# Existing Layout Audit

Audit of current AQVL spatial-layout logic prior to designing explicit spatial syntax (Phase 1.2). Covers the runtime layout strategies (`packages/runtime/src/core/layouts/*`, `LayoutManager.ts`, per-structure visualizers) and the renderer components that consume computed positions (`packages/renderer/src/components/**`), plus `AQVECanvas.tsx` camera behavior.

**Scope note on structures**: the codebase currently has no dedicated Trie or HashMap *renderer* component, and no Heap renderer at all. Trie and Heap nodes are rendered through `TreeRenderer` (they share `originalType` grouping with tree nodes at the `AQVECanvas` dispatch level), Heap's backing array is rendered through `ArrayRenderer`, and HashMap has no dedicated renderer — its buckets fall through to `ArrayRenderer` grouping by default (see HashMap section). This audit documents actual behavior, not the requested-but-nonexistent components.

**Architecture summary**: Position computation is centralized in `LayoutManager.updateLayout()` (`packages/runtime/src/core/LayoutManager.ts`), which groups scene elements by `logicalParent`, infers a `LayoutStrategy` per group from `originalType` heuristics, and writes results to `element.worldTarget` / `element.position`. Renderer components (`packages/renderer/src/components/library/*.tsx`) are largely presentational — they read already-computed `position` values, compute label placement (min/max X bounding box) and, for Stack/Queue, draw container geometry around the bounding box. Two structures (HashMap, and partially Heap) bypass `LayoutManager` and compute positions manually inside their algorithm visualizer.

---

## 1. Array

**Layout strategy**: Horizontal (or vertical) line, evenly spaced, centered on `startX`/`startY`.

- Strategy class: `ArrayLayoutStrategy` (`packages/runtime/src/core/layouts/ArrayLayoutStrategy.ts`)
- Sort key: `layoutSlot ?? logicalIndex` (line 35-38)
- Position formula (horizontal, default): `x = startX - totalLength/2 + i * spacing` (line 47); `totalLength = (n-1) * spacing` (line 40)

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `spacing` | `2.2` | `ArrayLayoutStrategy.ts:22` |
| `direction` | `'horizontal'` | `ArrayLayoutStrategy.ts:21` |
| `startX`/`startY`/`startZ` | `0` | `ArrayLayoutStrategy.ts:23-25` |
| Heap-array override `startY` | `-4` | `LayoutManager.ts:30` (`new ArrayLayoutStrategy({ startY: -4 })`) — pushes the heap's backing array below the tree view |
| Label height offset | `y + 1.2` | `ArrayRenderer.tsx:33` |
| Label font size | `0.4` | `ArrayRenderer.tsx:34` |

**Camera behavior**: No array-specific camera logic; picked up by the generic `CameraRig` centering/zoom (see §8).

**Renderer-computed values (migration checklist)**:
- [ ] `minX`/`maxX`/`y`/`z` bounding box for label centering (`ArrayRenderer.tsx:24-27`) — currently derived from element positions at render time; should come from AQIR/layout metadata instead of being recomputed per-frame from raw positions.
- [ ] Element sort order by `logicalIndex` (both in strategy and renderer) — duplicated logic in two places.

**Arbitrary/undocumented decisions** (flag for Phase 1.2):
- Why `2.2` spacing specifically (not e.g. `2.0`)? No comment/rationale.
- The `-4` Y-offset for heap arrays is a magic number chosen to visually separate the heap's array view from its tree view above — no formal relationship (e.g., "N units below tree's max depth") is computed; it's a fixed guess that will visually collide with tall trees.
- `direction: 'vertical'` branch exists (`ArrayLayoutStrategy.ts:49-52`) but nothing in the codebase currently sets it — dead/unused option.

---

## 2. Linked List

**Layout strategy**: Horizontal line, spacing-based, traversal order derived by walking forward-only adjacency starting at the `HEAD` element (not by `logicalIndex`).

- Strategy class: `LinkedListLayoutStrategy` (`packages/runtime/src/core/layouts/LinkedListLayoutStrategy.ts`)
- Builds `adjacency` map from non-backward edges (line 31-36), then walks from `HEAD` node (line 44-49) — order is graph-derived, not stored index.
- Position formula: same centered-line formula as Array (line 54): `x = startX - totalLength/2 + idx * spacing`

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `spacing` | `2.5` (wider than Array's 2.2 "for arrows") | `LinkedListLayoutStrategy.ts:17` |
| `startX`/`startY` | `0` | `LinkedListLayoutStrategy.ts:18-19` |
| `z` | hardcoded `0` regardless of `startZ` option (no `startZ` option exists) | `LinkedListLayoutStrategy.ts:57` |
| Label height offset | `y + 1.5` | `LinkedListRenderer.tsx:42` |
| Label font size | `0.4` | `LinkedListRenderer.tsx:44` |

**Camera behavior**: No list-specific logic; generic `CameraRig` only.

**Renderer-computed values (migration checklist)**:
- [ ] `minX`/`maxX`/`y`/`z` bounding box recomputed from node positions (`LinkedListRenderer.tsx:18-30`) for label placement.
- [ ] Edge/node render-order split (edges first, nodes second) is a renderer-level z-order decision (`LinkedListRenderer.tsx:52-59`), not encoded in AQIR.

**Arbitrary/undocumented decisions**:
- No explicit handling for circular linked lists — comment says "we don't support them yet" (`LinkedListLayoutStrategy.ts:41`) and a `visited` set guards against infinite loop by silently truncating.
- Traversal-order walk means a node not reachable from `HEAD` (orphaned/disconnected) gets **no position at all** (never added to `orderedNodes`) — silent failure mode, undocumented.
- No support for multiple linked lists sharing a layout offset (unlike Stack/Queue's `groupIdx` handling) — every `logicalParent` group gets its own strategy instance via `LayoutManager`, but there's no coordinated vertical/horizontal offset between multiple lists beyond the generic `offsetZ` in `LayoutManager.updateLayout` (see §7).

---

## 3. Stack

**Layout strategy**: Vertical column, elements stacked bottom-to-top from a fixed base Y; renderer additionally draws a U-shaped container mesh around the computed bounding box.

- Strategy class: `StackLayoutStrategy` (`packages/runtime/src/core/layouts/StackLayoutStrategy.ts`)
- Groups by `logicalParent` internally too (line 28-33) — this is redundant with `LayoutManager`'s own grouping-by-parent, since `LayoutManager` already only passes one group's elements to the strategy at a time; the strategy's internal grouping only fires if multiple stacks were ever passed together (currently never happens through `LayoutManager`, since it dispatches strategies per `logicalParent` already). Effectively dead code path today.
- Position formula: `y = startY + idx * spacing` (line 44), `x = startX + groupIdx * 3` (line 39, only relevant if multi-group ever occurs)

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `spacing` | `1.2` | `StackLayoutStrategy.ts:17` |
| `startY` | `-2` ("Start from bottom of the screen") | `StackLayoutStrategy.ts:19` |
| multi-stack `x` offset | `groupIdx * 3` | `StackLayoutStrategy.ts:39` |
| Container width | `2.0` | `StackRenderer.tsx:46` |
| Container height | `max(2, (n+1) * 1.2)` | `StackRenderer.tsx:47` — note the `1.2` here duplicates the strategy's `spacing` constant but is independently hardcoded, not imported/shared |
| Container base Y offset | `minY - 0.7` | `StackRenderer.tsx:49` |
| Wall thickness/depth | `0.2` × height × `1.2` | `StackRenderer.tsx:55` |
| Base slab size | `(width+0.2)` × `0.2` × `1.2` | `StackRenderer.tsx:83` |
| Label offset below base | `baseCenterY - 0.8` | `StackRenderer.tsx:97` |
| Label font size | `0.5` | `StackRenderer.tsx:98` |

**Camera behavior**: None specific; generic `CameraRig` only.

**Renderer-computed values (migration checklist)**:
- [ ] Full bounding box (`minX`,`maxX`,`minY`) recomputed from element positions (`StackRenderer.tsx:18-30`) purely to size/position the container mesh — this is a renderer inferring "how many elements, how tall a container" from raw positions rather than being told a container size.
- [ ] Container dimensions (`containerWidth`, `containerHeight`) are a rendering decoration computed from `elements.length`, duplicating the spacing constant from the layout strategy (`1.2` appears in both places, independently).

**Arbitrary/undocumented decisions**:
- The `1.2` reused in both `StackLayoutStrategy.spacing` and `StackRenderer`'s `containerHeight` formula is *coincidentally* the same value maintained in two files — a change to one silently desyncs container visuals from actual node spacing.
- `containerWidth = 2.0` is a flat constant regardless of node size/scale — will not adapt if node visual size changes.
- Multi-stack side-by-side offset (`groupIdx * 3`) is currently unreachable dead code (see above) but still represents an unvalidated assumption about spacing between multiple stacks.

---

## 4. Queue

**Layout strategy**: Horizontal line (same shape as Array/LinkedList), plus renderer draws an open "tube" (top/bottom bars) and Front/Rear labels.

- Strategy class: `QueueLayoutStrategy` (`packages/runtime/src/core/layouts/QueueLayoutStrategy.ts`)
- Internal per-`logicalParent` grouping again (line 28-33), same redundancy note as Stack.
- Position formula: `x = startX - totalLength/2 + idx * spacing` (line 44) — identical shape to Array's formula.

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `spacing` | `1.5` | `QueueLayoutStrategy.ts:17` |
| `startX`/`startY` | `0` | `QueueLayoutStrategy.ts:18-19` |
| multi-queue `y` offset | `groupIdx * 3` | `QueueLayoutStrategy.ts:40` |
| Container width | `max(2, (n+1) * 1.5)` | `QueueRenderer.tsx:48` — `1.5` duplicates the strategy's spacing constant, independently hardcoded |
| Top/bottom wall Y offset | `y ± 0.7` | `QueueRenderer.tsx:50-51` |
| Wall thickness/depth | `0.2` × width × `1.2` | `QueueRenderer.tsx:57` |
| Queue label offset | `topY + 0.5` | `QueueRenderer.tsx:85` |
| Queue label font size | `0.5` | `QueueRenderer.tsx:86` |
| Front/Rear label X offset | `minX - 1.2` / `maxX + 1.2` | `QueueRenderer.tsx:98,107` |
| Front/Rear font size | `0.3` | `QueueRenderer.tsx:99,108` |

**Camera behavior**: None specific; generic `CameraRig` only.

**Renderer-computed values (migration checklist)**:
- [ ] Bounding box (`minX`,`maxX`,`y`,`z`) recomputed from element positions for container + Front/Rear label placement (`QueueRenderer.tsx:18-30`).
- [ ] Container width formula duplicates the layout strategy's spacing constant (same issue as Stack).

**Arbitrary/undocumented decisions**:
- Same dead multi-group offset pattern as Stack (`groupIdx * 3`, effectively unreachable via `LayoutManager`).
- "Front"/"Rear" labels are positioned assuming `minX`=front and `maxX`=rear — this bakes in an assumption about insertion/removal direction that isn't validated against the actual queue semantics elsewhere; if enqueue ever pushed to the left, labels would be wrong with no guard.

---

## 5. Tree (also used for Heap-node view and Trie)

**Layout strategy**: Classic hierarchical/Reingold-Tilford-style tree layout — recursive subtree-width computation, then coordinate assignment top-down.

- Strategy class: `TreeLayoutStrategy` (`packages/runtime/src/core/layouts/TreeLayoutStrategy.ts`)
- Root detection via in-degree 0 (line 66-71); falls back to "first node found" if no clear root (cycle/disconnected graph) — line 74-77.
- Two-pass: `computeWidthAndDepth` (line 99-115, post-order) then `assignCoordinates` (line 117-127, pre-order).
- `dynamicStartY` (line 83): `max(startY, 0.5 + (maxDepth-1) * levelSpacing)` — grows the tree's vertical start based on its own depth so deep trees don't clip into the ground plane.

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `levelSpacing` (vertical gap between depths) | `2.0` | `TreeLayoutStrategy.ts:28` |
| `siblingSpacing` (horizontal leaf width) | `1.5` | `TreeLayoutStrategy.ts:29` |
| `startX` | `0` | `TreeLayoutStrategy.ts:30` |
| `startY` default | `0`, but overridden to `2` for actual trees via `LayoutManager.ts:29` (`new TreeLayoutStrategy({ startY: 2 })`) | |
| Ground-clip guard constant | `0.5` (min Y for deepest possible node) | `TreeLayoutStrategy.ts:83` |
| Debug `console.log` left in production code | — | `TreeLayoutStrategy.ts:38` |

**Camera behavior**: Tree-specific — `CameraRig` explicitly special-cases `TREE_NODE`/`HEAP_NODE`/`TRIE_NODE` types (see §8 for full detail): it tracks `maxTreeY` and re-centers the orbit target's Y at `maxTreeY / 2` instead of `0`.

**Renderer-computed values (migration checklist)**:
- [ ] `TreeRenderer.tsx` itself does no bounding-box math (unlike Array/List/Stack/Queue) — it only splits nodes vs. edges and controls z-order (edges first, line 19-26). No label rendering at all (no tree-name label, unlike other structures) — inconsistent with the rest of the renderer library.
- [ ] Node in-degree / root inference (`TreeLayoutStrategy.ts:66-77`) is layout-side "logic" that arguably belongs to the algorithm/AQIR layer (tree shape should be a language-level fact, not inferred from edge in-degree at render time).

**Arbitrary/undocumented decisions**:
- Root-finding by in-degree 0, with silent fallback to "first node" on ambiguity (cycle/disconnected) — no error/warning surfaced to the user, could silently misdraw a malformed tree.
- No `startZ` option at all (three-arg constructor pattern from other strategies dropped here); z is implicitly `0` before `LayoutManager`'s group `offsetZ` is applied.
- Reused wholesale for Heap-as-tree and Trie — i.e., there's no heap-specific layout (e.g., no complete-binary-tree index-based `2i+1`/`2i+2` placement — it's derived purely from edges like a generic tree) and no Trie-specific layout (e.g., no per-character-branch fan-out logic) — both structures get generic binary/N-ary tree layout with identical spacing constants, which will visually break for Tries with high branching factor (e.g., 26-way).
- Leftover `console.log` (`TreeLayoutStrategy.ts:38`) fires every layout pass — noise, not a design decision, but worth flagging for cleanup alongside the audit.

---

## 6. Graph

**Layout strategy**: Force-directed simulation (Fruchterman-Reingold-style: Coulomb repulsion + Hooke spring attraction + center gravity + simulated-annealing cooling).

- Strategy class: `GraphLayoutStrategy` (`packages/runtime/src/core/layouts/GraphLayoutStrategy.ts`)
- Initialization: nodes placed in a unit circle of `radius = 2.0` (line 38) before simulation starts (line 36-44).
- Runs `iterations` full O(n²) passes synchronously inside `applyLayout` (line 52-128) — this is a **blocking**, non-incremental computation; for any non-trivial graph this re-runs from scratch on every `updateLayout()` call (no position caching/seeding from previous frame), so node identity/position stability across edits is not guaranteed.

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| `iterations` | `100` | `GraphLayoutStrategy.ts:21` |
| `repulsion` (Coulomb constant) | `5.0` | `GraphLayoutStrategy.ts:22` |
| `springLength` (rest length) | `2.0` | `GraphLayoutStrategy.ts:23` |
| `springTension` (Hooke's constant) | `0.1` | `GraphLayoutStrategy.ts:24` |
| `gravity` (center-pull coefficient) | `0.05` | `GraphLayoutStrategy.ts:25` |
| Initial placement radius | `2.0` | `GraphLayoutStrategy.ts:38` |
| Cooling factor | `0.95` per iteration (`temperature *= 0.95`) | `GraphLayoutStrategy.ts:127` |
| Degenerate-overlap jitter | `Math.random() - 0.5` when `distSq === 0` | `GraphLayoutStrategy.ts:69-70` |

**Camera behavior**: No graph-specific special-case in `CameraRig`, but graphs are the primary driver of the generic "auto zoom out for wide spans" behavior (§8) since force-directed layouts can produce arbitrarily wide bounding boxes.

**Renderer-computed values (migration checklist)**:
- [ ] `GraphRenderer.tsx` (like `TreeRenderer`) does no bounding-box/label math — just node/edge split and z-order. No graph-name label rendered.
- [ ] Because the simulation re-seeds and re-runs from scratch every layout pass, **node positions are not stable/deterministic across edits** — this is itself a "computed value" (the entire coordinate set) that has no persistence/AQIR representation; every incremental graph mutation (add/remove vertex or edge) currently implies a full re-layout with no continuity guarantee. This is the single largest migration item for Graph.

**Arbitrary/undocumented decisions**:
- All five force-directed constants (repulsion, spring length/tension, gravity, iteration count) are tuned by feel with no documented derivation or reasoning in comments.
- No maximum bound/clamping on final layout extents — a large or highly connected graph can produce very large spans, relying entirely on `CameraRig`'s reactive zoom-out (§8) to stay in frame, rather than any layout-side normalization.
- No seed/RNG control — `Math.random()` jitter (line 69-70) means layout is technically non-deterministic in degenerate (exactly-overlapping) cases, though rare in practice given initial circular seeding.

---

## 7. LayoutManager (cross-cutting orchestration)

Not a "renderer," but the central dispatcher all of the above strategies flow through — audited here since its heuristics and offsets apply globally.

**File**: `packages/runtime/src/core/LayoutManager.ts`

**Strategy inference** (`updateLayout`, line 78-112): when no explicit strategy is registered for a `logicalParent` (via `setStrategy`, which nothing in the audited code currently calls), the manager guesses the structure type from `originalType` fields, in this precedence order: Heap-node → Heap-array → Tree/Trie → Queue → Stack → LinkedList → Graph-has-vertex → has-generic-edges (falls back to **tree** strategy, line 106) → Grid → default (**Array** strategy, line 110).

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| Cross-group Z offset | `i * -6` per group, pushes each distinct `logicalParent` group backward in Z to avoid overlap | `LayoutManager.ts:137` |
| Tree strategy `startY` | `2` | `LayoutManager.ts:29` |
| Heap-array strategy `startY` | `-4` | `LayoutManager.ts:30` |
| Fallback position for `getPositionForLogicalIndex` | `{x: index * 1.5, y: 0, z: 0}` | `LayoutManager.ts:185` — explicitly commented as legacy/fallback, "old hardcoded logic," unrelated to any current strategy's actual spacing (Array uses `2.2`, this uses `1.5`) |

**Renderer/runtime-computed values (migration checklist)**:
- [ ] Structure-type inference from `originalType` string matching (line 81-89) is effectively "layout selection logic" living in the runtime rather than being declared explicitly by the source language/AQIR — a `logicalParent` group's visual layout is implicit, not declared.
- [ ] `offsetZ = i * -6` ordering depends on `Object.keys(groupedElements)` iteration order (JS insertion order) — i.e., *which* structure ends up in front/behind another in Z is incidental to element-creation order, not an explicit scene-composition decision.
- [ ] Reserved-slot virtual-element injection (line 114-131) for Array in-progress-insert placeholders is a layout-time synthesis of elements that don't exist in the real scene graph — a computed/synthetic value with no AQIR representation.

**Arbitrary/undocumented decisions**:
- `getPositionForLogicalIndex` (line 181-186) is dead-ish/legacy code with a self-admitted stale hardcoded spacing value (`1.5`, doesn't match any live strategy) — comment says "kept for backward compatibility," should be flagged for removal or reconciliation.
- Precedence order of type-inference checks (line 91-110) is unexplained — e.g., why "has generic edges" falls back to tree layout rather than graph layout is not documented, and could silently mis-lay-out a non-tree edge-having structure that isn't caught by an earlier, more specific check.
- `setStrategy()` public API exists but has no callers in the audited code — dead extension point, not verified to actually work end-to-end.

---

## 8. Camera (AQVECanvas / CameraRig)

**File**: `packages/renderer/src/components/AQVECanvas.tsx`

**Camera automation**: `CameraRig` (line 18-67) runs every frame (`useFrame`) while `autoFollow` is `true` (default `true`, toggled off the instant the user manually drags `OrbitControls`, restored only via the "Reset Camera" button — line 70, 80-82, 73-78).

Per frame, when `autoFollow` is active:
1. Computes centroid X (`totalX / count`) and per-element X extent across **all** scene elements (line 30-43) — not per-structure, global across the whole scene.
2. Detects presence of any `TREE_NODE`/`HEAP_NODE`/`TRIE_NODE` element and tracks `maxTreeY` (line 31-36).
3. Lerps orbit `target.x` toward centroid X at rate `0.04` (line 49).
4. Lerps orbit `target.y` toward `maxTreeY / 2` if any tree-type element exists, else toward `0` (line 51-56).
5. If X span (`maxX - minX`) exceeds `6`, lerps camera Z position toward `clamp(8 + spanX * 0.75, 10, 30)` at rate `0.03` (line 59-63) — auto zoom-out for wide scenes.

**Hardcoded parameters**:
| Param | Value | Location |
|---|---|---|
| Target-X lerp rate | `0.04` | `AQVECanvas.tsx:49` |
| Target-Y lerp rate | `0.04` | `AQVECanvas.tsx:53,55` |
| Wide-scene trigger threshold | `spanX > 6` | `AQVECanvas.tsx:60` |
| Ideal-Z formula | `clamp(8 + spanX * 0.75, 10, 30)` | `AQVECanvas.tsx:61` |
| Z lerp rate | `0.03` | `AQVECanvas.tsx:62` |
| Initial camera position | `[0, 3, 10]`, `fov: 45` | `AQVECanvas.tsx:113` |
| `OrbitControls` distance clamp | `min 2`, `max 35` | `AQVECanvas.tsx:231-232` |
| Polar angle clamp | `maxPolarAngle = π/2 - 0.05` ("prevent going under the floor") | `AQVECanvas.tsx:233` |
| Damping factor | `0.05` | `AQVECanvas.tsx:230` |
| Grid size/cell/section | `30×30` area, `cellSize 1`, `sectionSize 3`, fade distance `25` | `AQVECanvas.tsx:130-141` |
| Contact shadow | `opacity 0.6`, `scale 20`, `blur 2.5`, `far 4` | `AQVECanvas.tsx:143` |
| Cross-group Z-offset multiplier (`-6`, see §7) also directly affects what the camera considers "in view," since Z-separated groups widen effective framing needs — not itself in this file but tightly coupled | — | `LayoutManager.ts:137` |

**Camera behavior notes**:
- Auto-fit/auto-pan/auto-zoom are all reactive/continuous (every frame lerp), not "fit to bounds once" — there's no one-shot camera-fit-to-scene call; it's a perpetual soft-follow.
- Tree-specific Y-centering logic exists (§5) but Graph/Array/List/Stack/Queue get no analogous specialized framing — e.g., a very tall Stack (many elements) gets no Y-centering equivalent to Tree's, only the generic X-centering + Z-distance zoom.
- "Reset Camera" only calls `controlsRef.current.reset()` (drei's default, resets to the `Canvas`'s initial camera prop) and re-enables `autoFollow` — it does not itself compute a fit-to-content position.

**Renderer-computed values (migration checklist)**:
- [ ] Global scene bounding-box scan (centroid X, min/max X, max tree Y) recomputed **every frame** from live element positions (`AQVECanvas.tsx:30-43`) — expensive-ish (O(n) per frame across all elements) and entirely derived from renderer-visible state; nothing here is informed by structure semantics beyond the tree-type check.

**Arbitrary/undocumented decisions**:
- All five automation constants (`0.04`, `0.04`, `6`, `8 + spanX*0.75` clamped `10..30`, `0.03`) are tuned by feel, no documented rationale.
- Tree-only Y-centering is a special case with no stated design principle for why trees get it and nothing else does (arguably because trees are the only structure with meaningful vertical extent today, but this isn't written down anywhere and will need revisiting once e.g. tall Stacks or multi-row Grids are common).
- Background color `#111111`, lighting intensities (`ambientLight 0.4`, `directionalLight 1.5`), and `Environment preset="city"` (line 115-127) are visual/lighting choices unrelated to spatial layout, included here only because they live in the same audited file — not in scope for AQIR migration.

---

## 9. HashMap (no dedicated renderer — flagged as gap)

Not requested explicitly in the audit's structure list but present in the codebase and directly relevant to "arbitrary/undocumented" findings, since it **bypasses `LayoutManager`'s structure-aware strategies entirely**.

**File**: `packages/runtime/src/core/algorithms/HashMapVisualizer.ts`

- Buckets (`HASHMAP_BUCKET`, one per capacity slot) are laid out via `context.layoutManager.updateLayout(buckets)` (line 124) — but `LayoutManager`'s type-inference (§7) has **no case for `HASHMAP_BUCKET`**, so buckets silently fall through to the **default strategy = `ArrayLayoutStrategy`** (`LayoutManager.ts:16,110`), i.e., a horizontal row using Array's `2.2` spacing — undocumented, incidental reuse rather than a designed HashMap layout.
- Entries (`HASHMAP_ENTRY`) are **not** run through `LayoutManager` at all — `placeEntry()` (line 147-152) manually computes `entry.worldTarget = { x: bucket.x, y: bucket.y - (chainIndex+1) * CHAIN_SPACING, z: bucket.z }`, stacking a bucket's chained entries directly beneath it.
- `CHAIN_SPACING = 1.1` (`HashMapVisualizer.ts:27`) — a third independent spacing constant, unrelated to any `LayoutStrategy` file, that a future AQIR migration would need to capture.
- No renderer component exists for HashMap in `packages/renderer/src/components/library/` — buckets/entries presumably render through generic `SceneElementRenderer`/`BoxRenderer` fallback (`AQVECanvas.tsx`'s dispatch switch has no `HASHMAP_*` branch — worth confirming whether HashMap elements currently render at all via the `standalone` bucket at `AQVECanvas.tsx:182-184`, which only catches `box`/`sphere`/`cylinder` types with no `logicalParent`-grouped label/container treatment).

**Arbitrary/undocumented decisions**:
- HashMap layout is entirely ad hoc/manual (bypasses the strategy pattern used by every other structure) — this is the clearest candidate in the whole audit for "needs an explicit `HashMapLayoutStrategy`" before any AQIR migration, since right now its spatial rules exist only as inline arithmetic in the visualizer.
- No label/container rendering exists for HashMap at all (no name label, no bucket-array framing) — inconsistent with Array/List/Stack/Queue, all of which label their structure.

---

## Summary Table

| Structure | Layout Strategy | Key Hardcoded Params | Camera Auto? | Renderer-Computed Values |
|---|---|---|---|---|
| Array | Horizontal line, centered | `spacing 2.2`; heap-array `startY -4` | Generic only (X-center, Z-zoom) | Label bbox (min/max X) |
| Linked List | Horizontal line, HEAD-traversal order | `spacing 2.5` | Generic only | Label bbox; edge/node z-order |
| Stack | Vertical column from base | `spacing 1.2`; `startY -2`; container `width 2.0`, `height (n+1)*1.2` | Generic only | Full bbox for container sizing; container dims duplicate spacing const |
| Queue | Horizontal line | `spacing 1.5`; container `width (n+1)*1.5`; Front/Rear offsets `±1.2` | Generic only | Full bbox for container + Front/Rear labels; container dims duplicate spacing const |
| Tree (+ Heap-node, Trie) | Hierarchical (subtree-width + depth pass) | `levelSpacing 2.0`; `siblingSpacing 1.5`; `startY 2`; ground guard `0.5` | **Tree-specific**: Y-centers on `maxTreeY/2` | Root inference by in-degree; no label/bbox math in renderer |
| Graph | Force-directed (Coulomb+Hooke+gravity) | `iterations 100`; `repulsion 5.0`; `springLength 2.0`; `springTension 0.1`; `gravity 0.05`; init radius `2.0` | Generic only (biggest driver of wide-span zoom-out) | Entire position set recomputed from scratch every layout pass — no stability/persistence |
| HashMap | **None** — buckets fall through to Array default; entries placed manually | `CHAIN_SPACING 1.1` (independent, ad hoc) | Generic only | No renderer component; no label/container |
| LayoutManager (cross-cutting) | Dispatch/inference + Z-offset | Group `offsetZ = i * -6`; legacy fallback spacing `1.5` | — | Type inference from `originalType` strings; synthetic virtual elements for reserved slots |
| Camera (CameraRig) | Reactive soft-follow, not fit-once | X/Y lerp `0.04`; Z lerp `0.03`; zoom trigger `spanX>6`; ideal-Z `8+spanX*0.75` clamped `[10,30]` | Global scan every frame | Global scene bbox + tree-Y recomputed every frame |

---

## Migration Checklist — Values Moving from Frontend/Runtime → AQIR/Language

Grouped by what kind of value each is, since they'll likely map to different AQIR constructs:

**Structural layout parameters** (should become named, overridable AQIR/language defaults rather than TS constructor defaults):
- [ ] Array: `spacing (2.2)`, `direction`, heap-array `startY (-4)`
- [ ] LinkedList: `spacing (2.5)`
- [ ] Stack: `spacing (1.2)`, `startY (-2)`
- [ ] Queue: `spacing (1.5)`
- [ ] Tree: `levelSpacing (2.0)`, `siblingSpacing (1.5)`, `startY (2)`, ground-clip guard `(0.5)`
- [ ] Graph: `iterations (100)`, `repulsion (5.0)`, `springLength (2.0)`, `springTension (0.1)`, `gravity (0.05)`, init radius `(2.0)`, cooling `(0.95)`
- [ ] HashMap: `CHAIN_SPACING (1.1)` — needs to become a real, first-class strategy input, not inline arithmetic
- [ ] Cross-structure Z separation: `offsetZ = i * -6` in `LayoutManager`

**Decorative/derived rendering parameters** (container sizes, label offsets — currently duplicate or derive from the above, should reference a single source of truth):
- [ ] Stack container `width (2.0)`, `height formula ((n+1)*1.2)` — duplicates Stack spacing
- [ ] Queue container `width formula ((n+1)*1.5)`, wall offsets `(±0.7)`, Front/Rear label offsets `(±1.2)` — duplicates Queue spacing
- [ ] All per-structure label font sizes/offsets (Array `1.2`/`0.4`, List `1.5`/`0.4`, Stack `-0.8`/`0.5`, Queue `+0.5`/`0.5`+Front/Rear `0.3`)

**Computed/inferred structural facts** (currently inferred at layout time from raw scene data — should be explicit facts the language/AQIR carries):
- [ ] Tree root detection via in-degree-0 with silent "first node" fallback
- [ ] LinkedList traversal order via HEAD-walk (silently drops unreachable nodes)
- [ ] Structure-type inference from `originalType` string matching in `LayoutManager` (Array vs Stack vs Queue vs Tree vs Graph vs Grid)
- [ ] HashMap's complete absence of strategy dispatch (currently accidental Array fallback)

**Bounding-box / framing values** (currently recomputed per-frame or per-render from live positions; should potentially be provided by layout/AQIR rather than re-derived):
- [ ] Per-structure label-centering bbox (Array, LinkedList, Stack, Queue renderers)
- [ ] Global scene bbox + tree max-Y, recomputed every frame in `CameraRig`
- [ ] Camera automation constants themselves (`0.04`/`0.04`/`0.03` lerp rates, `spanX>6` threshold, `8+spanX*0.75` clamped `[10,30]` ideal-Z) — candidates for becoming configurable "camera behavior" settings rather than fixed constants, if Phase 1.2 wants scene-level camera control

**Dead/legacy code surfaced during audit** (not layout design decisions, but should be resolved before/during migration so they don't get carried forward by accident):
- [ ] `LayoutManager.getPositionForLogicalIndex` — stale hardcoded `1.5` spacing, self-described as legacy fallback
- [ ] `TreeLayoutStrategy` leftover `console.log` (line 38)
- [ ] Stack/Queue strategies' internal per-`logicalParent` grouping — unreachable given `LayoutManager` already groups by parent before dispatch
- [ ] `ArrayLayoutStrategy`'s `direction: 'vertical'` branch — never invoked anywhere in the codebase
- [ ] `LayoutManager.setStrategy()` — public API with no callers

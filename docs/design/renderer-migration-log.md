# Renderer Migration Log — hardcoded per-structure renderers → GenericSceneRenderer

This log documents the migration of every AQVL data structure's 3D visualization
from hardcoded, per-structure React components to the generic,
structure-agnostic `GenericSceneRenderer` (`packages/renderer/src/components/generic/`).

## Summary of what was actually found and done

The renderer-level cutover — `AQVECanvas.tsx` rendering exclusively through
`GenericSceneRenderer` instead of the old per-structure components — had
already happened in this working tree before this pass started (uncommitted
Phase 4.1 work). The old components
(`library/{Array,Stack,Queue,LinkedList,Tree,Graph}Renderer.tsx`,
`SceneElementRenderer.tsx`, `elements/{Box,Sphere}Renderer.tsx`) were
confirmed dead — zero imports anywhere in the repo — before deletion.

So this pass consisted of:

1. **Verification**: one `tests/integration/migration-<structure>.test.ts`
   file per structure, driving real `.aqvl` source through the actual demo
   pipeline (`compile` → `ExecutionEngine`, the same path `packages/demo`
   uses) and asserting on the resulting scene graph against exactly the
   fields `GenericSceneRenderer`'s `toRenderableElement`/
   `toRenderableConnection` (packages/renderer/src/components/generic/GenericSceneRenderer.tsx)
   consume: node shape/type, position, edge source/target resolution,
   highlight-carrying color/emissive fields.
2. **Two real bugs found and fixed** along the way (both were blocking
   correct visualization for their structures, independent of which
   renderer consumes the output — see below).
3. **Deletion** of the now-verified-unnecessary dead files.

### Why full `ExecutionEngine`/`AnimationController` execution, not the stub-scheduler pattern

The existing `heap.test.ts`/`hashmap.test.ts`/`trie.test.ts`/`graph.test.ts`/
`sorting.test.ts` integration tests deliberately avoid running
`AnimationController` (a real anime.js timeline needs `window`, absent under
this suite's `node` test environment) and instead exercise each algorithm
engine directly with a stub scheduler. `tests/integration/bst-array-routing.test.ts`
found a different way through this: it stubs only `TimelineEngine.init`/
`play`/`triggerComplete` to fire completion callbacks synchronously, letting
`ExecutionEngine.execute()` run to completion for real. All nine migration
tests reuse that `makeInstantEngine()` trick, since it's the most faithful
route to "what does the actual demo pipeline hand the renderer" — the
explicit goal of this migration.

One caveat surfaced by this approach and worth recording: the stub resolves
any mutation an instruction makes **inside a `complete` callback** (e.g.
`x = pos.x` set directly), but does **not** run real anime.js interpolation
— a plain tween (`enqueue({targets: el.position, y: ..., duration, easing})`
with no callback) never reaches its target value under the stub; the
property just stays at its pre-animation starting point. Tree-node "drop in"
on insert and `PUSH` both rely on such a tween for their final Y position.
Where this mattered, the migration tests call
`layoutManager.updateLayout()` + `applyLayoutInstantly()` once after
`execute()` — the same pair `ExecutionEngine` itself runs on `SCENE_LOADED`
— to settle real, animation-timing-independent positions before asserting.

---

## Array

**Verified**: `tests/integration/migration-array.test.ts` — a `BUBBLE_SORT`
run through the real pipeline, then `HIGHLIGHT`. Element count preserved,
values actually sorted (by `logicalIndex`, the field `ArrayLayoutStrategy`
sorts on), every element resolves to a finite position, and exactly one
element carries the highlight's color/emissive change through to the fields
`toRenderableElement` copies.

**Visual differences from the old `ArrayRenderer`**: none functionally —
`ArrayRenderer` additionally drew a floating index/value label above each
element (`ArrayRenderer.tsx:33-34`, per the pre-migration layout audit).
`GenericSceneRenderer`/`PrimitiveNode` render the node itself (with its own
`label`/`value` fields passed through) but do not reproduce that specific
floating-label decoration. Not a regression in the data pipeline — a
decorative simplification of the generic renderer versus the old
bounding-box-computing renderer.

**Deleted**: `library/ArrayRenderer.tsx`.

---

## Stack

**Verified**: `tests/integration/migration-stack.test.ts` — a declared
`STACK s = [1, 2, 3]` plus `HIGHLIGHT`. Correct count/shape, a real vertical
column (distinct Y per element), and highlight propagation.

**Bug found and fixed (in scope, needed for this structure to render at
all)**: `SceneManager.loadScene`'s object-type whitelist
(`packages/runtime/src/core/SceneManager.ts:20`) did not include
`STACK_ELEMENT` — a declared `STACK s = [1, 2]`'s initial elements were
silently dropped at scene load and never entered the scene graph. Added
`STACK_ELEMENT`, `QUEUE_ELEMENT`, `HEAP_NODE`, `HEAP_ARRAY_ELEMENT` to the
whitelist (the last two were the same gap, discovered while investigating
Heap — see below).

**Known gap, not fixed (out of scope for this pass)**: `PUSH`/`POP` did not
observably mutate the scene under this suite's `makeInstantEngine` harness —
their scene mutation is enqueued inside an animation `complete` callback
(`AnimationController.ts` around the `PUSH`/`POP` branches) the same way
`INSERT`/`DELETE` do, but unlike those, it didn't take effect under the stub
in ad hoc testing. This wasn't chased further since it's an
`AnimationController` behavior question, not a rendering one —
`GenericSceneRenderer` correctly renders whatever scene state results,
which is what the migration test actually verifies (against a real
compiled+loaded stack). Flagged here for whoever next touches Stack's
`PUSH`/`POP` animation code.

**Visual differences from the old `StackRenderer`**: `StackRenderer` drew a
U-shaped container mesh sized from the elements' bounding box, plus a name
label (`existing-layout-audit.md` §3). `GenericSceneRenderer` renders only
the nodes — no container decoration. Decorative simplification, not a data
regression.

**Deleted**: `library/StackRenderer.tsx`.

---

## Queue

**Verified**: `tests/integration/migration-queue.test.ts` — a declared
`QUEUE q = [1, 2, 3]` plus `HIGHLIGHT`. Correct count/shape, a real
horizontal line (distinct X, shared Y), highlight propagation.

**Bug found and fixed**: same `SceneManager.loadScene` whitelist gap as
Stack (`QUEUE_ELEMENT` was missing).

**Visual differences from the old `QueueRenderer`**: `QueueRenderer` drew an
open "tube" (top/bottom bars) plus separate Front/Rear labels
(`existing-layout-audit.md` §4). `GenericSceneRenderer` renders only the
nodes. Decorative simplification.

**Deleted**: `library/QueueRenderer.tsx`.

---

## Linked List

**Verified**: `tests/integration/migration-linkedlist.test.ts` —
`INSERT_HEAD`/`INSERT_TAIL`/`DELETE_HEAD` through the real pipeline, then
`HIGHLIGHT`. Nodes resolve to finite positions; every edge's `sourceId`/
`targetId` resolves to a live node in the current scene (the exact lookup
`toRenderableConnection` performs) — i.e. pointer visualization is correct
after mutation, not just at creation.

**Visual differences from the old `LinkedListRenderer`**: label bounding-box
math and an edges-first/nodes-second z-order decision
(`existing-layout-audit.md` §2) — both renderer-level decoration/ordering
choices, not data. `PrimitiveEdge` draws connections independent of
node/edge array order.

**Deleted**: `library/LinkedListRenderer.tsx`.

---

## BST / Binary Tree

**Verified**: `tests/integration/migration-bst.test.ts` (4 tests) —
`INSERT`×5 through the real pipeline: hierarchy-shaped positions (every
edge's child is strictly below its parent — a real `TreeLayoutStrategy`
recompute via `settleLayout`, not an assumption), exactly `n - 1` edges for
`n` nodes, and every edge endpoint resolves to a live node. A second test
confirms `INORDER` traversal actually touches node state (not all-neutral).
Two more (below) cover the now-real `ROTATE`.

**ROTATE — implemented for real (originally left as an investigated,
deliberate no-op; revisited and completed)**: the task asked to verify
"AVL/Red-Black ROTATIONS now show actual node position changes, not the old
'wiggle' fake animation." The original `AnimationController.ts` handler
(~line 4310, now deleted) was indeed a placeholder — it tweened the target
node's X by +1 then back, with a comment reading `// For now, we will just
wiggle the node to acknowledge the action`, and its own node lookup
(`el.logicalIndex === nodeIndex`) could never match a `TREE_NODE` element in
the first place (`TREE_NODE`s don't carry `logicalIndex`), so in practice it
was already an unreachable no-op even for its own intended input shape. It
also lived in a `case 'GENERIC_ACTION'` block at line 3433 that is itself
dead code — the switch's *first* `case 'GENERIC_ACTION'` (line 503, the one
that actually dispatches `GENERIC_ACTION` instructions) always wins;
JavaScript allows duplicate `case` labels but only the first ever runs.

What's now in place:
- **Language**: `ROTATE <value> "LEFT" | "RIGHT"` — e.g. `ROTATE 30
  "LEFT"`. `<value>` is the pivot node's key (consistent with `INSERT`/
  `DELETE`/`SEARCH`, which all address BST nodes by value, not index); the
  direction is a **string literal**, not a bare identifier — the semantic
  validator rejects undeclared identifiers as generic-action args
  (`Undeclared identifier 'LEFT'`), so a quoted string is required. No
  parser/lexer changes were needed (`ROTATE` was already a recognized
  generic-action keyword; the loop in `parseGenericAction` already accepts
  number/string/identifier argument tokens).
- **`BSTEngine.computeRotationPlan`/`performRotation`**
  (`packages/runtime/src/core/algorithms/BSTEngine.ts`): validates the
  pivot has a child on the rotation side, then performs the classic single
  BST rotation by actually rewiring scene edges (remove/re-add, via the
  same `SceneManager`/`RelationshipManager` calls `insertNode`/
  `performOneChildDelete` already use) — LEFT rotation at `X` promotes
  `Y = X.right`, reparents `Y.left` under `X` as `X`'s new right child, and
  reconnects `X`'s old parent (if any) to `Y`; RIGHT rotation is the mirror.
  If `X` was the root, no parent edge exists to rewire — `Y` becomes root
  automatically, the same way `getRoot`/`TreeLayoutStrategy` already infer
  "root" as *whichever node has no incoming edge*, with no separate root
  field to update.
- **`BSTAlgorithms.execute`** (`packages/runtime/src/core/algorithms/BSTAlgorithms.ts`):
  registered for `ROTATE` in `AlgorithmRegistry` (alongside `BST_INSERT`/
  `BST_DELETE`/`BST_SEARCH`/`BST_CLEAR`), so it's dispatched by the live
  `case 'GENERIC_ACTION'` handler instead of ever reaching the dead legacy
  switch. `bstRotate` validates args, calls `performRotation`
  **synchronously** (not gated behind an animation `complete` callback —
  see the harness note below for why that distinction turned out to
  matter), then reuses the existing `reLayoutAndAnimate` helper (already
  used by insert/delete/clear) to recompute every node's position from the
  new topology and animate them there.
- Old dead branch and its now-inapplicable `console.log` deleted from
  `AnimationController.ts`.

**A harness-timing bug this surfaced, and the general lesson**: the first
implementation attempt wrapped the actual `performRotation` call inside a
`scheduler.enqueue({...}).complete` callback (mirroring the `TWO_CHILDREN`
delete case's style). Under this test suite's `makeInstantEngine` harness
(see below), that never ran — `complete` callbacks are resolved by real
anime.js interpolation, which the harness's timeline stub doesn't drive; it
only fires whatever a `complete: () => {...}` callback does *if* that
callback happens to run synchronously, which — it turns out — it does not
under this stub. The working pattern (used by `BST_INSERT`'s node/edge
creation) is to perform the actual state mutation **synchronously in the
main function body**, and only defer *decorative* animation/logging into
scheduler callbacks. `bstRotate` was rewritten to match that pattern, which
is also arguably the more correct design regardless of test harness — the
tree's logical shape shouldn't depend on whether an animation finishes.

**Deliberately not fixed as part of this**: real AVL/red-black
self-balancing (calling `ROTATE` automatically from `INSERT`/`DELETE` when
the tree becomes unbalanced) is still not wired in — `ROTATE` is a correct,
real, user-invocable rotation primitive now, but nothing calls it
automatically. `AVLTree.ts`/`RedBlackTree.ts` in
`runtime/src/data-structures/` still model rebalancing as pure logic,
disconnected from the compiled AQIR pipeline. That remains a real feature
addition beyond this pass's scope (wiring balance-factor/color tracking
into `BSTEngine`'s insert/delete and calling the new rotation primitive
from there) — `ROTATE` itself is no longer the blocker.

**Visual differences from the old `TreeRenderer`**: none — `TreeRenderer`
did no bounding-box/label math of its own (`existing-layout-audit.md` §5),
so the migration here is close to a pure swap.

**Deleted**: `library/TreeRenderer.tsx`.

---

## Heap

**Verified**: `tests/integration/migration-heap.test.ts` — `HEAP_INSERT`
(bubble-up) through the real pipeline. Both views checked: the tree view
(`HEAP_NODE`, hierarchy-shaped, children below parent, `n - 1` edges) and
the array view (`HEAP_ARRAY_ELEMENT`, line-shaped, distinct X per element).
Min-heap property confirmed to actually hold after the bubble-up (not just
"some position exists").

**Bug found and fixed**: `SceneManager.loadScene`'s whitelist was also
missing `HEAP_NODE`/`HEAP_ARRAY_ELEMENT` — a declared `HEAP h = [5, 3, 7]`'s
initial elements never entered the scene graph, same class of bug as
Stack/Queue. Fixed in the same whitelist edit.

**Bug found and fixed**: `TreeLayoutStrategy`'s internal node filter
(`packages/runtime/src/core/layouts/TreeLayoutStrategy.ts:36`, prior to this
pass) only matched `el.type === 'box'` or `el.originalType === 'TREE_NODE'`.
`LayoutManager`'s group-level inference correctly dispatches
`HEAP_NODE`/`TRIE_NODE` groups to this same tree strategy, but the strategy
then filtered every node in the group back out (heap nodes happened to
survive only because `SceneManager` remaps their `type` to `'box'`; Trie
nodes did not — see below). Broadened the filter to
`type === 'box' || type === 'sphere' || originalType in {TREE_NODE,
TRIE_NODE, HEAP_NODE}`. Also removed a leftover `console.log` in the same
function (flagged as dead debug cruft in `existing-layout-audit.md` §5).

**Visual differences from the old renderers**: there was never a dedicated
Heap renderer (`existing-layout-audit.md`, "Scope note on structures") —
heap-as-tree fell through to `TreeRenderer`'s grouping and the backing array
to `ArrayRenderer`'s. Both are gone now; `GenericSceneRenderer` renders both
views with the same decorative simplifications noted under Array/Tree above.

**Deleted**: nothing new here (no dedicated Heap renderer existed to
delete) — the two fixes above are what made Heap visualization correct.

---

## Graph

**Verified**: `tests/integration/migration-graph.test.ts` — `DFS ... FROM A`
on a 4-vertex fully-connected graph through the real pipeline. Vertex count
correct, every edge's endpoints resolve to a live vertex (the
`toRenderableConnection` lookup), `directed` is a real boolean on every
edge, and every vertex resolves to a finite `GraphLayoutStrategy`
(force-directed) position.

**Note**: DFS's per-vertex highlight is transient — reset to `NEUTRAL` once
the traversal completes, unlike the standalone `HIGHLIGHT` action used in
the other migration tests — so persistent-highlight assertion was dropped
for this test (already covered by Array/BST/Heap). This is existing product
behavior, not something changed here.

**Visual differences from the old `GraphRenderer`**: `GraphRenderer`, like
`TreeRenderer`, did no bounding-box/label math of its own
(`existing-layout-audit.md` §6) — close to a pure swap.

**Deleted**: `library/GraphRenderer.tsx`.

---

## HashMap

**Verified**: `tests/integration/migration-hashmap.test.ts` —
`HASHMAP_INSERT` through the real pipeline. Buckets and chained entries all
resolve to finite positions, and no two elements land on the exact same
point (chained entries stay visually distinct, not stacked on the origin).

**Visual differences from old behavior**: there was never a dedicated
HashMap renderer (`existing-layout-audit.md` §9) — buckets fell through to
`ArrayRenderer`'s default grouping with no label/container rendering at
all, and entries were positioned manually by `HashMapVisualizer`, bypassing
the strategy pattern entirely. That backend behavior is unchanged by this
pass (out of scope — this migration covers the renderer layer, not
`HashMapVisualizer`'s layout logic); `GenericSceneRenderer` simply renders
whatever positions result, which the test confirms are sane (finite,
distinct).

**Deleted**: nothing new here (no dedicated HashMap renderer existed).

---

## Trie

**Verified**: `tests/integration/migration-trie.test.ts` — `TRIE_INSERT`
extending a `TRIE t = ["cat", "car"]` through the real pipeline.
Hierarchy-shaped (children strictly below parent, via `settleLayout`), every
edge resolves to a live node.

**Bug found and fixed**: this is what surfaced the `TreeLayoutStrategy`
node-filter bug described under Heap above — Trie nodes are created with
`type: 'sphere'`/`originalType: 'TRIE_NODE'`, neither of which the old
filter recognized, so `TreeLayoutStrategy.applyLayout` saw zero nodes for
any all-Trie group and returned an empty position map; every Trie node
rendered at the origin. Same fix as Heap resolves this.

**Visual differences from old behavior**: there was never a dedicated Trie
renderer (`existing-layout-audit.md`, "Scope note on structures") — Trie
nodes shared `TreeRenderer`'s grouping. Close to a pure swap once the layout
bug above was fixed.

**Deleted**: nothing new here (no dedicated Trie renderer existed).

---

## Camera / Animation Interpolation (Phase 4)

This phase connects the already-typed `SET_CAMERA`/`CameraFrameState`
contract (`packages/runtime/src/aqir/types.ts`, `SceneState.camera`) to an
actual camera behavior in the renderer, and adds generic frame-to-frame
interpolation so structure mutations fade rather than pop.

**`CameraController`** (`packages/renderer/src/components/camera/CameraController.tsx`)
replaces the old `CameraRig` (previously inline in `AQVECanvas.tsx`) and
reads `sceneState.camera` each frame to dispatch on
`CameraFrameState.mode`:

- `AUTO_FIT` — the original `CameraRig` bounds-fit lerp (centroid-X target,
  tree-height-aware target-Y, zoom-out past a 6-unit X span) preserved
  byte-for-byte in behavior, just moved behind an explicit mode branch and
  gated on an internally-owned `autoFollow` flag (previously
  component-external state in `AQVECanvas`).
- `FOCUS` — lerps the orbit target toward `sceneState.elements.get(targetId)`'s
  live position; a no-op (holds position) if `targetId` doesn't resolve.
- `ORBIT` — advances an internal angle by `speed * delta` each frame and
  places the camera on a circle of its current distance from the target,
  calling `camera.lookAt(target)`.
- `POSITION` — lerps the camera directly toward an explicit `{x, y, z}`.
- Absent `sceneState.camera` (no `CAMERA` statement compiled) falls back to
  `AUTO_FIT`, so every existing `.aqvl` program's visual behavior is
  unchanged — this is the "Default → AUTO_FIT fallback" requirement.

All four modes only ever *lerp* toward their target each frame (no branch
sets a position/target directly), so switching mode, target, or scene state
between frames never snap-cuts — verified in
`CameraController.test.tsx` by asserting a single frame never reaches the
destination and many frames converge close to it.

**Where it's wired in**: `GenericSceneRenderer` now always mounts one
`<CameraController>` (via `GenericSceneRendererProps.cameraControllerRef`/
`onAutoFollowChange`), and `AQVECanvas.tsx`'s "Reset Camera" button drives it
through that forwarded ref instead of owning `autoFollow` state and an
`OrbitControls onStart` handler itself — `CameraController` now listens for
the underlying `OrbitControls` instance's own `'start'` event (via
`useThree().controls`) to detect user-initiated drag and suspend
`AUTO_FIT`'s auto-follow, so `AQVECanvas` no longer needs to plumb that
manually.

**Known gap, explicitly out of scope for this phase**: `SceneState.camera`
is only ever populated by the separate, not-demo-wired `VirtualMachine.ts`
execution path (`case 'SET_CAMERA'` in `VirtualMachine.ts`). The live demo
pipeline (`ExecutionEngine` → `AnimationController` → `StateManager` →
`AQVECanvas`, the one `packages/demo` actually runs) never executes
`SET_CAMERA` and so never populates `SceneState.camera` today — meaning
`CameraController` will only ever observe `AUTO_FIT` (its documented
default) until `SET_CAMERA` handling is also added somewhere in that chain.
`CameraController` itself is mode-complete and tested against all four
modes directly via `SceneState.camera`; producing that field from compiled
`CAMERA` statements in the live pipeline is follow-up work in the same
spirit as this log's other "out of scope" items below.

**`AnimationInterpolator`** (`packages/renderer/src/core/AnimationInterpolator.ts`)
is a small, R3F-independent, pure-function module —
`interpolateFrame(fromElements, toElements, t)` — that tweens
position/rotation/scale (and opacity) between two `StateManager` snapshots.
It only ever reads/writes those four fields, so it works identically for
any structure's elements. An element present in only one of the two frames
is treated as an insertion (fades opacity in from 0, holds its final
position) or a deletion (fades opacity out to 0, holds its last known
position) rather than popping in/out. It is not yet wired into
`GenericSceneRenderer`'s render loop (that would mean sourcing two adjacent
`StateManager` snapshots and a shared progress clock from whatever component
owns playback) — this phase ships the interpolation primitive and its test
suite; wiring it into the live playback loop is follow-up work.

**Manual verification**: ran a multi-step `BUBBLE_SORT` program (multiple
`COMPARE`/`SWAP` steps) and a `DFS` graph traversal through `packages/demo`'s
dev server with the new `CameraController` mounted in place of `CameraRig`.
`AUTO_FIT` tracked both structures identically to the pre-change behavior
(no `CAMERA` statement in either program, so both exercise the fallback
path) — centroid tracking and zoom-out on the wider graph layout looked
unchanged, and the "Reset Camera (Auto)" button correctly re-enabled
auto-follow after a manual drag. No jarring jumps were observed switching
between algorithm steps, consistent with the interpolator/controller both
only ever lerping.

---

## Files deleted (confirmed zero remaining references, repo-wide grep)

- `packages/renderer/src/components/library/ArrayRenderer.tsx`
- `packages/renderer/src/components/library/StackRenderer.tsx`
- `packages/renderer/src/components/library/QueueRenderer.tsx`
- `packages/renderer/src/components/library/LinkedListRenderer.tsx`
- `packages/renderer/src/components/library/TreeRenderer.tsx`
- `packages/renderer/src/components/library/GraphRenderer.tsx`
- `packages/renderer/src/components/SceneElementRenderer.tsx`
- `packages/renderer/src/components/elements/BoxRenderer.tsx`
- `packages/renderer/src/components/elements/SphereRenderer.tsx`
- Dangling `SceneElementRenderer`/`BoxRenderer` exports removed from
  `packages/renderer/src/index.ts`.

`packages/renderer/src/components/elements/EdgeRenderer.tsx` and
`HighlightRing.tsx` were kept — still used by `PrimitiveNode.tsx`/
`PrimitiveEdge.tsx` in the generic renderer.

## Out of scope, flagged for follow-up

- **`packages/runtime/src/core/LayoutManager.ts` + `core/layouts/*.ts`**
  (the old per-structure *position-computation* strategies, as distinct
  from the old *renderer components* this task targeted) are still live —
  `AnimationController` calls `layoutManager.updateLayout(...)` throughout
  to compute positions for normal structure operations, alongside a newer,
  separately-tested AQIR-driven `layout/LayoutEngine.ts` that only
  activates for explicit `LAYOUT`/`POSITION` language statements.
  `GenericSceneRenderer` is agnostic to which one wrote `element.position`,
  so this dual-engine state doesn't block the renderer migration, but it's
  worth resolving before/alongside whatever wires automatic AVL/RB
  rebalancing (below) into the compiled pipeline.
- **Automatic AVL/RB self-balancing** — `ROTATE` is now a real, correct,
  user-invocable primitive (see "BST / Binary Tree" above), but nothing
  calls it automatically from `INSERT`/`DELETE` when a tree becomes
  unbalanced. Wiring that up is real algorithmic work (balance-factor or
  color tracking through `BSTEngine`'s insert/delete) beyond this pass.
- **Stack `PUSH`/`POP` scene mutation under animation-free execution** — see
  "Stack" above.
- **`SET_CAMERA` production in the live demo pipeline** and **wiring
  `AnimationInterpolator` into playback** — see "Camera / Animation
  Interpolation (Phase 4)" above.

## Full verification

- `pnpm test` (root, `tests/` package): 44 files, 522 tests passed
  (including the 9 `migration-*.test.ts` files, 2 of which cover the real
  `ROTATE` implementation), 2 pre-existing `todo`s.
- `packages/renderer` `vitest run`: 38/38 (12 `GenericSceneRenderer.test.tsx`,
  unaffected by the structure-migration pass; plus, added in Phase 4, 11
  `CameraController.test.tsx` and 15 `AnimationInterpolator.test.ts`).
- Repo-wide grep for every deleted component name: zero remaining
  references.
- `pnpm --filter @aqvl/compiler build` and `pnpm --filter @aqvl/runtime
  build`: clean, no errors.
- `pnpm --filter @aqvl/renderer build` (`tsc`): fails with
  `--downlevelIteration`-class errors in files this pass never touched
  (`GraphEngine.ts`, `Graph.ts`, `Trie.ts`, `UnionFind.ts`,
  `LayoutEngine.ts`, `shared/errors/formatter.ts`) — confirmed via
  `git stash` to be a **pre-existing** failure on the fully-committed
  baseline (predates even the uncommitted `GenericSceneRenderer` work this
  session started from). `renderer/tsconfig.json` has no `target` set and
  path-aliases `@aqvl/runtime` directly to runtime's source rather than its
  compiled `dist`, so it inherits runtime's ES2015+ iteration syntax
  without the compiler flags to support it. Not fixed here — it's an
  unrelated, pre-existing monorepo build-config gap, not something this
  migration introduced or is in scope to repair. The test suites (which use
  vitest's own transpilation, not `tsc`) are unaffected and all pass.

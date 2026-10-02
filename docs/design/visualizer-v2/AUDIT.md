# Visualizer v1 audit (before the v2 rebuild)

Written before any visual code changed. Screenshots of v1 are in [`before/`](before/).

## 1. How it works

**Pipeline.** `Playground.tsx` runs the compiler in the page:
`Lexer → Parser → SemanticValidator → analyzeFunctions → Optimizer → AQIRGenerator`.
The result is an AQIR program: STEP instructions made of primitive ops, kernel opcodes
(JUMP, CALL, RET, SET_VAR, …), and a function table.

**Execution.** `ExecutionEngine` (packages/runtime) wraps `AQVLVirtualMachine`. The VM
runs control flow itself and passes every other instruction, lowered to its legacy
action form, to `AnimationController.executeInstruction`. That 4,400-line class mutates
a live scene graph held by `SceneManager`. It sets semantic state (`EVALUATING`,
`MODIFYING`, `SUCCESS`, …), values, `worldTarget` layout slots, tags and edges. It also
schedules anime.js tweens on the same objects through `AnimationScheduler` and
`TimelineEngine`.

**Where state becomes visuals.** After each visible instruction, `StateManager` takes a
shallow snapshot and the engine dispatches `STATE_UPDATED`. The page copies the snapshot
into React state. `AQVECanvas` (packages/renderer) renders a `GenericSceneRenderer`.
That renderer maps each element to a `PrimitiveNode` (drei `RoundedBox`/`Sphere`/`Cylinder`
plus `meshStandardMaterial`) or a `PrimitiveEdge`. Each node runs its own `useFrame`
lerp toward the snapshot. While a tween is in flight, the snapshot's position objects
are the same objects anime.js is mutating, so on-screen motion is whatever the tween
happened to reach.

**Camera.** `CameraController` lerps an OrbitControls target toward an auto-fit
centroid with fixed per-frame lerp factors (0.04/0.03/0.05), so its speed depends on
frame rate. `SET_CAMERA` (FOCUS/ORBIT/POSITION) is read from `SceneState.camera`, which
nothing ever sets: **CAMERA statements have no effect.**

**Layout.** The VM resolves `LAYOUT … AS CIRCULAR/GRID/FORCE_DIRECTED/CUSTOM` and
`POSITION … AT` into `VMState.positions`, but no renderer code reads them: **LAYOUT and
POSITION statements have no visible effect.** `before/layout-ring.png` shows a
`CIRCULAR` ring drawn as a straight line.

**Playback.** Play runs the VM live, one awaited instruction at a time. Step-back
restores checkpoints instantly with no animation. There is no scrubbing, and the
progress bar is display-only. Speed is anime.js's global `anime.speed`, so it also
affects every other anime instance on the page. A headless dry run counts the total
steps.

**Overlays.** `IterationDirector` (Loops and Searching: loop cursors, binary-search
window) and `LinearDirector` (Stacks, Queues, Linked Lists: roles and drawn pointers)
listen to engine events and push overlay state. A cartoon `Character` speaks
narration. The code panel reads `INSTRUCTION_START` to highlight the active line.

**Stack.** React 19, three 0.185, @react-three/fiber 9.6, drei 9.122 (built for fiber
8), anime.js 3, Motion 13 and GSAP 3 on the site pages, Vite 8, TypeScript, Tailwind 4.

## 2. What it supports (source of truth: the runtime and the 230 examples)

| Family | Element types (`originalType`) | Layouts |
|---|---|---|
| Arrays, Loops, Searching, Sorting | `ARRAY_ELEMENT` (box) | LINE (default), GRID, CIRCULAR, CUSTOM |
| Stacks / Queues | `STACK_ELEMENT`, `QUEUE_ELEMENT`, `CONTAINER` + `CONTAINER_ITEM` | vertical / horizontal line |
| Linked lists | `LINKEDLIST` anchor, `LINKEDLIST_NODE` (sphere), `next`/`prev` pointer edges, heap-memory area | row(s), arcs for wrap-around pointers |
| Trees / BST | `BINARYTREE` anchor (root, call stack), `TREE_NODE` (sphere), `EDGE` | hierarchy |
| Heaps | `HEAP_NODE` (tree view) + `HEAP_ARRAY_ELEMENT` (array view) | hierarchy + line |
| Hash maps | `HASHMAP_BUCKET`, `HASHMAP_ENTRY` | bucket column + chains |
| Tries | `TRIE_NODE`, edges | hierarchy |
| Graphs | `GRAPH` anchor, `VERTEX` (box), `GRAPH_EDGE` (weights, directed) | force-directed, circular |
| Recursion / Functions | VM call frames (only drawn when a tree anchor carries them) | none |

230 examples in 14 categories (packages/demo/src/examples/registry.ts).

## 3. Element and state inventory (v1)

| Element | v1 look | Purpose |
|---|---|---|
| Array cell / vertex | sky-blue `#38bdf8` rounded cube, roughness 0.2, white value text | value holder |
| Tree / list / heap / trie node | sky-blue sphere | value holder |
| Edge | grey line + cone arrow, 45% opacity | relation / pointer |
| Highlight ring | torus around the node in the state accent | "active" cue |
| Tags | coloured text above nodes (HEAD green, TOP amber, LEAKED red, vars cyan) | pointer names |
| Partition boundary / sorted region | coloured brackets / strip | algorithm regions |
| Loop cursor / search window | purple triangle + label, floor band | iteration aids |
| Tree name + call stack | flat text left of the tree | recursion |
| Heap-memory box | dashed violet rectangle | unlinked nodes |
| Floor | drei `Grid`, `#2a2a2a`/`#444` lines on `#111111` | reference plane |
| Camera button | cream, hard black offset shadow, Space Grotesk | reset view |
| Character | purple emoji face with speech bubble | narration |

States (`packages/shared/src/theme/semanticColors.ts`), all `meshStandardMaterial` plus
emissive:

| State | Colour | Emissive | Motion |
|---|---|---|---|
| NEUTRAL | sky `#38bdf8` | 0.1 | none |
| EVALUATING (compare / read) | amber `#f59e0b` | 0.7 | +0.3 lift, scale 1.15 |
| TRAVERSING (visit / pointer) | cyan `#06b6d4` | 0.6 | ring |
| MODIFYING (swap / write) | pink `#ec4899` | 0.7 | lift 1.8, z ±1.5 path, `easeOutBounce` |
| SUCCESS (sorted / found) | emerald `#10b981` | 0.5 | scale pop |
| DISCARDED | slate `#6b7280` | 0.05, opacity 0.4 | none |
| AUXILIARY | violet `#a855f7` | 0.4 | none |
| STRUCTURAL | indigo `#6366f1` | 0.5 | none |

## 4. Current look vs the website

The **website** is warm and editorial: ink `#1E1C27` / `#17151F` ground, peach `#EBC0A3`
text, cream `#F5D8C6` emphasis, dusk `#666379` greys, hairlines in peach at 9–34%
alpha, Newsreader (serif) for prose and JetBrains Mono for code, 2px/10px radii,
spring-based CSS easing, and a light paper theme (`#F7EFE9`). One neon (`#3FF6DC`) is
reserved for the 3D viewport frame.

The **3D area** is a different product. It has a cold `#111111` void, a generic grey
grid, saturated Tailwind-500 colours (sky, amber, pink, emerald, violet, indigo all at
once), Space Grotesk (deliberately pinned by `aqve-host.css`), and a neo-brutalist
camera button. It does not follow the light theme.

## 5. Critique

* **No single place to look.** Every node starts sky-blue at equal luminance with
  emissive glow. Comparisons, swaps and visits all add glow, scale and a ring, so a
  compare (amber) is as loud as a swap (pink). Nothing is reserved for "this just
  changed".
* **Six saturated hues at once** in a long session is tiring, and the Tailwind
  palette clashes with the warm site. Pink, amber and emerald next to each other also
  collapse for deuteranopes (amber/emerald especially), and no state has a non-hue
  cue except a lift that several states share.
* **Flat and floaty.** Unit cubes hover over a wireframe grid with no ground contact
  (contact shadow only), no reflection, and fog that does not match the void. Text is
  white on light sky-blue, about 2:1 contrast.
* **Mechanical motion.** The swap is a fixed lift, a sideways move, then
  `easeOutBounce`. All elements of a step move in unison, and nothing depends on mass,
  distance or staggering. Creation and removal pop.
* **Playback is not a timeline.** You cannot scrub. Step-back cuts instantly. Speed
  is a global anime.js setting. Motion and camera are frame-rate dependent (lerp per
  frame), and the camera never reacts to CAMERA statements.
* **LAYOUT / POSITION / CAMERA statements are ignored** by the renderer (see §1). The
  Layout & Camera examples teach features that do not appear.
* **UI seams.** The cream camera button, purple emoji narrator and Space Grotesk
  labels sit inside a peach/ink Newsreader page. The transport bar has no scrubber,
  no keyboard shortcuts and no indication of what kind of step is coming.

**Kept from v1:** the compiler, VM, `ExecutionEngine` and `AnimationController`
semantics (correct and well tested), the runtime's layouts, and the editor. Everything
the viewer sees is rebuilt on a recorded execution trace (see `README.md`).

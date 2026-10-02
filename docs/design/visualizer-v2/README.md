# Visualizer v2

The 3D output of an `.aqvl` program, rebuilt. The audit of what came before is in
[AUDIT.md](AUDIT.md). The code is in `packages/runtime/src/trace` (recording),
`packages/renderer/src/stage` (the stage) and `packages/demo/src/components/visualizer`
(the UI).

## Before / after

| Before (v1) | After (v2) |
|---|---|
| ![](before/sorting-bubble-sort.png) | ![](after/sorting-bubble-sort.png) |
| ![](before/graphs-dijkstra.png) | ![](after/graphs-dijkstra.png) |
| ![](before/tree-traversals.png) | ![](after/tree-traversals.png) |
| ![](before/layout-ring.png) (a `CIRCULAR` layout drawn as a line) | ![](after/layout-ring.png) |
| ![](before/recursion-factorial.png) | ![](after/recursion-factorial.png) |
| ![](before/linked-list-reverse.png) | ![](after/linked-list-reverse.png) |

The whole page, before: [before/playground-full.png](before/playground-full.png). After:
[after/playground-full.png](after/playground-full.png) (dark) and
[after/playground-light.png](after/playground-light.png) (light). Side-by-side sheets:
`compare-*.png`.

What changed, in one line each:

* **One place to look.** At most two nodes are emphasised per step, and one treatment (aqua, bloom, ripple) belongs to the data changing and nothing else.
* **Same product as the site.** The site's ink/peach/dusk/cream palette, its hairlines, JetBrains Mono and Newsreader, its dark and light themes. The cold `#111` void, Tailwind-500 colours and Space Grotesk are gone.
* **Physical, not mechanical.** Closed-form springs scaled by each node's value (mass), swaps on two separate arcs, staggered cascades, ripples when something locks in, light travelling along the edge a step used.
* **A real timeline.** Play, pause, step, step back, scrub and speed are exact. Every moment is a pure function of time, identical at any frame rate, and the timeline shows what kind of step lies where.
* **The program's own geometry, finally.** `LAYOUT`, `POSITION` and `CAMERA` statements now reach the picture (v1 ignored them).

## Architecture

```
source ──compile──▶ AQIR ──recordTrace()──▶ ExecutionTrace ──▶ StageModel ──▶ sampleStage(step, τ) ──▶ three.js
                          (headless run,      (one frame per     (slots, rest      (pure; preallocated      (instanced
                           SnapTimeline)       visible step)      frames, camera    buffers, no frame        meshes, SDF
                                                                  keys)             history)                 text, post)
                                   Playhead (time in "1x seconds") ─────┘
```

* **Kept from v1:** the compiler, the VM, `ExecutionEngine` and `AnimationController`. Their semantics are correct and covered by about 1,600 tests, so `.aqvl` parsing and execution are untouched. The old renderer components still exist (their tests pass) but nothing in the site uses them.
* **`recordTrace`** runs the program once on a `SnapTimelineEngine`, which lands every anime.js tween on its final value. It records one frame per visible step: nodes, edges, structures, sorted / partition regions, simple variables, the call stack, the camera, the runtime's own log line, and an event classified from the state diff (`compare`, `swap`, `write`, `link`, `create`, `remove`, `visit`, `traverse`, `settle`, `discard`, `mark`, `call`, `return`, `print`, `layout`, `camera`, `hold`). WAIT and mid-program LAYOUT / CAMERA changes become steps of their own. A runtime error ends the trace and is reported, never thrown. All 230 examples record in about 3 s together.
* **`Playhead`** is the one clock. Each step has a length by its kind (a swap 1.45 s at 1x, a print 0.55 s). Play, pause, step, step back (the step plays in reverse), scrub and speed all only move a number. Pausing the tab pauses it.
* **`sampleStage`** turns (step, time into it) into every transform, colour, edge curve, travelling light, floor mark and label. It reads only the two rest frames around the step, so scrubbing in any order gives the same picture (tested).
* **Rendering** is one `useFrame` that samples, places the camera, and hands the sample to each part. Bodies are one instanced mesh per shape; edges are instanced rod segments; the floor marks are one instanced SDF quad set. The canvas uses `frameloop="demand"`, so a paused stage draws nothing.

## Libraries, and what each one is for

| Library | Version | Role | Why |
|---|---|---|---|
| three | 0.185.1 | rendering | already in the stack |
| @react-three/fiber | 9.8.1 | React renderer for three | already used; upgraded for the postprocessing peer range |
| @react-three/drei | 10.7.7 | `Environment` + `Lightformer`, `MeshReflectorMaterial`, `OrbitControls` | v10 is the major built for fiber 9 (v9 targeted fiber 8) |
| @react-three/postprocessing + postprocessing | 3.1.3 + 6.39.5 | bloom, depth of field, vignette, dither, Khronos Neutral tone mapping | merges all effects into one fullscreen pass; nothing else in the stack does post |
| troika-three-text | 0.52.4 | SDF text in the scene | crisp at any distance, used imperatively so labels never re-render React |
| @fontsource/jetbrains-mono | 5.3.0 | the scene's typeface as static `.woff` | the site's code face; preloaded before any text is drawn, and a failed load is reported, not silently replaced |
| motion | 13.5.0 (existing) | DOM UI springs (caption card, speed pill) | the site's UI motion library; not used for anything in 3D |

Deliberately not used in the stage: **GSAP, anime.js, Motion or react-spring for 3D.** They are imperative timelines with their own clocks, so scrubbing and frame-rate independence would have to fight them. The stage's motion is closed-form springs evaluated at a given time (`stage/motion/spring.ts`). Theatre.js is an authoring tool, and nothing here is hand-keyed. Licences: MIT, except postprocessing (Zlib) and three (MIT).

## Colour

There is no fixed palette from outside. Each colour is derived from the site and assigned by meaning.

**Anchor.** The site is warm and editorial: ink `#1E1C27` / `#17151F`, peach `#EBC0A3`, dusk `#666379`, cream `#F5D8C6`, hairlines in peach at low alpha, and a light paper theme. Its one neon, `#3FF6DC`, was reserved for the old viewport frame. The stage keeps that ground (the void is `--ink-deep`, fog matches it), keeps hairlines for structure, and gives the neon a single job.

**By purpose (dark theme; light theme in `stage/look/palette.ts`).** Text = the value printed on the node. Contrast = WCAG ratio of that text on the body.

| State | Body | Text | Contrast | Why this colour | Second cue (not hue) |
|---|---|---|---|---|---|
| Idle | `#5E5878` | `#F5D8C6` | 4.94 | the site's dusk: calm, low arousal, recedes | rests on the floor, glossy |
| Compared / read | `#EBA96E` | `#1E1C27` | 8.34 | warm apricot from the peach family: "look here" without alarm | pair rises and leans in; the relation (`64 > 34`) is written between them |
| **Changed** (write, swap, re-link, create, remove) | `#3FF6DC` | `#17151F` | 13.26 | the brand neon, the one cool saturated hue on a warm ground: maximum salience, used for nothing else | arcs across or flashes; floor ripple; only thing past the bloom threshold |
| Visited / pointed at | `#B3ABF2` | `#1E1C27` | 8.02 | lavender, cool and light: present, not urgent | lifts; solid floor ring or halo ring |
| Settled / sorted / found | `#6C9C83` | `#1E1C27` | 5.37 | muted sage: done, quiet; it accumulates, so it must not shout | turns matte (clear coat off), slightly smaller; locks in with a ripple |
| Ruled out | `#2B2737` | `#9A96AE` | 5.07 | near the floor: out of the picture | shrinks to 78% onto the floor, matte |
| Marked | `#EC9FC4` | `#1E1C27` | 8.25 | rose, a peach relative: noted, not acted on | dashed ring |
| Role (root, view) | `#7186BF` | `#1E1C27` | 4.69 | steel blue: structural | double ring |

Light theme: idle `#5D5874`, compared `#D9853F`, changed `#0F9FA6`, visited `#9D95E6`, settled `#6A9A82`, ruled out `#D9CCC2` (text `#565166`), marked `#E590B8`, role `#7A8FC4`. The neon deepens to a teal there, because `#3FF6DC` on paper would have almost no contrast. Every state's text passes WCAG AA (4.5:1) in both themes; the lowest is 4.69 (dark) and 4.84 (light).

Other pairs (dark / light): tags on the ground 10.8 / 9.3, index captions 5.5 / 5.0, name plates 7.7 / 5.8, running call frame on its slab 6.8 / 5.9. UI chips use the same body / text pairs, and all overlay text is the site's cream or peach on its ink panels.

**Colour-blind check** (Machado 2009 simulation, CIE76 ΔE between state bodies, `stage/look/vision.ts`):

| Vision | Dark: core states, min ΔE | Dark: all states, min ΔE | Light: core min | Light: all min |
|---|---|---|---|---|
| normal | 23.9 | 19.9 | 22.9 | 19.2 |
| protanopia | 23.9 | 16.2 | 19.3 | 6.3 (changed / marked) |
| deuteranopia | 23.6 | 9.7 (changed / marked) | 18.8 | 11.1 |
| tritanopia | 22.4 | 9.5 (compared / marked) | 16.6 | 8.7 (settled / role) |

"Core" means idle, compared, changed, visited, settled and ruled out, which co-occur in almost every program. These stay at least ΔE 16 apart for every vision type, and the test suite enforces at least 9.5. The closest pairs all involve "marked" or "role", which are told apart by ring shape (dashed / double) and by the mutation's arc, flash and ripple. No state relies on hue alone.

**Environment.** The void `#17151F` matches the site's `--ink-deep`. Fog in the same colour dissolves the floor at the edges, with no gradients or glow blobs. The floor `#1D1A27` has a peach hairline grid at 4% that fades with distance. The rig never changes: a warm key light `#FFF1E4` with soft shadows, a cool lavender rim `#B6B0DD` that separates bodies from the void, and a dusk sky fill. A small studio of light panels gives the clear coat something crisp to reflect.

## Attention

* `ATTENTION_BUDGET = 2` (`stage/motion/attention.ts`): only a step's first two actors are lifted, haloed, put in focus and, for a mutation, lit. A test checks every frame of a third of the examples.
* Documented exceptions, which are motion rather than emphasis: layout / create / remove cascades move every node they touch (staggered); persistent states (settled, ruled out) colour every node in them; a compare's relation label belongs to its pair.
* The reserved treatment (aqua glow, bloom, floor ripple, aqua travelling light) appears only in `swap`, `write`, `link`, `create` and `remove` steps. A test checks that glow above the bloom threshold appears nowhere else.

## Motion

* **Springs:** closed form, stiffness 210, damping ratio 0.58, mass 0.8–2.2 from the node's value within its structure, so big values settle visibly later and ring lower. Every spring is windowed to be exactly at rest when its step ends.
* **Swaps:** one node leaves the row to the front and one to the back, then they cross and return. The back one rises higher so neither hides the other. A test samples every swap of bubble sort 60 times and checks no two bodies ever overlap. Landing has a small mass-dependent settle and a ripple.
* **Cascades:** 40 ms per actor, capped. Entrances grow in on a spring; exits shrink to nothing in a cascade, labels and edges included. A new program clears the floor (left to right) before the next builds in.
* **Edges:** draw in, retract, and re-aim (a re-pointed pointer swings from its old target to its new one). The step's edges carry a travelling light with a short trail.
* **Calm mode** (on when the OS asks for reduced motion; toggle with C): no arcs, ripples, travelling light, tilt, drift or depth of field. Changes cross-fade.

## Camera

Framing is keyed to the middle of each step. The camera therefore starts easing toward a step's actors before they move, and it is a pure function of time like everything else. It fits the projected bounding box of what matters, leans 12% toward the actors, and on large scenes (trees, tries, graphs) zooms up to 36% toward their neighbourhood. Its optical centre is shifted with `setViewOffset`, so the picture centres in the area the caption card and side panel leave free. Drift is ±4° of yaw over 38 s, stopping when paused. `CAMERA FOCUS / ORBIT / POSITION` are honoured. Dragging hands control to the viewer; "Recenter" (F) gives it back.

## UI

* **What just happened:** an event chip with a shape per kind (so it works without colour), the step and source line, and the runtime's own sentence in Newsreader. It is announced to screen readers when paused or stepping.
* **Timeline:** one tick per step, coloured and sized by kind, so the swaps' clusters are visible before you reach them. It is a slider with arrow / Page / Home / End keys.
* **Watch:** simple variables (those this step changed are marked with their old value) and the call stack.
* **Key:** each state's colour with its glyph and its non-colour cue.
* **Keyboard:** Space, ← →, Shift + ← → (±10), Home / End, `[` `]` speed, C calm, F follow, K key.
* **States:** tracing progress, compile error, runtime error (shown when playback reaches it; the editor marks the line), WebGL context loss (rebuilt in place, same moment), no WebGL (timeline, captions and variables still work), font failure notice, and a truncation notice beyond 4,000 steps.

## Performance

Measured in Chrome on this machine's integrated GPU (Intel UHD, D3D11), 1440×900, vsync off, playing at 2x:

| Tier | Bubble sort median / p95 | Trie (40 nodes) | Kruskal (graph) |
|---|---|---|---|
| High (reflections, DoF, shadows 2048) | 10.5 / 21.8 ms | 12.4 / 33.4 ms (before tuning) | 7.8 / 23.0 ms |
| Balanced (shadows, bloom) | 3.2 / 11.7 ms | 3.2 / 8.1 ms | 3.6 / 5.6 ms |
| Light | 1.6 / 2.6 ms | 1.5 / 2.6 ms | 2.1 / 3.3 ms |

The starting tier comes from the GPU (integrated and mobile GPUs start Balanced, software rendering starts Light). A probe then steps down when the 90th-percentile frame exceeds 22 ms. Bodies, edges, floor marks, rings and pulses are instanced. Sampling allocates nothing per frame once a step's plan exists. Everything is disposed on unmount, and nothing draws while paused.

## Beyond the brief

* **Value bars:** numeric arrays show each value as a height (scaled across the whole run), so order is visible at a glance and a swap visibly moves a tall bar.
* **Event-coded timeline:** see the UI section above.
* **LAYOUT / POSITION / CAMERA** now work. They were silently ignored before.
* **Loop cursors** (`i = 3`, `low … high` window) are derived from the source and the recorded variables for every array program, not only the Loops / Searching categories.

## Checks

```
pnpm test                                   # root suite: 77 files, incl. execution-trace and stage-engine
pnpm --filter demo test && pnpm --filter demo lint && pnpm --filter demo build
pnpm --filter @aqvl/renderer test
npx tsc --noEmit -p packages/renderer && npx tsc -b packages/demo
```

`tests/fixtures/renderer-snapshot.json` (the Skip List / Segment Tree acid tests' pin on `packages/renderer/src`) was regenerated for this rebuild. Every pre-existing renderer file hashes as before except `index.ts`, which gained one export line.

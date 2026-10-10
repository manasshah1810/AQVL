# Stage performance

## What was wrong
- Every world (`WorldLayer`) asked for a redraw on every display refresh, so a 144 Hz monitor drew 144 full scenes a second, and ~20 other `invalidate()` calls across the worlds re-armed the loop on their own.
- Every colony animal ran its brain (`IdleBrain.update`), its rig pose, particles and a name-bubble projection every frame, in or out of shot. The bunny warren did the same, and re-sorted its audience every frame.
- The day/night colour grading was recomputed every frame for a cycle that lasts 18 minutes.
- Quality could only go down (never recover); the slow-frame probe only ran while a program played, not while a world animated.
- The voice engine notified React on every progress tick and could synthesise the same sentence twice.

## What changed (`packages/renderer/src/stage/three/perf.ts`)
| Concern | Mechanism |
|---|---|
| Ambient redraw rate | `FrameGovernor` (60 → 45 → 30 fps, evenly paced) and `useGovernedInvalidate()`, which every world uses instead of raw `invalidate()` |
| Off-screen canvas | `IntersectionObserver` in `WorldLayer`; ambient redraws stop, resume on return |
| Animals out of shot | `ViewCuller` + `SleepGate`: decided on at 10 Hz, not posed (every 8th frame to keep springs warm), no particles/bubbles |
| Warren decisions | Who-goes-where at 10 Hz (immediately on run start/end/step); movement still per frame |
| Day cycle | Sky/lighting state refreshed at 15 Hz |
| Quality | Tier now recovers (`HeadroomProbe`, cautious, anti-flap); governor paces only once at the lowest tier |
| Voice | Progress quantised, no-op status updates skipped, identical in-flight syntheses shared, abandoned queued ones skipped |

## Debug monitor
Open the site with `?perf` (or `localStorage['aqvl.perf'] = '1'`). Shows FPS, frame time, JS ms per frame, draw calls, triangles, geometries/textures, animals in view/awake/total, animating systems and TTS state. Absent otherwise.

---

# Second pass: measured, not guessed

The first pass paced the redraw and slept off-screen animals, but the stage was still slow. This pass started from a profile instead of a theory.

## How it was measured
Edge driven over CDP (headless, on the machine's Intel UHD iGPU, which is the realistic weak case), the playground running a quick sort in each world, `?perf` monitor on:

- rAF cadence (fps, p50/p95/p99 frame gap), long tasks, `Performance.getMetrics` (script/layout/style ms per second, heap, listeners)
- the CPU profiler, aggregated by self time and by inclusive time inside the slow frames
- `gl.render()` + `finish()` in a loop, with parts of the scene hidden or lights switched off, to separate CPU from GPU cost
- a scene-graph walk (the monitor exposes `window.__aqvl` with `?perf`) to attribute draw calls and triangles to subtrees
- production build A/B against the previous commit, with `Emulation.setCPUThrottlingRate` 2-4x to stand in for slower laptops

## What was actually wrong
| Finding | Evidence | Fix |
|---|---|---|
| **Draw calls, not scene logic.** The panda grove drew 1286 meshes a frame (penguin 734, rabbit 944); the scene's own JS was ~1 ms. `setProgram`/`renderBufferDirect`/`projectObject` dominated the profile | monitor + CPU profile | `three/batch.ts`: still parts are baked into one mesh per material per joint (props, scenery, animals) |
| Culling was switched off for every prop | scene walk: 725 of 725 meshes `frustumCulled=false` | merged meshes keep tight bounds; the rabbit kingdom is cut into 26-unit patches so off-screen patches are skipped |
| **Each animal had its own copy of ~15 materials** (300 materials in a scene) | scene walk | `Builder.mat` shares materials per look, ref-counted |
| **Point lights**: every light runs for every lit pixel whether bright or dark. Six lanterns/fires cost ~1 ms each on the iGPU (8.9 ms -> 3.3 ms with two) | `gl.render` with lights hidden | `three/lightPool.ts`: three real lights lent to the lanterns/fire that matter to where the camera looks, faded when they move |
| **GPU fragment bound on integrated GPUs** (render 19.7 ms at dpr 1, 4.9 ms at half) | dpr experiment | `ResolutionGovernor`: steps the pixel ratio down on measured frame time, one step at a time, undoes a step that did not help (CPU-bound), climbs back slowly, no flapping |
| **Every execution step re-rendered the whole 3D scene tree** (a 25-30 ms synchronous React render once a second) | CPU profile of slow frames: `performSyncWorkOnRoot` -> BambooWorld/ColonyLayer/CastLayer | `StageCanvas` and `StageScene` are `memo`; the page re-rendering per step no longer reaches the scene |
| The editor measured layout up to 4 times per step | profile (`measureEditorMetrics`) | one reading per commit |
| Rounded boxes (non-indexed) were never merged in the rabbit kingdom; 28x20 spheres everywhere | scene walk, triangle census | merged; 20x14 spheres for animal blobs and kingdom props |

Not the cause (checked): memory leaks (heap and object count flat over 30 s), duplicate render loops, listeners piling up, TTS (synthesis runs in a worker; the main thread only decodes and plays).

## Architecture now
- **60 fps**: rendering and visual interpolation (rig poses, camera, sampler).
- **10-15 fps**: who decides what (colony / warren decisions, off-screen animals), 15 Hz day colour grading.
- **Event-driven**: execution steps, voice, UI. None of it reaches the scene's React tree.
- A rig's parts that never move relative to their joint are found by running the rig through every pose, gait, fidget and prop it has (`rigProbeInputs`) and seeing what changes; nothing is listed by hand, so a part added later is handled correctly. `rigs.merge.test.ts` checks the merged animal draws exactly the same vertices as the original for every probe input and 150 random ones.

## Numbers (production build, this machine, 2x CPU throttle, same session, before -> after)
| World | fps | draw calls | triangles |
|---|---|---|---|
| panda grove | 45 -> 61 | 1203 -> 540 | 675k -> 524k |
| penguin ice shelf | 54 -> 68 | 728 -> 429 | 395k -> 400k |
| rabbit cloud kingdom | 56 -> 55 (vertex-bound; the trims below came after this measurement) | 944 -> 623 | 2.82M -> 1.87M |
| ocean reef | 109 -> 113 | 115 -> 115 | 236k |

At 4x throttle the panda grove goes from 17 fps (p50 55 ms) to 27 fps; the original had 150+ long tasks in 12 s where the new build has about ten. Frame time varies a lot from run to run on this laptop (power state), so numbers are only comparable within one A/B pair.

## Switches
- `?perf` (or `localStorage['aqvl.perf']='1'`): monitor, now also pixel size and ratio.
- `?drs=0` (or `localStorage['aqvl.drs']='0'`): turn the resolution governor off, to measure raw cost.
- `?daytime=<seconds>`: start the world's day that many seconds in (to look at dusk or night).

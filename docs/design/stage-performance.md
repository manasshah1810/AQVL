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

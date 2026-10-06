# The penguin world

The penguin world (`Penguins + Ice`) is the stage's primary world. The structures stand on an ice shelf, two penguins act out each step, and the choice of world also themes the whole site. This note describes how it works and where each piece lives. The plain studio and the panda grove keep their earlier behaviour (they do not use ice physics, ledges or the eagle).

## Principle

Everything on the stage stays a pure function of `(step k, time into the step)`, so scrubbing in any order shows the same picture. The new motion follows it:

- **Blocks are moved by the penguins, and the penguins' contact comes from the block**, never the other way round: `worlds/ice.ts` defines each shove as a `Leg` (start, release, rest, direction), the sampler places the block from it, and `worlds/cast.ts` puts the penguin at `block - direction * stand` while it pushes (or `+` while it tugs). The two cannot drift apart.
- **Only things that are not part of the run are stateful**: the idle roaming (`worlds/idle.ts`), the particle puffs, and the viewer's clicks. They are never allowed to change a step's result: the moment the run plays, every animal is back on its script.

## Ice physics (`worlds/ice.ts`)

A shove has two phases in step fractions `[t0, t1, t2]`: the penguin leans in and the block accelerates with it (`t0..t1`, distance grows with `u²`), the penguin lets go and friction brings the block to rest (`t1..t2`, speed falls like `exp(-KAPPA·x)`). The share of the distance covered while pushing follows from equal speed on both sides of the release, so there is no jolt at the moment of release and no sudden stop at the end. The block tips a little (`slideLean`): back as it is pushed off, forward as friction brakes it, a small rock as it stops.

`iceMotionAt(model, k)` builds the motion of step k (cached per model), or `null`:

| Step | What moves |
| --- | --- |
| `swap` of two blocks on the floor | Neighbours: the front block is tugged diagonally out to the lane above the other's place while the back block is shoved straight back; then the back block is tugged home and the front block is shoved back into the row. Blocks with others between them go out, across their lane, and back (three legs). Nothing ever passes through another block. |
| a grounded block that travels 1.5+ units (`move`, a node going into its place in a list) | one shove along the way |
| `create` of a grounded block in an array | made in front of the row, then shoved into its place |
| `remove` of a grounded block | shoved back and melting |
| `create` of a floating node (tree, graph, heap, trie) | forged by a penguin on the ice below it, lifted by an eagle, set down with a small bounce (`Carry`, `eagleAt`, `carryBall`) |

All other grounded blocks that change place glide with the same friction profile (no hop). Calm motion switches all of this off (and the old plain motion returns).

Linked lists lie on the floor in this world (`StageModel.groundRow`): the row stands on the ice and a node the runtime stages "below" the row is staged on the ice in front of it. Balls roll as they go: a ball's orientation is a function of where it is (`NodeBodies`), so it is right at every step and when scrubbing.

## The crew (`worlds/cast.ts`, `worlds/three/CastLayer.tsx`, `worlds/three/rigs.ts`)

- A step with an `IceMotion` gives the penguins a script (`CrewScript`): walk to the block, lean into it while it accelerates, let go (or keep tugging), step back and aside to watch it settle. Which penguin takes which block is decided left to right.
- A floating node's station is a ledge beside it. Getting there: along an edge when the two nodes are joined (hand over hand), up a rope that unrolls from the node when coming from the floor, or in a leap between unconnected ledges (`pathBetween`).
- Walking is the waddle: the body rocks and shifts onto the planted foot, the other foot lifts and swings forward, the flipper on that side lifts for balance, the head stays level against the rock. Each penguin has a `Personality` (rocking, tempo, bounce, blink) and the stride is never perfectly regular.
- Idle life (`worlds/idle.ts`): while the run is stopped and the step has settled, each animal is let off its station and wanders, looks about, preens, shakes off the snow, fetches fish from the bucket or the fishing hole and eats it, plays with its friend, or goes into the igloo. When the run moves again it trots straight back. The two grown-ups by the igloo have a life of their own too. Never in calm mode.

## The site (`packages/demo`)

- `lib/world.ts` is the store for the chosen world (`localStorage['aqvl-stage-world']`, the key the visualizer has always used). It sets `data-world` on `<html>`; `index.html` does the same before first paint. `styles/world-penguin.css` turns `data-world='penguin'` into an ice palette (the same colour roles, light and dark), snowfall behind the pages, penguin mascots and a frozen baseline in the footer. `data-snow` and `data-mascots` switch the extras off.
- `lib/settings.ts` stores the rest (graphics quality, calm motion, camera follow, snow, mascots, whether the Playground hides the code, which panel was open).
- `pages/Settings.tsx` (`#/settings`) picks the world and the settings. The Playground's Stage panel has the same switches.
- The Playground stage is a clean scene with a one-line caption and the transport. Variables and call stack, the colour key, the run's output and the stage settings live in one panel (`components/visualizer/StageDock.tsx`) that opens beside the stage on a wide screen, over it on a narrow one, and remembers its tab. `Focus stage` hides the code to give the stage the whole width.

## Tests

`tests/integration/stage-ice.test.ts` covers the shove profile (continuity of speed at release, rest at the end), swaps (no hop, no overlap, exact landing, far and near), the contact between a penguin and the block it shoves, purity, no teleporting across whole runs, grounded linked lists, the eagle and the ledges, the waddle (weight shift, personalities, irregularity) and the idle brain. `packages/demo/tests` covers the stores, the Settings page and the Playground's panel.

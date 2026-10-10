# Challenge 2: Ghost Move

> Status: idea / overview. Nothing is implemented yet. Planned as the second challenge, after Complete the Algorithm.

## The idea in one sentence

The program pauses just before a step. A translucent **ghost** of the piece that is about to move appears, and you **drag it to where you think it will land**. Then the real step plays and you see how close you were.

## Why this challenge exists

Most prediction exercises ask "what happens next?" with a list of options. That lets people guess by elimination. Ghost Move makes the prediction *spatial*: you place the answer in the 3D scene itself. You cannot pick it from a list, and you can only get it right by understanding where the algorithm is going.

## How a round plays

1. **Start a puzzle.** Each puzzle is a short run of a known algorithm (roughly 5 to 15 steps) with 3 to 5 **prediction points**.
2. **The run plays normally** until a prediction point, then pauses *before* the step.
3. **The question appears**, for example "Where does the pivot end up?" or "Which node is visited next?" A ghost of the moving piece appears.
4. **Drag the ghost** onto a slot, node, or edge in the scene.
5. **Lock in.** The real step plays.
   - **Hit:** your ghost merges into the real motion and glows.
   - **Miss:** your ghost fades red and a line is drawn to the true spot, labelled with how far off you were ("2 nodes away").
6. The run continues to the next prediction point. At the end you see a result card.

## What gets predicted

| Step type | Question | You drag |
|---|---|---|
| Swap | Where does each value end up? | Two ghosts, one per value |
| Move or write | Where does this value go? | One ghost to a slot |
| Traverse or visit | Which node comes next? | A marker to a node |
| Link | Which node does this pointer connect to? | A ghost arrow to a node |
| Insert | Which position in the structure? | A ghost node to a position |

## Scoring

- **Exact hit:** full points.
- **Near miss:** partial points based on distance in the structure (index distance in an array, edge hops in a tree or graph).
- **Rewinding:** you may scrub back to re-read the scene before locking in, but each rewind lowers the maximum score for that prediction. Careful watching is rewarded, but nothing is blocked.
- **Par:** a set has a par accuracy. Beat it for a bonus star.

## The result card

After a set, the learner sees accuracy per kind of step (swaps, comparisons, traversals), such as "Swaps 4/5, Traversals 1/3". That tells them what to practise next.

## What makes it special

- The answer is placed *in the scene*, not chosen from letters.
- Wrong answers are corrected visually, with the real motion next to the ghost.
- Distance-based partial credit means a near miss still feels like progress.

## Example

**Selection sort, 5 elements.** The run pauses after the scan finds the minimum. The prompt reads "Where will the minimum go?" The learner drags the minimum value's ghost to slot 0. If they chose slot 1, the real swap plays, the ghost fades red, and a line shows "1 slot away."

## How it fits what already exists

The whole program run is recorded before playback, so the correct answer for every prediction already exists in the next recorded step. Grading is a comparison against recorded data, with no extra computation. The stage only needs a drag layer on top of the existing node bodies. As with all challenges, the plain **Studio** theme is used.

## Out of scope

- No AI tutor or chatbot, and no LLM-generated questions. Prediction points are chosen by hand or by simple rules.
- No free-text answers.
- No accounts or login. Progress is stored in the browser.
- No new compiler, backend, or animation engine.
- The existing homepage and UI are not redesigned.

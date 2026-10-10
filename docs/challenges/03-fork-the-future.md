# Challenge 3: Fork the Future

> Status: idea / overview. Nothing is implemented yet. Planned as the third challenge, after Complete the Algorithm and Ghost Move.

## The idea in one sentence

At a decision point the stage splits into two or three short, faint **parallel previews** of what might happen next. Only one is what the program will really do. You pick the real one.

## Why this challenge exists

Plain multiple choice shows the learner words. Fork the Future shows the learner *outcomes*. Seeing several plausible futures side by side forces them to reason about cause and effect: "if the comparison is `<=`, the last pair gets compared again, so that is the one I am watching." The wrong futures are chosen to be the typical beginner mistakes, so a wrong pick teaches something specific.

## How a round plays

1. The run plays normally and **pauses at a decision point**: a comparison, a loop condition, an `if`, or a recursive call.
2. The stage plays **two or three short silent previews** (about 1.5 seconds each), each labelled A, B, C.
3. The learner **picks the one they think is real**.
4. The learner sets a **confidence**: low, medium, or high.
5. The **real timeline plays** at full quality and the other previews dissolve.
6. A short **"why" note** explains what the wrong previews did, for example: *"Preview B used `<=` instead of `<`, so it compared the last pair twice."*

## Where the wrong futures come from

The decoys are not random and not written by an AI. Each challenge declares a **mutation** taken from a fixed catalogue of common mistakes, and the decoy is the same program with that one mutation applied and run for a few steps.

| Mutation | What the decoy does |
|---|---|
| Flipped comparison | Treats `<` as `>` |
| Off by one | Uses the next or previous index |
| Skipped swap | Compares but does not swap |
| Wrong child | Goes left where the real run goes right |
| Missed base case | Recurses once too many times |

Each mutation has one authored explanation sentence, used in the "why" note. A check ensures every decoy really looks different from the true future, so the answer is never ambiguous.

## Scoring

Confidence works as a stake:

| Confidence | Correct | Wrong |
|---|---|---|
| Low | +1 | 0 |
| Medium | +2 | -1 |
| High | +3 | -2 |

Guessing with high confidence is punished, and honest uncertainty is respected. At the end, the learner sees accuracy by kind of decision and how well their confidence matched reality.

## Difficulty ladder

1. **Two futures**, obviously different outcomes.
2. **Two futures**, subtle difference (one position off).
3. **Three futures**, including a mutation from an earlier lesson.
4. **Three futures** with a deeper preview (more steps before they diverge).

## What makes it special

- Learners compare *consequences*, not descriptions.
- Wrong answers are the real bugs people write, which makes the feedback instructive.
- The confidence stake trains calibration: knowing what you know.

## Example

**Binary search for 7 in `[1, 3, 5, 7, 9]`.** The run pauses at the first comparison. Preview A: the middle is 5 and the search moves right. Preview B: the middle is 5 and the search moves left. Preview C: the search stops immediately. The learner sees that 7 > 5 and picks A with high confidence. The real run confirms it. The note for B reads: "B went left even though 7 is larger than 5."

## How it fits what already exists

The real future is already recorded in the program's trace. A decoy is produced by running the same program with a single small change for its first few steps, using the existing runtime, then displaying those frames with the existing stage. It is built last because it needs previews shown side by side, which the earlier challenges do not. The plain **Studio** theme is used.

## Out of scope

- No AI tutor or chatbot, and no LLM-generated questions or decoys.
- No free-text answers.
- No accounts or login. Progress is stored in the browser.
- No new compiler, backend, or animation engine.
- The existing homepage and UI are not redesigned.

# Challenge 1: Complete the Algorithm

> Status: idea / overview. Nothing is implemented yet. This is the first challenge we plan to build.

## The idea in one sentence

You are given an algorithm that is missing a piece, or missing entirely. You fill in the gap, press **Run**, and watch your version play out in 3D. If it is right, the data sorts, searches, or traverses correctly. If it is wrong, you *see* it go wrong.

## Why this challenge exists

Watching an algorithm animate teaches how it behaves. Writing it teaches whether you understood it. This challenge closes that gap: the learner has to make the decisions the algorithm makes (which comparison, which index, which base case), and the 3D stage immediately shows the consequence of each decision.

## Where it lives

A new page, `/challenges`, with three sections. This is the first one. All challenges use the plain **Studio** theme of the stage, with no animal crews and no world scenes, so the focus stays on the data.

## How a challenge looks

1. **Pick a challenge** from a list grouped by topic (arrays, sorting, searching, recursion, stacks and queues, trees, graphs) and difficulty.
2. **Read the goal**, for example "Make this sort the array from smallest to largest."
3. **Complete the code** using one of the modes below.
4. **Press Run.** The program is compiled and run with AQVL's normal pipeline, and the 3D stage plays *your* version.
5. **Get graded** against test cases. Passing earns up to three stars.
6. **Compare.** After passing, you can replay your run side by side with the reference solution.

## The five modes (easy to hard)

### A. Fill the Blank (multiple choice)
A real AQVL program with one to three `___` gaps. Each gap offers three or four options. The wrong options are the classic mistakes: `<` instead of `<=`, `i + 1` instead of `i`, a missing base case. Run it with your picks and the stage shows the result. A wrong pick visibly misbehaves, for example a sort that leaves one element out of place.

### B. Assemble the Steps (ordering)
The lines of an algorithm are shuffled into tiles. Drag them into the right order, with loop and `if` bodies indenting as you drop them. Run it to verify.

### C. Spot the Bug
A complete program with one bug injected. Pick the faulty line, then pick the right fix. The stage first runs the buggy version so you can see the symptom.

### D. Write the Core (written test)
A mostly blank editor with a function signature and comments. You write the missing body in AQVL. "Written" means *you write code*, not prose. It is graded by running your code against test cases. Nothing is judged by reading text.

### E. Boss Round
One algorithm, several stages chained: fill a blank, fix a bug, then write a helper.

## How grading works

- Your code is compiled and run headlessly by the existing AQVL runtime.
- Each **test case** sets up an input (for example `[5, 2, 9, 1]`), runs your program, and checks the final state of a named structure (the array is `[1, 2, 5, 9]`).
- **Visible tests** (about three) are shown. **Hidden tests** (about two) cover edge cases: empty input, one element, duplicates. A hidden failure names the category ("edge case: duplicates") without giving the data.
- If a test fails you see: the input, the expected result, the actual result, and a **Replay in 3D** button that plays that failing case.
- Programs that never finish are stopped by the runtime's step cap and reported as "did not finish".
- Compile errors use the existing diagnostics, so the learner gets the same messages as in the Playground.

## Scoring

| Stars | Meaning |
|---|---|
| 1 | All tests pass |
| 2 | All tests pass without using the later hints |
| 3 | Also at or under the **par** step count (fewer comparisons or steps than the reference) |

**Hints** are authored in advance, in three levels: a conceptual nudge, a revealed line, then the full solution. Each hint level costs a star.

## What makes it special

- **Failure is visible.** A wrong answer is not just "incorrect"; the 3D scene shows the sort stalling, the search missing, the recursion running away.
- **Live preview.** While writing, a **Preview** button runs your code on a tiny input so you can see it before submitting.
- **Side-by-side finish.** Your run and the reference solution play together, with a line like "same result, 4 fewer steps."

## Example challenge

**Bubble Sort: the swap condition** (Fill the Blank, Sorting, Easy)

```
FOR i FROM 0 TO n - 2
  IF arr[i] ___ arr[i + 1]
    SWAP arr[i], arr[i + 1]
```

Options: `<` · `>` · `==` · `<=`
Correct: `>`. Picking `<` sorts the array in the wrong direction, and the stage shows it happening.
(The syntax above is illustrative; the real challenge will use actual AQVL syntax.)

## Starter topics

Arrays (max, reverse, linear search), sorting (bubble, selection), searching (binary search), recursion (factorial, Fibonacci), stack and queue (balanced brackets), trees (BST insert, in-order), graphs (BFS, DFS).

## Out of scope

- No AI tutor or chatbot, and no LLM-generated questions. All challenges, blanks, distractors, tests and hints are authored by hand.
- No free-text answers. Everything is a choice, a drag, or code that is run against tests.
- No accounts or login. Progress is stored in the browser.
- No new compiler, backend, or animation engine.
- The existing homepage and UI are not redesigned.

## Open decisions

1. Tests compare the **final state of a named structure** (recommended) rather than printed output.
2. Whether the first release covers one topic (for example sorting) or several.

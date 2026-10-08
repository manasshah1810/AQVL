# Error teaching

AQVL does not show an error; it teaches from it. One pipeline, one source of
truth, four voices.

```
User code ─ compile ─▶ diagnoseCompileError ───────────────┐
        └─ run ─▶ recordTrace ─▶ error frame ─▶ diagnose ──┤
                              └─▶ logic detectors ─────────┤
                                                           ▼
                                  ErrorInfo  (facts, no sentences)
                                       │ teachError
                                       ▼
                                  ErrorLesson (what · why · fix · correct logic)
              ┌────────────┬───────────┴─────────┬───────────────┐
              ▼            ▼                     ▼               ▼
        editor band   3D error cell        IssuePanel      themed voice script
        (frame.line)  (frame nodes)     (same lesson)   (errorVoice.ts → VoiceEngine)
```

## Where things live

| Piece | File |
| --- | --- |
| Facts about a mistake (`ErrorInfo`) | `packages/runtime/src/diagnose/types.ts` |
| Source reading, expression evaluation | `diagnose/source.ts` |
| Runtime errors → facts | `diagnose/runtime.ts` |
| Compile errors → facts (blames the right line) | `diagnose/compile.ts` |
| Logic problems | `diagnose/logic.ts` |
| Facts → lesson | `diagnose/lesson.ts` |
| The failed-access cell on the stage | `diagnose/ghost.ts` |
| Error frame, stall detection | `trace/recordTrace.ts` |
| Panel, narration hook | `demo/src/components/visualizer/IssuePanel.tsx`, `useIssue.ts` |
| Four narrators | `demo/src/lib/voice/errorVoice.ts` |
| Editor band, scroll, focus | `IDEEditor.tsx` (`issueLine`, `focusRequest`) |

## One source of truth

A runtime error ends the trace with an **error frame** (`event.kind === 'error'`).
Its `line` is the exact source line that failed, its `vars` are the live values at
that moment, and its nodes are the scene as it was, plus one cell (`state: 'ERROR'`)
where the failed access would have been. The editor highlight, the 3D stage, the
scrubber and the panel all read that frame, so none can drift from another.
A logic problem sits on an ordinary frame (`trace.diagnostics[i].frameIndex`).

## What is detected

* **Compile time:** unclosed brackets (blamed on the line that opened them, not the
  line the parser gave up on), statements cut off mid-way, misspelt keywords (with
  the closest real one), undeclared names (with the closest declared one), and the
  semantic checks the compiler already runs. AQVL blocks end with `END`, so there
  is no indentation error to report.
* **Runtime:** index out of range (with the index expression and the values in it),
  empty stack / queue / heap, NULL pointer, division by zero, undefined name or
  function, unbounded recursion, a loop that never ends (a run that stops changing
  is cut short and explained), hash-map key, wrong-type operations, and any other
  runtime failure (explained generically from the message and the values).
* **Logic** (only when AQVL is sure): a cell compared with itself (the same index
  written on both sides), and a scene named `...Sort` that finishes with its array in
  neither ascending nor descending order. A descending sort is never reported, and
  two different expressions that happen to meet (`low` and `mid` in a one-cell
  window) are left alone.

Every shipped example is a correct program; `tests/unit/errors.examples.test.ts`
asserts that none of them produces an error, an error frame or a warning.

## Teaching sequence

Error → run stops on the error frame → exact line marked and scrolled to → the
failed access drawn on the stage → what happened → why (from the real values) →
how to fix it → the right logic to compare with (never applied for the learner) →
**Edit code** (caret on the culprit) → **Try again**. Editing the code at any point
marks the explanation stale and silences the voice; running again discards it and
builds new frames, a new lesson and a new voiceover.

A logic warning pauses playback on its step and offers **Continue** / **Dismiss**.

## Themes

The lesson is theme-independent. A theme chooses presentation only: its mascot and
surface in the panel, its stage, and its narrator's wording
(`errorVoice.ts`: an opening sentence per kind, transitions, a hand-back). The
reason and the fix are spoken word for word the same in every theme.

## Visualising the failed access

An index error shows an `ERROR` cell in the structure's own spacing, just past the
last element (or before the first), captioned `arr[3]`, next to a strip of valid vs
attempted indices in the panel. A NULL link in a linked list shows a `NULL` cell after
the tail; an empty stack / queue shows an `empty` marker at its anchor. Other
structures (trees, graphs, hash maps) get the error frame and the panel but no
extra cell yet.

import { divergenceValues, explainDivergence, type Divergence } from './diverge';
import type { GradeReport } from './grade';
import { blankAnswers, bugLine, splitCore } from './program';
import type { Kernel, Mode } from './types';

/**
 * Hints that read the situation. Every challenge has three paid levels, the
 * same in spirit for every mode (a nudge, a pinpoint, the answer), but what
 * they say depends on the mode and on what is on screen right now: which
 * gap is still wrong, which line is out of place, where the bug is. A free
 * note on top reads the last run: which test failed and where it went wrong.
 */

/** What the workspace currently holds, as far as the hints need to know. */
export type WorkState =
  | { mode: 'blank'; picks: (string | null)[] }
  | { mode: 'order'; lines: string[] }
  | { mode: 'bug'; found: boolean; wrongPicks: number[]; fix: string | null }
  | { mode: 'write'; text: string };

export interface Hint {
  title: string;
  /** Plain sentences. */
  text: string;
  /** Code to show under the text, if any. */
  code?: string;
}

export const HINT_LEVELS = ['A nudge', 'Pinpoint', 'The answer'] as const;

/** The three levels for the current stage of a challenge. */
export function hintsFor(kernel: Kernel, mode: Exclude<Mode, 'boss'>, state: WorkState | null, solution: string): [Hint, Hint, Hint] {
  return [nudge(kernel, mode), pinpoint(kernel, mode, state), answer(kernel, mode, solution)];
}

function nudge(kernel: Kernel, mode: Exclude<Mode, 'boss'>): Hint {
  const lead: Record<typeof mode, string> = {
    blank: 'Read each gap as a decision the algorithm makes.',
    order: 'Think about what has to exist before each line can run.',
    bug: 'Watch the stage for the first step that looks wrong, not the last.',
    write: 'Write the loop or recursion first, then what happens inside it.',
  };
  return { title: HINT_LEVELS[0], text: `${lead[mode]} ${kernel.hints[0]}` };
}

function pinpoint(kernel: Kernel, mode: Exclude<Mode, 'boss'>, state: WorkState | null): Hint {
  const title = HINT_LEVELS[1];
  if (mode === 'blank') {
    const answers = blankAnswers(kernel);
    const picks = state?.mode === 'blank' ? state.picks : answers.map(() => null);
    const empty = picks.map((p, i) => (p === null ? i + 1 : 0)).filter(Boolean);
    const wrong = picks.map((p, i) => (p !== null && p !== answers[i] ? i + 1 : 0)).filter(Boolean);
    const right = picks.map((p, i) => (p !== null && p === answers[i] ? i + 1 : 0)).filter(Boolean);
    if (wrong.length === 0 && empty.length === 0) return { title, text: 'Every gap you picked is right. Press Run.' };
    const parts: string[] = [];
    if (wrong.length > 0) parts.push(`${gapList(wrong)} ${wrong.length === 1 ? 'is' : 'are'} not right yet.`);
    if (right.length > 0) parts.push(`${gapList(right)} ${right.length === 1 ? 'is' : 'are'} right.`);
    if (empty.length > 0) parts.push(`${gapList(empty)} ${empty.length === 1 ? 'is' : 'are'} still empty.`);
    return { title, text: `${parts.join(' ')} ${kernel.hints[1]}` };
  }
  if (mode === 'order') {
    const core = splitCore(kernel).core.map((l) => l.trim());
    const lines = state?.mode === 'order' ? state.lines.map((l) => l.trim()) : [];
    const at = lines.findIndex((l, i) => l !== core[i]);
    if (lines.length > 0 && at < 0) return { title, text: 'The lines are in the right order. Press Run.' };
    const first = Math.max(0, at);
    return {
      title,
      text: first === 0 ? 'The very first line of the core is out of place. It should be:' : `The first ${first} line${first === 1 ? ' is' : 's are'} in the right place. Line ${first + 1} of the core should be:`,
      code: core[first],
    };
  }
  if (mode === 'bug') {
    const target = bugLine(kernel) + 1;
    if (state?.mode === 'bug' && state.found) {
      return { title, text: `You found the line. Pick the fix that makes it do what the algorithm needs: ${kernel.hints[1]}` };
    }
    // A window of three lines around the bug, placed so it is not always centred on it.
    const shift = kernel.id.length % 3;
    const from = Math.max(1, target - shift);
    return { title, text: `The faulty line is one of lines ${from} to ${from + 2}.` };
  }
  return { title, text: `A key line of the core: ${kernel.hints[1]}` };
}

function answer(kernel: Kernel, mode: Exclude<Mode, 'boss'>, solution: string): Hint {
  const title = HINT_LEVELS[2];
  if (mode === 'blank') {
    const answers = blankAnswers(kernel);
    return { title, text: answers.map((a, i) => `Gap ${i + 1}: ${a}`).join(' · '), code: solution };
  }
  if (mode === 'order') return { title, text: 'The core, in order:', code: splitCore(kernel).core.join('\n') };
  if (mode === 'bug') {
    return { title, text: `Line ${bugLine(kernel) + 1} is the bug. It should read "${kernel.bug.find.trim()}". ${kernel.bug.why}` };
  }
  return { title, text: 'The reference solution:', code: solution };
}

function gapList(ns: number[]): string {
  if (ns.length === 1) return `Gap ${ns[0]}`;
  return `Gaps ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

/** The free note: what the last run says, in one or two sentences. Null before any run. */
export function runNote(report: GradeReport | null, divergence: Divergence | null, lineLabel: (l: number) => string = (l) => `line ${l}`): string | null {
  if (!report) return null;
  if (report.compileError) {
    const e = report.compileError;
    return `Your last run did not compile${e.line !== null ? ` (${lineLabel(e.line)})` : ''}: ${e.message}${e.suggestion ? ` ${e.suggestion}` : ''}`;
  }
  if (report.passed) return null;
  const failing = report.results.filter((r) => r.outcome.status !== 'pass');
  const visible = failing.find((r) => !r.test.hidden);
  if (!visible) {
    const cats = failing.map((r) => r.test.category).filter(Boolean);
    return `Every visible test passes, but ${cats.length === 1 ? `the hidden ${cats[0]} case fails` : `${cats.length} hidden cases fail (${cats.join(', ')})`}. Think about the smallest inputs: empty, one item, repeated values.`;
  }
  const n = visible.test.index + 1;
  if (divergence) {
    const { title, body } = explainDivergence(divergence);
    const values = divergenceValues(divergence)
      .map((v) => `${v.label}: ${v.value}.`)
      .join(' ');
    return `Test ${n} fails. ${title.charAt(0).toUpperCase()}${title.slice(1)} at step ${divergence.frame}${divergence.line !== null ? ` (${lineLabel(divergence.line)})` : ''}. ${body}${values ? ` ${values}` : ''}`;
  }
  return `Test ${n} fails. Replay it and watch for the first step that does not match what the algorithm should do.`;
}

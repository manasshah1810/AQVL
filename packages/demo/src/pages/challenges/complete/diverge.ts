import type { ExecutionTrace, TraceFinal } from '@aqvl/runtime';
import { actualKey, describeActual, readActual } from './extract';
import type { TestResult } from './grade';
import type { Expectation } from './types';

/**
 * Where a wrong run first goes wrong. A failing test's run is compared with
 * the reference solution's run on the same input, structure by structure:
 * each checked structure (or variable) is followed through the run as the
 * sequence of distinct states it passes through, and the first step whose
 * state the reference never reaches at that point is where the learner's
 * logic parted from the algorithm. The stage pauses there and says so.
 */

export type DivergenceKind =
  /** The structure changed into a state the reference never had at that point. */
  | 'wrong-change'
  /** The run finished (or stopped) while the structure still had changes to make. */
  | 'stopped-early'
  /** The structure was already right, and the run changed it again. */
  | 'extra-change'
  /** The run stopped on a runtime error. */
  | 'error'
  /** The run hit the step limit. */
  | 'no-finish';

export interface Divergence {
  kind: DivergenceKind;
  /** The frame of the learner's run to pause on. */
  frame: number;
  /** The program line that step ran (1-based), if known. */
  line: number | null;
  /** The structure or variable it is about (absent for an error that touched nothing checked). */
  name?: string;
  /** What it became / what it was at that point. */
  got?: string;
  /** What the reference had it become there. */
  want?: string;
  /** What the reference ends with (for a run that stops too soon). */
  final?: string;
  /** Whether the subject is a single variable (said differently from a structure). */
  scalar?: boolean;
  /** For a runtime error: the message. */
  message?: string;
}

interface State {
  frame: number;
  key: string;
  text: string;
}

/** A frame read as the final state (they share the shape). */
function asFinal(frame: ExecutionTrace['frames'][number]): TraceFinal {
  return { vars: frame.vars, nodes: frame.nodes, edges: frame.edges, structures: frame.structures };
}

/** The distinct states `exp`'s subject passes through, with the frame each first appears on. */
export function timeline(trace: ExecutionTrace, exp: Expectation): State[] {
  const out: State[] = [];
  trace.frames.forEach((frame, i) => {
    const actual = readActual(asFinal(frame), exp);
    // A variable that does not exist yet has no state to compare.
    if (actual.kind === 'scalar' && actual.value === null) return;
    const key = actualKey(actual);
    if (out.length > 0 && out[out.length - 1].key === key) return;
    out.push({ frame: i, key, text: describeActual(exp, actual) });
  });
  return out;
}

/** Where `mine` first parts from `ref` for one expectation, or null when it follows it all the way. */
function divergeOn(mine: ExecutionTrace, ref: ExecutionTrace, exp: Expectation): Divergence | null {
  const a = timeline(mine, exp);
  const b = timeline(ref, exp);
  const n = Math.min(a.length, b.length);
  const scalar = exp.kind === 'var';
  const base = { name: exp.name, scalar, final: b[b.length - 1]?.text };
  for (let i = 0; i < n; i++) {
    if (a[i].key !== b[i].key) {
      return { ...base, kind: 'wrong-change', frame: a[i].frame, line: mine.frames[a[i].frame]?.line ?? null, got: a[i].text, want: b[i].text };
    }
  }
  if (a.length < b.length) {
    const last = mine.frames.length - 1;
    return { ...base, kind: 'stopped-early', frame: last, line: mine.frames[last]?.line ?? null, got: a[a.length - 1]?.text ?? 'never set', want: b[a.length].text };
  }
  if (a.length > b.length) {
    const at = a[b.length];
    return { ...base, kind: 'extra-change', frame: at.frame, line: mine.frames[at.frame]?.line ?? null, got: at.text, want: b[b.length - 1]?.text };
  }
  return null;
}

/**
 * The first point a failing run goes wrong, read against the reference's run
 * on the same input. Null for a pass (or a run with nothing to show).
 */
export function findDivergence(mine: TestResult, ref: TestResult | null): Divergence | null {
  const trace = mine.trace;
  const o = mine.outcome;
  if (!trace || o.status === 'pass' || o.status === 'compile-error') return null;

  let first: Divergence | null = null;
  if (ref?.trace) {
    for (const exp of expectationsOf(mine)) {
      const d = divergeOn(trace, ref.trace, exp);
      if (d && (!first || d.frame < first.frame)) first = d;
    }
  }

  if (o.status === 'runtime-error') {
    const at = trace.error?.frameIndex ?? trace.frames.length - 1;
    // A wrong turn well before the crash is the more useful place to stop; otherwise, the crash itself.
    if (first && first.kind === 'wrong-change' && first.frame < at) return first;
    return { kind: 'error', frame: at, line: o.line, message: o.message };
  }
  if (o.status === 'did-not-finish') {
    if (first && first.kind !== 'stopped-early') return first;
    const last = trace.frames.length - 1;
    return { kind: 'no-finish', frame: last, line: trace.frames[last]?.line ?? null };
  }
  if (first) return first;
  // The structures followed the reference but the end result still differs (e.g. a value only set at the very end).
  const last = trace.frames.length - 1;
  const bad = o.checks.find((c) => !c.ok);
  return { kind: 'stopped-early', frame: last, line: trace.frames[last]?.line ?? null, name: bad?.expectation.name, scalar: bad?.expectation.kind === 'var', got: bad?.actual, final: bad?.expected };
}

/** The expectations a result was graded on (failing ones first, so they win a tie). */
function expectationsOf(r: TestResult): Expectation[] {
  const o = r.outcome;
  if (o.status === 'fail') return [...o.checks].sort((x, y) => Number(x.ok) - Number(y.ok)).map((c) => c.expectation);
  return r.expectations;
}

/** The popup's headline and sentence for a divergence (the values themselves are shown beside it). */
export function explainDivergence(d: Divergence): { title: string; body: string } {
  const at = d.line !== null ? ` on line ${d.line}` : '';
  const name = d.name ?? 'the result';
  switch (d.kind) {
    case 'wrong-change':
      return d.scalar
        ? { title: `${name} goes wrong here`, body: `This step${at} set ${name} to ${d.got}; following the algorithm it would be ${d.want} at this point.` }
        : { title: `${name} goes wrong here`, body: `This step${at} is the first one that leaves ${name} in a state the algorithm never passes through.` };
    case 'extra-change':
      return { title: `${name} was already right`, body: `Up to here ${name} matched the algorithm, but this step${at} changed it again.` };
    case 'stopped-early':
      if (d.scalar || !d.want) return { title: `${name} ends wrong`, body: `The run ends with ${name} = ${d.got ?? 'never set'}, but it should end as ${d.final ?? d.want ?? 'something else'}.` };
      return { title: 'The run stops too soon', body: `The program ends here, but ${name} still had changes to go through before it is finished.` };
    case 'error':
      return { title: `The run stops with an error${at}`, body: d.message ?? 'The program hit a runtime error.' };
    case 'no-finish':
      return { title: 'The run never finishes', body: 'It is still going at the step limit: a loop whose condition never becomes false, or a recursion with no base case reached.' };
  }
}

/** The values to show beside the sentence: what the run has, and what the algorithm has there. */
export function divergenceValues(d: Divergence): { label: string; value: string; tone: 'got' | 'want' }[] {
  const out: { label: string; value: string; tone: 'got' | 'want' }[] = [];
  if (!d.name || d.kind === 'error' || d.kind === 'no-finish') return out;
  if (d.got !== undefined) out.push({ label: d.kind === 'stopped-early' ? 'Your run ends with' : 'Your run has', value: d.got, tone: 'got' });
  if (d.kind === 'stopped-early') {
    if (!d.scalar && d.want && d.want !== d.final) out.push({ label: 'Next, the algorithm makes it', value: d.want, tone: 'want' });
    if (d.final) out.push({ label: 'It should end as', value: d.final, tone: 'want' });
  } else if (d.want !== undefined) {
    out.push({ label: d.kind === 'extra-change' ? 'It was already' : 'The algorithm has', value: d.want, tone: 'want' });
  }
  return out;
}

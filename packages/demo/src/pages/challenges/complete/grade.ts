import { recordTrace, type ErrorInfo, type ExecutionTrace } from '@aqvl/runtime';
import { compileOrIssue } from '../../../lib/compile';
import { describeActual, expectedActual, readActual, sameActual } from './extract';
import { fillSlots, solutionTemplate } from './program';
import type { Expectation, Kernel, TestCase } from './types';

/**
 * Grading: each test puts its input into the program, compiles it with the
 * Playground's own pipeline, records the run exactly as the stage plays it,
 * and compares what the run left behind with the reference's expectations.
 * Nothing is judged by reading the code.
 */

/** Steps a run may record before it is stopped as "did not finish". */
export const STEP_CAP = 3000;
/** Nodes a run may record across all its frames (a structure that grows without end stops here). */
export const NODE_CAP = 250_000;

export function testsOf(kernel: Kernel): TestCase[] {
  return [
    ...kernel.visible.map((input, i) => ({ index: i, input, hidden: false })),
    ...kernel.hidden.map((h, i) => ({ index: kernel.visible.length + i, input: h.input, hidden: true, category: h.category })),
  ];
}

export interface Check {
  expectation: Expectation;
  expected: string;
  actual: string;
  ok: boolean;
}

export type Outcome =
  | { status: 'pass'; checks: Check[] }
  | { status: 'fail'; checks: Check[] }
  | { status: 'compile-error'; info: ErrorInfo }
  | { status: 'runtime-error'; message: string; line: number | null }
  | { status: 'did-not-finish' };

export interface TestResult {
  test: TestCase;
  outcome: Outcome;
  /** Steps the run took (its frames, less the starting picture). */
  steps: number;
  /** The run, ready to play (absent when it did not compile). */
  trace?: ExecutionTrace;
  /** The exact program that ran. */
  source: string;
  /** What the run was checked against (the reference's expectations for this input). */
  expectations: Expectation[];
}

const RUNAWAY = /maximum allowed iteration count|never reaches its stopping condition|likely an infinite loop/i;

/** Runs `template` (slots in place) on one test and grades it. */
export async function runTest(template: string, kernel: Kernel, test: TestCase): Promise<TestResult> {
  const source = fillSlots(template, test.input);
  const expectations = kernel.expect(test.input);
  const compiled = compileOrIssue(source);
  if ('issue' in compiled) return { test, outcome: { status: 'compile-error', info: compiled.issue.info }, steps: 0, source, expectations };
  const trace = await recordTrace(compiled.program, { source, maxSteps: STEP_CAP, maxRecordedNodes: NODE_CAP });
  const steps = Math.max(0, trace.frames.length - 1);
  if (trace.truncated) return { test, outcome: { status: 'did-not-finish' }, steps, trace, source, expectations };
  if (trace.error) {
    if (RUNAWAY.test(trace.error.message)) return { test, outcome: { status: 'did-not-finish' }, steps, trace, source, expectations };
    return { test, outcome: { status: 'runtime-error', message: trace.error.info?.message ?? trace.error.message, line: trace.error.line }, steps, trace, source, expectations };
  }
  const final = trace.final;
  const checks: Check[] = expectations.map((expectation) => {
    const want = expectedActual(expectation);
    const got = final ? readActual(final, expectation) : null;
    return {
      expectation,
      expected: describeActual(expectation, want),
      actual: got ? describeActual(expectation, got) : 'nothing (the run left no final state)',
      ok: got !== null && sameActual(want, got),
    };
  });
  const ok = checks.every((c) => c.ok);
  return { test, outcome: { status: ok ? 'pass' : 'fail', checks }, steps, trace, source, expectations };
}

export interface GradeReport {
  results: TestResult[];
  passed: boolean;
  /** A compile error stops grading at once: every test would report it. */
  compileError?: ErrorInfo;
  /** Steps over the visible tests. */
  steps: number;
}

/**
 * Grades `template` on every test, one after another (each run yields to the
 * page while it records). `onProgress` hears which test is running.
 */
export async function grade(template: string, kernel: Kernel, onProgress?: (done: number, total: number) => void): Promise<GradeReport> {
  const tests = testsOf(kernel);
  const results: TestResult[] = [];
  for (const test of tests) {
    onProgress?.(results.length, tests.length);
    const result = await runTest(template, kernel, test);
    if (result.outcome.status === 'compile-error') {
      return { results: [result], passed: false, compileError: result.outcome.info, steps: 0 };
    }
    results.push(result);
  }
  onProgress?.(tests.length, tests.length);
  return {
    results,
    passed: results.every((r) => r.outcome.status === 'pass'),
    steps: results.filter((r) => !r.test.hidden).reduce((sum, r) => sum + r.steps, 0),
  };
}

const parCache = new Map<string, Promise<{ par: number; runs: TestResult[] }>>();

/** The reference solution's runs on the visible tests, and its step total: the par. */
export function reference(kernel: Kernel): Promise<{ par: number; runs: TestResult[] }> {
  let cached = parCache.get(kernel.id);
  if (!cached) {
    cached = (async () => {
      const runs: TestResult[] = [];
      for (const test of testsOf(kernel).filter((t) => !t.hidden)) runs.push(await runTest(solutionTemplate(kernel), kernel, test));
      return { par: runs.reduce((sum, r) => sum + r.steps, 0), runs };
    })();
    parCache.set(kernel.id, cached);
  }
  return cached;
}

/**
 * Stars for a pass: one for passing, one for not leaning on the later hints,
 * one for matching par; every hint level opened costs a star. A pass always
 * keeps at least one.
 */
export function starsFor(passed: boolean, hintsUsed: number, steps: number, par: number): number {
  if (!passed) return 0;
  const earned = 1 + (hintsUsed <= 1 ? 1 : 0) + (steps <= par ? 1 : 0);
  return Math.max(1, Math.min(earned, 3 - hintsUsed));
}

/** "same result, 4 fewer steps" */
export function compareLine(steps: number, par: number): string {
  if (steps === par) return 'Same result, same number of steps as the reference.';
  const d = Math.abs(steps - par);
  return steps < par ? `Same result, ${d} fewer step${d === 1 ? '' : 's'} than the reference.` : `Same result, ${d} more step${d === 1 ? '' : 's'} than the reference.`;
}

const refRunCache = new Map<string, Promise<TestResult>>();

/** The reference solution's run on one test's input (for finding where a failing run parts from it). */
export function referenceRun(kernel: Kernel, test: TestCase): Promise<TestResult> {
  const key = `${kernel.id}:${JSON.stringify(test.input)}`;
  let cached = refRunCache.get(key);
  if (!cached) {
    cached = runTest(solutionTemplate(kernel), kernel, test);
    refRunCache.set(key, cached);
  }
  return cached;
}

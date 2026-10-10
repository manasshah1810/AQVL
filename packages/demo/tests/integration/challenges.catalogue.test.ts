/**
 * Complete the Algorithm: every challenge in the catalogue, graded for real.
 *
 * For each algorithm, through the same compile → record → grade path the
 * Challenges page uses:
 *   - the solution passes every visible and hidden test;
 *   - every wrong option of every blank fails at least one test (a wrong pick
 *     must visibly misbehave);
 *   - the bug fails at least one visible test (so the stage can show the
 *     symptom), the right fix passes, and every wrong fix fails;
 *   - the shuffled core (Assemble) is not already in order, and the right
 *     order passes; the blank core (Write) does not pass;
 *   - the core is small enough to assemble, and every expectation reads.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { grade, testsOf } from '../../src/pages/challenges/complete/grade';
import {
  blankAnswers,
  buggyTemplate,
  fixedTemplate,
  indentLines,
  shuffleLines,
  solutionTemplate,
  splitCore,
  withBlanks,
  withCore,
} from '../../src/pages/challenges/complete/program';
import { writeScaffold } from '../../src/pages/challenges/complete/modes';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

const only = process.env.CHALLENGE ? CATALOGUE.filter((k) => k.id.startsWith(process.env.CHALLENGE!)) : CATALOGUE;

function why(report: Awaited<ReturnType<typeof grade>>): string {
  if (report.compileError) return `compile error: ${report.compileError.message} (line ${report.compileError.line})`;
  return report.results
    .filter((r) => r.outcome.status !== 'pass')
    .map((r) => {
      const o = r.outcome;
      const where = `test ${r.test.index}${r.test.hidden ? ` (${r.test.category})` : ''}`;
      if (o.status === 'fail') return `${where}: ${o.checks.filter((c) => !c.ok).map((c) => `${c.expectation.name} expected ${c.expected}, got ${c.actual}`).join('; ')}`;
      if (o.status === 'runtime-error') return `${where}: runtime error ${o.message} (line ${o.line})`;
      return `${where}: ${o.status}`;
    })
    .join('\n');
}

describe('Complete the Algorithm catalogue', () => {
  it('has unique ids and enough tests everywhere', () => {
    const ids = new Set<string>();
    for (const k of CATALOGUE) {
      expect(ids.has(k.id), k.id).toBe(false);
      ids.add(k.id);
      expect(k.visible.length, k.id).toBeGreaterThanOrEqual(3);
      expect(k.hidden.length, k.id).toBeGreaterThanOrEqual(2);
      expect(k.blanks.length, k.id).toBe(blankAnswers(k).length);
      expect(k.blanks.length, k.id).toBeGreaterThanOrEqual(1);
      expect(k.blanks.length, k.id).toBeLessThanOrEqual(3);
      for (const [i, wrong] of k.blanks.entries()) {
        expect(wrong.length, `${k.id} blank ${i}`).toBeGreaterThanOrEqual(2);
        expect(wrong.length + 1, `${k.id} blank ${i}`).toBeLessThanOrEqual(4);
        expect(wrong, `${k.id} blank ${i}`).not.toContain(blankAnswers(k)[i]);
      }
      expect(k.bug.fixes, k.id).not.toContain(k.bug.find);
      const core = splitCore(k).core;
      expect(core.length, `${k.id} core`).toBeGreaterThanOrEqual(3);
      expect(core.length, `${k.id} core`).toBeLessThanOrEqual(16);
    }
  });

  for (const k of only) {
    describe(k.id, () => {
      it('solution passes every test', async () => {
        const report = await grade(solutionTemplate(k), k);
        expect(report.passed, why(report)).toBe(true);
        // Every expectation reads a value the run really produced.
        for (const r of report.results) expect(r.trace?.final, `${k.id} test ${r.test.index}`).toBeTruthy();
      }, 120_000);

      it('every wrong blank option fails a test', async () => {
        const answers = blankAnswers(k);
        for (const [i, wrongs] of k.blanks.entries()) {
          for (const wrong of wrongs) {
            const picks = [...answers];
            picks[i] = wrong;
            const report = await grade(withBlanks(k, picks), k);
            expect(report.passed, `${k.id}: blank ${i} = "${wrong}" passes every test`).toBe(false);
          }
        }
      }, 300_000);

      it('the bug shows on a visible test; only the right fix passes', async () => {
        const buggy = await grade(buggyTemplate(k), k);
        const visibleFail = buggy.compileError || buggy.results.some((r) => !r.test.hidden && r.outcome.status !== 'pass');
        expect(visibleFail, `${k.id}: the bug passes every visible test`).toBeTruthy();
        const right = await grade(fixedTemplate(k, k.bug.find), k);
        expect(right.passed, why(right)).toBe(true);
        for (const fix of k.bug.fixes) {
          const report = await grade(fixedTemplate(k, fix), k);
          expect(report.passed, `${k.id}: wrong fix "${fix}" passes`).toBe(false);
        }
      }, 300_000);

      it('assemble and write are real tasks', async () => {
        const { core, indent } = splitCore(k);
        const shuffled = shuffleLines(core, k.id);
        expect(shuffled.map((l) => l.trim()), `${k.id}: shuffle is already in order`).not.toEqual(core.map((l) => l.trim()));
        const ordered = await grade(withCore(k, indentLines(core, indent).join('\n')), k);
        expect(ordered.passed, why(ordered)).toBe(true);
        const blank = await grade(withCore(k, writeScaffold(k)), k);
        expect(blank.passed, `${k.id}: the empty core passes`).toBe(false);
        expect(testsOf(k).length).toBe(k.visible.length + k.hidden.length);
      }, 120_000);
    });
  }
});

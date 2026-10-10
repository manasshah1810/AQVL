/**
 * Complete the Algorithm: a failing run is paused where it first goes wrong.
 *
 * For every algorithm, the buggy program (Spot the Bug's starting point) and
 * every wrong blank option are graded; each failing visible test must yield
 * a divergence on a real frame of its run, with a sentence to show.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { divergenceValues, findDivergence, explainDivergence } from '../../src/pages/challenges/complete/diverge';
import { grade, reference } from '../../src/pages/challenges/complete/grade';
import { blankAnswers, buggyTemplate, withBlanks } from '../../src/pages/challenges/complete/program';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

const only = process.env.CHALLENGE ? CATALOGUE.filter((k) => k.id.startsWith(process.env.CHALLENGE!)) : CATALOGUE;
const SHOW = !!process.env.SHOW_DIVERGE;

describe('divergence', () => {
  for (const k of only) {
    it(`${k.id}: every failing visible run has a place to pause`, async () => {
      const { runs } = await reference(k);
      const answers = blankAnswers(k);
      const programs = [buggyTemplate(k), ...k.blanks.flatMap((wrongs, i) => wrongs.map((w) => withBlanks(k, answers.map((a, j) => (j === i ? w : a)))))];
      for (const program of programs) {
        const report = await grade(program, k);
        if (report.compileError) continue;
        for (const r of report.results) {
          if (r.test.hidden || r.outcome.status === 'pass') continue;
          const ref = runs.find((x) => x.test.index === r.test.index) ?? null;
          const d = findDivergence(r, ref);
          expect(d, `${k.id} test ${r.test.index}`).not.toBeNull();
          expect(d!.frame).toBeGreaterThanOrEqual(0);
          expect(d!.frame).toBeLessThan(r.trace!.frames.length);
          const { title, body } = explainDivergence(d!);
          for (const v of divergenceValues(d!)) expect(v.value, `${k.id} ${v.label}`).not.toMatch(/undefined/);
          expect(title.length).toBeGreaterThan(0);
          expect(body).not.toMatch(/undefined/);
          if (SHOW) process.stdout.write(`${k.id} t${r.test.index} [${d!.kind} @${d!.frame}/${r.trace!.frames.length - 1}] ${title} — ${body}\n`);
        }
      }
    }, 300_000);
  }
});

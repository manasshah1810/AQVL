/**
 * Ghost Move: every algorithm in the catalogue is cut into a puzzle from its
 * real recorded run. Each puzzle must have 3 to 5 prediction points with a
 * right answer among their targets, and a perfect set of answers must score
 * full marks (so the grader agrees with the recording).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { puzzlesOf, CATEGORIES, gradePoint, summarize, type Puzzle } from '../../src/pages/challenges/ghost/puzzle';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const puzzles: { id: string; topic: string; puzzle: Puzzle | null }[] = [];

describe('Ghost Move puzzles', () => {
  it('builds puzzles from the whole catalogue', async () => {
    for (const k of CATALOGUE) {
      const ps = await puzzlesOf(k);
      if (ps.length === 0) puzzles.push({ id: k.id, topic: k.topic, puzzle: null });
      for (const p of ps) puzzles.push({ id: p.id, topic: k.topic, puzzle: p });
    }
    const missing = puzzles.filter((p) => !p.puzzle).map((p) => p.id);
    console.info('no puzzle:', missing.join(', '));
    // Only programs that draw nothing (plain recursion on numbers) have nothing to place.
    for (const m of missing) expect(m.startsWith('rec-') && m !== 'rec-array-sum', m).toBe(true);
    const cats = new Set(puzzles.flatMap((p) => p.puzzle?.points.map((x) => x.category) ?? []));
    console.info('categories:', [...cats].join(', '), 'runs:', puzzles.filter((p) => p.puzzle).length);
    for (const c of CATEGORIES) expect(cats.has(c), c).toBe(true);
    for (const topic of new Set(CATALOGUE.map((k) => k.topic))) {
      if (topic === 'Recursion') continue;
      expect(puzzles.some((p) => p.topic === topic && p.puzzle), topic).toBe(true);
    }
  }, 120_000);

  it('gives every puzzle 3 to 5 gradable points', () => {
    for (const { id, puzzle } of puzzles) {
      if (!puzzle) continue;
      expect(puzzle.points.length, id).toBeGreaterThanOrEqual(2);
      expect(puzzle.points.length, id).toBeLessThanOrEqual(5);
      expect(puzzle.trace.frames.length - 1, id).toBeLessThanOrEqual(90);
      expect(puzzle.trace.frames.length - 1, id).toBe(puzzle.points[puzzle.points.length - 1].frame);
      let last = 0;
      for (const p of puzzle.points) {
        expect(p.frame, id).toBeGreaterThan(last);
        last = p.frame;
        const ids = new Set(p.targets.map((t) => t.id));
        expect(ids.size, `${id} unique targets`).toBe(p.targets.length);
        for (const a of p.asks) expect(ids.has(a.answer), `${id} @${p.frame} answer in targets`).toBe(true);
        // A perfect answer scores full marks; a wrong one scores less.
        const perfect = gradePoint(puzzle.trace, p, Object.fromEntries(p.asks.map((a) => [a.id, a.answer])), 0);
        expect(perfect.score, `${id} @${p.frame}`).toBe(1);
        expect(perfect.hit).toBe(true);
        const wrongId = p.targets.find((t) => !p.asks.some((a) => a.answer === t.id))!.id;
        const wrong = gradePoint(puzzle.trace, p, Object.fromEntries(p.asks.map((a) => [a.id, wrongId])), 0);
        expect(wrong.hit, `${id} @${p.frame} wrong`).toBe(false);
        expect(wrong.score).toBeLessThan(1);
        const rewound = gradePoint(puzzle.trace, p, Object.fromEntries(p.asks.map((a) => [a.id, a.answer])), 2);
        expect(rewound.score).toBeLessThan(1);
      }
      expect(summarize(puzzle.points.map((p) => gradePoint(puzzle.trace, p, Object.fromEntries(p.asks.map((a) => [a.id, a.answer])), 0))).stars).toBe(3);
    }
  });
});

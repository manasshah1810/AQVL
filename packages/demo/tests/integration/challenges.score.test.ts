/**
 * Complete the Algorithm: points, ranks and progress kept in this browser,
 * and hints that read what is on screen in every mode.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { hintsFor } from '../../src/pages/challenges/complete/hints';
import { CHALLENGES, getChallenge, matchesQuery, neighboursOf, nextUnsolved, scoreOf, siblingsOf } from '../../src/pages/challenges/complete/modes';
import { blankAnswers, bugLine, shuffleLines, solutionTemplate, splitCore } from '../../src/pages/challenges/complete/program';
import { _reloadProgress, getLastOpened, getProgress, markOpened, pointsFor, rankOf, recordAttempt, recordHints, resetProgress } from '../../src/pages/challenges/complete/progress';

beforeEach(() => {
  localStorage.clear();
  _reloadProgress();
});

describe('points and progress', () => {
  it('every star is worth more on a harder challenge', () => {
    expect(pointsFor('Easy', 3)).toBe(30);
    expect(pointsFor('Medium', 2)).toBe(40);
    expect(pointsFor('Hard', 1)).toBe(30);
    expect(pointsFor('Hard', 9)).toBe(90);
  });

  it('keeps the best result, counts every attempt, and survives a reload', () => {
    const c = getChallenge('sort-quick.boss')!;
    expect(c.difficulty).toBe('Hard');
    recordAttempt(c.id, { passed: false, stars: 0, steps: 10 });
    recordAttempt(c.id, { passed: true, stars: 2, steps: 40, points: pointsFor(c.difficulty, 2) });
    recordAttempt(c.id, { passed: true, stars: 1, steps: 30, points: pointsFor(c.difficulty, 1) });
    _reloadProgress();
    const p = getProgress()[c.id];
    expect(p).toMatchObject({ attempts: 3, stars: 2, points: 60, bestSteps: 30 });
    expect(scoreOf(getProgress())).toMatchObject({ points: 60, stars: 2, solved: 1, total: 265 });
  });

  it('works out points for progress saved before points existed', () => {
    localStorage.setItem('aqvl-challenges', JSON.stringify({ 'array-max.blank': { stars: 3, attempts: 1 }, 'sort-quick.bug': { stars: 2, attempts: 4 }, junk: 5 }));
    _reloadProgress();
    expect(scoreOf(getProgress()).points).toBe(30 + 60);
  });

  it('opened hints stay counted until a pass', () => {
    recordHints('array-max.bug', 2);
    recordHints('array-max.bug', 1);
    _reloadProgress();
    expect(getProgress()['array-max.bug'].hints).toBe(2);
    recordAttempt('array-max.bug', { passed: true, stars: 1, steps: 5, points: 20 });
    expect(getProgress()['array-max.bug'].hints).toBe(0);
  });

  it('remembers the last challenge opened, and resets', () => {
    markOpened('heap-build.order');
    _reloadProgress();
    expect(getLastOpened()).toBe('heap-build.order');
    resetProgress();
    _reloadProgress();
    expect(getProgress()).toEqual({});
    expect(getLastOpened()).toBeUndefined();
  });

  it('ranks rise with points', () => {
    expect(rankOf(0).title).toBe('Newcomer');
    expect(rankOf(99).next!.title).toBe('Apprentice');
    expect(rankOf(100).title).toBe('Apprentice');
    expect(rankOf(1_000_000).next).toBeNull();
    // The whole catalogue at three stars reaches the top rank.
    const max = CHALLENGES.reduce((s, c) => s + pointsFor(c.difficulty, 3), 0);
    expect(rankOf(max).next).toBeNull();
  });
});

describe('finding your way', () => {
  it('265 challenges: every algorithm in five modes, searchable by any word', () => {
    expect(CHALLENGES).toHaveLength(CATALOGUE.length * 5);
    expect(CHALLENGES.length).toBe(265);
    const hits = (q: string) => CHALLENGES.filter((c) => matchesQuery(c, q)).map((c) => c.id);
    expect(hits('bubble')).toHaveLength(5);
    expect(hits('BUBBLE spot')).toEqual(['sort-bubble.bug']);
    expect(hits('tries').length).toBeGreaterThan(0);
    expect(hits('hard boss').every((id) => id.endsWith('.boss'))).toBe(true);
    expect(hits('zzz-nothing')).toHaveLength(0);
  });

  it('steps through the list, the modes of one algorithm, and what is left to solve', () => {
    const first = CHALLENGES[0];
    expect(neighboursOf(first).prev).toBeNull();
    expect(neighboursOf(first).next).toBe(CHALLENGES[1]);
    expect(neighboursOf(CHALLENGES[264]).next).toBeNull();
    expect(siblingsOf(getChallenge('trie-insert.write')!).map((c) => c.mode)).toEqual(['blank', 'order', 'bug', 'write', 'boss']);
    const solved = { [CHALLENGES[1].id]: { stars: 1, points: 10, attempts: 1, hints: 0 } };
    expect(nextUnsolved(first, solved)!.id).toBe(CHALLENGES[2].id);
    const all = Object.fromEntries(CHALLENGES.map((c) => [c.id, { stars: 1, points: 10, attempts: 1, hints: 0 }]));
    expect(nextUnsolved(first, all)).toBeNull();
  });
});

describe('contextual hints', () => {
  for (const k of CATALOGUE) {
    it(`${k.id}: every mode has three levels that read the screen`, () => {
      const sol = solutionTemplate(k);
      for (const mode of ['blank', 'order', 'bug', 'write'] as const) {
        const hs = hintsFor(k, mode, null, sol);
        expect(hs).toHaveLength(3);
        for (const h of hs) expect(h.text.length, `${mode} ${h.title}`).toBeGreaterThan(10);
      }
      // Fill the Blank: names the wrong gap.
      const answers = blankAnswers(k);
      const picks = answers.map((a, i) => (i === 0 ? k.blanks[0][0] : a));
      expect(hintsFor(k, 'blank', { mode: 'blank', picks }, sol)[1].text).toMatch(/^Gap 1 is not right yet\./);
      expect(hintsFor(k, 'blank', { mode: 'blank', picks: answers }, sol)[1].text).toMatch(/Every gap you picked is right/);
      // Assemble: names the first line out of place.
      const core = splitCore(k).core.map((l) => l.trim());
      const shuffled = shuffleLines(core, k.id);
      const first = shuffled.findIndex((l, i) => l !== core[i]);
      expect(hintsFor(k, 'order', { mode: 'order', lines: shuffled }, sol)[1].code).toBe(core[first]);
      expect(hintsFor(k, 'order', { mode: 'order', lines: core }, sol)[1].text).toMatch(/right order/);
      // Spot the Bug: a window of three lines that holds the bug.
      const target = bugLine(k) + 1;
      const [, from, to] = hintsFor(k, 'bug', { mode: 'bug', found: false, wrongPicks: [], fix: null }, sol)[1].text.match(/lines (\d+) to (\d+)/)!.map(Number);
      expect(target).toBeGreaterThanOrEqual(from);
      expect(target).toBeLessThanOrEqual(to);
      expect(hintsFor(k, 'bug', null, sol)[2].text).toContain(`Line ${target}`);
    });
  }
});

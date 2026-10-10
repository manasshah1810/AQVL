/**
 * Ghost Move, driven like a learner: the list, a whole set played through the
 * real runner (wrong and right drops, locking in, the verdict, the result
 * card), the rewind penalty, and the guard that stops the run at the pause.
 * The 3D canvas is a stub, so the drop targets use their grid fallback.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ExecutionTrace } from '@aqvl/runtime';

vi.mock('@aqvl/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aqvl/renderer')>();
  return {
    ...actual,
    StageCanvas: ({ trace, world }: { trace: ExecutionTrace; world: string }) => <div data-testid="stage-stub" data-world={world} data-steps={trace.frames.length - 1} />,
  };
});

import ChallengesPage from '../../src/pages/challenges/ChallengesPage';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { puzzlesOf, type Puzzle } from '../../src/pages/challenges/ghost/puzzle';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function go(path: string) {
  act(() => {
    window.location.hash = `#${path}`;
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-world', 'penguin');
});
afterEach(() => {
  go('/');
});

const playhead = () => (window as unknown as { __aqvl?: { playhead: import('@aqvl/renderer').Playhead } }).__aqvl!.playhead;

async function puzzle(id: string): Promise<Puzzle> {
  const kernel = CATALOGUE.find((k) => id.startsWith(`${k.id}.`))!;
  return (await puzzlesOf(kernel))[Number(id.split('.').pop()) - 1];
}

/** Drops ghost `ask` on target `targetId` the way a keyboard / click user does. */
function drop(p: Puzzle, pointIdx: number, askId: string, targetId: string) {
  const point = p.points[pointIdx];
  const ask = point.asks.find((a) => a.id === askId)!;
  const target = point.targets.find((t) => t.id === targetId)!;
  const same = point.targets.filter((t) => t.label === target.label);
  const chips = screen.getAllByRole('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Ghost ' + ask.ghost + ', not placed'));
  fireEvent.click(chips[0]);
  fireEvent.click(screen.getAllByRole('button', { name: `Drop here: ${target.label}` })[same.indexOf(target)]);
}

async function reachQuestion() {
  await waitFor(() => expect(screen.getByRole('region', { name: 'Question' })).toBeInTheDocument(), { timeout: 30_000 });
}

describe('Ghost Move page', () => {
  it('lists the algorithms that have something to place', async () => {
    go('/challenges/ghost');
    render(<ChallengesPage />);
    expect(screen.getByRole('link', { name: /Ghost Move/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tries', level: 2 })).toBeInTheDocument(), { timeout: 60_000 });
    expect(screen.getByRole('heading', { name: 'Sorting', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Selection sort: run 1/ })).toHaveLength(1);
    // Recursion on numbers draws its calls stack, so it has pieces to place too.
    expect(screen.getAllByRole('link', { name: /Factorial: run 1/ })).toHaveLength(1);
    expect(screen.queryByText(/Not listed:/)).toBeNull();
  }, 90_000);

  it('plays a whole set: miss, hit, locking in, the verdict and the result card', async () => {
    const p = await puzzle('sort-selection.1');
    go('/challenges/ghost/sort-selection.1');
    render(<ChallengesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Start the run/ })).toBeInTheDocument(), { timeout: 30_000 });
    expect(screen.getByTestId('stage-stub')).toHaveAttribute('data-world', 'studio');
    fireEvent.click(screen.getByRole('button', { name: /Start the run/ }));

    for (let i = 0; i < p.points.length; i++) {
      await reachQuestion();
      const point = p.points[i];
      // Nothing past the pause can be seen: pushing the playhead to the end stops at the pause.
      act(() => playhead().jumpToStep(playhead().totalSteps));
      expect(playhead().getSnapshot().step).toBeLessThanOrEqual(point.frame - 1);
      expect(screen.getByRole('button', { name: /Lock in/ })).toBeDisabled();
      // First prediction: deliberately wrong. Others: right.
      const wrongs = point.targets.filter((t) => !point.asks.some((x) => x.answer === t.id));
      point.asks.forEach((a, n) => drop(p, i, a.id, i === 0 ? wrongs[n].id : a.answer));
      expect(screen.getByRole('button', { name: /Lock in/ })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: /Lock in/ }));
      act(() => playhead().setSpeed(8));
      const next = await screen.findByRole('button', { name: /Next prediction|See the result/ }, { timeout: 30_000 });
      const verdict = screen.getByRole('status');
      if (i === 0) expect(within(verdict).getByRole('heading', { name: /Close|Not this time/ })).toBeInTheDocument();
      else expect(within(verdict).getByText('Exactly right.')).toBeInTheDocument();
      fireEvent.click(next);
    }

    const card = await screen.findByText(/% accurate/);
    expect(card).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Accuracy by kind of step' })).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('aqvl-ghost-move')!);
    expect(saved['sort-selection.1'].attempts).toBe(1);
    expect(saved['sort-selection.1'].stars).toBeGreaterThan(0);
  }, 120_000);

  it('counts a rewind and lowers what the prediction can score', async () => {
    // A prediction that is not the very first step (there is a picture to rewind to).
    const p = await puzzle('sort-selection.1');
    const at = p.points.findIndex((x) => x.frame > 1);
    expect(at).toBeGreaterThanOrEqual(0);
    go('/challenges/ghost/sort-selection.1');
    render(<ChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Start the run/ }, { timeout: 30_000 }));
    for (let i = 0; i <= at; i++) {
      await reachQuestion();
      if (i === at) break;
      for (const a of p.points[i].asks) drop(p, i, a.id, a.answer);
      fireEvent.click(screen.getByRole('button', { name: /Lock in/ }));
      act(() => playhead().setSpeed(8));
      fireEvent.click(await screen.findByRole('button', { name: /Next prediction|See the result/ }, { timeout: 30_000 }));
    }
    expect(screen.getByText(/Full marks available/)).toBeInTheDocument();
    act(() => playhead().stepBack());
    for (let i = 0; i < 12; i++) act(() => playhead().advance(0.1));
    await waitFor(() => expect(screen.getByText(/1 rewind: this prediction now scores at most 80%/)).toBeInTheDocument());
    // Going back forward to the pause does not count again, and the run still stops there.
    act(() => playhead().jumpToStep(p.points[at].frame - 1));
    act(() => playhead().stepForward());
    for (let i = 0; i < 12; i++) act(() => playhead().advance(0.1));
    expect(screen.getByText(/1 rewind:/)).toBeInTheDocument();
    expect(playhead().getSnapshot().step).toBeLessThanOrEqual(p.points[at].frame - 1);
  }, 90_000);

  it('explains an unknown puzzle', async () => {
    go('/challenges/ghost/nope.9');
    render(<ChallengesPage />);
    expect(screen.getByRole('heading', { name: 'No such puzzle.' })).toBeInTheDocument();
  }, 60_000);
});

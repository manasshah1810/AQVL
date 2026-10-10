/**
 * The Challenges page, driven like a learner would: the sections, the list,
 * and one challenge in every mode solved (and failed) through the real
 * grader. The 3D canvas is replaced by a stub that reports the trace and the
 * world it was handed (challenges must always use the plain studio).
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
import { getChallenge } from '../../src/pages/challenges/complete/modes';
import { blankAnswers, splitCore, solutionTemplate } from '../../src/pages/challenges/complete/program';
import { CATALOGUE } from '../../src/pages/challenges/complete/catalogue';
import { TOPICS } from '../../src/pages/challenges/complete/types';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function go(path: string) {
  act(() => {
    window.location.hash = `#${path}`;
  });
}

const RUN = () => screen.getByRole('button', { name: /^Run/ });

async function passed() {
  await waitFor(() => expect(screen.getByText(/All tests pass\.|Boss round cleared\./)).toBeInTheDocument(), { timeout: 30_000 });
}

/** Picks the right option in every gap. */
function fillBlanks(id: string) {
  const answers = blankAnswers(getChallenge(id)!.kernel);
  answers.forEach((a, i) => fireEvent.change(screen.getByLabelText(`Gap ${i + 1}`), { target: { value: a } }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-world', 'penguin');
});
afterEach(() => {
  go('/');
});

describe('Challenges page', () => {
  it('shows the three sections, with Complete the Algorithm open and every topic listed', () => {
    go('/challenges');
    render(<ChallengesPage />);
    const nav = screen.getByRole('navigation', { name: 'Kinds of challenge' });
    expect(within(nav).getByText('Complete the Algorithm')).toBeInTheDocument();
    expect(within(nav).getByText('Ghost Move')).toBeInTheDocument();
    expect(within(nav).getByText('Fork the Future')).toBeInTheDocument();
    expect(within(nav).getAllByText('Coming next')).toHaveLength(1);
    for (const topic of TOPICS) expect(screen.getByRole('heading', { name: topic, level: 2 })).toBeInTheDocument();
    // Every algorithm offers all five modes.
    expect(screen.getAllByRole('link', { name: /: Fill the Blank,/ })).toHaveLength(CATALOGUE.length);
    expect(screen.getAllByRole('link', { name: /: Boss Round,/ })).toHaveLength(CATALOGUE.length);
    expect(screen.getByText(`All ${CATALOGUE.length * 5} challenges`)).toBeInTheDocument();
    // The score starts empty.
    expect(within(screen.getByRole('region', { name: 'Your score' })).getByText('Newcomer')).toBeInTheDocument();
  });

  it('searches, filters by topic and status, and keeps the filters in the address', () => {
    go('/challenges/complete');
    render(<ChallengesPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search challenges' }), { target: { value: 'bubble' } });
    expect(screen.getAllByRole('link', { name: /^Bubble sort: / })).toHaveLength(5);
    expect(screen.queryAllByRole('link', { name: /^Selection sort: / })).toHaveLength(0);
    expect(screen.getByText('5 of 265 challenges')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/challenges/complete?q=bubble');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search challenges' }), { target: { value: 'spot the bug heap' } });
    for (const link of screen.getAllByRole('link', { name: /: Spot the Bug,/ })) expect(link.closest('section')!.id).toBe('topic-heaps');
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Tries/ })[0]);
    expect(screen.getByRole('heading', { name: 'Tries', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sorting', level: 2 })).toBeNull();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', { name: 'Solved' }));
    expect(screen.getByText('Nothing matches.')).toBeInTheDocument();
  });

  it('opens with the filters a link carries', () => {
    go('/challenges/complete?mode=write&level=Hard');
    render(<ChallengesPage />);
    expect(screen.queryAllByRole('link', { name: /: Fill the Blank,/ })).toHaveLength(0);
    for (const link of screen.getAllByRole('link', { name: /: Write the Core,/ })) expect(link.getAttribute('aria-label')).toMatch(/Hard/);
  });

  it('filters by mode and difficulty', () => {
    go('/challenges/complete');
    render(<ChallengesPage />);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name: 'Spot the Bug' }));
    expect(screen.queryAllByRole('link', { name: /: Fill the Blank,/ })).toHaveLength(0);
    expect(screen.getAllByRole('link', { name: /Spot the Bug/ }).length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Difficulty' })).getByRole('radio', { name: 'Easy' }));
    for (const link of screen.queryAllByRole('link', { name: /Spot the Bug/ })) expect(link.getAttribute('aria-label')).toMatch(/Easy/);
  });

  it('a section that is not built yet says so', () => {
    go('/challenges/fork');
    render(<ChallengesPage />);
    expect(screen.getByText('Fork the Future is next.')).toBeInTheDocument();
  });

  it('shows the plain studio while open and puts the visitor’s world back after', () => {
    go('/challenges');
    const { unmount } = render(<ChallengesPage />);
    expect(document.documentElement.getAttribute('data-world')).toBe('studio');
    unmount();
    expect(document.documentElement.getAttribute('data-world')).toBe('penguin');
  });
});

describe('Fill the Blank', () => {
  it('right picks pass every test, earn three stars, and are remembered', async () => {
    go('/challenges/complete/sort-bubble.blank');
    render(<ChallengesPage />);
    expect(RUN()).toBeDisabled();
    fillBlanks('sort-bubble.blank');
    fireEvent.click(RUN());
    await passed();
    expect(screen.getAllByRole('img', { name: '3 of 3 stars' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/6 of 6 tests pass/)).toBeInTheDocument();
    // The stage plays on the studio world, whatever the site's world was.
    expect(screen.getByTestId('stage-stub').getAttribute('data-world')).toBe('studio');
    expect(JSON.parse(localStorage.getItem('aqvl-challenges')!)['sort-bubble.blank'].stars).toBe(3);
    // Three stars on an Easy challenge: 30 points, saved with the result.
    expect(screen.getByText('+30 points')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('aqvl-challenges')!)['sort-bubble.blank'].points).toBe(30);
  }, 60_000);

  it('a wrong pick fails, shows expected against actual, and replays the failing case', async () => {
    go('/challenges/complete/sort-bubble.blank');
    render(<ChallengesPage />);
    fillBlanks('sort-bubble.blank');
    fireEvent.change(screen.getByLabelText('Gap 2'), { target: { value: '<' } });
    fireEvent.click(RUN());
    await waitFor(() => expect(screen.getByText(/tests pass/)).toBeInTheDocument(), { timeout: 30_000 });
    expect(screen.queryByText('All tests pass.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Wrong result').length).toBeGreaterThan(0);
    expect(screen.getAllByText('got').length).toBeGreaterThan(0);
    // Hidden tests name their category only.
    expect(screen.getByText('Hidden test · edge case: duplicates')).toBeInTheDocument();
    // The run plays up to the first step that goes wrong, stops there, and says why.
    await waitFor(() => expect(screen.getByText(/Your program · test 1/)).toBeInTheDocument(), { timeout: 10_000 });
    const playhead = () => (window as unknown as { __aqvl: { playhead: import('@aqvl/renderer').Playhead } }).__aqvl.playhead;
    await waitFor(() => expect(playhead().getSnapshot().playing).toBe(true), { timeout: 5_000 });
    for (let i = 0; i < 600 && playhead().getSnapshot().playing; i++) act(() => playhead().advance(0.1));
    expect(await screen.findByText('arr goes wrong here')).toBeInTheDocument();
    expect(playhead().getSnapshot().atEnd).toBe(false);
    expect(screen.getByText('[5, 9, 2, 1]')).toBeInTheDocument();
    expect(screen.getByText('[2, 5, 9, 1]')).toBeInTheDocument();
    // The free note under the hints says the same.
    expect(screen.getByText(/Test 1 fails\. Arr goes wrong here at step 3/)).toBeInTheDocument();
    // Continue plays to the end, where the verdict card shows expected against what the run left.
    fireEvent.click(screen.getByRole('button', { name: 'Continue the run' }));
    for (let i = 0; i < 600 && !playhead().getSnapshot().atEnd; i++) act(() => playhead().advance(0.1));
    expect(await screen.findByText('Test 1 fails')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show where it went wrong' }));
    expect(await screen.findByText('arr goes wrong here')).toBeInTheDocument();
    const replay = screen.getAllByRole('button', { name: /Replay Test \d in 3D/ });
    fireEvent.click(replay[replay.length - 1]);
    await waitFor(() => expect(screen.getByText(/Your program · test 3/)).toBeInTheDocument());
  }, 60_000);

  it('each hint level costs a star, reads the gaps on screen, and stays counted', async () => {
    go('/challenges/complete/rec-factorial.blank');
    const { unmount } = render(<ChallengesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Show a nudge/ }));
    unmount();
    // Leaving and coming back does not refund a hint.
    render(<ChallengesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Show pinpoint/ }));
    expect(screen.getByText(/Gaps 1, 2 and 3 are still empty\./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Gap 1'), { target: { value: '==' } });
    expect(screen.getByText(/Gap 1 is not right yet\. Gaps 2 and 3 are still empty\./)).toBeInTheDocument();
    fillBlanks('rec-factorial.blank');
    expect(screen.getByText(/Every gap you picked is right/)).toBeInTheDocument();
    fireEvent.click(RUN());
    await passed();
    expect(screen.getAllByRole('img', { name: '1 of 3 stars' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('img', { name: /[23] of 3 stars/ })).toHaveLength(0);
  }, 60_000);
});

describe('Spot the Bug', () => {
  it('plays the buggy run first, rejects a wrong line, then the right fix passes', async () => {
    const challenge = getChallenge('array-max.bug')!;
    go(`/challenges/complete/${challenge.id}`);
    render(<ChallengesPage />);
    await waitFor(() => expect(screen.getByText(/The buggy program · test/)).toBeInTheDocument(), { timeout: 30_000 });
    expect(screen.getByText(/the buggy program leaves/)).toBeInTheDocument();
    const lines = screen.getAllByRole('button', { name: /^Line \d+:/ });
    const wrong = lines.find((b) => !b.getAttribute('aria-label')!.includes(challenge.kernel.bug.replace))!;
    fireEvent.click(wrong);
    expect(screen.getByText(/is fine\. Watch the stage again/)).toBeInTheDocument();
    fireEvent.click(lines.find((b) => b.getAttribute('aria-label')!.includes(challenge.kernel.bug.replace))!);
    fireEvent.click(screen.getByRole('radio', { name: challenge.kernel.bug.find }));
    fireEvent.click(RUN());
    await passed();
    expect(screen.getByText(challenge.kernel.bug.why)).toBeInTheDocument();
  }, 60_000);
});

describe('Assemble the Steps', () => {
  it('starts shuffled (failing) and passes once the tiles are in order', async () => {
    const challenge = getChallenge('stack-reverse.order')!;
    go(`/challenges/complete/${challenge.id}`);
    render(<ChallengesPage />);
    fireEvent.click(RUN());
    // Shuffled, the program usually does not even compile (an END in the wrong place); either way it does not pass.
    await waitFor(() => expect(screen.queryByText(/tests pass/) ?? screen.queryByText('Does not compile')).toBeInTheDocument(), { timeout: 30_000 });
    expect(screen.queryByText('All tests pass.')).not.toBeInTheDocument();

    // Put the tiles in the solution's order with the keyboard-friendly arrows.
    const want = splitCore(challenge.kernel).core.map((l) => l.trim());
    for (let p = 0; p < want.length; p++) {
      const texts = () => Array.from(document.querySelectorAll('.ch-tile__src')).map((el) => el.textContent!.trim());
      let at = texts().findIndex((t, i) => i >= p && t === want[p]);
      while (at > p) {
        fireEvent.click(screen.getAllByRole('button', { name: `Move "${want[p]}" up` })[0]);
        at = texts().findIndex((t, i) => i >= p && t === want[p]);
      }
    }
    fireEvent.click(RUN());
    await passed();
  }, 90_000);
});

describe('Write the Core', () => {
  it('a blank core fails; the real core passes', async () => {
    const challenge = getChallenge('rec-gcd.write')!;
    go(`/challenges/complete/${challenge.id}`);
    render(<ChallengesPage />);
    fireEvent.click(RUN());
    await waitFor(() => expect(screen.getByText(/tests pass/)).toBeInTheDocument(), { timeout: 30_000 });
    expect(screen.queryByText('All tests pass.')).not.toBeInTheDocument();
    const editor = document.querySelector('textarea.aqvl-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: splitCore(challenge.kernel).core.join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText(/Preview · your code on a tiny input/)).toBeInTheDocument(), { timeout: 30_000 });
    fireEvent.click(RUN());
    await passed();
  }, 60_000);

  it('a compile error is reported against the learner’s own line', async () => {
    go('/challenges/complete/rec-gcd.write');
    render(<ChallengesPage />);
    const editor = document.querySelector('textarea.aqvl-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'IF b == 0\n  RETURN a\n' } });
    fireEvent.click(RUN());
    await waitFor(() => expect(screen.getByText('Does not compile')).toBeInTheDocument(), { timeout: 30_000 });
  }, 60_000);
});

describe('Boss Round', () => {
  it('chains blank, bug and write stages on one algorithm', async () => {
    const challenge = getChallenge('rec-factorial.boss')!;
    const k = challenge.kernel;
    go(`/challenges/complete/${challenge.id}`);
    render(<ChallengesPage />);

    fillBlanks(challenge.id);
    fireEvent.click(RUN());
    await waitFor(() => expect(screen.getByText('Stage 1 cleared.')).toBeInTheDocument(), { timeout: 30_000 });
    fireEvent.click(screen.getByRole('button', { name: /On to stage 2/ }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Line \d+:/ }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /^Line \d+:/ }).find((b) => b.getAttribute('aria-label')!.includes(k.bug.replace))!);
    fireEvent.click(screen.getByRole('radio', { name: k.bug.find }));
    fireEvent.click(RUN());
    await waitFor(() => expect(screen.getByText('Stage 2 cleared.')).toBeInTheDocument(), { timeout: 30_000 });
    fireEvent.click(screen.getByRole('button', { name: /On to stage 3/ }));

    const editor = document.querySelector('textarea.aqvl-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: splitCore(k).core.join('\n') } });
    fireEvent.click(RUN());
    await passed();
    expect(JSON.parse(localStorage.getItem('aqvl-challenges')!)['rec-factorial.boss'].stars).toBeGreaterThan(0);
    expect(solutionTemplate(k)).toContain(k.bug.find);
  }, 120_000);
});

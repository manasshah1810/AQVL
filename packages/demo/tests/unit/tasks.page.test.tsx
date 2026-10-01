import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { sealEntry, serializeEntry } from '../../src/pages/tasks/ledger';
import type { LedgerEntry } from '../../src/pages/tasks/ledger';

const mock = vi.hoisted(() => ({ raw: '' }));
vi.mock('../../src/pages/tasks/ledger/ledger.jsonl?raw', () => ({
  get default() {
    return mock.raw;
  },
}));

import TasksPage from '../../src/pages/tasks/TasksPage';

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

/** A correctly chained ledger, as the CLI would have written it. */
function chain(events: Omit<LedgerEntry, 'hash' | 'prev' | 'seq'>[]): string {
  const out: LedgerEntry[] = [];
  for (const e of events) out.push(sealEntry(e, out[out.length - 1]));
  return out.map(serializeEntry).join('');
}

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const base = { actor: 'tester@example.com', head: 'a'.repeat(40) };
const evidence = (elapsedMin: number) => ({ startHead: base.head, elapsedMin, files: ['poc/ai-api/contract.md'], linesAdded: 40, required: [], checks: [] });
const completedY1 = () => [
  { ...base, ts: iso(90), task: 'Y1', event: 'start' as const },
  { ...base, ts: iso(30), task: 'Y1', event: 'complete' as const, evidence: evidence(60) },
];

describe('/tasks command center (read-only, ledger-backed)', () => {
  beforeEach(() => {
    mock.raw = '';
    window.localStorage.clear();
    window.location.hash = '#/tasks';
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('overview shows all four members with honest 0% progress', () => {
    render(<TasksPage />);
    expect(screen.getByText('Roadmap not started')).toBeInTheDocument();
    for (const id of ['manas', 'yash', 'tirrth', 'pranav']) {
      expect(within(screen.getByTestId(`member-${id}`)).getByText(/^0% · 0\//)).toBeInTheDocument();
    }
  });

  it('navigates between dashboards by hash', () => {
    render(<TasksPage />);
    go('#/tasks/yash');
    expect(screen.getByRole('heading', { level: 1, name: 'Yash Poojari' })).toBeInTheDocument();
    go('#/tasks/manas');
    expect(screen.getByText('Roadmap, tasks & prompts')).toBeInTheDocument();
  });

  it('offers no way to change a status by hand', () => {
    render(<TasksPage />);
    go('#/tasks/yash');
    const row = screen.getByTestId('task-Y1');
    expect(within(row).queryByRole('checkbox')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: /Y1/ }));
    expect(within(row).queryByLabelText('Status')).toBeNull();
    expect(within(row).queryByLabelText('Priority')).toBeNull();
    expect(screen.queryByRole('button', { name: /mark complete|start this task|record blocker|unblock/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(import|export|reset all progress)$/i })).toBeNull();
    expect(screen.queryByText('Record this session')).toBeNull();
    fireEvent.click(within(row).getByRole('img', { name: 'Not verified complete' }));
    expect(within(row).getByRole('img', { name: 'Not verified complete' })).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('shows a completion only because the ledger records it, with elapsed time', () => {
    mock.raw = chain(completedY1());
    render(<TasksPage />);
    go('#/tasks');
    expect(within(screen.getByTestId('member-yash')).getByText('8% · 1/12')).toBeInTheDocument();
    go('#/tasks/yash');
    const row = screen.getByTestId('task-Y1');
    expect(within(row).getByRole('img', { name: 'Verified complete' })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: /Y1/ }));
    expect(within(row).getByText(/1h elapsed/)).toBeInTheDocument();
  });

  it('a tampered ledger is flagged and nothing past the break counts', () => {
    const lines = chain(completedY1()).split('\n').filter(Boolean);
    mock.raw = `${lines[0]}\n${lines[1].replace('"linesAdded":40', '"linesAdded":4000')}\n`;
    render(<TasksPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Ledger integrity failure/);
    go('#/tasks');
    expect(within(screen.getByTestId('member-yash')).getByText(/^0% · 0\//)).toBeInTheDocument();
  });

  it('a hand-written entry that does not chain is rejected', () => {
    mock.raw = `${JSON.stringify({ seq: 1, ts: iso(5), task: 'Y1', event: 'complete', actor: 'x', head: 'a'.repeat(40), prev: '0'.repeat(64), hash: 'f'.repeat(64) })}\n`;
    render(<TasksPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Ledger integrity failure/);
  });

  it('shows refused completion attempts on the task', () => {
    mock.raw = chain([{ ...base, ts: iso(5), task: 'Y1', event: 'flag', note: 'No commits by tester@example.com between start and now.' }]);
    render(<TasksPage />);
    go('#/tasks/yash');
    const row = screen.getByTestId('task-Y1');
    fireEvent.click(within(row).getByRole('button', { name: /Y1/ }));
    expect(within(row).getByText(/1 completion attempt refused/)).toBeInTheDocument();
  });

  it('copies the prompt wrapped in its bookkeeping steps while showing the plain prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<TasksPage />);
    go('#/tasks/manas');
    fireEvent.click(screen.getByRole('button', { name: /Phase 3\s*Prove the centralization is real/ }));
    const row = screen.getByTestId('task-R3.2');
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Copy' }));
    });
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('deliberately throwaway, non-spatial, non-DSA toy domain');
    expect(copied).toContain('pnpm task start R3.2');
    expect(copied).toContain('pnpm task done R3.2');
    fireEvent.click(within(row).getByRole('button', { name: /R3\.2/ }));
    expect(within(row).queryByText(/pnpm task/)).toBeNull();
  });

  it('report view derives its KPIs from ledger completions', () => {
    mock.raw = chain([
      ...completedY1(),
      { ...base, ts: iso(20), task: 'Y2', event: 'start' },
      { ...base, ts: iso(5), task: 'Y2', event: 'complete', evidence: evidence(15) },
    ]);
    render(<TasksPage />);
    go('#/tasks/report');
    expect(screen.getByRole('heading', { level: 1, name: 'AQVL project status' })).toBeInTheDocument();
    const kpi = (label: string) => screen.getAllByText(label).find((el) => el.classList.contains('tk-kpi__label'))!.closest('.tk-kpi') as HTMLElement;
    expect(within(kpi('Team tasks')).getByText('2/29')).toBeInTheDocument();
    expect(within(kpi('Blocked')).getByText('0')).toBeInTheDocument();
  });

  it('marks tasks overdue from the real current date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 9));
    render(<TasksPage />);
    go('#/tasks/yash');
    expect(within(screen.getByTestId('task-Y1')).getByText(/5d overdue/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});

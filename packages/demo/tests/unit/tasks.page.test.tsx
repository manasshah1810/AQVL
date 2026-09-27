import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from '../../src/pages/tasks/TasksPage';
import { STORAGE_KEY } from '../../src/pages/tasks/model';

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
}

describe('/tasks command center', () => {
  beforeEach(() => {
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
      const card = screen.getByTestId(`member-${id}`);
      expect(within(card).getByText(/^0% · 0\//)).toBeInTheDocument();
    }
  });

  it('navigates between dashboards by hash', () => {
    render(<TasksPage />);
    go('#/tasks/yash');
    expect(screen.getByRole('heading', { level: 1, name: 'Yash Poojari' })).toBeInTheDocument();
    expect(screen.getByText('Demo pipeline')).toBeInTheDocument();
    go('#/tasks/tirrth');
    expect(screen.getByRole('heading', { level: 1, name: 'Tirrth Mistry' })).toBeInTheDocument();
    expect(screen.getByText(/Out of scope — do not touch/)).toBeInTheDocument();
    go('#/tasks/manas');
    expect(screen.getByText('Roadmap, tasks & prompts')).toBeInTheDocument();
  });

  it('completing a task updates progress and survives a remount', () => {
    const { unmount } = render(<TasksPage />);
    go('#/tasks/yash');
    const row = screen.getByTestId('task-Y1');
    fireEvent.click(within(row).getByRole('checkbox'));
    expect(stored().overrides.Y1.status).toBe('completed');
    expect(screen.getAllByText('1/8').length).toBeGreaterThan(0);
    unmount();

    render(<TasksPage />);
    go('#/tasks');
    expect(within(screen.getByTestId('member-yash')).getByText('13% · 1/8')).toBeInTheDocument();
  });

  it('changes status and priority from task details and records a blocker', () => {
    render(<TasksPage />);
    go('#/tasks/pranav');
    const row = screen.getByTestId('task-P6');
    fireEvent.click(within(row).getByRole('button', { name: /P6/ }));
    fireEvent.change(within(row).getByLabelText('Status'), { target: { value: 'in_progress' } });
    fireEvent.change(within(row).getByLabelText('Priority'), { target: { value: 'P0' } });
    expect(stored().overrides.P6).toMatchObject({ status: 'in_progress', priority: 'P0' });

    fireEvent.change(within(row).getByPlaceholderText('What is stopping this task?'), { target: { value: 'Lens.org down' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Record blocker' }));
    expect(stored().overrides.P6).toMatchObject({ status: 'blocked', blocker: 'Lens.org down' });
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });

  it('expands a roadmap phase and copies its prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<TasksPage />);
    go('#/tasks/manas');
    fireEvent.click(screen.getByRole('button', { name: /Phase 3\s*Prove the centralization is real/ }));
    const row = screen.getByTestId('task-R3.2');
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Copy' }));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('deliberately throwaway, non-spatial, non-DSA toy domain'));
    expect(within(row).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('records a session that then appears as the last session', () => {
    render(<TasksPage />);
    go('#/tasks/manas');
    const form = screen.getByText('Record this session').closest('form')!;
    const [workedOn, completed, remaining] = within(form).getAllByRole('textbox');
    fireEvent.change(workedOn, { target: { value: 'Ran the Phase 1 prerequisite' } });
    fireEvent.change(completed, { target: { value: 'Baseline summary' } });
    fireEvent.change(remaining, { target: { value: 'Start 1.1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save session' }));

    expect(stored().sessions).toHaveLength(1);
    expect(screen.getByText(/Completed:/).parentElement).toHaveTextContent('Baseline summary');
    expect(screen.getByText(/Left open:/).parentElement).toHaveTextContent('Start 1.1');
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

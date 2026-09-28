import { describe, expect, it } from 'vitest';
import {
  SEEDS,
  activeTask,
  addDays,
  byOwner,
  currentPhase,
  daysBetween,
  emptyState,
  health,
  indexTasks,
  isOverdue,
  memberSummary,
  mergeTasks,
  nextDeadline,
  nextTask,
  progress,
  reducer,
} from '../../src/pages/tasks/model';
import { ROADMAP } from '../../src/pages/tasks/roadmapData';

const NOW = '2026-09-27T10:00:00.000Z';

describe('task seed', () => {
  it('contains every roadmap prerequisite and sub-phase with its prompt', () => {
    const roadmap = SEEDS.filter((s) => s.owner === 'manas');
    const expected = ROADMAP.reduce((n, p) => n + 1 + p.steps.length, 0);
    expect(roadmap).toHaveLength(expected);
    expect(roadmap.every((t) => t.prompt && t.prompt.length > 100 && t.model)).toBe(true);
    expect(new Set(roadmap.map((t) => t.phase))).toEqual(new Set(ROADMAP.map((p) => p.number)));
  });

  it('starts honestly: nothing is completed or in progress', () => {
    expect(SEEDS.some((s) => s.status === 'completed' || s.status === 'in_progress')).toBe(false);
    const unverified = SEEDS.filter((s) => s.status === 'unverified').map((s) => s.id);
    expect(unverified).toEqual(['R2.5']);
  });

  it('gives each team member 5-14 tasks with complete fields', () => {
    for (const owner of ['yash', 'tirrth', 'pranav'] as const) {
      const tasks = SEEDS.filter((s) => s.owner === owner);
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      expect(tasks.length).toBeLessThanOrEqual(14);
      for (const t of tasks) {
        for (const f of ['title', 'objective', 'scope', 'expectedOutcome', 'definitionOfDone', 'verification'] as const) {
          expect(t[f].length, `${t.id}.${f}`).toBeGreaterThan(10);
        }
        expect(t.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(new Set(tasks.map((t) => t.deadline)).size).toBeGreaterThan(1);
    }
  });

  it('never schedules a task before any of its dependencies', () => {
    const idx = new Map(SEEDS.map((s) => [s.id, s]));
    for (const t of SEEDS) {
      for (const d of t.dependencies) {
        const dep = idx.get(d);
        expect(dep, `${t.id} -> ${d}`).toBeDefined();
        if (t.deadline && dep!.deadline) expect(dep!.deadline <= t.deadline, `${t.id} due before ${d}`).toBe(true);
      }
    }
  });

  it('has unique ids and all team deadlines on or after 2026-09-27', () => {
    expect(new Set(SEEDS.map((s) => s.id)).size).toBe(SEEDS.length);
    for (const t of SEEDS) if (t.deadline) expect(t.deadline >= '2026-09-27').toBe(true);
  });
});

describe('dates', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-09-27', '2026-09-30')).toBe(3);
    expect(daysBetween('2026-10-01', '2026-09-30')).toBe(-1);
    expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
  });
});

describe('selectors', () => {
  const base = mergeTasks(SEEDS, emptyState());

  it('reports 0% for the honest seed and recomputes after completions', () => {
    expect(progress(byOwner(base, 'manas')).pct).toBe(0);
    let state = emptyState();
    state = reducer(state, { type: 'setStatus', id: 'Y1', status: 'completed', now: NOW });
    state = reducer(state, { type: 'setStatus', id: 'Y2', status: 'completed', now: NOW });
    const yash = byOwner(mergeTasks(SEEDS, state), 'yash');
    expect(progress(yash)).toEqual({ done: 2, total: 12, pct: 17 });
  });

  it('flags overdue only for unfinished tasks past their deadline', () => {
    const y1 = base.find((t) => t.id === 'Y1')!;
    expect(isOverdue(y1, '2026-09-30')).toBe(false);
    expect(isOverdue(y1, '2026-10-01')).toBe(true);
    expect(isOverdue({ ...y1, status: 'completed' }, '2026-12-01')).toBe(false);
  });

  it('picks the next task by sequence and dependencies', () => {
    const idx = indexTasks(base);
    expect(nextTask(byOwner(base, 'manas'), idx)?.id).toBe('R1.0');
    expect(nextTask(byOwner(base, 'yash'), idx)?.id).toBe('Y1');
    const state = reducer(emptyState(), { type: 'setStatus', id: 'Y1', status: 'completed', now: NOW });
    const merged = mergeTasks(SEEDS, state);
    expect(nextTask(byOwner(merged, 'yash'), indexTasks(merged))?.id).toBe('Y2');
  });

  it('derives current phase, active task and next deadline', () => {
    expect(currentPhase(byOwner(base, 'manas'))).toBe(1);
    const state = reducer(emptyState(), { type: 'setStatus', id: 'T2', status: 'in_progress', now: NOW });
    const merged = mergeTasks(SEEDS, state);
    expect(activeTask(byOwner(merged, 'tirrth'))?.id).toBe('T2');
    expect(nextDeadline(byOwner(base, 'pranav'), '2026-09-27')?.id).toBe('P1');
  });

  it('member health reflects blocked and overdue work', () => {
    expect(health(byOwner(base, 'yash'), '2026-09-27')).toBe('not_started');
    expect(health(byOwner(base, 'yash'), '2026-10-05')).toBe('at_risk');
    const state = reducer(emptyState(), { type: 'setBlocker', id: 'Y1', blocker: 'No API key', now: NOW });
    const s = memberSummary(mergeTasks(SEEDS, state), 'yash', '2026-09-27');
    expect(s.health).toBe('blocked');
    expect(s.blocked.map((t) => t.id)).toEqual(['Y1']);
  });
});

describe('reducer', () => {
  it('records completion time and clears it when reopened', () => {
    let s = reducer(emptyState(), { type: 'setStatus', id: 'R1.1', status: 'completed', now: NOW });
    expect(s.overrides['R1.1'].completedAt).toBe(NOW);
    s = reducer(s, { type: 'setStatus', id: 'R1.1', status: 'planned', now: NOW });
    expect(s.overrides['R1.1'].completedAt).toBeNull();
  });

  it('recording a blocker blocks the task; leaving blocked clears it', () => {
    let s = reducer(emptyState(), { type: 'setBlocker', id: 'T1', blocker: 'Waiting on screenshots', now: NOW });
    expect(s.overrides.T1).toMatchObject({ status: 'blocked', blocker: 'Waiting on screenshots' });
    s = reducer(s, { type: 'setStatus', id: 'T1', status: 'in_progress', now: NOW });
    expect(s.overrides.T1).toMatchObject({ status: 'in_progress', blocker: '' });
  });

  it('adds sessions newest first and deletes them', () => {
    const mk = (id: string) => ({ id, date: NOW, owner: 'manas' as const, workedOn: 'x', completed: '', remaining: '', blockers: '', note: '', taskIds: [] });
    let s = reducer(emptyState(), { type: 'addSession', session: mk('a') });
    s = reducer(s, { type: 'addSession', session: mk('b') });
    expect(s.sessions.map((x) => x.id)).toEqual(['b', 'a']);
    s = reducer(s, { type: 'deleteSession', id: 'b' });
    expect(s.sessions.map((x) => x.id)).toEqual(['a']);
  });
});

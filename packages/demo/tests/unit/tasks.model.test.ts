import { describe, expect, it } from 'vitest';
import {
  SEEDS,
  activeTask,
  addDays,
  byOwner,
  currentPhase,
  daysBetween,
  health,
  indexTasks,
  isOverdue,
  memberSummary,
  mergeTasks,
  nextDeadline,
  nextTask,
  progress,
} from '../../src/pages/tasks/model';
import { done, entry, factsOf } from './tasksFixture';
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

  it('gives each team member 5-14 undated tasks with complete fields', () => {
    for (const owner of ['yash', 'tirrth', 'pranav'] as const) {
      const tasks = SEEDS.filter((s) => s.owner === owner);
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      expect(tasks.length).toBeLessThanOrEqual(14);
      for (const t of tasks) {
        for (const f of ['title', 'objective', 'scope', 'expectedOutcome', 'definitionOfDone', 'verification'] as const) {
          expect(t[f].length, `${t.id}.${f}`).toBeGreaterThan(10);
        }
        expect(t.deadline).toBeNull();
      }
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

  it('has unique ids and no roadmap deadline before 2026-09-27', () => {
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
  const base = mergeTasks(SEEDS, factsOf([]));

  it('reports 0% for the honest seed and recomputes after completions', () => {
    expect(progress(byOwner(base, 'manas')).pct).toBe(0);
    const state = factsOf([...done('Y1', NOW), ...done('Y2', NOW)]);
    const yash = byOwner(mergeTasks(SEEDS, state), 'yash');
    expect(progress(yash)).toEqual({ done: 2, total: 12, pct: 17 });
  });

  it('flags overdue only for unfinished tasks past their deadline', () => {
    const y1 = { ...base.find((t) => t.id === 'Y1')!, deadline: '2026-09-30' };
    expect(isOverdue(y1, '2026-09-30')).toBe(false);
    expect(isOverdue(y1, '2026-10-01')).toBe(true);
    expect(isOverdue({ ...y1, status: 'completed' }, '2026-12-01')).toBe(false);
  });

  it('picks the next task by sequence and dependencies', () => {
    const idx = indexTasks(base);
    expect(nextTask(byOwner(base, 'manas'), idx)?.id).toBe('R1.0');
    expect(nextTask(byOwner(base, 'yash'), idx)?.id).toBe('Y1');
    const state = factsOf(done('Y1', NOW));
    const merged = mergeTasks(SEEDS, state);
    expect(nextTask(byOwner(merged, 'yash'), indexTasks(merged))?.id).toBe('Y2');
  });

  it('derives current phase, active task and next deadline', () => {
    expect(currentPhase(byOwner(base, 'manas'))).toBe(1);
    const state = factsOf([entry('T2', 'start', NOW)]);
    const merged = mergeTasks(SEEDS, state);
    expect(activeTask(byOwner(merged, 'tirrth'))?.id).toBe('T2');
    expect(nextDeadline(byOwner(base, 'manas'), '2026-09-27')?.id).toBe('R1.0');
    expect(nextDeadline(byOwner(base, 'pranav'), '2026-09-27')).toBeNull();
  });

  it('member health reflects blocked and overdue work', () => {
    expect(health(byOwner(base, 'yash'), '2026-09-27')).toBe('not_started');
    expect(health(byOwner(base, 'yash'), '2026-10-05')).toBe('not_started');
    expect(health(byOwner(base, 'manas'), '2026-10-05')).toBe('at_risk');
    const state = factsOf([entry('Y1', 'start', NOW), entry('Y1', 'block', NOW, { note: 'No API key' })]);
    const s = memberSummary(mergeTasks(SEEDS, state), 'yash', '2026-09-27');
    expect(s.health).toBe('blocked');
    expect(s.blocked.map((t) => t.id)).toEqual(['Y1']);
  });
});

describe('ledger replay', () => {
  it('records completion time, elapsed minutes and the person who finished it', () => {
    const t = mergeTasks(SEEDS, factsOf(done('R1.0', NOW, 42))).find((x) => x.id === 'R1.0')!;
    expect(t).toMatchObject({ status: 'completed', completedAt: NOW, elapsedMin: 42, doneBy: 'tester@example.com' });
  });

  it('a blocker blocks the task and unblocking resumes it', () => {
    const blocked = factsOf([entry('T1', 'start', NOW), entry('T1', 'block', NOW, { note: 'Waiting on screenshots' })]);
    expect(mergeTasks(SEEDS, blocked).find((t) => t.id === 'T1')).toMatchObject({ status: 'blocked', blocker: 'Waiting on screenshots' });
    const resumed = factsOf([entry('T1', 'start', NOW), entry('T1', 'block', NOW, { note: 'x' }), entry('T1', 'unblock', NOW)]);
    expect(mergeTasks(SEEDS, resumed).find((t) => t.id === 'T1')).toMatchObject({ status: 'in_progress', blocker: '' });
  });

  it('refused attempts are counted against the task but never change its status', () => {
    const f = factsOf([entry('Y1', 'flag', NOW, { note: 'No commits' })]);
    expect(mergeTasks(SEEDS, f).find((t) => t.id === 'Y1')).toMatchObject({ status: 'planned', flags: 1, lastFlag: 'No commits' });
  });
});

describe('tracked prompts', () => {
  it('every roadmap and team task gets a copy prompt that starts and finishes through the CLI', () => {
    const tasks = mergeTasks(SEEDS, factsOf([]));
    expect(tasks.every((t) => t.copyPrompt)).toBe(true);
    const r = tasks.find((t) => t.id === 'R1.1')!;
    expect(r.copyPrompt!.startsWith('Housekeeping before you begin: run `pnpm task start R1.1`')).toBe(true);
    expect(r.copyPrompt).toContain('`pnpm task done R1.1`');
    expect(r.prompt).not.toContain('pnpm task');
  });
});

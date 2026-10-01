import { describe, expect, it } from 'vitest';
import { SEEDS, mergeTasks } from '../../src/pages/tasks/model';
import { done, factsOf } from './tasksFixture';
import {
  burnUp,
  scheduleAdherence,
  sessionStreak,
  statusCounts,
  upcomingLoad,
  velocity,
  weekStart,
  weeklyThroughput,
} from '../../src/pages/tasks/metrics';
import type { Session } from '../../src/pages/tasks/types';

const at = (day: string) => `${day}T10:00:00`;

function withCompletions(ids: [string, string][]) {
  return mergeTasks(SEEDS, factsOf(ids.flatMap(([id, day]) => done(id, new Date(at(day)).toISOString()))));
}

/** Team tasks are undated in the product; the metric functions are generic, so give a few dates for them here. */
const DATES: Record<string, string> = { Y1: '2026-09-30', Y2: '2026-10-02', T1: '2026-09-30', T2: '2026-10-03' };
const dated = <T extends { id: string; deadline: string | null }>(tasks: T[]): T[] => tasks.map((t) => ({ ...t, deadline: DATES[t.id] ?? '2026-11-01' }));

describe('metrics', () => {
  it('weekStart returns the Monday of the week', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // Sunday
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
  });

  it('status counts cover every task', () => {
    const tasks = mergeTasks(SEEDS, factsOf([]));
    const c = statusCounts(tasks);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(tasks.length);
    expect(c.completed).toBe(0);
    expect(c.unverified).toBe(1);
  });

  it('burn-up: planned follows deadlines, actual follows completion dates', () => {
    const tasks = withCompletions([['Y1', '2026-09-29'], ['Y2', '2026-10-01']]).filter((t) => t.owner === 'yash');
    const b = burnUp(dated(tasks), '2026-10-02', '2026-09-27')!;
    expect(b.total).toBe(12);
    expect(b.planned.at(-1)!.value).toBe(12);
    const p = (d: string) => b.planned.find((x) => x.date === d)?.value;
    const a = (d: string) => b.actual.find((x) => x.date === d)?.value;
    expect(p('2026-09-30')).toBe(1);
    expect(p('2026-10-02')).toBe(2);
    expect(a('2026-09-28')).toBe(0);
    expect(a('2026-09-29')).toBe(1);
    expect(a('2026-10-02')).toBe(2);
    expect(b.actual.every((x) => x.date <= '2026-10-02')).toBe(true);
  });

  it('schedule adherence only counts work already due', () => {
    const none = scheduleAdherence(dated(mergeTasks(SEEDS, factsOf([])).filter((t) => t.owner === 'yash')), '2026-09-27');
    expect(none).toEqual({ due: 0, done: 0, pct: null });
    const tasks = withCompletions([['Y1', '2026-09-29']]).filter((t) => t.owner === 'yash');
    expect(scheduleAdherence(dated(tasks), '2026-10-02')).toEqual({ due: 2, done: 1, pct: 50 });
  });

  it('weekly throughput buckets completions by week', () => {
    const tasks = withCompletions([['P1', '2026-09-29'], ['P2', '2026-10-01'], ['P3', '2026-10-06']]);
    const w = weeklyThroughput(tasks, '2026-10-07', 3);
    expect(w.map((x) => x.week)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
    expect(w.map((x) => x.value)).toEqual([0, 2, 1]);
  });

  it('upcoming load separates overdue from future weeks', () => {
    const tasks = mergeTasks(SEEDS, factsOf([])).filter((t) => t.owner === 'tirrth');
    const l = upcomingLoad(dated(tasks), '2026-10-01', 2);
    expect(l.overdue).toBe(1); // T1 due 30 Sep
    expect(l.buckets[0].value).toBe(1); // T2 due 3 Oct, week of 28 Sep
  });

  it('velocity projects a finish date only with real completions', () => {
    const empty = velocity(mergeTasks(SEEDS, factsOf([])), '2026-10-10');
    expect(empty.projected).toBeNull();
    const tasks = withCompletions([['Y1', '2026-10-01'], ['Y2', '2026-10-05'], ['T1', '2026-10-08'], ['P1', '2026-10-09']]);
    const v = velocity(tasks, '2026-10-10');
    expect(v.last28).toBe(4);
    expect(v.perWeek).toBe(1);
    expect(v.projected).not.toBeNull();
  });

  it('session streak counts consecutive logged days', () => {
    const mk = (day: string): Session => ({ id: day, date: new Date(at(day)).toISOString(), owner: 'manas', workedOn: 'x', completed: '', remaining: '', blockers: '', note: '', taskIds: [] });
    const s = [mk('2026-10-03'), mk('2026-10-04'), mk('2026-10-05'), mk('2026-10-01')];
    expect(sessionStreak(s, '2026-10-05')).toBe(3);
    expect(sessionStreak(s, '2026-10-06')).toBe(3);
    expect(sessionStreak(s, '2026-10-08')).toBe(0);
  });
});

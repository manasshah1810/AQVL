import { addDays, daysBetween, isOverdue, toDateKey } from './model';
import type { Session, Status, Task } from './types';
import { STATUSES, STATUS_LABEL } from './types';

/** Local calendar day of an ISO timestamp. */
export function dayOf(iso: string): string {
  return toDateKey(new Date(iso));
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(key, -dow);
}

export function statusCounts(tasks: Task[]): Record<Status, number> {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const t of tasks) c[t.status]++;
  return c;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/**
 * Burn-up: planned = cumulative tasks whose deadline has arrived by each date;
 * actual = cumulative tasks completed by each date (from completedAt), up to today.
 * Only dated tasks are included, since undated work has no plan to compare against.
 */
export function burnUp(tasks: Task[], today: string, startOverride?: string) {
  const dated = tasks.filter((t) => t.deadline);
  if (!dated.length) return null;
  const deadlines = dated.map((t) => t.deadline!).sort();
  const completions = dated.filter((t) => t.status === 'completed' && t.completedAt).map((t) => dayOf(t.completedAt!)).sort();
  const start = startOverride ?? [deadlines[0], completions[0] ?? deadlines[0], today].sort()[0];
  const end = [deadlines.at(-1)!, today].sort().at(-1)!;
  const span = Math.max(1, daysBetween(start, end));
  const step = span > 120 ? 7 : span > 45 ? 3 : 1;

  const dates: string[] = [];
  for (let d = 0; d <= span; d += step) dates.push(addDays(start, d));
  if (dates.at(-1) !== end) dates.push(end);
  if (daysBetween(start, today) >= 0 && daysBetween(today, end) >= 0 && !dates.includes(today)) {
    dates.push(today);
    dates.sort();
  }

  const planned = dates.map((date) => ({ date, value: deadlines.filter((k) => k <= date).length }));
  const actual = dates.filter((d) => d <= today).map((date) => ({ date, value: completions.filter((k) => k <= date).length }));
  return { start, end, total: dated.length, planned, actual };
}

/** Of the tasks due on or before today, the share actually completed. */
export function scheduleAdherence(tasks: Task[], today: string) {
  const due = tasks.filter((t) => t.deadline && daysBetween(today, t.deadline) <= 0);
  const done = due.filter((t) => t.status === 'completed').length;
  return { due: due.length, done, pct: due.length ? Math.round((done / due.length) * 100) : null };
}

export function completedBetween(tasks: Task[], fromKey: string, toKey: string): number {
  return tasks.filter((t) => t.status === 'completed' && t.completedAt && dayOf(t.completedAt) >= fromKey && dayOf(t.completedAt) <= toKey).length;
}

/** Completions per week over the last `weeks` weeks (oldest first). */
export function weeklyThroughput(tasks: Task[], today: string, weeks = 8) {
  const thisWeek = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(thisWeek, -7 * (weeks - 1 - i));
    const to = addDays(from, 6);
    return { week: from, value: completedBetween(tasks, from, to) };
  });
}

/** Open tasks due per week over the next `weeks` weeks, plus everything already overdue. */
export function upcomingLoad(tasks: Task[], today: string, weeks = 8) {
  const open = tasks.filter((t) => t.status !== 'completed' && t.deadline);
  const thisWeek = weekStart(today);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(thisWeek, 7 * i);
    const to = addDays(from, 6);
    return { week: from, value: open.filter((t) => t.deadline! >= from && t.deadline! <= to && !isOverdue(t, today)).length };
  });
  return { overdue: open.filter((t) => isOverdue(t, today)).length, buckets };
}

/** Average completions per week over the last 28 days, and the finish date that pace implies. */
export function velocity(tasks: Task[], today: string) {
  const last7 = completedBetween(tasks, addDays(today, -6), today);
  const last28 = completedBetween(tasks, addDays(today, -27), today);
  const perWeek = last28 / 4;
  const remaining = tasks.filter((t) => t.status !== 'completed').length;
  const projected = perWeek > 0 && remaining > 0 ? addDays(today, Math.ceil((remaining / perWeek) * 7)) : null;
  return { last7, last28, perWeek, remaining, projected };
}

/** Activity per day = sessions recorded + tasks completed that day. */
export function activityByDay(tasks: Task[], sessions: Session[]) {
  const map = new Map<string, { sessions: number; completed: number }>();
  const bump = (k: string, f: 'sessions' | 'completed') => {
    const e = map.get(k) ?? { sessions: 0, completed: 0 };
    e[f]++;
    map.set(k, e);
  };
  sessions.forEach((s) => bump(dayOf(s.date), 'sessions'));
  tasks.forEach((t) => t.status === 'completed' && t.completedAt && bump(dayOf(t.completedAt), 'completed'));
  return map;
}

/** Consecutive days with a recorded session, ending today (or yesterday if today has none yet). */
export function sessionStreak(sessions: Session[], today: string): number {
  const days = new Set(sessions.map((s) => dayOf(s.date)));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export const DOMAINS: { id: string; label: string; phases: number[] }[] = [
  { id: 'core', label: 'DSA & core', phases: [1, 2, 3] },
  { id: 'coach', label: 'Error coaching', phases: [3.5] },
  { id: 'aiml', label: 'AI/ML', phases: [4, 6] },
  { id: 'chain', label: 'Blockchain', phases: [5, 7] },
  { id: 'stress', label: 'System stress', phases: [8] },
  { id: 'lang', label: 'Languages', phases: [9, 10, 11, 12] },
];

export function domainOf(phase: number): string {
  return DOMAINS.find((d) => d.phases.includes(phase))?.id ?? 'core';
}

export interface Segment {
  label: string;
  value: number;
  cls: string;
}

export function statusSegments(counts: Record<Status, number>): Segment[] {
  return (['completed', 'in_progress', 'unverified', 'blocked', 'planned'] as Status[]).map((s) => ({
    label: STATUS_LABEL[s],
    value: counts[s],
    cls: `st-${s}`,
  }));
}

import { useSyncExternalStore } from 'react';
import type { Difficulty } from './types';

/**
 * Challenge progress, kept in this browser only (there are no accounts):
 * the best stars, points and fewest steps per challenge, how many runs it
 * took, the hints opened on it, and which challenge was played last.
 */
export interface ChallengeProgress {
  stars: number;
  /** Best points earned on it (see `pointsFor`). */
  points: number;
  /** Fewest steps over the visible tests in a passing run. */
  bestSteps?: number;
  attempts: number;
  /** Hint levels opened since the last pass (each one costs a star, and it is kept across visits). */
  hints: number;
  /** When it was last run (ms since epoch). */
  lastPlayed?: number;
}

/** Points per star, by the challenge's difficulty. */
export const POINTS_PER_STAR: Record<Difficulty, number> = { Easy: 10, Medium: 20, Hard: 30 };

/** Points for a result: every star is worth more on a harder challenge. */
export function pointsFor(difficulty: Difficulty, stars: number): number {
  return POINTS_PER_STAR[difficulty] * Math.max(0, Math.min(3, stars));
}

/** Titles earned by total points. */
export const RANKS: { title: string; at: number }[] = [
  { title: 'Newcomer', at: 0 },
  { title: 'Apprentice', at: 100 },
  { title: 'Tracer', at: 400 },
  { title: 'Builder', at: 1000 },
  { title: 'Engineer', at: 2500 },
  { title: 'Architect', at: 5000 },
  { title: 'Grandmaster', at: 9000 },
];

export function rankOf(points: number): { title: string; at: number; next: { title: string; at: number } | null } {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].at) i++;
  return { ...RANKS[i], next: RANKS[i + 1] ?? null };
}

interface Store {
  challenges: Record<string, ChallengeProgress>;
  /** The challenge opened most recently. */
  last?: string;
}

const KEY = 'aqvl-challenges';
const LAST_KEY = 'aqvl-challenges-last';
const listeners = new Set<() => void>();
let cache: Store | null = null;

const num = (v: unknown, max = Infinity) => Math.max(0, Math.min(max, Number(v) || 0));

function read(): Store {
  const out: Store = { challenges: {} };
  try {
    if (typeof localStorage === 'undefined') return out;
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [id, p] of Object.entries(parsed as Record<string, Partial<ChallengeProgress>>)) {
        if (!p || typeof p !== 'object') continue;
        out.challenges[id] = {
          stars: num(p.stars, 3),
          points: num(p.points),
          attempts: num(p.attempts),
          hints: num(p.hints, 3),
          ...(typeof p.bestSteps === 'number' ? { bestSteps: p.bestSteps } : {}),
          ...(typeof p.lastPlayed === 'number' ? { lastPlayed: p.lastPlayed } : {}),
        };
      }
    }
    const last = localStorage.getItem(LAST_KEY);
    if (last) out.last = last;
  } catch {
    /* unreadable: start fresh */
  }
  return out;
}

function store(): Store {
  if (!cache) cache = read();
  return cache;
}

export function getProgress(): Record<string, ChallengeProgress> {
  return store().challenges;
}

function write(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.challenges));
    if (next.last) localStorage.setItem(LAST_KEY, next.last);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

const blank = (): ChallengeProgress => ({ stars: 0, points: 0, attempts: 0, hints: 0 });

/**
 * Records one graded run: the attempt always counts; stars, points and steps
 * only improve. A pass clears the hints opened, so a later replay starts clean.
 */
export function recordAttempt(id: string, result: { passed: boolean; stars: number; steps: number; points?: number }) {
  const s = store();
  const prev = s.challenges[id] ?? blank();
  const next: ChallengeProgress = {
    ...prev,
    attempts: prev.attempts + 1,
    stars: Math.max(prev.stars, result.stars),
    points: Math.max(prev.points, result.points ?? 0),
    lastPlayed: Date.now(),
  };
  if (result.passed) {
    next.bestSteps = prev.bestSteps === undefined ? result.steps : Math.min(prev.bestSteps, result.steps);
    next.hints = 0;
  }
  write({ ...s, challenges: { ...s.challenges, [id]: next } });
}

/** Keeps the hint level opened on a challenge, so leaving and coming back does not refund it. */
export function recordHints(id: string, hints: number) {
  const s = store();
  const prev = s.challenges[id] ?? blank();
  if (prev.hints >= hints) return;
  write({ ...s, challenges: { ...s.challenges, [id]: { ...prev, hints: Math.min(3, hints) } } });
}

/** Remembers the challenge being played (the hub offers to continue it). */
export function markOpened(id: string) {
  const s = store();
  if (s.last === id) return;
  write({ ...s, last: id });
}

export function getLastOpened(): string | undefined {
  return store().last;
}

export function resetProgress() {
  write({ challenges: {} });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: Record<string, ChallengeProgress> = {};
const EMPTY_STORE: Store = { challenges: EMPTY };

export function useProgress(): Record<string, ChallengeProgress> {
  return useSyncExternalStore(subscribe, getProgress, () => EMPTY);
}

/** The whole store (progress and the last challenge opened). */
export function useProgressStore(): Store {
  return useSyncExternalStore(subscribe, store, () => EMPTY_STORE);
}

/** For tests: forget the in-memory copy so the next read comes from storage. */
export function _reloadProgress() {
  cache = null;
}

import { useSyncExternalStore } from 'react';

/**
 * Challenge progress, kept in this browser only (there are no accounts):
 * the best stars and fewest steps per challenge, and how many runs it took.
 */
export interface ChallengeProgress {
  stars: number;
  /** Fewest steps over the visible tests in a passing run. */
  bestSteps?: number;
  attempts: number;
}

const KEY = 'aqvl-challenges';
const listeners = new Set<() => void>();
let cache: Record<string, ChallengeProgress> | null = null;

function read(): Record<string, ChallengeProgress> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, ChallengeProgress> = {};
    for (const [id, p] of Object.entries(parsed as Record<string, Partial<ChallengeProgress>>)) {
      if (!p || typeof p !== 'object') continue;
      out[id] = {
        stars: Math.max(0, Math.min(3, Number(p.stars) || 0)),
        attempts: Math.max(0, Number(p.attempts) || 0),
        ...(typeof p.bestSteps === 'number' ? { bestSteps: p.bestSteps } : {}),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function getProgress(): Record<string, ChallengeProgress> {
  if (!cache) cache = read();
  return cache;
}

function write(next: Record<string, ChallengeProgress>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

/** Records one graded run: the attempt always counts; stars and steps only improve. */
export function recordAttempt(id: string, result: { passed: boolean; stars: number; steps: number }) {
  const all = getProgress();
  const prev = all[id] ?? { stars: 0, attempts: 0 };
  const next: ChallengeProgress = { ...prev, attempts: prev.attempts + 1, stars: Math.max(prev.stars, result.stars) };
  if (result.passed) next.bestSteps = prev.bestSteps === undefined ? result.steps : Math.min(prev.bestSteps, result.steps);
  write({ ...all, [id]: next });
}

export function resetProgress() {
  write({});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: Record<string, ChallengeProgress> = {};

export function useProgress(): Record<string, ChallengeProgress> {
  return useSyncExternalStore(subscribe, getProgress, () => EMPTY);
}

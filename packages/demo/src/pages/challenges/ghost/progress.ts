import { useSyncExternalStore } from 'react';

/** Ghost Move progress, kept in this browser only: the best stars and accuracy per puzzle, and how many sets were played. */
export interface GhostProgress {
  stars: number;
  /** Best accuracy, 0..1. */
  bestScore?: number;
  attempts: number;
}

const KEY = 'aqvl-ghost-move';
const listeners = new Set<() => void>();
let cache: Record<string, GhostProgress> | null = null;

function read(): Record<string, GhostProgress> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, GhostProgress> = {};
    for (const [id, p] of Object.entries(parsed as Record<string, Partial<GhostProgress>>)) {
      if (!p || typeof p !== 'object') continue;
      out[id] = {
        stars: Math.max(0, Math.min(3, Number(p.stars) || 0)),
        attempts: Math.max(0, Number(p.attempts) || 0),
        ...(typeof p.bestScore === 'number' ? { bestScore: Math.max(0, Math.min(1, p.bestScore)) } : {}),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function getGhostProgress(): Record<string, GhostProgress> {
  if (!cache) cache = read();
  return cache;
}

function write(next: Record<string, GhostProgress>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

/** Records one finished set: it always counts as an attempt; stars and accuracy only improve. */
export function recordGhost(id: string, result: { stars: number; score: number }) {
  const all = getGhostProgress();
  const prev = all[id] ?? { stars: 0, attempts: 0 };
  write({ ...all, [id]: { attempts: prev.attempts + 1, stars: Math.max(prev.stars, result.stars), bestScore: Math.max(prev.bestScore ?? 0, result.score) } });
}

export function resetGhostProgress() {
  write({});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: Record<string, GhostProgress> = {};

export function useGhostProgress(): Record<string, GhostProgress> {
  return useSyncExternalStore(subscribe, getGhostProgress, () => EMPTY);
}

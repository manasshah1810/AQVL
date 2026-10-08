import type { ExecutionTrace, TraceEventKind, TraceFrame } from '@aqvl/runtime';

/**
 * How long each kind of step plays at 1x, in seconds. Significant events
 * (a swap, a layout change) get time to be followed; routine ones (a visit,
 * a print) pass quickly, so a long run keeps its rhythm.
 */
export const BEAT_SECONDS: Record<TraceEventKind, number> = {
  init: 0,
  compare: 0.95,
  swap: 1.45,
  write: 1.05,
  move: 1.1,
  create: 1.0,
  remove: 0.95,
  link: 1.1,
  traverse: 1.0,
  visit: 0.72,
  settle: 0.9,
  discard: 0.78,
  mark: 0.75,
  call: 0.82,
  return: 0.72,
  print: 0.55,
  assign: 0.55,
  layout: 1.6,
  camera: 1.5,
  hold: 1.0,
  // The run stops here: long enough to take in the picture before the explanation starts.
  error: 1.4,
  none: 0.45,
};

/** Stagger between successive actors of one step (seconds at 1x). */
export const STAGGER_SECONDS = 0.04;

/** Seconds step `frame` takes to play (frame 0 is the starting picture and takes none). */
export function beatSeconds(frame: TraceFrame): number {
  if (frame.index === 0) return 0;
  const base = BEAT_SECONDS[frame.event.kind] ?? 0.6;
  const cascade = Math.min(0.7, STAGGER_SECONDS * Math.max(0, frame.event.actors.length - 1));
  return base + cascade;
}

/**
 * The trace laid out on a time axis: step k plays over
 * [starts[k], starts[k] + durations[k]], and the scene is exactly frame k
 * at rest at its end.
 */
export interface BeatTable {
  durations: Float64Array;
  /** ends[k] = time at which frame k is at rest; ends[0] = 0. */
  ends: Float64Array;
  total: number;
}

export function buildBeatTable(trace: ExecutionTrace): BeatTable {
  const n = trace.frames.length;
  const durations = new Float64Array(n);
  const ends = new Float64Array(n);
  let t = 0;
  for (let k = 0; k < n; k++) {
    durations[k] = beatSeconds(trace.frames[k]);
    t += durations[k];
    ends[k] = t;
  }
  return { durations, ends, total: t };
}

export interface BeatPosition {
  /** The step playing (or just finished): the scene goes from frame k-1 to frame k. */
  k: number;
  /** Seconds since step k started. */
  tau: number;
  /** Step k's length. */
  duration: number;
  /** 0..1 through step k. */
  u: number;
}

/** Where time `t` falls: which step is playing and how far into it. */
export function locate(table: BeatTable, t: number): BeatPosition {
  const { ends, durations } = table;
  const n = ends.length;
  if (n <= 1 || t <= 0) return { k: 0, tau: 0, duration: 0, u: 1 };
  if (t >= table.total) return { k: n - 1, tau: durations[n - 1], duration: durations[n - 1], u: 1 };
  // First k >= 1 with ends[k] >= t.
  let lo = 1;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid] >= t) hi = mid;
    else lo = mid + 1;
  }
  const k = lo;
  const duration = durations[k];
  const tau = duration - (ends[k] - t);
  return { k, tau, duration, u: duration > 0 ? tau / duration : 1 };
}

/** The last step completely shown at time `t` (the step counter). */
export function completedStep(table: BeatTable, t: number): number {
  const p = locate(table, t);
  return p.u >= 1 - 1e-9 ? p.k : p.k - 1;
}

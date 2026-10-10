/**
 * The grove's day: the sun climbs out of the bamboo on the right, arcs over
 * the back of the clearing and sets on the left; the moon follows it round
 * the other half of the circle. One whole day (daylight, dusk, night, dawn)
 * takes DAY_LENGTH seconds of ambient time, like a Minecraft day.
 *
 * Ambient time only (it stops in calm mode), and kept across scenes: the
 * clock is module state, so moving to the next example does not bring the
 * morning back.
 */

/** Seconds in one full grove day, night included (18 minutes). */
export const DAY_LENGTH = 18 * 60;

/** Where in the day the grove starts: early morning, the sun low behind the bamboo on the right (the dawn the grove was drawn in). */
const START = 0.06;

export interface DayState {
  /** 0..1 through the day (0: sunrise, 0.5: sunset). */
  phase: number;
  /** Unit directions to the sun and the moon (y up). */
  sun: [number, number, number];
  moon: [number, number, number];
  /** 1 in full daylight, 0 at night (smooth through dusk and dawn). */
  day: number;
  /** 1 in deep night. */
  night: number;
  /** Golden-hour glow: peaks while the sun is near the horizon (dusk and dawn). */
  dusk: number;
  /** Whole days since the grove opened (0 on the first morning): the noon gathering is a new one each day. */
  count: number;
}

/** Noon, as a phase of the day (the sun is highest). */
export const NOON = 0.25;
/** How long the gathering round the fire lasts, in seconds of a normal-speed day (a minute and a half). */
export const GATHER_SECONDS = 90;
/** How long before noon the musician gets up and heads for the fire. */
export const GATHER_LEAD = 14;

/** The noon gathering: `soon` while the musician is getting ready, `on` for its minute and a half. */
export function gatherAt(day: DayState): { on: boolean; soon: boolean; day: number } {
  const span = GATHER_SECONDS / DAY_LENGTH;
  const lead = GATHER_LEAD / DAY_LENGTH;
  const on = day.phase >= NOON && day.phase < NOON + span;
  return { on, soon: !on && day.phase >= NOON - lead && day.phase < NOON, day: day.count };
}

let elapsed = 0;

/** Advances the grove's day by `dt` seconds of ambient time. */
export function advanceDay(dt: number): void {
  elapsed += dt;
}

/** Seconds of grove time since the page opened. */
export function dayTime(): number {
  return elapsed + debugOffset;
}

/** `?daytime=<seconds>` starts the day that many seconds in (to look at dusk or night without waiting for it). */
const debugOffset = (() => {
  try {
    const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('daytime');
    return v === null ? 0 : Number(v) || 0;
  } catch {
    return 0;
  }
})();

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function arc(a: number, out: [number, number, number]): void {
  // Across the back of the sky: rises on the right (+x), highest behind the clearing (-z), sets on the left.
  const x = Math.cos(a) * 0.6;
  const y = Math.sin(a) * 0.62;
  const z = -0.8 - Math.max(0, Math.sin(a)) * 0.15;
  const l = Math.hypot(x, y, z);
  out[0] = x / l;
  out[1] = y / l;
  out[2] = z / l;
}

/**
 * The state of the day at `seconds` of grove time. A page can pin the time of day for a look at it
 * (`globalThis.__aqvlDayPhase = 0.75` is midnight) or hurry it along (`globalThis.__aqvlDaySpeed = 20`).
 */
export function dayAt(seconds: number, out: DayState = blankDay()): DayState {
  const g = globalThis as { __aqvlDayPhase?: unknown; __aqvlDaySpeed?: unknown };
  const speed = typeof g.__aqvlDaySpeed === 'number' ? g.__aqvlDaySpeed : 1;
  const pinned = typeof g.__aqvlDayPhase === 'number' ? g.__aqvlDayPhase : null;
  const p = pinned ?? seconds * speed / DAY_LENGTH + START;
  const phase = ((p % 1) + 1) % 1;
  const a = phase * Math.PI * 2;
  arc(a, out.sun);
  arc(a + Math.PI, out.moon);
  const elev = Math.sin(a);
  out.phase = phase;
  out.count = Math.floor(p);
  out.day = smooth(-0.12, 0.2, elev);
  out.night = 1 - smooth(-0.3, 0.02, elev);
  out.dusk = Math.max(0, 1 - Math.abs(elev + 0.02) / 0.3);
  return out;
}

export function blankDay(): DayState {
  return { phase: START, sun: [1, 0, 0], moon: [-1, 0, 0], day: 1, night: 0, dusk: 0, count: 0 };
}

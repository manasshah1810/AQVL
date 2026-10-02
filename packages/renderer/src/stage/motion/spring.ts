/**
 * Closed-form motion. Everything the stage draws is a function of time
 * since a beat started, never of the previous frame, so playback is
 * identical at any frame rate and when scrubbed in either direction.
 */

/** Base stiffness of every node spring (N/m, unit mass). */
export const STIFFNESS = 210;
/** Damping ratio: well damped, a barely visible overshoot (physical, never bouncy). */
export const DAMPING_RATIO = 0.78;

/**
 * Displacement left over `t` seconds after a unit step, for a damped spring
 * of the given mass: 1 at t = 0, oscillating towards 0. Heavier nodes ring
 * lower and settle later.
 */
export function springResidual(t: number, mass = 1, zeta = DAMPING_RATIO, stiffness = STIFFNESS): number {
  if (t <= 0) return 1;
  const w = Math.sqrt(stiffness / mass);
  if (zeta >= 1) {
    return (1 + w * t) * Math.exp(-w * t);
  }
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

/** Progress of a spring released at t = 0 towards 1 (overshoots slightly). */
export function springProgress(t: number, mass = 1, zeta = DAMPING_RATIO, stiffness = STIFFNESS): number {
  return 1 - springResidual(t, mass, zeta, stiffness);
}

/** Seconds until a spring of this mass stays within 1% of rest. */
export function settleTime(mass = 1, zeta = DAMPING_RATIO, stiffness = STIFFNESS): number {
  const w = Math.sqrt(stiffness / mass);
  return 4.6 / (zeta * w);
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * A spring that is guaranteed to be exactly at rest by `end`: the residual
 * fades out over the last 15% of the window, so a step that ends is an
 * exact snapshot no matter how heavy the node is.
 */
export function windowedSpring(t: number, end: number, mass = 1, zeta = DAMPING_RATIO): number {
  if (t >= end) return 1;
  const fade = 1 - smoothstep(end * 0.82, end, t);
  return 1 - springResidual(t, mass, zeta) * fade;
}

/** A decaying ring (landing micro-settle, shockwave wobble): sin wave inside an exponential envelope. */
export function dampedWave(t: number, frequencyHz: number, decay: number): number {
  if (t <= 0) return 0;
  return Math.sin(t * frequencyHz * Math.PI * 2) * Math.exp(-t * decay);
}

/** A node's mass from its value: bigger numbers are heavier, so they settle visibly slower. */
export function massFor(numeric: number | undefined, min: number, max: number): number {
  if (numeric === undefined || !(max > min)) return 1;
  return 0.8 + 1.4 * clamp01((numeric - min) / (max - min));
}

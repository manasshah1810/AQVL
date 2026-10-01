// Shared motion vocabulary. Everything is a pure function of time in seconds,
// so the film is identical at 30fps and 60fps.

export type SpringPreset = {k: number; c: number; m: number};

// High stiffness, medium damping: snappy with a small visible overshoot.
export const SNAP: SpringPreset = {k: 260, c: 18, m: 1};
export const SETTLE: SpringPreset = {k: 200, c: 15, m: 1};
export const HEAVY: SpringPreset = {k: 180, c: 20, m: 1.5};
export const FLOAT: SpringPreset = {k: 60, c: 9, m: 1};
export const SOFT: SpringPreset = {k: 120, c: 22, m: 1};

// Analytic damped harmonic oscillator going 0 -> 1, started at t = 0.
export const spring = (t: number, p: SpringPreset = SNAP): number => {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(p.k / p.m);
  const zeta = p.c / (2 * Math.sqrt(p.k * p.m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * t);
    return 1 - e * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  const e = Math.exp(-w0 * t);
  return 1 - e * (1 + w0 * t);
};

// Spring that starts at `start` seconds.
export const springAt = (t: number, start: number, p: SpringPreset = SNAP) =>
  spring(t - start, p);

// Animate between a sequence of values, each change triggered at a time.
// keys: [[time, value], ...] sorted by time. Each segment springs from the
// previous resting value to the next, preserving continuity.
export const springKeys = (
  t: number,
  keys: [number, number][],
  p: SpringPreset = SNAP,
): number => {
  if (keys.length === 0) return 0;
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [kt, kv] = keys[i];
    if (t < kt) break;
    const prev = keys[i - 1][1];
    v += (kv - prev) * spring(t - kt, p);
  }
  return v;
};

// Programmatic wave: delay for element i given a per-step delay.
export const stagger = (i: number, step = 0.04, base = 0) => base + i * step;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

// Camera only: smooth ease-in-out trajectory smoothing.
export const easeInOut = (x: number) => {
  const c = clamp(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = (x: number) => Math.pow(clamp(x), 3);

// Deterministic randomness.
export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
};
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// Smooth 1D value noise, for camera handheld drift and shake.
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
};
// Impact shake: decaying noise after time t0.
export const shake = (t: number, t0: number, amp: number, decay = 9, freq = 38, seed = 1) => {
  const d = t - t0;
  if (d < 0) return 0;
  return amp * Math.exp(-d * decay) * noise1(d * freq, seed);
};

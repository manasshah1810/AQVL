// Shared motion vocabulary. Everything is a pure function of time in seconds.
export type SpringCfg = {k: number; c: number; m?: number};

export const PRESETS = {
  snap: {k: 260, c: 18, m: 1},
  settle: {k: 200, c: 14, m: 1},
  heavy: {k: 150, c: 20, m: 1.5},
  float: {k: 70, c: 11, m: 1},
  pop: {k: 320, c: 15, m: 1},
} satisfies Record<string, SpringCfg>;

/** Analytic damped spring step response 0 -> 1, evaluated at time t (s) after trigger. */
export const spring = (t: number, cfg: SpringCfg = PRESETS.snap): number => {
  if (t <= 0) return 0;
  const m = cfg.m ?? 1;
  const w0 = Math.sqrt(cfg.k / m);
  const z = cfg.c / (2 * Math.sqrt(cfg.k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
};

/** spring between two values */
export const sprLerp = (t: number, from: number, to: number, cfg?: SpringCfg) =>
  from + (to - from) * spring(t, cfg);

/** Delay for the i-th element of a cascade. */
export const stag = (i: number, step = 0.04) => i * step;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (x: number) => {
  const k = clamp(x);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

/** quick pulse: rises in ~rise s, decays with time constant tau */
export const pulse = (t: number, rise = 0.05, tau = 0.35) =>
  t < 0 ? 0 : (1 - Math.exp(-t / rise)) * Math.exp(-t / tau);

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type V3 = [number, number, number];
export const v3lerp = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const v3add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const v3sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const v3len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** The only non-spring easing: camera trajectory. C1-continuous Hermite through keys, eased at the ends. */
export type CamKey = {t: number; pos: V3; look: V3; fov: number};
export const camPath = (keys: CamKey[], t: number): CamKey => {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[n - 1].t) return keys[n - 1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2.t - k1.t;
  const u = (t - k1.t) / h;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const first = i === 0, last = i + 1 === n - 1;
  const ev = (g: (k: CamKey) => number) => {
    const m1 = first ? 0 : (g(k2) - g(k0)) / (k2.t - k0.t);
    const m2 = last ? 0 : (g(k3) - g(k1)) / (k3.t - k1.t);
    return h00 * g(k1) + h10 * h * m1 + h01 * g(k2) + h11 * h * m2;
  };
  return {
    t,
    pos: [ev((k) => k.pos[0]), ev((k) => k.pos[1]), ev((k) => k.pos[2])],
    look: [ev((k) => k.look[0]), ev((k) => k.look[1]), ev((k) => k.look[2])],
    fov: ev((k) => k.fov),
  };
};

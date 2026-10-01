import { Easing, interpolate } from 'remotion';

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const C = {
  void: '#04050A',
  deep: '#0A0D16',
  line: '#AEB9CF',
  white: '#F3F1EC',
  hot: '#FF5B2E',
  hotSoft: '#FF8A5C',
  cool: '#86A8FF',
  mint: '#9FF0D0',
  paper: '#EFE6D2',
  chalk: '#ECE7DA',
  board: '#1C2823',
  pen: '#22389A',
  graphite: '#3A3631',
  warm: '#FFD6A0',
  shadow: '#1B130D',
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);

// motion vocabulary
export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-ish out: confident arrivals
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // camera moves
  in: Easing.bezier(0.7, 0, 0.84, 0), // accelerations into cuts
  snap: Easing.bezier(0.2, 0, 0, 1), // UI-less snaps
  soft: Easing.bezier(0.33, 0, 0.2, 1),
};

/** clamped interpolate, eased */
export const ip = (f: number, a: number, b: number, from: number, to: number, ease: (t: number) => number = (t) => t) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

/** damped spring on [0..1] given frames since start (deterministic, closed form) */
export const spring01 = (t: number, freq = 2.2, damp = 0.55) => {
  if (t <= 0) return 0;
  const w = freq * 2 * Math.PI;
  const s = t / FPS;
  return 1 - Math.exp(-damp * w * s) * Math.cos(w * Math.sqrt(1 - damp * damp) * s);
};

export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** smooth 1D noise in [-1,1] */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 101) * 2 - 1, b = hash(i + 1 + seed * 101) * 2 - 1;
  return lerp(a, b, smooth(f));
};

export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type Cam = (p: V3) => { x: number; y: number; z: number; s: number };
/** perspective look-at camera; s = pixels per world unit at that depth */
export const lookAt = (pos: V3, target: V3, fov = 50, cx = W / 2, cy = H / 2, roll = 0): Cam => {
  const fwd = norm(sub(target, pos));
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2: V3 = add(mul(right, c), mul(up, s));
    const u2: V3 = add(mul(up, c), mul(right, -s));
    right = r2;
    up = u2;
  }
  const f = H / 2 / Math.tan((fov * Math.PI) / 360);
  return (p) => {
    const d = sub(p, pos);
    const z = dot(d, fwd);
    const s = f / Math.max(z, 0.0001);
    return { x: cx + dot(d, right) * s, y: cy - dot(d, up) * s, z, s };
  };
};
/** orbit position helper */
export const orbit = (target: V3, dist: number, yaw: number, pitch: number): V3 => [
  target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
  target[1] + dist * Math.sin(pitch),
  target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
];

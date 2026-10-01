// Hand-drawn primitives: polylines that draw on over time with a moving tip.
import { lerp, noise1, rng } from './core';

export type Pt = [number, number];
export const wobblyCircle = (cx: number, cy: number, r: number, seed: number, over = 0.14, n = 40): Pt[] => {
  const R = rng(seed);
  const a0 = R() * Math.PI * 2 - Math.PI / 2;
  const pts: Pt[] = [];
  const squash = 0.92 + R() * 0.12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * Math.PI * 2 * (1 + over);
    const rr = r * (1 + noise1(t * 3.2, seed) * 0.06 + t * 0.05);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  return pts;
};
export const wobblyLine = (x1: number, y1: number, x2: number, y2: number, seed: number, bow = 0.04, n = 14): Pt[] => {
  const pts: Pt[] = [];
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  const b = (rng(seed)() - 0.5) * 2 * bow * L;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = Math.sin(t * Math.PI) * b + noise1(t * 4, seed) * L * 0.006;
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
  }
  return pts;
};
export const arrowHead = (from: Pt, to: Pt, size: number): Pt[] => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return [
    [to[0] - Math.cos(a - 0.45) * size, to[1] - Math.sin(a - 0.45) * size],
    to,
    [to[0] - Math.cos(a + 0.45) * size, to[1] - Math.sin(a + 0.45) * size],
  ];
};
/** shorten a segment from both ends (for edges between circles) */
export const trim = (a: Pt, b: Pt, ra: number, rb: number): [Pt, Pt] => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  return [
    [a[0] + (dx / L) * ra, a[1] + (dy / L) * ra],
    [b[0] - (dx / L) * rb, b[1] - (dy / L) * rb],
  ];
};
export const partial = (pts: Pt[], t: number): { d: string; tip: Pt | null } => {
  if (t <= 0) return { d: '', tip: null };
  const f = Math.min(1, t) * (pts.length - 1);
  const i = Math.floor(f);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let k = 1; k <= i; k++) d += `L${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)}`;
  let tip: Pt = pts[i];
  if (i < pts.length - 1) {
    const fr = f - i;
    tip = [lerp(pts[i][0], pts[i + 1][0], fr), lerp(pts[i][1], pts[i + 1][1], fr)];
    d += `L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`;
  }
  return { d, tip };
};
export type Stroke = { pts: Pt[]; a: number; b: number; w?: number };
/** render a timed list of strokes at frame f; returns path strings and current tip */
export const strokesAt = (strokes: Stroke[], f: number) => {
  let tip: Pt | null = null;
  const paths: { d: string; w?: number }[] = [];
  for (const s of strokes) {
    const t = (f - s.a) / (s.b - s.a);
    if (t <= 0) continue;
    const p = partial(s.pts, t);
    paths.push({ d: p.d, w: s.w });
    if (t < 1) tip = p.tip;
    else if (!tip) tip = s.pts[s.pts.length - 1];
  }
  return { paths, tip };
};
/** zig-zag scribble over a rect */
export const scribble = (x: number, y: number, w: number, h: number, seed: number, n = 14): Pt[] => {
  const R = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x + (i % 2 ? w : 0) + (R() - 0.5) * w * 0.15, y + t * h + (R() - 0.5) * 10]);
  }
  return pts;
};
/** a handwritten question mark as a single stroke + dot position */
export const questionMark = (cx: number, cy: number, s: number, seed: number): { pts: Pt[]; dot: Pt } => {
  const R = rng(seed);
  const pts: Pt[] = [];
  // hook: arc from left, over the top, down the right, curling to center, then stem
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = Math.PI * (1.08 - t * 1.62); // from ~194deg to ~-97deg
    const r = s * 0.36 * (1 - t * 0.12);
    pts.push([cx + Math.cos(a) * r + noise1(t * 3, seed) * s * 0.02, cy - s * 0.32 - Math.sin(a) * r]);
  }
  const last = pts[pts.length - 1];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    pts.push([lerp(last[0], cx + (R() - 0.5) * s * 0.03, t), lerp(last[1], cy + s * 0.16, t)]);
  }
  return { pts, dot: [cx + (R() - 0.5) * s * 0.03, cy + s * 0.42] };
};
export const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');

/** resample a polyline to n points evenly by arc length */
export const resample = (pts: Pt[], n: number): Pt[] => {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * L;
    while (j < d.length - 2 && d[j + 1] < t) j++;
    const f = (t - d[j]) / (d[j + 1] - d[j] || 1);
    out.push([lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)]);
  }
  return out;
};

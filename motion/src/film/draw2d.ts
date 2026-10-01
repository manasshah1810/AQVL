// Procedural analog drawing kit: paper, chalkboard, ink, chalk, marker.
// Every stroke is a polyline drawn up to a progress value, so lines draw on
// in real time and every frame is a pure function of time.
import {hash, noise1, rng} from '../lib/motion';

export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;

export const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
};

// Single-stroke handwriting glyphs on a unit box (y down).
const G: Record<string, Pt[][]> = {
  '0': [arc(0.5, 0.5, 0.33, 0.5, -80, 285, 22)],
  '1': [[[0.28, 0.22], [0.55, 0], [0.55, 1]]],
  '2': [[...arc(0.5, 0.3, 0.32, 0.3, 190, 380, 10), [0.12, 1], [0.9, 1]]],
  '3': [arc(0.48, 0.27, 0.3, 0.26, 200, 450, 10), arc(0.48, 0.74, 0.34, 0.26, 270, 525, 10)],
  '4': [[[0.68, 1], [0.68, 0], [0.06, 0.68], [0.95, 0.68]]],
  '5': [[[0.85, 0], [0.22, 0], [0.16, 0.44], ...arc(0.5, 0.68, 0.34, 0.31, 235, 520, 12)]],
  '6': [[[0.75, 0.02], [0.4, 0.25], [0.18, 0.62], ...arc(0.5, 0.69, 0.32, 0.3, 180, 540, 16)]],
  '7': [[[0.1, 0], [0.9, 0], [0.38, 1]]],
  '8': [arc(0.5, 0.26, 0.26, 0.25, 90, 450, 14), arc(0.5, 0.75, 0.33, 0.25, 270, 630, 16)],
  '9': [arc(0.5, 0.32, 0.32, 0.31, 0, 360, 16), [[0.82, 0.32], [0.7, 1]]],
  '?': [[...arc(0.5, 0.27, 0.3, 0.26, 190, 420, 10), [0.5, 0.66]], [[0.5, 0.92], [0.51, 0.98]]],
  '(': [arc(0.95, 0.5, 0.6, 0.56, 140, 220, 8)],
  ')': [arc(0.05, 0.5, 0.6, 0.56, -40, 40, 8)],
  f: [[[0.8, 0.08], [0.62, 0], [0.47, 0.1], [0.43, 1]], [[0.15, 0.42], [0.75, 0.42]]],
  i: [[[0.5, 0.38], [0.5, 1]], [[0.5, 0.1], [0.51, 0.15]]],
  b: [[[0.25, 0], [0.25, 1]], arc(0.53, 0.72, 0.28, 0.28, 180, 540, 14)],
  n: [[[0.2, 0.38], [0.2, 1]], [[0.2, 0.6], ...arc(0.5, 0.6, 0.3, 0.22, 180, 360, 8), [0.8, 1]]],
  u: [[[0.2, 0.38], [0.2, 0.75], ...arc(0.5, 0.75, 0.3, 0.25, 180, 0, 8), [0.8, 0.38]], [[0.8, 0.38], [0.8, 1]]],
  l: [[[0.5, 0], [0.5, 1]]],
  h: [[[0.2, 0], [0.2, 1]], [[0.2, 0.6], ...arc(0.5, 0.62, 0.3, 0.22, 180, 360, 8), [0.8, 1]]],
  e: [[[0.18, 0.68], [0.82, 0.68], ...arc(0.5, 0.68, 0.32, 0.31, 0, -290, 14)]],
  a: [arc(0.48, 0.69, 0.3, 0.3, -10, 350, 14), [[0.8, 0.4], [0.8, 1]]],
  d: [arc(0.45, 0.69, 0.3, 0.3, 0, 360, 14), [[0.76, 0], [0.76, 1]]],
  N: [[[0.15, 1], [0.15, 0], [0.85, 1], [0.85, 0]]],
  U: [[[0.15, 0], [0.15, 0.68], ...arc(0.5, 0.68, 0.35, 0.32, 180, 0, 10), [0.85, 0]]],
  L: [[[0.15, 0], [0.15, 1], [0.85, 1]]],
  '-': [[[0.15, 0.55], [0.85, 0.55]]],
  '>': [[[0.2, 0.25], [0.8, 0.58], [0.2, 0.9]]],
  x: [[[0.15, 0.38], [0.85, 1]], [[0.85, 0.38], [0.15, 1]]],
  '=': [[[0.15, 0.45], [0.85, 0.45]], [[0.15, 0.7], [0.85, 0.7]]],
  '[': [[[0.7, 0], [0.35, 0], [0.35, 1], [0.7, 1]]],
  ']': [[[0.3, 0], [0.65, 0], [0.65, 1], [0.3, 1]]],
  ',': [[[0.5, 0.88], [0.4, 1.1]]],
};

// Handwritten text as polylines in canvas px.
export const writeText = (s: string, x: number, y: number, size: number, seed: number, slant = 0.12): Pt[][] => {
  const r = rng(seed);
  const out: Pt[][] = [];
  let cx = x;
  for (const ch of s) {
    if (ch === ' ') {
      cx += size * 0.5;
      continue;
    }
    const g = G[ch];
    const w = size * 0.62;
    const sc = 1 + (r() - 0.5) * 0.12;
    const dy = (r() - 0.5) * size * 0.08;
    if (g) {
      for (const line of g) {
        out.push(
          line.map(([u, v]) => {
            const px = cx + u * w * sc + (1 - v) * size * slant + (r() - 0.5) * size * 0.04;
            const py = y + v * size * sc + dy + (r() - 0.5) * size * 0.04;
            return [px, py] as Pt;
          }),
        );
      }
    }
    cx += w + size * 0.16;
  }
  return out;
};

// Resample a polyline to roughly even spacing, with hand jitter.
export const resample = (pts: Pt[], step: number, jitter = 0, seed = 1): Pt[] => {
  const out: Pt[] = [];
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const jx = jitter ? noise1(k * 0.15, seed) * jitter : 0;
      const jy = jitter ? noise1(k * 0.15 + 50, seed) * jitter : 0;
      out.push([ax + (bx - ax) * u + jx, ay + (by - ay) * u + jy]);
      k++;
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const lengths = (pts: Pt[]) => {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
};

// Point at progress p (0..1) along a polyline.
export const pointAt = (pts: Pt[], p: number): Pt => {
  const L = lengths(pts);
  const target = Math.max(0, Math.min(1, p)) * L[L.length - 1];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] >= target) {
      const u = (target - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    }
  }
  return pts[pts.length - 1];
};

// Ink pen: pressure-varying line with a faint bleed underneath.
export const ink = (ctx: Ctx, pts: Pt[], p: number, width: number, color: string, seed = 1, alpha = 1, bleed = 0.12) => {
  if (p <= 0 || pts.length < 2) return;
  const L = lengths(pts);
  const end = Math.min(1, p) * L[L.length - 1];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = bleed * alpha;
  ctx.lineWidth = width * 1.8;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && L[i - 1] < end; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.globalAlpha = 0.92 * alpha;
  for (let i = 1; i < pts.length && L[i - 1] < end; i++) {
    const pr = 0.75 + 0.35 * noise1(L[i] * 0.02, seed);
    ctx.lineWidth = width * pr;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    let [x, y] = pts[i];
    if (L[i] > end) {
      const u = (end - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      x = pts[i - 1][0] + (x - pts[i - 1][0]) * u;
      y = pts[i - 1][1] + (y - pts[i - 1][1]) * u;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
};

// Chalk: grainy stamped dots that skip over the board's tooth.
export const chalk = (ctx: Ctx, pts: Pt[], p: number, width: number, color: string, seed = 1, alpha = 1) => {
  if (p <= 0 || pts.length < 2) return;
  const L = lengths(pts);
  const total = L[L.length - 1];
  const end = Math.min(1, p) * total;
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(1.2, width * 0.18);
  let k = 0;
  let seg = 1;
  for (let s = 0; s < end; s += step, k++) {
    while (seg < pts.length - 1 && L[seg] < s) seg++;
    const u = (s - L[seg - 1]) / Math.max(1e-6, L[seg] - L[seg - 1]);
    const x = pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * u;
    const y = pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * u;
    const pressure = 0.7 + 0.3 * noise1(s * 0.01, seed);
    for (let d = 0; d < 5; d++) {
      const hsh = hash(seed * 13.1 + k * 7.31 + d * 1.7);
      const h2 = hash(seed * 3.7 + k * 1.93 + d * 9.1);
      const ox = (hsh - 0.5) * width * pressure;
      const oy = (h2 - 0.5) * width * pressure;
      const tooth = hash(Math.floor((x + ox) / 3) * 17.3 + Math.floor((y + oy) / 3) * 91.7);
      if (tooth < 0.28) continue;
      ctx.globalAlpha = alpha * (0.25 + 0.6 * hash(k * 3.3 + d + seed));
      const sz = 1 + hash(k + d * 5.1 + seed) * width * 0.22;
      ctx.fillRect(x + ox, y + oy, sz, sz);
    }
  }
  ctx.restore();
};

// Hand-drawn box: four strokes with overshooting corners.
export const handBox = (x: number, y: number, w: number, h: number, seed: number): Pt[][] => {
  const r = rng(seed);
  const j = () => (r() - 0.5) * Math.min(w, h) * 0.06;
  const o = Math.min(w, h) * 0.08;
  return [
    resample([[x - o + j(), y + j()], [x + w + o + j(), y + j()]], 8, 1.2, seed),
    resample([[x + w + j(), y - o + j()], [x + w + j(), y + h + o + j()]], 8, 1.2, seed + 1),
    resample([[x + w + o + j(), y + h + j()], [x - o + j(), y + h + j()]], 8, 1.2, seed + 2),
    resample([[x + j(), y + h + o + j()], [x + j(), y - o + j()]], 8, 1.2, seed + 3),
  ];
};

// Hand-drawn arrow along a quadratic curve, with a two-stroke head.
export const handArrow = (a: Pt, b: Pt, bend: number, seed: number, head = 18): Pt[][] => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c: Pt = [mx - dy * bend, my + dx * bend];
  const body: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    body.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]]);
  }
  const tx = b[0] - c[0];
  const ty = b[1] - c[1];
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const h1: Pt = [b[0] - ux * head - uy * head * 0.55, b[1] - uy * head + ux * head * 0.55];
  const h2: Pt = [b[0] - ux * head + uy * head * 0.55, b[1] - uy * head - ux * head * 0.55];
  return [resample(body, 8, 1.4, seed), [h1, b, h2]];
};

// Frantic cross-out scribble filling a region.
export const scribble = (cx: number, cy: number, w: number, h: number, seed: number, turns = 9): Pt[] => {
  const r = rng(seed);
  const pts: Pt[] = [];
  const n = turns * 8;
  const ph = r() * 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = cx + (w / 2) * Math.sin(u * Math.PI * turns + ph) * (0.75 + 0.25 * r());
    const y = cy - h / 2 + h * u + (h / turns) * 0.6 * Math.sin(u * Math.PI * turns * 2.1) + (r() - 0.5) * h * 0.08;
    pts.push([x, y]);
  }
  return resample(pts, 6, 2, seed);
};

// Zigzag hatching cross-out.
export const hatch = (x: number, y: number, w: number, h: number, seed: number, n = 7): Pt[] => {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push([x + (i % 2 ? w : 0) + (r() - 0.5) * w * 0.15, y + (h * i) / n + (r() - 0.5) * 10]);
  }
  return resample(pts, 6, 2.5, seed);
};

// ---- static bases ---------------------------------------------------------

export const paperBase = (w: number, h: number, seed: number, ruled = true, tone = '#ebdfcf') => {
  const c = mkCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 80 + r() * 380;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.5;
    g.addColorStop(0, warm ? 'rgba(196,150,110,0.05)' : 'rgba(255,250,240,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 2 + r() * 9;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(120,90,70,0.06)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  if (ruled) {
    const gap = h / 24;
    ctx.strokeStyle = 'rgba(122,112,140,0.32)';
    ctx.lineWidth = 2;
    for (let y = gap * 2.2; y < h; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(176,92,78,0.38)';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 0);
    ctx.lineTo(w * 0.1, h);
    ctx.stroke();
  }
  return c;
};

export const boardBase = (w: number, h: number, seed: number) => {
  const c = mkCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  ctx.fillStyle = '#1e1c1d';
  ctx.fillRect(0, 0, w, h);
  // erased chalk residue: soft clouds and eraser swipes
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 60 + r() * 300;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(235,225,215,${0.015 + r() * 0.04})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const y = r() * h;
    ctx.strokeStyle = `rgba(230,220,210,${0.02 + r() * 0.025})`;
    ctx.lineWidth = 50 + r() * 70;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 200 + r() * 200, y + (r() - 0.5) * 120, x + 400 + r() * 300, y + (r() - 0.5) * 80);
    ctx.stroke();
  }
  for (let i = 0; i < 40000; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  return c;
};

// Grayscale tooth/noise for bump maps.
export const noiseCanvas = (w: number, h: number, seed: number, scale = 1) => {
  const c = mkCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const r = rng(seed);
  for (let i = 0; i < w * h; i++) {
    const v = 110 + r() * 60 * scale;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

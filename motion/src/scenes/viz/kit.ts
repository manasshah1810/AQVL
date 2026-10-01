// Drawing kit for the AQVL world: luminous, precise, dimensional.
import { C, Cam, V3, clamp, lerp } from '../../lib/core';

export const HOT = [255, 91, 46];
export const COOL = [134, 168, 255];
export const WHITE = [236, 240, 248];
export const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
export const mix = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const bg = (ctx: CanvasRenderingContext2D, tint = 0) => {
  const g = ctx.createRadialGradient(960, 620, 50, 960, 540, 1300);
  g.addColorStop(0, `rgb(${14 + tint * 8},${17 + tint * 6},${28 + tint * 4})`);
  g.addColorStop(1, C.void);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
};

export const floor = (ctx: CanvasRenderingContext2D, cam: Cam, y: number, ext: number, step: number, alpha = 0.12, cx = 0, cz = 0) => {
  ctx.lineWidth = 1;
  for (let k = -ext; k <= ext; k += step) {
    for (const axis of [0, 1]) {
      const pts: { x: number; y: number; z: number }[] = [];
      for (let s = -ext; s <= ext; s += step / 2) {
        const p: V3 = axis ? [cx + k, y, cz + s] : [cx + s, y, cz + k];
        pts.push(cam(p));
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.z < 1 || b.z < 1) continue;
        const fade = clamp(1 - Math.hypot(k, (i / pts.length) * 2 * ext - ext) / ext);
        ctx.strokeStyle = `rgba(150,170,210,${alpha * fade * fade})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
};

/** glassy box with lit edges. state color c, glow 0..1 */
export const box = (ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, z: number, w: number, h: number, d: number, c: number[], glow = 0, alpha = 1) => {
  if (h <= 0.0001) return;
  const v: V3[] = [
    [x - w / 2, y, z - d / 2],
    [x + w / 2, y, z - d / 2],
    [x + w / 2, y, z + d / 2],
    [x - w / 2, y, z + d / 2],
    [x - w / 2, y + h, z - d / 2],
    [x + w / 2, y + h, z - d / 2],
    [x + w / 2, y + h, z + d / 2],
    [x - w / 2, y + h, z + d / 2],
  ];
  const p = v.map(cam);
  if (p.some((q) => q.z < 1)) return;
  const faces = [
    [4, 5, 6, 7, 1.0],
    [0, 1, 5, 4, 0.55],
    [1, 2, 6, 5, 0.4],
    [2, 3, 7, 6, 0.55],
    [3, 0, 4, 7, 0.4],
  ];
  // back-face cull by screen winding
  for (const fc of faces) {
    const [a, b, cc, dd, shade] = fc;
    const A = p[a], B = p[b], Cc = p[cc];
    const cr = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
    if (cr > 0) continue;
    ctx.beginPath();
    ctx.moveTo(p[a].x, p[a].y);
    ctx.lineTo(p[b].x, p[b].y);
    ctx.lineTo(p[cc].x, p[cc].y);
    ctx.lineTo(p[dd].x, p[dd].y);
    ctx.closePath();
    const base = mix([16, 20, 32], c, 0.18 + glow * 0.55);
    ctx.fillStyle = rgba(mix(base, c, (shade as number) * (0.12 + glow * 0.5)), 0.92 * alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(c, (0.55 + glow * 0.45) * alpha);
    ctx.lineWidth = 1.4 + glow * 1.4;
    ctx.stroke();
  }
};

export const node = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: number[], glow = 0, alpha = 1, ring = true) => {
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * (2.4 + glow * 1.6));
    g.addColorStop(0, rgba(c, 0.45 * glow * alpha));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * (2.4 + glow * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgba(mix([12, 15, 24], c, 0.25 + glow * 0.75), alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (ring) {
    ctx.strokeStyle = rgba(c, 0.9 * alpha);
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.stroke();
  }
};

export const line = (ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, c: number[], alpha: number, w = 1.5, t = 1) => {
  if (t <= 0) return;
  ctx.strokeStyle = rgba(c, alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  ctx.stroke();
};

export const label = (ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, size: number, c: number[], alpha: number, font: string, align: CanvasTextAlign = 'center') => {
  ctx.font = `600 ${size}px "${font}"`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(c, alpha);
  ctx.fillText(txt, x, y);
};

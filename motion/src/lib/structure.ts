// The colossal structure: a procedurally grown 3D call tree (~2.5k nodes).
// Used by the hook (macro→micro pull-back) and the hero return.
import { C, Cam, V3, add, clamp, cross, lerp, lerp3, mul, norm, rng } from './core';

export type SNode = { p: V3; parent: number; depth: number; dir: V3; leafIdx: number; phase: number };
const BRANCH = [6, 3, 3, 3, 2, 2, 2];
const LEN = [150, 135, 140, 150, 160, 175, 190];
const SPREAD = [0, 0.75, 0.62, 0.56, 0.5, 0.46, 0.42];

const perp = (d: V3): [V3, V3] => {
  const a: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, a));
  return [u, cross(d, u)];
};

export const buildStructure = () => {
  const r = rng(2026);
  const nodes: SNode[] = [{ p: [0, 0, 0], parent: -1, depth: 0, dir: [0, 0, 1], leafIdx: -1, phase: 0 }];
  let frontier = [0];
  for (let d = 0; d < BRANCH.length; d++) {
    const next: number[] = [];
    for (const pi of frontier) {
      const par = nodes[pi];
      const n = BRANCH[d];
      for (let k = 0; k < n; k++) {
        let dir: V3;
        if (d === 0) {
          // fibonacci sphere
          const y = 1 - ((k + 0.5) / n) * 2;
          const rad = Math.sqrt(1 - y * y);
          const th = k * 2.399963 + 0.4;
          dir = [Math.cos(th) * rad, y * 0.8, Math.sin(th) * rad];
        } else {
          const [u, v] = perp(par.dir);
          const ang = (k / n) * Math.PI * 2 + r() * 0.9 + d;
          const s = SPREAD[d] * (0.75 + r() * 0.5);
          dir = norm(add(par.dir, add(mul(u, Math.cos(ang) * s), mul(v, Math.sin(ang) * s))));
        }
        const len = LEN[d] * (0.8 + r() * 0.4);
        nodes.push({ p: add(par.p, mul(dir, len)), parent: pi, depth: d + 1, dir: norm(dir), leafIdx: -1, phase: r() });
        next.push(nodes.length - 1);
      }
    }
    frontier = next;
  }
  const leaves = frontier;
  leaves.forEach((li, i) => (nodes[li].leafIdx = i));
  return { nodes, leaves };
};

export const S = buildStructure();
// the hero leaf: pick a leaf whose direction faces +z and slightly up-right
export const HERO_LEAF = (() => {
  let best = S.leaves[0], bs = -1e9;
  for (const li of S.leaves) {
    const d = norm(S.nodes[li].p);
    const sc = d[2] * 1.0 + d[0] * 0.25 + d[1] * 0.15;
    if (sc > bs) {
      bs = sc;
      best = li;
    }
  }
  return best;
})();
export const pathTo = (i: number) => {
  const out: number[] = [];
  while (i >= 0) {
    out.unshift(i);
    i = S.nodes[i].parent;
  }
  return out;
};
const HERO_PATH = new Set(pathTo(HERO_LEAF));

export type DrawOpts = {
  t: number; // seconds, drives pulses
  implode?: number; // 0..1 collapse everything into the hero leaf
  heroGlow?: number; // emphasis of orange path
  pulses?: number; // 0..1 density of traversal pulses
  fogNear?: number;
  fogFar?: number;
  nodeR?: number;
  lineAlpha?: number;
  activity?: number; // 0..1: nodes flashing orange (alive)
  pointScale?: number;
  pointPx?: number;
  nodeAlpha?: number;
};

export const drawStructure = (ctx: CanvasRenderingContext2D, cam: Cam, o: DrawOpts) => {
  const { nodes } = S;
  const hero = nodes[HERO_LEAF].p;
  const imp = o.implode ?? 0;
  const fogNear = o.fogNear ?? 200, fogFar = o.fogFar ?? 9000;
  const nodeR = o.nodeR ?? 1.6;
  const la = o.lineAlpha ?? 0.22;
  const act = o.activity ?? 0;
  const proj = nodes.map((n) => {
    const k = clamp(imp * (1.0 + (n.depth / 7) * 0.0) * 1.15 - (1 - n.depth / 7) * 0.15 * (1 - imp));
    const p = imp > 0 ? lerp3(n.p, hero, Math.pow(k, 1.6)) : n.p;
    return cam(p);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  // edges
  for (let i = 1; i < nodes.length; i++) {
    const a = proj[nodes[i].parent], b = proj[i];
    if (a.z <= 1 || b.z <= 1) continue;
    const z = (a.z + b.z) / 2;
    const fog = clamp(1 - (z - fogNear) / (fogFar - fogNear), 0.08, 1);
    const isHero = HERO_PATH.has(i);
    const w = clamp(0.9 * Math.min(a.s, b.s) * 1.2, 0.5, 6);
    if (isHero && (o.heroGlow ?? 0) > 0) {
      ctx.strokeStyle = `rgba(255,91,46,${clamp(0.85 * (o.heroGlow ?? 0))})`;
      ctx.lineWidth = w * 1.8;
    } else {
      const dd = nodes[i].depth;
      const depthA = dd <= 2 ? 2.2 : dd <= 4 ? 1.3 : 0.75;
      ctx.strokeStyle = `rgba(190,205,235,${clamp(la * fog * depthA)})`;
      ctx.lineWidth = w * (dd <= 1 ? 3.2 : dd <= 2 ? 2.2 : dd <= 4 ? 1.4 : 1);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // nodes
  for (let i = 0; i < nodes.length; i++) {
    const q = proj[i];
    if (q.z <= 1) continue;
    const n = nodes[i];
    const fog = clamp(1 - (q.z - fogNear) / (fogFar - fogNear), 0.1, 1);
    let r = clamp(nodeR * q.s * (n.depth === 7 ? 1 : 1.25), 0.7, 260);
    let col = '235,240,250';
    let a = 0.75 * fog * (o.nodeAlpha ?? 1);
    if (n.depth <= 3) r *= 1.6 - n.depth * 0.1;
    if (act > 0) {
      const fl = Math.sin(o.t * 2.2 + n.phase * 40 + n.depth * 0.7);
      if (fl > 1 - act * 0.35) {
        col = '255,91,46';
        a = 0.95;
        r *= 1.4;
      }
    }
    if (i === HERO_LEAF) continue;
    if (r > 14) a *= Math.pow(14 / r, 1.3) * 0.8; // out-of-focus: soft, translucent
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // traversal pulses: root -> leaf
  const pd = o.pulses ?? 0;
  if (pd > 0) {
    const count = Math.floor(140 * pd);
    for (let k = 0; k < count; k++) {
      const leaf = S.leaves[(k * 97 + 13) % S.leaves.length];
      const path = pathTo(leaf);
      const speed = 0.55 + ((k * 37) % 10) / 22;
      const u = (o.t * speed + k * 0.618) % 1.6;
      if (u > 1) continue;
      const fpos = u * (path.length - 1);
      const i0 = Math.floor(fpos), fr = fpos - i0;
      const A = proj[path[i0]], B = proj[path[Math.min(i0 + 1, path.length - 1)]];
      if (A.z <= 1 || B.z <= 1) continue;
      const x = lerp(A.x, B.x, fr), y = lerp(A.y, B.y, fr);
      const s = lerp(A.s, B.s, fr);
      const r = clamp(nodeR * s * 1.6, 1, 30);
      ctx.fillStyle = `rgba(255,${k % 5 === 0 ? 120 : 236},${k % 5 === 0 ? 80 : 225},0.95)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // hero point (drawn last, solid, not additive)
  const hq = cam(hero);
  if (hq.z > 1) {
    const r = o.pointPx ?? clamp(nodeR * hq.s * 1.5 * (o.pointScale ?? 1), 2, 2000);
    const g = ctx.createRadialGradient(hq.x, hq.y, r * 0.8, hq.x, hq.y, r * 2.4);
    g.addColorStop(0, 'rgba(255,91,46,0.35)');
    g.addColorStop(1, 'rgba(255,91,46,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hq.x, hq.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.hot;
    ctx.beginPath();
    ctx.arc(hq.x, hq.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return hq;
};

export const CENTROID: V3 = (() => {
  let x = 0, y = 0, z = 0;
  for (const n of S.nodes) { x += n.p[0]; y += n.p[1]; z += n.p[2]; }
  const k = S.nodes.length;
  return [x / k, y / k, z / k];
})();

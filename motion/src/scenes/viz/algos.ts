// Algorithm vignettes. Each is real: the data and events come from running the algorithm.
import { E, V3, clamp, inv, lerp, lookAt, orbit, rng } from '../../lib/core';
import { MONO } from '../../fonts';
import { COOL, HOT, WHITE, bg, box, floor, label, line, mix, node, rgba } from './kit';

type Ctx = CanvasRenderingContext2D;
const ease = (t: number) => E.inOut(clamp(t));

/* ---------------- sorting: replay swap events ---------------- */
type SortEv = { a: number; b: number; pivot?: number; done?: number[] };
const quickEvents = (arr: number[]) => {
  const a = arr.slice();
  const ev: SortEv[] = [];
  const done: number[] = [];
  const qs = (lo: number, hi: number) => {
    if (lo > hi) return;
    if (lo === hi) {
      done.push(lo);
      return;
    }
    const p = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      if (a[j] < p) {
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          ev.push({ a: i, b: j, pivot: hi });
        }
        i++;
      }
    }
    [a[i], a[hi]] = [a[hi], a[i]];
    ev.push({ a: i, b: hi, pivot: i });
    done.push(i);
    ev[ev.length - 1].done = done.slice();
    qs(lo, i - 1);
    qs(i + 1, hi);
  };
  qs(0, a.length - 1);
  return ev;
};
export const bubbleEvents = (arr: number[]) => {
  const a = arr.slice();
  const ev: (SortEv & { cmp?: boolean })[] = [];
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - i - 1; j++) {
      ev.push({ a: j, b: j + 1, cmp: true });
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        ev.push({ a: j, b: j + 1 });
      }
    }
  return ev;
};
/** item positions (slot index per item) and swap arc at continuous step s */
const replay = (n: number, ev: SortEv[], s: number) => {
  const slot = Array.from({ length: n }, (_, i) => i); // slot[item]
  const at = Array.from({ length: n }, (_, i) => i); // at[slot] = item
  const k = Math.floor(s);
  for (let e = 0; e < Math.min(k, ev.length); e++) {
    const { a, b } = ev[e];
    if ((ev[e] as any).cmp) continue;
    const ia = at[a], ib = at[b];
    at[a] = ib;
    at[b] = ia;
    slot[ia] = b;
    slot[ib] = a;
  }
  const pos = slot.map((x) => x as number);
  const hop = new Array(n).fill(0);
  let active: number[] = [];
  if (k < ev.length) {
    const fr = s - k;
    const { a, b } = ev[k];
    const ia = at[a], ib = at[b];
    active = [ia, ib];
    if (!(ev[k] as any).cmp) {
      const e = ease(fr);
      pos[ia] = lerp(a, b, e);
      pos[ib] = lerp(b, a, e);
      hop[ia] = Math.sin(e * Math.PI);
      hop[ib] = -Math.sin(e * Math.PI);
    }
  }
  return { pos, hop, active, cur: ev[Math.min(k, ev.length - 1)] };
};

export const SORT_VALS = (() => {
  const r = rng(8);
  return Array.from({ length: 26 }, () => 0.15 + r() * 0.85);
})();
const QEV = quickEvents(SORT_VALS);

export const drawQuickSort = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const n = SORT_VALS.length;
  const t = f / dur;
  const cam = lookAt(orbit([0, 2.6, 0], 17 - t * 3, -0.95 + t * 0.7, 0.2 + t * 0.05), [lerp(-3, 3, t), 2.2, 0], 52);
  floor(ctx, cam, 0, 20, 1, 0.14);
  const s = 4 + f * 0.75;
  const { pos, hop, active, cur } = replay(n, QEV, s);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => cam([pos[b] - n / 2, 0, hop[b]]).z - cam([pos[a] - n / 2, 0, hop[a]]).z);
  for (const i of order) {
    const x = (pos[i] - n / 2 + 0.5) * 1.0;
    const isA = active.includes(i);
    const isP = cur && cur.pivot !== undefined && Math.round(pos[i]) === cur.pivot;
    const c = isA ? HOT : isP ? COOL : WHITE;
    box(ctx, cam, x, 0, hop[i] * 1.6, 0.72, SORT_VALS[i] * 6, 0.72, c, isA ? 1 : isP ? 0.6 : 0.05);
  }
};

/* ---------------- bars for the code→structure scene (bubble sort on the README's array) ---------------- */
export const README_ARR = [64, 34, 25, 12, 22, 11, 90];
export const BEV = bubbleEvents(README_ARR);
export const drawBubble = (ctx: Ctx, step: number, cam: ReturnType<typeof lookAt>, rise: number, alpha = 1) => {
  const n = README_ARR.length;
  const { pos, hop, active } = replay(n, BEV, step);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => cam([pos[b] * 1.6, 0, hop[b]]).z - cam([pos[a] * 1.6, 0, hop[a]]).z);
  const sortedCount = step >= BEV.length ? n : 0;
  for (const i of order) {
    const x = (pos[i] - (n - 1) / 2) * 1.6;
    const r = clamp(rise * 1.3 - i * 0.05);
    const isA = active.includes(i) && step < BEV.length;
    box(ctx, cam, x, 0, hop[i] * 1.7, 1.1, (README_ARR[i] / 90) * 6 * E.out(r), 1.1, isA ? HOT : sortedCount ? COOL : WHITE, isA ? 1 : 0.08, alpha);
    const top = cam([x, (README_ARR[i] / 90) * 6 * E.out(r) + 0.6, hop[i] * 1.7]);
    if (r > 0.5) label(ctx, String(README_ARR[i]), top.x, top.y, Math.max(14, top.s * 0.42), isA ? HOT : WHITE, alpha * (r - 0.5) * 2 * 0.9, MONO);
  }
  return active;
};

/* ---------------- graph: Dijkstra wavefront ---------------- */
export const G = (() => {
  const r = rng(31);
  const pts: V3[] = [];
  while (pts.length < 52) {
    const p: V3 = [(r() - 0.5) * 22, 0, (r() - 0.5) * 13];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) > 1.7)) {
      p[1] = Math.sin(p[0] * 0.35) * 0.9 + Math.cos(p[2] * 0.5) * 0.6;
      pts.push(p);
    }
  }
  const edges: [number, number, number][] = [];
  const has = new Set<string>();
  pts.forEach((p, i) => {
    const near = pts.map((q, j) => [j, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])] as [number, number]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
    for (const [j, d] of near) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!has.has(k)) {
        has.add(k);
        edges.push([i, j, d]);
      }
    }
  });
  const src = pts.reduce((b, p, i) => (p[0] < pts[b][0] ? i : b), 0);
  const dst = pts.reduce((b, p, i) => (p[0] > pts[b][0] ? i : b), 0);
  // Dijkstra
  const dist = new Array(pts.length).fill(Infinity), par = new Array(pts.length).fill(-1), done = new Array(pts.length).fill(false);
  dist[src] = 0;
  for (let it = 0; it < pts.length; it++) {
    let u = -1;
    for (let i = 0; i < pts.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [a, b, w] of edges) {
      const v = a === u ? b : b === u ? a : -1;
      if (v >= 0 && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        par[v] = u;
      }
    }
  }
  const maxD = Math.max(...dist.filter((d) => d < Infinity));
  const path: number[] = [];
  for (let v = dst; v >= 0; v = par[v]) path.unshift(v);
  return { pts, edges, src, dst, dist, par, maxD, path };
})();

export const drawDijkstra = (ctx: Ctx, f: number, dur: number, o: { yaw?: number; dist?: number; skipBg?: boolean; wave?: number } = {}) => {
  if (!o.skipBg) bg(ctx);
  const t = f / dur;
  const cam = lookAt(orbit([0, 0, 0], o.dist ?? 21 - t * 3, (o.yaw ?? -0.4) + t * 0.5, 0.75 - t * 0.12), [0, 0, 0], 50);
  floor(ctx, cam, -1.6, 18, 1.5, 0.08);
  const front = (o.wave ?? clamp(t / 0.7)) * G.maxD * 1.02; // wavefront distance
  const pathT = clamp((t - 0.7) / 0.25);
  const proj = G.pts.map(cam);
  const onPath = new Set<string>();
  for (let i = 1; i < G.path.length; i++) onPath.add(`${G.path[i - 1]}-${G.path[i]}`);
  for (const [a, b] of G.edges) {
    line(ctx, proj[a], proj[b], WHITE, 0.14, 1.3);
  }
  // tree edges grow as the wave reaches them
  for (let v = 0; v < G.pts.length; v++) {
    const u = G.par[v];
    if (u < 0) continue;
    const e = clamp((front - G.dist[u]) / (G.dist[v] - G.dist[u] + 1e-6));
    if (e <= 0) continue;
    const isPath = onPath.has(`${u}-${v}`);
    const pp = isPath ? clamp(pathT * (G.path.length - 1) - (G.path.indexOf(v) - 1)) : 0;
    line(ctx, proj[u], proj[v], COOL, 0.75, 2.2, e);
    if (pp > 0) line(ctx, proj[u], proj[v], HOT, 1, 5, pp);
  }
  for (let i = 0; i < G.pts.length; i++) {
    const q = proj[i];
    const reached = G.dist[i] <= front;
    const just = reached ? clamp(1 - (front - G.dist[i]) / (G.maxD * 0.12)) : 0;
    const isP = G.path.includes(i) && pathT > G.path.indexOf(i) / G.path.length;
    const c = isP ? HOT : reached ? mix(COOL, WHITE, just) : WHITE;
    node(ctx, q.x, q.y, Math.max(3, q.s * 0.28), c, isP ? 1 : just, reached ? 1 : 0.55);
  }
  if (pathT > 0 && pathT < 1) {
    const fp = pathT * (G.path.length - 1);
    const i = Math.floor(fp);
    const a = proj[G.path[i]], b = proj[G.path[Math.min(i + 1, G.path.length - 1)]];
    node(ctx, lerp(a.x, b.x, fp - i), lerp(a.y, b.y, fp - i), 10, HOT, 1.5);
  }
};

/* ---------------- tree: BST search with a diving camera ---------------- */
type TN = { key: number; p: V3; depth: number; parent: number };
const TREE: TN[] = (() => {
  const out: TN[] = [];
  const build = (lo: number, hi: number, depth: number, x: number, spread: number, parent: number) => {
    if (lo > hi) return;
    const mid = (lo + hi) >> 1;
    const idx = out.length;
    out.push({ key: mid, p: [x, -depth * 3.2, Math.sin(depth * 1.3 + x) * 0.6], depth, parent });
    build(lo, mid - 1, depth + 1, x - spread, spread / 2, idx);
    build(mid + 1, hi, depth + 1, x + spread, spread / 2, idx);
  };
  build(1, 63, 0, 0, 13, -1);
  return out;
})();
const SEARCH = (() => {
  const target = 45;
  const path: number[] = [];
  let i = 0;
  while (i >= 0) {
    path.push(i);
    const k = TREE[i].key;
    if (k === target) break;
    const kids = TREE.map((n, j) => [n, j] as [TN, number]).filter(([n]) => n.parent === i);
    const next = kids.find(([n]) => (target < k ? n.key < k : n.key > k));
    i = next ? next[1] : -1;
  }
  return path;
})();
export const drawBST = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const fp = clamp(t * 1.1) * (SEARCH.length - 1);
  const i = Math.floor(fp), fr = E.inOut(fp - i);
  const A = TREE[SEARCH[i]].p, B = TREE[SEARCH[Math.min(i + 1, SEARCH.length - 1)]].p;
  const pt: V3 = [lerp(A[0], B[0], fr), lerp(A[1], B[1], fr), lerp(A[2], B[2], fr)];
  const camPos: V3 = [pt[0] * 0.8 + 4, pt[1] + 7 - t * 2, pt[2] + 15 - t * 6];
  const cam = lookAt(camPos, [pt[0], pt[1] - 2, pt[2]], 55);
  const proj = TREE.map((n) => cam(n.p));
  for (let k = 1; k < TREE.length; k++) {
    const pa = proj[TREE[k].parent], pb = proj[k];
    if (pa.z < 1 || pb.z < 1) continue;
    const pi = SEARCH.indexOf(k);
    const lit = pi > 0 && pi <= fp + 0.001 ? 1 : pi > 0 && pi - 1 < fp ? fp - (pi - 1) : 0;
    line(ctx, pa, pb, WHITE, 0.25, 1.4);
    if (lit > 0) line(ctx, pa, pb, HOT, 1, 4, lit);
  }
  for (let k = 0; k < TREE.length; k++) {
    const q = proj[k];
    if (q.z < 1) continue;
    const pi = SEARCH.indexOf(k);
    const visited = pi >= 0 && pi <= fp;
    const r = Math.max(4, q.s * 0.55);
    node(ctx, q.x, q.y, r, visited ? HOT : WHITE, visited ? 0.9 : 0, visited ? 1 : 0.8);
    if (r > 14) label(ctx, String(TREE[k].key), q.x, q.y + 1, r * 0.75, visited ? [255, 240, 230] : WHITE, 0.95, MONO);
  }
  const pq = cam(pt);
  node(ctx, pq.x, pq.y - Math.max(4, pq.s * 0.55) * 1.9, 9, HOT, 1.4);
};

/* ---------------- recursion: fib call tree + live call stack ---------------- */
type Call = { n: number; depth: number; x: number; parent: number; open: number; close: number; val: number };
const CALLS: Call[] = (() => {
  const out: Call[] = [];
  let clock = 0, leaf = 0;
  const fib = (n: number, depth: number, parent: number): number => {
    const idx = out.length;
    out.push({ n, depth, x: 0, parent, open: clock++, close: 0, val: 0 });
    let v: number;
    if (n < 2) {
      v = n;
      out[idx].x = leaf++;
    } else {
      const kidsStart = out.length;
      v = fib(n - 1, depth + 1, idx) + fib(n - 2, depth + 1, idx);
      const kids = out.filter((c, j) => j >= kidsStart && c.parent === idx);
      out[idx].x = (kids[0].x + kids[kids.length - 1].x) / 2;
    }
    out[idx].close = clock++;
    out[idx].val = v;
    return v;
  };
  fib(6, 0, -1);
  return out;
})();
const CLOCK = Math.max(...CALLS.map((c) => c.close)) + 1;
const LEAVES = Math.max(...CALLS.map((c) => c.x)) + 1;
export const drawRecursion = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const clock = t * CLOCK * 1.05;
  const cam = lookAt([2 + t * 3, -6, 26 - t * 4], [0, -6.5, 0], 50);
  const pos = (c: Call): V3 => [(c.x - (LEAVES - 1) / 2) * 1.5, -c.depth * 2.6, 0];
  const proj = CALLS.map((c) => cam(pos(c)));
  CALLS.forEach((c, i) => {
    if (c.parent < 0 || clock < c.open) return;
    const e = clamp(clock - c.open);
    line(ctx, proj[c.parent], proj[i], clock > c.close ? COOL : WHITE, clock > c.close ? 0.7 : 0.4, 1.8, e);
  });
  let depthNow = 0;
  CALLS.forEach((c, i) => {
    if (clock < c.open) return;
    const active = clock < c.close;
    if (active) depthNow = Math.max(depthNow, c.depth + 1);
    const q = proj[i];
    const pop = E.out(clamp(clock - c.open));
    const isTop = active && !CALLS.some((d) => d.parent === i && clock >= d.open && clock < d.close);
    node(ctx, q.x, q.y, Math.max(5, q.s * 0.5) * pop, isTop ? HOT : active ? WHITE : COOL, isTop ? 1.2 : active ? 0.2 : 0.4);
    label(ctx, active ? `f${c.n}` : String(c.val), q.x, q.y + 1, Math.max(10, q.s * 0.36), isTop ? [255, 240, 230] : WHITE, 0.9 * pop, MONO);
  });
  // call stack column, left
  for (let k = 0; k < 7; k++) {
    const on = k < depthNow;
    const y = 900 - k * 62;
    ctx.fillStyle = on ? rgba(k === depthNow - 1 ? HOT : COOL, k === depthNow - 1 ? 0.95 : 0.35) : 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = on ? rgba(k === depthNow - 1 ? HOT : COOL, 0.9) : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(150, y, 170, 48, 6);
    ctx.fill();
    ctx.stroke();
  }
};

/* ---------------- DP table: LCS terrain ---------------- */
const SA = 'ALGORITHMS', SB = 'LOGARITHMIC';
const LCS = (() => {
  const m = SA.length, n = SB.length;
  const T = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) T[i][j] = SA[i - 1] === SB[j - 1] ? T[i - 1][j - 1] + 1 : Math.max(T[i - 1][j], T[i][j - 1]);
  return T;
})();
export const drawDP = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const m = SA.length, n = SB.length;
  const cam = lookAt(orbit([0, 0, 0], 19 - t * 2, 0.75 - t * 0.5, 0.82), [0, 0.5, 0], 50);
  const wave = t * (m + n + 2) * 1.05;
  const cells: { i: number; j: number; z: number }[] = [];
  for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) cells.push({ i, j, z: cam([(j - n / 2) * 1.1, 0, (i - m / 2) * 1.1]).z });
  cells.sort((a, b) => b.z - a.z);
  for (const { i, j } of cells) {
    const k = clamp(wave - (i + j));
    const v = LCS[i][j];
    const front = k > 0 && k < 1;
    const match = i > 0 && j > 0 && SA[i - 1] === SB[j - 1];
    box(ctx, cam, (j - n / 2) * 1.1, 0, (i - m / 2) * 1.1, 0.92, 0.12 + E.out(k) * v * 0.55, 0.92, front ? HOT : match && k >= 1 ? mix(COOL, WHITE, 0.3) : WHITE, front ? 1 : match ? 0.45 : 0.04, k > 0 ? 1 : 0.35);
  }
};

/* ---------------- binary search: halves fall away ---------------- */
const BS_N = 64, BS_T = 41;
const BS_STEPS = (() => {
  const s: [number, number, number][] = [];
  let lo = 0, hi = BS_N - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    s.push([lo, hi, mid]);
    if (mid === BS_T) break;
    if (mid < BS_T) lo = mid + 1;
    else hi = mid - 1;
  }
  return s;
})();
export const drawBinarySearch = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const sp = t * BS_STEPS.length * 1.05;
  const cam = lookAt([BS_T * 0.4 - 12.8 + 6, 6, 20 - t * 9], [lerp(0, (BS_T - BS_N / 2) * 0.4, t), 0, 0], 50);
  floor(ctx, cam, -0.01, 16, 0.8, 0.08);
  for (let i = 0; i < BS_N; i++) {
    // when was i eliminated?
    let gone = -1;
    for (let k = 0; k < BS_STEPS.length - 1; k++) {
      const [lo, hi] = BS_STEPS[k + 1];
      if (i < lo || i > hi) {
        gone = k + 1;
        break;
      }
    }
    const fall = gone > 0 ? E.in(clamp(sp - gone)) : 0;
    const k = Math.min(Math.floor(sp), BS_STEPS.length - 1);
    const isMid = BS_STEPS[k][2] === i;
    const found = i === BS_T && sp >= BS_STEPS.length - 0.5;
    box(ctx, cam, (i - BS_N / 2) * 0.4, -fall * 6, 0, 0.3, 0.3 + (i / BS_N) * 2.5, 0.3, isMid || found ? HOT : WHITE, isMid || found ? 1 : 0.05, 1 - fall * 0.85);
  }
};

/* ---------------- linked list reversal ---------------- */
export const drawLinkedList = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const n = 7;
  const cam = lookAt([-4 + t * 6, 4.5, 15], [0, 0, 0], 50);
  const step = t * (n + 0.5);
  const P = (i: number) => cam([(i - (n - 1) / 2) * 2.6, 0, 0]);
  for (let i = 0; i < n; i++) {
    const flip = E.inOut(clamp(step - i));
    box(ctx, cam, (i - (n - 1) / 2) * 2.6, -0.6, 0, 1.4, 1.2, 1.2, Math.floor(step) === i ? HOT : flip >= 1 ? COOL : WHITE, Math.floor(step) === i ? 1 : 0.15);
    if (i < n - 1) {
      // arrow from i to i+1 rotates to point from i+1 to i
      const a = P(i), b = P(i + 1);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 70;
      const ang = flip * Math.PI;
      const L = (b.x - a.x) * 0.28;
      const x1 = mx - Math.cos(ang) * L, x2 = mx + Math.cos(ang) * L;
      const y1 = my - Math.sin(ang) * L * 0.4, y2 = my + Math.sin(ang) * L * 0.4;
      const col = flip > 0 && flip < 1 ? HOT : flip >= 1 ? COOL : WHITE;
      line(ctx, { x: x1, y: y1 }, { x: x2, y: y2 }, col, 0.95, 3);
      const ah = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = rgba(col, 0.95);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ah - 0.5) * 16, y2 - Math.sin(ah - 0.5) * 16);
      ctx.lineTo(x2 - Math.cos(ah + 0.5) * 16, y2 - Math.sin(ah + 0.5) * 16);
      ctx.fill();
    }
  }
};

/* ---------------- hash map: keys drop into buckets ---------------- */
const KEYS = ['ana', 'bo', 'cy', 'dee', 'eli', 'fay', 'gus', 'hal', 'ivy', 'jo', 'kai', 'lu', 'max', 'ned', 'oz', 'pia'];
const hsh = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 8, 7);
export const drawHash = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const cam = lookAt([3, 7, 16], [0, 1.5, 0], 50);
  floor(ctx, cam, 0, 12, 1, 0.1);
  const counts = new Array(8).fill(0);
  for (let b = 0; b < 8; b++) box(ctx, cam, (b - 3.5) * 1.8, 0, 0, 1.4, 0.15, 1.4, WHITE, 0.1);
  KEYS.forEach((k, i) => {
    const b = hsh(k);
    const st = clamp(t * 1.4 * KEYS.length - i * 1.1, 0, 3) / 3;
    if (st <= 0) return;
    const lvl = counts[b]++;
    const y = lerp(9, 0.2 + lvl * 0.9, E.in(st)) ;
    box(ctx, cam, (b - 3.5) * 1.8, y, 0, 1.1, 0.75, 1.1, st < 1 ? HOT : COOL, st < 1 ? 1 : 0.3);
  });
};

/* ---------------- heap: tree and array, one truth ---------------- */
export const drawHeap = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const n = 15;
  const cam = lookAt([0, 1, 17], [0, -1, 0], 50);
  const tp = (i: number): V3 => {
    const d = Math.floor(Math.log2(i + 1));
    const k = i - (2 ** d - 1);
    return [(k + 0.5 - 2 ** d / 2) * (14 / 2 ** d), 3 - d * 2, 0];
  };
  const swapIdx = Math.floor(t * 3) % 3; // sift-up path 14 -> 6 -> 2 -> 0
  const pathI = [14, 6, 2, 0];
  for (let i = 1; i < n; i++) line(ctx, cam(tp(Math.floor((i - 1) / 2))), cam(tp(i)), WHITE, 0.3, 1.5);
  for (let i = 0; i < n; i++) {
    const on = i === pathI[swapIdx] || i === pathI[swapIdx + 1];
    const q = cam(tp(i));
    node(ctx, q.x, q.y, Math.max(6, q.s * 0.45), on ? HOT : WHITE, on ? 1 : 0.1);
    const a = cam([(i - 7) * 0.95, -6, 0]);
    box(ctx, cam, (i - 7) * 0.95, -6.4, 0, 0.8, 0.8, 0.8, on ? HOT : WHITE, on ? 1 : 0.05);
    if (on) line(ctx, q, a, HOT, 0.35, 1.5);
  }
};

/* ---------------- trie ---------------- */
const WORDS = ['tree', 'trie', 'trip', 'tram', 'graph', 'grid', 'greedy', 'heap', 'hash'];
type TrieN = { ch: string; depth: number; parent: number; x: number; order: number };
const TRIE: TrieN[] = (() => {
  const nodes: TrieN[] = [{ ch: '', depth: 0, parent: -1, x: 0, order: 0 }];
  const kids = new Map<string, number>();
  let order = 0;
  for (const w of WORDS) {
    let cur = 0;
    for (const ch of w) {
      const key = cur + ':' + ch;
      if (!kids.has(key)) {
        nodes.push({ ch, depth: nodes[cur].depth + 1, parent: cur, x: 0, order: ++order });
        kids.set(key, nodes.length - 1);
      }
      cur = kids.get(key)!;
    }
  }
  let leaf = 0;
  const lay = (i: number): number => {
    const ch = nodes.map((n, j) => [n, j] as [TrieN, number]).filter(([n]) => n.parent === i).map(([, j]) => j);
    if (!ch.length) return (nodes[i].x = leaf++);
    const xs = ch.map(lay);
    return (nodes[i].x = (xs[0] + xs[xs.length - 1]) / 2);
  };
  lay(0);
  return nodes;
})();
export const drawTrie = (ctx: Ctx, f: number, dur: number) => {
  bg(ctx);
  const t = f / dur;
  const maxO = TRIE.length;
  const leaves = Math.max(...TRIE.map((n) => n.x)) + 1;
  const cam = lookAt([0, -3, 20 - t * 3], [0, -4.5, 0], 50);
  const P = (n: TrieN): V3 => [(n.x - (leaves - 1) / 2) * 1.6, -n.depth * 1.75, 0];
  const shown = t * maxO * 1.15;
  TRIE.forEach((n, i) => {
    if (n.order > shown || i === 0) return;
    line(ctx, cam(P(TRIE[n.parent])), cam(P(n)), WHITE, 0.35, 1.6);
  });
  TRIE.forEach((n, i) => {
    if (n.order > shown) return;
    const q = cam(P(n));
    const fresh = shown - n.order < 3;
    node(ctx, q.x, q.y, Math.max(8, q.s * 0.5), fresh ? HOT : i === 0 ? COOL : WHITE, fresh ? 1 : 0.1);
    if (n.ch) label(ctx, n.ch, q.x, q.y + 1, Math.max(12, q.s * 0.5), fresh ? [255, 240, 230] : WHITE, 0.95, MONO);
  });
};
export { inv };

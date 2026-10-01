// Four hero algorithms, each a pure function of local time (seconds). All motion is spring-driven.
import {PRESETS, spring, stag, pulse, smooth, lerp, clamp, type V3} from './motion';
import type {NodeP, EdgeP} from './rig';

export type SpecNode = NodeP & {id: string};
export type SpecEdge = EdgeP & {id: string};
export type SpecLabel = {id: string; p: V3; text: string; size: number; color: string; opacity?: number; weight?: number};
export type Built = {nodes: SpecNode[]; edges: SpecEdge[]; labels: SpecLabel[]};
export type Ev = {t: number; p: V3; s: number}; // key action: where the camera/light should go
export type Hero = {
  id: string; file: string; anchor: V3; t0: number; dur: number;
  code: string[]; lines: [number, number][]; ticks: number[]; events: Ev[];
  build: (t: number) => Built;
};

const ICE_TXT = '#dbe9fb', AMB = '#ffb02e', MINT_TXT = '#5cf2c8';
const ap = (t: number, t0: number, cfg = PRESETS.pop) => spring(t - t0, cfg);
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ───────────────────────── 1 · Dijkstra ─────────────────────────
const DN: Record<string, V3> = {
  Shop: [-5.8, 1.4, 0], Park: [-2.2, 1.6, 2.9], Mkt: [-2.4, 1.3, -2.9],
  Bank: [2.4, 1.5, -2.5], Gym: [2.6, 1.6, 2.9], Home: [6.4, 1.4, 0.2],
};
const DE: [string, string, number][] = [
  ['Shop', 'Park', 1], ['Shop', 'Mkt', 4], ['Park', 'Mkt', 2], ['Mkt', 'Bank', 5],
  ['Park', 'Gym', 8], ['Bank', 'Gym', 3], ['Bank', 'Home', 6], ['Gym', 'Home', 2],
];
const D_VISIT: Record<string, number> = {Shop: 1.0, Park: 1.65, Mkt: 2.25, Bank: 2.8, Gym: 3.3, Home: 3.8};
// relax events: [edge index, t, from, to, newDist, improved]
const D_RELAX: [number, number, string, string, number, boolean][] = [
  [0, 1.1, 'Shop', 'Park', 1, true], [1, 1.24, 'Shop', 'Mkt', 4, true],
  [2, 1.78, 'Park', 'Mkt', 3, true], [4, 1.92, 'Park', 'Gym', 9, true],
  [3, 2.38, 'Mkt', 'Bank', 8, true], [5, 2.92, 'Bank', 'Gym', 11, false],
  [6, 3.04, 'Bank', 'Home', 14, true], [7, 3.44, 'Gym', 'Home', 11, true],
];
const D_PATH = [0, 4, 7]; // Shop-Park, Park-Gym, Gym-Home
const D_PATH_NODES = ['Shop', 'Park', 'Gym', 'Home'];
const D_OUT = 3.95;
const dijkLines: [number, number][] = [[0, 0], [0.22, 1], [0.44, 2], [0.8, 4], [0.92, 5]];
for (const [n, tv] of Object.entries(D_VISIT)) { void n; dijkLines.push([tv - 0.06, 6], [tv, 7]); }
for (const [, t, , , , imp] of D_RELAX) dijkLines.push([t - 0.14, 8], [t - 0.09, 9], [t - 0.04, 10], [t, imp ? 11 : 13]);
dijkLines.push([D_OUT, 15]);
dijkLines.sort((a, b) => a[0] - b[0]);

const dijkstraBuild = (t: number): Built => {
  const nodes: SpecNode[] = [], edges: SpecEdge[] = [], labels: SpecLabel[] = [];
  const names = Object.keys(DN);
  const outT = (t - D_OUT);
  names.forEach((n, i) => {
    const d0 = dist3(DN[n], DN.Shop);
    const tA = 0.05 + stag(d0, 0.035);
    const a = ap(t, tA);
    const drop = (1 - spring(t - tA, PRESETS.heavy)) * 3.2;
    const bob = Math.sin(t * 1.7 + i * 1.3) * 0.05 * smooth((t - tA) / 0.6);
    const tv = D_VISIT[n];
    const act = Math.max(0, spring(t - tv) - spring(t - (tv + 0.5), PRESETS.settle));
    const flashes = D_RELAX.filter((r) => r[3] === n).reduce((m, r) => Math.max(m, 0.75 * pulse(t - r[1], 0.05, 0.3)), 0);
    let done = spring(t - (tv + 0.5), PRESETS.settle);
    const onPath = D_PATH_NODES.indexOf(n);
    let alpha = 1, scale = 0.7;
    if (outT > 0) {
      if (onPath >= 0) { const k = spring(outT - onPath * 0.17, PRESETS.snap); scale = 0.7 * (1 + 0.18 * k); }
      else alpha = 1 - 0.5 * spring(outT, PRESETS.float);
    }
    nodes.push({id: n, p: add(DN[n], [0, drop + bob, 0]), size: scale, appear: a, active: Math.max(act, flashes), done, alpha});
    // labels: name inside, distance above
    labels.push({id: n + 'n', p: add(DN[n], [0, drop + bob, 0]), text: n, size: 22, color: ICE_TXT, opacity: clamp(a)});
    let dv = '∞', tU = -1;
    for (const r of D_RELAX) if (r[3] === n && t >= r[1] && r[5]) { dv = String(r[4]); tU = r[1]; }
    if (n === 'Shop' && t >= 0.95) { dv = '0'; tU = 0.95; }
    const pop = tU < 0 ? 0 : pulse(t - tU, 0.06, 0.45);
    labels.push({id: n + 'd', p: add(DN[n], [0, 1.15 + drop + bob, 0]), text: dv, size: 34 + pop * 12, color: pop > 0.15 ? AMB : ICE_TXT, opacity: clamp(a) * (dv === '∞' ? 0.5 : 1), weight: 700});
  });
  DE.forEach(([a, b, w], i) => {
    const grow = spring(t - (0.45 + stag(i, 0.06)), PRESETS.snap);
    const rx = D_RELAX.find((r) => r[0] === i);
    const act = rx ? pulse(t - rx[1], 0.05, 0.5) * (rx[5] ? 1 : 0.55) : 0;
    const inPath = D_PATH.indexOf(i);
    let done = 0;
    if (inPath >= 0 && outT > 0) done = spring(outT - inPath * 0.17, PRESETS.snap);
        edges.push({id: 'e' + i, a: DN[a], b: DN[b], grow: clamp(grow, 0, 1.0), active: Math.max(act, 0), done, r: 0.045 + done * 0.03, alpha: inPath < 0 && outT > 0 ? 1 - 0.55 * spring(outT, PRESETS.float) : 1});
    labels.push({id: 'w' + i, p: add(mid(DN[a], DN[b]), [0, 0.35, 0]), text: String(w), size: 20, color: '#8fb4de', opacity: clamp(grow) * 0.85});
  });
  return {nodes, edges, labels};
};

// ───────────────────────── 2 · Recursion: fib(4) call tree + stack ─────────────────────────
type FN = {id: string; n: number; parent: string | null; p: V3; val: number};
const FT: FN[] = [
  {id: 'f4', n: 4, parent: null, p: [0.00, 6.0, 0], val: 3},
  {id: 'f3', n: 3, parent: 'f4', p: [-2.75, 4.5, 0], val: 2},
  {id: 'f2a', n: 2, parent: 'f3', p: [-4.64, 3.0, 0], val: 1},
  {id: 'f1a', n: 1, parent: 'f2a', p: [-5.59, 1.5, 0], val: 1},
  {id: 'f0a', n: 0, parent: 'f2a', p: [-3.61, 1.5, 0], val: 0},
  {id: 'f1c', n: 1, parent: 'f3', p: [-1.55, 3.0, 0], val: 1},
  {id: 'f2b', n: 2, parent: 'f4', p: [2.92, 4.5, 0], val: 1},
  {id: 'f1d', n: 1, parent: 'f2b', p: [1.63, 3.0, 0], val: 1},
  {id: 'f0d', n: 0, parent: 'f2b', p: [4.21, 3.0, 0], val: 0},
];
const callOrder = ['f4', 'f3', 'f2a', 'f1a', 'f0a', 'f1c', 'f2b', 'f1d', 'f0d'];
type Op = {id: string; call: number; ret: number; slot: number};
const OPS: Op[] = (() => {
  const ops: Op[] = [];
  let t = 0.6, k = 0;
  const stack: string[] = [];
  const retOf: Record<string, number> = {};
  const byId = Object.fromEntries(FT.map((f) => [f.id, f]));
  const kids = (id: string) => FT.filter((f) => f.parent === id).map((f) => f.id);
  const visit = (id: string) => {
    const slot = stack.length;
    stack.push(id);
    const op: Op = {id, call: t, ret: 0, slot};
    ops.push(op);
    t += Math.max(0.2, 0.32 - 0.014 * k++);
    for (const c of kids(id)) visit(c);
    t += 0.06;
    op.ret = t; retOf[id] = t;
    t += Math.max(0.18, 0.26 - 0.012 * k++);
    stack.pop();
  };
  visit('f4');
  void byId; void retOf;
  return ops;
})();
const F_END = OPS[0].ret;
const fibLines: [number, number][] = [[0, 0], [0.3, 1], [0.55, 2]];
for (const o of OPS) {
  const f = FT.find((x) => x.id === o.id)!;
  fibLines.push([o.call, o.id === 'f4' ? 9 : f.n <= 1 ? 3 : 6]);
  fibLines.push([o.ret - 0.03, f.n <= 1 ? 4 : 6]);
}
fibLines.push([F_END + 0.5, 10]);
fibLines.sort((a, b) => a[0] - b[0]);
const SLAB_X = 7.0;

const fibBuild = (t: number): Built => {
  const nodes: SpecNode[] = [], edges: SpecEdge[] = [], labels: SpecLabel[] = [];
  const fin = t - F_END; // final wave
  for (const f of FT) {
    const op = OPS.find((o) => o.id === f.id)!;
    const a = ap(t, op.call);
    const drop = (1 - spring(t - op.call, PRESETS.heavy)) * 2.4;
    const live = spring(t - op.call) * (1 - spring(t - op.ret, PRESETS.snap));
    const dn = spring(t - op.ret, PRESETS.settle);
    const depth = f.id === 'f4' ? 0 : f.p[1] > 5 ? 0 : f.p[1] > 4 ? 1 : f.p[1] > 2.8 ? 2 : 3;
    const wave = fin > 0 ? 0.28 * spring(fin - (3 - depth) * 0.1, PRESETS.snap) : 0;
    nodes.push({id: f.id, p: add(f.p, [0, drop + Math.sin(t * 1.5 + f.p[0]) * 0.04, 0]), size: 0.66, appear: a, active: live, done: Math.min(1, dn + wave)});
    labels.push({id: f.id + 'l', p: add(f.p, [0, drop, 0]), text: `fib(${f.n})`, size: 18, color: ICE_TXT, opacity: clamp(a)});
    const vp = pulse(t - op.ret, 0.06, 0.5);
    if (t > op.ret) labels.push({id: f.id + 'v', p: add(f.p, [0, 1.1, 0]), text: String(f.val), size: 30 + vp * 14, color: vp > 0.2 ? AMB : MINT_TXT, opacity: clamp(dn * 1.5), weight: 700});
    if (f.parent) {
      const par = FT.find((x) => x.id === f.parent)!;
      const gr = spring(t - op.call, PRESETS.snap);
      const flow = pulse(t - op.call, 0.05, 0.4);
      edges.push({id: 'e' + f.id, a: par.p, b: f.p, grow: clamp(gr, 0, 1), active: Math.max(live * 0.5, flow * 0.6), done: dn * 0.8});
    }
    // stack slab
    const s0 = op.call, s1 = op.ret;
    const sa = ap(t, s0, PRESETS.heavy) * (1 - spring(t - s1, PRESETS.snap));
    const sy = 0.5 + op.slot * 0.72 + (1 - spring(t - s0, PRESETS.heavy)) * 2.6 + spring(t - s1, PRESETS.snap) * 0.8;
    const top = t >= s0 && t < s1 ? 1 : 0;
    nodes.push({id: 's' + f.id, p: [SLAB_X, sy, 0], size: [3.3, 0.56, 1.7], shape: 'box', appear: sa, active: top * 0.9 * (1 - spring(t - s0 - 0.35, PRESETS.float) * 0.5)});
    if (sa > 0.4) labels.push({id: 's' + f.id + 'l', p: [SLAB_X, sy + 0.02, 0.9], text: `fib(${f.n})`, size: 18, color: ICE_TXT, opacity: clamp(sa)});
  }
  labels.push({id: 'stk', p: [SLAB_X, -0.35, 0.8], text: 'CALL STACK', size: 14, color: '#6f8fb5', opacity: clamp((t - 0.6) * 2)});
  return {nodes, edges, labels};
};

// ───────────────────────── 3 · Min-heap sift-up ─────────────────────────
const HV = [14, 19, 27, 35, 33, 42, 44]; // existing heap, then insert 10
const HP: V3[] = [
  [0, 6.3, 0], [-3.6, 4.7, 0], [3.6, 4.7, 0], [-5.4, 3.1, 0], [-1.8, 3.1, 0], [1.8, 3.1, 0], [5.4, 3.1, 0], [-6.4, 1.5, 0],
];
const arrP = (i: number): V3 => [-5.6 + i * 1.6, 0.5, 4.2];
const H_T = {ins: 1.5, s1: 2.35, s2: 3.0, s3: 3.65, end: 4.35};
const heapLines: [number, number][] = [[0, 0], [0.25, 1], [0.5, 2], [1.35, 10], [H_T.ins + 0.2, 11],
  [H_T.s1 - 0.25, 4], [H_T.s1, 5], [H_T.s1 + 0.2, 6], [H_T.s2 - 0.25, 4], [H_T.s2, 5], [H_T.s2 + 0.2, 6],
  [H_T.s3 - 0.25, 4], [H_T.s3, 5], [H_T.s3 + 0.2, 6], [H_T.end, 12]];
// slots over time for each value: value key -> sequence of slots
const hslot = (v: number, t: number): {slot: number; k: number; dir: number} => {
  // returns current slot (fractional via k) between from/to
  const swaps = [[H_T.s1, 7, 3], [H_T.s2, 3, 1], [H_T.s3, 1, 0]] as const; // time, childSlot, parentSlot
  if (v === 10) {
    let from = 7, to = 7, k = 1, ts = 0;
    for (const [tt, c, p] of swaps) if (t >= tt - 0.0001) { from = c; to = p; k = spring(t - tt, PRESETS.settle); ts = tt; }
    void ts;
    return {slot: from, k: to === from ? 1 : k, dir: to};
  }
  // displaced values move child<-parent
  let cur = HV.indexOf(v), from = cur, to = cur, k = 1;
  for (const [tt, c, p] of swaps) {
    if (cur === p && t >= tt - 0.0001) { from = p; to = c; k = spring(t - tt - 0.04, PRESETS.settle); cur = c; }
  }
  return {slot: from, k: to === from ? 1 : k, dir: to};
};
const heapBuild = (t: number): Built => {
  const nodes: SpecNode[] = [], edges: SpecEdge[] = [], labels: SpecLabel[] = [];
  const all = [...HV, 10];
  const lvl = (s: number) => (s === 0 ? 0 : s < 3 ? 1 : s < 7 ? 2 : 3);
  const mixp = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  all.forEach((v, idx) => {
    const isNew = v === 10;
    const base = isNew ? H_T.ins : 0.1 + lvl(HV.indexOf(v)) * 0.12;
    const a = ap(t, base);
    const {slot, k, dir} = hslot(v, t);
    const swapT = [H_T.s1, H_T.s2, H_T.s3].find((s) => t >= s - 0.001 && t < s + 0.7);
    let pos = mixp(HP[slot], HP[dir], k);
    const arc = Math.sin(Math.PI * clamp(k)) * (isNew ? 1.1 : -1.1);
    pos = add(pos, [0, 0, arc]);
    const drop = isNew ? (1 - spring(t - H_T.ins, PRESETS.heavy)) * 4.5 : (1 - spring(t - base, PRESETS.heavy)) * 3;
    const moving = swapT !== undefined && k < 0.98 ? 1 : 0;
    const fin = t - H_T.end;
    const act = isNew ? clamp(spring(t - H_T.ins) * (1 - (fin > 0 ? spring(fin, PRESETS.snap) : 0))) : moving * 0.6 * Math.sin(Math.PI * clamp(k));
    const done = isNew ? (fin > 0 ? spring(fin, PRESETS.settle) : 0) : 0;
    const p2 = add(pos, [0, drop, 0]);
    nodes.push({id: 'h' + v, p: p2, size: 0.62, appear: a, active: act, done});
    labels.push({id: 'hl' + v, p: p2, text: String(v), size: 28, color: isNew ? '#fff' : ICE_TXT, opacity: clamp(a), weight: 700});
    // array view
    const slotNow = lerp(slot, dir, k);
    const bp: V3 = [arrP(0)[0] + slotNow * 1.6, 0.5 + (isNew ? (1 - spring(t - H_T.ins, PRESETS.heavy)) * 2.6 : 0), 4.2];
    nodes.push({id: 'a' + v, p: bp, size: [1.25, 0.9, 1.25], shape: 'box', appear: ap(t, base + 0.1), active: act, done});
    labels.push({id: 'al' + v, p: add(bp, [0, 0, 0.64]), text: String(v), size: 22, color: ICE_TXT, opacity: clamp(a), weight: 600});
  });
  // edges between slots (tree structure is by slot)
  for (let s = 1; s < 8; s++) {
    const par = (s - 1) >> 1;
    const g = s === 7 ? spring(t - H_T.ins, PRESETS.snap) : spring(t - (0.2 + lvl(s) * 0.12), PRESETS.snap);
    const hot = [[H_T.s1, 7], [H_T.s1, 3], [H_T.s2, 3], [H_T.s2, 1], [H_T.s3, 1]].reduce((m, [tt, ss]) => (ss === s ? Math.max(m, pulse(t - tt + 0.3, 0.06, 0.5)) : m), 0);
    const end = t - H_T.end;
    const mint = (s === 7 || s === 3 || s === 1) && end > 0 ? spring(end - (s === 7 ? 0 : s === 3 ? 0.1 : 0.2), PRESETS.snap) : 0;
    edges.push({id: 'he' + s, a: HP[par], b: HP[s], grow: clamp(g, 0, 1), active: hot, done: mint});
  }
  labels.push({id: 'arrt', p: [0, 0.0, 5.45], text: 'h[ ]', size: 15, color: '#6f8fb5', opacity: clamp((t - 0.6) * 2)});
  return {nodes, edges, labels};
};

// ───────────────────────── 4 · Merge sort ─────────────────────────
const MV = [5, 2, 8, 1, 7, 3, 6, 4];
const MS: number[][][] = [
  [[0, 1, 2, 3, 4, 5, 6, 7]],
  [[0, 1, 2, 3], [4, 5, 6, 7]],
  [[0, 1], [2, 3], [4, 5], [6, 7]],
  [[0], [1], [2], [3], [4], [5], [6], [7]],
  [[1, 0], [3, 2], [5, 4], [7, 6]],
  [[3, 1, 0, 2], [5, 7, 6, 4]],
  [[3, 1, 5, 7, 0, 6, 4, 2]],
];
const MZ = [0, -3.0, -6.0, -9.0, -6.0, -3.0, 0];
const MT = [1.1, 1.55, 2.0, 2.55, 3.05, 3.55]; // transitions s -> s+1
const MEND = 4.1;
const slotPos = (s: number, el: number): V3 => {
  const groups = MS[s];
  const gi = groups.findIndex((g) => g.includes(el));
  const g = groups[gi];
  const j = g.indexOf(el);
  const gw = g.length * 1.45;
  const total = groups.length * (gw + (groups.length > 1 ? 1.1 : 0));
  const cx = -total / 2 + gi * (gw + (groups.length > 1 ? 1.1 : 0)) + gw / 2;
  const x = cx + (j - (g.length - 1) / 2) * 1.45;
  return [x, 0, MZ[s]];
};
const mergeLines: [number, number][] = [[0, 0], [0.25, 1], [0.5, 2], [0.9, 11], [MT[0] - 0.1, 5], [MT[1] - 0.1, 5], [MT[2] - 0.1, 6],
  [MT[3] - 0.15, 7], [MT[4] - 0.15, 7], [MT[5] - 0.15, 7], [MEND + 0.1, 12]];
const mergeBuild = (t: number): Built => {
  const nodes: SpecNode[] = [], edges: SpecEdge[] = [], labels: SpecLabel[] = [];
  MV.forEach((v, el) => {
    const x0 = slotPos(0, el)[0];
    const a = ap(t, 0.1 + stag(el, 0.05));
    // find stage
    let pos = slotPos(0, el);
    let moving = 0, merging = 0;
    for (let s = 0; s < 6; s++) {
      const to = slotPos(s + 1, el), from = slotPos(s, el);
      const k = spring(t - (MT[s] + stag(Math.abs(x0) / 1.45, 0.025)), PRESETS.settle);
      if (t >= MT[s]) {
        pos = [lerp(from[0], to[0], k), 0, lerp(from[2], to[2], k)];
        const lift = Math.sin(Math.PI * clamp(k)) * (s >= 3 ? 0.9 : 0.5);
        pos[1] = lift;
        const m = Math.sin(Math.PI * clamp(k));
        moving = m; if (s >= 3) merging = m;
      }
    }
    const h = v * 0.5 + 0.5;
    const drop = (1 - spring(t - 0.1 - stag(el, 0.05), PRESETS.heavy)) * 3.5;
    const fin = t - MEND;
    const wave = fin > 0 ? spring(fin - stag(pos[0] + 6, 0.06), PRESETS.snap) : 0;
    const act = Math.max(merging * 0.85, moving * 0.25);
    const P: V3 = [pos[0], h / 2 + pos[1] + drop, pos[2]];
    nodes.push({id: 'm' + el, p: P, size: [1.12, h, 1.12], shape: 'box', appear: a, active: act, done: wave});
    labels.push({id: 'ml' + el, p: [P[0], P[1] + h / 2 + 0.55, P[2]], text: String(v), size: 24, color: wave > 0.5 ? MINT_TXT : ICE_TXT, opacity: clamp(a), weight: 700});
  });
  return {nodes, edges, labels};
};

export const HEROES: Hero[] = [
  {
    id: 'dijkstra', file: 'dijkstra.aqvl', anchor: [0, 0, 0], t0: 15.5, dur: 5.1,
    code: [
      'SCENE Dijkstra', 'DECLARE', '  GRAPH town = ["Shop-Park:1", …]', 'SEQUENCE', '  source = VERTEX(town, "Shop")', '  source.dist = 0',
      '  WHILE finished == FALSE', '    u.visited = TRUE', '    LOOP k FROM 0 TO EDGE_COUNT(town) - 1', '      e = EDGE_AT(town, k)',
      '      IF u.dist + e.weight < v.dist', '        v.dist = u.dist + e.weight', '        v.parent = u', '      END', '    END', '  END',
    ],
    lines: dijkLines, ticks: D_RELAX.map((r) => r[1]), build: dijkstraBuild,
    events: [{t: 1.78, p: [-2.3, 1.4, 0], s: 1}, {t: 3.44, p: [4.5, 1.5, 1.5], s: 1}, {t: 4.1, p: [0.3, 1.5, 1.4], s: 0.8}],
  },
  {
    id: 'fib', file: 'fibonacci.aqvl', anchor: [14.5, 0, -4], t0: 20.6, dur: 5.5,
    code: ['SCENE Fibonacci', 'DECLARE', '  FUNCTION fib(n)', '    IF n <= 1', '      RETURN n', '    END', '    RETURN fib(n - 1) + fib(n - 2)', '  END', 'SEQUENCE', '  result = fib(4)', 'END'],
    lines: fibLines, ticks: OPS.map((o) => o.call), build: fibBuild,
    events: [
      {t: OPS[3].call, p: [FT[3].p[0], 1.6, 0], s: 1}, {t: OPS[3].ret, p: [SLAB_X, 3.0, 0], s: 0.8}, {t: F_END, p: [0, 6, 0], s: 1.2},
    ],
  },
  {
    id: 'heap', file: 'minheap.aqvl', anchor: [31, 0, 2], t0: 26.2, dur: 4.9,
    code: ['SCENE MinHeapInsert', 'DECLARE', '  HEAP h = [14, 19, 27, 35, 33, 42, 44]', '  FUNCTION siftUp(start)', '    IF h[child] < h[parent]', '      SWAP h[child] h[parent]', '      child = parent', '    END', '  END', 'SEQUENCE', '  INSERT h 10', '  siftUp(LENGTH(h) - 1)', 'END'],
    lines: heapLines, ticks: [H_T.ins, H_T.s1, H_T.s2, H_T.s3], build: heapBuild,
    events: [{t: H_T.s1, p: [-5.3, 2.4, 0], s: 1}, {t: H_T.s2, p: [-3.6, 3.9, 0], s: 1}, {t: H_T.s3, p: [0, 6.0, 0], s: 1.3}],
  },
  {
    id: 'merge', file: 'mergesort.aqvl', anchor: [47, 0, 0], t0: 31.2, dur: 4.6,
    code: ['SCENE MergeSort', 'DECLARE', '  ARRAY arr = [5, 2, 8, 1, 7, 3, 6, 4]', '  FUNCTION mergeSort(low, high)', '    IF low < high', '      mergeSort(low, mid)', '      mergeSort(mid + 1, high)', '      merge(low, mid, high)', '    END', '  END', 'SEQUENCE', '  mergeSort(0, LENGTH(arr) - 1)', 'END'],
    lines: mergeLines, ticks: MT, build: mergeBuild,
    events: [{t: MT[2], p: [0, 0.5, -6], s: 1}, {t: MT[5], p: [0, 1, 0], s: 1}, {t: MEND, p: [0, 1.2, 0], s: 1.2}],
  },
];
export const WORLD_START = HEROES[0].t0;
export const BREADTH_START = 35.8;

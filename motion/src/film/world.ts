import * as THREE from 'three';
import {Glass, placeLine, Rig} from '../gl/rig';
import {fontFamily} from '../lib/fonts';
import {clamp, HEAVY, SETTLE, SNAP, spring} from '../lib/motion';
import {PEACH, TWILIGHT} from '../lib/palette';
import {HERO} from './camera';
import {DJ_EDGES, DJ_NODES, dijkstra, Ev, fib, FIB_CALLS, heap, HEAP_VALUES, merge, MERGE_VALUES} from './script';

// ---------------------------------------------------------------- helpers
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const texCache = new Map<string, {tex: THREE.Texture; aspect: number}>();
const labelTex = (text: string, color: string, weight = 600) => {
  const key = `${text}|${color}|${weight}`;
  if (texCache.has(key)) return texCache.get(key)!;
  const px = 120;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `${weight} ${px}px ${fontFamily}`;
  const w = Math.ceil(ctx.measureText(text).width + px * 0.4);
  c.width = Math.max(w, px);
  c.height = Math.ceil(px * 1.35);
  ctx.font = `${weight} ${px}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + px * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const v = {tex, aspect: c.width / c.height};
  texCache.set(key, v);
  return v;
};

class Label {
  sprite: THREE.Sprite;
  h: number;
  text = '';
  color = '';
  constructor(h: number) {
    this.h = h;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({transparent: true, depthWrite: false}));
    this.sprite.renderOrder = 20;
    this.sprite.layers.set(3); // labels are never mirrored into the floor
  }
  set(text: string, color: string, opacity: number) {
    if (text !== this.text || color !== this.color) {
      const {tex, aspect} = labelTex(text, color);
      this.sprite.material.map = tex;
      this.sprite.material.needsUpdate = true;
      this.sprite.scale.set(this.h * aspect, this.h, 1);
      this.text = text;
      this.color = color;
    }
    this.sprite.material.opacity = opacity;
    this.sprite.visible = opacity > 0.01 && text !== '';
  }
}

// keyed vector motion: each key springs from the previous resting point,
// with an optional arc lift while traveling
type PKey = {t: number; p: THREE.Vector3; lift?: number; preset?: typeof SNAP};
const posAt = (keys: PKey[], t: number, out = new THREE.Vector3()) => {
  out.copy(keys[0].p);
  let lift = 0;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t < k.t) break;
    const u = spring(t - k.t, k.preset ?? SNAP);
    out.x += (k.p.x - keys[i - 1].p.x) * u;
    out.y += (k.p.y - keys[i - 1].p.y) * u;
    out.z += (k.p.z - keys[i - 1].p.z) * u;
    if (k.lift) lift += Math.sin(Math.PI * clamp(u)) * k.lift;
  }
  out.y += lift;
  return out;
};

// soft activation pulse inside [a, b]
const pulse = (t: number, a: number, b: number, attack = 0.05, release = 0.14) =>
  t < a || t > b + release ? 0 : Math.min(clamp((t - a) / attack), clamp((b + release - t) / release));

const enterScale = (t: number, t0: number) => Math.max(0, spring(t - t0, SNAP));
const exitScale = (t: number, t0: number) => Math.max(0, 1 - spring(t - t0, SNAP));

export type Focus = {pos: THREE.Vector3; at: number} | null;

// ---------------------------------------------------------------- bursts
class Bursts {
  sprites: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  rings: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  list: {t: number; pos: THREE.Vector3; s: number}[] = [];
  until = Infinity; // bursts fade out before a hero's clean exit completes
  rig: Rig;
  constructor(rig: Rig) {
    this.rig = rig;
    for (let i = 0; i < 8; i++) {
      const b = rig.burst();
      rig.world.add(b);
      this.sprites.push(b);
      const r = rig.ring();
      rig.world.add(r);
      this.rings.push(r);
    }
  }
  begin() {
    this.list = [];
  }
  add(t: number, te: number, pos: THREE.Vector3, s = 1) {
    const cut = clamp((this.until - t) / 0.3);
    if (t >= te && t - te < 1.4 && cut > 0) this.list.push({t: t - te, pos: pos.clone(), s: s * cut});
  }
  commit() {
    const env = (a: number) => (1 - Math.exp(-a * 45)) * Math.exp(-a * 4.2);
    const sorted = this.list.sort((a, b) => env(b.t) * b.s - env(a.t) * a.s);
    this.sprites.forEach((sp, i) => {
      const b = sorted[i];
      const ring = this.rings[i];
      if (!b) {
        sp.visible = false;
        ring.visible = false;
        return;
      }
      sp.visible = true;
      sp.position.copy(b.pos);
      sp.scale.setScalar((1.1 + b.t * 1.6) * b.s);
      sp.material.uniforms.uI.value = env(b.t) * 0.9;
      sp.material.uniforms.uR.value = clamp(b.t * 1.8);
      ring.visible = true;
      ring.position.set(b.pos.x, 0.012, b.pos.z);
      const rr = (0.8 + b.t * 5) * b.s;
      ring.scale.set(rr, 1, rr);
      ring.material.uniforms.uI.value = env(b.t) * 0.8;
      ring.material.uniforms.uR.value = clamp(0.35 + b.t * 0.5);
    });
    this.rig.setBursts(sorted.slice(0, 4).map((b) => ({pos: b.pos, i: env(b.t) * 2.2 * b.s})));
  }
}

// ---------------------------------------------------------------- heroes
type Ctx = {t: number; cam: THREE.Camera; bursts: Bursts};

const faceCam = (label: Label, center: THREE.Vector3, cam: THREE.Camera, r: number, up = 0) => {
  const d = cam.position.clone().sub(center).normalize();
  label.sprite.position.copy(center).addScaledVector(d, r).add(V(0, up, 0));
};

const evOf = (h: {events: Ev[]}, kind: string) => h.events.filter((e) => e.kind === kind);
const exitT = (h: {events: Ev[]}) => evOf(h, 'exit')[0].t;

// ---- 1. MinHeap
class HeapHero {
  exitAt = exitT(heap);
  nodes: Glass[] = [];
  labels: Label[] = [];
  edges: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  keys: PKey[][] = [];
  slotTimeline: {t: number; slots: number[]}[] = [];
  constructor(rig: Rig) {
    const c = HERO.heap;
    const arrayPos = (i: number) => V(c.x + (i - 4) * 1.2, 0.56, c.z + 1.2);
    const level = (s: number) => Math.floor(Math.log2(s + 1));
    const treePos = (s: number) => {
      const L = level(s);
      const p = s - (2 ** L - 1);
      return V(c.x + ((p + 0.5) / 2 ** L - 0.5) * 9.0, 0.56 + (3 - L) * 1.38, c.z - L * 0.35);
    };
    this.treePos = treePos;
    this.level = level;
    const morph = evOf(heap, 'morph')[0].t;
    HEAP_VALUES.forEach((v, id) => {
      const m = rig.glassBox(0.96, 0.96, 0.96, 0.14);
      rig.world.add(m);
      this.nodes.push(m);
      const l = new Label(0.42);
      rig.world.add(l.sprite);
      this.labels.push(l);
      this.keys.push([
        {t: heap.t0, p: arrayPos(id)},
        {t: morph + id * 0.045, p: treePos(id), preset: HEAVY, lift: 0.3},
      ]);
    });
    // swaps
    let slots = HEAP_VALUES.map((_, i) => i); // slots[slot] = id
    this.slotTimeline.push({t: -1, slots: [...slots]});
    for (const e of heap.events.filter((e) => e.kind === 'swap')) {
      const ia = slots[e.a!];
      const ib = slots[e.b!];
      this.keys[ia].push({t: e.t, p: treePos(e.b!), lift: 0.7});
      this.keys[ib].push({t: e.t, p: treePos(e.a!), lift: 0.7});
      slots = [...slots];
      slots[e.a!] = ib;
      slots[e.b!] = ia;
      this.slotTimeline.push({t: e.t, slots: [...slots]});
    }
    for (let s = 1; s < 9; s++) {
      const e = rig.line();
      rig.world.add(e);
      this.edges.push(e);
    }
  }
  treePos: (s: number) => THREE.Vector3;
  level: (s: number) => number;
  slotsAt(t: number) {
    let cur = this.slotTimeline[0].slots;
    for (const s of this.slotTimeline) if (t >= s.t) cur = s.slots;
    return cur;
  }
  update({t, cam, bursts}: Ctx): Focus {
    const vis = t >= heap.t0 - 0.01 && t < heap.t1;
    const ex = exitT(heap);
    const succ = evOf(heap, 'success')[0].t;
    const morph = evOf(heap, 'morph')[0].t;
    const slots = this.slotsAt(t);
    const slotOf = (id: number) => slots.indexOf(id);
    let focus: Focus = null;
    this.nodes.forEach((m, id) => {
      const s = slotOf(id);
      const sc = enterScale(t, heap.t0 + id * 0.05) * exitScale(t, ex + this.level(s) * 0.07 + (s % 4) * 0.02);
      m.visible = vis && sc > 0.001;
      const p = posAt(this.keys[id], t, m.position);
      m.scale.setScalar(Math.max(sc, 0.0001));
      // settle wobble: a slight squash on landing after a swap
      let act = 0;
      let hot = 0;
      for (const e of heap.events) {
        if (e.kind === 'mark' && slotOf(id) === e.a && t < e.t + 0.6) act = Math.max(act, pulse(t, e.t, e.t + 0.3) * 0.85);
        if (e.kind === 'compare' && (e.a === s || e.b === s)) act = Math.max(act, pulse(t, e.t, e.t + 0.15) * 0.6);
        if (e.kind === 'swap') {
          const sl = this.slotsAt(e.t - 0.001);
          if (sl[e.a!] === id || sl[e.b!] === id) {
            act = Math.max(act, pulse(t, e.t - 0.04, e.t + 0.3));
            hot = Math.max(hot, pulse(t, e.t, e.t + 0.08, 0.02, 0.3));
          }
        }
      }
      m.u.uActive.value = act;
      m.u.uHot.value = hot;
      m.u.uDone.value = clamp(spring(t - succ - this.level(s) * 0.08, SETTLE));
      const lab = this.labels[id];
      lab.set(String(HEAP_VALUES[id]), act > 0.5 ? TWILIGHT : PEACH, m.visible ? clamp(sc) : 0);
      faceCam(lab, p, cam, 0.84 * sc + 0.02);
      lab.sprite.scale.multiplyScalar(1);
    });
    // edges draw on after the morph, retract before the exit
    this.edges.forEach((e, k) => {
      const s = k + 1;
      const par = Math.floor((s - 1) / 2);
      const a = this.nodes[slots[par]].position;
      const b = this.nodes[slots[s]].position;
      const dir = b.clone().sub(a).normalize();
      const pa = a.clone().addScaledVector(dir, 0.55);
      const pb = b.clone().addScaledVector(dir, -0.55);
      const on = clamp(spring(t - (morph + 0.55 + this.level(s) * 0.09), SETTLE)) * (1 - clamp(spring(t - (ex - 0.06 + this.level(s) * 0.03), SNAP)));
      placeLine(e, pa, pb, 0.024, vis ? on : 0);
      e.material.uniforms.uDone.value = clamp(spring(t - succ - this.level(s) * 0.08, SETTLE));
      e.material.uniforms.uActive.value = 0;
    });
    // bursts and focus
    for (const e of heap.events) {
      if (e.kind === 'swap') {
        const top = this.treePos(Math.min(e.a!, e.b!));
        bursts.add(t, e.t + 0.12, top, 0.9);
        if (t >= e.t - 0.1) focus = {pos: top, at: e.t};
      }
      if (e.kind === 'mark' && t >= e.t) focus = {pos: this.treePos(e.a!), at: e.t};
      if (e.kind === 'success') {
        bursts.add(t, e.t, this.treePos(0), 1.5);
        if (t >= e.t) focus = {pos: this.treePos(0), at: e.t};
      }
      if (e.kind === 'enter' || e.kind === 'morph') if (t >= e.t && !focus) focus = {pos: V(HERO.heap.x, 1.6, HERO.heap.z), at: e.t};
    }
    return vis ? focus : null;
  }
}

// ---- 2. MergeSort
const GROUPS: number[][][] = [
  [[0, 1, 2, 3, 4, 5, 6]],
  [
    [0, 1, 2, 3],
    [4, 5, 6],
  ],
  [[0, 1], [2, 3], [4, 5], [6]],
  [[0], [1], [2], [3], [4], [5], [6]],
];
const groupIdx = (L: number, k: number) => GROUPS[L].findIndex((g) => g.includes(k));
const sortedOrder = (L: number) => GROUPS[L].flatMap((g) => g.map((k) => MERGE_VALUES[k]).sort((a, b) => a - b));

class MergeHero {
  exitAt = exitT(merge);
  nodes: Glass[] = [];
  labels: Label[] = [];
  keys: PKey[][] = [];
  hgt: number[] = [];
  placeT: number[][] = []; // [level][slot] time of placement
  slotPos: (L: number, k: number, id: number) => THREE.Vector3;
  constructor(rig: Rig) {
    const c = HERO.merge;
    const slotX = (L: number, k: number) => {
      let x = (k - 3) * 0.85;
      for (let l = 1; l <= L; l++) x += (groupIdx(l, k) - (GROUPS[l].length - 1) / 2) * 0.28;
      return c.x + x;
    };
    MERGE_VALUES.forEach((v) => this.hgt.push(0.4 + (v / 82) * 2.4));
    this.slotPos = (L, k, id) => V(slotX(L, k), this.hgt[id] / 2, c.z - 2.0 + L * 1.45);
    MERGE_VALUES.forEach((v, id) => {
      const m = rig.glassBox(0.7, this.hgt[id], 0.7, 0.09);
      rig.world.add(m);
      this.nodes.push(m);
      const l = new Label(0.34);
      rig.world.add(l.sprite);
      this.labels.push(l);
      const keys: PKey[] = [{t: merge.t0, p: this.slotPos(0, id, id)}];
      for (const e of evOf(merge, 'split')) keys.push({t: e.t + id * 0.03, p: this.slotPos(e.v!, id, id), preset: SETTLE});
      this.keys.push(keys);
    });
    // merges: in each round, the k-th placement takes the k-th smallest
    // value of its group into slot k of the level above
    const used: Record<number, boolean>[] = [{}, {}, {}];
    for (const e of evOf(merge, 'place')) {
      const L = e.v!;
      const val = sortedOrder(L)[e.a!];
      const id = MERGE_VALUES.findIndex((x, i) => x === val && !used[L][i]);
      used[L][id] = true;
      this.keys[id].push({t: e.t, p: this.slotPos(L, e.a!, id), lift: 0.6});
      (this.placeT[L] ??= [])[id] = e.t;
    }
  }
  update({t, cam, bursts}: Ctx): Focus {
    const vis = t >= merge.t0 - 0.01 && t < merge.t1;
    const ex = exitT(merge);
    const succ = evOf(merge, 'success')[0].t;
    let focus: Focus = null;
    this.nodes.forEach((m, id) => {
      const p = posAt(this.keys[id], t, m.position);
      const finalX = this.slotPos(0, sortedOrder(0).indexOf(MERGE_VALUES[id]), id).x;
      const sc = enterScale(t, merge.t0 + id * 0.05) * exitScale(t, ex + Math.abs(finalX - this.slotPos(0, 6, 0).x) * 0.05);
      m.visible = vis && sc > 0.001;
      m.scale.setScalar(Math.max(sc, 0.0001));
      let act = 0;
      for (let L = 0; L < 3; L++) {
        const pt = this.placeT[L]?.[id];
        if (pt !== undefined) act = Math.max(act, pulse(t, pt - 0.04, pt + 0.16));
      }
      m.u.uActive.value = act;
      m.u.uHot.value = act * 0.4;
      m.u.uDone.value = clamp(spring(t - succ - Math.abs(finalX - this.slotPos(0, 0, 0).x) * 0.04, SETTLE));
      const lab = this.labels[id];
      lab.set(String(MERGE_VALUES[id]), PEACH, m.visible ? clamp(sc) : 0);
      lab.sprite.position.set(p.x, p.y + (this.hgt[id] / 2) * sc + 0.3, p.z);
    });
    for (const e of evOf(merge, 'place')) {
      const L = e.v!;
      const id = this.placeT[L].findIndex((x) => x === e.t);
      const pos = this.slotPos(L, e.a!, id).clone();
      pos.y = this.hgt[id] + 0.1;
      bursts.add(t, e.t + 0.1, pos, L === 0 ? 0.9 : 0.6);
      if (t >= e.t - 0.05) focus = {pos, at: e.t};
    }
    if (t >= succ) {
      bursts.add(t, succ, this.slotPos(0, 3, 3).setY(1.4), 1.3);
      focus = {pos: this.slotPos(0, 3, 3).setY(1.0), at: succ};
    }
    if (!focus && t >= merge.t0) focus = {pos: V(HERO.merge.x, 1, HERO.merge.z), at: merge.t0};
    return vis ? focus : null;
  }
}

// ---- 3. Dijkstra
const DJ_POS = [V(-4.2, 0, 1.2), V(-1.6, 0, -1.9), V(-1.0, 0, 2.3), V(1.9, 0, 1.0), V(2.0, 0, -2.3), V(4.5, 0, -0.3)];
const HOPS_FROM_HOME = [3, 2, 2, 1, 1, 0];
const HOPS_FROM_SHOP = [0, 1, 1, 2, 2, 3];
class DijkstraHero {
  exitAt = exitT(dijkstra);
  nodes: Glass[] = [];
  labels: Label[] = [];
  names: Label[] = [];
  edges: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  wlabels: Label[] = [];
  pos: THREE.Vector3[];
  constructor(rig: Rig) {
    const c = HERO.dijkstra;
    this.pos = DJ_POS.map((p) => p.clone().add(c).setY(0.5));
    DJ_NODES.forEach(() => {
      const m = rig.glassSphere();
      rig.world.add(m);
      this.nodes.push(m);
      const l = new Label(0.4);
      rig.world.add(l.sprite);
      this.labels.push(l);
    });
    DJ_EDGES.forEach(() => {
      const e = rig.line();
      rig.world.add(e);
      this.edges.push(e);
      const w = new Label(0.26);
      rig.world.add(w.sprite);
      this.wlabels.push(w);
    });
  }
  update({t, cam, bursts}: Ctx): Focus {
    const h = dijkstra;
    const vis = t >= h.t0 - 0.01 && t < h.t1;
    const ex = exitT(h);
    let focus: Focus = null;
    const visitT = DJ_NODES.map((_, i) => evOf(h, 'visit').find((e) => e.a === i)!.t);
    // dist labels over time
    const dist: string[] = DJ_NODES.map(() => '');
    const src = evOf(h, 'source')[0];
    if (t >= src.t) DJ_NODES.forEach((_, i) => (dist[i] = i === 0 ? '0' : '∞'));
    const relax = evOf(h, 'relax');
    for (const e of relax) if (t >= e.t + 0.18) dist[e.b!] = String(e.v);
    const pathEdges = evOf(h, 'path');
    this.nodes.forEach((m, i) => {
      const sc = enterScale(t, h.t0 + HOPS_FROM_SHOP[i] * 0.09) * exitScale(t, ex + HOPS_FROM_HOME[i] * 0.07);
      m.visible = vis && sc > 0.001;
      m.position.copy(this.pos[i]);
      m.scale.setScalar(Math.max(sc * 0.86, 0.0001));
      let act = pulse(t, visitT[i], visitT[i] + 0.32);
      for (const e of relax) if (e.b === i) act = Math.max(act, pulse(t, e.t + 0.16, e.t + 0.3) * 0.9);
      for (const e of pathEdges) if (e.a === i || (e.b === i && e.b === 0)) act = Math.max(act, pulse(t, e.t, e.t + 0.2));
      m.u.uActive.value = act;
      m.u.uHot.value = pulse(t, visitT[i], visitT[i] + 0.05, 0.02, 0.25);
      m.u.uDone.value = clamp(spring(t - visitT[i] - 0.35, SETTLE));
      const lab = this.labels[i];
      lab.set(dist[i], act > 0.5 ? TWILIGHT : PEACH, m.visible ? clamp(sc) : 0);
      faceCam(lab, this.pos[i], cam, 0.45 * sc);
    });
    this.edges.forEach((e, k) => {
      const [a, b, w] = DJ_EDGES[k];
      const A = this.pos[a];
      const B = this.pos[b];
      const dir = B.clone().sub(A).normalize();
      const pa = A.clone().addScaledVector(dir, 0.45);
      const pb = B.clone().addScaledVector(dir, -0.45);
      const hop = Math.min(HOPS_FROM_SHOP[a], HOPS_FROM_SHOP[b]);
      const hopH = Math.min(HOPS_FROM_HOME[a], HOPS_FROM_HOME[b]);
      const on = clamp(spring(t - (h.t0 + 0.35 + hop * 0.1 + k * 0.02), SETTLE)) * (1 - clamp(spring(t - (ex - 0.05 + hopH * 0.06), SNAP)));
      placeLine(e, pa, pb, 0.022, vis ? on : 0);
      let act = 0;
      for (const r of [...relax, ...evOf(h, 'reject')]) if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) act = Math.max(act, pulse(t, r.t, r.t + 0.2) * (r.kind === 'reject' ? 0.4 : 1));
      let done = 0;
      for (const p of pathEdges) if ((p.a === a && p.b === b) || (p.a === b && p.b === a)) {
        act = Math.max(act, pulse(t, p.t, p.t + 0.15));
        done = clamp(spring(t - p.t - 0.1, SETTLE));
      }
      e.material.uniforms.uActive.value = act;
      e.material.uniforms.uDone.value = done;
      const wl = this.wlabels[k];
      wl.set(String(w), '#a79fb4', vis ? on * 0.85 : 0);
      wl.sprite.position.copy(pa).lerp(pb, 0.5).add(V(0, 0.2, 0));
    });
    // relax pulses: a neon bead travels the edge, bursts at arrival
    for (const e of relax) {
      const A = this.pos[e.a!];
      const B = this.pos[e.b!];
      const u = clamp((t - e.t) / 0.18);
      if (t >= e.t && t < e.t + 0.18) bursts.add(t, t - 0.06, A.clone().lerp(B, u), 0.35);
      bursts.add(t, e.t + 0.18, B, 0.75);
      if (t >= e.t) focus = {pos: B, at: e.t};
    }
    for (const e of evOf(h, 'visit')) {
      bursts.add(t, e.t, this.pos[e.a!], 1.0);
      if (t >= e.t && (!focus || focus.at < e.t)) focus = {pos: this.pos[e.a!], at: e.t};
    }
    for (const p of pathEdges) {
      bursts.add(t, p.t, this.pos[p.b!], 0.9);
      if (t >= p.t) focus = {pos: this.pos[p.b!], at: p.t};
    }
    if (!focus && t >= h.t0) focus = {pos: V(HERO.dijkstra.x, 0.5, HERO.dijkstra.z), at: h.t0};
    return vis ? focus : null;
  }
}

// ---- 4. Fibonacci call stack + call tree
class FibHero {
  exitAt = exitT(fib);
  slabs: Glass[] = [];
  slabLabels: Label[] = [];
  tnodes: Glass[] = [];
  tlabels: Label[] = [];
  tedges: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  tpos: THREE.Vector3[] = [];
  base: Glass;
  constructor(rig: Rig) {
    const c = HERO.fib;
    // leaf order for tree layout
    let leaf = 0;
    const xs: number[] = [];
    const place = (id: number): number => {
      const kids = FIB_CALLS.filter((k) => k.parent === id);
      if (kids.length === 0) return (xs[id] = leaf++);
      const v = kids.map((k) => place(k.id));
      return (xs[id] = v.reduce((a, b) => a + b, 0) / v.length);
    };
    place(0);
    FIB_CALLS.forEach((call) => {
      const s = rig.glassBox(2.3, 0.42, 1.3, 0.09);
      rig.world.add(s);
      this.slabs.push(s);
      const l = new Label(0.3);
      rig.world.add(l.sprite);
      this.slabLabels.push(l);
      const n = rig.glassSphere();
      rig.world.add(n);
      this.tnodes.push(n);
      const tl = new Label(0.32);
      rig.world.add(tl.sprite);
      this.tlabels.push(tl);
      this.tpos.push(V(c.x + 1.0 + xs[call.id] * 1.0, 4.3 - call.depth * 1.05, c.z - 0.4));
      const e = rig.line();
      rig.world.add(e);
      this.tedges.push(e);
    });
    this.base = rig.glassBox(2.6, 0.08, 1.6, 0.03);
    rig.world.add(this.base);
  }
  update({t, cam, bursts}: Ctx): Focus {
    const h = fib;
    const vis = t >= h.t0 - 0.01 && t < h.t1;
    const ex = exitT(h);
    const succ = evOf(h, 'success')[0].t;
    const c = HERO.fib;
    const sx = c.x - 2.1;
    let focus: Focus = null;
    const bs = enterScale(t, h.t0) * exitScale(t, ex + 0.3);
    this.base.visible = vis && bs > 0.001;
    this.base.scale.setScalar(Math.max(bs, 0.0001));
    this.base.position.set(sx, 0.04, c.z);
    FIB_CALLS.forEach((call, i) => {
      // stack frame: drops in on PUSH, flashes and leaves on POP
      const slot = V(sx, 0.36 + call.depth * 0.5, c.z);
      const s = this.slabs[i];
      const inT = spring(t - call.push, HEAVY);
      const outU = clamp(spring(t - call.pop - 0.07, SNAP));
      const alive = t >= call.push && outU < 0.999;
      s.visible = vis && alive;
      s.position.copy(slot).add(V(0, (1 - inT) * 2.6 + outU * 0.5, 0));
      const sc = Math.max(0.0001, Math.min(1, t >= call.push ? clamp(inT * 3) : 0) * (1 - outU));
      s.scale.setScalar(sc);
      const top = pulse(t, call.push, call.push + 0.1, 0.03, 0.12);
      const pop = pulse(t, call.pop - 0.03, call.pop + 0.08, 0.03, 0.1);
      s.u.uActive.value = Math.max(top * 0.7, pop);
      s.u.uHot.value = pop;
      const sl = this.slabLabels[i];
      sl.set(`fib(${call.n})`, pop > 0.5 ? TWILIGHT : PEACH, s.visible ? sc : 0);
      faceCam(sl, s.position, cam, 0.7 * sc);
      // call tree node
      const n = this.tnodes[i];
      const ts = enterScale(t, call.push) * exitScale(t, ex + call.depth * 0.07);
      n.visible = vis && ts > 0.001;
      n.position.copy(this.tpos[i]);
      n.scale.setScalar(Math.max(ts * 0.62, 0.0001));
      n.u.uActive.value = Math.max(top, pop, i === 0 ? pulse(t, succ, succ + 0.3) : 0);
      n.u.uHot.value = pop;
      n.u.uDone.value = clamp(spring(t - call.pop - 0.1, SETTLE));
      const tl = this.tlabels[i];
      tl.set(t >= call.pop ? String(call.ret) : String(call.n), n.u.uActive.value > 0.5 ? TWILIGHT : PEACH, n.visible ? clamp(ts) : 0);
      faceCam(tl, this.tpos[i], cam, 0.34 * ts);
      const e = this.tedges[i];
      if (call.parent >= 0) {
        const A = this.tpos[call.parent];
        const B = this.tpos[i];
        const dir = B.clone().sub(A).normalize();
        const on = clamp(spring(t - call.push, SETTLE)) * (1 - clamp(spring(t - (ex - 0.04 + call.depth * 0.05), SNAP)));
        placeLine(e, A.clone().addScaledVector(dir, 0.33), B.clone().addScaledVector(dir, -0.33), 0.02, vis ? on : 0);
        e.material.uniforms.uDone.value = n.u.uDone.value;
        e.material.uniforms.uActive.value = pop;
      } else e.visible = false;
      bursts.add(t, call.pop, slot, 0.8);
      if (t >= call.push) focus = {pos: slot, at: call.push};
      if (t >= call.pop && (!focus || focus.at <= call.pop)) focus = {pos: slot, at: call.pop};
    });
    if (t >= succ) {
      bursts.add(t, succ, this.tpos[0], 1.5);
      focus = {pos: this.tpos[0], at: succ};
    }
    if (!focus && t >= h.t0) focus = {pos: V(sx, 0.5, c.z), at: h.t0};
    return vis ? focus : null;
  }
}

// ---------------------------------------------------------------- world
export class World {
  rig!: Rig;
  bursts!: Bursts;
  heroes!: {update: (c: Ctx) => Focus; exitAt: number}[];
  build(rig: Rig) {
    this.rig = rig;
    this.bursts = new Bursts(rig);
    this.heroes = [new HeapHero(rig), new MergeHero(rig), new DijkstraHero(rig), new FibHero(rig)];
  }
  setVisible(v: boolean) {
    this.rig.world.visible = v;
    this.rig.floor.visible = v;
  }
  update(t: number, cam: THREE.Camera): Focus {
    this.bursts.begin();
    let focus: Focus = null;
    for (const h of this.heroes) {
      this.bursts.until = h.exitAt + 0.25;
      const f = h.update({t, cam, bursts: this.bursts});
      if (f) focus = f;
    }
    this.bursts.commit();
    return focus;
  }
}

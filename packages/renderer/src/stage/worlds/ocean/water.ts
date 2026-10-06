import type { RestFrame, StageModel } from '../../model/StageModel';
import { clamp01, smoothstep } from '../../motion/spring';
import { isOcean } from '../types';

/**
 * Water physics for the ocean world. Nothing slides and nothing hops: a
 * block that has to move is nudged off the seabed by a whale (or her calf),
 * rises on its own buoyancy, is steered through the water nose-first, and
 * then let go, after which water drag slows it to a stop and it sinks (or
 * floats) the last bit into its place, bobbing once as it settles.
 *
 * Like the rest of the stage every motion here is a pure function of the
 * step's fraction `f` (0..1): scrubbing in any order shows the same picture.
 *
 * A Haul is one node's trip in one step: a smooth path through the water (a
 * cubic Bézier, so it lifts off vertically, crosses, and sinks in
 * vertically), a speed profile along it (pushed, then drifting against
 * drag), and which swimmer (0 the whale, 1 the calf, -1 nobody: the node is
 * carried by the wake) is in contact with it while it is pushed. The
 * node's motion is the single source of truth: the swimmer's nose is placed
 * on the node (pod.ts), never the other way round.
 */

/** Water drag: after release a node's speed falls like exp(-WATER_DRAG * x) over the drift (x: fraction of the drift). */
export const WATER_DRAG = 3.6;
/** Clearance kept between a node in transit and anything it passes over. */
const CLEAR = 0.5;
/** Vertical distance between the whale's (high) lane and the calf's (low) lane when both carry at once. */
const LANE_GAP = 1.45;
/** Nodes this close to the seabed rest on it (they settle into the sand rather than bob in open water). */
const GROUND_CLEARANCE = 0.55;

export type HaulKind = 'carry' | 'birth' | 'farewell' | 'drift';

export interface Haul {
  slot: number;
  /** 0: the whale pushes it, 1: the calf, -1: nobody (it moves on the wake). */
  who: number;
  kind: HaulKind;
  /** Cubic Bézier control points: p0, c1, c2, p3 (x, y, z each). */
  ctrl: Float64Array;
  /** Cumulative arc length at LUT_N + 1 evenly spaced parameters, and the total. */
  lut: Float64Array;
  len: number;
  /** Step fractions: the swimmer touches it (t0), lets go (t1), and it comes to rest at the end of its path (t2). */
  t0: number;
  t1: number;
  t2: number;
  /** Grows from a bubble (a new node) or dissolves into bubbles (a removed one) over these fractions. */
  grow?: [number, number];
  fade?: [number, number];
  /** True when it ends resting on the seabed (it touches down with a puff of silt instead of bobbing). */
  landsOnFloor: boolean;
  /** True when it starts on the seabed (it lifts off with a puff of silt). */
  liftsOffFloor: boolean;
  /** Height of the settle bob. */
  bob: number;
  /** Half the node's size (x, y, z). */
  half: [number, number, number];
}

/** A gentle bump of the nose against a node (a write, a link): no trip, a little give and back. */
export interface Tap {
  slot: number;
  who: number;
  /** Step fraction of the bump, and the direction the node gives (unit, away from the nose). */
  at: number;
  dx: number;
  dy: number;
  dz: number;
  /** On the seabed: it gives sideways only (it cannot be pressed into the sand). */
  grounded: boolean;
}

export interface WaterMotion {
  k: number;
  hauls: Haul[];
  taps: Tap[];
  bySlot: Map<number, Haul>;
  tapBySlot: Map<number, Tap>;
}

const LUT_N = 40;

// ── The speed profile ──────────────────────────────────────────────────────

/**
 * Fraction of a path covered at step fraction f. While pushed ([t0, t1]) the
 * node picks up speed the way a body does in water (fast at first, then
 * levelling off as drag balances the push); once let go ([t1, t2]) its speed
 * falls exponentially with drag. The two halves meet at equal speed.
 */
export function driftProgress(f: number, t0: number, t1: number, t2: number, drag = WATER_DRAG): number {
  if (f <= t0) return 0;
  if (f >= t2) return 1;
  const push = Math.max(1e-4, t1 - t0);
  const glide = Math.max(1e-4, t2 - t1);
  const norm = 1 - Math.exp(-drag);
  // Push: g(u) = u^2 (1.5 - 0.5 u), so g(1) = 1 and g'(1) = 1.5.
  const share = 1 / (1 + (1.5 * norm * glide) / (drag * push));
  if (f <= t1) {
    const u = (f - t0) / push;
    return share * u * u * (1.5 - 0.5 * u);
  }
  const x = (f - t1) / glide;
  return share + (1 - share) * ((1 - Math.exp(-drag * x)) / norm);
}

/** The release time that makes the push cover `share` of the path (the rest is drift). */
function releaseFor(t0: number, t2: number, share: number, drag = WATER_DRAG): number {
  const norm = 1 - Math.exp(-drag);
  const c = (1.5 * norm) / drag;
  const q = (1 / share - 1) / c; // glide / push
  return t0 + (t2 - t0) / (1 + q);
}

// ── Paths ──────────────────────────────────────────────────────────────────

function bezierAt(c: Float64Array, t: number, out: { x: number; y: number; z: number }): void {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  out.x = a * c[0] + b * c[3] + d * c[6] + e * c[9];
  out.y = a * c[1] + b * c[4] + d * c[7] + e * c[10];
  out.z = a * c[2] + b * c[5] + d * c[8] + e * c[11];
}

function bezierTangent(c: Float64Array, t: number, out: { x: number; y: number; z: number }): void {
  const u = 1 - t;
  const a = 3 * u * u, b = 6 * u * t, d = 3 * t * t;
  out.x = a * (c[3] - c[0]) + b * (c[6] - c[3]) + d * (c[9] - c[6]);
  out.y = a * (c[4] - c[1]) + b * (c[7] - c[4]) + d * (c[10] - c[7]);
  out.z = a * (c[5] - c[2]) + b * (c[8] - c[5]) + d * (c[11] - c[8]);
}

const _pt = { x: 0, y: 0, z: 0 };

function makePath(p0: number[], c1: number[], c2: number[], p3: number[]): { ctrl: Float64Array; lut: Float64Array; len: number } {
  const ctrl = new Float64Array([...p0, ...c1, ...c2, ...p3]);
  const lut = new Float64Array(LUT_N + 1);
  let px = p0[0], py = p0[1], pz = p0[2];
  for (let i = 1; i <= LUT_N; i++) {
    bezierAt(ctrl, i / LUT_N, _pt);
    lut[i] = lut[i - 1] + Math.hypot(_pt.x - px, _pt.y - py, _pt.z - pz);
    px = _pt.x;
    py = _pt.y;
    pz = _pt.z;
  }
  return { ctrl, lut, len: lut[LUT_N] };
}

/** Bézier parameter at a fraction s of the arc length. */
function paramAt(h: Haul, s: number): number {
  if (h.len < 1e-6) return clamp01(s);
  const target = clamp01(s) * h.len;
  let lo = 0, hi = LUT_N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h.lut[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = h.lut[hi] - h.lut[lo];
  const w = span > 1e-9 ? (target - h.lut[lo]) / span : 0;
  return (lo + w) / LUT_N;
}

export interface HaulPose {
  x: number;
  y: number;
  z: number;
  /** Unit direction of travel (the path's tangent), and the speed in units per step fraction. */
  tx: number;
  ty: number;
  tz: number;
  speed: number;
  /** 0..1 of the path covered. */
  s: number;
  /** Rotation about the view axis: a node pushed through water leans against the drag, and rocks as it settles. */
  lean: number;
  presence: number;
}

const _tan = { x: 0, y: 0, z: 0 };

/** Where a hauled node is at step fraction f. */
export function haulAt(h: Haul, f: number, out: HaulPose): void {
  const s = driftProgress(f, h.t0, h.t1, h.t2);
  const t = paramAt(h, s);
  bezierAt(h.ctrl, t, _pt);
  bezierTangent(h.ctrl, t, _tan);
  const tl = Math.hypot(_tan.x, _tan.y, _tan.z) || 1;
  out.x = _pt.x;
  out.y = _pt.y;
  out.z = _pt.z;
  out.tx = _tan.x / tl;
  out.ty = _tan.y / tl;
  out.tz = _tan.z / tl;
  out.s = s;
  const e = 0.004;
  out.speed = ((driftProgress(f + e, h.t0, h.t1, h.t2) - driftProgress(f - e, h.t0, h.t1, h.t2)) / (2 * e)) * h.len;
  // Leaning back against the water while it is moved, rocking gently once it is still.
  const maxSpeed = Math.max(1e-3, h.len * 2.4);
  out.lean = -0.08 * out.tx * Math.min(1, out.speed / maxSpeed);
  // The settle: let go above its place, it dips (or touches down on the sand), bobs once, and is still by the end of the step.
  if (f > h.t2 && h.t2 < 1) {
    const q = (f - h.t2) / (1 - h.t2);
    const wave = Math.sin(q * Math.PI * 2.2) * Math.exp(-q * 3.4) * (1 - smoothstep(0.82, 1, q));
    out.y += h.landsOnFloor ? Math.abs(wave) * h.bob * 0.55 : -wave * h.bob;
    out.lean += 0.05 * Math.sin(q * Math.PI * 3) * Math.exp(-q * 4) * (1 - smoothstep(0.85, 1, q)) * (h.ctrl[9] >= h.ctrl[0] ? 1 : -1);
  }
  let p = 1;
  if (h.grow) p *= smoothstep(h.grow[0], h.grow[1], f);
  if (h.fade) {
    const u = clamp01((f - h.fade[0]) / (h.fade[1] - h.fade[0]));
    p *= 1 - u * u * u;
  }
  out.presence = p;
}

/** Offset of a tapped node at f: a give away from the nose and back, done by the end of the step. */
export function tapOffset(tap: Tap, f: number, out: { x: number; y: number; z: number }): void {
  const q = f - tap.at;
  let d = 0;
  if (q > 0) d = 0.13 * Math.sin(Math.min(1, q / 0.5) * Math.PI) * Math.exp(-q * 2.5) * (1 - smoothstep(0.9, 1, f));
  out.x = tap.dx * d;
  out.y = tap.grounded ? 0 : tap.dy * d;
  out.z = tap.dz * d;
}

// ── Building a step's motion ───────────────────────────────────────────────

const cache = new WeakMap<StageModel, Map<number, WaterMotion | null>>();

/** The water motion of step k (who pushes what where), or null when nothing in it moves. */
export function waterMotionAt(model: StageModel, k: number): WaterMotion | null {
  if (!isOcean(model.world) || k <= 0 || k >= model.frameCount) return null;
  let per = cache.get(model);
  if (!per) {
    per = new Map();
    cache.set(model, per);
  }
  if (per.has(k)) return per.get(k)!;
  const built = build(model, k);
  per.set(k, built);
  if (per.size > 64) per.delete(per.keys().next().value as number);
  return built;
}

function onFloor(model: StageModel, rest: RestFrame, s: number): boolean {
  return rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 - model.floorY < GROUND_CLEARANCE;
}

interface Box {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

/** Everything present in either frame except the given slots: what a path must not pass through. */
function obstacles(model: StageModel, from: RestFrame, to: RestFrame, except: Set<number>): Box[] {
  const out: Box[] = [];
  for (const r of [from, to]) {
    for (let s = 0; s < model.slots.length; s++) {
      if (!r.present[s] || except.has(s)) continue;
      out.push({ x: r.pos[s * 3], y: r.pos[s * 3 + 1], z: r.pos[s * 3 + 2], hx: r.dims[s * 3] / 2, hy: r.dims[s * 3 + 1] / 2, hz: r.dims[s * 3 + 2] / 2 });
    }
  }
  return out;
}

/** True when a box of half size (hx, hy, hz) moving along the path never overlaps an obstacle (with a margin). */
function pathClear(ctrl: Float64Array, hx: number, hy: number, hz: number, boxes: Box[], margin = 0.12): boolean {
  for (let i = 1; i < 24; i++) {
    bezierAt(ctrl, i / 24, _pt);
    for (const b of boxes) {
      if (Math.abs(_pt.x - b.x) < hx + b.hx + margin && Math.abs(_pt.y - b.y) < hy + b.hy + margin && Math.abs(_pt.z - b.z) < hz + b.hz + margin) return false;
    }
  }
  return true;
}

/** The highest top of anything standing in the band a trip from ax to bx crosses (near the trip's depth). */
function topAlong(boxes: Box[], ax: number, bx: number, z: number, reach: number): number {
  let top = -Infinity;
  const x0 = Math.min(ax, bx) - reach, x1 = Math.max(ax, bx) + reach;
  for (const b of boxes) {
    if (b.x + b.hx < x0 || b.x - b.hx > x1 || Math.abs(b.z - z) > b.hz + 1.4) continue;
    top = Math.max(top, b.y + b.hy);
  }
  return top;
}

interface Endpoints {
  a: [number, number, number];
  b: [number, number, number];
  hx: number;
  hy: number;
  hz: number;
}

function endpoints(from: RestFrame, to: RestFrame, s: number): Endpoints {
  return {
    a: [from.pos[s * 3], from.pos[s * 3 + 1], from.pos[s * 3 + 2]],
    b: [to.pos[s * 3], to.pos[s * 3 + 1], to.pos[s * 3 + 2]],
    hx: to.dims[s * 3] / 2,
    hy: to.dims[s * 3 + 1] / 2,
    hz: to.dims[s * 3 + 2] / 2,
  };
}

/**
 * A path from a to b that clears everything else: straight (with a little
 * rise) when that is free, else up and over (a block on the seabed, or a row
 * in the way), else out in front of the structure and back (open water).
 * `lane` 0 is the whale's (higher, further out), 1 the calf's (lower, nearer).
 */
function routeFor(model: StageModel, e: Endpoints, boxes: Box[], lane: number, forceLane: boolean, under?: Box): ReturnType<typeof makePath> {
  const { a, b, hx, hy, hz } = e;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (!forceLane) {
    // Along the sand a block barely leaves it; in open water it rides up a little on the way.
    const sand = a[1] - hy - model.floorY < GROUND_CLEARANCE && b[1] - hy - model.floorY < GROUND_CLEARANCE;
    const rise = sand ? Math.min(0.14, 0.04 + len * 0.025) : Math.min(0.5, 0.12 + len * 0.08);
    const straight = makePath(a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3 + rise, a[2] + (b[2] - a[2]) / 3], [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3 + rise, a[2] + ((b[2] - a[2]) * 2) / 3], b);
    if (pathClear(straight.ctrl, hx, hy, hz, boxes)) return straight;
  }
  const grounded = a[1] - hy - model.floorY < GROUND_CLEARANCE && b[1] - hy - model.floorY < GROUND_CLEARANCE;
  if (grounded) {
    // Up and over whatever stands between (and over the partner block passing underneath): the peak clears the tallest top in the way.
    let top = Math.max(topAlong(boxes, a[0], b[0], (a[2] + b[2]) / 2, hx + 0.3), a[1] + hy, b[1] + hy);
    if (under) top = Math.max(top, under.y + under.hy);
    for (let extra = 0; extra < 4; extra++) {
      const peak = top + CLEAR + hy + (lane === 0 && !under ? LANE_GAP : 0) + extra * 0.5;
      const h = (peak - (a[1] + b[1]) / 8) / 0.75;
      const fwd = lane === 0 ? 0.35 : 0.1;
      const p = makePath(a, [a[0], h, a[2] + fwd], [b[0], h, b[2] + fwd], b);
      if (pathClear(p.ctrl, hx, hy, hz, boxes) || extra === 3) return p;
    }
  }
  // Open water: out towards the viewer (and up or down a little) and back in. The whale's lane is further out and higher.
  const lift = lane === 0 ? 0.75 : -0.45;
  for (let extra = 0; extra < 5; extra++) {
    const out = (lane === 0 ? 1.9 : 1.05) + extra * 0.55;
    const floorMin = model.floorY + hy + 0.25;
    const y1 = Math.max(floorMin, a[1] + lift), y2 = Math.max(floorMin, b[1] + lift);
    const p = makePath(a, [a[0] + (b[0] - a[0]) * 0.15, y1, a[2] + out / 0.75], [b[0] - (b[0] - a[0]) * 0.15, y2, b[2] + out / 0.75], b);
    if (pathClear(p.ctrl, hx, hy, hz, boxes) || extra === 4) return p;
  }
  return makePath(a, a, b, b);
}

function haulOf(slot: number, who: number, kind: HaulKind, path: ReturnType<typeof makePath>, t0: number, t2: number, share: number, model: StageModel, from: RestFrame, to: RestFrame, extra: Partial<Haul> = {}): Haul {
  const t1 = releaseFor(t0, t2, share);
  return {
    slot,
    who,
    kind,
    ...path,
    t0,
    t1,
    t2,
    landsOnFloor: to.present[slot] ? onFloor(model, to, slot) : false,
    liftsOffFloor: from.present[slot] ? onFloor(model, from, slot) : false,
    bob: 0.16,
    half: to.present[slot] ? [to.dims[slot * 3] / 2, to.dims[slot * 3 + 1] / 2, to.dims[slot * 3 + 2] / 2] : [from.dims[slot * 3] / 2, from.dims[slot * 3 + 1] / 2, from.dims[slot * 3 + 2] / 2],
    ...extra,
  };
}

const _ma: HaulPose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 };
const _mb: HaulPose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 };

/** True when two hauled nodes come within a hair of each other at any moment of the step. */
function haulsMeet(a: Haul, b: Haul): boolean {
  for (let i = 0; i <= 120; i++) {
    const f = i / 120;
    haulAt(a, f, _ma);
    haulAt(b, f, _mb);
    if (Math.abs(_ma.x - _mb.x) < a.half[0] + b.half[0] + 0.04 && Math.abs(_ma.y - _mb.y) < a.half[1] + b.half[1] + 0.04 && Math.abs(_ma.z - _mb.z) < a.half[2] + b.half[2] + 0.04) return true;
  }
  return false;
}

/** Where the whale blows a new node from: beside its place, towards the viewer, wherever there is room. */
function birthPoint(model: StageModel, to: RestFrame, s: number, boxes: Box[]): [number, number, number] {
  const x = to.pos[s * 3], y = to.pos[s * 3 + 1], z = to.pos[s * 3 + 2];
  const hx = to.dims[s * 3] / 2, hy = to.dims[s * 3 + 1] / 2, hz = to.dims[s * 3 + 2] / 2;
  const fp = model.footprint();
  const side = x >= (fp.minX + fp.maxX) / 2 ? 1 : -1;
  // Beside its place first (the whale then pushes it side-on to the viewer), else in front, else above.
  const tries: [number, number, number][] = [
    [x + side * (hx + 1.15), y + 0.3, z + hz * 0.5 + 0.3],
    [x - side * (hx + 1.15), y + 0.3, z + hz * 0.5 + 0.3],
    [x + side * 0.9, y + 0.45, z + hz + 1.25],
    [x - side * 0.9, y + 0.45, z + hz + 1.25],
    [x, y + hy + 1.2, z + 0.6],
  ];
  for (const p of tries) {
    p[1] = Math.max(p[1], model.floorY + hy + 0.12);
    let ok = true;
    for (const b of boxes) if (Math.abs(p[0] - b.x) < hx + b.hx + 0.2 && Math.abs(p[1] - b.y) < hy + b.hy + 0.2 && Math.abs(p[2] - b.z) < hz + b.hz + 0.2) ok = false;
    if (ok) return p;
  }
  return tries[2];
}

function build(model: StageModel, k: number): WaterMotion | null {
  const to = model.rest(k);
  const from = model.rest(k - 1);
  const frame = model.frames[k];
  const n = model.slots.length;
  const actors: number[] = [];
  for (const id of frame.event.actors) {
    const s = model.slotOf.get(id);
    if (s !== undefined && !actors.includes(s)) actors.push(s);
  }
  const hauls: Haul[] = [];
  const taps: Tap[] = [];
  const travel = (s: number) => Math.hypot(to.pos[s * 3] - from.pos[s * 3], to.pos[s * 3 + 2] - from.pos[s * 3 + 2], to.pos[s * 3 + 1] - from.pos[s * 3 + 1]);
  const moves = (s: number) => from.present[s] === 1 && to.present[s] === 1 && Math.hypot(to.pos[s * 3] - from.pos[s * 3], to.pos[s * 3 + 2] - from.pos[s * 3 + 2]) > 0.3;
  const busy = new Set<number>();
  let swimmers = 0; // 0: both free, bit 1 whale taken, bit 2 calf taken
  const take = (): number => {
    if (!(swimmers & 1)) {
      swimmers |= 1;
      return 0;
    }
    if (!(swimmers & 2)) {
      swimmers |= 2;
      return 1;
    }
    return -1;
  };

  // A swap: the whale carries the first block high over the row (or far out in front), the calf the second low (or near):
  // their lanes never meet, and both blocks are let go above their new places and sink into them.
  if (frame.event.kind === 'swap' && actors.length >= 2 && moves(actors[0]) && moves(actors[1])) {
    const [a, b] = actors;
    const boxes = obstacles(model, from, to, new Set([a, b]));
    // On the seabed: the whale lifts one up and over the row while the calf slides the other round the front of
    // it along the sand (the classic swap: one over the top, one round the front; their paths never meet). Off
    // the seabed (or with no room in front), both go round in open water, in two lanes.
    const ea = endpoints(from, to, a);
    const eb = endpoints(from, to, b);
    const grounded = onFloor(model, from, a) && onFloor(model, from, b);
    const out = (eb.hz * 2 + 0.45) / 0.75;
    const sand = 0.05;
    const front = makePath(eb.a, [eb.a[0], eb.a[1] + sand, eb.a[2] + out], [eb.b[0], eb.b[1] + sand, eb.b[2] + out], eb.b);
    const slides = grounded && pathClear(front.ctrl, eb.hx, eb.hy, eb.hz, boxes);
    const wa = take(), wb = take();
    let ha: Haul | null = null, hb: Haul | null = null;
    search: for (const extra of [0, 0.3, 0.6, 0.9]) {
      for (const bt0 of [0.24, 0.3, 0.18, 0.12, 0.36]) {
        const over = routeFor(model, ea, boxes, 0, true, slides ? { x: ea.a[0], y: ea.a[1] - 0.6 + extra, z: ea.a[2], hx: ea.hx, hy: ea.hy, hz: ea.hz } : undefined);
        ha = haulOf(a, wa, 'carry', over, 0.16, 0.88, 0.62, model, from, to);
        hb = haulOf(b, wb, 'carry', slides ? front : routeFor(model, eb, boxes, 1, true), bt0, 0.86, 0.64, model, from, to);
        if (!haulsMeet(ha, hb)) break search;
      }
    }
    hauls.push(ha!, hb!);
    busy.add(a);
    busy.add(b);
  }

  // A step that makes or frees one or two nodes without naming them is still about them.
  const born: number[] = [], freed: number[] = [];
  for (let s = 0; s < n; s++) {
    if (!from.present[s] && to.present[s]) born.push(s);
    if (from.present[s] && !to.present[s]) freed.push(s);
  }
  const subjects = [...actors];
  if (born.length > 0 && born.length <= 2) for (const s of born) if (!subjects.includes(s)) subjects.push(s);
  if (freed.length > 0 && freed.length <= 2) for (const s of freed) if (!subjects.includes(s)) subjects.push(s);

  // New nodes the step is about: the whale (then the calf) arrives beside the place and blows a bubble, it
  // condenses into the node, and is nudged into its place.
  for (const s of subjects) {
    if (busy.has(s) || from.present[s] || !to.present[s] || swimmers === 3) continue;
    const boxes = obstacles(model, from, to, new Set([s]));
    const start = birthPoint(model, to, s, boxes);
    const b: [number, number, number] = [to.pos[s * 3], to.pos[s * 3 + 1], to.pos[s * 3 + 2]];
    const mid = 0.22;
    const path = makePath(start, [start[0] + (b[0] - start[0]) * 0.3, start[1] + (b[1] - start[1]) * 0.3 + mid, start[2] + (b[2] - start[2]) * 0.3], [start[0] + (b[0] - start[0]) * 0.7, start[1] + (b[1] - start[1]) * 0.7 + mid * 0.5, start[2] + (b[2] - start[2]) * 0.7], b);
    hauls.push(haulOf(s, take(), 'birth', path, 0.5, 0.9, 0.6, model, from, to, { grow: [0.28, 0.5], liftsOffFloor: false }));
    busy.add(s);
  }

  // Removed nodes the step is about: nudged, they float up and away, dissolving into bubbles.
  for (const s of subjects) {
    if (busy.has(s) || !from.present[s] || to.present[s] || swimmers === 3) continue;
    const a: [number, number, number] = [from.pos[s * 3], from.pos[s * 3 + 1], from.pos[s * 3 + 2]];
    // Up and away to the outside of the structure, drifting back into the blue.
    const fp = model.footprint();
    const away = a[0] >= (fp.minX + fp.maxX) / 2 ? 1 : -1;
    const b: [number, number, number] = [a[0] + away * 1.3, a[1] + 1.8, a[2] - 0.9];
    const path = makePath(a, [a[0] + away * 0.3, a[1] + 0.5, a[2] - 0.1], [a[0] + away * 1.0, a[1] + 1.4, a[2] - 0.6], b);
    hauls.push(haulOf(s, take(), 'farewell', path, 0.42, 0.98, 0.32, model, from, to, { fade: [0.55, 0.92], landsOnFloor: false, bob: 0 }));
    busy.add(s);
  }

  // Nodes that change place: the step's actors are pushed by whoever is free; the rest move on the wake.
  const movers: number[] = [];
  for (let s = 0; s < n; s++) if (!busy.has(s) && moves(s)) movers.push(s);
  movers.sort((p, q) => (actors.includes(q) ? 1 : 0) - (actors.includes(p) ? 1 : 0) || travel(q) - travel(p));
  const scripted = movers.length <= 6;
  movers.forEach((s, i) => {
    const boxes = obstacles(model, from, to, new Set(movers));
    const who = scripted && travel(s) > 0.6 ? take() : -1;
    const lane = who === 1 ? 1 : 0;
    const path = routeFor(model, endpoints(from, to, s), boxes, lane, false);
    if (who >= 0) hauls.push(haulOf(s, who, 'carry', path, 0.22 + i * 0.02, 0.86, 0.64, model, from, to));
    else hauls.push(haulOf(s, -1, 'drift', path, 0.1 + Math.min(0.2, i * 0.025), 0.9, 0.5, model, from, to, { bob: 0.1 }));
    busy.add(s);
  });

  // A write, an assignment, a link: a nudge of the nose (the node gives a little and comes back).
  if (['write', 'assign', 'link'].includes(frame.event.kind)) {
    // From the side (the swimmer seen side-on), from whichever side is the outside of the structure.
    const fp = model.footprint();
    const mid = (fp.minX + fp.maxX) / 2;
    for (const s of actors) {
      if (busy.has(s) || !from.present[s] || !to.present[s] || swimmers === 3) continue;
      const who = take();
      const lift = to.pos[s * 3 + 1] - to.dims[s * 3 + 1] / 2 - model.floorY;
      const sx = to.pos[s * 3] < mid ? 1 : -1;
      // On the seabed it presses the top corner from above and to the side (clear of the neighbours); in open water, level.
      const grounded = lift < 0.6;
      const dy = grounded ? -0.42 : 0.12;
      const l = Math.hypot(0.85, dy, 0.38);
      taps.push({ slot: s, who, at: 0.42 + who * 0.06, dx: (sx * 0.85) / l, dy: dy / l, dz: -0.38 / l, grounded });
    }
  }

  if (hauls.length === 0 && taps.length === 0) return null;
  return { k, hauls, taps, bySlot: new Map(hauls.map((h) => [h.slot, h])), tapBySlot: new Map(taps.map((t) => [t.slot, t])) };
}

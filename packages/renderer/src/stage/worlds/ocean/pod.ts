import type { TraceEventKind } from '@aqvl/runtime';
import type { RestFrame, StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import { clamp01, lerp, smoothstep } from '../../motion/spring';
import { beatSeconds } from '../../timeline/beats';
import { haulAt, waterMotionAt, type Haul, type HaulPose, type Tap } from './water';

/**
 * The pod: a whale (Kai) and her calf (Nami). They swim to the nodes each
 * step is about and act it out: a long look on a compare, a nudge that lifts
 * a block off the seabed and steers it on a swap, a bubble blown into a new
 * node, a farewell push for a removed one, a tap of the nose on a write.
 *
 * Like the rest of the stage it is a pure function of (step, time into the
 * step): each step ends with both swimmers at a station (where they hover,
 * and which way they face), and in between they swim there along a path
 * that clears every node. While a node is being pushed, the swimmer's nose
 * is placed on the node (the node's water motion is the source of truth).
 * Breathing, tail beats, hovering and the idle wandering when nothing runs
 * are drawn on top of this by the layer (they never move a node).
 */

export const POD_SIZE = 2;

/** Body sizes in world units (a node is one unit tall). The nose is this far ahead of the body's centre. */
export const SWIMMERS = [
  { length: 2.75, nose: 1.32, radius: 0.5 },
  { length: 1.4, nose: 0.68, radius: 0.27 },
] as const;

/** What a swimmer is doing at its station. */
export type PodMood = 'hover' | 'compare' | 'match' | 'push' | 'blow' | 'farewell' | 'tap' | 'visit' | 'shake' | 'happy' | 'celebrate' | 'confused' | 'escort';

export interface Pose {
  /** Centre of the body. */
  x: number;
  y: number;
  z: number;
  /** Heading: yaw about y (0 faces +z, towards the viewer) and pitch (nose up positive). */
  yaw: number;
  pitch: number;
}

export interface PodStation extends Pose {
  /** The node attended (or -1), and a second node it glances at (a compare's other side, or -1). */
  slot: number;
  glance: number;
  mood: PodMood;
}

export interface Swimmer extends Pose {
  roll: number;
  /** Speed of the body through the water (units per second at 1x). */
  speed: number;
  mood: PodMood;
  /** Seconds since the mood began (gestures play on it), and how much of it shows. */
  moodTime: number;
  moodWeight: number;
  /** The point the eyes (and a little of the head) turn to. */
  look: [number, number, number];
  target: number;
  glance: number;
  /** One of the step's actors. */
  active: boolean;
  /** 0..1: nose against a node, pushing (the body strains, the flukes beat harder). */
  contact: number;
  /** 0..1: blowing a bubble that becomes a node. */
  blow: number;
  /** 0..1: the nose bump of a tap. */
  bump: number;
}

export function createPod(): Swimmer[] {
  return Array.from({ length: POD_SIZE }, () => ({
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0,
    mood: 'hover' as PodMood, moodTime: 0, moodWeight: 1,
    look: [0, 0, 0] as [number, number, number], target: -1, glance: -1, active: false, contact: 0, blow: 0, bump: 0,
  }));
}

/** What the pod does for each kind of step. */
export function moodFor(kind: TraceEventKind, relation?: '<' | '>' | '='): PodMood {
  switch (kind) {
    case 'compare':
      return relation === '=' ? 'match' : 'compare';
    case 'swap':
    case 'move':
      return 'push';
    case 'write':
    case 'link':
    case 'assign':
      return 'tap';
    case 'create':
      return 'blow';
    case 'remove':
      return 'farewell';
    case 'discard':
      return 'shake';
    case 'visit':
    case 'traverse':
    case 'mark':
      return 'visit';
    case 'settle':
      return 'happy';
    default:
      return 'hover';
  }
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

// ── Space: what a swimmer must keep out of ──────────────────────────────────

interface Box {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

function boxesOf(model: StageModel, frames: RestFrame[], except = -1): Box[] {
  const out: Box[] = [];
  for (const r of frames) {
    for (let s = 0; s < model.slots.length; s++) {
      if (!r.present[s] || s === except) continue;
      out.push({ x: r.pos[s * 3], y: r.pos[s * 3 + 1], z: r.pos[s * 3 + 2], hx: r.dims[s * 3] / 2, hy: r.dims[s * 3 + 1] / 2, hz: r.dims[s * 3 + 2] / 2 });
    }
  }
  return out;
}

/** Distance from a point to a box (0 inside). */
function boxDistance(b: Box, x: number, y: number, z: number): number {
  const dx = Math.max(0, Math.abs(x - b.x) - b.hx);
  const dy = Math.max(0, Math.abs(y - b.y) - b.hy);
  const dz = Math.max(0, Math.abs(z - b.z) - b.hz);
  return Math.hypot(dx, dy, dz);
}

/** Unit heading from yaw and pitch. */
function headingOf(yaw: number, pitch: number): [number, number, number] {
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c];
}

/**
 * How close a swimmer's body (a capsule from nose to tail, thinner towards the tail) at `p` comes to the
 * nodes: negative when it overlaps one.
 */
function bodyClearance(p: Pose, who: number, boxes: Box[], floorY: number): number {
  const size = SWIMMERS[who];
  const [hx, hy, hz] = headingOf(p.yaw, p.pitch);
  let worst = Infinity;
  for (let i = 0; i <= 6; i++) {
    const u = i / 6; // 0 nose .. 1 tail
    const along = size.nose - u * size.length * 0.95;
    const r = size.radius * (u < 0.35 ? 0.75 + u : 1.1 - u * 0.9);
    const x = p.x + hx * along, y = p.y + hy * along, z = p.z + hz * along;
    worst = Math.min(worst, y - r - floorY);
    for (const b of boxes) worst = Math.min(worst, boxDistance(b, x, y, z) - r);
  }
  return worst;
}

/** Poses from which a swimmer can attend node s (in order of preference): above and in front, beside, or above it. */
function viewPoses(model: StageModel, r: RestFrame, s: number, who: number, side: number): Pose[] {
  const x = r.pos[s * 3], y = r.pos[s * 3 + 1], z = r.pos[s * 3 + 2];
  const hx = r.dims[s * 3] / 2, hy = r.dims[s * 3 + 1] / 2, hz = r.dims[s * 3 + 2] / 2;
  const size = SWIMMERS[who];
  const gap = who === 0 ? 0.5 : 0.36;
  const floorMin = model.floorY + size.radius + 0.18;
  const out: Pose[] = [];
  const place = (nx: number, ny: number, nz: number, yaw: number, pitch: number) => {
    const [dx, dy, dz] = headingOf(yaw, pitch);
    const p = { x: nx - dx * size.nose, y: ny - dy * size.nose, z: nz - dz * size.nose, yaw, pitch };
    if (p.y < floorMin) p.y = floorMin;
    out.push(p);
  };
  for (const sd of [side, -side]) {
    // Side-on to the viewer, beside it and a little above, nose tipped down towards it: the whale in profile.
    place(x + sd * (hx + 0.06), y + hy + size.radius * 0.55 + 0.05, z + hz * 0.3 + 0.12, Math.atan2(-sd, -0.28), -0.3);
  }
  for (const sd of [side, -side]) {
    // The same, a little higher (clear of tall neighbours).
    place(x + sd * (hx + 0.1), y + hy + size.radius * 0.55 + 0.5, z + hz * 0.3 + 0.2, Math.atan2(-sd, -0.32), -0.42);
  }
  for (const sd of [side, -side]) {
    // Hovering above and in front, looking down at it in three-quarter view (hides nothing below it).
    place(x + sd * Math.min(0.25, hx * 0.5), y + hy + size.radius * 0.8 + 0.08, z + hz * 0.6 + gap * 0.5, Math.atan2(-sd * 0.62, -0.78), -0.42);
  }
  for (const sd of [side, -side]) {
    // Level with it, in front and to one side (the viewer sees face and flank).
    place(x + sd * Math.min(0.3, hx * 0.6), y + Math.min(0.15, hy * 0.3), z + hz + gap, Math.atan2(-sd * 0.78, -0.62), -0.1);
  }
  // Above it, looking down (nodes spread across the floor, crowded places).
  place(x + side * 0.25, y + hy + size.radius + 0.35, z + hz * 0.3 + 0.3, Math.atan2(-side * 0.7, -0.7), -0.5);
  return out;
}

/** The direction from the scene towards the stage camera (it looks a little from the left, from above). */
const VIEW: [number, number, number] = (() => {
  const yaw = -0.16, pitch = 0.42;
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
})();

/**
 * How much of the other nodes (and the index captions printed on the floor in front of them) a body at `p`
 * hides from the camera: 0 when it hides nothing.
 */
function occlusion(p: Pose, who: number, model: StageModel, r: RestFrame, except: number): number {
  const size = SWIMMERS[who];
  const [hx, hy, hz] = headingOf(p.yaw, p.pitch);
  let sum = 0;
  for (let s = 0; s < model.slots.length; s++) {
    if (!r.present[s]) continue;
    // Its own node most of all must stay in view (only its top may be overlapped by the head looking down at it).
    const own = s === except;
    const nr = Math.max(r.dims[s * 3], r.dims[s * 3 + 1]) * (own ? 0.32 : 0.45);
    const targets: [number, number, number, number][] = [[r.pos[s * 3], r.pos[s * 3 + 1], r.pos[s * 3 + 2], 1]];
    if (r.pos[s * 3 + 1] - r.dims[s * 3 + 1] / 2 - model.floorY < 0.75) targets.push([r.pos[s * 3], model.floorY + 0.05, r.pos[s * 3 + 2] + r.dims[s * 3 + 2] / 2 + 0.95, 0.5]);
    else targets.push([r.pos[s * 3], r.pos[s * 3 + 1] + r.dims[s * 3 + 1] / 2 + 0.4, r.pos[s * 3 + 2], 0.5]);
    for (const [cx, cy, cz, w] of targets) {
      for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        const along = size.nose - u * size.length * 0.9;
        const rad = size.radius * (u < 0.4 ? 0.9 : 1 - u * 0.7);
        const px = p.x + hx * along - cx, py = p.y + hy * along - cy, pz = p.z + hz * along - cz;
        const t = px * VIEW[0] + py * VIEW[1] + pz * VIEW[2];
        if (t <= 0) continue;
        const d = Math.hypot(px - VIEW[0] * t, py - VIEW[1] * t, pz - VIEW[2] * t);
        const reach = rad + nr * (w < 1 ? 0.5 : 0.75);
        if (d < reach) sum += (reach - d) * w * (own ? 1.5 : 1);
      }
    }
  }
  return sum;
}

function bestPose(model: StageModel, cands: Pose[], who: number, boxes: Box[], prev: Pose | null, view?: { r: RestFrame; slot: number }): Pose {
  let best: Pose | null = null;
  let bestScore = -Infinity;
  cands.forEach((c, i) => {
    const clear = bodyClearance(c, who, boxes, model.floorY);
    const travel = prev ? Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z) : 0;
    const hides = view ? occlusion(c, who, model, view.r, view.slot) : 0;
    // Not far above what it attends (it would have to dive a long way for the next push, and leaves the frame).
    const top = view ? view.r.pos[view.slot * 3 + 1] + view.r.dims[view.slot * 3 + 1] / 2 : c.y;
    const high = Math.max(0, c.y - (top + 0.85));
    // Clear of everything first; then hiding as little as it can; then low, the earlier (nicer) candidates and the shorter trip.
    const score = (clear > 0.05 ? 100 : clear * 10) - hides * 1.6 - high * 1.4 - i * 0.35 - travel * 0.06;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return best ?? cands[0];
}

/** The calf's place beside her mother: under her pectoral fin on the side away from the work, a little behind. */
function escortPose(model: StageModel, mom: Pose, side: number, boxes: Box[], view?: { r: RestFrame; slot: number }): Pose {
  const [hx, , hz] = headingOf(mom.yaw, 0);
  const rx = hz, rz = -hx; // right of the heading (in the horizontal plane)
  const cands: Pose[] = [];
  for (const sd of [side, -side]) {
    cands.push({ x: mom.x + rx * sd * 1.05 - hx * 0.55, y: mom.y - 0.38, z: mom.z + rz * sd * 1.05 - hz * 0.55, yaw: mom.yaw + sd * 0.12, pitch: mom.pitch * 0.5 });
  }
  cands.push({ x: mom.x - hx * 0.4, y: mom.y + 0.85, z: mom.z - hz * 0.4 + 0.3, yaw: mom.yaw, pitch: -0.15 });
  cands.push({ x: mom.x - hx * 1.6, y: mom.y + 0.2, z: mom.z - hz * 1.6 + 0.6, yaw: mom.yaw, pitch: 0 });
  // Further out to the side (clear of whatever she is working on).
  for (const sd of [side, -side]) cands.push({ x: mom.x + rx * sd * 1.9 - hx * 0.3, y: mom.y + 0.25, z: mom.z + rz * sd * 1.9 - hz * 0.3 + 0.4, yaw: mom.yaw, pitch: 0 });
  for (const c of cands) c.y = Math.max(c.y, model.floorY + SWIMMERS[1].radius + 0.2);
  return bestPose(model, cands, 1, boxes, null, view);
}

// ── Stations, step by step ─────────────────────────────────────────────────

interface Seg {
  f0: number;
  f1: number;
  kind: 'travel' | 'contact' | 'hold' | 'tap';
  a: Pose;
  b: Pose;
  /** A travel's bend: the control point of the quadratic path (clears the nodes). */
  via?: [number, number, number];
  mood: PodMood;
  haul?: Haul;
  tap?: Tap;
}

interface Entry {
  stations: PodStation[];
  /** Per swimmer: scripted segments covering the whole step (a push, a blow, a tap), or null. */
  script: (Seg[] | null)[];
}

const cache = new WeakMap<StageModel, Entry[]>();

function entryAt(model: StageModel, k: number): Entry {
  let list = cache.get(model);
  if (!list) {
    list = [];
    cache.set(model, list);
  }
  const last = Math.max(0, Math.min(k, model.frameCount - 1));
  while (list.length <= last) list.push(computeEntry(model, list.length, list[list.length - 1]));
  return list[last];
}

/** Where the whale and her calf are at rest at the end of step k. */
export function podStationsAt(model: StageModel, k: number): PodStation[] {
  return entryAt(model, k).stations;
}

function actorsOf(model: StageModel, k: number): number[] {
  const rest = model.rest(k);
  const before = k > 0 ? model.rest(k - 1) : rest;
  const out: number[] = [];
  for (const id of model.frames[k].event.actors) {
    const s = model.slotOf.get(id);
    if (s === undefined || out.includes(s)) continue;
    if (!rest.present[s] && !before.present[s]) continue;
    out.push(s);
    if (out.length === POD_SIZE) break;
  }
  return out;
}

function home(model: StageModel, who: number): PodStation {
  const f = model.footprint();
  const cx = (f.minX + f.maxX) / 2;
  const y = model.floorY + 1.7 + (who === 0 ? 0.6 : 0);
  // With nothing to attend yet the pod waits up and to the left of the structures, looking at them.
  const x = f.minX - 0.9 - who * 0.9;
  const z = f.maxZ + 0.9 + who * 0.5;
  return { x, y, z, yaw: Math.atan2(cx - x, -0.8) * 0.85, pitch: -0.12, slot: -1, glance: -1, mood: 'hover' };
}

/** Where the pod waits before the first step: at the left end of the structures, attending the first node. */
function startStations(model: StageModel, rest: RestFrame, boxes: Box[]): PodStation[] {
  let left = -1;
  for (let s = 0; s < model.slots.length; s++) {
    if (!rest.present[s]) continue;
    if (left < 0 || rest.pos[s * 3] < rest.pos[left * 3]) left = s;
  }
  if (left < 0) return [home(model, 0), home(model, 1)];
  const mom = stationFor(model, rest, left, 0, -1, 'hover', -1, boxes, null);
  const esc = escortPose(model, mom, -1, [...boxes, ...bodyBoxes(mom, 0)]);
  return [{ ...mom, mood: 'hover' }, { ...esc, slot: left, glance: -1, mood: 'hover' }];
}

function stationFor(model: StageModel, r: RestFrame, s: number, who: number, side: number, mood: PodMood, glance: number, boxes: Box[], prev: Pose | null): PodStation {
  const p = bestPose(model, viewPoses(model, r, s, who, side), who, boxes, prev, { r, slot: s });
  return { ...p, slot: s, glance, mood };
}

function computeEntry(model: StageModel, k: number, prev: Entry | undefined): Entry {
  const rest = model.rest(k);
  const before = k > 0 ? model.rest(k - 1) : rest;
  const boxes = boxesOf(model, k > 0 ? [before, rest] : [rest]);
  if (model.frameCount === 0 || !prev) {
    // The start: the pod waits at the left end of the structures.
    return { stations: startStations(model, rest, boxes), script: [null, null] };
  }
  const frame = model.frames[k];
  const finale = k === model.frameCount - 1 && k > 0;
  const failed = finale && model.trace.error !== null;
  let mood = moodFor(frame.event.kind, frame.event.relation);
  if (finale) mood = failed ? 'confused' : 'celebrate';
  const actors = actorsOf(model, k);
  const placeOf = (s: number) => (rest.present[s] ? rest : before);
  const prevSt = prev.stations;
  const next: PodStation[] = prevSt.map((p) => ({ ...p }));
  const fp = model.footprint();
  const midX = (fp.minX + fp.maxX) / 2;
  const sideOf = (x: number, nodeX: number) => (x < nodeX - 0.05 ? -1 : x > nodeX + 0.05 ? 1 : nodeX < midX ? -1 : 1);

  if (actors.length >= 2) {
    // Two nodes: the whale takes the first, the calf the second, each from its outer side, glancing at the other.
    const [a, b] = actors;
    const pa = placeOf(a), pb = placeOf(b);
    const aLeft = pa.pos[a * 3] <= pb.pos[b * 3];
    next[0] = stationFor(model, pa, a, 0, aLeft ? -1 : 1, mood, b, boxes, prevSt[0]);
    next[1] = stationFor(model, pb, b, 1, aLeft ? 1 : -1, mood, a, [...boxes, ...bodyBoxes(next[0], 0)], prevSt[1]);
  } else if (actors.length === 1) {
    const s = actors[0];
    const p = placeOf(s);
    next[0] = stationFor(model, p, s, 0, sideOf(prevSt[0].x, p.pos[s * 3]), mood, -1, boxes, prevSt[0]);
    // The calf stays close to her mother, on the side away from the work.
    const esc = escortPose(model, next[0], next[0].x < p.pos[s * 3] ? -1 : 1, [...boxes, ...bodyBoxes(next[0], 0)], { r: p, slot: s });
    next[1] = { ...esc, slot: s, glance: -1, mood: finale ? mood : 'escort' };
  } else {
    // Nothing in particular: stay where they are, at ease.
    for (let i = 0; i < POD_SIZE; i++) next[i] = { ...prevSt[i], mood: 'hover', glance: -1 };
  }
  if (finale && !failed) {
    // The end: both rise over the middle of the structures, facing the viewer, and celebrate (a roll, a ring of bubbles).
    const top = fp.top + 0.9;
    const z = fp.maxZ + 0.2;
    next[0] = { x: midX - 0.7, y: top + 0.55, z, yaw: Math.atan2(0.85, 0.55), pitch: 0.08, slot: next[0].slot, glance: -1, mood: 'celebrate' };
    next[1] = { x: midX + 0.9, y: top + 0.2, z: z + 0.5, yaw: Math.atan2(-0.8, 0.6), pitch: 0.12, slot: next[1].slot, glance: -1, mood: 'celebrate' };
  } else if (finale) {
    // A run that ended in an error: they stay by the last node, puzzled.
    for (let i = 0; i < POD_SIZE; i++) next[i] = { ...next[i], pitch: Math.max(-0.2, next[i].pitch), mood: 'confused' };
  }

  // A whale is quick but not instant: a place it cannot reach within the step at its top speed becomes a point on
  // the way there (looking ahead at the node); it carries on from there next step and soon catches up.
  const D = beatSeconds(frame);
  for (let i = 0; i < POD_SIZE; i++) {
    const a = prevSt[i], b = next[i];
    const reach = MAX_SPEED[i] * 0.8 * D;
    const via = viaFor(model, a, b, i, boxes);
    const len = pathLength(a, via, b);
    if (len <= reach || len < 1e-6) continue;
    const u = reach / len;
    const p = quad(a, via, b, u);
    const q = quad(a, via, b, Math.min(1, u + 0.02));
    next[i] = { ...b, x: p[0], y: p[1], z: p[2], yaw: Math.atan2(q[0] - p[0], q[2] - p[2]), pitch: Math.max(-0.4, Math.min(0.4, Math.atan2(q[1] - p[1], Math.hypot(q[0] - p[0], q[2] - p[2])))), mood: 'hover' };
  }

  const water = waterMotionAt(model, k);
  const script: (Seg[] | null)[] = [null, null];
  if (water) {
    for (const h of water.hauls) {
      if (h.who < 0 || script[h.who]) continue;
      const res = scriptHaul(model, rest, h, prevSt[h.who], boxes, beatSeconds(frame));
      script[h.who] = res.segs;
      next[h.who] = { ...res.end, slot: h.slot, glance: -1, mood: h.kind === 'farewell' ? 'farewell' : 'hover' };
    }
    for (const t of water.taps) {
      if (script[t.who]) continue;
      const res = scriptTap(model, t, prevSt[t.who], rest, boxes, beatSeconds(frame));
      script[t.who] = res.segs;
      next[t.who] = { ...res.end, slot: t.slot, glance: -1, mood: 'tap' };
    }
    // A calf with no part in it keeps out of the way of her mother's work.
    for (let i = 0; i < POD_SIZE; i++) {
      if (script[i] || !script[1 - i]) continue;
      const busy = script[1 - i]!;
      const end = busy[busy.length - 1].b;
      const slot = next[1 - i].slot;
      const esc = escortPose(model, end, 1, [...boxes, ...bodyBoxes(end, 1 - i)], slot >= 0 && rest.present[slot] ? { r: rest, slot } : undefined);
      next[i] = i === 1 ? { ...esc, slot: next[1 - i].slot, glance: -1, mood: 'escort' } : next[i];
    }
  }
  return { stations: next, script };
}

/** The space a swimmer's body takes at a pose, as a few boxes (so the other one keeps clear of it). */
function bodyBoxes(p: Pose, who: number): Box[] {
  const size = SWIMMERS[who];
  const [hx, hy, hz] = headingOf(p.yaw, p.pitch);
  const out: Box[] = [];
  for (const u of [0.15, 0.45, 0.75]) {
    const along = size.nose - u * size.length;
    const r = size.radius * (u < 0.5 ? 1 : 0.7);
    out.push({ x: p.x + hx * along, y: p.y + hy * along, z: p.z + hz * along, hx: r, hy: r, hz: r });
  }
  return out;
}

// ── Contact: the nose on a node ─────────────────────────────────────────────

const _hp: HaulPose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 };

/**
 * Where a swimmer is while its nose is on a hauled node at f. It stays level (a whale does not stand on its
 * tail), always on the viewer's side of the node, in three-quarter view: while the node rises off the seabed
 * the nose is under its front lip; as it is carried across, the swimmer comes round behind it, the way it goes.
 */
export function contactPose(model: StageModel, h: Haul, f: number, who: number, out: Pose): void {
  haulAt(h, f, _hp);
  const size = SWIMMERS[who];
  // Which way the trip goes across (left or right), and how much of the motion right now is across rather than up / down.
  const cx = h.ctrl[9] - h.ctrl[0], cz = h.ctrl[11] - h.ctrl[2];
  const sx = Math.abs(cx) > 0.05 ? Math.sign(cx) : who === 0 ? -1 : 1;
  const across = Math.min(1, Math.hypot(_hp.tx, _hp.tz) * 1.15);
  let dx: number, dy: number, dz: number;
  if (h.kind === 'farewell') {
    dx = sx * 0.85;
    dy = 0.3;
    dz = -0.45;
  } else {
    // Nearly side-on to the viewer (so the whale is seen in profile, face and flank), turned a little into the scene.
    dx = sx * (0.9 + 0.08 * across);
    dy = Math.max(-0.18, Math.min(0.18, _hp.ty * 0.2));
    dz = -(0.46 - 0.18 * across) + Math.min(0, _hp.tz) * 0.3 + (cz > 0.3 ? 0.15 : 0);
  }
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  // The node's half extent along the push (its box's support), and a hair of water.
  const ext = Math.abs(dx) * h.half[0] + Math.abs(dy) * h.half[1] + Math.abs(dz) * h.half[2] + 0.05;
  const reach = ext + size.nose;
  // The nose meets the node a little below its middle while it is lifted (under the lip), level once it is carried.
  const under = (1 - across) * Math.min(0.3, h.half[1] * 0.6);
  out.x = _hp.x - dx * reach;
  out.y = Math.max(model.floorY + size.radius + 0.1, _hp.y - dy * reach - under);
  out.z = _hp.z - dz * reach;
  out.yaw = Math.atan2(dx, dz);
  out.pitch = Math.asin(Math.max(-1, Math.min(1, dy)));
}

/** Top swimming speed (units per second at 1x): the whale's dart, and the calf's (quicker for her size). */
const MAX_SPEED = [10, 11];

function pathLength(a: Pose, via: [number, number, number] | undefined, b: Pose): number {
  let len = 0;
  let p = quad(a, via, b, 0);
  for (let i = 1; i <= 8; i++) {
    const q = quad(a, via, b, i / 8);
    len += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    p = q;
  }
  return len;
}

function scriptHaul(model: StageModel, to: RestFrame, h: Haul, start: Pose, boxes: Box[], D: number): { segs: Seg[]; end: Pose } {
  const who = h.who;
  const c0: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  const c1: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  contactPose(model, h, h.t0, who, c0);
  contactPose(model, h, h.t1, who, c1);
  const segs: Seg[] = [];
  const near = (b: Box, x: number, z: number) => Math.abs(b.x - x) < 1e-6 && Math.abs(b.z - z) < 1e-6;
  const others = boxes.filter((b) => !near(b, h.ctrl[0], h.ctrl[2]) && !near(b, h.ctrl[9], h.ctrl[11]));
  const via = viaFor(model, start, c0, who, others);
  // A whale swims fast but never teleports: a long way to go takes the time it takes (the node waits, or sets off on its own).
  const dist = pathLength(start, via, c0);
  const need = dist / (MAX_SPEED[who] * D);
  const nominal = h.kind === 'birth' && h.grow ? Math.max(0.08, h.grow[0] - 0.02) : Math.max(0.06, h.t0 - 0.02);
  const arrive = Math.max(nominal, need);
  if (arrive > h.t1 - 0.04) {
    // Too far to get there in time: the node goes on its own (on the wake); the swimmer comes over to watch.
    const watch = h.kind !== 'farewell' && to.present[h.slot] ? stationFor(model, to, h.slot, who, start.x < h.ctrl[9] ? -1 : 1, 'hover', -1, others, start) : c1;
    const end = Math.min(0.97, Math.max(0.3, pathLength(start, undefined, watch) / (MAX_SPEED[who] * D)));
    segs.push({ f0: 0, f1: end, kind: 'travel', a: start, b: watch, via: viaFor(model, start, watch, who, others), mood: 'hover' });
    segs.push({ f0: end, f1: 1, kind: 'hold', a: watch, b: watch, mood: h.kind === 'farewell' ? 'farewell' : 'hover' });
    return { segs, end: watch };
  }
  segs.push({ f0: 0, f1: arrive, kind: 'travel', a: start, b: c0, via, mood: 'hover' });
  if (h.kind === 'birth' && h.grow && arrive < h.t0) segs.push({ f0: arrive, f1: h.t0, kind: 'hold', a: c0, b: c0, mood: 'blow' });
  else if (arrive < h.t0) segs.push({ f0: arrive, f1: h.t0, kind: 'hold', a: c0, b: c0, mood: 'push' });
  if (arrive <= h.t0) segs.push({ f0: h.t0, f1: h.t1, kind: 'contact', a: c0, b: c1, mood: h.kind === 'farewell' ? 'farewell' : 'push', haul: h });
  else {
    // Late: it catches the node up and takes over the push.
    const cl: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    contactPose(model, h, arrive, who, cl);
    segs[0].b = cl;
    segs.push({ f0: arrive, f1: h.t1, kind: 'contact', a: cl, b: c1, mood: h.kind === 'farewell' ? 'farewell' : 'push', haul: h });
  }
  // Let go, ease off to a place from which to watch it settle (above and in front of where it ends up).
  let watch: Pose;
  if (h.kind !== 'farewell' && to.present[h.slot]) {
    watch = stationFor(model, to, h.slot, who, c1.x < h.ctrl[9] ? -1 : 1, 'happy', -1, others, c1);
  } else {
    // Back off and watch it go, from wherever is clear.
    const [dx, dy, dz] = headingOf(c1.yaw, c1.pitch);
    const floorMin = model.floorY + SWIMMERS[who].radius + 0.18;
    const cands: Pose[] = [
      { x: c1.x - dx * 0.7, y: Math.max(floorMin, c1.y - dy * 0.35 + 0.3), z: c1.z - dz * 0.7 + 0.3, yaw: c1.yaw, pitch: -0.15 },
      { x: c1.x - dx * 0.4, y: Math.max(floorMin, c1.y + 0.9), z: c1.z + 0.5, yaw: c1.yaw, pitch: -0.1 },
      { x: c1.x - dx * 1.3, y: Math.max(floorMin, c1.y + 0.4), z: c1.z + 0.9, yaw: c1.yaw, pitch: -0.1 },
    ];
    watch = bestPose(model, cands, who, others, c1);
  }
  const backEnd = Math.min(0.97, h.t1 + 0.32);
  segs.push({ f0: h.t1, f1: backEnd, kind: 'travel', a: c1, b: watch, mood: h.kind === 'farewell' ? 'farewell' : 'hover' });
  segs.push({ f0: backEnd, f1: 1, kind: 'hold', a: watch, b: watch, mood: h.kind === 'farewell' ? 'farewell' : 'happy' });
  return { segs, end: watch };
}

function scriptTap(model: StageModel, t: Tap, start: Pose, rest: RestFrame, boxes: Box[], D: number): { segs: Seg[]; end: Pose } {
  const s = t.slot;
  const who = t.who;
  const size = SWIMMERS[who];
  const x = rest.pos[s * 3], y = rest.pos[s * 3 + 1], z = rest.pos[s * 3 + 2];
  const ext = 0.5 * (Math.abs(t.dx) * rest.dims[s * 3] + Math.abs(t.dy) * rest.dims[s * 3 + 1] + Math.abs(t.dz) * rest.dims[s * 3 + 2]) * 0.9 + 0.08;
  const reach = ext + size.nose;
  // The nose on the face (or, pressing from above, on the top corner) of the node.
  const ny = t.dy < 0 ? y + rest.dims[s * 3 + 1] / 2 - 0.05 : y;
  const p: Pose = { x: x - t.dx * reach, y: Math.max(model.floorY + size.radius + 0.15, ny - t.dy * size.nose), z: z - t.dz * reach, yaw: Math.atan2(t.dx, t.dz), pitch: Math.asin(t.dy) };
  const segs: Seg[] = [];
  const others = boxes.filter((b) => !(Math.abs(b.x - x) < 1e-6 && Math.abs(b.y - y) < 1e-6 && Math.abs(b.z - z) < 1e-6));
  const via = viaFor(model, start, p, who, others);
  const arrive = Math.min(0.85, Math.max(0.1, t.at - 0.12, pathLength(start, via, p) / (MAX_SPEED[who] * D)));
  segs.push({ f0: 0, f1: arrive, kind: 'travel', a: start, b: p, via, mood: 'hover' });
  segs.push({ f0: arrive, f1: 1, kind: 'tap', a: p, b: p, mood: 'tap', tap: t });
  return { segs, end: p };
}

/**
 * A bend for a trip from a to b that keeps the body clear of the nodes (a straight line if that is clear;
 * else out towards the viewer and up, as far as it takes).
 */
function viaFor(model: StageModel, a: Pose, b: Pose, who: number, boxes: Box[]): [number, number, number] | undefined {
  const mid: [number, number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
  const test = (via: [number, number, number] | undefined) => {
    const r = SWIMMERS[who].radius * 0.9;
    for (let i = 1; i < 12; i++) {
      const u = i / 12;
      const p = quad(a, via, b, u);
      for (const bx of boxes) if (boxDistance(bx, p[0], p[1], p[2]) < r) return false;
      if (p[1] - r < model.floorY) return false;
    }
    return true;
  };
  if (test(undefined)) return undefined;
  for (let i = 1; i <= 6; i++) {
    const via: [number, number, number] = [mid[0], mid[1] + i * 0.55, mid[2] + i * 0.7];
    if (test(via)) return via;
  }
  return [mid[0], mid[1] + 3.3, mid[2] + 4.2];
}

function quad(a: { x: number; y: number; z: number }, via: [number, number, number] | undefined, b: { x: number; y: number; z: number }, u: number): [number, number, number] {
  if (!via) return [lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u)];
  const w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u;
  return [w0 * a.x + w1 * via[0] + w2 * b.x, w0 * a.y + w1 * via[1] + w2 * b.y, w0 * a.z + w1 * via[2] + w2 * b.z];
}

// ── Sampling ───────────────────────────────────────────────────────────────

function easeInOut(x: number): number {
  return -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;
}

const _pose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };

/** A swimmer's body at step fraction f of a free trip from station a to station b (pure). */
function freeAt(model: StageModel, k: number, i: number, a: PodStation, b: PodStation, f: number, D: number, out: Pose, calm: boolean): { moving: boolean; arrive: number } {
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const moving = dist > 0.02;
  if (!moving) {
    out.x = b.x;
    out.y = b.y;
    out.z = b.z;
    out.yaw = lerpAngle(a.yaw, b.yaw, smoothstep(0, Math.min(0.5, 0.35 / D), f));
    out.pitch = lerp(a.pitch, b.pitch, smoothstep(0, Math.min(0.5, 0.35 / D), f));
    return { moving, arrive: 0 };
  }
  // Swimming speed: a cruise, quicker over long distances (a whale covers ground with a few strong beats).
  const T = Math.min(0.88, Math.max(0.3, dist / (4.2 * D) + 0.18 / D, dist / (MAX_SPEED[i] * D)));
  const start = i * 0.05;
  const u = clamp01((f - start) / T);
  const e = calm ? smoothstep(0, 1, u) : easeInOut(u);
  const via = calm ? undefined : viaCached(model, k, i, a, b);
  const p = quad(a, via, b, e);
  out.x = p[0];
  out.y = p[1];
  out.z = p[2];
  // Facing: along the way it swims (yaw and pitch from the path), turning into the station's facing on arrival.
  const p2 = quad(a, via, b, Math.min(1, e + 0.02));
  const p1 = quad(a, via, b, Math.max(0, e - 0.02));
  const vx = p2[0] - p1[0], vy = p2[1] - p1[1], vz = p2[2] - p1[2];
  const hl = Math.hypot(vx, vz);
  const travelYaw = Math.atan2(vx, vz);
  const travelPitch = Math.max(-0.55, Math.min(0.55, Math.atan2(vy, Math.max(1e-4, hl)) * 0.8));
  const into = calm ? 0 : smoothstep(0, 0.18, u) * (1 - smoothstep(0.72, 1, u));
  const settle = smoothstep(0.6, 1, u);
  const baseYaw = lerpAngle(a.yaw, b.yaw, settle);
  const basePitch = lerp(a.pitch, b.pitch, settle);
  out.yaw = Math.hypot(vx, vy, vz) > 1e-5 ? lerpAngle(baseYaw, travelYaw, into) : baseYaw;
  out.pitch = lerp(basePitch, travelPitch, into);
  return { moving, arrive: start + T * 0.85 };
}

const viaCache = new WeakMap<StageModel, Map<string, [number, number, number] | undefined>>();

function viaCached(model: StageModel, k: number, i: number, a: Pose, b: Pose): [number, number, number] | undefined {
  let m = viaCache.get(model);
  if (!m) {
    m = new Map();
    viaCache.set(model, m);
  }
  const key = `${k}:${i}`;
  if (m.has(key)) return m.get(key);
  const boxes = boxesOf(model, k > 0 ? [model.rest(k - 1), model.rest(k)] : [model.rest(k)]);
  const via = viaFor(model, a, b, i, boxes);
  m.set(key, via);
  if (m.size > 256) m.delete(m.keys().next().value as string);
  return via;
}

function scriptedAt(model: StageModel, segs: Seg[], f: number, D: number, who: number, out: Pose, m: Swimmer): void {
  let si = segs.length - 1;
  for (let i = 0; i < segs.length; i++) {
    if (f < segs[i].f1) {
      si = i;
      break;
    }
  }
  const seg = segs[si];
  const u = clamp01((f - seg.f0) / Math.max(1e-4, seg.f1 - seg.f0));
  m.contact = 0;
  m.blow = 0;
  m.bump = 0;
  if (seg.kind === 'travel') {
    const e = easeInOut(u);
    const p = quad(seg.a, seg.via, seg.b, e);
    out.x = p[0];
    out.y = p[1];
    out.z = p[2];
    const p2 = quad(seg.a, seg.via, seg.b, Math.min(1, e + 0.02));
    const p1 = quad(seg.a, seg.via, seg.b, Math.max(0, e - 0.02));
    const vx = p2[0] - p1[0], vy = p2[1] - p1[1], vz = p2[2] - p1[2];
    const into = smoothstep(0, 0.2, u) * (1 - smoothstep(0.6, 1, u));
    const baseYaw = lerpAngle(seg.a.yaw, seg.b.yaw, smoothstep(0.45, 1, u));
    const basePitch = lerp(seg.a.pitch, seg.b.pitch, smoothstep(0.45, 1, u));
    const moving = Math.hypot(vx, vy, vz) > 1e-4;
    out.yaw = moving ? lerpAngle(baseYaw, Math.atan2(vx, vz), into) : baseYaw;
    out.pitch = moving ? lerp(basePitch, Math.max(-0.55, Math.min(0.55, Math.atan2(vy, Math.max(1e-4, Math.hypot(vx, vz))) * 0.8)), into) : basePitch;
  } else if (seg.kind === 'contact' && seg.haul) {
    contactPose(model, seg.haul, f, who, out);
    m.contact = smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u));
  } else if (seg.kind === 'tap' && seg.tap) {
    const q = (f - seg.tap.at) * D;
    const bump = q > -0.12 && q < 0.4 ? Math.sin(clamp01((q + 0.12) / 0.52) * Math.PI) : 0;
    const [dx, dy, dz] = headingOf(seg.a.yaw, seg.a.pitch);
    out.x = seg.a.x + dx * bump * 0.12;
    out.y = seg.a.y + dy * bump * 0.12;
    out.z = seg.a.z + dz * bump * 0.12;
    out.yaw = seg.a.yaw;
    out.pitch = seg.a.pitch;
    m.bump = bump;
  } else {
    out.x = seg.a.x;
    out.y = seg.a.y;
    out.z = seg.a.z;
    out.yaw = seg.a.yaw;
    out.pitch = seg.a.pitch;
    if (seg.mood === 'blow') m.blow = smoothstep(0, 0.25, u) * (1 - smoothstep(0.85, 1, u));
  }
  // Mood: the segment's own, eased in.
  const into = Math.max(0, (f - seg.f0) * D);
  m.mood = seg.mood;
  m.moodTime = into;
  m.moodWeight = smoothstep(0, 0.18, into);
}

/**
 * Fill `out` with the pod `tau` seconds into step k (of length `duration`), given the bodies' sample for the
 * same moment (heads turn to where the nodes are now).
 */
export function samplePod(model: StageModel, k: number, tau: number, duration: number, sample: StageSample, out: Swimmer[], calm: boolean): void {
  const S1 = podStationsAt(model, k);
  const S0 = k > 0 ? podStationsAt(model, k - 1) : S1;
  const D = Math.max(1e-3, duration);
  const f = k === 0 ? 1 : clamp01(Math.max(0, tau) / D);
  const script = !calm && k > 0 ? entryAt(model, k).script : [null, null];
  const e = 0.01;
  for (let i = 0; i < POD_SIZE; i++) {
    const m = out[i];
    const a = S0[i], b = S1[i];
    const segs = script[i];
    m.contact = 0;
    m.blow = 0;
    m.bump = 0;
    let arrive = 0;
    if (segs) {
      scriptedAt(model, segs, f, D, i, _pose, m);
    } else {
      const r = freeAt(model, k, i, a, b, f, D, _pose, calm);
      arrive = r.arrive;
      m.mood = b.mood;
      m.moodTime = Math.max(0, (f - arrive) * D);
      m.moodWeight = calm && b.mood !== 'hover' ? smoothstep(arrive, arrive + 0.25, f) * 0.5 : smoothstep(arrive - 0.05, arrive + 0.2, f);
    }
    m.x = _pose.x;
    m.y = _pose.y;
    m.z = _pose.z;
    m.yaw = _pose.yaw;
    m.pitch = _pose.pitch;
    // Speed and bank from the motion a moment either side (pure: the same samples, evaluated again).
    const fa = Math.max(0, f - e), fb = Math.min(1, f + e);
    let speed = 0;
    let turn = 0;
    if (!calm && fb > fa && k > 0) {
      const pa = poseAt(model, i, a, b, segs, k, fa, D, m);
      const ya = pa.yaw, xa = pa.x, y_a = pa.y, za = pa.z;
      const pb = poseAt(model, i, a, b, segs, k, fb, D, m);
      speed = Math.hypot(pb.x - xa, pb.y - y_a, pb.z - za) / ((fb - fa) * D);
      turn = wrapAngle(pb.yaw - ya) / ((fb - fa) * D);
    }
    m.speed = speed;
    m.roll = Math.max(-0.3, Math.min(0.3, -turn * 0.06));
    m.target = b.slot;
    m.glance = b.glance;
    m.active = b.slot >= 0 && b.mood !== 'hover' && b.mood !== 'escort';
    // Eyes: on the node (wherever it is now); on a compare, now and then across to the other one.
    const s = segs ? (segs.find((sg) => sg.haul)?.haul?.slot ?? segs.find((sg) => sg.tap)?.tap?.slot ?? b.slot) : b.slot;
    let lookSlot = s;
    if (b.glance >= 0 && m.mood === 'compare' && Math.floor(m.moodTime / 0.55) % 2 === 1) lookSlot = b.glance;
    if (lookSlot >= 0 && sample.presence[lookSlot] > 0.01) {
      m.look[0] = sample.pos[lookSlot * 3];
      m.look[1] = sample.pos[lookSlot * 3 + 1];
      m.look[2] = sample.pos[lookSlot * 3 + 2];
    } else {
      const [hx, hy, hz] = headingOf(m.yaw, m.pitch);
      m.look[0] = m.x + hx * 4;
      m.look[1] = m.y + hy * 4;
      m.look[2] = m.z + hz * 4;
    }
  }
}

const _tmp: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const _scratch = createPod()[0];

function poseAt(model: StageModel, i: number, a: PodStation, b: PodStation, segs: Seg[] | null, k: number, f: number, D: number, m: Swimmer): Pose {
  void m;
  if (segs) scriptedAt(model, segs, f, D, i, _tmp, _scratch);
  else freeAt(model, k, i, a, b, f, D, _tmp, false);
  return { ..._tmp };
}

import type { TraceEventKind } from '@aqvl/runtime';
import type { StageModel } from '../model/StageModel';
import type { StageSample } from '../model/sampler';
import { clamp01, lerp, smoothstep } from '../motion/spring';

/**
 * The crew: two animals who stand in the gaps in front of the cells a step
 * is about and act out what happens to them. Like the rest of the stage it
 * is a pure function of (step, time into the step): each step has two
 * stations (where each animal ends up, and what it is doing there), and the
 * animal travels from its previous station to the new one at the start of
 * the step. Scrubbing in any order gives the same picture.
 */

export type CastPose = 'idle' | 'inspect' | 'push' | 'tap' | 'present' | 'shrug' | 'point' | 'cheer';
export type CastGait = 'stand' | 'walk' | 'glide' | 'roll';
/** How an animal travels: penguins waddle and belly-slide, pandas shuffle and roll. */
export type CastStyle = 'penguin' | 'panda';

export const CREW_SIZE = 2;
/** Footprint radius of a crew member (collision with cells and with each other). */
export const CAST_RADIUS = 0.36;
/** Facing the camera (the stage camera sits a little to the left). */
export const CAMERA_YAW = -0.16;

export interface Station {
  x: number;
  z: number;
  /** The cell this animal is attending to, or -1. */
  slot: number;
  /** -1: stands left of the cell, +1: right. */
  side: number;
  pose: CastPose;
  /** Facing at rest (radians about y; 0 faces +z, towards the camera). */
  yaw: number;
}

export interface CastMember {
  x: number;
  y: number;
  z: number;
  yaw: number;
  gait: CastGait;
  /** Walk-cycle phase (radians) for walk; roll angle for roll. */
  gaitPhase: number;
  /** 0..1: how far into the travel posture (the dive of a slide, the curl of a roll). */
  gaitWeight: number;
  pose: CastPose;
  poseWeight: number;
  /** Seconds since the pose began (gestures loop on it). */
  poseTime: number;
  prevPose: CastPose;
  prevWeight: number;
  /** The cell attended to (or -1) and the point the head turns to. */
  target: number;
  look: [number, number, number];
  /** True while this animal is one of the step's actors. */
  active: boolean;
  /** Which side of its cell it stands on (-1 left, +1 right): its speech bubble goes that way. */
  side: number;
}

export function createCast(): CastMember[] {
  return Array.from({ length: CREW_SIZE }, () => ({
    x: 0, y: 0, z: 0, yaw: CAMERA_YAW,
    gait: 'stand' as CastGait, gaitPhase: 0, gaitWeight: 0,
    pose: 'idle' as CastPose, poseWeight: 1, poseTime: 0, prevPose: 'idle' as CastPose, prevWeight: 0,
    target: -1, look: [0, 0, 0] as [number, number, number], active: false, side: -1,
  }));
}

/** What the crew does for each kind of step. */
export function poseFor(kind: TraceEventKind): CastPose {
  switch (kind) {
    case 'compare':
      return 'inspect';
    case 'swap':
    case 'move':
      return 'push';
    case 'write':
    case 'link':
    case 'assign':
      return 'tap';
    case 'create':
      return 'present';
    case 'remove':
    case 'discard':
      return 'shrug';
    case 'visit':
    case 'traverse':
    case 'mark':
      return 'point';
    case 'settle':
      return 'cheer';
    default:
      return 'idle';
  }
}

/** How much an animal turns from the camera towards its cell, per pose. */
const TURN: Record<CastPose, number> = {
  idle: 0.2,
  inspect: 0.42,
  push: 0.55,
  tap: 0.45,
  present: 0.15,
  shrug: 0.18,
  point: 0.38,
  cheer: 0.05,
};

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

interface Gap {
  x: number;
  z: number;
}

/** Where an animal stands to attend to cell `s`: in the gap beside it, in front of its index caption. */
function gapOf(model: StageModel, pos: Float32Array, dims: Float32Array, s: number, side: number): Gap {
  const x = pos[s * 3], y = pos[s * 3 + 1], z = pos[s * 3 + 2];
  const hw = dims[s * 3] / 2, hh = dims[s * 3 + 1] / 2, hd = dims[s * 3 + 2] / 2;
  const grounded = y - hh - model.floorY < 0.8;
  const off = grounded ? hw + 0.1 : Math.max(0.36, hw * 0.65);
  return { x: x + side * off, z: z + hd + (grounded ? 1.3 : 0.8) };
}

function station(model: StageModel, pos: Float32Array, dims: Float32Array, s: number, side: number, pose: CastPose): Station {
  const g = gapOf(model, pos, dims, s, side);
  const toward = Math.atan2(pos[s * 3] - g.x, pos[s * 3 + 2] - g.z);
  return { x: g.x, z: g.z, slot: s, side, pose, yaw: lerpAngle(CAMERA_YAW, toward, TURN[pose]) };
}

function resting(st: Station, pose: CastPose, model: StageModel, pos: Float32Array): Station {
  if (st.slot < 0) return { ...st, pose, yaw: CAMERA_YAW };
  const toward = Math.atan2(pos[st.slot * 3] - st.x, pos[st.slot * 3 + 2] - st.z);
  return { ...st, pose, yaw: lerpAngle(CAMERA_YAW, toward, TURN[pose] * 0.6) };
}

const stationCache = new WeakMap<StageModel, Station[][]>();

/** Both stations at step k (computed in order from the start of the run, cached). */
export function stationsAt(model: StageModel, k: number): Station[] {
  let list = stationCache.get(model);
  if (!list) {
    list = [];
    stationCache.set(model, list);
  }
  const last = Math.max(0, Math.min(k, model.frameCount - 1));
  while (list.length <= last) list.push(computeStations(model, list.length, list[list.length - 1]));
  return list[last];
}

function computeStations(model: StageModel, k: number, prev: Station[] | undefined): Station[] {
  if (model.frameCount === 0) return [home(-1.2), home(1.2)];
  const rest = model.rest(k);
  const before = k > 0 ? model.rest(k - 1) : rest;
  const frame = model.frames[k];
  const finale = k > 0 && k === model.frameCount - 1 && !model.trace.error;
  const pose = finale ? 'cheer' : poseFor(frame.event.kind);

  // Where an actor stands this step: its new place, or (removed) the place it left.
  const placeOf = (s: number) => (rest.present[s] ? rest : before);
  const actors: number[] = [];
  for (const id of frame.event.actors) {
    const s = model.slotOf.get(id);
    if (s === undefined || actors.includes(s)) continue;
    if (!rest.present[s] && !before.present[s]) continue;
    actors.push(s);
    if (actors.length === CREW_SIZE) break;
  }

  if (!prev) {
    // The start: the crew waits at either end of the first row.
    let left = -1, right = -1;
    for (let s = 0; s < model.slots.length; s++) {
      if (!rest.present[s]) continue;
      if (left < 0 || rest.pos[s * 3] < rest.pos[left * 3]) left = s;
      if (right < 0 || rest.pos[s * 3] > rest.pos[right * 3]) right = s;
    }
    if (left < 0) {
      const lane = model.laneX();
      return [home(lane.x + 1.4, lane.z + 1.4), home(lane.x + 2.6, lane.z + 1.4)];
    }
    return [station(model, rest.pos, rest.dims, left, -1, 'idle'), station(model, rest.pos, rest.dims, right, 1, 'idle')];
  }

  const next = prev.map((p) => ({ ...p }));
  if (actors.length >= 2) {
    // Two cells: flank them, each animal keeping its side so they never cross.
    const [a, b] = actors;
    const pa = placeOf(a), pb = placeOf(b);
    const ax = pa.pos[a * 3], bx = pb.pos[b * 3];
    const [l, r] = ax < bx || (ax === bx && pa.pos[a * 3 + 2] <= pb.pos[b * 3 + 2]) ? [a, b] : [b, a];
    const order = prev[0].x <= prev[1].x ? [0, 1] : [1, 0];
    next[order[0]] = station(model, placeOf(l).pos, placeOf(l).dims, l, -1, pose);
    next[order[1]] = station(model, placeOf(r).pos, placeOf(r).dims, r, 1, pose);
    return next;
  }
  if (actors.length === 1) {
    const s = actors[0];
    const p = placeOf(s);
    const sx = p.pos[s * 3];
    // The nearer animal attends, on the side it is already on.
    const dist = (st: Station, side: number) => {
      const g = gapOf(model, p.pos, p.dims, s, side);
      return Math.hypot(g.x - st.x, g.z - st.z);
    };
    const sideOf = (st: Station) => (st.x < sx - 1e-3 ? -1 : st.x > sx + 1e-3 ? 1 : st.side || -1);
    const d0 = dist(prev[0], sideOf(prev[0]));
    const d1 = dist(prev[1], sideOf(prev[1]));
    const who = d0 <= d1 ? 0 : 1;
    const other = 1 - who;
    const side = sideOf(prev[who]);
    next[who] = station(model, p.pos, p.dims, s, side, pose);
    // The other one keeps its place (watching), unless that is now in the way.
    const o = prev[other];
    if (Math.hypot(o.x - next[who].x, o.z - next[who].z) < CAST_RADIUS * 3) {
      next[other] = station(model, p.pos, p.dims, s, -side, finale ? 'cheer' : 'idle');
    } else {
      next[other] = resting(o, finale ? 'cheer' : 'idle', model, rest.present[o.slot] ? rest.pos : before.pos);
    }
    return next;
  }
  // Nothing in particular: stay, at ease (or celebrate the end).
  return next.map((st) => resting(st, finale ? 'cheer' : 'idle', model, st.slot >= 0 && rest.present[st.slot] ? rest.pos : before.pos));
}

function home(x: number, z = 1.4): Station {
  return { x, z, slot: -1, side: x < 0 ? -1 : 1, pose: 'idle', yaw: CAMERA_YAW };
}

/** Travel speeds (world units per second at 1x) and when a trip becomes a slide / roll. */
const GAIT = {
  penguin: { walk: 2.4, fast: 5.2, fastFrom: 2.6, stride: 0.17 },
  panda: { walk: 1.7, fast: 3.4, fastFrom: 0.75, stride: 0.2 },
} as const;
/** Radius of a curled-up rolling panda (roll angle = distance / radius, rounded to whole turns). */
export const ROLL_RADIUS = 0.34;

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;
}

/**
 * Fill `out` with the crew `tau` seconds into step k (of length `duration`),
 * given the bodies' sample for the same moment (cells being swapped push an
 * animal out of their way rather than passing through it).
 */
export function sampleCast(
  model: StageModel,
  style: CastStyle,
  k: number,
  tau: number,
  duration: number,
  sample: StageSample,
  out: CastMember[],
  calm: boolean,
): void {
  const S1 = stationsAt(model, k);
  const S0 = k > 0 ? stationsAt(model, k - 1) : S1;
  const D = Math.max(1e-3, duration);
  const t = k === 0 ? D : Math.min(Math.max(0, tau), D);
  const g = GAIT[style];

  for (let i = 0; i < CREW_SIZE; i++) {
    const a = S0[i], b = S1[i], m = out[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.02;
    const fast = dist > g.fastFrom;
    const T = moving ? Math.min(D * 0.62, Math.max(0.28, dist / (fast ? g.fast : g.walk))) : 0;
    const start = i * 0.06;
    const p = moving ? clamp01((t - start) / T) : 1;
    const heading = moving ? Math.atan2(dx, dz) : b.yaw;

    let e: number;
    m.gait = 'stand';
    m.gaitPhase = 0;
    m.gaitWeight = 0;
    m.y = 0;
    if (!moving) {
      e = 1;
    } else if (calm) {
      e = smoothstep(0, 1, p);
    } else if (style === 'penguin' && fast) {
      // Belly slide: a hop forward onto the belly, a long glide, and a pop back up.
      e = smoothstep(0.08, 1, p);
      e = e * e * (3 - 2 * e) * 0.15 + e * 0.85;
      m.gait = 'glide';
      m.gaitWeight = smoothstep(0, 0.14, p) * (1 - smoothstep(0.86, 1, p));
      m.y = 0.12 * Math.sin(Math.PI * clamp01(p / 0.14)) * (p < 0.14 ? 1 : 0);
      m.gaitPhase = p;
    } else if (style === 'panda' && fast) {
      // Roll: curl up, tumble a whole number of turns, uncurl.
      e = easeInOutSine(p);
      const turns = Math.max(1, Math.round(dist / (2 * Math.PI * ROLL_RADIUS)));
      m.gait = 'roll';
      m.gaitWeight = smoothstep(0, 0.12, p) * (1 - smoothstep(0.88, 1, p));
      m.gaitPhase = easeInOutSine(p) * turns * 2 * Math.PI;
    } else {
      e = easeInOutSine(p);
      m.gait = p > 0 && p < 1 ? 'walk' : 'stand';
      m.gaitWeight = smoothstep(0, 0.1, p) * (1 - smoothstep(0.9, 1, p));
      m.gaitPhase = ((e * dist) / g.stride) * Math.PI;
      m.y = Math.abs(Math.sin(m.gaitPhase)) * (style === 'penguin' ? 0.035 : 0.02) * m.gaitWeight;
    }
    m.x = lerp(a.x, b.x, e);
    m.z = lerp(a.z, b.z, e);

    // Facing: towards where it is going while it travels, then settle to the new pose's facing.
    const settle = moving ? smoothstep(0.75, 1, p) : smoothstep(0, Math.min(0.35, D * 0.3), t);
    const base = lerpAngle(a.yaw, b.yaw, settle);
    const travelTurn = moving && !calm ? smoothstep(0, 0.12, p) * (1 - smoothstep(0.8, 1, p)) : 0;
    m.yaw = lerpAngle(base, heading, m.gait === 'roll' ? Math.max(travelTurn, m.gaitWeight) : travelTurn);

    // Pose: the new one begins on arrival; the old one fades out as the trip starts.
    const arrive = moving ? start + T * 0.8 : 0;
    m.pose = b.pose;
    m.poseTime = Math.max(0, t - arrive);
    m.poseWeight = calm && b.pose !== 'idle' ? smoothstep(arrive, arrive + 0.25, t) * 0.5 : smoothstep(arrive - 0.05, arrive + 0.22, t);
    m.prevPose = a.pose;
    m.prevWeight = k === 0 ? 0 : (1 - smoothstep(0, 0.22, t)) * (calm ? 0.5 : 1);
    m.target = b.slot;
    m.active = b.slot >= 0 && b.pose !== 'idle';
    m.side = b.slot >= 0 ? (b.x < (sample.presence[b.slot] > 0.01 ? sample.pos[b.slot * 3] : b.x + b.side) ? -1 : 1) : b.side || -1;

    // Head: towards the cell (wherever it is right now), else straight ahead.
    const s = b.slot;
    if (s >= 0 && sample.presence[s] > 0.01) {
      m.look[0] = sample.pos[s * 3];
      m.look[1] = sample.pos[s * 3 + 1];
      m.look[2] = sample.pos[s * 3 + 2];
    } else {
      m.look[0] = m.x + Math.sin(m.yaw) * 3;
      m.look[1] = model.floorY + 0.6;
      m.look[2] = m.z + Math.cos(m.yaw) * 3;
    }
  }

  resolve(model, sample, out);
}

/** Cells moving through an animal's spot push it forward, out of their way; the two animals never overlap. */
function resolve(model: StageModel, sample: StageSample, out: CastMember[]): void {
  const R = CAST_RADIUS;
  for (const m of out) {
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < sample.nodeCount; s++) {
        if (sample.presence[s] < 0.2) continue;
        const ny = sample.pos[s * 3 + 1], hh = (sample.dims[s * 3 + 1] * sample.presence[s]) / 2;
        if (ny - hh - model.floorY > 0.75) continue; // high enough to stand under
        const hw = (sample.dims[s * 3] * sample.presence[s]) / 2 + R * 0.8;
        const hd = (sample.dims[s * 3 + 2] * sample.presence[s]) / 2 + R;
        const nx = sample.pos[s * 3], nz = sample.pos[s * 3 + 2];
        if (Math.abs(m.x - nx) < hw && m.z > nz - hd && m.z < nz + hd) m.z = nz + hd;
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      let dx = b.x - a.x, dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      if (d >= 2 * R) continue;
      if (d < 1e-4) {
        dx = 1;
        dz = 0;
        d = 1;
      }
      const push = (2 * R - Math.hypot(b.x - a.x, b.z - a.z)) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      b.x += (dx / d) * push;
      b.z += (dz / d) * push;
    }
  }
}

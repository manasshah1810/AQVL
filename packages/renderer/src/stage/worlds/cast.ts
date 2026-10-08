import type { TraceEventKind } from '@aqvl/runtime';
import type { StageModel } from '../model/StageModel';
import type { StageSample } from '../model/sampler';
import { clamp01, lerp, smoothstep } from '../motion/spring';
import { blockAt, contactPoint, iceMotionAt, PERCH_DROP, porterAt, releaseAt, type IceMotion, type Job, type Leg, type PorterPose } from './ice';
import { hasPhysics } from './types';

/**
 * The crew: two animals who stand in the gaps in front of the cells a step
 * is about and act out what happens to them. Like the rest of the stage it
 * is a pure function of (step, time into the step): each step has two
 * stations (where each animal ends up, and what it is doing there), and the
 * animal travels from its previous station to the new one at the start of
 * the step. Scrubbing in any order gives the same picture.
 */

export type CastPose = 'idle' | 'inspect' | 'push' | 'pull' | 'tap' | 'present' | 'shrug' | 'point' | 'cheer' | 'nod' | 'startle';
/** 'push' / 'pull': walking while shoving or tugging a block along the ice. 'climb': up or down a rope or an edge; 'leap': a jump between perches. */
export type CastGait = 'stand' | 'walk' | 'glide' | 'roll' | 'push' | 'pull' | 'climb' | 'leap' | 'tumble' | 'swim';
/** How an animal travels: penguins waddle and belly-slide, pandas shuffle and roll. */
export type CastStyle = 'penguin' | 'panda';

export const CREW_SIZE = 2;
/** Footprint radius of a crew member (collision with cells and with each other). */
export const CAST_RADIUS = 0.44;
/** Facing the camera (the stage camera sits a little to the left). */
export const CAMERA_YAW = -0.16;

export interface Station {
  x: number;
  z: number;
  /** Height of the feet above the floor (0 on the ice; above it when perched on a ledge at an elevated node). */
  y: number;
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
  /** True while a scripted shove carries this animal (it is in contact with a block, or on its way to one). */
  scripted: boolean;
  /** 0..1: how hard it is leaning into a block (the rig bends and strains with it). */
  effort: number;
  /** Climbing: the slope of the climb (radians from vertical). */
  climbSlope: number;
  /** 0..1: how tightly it hugs a ball it is carrying (pandas carrying a new node up a bamboo pole). */
  carry: number;
  /** A rope hangs for a climb (0..1 how much of it shows): its place and the heights of its ends above the floor. */
  rope: number;
  ropeX: number;
  ropeZ: number;
  ropeTop: number;
}

export function createCast(): CastMember[] {
  return Array.from({ length: CREW_SIZE }, () => ({
    x: 0, y: 0, z: 0, yaw: CAMERA_YAW,
    gait: 'stand' as CastGait, gaitPhase: 0, gaitWeight: 0,
    pose: 'idle' as CastPose, poseWeight: 1, poseTime: 0, prevPose: 'idle' as CastPose, prevWeight: 0,
    target: -1, look: [0, 0, 0] as [number, number, number], active: false, side: -1, scripted: false, effort: 0, climbSlope: 0, carry: 0, rope: 0, ropeX: 0, ropeZ: 0, ropeTop: 0,
  }));
}

/** What the crew does for each kind of step. */
export function poseFor(kind: TraceEventKind, relation?: '<' | '>' | '='): CastPose {
  switch (kind) {
    case 'compare':
      // A match is a small win; anything else is looked at hard.
      return relation === '=' ? 'nod' : 'inspect';
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
      return 'startle';
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
  pull: 0.55,
  tap: 0.45,
  present: 0.15,
  shrug: 0.18,
  point: 0.38,
  cheer: 0.05,
  nod: 0.35,
  startle: 0.1,
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
  y: number;
}

/**
 * Where an animal stands to attend to cell `s`: in the gap beside it, in front of its index caption. A cell
 * that floats in the air (a tree's, a graph's) is attended from a ledge beside it, reached by climbing, in
 * the penguin world; elsewhere from the floor beneath it.
 */
function gapOf(model: StageModel, pos: Float32Array, dims: Float32Array, s: number, side: number): Gap {
  const x = pos[s * 3], y = pos[s * 3 + 1], z = pos[s * 3 + 2];
  const hw = dims[s * 3] / 2, hh = dims[s * 3 + 1] / 2, hd = dims[s * 3 + 2] / 2;
  const clearance = y - hh - model.floorY;
  const grounded = clearance < 0.8;
  if (!grounded && hasPhysics(model.world)) {
    // On a ledge at the level of the cell's lower half, beside it, a little towards the camera.
    return { x: x + side * (hw + 0.5), z: z + 0.45, y: Math.max(0, y - model.floorY - PERCH_DROP) };
  }
  const off = grounded ? hw + 0.1 : Math.max(0.36, hw * 0.65);
  return { x: x + side * off, z: z + hd + (grounded ? 1.3 : 0.8), y: 0 };
}

function station(model: StageModel, pos: Float32Array, dims: Float32Array, s: number, side: number, pose: CastPose): Station {
  const g = gapOf(model, pos, dims, s, side);
  const toward = Math.atan2(pos[s * 3] - g.x, pos[s * 3 + 2] - g.z);
  return { x: g.x, z: g.z, y: g.y, slot: s, side, pose, yaw: lerpAngle(CAMERA_YAW, toward, g.y > 0 ? TURN[pose] * 0.5 : TURN[pose]) };
}

function resting(st: Station, pose: CastPose, model: StageModel, pos: Float32Array): Station {
  if (st.slot < 0) return { ...st, pose, yaw: CAMERA_YAW };
  const toward = Math.atan2(pos[st.slot * 3] - st.x, pos[st.slot * 3 + 2] - st.z);
  return { ...st, pose, yaw: lerpAngle(CAMERA_YAW, toward, TURN[pose] * 0.6) };
}

interface Entry {
  stations: Station[];
  /** The crew's scripted shoves in this step (penguin world), or null. */
  script: CrewScript | null;
}

const stationCache = new WeakMap<StageModel, Entry[]>();

function entryAt(model: StageModel, k: number): Entry {
  let list = stationCache.get(model);
  if (!list) {
    list = [];
    stationCache.set(model, list);
  }
  const last = Math.max(0, Math.min(k, model.frameCount - 1));
  while (list.length <= last) list.push(computeEntry(model, list.length, list[list.length - 1]));
  return list[last];
}

/** Both stations at step k (computed in order from the start of the run, cached). */
export function stationsAt(model: StageModel, k: number): Station[] {
  return entryAt(model, k).stations;
}

/** The crew's scripted shoves in step k (null when nothing in the step is pushed). */
export function crewScriptAt(model: StageModel, k: number): CrewScript | null {
  return entryAt(model, k).script;
}

function baseStations(model: StageModel, k: number, prev: Station[] | undefined): Station[] {
  if (model.frameCount === 0) return [home(-1.2), home(1.2)];
  const rest = model.rest(k);
  const before = k > 0 ? model.rest(k - 1) : rest;
  const frame = model.frames[k];
  const finale = k > 0 && k === model.frameCount - 1 && !model.trace.error;
  const pose = finale ? 'cheer' : poseFor(frame.event.kind, frame.event.relation);

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
    const starts = [station(model, rest.pos, rest.dims, left, -1, 'idle'), station(model, rest.pos, rest.dims, right, 1, 'idle')];
    // The pandas begin on the ground, in front of the structure: they climb when a step asks them to.
    if (model.world === 'panda') {
      const f = model.footprint();
      return starts.map((st, i) => (st.y > 0.35 ? { ...home(i === 0 ? f.minX - 0.6 : f.maxX + 0.6, f.maxZ + 1.6), slot: st.slot, side: st.side } : st));
    }
    return starts;
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
  return { x, z, y: 0, slot: -1, side: x < 0 ? -1 : 1, pose: 'idle', yaw: CAMERA_YAW };
}

/** How far a climbing pole stands above the platform that is lashed to it. */
const POLE_ABOVE = 0.9;

/** A fixed pseudo-random number in 0..1 for a seed (steps are pure functions of time, so are their accidents). */
export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Travel speeds (world units per second at 1x) and when a trip becomes a slide / roll. */
const GAIT = {
  penguin: { walk: 2.2, fast: 5.2, fastFrom: 2.8, stride: 0.27 },
  panda: { walk: 1.9, fast: 3.6, fastFrom: 3.4, stride: 0.46 },
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
  const script = !calm && k > 0 ? crewScriptAt(model, k) : null;

  for (let i = 0; i < CREW_SIZE; i++) {
    const a = S0[i], b = S1[i], m = out[i];
    m.scripted = false;
    m.effort = 0;
    m.rope = 0;
    m.climbSlope = 0;
    m.carry = 0;
    const segs = script?.crew[i];
    if (segs && script) {
      sampleScripted(segs, a, clamp01(t / D), D, m, style, model.floorY);
      m.target = b.slot;
      m.active = true;
      const sl = b.slot;
      m.side = sl >= 0 ? (m.x < (sample.presence[sl] > 0.01 ? sample.pos[sl * 3] : b.x) ? -1 : 1) : -1;
      if (sl >= 0 && sample.presence[sl] > 0.01) {
        m.look[0] = sample.pos[sl * 3];
        m.look[1] = sample.pos[sl * 3 + 1];
        m.look[2] = sample.pos[sl * 3 + 2];
      } else {
        m.look[0] = m.x + Math.sin(m.yaw) * 3;
        m.look[1] = model.floorY + 0.6;
        m.look[2] = m.z + Math.cos(m.yaw) * 3;
      }
      continue;
    }
    const dx = b.x - a.x, dz = b.z - a.z;
    // To or from a ledge on a floating cell: along a rope or an edge, or in a leap.
    const climbPath = !calm && (a.y > 0.35 || b.y > 0.35) ? pathBetween(model, k, a, b, style, i, D) : null;
    const dist = climbPath ? climbPath.length : Math.hypot(dx, dz);
    const moving = dist > 0.02;
    const fast = !climbPath && dist > g.fastFrom && (style === 'penguin' || hash01(k * 3.7 + i * 11.3) < 0.6);
    const T = moving ? (climbPath ? Math.min(D * (climbPath.slip ? 0.88 : 0.66), Math.max(climbPath.slip ? 0.8 : 0.34, climbPath.time)) : Math.min(D * 0.62, Math.max(0.28, dist / (fast ? g.fast : g.walk)))) : 0;
    const start = i * 0.06;
    const p = moving ? clamp01((t - start) / T) : 1;
    const heading = moving ? Math.atan2(dx, dz) : b.yaw;

    let e: number;
    m.gait = 'stand';
    m.gaitPhase = 0;
    m.gaitWeight = 0;
    m.y = b.y;
    m.rope = 0;
    if (!moving) {
      e = 1;
    } else if (climbPath) {
      e = easeInOutSine(p);
      samplePath(climbPath, e, p, g.stride, m);
    } else if (calm) {
      e = smoothstep(0, 1, p);
      m.y = lerp(a.y, b.y, e);
    } else if (style === 'penguin' && fast) {
      // Belly slide: a hop forward onto the belly, a long glide, and a pop back up.
      e = smoothstep(0.08, 1, p);
      e = e * e * (3 - 2 * e) * 0.15 + e * 0.85;
      m.gait = 'glide';
      m.gaitWeight = smoothstep(0, 0.14, p) * (1 - smoothstep(0.86, 1, p));
      m.y = 0.12 * Math.sin(Math.PI * clamp01(p / 0.14)) * (p < 0.14 ? 1 : 0);
      m.gaitPhase = p;
    } else if (style === 'panda' && fast) {
      // A long trip, now and then: curl up, tumble a whole number of turns, uncurl.
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
      m.y = style === 'penguin' ? Math.abs(Math.sin(m.gaitPhase)) * 0.035 * m.gaitWeight : 0;
    }
    if (!climbPath || !moving) {
      m.x = lerp(a.x, b.x, e);
      m.z = lerp(a.z, b.z, e);
    }
    if (!moving) m.y = b.y;
    // Perched on a bamboo platform: the pole it is lashed to stays up for as long as it is there.
    if (m.y > 0.3 && m.rope === 0 && !climbPath) {
      m.rope = 1;
      m.ropeX = m.x;
      m.ropeZ = m.z;
      m.ropeTop = m.y + POLE_ABOVE;
    }

    // Facing: towards where it is going while it travels, then settle to the new pose's facing.
    const settle = moving ? smoothstep(0.75, 1, p) : smoothstep(0, Math.min(0.35, D * 0.3), t);
    const base = lerpAngle(a.yaw, b.yaw, settle);
    const travelTurn = moving && !calm ? smoothstep(0, 0.12, p) * (1 - smoothstep(0.8, 1, p)) : 0;
    m.yaw = lerpAngle(base, heading, m.gait === 'roll' ? Math.max(travelTurn, m.gaitWeight) : travelTurn);
    const gaitNow = m.gait as CastGait;
    if (climbPath && moving && (gaitNow === 'climb' || gaitNow === 'leap')) {
      // Belly to the rope (and to the camera): a little turn the way it climbs.
      m.yaw = lerpAngle(CAMERA_YAW, heading, gaitNow === 'leap' ? 0.7 : 0.25 * Math.min(1, m.climbSlope * 1.6));
    }

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

/**
 * Cells moving through an animal's spot push it out of their way (by the shortest way, so it is carried
 * along rather than thrown across them); the two animals never overlap.
 */
function resolve(model: StageModel, sample: StageSample, out: CastMember[]): void {
  const R = CAST_RADIUS;
  for (const m of out) {
    if (m.scripted) continue; // its script already keeps clear of the cells
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < sample.nodeCount; s++) {
        if (sample.presence[s] < 0.1) continue;
        const ny = sample.pos[s * 3 + 1], hh = (sample.dims[s * 3 + 1] * sample.presence[s]) / 2;
        if (ny - hh - model.floorY > 0.75 || m.y > 0.3) continue; // high enough to stand under
        // A cell that is still growing (or shrinking) claims its ground gradually.
        const claim = smoothstep(0.1, 0.5, sample.presence[s]);
        const hw = (sample.dims[s * 3] * sample.presence[s]) / 2 + R * 0.8 * claim;
        const hd = (sample.dims[s * 3 + 2] * sample.presence[s]) / 2 + R * claim;
        const nx = sample.pos[s * 3], nz = sample.pos[s * 3 + 2];
        const dx = m.x - nx, dz = m.z - nz;
        if (Math.abs(dx) >= hw || Math.abs(dz) >= hd) continue;
        // Out by whichever way is shortest: sideways, or forward (a cell never pushes an animal back through the row).
        const sideways = hw - Math.abs(dx);
        const forward = nz + hd - m.z;
        const backward = m.z - (nz - hd);
        if (forward <= sideways && forward <= backward) m.z = nz + hd;
        else if (sideways <= backward) m.x = nx + (dx >= 0 ? hw : -hw);
        else m.z = nz - hd;
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      let dx = b.x - a.x, dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      const apart = 2 * R;
      if (d >= apart) continue;
      if (d < 1e-4) {
        dx = 1;
        dz = 0;
        d = 1;
      }
      const push = (apart - Math.hypot(b.x - a.x, b.z - a.z)) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      b.x += (dx / d) * push;
      b.z += (dz / d) * push;
    }
  }
}

// ── Scripted shoves (penguin world) ────────────────────────────────────────
//
// A step in which blocks are shoved along the ice (see ice.ts) gives each
// animal that does the shoving a script: walk to the block, lean into it
// while it accelerates, let go (or keep tugging), step back and watch it
// slide. Positions in contact come from the block itself, so the two can
// never drift apart; before and after, the animal travels between contacts.

interface Seg {
  /** Step fractions. */
  f0: number;
  f1: number;
  kind: 'travel' | 'contact' | 'hold' | 'porter';
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Facing at the start and end of a travel / hold. */
  yawA: number;
  yawB: number;
  /** Distance walked in the segments before this one (the waddle carries on across them). */
  d0: number;
  pose: CastPose;
  job?: Job;
  leg?: Leg;
}

export interface CrewScript {
  motion: IceMotion;
  /** Per crew member: its segments (covering the whole step), or undefined when it has no part in the shoving. */
  crew: (Seg[] | undefined)[];
}

function computeEntry(model: StageModel, k: number, prev: Entry | undefined): Entry {
  const base = baseStations(model, k, prev?.stations);
  if (!hasPhysics(model.world) || !prev || k === 0) return { stations: base, script: null };
  const motion = iceMotionAt(model, k);
  if (motion) return scriptEntry(model, motion, prev.stations, base);
  return { stations: base, script: null };
}

const _c: [number, number] = [0, 0];

/** Which animal takes which job: left to right, or (one job) the nearer. */
function assign(jobs: Job[], at: { x: number; z: number; y?: number }[]): number[] {
  const startOf = (j: Job): [number, number] => {
    if (j.carry) return [j.carry.stand[0], j.carry.stand[1]];
    contactPoint(j.legs[0], j.legs[0].ax, j.legs[0].az, _c);
    return [_c[0], _c[1]];
  };
  const xOf = (j: Job) => (j.carry ? j.carry.tx : j.legs[0].ax);
  if (jobs.length >= 2) {
    const order = jobs.map((_, i) => i).sort((p, q) => xOf(jobs[p]) - xOf(jobs[q]));
    const crew = at[0].x <= at[1].x ? [0, 1] : [1, 0];
    const out: number[] = [-1, -1];
    out[crew[0]] = order[0];
    out[crew[1]] = order[1];
    return out;
  }
  const [sx, sz] = startOf(jobs[0]);
  // The nearer animal does it, and one that is up on a perch is a long way from the ground: the one down below takes it.
  const d0 = Math.hypot(at[0].x - sx, at[0].z - sz) + 1.5 * (at[0].y ?? 0);
  const d1 = Math.hypot(at[1].x - sx, at[1].z - sz) + 1.5 * (at[1].y ?? 0);
  return d0 <= d1 ? [0, -1] : [-1, 0];
}

function facing(leg: Leg): number {
  return leg.kind === 'push' ? Math.atan2(leg.dx, leg.dz) : Math.atan2(-leg.dx, -leg.dz);
}

function scriptEntry(model: StageModel, motion: IceMotion, prev: Station[], base: Station[]): Entry {
  const to = model.rest(motion.k);
  const assigned = assign(motion.jobs, prev);
  const crew: (Seg[] | undefined)[] = [undefined, undefined];
  const stations = base.map((st) => ({ ...st }));
  const touched: { x: number; z: number }[] = [];

  assigned.forEach((ji, i) => {
    if (ji < 0) return;
    const job = motion.jobs[ji];
    const segs: Seg[] = [];
    let cursor = 0;
    let px = prev[i].x, pz = prev[i].z, yaw = prev[i].yaw;
    let walked = 0;
    const blk = { x: 0, z: 0, vx: 0, vz: 0, leg: -1 };
    if (job.carry && job.carry.porter) {
      // A panda: makes the ball in its arms, walks it to the foot of a pole, climbs, and sets it in place.
      const c = job.carry;
      const pt = c.porter!;
      touched.push({ x: c.stand[0], z: c.stand[1] }, { x: pt.base[0], z: pt.base[1] }, { x: prev[i].x, z: prev[i].z });
      segs.push({ f0: 0, f1: c.made[0], kind: 'travel', ax: px, az: pz, bx: c.stand[0], bz: c.stand[1], yawA: yaw, yawB: CAMERA_YAW, d0: 0, pose: 'idle' });
      segs.push({ f0: c.made[0], f1: 1, kind: 'porter', ax: c.stand[0], az: c.stand[1], bx: pt.base[0], bz: pt.base[1], yawA: CAMERA_YAW, yawB: CAMERA_YAW, d0: Math.hypot(c.stand[0] - px, c.stand[1] - pz), pose: 'present', job });
      crew[i] = segs;
      stations[i] = { x: pt.base[0], z: pt.base[1], y: pt.perch, slot: job.slot, side: pt.base[0] < c.tx ? -1 : 1, pose: 'point', yaw: CAMERA_YAW };
      return;
    }
    if (job.carry) {
      // To the forge, hands up as the ball grows between the flippers, then a point after it as the eagle takes it.
      const [fx, fz] = job.carry.stand;
      const forged = job.carry.grab;
      touched.push({ x: fx, z: fz }, { x: prev[i].x, z: prev[i].z });
      segs.push({ f0: 0, f1: job.carry.made[0] + 0.04, kind: 'travel', ax: px, az: pz, bx: fx, bz: fz, yawA: yaw, yawB: CAMERA_YAW, d0: 0, pose: 'idle' });
      segs.push({ f0: job.carry.made[0] + 0.04, f1: forged, kind: 'hold', ax: fx, az: fz, bx: fx, bz: fz, yawA: CAMERA_YAW, yawB: CAMERA_YAW, d0: Math.hypot(fx - px, fz - pz), pose: 'present' });
      segs.push({ f0: forged, f1: 1, kind: 'hold', ax: fx, az: fz, bx: fx, bz: fz, yawA: CAMERA_YAW, yawB: CAMERA_YAW, d0: Math.hypot(fx - px, fz - pz), pose: 'point' });
      crew[i] = segs;
      stations[i] = { x: fx, z: fz, y: 0, slot: job.slot, side: fx < job.carry.tx ? -1 : 1, pose: 'point', yaw: CAMERA_YAW };
      return;
    }
    job.legs.forEach((leg, li) => {
      contactPoint(leg, leg.ax, leg.az, _c);
      const cx = _c[0], cz = _c[1];
      const face = facing(leg);
      const first = li === 0;
      if (leg.t0 > cursor + 1e-4) {
        segs.push({ f0: cursor, f1: leg.t0, kind: 'travel', ax: px, az: pz, bx: cx, bz: cz, yawA: yaw, yawB: face, d0: walked, pose: first && job.grow ? 'present' : 'idle' });
        walked += Math.hypot(cx - px, cz - pz);
      }
      touched.push({ x: cx, z: cz });
      const rel = releaseAt(leg);
      segs.push({ f0: leg.t0, f1: rel, kind: 'contact', ax: cx, az: cz, bx: cx, bz: cz, yawA: face, yawB: face, d0: walked, pose: leg.kind, job, leg });
      // Where it stands when it lets go (or when the tugged block has stopped).
      blockAt({ slot: job.slot, legs: [leg] }, rel, blk);
      contactPoint(leg, blk.x, blk.z, _c);
      walked += Math.hypot(_c[0] - cx, _c[1] - cz);
      touched.push({ x: _c[0], z: _c[1] }, { x: leg.bx, z: leg.bz });
      px = _c[0];
      pz = _c[1];
      yaw = face;
      cursor = rel;
    });
    const last = job.legs[job.legs.length - 1];
    if (to.present[job.slot] && !job.fade) {
      // Having shoved it, the animal steps back and aside to watch it settle (and to show its face).
      const side = px < last.bx ? -1 : 1;
      const st = station(model, to.pos, to.dims, job.slot, side, 'idle');
      const settleEnd = Math.min(1, Math.max(cursor + 0.1, 0.95));
      segs.push({ f0: cursor, f1: settleEnd, kind: 'travel', ax: px, az: pz, bx: st.x, bz: st.z, yawA: yaw, yawB: st.yaw, d0: walked, pose: 'idle' });
      walked += Math.hypot(st.x - px, st.z - pz);
      touched.push({ x: st.x, z: st.z });
      if (settleEnd < 1) segs.push({ f0: settleEnd, f1: 1, kind: 'hold', ax: st.x, az: st.z, bx: st.x, bz: st.z, yawA: st.yaw, yawB: st.yaw, d0: walked, pose: 'idle' });
      crew[i] = segs;
      stations[i] = { ...st, pose: 'idle' };
      return;
    }
    segs.push({ f0: cursor, f1: 1, kind: 'hold', ax: px, az: pz, bx: px, bz: pz, yawA: yaw, yawB: yaw, d0: walked, pose: 'idle' });
    crew[i] = segs;
    stations[i] = { x: px, z: pz, y: 0, slot: job.slot, side: px < last.bx ? -1 : 1, pose: 'idle', yaw };
  });

  // An animal with no part in it keeps out of the way.
  const near = 1.15 + CAST_RADIUS;
  if (touched.length > 0) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const j of motion.jobs) {
      for (const leg of j.legs) {
        x0 = Math.min(x0, leg.ax, leg.bx); x1 = Math.max(x1, leg.ax, leg.bx);
        z0 = Math.min(z0, leg.az, leg.bz); z1 = Math.max(z1, leg.az, leg.bz);
      }
    }
    for (const t of touched) {
      x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x);
      z0 = Math.min(z0, t.z); z1 = Math.max(z1, t.z);
    }
    for (let i = 0; i < CREW_SIZE; i++) {
      if (crew[i]) continue;
      const st = stations[i];
      if (st.x > x0 - near && st.x < x1 + near && st.z > z0 - near && st.z < z1 + near) {
        const left = st.x - (x0 - near), right = x1 + near - st.x;
        stations[i] = { ...st, x: left < right ? x0 - near : x1 + near, pose: 'idle' };
      }
      stations[i] = { ...stations[i], pose: 'idle' };
    }
  }
  return { stations, script: { motion, crew } };
}

function easeInOut(x: number): number {
  return -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;
}

const _blk = { x: 0, z: 0, vx: 0, vz: 0, leg: -1 };
const GLIDE_SPEED = 4.6;

/** Fills one crew member's body for a scripted step at step fraction f. */
function sampleScripted(segs: Seg[], start: Station, f: number, D: number, m: CastMember, style: CastStyle, floorY: number): void {
  let si = segs.length - 1;
  for (let i = 0; i < segs.length; i++) {
    if (f < segs[i].f1) {
      si = i;
      break;
    }
  }
  const seg = segs[si];
  const stride = GAIT[style].stride;
  const panda = style === 'panda';
  const len = Math.max(1e-4, seg.f1 - seg.f0);
  const u = clamp01((f - seg.f0) / len);
  m.scripted = true;
  m.gait = 'stand';
  m.gaitWeight = 0;
  m.gaitPhase = 0;
  m.y = 0;
  m.effort = 0;

  if (seg.kind === 'travel') {
    const dist = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
    const speed = dist / (len * D);
    const glide = panda ? speed > 5.2 && dist > 2.4 : speed > GLIDE_SPEED && dist > 1.5;
    let e = easeInOut(u);
    if (glide && !panda) {
      e = smoothstep(0.06, 1, u);
      e = e * e * (3 - 2 * e) * 0.15 + e * 0.85;
    }
    m.x = lerp(seg.ax, seg.bx, e);
    m.z = lerp(seg.az, seg.bz, e);
    const heading = dist > 0.05 ? Math.atan2(seg.bx - seg.ax, seg.bz - seg.az) : seg.yawB;
    const toHeading = lerpAngle(seg.yawA, heading, smoothstep(0, 0.2, u));
    m.yaw = lerpAngle(toHeading, seg.yawB, smoothstep(0.62, 1, u));
    if (dist > 0.04) {
      if (glide && panda) {
        // A long dash: curled up and tumbling along.
        m.gait = 'roll';
        m.gaitWeight = smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u));
        m.gaitPhase = e * Math.max(1, Math.round(dist / (2 * Math.PI * ROLL_RADIUS))) * 2 * Math.PI;
        m.yaw = lerpAngle(m.yaw, heading, m.gaitWeight);
      } else if (glide) {
        m.gait = 'glide';
        m.gaitWeight = smoothstep(0, 0.14, u) * (1 - smoothstep(0.86, 1, u));
        m.gaitPhase = u;
      } else {
        m.gait = 'walk';
        m.gaitWeight = smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u));
        m.gaitPhase = ((seg.d0 + e * dist) / stride) * Math.PI;
      }
    }
  } else if (seg.kind === 'contact' && seg.job && seg.leg) {
    blockAt({ slot: seg.job.slot, legs: [seg.leg] }, f, _blk);
    contactPoint(seg.leg, _blk.x, _blk.z, _c);
    m.x = _c[0];
    m.z = _c[1];
    m.yaw = seg.yawA;
    const speed = Math.hypot(_blk.vx, _blk.vz);
    const moving = speed > 0.4;
    const walked = Math.hypot(m.x - seg.ax, m.z - seg.az);
    // Faster than an animal can run: it throws itself after the block on its belly.
    m.gait = !moving ? 'stand' : speed > 6.5 && !panda ? 'glide' : seg.leg.kind;
    m.gaitWeight = moving ? 1 : 0;
    m.gaitPhase = ((seg.d0 + walked) / (stride * 0.8)) * Math.PI;
    // Straining: hardest while it is accelerating the block.
    const accel = seg.leg.kind === 'push' ? 1 : smoothstep(0, 0.2, u) * (1 - smoothstep(0.55, 1, u)) * 0.8 + 0.2;
    m.effort = accel;
  } else if (seg.kind === 'porter' && seg.job?.carry) {
    samplePorter(seg.job.carry, f, floorY, stride, seg.d0, m);
  } else {
    m.x = seg.ax;
    m.z = seg.az;
    m.yaw = seg.yawB;
  }
  // Coming down from a perch (the step before ended on a platform): down the pole as the trip starts.
  if (si === 0 && seg.kind === 'travel' && start.y > 0.35) {
    const down = easeInOut(clamp01(u * 1.15));
    m.y = start.y * (1 - down);
    if (down < 1) {
      m.rope = 1 - smoothstep(0.7, 1, down);
      m.ropeX = start.x;
      m.ropeZ = start.z;
      m.ropeTop = start.y + POLE_ABOVE;
      m.x = lerp(start.x, m.x, smoothstep(0.55, 1, down));
      m.z = lerp(start.z, m.z, smoothstep(0.55, 1, down));
      m.gait = 'climb';
      m.gaitWeight = 1;
      m.gaitPhase = down * start.y * 9;
      m.climbSlope = 0;
    }
  }

  // Pose: the segment's own, eased in over a moment; the one before it fades out.
  if (seg.kind === 'porter') {
    // Arms round the ball the whole way up: the carry weight does it, the pose only sets the ball in place.
    m.prevPose = 'idle';
    m.prevWeight = 0;
    return;
  }
  const before = si > 0 ? segs[si - 1].pose : start.pose;
  const intoSeg = Math.max(0, (f - seg.f0) * D);
  const w = smoothstep(0, 0.14, intoSeg);
  m.pose = seg.pose;
  m.poseTime = intoSeg;
  m.poseWeight = seg.pose === 'idle' && before === 'idle' ? 1 : w;
  m.prevPose = before;
  m.prevWeight = seg.pose === before ? 0 : 1 - w;
}

const _pp: PorterPose = { x: 0, y: 0, z: 0, phase: 'make', u: 0 };

/** A panda carrying a new node: forging it in its arms, walking to the pole, climbing it, setting the ball in place. */
function samplePorter(c: NonNullable<Job['carry']>, f: number, floorY: number, stride: number, d0: number, m: CastMember): void {
  porterAt(c, f, _pp);
  const pt = c.porter!;
  m.x = _pp.x;
  m.y = _pp.y;
  m.z = _pp.z;
  m.yaw = CAMERA_YAW;
  m.gait = 'stand';
  m.gaitWeight = 0;
  m.gaitPhase = 0;
  m.rope = 0;
  m.effort = 0;
  // Arms round the ball from the moment it starts to form until it leaves them.
  const made = smoothstep(c.made[0], c.made[0] + (c.made[1] - c.made[0]) * 0.8, f);
  const placed = _pp.phase === 'place' ? smoothstep(0, 0.4, _pp.u) : 0;
  m.carry = made * (1 - placed);
  m.pose = _pp.phase === 'place' ? 'present' : 'idle';
  m.poseTime = _pp.phase === 'place' ? _pp.u * 0.4 : 0;
  m.poseWeight = _pp.phase === 'place' ? smoothstep(0, 0.2, _pp.u) : 0;
  void floorY;
  if (_pp.phase === 'walk') {
    const dist = Math.hypot(pt.base[0] - c.stand[0], pt.base[1] - c.stand[1]);
    m.gait = 'walk';
    m.gaitWeight = smoothstep(0, 0.15, _pp.u) * (1 - smoothstep(0.85, 1, _pp.u));
    m.gaitPhase = ((d0 + _pp.u * _pp.u * (3 - 2 * _pp.u) * dist) / stride) * Math.PI;
    m.yaw = lerpAngle(CAMERA_YAW, Math.atan2(pt.base[0] - c.stand[0], pt.base[1] - c.stand[1]), 0.5 * m.gaitWeight);
  } else if (_pp.phase === 'climb') {
    m.gait = 'climb';
    m.gaitWeight = 1;
    m.gaitPhase = _pp.y * 9;
    m.climbSlope = 0;
  }
  if (_pp.phase === 'climb' || _pp.phase === 'hold' || _pp.phase === 'place') {
    m.rope = _pp.phase === 'climb' ? smoothstep(0, 0.2, _pp.u) : 1;
    m.ropeX = pt.base[0];
    m.ropeZ = pt.base[1];
    m.ropeTop = pt.perch + POLE_ABOVE;
  }
}

// ── Up and down: ropes, edges and leaps ────────────────────────────────────

interface PathLeg {
  kind: 'walk' | 'climb' | 'leap';
  ax: number;
  az: number;
  ay: number;
  bx: number;
  bz: number;
  by: number;
  len: number;
}

interface CrewPath {
  legs: PathLeg[];
  length: number;
  /** Seconds the whole trip takes. */
  time: number;
  /** A rope hangs for this climb (not when the animal climbs along an edge that is already there). */
  rope: { x: number; z: number; top: number } | null;
  /** A panda loses its grip at this fraction of the climb, falls to this side of the pole's foot, and starts again. */
  slip: { at: number; side: number } | null;
  /** The pole stays (the animal ends on a platform lashed to it). */
  keepRope: boolean;
  /** A panda: it settles into a stand as it arrives instead of staying in its climbing pose. */
  panda: boolean;
}

const CLIMB_SPEED = 4.6;
const WALK_SPEED = 2.6;
const LEAP_TIME = 0.5;

function connected(model: StageModel, k: number, sa: number, sb: number): boolean {
  if (sa < 0 || sb < 0 || k < 0) return false;
  const rest = model.rest(k);
  for (let e = 0; e < model.edgeSlots.length; e++) {
    if (!rest.edgePresent[e]) continue;
    const f = rest.edgeFrom[e], t = rest.edgeTo[e];
    if ((f === sa && t === sb) || (f === sb && t === sa)) return true;
  }
  return false;
}

/** How an animal gets from one station to another when either is on a ledge. */
function pathBetween(model: StageModel, k: number, a: Station, b: Station, style: CastStyle, who: number, duration: number): CrewPath | null {
  const leg = (kind: PathLeg['kind'], ax: number, az: number, ay: number, bx: number, bz: number, by: number): PathLeg => ({
    kind, ax, az, ay, bx, bz, by, len: Math.hypot(bx - ax, bz - az, by - ay),
  });
  const panda = style === 'panda';
  const legs: PathLeg[] = [];
  let rope: CrewPath['rope'] = null;
  let slip: CrewPath['slip'] = null;
  const aHigh = a.y > 0.35, bHigh = b.y > 0.35;
  if (aHigh && bHigh) {
    if (connected(model, k, a.slot, b.slot) || connected(model, k - 1, a.slot, b.slot)) legs.push(leg('climb', a.x, a.z, a.y, b.x, b.z, b.y));
    else legs.push(leg('leap', a.x, a.z, a.y, b.x, b.z, b.y));
  } else if (bHigh) {
    // Up the pole (pandas) or rope (penguins) that stands by the ledge.
    legs.push(leg('walk', a.x, a.z, a.y, b.x, b.z, 0), leg('climb', b.x, b.z, 0, b.x, b.z, b.y));
    rope = { x: b.x, z: b.z, top: b.y + (panda ? POLE_ABOVE : 1.2) };
    // Now and then a panda loses its grip on the way up, tumbles to the ground, shakes itself and goes again.
    // (Only when the step is long enough and the pole short enough for the fall and the second try to fit without a scramble.)
    if (panda && duration >= 0.95 && b.y > 1.1 && b.y < 5 && hash01(k * 9.31 + who * 4.7 + b.x * 1.3) < SLIP_CHANCE) {
      slip = { at: 0.5 + 0.2 * hash01(k * 2.9 + who), side: hash01(k * 5.3 + who * 2.1) < 0.5 ? -1 : 1 };
    }
  } else {
    legs.push(leg('climb', a.x, a.z, a.y, a.x, a.z, 0), leg('walk', a.x, a.z, 0, b.x, b.z, b.y));
    rope = { x: a.x, z: a.z, top: a.y + (panda ? POLE_ABOVE : 1.2) };
  }
  const length = legs.reduce((sum, l) => sum + l.len, 0);
  if (length < 0.02) return null;
  let time = legs.reduce((sum, l) => sum + (l.kind === 'climb' ? l.len / CLIMB_SPEED : l.kind === 'leap' ? LEAP_TIME : l.len / WALK_SPEED), 0);
  if (slip) time += 0.9;
  return { legs, length, time, rope, slip, keepRope: panda && bHigh, panda };
}

/** How often a panda slips on the way up a pole (the slip is a pure function of the step, so it is the same every time it is played). */
const SLIP_CHANCE = 0.18;

/** Places the animal a fraction e (eased) of the way along its path. */
function samplePath(path: CrewPath, e: number, p: number, stride: number, m: CastMember): void {
  if (path.slip) {
    sampleSlip(path, e, p, stride, m);
    return;
  }
  walkPath(path, e, p, stride, m);
}

function walkPath(path: CrewPath, e: number, p: number, stride: number, m: CastMember): void {
  let remaining = e * path.length;
  let done = 0;
  for (let i = 0; i < path.legs.length; i++) {
    const l = path.legs[i];
    if (remaining <= l.len + 1e-9 || i === path.legs.length - 1) {
      const u = l.len > 1e-6 ? clamp01(remaining / l.len) : 1;
      m.x = lerp(l.ax, l.bx, u);
      m.z = lerp(l.az, l.bz, u);
      m.y = lerp(l.ay, l.by, u);
      const weight = smoothstep(0, 0.1, p) * (1 - smoothstep(0.9, 1, p));
      m.gaitWeight = weight;
      if (l.kind === 'walk') {
        m.gait = p > 0 && p < 1 ? 'walk' : 'stand';
        m.gaitPhase = ((done + remaining) / stride) * Math.PI;
      } else if (l.kind === 'climb') {
        m.gait = 'climb';
        m.gaitPhase = ((done + remaining) / 0.34) * Math.PI;
        const horiz = Math.hypot(l.bx - l.ax, l.bz - l.az);
        const vert = Math.abs(l.by - l.ay);
        m.climbSlope = Math.atan2(horiz, Math.max(1e-3, vert));
        m.gaitWeight = path.panda && i === path.legs.length - 1 ? 1 - smoothstep(0.88, 1, p) : 1;
        if (path.panda && p >= 1) m.gait = 'stand';
      } else {
        // A leap: out over the gap with the flippers up, and down on the other ledge.
        m.gait = 'leap';
        m.gaitPhase = u;
        m.y += Math.sin(Math.PI * u) * (0.7 + 0.12 * l.len);
        m.gaitWeight = Math.sin(Math.PI * u);
      }
      if (path.rope) {
        m.rope = smoothstep(0, 0.2, p) * (path.keepRope ? 1 : 1 - smoothstep(0.97, 1, p));
        m.ropeX = path.rope.x;
        m.ropeZ = path.rope.z;
        m.ropeTop = path.rope.top;
      } else if (path.panda) {
        // Along a branch from one perch to another: the pole of the one it leaves goes, the pole of the one it reaches comes.
        const first = path.legs[0], last = path.legs[path.legs.length - 1];
        const arriving = last.by > 0.35 ? smoothstep(0.8, 1, p) : 0;
        const leaving = first.ay > 0.35 ? 1 - smoothstep(0, 0.2, p) : 0;
        if (arriving >= leaving && arriving > 0) {
          m.rope = arriving;
          m.ropeX = last.bx;
          m.ropeZ = last.bz;
          m.ropeTop = last.by + POLE_ABOVE;
        } else if (leaving > 0) {
          m.rope = leaving;
          m.ropeX = first.ax;
          m.ropeZ = first.az;
          m.ropeTop = first.ay + POLE_ABOVE;
        }
      }
      return;
    }
    remaining -= l.len;
    done += l.len;
  }
}

/**
 * A climb with a slip in it: up the pole, a lost grip at `slip.at` of the way, a flailing fall (a tumble) to
 * the ground beside the foot of the pole, a moment sitting up dazed, then the climb again, all of it in the
 * one step. Harmless and brief; the step's own work (the colours, the values) carries on regardless.
 */
function sampleSlip(path: CrewPath, e: number, p: number, stride: number, m: CastMember): void {
  const slip = path.slip!;
  const climb = path.legs[path.legs.length - 1];
  const wl = path.length - climb.len;
  const hSlip = climb.len * slip.at;
  const T1 = 0.42, T2 = 0.58, T3 = 0.72;
  const rope = path.rope!;
  m.rope = smoothstep(0, 0.1, p) * (path.keepRope ? 1 : 1 - smoothstep(0.97, 1, p));
  m.ropeX = rope.x;
  m.ropeZ = rope.z;
  m.ropeTop = rope.top;
  void e;
  if (p < T1) {
    // Up to the slip: eased so it arrives slowing, as if the grip is going.
    const q = p / T1;
    walkPath(path, ((wl + hSlip) * (q * (2 - q))) / path.length, p, stride, m);
    m.gaitWeight = 1;
    return;
  }
  const baseX = climb.bx, baseZ = climb.bz;
  const fallX = baseX + slip.side * 0.55, fallZ = baseZ + 0.7;
  if (p < T2) {
    // The fall: arms flailing, then a tumble, landing in a heap.
    const u = (p - T1) / (T2 - T1);
    m.gait = 'tumble';
    m.gaitWeight = 1;
    m.gaitPhase = u * 0.999;
    m.y = hSlip * Math.max(0, 1 - u * u);
    m.x = lerp(baseX, fallX, smoothstep(0.1, 1, u));
    m.z = lerp(baseZ, fallZ, smoothstep(0.1, 1, u));
    m.climbSlope = 0;
    return;
  }
  if (p < T3) {
    // Sitting up, dazed, a shake of the head.
    const u = (p - T2) / (T3 - T2);
    m.gait = 'tumble';
    m.gaitWeight = 1;
    m.gaitPhase = 1 + u;
    m.y = 0;
    m.x = fallX;
    m.z = fallZ;
    return;
  }
  // Up again, from the foot of the pole, a little quicker than before.
  const u = (p - T3) / (1 - T3);
  const back = smoothstep(0, 0.28, u);
  const q = u * (2 - u) * 0.6 + u * 0.4;
  m.x = lerp(fallX, baseX, back);
  m.z = lerp(fallZ, baseZ, back);
  m.y = climb.by * smoothstep(0.18, 1, q);
  m.gait = back < 1 ? 'walk' : 'climb';
  m.gaitWeight = 1;
  m.gaitPhase = back < 1 ? u * 18 : m.y * 9;
  m.climbSlope = 0;
}

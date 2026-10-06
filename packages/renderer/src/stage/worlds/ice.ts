import type { StageModel, RestFrame } from '../model/StageModel';
import { clamp01, easeInCubic, smoothstep } from '../motion/spring';
import { hasPhysics, type StageWorld } from './types';

/**
 * Ice physics for the penguin world. Blocks standing on the ice do not hop
 * or teleport: a penguin shoves (or tugs) them, and they slide, slow down
 * with friction and stop. Everything is a pure function of the step's
 * fraction `f` (0..1), like the rest of the stage, so scrubbing in any
 * order shows the same picture.
 *
 * A shove is described by a Leg: from rest at (ax, az) the penguin leans
 * into the block from t0 to t1 (the block accelerates with it), lets go, and
 * the block glides on the ice with exponentially falling speed until it
 * comes to rest at (bx, bz) at t2. The block's motion is the single source
 * of truth: the penguin's contact position (cast.ts) is computed from it.
 */

/** Friction of the ice: speed falls like exp(-KAPPA * x) over a glide of x (in step fractions). */
export const KAPPA = 5.2;
/** Packed earth and leaf litter grip harder than ice: a pushed block rolls on a little, then settles. */
export const EARTH_KAPPA = 8.2;

/** The friction a world's ground has. */
export function frictionOf(world: StageWorld): number {
  return world === 'panda' ? EARTH_KAPPA : KAPPA;
}
/** Penguin chest to block face when they touch (penguin centre to block surface). */
export const REACH = 0.5;
/** Radius of the circle a penguin needs free to stand in. */
const STANCE = 0.46;
/** Blocks must be this close to the floor to count as standing on the ice. */
const GROUND_CLEARANCE = 0.55;

export interface Leg {
  slot: number;
  /** 'push': the penguin stands behind the block and leans into it; 'pull': it stands ahead of it, hooked on, walking backwards. */
  kind: 'push' | 'pull';
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Shove begins; end of the acceleration (the penguin lets go of a pushed block); the block is at rest. */
  t0: number;
  t1: number;
  t2: number;
  /** Unit direction of travel (a to b) and its length. */
  dx: number;
  dz: number;
  len: number;
  /** Centre-to-centre distance between block and penguin while they touch. */
  stand: number;
  /** The penguin shoves a little off-centre (sideways, along the face), to leave room for its friend. */
  lateral: number;
  /** Friction of the ground this leg runs over (see KAPPA). */
  kappa: number;
}

/** What happens to one block in a step: its shoves, in order, and how it appears or vanishes. */
export interface Job {
  slot: number;
  legs: Leg[];
  /** Step fractions over which the block is forged (grows from nothing), when it is new. */
  grow?: [number, number];
  /** ... and over which it is shrinking away, when it is being removed. */
  fade?: [number, number];
  /** True for a block that is made in front of the row and shoved into its place. */
  fromFront?: boolean;
  /** A node that floats in the air: made at the forge by a penguin and carried to its place by an eagle. */
  carry?: Carry;
}

/**
 * How a panda gets a new floating node to its place: it makes the ball in its arms where it stands, walks to
 * the foot of a bamboo pole beside the node's place, climbs it with the ball hugged to its chest, and sets the
 * ball into place from the perch. (Penguins have an eagle do it instead.)
 */
export interface Porter {
  /** Foot of the pole, and where the animal ends up: (x, z) and the height of its feet above the floor. */
  base: [number, number];
  perch: number;
  /** Step fractions: walks to the pole during [grab, climb0], climbs during [climb0, climb1], holds, places at `drop`. */
  climb0: number;
  climb1: number;
}

/** The flight of a new floating node: forged at (wx, wy, wz), lifted by an eagle (or a climbing panda), set down at (tx, ty, tz). */
export interface Carry {
  wx: number;
  wy: number;
  wz: number;
  tx: number;
  ty: number;
  tz: number;
  /** Step fractions: the ball is made over `made`, the eagle takes it at `grab`, lets go at `drop`, and it settles by `settle`. */
  made: [number, number];
  grab: number;
  drop: number;
  settle: number;
  /** Where the penguin stands to make it. */
  stand: [number, number];
  /** Pandas: the climb that takes the ball up. */
  porter?: Porter;
}

/** How far above the ball the eagle's feet are while it holds it, and how high above its place the ball is let go. */
const HOLD = 1.0;
const LET_GO = 0.5;
/** How far below a floating node's centre the feet of an animal perched beside it are. */
export const PERCH_DROP = 0.8;
/** Where a panda hugs the ball it carries, relative to its feet (+z is towards the camera). */
export const HUG = { y: 0.74, z: 0.6 };

export interface IceMotion {
  k: number;
  jobs: Job[];
  bySlot: Map<number, Job>;
}

/** Fraction of a leg's distance covered at step fraction f. */
export function shoveProgress(f: number, t0: number, t1: number, t2: number, kappa: number = KAPPA): number {
  if (f <= t0) return 0;
  if (f >= t2) return 1;
  const push = Math.max(1e-4, t1 - t0);
  const glide = Math.max(1e-4, t2 - t1);
  const norm = 1 - Math.exp(-kappa);
  // Equal speed on both sides of the release fixes the share of the distance covered while pushing
  // (a constant acceleration, distance ~ u^2) against the glide (exponentially falling speed).
  const share = 1 / (1 + (2 * norm * glide) / (kappa * push));
  if (f <= t1) {
    const u = (f - t0) / push;
    return share * u * u;
  }
  const x = (f - t1) / glide;
  return share + (1 - share) * ((1 - Math.exp(-kappa * x)) / norm);
}

/** Speed of a block (units of length per step fraction, signed along the leg) at f. */
export function shoveSpeed(leg: Leg, f: number): number {
  const e = 0.004;
  const a = shoveProgress(f - e, leg.t0, leg.t1, leg.t2, leg.kappa);
  const b = shoveProgress(f + e, leg.t0, leg.t1, leg.t2, leg.kappa);
  return ((b - a) / (2 * e)) * leg.len;
}

/**
 * How a block tips as it is shoved, in radians about the view axis (+ is counter-clockwise from the
 * camera): it leans back as it is pushed off, pitches forward as friction brakes it, and rocks a
 * little as it stops. Blocks moving along z do not tip (only the view axis is animated).
 */
export function slideLean(leg: { dx: number; t0: number; t1: number; t2: number }, f: number): number {
  if (f <= leg.t0 || Math.abs(leg.dx) < 0.2) return 0;
  const push = Math.max(1e-4, leg.t1 - leg.t0);
  const glide = Math.max(1e-4, leg.t2 - leg.t1);
  let lean: number;
  if (f < leg.t1) {
    lean = 0.085 * Math.sin(Math.min(1, (f - leg.t0) / push) * (Math.PI / 2));
  } else if (f < leg.t2) {
    const x = (f - leg.t1) / glide;
    lean = 0.085 * Math.exp(-7 * x) - 0.05 * (1 - Math.exp(-5 * x)) * Math.exp(-1.2 * x);
  } else {
    const since = (f - leg.t2) / glide;
    lean = -0.05 * Math.exp(-3.2) * Math.exp(-5 * since) * Math.cos(since * 17);
  }
  return lean * Math.sign(leg.dx) * Math.min(1, Math.abs(leg.dx) * 1.2);
}

/** Where a job's block is at step fraction f. */
export function blockAt(job: Job, f: number, out: { x: number; z: number; vx: number; vz: number; leg: number }): void {
  if (job.legs.length === 0) {
    const c = job.carry!;
    out.x = c.tx;
    out.z = c.tz;
    out.vx = 0;
    out.vz = 0;
    out.leg = -1;
    return;
  }
  const first = job.legs[0];
  out.x = first.ax;
  out.z = first.az;
  out.vx = 0;
  out.vz = 0;
  out.leg = -1;
  for (let i = 0; i < job.legs.length; i++) {
    const leg = job.legs[i];
    if (f < leg.t0) return;
    const p = shoveProgress(f, leg.t0, leg.t1, leg.t2, leg.kappa);
    out.x = leg.ax + (leg.bx - leg.ax) * p;
    out.z = leg.az + (leg.bz - leg.az) * p;
    if (f < leg.t2) {
      const v = shoveSpeed(leg, f);
      out.vx = v * leg.dx;
      out.vz = v * leg.dz;
      out.leg = i;
      return;
    }
  }
}

/** Where the penguin stands while it touches the block at (bx, bz). */
export function contactPoint(leg: Leg, bx: number, bz: number, out: [number, number]): void {
  const s = leg.kind === 'push' ? -1 : 1;
  // Off-centre: along the block's face, at right angles to the way it goes.
  out[0] = bx + s * leg.dx * leg.stand - leg.dz * leg.lateral;
  out[1] = bz + s * leg.dz * leg.stand + leg.dx * leg.lateral;
}

/** Step fraction at which the penguin lets go of the leg's block. */
export function releaseAt(leg: Leg): number {
  return leg.kind === 'push' ? leg.t1 : leg.t2;
}

// ── Building the motion of a step ──────────────────────────────────────────

const cache = new WeakMap<StageModel, Map<number, IceMotion | null>>();

/** The ground motion of step k (blocks shoved along ice or earth), or null when nothing in it is shoved. */
export function iceMotionAt(model: StageModel, k: number): IceMotion | null {
  if (!hasPhysics(model.world) || k <= 0 || k >= model.frameCount) return null;
  let per = cache.get(model);
  if (!per) {
    per = new Map();
    cache.set(model, per);
  }
  if (per.has(k)) return per.get(k)!;
  const built = build(model, k);
  if (built && model.world === 'panda') for (const job of built.jobs) for (const leg of job.legs) leg.kappa = EARTH_KAPPA;
  per.set(k, built);
  if (per.size > 64) per.delete(per.keys().next().value as number);
  return built;
}

function grounded(model: StageModel, rest: RestFrame, s: number): boolean {
  return rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 - model.floorY < GROUND_CLEARANCE;
}

/** Half the block's extent along a direction (a box's support, a sphere's radius). */
function extent(rest: RestFrame, s: number, dx: number, dz: number): number {
  return (rest.dims[s * 3] / 2) * Math.abs(dx) + (rest.dims[s * 3 + 2] / 2) * Math.abs(dz);
}

function makeLeg(rest: RestFrame, slot: number, kind: Leg['kind'], ax: number, az: number, bx: number, bz: number, t0: number, t1: number, t2: number, lateral = 0): Leg {
  const len = Math.hypot(bx - ax, bz - az);
  const dx = len > 1e-6 ? (bx - ax) / len : 0;
  const dz = len > 1e-6 ? (bz - az) / len : 1;
  return { slot, kind, ax, az, bx, bz, t0, t1, t2, dx, dz, len, stand: extent(rest, slot, dx, dz) + REACH, lateral, kappa: KAPPA };
}

/** True when a penguin can stand at (x, z) among the cells present in `rest` (ignoring `except`). */
function standable(rest: RestFrame, n: number, x: number, z: number, except: number[]): boolean {
  for (let s = 0; s < n; s++) {
    if (!rest.present[s] || except.includes(s)) continue;
    const hw = rest.dims[s * 3] / 2 + STANCE * 0.9;
    const hd = rest.dims[s * 3 + 2] / 2 + STANCE * 0.9;
    if (rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 > 1.4) continue; // stands clear above
    if (Math.abs(x - rest.pos[s * 3]) < hw && Math.abs(z - rest.pos[s * 3 + 2]) < hd) return false;
  }
  return true;
}

/** How far in front of its row a new block is made before it is shoved in. */
const MAKE_AHEAD = 2.3;
/** How far a removed block is shoved back before it melts into the ice. */
const SHOVE_AWAY = 1.9;
/** Distance of the lanes a swapped block is shoved out to. */
const LANE = 1.8;
/**
 * Neighbours that swap: the front-lane block is tugged out diagonally (to the lane above the other's place)
 * while the back-lane block is shoved straight back, so the two are never in each other's way; then the
 * back-lane block is tugged diagonally home while the front-lane block is shoved straight back into the row.
 * Each leg is (start, release, rest).
 */
/**
 * Blocks that swap across others: out of the row, a long way across the lane (the longer the way, the more of
 * the step it takes), and back.
 */
const FAR_T = [0.08, 0.14, 0.24, 0.32, 0.4, 0.68, 0.74, 0.8, 0.92] as const;
const NEAR_FRONT = { out: [0.14, 0.24, 0.42], back: [0.58, 0.68, 0.88] } as const;
const NEAR_BACK = { out: [0.14, 0.24, 0.42], back: [0.54, 0.64, 0.84] } as const;

function build(model: StageModel, k: number): IceMotion | null {
  const to = model.rest(k);
  const from = model.rest(k - 1);
  const frame = model.frames[k];
  const n = model.slots.length;
  const jobs: Job[] = [];
  const claimed = new Set<number>();
  const actors = frame.event.actors.map((id) => model.slotOf.get(id)).filter((s): s is number => s !== undefined);

  const moved = (s: number) => from.present[s] && to.present[s] && Math.hypot(to.pos[s * 3] - from.pos[s * 3], to.pos[s * 3 + 2] - from.pos[s * 3 + 2]) > 0.05;

  // Swap: both blocks leave the row (one tugged towards the camera, one shoved away), pass each other in
  // their lanes, and come back. Neighbours are shoved diagonally to the other's lane (one leg out, one back);
  // blocks further apart go out, across and back (three legs), so no block ever passes through another.
  if (frame.event.kind === 'swap' && actors.length >= 2 && moved(actors[0]) && moved(actors[1]) && grounded(model, to, actors[0]) && grounded(model, to, actors[1]) && grounded(model, from, actors[0]) && grounded(model, from, actors[1])) {
    const [a, b] = actors;
    const gap = Math.abs(from.pos[a * 3] - from.pos[b * 3]);
    let between = false;
    for (let s = 0; s < n; s++) {
      if (s === a || s === b || !from.present[s] || !grounded(model, from, s)) continue;
      const x = from.pos[s * 3];
      if (Math.abs(from.pos[s * 3 + 2] - from.pos[a * 3 + 2]) < 1.2 && x > Math.min(from.pos[a * 3], from.pos[b * 3]) + 0.3 && x < Math.max(from.pos[a * 3], from.pos[b * 3]) - 0.3) between = true;
    }
    const near = gap < 2.7 && !between;
    const swapJob = (s: number, front: boolean, partner: number): Job => {
      const ax = from.pos[s * 3], az = from.pos[s * 3 + 2];
      const bx = to.pos[s * 3], bz = to.pos[s * 3 + 2];
      const lane = az + (front ? LANE : -LANE);
      if (near) {
        const w = front ? NEAR_FRONT : NEAR_BACK;
        return {
          slot: s,
          legs: front
            ? [
                // Tugged diagonally out to the lane above the other's place, then shoved straight back into the row.
                makeLeg(from, s, 'pull', ax, az, bx, lane, w.out[0], w.out[1], w.out[2]),
                makeLeg(from, s, 'push', bx, lane, bx, bz, w.back[0], w.back[1], w.back[2]),
              ]
            : [
                // Shoved straight back out of the row (a little off-centre, away from its friend), then tugged diagonally home to the other's old place.
                makeLeg(from, s, 'push', ax, az, ax, lane, w.out[0], w.out[1], w.out[2], Math.sign(ax - from.pos[partner * 3]) * 0.5),
                makeLeg(from, s, 'pull', ax, lane, bx, bz, w.back[0], w.back[1], w.back[2]),
              ],
        };
      }
      return {
        slot: s,
        legs: [
          // Out of the row: tugged forward (front) or shoved back.
          makeLeg(from, s, front ? 'pull' : 'push', ax, az, ax, lane, FAR_T[0], FAR_T[1], FAR_T[2]),
          // Across the lane to the other's place.
          makeLeg(from, s, 'push', ax, lane, bx, lane, FAR_T[3], FAR_T[4], FAR_T[5]),
          // Back into the row.
          makeLeg(from, s, front ? 'push' : 'pull', bx, lane, bx, bz, FAR_T[6], FAR_T[7], FAR_T[8]),
        ],
      };
    };
    jobs.push(swapJob(a, true, b), swapJob(b, false, a));
    claimed.add(a);
    claimed.add(b);
  }

  // A floating node that is made (a tree's, a graph's): forged on the ice below it, and carried up by an eagle.
  if (jobs.length === 0) {
    for (const s of actors) {
      if (from.present[s] || !to.present[s] || grounded(model, to, s)) continue;
      const tx = to.pos[s * 3], ty = to.pos[s * 3 + 1], tz = to.pos[s * 3 + 2];
      if (model.world === 'panda') {
        // A panda makes the ball in its arms, carries it to the foot of a bamboo pole beside its place, and climbs.
        const fp = model.footprint();
        const side = tx >= (fp.minX + fp.maxX) / 2 ? 1 : -1;
        const base: [number, number] = [tx + side * (to.dims[s * 3] / 2 + 0.5), tz + 0.45];
        const perch = Math.max(0, ty - model.floorY - PERCH_DROP);
        jobs.push({
          slot: s,
          legs: [],
          grow: [0.14, 0.22],
          carry: {
            wx: base[0], wy: model.floorY + HUG.y, wz: base[1] + 0.9, tx, ty, tz,
            made: [0.14, 0.22], grab: 0.24, drop: 0.89, settle: 0.99,
            stand: [base[0] - side * 0.7, base[1] + 0.95],
            porter: { base, perch, climb0: 0.36, climb1: 0.84 },
          },
        });
        claimed.add(s);
        break;
      }
      jobs.push({
        slot: s,
        legs: [],
        grow: [0.1, 0.28],
        carry: { wx: tx, wy: model.floorY + 0.95, wz: tz + 1.95, tx, ty, tz, made: [0.1, 0.28], grab: 0.3, drop: 0.78, settle: 0.97, stand: [tx, tz + 1.15] },
      });
      claimed.add(s);
      break; // one eagle at a time
    }
  }

  // Blocks that are made: forged in front of the row, then shoved back into their place.
  if (jobs.length === 0) {
    for (let s = 0; s < n && jobs.length < 2; s++) {
      if (from.present[s] || !to.present[s] || !actors.includes(s)) continue;
      if (!grounded(model, to, s) || model.isGrounded(model.slots[s].structure)) continue;
      const x = to.pos[s * 3], z = to.pos[s * 3 + 2];
      if (!standable(to, n, x, z + MAKE_AHEAD + 0.9, [s])) continue;
      jobs.push({ slot: s, legs: [makeLeg(to, s, 'push', x, z + MAKE_AHEAD, x, z, 0.36, 0.5, 0.88)], grow: [0.02, 0.3], fromFront: true });
      claimed.add(s);
    }
    // Blocks that are removed: shoved away and melting as they go.
    for (let s = 0; s < n && jobs.length < 2; s++) {
      if (!from.present[s] || to.present[s] || !actors.includes(s)) continue;
      if (!grounded(model, from, s) || model.isGrounded(model.slots[s].structure)) continue;
      const x = from.pos[s * 3], z = from.pos[s * 3 + 2];
      jobs.push({ slot: s, legs: [makeLeg(from, s, 'push', x, z, x, z - SHOVE_AWAY, 0.16, 0.3, 0.74)], fade: [0.42, 0.82] });
      claimed.add(s);
    }
  }

  // Blocks that move along the ice (a node going into its place in a list): one shove along the way.
  if (jobs.length === 0) {
    const movers: { s: number; len: number }[] = [];
    for (const s of actors) {
      if (!moved(s) || !grounded(model, from, s) || !grounded(model, to, s)) continue;
      const len = Math.hypot(to.pos[s * 3] - from.pos[s * 3], to.pos[s * 3 + 2] - from.pos[s * 3 + 2]);
      if (len >= 1.5) movers.push({ s, len });
    }
    movers.sort((p, q) => q.len - p.len);
    for (const { s } of movers) {
      if (jobs.length >= 2) break;
      // A long way is shoved for longer (the penguin walks the block up to speed) before it is let go.
      const reach = Math.hypot(to.pos[s * 3] - from.pos[s * 3], to.pos[s * 3 + 2] - from.pos[s * 3 + 2]);
      const leg = makeLeg(from, s, 'push', from.pos[s * 3], from.pos[s * 3 + 2], to.pos[s * 3], to.pos[s * 3 + 2], 0.2, 0.2 + Math.min(0.3, 0.06 * reach), 0.92);
      // The penguin needs room behind the block.
      if (!standable(from, n, from.pos[s * 3] - leg.dx * leg.stand, from.pos[s * 3 + 2] - leg.dz * leg.stand, [s])) continue;
      jobs.push({ slot: s, legs: [leg] });
      claimed.add(s);
    }
  }

  if (jobs.length === 0) return null;
  return { k, jobs, bySlot: new Map(jobs.map((j) => [j.slot, j])) };
}

/** Presence (0..1) of a job's block at f. */
export function jobPresence(job: Job, f: number): number {
  let p = 1;
  if (job.grow) p *= smoothstep(job.grow[0], job.grow[1], f);
  if (job.fade) p *= 1 - easeInCubic(clamp01((f - job.fade[0]) / (job.fade[1] - job.fade[0])));
  return p;
}


// ── The eagle ───────────────────────────────────────────────────────────────

/** The path the eagle's feet follow while carrying: out of the forge, over, and down to the place. */
function carryFeet(c: Carry, f: number, out: { x: number; y: number; z: number }): void {
  const u = clamp01((f - c.grab) / (c.drop - c.grab));
  const e = u * u * (3 - 2 * u);
  out.x = c.wx + (c.tx - c.wx) * e;
  out.z = c.wz + (c.tz - c.wz) * e;
  // The ball goes up in an arc and ends a little above its place (LET_GO), the eagle's feet HOLD above it.
  const ballY = c.wy + (c.ty + LET_GO - c.wy) * e + Math.sin(Math.PI * u) * 0.9;
  out.y = ballY + HOLD;
}

export interface PorterPose {
  x: number;
  /** Height of the feet above the floor. */
  y: number;
  z: number;
  phase: 'make' | 'walk' | 'climb' | 'hold' | 'place';
  /** 0..1 through the phase. */
  u: number;
}

/** Where the panda that carries a ball up is at step fraction f (feet), and what it is doing. */
export function porterAt(c: Carry, f: number, out: PorterPose): void {
  const pt = c.porter!;
  const [bx, bz] = pt.base;
  if (f < c.grab) {
    out.x = c.stand[0];
    out.z = c.stand[1];
    out.y = 0;
    out.phase = 'make';
    out.u = clamp01((f - c.made[0]) / Math.max(1e-3, c.made[1] - c.made[0]));
  } else if (f < pt.climb0) {
    const u = clamp01((f - c.grab) / (pt.climb0 - c.grab));
    const e = u * u * (3 - 2 * u);
    out.x = c.stand[0] + (bx - c.stand[0]) * e;
    out.z = c.stand[1] + (bz - c.stand[1]) * e;
    out.y = 0;
    out.phase = 'walk';
    out.u = u;
  } else if (f < pt.climb1) {
    const u = clamp01((f - pt.climb0) / (pt.climb1 - pt.climb0));
    out.x = bx;
    out.z = bz;
    out.y = pt.perch * (u * u * (3 - 2 * u) * 0.35 + u * 0.65);
    out.phase = 'climb';
    out.u = u;
  } else {
    out.x = bx;
    out.z = bz;
    out.y = pt.perch;
    out.phase = f < c.drop ? 'hold' : 'place';
    out.u = f < c.drop ? clamp01((f - pt.climb1) / Math.max(1e-3, c.drop - pt.climb1)) : clamp01((f - c.drop) / Math.max(1e-3, c.settle - c.drop));
  }
}

const _pp: PorterPose = { x: 0, y: 0, z: 0, phase: 'make', u: 0 };

/** The ball of a carried node while a panda has it: hugged to the chest, then set into its place with a little lob. */
function porterBall(c: Carry, f: number, floorY: number, out: { x: number; y: number; z: number }): void {
  porterAt(c, f, _pp);
  const hx = _pp.x, hy = floorY + _pp.y + HUG.y, hz = _pp.z + HUG.z;
  if (f < c.drop) {
    out.x = hx;
    out.y = hy;
    out.z = hz;
    return;
  }
  const since = clamp01((f - c.drop) / Math.max(1e-3, c.settle - c.drop));
  const e = since < 0.6 ? easeOut(since / 0.6) : 1;
  out.x = hx + (c.tx - hx) * e;
  out.z = hz + (c.tz - hz) * e;
  const lob = Math.sin(Math.PI * Math.min(1, since / 0.6)) * 0.32;
  const settle = since > 0.6 ? 0.07 * Math.sin((since - 0.6) * Math.PI * 3) * Math.exp(-(since - 0.6) * 6) : 0;
  out.y = hy + (c.ty - hy) * e + lob + settle;
}

function easeOut(x: number): number {
  const t = clamp01(x);
  return 1 - (1 - t) * (1 - t);
}

/** Where a floating node is during its flight (for the bodies): grown at the forge, carried, set down. */
export function carryBall(c: Carry, f: number, out: { x: number; y: number; z: number }, floorY = 0): void {
  if (c.porter) {
    porterBall(c, f, floorY, out);
    return;
  }
  if (f < c.grab) {
    out.x = c.wx;
    out.y = c.wy;
    out.z = c.wz;
    return;
  }
  if (f < c.drop) {
    carryFeet(c, f, out);
    out.y -= HOLD;
    return;
  }
  // Let go a little above its place: it drops and settles with a small bounce.
  const since = (f - c.drop) / Math.max(1e-3, c.settle - c.drop);
  const fall = since * since;
  const bounce = since > 0.55 ? 0.12 * Math.sin((since - 0.55) * Math.PI * 2.4) * Math.exp(-(since - 0.55) * 4) * Math.min(1, (since - 0.55) * 6) : 0;
  out.x = c.tx;
  out.z = c.tz;
  out.y = c.ty + LET_GO * (1 - Math.min(1, fall)) + Math.max(0, bounce);
}

export interface EagleState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  /** Heading (radians about y, 0 faces +z). */
  yaw: number;
  /** 0 gliding, 1 flapping hard. */
  flap: number;
  /** Carrying the ball (talons closed round it). */
  holding: boolean;
  /** Step-time (k + f) the eagle is at, for the wing beat. */
  clock: number;
}

const EAGLE_IN = 0.55;
const EAGLE_OUT = 0.8;

/** Where the eagle is at step k, fraction f (it may be arriving for the next step, or leaving after the last). */
export function eagleAt(model: StageModel, k: number, f: number, out: EagleState): void {
  out.visible = false;
  out.holding = false;
  if (model.world !== 'penguin') return;
  const u = k + f;
  // The carry whose flight covers this moment: the one holding a ball (it must never vanish mid-carry), else the latest.
  let chosen: { carry: Carry; t: number; c: number } | null = null;
  for (let c = Math.max(1, k - 1); c <= Math.min(model.frameCount - 1, k + 1); c++) {
    const motion = iceMotionAt(model, c);
    const carry = motion?.jobs.find((j) => j.carry)?.carry;
    if (!carry) continue;
    const t = u - c; // step-time relative to the carry step
    if (t < -EAGLE_IN || t > carry.settle + EAGLE_OUT) continue;
    const holding = t >= carry.grab && t < carry.drop;
    if (!chosen || holding || !(chosen.t >= chosen.carry.grab && chosen.t < chosen.carry.drop)) chosen = { carry, t, c };
  }
  if (!chosen) return;
  place(chosen.carry, chosen.t, out);
  out.clock = u;
}

const _feet = { x: 0, y: 0, z: 0 };

function place(c: Carry, t: number, out: EagleState): void {
  const hold0 = c.grab;
  const hold1 = c.drop;
  // Where it comes from and where it goes: out of the sky to the left and behind, away to the right and behind.
  const sx = c.wx - 9, sy = c.wy + 6.5, sz = c.wz - 8;
  const gx = c.wx, gy = c.wy + HOLD, gz = c.wz;
  out.visible = true;
  if (t < hold0) {
    const u = clamp01((t + EAGLE_IN) / (hold0 + EAGLE_IN));
    // A swoop: high and fast, easing down onto the ball.
    const e = 1 - Math.pow(1 - u, 2.2);
    out.x = sx + (gx - sx) * e;
    out.z = sz + (gz - sz) * e;
    out.y = sy + (gy - sy) * Math.pow(u, 1.35);
    out.flap = 0.35 + 0.65 * (1 - u) ;
    face(out, gx - sx, gz - sz);
    return;
  }
  if (t < hold1) {
    carryFeet(c, t, _feet);
    out.x = _feet.x;
    out.y = _feet.y;
    out.z = _feet.z;
    out.holding = true;
    out.flap = 0.8;
    face(out, c.tx - c.wx, c.tz - c.wz);
    return;
  }
  // Away: up and off to the right, behind.
  const u = clamp01((t - hold1) / (c.settle + EAGLE_OUT - hold1));
  const e = u * u;
  const ex = c.tx + 10, ey = c.ty + LET_GO + HOLD + 5.5, ez = c.tz - 8;
  const bx = c.tx, by = c.ty + LET_GO + HOLD, bz = c.tz;
  out.x = bx + (ex - bx) * e;
  out.y = by + (ey - by) * e;
  out.z = bz + (ez - bz) * e;
  out.flap = 0.9 - 0.4 * u;
  face(out, ex - bx, ez - bz);
}

function face(out: EagleState, dx: number, dz: number): void {
  if (Math.abs(dx) + Math.abs(dz) > 1e-4) out.yaw = Math.atan2(dx, dz);
}

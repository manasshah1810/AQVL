import type { TraceFrame } from '@aqvl/runtime';
import { STATE_TREATMENTS } from '../look/treatments';
import { allocateAttention, isMutation } from '../motion/attention';
import {
  clamp01,
  dampedWave,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  smoothstep,
  springResidual,
  windowedSpring,
} from '../motion/spring';
import { STAGGER_SECONDS } from '../timeline/beats';
import { blockAt, carryBall, frictionOf, iceMotionAt, jobPresence, shoveProgress, slideLean } from '../worlds/ice';
import { hasPhysics, isOcean } from '../worlds/types';
import { driftProgress, haulAt, tapOffset, waterMotionAt, type HaulPose } from '../worlds/ocean/water';
import { linearRgb } from './colors';
import { DECAL_SHAPE, type DecalState, type LabelFont, type LabelOrient, type LabelState, type RestFrame, type StageModel } from './StageModel';

export const MAX_DECALS = 384;
export const MAX_PULSES = 36;
export const MAX_RINGS = 6;

/** How a node gets from its place in frame k-1 to its place in frame k. */
const enum Motion {
  Still = 0,
  Move = 1,
  Swap = 2,
  Enter = 3,
  Exit = 4,
}

/** Per-step choreography (computed once per step, cached). */
interface StepPlan {
  k: number;
  from: RestFrame;
  to: RestFrame;
  motion: Uint8Array;
  /** +1 / -1: which side of the row a swapping node passes (they never meet). */
  side: Int8Array;
  delay: Float32Array;
  /** Seconds into the step at which this node's value changes (writes). */
  writeAt: Float32Array;
  /** Seconds into the step at which a shockwave leaves this node, or -1. */
  shockAt: Float32Array;
  shockColor: string[];
  /** Brightening on landing / writing (kept at zero: nothing flashes). */
  flash: Float32Array;
  labelKeys: string[];
  labelFrom: (LabelState | undefined)[];
  labelTo: (LabelState | undefined)[];
  decalKeys: string[];
  decalFrom: (DecalState | undefined)[];
  decalTo: (DecalState | undefined)[];
  pulseEdges: number[];
  pulseColor: string;
  /** Edge slots whose target changed this step (re-aimed pointers). */
  reaimed: Uint8Array;
  frame: TraceFrame;
}

/** A label's live state, mutated in place every frame. */
export interface LabelOut {
  key: string;
  text: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  opacity: number;
  anchorX: 'left' | 'center' | 'right';
  font: LabelFont;
  /** Node slot this label rides on, or -1; when set, x/y/z are relative offsets resolved by the renderer. */
  follow: number;
  /** Edge slot this label sits on (its middle), or -1. */
  edge: number;
  /** Printed on the node's face, on the floor, or turned to the camera. */
  orient: LabelOrient;
  /** Extra vertical slide (value changes). */
  slide: number;
}

/**
 * Everything the renderer needs for one moment, in preallocated buffers.
 * `sampleStage` overwrites it in place; nothing is allocated per frame
 * once a step's plan exists.
 */
export class StageSample {
  k = 0;
  u = 1;
  tau = 0;
  duration = 0;
  readonly pos: Float32Array;
  readonly dims: Float32Array;
  readonly color: Float32Array;
  readonly glow: Float32Array;
  readonly finish: Float32Array;
  readonly tilt: Float32Array;
  /** 0 = gone, 1 = full size (enter / exit). */
  readonly presence: Float32Array;
  readonly edgeVisible: Float32Array;
  readonly edgeP0: Float32Array;
  readonly edgeP1: Float32Array;
  readonly edgeCtrl: Float32Array;
  readonly edgeColor: Float32Array;
  readonly edgeWidth: Float32Array;
  readonly edgeArrow: Uint8Array;
  readonly pulse = new Float32Array(MAX_PULSES * 4);
  readonly pulseColor = new Float32Array(MAX_PULSES * 3);
  pulseCount = 0;
  /** Halo rings in the air: x, y, z, radius, alpha. */
  readonly ring = new Float32Array(MAX_RINGS * 5);
  readonly ringColor = new Float32Array(MAX_RINGS * 3);
  readonly ringStyle = new Float32Array(MAX_RINGS);
  ringCount = 0;
  readonly decal = new Float32Array(MAX_DECALS * 6);
  readonly decalColor = new Float32Array(MAX_DECALS * 4);
  decalCount = 0;
  readonly labels = new Map<string, LabelOut>();
  /** Keys of labels alive in the current step (changes only when the step changes). */
  labelKeys: string[] = [];
  labelVersion = 0;

  constructor(readonly nodeCount: number, readonly edgeCount: number) {
    this.pos = new Float32Array(nodeCount * 3);
    this.dims = new Float32Array(nodeCount * 3);
    this.color = new Float32Array(nodeCount * 3);
    this.glow = new Float32Array(nodeCount);
    this.finish = new Float32Array(nodeCount);
    this.tilt = new Float32Array(nodeCount);
    this.presence = new Float32Array(nodeCount);
    this.edgeVisible = new Float32Array(edgeCount);
    this.edgeP0 = new Float32Array(edgeCount * 3);
    this.edgeP1 = new Float32Array(edgeCount * 3);
    this.edgeCtrl = new Float32Array(edgeCount * 3);
    this.edgeColor = new Float32Array(edgeCount * 3);
    this.edgeWidth = new Float32Array(edgeCount);
    this.edgeArrow = new Uint8Array(edgeCount);
  }
}

const planCache = new WeakMap<StageModel, Map<number, StepPlan>>();

function planFor(model: StageModel, k: number): StepPlan {
  let cache = planCache.get(model);
  if (!cache) {
    cache = new Map();
    planCache.set(model, cache);
  }
  const hit = cache.get(k);
  if (hit) return hit;
  const plan = buildPlan(model, k);
  cache.set(k, plan);
  if (cache.size > 48) cache.delete(cache.keys().next().value as number);
  return plan;
}

function buildPlan(model: StageModel, k: number): StepPlan {
  const to = model.rest(k);
  const from = k > 0 ? model.rest(k - 1) : to;
  const frame = model.frames[k];
  const n = model.slots.length;
  const motion = new Uint8Array(n);
  const side = new Int8Array(n);
  const delay = new Float32Array(n);
  const writeAt = new Float32Array(n).fill(-1);
  const shockAt = new Float32Array(n).fill(-1);
  const shockColor = new Array<string>(n).fill('');
  const flash = new Float32Array(n);
  const palette = model.palette;
  const event = frame.event;
  const actors = event.actors.map((id) => model.slotOf.get(id)).filter((s): s is number => s !== undefined);
  const emphasized = new Set(allocateAttention(frame).map((id) => model.slotOf.get(id)!));
  const mutation = isMutation(frame);

  // Order of the cascade: the step's actors first, then everything else left to right.
  const order: number[] = [];
  for (let s = 0; s < n; s++) if (from.present[s] || to.present[s]) order.push(s);
  const posOf = (s: number) => (to.present[s] ? to.pos[s * 3] : from.pos[s * 3]);
  order.sort((a, b) => posOf(a) - posOf(b));
  const rank = new Map<number, number>();
  actors.forEach((s, i) => rank.set(s, i));

  let moverIndex = 0;
  let enterIndex = 0;
  let exitIndex = 0;
  for (const s of order) {
    const was = from.present[s] === 1;
    const is = to.present[s] === 1;
    if (!was && is) {
      motion[s] = Motion.Enter;
      delay[s] = Math.min(0.5, STAGGER_SECONDS * (rank.get(s) ?? enterIndex++));
      continue;
    }
    if (was && !is) {
      motion[s] = Motion.Exit;
      delay[s] = Math.min(0.4, STAGGER_SECONDS * exitIndex++);
      continue;
    }
    if (!was && !is) continue;
    const dx = to.pos[s * 3] - from.pos[s * 3];
    const dz = to.pos[s * 3 + 2] - from.pos[s * 3 + 2];
    const dyRest = Math.abs(to.pos[s * 3 + 1] - from.pos[s * 3 + 1]);
    const travelled = Math.hypot(dx, dz);
    if (event.kind === 'swap' && actors.length >= 2 && (s === actors[0] || s === actors[1]) && travelled > 0.05) {
      motion[s] = Motion.Swap;
      side[s] = s === actors[0] ? 1 : -1;
      delay[s] = s === actors[0] ? 0 : 0.03;
    } else if (travelled > 0.05 || dyRest > 0.05) {
      motion[s] = Motion.Move;
      delay[s] = Math.min(0.6, STAGGER_SECONDS * (rank.get(s) ?? moverIndex++));
    } else {
      motion[s] = Motion.Still;
      delay[s] = rank.has(s) ? Math.min(0.4, STAGGER_SECONDS * rank.get(s)!) : 0;
    }
  }

  // Value changes: the new value lands a little into the step, with one soft ripple.
  for (const w of event.writes) {
    const s = model.slotOf.get(w.id);
    if (s === undefined) continue;
    writeAt[s] = delay[s] + 0.16;
    if (emphasized.has(s) || event.writes.length <= 2) {
      shockAt[s] = writeAt[s];
      shockColor[s] = palette.states.MODIFYING.body;
    }
  }
  if (event.kind === 'swap') {
    for (const s of actors.slice(0, 2)) {
      shockAt[s] = -2; // resolved against the step length when sampling (landing time)
      shockColor[s] = palette.states.MODIFYING.body;
    }
  }
  // Locking in: a node that becomes settled sends a ripple across the floor.
  for (let s = 0; s < n; s++) {
    if (to.present[s] && from.present[s] && to.state[s] === 'SUCCESS' && from.state[s] !== 'SUCCESS') {
      if (shockAt[s] < 0 && shockAt[s] !== -2) {
        shockAt[s] = delay[s] + 0.22;
        shockColor[s] = palette.states.SUCCESS.body;
      }
    }
  }
  // The change ripple belongs to mutations alone (see motion/attention.ts).
  if (!mutation) {
    for (let s = 0; s < n; s++) {
      if (shockColor[s] !== palette.states.MODIFYING.body) continue;
      shockAt[s] = -1;
      flash[s] = 0;
    }
  }

  // Labels and floor marks: matched by key between the two frames.
  const labelKeys: string[] = [];
  const labelFrom: (LabelState | undefined)[] = [];
  const labelTo: (LabelState | undefined)[] = [];
  const fromLabels = new Map(from.labels.map((l) => [l.key, l]));
  for (const l of to.labels) {
    labelKeys.push(l.key);
    labelFrom.push(fromLabels.get(l.key));
    labelTo.push(l);
    fromLabels.delete(l.key);
  }
  for (const l of fromLabels.values()) {
    labelKeys.push(l.key);
    labelFrom.push(l);
    labelTo.push(undefined);
  }
  const decalKeys: string[] = [];
  const decalFrom: (DecalState | undefined)[] = [];
  const decalTo: (DecalState | undefined)[] = [];
  const fromDecals = new Map(from.decals.map((d) => [d.key, d]));
  for (const d of to.decals) {
    decalKeys.push(d.key);
    decalFrom.push(fromDecals.get(d.key));
    decalTo.push(d);
    fromDecals.delete(d.key);
  }
  for (const d of fromDecals.values()) {
    decalKeys.push(d.key);
    decalFrom.push(d);
    decalTo.push(undefined);
  }

  // Edges this step travelled along.
  const pulseEdges = event.edges.map((id) => model.edgeSlotOf.get(id)).filter((s): s is number => s !== undefined && to.edgePresent[s] === 1);
  const pulseColor =
    event.kind === 'link' || event.kind === 'write' ? palette.edges.mutate : event.kind === 'settle' ? palette.edges.settled : palette.edges.visit;
  const reaimed = new Uint8Array(model.edgeSlots.length);
  for (let e = 0; e < reaimed.length; e++) {
    if (from.edgePresent[e] && to.edgePresent[e] && (from.edgeTo[e] !== to.edgeTo[e] || from.edgeFrom[e] !== to.edgeFrom[e])) reaimed[e] = 1;
  }

  return {
    k, from, to, motion, side, delay, writeAt, shockAt, shockColor, flash,
    labelKeys, labelFrom, labelTo, decalKeys, decalFrom, decalTo,
    pulseEdges, pulseColor, reaimed, frame,
  };
}

export interface SampleOptions {
  reducedMotion: boolean;
  /**
   * Scene entrance / exit (a new program replacing the old one): seconds
   * since it began. Nodes grow in, or shrink away, in a left-to-right
   * cascade, taking their labels, edges and floor marks with them.
   */
  envelope?: { kind: 'in' | 'out'; t: number };
  /**
   * Ice physics (penguin world): blocks on the ice are shoved by the crew and slide, instead of hopping.
   * Defaults to on in the penguin world unless motion is reduced.
   */
  ice?: boolean;
}

const rankCache = new WeakMap<StageModel, Float32Array>();

/** Each node's place in a left-to-right cascade (0..1), for entrances and exits. */
function cascadeRank(model: StageModel): Float32Array {
  let rank = rankCache.get(model);
  if (!rank) {
    const r0 = model.rest(0);
    const order = model.slots.map((_, s) => s).sort((a, b) => r0.pos[a * 3] - r0.pos[b * 3] || a - b);
    rank = new Float32Array(model.slots.length);
    order.forEach((s, i) => (rank![s] = order.length > 1 ? i / (order.length - 1) : 0));
    rankCache.set(model, rank);
  }
  return rank;
}

/** Seconds an entrance / exit takes (cascade included). */
export const ENVELOPE_SECONDS = 0.95;

/**
 * Fill `out` with the scene `tau` seconds into step k (of length `duration`).
 * Pure: the same arguments always give the same picture.
 */
export function sampleStage(model: StageModel, k: number, tau: number, duration: number, out: StageSample, options: SampleOptions): void {
  const plan = planFor(model, k);
  const { from, to } = plan;
  const D = Math.max(1e-6, duration);
  const t = k === 0 ? D : Math.min(tau, D);
  const calm = options.reducedMotion;
  out.k = k;
  out.tau = t;
  out.duration = duration;
  out.u = k === 0 ? 1 : clamp01(t / D);
  out.decalCount = 0;
  out.pulseCount = 0;

  const n = model.slots.length;
  const colorT = calm ? smoothstep(0, 0.5, out.u) : smoothstep(0.02, 0.32, out.u);
  const ice = (options.ice ?? hasPhysics(model.world)) && !calm && hasPhysics(model.world);
  const motionPlan = ice ? iceMotionAt(model, k) : null;
  // Underwater: nodes are nudged, steered and let go, and drift to rest against drag (see worlds/ocean/water.ts).
  const ocean = isOcean(model.world) && !calm;
  const water = ocean ? waterMotionAt(model, k) : null;
  const fStep = clamp01(t / D);

  for (let s = 0; s < n; s++) {
    const i3 = s * 3;
    const m = plan.motion[s];
    const was = from.present[s] === 1;
    const is = to.present[s] === 1;
    if (!was && !is) {
      out.presence[s] = 0;
      continue;
    }
    const a = was ? from : to;
    const b = is ? to : from;
    const local = Math.max(0, t - plan.delay[s]);
    const span = Math.max(1e-3, D - plan.delay[s]);
    const mass = b.mass[s];

    // Colour, finish, glow and tilt ease over the first third of the step.
    const ct = calm ? colorT : smoothstep(0, 0.32, local / span);
    out.color[i3] = lerp(a.color[i3], b.color[i3], ct);
    out.color[i3 + 1] = lerp(a.color[i3 + 1], b.color[i3 + 1], ct);
    out.color[i3 + 2] = lerp(a.color[i3 + 2], b.color[i3 + 2], ct);
    out.finish[s] = lerp(a.finish[s], b.finish[s], ct);
    out.tilt[s] = calm ? 0 : lerp(a.tilt[s], b.tilt[s], windowedSpring(local, span, mass));
    let glow = lerp(a.glow[s], b.glow[s], ct);

    // Size (value bars grow / shrink with their value).
    const dimT = calm ? smoothstep(0, 1, local / span) : windowedSpring(local, span, mass);
    out.dims[i3] = lerp(a.dims[i3], b.dims[i3], dimT);
    out.dims[i3 + 1] = lerp(a.dims[i3 + 1], b.dims[i3 + 1], dimT);
    out.dims[i3 + 2] = lerp(a.dims[i3 + 2], b.dims[i3 + 2], dimT);

    const ax = a.pos[i3], ay = a.pos[i3 + 1], az = a.pos[i3 + 2];
    const bx = b.pos[i3], by = b.pos[i3 + 1], bz = b.pos[i3 + 2];
    let x = bx, y = by, z = bz;
    let presence = 1;
    let lean = 0;

    const job = motionPlan?.bySlot.get(s);
    const onIce = ice && !job && (m === Motion.Move || m === Motion.Still) && groundedAt(model, a, s) && groundedAt(model, b, s);
    const haul = water?.bySlot.get(s);

    if (haul) {
      // Through the water: lifted, steered, let go, drifting to rest and bobbing once.
      haulAt(haul, fStep, hauled);
      x = hauled.x;
      y = hauled.y;
      z = hauled.z;
      presence = hauled.presence;
      lean = hauled.lean;
    } else if (ocean && (m === Motion.Move || m === Motion.Still)) {
      // A small change of place or height in water: a quick start, then drag eases it to rest (no spring bounce).
      const p = driftProgress(clamp01(local / span), 0.0, 0.26, 0.94);
      x = lerp(ax, bx, p);
      y = lerp(ay, by, p);
      z = lerp(az, bz, p);
    } else if (ocean && m === Motion.Enter) {
      // Rises gently into place as it forms.
      const p = smoothstep(0, 0.75, local / span);
      presence = p;
      y = by - 0.35 * (1 - p) * (1 - p);
    } else if (ocean && m === Motion.Exit) {
      // Floats up as it dissolves.
      const p = smoothstep(0, 0.7, local / span);
      presence = 1 - p * p;
      x = ax;
      y = ay + 0.7 * p;
      z = az;
    } else if (job?.carry) {
      // A floating node: made at the forge, lifted by the eagle, set down in its place.
      carryBall(job.carry, fStep, ball, model.floorY);
      x = ball.x;
      y = ball.y;
      z = ball.z;
      presence = jobPresence(job, fStep);
    } else if (job) {
      // Shoved by a penguin: slides on the ice from where it rests to where it is going.
      blockAt(job, fStep, slide);
      const p = windowedSpring(Math.max(0, t), D, mass);
      x = slide.x;
      z = slide.z;
      y = lerp(ay, by, p);
      presence = jobPresence(job, fStep);
      if (job.legs.length > 0) {
        const li = Math.max(0, slide.leg);
        lean = slideLean(job.legs[Math.min(li, job.legs.length - 1)], fStep);
      }
    } else switch (m) {
      case Motion.Swap: {
        // Out of the row (front or back), across, back in: two distinct arcs that never meet.
        const p = clamp01(local / (span * 0.84));
        const sideways = calm ? 0 : plan.side[s] * 1.35;
        const out01 = smoothstep(0, 0.3, p) - smoothstep(0.7, 1, p);
        const across = calm ? smoothstep(0, 1, p) : easeInOutCubic((p - 0.16) / 0.68);
        // The one passing behind the row rises higher, so neither ever hides the other.
        const hop = calm ? 0 : (plan.side[s] > 0 ? 0.28 : 1.05) * Math.sin(Math.PI * p);
        x = lerp(ax, bx, across);
        z = lerp(az, bz, across) + sideways * out01;
        y = lerp(ay, by, p) + hop;
        if (!calm && p >= 1) {
          // Landing: a small mass-dependent settle.
          const since = local - span * 0.84;
          const fade = 1 - smoothstep(span * 0.9, span, local);
          y -= 0.04 * dampedWave(since, 2.6 / Math.sqrt(mass), 6.5) * fade;
          glow += plan.flash[s] * Math.exp(-since / 0.28);
        }
        break;
      }
      case Motion.Move: {
        // On the ice a block that is carried along glides: a quick start, then friction brings it to rest.
        const p = calm ? smoothstep(0, 1, local / span) : onIce ? shoveProgress(clamp01(local / span), 0.02, 0.14, 0.92, frictionOf(model.world)) : windowedSpring(local, span, mass);
        const dist = Math.hypot(bx - ax, bz - az);
        const arc = calm || onIce ? 0 : Math.min(1.1, 0.16 * dist) * 4 * clamp01(p) * (1 - clamp01(p));
        if (onIce && dist > 0.05) lean = slideLean({ t0: 0.02, t1: 0.14, t2: 0.92, dx: (bx - ax) / dist }, clamp01(local / span)) * 0.6;
        x = lerp(ax, bx, p);
        y = lerp(ay, by, p) + arc;
        z = lerp(az, bz, p);
        break;
      }
      case Motion.Enter: {
        const p = calm ? smoothstep(0, 1, local / (span * 0.6)) : windowedSpring(local, span, mass);
        presence = Math.max(0, p);
        y = by + (calm ? 0 : 0.3 * springResidual(local, mass) * (1 - smoothstep(span * 0.82, span, local)));
        break;
      }
      case Motion.Exit: {
        const p = easeInCubic(local / (span * 0.55));
        presence = 1 - p;
        x = ax;
        y = ay + (calm ? 0 : 0.25 * p);
        z = az;
        break;
      }
      default: {
        // Still: only lift (emphasis) changes, on a spring.
        const p = calm ? smoothstep(0, 1, local / span) : windowedSpring(local, span, mass);
        x = lerp(ax, bx, p);
        y = lerp(ay, by, p);
        z = lerp(az, bz, p);
      }
    }

    // A nudge of a whale's nose: the node gives a little and floats back.
    const tap = water?.tapBySlot.get(s);
    if (tap) {
      tapOffset(tap, fStep, tapped);
      x += tapped.x;
      y += tapped.y;
      z += tapped.z;
    }

    // A written value: flash and a little pulse in size.
    const w = plan.writeAt[s];
    if (w >= 0 && t >= w) {
      const since = t - w;
      glow += plan.flash[s] * Math.exp(-since / 0.3);
      if (!calm) {
        const pulse = 1 + 0.06 * dampedWave(since, 2.2, 5) * (1 - smoothstep(span * 0.85, span, local));
        out.dims[i3] *= pulse;
        out.dims[i3 + 1] *= pulse;
        out.dims[i3 + 2] *= pulse;
      }
    }

    if (options.envelope) {
      const env = options.envelope;
      const start = cascadeRank(model)[s] * 0.4;
      const local = env.t - start;
      if (env.kind === 'in') {
        const p = calm ? smoothstep(0, 0.4, local) : windowedSpring(local, ENVELOPE_SECONDS - start, mass);
        presence *= Math.max(0, p);
        y += calm ? 0 : 0.5 * (1 - clamp01(p));
      } else {
        presence *= 1 - easeInCubic(local / 0.45);
      }
    }

    out.pos[i3] = x;
    out.pos[i3 + 1] = y;
    out.pos[i3 + 2] = z;
    if (lean !== 0) out.tilt[s] += lean;
    out.glow[s] = glow;
    out.presence[s] = presence;

    // Ripples on the floor.
    const shockStart = plan.shockAt[s] === -2 ? plan.delay[s] + span * 0.84 : plan.shockAt[s];
    if (!calm && shockStart >= 0 && t >= shockStart && out.decalCount < MAX_DECALS) {
      const since = t - shockStart;
      const life = 0.75;
      if (since < life) {
        const q = since / life;
        const rgb = linearRgb(plan.shockColor[s]);
        writeDecal(out, x, z, 1.0 + 1.8 * easeOutCubic(q), 0, DECAL_SHAPE.ring, rgb, 0.45 * (1 - q) * (1 - q), 8);
      }
    }
  }

  sampleEdges(model, plan, t, D, out, calm);
  sampleRings(plan, out, t, D, calm);
  sampleDecals(plan, out, t, D, calm);
  sampleLabels(plan, out, t, D, calm);

  if (options.envelope) {
    // Free-standing marks and labels follow the cascade as a whole.
    const env = options.envelope;
    const whole = env.kind === 'in' ? smoothstep(0.1, ENVELOPE_SECONDS, env.t) : 1 - smoothstep(0, 0.6, env.t);
    for (let i = 0; i < out.decalCount; i++) out.decalColor[i * 4 + 3] *= whole;
    for (const key of out.labelKeys) {
      const l = out.labels.get(key);
      if (l && l.follow < 0) l.opacity *= whole;
    }
    out.pulseCount = env.kind === 'out' ? 0 : out.pulseCount;
  }
}

const _rgb: [number, number, number] = [0, 0, 0];
const slide = { x: 0, z: 0, vx: 0, vz: 0, leg: -1 };
const hauled: HaulPose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 };
const tapped = { x: 0, y: 0, z: 0 };
const ball = { x: 0, y: 0, z: 0 };

/** Whether node s stands on the floor in a rest frame (its bottom within a hand of it). */
function groundedAt(model: StageModel, rest: RestFrame, s: number): boolean {
  return rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 - model.floorY < 0.55;
}

function writeDecal(out: StageSample, x: number, z: number, w: number, d: number, shape: number, rgb: readonly number[], alpha: number, layer: number): void {
  const i = out.decalCount++;
  out.decal[i * 6] = x;
  out.decal[i * 6 + 1] = z;
  out.decal[i * 6 + 2] = w;
  out.decal[i * 6 + 3] = d;
  out.decal[i * 6 + 4] = shape;
  out.decal[i * 6 + 5] = layer;
  out.decalColor[i * 4] = rgb[0];
  out.decalColor[i * 4 + 1] = rgb[1];
  out.decalColor[i * 4 + 2] = rgb[2];
  out.decalColor[i * 4 + 3] = alpha;
}

function emitRing(out: StageSample, slot: number, style: number, color: string, alpha: number, calm: boolean): void {
  const a = alpha * Math.min(1, out.presence[slot]);
  if (out.ringCount >= MAX_RINGS || a <= 0.002) return;
  const j = out.ringCount++;
  const r = 0.5 * Math.max(out.dims[slot * 3], out.dims[slot * 3 + 1], out.dims[slot * 3 + 2]) + 0.26;
  out.ring[j * 5] = out.pos[slot * 3];
  out.ring[j * 5 + 1] = out.pos[slot * 3 + 1];
  out.ring[j * 5 + 2] = out.pos[slot * 3 + 2];
  out.ring[j * 5 + 3] = r * (calm ? 1 : 0.92 + 0.08 * a);
  out.ring[j * 5 + 4] = a;
  const rgb = linearRgb(color);
  out.ringColor[j * 3] = rgb[0];
  out.ringColor[j * 3 + 1] = rgb[1];
  out.ringColor[j * 3 + 2] = rgb[2];
  out.ringStyle[j] = style;
}

function hasRing(rings: readonly { slot: number; style: number }[], slot: number, style: number): boolean {
  for (const r of rings) if (r.slot === slot && r.style === style) return true;
  return false;
}

/** Halo rings around floating nodes: they grow in with the step's emphasis and fade as it passes. */
function sampleRings(plan: StepPlan, out: StageSample, t: number, D: number, calm: boolean): void {
  const u = clamp01(t / D);
  const fadeIn = calm ? smoothstep(0, 0.5, u) : smoothstep(0.05, 0.4, u);
  const fadeOut = 1 - (calm ? smoothstep(0, 0.5, u) : smoothstep(0, 0.3, u));
  out.ringCount = 0;
  for (const ring of plan.to.rings) {
    emitRing(out, ring.slot, ring.style, ring.color, hasRing(plan.from.rings, ring.slot, ring.style) ? 1 : fadeIn, calm);
  }
  for (const ring of plan.from.rings) {
    if (!hasRing(plan.to.rings, ring.slot, ring.style)) emitRing(out, ring.slot, ring.style, ring.color, fadeOut, calm);
  }
}

function sampleDecals(plan: StepPlan, out: StageSample, t: number, D: number, calm: boolean): void {
  const u = clamp01(t / D);
  const fadeIn = calm ? smoothstep(0, 0.5, u) : smoothstep(0.05, 0.4, u);
  const fadeOut = 1 - (calm ? smoothstep(0, 0.5, u) : smoothstep(0, 0.3, u));
  const move = calm ? smoothstep(0, 1, u) : easeInOutCubic(u / 0.7);
  for (let i = 0; i < plan.decalKeys.length && out.decalCount < MAX_DECALS; i++) {
    const a = plan.decalFrom[i];
    const b = plan.decalTo[i];
    if (a && b) {
      const ca = linearRgb(a.color);
      const cb = linearRgb(b.color);
      _rgb[0] = lerp(ca[0], cb[0], fadeIn);
      _rgb[1] = lerp(ca[1], cb[1], fadeIn);
      _rgb[2] = lerp(ca[2], cb[2], fadeIn);
      writeDecal(out, lerp(a.x, b.x, move), lerp(a.z, b.z, move), lerp(a.w, b.w, move), lerp(a.d, b.d, move), b.shape, _rgb, lerp(a.alpha, b.alpha, fadeIn), b.layer);
    } else if (b) {
      writeDecal(out, b.x, b.z, b.w, b.d, b.shape, linearRgb(b.color), b.alpha * fadeIn, b.layer);
    } else if (a) {
      writeDecal(out, a.x, a.z, a.w, a.d, a.shape, linearRgb(a.color), a.alpha * fadeOut, a.layer);
    }
  }
}

function sampleLabels(plan: StepPlan, out: StageSample, t: number, D: number, calm: boolean): void {
  const u = clamp01(t / D);
  if (out.labelKeys !== plan.labelKeys) {
    out.labelKeys = plan.labelKeys;
    out.labelVersion++;
  }
  const fadeIn = calm ? smoothstep(0, 0.5, u) : smoothstep(0.08, 0.42, u);
  const fadeOut = 1 - (calm ? smoothstep(0, 0.5, u) : smoothstep(0, 0.28, u));
  const move = calm ? smoothstep(0, 1, u) : easeInOutCubic(u / 0.75);
  for (let i = 0; i < plan.labelKeys.length; i++) {
    const key = plan.labelKeys[i];
    const a = plan.labelFrom[i];
    const b = plan.labelTo[i];
    const ref = (b ?? a)!;
    let o = out.labels.get(key);
    if (!o) {
      o = { key, text: ref.text, x: 0, y: 0, z: 0, size: ref.size, color: ref.color, opacity: 0, anchorX: ref.anchorX, font: ref.font, follow: -1, edge: -1, orient: ref.orient, slide: 0 };
      out.labels.set(key, o);
    }
    o.anchorX = ref.anchorX;
    o.edge = ref.edge ?? -1;
    o.font = ref.font;
    o.orient = ref.orient;
    o.slide = 0;
    if (a && b) {
      const followA = a.follow;
      const followB = b.follow;
      if (followA && followB && followA.slot !== followB.slot) {
        // A tag moving to another node (pointer reassignment): it slides across, following both.
        o.follow = -2;
        const pa = followA.slot * 3;
        const pb = followB.slot * 3;
        const p = calm ? smoothstep(0, 1, u) : easeInOutCubic(u / 0.8);
        o.x = lerp(out.pos[pa], out.pos[pb], p);
        o.y = lerp(out.pos[pa + 1] + followA.dy, out.pos[pb + 1] + followB.dy, p) + (calm ? 0 : 0.35 * Math.sin(Math.PI * clamp01(u / 0.8)));
        o.z = lerp(out.pos[pa + 2], out.pos[pb + 2], p);
      } else if (followB) {
        o.follow = followB.slot;
        o.x = 0;
        o.y = lerp(followA ? followA.dy : followB.dy, followB.dy, move);
        o.z = 0;
      } else {
        o.follow = -1;
        o.x = lerp(a.x, b.x, move);
        o.y = lerp(a.y, b.y, move);
        o.z = lerp(a.z, b.z, move);
      }
      o.size = lerp(a.size, b.size, move);
      o.opacity = lerp(a.opacity, b.opacity, fadeIn);
      o.color = u < 0.3 ? a.color : b.color;
      // Value text changes at the moment the node is written, sliding up into place.
      const node = b.follow?.slot ?? -1;
      const writeAt = node >= 0 && key.startsWith('v:') ? plan.writeAt[node] : -1;
      if (a.text !== b.text && writeAt >= 0) {
        if (t < writeAt) o.text = a.text;
        else {
          o.text = b.text;
          o.slide = calm ? 0 : -0.22 * springResidual(t - writeAt, 1, 0.8);
        }
      } else {
        o.text = u < 0.35 ? a.text : b.text;
      }
    } else if (b) {
      o.text = b.text;
      o.size = b.size;
      o.color = b.color;
      o.opacity = b.opacity * fadeIn;
      if (b.follow) {
        o.follow = b.follow.slot;
        o.x = 0;
        o.y = b.follow.dy;
        o.z = 0;
      } else {
        o.follow = -1;
        o.x = b.x;
        o.y = b.y;
        o.z = b.z;
      }
    } else if (a) {
      o.text = a.text;
      o.size = a.size;
      o.color = a.color;
      // A node's own labels go with it (they shrink with it); free labels fade.
      if (a.follow) {
        o.follow = a.follow.slot;
        o.x = 0;
        o.y = a.follow.dy;
        o.z = 0;
        o.opacity = a.opacity * out.presence[a.follow.slot];
      } else {
        o.follow = -1;
        o.x = a.x;
        o.y = a.y;
        o.z = a.z;
        o.opacity = a.opacity * fadeOut;
      }
    }
    if (o.follow >= 0) o.opacity *= Math.min(1, out.presence[o.follow] * 1.4);
  }
}

const _pulseRgb = new Float32Array(3);
const _p0 = new Float32Array(3);
const _p1 = new Float32Array(3);

function sampleEdges(model: StageModel, plan: StepPlan, t: number, D: number, out: StageSample, calm: boolean): void {
  const { from, to } = plan;
  const u = clamp01(t / D);
  const colorT = calm ? smoothstep(0, 0.5, u) : smoothstep(0.02, 0.35, u);
  const E = model.edgeSlots.length;
  for (let e = 0; e < E; e++) {
    const was = from.edgePresent[e] === 1;
    const is = to.edgePresent[e] === 1;
    if (!was && !is) {
      out.edgeVisible[e] = 0;
      continue;
    }
    const r = is ? to : from;
    const src = r.edgeFrom[e];
    const dst = r.edgeTo[e];
    // Draw in / retract.
    let visible = 1;
    if (!was && is) visible = calm ? smoothstep(0, 0.6, u) : easeOutCubic((u - 0.12) / 0.5);
    else if (was && !is) visible = 1 - (calm ? smoothstep(0, 0.6, u) : easeInCubic(u / 0.5));
    visible *= Math.min(out.presence[src], out.presence[dst]) > 0.02 ? Math.min(1, Math.min(out.presence[src], out.presence[dst]) * 1.5) : 0;
    out.edgeVisible[e] = Math.max(0, visible);
    out.edgeArrow[e] = model.edgeSlots[e].directed ? 1 : 0;

    // Endpoints at the node surfaces (a re-aimed pointer swings from its old target to the new one).
    nodeCentre(out, src, _p0);
    if (plan.reaimed[e] === 1) {
      const oldDst = from.edgeTo[e];
      const p = calm ? smoothstep(0, 1, u) : windowedSpring(t, D, 1);
      const o3 = oldDst * 3;
      const n3 = dst * 3;
      _p1[0] = lerp(out.pos[o3], out.pos[n3], p);
      _p1[1] = lerp(out.pos[o3 + 1], out.pos[n3 + 1], p) + (calm ? 0 : 0.6 * Math.sin(Math.PI * clamp01(p)));
      _p1[2] = lerp(out.pos[o3 + 2], out.pos[n3 + 2], p);
    } else {
      nodeCentre(out, dst, _p1);
    }
    const route = r.edgeRoute[e];
    const bend = r.edgeBend[e];
    routeInto(out, e, src, dst === src ? -1 : dst, route, bend);

    const i3 = e * 3;
    const ca = was ? from.edgeColor : to.edgeColor;
    const cb = is ? to.edgeColor : from.edgeColor;
    out.edgeColor[i3] = lerp(ca[i3], cb[i3], colorT);
    out.edgeColor[i3 + 1] = lerp(ca[i3 + 1], cb[i3 + 1], colorT);
    out.edgeColor[i3 + 2] = lerp(ca[i3 + 2], cb[i3 + 2], colorT);
    out.edgeWidth[e] = lerp(was ? from.edgeWidth[e] : to.edgeWidth[e], is ? to.edgeWidth[e] : from.edgeWidth[e], colorT);
  }

  // Light travelling along each edge the step used.
  if (!calm) {
    const base = linearRgb(plan.pulseColor);
    // A small dot in the edge's colour, not a light: it shows direction without glowing.
    const rgb = _pulseRgb;
    rgb[0] = base[0];
    rgb[1] = base[1];
    rgb[2] = base[2];
    for (const e of plan.pulseEdges) {
      const q = smoothstep(0.08, 0.78, u);
      const bell = Math.sin(Math.PI * clamp01((u - 0.05) / 0.85));
      if (bell <= 0.001) continue;
      for (let trail = 0; trail < 2 && out.pulseCount < MAX_PULSES; trail++) {
        const qt = q - trail * 0.05;
        if (qt < 0) continue;
        const j = out.pulseCount++;
        bezier(out, e, qt * out.edgeVisible[e], j);
        out.pulse[j * 4 + 3] = (0.1 - trail * 0.035) * bell;
        out.pulseColor[j * 3] = rgb[0];
        out.pulseColor[j * 3 + 1] = rgb[1];
        out.pulseColor[j * 3 + 2] = rgb[2];
      }
    }
  }
}

function nodeCentre(out: StageSample, s: number, into: Float32Array): void {
  into[0] = out.pos[s * 3];
  into[1] = out.pos[s * 3 + 1];
  into[2] = out.pos[s * 3 + 2];
}

/** Quadratic Bézier control points for an edge between the sampled node positions in _p0 / _p1. */
function routeInto(out: StageSample, e: number, src: number, dst: number, route: string, bend: number): void {
  const i3 = e * 3;
  const r0 = 0.5 * Math.max(out.dims[src * 3], out.dims[src * 3 + 2]) + 0.06;
  if (dst < 0 || route === 'loop') {
    const top = out.pos[src * 3 + 1] + out.dims[src * 3 + 1] / 2;
    out.edgeP0[i3] = _p0[0] + 0.32;
    out.edgeP0[i3 + 1] = top;
    out.edgeP0[i3 + 2] = _p0[2];
    out.edgeP1[i3] = _p0[0] - 0.32;
    out.edgeP1[i3 + 1] = top;
    out.edgeP1[i3 + 2] = _p0[2];
    out.edgeCtrl[i3] = _p0[0];
    out.edgeCtrl[i3 + 1] = top + 1.7;
    out.edgeCtrl[i3 + 2] = _p0[2];
    return;
  }
  const r1 = 0.5 * Math.max(out.dims[dst * 3], out.dims[dst * 3 + 2]) + 0.1;
  let dx = _p1[0] - _p0[0];
  let dy = _p1[1] - _p0[1];
  let dz = _p1[2] - _p0[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  // Sideways (in the plane of the picture) for parallel offsets.
  let px = -dy, py = dx;
  const pl = Math.hypot(px, py) || 1;
  px /= pl; py /= pl;
  const offset = route === 'straight' ? bend : 0;
  out.edgeP0[i3] = _p0[0] + dx * r0 + px * offset;
  out.edgeP0[i3 + 1] = _p0[1] + dy * r0 + py * offset;
  out.edgeP0[i3 + 2] = _p0[2] + dz * r0;
  out.edgeP1[i3] = _p1[0] - dx * r1 + px * offset;
  out.edgeP1[i3 + 1] = _p1[1] - dy * r1 + py * offset;
  out.edgeP1[i3 + 2] = _p1[2] - dz * r1;
  const mx = (out.edgeP0[i3] + out.edgeP1[i3]) / 2;
  const my = (out.edgeP0[i3 + 1] + out.edgeP1[i3 + 1]) / 2;
  const mz = (out.edgeP0[i3 + 2] + out.edgeP1[i3 + 2]) / 2;
  const lift = route === 'arc' ? bend * 2 : 0;
  out.edgeCtrl[i3] = mx;
  out.edgeCtrl[i3 + 1] = my + lift;
  out.edgeCtrl[i3 + 2] = mz;
}

/** Point at parameter q along edge e's curve, written into pulse slot j. */
function bezier(out: StageSample, e: number, q: number, j: number): void {
  const i3 = e * 3;
  const a = (1 - q) * (1 - q);
  const b = 2 * (1 - q) * q;
  const c = q * q;
  out.pulse[j * 4] = a * out.edgeP0[i3] + b * out.edgeCtrl[i3] + c * out.edgeP1[i3];
  out.pulse[j * 4 + 1] = a * out.edgeP0[i3 + 1] + b * out.edgeCtrl[i3 + 1] + c * out.edgeP1[i3 + 1];
  out.pulse[j * 4 + 2] = a * out.edgeP0[i3 + 2] + b * out.edgeCtrl[i3 + 2] + c * out.edgeP1[i3 + 2];
}

/** Treatment lookups kept here so the renderer never needs the trace types. */
export { STATE_TREATMENTS };

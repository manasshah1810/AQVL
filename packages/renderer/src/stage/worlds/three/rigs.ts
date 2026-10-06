import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { CastGait, CastPose } from '../cast';
import { ROLL_RADIUS } from '../cast';

/**
 * The two animals, built from soft primitives (no model files). Each rig
 * is a small hierarchy with pivots where a body bends (lean at the feet,
 * flippers / arms at the shoulder, the head at the neck), driven every frame
 * by `RigInput`: a travel gait, and two poses (the step's and the one
 * fading out) blended over a neutral stance.
 */

export interface RigInput {
  gait: CastGait;
  gaitPhase: number;
  gaitWeight: number;
  pose: CastPose;
  poseWeight: number;
  poseTime: number;
  prevPose: CastPose;
  prevWeight: number;
  /** Target in the rig's own frame: side (x) and forward (z) distance, height above the feet (y). */
  lookLocal: [number, number, number];
  /** Seconds since the viewer clicked this animal (-1: not reacting). */
  react: number;
  /** Seconds of ambient time (breathing, blinking); frozen in calm mode. */
  time: number;
  /** Per-animal offset so two idle animals never move in step. */
  seed: number;
  /** An idle fidget (looking about, preening, eating, shaking off snow...): which, seconds into it, and how much of it shows. */
  idle?: { act: IdleAct; t: number; weight: number };
  /** A fish held in the beak: 1 whole, shrinking to 0 as it is swallowed (undefined / 0: none). */
  fish?: number;
  /** 0..1: strain while shoving or tugging a block (the body bends into it and trembles). */
  effort?: number;
  /** Climbing a rope or an edge: how much, the stride phase (radians), and the slope of the climb (radians from vertical). */
  climb?: { weight: number; phase: number; slope: number };
}

/** The small things an animal does when nothing is asked of it. */
export type IdleAct = 'none' | 'look' | 'preen' | 'eat' | 'shake' | 'play' | 'wave' | 'bow' | 'sniff';

export interface Rig {
  root: Group;
  /** Meshes the pointer can hit. */
  hit: Object3D[];
  update(input: RigInput): void;
  dispose(): void;
}

/** Joint angles a pose asks for. Everything blends linearly from NEUTRAL. */
interface Joints {
  lean: number;
  /** Arm / flipper raise (out to the side) and reach (forward), left and right. */
  raiseL: number;
  raiseR: number;
  reachL: number;
  reachR: number;
  headYaw: number;
  headPitch: number;
  headTilt: number;
  hop: number;
  squash: number;
}

const NEUTRAL: Joints = { lean: 0, raiseL: 0.14, raiseR: 0.14, reachL: 0, reachR: 0, headYaw: 0, headPitch: 0, headTilt: 0, hop: 0, squash: 0 };

function blank(): Joints {
  return { ...NEUTRAL };
}

/** Sets the arm on the target's side. */
function nearArm(j: Joints, side: number, reach: number, raise: number): void {
  if (side > 0) {
    j.reachL = reach;
    j.raiseL = raise;
  } else {
    j.reachR = reach;
    j.raiseR = raise;
  }
}

function addWeighted(out: Joints, j: Joints, w: number): void {
  if (w <= 0) return;
  for (const key of Object.keys(NEUTRAL) as (keyof Joints)[]) out[key] += (j[key] - NEUTRAL[key]) * w;
}

/** Shared pose library. `side` is +1 when the target is on the rig's left (+x), -1 on its right. */
function poseJoints(pose: CastPose, s: number, side: number, look: [number, number, number], style: 'penguin' | 'panda'): Joints {
  const j = blank();
  const towardYaw = Math.max(-0.9, Math.min(0.9, Math.atan2(look[0], Math.max(0.2, look[2]))));
  const towardPitch = Math.max(-0.5, Math.min(0.6, Math.atan2(look[1] - 0.55, Math.max(0.3, Math.hypot(look[0], look[2])))));
  const fade = (rate: number) => Math.exp(-s * rate);
  switch (pose) {
    case 'idle':
      j.headYaw = 0.22 * Math.sin(s * 0.55);
      j.headTilt = 0.05 * Math.sin(s * 0.8 + 1);
      break;
    case 'inspect': {
      // Leans in, head cocked, a flipper / paw at the chin: "which one is bigger?"
      j.lean = 0.2;
      j.headYaw = towardYaw * 0.7;
      j.headPitch = towardPitch;
      j.headTilt = 0.32 * Math.sin(s * 1.7);
      nearArm(j, side, 1.15, style === 'penguin' ? 0.25 : 0.1);
      break;
    }
    case 'push': {
      // Shoulders into it: both arms forward, leaning hard, little effort shakes.
      j.lean = 0.42 + 0.03 * Math.sin(s * 28) * fade(0.6);
      j.reachL = j.reachR = 1.3;
      j.raiseL = j.raiseR = 0.05;
      j.headPitch = 0.12;
      j.headYaw = towardYaw * 0.3;
      j.squash = 0.04;
      break;
    }
    case 'pull': {
      // Hooked on to the block with both flippers, leaning back, head up: a tug of war with the ice.
      j.lean = -0.2;
      j.reachL = j.reachR = 1.05;
      j.raiseL = j.raiseR = 0.2;
      j.headPitch = -0.12;
      j.headYaw = towardYaw * 0.3;
      j.squash = 0.04;
      break;
    }
    case 'tap': {
      // Two quick taps on the cell: the value is being written.
      const beat = Math.max(0, Math.sin(s * 10)) * (s < 0.65 ? 1 : 0);
      nearArm(j, side, 0.95 + 0.55 * beat, 0.35);
      j.lean = 0.14;
      j.hop = 0.04 * beat;
      j.headYaw = towardYaw * 0.6;
      j.headPitch = towardPitch;
      break;
    }
    case 'present':
      // Ta-da: a new cell.
      j.raiseL = j.raiseR = 2.0 - 0.25 * fade(4);
      j.reachL = j.reachR = 0.3;
      j.lean = -0.1;
      j.hop = 0.16 * Math.max(0, Math.sin(Math.min(s, 0.45) * 7));
      j.headPitch = -0.12;
      break;
    case 'shrug':
      // Ruled out: arms out, a little head shake.
      j.raiseL = j.raiseR = 0.95;
      j.reachL = j.reachR = -0.2;
      j.headYaw = 0.38 * Math.sin(s * 11) * fade(1.6);
      j.headTilt = 0.2;
      j.lean = -0.06;
      j.squash = 0.05;
      break;
    case 'point': {
      // "This one": the near arm out towards the cell.
      nearArm(j, side, 0.75, 1.25);
      j.headYaw = towardYaw;
      j.headPitch = towardPitch;
      j.lean = 0.08;
      break;
    }
    case 'cheer': {
      // Hops with flapping arms; it calms after a couple of seconds.
      const energy = 0.35 + 0.65 * fade(0.45);
      j.hop = 0.24 * Math.abs(Math.sin(s * 6.2)) * energy;
      const flap = style === 'penguin' ? 0.55 * Math.sin(s * 24) : 0.3 * Math.sin(s * 9);
      j.raiseL = j.raiseR = 1.55 + flap * energy;
      j.reachL = j.reachR = 0.15;
      j.headPitch = -0.2;
      j.lean = -0.08;
      break;
    }
  }
  return j;
}

/** Fidgets, added to the neutral stance by the animal that is otherwise doing nothing. */
function idleActJoints(act: IdleAct, t: number, j: Joints): void {
  switch (act) {
    case 'look': {
      // A slow look to one side, a pause, the other side, and back, the body turning a little after the head.
      const q = (a: number, b: number) => smoothstepJ(a, b, t);
      const yaw = 0.95 * (q(0, 0.5) - q(1.3, 1.9)) - 1.0 * (q(1.9, 2.4) - q(3.3, 3.9));
      j.headYaw += yaw;
      j.headPitch += 0.08 * Math.sin(t * 1.3);
      j.headTilt += 0.1 * Math.sin(t * 1.9) + 0.12 * yaw;
      j.lean += 0.03;
      break;
    }
    case 'preen': {
      // Beak into the chest feathers, a flipper flutters.
      const down = smoothstepJ(0, 0.4, t) * (1 - smoothstepJ(2.6, 3.1, t));
      j.headPitch += 0.75 * down;
      j.headTilt += 0.45 * down;
      j.headYaw += 0.3 * down * Math.sin(t * 4);
      j.raiseR += 0.5 * down + 0.2 * down * Math.sin(t * 13);
      j.reachR += 0.35 * down;
      break;
    }
    case 'eat': {
      // Head back, the fish goes down; a satisfied wiggle.
      const back = smoothstepJ(0.2, 0.7, t) * (1 - smoothstepJ(1.5, 1.9, t));
      j.headPitch -= 0.85 * back;
      j.squash += 0.03 * Math.max(0, Math.sin((t - 0.9) * 12)) * (t > 0.9 && t < 1.8 ? 1 : 0);
      const wiggle = smoothstepJ(1.8, 2.0, t) * (1 - smoothstepJ(2.8, 3.2, t));
      j.raiseL += 0.5 * wiggle * (0.5 + 0.5 * Math.sin(t * 16));
      j.raiseR += 0.5 * wiggle * (0.5 + 0.5 * Math.sin(t * 16 + Math.PI));
      j.headTilt += 0.12 * wiggle * Math.sin(t * 8);
      break;
    }
    case 'shake': {
      // Shaking snow off: a fast shudder through the whole body.
      const w = smoothstepJ(0, 0.12, t) * (1 - smoothstepJ(0.7, 1.0, t));
      j.headYaw += 0.5 * w * Math.sin(t * 38);
      j.squash += 0.04 * w * Math.sin(t * 46);
      j.raiseL += 0.5 * w;
      j.raiseR += 0.5 * w;
      j.headTilt += 0.25 * w * Math.sin(t * 31);
      break;
    }
    case 'play': {
      // Bouncing about, flippers up.
      const w = smoothstepJ(0, 0.15, t);
      j.hop += 0.16 * Math.abs(Math.sin(t * 6.4)) * w;
      j.raiseL += (0.9 + 0.5 * Math.sin(t * 13)) * w;
      j.raiseR += (0.9 + 0.5 * Math.sin(t * 13 + 1.7)) * w;
      j.headTilt += 0.2 * Math.sin(t * 6.4) * w;
      j.headPitch -= 0.12 * w;
      break;
    }
    case 'wave': {
      const w = smoothstepJ(0, 0.2, t) * (1 - smoothstepJ(1.8, 2.2, t));
      j.raiseL += (1.5 + 0.35 * Math.sin(t * 11)) * w;
      j.headTilt += 0.14 * w;
      j.headPitch -= 0.1 * w;
      break;
    }
    case 'bow': {
      const w = smoothstepJ(0, 0.3, t) * (1 - smoothstepJ(0.9, 1.4, t));
      j.lean += 0.5 * w;
      j.headPitch += 0.3 * w;
      j.raiseL += 0.5 * w;
      j.raiseR += 0.5 * w;
      break;
    }
    case 'sniff': {
      // Nose down at the ice, little hops sideways.
      const w = smoothstepJ(0, 0.3, t) * (1 - smoothstepJ(1.8, 2.3, t));
      j.headPitch += 0.55 * w;
      j.lean += 0.12 * w;
      j.headYaw += 0.3 * w * Math.sin(t * 5);
      break;
    }
    default:
      break;
  }
}

function smoothstepJ(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Breathing and a slow sway, so a waiting animal is never a statue. */
function ambient(j: Joints, time: number, seed: number): void {
  j.squash += 0.012 * Math.sin(time * 2.1 + seed * 3);
  j.headYaw += 0.04 * Math.sin(time * 0.37 + seed * 7);
}

function mat(color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0 });
  Object.assign(m, extra);
  return m;
}

class Builder {
  readonly geometries: BufferGeometry[] = [];
  readonly materials: Material[] = [];
  readonly sphere = this.keep(new SphereGeometry(1, 28, 20));
  readonly hit: Object3D[] = [];

  keep<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  mat(color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
    const m = mat(color, roughness, extra);
    this.materials.push(m);
    return m;
  }

  blob(parent: Object3D, material: Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, hit = false): Mesh {
    const mesh = new Mesh(this.sphere, material);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (hit) this.hit.push(mesh);
    return mesh;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

// ── Penguin ───────────────────────────────────────────────────────────────

/**
 * What makes one penguin walk, bounce and fidget differently from the next
 * (no two animals share a gait, so a crew never moves in lockstep).
 */
export interface Personality {
  /** How far the body rocks from foot to foot (1 = the usual waddle). */
  waddle: number;
  /** Steps per unit of travel (>1 quick little steps, <1 a long lazy stride). */
  tempo: number;
  /** How much the walk bobs up and down. */
  bounce: number;
  /** Seconds between blinks. */
  blink: number;
  /** Body width / head size relative to the usual. */
  plump: number;
  headSize: number;
}

export const PERSONALITIES: Personality[] = [
  { waddle: 1.15, tempo: 1.1, bounce: 1.25, blink: 3.4, plump: 1.0, headSize: 1.04 },
  { waddle: 0.9, tempo: 0.92, bounce: 0.85, blink: 4.3, plump: 1.1, headSize: 0.98 },
  { waddle: 1.0, tempo: 1.0, bounce: 1.0, blink: 3.8, plump: 1.0, headSize: 1.0 },
  { waddle: 1.3, tempo: 1.25, bounce: 1.1, blink: 3.1, plump: 0.92, headSize: 1.08 },
];

export interface PenguinOptions {
  /** Scarf colours (knit stripes), or null for a bare penguin. */
  scarf: [string, string] | null;
  scale?: number;
  /** A chick: rounder, fluffier, grey. */
  chick?: boolean;
  personality?: Personality;
}

export function buildPenguin(options: PenguinOptions): Rig {
  const b = new Builder();
  const root = new Group();
  const scale = options.scale ?? 1;
  const chick = !!options.chick;
  const P = options.personality ?? PERSONALITIES[2];
  const ink = b.mat(chick ? '#66707f' : '#253047', chick ? 0.9 : 0.34);
  const belly = b.mat(chick ? '#d9dde3' : '#f6f3ec', 0.7);
  const orange = b.mat('#f39a2e', 0.5);
  const eyeMat = b.mat('#0b0d12', 0.15);
  const shine = b.mat('#ffffff', 0.2, { emissive: new Color('#ffffff'), emissiveIntensity: 0.6 });
  const blush = b.mat('#f2a0a8', 0.8, { transparent: true, opacity: 0.85 });

  const body = new Group(); // leans about the feet
  root.add(body);
  const squash = new Group();
  body.add(squash);
  squash.scale.set(P.plump, 1, P.plump);
  b.blob(squash, ink, 0.26, 0.31, 0.24, 0, 0.31, 0, true);
  b.blob(squash, belly, 0.215, 0.27, 0.17, 0, 0.29, 0.1, true);
  // A little tail.
  b.blob(squash, ink, 0.08, 0.05, 0.09, 0, 0.06, -0.2);

  const head = new Group();
  head.position.set(0, chick ? 0.53 : 0.565, 0.01);
  head.scale.setScalar(P.headSize);
  squash.add(head);
  b.blob(head, ink, 0.17, 0.158, 0.165, 0, 0, 0, true);
  if (!chick) {
    b.blob(head, belly, 0.13, 0.11, 0.1, 0, -0.012, 0.085);
  } else {
    b.blob(head, belly, 0.13, 0.12, 0.1, 0, -0.01, 0.08);
  }
  const eyes: Mesh[] = [];
  for (const sx of [-1, 1]) {
    const e = b.blob(head, eyeMat, 0.028, 0.034, 0.02, sx * 0.058, 0.02, 0.158);
    eyes.push(e);
    b.blob(head, shine, 0.009, 0.009, 0.006, sx * 0.058 + 0.008, 0.032, 0.176);
    b.blob(head, blush, 0.03, 0.016, 0.012, sx * 0.098, -0.035, 0.13);
  }
  const beakGeo = b.keep(new ConeGeometry(0.042, 0.1, 14));
  const beak = new Mesh(beakGeo, orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.022, 0.2);
  beak.scale.set(1, 1, 0.75);
  head.add(beak);

  // A fish for the beak (shown while eating).
  const fish = new Group();
  const fishMat = b.mat('#a9c2d4', 0.28, { metalness: 0.4 });
  const fishBody = b.blob(fish, fishMat, 0.2, 0.55, 0.62, 0, 0, 0);
  fishBody.scale.set(0.045, 0.06, 0.17);
  const fishTail = new Mesh(b.keep(new ConeGeometry(0.05, 0.09, 3)), fishMat);
  fishTail.rotation.x = -Math.PI / 2;
  fishTail.scale.set(0.3, 1, 1);
  fishTail.position.z = -0.17;
  fish.add(fishTail);
  fish.position.set(0.0, -0.045, 0.26);
  fish.rotation.set(0.15, 0, 0.5);
  fish.visible = false;
  head.add(fish);

  if (options.scarf) {
    const [c1, c2] = options.scarf;
    const scarfA = b.mat(c1, 0.95);
    const scarfB = b.mat(c2, 0.95);
    const ring = new Mesh(b.keep(new TorusGeometry(0.162, 0.042, 10, 28)), scarfA);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.475, 0.0);
    ring.scale.set(1, 0.92, 1);
    squash.add(ring);
    const stripe = new Mesh(b.keep(new TorusGeometry(0.166, 0.016, 8, 28)), scarfB);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(0, 0.475, 0.0);
    squash.add(stripe);
    // The loose end hanging at the front.
    const tail = new Mesh(b.keep(new CylinderGeometry(0.035, 0.04, 0.17, 10)), scarfA);
    tail.position.set(0.075, 0.39, 0.165);
    tail.rotation.set(0.25, 0, 0.2);
    squash.add(tail);
    const tailStripe = new Mesh(b.keep(new CylinderGeometry(0.042, 0.042, 0.03, 10)), scarfB);
    tailStripe.position.set(0.075, 0.38, 0.165);
    tailStripe.rotation.set(0.25, 0, 0.2);
    squash.add(tailStripe);
  }

  const flippers: Group[] = [];
  for (const sx of [1, -1]) {
    const pivot = new Group();
    pivot.position.set(sx * 0.235, 0.43, 0.0);
    squash.add(pivot);
    b.blob(pivot, ink, 0.045, 0.17, 0.095, sx * 0.01, -0.14, 0);
    flippers.push(pivot);
  }
  const feet: Mesh[] = [];
  for (const sx of [-1, 1]) feet.push(b.blob(root, orange, 0.075, 0.03, 0.105, sx * 0.095, 0.022, 0.07));

  root.scale.setScalar(scale);
  const j = blank();
  const idleJ = blank();

  return {
    root,
    hit: b.hit,
    update(input) {
      const side = input.lookLocal[0] >= 0 ? 1 : -1;
      Object.assign(j, NEUTRAL);
      const base = 1 - Math.min(1, input.poseWeight + input.prevWeight);
      if (base > 0) addWeighted(j, poseJoints('idle', input.time + input.seed * 5, side, input.lookLocal, 'penguin'), base);
      addWeighted(j, poseJoints(input.prevPose, input.poseTime + 2, side, input.lookLocal, 'penguin'), input.prevWeight);
      addWeighted(j, poseJoints(input.pose, input.poseTime, side, input.lookLocal, 'penguin'), input.poseWeight);
      ambient(j, input.time, input.seed);
      if (input.idle && input.idle.weight > 0 && input.idle.act !== 'none') {
        Object.assign(idleJ, NEUTRAL);
        idleActJoints(input.idle.act, input.idle.t, idleJ);
        addWeighted(j, idleJ, input.idle.weight);
      }

      const gw = input.gaitWeight;
      const walking = input.gait === 'walk' || input.gait === 'push' || input.gait === 'pull';
      let rock = 0;
      let twist = 0;
      let sway = 0;
      let bob = 0;
      let lift = 0;
      let dive = 0;
      let stepPhase = 0;
      let stepAmp = 0;
      if (walking) {
        // The waddle: weight goes onto one foot (the body rocks and shifts over it, the other foot lifts and
        // swings forward, the flipper on that side lifts for balance), then onto the other. The head stays
        // level against the rock and nods a little, and no two strides are quite alike.
        const raw = input.gaitPhase * P.tempo;
        const ph = raw + 0.1 * Math.sin(raw * 0.37 + input.seed * 5) + 0.06 * Math.sin(raw * 0.91 + input.seed * 2);
        const strength = input.gait === 'walk' ? 1 : 0.5;
        stepAmp = P.waddle * strength * (1 + 0.14 * Math.sin(ph * 0.23 + input.seed)) * gw;
        stepPhase = ph;
        const s = Math.sin(ph);
        rock = -s * 0.17 * stepAmp;
        sway = s * 0.045 * stepAmp;
        twist = s * 0.12 * stepAmp;
        bob = Math.abs(s) * 0.034 * stepAmp * P.bounce;
        if (input.gait === 'walk') {
          j.raiseR += (0.3 + 0.22 * s) * gw;
          j.raiseL += (0.3 - 0.22 * s) * gw;
          j.headTilt += s * 0.1 * stepAmp;
          j.headPitch -= Math.abs(s) * 0.05 * stepAmp;
          j.headYaw += Math.sin(ph - 0.6) * 0.05 * stepAmp;
        } else if (input.gait === 'push') {
          // Head down, shoulders in: short shuffling steps behind the block.
          j.lean += 0.05 * gw;
          j.headPitch += 0.1 * gw;
        } else {
          // Tugging: walking backwards with the block in tow.
          j.lean -= 0.04 * gw;
        }
      } else if (input.gait === 'leap') {
        // Airborne between ledges: flippers up and out, body stretched, eyes on the landing.
        j.raiseL = j.raiseL * (1 - gw) + 1.65 * gw;
        j.raiseR = j.raiseR * (1 - gw) + 1.65 * gw;
        j.reachL = j.reachL * (1 - gw) + 0.25 * gw;
        j.reachR = j.reachR * (1 - gw) + 0.25 * gw;
        j.lean -= 0.12 * gw;
        j.headPitch -= 0.2 * gw;
        j.squash -= 0.05 * gw;
      } else if (input.gait === 'glide') {
        dive = gw;
        j.raiseL = j.raiseL * (1 - gw) + (1.25 + 0.2 * Math.sin(input.time * 14)) * gw;
        j.raiseR = j.raiseR * (1 - gw) + (1.25 + 0.2 * Math.sin(input.time * 14 + 1.5)) * gw;
        j.reachL *= 1 - gw;
        j.reachR *= 1 - gw;
        j.headPitch = j.headPitch * (1 - gw) - 0.9 * gw;
        lift = 0.19 * gw;
      }

      // Strain: the whole body bends into the block and trembles with the effort.
      const effort = input.effort ?? 0;
      if (effort > 0) {
        j.lean += 0.05 * effort;
        j.squash += 0.012 * effort * Math.sin(input.time * 31 + input.seed);
        rock += 0.012 * effort * Math.sin(input.time * 37 + input.seed * 2);
      }

      // Climbing: belly to the rope, flippers reaching up hand over hand, feet scrabbling.
      let climbLean = 0;
      const climb = input.climb;
      if (climb && climb.weight > 0) {
        const cw = climb.weight;
        const c = Math.sin(climb.phase);
        climbLean = (0.28 + climb.slope * 0.55) * cw;
        j.reachL = j.reachL * (1 - cw) + (1.15 + 0.55 * c) * cw;
        j.reachR = j.reachR * (1 - cw) + (1.15 - 0.55 * c) * cw;
        j.raiseL = j.raiseL * (1 - cw) + 0.32 * cw;
        j.raiseR = j.raiseR * (1 - cw) + 0.32 * cw;
        j.headPitch = j.headPitch * (1 - cw) - 0.38 * cw;
        rock += c * 0.07 * cw;
        sway += c * 0.02 * cw;
        bob += Math.abs(c) * 0.02 * cw;
        stepPhase = climb.phase;
        stepAmp = Math.max(stepAmp, cw);
      }

      // Click: a hop with a full spin.
      let spin = 0;
      if (input.react >= 0 && input.react < 1.0) {
        const r = input.react / 1.0;
        j.hop += 0.38 * Math.sin(Math.PI * r);
        spin = Math.PI * 2 * (r * r * (3 - 2 * r));
        j.raiseL = j.raiseR = 1.6 + 0.4 * Math.sin(input.react * 30);
      }

      root.position.set(sway, j.hop + lift + bob, 0);
      root.rotation.set(0, spin + twist, rock);
      body.rotation.x = j.lean * (1 - dive) + 1.42 * dive + climbLean;
      squash.scale.set((1 + j.squash * 0.6) * P.plump, 1 - j.squash, (1 + j.squash * 0.6) * P.plump);
      head.rotation.set(j.headPitch, j.headYaw, j.headTilt, 'YXZ');
      flippers[0].rotation.set(-j.reachL, 0, j.raiseL);
      flippers[1].rotation.set(-j.reachR, 0, -j.raiseR);

      // Feet: alternate while walking (lift, swing forward, plant, slide back), trail behind on a slide.
      const footBack = dive * 0.42;
      for (let i = 0; i < 2; i++) {
        const q = stepPhase + (i === 0 ? 0 : Math.PI);
        const up = Math.max(0, Math.sin(q));
        const fwd = -Math.cos(q);
        const reverse = input.gait === 'pull' ? -1 : 1;
        feet[i].position.set((i === 0 ? -1 : 1) * 0.095, 0.022 + up * 0.055 * stepAmp, 0.07 + fwd * 0.075 * stepAmp * reverse - footBack);
        feet[i].rotation.x = -up * 0.4 * stepAmp;
      }
      feet[0].visible = feet[1].visible = dive < 0.5;

      // A fish in the beak.
      const f = input.fish ?? 0;
      fish.visible = f > 0.02;
      if (fish.visible) fish.scale.setScalar(Math.min(1, f));

      // Blink every few seconds (each penguin at its own rhythm).
      const blink = (input.time + input.seed * 2.3) % P.blink < 0.12 ? 0.15 : 1;
      for (const e of eyes) e.scale.y = 0.034 * blink;
    },
    dispose() {
      b.dispose();
    },
  };
}

// ── Panda ─────────────────────────────────────────────────────────────────

export interface PandaOptions {
  /** 'bamboo': carries a bamboo cane (and points with it); 'leaf': a leaf on the head; null: nothing. */
  prop: 'bamboo' | 'leaf' | null;
  scale?: number;
  cub?: boolean;
}

export function buildPanda(options: PandaOptions): Rig {
  const b = new Builder();
  const root = new Group();
  const cub = !!options.cub;
  const white = b.mat('#f5f2ea', 0.88);
  const black = b.mat('#1d1d22', 0.82);
  const eyeMat = b.mat('#0b0b0e', 0.15);
  const shine = b.mat('#ffffff', 0.2, { emissive: new Color('#ffffff'), emissiveIntensity: 0.6 });
  const pad = b.mat('#c99a9a', 0.8);
  const blush = b.mat('#f2a5a5', 0.85, { transparent: true, opacity: 0.8 });

  // Everything rolls about the body's centre.
  const center = new Group();
  center.position.y = 0.32;
  root.add(center);
  const lean = new Group(); // leans about the seat
  center.add(lean);
  lean.position.y = -0.3;
  const bodyRoot = new Group();
  bodyRoot.position.y = 0.3;
  lean.add(bodyRoot);
  b.blob(bodyRoot, white, 0.33, 0.32, 0.3, 0, 0, 0, true);
  // The black band over the shoulders.
  b.blob(bodyRoot, black, 0.337, 0.135, 0.305, 0, 0.13, -0.005, true);
  b.blob(bodyRoot, white, 0.08, 0.06, 0.07, 0, -0.06, -0.27); // tail

  const legs: Group[] = [];
  for (const sx of [-1, 1]) {
    const leg = new Group();
    leg.position.set(sx * 0.17, -0.22, 0.12);
    bodyRoot.add(leg);
    b.blob(leg, black, 0.12, 0.1, 0.15, 0, 0, 0.05, true);
    b.blob(leg, pad, 0.055, 0.05, 0.02, 0, 0, 0.19);
    legs.push(leg);
  }

  const head = new Group();
  head.position.set(0, 0.36, 0.03);
  bodyRoot.add(head);
  b.blob(head, white, 0.25, 0.215, 0.22, 0, 0, 0, true);
  for (const sx of [-1, 1]) {
    b.blob(head, black, 0.075, 0.072, 0.05, sx * 0.165, 0.155, -0.03);
    const patch = b.blob(head, black, 0.062, 0.085, 0.04, sx * 0.088, 0.015, 0.182);
    patch.rotation.z = sx * 0.55;
    b.blob(head, blush, 0.035, 0.018, 0.012, sx * 0.15, -0.055, 0.17);
  }
  const eyes: Mesh[] = [];
  for (const sx of [-1, 1]) {
    b.blob(head, white, 0.023, 0.025, 0.012, sx * 0.086, 0.025, 0.214);
    eyes.push(b.blob(head, eyeMat, 0.014, 0.016, 0.01, sx * 0.084, 0.024, 0.223));
    b.blob(head, shine, 0.005, 0.005, 0.004, sx * 0.08, 0.031, 0.232);
  }
  b.blob(head, white, 0.095, 0.068, 0.07, 0, -0.065, 0.165);
  b.blob(head, black, 0.035, 0.022, 0.022, 0, -0.035, 0.232);

  const arms: Group[] = [];
  for (const sx of [1, -1]) {
    const arm = new Group();
    arm.position.set(sx * 0.27, 0.15, 0.05);
    bodyRoot.add(arm);
    b.blob(arm, black, 0.085, 0.19, 0.09, sx * 0.02, -0.15, 0.02, true);
    arms.push(arm);
  }

  if (options.prop === 'bamboo') {
    // A bamboo cane in the right paw: what Bao points with.
    const caneGreen = b.mat('#7fae4c', 0.55);
    const caneNode = b.mat('#5f8a33', 0.6);
    const cane = new Group();
    cane.position.set(-0.03, -0.31, 0.06);
    cane.rotation.x = 1.25;
    arms[1].add(cane);
    const stalk = new Mesh(b.keep(new CylinderGeometry(0.022, 0.026, 0.62, 10)), caneGreen);
    stalk.position.y = 0.16;
    cane.add(stalk);
    for (const y of [-0.05, 0.14, 0.33]) {
      const node = new Mesh(b.keep(new CylinderGeometry(0.03, 0.03, 0.022, 10)), caneNode);
      node.position.y = y;
      cane.add(node);
    }
    const leaf = b.blob(cane, b.mat('#8cc152', 0.7), 0.035, 0.12, 0.01, 0.05, 0.42, 0);
    leaf.rotation.z = -0.7;
  } else if (options.prop === 'leaf') {
    const leafMat = b.mat('#7fb84a', 0.7);
    for (const [rz, x] of [[-0.5, -0.04], [0.45, 0.04]] as const) {
      const leaf = b.blob(head, leafMat, 0.04, 0.11, 0.012, x, 0.25, 0.02);
      leaf.rotation.z = rz;
    }
    b.blob(head, b.mat('#e86f5a', 0.6), 0.03, 0.03, 0.03, 0, 0.215, 0.03);
  }

  root.scale.setScalar(options.scale ?? (cub ? 0.62 : 1));
  const j = blank();

  return {
    root,
    hit: b.hit,
    update(input) {
      const side = input.lookLocal[0] >= 0 ? 1 : -1;
      Object.assign(j, NEUTRAL);
      j.raiseL = j.raiseR = 0.25;
      const base = 1 - Math.min(1, input.poseWeight + input.prevWeight);
      if (base > 0) addWeighted(j, poseJoints('idle', input.time + input.seed * 5, side, input.lookLocal, 'panda'), base);
      addWeighted(j, poseJoints(input.prevPose, input.poseTime + 2, side, input.lookLocal, 'panda'), input.prevWeight);
      addWeighted(j, poseJoints(input.pose, input.poseTime, side, input.lookLocal, 'panda'), input.poseWeight);
      ambient(j, input.time, input.seed);

      let roll = 0;
      let curl = 0;
      let rock = 0;
      const gw = input.gaitWeight;
      if (input.gait === 'roll') {
        roll = input.gaitPhase;
        curl = gw;
      } else if (input.gait === 'walk') {
        rock = Math.sin(input.gaitPhase) * 0.12 * gw;
        j.hop += Math.abs(Math.sin(input.gaitPhase)) * 0.03 * gw;
      }
      // Click: a happy forward roll on the spot.
      if (input.react >= 0 && input.react < 1.1) {
        const r = input.react / 1.1;
        const e = r * r * (3 - 2 * r);
        roll += e * Math.PI * 2;
        curl = Math.max(curl, Math.sin(Math.PI * r));
        j.hop += 0.12 * Math.sin(Math.PI * r);
      }
      // Curled into a ball: head tucked, limbs in.
      const k = curl;
      j.headPitch = j.headPitch * (1 - k) + 0.65 * k;
      j.raiseL = j.raiseL * (1 - k) + 0.05 * k;
      j.raiseR = j.raiseR * (1 - k) + 0.05 * k;
      j.reachL = j.reachL * (1 - k) + 1.1 * k;
      j.reachR = j.reachR * (1 - k) + 1.1 * k;
      j.lean *= 1 - k;

      center.position.y = 0.32 + j.hop + (ROLL_RADIUS - 0.32 + 0.04) * k;
      center.rotation.set(roll, 0, rock);
      lean.rotation.x = j.lean;
      bodyRoot.scale.set(1 + j.squash * 0.6, 1 - j.squash, 1 + j.squash * 0.6);
      head.position.set(0, 0.36 - 0.1 * k, 0.03 + 0.08 * k);
      head.rotation.set(j.headPitch, j.headYaw, j.headTilt, 'YXZ');
      arms[0].rotation.set(-j.reachL, 0, j.raiseL);
      arms[1].rotation.set(-j.reachR, 0, -j.raiseR);
      for (const leg of legs) leg.rotation.x = -0.9 * k;
      const blink = (input.time + input.seed * 2.3) % 4.1 < 0.13 ? 0.12 : 1;
      for (const e of eyes) e.scale.y = 0.016 * blink;
    },
    dispose() {
      b.dispose();
    },
  };
}

// ── Soft contact shadow under an animal ──────────────────────────────────

export function createBlobShadow(color: string, opacity: number): { mesh: Mesh; dispose: () => void } {
  const geometry = new CircleGeometry(0.5, 32);
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

// ── Eagle ─────────────────────────────────────────────────────────────────

export interface EagleInput {
  /** Wing beat clock (seconds-ish), 0 gliding to 1 flapping hard, and whether the talons hold a ball. */
  clock: number;
  flap: number;
  holding: boolean;
  /** Climb / dive of the flight path (radians, + nose up) and how hard it banks into a turn. */
  pitch: number;
  bank: number;
}

export interface EagleRig {
  root: Group;
  update(input: EagleInput): void;
  dispose(): void;
}

/** A sea eagle of the polar coast: dark body, white head and tail, yellow hooked beak and talons. */
export function buildEagle(scale = 1): EagleRig {
  const b = new Builder();
  const root = new Group();
  const frame = new Group(); // pitch and bank
  root.add(frame);
  const brown = b.mat('#4a3626', 0.78);
  const brownLight = b.mat('#7a5a3c', 0.8);
  const white = b.mat('#f5f2e9', 0.7);
  const yellow = b.mat('#f2b632', 0.5);
  const dark = b.mat('#15110e', 0.3);

  b.blob(frame, brown, 0.2, 0.17, 0.52, 0, 0, 0);
  b.blob(frame, brownLight, 0.15, 0.1, 0.34, 0, -0.07, 0.1);
  const head = new Group();
  head.position.set(0, 0.09, 0.5);
  frame.add(head);
  b.blob(head, white, 0.13, 0.12, 0.15, 0, 0.02, 0.04);
  const beak = new Mesh(b.keep(new ConeGeometry(0.06, 0.2, 10)), yellow);
  beak.rotation.x = Math.PI / 2 + 0.25;
  beak.position.set(0, -0.01, 0.2);
  beak.scale.set(1, 1, 0.8);
  head.add(beak);
  for (const sx of [-1, 1]) {
    b.blob(head, yellow, 0.026, 0.026, 0.02, sx * 0.075, 0.05, 0.12);
    b.blob(head, dark, 0.014, 0.014, 0.012, sx * 0.078, 0.05, 0.135);
    const brow = b.blob(head, white, 0.05, 0.016, 0.05, sx * 0.07, 0.085, 0.11);
    brow.rotation.z = -sx * 0.4;
  }
  // The tail, a white fan.
  const tail = new Group();
  tail.position.set(0, 0.0, -0.5);
  frame.add(tail);
  b.blob(tail, white, 0.17, 0.018, 0.34, 0, 0, -0.18);

  const wings: { inner: Group; outer: Group }[] = [];
  for (const sx of [-1, 1]) {
    const inner = new Group();
    inner.position.set(sx * 0.14, 0.06, 0.12);
    frame.add(inner);
    const w1 = b.blob(inner, brown, 0.5, 0.035, 0.3, sx * 0.5, 0, 0);
    w1.rotation.y = sx * 0.12;
    const outer = new Group();
    outer.position.set(sx * 1.0, 0, 0.0);
    inner.add(outer);
    b.blob(outer, brown, 0.46, 0.03, 0.22, sx * 0.42, 0, -0.05);
    // Finger feathers at the tip.
    for (let i = 0; i < 4; i++) {
      const f = b.blob(outer, brownLight, 0.2, 0.012, 0.045, sx * (0.78 + i * 0.03), 0, 0.1 - i * 0.075);
      f.rotation.y = sx * (0.1 + i * 0.1);
    }
    wings.push({ inner, outer });
  }
  const legs: Group[] = [];
  for (const sx of [-1, 1]) {
    const leg = new Group();
    leg.position.set(sx * 0.09, -0.12, 0.12);
    frame.add(leg);
    const shank = new Mesh(b.keep(new CylinderGeometry(0.025, 0.02, 0.24, 6)), yellow);
    shank.position.y = -0.12;
    leg.add(shank);
    for (let i = -1; i <= 1; i++) {
      const claw = new Mesh(b.keep(new ConeGeometry(0.018, 0.12, 6)), dark);
      claw.position.set(i * 0.035, -0.27, 0.05);
      claw.rotation.x = Math.PI * 0.6;
      leg.add(claw);
    }
    legs.push(leg);
  }

  root.scale.setScalar(scale);
  return {
    root,
    update(input) {
      const beat = Math.sin(input.clock * 15) * input.flap;
      const flap = 0.12 + 0.62 * beat;
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? -1 : 1;
        wings[i].inner.rotation.z = -sx * flap;
        // The tip trails the shoulder: bends the other way as the wing comes down.
        wings[i].outer.rotation.z = -sx * (flap * 0.9 + 0.35 * Math.sin(input.clock * 15 - 0.9) * input.flap);
      }
      frame.rotation.set(-input.pitch, 0, input.bank, 'YXZ');
      frame.position.y = 0.03 * beat;
      for (const leg of legs) leg.rotation.x = input.holding ? -0.55 : 0.5;
      tail.rotation.x = -0.1 - 0.2 * Math.max(0, input.pitch);
    },
    dispose() {
      b.dispose();
    },
  };
}

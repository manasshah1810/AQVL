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
  /** 0..1: arms round a ball it is carrying (pandas). */
  carry?: number;
  /** 0..1: sitting on its haunches, held across a run of seated acts so it does not bob up between them (pandas). */
  seat?: number;
  /** 0..1: a paper lantern carried in the right paw, lit (pandas that have one). */
  lamp?: number;
}

/** The small things an animal does when nothing is asked of it. */
export type IdleAct =
  | 'none'
  | 'look'
  | 'preen'
  | 'eat'
  | 'shake'
  | 'play'
  | 'wave'
  | 'bow'
  | 'sniff'
  | 'sit'
  | 'chew'
  | 'scratch'
  | 'stretch'
  | 'drink'
  // Pandas, round the grove at all hours: asleep on its side, nodding off where it sits, lying back to look at the
  // stars, a big yawn, lolling on its back with its feet in its paws, a little dance, swiping at fireflies, a ride down
  // the slide and on the swing, and the students' acts (notes in an open book, chin in paw, clapping, a paw up).
  | 'sleep'
  | 'doze'
  | 'stargaze'
  | 'yawn'
  | 'lounge'
  | 'dance'
  | 'chase'
  | 'slide'
  | 'swing'
  | 'notes'
  | 'ponder'
  | 'clap'
  | 'raise';

/** Acts a panda does sitting on its haunches (it stays down from one to the next). */
export const SEATED_ACTS: ReadonlySet<IdleAct> = new Set<IdleAct>(['sit', 'chew', 'doze', 'stargaze', 'notes', 'ponder', 'clap', 'raise', 'slide', 'swing']);
/** How fast a swing goes back and forth (radians of its swing per second). */
export const SWING_RATE = 2.35;

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
    case 'nod': {
      // A match: a small, pleased nod and a paw pump.
      const beat = Math.max(0, Math.sin(s * 9)) * (s < 0.9 ? 1 : 0);
      j.headPitch = 0.28 * beat;
      j.lean = 0.1;
      j.hop = 0.05 * beat;
      nearArm(j, side, 0.9, 0.5 + 0.5 * beat);
      j.headYaw = towardYaw * 0.4;
      break;
    }
    case 'startle': {
      // Something vanished: a jump back, arms up, a wide-eyed freeze.
      const pop = Math.exp(-s * 7);
      j.hop = 0.2 * pop;
      j.raiseL = j.raiseR = 1.1 + 0.4 * pop;
      j.reachL = j.reachR = 0.3;
      j.lean = -0.18 * Math.min(1, pop * 2 + 0.3);
      j.headPitch = -0.15;
      j.headTilt = 0.1 * Math.sin(s * 6) * fade(1.2);
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

/**
 * What makes one panda walk, bounce and fidget differently from the next: its size, how far it sways from
 * foot to foot, how quick its steps are, how bouncy, how often it blinks, how round it is, how lively its ears are.
 */
export interface PandaPersonality {
  size: number;
  sway: number;
  tempo: number;
  bounce: number;
  blink: number;
  plump: number;
  headSize: number;
  ear: number;
}

export const PANDA_PERSONALITIES: PandaPersonality[] = [
  // Bao: big, steady, a little lazy.
  { size: 1.07, sway: 1.0, tempo: 0.9, bounce: 0.85, blink: 4.6, plump: 1.1, headSize: 1.0, ear: 0.8 },
  // Mochi: smaller, quicker, bouncy, ears everywhere.
  { size: 0.93, sway: 1.25, tempo: 1.18, bounce: 1.3, blink: 3.3, plump: 0.95, headSize: 1.07, ear: 1.35 },
  { size: 1.0, sway: 1.0, tempo: 1.0, bounce: 1.0, blink: 4.0, plump: 1.0, headSize: 1.0, ear: 1.0 },
];

export interface PandaOptions {
  /** 'bamboo': carries a bamboo cane (and points with it); 'leaf': a leaf on the head; null: nothing. */
  prop: 'bamboo' | 'leaf' | null;
  scale?: number;
  cub?: boolean;
  personality?: PandaPersonality;
  /** A student's things: a backpack of this colour, a book with this cover, round glasses. */
  bag?: string;
  book?: string;
  glasses?: boolean;
  /** Carries a paper lantern about at night. */
  lamp?: boolean;
}

/** What an idle action asks of a panda beyond the shared joints. */
interface PandaExtras {
  /** Sitting back on its haunches, feet out in front. */
  seat: number;
  /** A length of bamboo in the paws, raised to the mouth (0..1), and chewing it (0..1). */
  snack: number;
  chew: number;
  /** A paw scratching behind the ear (0..1). */
  scratch: number;
  /** Arms overhead, back arched (0..1), and a wide yawn. */
  stretch: number;
  yawn: number;
  /** Muzzle down to the water. */
  drink: number;
  /** Lying down on its side (asleep) and on its back (lolling about). */
  lie: number;
  back: number;
  /** Eyes shut (asleep, dozing). */
  shut: number;
  /** An open book in the lap, and the pencil going in it. */
  book: number;
  write: number;
  /** Legs kicking on the swing (-1..1). */
  kick: number;
}

function pandaIdle(act: IdleAct, t: number, j: Joints, x: PandaExtras, seed: number): void {
  switch (act) {
    case 'sit': {
      // Plops down, looks about slowly, a little sway.
      const w = smoothstepJ(0, 0.5, t);
      x.seat = w;
      j.headYaw += 0.5 * w * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
      j.headPitch -= 0.08 * w;
      j.raiseL += 0.15 * w;
      j.raiseR += 0.15 * w;
      break;
    }
    case 'chew': {
      // Sits, takes up a cane in both paws, and chews it: the head bobs, the muzzle works, the cane gets shorter.
      const sit = smoothstepJ(0, 0.55, t);
      const up = smoothstepJ(0.45, 1.0, t);
      x.seat = sit;
      x.snack = up;
      x.chew = up * smoothstepJ(1.0, 1.4, t);
      j.reachL += 1.15 * up;
      j.reachR += 1.15 * up;
      j.raiseL += 0.25 * up;
      j.raiseR += 0.25 * up;
      j.headPitch += 0.14 * up * Math.sin(t * 7.5) * x.chew;
      j.headTilt += 0.08 * Math.sin(t * 2.2) * up;
      j.headYaw += 0.12 * Math.sin(t * 0.8) * up;
      break;
    }
    case 'scratch': {
      // One paw up behind the ear, scrubbing, the head tilting into it.
      const w = smoothstepJ(0, 0.35, t) * (1 - smoothstepJ(2.1, 2.5, t));
      x.scratch = w;
      j.reachR += 2.5 * w;
      j.raiseR += 0.75 * w;
      j.headTilt += 0.3 * w + 0.05 * w * Math.sin(t * 16);
      j.headYaw += 0.15 * w;
      j.lean += 0.04 * w;
      break;
    }
    case 'stretch': {
      // Arms right up, back arched, a wide yawn, then it all lets go.
      const up = smoothstepJ(0, 0.8, t) * (1 - smoothstepJ(2.0, 2.7, t));
      x.stretch = up;
      x.yawn = smoothstepJ(0.6, 1.0, t) * (1 - smoothstepJ(1.7, 2.1, t));
      j.reachL += 2.7 * up;
      j.reachR += 2.7 * up;
      j.raiseL += 0.35 * up;
      j.raiseR += 0.35 * up;
      j.lean -= 0.2 * up;
      j.headPitch -= 0.5 * up;
      j.squash -= 0.04 * up;
      j.squash += 0.05 * smoothstepJ(2.5, 2.8, t) * (1 - smoothstepJ(2.8, 3.2, t));
      break;
    }
    case 'drink': {
      // Down on all fours at the water's edge.
      const w = smoothstepJ(0, 0.6, t) * (1 - smoothstepJ(2.4, 3.0, t));
      x.drink = w;
      j.lean += 0.45 * w;
      j.headPitch += 0.55 * w + 0.08 * w * Math.sin(t * 7);
      j.reachL += 0.9 * w;
      j.reachR += 0.9 * w;
      break;
    }
    case 'look': {
      const q = (a: number, b: number) => smoothstepJ(a, b, t);
      const yaw = 0.95 * (q(0, 0.5) - q(1.3, 1.9)) - 1.0 * (q(1.9, 2.4) - q(3.3, 3.9));
      j.headYaw += yaw;
      j.headPitch += 0.1 * Math.sin(t * 1.3) - 0.1 * q(0.2, 0.7) * (1 - q(1.2, 1.7));
      j.headTilt += 0.1 * Math.sin(t * 1.9) + 0.14 * yaw;
      j.lean += 0.03;
      break;
    }
    case 'sniff': {
      const w = smoothstepJ(0, 0.3, t) * (1 - smoothstepJ(1.8, 2.3, t));
      j.headPitch += 0.5 * w;
      j.lean += 0.15 * w;
      j.headYaw += 0.3 * w * Math.sin(t * 5);
      break;
    }
    case 'wave': {
      const w = smoothstepJ(0, 0.2, t) * (1 - smoothstepJ(1.8, 2.2, t));
      j.raiseL += (1.5 + 0.35 * Math.sin(t * 11)) * w;
      j.headTilt += 0.14 * w;
      break;
    }
    case 'bow': {
      const w = smoothstepJ(0, 0.3, t) * (1 - smoothstepJ(0.9, 1.4, t));
      j.lean += 0.45 * w;
      j.headPitch += 0.3 * w;
      break;
    }
    case 'play': {
      const w = smoothstepJ(0, 0.15, t);
      j.hop += 0.12 * Math.abs(Math.sin(t * 5.2)) * w;
      j.raiseL += (0.9 + 0.5 * Math.sin(t * 9)) * w;
      j.raiseR += (0.9 + 0.5 * Math.sin(t * 9 + 1.7)) * w;
      j.headTilt += 0.2 * Math.sin(t * 5.2) * w;
      break;
    }
    case 'shake': {
      const w = smoothstepJ(0, 0.12, t) * (1 - smoothstepJ(0.7, 1.0, t));
      j.headYaw += 0.5 * w * Math.sin(t * 36);
      j.squash += 0.04 * w * Math.sin(t * 44);
      j.headTilt += 0.25 * w * Math.sin(t * 29);
      break;
    }
    case 'sleep': {
      // Lies down on its side, curls up a little, and sleeps: slow deep breaths, an ear twitch, now and then a paw moves.
      const w = smoothstepJ(0, 0.9, t);
      const breath = Math.sin(t * 1.25 + seed * 3);
      x.lie = w;
      x.shut = smoothstepJ(0.3, 0.8, t);
      j.squash += 0.035 * breath * w;
      j.headPitch += 0.25 * w;
      j.headTilt += 0.12 * w;
      j.reachL += 0.8 * w + 0.15 * w * Math.max(0, Math.sin(t * 0.21 + seed)) ** 8;
      j.reachR += 0.6 * w;
      j.raiseL -= 0.1 * w;
      j.raiseR -= 0.1 * w;
      break;
    }
    case 'doze': {
      // Sitting up, nodding off: the head sinks slowly, jerks back up, sinks again.
      const cycle = (t + seed * 1.7) % 4.6;
      const sink = smoothstepJ(0, 3.8, cycle) * (1 - smoothstepJ(3.9, 4.1, cycle));
      x.shut = 0.55 + 0.45 * sink;
      j.headPitch += 0.15 + 0.45 * sink;
      j.headTilt += 0.18 * sink * Math.sin(seed * 5);
      j.lean += 0.1 * sink;
      j.squash += 0.02 * Math.sin(t * 1.5 + seed);
      break;
    }
    case 'stargaze': {
      // Leans back on its paws and looks up at the sky; every so often a paw points at something up there.
      const w = smoothstepJ(0, 1.2, t);
      const point = smoothstepJ(0.2, 0.6, Math.sin(t * 0.33 + seed * 2)) * w;
      j.lean -= 0.22 * w;
      j.headPitch -= 0.75 * w;
      j.headYaw += 0.35 * Math.sin(t * 0.27 + seed * 4) * w;
      j.headTilt += 0.12 * Math.sin(t * 0.41 + seed) * w;
      j.raiseR += 0.4 * w;
      j.raiseL += 0.4 * w * (1 - point);
      j.reachL += 2.6 * point;
      j.raiseL += 0.25 * point;
      break;
    }
    case 'yawn': {
      // A great yawn, arms halfway up, then a paw rubs an eye.
      const up = smoothstepJ(0, 0.7, t) * (1 - smoothstepJ(1.8, 2.3, t));
      const rub = smoothstepJ(2.1, 2.4, t) * (1 - smoothstepJ(3.2, 3.6, t));
      x.yawn = up;
      x.shut = Math.max(up * 0.9, rub);
      j.reachL += 1.4 * up;
      j.reachR += 1.4 * up + 2.1 * rub;
      j.raiseL += 0.5 * up;
      j.raiseR += 0.5 * up - 0.2 * rub;
      j.lean -= 0.12 * up;
      j.headPitch -= 0.35 * up;
      j.headTilt += 0.2 * rub * Math.sin(t * 9);
      break;
    }
    case 'lounge': {
      // Flops onto its back and plays with its feet, rocking side to side.
      const w = smoothstepJ(0, 0.7, t);
      x.back = w;
      j.reachL += 1.6 * w + 0.25 * Math.sin(t * 2.6 + seed) * w;
      j.reachR += 1.6 * w + 0.25 * Math.sin(t * 2.6 + seed + 1.4) * w;
      j.raiseL += 0.1 * w;
      j.raiseR += 0.1 * w;
      j.headPitch += 0.35 * w;
      j.headYaw += 0.3 * Math.sin(t * 0.7 + seed) * w;
      break;
    }
    case 'dance': {
      // A happy little dance: hops from foot to foot, arms up and waving in turn, a wiggle.
      const w = smoothstepJ(0, 0.3, t);
      const beat = t * (5.4 + (seed % 1) * 1.2);
      j.hop += 0.08 * Math.abs(Math.sin(beat)) * w;
      j.raiseL += (1.3 + 0.5 * Math.sin(beat)) * w;
      j.raiseR += (1.3 - 0.5 * Math.sin(beat)) * w;
      j.reachL += 0.5 * Math.max(0, Math.sin(beat * 0.5)) * w;
      j.reachR += 0.5 * Math.max(0, -Math.sin(beat * 0.5)) * w;
      j.headTilt += 0.22 * Math.sin(beat) * w;
      j.squash += 0.03 * Math.sin(beat * 2) * w;
      break;
    }
    case 'chase': {
      // Fireflies: looks up, swipes at one with a paw, then the other, hopping after them.
      const w = smoothstepJ(0, 0.3, t);
      const ph = t * 3.1 + seed * 2;
      const left = Math.max(0, Math.sin(ph));
      const right = Math.max(0, -Math.sin(ph));
      j.reachL += (1.0 + 1.6 * left) * w;
      j.reachR += (1.0 + 1.6 * right) * w;
      j.raiseL += 0.3 * w;
      j.raiseR += 0.3 * w;
      j.headPitch -= (0.45 + 0.15 * Math.sin(ph * 0.7)) * w;
      j.headYaw += 0.35 * Math.sin(ph * 0.5) * w;
      j.hop += 0.1 * Math.max(0, Math.sin(ph * 2)) ** 2 * w;
      break;
    }
    case 'slide': {
      // Down the slide: leaning back, both arms in the air.
      const w = smoothstepJ(0, 0.25, t);
      j.raiseL += 1.45 * w;
      j.raiseR += 1.45 * w;
      j.reachL += 0.9 * w;
      j.reachR += 0.9 * w;
      j.lean -= 0.3 * w;
      j.headPitch -= 0.15 * w;
      x.yawn = 0.55 * w;
      break;
    }
    case 'swing': {
      // On the swing: paws up on the ropes, legs out on the way forward and tucked on the way back.
      const w = smoothstepJ(0, 0.4, t);
      const ph = Math.cos(t * SWING_RATE);
      j.reachL += 2.45 * w;
      j.reachR += 2.45 * w;
      j.raiseL += 0.05 * w;
      j.raiseR += 0.05 * w;
      j.lean -= 0.12 * ph * w;
      j.headPitch -= 0.12 * ph * w;
      x.kick = ph * w;
      break;
    }
    case 'notes': {
      // A student at the lesson: the book open in its lap, writing; it looks up at the board every few lines, nods, writes again.
      const w = smoothstepJ(0, 0.6, t);
      const cycle = (t + seed * 2.9) % (5.2 + (seed % 1.3));
      const up = smoothstepJ(3.2, 3.6, cycle) * (1 - smoothstepJ(4.6, 5.0, cycle));
      x.book = w;
      x.write = w * (1 - up);
      j.headPitch += (0.38 * (1 - up) - 0.12 * up) * w;
      j.headPitch += 0.07 * Math.sin(cycle * 6) * up;
      j.headYaw += 0.08 * Math.sin(t * 0.8 + seed) * w;
      j.reachL += 0.85 * w;
      j.raiseL -= 0.45 * w;
      j.reachR += (0.95 + 0.12 * Math.sin(t * 13 + seed)) * w * (1 - up) + 0.6 * up * w;
      j.raiseR -= (0.5 + 0.06 * Math.sin(t * 9.1)) * w;
      break;
    }
    case 'ponder': {
      // Chin in paw, head on one side, thinking it over.
      const w = smoothstepJ(0, 0.6, t);
      x.book = w * 0.9;
      j.reachR += 2.05 * w;
      j.raiseR -= 0.8 * w;
      j.reachL += 0.8 * w;
      j.raiseL -= 0.3 * w;
      j.headTilt += (0.22 + 0.05 * Math.sin(t * 0.9 + seed)) * w;
      j.headPitch -= 0.08 * w;
      j.headYaw += 0.1 * Math.sin(t * 0.5) * w;
      break;
    }
    case 'clap': {
      // Claps, paws together in front, bouncing where it sits.
      const w = smoothstepJ(0, 0.25, t);
      const c = 0.5 + 0.5 * Math.sin(t * (13 + (seed % 1) * 3));
      j.reachL += 1.3 * w;
      j.reachR += 1.3 * w;
      j.raiseL += (-1.2 + 0.55 * c) * w;
      j.raiseR += (-1.2 + 0.55 * c) * w;
      j.hop += 0.03 * c * w;
      j.headPitch -= 0.1 * w;
      j.headTilt += 0.1 * Math.sin(t * 3) * w;
      break;
    }
    case 'raise': {
      // A paw straight up: it has a question.
      const w = smoothstepJ(0, 0.35, t) * (1 - smoothstepJ(2.0, 2.4, t));
      x.book = 0.9;
      j.reachL += 2.9 * w;
      j.raiseL += (0.15 + 0.08 * Math.sin(t * 8)) * w;
      j.reachR += 0.9;
      j.headPitch -= 0.15 * w;
      j.lean -= 0.05 * w;
      break;
    }
    default:
      break;
  }
}

export function buildPanda(options: PandaOptions): Rig {
  const b = new Builder();
  const root = new Group();
  const cub = !!options.cub;
  const P = options.personality ?? PANDA_PERSONALITIES[2];
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
  const tail = new Group();
  tail.position.set(0, -0.06, -0.27);
  bodyRoot.add(tail);
  b.blob(tail, white, 0.08, 0.06, 0.07, 0, 0, 0);

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
  head.scale.setScalar(P.headSize);
  bodyRoot.add(head);
  b.blob(head, white, 0.25, 0.215, 0.22, 0, 0, 0, true);
  // Ears: each on its own pivot so it can flick and flop.
  const ears: Group[] = [];
  for (const sx of [-1, 1]) {
    const ear = new Group();
    ear.position.set(sx * 0.165, 0.155, -0.03);
    head.add(ear);
    b.blob(ear, black, 0.075, 0.072, 0.05, 0, 0, 0);
    ears.push(ear);
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
  const muzzle = b.blob(head, white, 0.095, 0.068, 0.07, 0, -0.065, 0.165);
  b.blob(head, black, 0.035, 0.022, 0.022, 0, -0.035, 0.232);
  // An open mouth for yawning.
  const mouth = b.blob(head, b.mat('#7a2f3a', 0.6), 0.05, 0.001, 0.04, 0, -0.095, 0.2);

  const arms: Group[] = [];
  for (const sx of [1, -1]) {
    const arm = new Group();
    arm.position.set(sx * 0.27, 0.15, 0.05);
    bodyRoot.add(arm);
    b.blob(arm, black, 0.085, 0.19, 0.09, sx * 0.02, -0.15, 0.02, true);
    arms.push(arm);
  }

  // A length of bamboo to chew (held in both paws, shown while it is being eaten).
  const caneGreen = b.mat('#7fae4c', 0.55);
  const caneNode = b.mat('#5f8a33', 0.6);
  const snack = new Group();
  snack.visible = false;
  bodyRoot.add(snack);
  const bite = new Mesh(b.keep(new CylinderGeometry(0.024, 0.027, 0.5, 10)), caneGreen);
  snack.add(bite);
  for (const y of [-0.12, 0.08, 0.2]) {
    const n = new Mesh(b.keep(new CylinderGeometry(0.031, 0.031, 0.02, 10)), caneNode);
    n.position.y = y;
    snack.add(n);
  }
  const sprig = b.blob(snack, b.mat('#8cc152', 0.7), 0.035, 0.12, 0.01, 0.05, 0.27, 0);
  sprig.rotation.z = -0.7;

  if (options.prop === 'bamboo') {
    // A bamboo cane in the right paw: what Bao points with.
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

  // A student's things: a backpack with a flap and two straps, a book (carried shut under the arm, open in the lap
  // at a lesson, with a pencil), and round glasses.
  if (options.bag) {
    const bagMat = b.mat(options.bag, 0.75);
    const flapMat = b.mat(new Color(options.bag).multiplyScalar(0.78).getStyle(), 0.75);
    const bag = new Group();
    bag.position.set(0, 0.02, -0.29);
    bodyRoot.add(bag);
    b.blob(bag, bagMat, 0.2, 0.21, 0.1, 0, 0, 0);
    b.blob(bag, flapMat, 0.19, 0.09, 0.07, 0, 0.12, -0.035);
    b.blob(bag, b.mat('#f2d16b', 0.4), 0.025, 0.025, 0.02, 0, 0.07, -0.1);
    b.blob(bag, flapMat, 0.13, 0.08, 0.05, 0, -0.09, -0.08);
    // Straps over the shoulders (on the black band), down to the armpits.
    for (const sx of [-1, 1]) {
      const strap = b.blob(bodyRoot, flapMat, 0.026, 0.1, 0.022, sx * 0.17, 0.16, 0.24);
      strap.rotation.x = -0.55;
      strap.rotation.z = sx * 0.2;
      b.blob(bodyRoot, flapMat, 0.024, 0.024, 0.08, sx * 0.19, 0.24, 0.08);
    }
  }
  let bookShut: Group | null = null;
  let bookOpen: Group | null = null;
  let pencil: Mesh | null = null;
  if (options.book) {
    const cover = b.mat(options.book, 0.6);
    const paper = b.mat('#fbf6e8', 0.85);
    const boxGeo = b.keep(new CylinderGeometry(0.5, 0.5, 1, 4, 1));
    boxGeo.rotateY(Math.PI / 4);
    const box = (parent: Object3D, m: Material, w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new Mesh(boxGeo, m);
      mesh.scale.set(w * 1.414, h, d * 1.414);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    bookShut = new Group();
    bookShut.position.set(0.04, -0.3, 0.06);
    bookShut.rotation.set(0.2, 0.2, 0.1);
    arms[0].add(bookShut);
    box(bookShut, cover, 0.05, 0.22, 0.17, 0, 0, 0);
    box(bookShut, paper, 0.04, 0.2, 0.16, 0.003, 0, 0.012);
    bookOpen = new Group();
    bookOpen.visible = false;
    bodyRoot.add(bookOpen);
    for (const sx of [-1, 1]) {
      const half = new Group();
      half.rotation.z = sx * 0.22;
      bookOpen.add(half);
      box(half, cover, 0.15, 0.012, 0.2, sx * 0.075, 0, 0);
      box(half, paper, 0.14, 0.012, 0.19, sx * 0.07, 0.011, 0);
      for (let l = 0; l < 4; l++) box(half, b.mat('#9aa3b5', 0.9), 0.1, 0.003, 0.006, sx * 0.075, 0.019, -0.06 + l * 0.04);
    }
    pencil = new Mesh(b.keep(new CylinderGeometry(0.008, 0.008, 0.14, 6)), b.mat('#f2b632', 0.5));
    pencil.position.set(0.0, -0.33, 0.07);
    pencil.rotation.x = 1.0;
    pencil.visible = false;
    arms[1].add(pencil);
  }
  if (options.glasses) {
    const rim = b.mat('#3b2f2a', 0.4);
    const ring = b.keep(new TorusGeometry(0.042, 0.007, 6, 18));
    for (const sx of [-1, 1]) {
      const g = new Mesh(ring, rim);
      g.position.set(sx * 0.086, 0.025, 0.232);
      head.add(g);
    }
    b.blob(head, rim, 0.022, 0.006, 0.006, 0, 0.032, 0.238);
  }
  // A paper lantern on a short cane, carried in the right paw on a night walk.
  let lamp: Group | null = null;
  let lampGlow: MeshStandardMaterial | null = null;
  if (options.lamp) {
    lamp = new Group();
    lamp.position.set(-0.02, -0.33, 0.08);
    lamp.visible = false;
    arms[1].add(lamp);
    const cane = new Mesh(b.keep(new CylinderGeometry(0.008, 0.008, 0.3, 6)), caneNode);
    cane.rotation.x = Math.PI / 2;
    cane.position.z = 0.12;
    lamp.add(cane);
    const hanger = new Group();
    hanger.position.z = 0.26;
    lamp.add(hanger);
    lampGlow = b.mat('#c2412d', 0.7, { emissive: new Color('#ffb04a'), emissiveIntensity: 1.6 });
    b.blob(hanger, lampGlow, 0.065, 0.08, 0.065, 0, -0.1, 0);
    b.blob(hanger, black, 0.04, 0.012, 0.04, 0, -0.02, 0);
    b.blob(hanger, black, 0.04, 0.012, 0.04, 0, -0.18, 0);
  }

  root.scale.setScalar((options.scale ?? (cub ? 0.62 : 1)) * P.size);
  const j = blank();
  const idleJ = blank();
  const ex: PandaExtras = { seat: 0, snack: 0, chew: 0, scratch: 0, stretch: 0, yawn: 0, drink: 0, lie: 0, back: 0, shut: 0, book: 0, write: 0, kick: 0 };
  let lastTime = 0;
  let earTwitch = { at: -10, side: 1 };

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
      ex.seat = ex.snack = ex.chew = ex.scratch = ex.stretch = ex.yawn = ex.drink = ex.lie = ex.back = ex.shut = ex.book = ex.write = ex.kick = 0;
      if (input.idle && input.idle.weight > 0 && input.idle.act !== 'none') {
        Object.assign(idleJ, NEUTRAL);
        idleJ.raiseL = idleJ.raiseR = 0.25;
        const px = { ...ex };
        pandaIdle(input.idle.act, input.idle.t, idleJ, px, input.seed);
        addWeighted(j, idleJ, input.idle.weight);
        for (const key of Object.keys(ex) as (keyof PandaExtras)[]) ex[key] = px[key] * input.idle.weight;
      }

      const gw = input.gaitWeight;
      const gait = input.gait;
      let roll = 0;
      let curl = 0;
      let rock = 0;
      let twist = 0;
      let sway = 0;
      let bob = 0;
      let stepPhase = 0;
      let stepAmp = 0;
      let seat = Math.max(ex.seat, input.seat ?? 0);
      let flail = 0;
      let climbLean = 0;
      let lift = 0;
      let reverse = 1;

      if (gait === 'roll') {
        roll = input.gaitPhase;
        curl = gw;
      } else if (gait === 'walk' || gait === 'push' || gait === 'pull') {
        // The amble: the weight goes onto one foot (the body rocks and shifts over it, the other foot lifts and
        // swings forward, the opposite arm swings with it), then onto the other. The head stays level against
        // the rock and bobs a little behind the body; no two strides are quite alike.
        const raw = input.gaitPhase * P.tempo;
        const ph = raw + 0.12 * Math.sin(raw * 0.37 + input.seed * 5) + 0.07 * Math.sin(raw * 0.91 + input.seed * 2);
        const strength = gait === 'walk' ? 1 : 0.65;
        stepAmp = strength * (1 + 0.16 * Math.sin(ph * 0.23 + input.seed)) * gw;
        stepPhase = ph;
        const s = Math.sin(ph);
        rock = -s * 0.15 * P.sway * stepAmp;
        sway = s * 0.04 * P.sway * stepAmp;
        twist = s * 0.11 * P.sway * stepAmp;
        bob = Math.abs(s) * 0.034 * P.bounce * stepAmp;
        lean.rotation.x = 0;
        j.reachL += 0.5 * s * stepAmp * (gait === 'walk' ? 1 : 0);
        j.reachR -= 0.5 * s * stepAmp * (gait === 'walk' ? 1 : 0);
        j.headTilt += s * 0.1 * stepAmp;
        j.headPitch -= Math.abs(s) * 0.06 * stepAmp;
        j.headYaw += Math.sin(ph - 0.6) * 0.06 * stepAmp;
        if (gait === 'walk') {
          j.lean += 0.05 * gw;
        } else if (gait === 'push') {
          // Head down, shoulders in: short, strong steps behind the block.
          j.lean += 0.08 * gw;
          j.headPitch += 0.1 * gw;
        } else {
          // Tugging: walking backwards with the block in tow.
          j.lean -= 0.06 * gw;
          reverse = -1;
        }
      } else if (gait === 'climb') {
        const climb = input.climb;
        const cw = climb ? climb.weight : gw;
        const ph = climb ? climb.phase : input.gaitPhase;
        const c = Math.sin(ph);
        climbLean = (0.3 + (climb ? climb.slope : 0) * 0.5) * cw;
        const carrying = input.carry ?? 0;
        // Hand over hand and foot over foot, the opposite pairs together; the body hugs the pole.
        j.reachL = j.reachL * (1 - cw) + (carrying > 0.5 ? 1.25 : 2.3 + 0.5 * c) * cw;
        j.reachR = j.reachR * (1 - cw) + (carrying > 0.5 ? 1.25 : 2.3 - 0.5 * c) * cw;
        j.raiseL = j.raiseL * (1 - cw) + 0.3 * cw;
        j.raiseR = j.raiseR * (1 - cw) + 0.3 * cw;
        j.headPitch = j.headPitch * (1 - cw) - 0.35 * cw;
        rock += c * 0.08 * cw;
        sway += c * 0.02 * cw;
        bob += Math.abs(c) * 0.02 * cw;
        stepPhase = ph;
        stepAmp = Math.max(stepAmp, cw);
      } else if (gait === 'leap') {
        // Airborne between platforms: arms up and out, legs trailing, eyes on the landing.
        j.raiseL = j.raiseL * (1 - gw) + 1.7 * gw;
        j.raiseR = j.raiseR * (1 - gw) + 1.7 * gw;
        j.reachL = j.reachL * (1 - gw) + 0.4 * gw;
        j.reachR = j.reachR * (1 - gw) + 0.4 * gw;
        j.lean -= 0.12 * gw;
        j.headPitch -= 0.2 * gw;
        j.squash -= 0.05 * gw;
      } else if (gait === 'tumble') {
        const ph = input.gaitPhase;
        if (ph < 1) {
          // Losing the grip and falling: arms and legs everywhere, tipping over backwards, landing on the seat.
          flail = Math.sin(Math.min(1, ph / 0.2) * Math.PI * 0.5);
          roll = -0.9 * (ph * ph) * (1 + 0.4 * Math.sin(ph * 5));
          j.raiseL = 1.9 + 0.7 * Math.sin(ph * 46);
          j.raiseR = 1.9 + 0.7 * Math.sin(ph * 46 + 2.4);
          j.reachL = 0.6 + 0.8 * Math.sin(ph * 31);
          j.reachR = 0.6 + 0.8 * Math.sin(ph * 31 + 1.9);
          j.headPitch = -0.3 + 0.2 * Math.sin(ph * 25);
          j.squash += 0.05 * Math.sin(Math.max(0, ph - 0.85) * Math.PI / 0.15);
          seat = smoothstep01(0.7, 1, ph);
        } else {
          // Dazed on the ground: sits up, a shake of the head, a paw to the head, then it is back on its feet.
          const u = ph - 1;
          seat = 1 - smoothstep01(0.65, 1, u);
          roll = -0.9 * (1 - smoothstep01(0, 0.5, u)) * 0;
          j.headYaw += 0.55 * Math.sin(u * 17) * (1 - u);
          j.headPitch += 0.2 * (1 - u);
          j.reachR += 1.9 * smoothstep01(0.2, 0.5, u) * (1 - smoothstep01(0.7, 1, u));
          j.raiseL += 0.5;
        }
      }

      // Carrying a ball: both arms round it, held to the chest.
      const carry = input.carry ?? 0;
      if (carry > 0) {
        j.reachL = j.reachL * (1 - carry) + 1.3 * carry;
        j.reachR = j.reachR * (1 - carry) + 1.3 * carry;
        j.raiseL = j.raiseL * (1 - carry) + 0.1 * carry;
        j.raiseR = j.raiseR * (1 - carry) + 0.1 * carry;
        j.headPitch += 0.1 * carry;
        j.lean -= 0.05 * carry;
      }

      // Strain: the whole body bends into the block and trembles with the effort.
      const effort = input.effort ?? 0;
      if (effort > 0) {
        j.lean += 0.06 * effort;
        j.squash += 0.014 * effort * Math.sin(input.time * 29 + input.seed);
        rock += 0.014 * effort * Math.sin(input.time * 37 + input.seed * 2);
      }

      // Click: a happy forward roll on the spot.
      if (input.react >= 0 && input.react < 1.1) {
        const r = input.react / 1.1;
        const e = r * r * (3 - 2 * r);
        roll += e * Math.PI * 2;
        curl = Math.max(curl, Math.sin(Math.PI * r));
        j.hop += 0.12 * Math.sin(Math.PI * r);
      }

      // A lantern held out in front on a night walk.
      const lampW = lamp ? (input.lamp ?? 0) : 0;
      if (lampW > 0) {
        j.reachR = j.reachR * (1 - lampW) + 0.95 * lampW;
        j.raiseR = j.raiseR * (1 - lampW) + 0.12 * lampW;
      }

      // Lying down: on its side to sleep (each panda has its own side), on its back to loll about.
      const sleepSide = Math.sin(input.seed * 12.9898) > 0 ? 1 : -1;
      rock += sleepSide * 1.32 * ex.lie;
      roll -= 1.2 * ex.back;
      j.lean += 0.25 * ex.lie;

      // Curled into a ball: head tucked, limbs in.
      const k = curl;
      j.headPitch = j.headPitch * (1 - k) + 0.65 * k;
      j.raiseL = j.raiseL * (1 - k) + 0.05 * k;
      j.raiseR = j.raiseR * (1 - k) + 0.05 * k;
      j.reachL = j.reachL * (1 - k) + 1.1 * k;
      j.reachR = j.reachR * (1 - k) + 1.1 * k;
      j.lean *= 1 - k;

      // Sitting on its haunches (feet out in front, soles to the camera, leaning back a little).
      seat = Math.min(1, seat);
      const sitDrop = 0.07 * seat;
      lift = 0;

      // Ears: a flick every so often (each panda at its own rhythm), a flop with each stride, a lag when it hops.
      const dt = input.time - lastTime;
      lastTime = input.time;
      if (dt < 0 || dt > 0.5) earTwitch = { at: -10, side: 1 };
      const period = 3.4 + 1.2 * Math.sin(input.seed * 7.3);
      const cycle = Math.floor((input.time + input.seed * 3.1) / period);
      const into = (input.time + input.seed * 3.1) - cycle * period;
      if (into < 0.3) earTwitch = { at: input.time - into, side: (cycle % 2 === 0 ? 1 : -1) };
      const twitch = Math.max(0, 1 - (input.time - earTwitch.at) / 0.3);
      const flick = twitch > 0 ? Math.sin((1 - twitch) * Math.PI * 4) * twitch : 0;
      const flop = stepAmp > 0 ? Math.sin(stepPhase * 2 - 0.8) * 0.14 * stepAmp : 0;
      const earLag = (j.hop + bob) * -2.2;
      ears[0].rotation.z = (0.12 + flop + earLag * 0.5 + (earTwitch.side < 0 ? flick * 0.5 : 0)) * P.ear;
      ears[1].rotation.z = (-0.12 - flop - earLag * 0.5 - (earTwitch.side > 0 ? flick * 0.5 : 0)) * P.ear;

      center.position.set(sway, 0.32 + j.hop + bob + (ROLL_RADIUS - 0.32 + 0.04) * k - sitDrop + lift - 0.03 * ex.lie - 0.02 * ex.back, 0);
      center.rotation.set(roll, 0, rock);
      lean.rotation.x = j.lean + climbLean - 0.28 * seat + 0.12 * ex.stretch * 0 - 0.1 * flail;
      bodyRoot.rotation.y = twist;
      bodyRoot.scale.set((1 + j.squash * 0.6) * P.plump, 1 - j.squash, (1 + j.squash * 0.6) * P.plump);
      head.position.set(0, 0.36 - 0.1 * k, 0.03 + 0.08 * k);
      head.rotation.set(j.headPitch - ex.drink * 0, j.headYaw - twist * 0.6, j.headTilt - rock * 0.7, 'YXZ');
      arms[0].rotation.set(-j.reachL, 0, j.raiseL);
      arms[1].rotation.set(-j.reachR, 0, -j.raiseR);

      // Feet: alternate while walking (lift, swing forward, plant, slide back); tucked when curled, out in front when sitting.
      for (let i = 0; i < 2; i++) {
        const q = stepPhase + (i === 0 ? 0 : Math.PI);
        const up = Math.max(0, Math.sin(q)) * stepAmp;
        const fwd = -Math.cos(q) * stepAmp * reverse;
        const sx = i === 0 ? -1 : 1;
        const climbing = gait === 'climb';
        const sp = Math.sin(stepPhase + (i === 0 ? 0 : Math.PI));
        legs[i].position.set(
          sx * (0.17 + seat * 0.03),
          -0.22 + up * 0.065 + (climbing ? 0.07 * Math.max(0, sp) * stepAmp : 0) + seat * 0.03 + 0.05 * flail * Math.sin(input.gaitPhase * 30 + i * 2),
          0.12 + fwd * 0.1 + (climbing ? 0.05 * sp : 0) + seat * 0.2,
        );
        const kick = ex.kick * (i === 0 ? 1 : 0.85);
        const paddle = ex.back * (0.9 + 0.35 * Math.sin(input.time * 2.6 + input.seed + i * 1.4));
        legs[i].rotation.x = -up * 0.4 - 0.9 * k - seat * 1.15 + (climbing ? -0.5 * Math.max(0, sp) : 0) - 0.55 * Math.max(0, kick) * seat + 0.45 * Math.max(0, -kick) * seat - 0.7 * ex.lie - paddle;
      }

      // Sitting back with the legs forward lowers the tail and tips the body.
      tail.rotation.x = 0.25 * seat + 0.15 * Math.sin(input.time * 3 + input.seed) * (1 - seat);
      tail.rotation.z = 0.2 * Math.sin(stepPhase) * stepAmp;

      // The snack: raised to the mouth in both paws while it is chewed, shorter with every bite.
      snack.visible = ex.snack > 0.02;
      if (snack.visible) {
        snack.position.set(0, 0.12 + 0.2 * ex.snack, 0.32);
        snack.rotation.set(-0.35 - 0.35 * (1 - ex.snack), 0, 0.15 * Math.sin(input.time * 7.5) * ex.chew);
        snack.scale.set(1, 1 - 0.18 * ex.chew * (0.5 + 0.5 * Math.sin(input.time * 0.5)), 1);
      }

      // Muzzle: works while chewing, opens wide to yawn.
      const work = ex.chew * (0.5 + 0.5 * Math.sin(input.time * 15));
      muzzle.scale.set(0.095 * (1 + 0.12 * work), 0.068 * (1 + 0.3 * work + 0.55 * ex.yawn), 0.07);
      mouth.scale.set(0.05, 0.001 + 0.045 * ex.yawn + 0.012 * work, 0.04);

      // Blink every few seconds (each panda at its own rhythm); eyes shut for a yawn and a good scratch, and in sleep.
      const blink = (input.time + input.seed * 2.3) % P.blink < 0.13 || ex.yawn > 0.5 || ex.scratch > 0.6 ? 0.12 : 1;
      for (const e of eyes) e.scale.y = 0.016 * Math.min(blink, 1 - 0.88 * ex.shut);

      // A student's book: shut under the arm, open in the lap at a lesson (with the pencil going).
      if (bookOpen && bookShut) {
        bookOpen.visible = ex.book > 0.05;
        // Put down while it sits, and out of the paw when the arm is up (clapping, swinging, waving).
        bookShut.visible = !bookOpen.visible && ex.lie < 0.3 && ex.back < 0.3 && k < 0.3 && seat < 0.4 && j.reachL < 1.1 && j.raiseL < 0.9;
        if (bookOpen.visible) {
          const o = ex.book;
          bookOpen.position.set(0, -0.05 + 0.1 * o, 0.28 + 0.06 * o);
          bookOpen.rotation.set(-0.55 - 0.3 * (1 - o), 0, 0.03 * Math.sin(input.time * 0.7 + input.seed));
          bookOpen.scale.setScalar(o);
        }
      }
      if (pencil) pencil.visible = ex.write > 0.15;

      // The lantern: lit, and swinging gently on its cane, the paper kept upright under it.
      if (lamp && lampGlow) {
        lamp.visible = lampW > 0.02;
        if (lamp.visible) {
          const hanger = lamp.children[1];
          hanger.rotation.set(j.reachR + 0.12 * Math.sin(input.time * 2.7 + stepPhase), 0, 0.1 * Math.sin(input.time * 2.1));
          lampGlow.emissiveIntensity = (1.2 + 0.25 * Math.sin(input.time * 9.3) * Math.sin(input.time * 4.1)) * lampW;
        }
      }
    },
    dispose() {
      b.dispose();
    },
  };
}

function smoothstep01(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
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

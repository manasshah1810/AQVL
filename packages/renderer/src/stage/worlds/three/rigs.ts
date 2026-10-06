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
}

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

export interface PenguinOptions {
  /** Scarf colours (knit stripes), or null for a bare penguin. */
  scarf: [string, string] | null;
  scale?: number;
  /** A chick: rounder, fluffier, grey. */
  chick?: boolean;
}

export function buildPenguin(options: PenguinOptions): Rig {
  const b = new Builder();
  const root = new Group();
  const scale = options.scale ?? 1;
  const chick = !!options.chick;
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
  b.blob(squash, ink, 0.26, 0.31, 0.24, 0, 0.31, 0, true);
  b.blob(squash, belly, 0.215, 0.27, 0.17, 0, 0.29, 0.1, true);
  // A little tail.
  b.blob(squash, ink, 0.08, 0.05, 0.09, 0, 0.06, -0.2);

  const head = new Group();
  head.position.set(0, chick ? 0.53 : 0.565, 0.01);
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

      // Travel.
      let rock = 0;
      let lift = 0;
      let dive = 0;
      const gw = input.gaitWeight;
      if (input.gait === 'walk') {
        rock = Math.sin(input.gaitPhase) * 0.15 * gw;
        j.raiseL += 0.3 * gw;
        j.raiseR += 0.3 * gw;
      } else if (input.gait === 'glide') {
        dive = gw;
        j.raiseL = j.raiseL * (1 - gw) + 1.25 * gw;
        j.raiseR = j.raiseR * (1 - gw) + 1.25 * gw;
        j.reachL *= 1 - gw;
        j.reachR *= 1 - gw;
        j.headPitch = j.headPitch * (1 - gw) - 0.9 * gw;
        lift = 0.19 * gw;
      }
      // Click: a hop with a full spin.
      let spin = 0;
      if (input.react >= 0 && input.react < 1.0) {
        const r = input.react / 1.0;
        j.hop += 0.38 * Math.sin(Math.PI * r);
        spin = Math.PI * 2 * (r * r * (3 - 2 * r));
        j.raiseL = j.raiseR = 1.6 + 0.4 * Math.sin(input.react * 30);
      }

      root.position.y = j.hop + lift;
      root.rotation.set(0, spin, rock);
      body.rotation.x = j.lean * (1 - dive) + 1.42 * dive;
      squash.scale.set(1 + j.squash * 0.6, 1 - j.squash, 1 + j.squash * 0.6);
      head.rotation.set(j.headPitch, j.headYaw, j.headTilt, 'YXZ');
      flippers[0].rotation.set(-j.reachL, 0, j.raiseL);
      flippers[1].rotation.set(-j.reachR, 0, -j.raiseR);
      // Feet: alternate while walking, trail behind on a slide.
      const stepL = input.gait === 'walk' ? Math.max(0, Math.sin(input.gaitPhase)) * 0.05 * gw : 0;
      const stepR = input.gait === 'walk' ? Math.max(0, -Math.sin(input.gaitPhase)) * 0.05 * gw : 0;
      feet[0].position.set(-0.095, 0.022 + stepL, 0.07 - dive * 0.42);
      feet[1].position.set(0.095, 0.022 + stepR, 0.07 - dive * 0.42);
      feet[0].visible = feet[1].visible = dive < 0.5;
      // Blink every few seconds.
      const blink = (input.time + input.seed * 2.3) % 3.7 < 0.12 ? 0.15 : 1;
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

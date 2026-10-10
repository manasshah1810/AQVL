import { CircleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Matrix4, Mesh, Quaternion, TorusGeometry, Vector3, type Material, type Object3D } from 'three';
import { ROLL_RADIUS } from '../cast';
import {
  Builder,
  NEUTRAL,
  PERSONALITIES,
  addWeighted,
  ambient,
  blank,
  idleActJoints,
  mergeRigParts,
  pandaIdle,
  poseJoints,
  smoothstep01,
  type IdleAct,
  type PandaExtras,
  type Personality,
  type Rig,
} from './rigs';

/**
 * The penguins of the colony: the same soft-primitive penguin as the crew,
 * built so that it can do everything the colony does (sit, lie down to
 * sleep, loll on its back, roll, take a tumble, swim, belly-slide, play the
 * guitar, lift a barbell, take notes...) and dressed as itself: Yash's
 * muscles and headband, Manas's headset and tummy, Manan's guitar, Tirrth's
 * green hat over a bald crown, Aastha's bow, Siddhant's gold chain and
 * shades, Bansaree's glasses and shawl, Dishi's crest, Deep's enormous
 * glasses, the students' bags and books.
 *
 * The idle acts share their joint curves with the pandas' (`pandaIdle`); the
 * penguin's own (preening, swallowing a fish) come from `idleActJoints`.
 */

export interface ColonyPenguinOptions {
  scale?: number;
  personality?: Personality;
  /** A knitted scarf (two colours: the knit and the stripe). */
  scarf?: [string, string];
  /** A student's things: a backpack of this colour, a book with this cover. */
  bag?: string;
  book?: string;
  /** Round glasses ('big': enormous ones that are the whole of the face). */
  glasses?: boolean | 'big';
  /** Muscles (broad chest, a six-pack, shoulders, thick flippers); a pear (an enormous lower half). */
  bulk?: number;
  pear?: number;
  /** How round (1: the usual). */
  plump?: number;
  /** A human-style brimmed hat of this colour, over a bald crown. */
  hat?: string;
  bald?: boolean;
  /** A gold chain and bracelets; shades. */
  chain?: boolean;
  shades?: boolean;
  /** A teacher's things: a little top-knot, a shawl of this colour, a pointer. */
  bun?: boolean;
  shawl?: string;
  pointer?: boolean;
  /** A bow, a flower, a crest of yellow plumes (like a rockhopper's), long lashes, a headband, a headset, a tuft of feathers. */
  bow?: string;
  flower?: string;
  crest?: string;
  lashes?: boolean;
  headband?: string;
  headset?: boolean;
  tuft?: boolean;
  /** Plays a guitar (carried on the back when not playing it); lifts a barbell. */
  guitar?: boolean;
  barbell?: boolean;
}

const _wm = new Matrix4();
const _inv = new Matrix4();
const _loc = new Matrix4();
const _wp = new Vector3();
const _ws = new Vector3();
const _wq = new Quaternion();
const _dp = new Vector3();
const _dq = new Quaternion();
const _ONE = new Vector3(1, 1, 1);
const _DOWN = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -1.2);

/** Height of the body's centre above the feet. */
const MID = 0.31;

export function buildColonyPenguinRaw(options: ColonyPenguinOptions): Rig {
  const b = new Builder();
  const root = new Group();
  const P = options.personality ?? PERSONALITIES[2];
  const bulk = options.bulk ?? 0;
  const pear = options.pear ?? 0;
  const plump = (options.plump ?? 1) * P.plump;
  const ink = b.mat('#253047', 0.34);
  const belly = b.mat('#f6f3ec', 0.7);
  const shade = b.mat('#e2ddd2', 0.75);
  const orange = b.mat('#f39a2e', 0.5);
  const eyeMat = b.mat('#0b0d12', 0.15);
  const shine = b.mat('#ffffff', 0.2, { emissive: new Color('#ffffff'), emissiveIntensity: 0.6 });
  const blush = b.mat('#f2a0a8', 0.8, { transparent: true, opacity: 0.85 });
  const gold = b.mat('#f0b920', 0.22, { metalness: 0.85 });

  // Everything rolls about the body's centre, and leans about the feet.
  const center = new Group();
  center.position.y = MID;
  root.add(center);
  const lean = new Group();
  lean.position.y = -MID;
  center.add(lean);
  const body = new Group();
  body.position.y = MID;
  lean.add(body);

  const wide = 1 + 0.22 * bulk;
  b.blob(body, ink, 0.26 * wide, 0.31, 0.24 * (1 + 0.12 * bulk), 0, 0, 0, true);
  b.blob(body, belly, 0.215 * (1 + 0.1 * bulk), 0.27, 0.17, 0, -0.02, 0.1, true);
  if (bulk > 0) {
    // Shoulders like boulders, a broad chest, a six-pack.
    for (const sx of [-1, 1]) {
      b.blob(body, ink, 0.12 * bulk, 0.11 * bulk, 0.13 * bulk, sx * 0.2 * wide, 0.12, 0.0);
      b.blob(body, belly, 0.095, 0.075, 0.06, sx * 0.083, 0.1, 0.205);
      for (const y of [-0.0, -0.065, -0.13]) b.blob(body, shade, 0.033, 0.026, 0.02, sx * 0.04, y - 0.01, 0.262);
    }
  }
  if (pear > 0) {
    // An enormous lower half (and a bottom behind), the feet set wide under it.
    b.blob(body, ink, 0.26 + 0.17 * pear, 0.19 + 0.04 * pear, 0.25 + 0.13 * pear, 0, -0.14, -0.01, true);
    b.blob(body, belly, 0.21 + 0.15 * pear, 0.16 + 0.03 * pear, 0.18 + 0.08 * pear, 0, -0.13, 0.08 + 0.04 * pear, true);
    b.blob(body, ink, 0.22 * pear, 0.17 * pear, 0.2 * pear, 0, -0.12, -0.18 * pear);
  }
  const tail = b.blob(body, ink, 0.08, 0.05, 0.09, 0, -0.25, -0.2 - 0.1 * pear);

  const head = new Group();
  head.position.set(0, 0.255, 0.01);
  head.scale.setScalar(P.headSize);
  body.add(head);
  b.blob(head, ink, 0.17, 0.158, 0.165, 0, 0, 0, true);
  b.blob(head, belly, 0.13, 0.11, 0.1, 0, -0.012, 0.085);
  const eyes: Mesh[] = [];
  for (const sx of [-1, 1]) {
    eyes.push(b.blob(head, eyeMat, 0.028, 0.034, 0.02, sx * 0.058, 0.02, 0.158));
    b.blob(head, shine, 0.009, 0.009, 0.006, sx * 0.058 + 0.008, 0.032, 0.176);
    b.blob(head, blush, 0.03, 0.016, 0.012, sx * 0.098, -0.035, 0.13);
  }
  // The beak: the upper half fixed, the lower one opens (a yawn, a song).
  const beakGeo = b.keep(new ConeGeometry(0.042, 0.1, 14));
  const beak = new Mesh(beakGeo, orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.016, 0.2);
  beak.scale.set(1, 1, 0.6);
  head.add(beak);
  const jaw = new Group();
  jaw.position.set(0, -0.03, 0.16);
  head.add(jaw);
  const lower = new Mesh(beakGeo, b.mat('#e0832a', 0.55));
  lower.rotation.x = Math.PI / 2;
  lower.position.set(0, 0, 0.036);
  lower.scale.set(0.85, 0.8, 0.35);
  jaw.add(lower);

  // A fish for the beak (shown while eating).
  const fish = new Group();
  const fishMat = b.mat('#a9c2d4', 0.28, { metalness: 0.4 });
  const fishBody = b.blob(fish, fishMat, 1, 1, 1, 0, 0, 0);
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

  // Flippers: thick and bulging on a strong one.
  const flippers: Group[] = [];
  for (const sx of [1, -1]) {
    const pivot = new Group();
    pivot.position.set(sx * 0.235 * wide, 0.12, 0.0);
    body.add(pivot);
    b.blob(pivot, ink, 0.045 * (1 + 0.6 * bulk), 0.17, 0.095 * (1 + 0.35 * bulk), sx * 0.01, -0.14, 0, true);
    if (bulk > 0) b.blob(pivot, ink, 0.06 * bulk, 0.07 * bulk, 0.08 * bulk, sx * 0.02, -0.06, 0.02);
    flippers.push(pivot);
  }
  const footSpread = 0.095 + 0.07 * pear;
  const feet: Mesh[] = [];
  for (const sx of [-1, 1]) feet.push(b.blob(body, orange, 0.075 * (1 + 0.2 * pear), 0.03, 0.105, sx * footSpread, 0.022 - MID, 0.07));

  if (options.scarf) {
    const [c1, c2] = options.scarf;
    const knit = b.mat(c1, 0.95);
    const stripe = b.mat(c2, 0.95);
    const ring = new Mesh(b.keep(new TorusGeometry(0.162 * wide, 0.042, 10, 28)), knit);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.165, 0);
    ring.scale.set(1, 0.92, 1);
    body.add(ring);
    const band = new Mesh(b.keep(new TorusGeometry(0.166 * wide, 0.016, 8, 28)), stripe);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.165, 0);
    body.add(band);
    const end = new Mesh(b.keep(new CylinderGeometry(0.035, 0.04, 0.17, 10)), knit);
    end.position.set(0.075, 0.08, 0.165);
    end.rotation.set(0.25, 0, 0.2);
    body.add(end);
  }

  if (options.glasses) {
    const big = options.glasses === 'big';
    const rim = b.mat(big ? '#17171c' : '#3b2f2a', 0.4);
    const rad = big ? 0.074 : 0.04;
    const ring = b.keep(new TorusGeometry(rad, big ? 0.012 : 0.006, big ? 8 : 6, big ? 28 : 18));
    const gx = big ? 0.074 : 0.058;
    const gz = big ? 0.176 : 0.168;
    const lens = b.mat('#bfe3ff', 0.05, { transparent: true, opacity: big ? 0.22 : 0.12, depthWrite: false });
    for (const sx of [-1, 1]) {
      const g = new Mesh(ring, rim);
      g.position.set(sx * gx, 0.024, gz);
      g.rotation.y = sx * 0.12;
      head.add(g);
      const disc = new Mesh(b.keep(new CircleGeometry(rad, 24)), lens);
      disc.position.set(sx * gx, 0.024, gz + 0.001);
      disc.rotation.y = sx * 0.12;
      head.add(disc);
      // The arms, back to where the ears would be.
      b.blob(head, rim, 0.008, 0.008, 0.08, sx * (big ? 0.15 : 0.12), 0.026, 0.1);
    }
    b.blob(head, rim, big ? 0.02 : 0.014, big ? 0.01 : 0.006, 0.006, 0, big ? 0.036 : 0.03, gz + 0.008);
  }

  // Tirrth's crown: bare and shiny under a green brimmed hat with a band and a feather, worn a little back.
  let hat: Group | null = null;
  if (options.bald) {
    const skin = b.mat('#f0cdb0', 0.3);
    b.blob(head, skin, 0.152, 0.085, 0.15, 0, 0.088, 0.005);
    b.blob(head, b.mat('#ffffff', 0.2, { transparent: true, opacity: 0.55 }), 0.03, 0.012, 0.03, 0.03, 0.17, 0.06);
  }
  if (options.hat) {
    const hatMat = b.mat(options.hat, 0.7);
    const bandMat = b.mat(new Color(options.hat).multiplyScalar(0.45).getStyle(), 0.6);
    hat = new Group();
    hat.position.set(0, 0.135, -0.02);
    hat.rotation.set(-0.28, 0.1, 0.06);
    head.add(hat);
    hat.add(new Mesh(b.keep(new CylinderGeometry(0.25, 0.26, 0.018, 30)), hatMat));
    const crown = new Mesh(b.keep(new CylinderGeometry(0.11, 0.135, 0.13, 24)), hatMat);
    crown.position.y = 0.072;
    hat.add(crown);
    b.blob(hat, hatMat, 0.11, 0.03, 0.13, 0, 0.14, 0);
    const hb = new Mesh(b.keep(new CylinderGeometry(0.137, 0.14, 0.038, 24)), bandMat);
    hb.position.y = 0.03;
    hat.add(hb);
    const feather = b.blob(hat, b.mat('#f2d16b', 0.6), 0.01, 0.06, 0.024, 0.13, 0.09, 0.04);
    feather.rotation.z = -0.45;
  }

  // Siddhant: a heavy gold chain with a pendant, a finer one, bracelets, shades.
  if (options.chain) {
    for (const [r, y, tube] of [[0.19, 0.15, 0.015], [0.178, 0.175, 0.008]] as const) {
      const chain = new Mesh(b.keep(new TorusGeometry(r * wide, tube, 8, 40)), gold);
      chain.position.set(0, y, 0.02);
      chain.rotation.x = Math.PI / 2 + 0.32;
      body.add(chain);
    }
    b.blob(body, gold, 0.03, 0.04, 0.014, 0, 0.06, 0.255);
    for (const fl of flippers) {
      const bracelet = new Mesh(b.keep(new TorusGeometry(0.05, 0.011, 6, 18)), gold);
      bracelet.position.set(fl === flippers[0] ? 0.012 : -0.012, -0.24, 0);
      bracelet.rotation.x = Math.PI / 2;
      fl.add(bracelet);
    }
  }
  if (options.shades) {
    const lensMat = b.mat('#121218', 0.08, { metalness: 0.4 });
    for (const sx of [-1, 1]) {
      b.blob(head, lensMat, 0.05, 0.036, 0.012, sx * 0.06, 0.024, 0.17);
      b.blob(head, gold, 0.056, 0.042, 0.008, sx * 0.06, 0.024, 0.164);
      b.blob(head, gold, 0.006, 0.006, 0.07, sx * 0.12, 0.03, 0.11);
    }
    b.blob(head, gold, 0.02, 0.006, 0.006, 0, 0.032, 0.178);
  }

  if (options.headband) {
    const band = b.mat(options.headband, 0.6);
    const hb = new Mesh(b.keep(new TorusGeometry(0.163, 0.018, 6, 28)), band);
    hb.position.set(0, 0.075, 0);
    hb.rotation.x = Math.PI / 2 + 0.12;
    head.add(hb);
    const knot = b.blob(head, band, 0.024, 0.045, 0.016, 0.04, 0.06, -0.165);
    knot.rotation.z = 0.5;
    // Sweatbands on the flippers.
    for (const fl of flippers) {
      const wb = new Mesh(b.keep(new TorusGeometry(0.06 * (1 + 0.5 * bulk), 0.016, 6, 16)), band);
      wb.position.set(0, -0.22, 0);
      wb.rotation.x = Math.PI / 2;
      fl.add(wb);
    }
  }
  if (options.headset) {
    const hs = b.mat('#2d3340', 0.45);
    const arc = new Mesh(b.keep(new TorusGeometry(0.175, 0.012, 6, 24, Math.PI)), hs);
    arc.position.set(0, 0.01, -0.01);
    head.add(arc);
    for (const sx of [-1, 1]) {
      const cup = new Mesh(b.keep(new CylinderGeometry(0.05, 0.05, 0.04, 14)), hs);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * 0.172, 0.0, -0.01);
      head.add(cup);
      b.blob(head, b.mat('#5fb4ff', 0.3, { emissive: new Color('#5fb4ff'), emissiveIntensity: 0.6 }), 0.008, 0.008, 0.008, sx * 0.195, 0.0, -0.01);
    }
    const boom = new Mesh(b.keep(new CylinderGeometry(0.005, 0.005, 0.15, 5)), hs);
    boom.rotation.set(Math.PI / 2 - 0.35, 0, 0.6);
    boom.position.set(0.13, -0.05, 0.1);
    head.add(boom);
    b.blob(head, hs, 0.014, 0.014, 0.014, 0.08, -0.08, 0.165);
  }

  // Bansaree: a little top-knot with a pin, a bindi, a shawl draped over one shoulder, a pointer for the board.
  if (options.bun) {
    b.blob(head, ink, 0.065, 0.06, 0.06, 0, 0.16, -0.07);
    const pin = new Mesh(b.keep(new CylinderGeometry(0.005, 0.005, 0.16, 5)), gold);
    pin.position.set(0, 0.17, -0.07);
    pin.rotation.z = 1.3;
    head.add(pin);
    b.blob(head, b.mat('#d4303a', 0.4), 0.009, 0.009, 0.005, 0, 0.07, 0.163);
  }
  if (options.shawl) {
    const cloth = b.mat(options.shawl, 0.55);
    for (let k = 0; k <= 9; k++) {
      const t = (k / 9 - 0.5) * 2;
      const x = t * 0.16, y = 0.02 - t * 0.17;
      const z = 0.24 * Math.sqrt(Math.max(0.08, 1 - (x / 0.27) ** 2 - (y / 0.31) ** 2)) + 0.012;
      const piece = b.blob(body, cloth, 0.045, 0.045, 0.022, x, y, z);
      piece.rotation.set(0, -x * 1.4, 0.78);
      const edge = b.blob(body, gold, 0.01, 0.045, 0.023, x + 0.03, y + 0.03, z + 0.002);
      edge.rotation.set(0, -x * 1.4, 0.78);
    }
    b.blob(body, cloth, 0.09, 0.07, 0.24, 0.17, 0.12, -0.01);
  }
  let pointer: Mesh | null = null;
  if (options.pointer) {
    pointer = new Mesh(b.keep(new CylinderGeometry(0.008, 0.011, 0.5, 6)), b.mat('#8a5a2b', 0.6));
    pointer.position.set(0, -0.44, 0.02);
    pointer.visible = false;
    flippers[1].add(pointer);
    b.blob(pointer, b.mat('#d4303a', 0.5), 0.018, 0.026, 0.018, 0, -0.25, 0);
  }

  if (options.bow) {
    const bm = b.mat(options.bow, 0.5);
    const bow = new Group();
    bow.position.set(0.085, 0.135, 0.06);
    bow.rotation.z = -0.5;
    head.add(bow);
    for (const sx of [-1, 1]) {
      const wing = b.blob(bow, bm, 0.05, 0.032, 0.02, sx * 0.045, 0, 0);
      wing.rotation.z = sx * 0.3;
    }
    b.blob(bow, bm, 0.022, 0.022, 0.022);
  }
  if (options.flower) {
    const petal = b.mat(options.flower, 0.55);
    const fl = new Group();
    fl.position.set(-0.115, 0.1, 0.09);
    fl.rotation.y = -0.6;
    head.add(fl);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      b.blob(fl, petal, 0.024, 0.024, 0.011, Math.cos(a) * 0.032, Math.sin(a) * 0.032, 0);
    }
    b.blob(fl, b.mat('#ffd84a', 0.5), 0.016, 0.016, 0.016, 0, 0, 0.006);
  }
  // Dishi's crest: a spray of yellow plumes over each eye, swept back (a rockhopper's eyebrows).
  const plumes: Mesh[] = [];
  if (options.crest) {
    const cm = b.mat(options.crest, 0.5);
    for (const sx of [-1, 1]) {
      for (const [dy, dz, rz, len] of [[0.07, 0.11, 0.25, 0.09], [0.085, 0.07, 0.45, 0.11], [0.08, 0.02, 0.7, 0.1]] as const) {
        const pl = b.blob(head, cm, 0.012, 0.014, len, sx * 0.085, dy, dz - 0.04);
        pl.rotation.set(-0.5, sx * 0.4, sx * rz);
        plumes.push(pl);
      }
    }
  }
  if (options.lashes) {
    for (const sx of [-1, 1]) {
      for (const [dx, dy, rz] of [[0.078, 0.052, -0.9], [0.07, 0.058, -0.5], [0.06, 0.062, -0.15]] as const) {
        const lash = b.blob(head, ink, 0.004, 0.016, 0.004, sx * dx, dy, 0.16);
        lash.rotation.z = sx * rz;
      }
    }
  }
  if (options.tuft) {
    for (const [x, rz, h] of [[-0.03, 0.4, 0.07], [0.0, 0, 0.09], [0.035, -0.45, 0.065]] as const) {
      const tf = b.blob(head, ink, 0.014, h, 0.014, x, 0.17, -0.01);
      tf.rotation.z = rz;
    }
  }

  // A student's things: a backpack (in the root, so it can come off and be put down beside the penguin), a book (shut
  // under the flipper, open in the lap at a lesson), a pencil.
  let bagKit: Group | null = null;
  const straps: Mesh[] = [];
  if (options.bag) {
    const bagMat = b.mat(options.bag, 0.75);
    const flapMat = b.mat(new Color(options.bag).multiplyScalar(0.78).getStyle(), 0.75);
    bagKit = new Group();
    root.add(bagKit);
    b.blob(bagKit, bagMat, 0.16, 0.17, 0.08, 0, 0, 0);
    b.blob(bagKit, flapMat, 0.15, 0.07, 0.06, 0, 0.1, -0.03);
    b.blob(bagKit, b.mat('#f2d16b', 0.4), 0.02, 0.02, 0.016, 0, 0.055, -0.085);
    b.blob(bagKit, flapMat, 0.1, 0.065, 0.04, 0, -0.07, -0.065);
    for (const sx of [-1, 1]) {
      const strap = b.blob(body, flapMat, 0.022, 0.09, 0.018, sx * 0.13, 0.13, 0.185);
      strap.rotation.set(-0.5, 0, sx * 0.2);
      straps.push(strap, b.blob(body, flapMat, 0.02, 0.02, 0.07, sx * 0.15, 0.19, 0.06));
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
    bookShut.position.set(0.03, -0.22, 0.05);
    bookShut.rotation.set(0.2, 0.2, 0.1);
    flippers[0].add(bookShut);
    box(bookShut, cover, 0.04, 0.17, 0.13, 0, 0, 0);
    box(bookShut, paper, 0.032, 0.155, 0.12, 0.003, 0, 0.01);
    bookOpen = new Group();
    bookOpen.visible = false;
    body.add(bookOpen);
    for (const sx of [-1, 1]) {
      const half = new Group();
      half.rotation.z = sx * 0.22;
      bookOpen.add(half);
      box(half, cover, 0.12, 0.01, 0.16, sx * 0.06, 0, 0);
      box(half, paper, 0.11, 0.01, 0.15, sx * 0.056, 0.009, 0);
      for (let l = 0; l < 4; l++) box(half, b.mat('#9aa3b5', 0.9), 0.08, 0.003, 0.005, sx * 0.06, 0.016, -0.05 + l * 0.032);
    }
    pencil = new Mesh(b.keep(new CylinderGeometry(0.007, 0.007, 0.11, 6)), b.mat('#f2b632', 0.5));
    pencil.position.set(0, -0.26, 0.06);
    pencil.rotation.x = 1.0;
    pencil.visible = false;
    flippers[1].add(pencil);
  }

  // Manan's guitar: across the lap while he plays, slung on his back the rest of the time.
  let guitar: Group | null = null;
  if (options.guitar) {
    guitar = new Group();
    body.add(guitar);
    const wood = b.mat('#c0783a', 0.45);
    const dark = b.mat('#3a2412', 0.5);
    b.blob(guitar, wood, 0.12, 0.15, 0.04, 0, 0, 0);
    b.blob(guitar, wood, 0.09, 0.1, 0.04, 0, 0.15, 0);
    b.blob(guitar, dark, 0.04, 0.04, 0.01, 0, 0.055, 0.036);
    const neck = new Mesh(b.keep(new CylinderGeometry(0.016, 0.018, 0.48, 8)), dark);
    neck.position.set(0, 0.43, 0.016);
    guitar.add(neck);
    b.blob(guitar, dark, 0.028, 0.055, 0.02, 0, 0.7, 0.016);
    for (const y of [0.28, 0.36, 0.44, 0.52]) b.blob(guitar, gold, 0.021, 0.003, 0.021, 0, y, 0.028);
    // The strap, over the shoulder.
    const strap = new Mesh(b.keep(new TorusGeometry(0.25, 0.012, 6, 28)), b.mat('#7a3b2a', 0.7));
    strap.rotation.set(0, Math.PI / 2, 0.75);
    strap.position.set(0, 0.18, 0);
    guitar.add(strap);
  }
  let barbell: Group | null = null;
  if (options.barbell) {
    barbell = new Group();
    barbell.visible = false;
    body.add(barbell);
    const bar = new Mesh(b.keep(new CylinderGeometry(0.013, 0.013, 0.95, 8)), b.mat('#c9d4dd', 0.3, { metalness: 0.6 }));
    bar.rotation.z = Math.PI / 2;
    barbell.add(bar);
    const plate = b.mat('#3d4656', 0.6);
    for (const sx of [-1, 1]) {
      for (const [dx, r] of [[0.37, 0.14], [0.42, 0.1]] as const) {
        const pl = new Mesh(b.keep(new CylinderGeometry(r, r, 0.04, 18)), plate);
        pl.rotation.z = Math.PI / 2;
        pl.position.x = sx * dx;
        barbell.add(pl);
      }
    }
  }

  root.scale.setScalar(options.scale ?? 1);
  const j = blank();
  const idleJ = blank();
  const ex: PandaExtras = { seat: 0, snack: 0, chew: 0, scratch: 0, stretch: 0, yawn: 0, drink: 0, lie: 0, back: 0, shut: 0, book: 0, write: 0, kick: 0, guitar: 0, sing: 0, bar: 0, pointer: 0 };
  const keys = Object.keys(ex) as (keyof PandaExtras)[];
  // Each sleeps in its own way: on its side, flat on its belly, or standing with its head tucked under a flipper.
  const sleepPoseOf = (seed: number) => Math.floor(((Math.sin(seed * 91.7) * 43758.5453) % 1 + 1) % 1 * 3);

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
      for (const k of keys) ex[k] = 0;
      const act: IdleAct = input.idle && input.idle.weight > 0 ? input.idle.act : 'none';
      if (input.idle && act !== 'none') {
        Object.assign(idleJ, NEUTRAL);
        const px = { ...ex };
        if (act === 'preen' || act === 'eat') idleActJoints(act, input.idle.t, idleJ);
        else pandaIdle(act, input.idle.t, idleJ, px, input.seed);
        addWeighted(j, idleJ, input.idle.weight);
        for (const k of keys) ex[k] = px[k] * input.idle.weight;
      }

      const gw = input.gaitWeight;
      const gait = input.gait;
      let roll = 0;
      let curl = 0;
      let rock = 0;
      let twist = 0;
      let sway = 0;
      let bob = 0;
      let lift = 0;
      let flat = 0;
      let stepPhase = 0;
      let stepAmp = 0;
      let seat = Math.max(ex.seat, input.seat ?? 0);
      let flail = 0;
      let climbLean = 0;
      let reverse = 1;
      let paddle = 0;

      if (gait === 'roll') {
        roll = input.gaitPhase;
        curl = gw;
      } else if (gait === 'walk' || gait === 'push' || gait === 'pull') {
        // The waddle (as the crew's): weight onto one foot, the body rocks over it, the other foot swings forward.
        const raw = input.gaitPhase * P.tempo;
        const ph = raw + 0.1 * Math.sin(raw * 0.37 + input.seed * 5) + 0.06 * Math.sin(raw * 0.91 + input.seed * 2);
        stepAmp = P.waddle * (gait === 'walk' ? 1 : 0.5) * (1 + 0.14 * Math.sin(ph * 0.23 + input.seed)) * gw;
        stepPhase = ph;
        const s = Math.sin(ph);
        rock = -s * 0.17 * stepAmp * (1 + 0.25 * pear);
        sway = s * 0.045 * stepAmp;
        twist = s * 0.12 * stepAmp;
        bob = Math.abs(s) * 0.034 * stepAmp * P.bounce;
        j.raiseR += (0.3 + 0.22 * s) * gw;
        j.raiseL += (0.3 - 0.22 * s) * gw;
        j.headTilt += s * 0.1 * stepAmp;
        j.headPitch -= Math.abs(s) * 0.05 * stepAmp;
        j.headYaw += Math.sin(ph - 0.6) * 0.05 * stepAmp;
        if (gait === 'pull') reverse = -1;
      } else if (gait === 'glide') {
        // Belly down on the ice, flippers out, head up: the slide.
        flat = gw;
        j.raiseL = j.raiseL * (1 - gw) + (1.15 + 0.15 * Math.sin(input.time * 9)) * gw;
        j.raiseR = j.raiseR * (1 - gw) + (1.15 + 0.15 * Math.sin(input.time * 9 + 1.5)) * gw;
        j.reachL *= 1 - gw;
        j.reachR *= 1 - gw;
        j.headPitch = j.headPitch * (1 - gw) - 1.0 * gw;
        lift = 0.19 * gw;
      } else if (gait === 'swim') {
        // Swimming: flat in the water, the flippers beating in turn, the head up and looking ahead.
        flat = gw;
        paddle = gw;
        const ph = input.gaitPhase;
        j.raiseL = j.raiseL * (1 - gw) + (1.1 + 0.55 * Math.sin(ph)) * gw;
        j.raiseR = j.raiseR * (1 - gw) + (1.1 + 0.55 * Math.sin(ph + Math.PI)) * gw;
        j.reachL = j.reachL * (1 - gw) + 0.45 * Math.cos(ph) * gw;
        j.reachR = j.reachR * (1 - gw) + 0.45 * Math.cos(ph + Math.PI) * gw;
        j.headPitch = j.headPitch * (1 - gw) - 1.05 * gw;
        j.headYaw += 0.12 * Math.sin(input.time * 0.9 + input.seed) * gw;
        rock += 0.06 * Math.sin(ph) * gw;
        lift = 0.2 * gw;
      } else if (gait === 'climb') {
        const climb = input.climb;
        const cw = climb ? climb.weight : gw;
        const c = Math.sin(climb ? climb.phase : input.gaitPhase);
        climbLean = (0.28 + (climb ? climb.slope : 0) * 0.55) * cw;
        j.reachL = j.reachL * (1 - cw) + (1.15 + 0.55 * c) * cw;
        j.reachR = j.reachR * (1 - cw) + (1.15 - 0.55 * c) * cw;
        j.raiseL = j.raiseL * (1 - cw) + 0.32 * cw;
        j.raiseR = j.raiseR * (1 - cw) + 0.32 * cw;
        j.headPitch = j.headPitch * (1 - cw) - 0.38 * cw;
        rock += c * 0.07 * cw;
        bob += Math.abs(c) * 0.02 * cw;
        stepPhase = climb ? climb.phase : input.gaitPhase;
        stepAmp = cw;
      } else if (gait === 'tumble') {
        const ph = input.gaitPhase;
        if (ph < 1) {
          // Feet out from under it on the ice: flippers everywhere, over backwards, down on its bottom.
          flail = Math.sin(Math.min(1, ph / 0.2) * Math.PI * 0.5);
          roll = -0.9 * (ph * ph) * (1 + 0.4 * Math.sin(ph * 5));
          j.raiseL = 1.9 + 0.7 * Math.sin(ph * 46);
          j.raiseR = 1.9 + 0.7 * Math.sin(ph * 46 + 2.4);
          j.reachL = 0.6 + 0.8 * Math.sin(ph * 31);
          j.reachR = 0.6 + 0.8 * Math.sin(ph * 31 + 1.9);
          j.headPitch = -0.3 + 0.2 * Math.sin(ph * 25);
          seat = smoothstep01(0.7, 1, ph);
        } else {
          // Dazed: sat on the ice, a shake of the head, a flipper to the head, and up again.
          const u = ph - 1;
          seat = 1 - smoothstep01(0.65, 1, u);
          j.headYaw += 0.55 * Math.sin(u * 17) * (1 - u);
          j.headPitch += 0.2 * (1 - u);
          j.reachR += 1.9 * smoothstep01(0.2, 0.5, u) * (1 - smoothstep01(0.7, 1, u));
          j.raiseL += 0.5;
        }
      } else if (gait === 'leap') {
        j.raiseL = j.raiseL * (1 - gw) + 1.65 * gw;
        j.raiseR = j.raiseR * (1 - gw) + 1.65 * gw;
        j.lean -= 0.12 * gw;
        j.headPitch -= 0.2 * gw;
      }

      // Click: a hop with a full spin.
      let spin = 0;
      if (input.react >= 0 && input.react < 1.0) {
        const r = input.react;
        j.hop += 0.34 * Math.sin(Math.PI * r);
        spin = Math.PI * 2 * (r * r * (3 - 2 * r));
        j.raiseL = j.raiseL * 0.3 + (1.6 + 0.4 * Math.sin(input.react * 30)) * 0.7;
        j.raiseR = j.raiseR * 0.3 + (1.6 + 0.4 * Math.sin(input.react * 30 + 1)) * 0.7;
      }

      // Lying down to sleep: on its side, on its belly, or standing with the head tucked under a flipper.
      const lie = ex.lie;
      if (lie > 0) {
        const pose = sleepPoseOf(input.seed);
        if (pose === 0) {
          rock += (Math.sin(input.seed * 12.9898) > 0 ? 1 : -1) * 1.35 * lie;
          j.lean += 0.2 * lie;
        } else if (pose === 1) {
          flat = Math.max(flat, lie);
          lift = Math.max(lift, 0.17 * lie);
          j.headPitch -= 0.55 * lie;
          j.raiseL -= 0.1 * lie;
          j.raiseR -= 0.1 * lie;
        } else {
          // Standing asleep: the head turned right round and tucked down into the feathers of the back.
          j.headYaw += 2.2 * lie;
          j.headPitch += 0.35 * lie;
          j.headTilt += 0.3 * lie;
          j.reachL -= 0.8 * lie;
          j.reachR -= 0.6 * lie;
          j.squash += 0.05 * lie;
        }
      }
      // On its back, feet in the air.
      roll -= 1.25 * ex.back;

      // Curled into a ball: head tucked, flippers in.
      const k = curl;
      j.headPitch = j.headPitch * (1 - k) + 0.7 * k;
      j.raiseL = j.raiseL * (1 - k) + 0.05 * k;
      j.raiseR = j.raiseR * (1 - k) + 0.05 * k;
      j.reachL = j.reachL * (1 - k) + 1.0 * k;
      j.reachR = j.reachR * (1 - k) + 1.0 * k;
      j.lean *= 1 - k;

      seat = Math.min(1, seat) * (1 - flat);
      center.position.set(sway, MID + j.hop + bob + lift + (ROLL_RADIUS - MID + 0.03) * k - 0.07 * seat - 0.03 * ex.back, 0);
      center.rotation.set(roll, spin, rock);
      lean.rotation.x = (j.lean + climbLean) * (1 - flat) + 1.42 * flat - 0.32 * seat - 0.1 * flail;
      body.rotation.y = twist;
      body.scale.set((1 + j.squash * 0.6) * plump, 1 - j.squash, (1 + j.squash * 0.6) * plump);
      head.position.set(0, 0.255 - 0.06 * k, 0.01 + 0.05 * k);
      head.rotation.set(j.headPitch, j.headYaw - twist * 0.6, j.headTilt - rock * 0.5 * (1 - lie), 'YXZ');
      flippers[0].rotation.set(-j.reachL, 0, j.raiseL);
      flippers[1].rotation.set(-j.reachR, 0, -j.raiseR);

      // Feet: alternate while walking; out in front when sitting; trailing behind on a slide; kicking in the water.
      for (let i = 0; i < 2; i++) {
        const q = stepPhase + (i === 0 ? 0 : Math.PI);
        const up = Math.max(0, Math.sin(q)) * stepAmp;
        const fwd = -Math.cos(q) * stepAmp * reverse;
        const kick = paddle * Math.sin(input.time * 7 + i * Math.PI) * 0.4;
        const lounge = ex.back * (0.9 + 0.35 * Math.sin(input.time * 2.6 + input.seed + i * 1.4));
        feet[i].position.set((i === 0 ? -1 : 1) * footSpread, 0.022 - MID + up * 0.055 + seat * 0.05 + 0.04 * flail * Math.sin(input.gaitPhase * 30 + i * 2), 0.07 + fwd * 0.075 + seat * 0.13 - flat * 0.1);
        feet[i].rotation.x = -up * 0.4 - seat * 1.1 - 0.8 * flat + kick - lounge;
      }
      tail.rotation.x = 0.3 * seat;

      // The beak: opens to yawn and to sing.
      const sing = ex.sing * (0.35 + 0.65 * Math.max(0, Math.sin(input.time * 8.1 + input.seed))) * (0.6 + 0.4 * Math.sin(input.time * 2.7 + input.seed * 2));
      jaw.rotation.x = 0.55 * ex.yawn + 0.35 * sing + 0.12 * ex.chew * (0.5 + 0.5 * Math.sin(input.time * 15));

      // Blinks (each at its own rhythm); eyes shut to sleep, doze, yawn.
      const blink = (input.time + input.seed * 2.3) % P.blink < 0.12 || ex.yawn > 0.5 ? 0.15 : 1;
      for (const e of eyes) e.scale.y = 0.034 * Math.min(blink, 1 - 0.88 * ex.shut);

      // A fish in the beak.
      const f = input.fish ?? 0;
      fish.visible = f > 0.02;
      if (fish.visible) fish.scale.setScalar(Math.min(1, f));

      // The hat comes off for a wave or a bow (and there is the bald crown).
      if (hat) {
        const tip = act === 'wave' || act === 'bow' ? (input.idle?.weight ?? 0) * smoothstep01(0.1, 0.5, input.idle!.t) * (1 - smoothstep01(1.3, 1.8, input.idle!.t)) : 0;
        hat.position.set(0.03 * tip, 0.135 + 0.13 * tip, -0.02 + 0.03 * tip);
        hat.rotation.set(-0.28 - 0.35 * tip, 0.1, 0.06 + 0.5 * tip);
      }
      // The crest's plumes bounce as it goes.
      for (let i = 0; i < plumes.length; i++) plumes[i].rotation.x = -0.5 + 0.12 * Math.sin(stepPhase * 2 + i) * stepAmp + 0.04 * Math.sin(input.time * 3 + i);

      if (bookOpen && bookShut) {
        bookOpen.visible = ex.book > 0.05;
        bookShut.visible = !bookOpen.visible && lie < 0.3 && ex.back < 0.3 && k < 0.3 && flat < 0.3 && seat < 0.4 && j.reachL < 1.1 && j.raiseL < 0.9;
        if (bookOpen.visible) {
          const o = ex.book;
          bookOpen.position.set(0, -0.05 + 0.08 * o, 0.24 + 0.05 * o);
          bookOpen.rotation.set(-0.55 - 0.3 * (1 - o), 0, 0.03 * Math.sin(input.time * 0.7 + input.seed));
          bookOpen.scale.setScalar(o);
        }
      }
      if (pencil) pencil.visible = ex.write > 0.15;

      if (guitar) {
        const play = ex.guitar;
        if (play > 0.05) {
          const strum = Math.sin(input.time * 8.8 + input.seed);
          guitar.position.set(0.02, -0.06 + 0.01 * strum * play, 0.26);
          guitar.rotation.set(0.12 + 0.03 * strum, 0, -1.05 + 0.02 * strum);
          guitar.scale.setScalar(0.5 + 0.5 * play);
        } else {
          // Slung across the back, neck up over the shoulder.
          guitar.position.set(0.02, -0.02, -0.25 - 0.05 * pear);
          guitar.rotation.set(-0.1, Math.PI, 0.55);
          guitar.scale.setScalar(1);
        }
        guitar.visible = lie < 0.4 && ex.back < 0.4 && k < 0.4 && flat < 0.5;
      }
      if (barbell) {
        barbell.visible = ex.bar > 0.05;
        if (barbell.visible) {
          const th = (j.reachL + j.reachR) / 2;
          barbell.position.set(0, 0.1 - 0.3 * Math.cos(th), 0.06 + 0.3 * Math.sin(th));
          barbell.scale.setScalar(ex.bar);
        }
      }
      if (pointer) pointer.visible = ex.pointer > 0.05;

      // The bag: on the back, or (coming off, put down, going back on) carried between there and where it was put down.
      if (bagKit) {
        const w = Math.max(0, Math.min(1, input.bag ?? 1));
        for (const st of straps) st.visible = w > 0.985;
        body.updateWorldMatrix(true, false);
        _inv.copy(root.matrixWorld).invert();
        _wm.multiplyMatrices(_inv, body.matrixWorld).multiply(_loc.makeTranslation(0, 0.02, -0.25 - 0.08 * pear));
        _wm.decompose(_wp, _wq, _ws);
        if (w >= 0.999) {
          bagKit.position.copy(_wp);
          bagKit.quaternion.copy(_wq);
          bagKit.scale.copy(_ws);
        } else {
          const e = w * w * (3 - 2 * w);
          if (input.bagAt) _dp.set(input.bagAt[0], input.bagAt[1], input.bagAt[2]).applyMatrix4(_inv);
          else _dp.set(0.6, 0.16, 0.12);
          _dq.copy(_DOWN);
          bagKit.position.lerpVectors(_dp, _wp, e);
          bagKit.position.y += 0.28 * Math.sin(Math.PI * e) * (1 - 0.3 * e);
          bagKit.quaternion.slerpQuaternions(_dq, _wq, e);
          bagKit.scale.lerpVectors(_ONE, _ws, e);
        }
      }
    },
    dispose() {
      b.dispose();
    },
  };
}

export function buildColonyPenguin(options: ColonyPenguinOptions): Rig {
  return mergeRigParts(buildColonyPenguinRaw(options));
}

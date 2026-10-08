import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { Accessory, Bunny, BunnyLook, GearAt, Held, Pose } from '../warren';

/**
 * A rabbit: a round body and a round head, long ears (or lop ears), a puff
 * of a tail, big hind feet and small front paws, and whatever the character
 * wears. Everything is a few shared shapes; the pose is a handful of smoothed
 * numbers (lean, paws, ears, head) so it never snaps between moods.
 *
 * The characters differ in build (Yash's gym shoulders, Manas's comfortable
 * middle, Deep's big cartoon head on a small body, Aastha's tiny size), in
 * what they wear (a tank top and sweatbands, a hoodie, a green fedora on a
 * bare head, a gold chain and shades, a cardigan and a bun, oversized
 * glasses) and in what they carry: a guitar slung on the back, a school bag
 * (put down beside the bed at night), a pointer, dumbbells, a notebook.
 */

const SPHERE = new SphereGeometry(1, 22, 16);
const SMALL = new SphereGeometry(1, 12, 9);
const TORUS = new TorusGeometry(1, 0.32, 10, 28);
const THIN = new TorusGeometry(1, 0.07, 6, 36);
const CYL = new CylinderGeometry(1, 1, 1, 18);
const CONE = new ConeGeometry(1, 1, 10);
const BOX = new BoxGeometry(1, 1, 1);
const FRUSTUM = new CylinderGeometry(0.82, 1, 1, 18);
const SKIRT = new CylinderGeometry(0.62, 1, 1, 22, 1, true);
/** Clothes over the torso: a band of the sphere (a tank top), a longer one (a hoodie), one open at the front (a jacket, a cardigan). */
const TOP = new SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0.5, 1.6);
const LONG = new SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0.32, 2.1);
const OPEN = new SphereGeometry(1, 22, 14, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0.38, 1.95);
/** Half a sphere (caps, beanies). */
const DOME = new SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);

const shared = {
  eye: new MeshStandardMaterial({ color: '#221c2c', roughness: 0.25, metalness: 0 }),
  shine: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 }),
  nose: new MeshStandardMaterial({ color: '#ff8fae', roughness: 0.5 }),
  carrot: new MeshStandardMaterial({ color: '#ff8a2b', roughness: 0.6 }),
  leaf: new MeshStandardMaterial({ color: '#58c25e', roughness: 0.7 }),
  book: new MeshStandardMaterial({ color: '#6f8cff', roughness: 0.6 }),
  page: new MeshStandardMaterial({ color: '#fffaf0', roughness: 0.9 }),
  brass: new MeshStandardMaterial({ color: '#d9a948', roughness: 0.35, metalness: 0.6 }),
  glow: new MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 2.2 }),
  balloon: new MeshStandardMaterial({ color: '#ff7aa8', roughness: 0.3 }),
  string: new MeshStandardMaterial({ color: '#f6f1ff', roughness: 0.9 }),
  iron: new MeshStandardMaterial({ color: '#4a4a58', roughness: 0.35, metalness: 0.7 }),
  water: new MeshStandardMaterial({ color: '#8fd3ff', roughness: 0.1, transparent: true, opacity: 0.75 }),
  wood: new MeshStandardMaterial({ color: '#a8774f', roughness: 0.6 }),
  pencil: new MeshStandardMaterial({ color: '#ffd166', roughness: 0.5 }),
  lens: new MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.05, transparent: true, opacity: 0.28 }),
  dark: new MeshStandardMaterial({ color: '#2a2230', roughness: 0.4 }),
  blush: new MeshStandardMaterial({ color: '#ffb0c4', roughness: 0.9, transparent: true, opacity: 0.8 }),
};

type Geo = BufferGeometry;

function mesh(geo: Geo, mat: Material, p: [number, number, number], s: [number, number, number] | number, parent: Object3D): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(s[0], s[1], s[2]);
  parent.add(m);
  return m;
}

interface Params {
  bodyY: number;
  pitch: number;
  twist: number;
  lean: number;
  squash: number;
  armL: number;
  armR: number;
  spread: number;
  spreadL: number;
  earBack: number;
  earSpread: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  feet: number;
  eyes: number;
}

const ZERO: Params = { bodyY: 0, pitch: 0, twist: 0, lean: 0, squash: 1, armL: 0, armR: 0, spread: 0, spreadL: 0, earBack: 0, earSpread: 0, headPitch: 0, headYaw: 0, headRoll: 0, feet: 0, eyes: 1 };

type HeldKey = Exclude<Held, null>;

export interface BunnyRig {
  root: Group;
  body: Group;
  torso: Mesh;
  torsoBase: [number, number, number];
  head: Group;
  earL: Group;
  earR: Group;
  /** Extra outward tilt of the ears (short ears poking out from under a hat). */
  earOut: number;
  armL: Group;
  armR: Group;
  footL: Mesh;
  footR: Mesh;
  eyeL: Mesh;
  eyeR: Mesh;
  nose: Mesh;
  held: Record<HeldKey, Object3D[]>;
  gear: { obj: Group; kind: 'bag' | 'guitar'; at: GearAt | null; extra: Object3D | null } | null;
  lanternLight: Mesh;
  look: BunnyLook;
  p: Params;
  materials: Material[];
}

export function buildBunny(look: BunnyLook): BunnyRig {
  const materials: Material[] = [];
  const cache = new Map<string, MeshStandardMaterial>();
  const mat = (color: string, rough = 0.85, extra: Partial<{ metalness: number; side: typeof DoubleSide }> = {}) => {
    const key = `${color}|${rough}|${extra.metalness ?? 0}|${extra.side ?? 0}`;
    let m = cache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: rough, ...extra });
      cache.set(key, m);
      materials.push(m);
    }
    return m;
  };
  const col = (a: Accessory) => look.colors?.[a] ?? look.accColor;
  const fur = mat(look.fur, 0.92);
  const belly = mat(look.belly, 0.95);
  const inner = mat(look.inner, 0.8);
  const patch = look.patch ? mat(look.patch, 0.92) : null;
  const skin = look.skin ? mat(look.skin, 0.42) : null;
  const build = look.build ?? 'normal';
  const has = (a: Accessory) => look.acc.includes(a);

  const root = new Group();
  root.scale.setScalar(look.scale);
  const body = new Group();
  root.add(body);
  const torsoBase: [number, number, number] =
    build === 'muscle' ? [0.36, 0.31, 0.33] : build === 'chubby' ? [0.37, 0.31, 0.39] : build === 'cartoon' ? [0.24, 0.27, 0.27] : [0.3, 0.29, 0.34];
  const torso = mesh(SPHERE, fur, [0, 0.33, -0.02], torsoBase, body);
  if (build === 'chubby') mesh(SPHERE, belly, [0, 0.28, 0.17], [0.27, 0.24, 0.22], body);
  else mesh(SPHERE, belly, [0, 0.3, 0.14], [0.21 * (torsoBase[0] / 0.3), 0.22, 0.18], body);
  if (build === 'muscle') {
    // A broad chest and a strong neck.
    for (const sx of [-1, 1]) mesh(SPHERE, belly, [sx * 0.1, 0.43, 0.17], [0.12, 0.085, 0.08], body);
    mesh(CYL, fur, [0, 0.52, 0.04], [0.12, 0.12, 0.11], body);
  }
  mesh(SPHERE, belly, [0, 0.36, -0.36], 0.1, body);
  if (patch) {
    mesh(SPHERE, patch, [0.14, 0.38, -0.1], [0.2, 0.18, 0.2], body);
    mesh(SPHERE, patch, [-0.12, 0.3, -0.18], [0.16, 0.15, 0.16], body);
  }
  const feet = build === 'cartoon' ? 1.3 : build === 'muscle' ? 1.12 : 1;
  const footL = mesh(SPHERE, fur, [-0.15, 0.06, 0.02], [0.08 * feet, 0.055, 0.17 * feet], body);
  const footR = mesh(SPHERE, fur, [0.15, 0.06, 0.02], [0.08 * feet, 0.055, 0.17 * feet], body);
  const arm = (side: number) => {
    const g = new Group();
    const wide = build === 'muscle' ? 0.16 : build === 'chubby' ? 0.17 : build === 'cartoon' ? 0.1 : 0.11;
    g.position.set(side * wide, 0.32 + (build === 'muscle' ? 0.06 : 0), 0.2 - (build === 'muscle' ? 0.04 : 0));
    const thick = build === 'muscle' ? 1.6 : build === 'chubby' ? 1.2 : build === 'cartoon' ? 0.85 : 1;
    mesh(SPHERE, fur, [0, -0.1, 0.02], [0.055 * thick, 0.1 * (build === 'muscle' ? 1.12 : 1), 0.055 * thick], g);
    mesh(SPHERE, belly, [0, -0.2, 0.03], 0.055 * (build === 'muscle' ? 1.25 : 1), g);
    // Shoulders like boulders.
    if (build === 'muscle') mesh(SPHERE, fur, [0, -0.01, 0], [0.085, 0.075, 0.085], g);
    if (has('wristbands')) mesh(CYL, mat(col('wristbands'), 0.8), [0, -0.165, 0.025], [0.072, 0.04, 0.072], g);
    body.add(g);
    return g;
  };
  const armL = arm(-1), armR = arm(1);

  const head = new Group();
  const hs = build === 'cartoon' ? 1.38 : build === 'muscle' ? 0.95 : build === 'chubby' ? 1.03 : 1;
  head.position.set(0, 0.64 + (hs - 1) * 0.16 + (build === 'muscle' ? 0.04 : 0), 0.14);
  head.scale.setScalar(hs);
  body.add(head);
  mesh(SPHERE, skin ?? fur, [0, 0, 0], [0.23 * (build === 'chubby' ? 1.06 : 1), 0.215, 0.22], head);
  mesh(SPHERE, belly, [-0.1, -0.06, 0.12], 0.085 * (build === 'chubby' ? 1.15 : 1), head);
  mesh(SPHERE, belly, [0.1, -0.06, 0.12], 0.085 * (build === 'chubby' ? 1.15 : 1), head);
  mesh(SPHERE, belly, [0, -0.07, 0.16], [0.07, 0.055, 0.06], head);
  const nose = mesh(SMALL, shared.nose, [0, -0.02, 0.215], [0.032, 0.024, 0.02], head);
  const eyeL = mesh(SMALL, shared.eye, [-0.095, 0.035, 0.175], [0.042, 0.05, 0.03], head);
  const eyeR = mesh(SMALL, shared.eye, [0.095, 0.035, 0.175], [0.042, 0.05, 0.03], head);
  mesh(SMALL, shared.shine, [-0.08, 0.055, 0.2], 0.012, head);
  mesh(SMALL, shared.shine, [0.11, 0.055, 0.2], 0.012, head);
  if (patch && !skin) mesh(SPHERE, patch, [0.09, 0.07, 0.08], [0.11, 0.1, 0.12], head);

  // Ears: ordinary, lop, or short ones poking out sideways from under a hat brim.
  const hatted = has('fedora');
  const earOut = hatted ? 1.15 : 0;
  const ear = (side: number) => {
    const g = new Group();
    g.position.set(side * (hatted ? 0.17 : 0.085), hatted ? 0.07 : 0.15, -0.03);
    const len = (look.lop ? 0.22 : 0.27) * (look.ears ?? 1);
    mesh(SPHERE, skin ?? (side > 0 && patch ? patch : fur), [0, len, 0], [0.07, len, 0.035], g);
    mesh(SPHERE, inner, [0, len * 0.98, 0.022], [0.042, len * 0.78, 0.016], g);
    head.add(g);
    return g;
  };
  const earL = ear(-1), earR = ear(1);

  // What the character wears.
  for (const a of look.acc) {
    const am = mat(col(a), 0.6);
    switch (a) {
      case 'scarf': {
        const s = mesh(TORUS, am, [0, 0.5, 0.06], [0.2, 0.2, 0.2], body);
        s.rotation.x = Math.PI / 2 - 0.2;
        mesh(SPHERE, am, [0.12, 0.42, 0.2], [0.05, 0.1, 0.03], body).rotation.z = 0.3;
        break;
      }
      case 'bow': {
        mesh(SPHERE, am, [-0.06, 0.2, 0.02], [0.06, 0.04, 0.025], head).rotation.z = 0.3;
        mesh(SPHERE, am, [0.06, 0.2, 0.02], [0.06, 0.04, 0.025], head).rotation.z = -0.3;
        mesh(SMALL, am, [0, 0.2, 0.03], 0.025, head);
        break;
      }
      case 'hat': {
        mesh(CYL, am, [0, 0.17, 0], [0.3, 0.02, 0.3], head);
        mesh(CYL, am, [0, 0.23, 0], [0.15, 0.11, 0.15], head);
        mesh(CYL, shared.leaf, [0, 0.2, 0], [0.152, 0.025, 0.152], head);
        break;
      }
      case 'crown': {
        mesh(CYL, am, [0, 0.2, 0.02], [0.11, 0.06, 0.11], head);
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          mesh(CONE, am, [Math.cos(ang) * 0.1, 0.27, 0.02 + Math.sin(ang) * 0.1], [0.03, 0.08, 0.03], head);
        }
        break;
      }
      case 'glasses': {
        const gl = mesh(TORUS, am, [-0.095, 0.035, 0.205], [0.06, 0.06, 0.04], head);
        const gr = mesh(TORUS, am, [0.095, 0.035, 0.205], [0.06, 0.06, 0.04], head);
        gl.scale.z = gr.scale.z = 0.05;
        mesh(BOX, am, [0, 0.04, 0.21], [0.07, 0.012, 0.012], head);
        break;
      }
      case 'specs': {
        // Squarish frames (the tech rabbit's).
        for (const sx of [-1, 1]) {
          mesh(BOX, am, [sx * 0.095, 0.075, 0.212], [0.12, 0.016, 0.014], head);
          mesh(BOX, am, [sx * 0.095, -0.005, 0.212], [0.12, 0.016, 0.014], head);
          mesh(BOX, am, [sx * 0.155, 0.035, 0.206], [0.016, 0.095, 0.014], head);
          mesh(BOX, am, [sx * 0.035, 0.035, 0.214], [0.016, 0.095, 0.014], head);
          mesh(BOX, shared.lens, [sx * 0.095, 0.035, 0.212], [0.11, 0.075, 0.004], head);
          mesh(BOX, am, [sx * 0.17, 0.05, 0.11], [0.012, 0.012, 0.2], head);
        }
        break;
      }
      case 'bigglasses': {
        // Enormous round glasses: the first thing anyone sees.
        for (const sx of [-1, 1]) {
          const rim = mesh(TORUS, am, [sx * 0.105, 0.045, 0.215], [0.1, 0.1, 0.1], head);
          rim.scale.z = 0.06;
          const lens = mesh(CYL, shared.lens, [sx * 0.105, 0.045, 0.215], [0.095, 0.004, 0.095], head);
          lens.rotation.x = Math.PI / 2;
          mesh(BOX, am, [sx * 0.2, 0.06, 0.1], [0.014, 0.014, 0.22], head);
        }
        mesh(BOX, am, [0, 0.07, 0.225], [0.05, 0.016, 0.016], head);
        // His eyes, magnified behind them.
        eyeL.scale.set(0.058, 0.066, 0.03);
        eyeR.scale.set(0.058, 0.066, 0.03);
        break;
      }
      case 'shades': {
        for (const sx of [-1, 1]) mesh(SPHERE, mat(col('shades'), 0.15), [sx * 0.095, 0.035, 0.205], [0.068, 0.05, 0.02], head);
        mesh(BOX, mat(col('shades'), 0.15), [0, 0.055, 0.216], [0.06, 0.014, 0.012], head);
        for (const sx of [-1, 1]) mesh(BOX, mat(col('shades'), 0.15), [sx * 0.17, 0.05, 0.11], [0.012, 0.012, 0.2], head);
        break;
      }
      case 'flowers': {
        const cols = ['#ffd34d', '#ff8fb1', '#ffffff', '#9fd7ff', '#ffb347'];
        for (let i = 0; i < 7; i++) {
          const ang = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8;
          mesh(SMALL, mat(cols[i % cols.length], 0.6), [Math.cos(ang) * 0.17, 0.15 + Math.sin(-ang) * 0.02, Math.sin(ang) * 0.12 + 0.02], 0.035, head);
        }
        break;
      }
      case 'apron': mesh(SPHERE, am, [0, 0.28, 0.2], [0.2, 0.2, 0.08], body); break;
      case 'headband':
      case 'sweatband': {
        const h = mesh(TORUS, am, [0, 0.07, -0.01], [0.225, 0.225, 0.12], head);
        h.rotation.x = Math.PI / 2 + 0.15;
        break;
      }
      case 'backpack': {
        mesh(SPHERE, am, [0, 0.38, -0.3], [0.17, 0.18, 0.1], body);
        mesh(SPHERE, am, [0, 0.3, -0.38], [0.11, 0.08, 0.05], body);
        break;
      }
      case 'tank': {
        const top = mesh(TOP, mat(col('tank'), 0.7, { side: DoubleSide }), [0, 0, 0], 1.06, torso);
        top.rotation.y = 0;
        for (const sx of [-1, 1]) mesh(BOX, am, [sx * 0.1, 0.56, 0.02], [0.05, 0.03, 0.3], body);
        // A number on the front.
        mesh(BOX, mat('#ffffff', 0.7), [0, 0.38, 0.35], [0.1, 0.1, 0.01], body);
        break;
      }
      case 'hoodie': {
        mesh(LONG, mat(col('hoodie'), 0.9, { side: DoubleSide }), [0, 0, 0], 1.05, torso);
        // The hood, bunched behind the neck; a front pocket; the drawstrings.
        mesh(SPHERE, mat(col('hoodie'), 0.9), [0, 0.56, -0.16], [0.21, 0.11, 0.13], body);
        mesh(BOX, mat(col('hoodie'), 0.9), [0, 0.25, 0.39], [0.22, 0.1, 0.03], body);
        for (const sx of [-0.04, 0.04]) mesh(CYL, mat('#ffffff', 0.7), [sx, 0.47, 0.34], [0.008, 0.1, 0.008], body);
        break;
      }
      case 'jacket':
      case 'cardigan': {
        mesh(OPEN, mat(col(a), 0.75, { side: DoubleSide }), [0, 0, 0], 1.06, torso);
        if (a === 'jacket') {
          // A collar turned up.
          const c = mesh(TORUS, am, [0, 0.54, 0.0], [0.17, 0.17, 0.2], body);
          c.rotation.x = Math.PI / 2 - 0.25;
        } else {
          // Buttons down one side, a brooch.
          for (let i = 0; i < 3; i++) mesh(SMALL, mat('#fffaf0', 0.4), [0.1, 0.42 - i * 0.09, 0.31 - i * 0.01], 0.018, body);
          mesh(SMALL, mat('#ff8fb1', 0.5), [-0.1, 0.47, 0.29], 0.03, body);
        }
        break;
      }
      case 'chain': {
        const ch = mesh(THIN, mat(col('chain'), 0.22, { metalness: 0.9 }), [0, 0.5, 0.07], [0.19, 0.19, 0.19], body);
        ch.rotation.x = Math.PI / 2 - 0.35;
        mesh(SPHERE, mat(col('chain'), 0.22, { metalness: 0.9 }), [0, 0.41, 0.27], [0.04, 0.05, 0.015], body);
        break;
      }
      case 'pearls': {
        for (let i = 0; i < 11; i++) {
          const ang = Math.PI * (0.1 + (i / 10) * 0.8);
          mesh(SMALL, mat(col('pearls'), 0.25), [Math.cos(ang) * 0.17, 0.5 - Math.sin(ang) * 0.05, 0.05 + Math.sin(ang) * 0.17], 0.022, body);
        }
        break;
      }
      case 'bun': {
        // A neat bun between the ears, a pencil through it.
        mesh(SPHERE, mat(col('bun'), 0.92), [0, 0.19, -0.07], [0.085, 0.075, 0.085], head);
        const p = mesh(CYL, shared.pencil, [0.0, 0.2, -0.07], [0.012, 0.22, 0.012], head);
        p.rotation.z = 1.2;
        break;
      }
      case 'bowtie': {
        for (const sx of [-1, 1]) {
          const c = mesh(CONE, am, [sx * 0.05, 0.5, 0.24], [0.04, 0.07, 0.03], body);
          c.rotation.z = sx * Math.PI / 2;
        }
        mesh(SMALL, am, [0, 0.5, 0.25], 0.022, body);
        break;
      }
      case 'dress': {
        mesh(SKIRT, mat(col('dress'), 0.75, { side: DoubleSide }), [0, 0.2, -0.01], [0.35, 0.24, 0.38], body);
        // White polka dots, a little collar.
        for (let i = 0; i < 6; i++) {
          const ang = -0.6 + i * 0.5;
          mesh(SMALL, mat('#ffffff', 0.7), [Math.sin(ang) * 0.31, 0.17 + (i % 2) * 0.07, Math.cos(ang) * 0.33], 0.02, body);
        }
        const c = mesh(TORUS, mat('#ffffff', 0.7), [0, 0.52, 0.06], [0.15, 0.15, 0.15], body);
        c.rotation.x = Math.PI / 2 - 0.2;
        break;
      }
      case 'blush':
        for (const sx of [-1, 1]) mesh(SPHERE, shared.blush, [sx * 0.135, -0.035, 0.155], [0.04, 0.025, 0.012], head).rotation.y = sx * 0.6;
        break;
      case 'cap': {
        mesh(DOME, am, [0, 0.09, 0], [0.215, 0.14, 0.215], head);
        mesh(BOX, am, [0, 0.1, 0.24], [0.2, 0.015, 0.14], head).rotation.x = 0.12;
        mesh(SMALL, mat('#ffffff', 0.6), [0, 0.23, 0], 0.02, head);
        break;
      }
      case 'clip': {
        mesh(BOX, am, [0.14, 0.13, 0.08], [0.08, 0.025, 0.02], head).rotation.z = 0.5;
        mesh(SMALL, mat('#ffd34d', 0.4), [0.16, 0.15, 0.09], 0.022, head);
        break;
      }
      case 'beanie': {
        mesh(DOME, am, [0, 0.06, -0.01], [0.235, 0.17, 0.235], head);
        const fold = mesh(TORUS, mat(col('beanie'), 0.9), [0, 0.075, -0.01], [0.232, 0.232, 0.13], head);
        fold.rotation.x = Math.PI / 2;
        // A little music note badge.
        mesh(SMALL, mat('#2a2230', 0.4), [0.1, 0.12, 0.2], 0.018, head);
        mesh(BOX, mat('#2a2230', 0.4), [0.115, 0.16, 0.2], [0.006, 0.07, 0.006], head);
        break;
      }
      case 'fedora': {
        // A human-style green fedora: a wide brim, a pinched crown, a dark band.
        const hat = new Group();
        hat.position.set(0, 0.15, -0.01);
        hat.rotation.set(-0.08, 0, 0.06);
        head.add(hat);
        mesh(CYL, am, [0, 0, 0], [0.33, 0.016, 0.31], hat);
        mesh(FRUSTUM, am, [0, 0.085, 0], [0.175, 0.16, 0.165], hat);
        mesh(CYL, mat('#1f2a22', 0.5), [0, 0.03, 0], [0.18, 0.04, 0.17], hat);
        mesh(BOX, mat(col('fedora'), 0.6), [0, 0.165, 0], [0.04, 0.03, 0.22], hat);
        mesh(SMALL, mat('#ffcf3a', 0.4), [0.15, 0.04, 0.07], 0.02, hat);
        break;
      }
    }
  }

  // Things it may be holding (only the current one is shown): on the body, or in a paw (moving with the arm).
  const hold = (parent: Object3D = body) => {
    const g = new Group();
    g.visible = false;
    parent.add(g);
    return g;
  };
  const carrot = hold();
  carrot.position.set(0, 0.45, 0.33);
  mesh(CONE, shared.carrot, [0, -0.05, 0], [0.04, 0.16, 0.04], carrot).rotation.x = Math.PI;
  mesh(CONE, shared.leaf, [0, 0.07, 0], [0.035, 0.08, 0.035], carrot);
  const book = hold();
  book.position.set(0, 0.36, 0.34);
  book.rotation.x = -0.6;
  mesh(BOX, shared.book, [0, 0, 0], [0.26, 0.18, 0.03], book);
  mesh(BOX, shared.page, [0, 0, 0.018], [0.24, 0.16, 0.01], book);
  const lantern = hold();
  lantern.position.set(0.2, 0.32, 0.3);
  mesh(CYL, shared.brass, [0, 0.11, 0], [0.05, 0.02, 0.05], lantern);
  const lanternLight = mesh(SMALL, shared.glow, [0, 0.04, 0], 0.055, lantern);
  mesh(CYL, shared.brass, [0, -0.03, 0], [0.05, 0.015, 0.05], lantern);
  const balloon = hold();
  balloon.position.set(0.16, 0.5, 0.22);
  mesh(CYL, shared.string, [0, 0.45, 0], [0.006, 0.9, 0.006], balloon);
  mesh(SPHERE, mat(look.accColor, 0.25), [0, 1.05, 0], [0.22, 0.26, 0.22], balloon);
  const telescope = hold();
  telescope.position.set(0, 0.7, 0.32);
  telescope.rotation.x = -0.9;
  mesh(CYL, shared.brass, [0, 0.16, 0], [0.04, 0.34, 0.04], telescope);
  mesh(CYL, shared.book, [0, 0.0, 0], [0.05, 0.12, 0.05], telescope);
  // A dumbbell in each paw.
  const bells = [armL, armR].map((a) => {
    const g = hold(a);
    g.position.set(0, -0.23, 0.04);
    mesh(CYL, shared.iron, [0, 0, 0], [0.016, 0.22, 0.016], g).rotation.z = Math.PI / 2;
    for (const sx of [-0.1, 0.1]) mesh(CYL, shared.iron, [sx, 0, 0], [0.055, 0.04, 0.055], g).rotation.z = Math.PI / 2;
    return g;
  });
  const bottle = hold(armR);
  bottle.position.set(0, -0.24, 0.05);
  mesh(CYL, shared.water, [0, 0, 0], [0.04, 0.15, 0.04], bottle);
  mesh(CYL, mat('#5fd3b0', 0.5), [0, 0.09, 0], [0.025, 0.03, 0.025], bottle);
  // The teacher's pointer: a long thin stick along the arm, a red tip.
  const pointer = hold(armR);
  pointer.position.set(0, -0.2, 0.04);
  mesh(CYL, shared.wood, [0, -0.28, 0], [0.011, 0.56, 0.011], pointer);
  mesh(SMALL, mat('#ff5a5f', 0.5), [0, -0.56, 0], 0.02, pointer);
  // A notebook in the left paw and a pencil in the right.
  const notebook = hold();
  notebook.position.set(-0.05, 0.34, 0.32);
  notebook.rotation.set(-1.0, 0.25, 0);
  mesh(BOX, mat(look.book ?? '#ff8fb1', 0.6), [0, 0, 0], [0.18, 0.22, 0.02], notebook);
  mesh(BOX, shared.page, [0.005, 0, 0.012], [0.16, 0.2, 0.006], notebook);
  for (let i = 0; i < 4; i++) mesh(BOX, mat('#c9c0dc', 0.6), [0.01, 0.07 - i * 0.045, 0.016], [0.12, 0.006, 0.002], notebook);
  const pencil = hold(armR);
  pencil.position.set(0, -0.22, 0.05);
  pencil.rotation.x = 0.5;
  mesh(CYL, shared.pencil, [0, -0.04, 0], [0.01, 0.12, 0.01], pencil);
  mesh(CONE, mat('#3a3040', 0.5), [0, -0.11, 0], [0.01, 0.025, 0.01], pencil).rotation.x = Math.PI;

  // What it carries about: a school bag or a guitar.
  let gear: BunnyRig['gear'] = null;
  if (look.gear) {
    const obj = new Group();
    const main = mat(look.gear.color, 0.6);
    const trim = mat(look.gear.trim, 0.6);
    let extra: Object3D | null = null;
    if (look.gear.kind === 'bag') {
      mesh(SPHERE, main, [0, 0, 0], [0.17, 0.18, 0.1], obj);
      mesh(SPHERE, trim, [0, 0.06, -0.06], [0.15, 0.1, 0.06], obj);
      mesh(SPHERE, main, [0, -0.08, -0.08], [0.11, 0.07, 0.04], obj);
      mesh(SMALL, mat('#ffd34d', 0.4), [0, 0.0, -0.11], 0.02, obj);
      // A book beside the bag (shown when both have been put down).
      extra = new Group();
      mesh(BOX, mat(look.book ?? '#6f8cff', 0.6), [0, 0, 0], [0.2, 0.04, 0.26], extra);
      mesh(BOX, shared.page, [0.012, 0, 0], [0.18, 0.03, 0.24], extra);
      extra.visible = false;
    } else {
      // A little acoustic guitar: the body, a sound hole, the neck and its head.
      mesh(SPHERE, main, [0, -0.06, 0], [0.15, 0.16, 0.05], obj);
      mesh(SPHERE, main, [0, 0.12, 0], [0.11, 0.11, 0.048], obj);
      mesh(CYL, shared.dark, [0, 0.02, 0.045], [0.045, 0.01, 0.045], obj).rotation.x = Math.PI / 2;
      mesh(BOX, trim, [0, 0.38, 0.01], [0.04, 0.38, 0.02], obj);
      mesh(BOX, trim, [0, 0.6, 0.0], [0.06, 0.09, 0.025], obj);
      mesh(BOX, mat('#f6f1ff', 0.4), [0, -0.12, 0.05], [0.07, 0.015, 0.01], obj);
      for (const sx of [-0.012, 0, 0.012]) mesh(BOX, mat('#f6f1ff', 0.4), [sx, 0.25, 0.026], [0.003, 0.7, 0.003], obj);
    }
    gear = { obj, kind: look.gear.kind, at: null, extra };
    if (extra) root.add(extra);
  }

  return {
    root, body, torso, torsoBase, head, earL, earR, earOut, armL, armR, footL, footR, eyeL, eyeR, nose,
    held: { carrot: [carrot], book: [book], lantern: [lantern], balloon: [balloon], telescope: [telescope], dumbbell: bells, bottle: [bottle], pointer: [pointer], notebook: [notebook, pencil] },
    gear, lanternLight, look, p: { ...ZERO }, materials,
  };
}

/** Puts the bag or guitar where it belongs: on the back, in the paws, or on the ground beside the rabbit. */
function placeGear(rig: BunnyRig, at: GearAt): void {
  const g = rig.gear;
  if (!g || g.at === at) return;
  g.at = at;
  const o = g.obj;
  o.removeFromParent();
  if (at === 'aside') {
    rig.root.add(o);
    if (g.kind === 'bag') {
      o.position.set(0.62, 0.1, -0.15);
      o.rotation.set(-0.3, 0.6, 0.15);
    } else {
      o.position.set(0.6, 0.06, 0.2);
      o.rotation.set(-Math.PI / 2, 0, 0.4);
    }
  } else if (at === 'play' && g.kind === 'guitar') {
    rig.body.add(o);
    o.position.set(0.02, 0.3, 0.31);
    o.rotation.set(-0.15, 0.1, 1.15);
  } else {
    rig.body.add(o);
    if (g.kind === 'bag') {
      o.position.set(0, 0.38, -0.31);
      o.rotation.set(0, Math.PI, 0);
    } else {
      o.position.set(0, 0.4, -0.34);
      o.rotation.set(0, Math.PI, 0.6);
    }
  }
  if (g.extra) {
    g.extra.visible = at === 'aside';
    g.extra.position.set(0.66, 0.02, 0.28);
    g.extra.rotation.set(0, 0.5, 0);
  }
}

const target: Params = { ...ZERO };

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Places the rig where the rabbit is and moves it into its pose. */
export function poseBunny(rig: BunnyRig, b: Bunny, now: number, dt: number, calm: boolean): void {
  const t = now + b.index * 1.37;
  Object.assign(target, ZERO);
  let lift = 0;
  const f = b.hop - Math.floor(b.hop);
  const breathe = calm ? 0 : Math.sin(t * 2.4) * 0.018;
  const look = rig.look;
  const lazy = (look.slouch ?? 0) > 0.1;
  target.squash = 1 + breathe;
  if (lazy) target.eyes = 0.72;

  switch (b.gait) {
    case 'hop': {
      const s = Math.sin(f * Math.PI);
      lift = b.air * s;
      target.pitch = -0.22 * Math.cos(f * Math.PI) * Math.min(1, b.air * 5);
      target.feet = -0.9 * s;
      target.armL = target.armR = 0.5 * s;
      target.earBack = 0.35 * s;
      target.squash = 1 + 0.08 * s - 0.06 * (1 - s);
      // A strut: the head rolls and the shoulders swing with every hop.
      if (look.swagger) {
        const side = Math.floor(b.hop) % 2 ? 1 : -1;
        target.headRoll = 0.14 * side;
        target.twist = 0.12 * side;
      }
      break;
    }
    case 'leap':
      target.feet = -1.1;
      target.armL = target.armR = -0.6;
      target.earBack = 0.55;
      target.pitch = -0.15;
      target.squash = 1.08;
      break;
    case 'slide':
      target.pitch = -0.35;
      target.armL = target.armR = -2.6;
      target.spread = 0.5;
      target.earBack = 1.1;
      target.feet = 0.4;
      break;
    case 'float':
      target.earBack = -0.15;
      target.earSpread = 0.7;
      target.spread = 1.25;
      target.armL = target.armR = -0.4;
      target.feet = -0.4;
      target.pitch = Math.sin(t * 3) * 0.08;
      break;
    case 'ride':
      target.armL = target.armR = -1.1;
      target.headPitch = -0.2;
      break;
    case 'stand':
      break;
  }

  const pose = b.pose as Pose;
  let spin = 0;
  if (b.gait === 'stand' || b.gait === 'ride' || (b.gait === 'leap' && (pose === 'jumps' || pose === 'idle'))) {
    const wig = calm ? 0 : Math.sin(t * 1.1) > 0.92 ? Math.sin(t * 40) * 0.15 : 0;
    target.earBack += wig;
    switch (pose) {
      case 'idle':
        target.headYaw = Math.sin(t * 0.37) * 0.35;
        target.headPitch = Math.sin(t * 0.23) * 0.1;
        break;
      case 'look':
        // A good look round: the head turns well over, the ears up.
        target.headYaw = Math.sin(t * 0.8) * 0.75;
        target.headPitch = -0.12 + Math.sin(t * 0.5) * 0.1;
        target.earBack = -0.12;
        target.earSpread = 0.08;
        break;
      case 'sit':
      case 'watch':
        target.bodyY = -0.03;
        target.pitch = -0.12;
        target.headPitch = -0.1;
        target.headYaw = Math.sin(t * 0.3) * 0.25;
        break;
      case 'eat':
        target.pitch = -0.08;
        target.armL = target.armR = -1.35;
        target.headPitch = 0.15 + Math.abs(Math.sin(t * 7)) * 0.08;
        break;
      case 'dig':
        target.pitch = 0.35;
        target.armL = -0.9 + Math.sin(t * 11) * 0.6;
        target.armR = -0.9 - Math.sin(t * 11) * 0.6;
        target.headPitch = 0.3;
        break;
      case 'sniff':
        target.pitch = 0.22;
        target.headPitch = 0.35;
        target.headYaw = Math.sin(t * 0.9) * 0.3;
        break;
      case 'sleep':
        target.bodyY = -0.1;
        target.squash = 0.82 + (calm ? 0 : Math.sin(t * 1.1) * 0.035);
        target.headPitch = 0.4;
        target.earBack = 1.35;
        target.eyes = 0.12;
        target.armL = target.armR = -0.5;
        target.feet = 0.2;
        break;
      case 'read':
        target.bodyY = -0.03;
        target.pitch = -0.1;
        target.armL = target.armR = -1.2;
        target.headPitch = 0.32;
        break;
      case 'gaze':
        target.bodyY = -0.03;
        target.pitch = -0.2;
        target.headPitch = -0.55;
        target.armL = target.armR = -1.6;
        break;
      case 'chat':
        target.headRoll = Math.sin(t * 0.8) * 0.18;
        target.armR = Math.sin(t * 1.7) > 0.4 ? -1.4 + Math.sin(t * 6) * 0.3 : -0.2;
        target.headYaw = Math.sin(t * 0.5) * 0.4;
        break;
      case 'hold':
        target.armR = -2.7;
        target.headPitch = -0.3;
        break;
      case 'cheer': {
        lift = calm ? 0 : Math.abs(Math.sin(t * 6.5)) * 0.32;
        target.armL = target.armR = -2.9;
        target.spread = 0.35;
        target.earBack = -0.15;
        target.earSpread = 0.25;
        target.headPitch = -0.2;
        break;
      }
      case 'inspect':
        target.pitch = 0.3;
        target.earBack = -0.25;
        target.headYaw = Math.sin(t * 0.8) * 0.12;
        target.headRoll = 0.18;
        break;
      case 'peer':
        // Right up close: leaning in, eyes wide.
        target.pitch = 0.5;
        target.bodyY = 0.02;
        target.headPitch = 0.3;
        target.earBack = -0.3;
        target.eyes = 1.25;
        target.headYaw = Math.sin(t * 0.6) * 0.2;
        target.armL = target.armR = -0.5;
        break;
      case 'push':
        target.pitch = 0.5;
        target.armL = target.armR = -1.45;
        target.feet = -0.7;
        target.earBack = 0.6;
        break;
      case 'tap':
        target.pitch = 0.18;
        target.armR = -1.5 + (calm ? 0 : Math.max(0, Math.sin(t * 9)) * 0.45);
        break;
      case 'point':
        target.armR = -1.9;
        target.headPitch = -0.1;
        break;
      case 'nod':
        target.headPitch = calm ? 0.2 : Math.sin(t * 7) * 0.25 + 0.05;
        target.armL = target.armR = -0.4;
        break;
      case 'startle':
        target.bodyY = 0.08;
        target.earBack = -0.3;
        target.eyes = 1.35;
        target.armL = target.armR = -0.9;
        target.spread = 0.5;
        break;
      case 'shrug':
        target.spread = 0.9;
        target.armL = target.armR = -0.7;
        target.headRoll = 0.25;
        break;
      case 'present':
        target.armL = target.armR = -1.7;
        target.spread = 0.35;
        target.headPitch = -0.15;
        break;
      case 'wave':
        target.armR = -2.8;
        target.spread = 0.25 + (calm ? 0 : Math.sin(t * 9) * 0.3);
        target.headRoll = 0.15;
        break;
      case 'clap':
        target.armL = target.armR = -1.4;
        target.spread = 0.06 + (calm ? 0 : Math.cos(t * 11) * 0.2);
        lift = calm ? 0 : Math.abs(Math.sin(t * 5.5)) * 0.05;
        target.headPitch = -0.1;
        break;
      // The gym.
      case 'lift': {
        // Curls, one arm then the other.
        const a = calm ? 0.5 : Math.max(0, Math.sin(t * 2.6)), c = calm ? 0.5 : Math.max(0, Math.sin(t * 2.6 + Math.PI));
        target.armL = -0.25 - 1.9 * a;
        target.armR = -0.25 - 1.9 * c;
        target.spread = 0.14;
        target.pitch = -0.06;
        target.headPitch = -0.08;
        target.squash = 1 + 0.03 * (a + c);
        break;
      }
      case 'stretch': {
        if (Math.sin(t * 0.45) > 0.55) {
          // A touch of the toes.
          target.pitch = 0.75;
          target.armL = target.armR = -0.5;
          target.headPitch = 0.3;
        } else {
          target.armL = target.armR = -2.95;
          target.lean = calm ? 0 : Math.sin(t * 1.5) * 0.35;
          target.headRoll = -target.lean * 0.5;
          target.spread = 0.05;
        }
        break;
      }
      case 'jumps': {
        const s = calm ? 0.5 : Math.abs(Math.sin(t * 5));
        lift = s * 0.3;
        target.armL = target.armR = -0.4 - 2.4 * s;
        target.spread = 0.2 + 0.9 * s;
        target.feet = -0.6 * s;
        target.earBack = -0.2 + 0.4 * s;
        break;
      }
      case 'drink':
        target.bodyY = -0.03;
        target.pitch = -0.12;
        target.armR = -2.55;
        target.spread = -0.25;
        target.headPitch = -0.4;
        break;
      // Manas at his desk.
      case 'type':
        target.bodyY = -0.03;
        target.pitch = 0.12;
        target.armL = -1.25 + (calm ? 0 : Math.max(0, Math.sin(t * 14)) * 0.15);
        target.armR = -1.25 + (calm ? 0 : Math.max(0, Math.sin(t * 14 + 1.9)) * 0.15);
        target.headPitch = 0.08;
        target.eyes = 0.9;
        break;
      case 'nap':
        target.bodyY = -0.06;
        target.pitch = 0.42;
        target.headPitch = 0.55;
        target.armL = target.armR = -1.3;
        target.spread = -0.1;
        target.eyes = 0.1;
        target.earBack = 1.0;
        target.squash = 0.92 + (calm ? 0 : Math.sin(t * 1.1) * 0.03);
        break;
      case 'lazy':
        // Sunk into the beanbag.
        target.pitch = -0.45;
        target.armL = target.armR = -0.3;
        target.spread = 0.7;
        target.headPitch = -0.1;
        target.headRoll = 0.15;
        target.eyes = 0.55;
        target.feet = 0.5;
        target.earBack = 0.6;
        break;
      // Manan's music.
      case 'guitar':
      case 'sing':
        target.armL = -1.15;
        target.spreadL = -0.45;
        target.armR = -0.95 + (calm ? 0 : Math.sin(t * 9) * 0.25);
        target.spread = -0.2;
        target.headPitch = pose === 'sing' ? -0.32 : 0.12 + (calm ? 0 : Math.sin(t * 4.2) * 0.08);
        target.headRoll = pose === 'sing' ? Math.sin(t * 1.2) * 0.15 : 0.12;
        target.eyes = pose === 'sing' ? 0.25 : 1;
        target.feet = calm ? 0 : Math.max(0, Math.sin(t * 4.2)) * 0.3;
        break;
      // The teacher and the students.
      case 'teach':
        target.armR = -2.05;
        target.armL = -0.6;
        target.headPitch = -0.12;
        target.headYaw = 0.2;
        break;
      case 'notes':
        target.bodyY = -0.03;
        target.pitch = 0.14;
        target.armL = -1.15;
        target.armR = -1.0 + (calm ? 0 : Math.sin(t * 12) * 0.1);
        target.spread = -0.15 + (calm ? 0 : Math.sin(t * 7) * 0.08);
        target.headPitch = 0.38;
        break;
      case 'raise':
        target.armR = -3.05 + (calm ? 0 : Math.sin(t * 8) * 0.1);
        target.armL = -0.4;
        target.eyes = 1.15;
        target.headPitch = -0.15;
        target.bodyY = 0.02;
        break;
      case 'ponder':
        target.bodyY = -0.03;
        target.armR = -2.1;
        target.spread = -0.45;
        target.headRoll = 0.2;
        target.headPitch = -0.22;
        break;
      case 'adjust':
        // A push of the glasses up the nose.
        target.armR = -2.45;
        target.spread = -0.5;
        target.headPitch = 0.05;
        target.eyes = 1.1;
        break;
      case 'stumble': {
        // Down (paws out), a dazed moment sat on the cloud, back up, glasses straightened.
        const u = b.cue;
        if (u < 0.18) {
          const k = u / 0.18;
          target.pitch = 0.95 * k;
          target.armL = target.armR = -1.7 * k;
          target.spread = 0.4;
          target.eyes = 1.4;
          target.earBack = -0.4;
        } else if (u < 0.55) {
          target.bodyY = -0.1;
          target.pitch = -0.28;
          target.headRoll = calm ? 0 : Math.sin(t * 6) * 0.22;
          target.armL = target.armR = -0.3;
          target.spread = 0.6;
          target.eyes = 0.55;
          target.earBack = 1.0;
          target.feet = 0.6;
        } else if (u < 0.8) {
          target.pitch = 0.25;
          target.armL = target.armR = -0.8;
          target.headPitch = 0.1;
        } else {
          target.armR = -2.45;
          target.spread = -0.5;
          target.eyes = 1.1;
        }
        break;
      }
      // The gathering.
      case 'dance':
        target.armL = -1.8 + (calm ? 0 : Math.sin(t * 5.6) * 0.9);
        target.armR = -1.8 - (calm ? 0 : Math.sin(t * 5.6) * 0.9);
        target.spread = 0.35;
        target.twist = calm ? 0 : Math.sin(t * 2.8) * 0.35;
        target.headRoll = calm ? 0 : Math.sin(t * 2.8) * 0.2;
        target.earSpread = 0.2;
        break;
      case 'listen':
        target.bodyY = -0.03;
        target.pitch = -0.1;
        target.headRoll = calm ? 0 : Math.sin(t * 2.1) * 0.15;
        target.headPitch = 0.05;
        target.eyes = 0.8;
        break;
      case 'cool':
        // Arms folded, chin up.
        target.armL = target.armR = -1.25;
        target.spread = target.spreadL = -0.75;
        target.headPitch = -0.14;
        target.headYaw = Math.sin(t * 0.3) * 0.3;
        target.pitch = -0.06;
        break;
      case 'hide':
        target.bodyY = -0.1;
        target.pitch = 0.35;
        target.earBack = 1.2;
        target.headPitch = 0.15;
        target.eyes = 1.3;
        target.armL = target.armR = -1.0;
        target.squash = 0.88;
        break;
      case 'roll':
        target.armL = target.armR = -0.3;
        target.spread = -0.2;
        target.earBack = 1.2;
        target.eyes = 0.3;
        target.feet = 0.4;
        spin = calm ? 0 : b.cue * Math.PI * 4;
        break;
    }
    // How each one carries itself: Yash chest out, Manas in a comfortable slump.
    if (pose !== 'sleep' && pose !== 'nap' && pose !== 'roll' && pose !== 'stumble' && pose !== 'lazy') {
      target.pitch += look.slouch ?? 0;
      target.headPitch -= (look.slouch ?? 0) * 0.6;
    }
  }
  if (target.spreadL === 0) target.spreadL = target.spread;

  // Blink now and then.
  if (!calm && target.eyes > 0.5 && (t % 4.3) < 0.12) target.eyes = 0.1;

  // Turn the head towards what it is looking at.
  if (b.look) {
    const dx = b.look[0] - b.x, dz = b.look[2] - b.z, dy = b.look[1] - (b.y + 0.7);
    const yaw = wrap(Math.atan2(dx, dz) - b.yaw);
    target.headYaw = Math.max(-0.9, Math.min(0.9, yaw));
    target.headPitch += Math.max(-0.7, Math.min(0.4, -Math.atan2(dy, Math.hypot(dx, dz)) * 0.8));
  }

  const p = rig.p;
  const k = calm ? 1 : Math.min(1, dt * 9);
  for (const key of Object.keys(target) as (keyof Params)[]) p[key] += (target[key] - p[key]) * k;

  rig.root.position.set(b.x, b.y, b.z);
  rig.root.rotation.y = b.yaw;
  // Rolling: the body turns over about its middle (sideways, like a log down a slope).
  rig.body.position.set(spin ? Math.sin(spin) * 0.3 : 0, p.bodyY + lift + (spin ? 0.3 - Math.cos(spin) * 0.3 : 0), 0);
  rig.body.rotation.set(p.pitch, p.twist, p.lean + spin);
  const [tx, ty, tz] = rig.torsoBase;
  rig.torso.scale.set(tx * (2 - p.squash) ** 0.5, ty * p.squash, tz);
  rig.armL.rotation.set(p.armL, 0, -p.spreadL);
  rig.armR.rotation.set(p.armR, 0, p.spread);
  rig.footL.rotation.x = rig.footR.rotation.x = p.feet;
  rig.head.rotation.set(p.headPitch, p.headYaw, p.headRoll);
  const lop = look.lop;
  const wob = calm ? 0 : Math.sin(t * 3.1) * 0.05;
  const out = rig.earOut;
  rig.earL.rotation.set(lop ? 0.25 + p.earBack * 0.3 : -0.12 - p.earBack * (out ? 0.3 : 1), 0, lop ? 2.0 - p.earSpread * 0.8 + wob : 0.18 + out + p.earSpread + wob);
  rig.earR.rotation.set(lop ? 0.25 + p.earBack * 0.3 : -0.12 - p.earBack * (out ? 0.3 : 1), 0, lop ? -2.0 + p.earSpread * 0.8 - wob : -0.18 - out - p.earSpread - wob);
  const eyeY = look.acc.includes('bigglasses') ? 0.066 : 0.05;
  rig.eyeL.scale.y = rig.eyeR.scale.y = eyeY * Math.max(0.08, p.eyes);
  rig.nose.scale.x = 0.032 * (1 + (calm ? 0 : Math.max(0, Math.sin(t * 13)) * 0.18));

  for (const [key, list] of Object.entries(rig.held) as [HeldKey, Object3D[]][]) {
    const on = b.held === key;
    for (const o of list) o.visible = on;
  }
  if (b.held === 'balloon') rig.held.balloon[0].rotation.z = Math.sin(t * 1.2) * 0.12;
  // The guitar only comes out in front to play; the bag and the guitar are put down beside the bed at night.
  placeGear(rig, b.gear === 'play' && rig.gear?.kind !== 'guitar' ? 'worn' : b.gear);
}

export function disposeBunny(rig: BunnyRig): void {
  rig.materials.forEach((m) => m.dispose());
}

import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { PolarPlaces, PolarProp } from './polarLayout';

/**
 * Everything the penguin colony has set out on the ice, built from snow and
 * ice: snow beds and ice mats, igloos, snow chairs and an ice table, an ice
 * desk with a laptop, a board of ice and a lectern, benches, the gym (a
 * barbell rack, a pull-up bar, a punching bag, dumbbells, a water jug), the
 * campfire of driftwood ringed with stones and ice-block seats, the rim of
 * the pool with its diving ledge and floes, the ice slide on its snow hill,
 * the play slide, a snowman, a ball, a crate of fish, and ice lanterns on
 * posts. Pure scenery: the penguins that use it live in ColonyLayer, and the
 * light it gives at night is the world's to animate.
 */

const BLANKETS = ['#c9503a', '#3f7fb5', '#e0b33a', '#8e5fb5', '#4f9f6a', '#d9788a', '#5fb4a8', '#e07a3a'];
const MATS = ['#7fb6e0', '#a9d4f0', '#e8a0b4', '#9fd0c0', '#c8b8f0', '#f0d290', '#90c0f0', '#b0e0d0', '#f0b0a0', '#a0b8e0'];

export interface PolarColonyProps {
  group: Group;
  /** The laptop's screen (it glows, more so at night). */
  screen: MeshStandardMaterial;
  fire: { x: number; z: number; flames: { mesh: Mesh; seed: number; base: number }[]; light: PointLight };
  /** The ice lanterns (lit at night). */
  lamps: { mat: MeshStandardMaterial; x: number; z: number }[];
  /** The igloos' doorways (they glow at night). */
  doors: MeshStandardMaterial[];
  /** The barbell lying on the rack (hidden while someone lifts it), and the punching bag's pivot (swung by a puncher). */
  rackBar: Group[];
  punch: { pivot: Group; x: number; z: number }[];
  /** Ice floes in the pool (they bob), and the ball. */
  floes: { mesh: Group; x: number; z: number; seed: number }[];
  ball: Group | null;
  dispose(): void;
}

/** Bricks for an igloo, drawn once on a canvas. */
export function iglooTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#eef5fc';
  ctx.fillRect(0, 0, w, h);
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const y0 = (r / rows) * h;
    const cols = Math.max(4, Math.round(16 * Math.cos(((r + 0.5) / rows) * (Math.PI / 2))));
    ctx.fillStyle = r % 2 ? '#e6f0fa' : '#f4f9ff';
    ctx.fillRect(0, y0, w, h / rows);
    ctx.strokeStyle = '#a9c3dd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
    for (let c = 0; c < cols; c++) {
      const x = ((c + (r % 2) * 0.5) / cols) * w;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + h / rows);
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function buildPolarColonyProps(places: PolarPlaces, lanterns: [number, number][], floorY: number): PolarColonyProps {
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const textures: CanvasTexture[] = [];
  const g = <T extends BufferGeometry>(geo: T): T => {
    geos.push(geo);
    return geo;
  };
  const m = (color: string, roughness = 0.6, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial => {
    const mat = new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0 });
    Object.assign(mat, extra);
    mats.push(mat);
    return mat;
  };
  const snow = m('#eef4fb', 0.92, { emissive: new Color('#1a3050'), emissiveIntensity: 0.12 });
  const snowShade = m('#d4e2f0', 0.95, { emissive: new Color('#1a3050'), emissiveIntensity: 0.12 });
  const ice = m('#bfe3ff', 0.08, { transparent: true, opacity: 0.86, emissive: new Color('#2f6fa8'), emissiveIntensity: 0.25 });
  const iceSolid = m('#a8d4f4', 0.12, { emissive: new Color('#1f5585'), emissiveIntensity: 0.22 });
  const steel = m('#c9d4dd', 0.3, { metalness: 0.65 });
  const plate = m('#3d4656', 0.6);
  const wood = m('#8a6a4a', 0.85);
  const woodDark = m('#5e4430', 0.9);
  const stone = m('#5f6a78', 0.95);
  const coal = m('#1b1d22', 0.8);
  const carrot = m('#f08a2a', 0.6);
  const fishMat = m('#a9c2d4', 0.28, { metalness: 0.45 });
  const blanket = BLANKETS.map((c) => m(c, 0.85));
  const matTones = MATS.map((c) => m(c, 0.7));
  const brick = iglooTexture();
  if (brick) textures.push(brick);
  const dome = m('#ffffff', 0.75, { map: brick ?? undefined, emissive: new Color('#203a58'), emissiveIntensity: 0.3 });

  const root = new Group();
  const box = (parent: Group, mat: Material, w: number, h: number, d: number, x: number, y: number, z: number): Mesh => {
    const mesh = new Mesh(g(new BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const cyl = (parent: Group, mat: Material, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, r2 = r, seg = 14): Mesh => {
    const mesh = new Mesh(g(new CylinderGeometry(r, r2, h, seg)), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, 0, rz);
    parent.add(mesh);
    return mesh;
  };
  const ball = (parent: Group, mat: Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh => {
    const mesh = new Mesh(g(new SphereGeometry(r, 16, 12)), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  const place = (p: { x: number; z: number; yaw: number }): Group => {
    const grp = new Group();
    grp.position.set(p.x, floorY, p.z);
    grp.rotation.y = p.yaw;
    root.add(grp);
    return grp;
  };
  const fishOn = (parent: Group, x: number, y: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const f = ball(parent, fishMat, 0.5, x + Math.cos(i * 1.7) * 0.12, y + (i % 2) * 0.03, z + Math.sin(i * 1.7) * 0.1, 0.06, 0.07, 0.19);
      f.rotation.set(0.3 - i * 0.15, i * 1.1, 0.4);
    }
  };

  let screen = m('#101820', 0.3, { emissive: new Color('#7fc8ff'), emissiveIntensity: 0.6 });
  const rackBar: Group[] = [];
  const punch: PolarColonyProps['punch'] = [];
  const doors: MeshStandardMaterial[] = [];
  const floes: PolarColonyProps['floes'] = [];
  let theBall: Group | null = null;

  const build = (p: PolarProp) => {
    const grp = place(p);
    const tone = Math.round(p.tone ?? 0);
    switch (p.kind) {
      case 'snowbed': {
        // A bed of packed snow: a block, a soft snow pillow, a blanket half over it.
        box(grp, snowShade, 1.3, 0.2, 0.74, 0, 0.1, 0);
        ball(grp, snow, 0.5, 0, 0.2, 0, 1.3, 0.12, 0.74);
        ball(grp, snow, 0.2, -0.45, 0.28, 0, 0.9, 0.55, 1.4);
        const bl = box(grp, blanket[tone % blanket.length], 0.62, 0.05, 0.78, 0.3, 0.255, 0);
        bl.rotation.z = 0.02;
        break;
      }
      case 'icemat': {
        // A round mat of woven reeds laid on the ice.
        const mat = cyl(grp, matTones[tone % matTones.length], 0.62, 0.03, 0, 0.015, 0, 0, 0, 0.62, 24);
        mat.scale.set(1, 1, 0.78);
        const rim = new Mesh(g(new TorusGeometry(0.6, 0.025, 6, 32)), m(new Color(MATS[tone % MATS.length]).multiplyScalar(0.75).getStyle(), 0.8));
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(1, 0.78, 1);
        rim.position.y = 0.03;
        grp.add(rim);
        break;
      }
      case 'snowchair': {
        // A seat cut from a block of snow, with a back to it (the seat faces along the group's +z).
        box(grp, snowShade, 0.62, 0.2, 0.6, 0, 0.1, 0);
        box(grp, snow, 0.62, 0.55, 0.16, 0, 0.42, -0.26);
        ball(grp, snow, 0.32, 0, 0.2, 0.02, 0.95, 0.15, 0.9);
        break;
      }
      case 'icetable': {
        // An ice slab on a pillar of snow, a plate of fish on it.
        cyl(grp, snowShade, 0.18, 0.5, 0, 0.25, 0, 0, 0, 0.26);
        cyl(grp, ice, 0.55, 0.06, 0, 0.53, 0, 0, 0, 0.55, 24);
        cyl(grp, m('#f4f1ea', 0.5), 0.2, 0.02, 0.05, 0.57, 0);
        fishOn(grp, 0.05, 0.6, 0, 3);
        break;
      }
      case 'icedesk': {
        // A slab of ice on two blocks of snow, a laptop open on it (its screen to the chair), a mug of something hot.
        for (const sx of [-1, 1]) box(grp, snowShade, 0.22, 0.62, 0.55, sx * 0.62, 0.31, 0);
        box(grp, ice, 1.6, 0.07, 0.75, 0, 0.66, 0);
        const laptop = new Group();
        laptop.position.set(0, 0.7, 0.05);
        grp.add(laptop);
        box(laptop, m('#3a3f4a', 0.4, { metalness: 0.4 }), 0.52, 0.025, 0.36, 0, 0, 0.08);
        const lid = new Group();
        lid.position.set(0, 0.01, -0.1);
        lid.rotation.x = 0.3;
        laptop.add(lid);
        box(lid, m('#3a3f4a', 0.4, { metalness: 0.4 }), 0.52, 0.34, 0.02, 0, 0.17, 0);
        const sc = new Mesh(g(new BoxGeometry(0.46, 0.29, 0.005)), screen);
        sc.position.set(0, 0.175, 0.012);
        lid.add(sc);
        cyl(grp, m('#d9402f', 0.5), 0.05, 0.1, 0.55, 0.75, 0.15);
        break;
      }
      case 'board': {
        // A board of ice on two posts, with a little bar chart scratched on it (the lesson).
        for (const sx of [-1, 1]) cyl(grp, iceSolid, 0.06, 1.7, sx * 1.05, 0.85, 0, 0, 0, 0.08);
        box(grp, m('#1f3a5a', 0.3, { emissive: new Color('#0d2036'), emissiveIntensity: 0.4 }), 2.2, 1.15, 0.06, 0, 1.15, 0);
        const chalk = m('#e8f4ff', 0.9, { emissive: new Color('#8fc8ff'), emissiveIntensity: 0.35 });
        [0.35, 0.6, 0.25, 0.8, 0.45].forEach((h, i) => box(grp, chalk, 0.2, h, 0.01, -0.7 + i * 0.35, 0.72 + h / 2, 0.04));
        box(grp, chalk, 1.9, 0.015, 0.01, 0, 0.7, 0.04);
        box(grp, chalk, 0.8, 0.02, 0.01, -0.3, 1.58, 0.04);
        break;
      }
      case 'lectern': {
        box(grp, snowShade, 0.5, 0.85, 0.4, 0, 0.42, 0);
        const top = box(grp, ice, 0.6, 0.05, 0.48, 0, 0.88, 0.02);
        top.rotation.x = 0.25;
        box(grp, m('#8a4fb0', 0.6), 0.3, 0.04, 0.22, 0, 0.92, 0.04).rotation.x = 0.25;
        break;
      }
      case 'bench': {
        // A long snow bench with an ice top (the sitters face along +z).
        box(grp, snowShade, 1.4, 0.22, 0.45, 0, 0.11, 0);
        box(grp, ice, 1.5, 0.05, 0.5, 0, 0.245, 0);
        break;
      }
      case 'iceblock': {
        // A seat by the fire: a block of ice, a reed cushion on it.
        const blk = box(grp, iceSolid, 0.62, 0.3, 0.48, 0, 0.15, 0);
        blk.rotation.y = 0.05;
        cyl(grp, matTones[(Math.round(p.x * 3) % matTones.length + matTones.length) % matTones.length], 0.22, 0.03, 0, 0.31, 0);
        break;
      }
      case 'rack': {
        // A rack of ice with the barbell across its hooks.
        for (const sx of [-1, 1]) {
          box(grp, iceSolid, 0.12, 1.0, 0.16, sx * 0.48, 0.5, 0);
          box(grp, iceSolid, 0.16, 0.06, 0.2, sx * 0.48, 0.84, 0.1);
        }
        box(grp, snowShade, 1.2, 0.08, 0.5, 0, 0.04, 0);
        const bar = new Group();
        bar.position.set(0, 0.9, 0.12);
        grp.add(bar);
        cyl(bar, steel, 0.013, 1.1, 0, 0, 0, 0, Math.PI / 2);
        for (const sx of [-1, 1]) for (const [dx, r] of [[0.42, 0.14], [0.47, 0.1]] as const) cyl(bar, plate, r, 0.04, sx * dx, 0, 0, 0, Math.PI / 2, r, 18);
        rackBar.push(bar);
        break;
      }
      case 'pullup': {
        // Two ice posts and a steel bar across the top, a step of snow under it.
        for (const sx of [-1, 1]) cyl(grp, iceSolid, 0.07, 2.05, sx * 0.62, 1.02, 0, 0, 0, 0.09);
        cyl(grp, steel, 0.025, 1.36, 0, 2.0, 0, 0, Math.PI / 2);
        box(grp, snowShade, 0.7, 0.3, 0.55, 0, 0.15, -0.1);
        break;
      }
      case 'punch': {
        // A punching bag hung from a frame of ice.
        for (const sx of [-1, 1]) cyl(grp, iceSolid, 0.06, 1.9, sx * 0.55, 0.95, 0, 0, 0, 0.08);
        box(grp, iceSolid, 1.25, 0.1, 0.12, 0, 1.9, 0);
        const pivot = new Group();
        pivot.position.set(0, 1.85, 0);
        grp.add(pivot);
        cyl(pivot, steel, 0.008, 0.3, 0, -0.15, 0);
        cyl(pivot, m('#b8402f', 0.7), 0.19, 0.8, 0, -0.7, 0, 0, 0, 0.19, 16);
        cyl(pivot, m('#2b2f38', 0.6), 0.2, 0.06, 0, -0.32, 0, 0, 0, 0.2, 16);
        punch.push({ pivot, x: p.x, z: p.z });
        break;
      }
      case 'dumbbells': {
        for (const dx of [-0.2, 0.2]) {
          const db = new Group();
          db.position.set(dx, 0.08, 0);
          db.rotation.y = dx * 2;
          grp.add(db);
          cyl(db, steel, 0.02, 0.3, 0, 0, 0, 0, Math.PI / 2);
          for (const sx of [-1, 1]) cyl(db, plate, 0.075, 0.05, sx * 0.13, 0, 0, 0, Math.PI / 2, 0.075, 12);
        }
        break;
      }
      case 'jug': {
        cyl(grp, m('#5fb4ff', 0.15, { transparent: true, opacity: 0.75 }), 0.12, 0.42, 0, 0.21, 0);
        cyl(grp, m('#2f6fa8', 0.4), 0.06, 0.06, 0, 0.45, 0);
        break;
      }
      case 'igloo': {
        // A snow-brick igloo with a tunnel, its doorway warm with lamplight.
        const s = p.tone ?? 1;
        const ig = new Group();
        ig.scale.setScalar(s);
        grp.add(ig);
        ig.add(new Mesh(g(new SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), dome));
        const tunnel = new Mesh(g(new CylinderGeometry(0.48, 0.48, 0.85, 20, 1, true, -Math.PI / 2, Math.PI)), dome);
        tunnel.rotation.x = Math.PI / 2;
        tunnel.position.set(0, 0, 1.2);
        ig.add(tunnel);
        const doorMat = m('#2a1606', 1, { emissive: new Color('#ffa64d'), emissiveIntensity: 1.0 });
        doors.push(doorMat);
        const door = new Mesh(g(new CircleGeometry(0.43, 20, 0, Math.PI)), doorMat);
        door.position.set(0, 0, 1.63);
        ig.add(door);
        break;
      }
      case 'snowman': {
        ball(grp, snow, 0.42, 0, 0.38, 0);
        ball(grp, snow, 0.3, 0, 0.98, 0);
        ball(grp, snow, 0.21, 0, 1.42, 0);
        for (const sx of [-1, 1]) ball(grp, coal, 0.028, sx * 0.07, 1.47, 0.18);
        for (const y of [0.9, 1.02, 1.14]) ball(grp, coal, 0.03, 0, y, 0.29);
        cyl(grp, carrot, 0.0, 0.2, 0, 1.42, 0.27, Math.PI / 2, 0, 0.035, 8);
        const scarf = new Mesh(g(new TorusGeometry(0.21, 0.045, 8, 24)), m('#d4503a', 0.9));
        scarf.rotation.x = Math.PI / 2;
        scarf.position.y = 1.24;
        grp.add(scarf);
        cyl(grp, coal, 0.2, 0.03, 0, 1.6, 0, 0, 0, 0.2, 18);
        cyl(grp, coal, 0.13, 0.22, 0, 1.72, 0, 0, 0, 0.13, 18);
        for (const sx of [-1, 1]) {
          const arm = cyl(grp, woodDark, 0.015, 0.6, sx * 0.48, 1.12, 0, 0, sx * 1.0);
          arm.rotation.y = 0.2;
        }
        break;
      }
      case 'ball': {
        // A striped ball to chase about.
        const bg = new Group();
        bg.position.y = 0.22;
        grp.add(bg);
        const colors = ['#e84a4a', '#f5f1e8', '#3d7cc0', '#f5f1e8', '#f2c14e', '#f5f1e8'];
        colors.forEach((c, i) => {
          const seg = new Mesh(g(new SphereGeometry(0.22, 18, 12, (i / 6) * Math.PI * 2, Math.PI / 3)), m(c, 0.4));
          bg.add(seg);
        });
        theBall = bg;
        break;
      }
      case 'crate': {
        // A wooden crate brimming with fish.
        box(grp, wood, 0.7, 0.36, 0.5, 0, 0.18, 0);
        for (const y of [0.08, 0.28]) box(grp, woodDark, 0.72, 0.05, 0.52, 0, y, 0);
        ball(grp, snow, 0.3, 0, 0.36, 0, 1.0, 0.25, 0.75);
        fishOn(grp, 0, 0.44, 0, 5);
        break;
      }
      case 'ledge': {
        // A diving ledge: a step of snow and a slab of ice out over the water (the group's +z points at the pool).
        box(grp, snowShade, 0.9, 0.4, 0.9, 0, 0.2, -0.15);
        box(grp, ice, 0.75, 0.06, 1.1, 0, 0.42, 0.2);
        // A step up to it at the back.
        box(grp, snow, 0.6, 0.2, 0.35, 0, 0.1, -0.75);
        break;
      }
      case 'floe': {
        const s = p.tone ?? 0.5;
        const fl = new Group();
        fl.position.set(p.x, floorY + 0.02, p.z);
        fl.rotation.y = p.yaw;
        root.remove(grp);
        root.add(fl);
        const top = cyl(fl, snow, 0.5 * s, 0.08, 0, 0.02, 0, 0, 0, 0.55 * s, 9);
        top.scale.set(1.3, 1, 1);
        cyl(fl, iceSolid, 0.56 * s, 0.1, 0, -0.05, 0, 0, 0, 0.6 * s, 9).scale.set(1.3, 1, 1);
        floes.push({ mesh: fl, x: p.x, z: p.z, seed: p.yaw });
        break;
      }
      default:
        break;
    }
  };
  for (const p of places.props) build(p);

  // The fire: driftwood in a ring of dark stones, flames over it, and the light it throws.
  const camp = places.camp;
  const fireGrp = place({ x: camp.x, z: camp.z, yaw: 0 });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    ball(fireGrp, stone, 0.17, Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75, 1.1, 0.75, 0.9);
  }
  for (let k = 0; k < 4; k++) {
    const log = cyl(fireGrp, k % 2 ? wood : woodDark, 0.06, 0.95, 0, 0.12, 0, Math.PI / 2 - 0.3, 0, 0.07, 8);
    log.rotation.y = (k / 4) * Math.PI;
    log.rotation.order = 'YXZ';
  }
  const flames: PolarColonyProps['fire']['flames'] = [];
  const flameMats = ['#ffcf5a', '#ff9a3a', '#ff6a2a'].map((c) => m(c, 1, { emissive: new Color(c), emissiveIntensity: 2.2, transparent: true, opacity: 0.9, depthWrite: false }));
  for (let k = 0; k < 5; k++) {
    const fl = new Mesh(g(new ConeGeometry(1, 1, 10)), flameMats[k % 3]);
    const a = k * 2.4;
    fl.position.set(k === 0 ? 0 : Math.cos(a) * 0.17, 0.35, k === 0 ? 0 : Math.sin(a) * 0.17);
    const base = k === 0 ? 0.85 : 0.5 + (k % 2) * 0.15;
    fl.scale.set(0.2, base, 0.2);
    fl.position.y = 0.12 + base / 2;
    fireGrp.add(fl);
    flames.push({ mesh: fl, seed: k * 1.3, base });
  }
  const light = new PointLight('#ffa040', 4, 14, 1.6);
  light.position.set(0, 1.0, 0);
  fireGrp.add(light);

  // The pool's rim: a lip of packed snow round the open water.
  const pool = places.pool;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const r = 1.04 + 0.04 * Math.sin(k * 2.3);
    ball(root, k % 3 ? snow : snowShade, 0.32 + 0.06 * Math.sin(k * 1.7), pool.x + Math.cos(a) * pool.rx * r, floorY + 0.02, pool.z + Math.sin(a) * pool.rz * r, 1.3, 0.38, 0.9).rotation.y = -a;
  }

  // The ice slide: steps up the back of a snow hill, a polished lane down its front, rails along it.
  const rp = places.ramp;
  const rg = place({ x: 0, z: 0, yaw: 0 });
  rg.position.set(0, floorY, 0);
  for (let k = 0; k <= 5; k++) {
    const u = k / 5;
    const hx = rp.top[0] + (rp.end[0] - rp.top[0]) * u, hz = rp.top[1] + (rp.end[1] - rp.top[1]) * u;
    const h = rp.height * (1 - u) + 0.05;
    ball(rg, k % 2 ? snow : snowShade, 1, hx, 0, hz, 0.85, h * 0.97, 0.85);
  }
  ball(rg, snow, 1, rp.top[0], 0, rp.top[1], 0.95, rp.height + 0.02, 0.95);
  beamTo(rg, ice, 0.95, [rp.top[0], rp.height + 0.03, rp.top[1]], [rp.end[0], 0.04, rp.end[1]], g, 0.06);
  {
    const nx = -(rp.end[1] - rp.top[1]), nz = rp.end[0] - rp.top[0];
    const nl = Math.hypot(nx, nz) || 1;
    for (const side of [-1, 1]) {
      const ox = (nx / nl) * 0.5 * side, oz = (nz / nl) * 0.5 * side;
      beamTo(rg, iceSolid, 0.08, [rp.top[0] + ox, rp.height + 0.11, rp.top[1] + oz], [rp.end[0] + ox, 0.12, rp.end[1] + oz], g, 0.16);
    }
  }
  for (let k = 0; k < 5; k++) {
    const u = (k + 0.5) / 5;
    const h = rp.height * ((k + 1) / 5);
    const st = box(rg, snowShade, 0.75, h, 0.32, rp.base[0] + (rp.top[0] - rp.base[0]) * u, h / 2, rp.base[1] + (rp.top[1] - rp.base[1]) * u);
    st.rotation.y = Math.atan2(rp.top[0] - rp.base[0], rp.top[1] - rp.base[1]);
  }
  // A little flag at the top.
  cyl(rg, woodDark, 0.015, 0.9, rp.top[0] - 0.35, rp.height + 0.45, rp.top[1] - 0.3);
  const flag = box(rg, m('#e84a4a', 0.7), 0.3, 0.18, 0.01, rp.top[0] - 0.2, rp.height + 0.8, rp.top[1] - 0.3);
  flag.rotation.y = 0.3;

  // The play slide: a ladder up to a platform, a chute of ice down.
  const sl = places.play.slide;
  const pg = place({ x: 0, z: 0, yaw: 0 });
  pg.position.set(0, floorY, 0);
  const ladYaw = Math.atan2(sl.top[0] - sl.base[0], sl.top[1] - sl.base[1]);
  for (const side of [-1, 1]) {
    const lx = Math.cos(ladYaw) * 0.25 * side, lz = -Math.sin(ladYaw) * 0.25 * side;
    beamTo(pg, iceSolid, 0.06, [sl.base[0] + lx, 0, sl.base[1] + lz], [sl.top[0] + lx, sl.height + 0.5, sl.top[1] + lz], g);
  }
  for (let k = 1; k < 5; k++) {
    const u = k / 5;
    const r = cyl(pg, iceSolid, 0.025, 0.5, sl.base[0] + (sl.top[0] - sl.base[0]) * u, sl.height * u, sl.base[1] + (sl.top[1] - sl.base[1]) * u, 0, Math.PI / 2);
    r.rotation.y = ladYaw;
    r.rotation.order = 'YXZ';
  }
  box(pg, iceSolid, 0.7, 0.08, 0.6, sl.top[0], sl.height, sl.top[1]);
  for (const sx of [-1, 1]) cyl(pg, iceSolid, 0.05, sl.height, sl.top[0] + sx * 0.3, sl.height / 2, sl.top[1] - 0.25);
  beamTo(pg, ice, 0.6, [sl.top[0], sl.height + 0.02, sl.top[1]], [sl.end[0], sl.endHeight, sl.end[1]], g, 0.06);
  cyl(pg, iceSolid, 0.05, sl.endHeight, sl.end[0], sl.endHeight / 2, sl.end[1]);

  // Ice lanterns on posts: a pillar of ice, a lantern with a warm light inside a block of clear ice.
  const lamps: PolarColonyProps['lamps'] = [];
  for (const [lx, lz] of lanterns) {
    const lg = place({ x: lx, z: lz, yaw: 0 });
    cyl(lg, iceSolid, 0.06, 1.25, 0, 0.62, 0, 0, 0, 0.08);
    ball(lg, snow, 0.16, 0, 0.04, 0, 1.4, 0.4, 1.4);
    const glow = m('#ffcf8a', 0.6, { emissive: new Color('#ffb04a'), emissiveIntensity: 0.3 });
    ball(lg, glow, 0.08, 0, 1.4, 0);
    box(lg, ice, 0.22, 0.26, 0.22, 0, 1.4, 0);
    box(lg, iceSolid, 0.26, 0.04, 0.26, 0, 1.55, 0);
    lamps.push({ mat: glow, x: lx, z: lz });
  }

  root.traverse((o) => {
    o.frustumCulled = false;
  });
  return {
    group: root,
    screen,
    fire: { x: camp.x, z: camp.z, flames, light },
    lamps,
    doors,
    rackBar,
    punch,
    floes,
    ball: theBall,
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      textures.forEach((x) => x.dispose());
      screen = null as unknown as MeshStandardMaterial;
    },
  };
}

/** A bar w wide and h thick from a to b (in the group's own space), its width kept level (turned, then tipped). */
function beamTo(parent: Group, mat: Material, w: number, a: [number, number, number], b: [number, number, number], keep: <T extends BufferGeometry>(geo: T) => T, h = w): Mesh {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const flat = Math.hypot(dx, dz);
  const mesh = new Mesh(keep(new BoxGeometry(w, h, Math.hypot(flat, dy))), mat);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(Math.atan2(-dy, flat), Math.atan2(dx, dz), 0);
  parent.add(mesh);
  return mesh;
}

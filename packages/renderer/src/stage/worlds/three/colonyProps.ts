import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { ColonyPlaces, Prop } from './layout';

/**
 * Everything the colony has set out in the grove, built from bamboo: beds and
 * mats to sleep on, chairs, a bench and a tea table, a desk with a laptop, a
 * board and a teacher's table, the gym (a barbell rack, a pull-up bar, a
 * punching log, dumbbells, a water jug), the campfire with its log seats, a
 * fence, an arch and lamp posts. Pure scenery: the pandas that use it live in
 * ColonyLayer, and the light it gives at night is the world's to animate.
 */

const WEAVES = ['#d9b36b', '#c7d08a', '#e0a07a', '#9fc2b0', '#d9c7a0'];
const BLANKETS = ['#c9503a', '#3f7fb5', '#e0b33a', '#8e5fb5', '#4f9f6a', '#d9788a'];

export interface ColonyProps {
  group: Group;
  /** The laptop's screen (it glows, more so at night). */
  screen: MeshStandardMaterial;
  fire: { x: number; z: number; flames: { mesh: Mesh; seed: number; base: number }[]; light: PointLight };
  lamps: { mat: MeshStandardMaterial; x: number; z: number }[];
  /** The barbell lying on the rack (hidden while someone lifts it), and the punching log's pivot (swung by a puncher). */
  rackBar: Group[];
  punch: { pivot: Group; x: number; z: number }[];
  dispose(): void;
}

export function buildColonyProps(places: ColonyPlaces, floorY: number): ColonyProps {
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
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
  const cane = m('#9bb85a', 0.45);
  const caneDark = m('#6f8f3a', 0.5);
  const dry = m('#c9a65f', 0.75);
  const dryDark = m('#a98544', 0.8);
  const stone = m('#8f9182', 0.95);
  const stoneDark = m('#6d7168', 0.9);
  const slate = m('#2b3a36', 0.9);
  const chalk = m('#f1efe6', 0.9);
  const rope = m('#c9a66b', 0.9);
  const pillow = m('#f3ead2', 0.85);
  const weave = WEAVES.map((c) => m(c, 0.9));
  const weaveDark = WEAVES.map((c) => m(new Color(c).multiplyScalar(0.8).getStyle(), 0.9));
  const blanket = BLANKETS.map((c) => m(c, 0.85));

  const root = new Group();
  const box = (parent: Group, mat: Material, w: number, h: number, d: number, x: number, y: number, z: number): Mesh => {
    const mesh = new Mesh(g(new BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const cyl = (parent: Group, mat: Material, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, r2 = r): Mesh => {
    const mesh = new Mesh(g(new CylinderGeometry(r, r2, h, 10)), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, 0, rz);
    parent.add(mesh);
    return mesh;
  };
  const ball = (parent: Group, mat: Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh => {
    const mesh = new Mesh(g(new SphereGeometry(r, 14, 10)), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  const place = (p: Prop): Group => {
    const grp = new Group();
    grp.position.set(p.x, floorY, p.z);
    grp.rotation.y = p.yaw;
    root.add(grp);
    return grp;
  };
  /** A pole between two points (in the group's own space). */
  const pole = (parent: Group, mat: Material, r: number, a: [number, number, number], b: [number, number, number]): Mesh => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const mesh = new Mesh(g(new CylinderGeometry(r, r * 1.05, len, 8)), mat);
    mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
    parent.add(mesh);
    return mesh;
  };
  /** A barbell lying along x, with a stone plate and a collar at each end. */
  const barbell = (parent: Group, y: number, z = 0): Group => {
    const bar = new Group();
    bar.position.set(0, y, z);
    parent.add(bar);
    cyl(bar, cane, 0.016, 1.15, 0, 0, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) for (const [dx, r] of [[0.45, 0.17], [0.5, 0.12]] as const) cyl(bar, stoneDark, r, 0.05, sx * dx, 0, 0, 0, Math.PI / 2);
    return bar;
  };

  let screen = m('#101820', 0.3, { emissive: new Color('#7fc8ff'), emissiveIntensity: 0.6 });
  const rackBar: Group[] = [];
  const punch: ColonyProps['punch'] = [];

  for (const p of places.props) {
    const grp = place(p);
    const tone = Math.round(p.tone ?? 0);
    switch (p.kind) {
      case 'bed': {
        // A raised bamboo bed: four short legs, rails and slats, a woven mattress, a pillow and half a blanket.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(grp, caneDark, 0.036, 0.2, sx * 0.68, 0.1, sz * 0.37);
        for (const sz of [-1, 1]) cyl(grp, cane, 0.03, 1.46, 0, 0.2, sz * 0.39, 0, Math.PI / 2);
        for (const sx of [-1, 1]) cyl(grp, cane, 0.03, 0.8, sx * 0.71, 0.2, 0, Math.PI / 2, 0);
        for (let i = 0; i < 9; i++) box(grp, i % 2 ? dry : dryDark, 0.1, 0.035, 0.78, -0.64 + i * 0.16, 0.22, 0);
        box(grp, weave[tone % weave.length], 1.32, 0.07, 0.72, 0, 0.275, 0);
        box(grp, weaveDark[tone % weave.length], 1.32, 0.072, 0.05, 0, 0.275, 0.2);
        ball(grp, pillow, 0.18, -0.46, 0.34, 0, 1, 0.38, 0.8);
        const cover = box(grp, blanket[tone % blanket.length], 0.66, 0.05, 0.74, 0.3, 0.325, 0);
        cover.rotation.z = 0.02;
        break;
      }
      case 'mat': {
        const i = tone % weave.length;
        box(grp, weave[i], 1.3, 0.022, 0.74, 0, 0.011, 0);
        for (const dx of [-0.46, -0.15, 0.15, 0.46]) box(grp, weaveDark[i], 0.07, 0.006, 0.7, dx, 0.024, 0);
        for (const sx of [-1, 1]) box(grp, weaveDark[i], 0.05, 0.028, 0.76, sx * 0.66, 0.012, 0);
        break;
      }
      case 'chair': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(grp, caneDark, 0.026, 0.2, sx * 0.22, 0.1, sz * 0.22);
        box(grp, dry, 0.52, 0.035, 0.52, 0, 0.2, 0);
        for (const sx of [-1, 1]) cyl(grp, cane, 0.026, 0.62, sx * 0.23, 0.4, -0.24);
        for (const y of [0.42, 0.56]) box(grp, dryDark, 0.5, 0.04, 0.03, 0, y, -0.24);
        for (const sx of [-1, 1]) cyl(grp, caneDark, 0.02, 0.4, sx * 0.26, 0.34, 0, Math.PI / 2, 0);
        break;
      }
      case 'bench': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(grp, caneDark, 0.03, 0.22, sx * 0.6, 0.11, sz * 0.14);
        for (let i = 0; i < 4; i++) cyl(grp, i % 2 ? cane : caneDark, 0.04, 1.5, 0, 0.235, -0.15 + i * 0.1, 0, Math.PI / 2);
        break;
      }
      case 'teatable': {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.4;
          pole(grp, caneDark, 0.03, [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4], [Math.cos(a) * 0.3, 0.42, Math.sin(a) * 0.3]);
        }
        cyl(grp, dry, 0.5, 0.04, 0, 0.44, 0);
        const pot = ball(grp, m('#35527a', 0.4), 0.1, 0, 0.56, 0, 1, 0.85, 1);
        void pot;
        cyl(grp, m('#35527a', 0.4), 0.018, 0.12, 0.12, 0.58, 0, 0, -0.9);
        for (const sx of [-0.28, 0.28]) cyl(grp, m('#f3ead2', 0.5), 0.04, 0.05, sx, 0.49, 0.16);
        break;
      }
      case 'desk': {
        // The sitter is on the local +z side; the laptop's screen faces it.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(grp, caneDark, 0.032, 0.6, sx * 0.58, 0.3, sz * 0.32);
        for (let i = 0; i < 7; i++) cyl(grp, i % 2 ? cane : caneDark, 0.05, 1.3, 0, 0.62, -0.33 + i * 0.11, 0, Math.PI / 2);
        const base = box(grp, m('#a9afb8', 0.35, { metalness: 0.4 }), 0.48, 0.022, 0.34, 0, 0.69, 0.12);
        void base;
        const lid = new Group();
        lid.position.set(0, 0.7, -0.04);
        lid.rotation.x = -0.28;
        grp.add(lid);
        box(lid, m('#8e949e', 0.4, { metalness: 0.4 }), 0.48, 0.32, 0.016, 0, 0.16, -0.01);
        screen = m('#101820', 0.3, { emissive: new Color('#7fc8ff'), emissiveIntensity: 0.6 });
        box(lid, screen, 0.43, 0.27, 0.006, 0, 0.16, 0.0);
        cyl(grp, m('#e8e3d4', 0.5), 0.04, 0.09, 0.5, 0.74, 0.1);
        cyl(grp, m('#d4553f', 0.5), 0.03, 0.05, -0.5, 0.72, 0.0);
        // A little potted bamboo, and a lamp.
        cyl(grp, m('#c4793f', 0.7), 0.05, 0.08, -0.52, 0.74, -0.2);
        for (const dx of [-0.02, 0.02]) cyl(grp, cane, 0.01, 0.3, -0.52 + dx, 0.93, -0.2);
        break;
      }
      case 'board': {
        for (const sx of [-1, 1]) {
          cyl(grp, cane, 0.06, 2.3, sx * 1.25, 1.15, 0);
          for (const sz of [-1, 1]) pole(grp, caneDark, 0.04, [sx * 1.25, 0, 0], [sx * 1.25, 0.1, sz * 0.5]);
        }
        cyl(grp, caneDark, 0.045, 2.7, 0, 2.2, 0, 0, Math.PI / 2);
        box(grp, slate, 2.3, 1.15, 0.05, 0, 1.45, 0);
        for (const dy of [-0.6, 0.6]) box(grp, dry, 2.4, 0.06, 0.07, 0, 1.45 + dy, 0.01);
        for (const dx of [-1.17, 1.17]) box(grp, dry, 0.06, 1.2, 0.07, dx, 1.45, 0.01);
        // Chalk: a bar chart, getting taller, with an arrow, and a few lines of writing.
        [0.14, 0.24, 0.36, 0.5, 0.64].forEach((h, i) => box(grp, chalk, 0.13, h, 0.01, -0.82 + i * 0.2, 0.92 + h / 2, 0.03));
        box(grp, chalk, 1.0, 0.014, 0.01, -0.4, 0.9, 0.03);
        box(grp, chalk, 0.012, 0.8, 0.01, -0.9, 1.3, 0.03);
        for (let l = 0; l < 4; l++) box(grp, chalk, 0.5 - l * 0.06, 0.016, 0.01, 0.62, 1.78 - l * 0.13, 0.03);
        box(grp, chalk, 0.5, 0.012, 0.01, 0.62, 1.1, 0.03).rotation.z = 0.12;
        box(grp, dry, 2.3, 0.04, 0.12, 0, 0.84, 0.07);
        box(grp, chalk, 0.08, 0.02, 0.02, 0.5, 0.87, 0.07);
        break;
      }
      case 'lectern': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(grp, caneDark, 0.03, 0.72, sx * 0.34, 0.36, sz * 0.2);
        box(grp, dry, 0.86, 0.04, 0.52, 0, 0.74, 0);
        [['#2f6db5', 0.06], ['#e0a43a', 0.05], ['#8a4fb0', 0.05]].forEach(([c, h], i) => box(grp, m(c as string, 0.6), 0.3 - i * 0.03, h as number, 0.22, -0.2, 0.77 + i * 0.05, 0.02 * i));
        cyl(grp, m('#d9a53a', 0.35, { metalness: 0.6 }), 0.05, 0.07, 0.25, 0.795, 0, 0, 0, 0.02);
        break;
      }
      case 'log': {
        cyl(grp, cane, 0.16, 1.3, 0, 0.17, 0, 0, Math.PI / 2);
        for (const dx of [-0.3, 0.3]) cyl(grp, caneDark, 0.17, 0.035, dx, 0.17, 0, 0, Math.PI / 2);
        for (const sx of [-1, 1]) cyl(grp, m('#d8c88a', 0.8), 0.14, 0.01, sx * 0.65, 0.17, 0, 0, Math.PI / 2);
        break;
      }
      case 'rack': {
        for (const sx of [-1, 1]) {
          const x = sx * 0.58;
          cyl(grp, cane, 0.045, 1.2, x, 0.6, 0);
          cyl(grp, caneDark, 0.04, 0.7, x, 0.03, 0, Math.PI / 2, 0);
          box(grp, dryDark, 0.08, 0.04, 0.16, x * 0.97, 1.02, 0.07);
        }
        rackBar.push(barbell(grp, 1.07, 0.06));
        // A spare plate or two stacked on a spike.
        cyl(grp, caneDark, 0.02, 0.4, 1.0, 0.2, 0.2);
        for (let i = 0; i < 3; i++) cyl(grp, stoneDark, 0.14 - i * 0.015, 0.05, 1.0, 0.04 + i * 0.055, 0.2);
        break;
      }
      case 'pullup': {
        for (const sx of [-1, 1]) {
          cyl(grp, cane, 0.05, 1.7, sx * 0.9, 0.85, 0);
          for (const sz of [-1, 1]) pole(grp, caneDark, 0.035, [sx * 0.9, 0.05, sz * 0.5], [sx * 0.9, 0.9, 0]);
        }
        cyl(grp, caneDark, 0.032, 1.9, 0, 1.55, 0, 0, Math.PI / 2);
        for (const dx of [-0.25, 0.25]) cyl(grp, rope, 0.036, 0.12, dx, 1.55, 0, 0, Math.PI / 2);
        break;
      }
      case 'punch': {
        // Two posts and a beam, and a thick log hung from it by ropes and wrapped in straw rope (swung by a puncher).
        for (const sx of [-1, 1]) {
          cyl(grp, cane, 0.05, 2.1, sx * 0.62, 1.05, 0);
          for (const sz of [-1, 1]) pole(grp, caneDark, 0.035, [sx * 0.62, 0.05, sz * 0.5], [sx * 0.62, 1.0, 0]);
        }
        cyl(grp, caneDark, 0.04, 1.4, 0, 2.08, 0, 0, Math.PI / 2);
        const pivot = new Group();
        pivot.position.set(0, 2.05, 0);
        grp.add(pivot);
        for (const dx of [-0.1, 0.1]) cyl(grp, rope, 0.012, 0.4, dx, 1.88, 0);
        cyl(pivot, caneDark, 0.17, 1.15, 0, -1.05, 0);
        for (const y of [-0.7, -0.95, -1.2, -1.45]) {
          const band = new Mesh(g(new TorusGeometry(0.17, 0.022, 6, 14)), rope);
          band.rotation.x = Math.PI / 2;
          band.position.y = y;
          pivot.add(band);
        }
        punch.push({ pivot, x: p.x, z: p.z });
        break;
      }
      case 'dumbbells': {
        for (const [dz, rot] of [[-0.12, 0], [0.16, 0.2]] as const) {
          const d = new Group();
          d.position.set(0, 0.07, dz);
          d.rotation.y = rot;
          grp.add(d);
          cyl(d, cane, 0.016, 0.34, 0, 0, 0, 0, Math.PI / 2);
          for (const sx of [-1, 1]) ball(d, stoneDark, 0.075, sx * 0.17, 0, 0);
        }
        // A kettle-stone with a bamboo handle.
        ball(grp, stone, 0.1, 0.5, 0.1, 0.05);
        const handle = new Mesh(g(new TorusGeometry(0.06, 0.012, 6, 14)), caneDark);
        handle.position.set(0.5, 0.22, 0.05);
        grp.add(handle);
        break;
      }
      case 'jug': {
        cyl(grp, cane, 0.12, 0.36, 0, 0.18, 0, 0, 0, 0.14);
        cyl(grp, caneDark, 0.055, 0.06, 0, 0.39, 0);
        for (const y of [0.1, 0.27]) cyl(grp, caneDark, 0.133, 0.02, 0, y, 0);
        box(grp, m('#e8e3d4', 0.9), 0.3, 0.05, 0.2, 0.3, 0.025, 0.1);
        break;
      }
      case 'fence': {
        const len = p.tone ?? 7;
        const n = Math.round(len / 0.55);
        for (let i = 0; i <= n; i++) {
          const x = -len / 2 + (i / n) * len;
          cyl(grp, i % 2 ? cane : caneDark, 0.05, 1.0 + 0.18 * Math.sin(i * 2.3), x, 0.5, 0);
        }
        for (const y of [0.35, 0.72]) cyl(grp, dry, 0.03, len + 0.3, 0, y, 0.05, 0, Math.PI / 2);
        break;
      }
      case 'arch': {
        for (const sx of [-1, 1]) cyl(grp, cane, 0.07, 2.5, sx * 1.35, 1.25, 0);
        cyl(grp, caneDark, 0.06, 3.0, 0, 2.5, 0, 0, Math.PI / 2);
        const curve = new Mesh(g(new TorusGeometry(1.35, 0.035, 6, 20, Math.PI)), caneDark);
        curve.scale.set(1, 0.32, 1);
        curve.position.set(0, 2.5, 0);
        grp.add(curve);
        // A little sign hung from the beam.
        for (const dx of [-0.3, 0.3]) cyl(grp, rope, 0.008, 0.25, dx, 2.37, 0.02);
        box(grp, dry, 0.8, 0.2, 0.03, 0, 2.2, 0.02);
        for (const dx of [-0.2, 0, 0.2]) box(grp, caneDark, 0.1, 0.03, 0.035, dx, 2.2 + (dx === 0 ? 0.04 : 0), 0.02);
        break;
      }
    }
  }

  // The campfire: a ring of stones, charred logs leaning together, flames (animated by the world), a kettle on a tripod.
  const fire = new Group();
  fire.position.set(places.camp.x, floorY, places.camp.z);
  root.add(fire);
  cyl(fire, m('#2a2623', 1), 0.78, 0.02, 0, 0.01, 0);
  const stoneGeo = g(new DodecahedronGeometry(1, 0));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = new Mesh(stoneGeo, i % 2 ? stone : stoneDark);
    s.position.set(Math.cos(a) * 0.82, 0.07, Math.sin(a) * 0.82);
    s.scale.set(0.17 + 0.04 * Math.sin(i * 3.1), 0.12 + 0.03 * Math.sin(i * 1.7), 0.17 + 0.03 * Math.cos(i * 2.3));
    s.rotation.set(i, i * 2, 0);
    fire.add(s);
  }
  const char = m('#2d2118', 0.95, { emissive: new Color('#ff5a1a'), emissiveIntensity: 0.25 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    pole(fire, char, 0.06, [Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55], [Math.cos(a) * 0.05, 0.62, Math.sin(a) * 0.05]);
  }
  const flames: ColonyProps['fire']['flames'] = [];
  const flameMat = (color: string, opacity: number) => {
    const mat = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
    mats.push(mat);
    return mat;
  };
  const flameGeo = g(new ConeGeometry(1, 1, 10, 1, true));
  flameGeo.translate(0, 0.5, 0);
  [['#ff7a1e', 0.62, 0.33, 0.95, 0], ['#ffb02e', 0.75, 0.24, 0.72, 1.7], ['#ffe27a', 0.85, 0.14, 0.5, 3.1], ['#ff5a1a', 0.5, 0.2, 0.7, 4.4]].forEach(([color, opacity, r, h, seed], i) => {
    const mesh = new Mesh(flameGeo, flameMat(color as string, opacity as number));
    mesh.position.set(i === 3 ? 0.14 : i === 1 ? -0.08 : 0, 0.12, i === 3 ? -0.1 : 0.05 * (i - 1));
    mesh.scale.set(r as number, h as number, r as number);
    mesh.renderOrder = 6;
    fire.add(mesh);
    flames.push({ mesh, seed: seed as number, base: h as number });
  });
  // The tripod and the kettle over the fire.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 1.0;
    pole(fire, caneDark, 0.03, [Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05], [0, 1.55, 0]);
  }
  cyl(fire, rope, 0.008, 0.45, 0, 1.3, 0);
  const kettle = ball(fire, m('#3b3f45', 0.4, { metalness: 0.5 }), 0.16, 0, 0.98, 0, 1, 0.8, 1);
  kettle.position.y = 1.0;
  const light = new PointLight('#ff8a3a', 0, 14, 1.5);
  light.position.set(0, 0.8, 0);
  fire.add(light);

  // Lamp posts at the places: a bamboo post with a paper lantern (the world lights them at night).
  const lamps: ColonyProps['lamps'] = [];
  for (const [x, z] of places.posts) {
    const post = new Group();
    post.position.set(x, floorY, z);
    root.add(post);
    cyl(post, cane, 0.05, 2.2, 0, 1.1, 0);
    cyl(post, caneDark, 0.03, 0.5, 0, 2.15, 0.22, Math.PI / 2, 0);
    const paper = m('#d9852a', 0.8, { emissive: new Color('#ff9a3a'), emissiveIntensity: 0.12 });
    const hang = new Group();
    hang.position.set(0, 2.1, 0.44);
    post.add(hang);
    const shade = ball(hang, paper, 0.19, 0, -0.3, 0, 1, 1.25, 1);
    void shade;
    for (const y of [-0.08, -0.55]) cyl(hang, caneDark, 0.09, 0.05, 0, y, 0);
    cyl(hang, caneDark, 0.008, 0.12, 0, 0.0, 0);
    lamps.push({ mat: paper, x, z: z + 0.44 });
  }

  root.traverse((o) => {
    o.frustumCulled = false;
  });
  return {
    group: root,
    screen,
    fire: { x: places.camp.x, z: places.camp.z, flames, light },
    lamps,
    rackBar,
    punch,
    dispose() {
      geos.forEach((geo) => geo.dispose());
      mats.forEach((mat) => mat.dispose());
    },
  };
}

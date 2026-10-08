import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterialParameters,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../three/glsl';
import { SCHOOL_ANGLE, clampTo, type Island, type Kingdom, type V3 } from '../kingdom';
import { COURSE, PLAY_SLIDE, local } from '../warren';

/**
 * The kingdom's furniture: round cloud cottages, the little castle and its
 * clock tower, market stalls, fountains, benches, lanterns and flags; the
 * carrot rows, the giant flowers, the playground, the academy's hurdles
 * and ramps, the beds, the lookout's telescope. Built once from the layout;
 * the scene animates the few things that move (flags, clock hands, lamp
 * glow, the swaying grass and flowers, balloons).
 */

const GEO = {
  sphere: new SphereGeometry(1, 20, 14),
  small: new SphereGeometry(1, 10, 8),
  cyl: new CylinderGeometry(1, 1, 1, 20),
  cyl8: new CylinderGeometry(1, 1, 1, 8),
  cone: new ConeGeometry(1, 1, 20),
  box: new BoxGeometry(1, 1, 1),
  torus: new TorusGeometry(1, 0.12, 8, 28),
  flag: new PlaneGeometry(1, 0.62, 10, 2).translate(0.5, 0, 0),
  blade: new ConeGeometry(0.05, 1, 4).translate(0, 0.5, 0),
  petal: new SphereGeometry(1, 8, 6),
};

const C = {
  cream: '#fff4e6', pink: '#ffd9e4', mint: '#d4f3e4', lilac: '#e6dcfb', peach: '#ffe0c8', sky: '#d8ecff',
  roofPink: '#ff97b7', roofBlue: '#87b2ff', roofLilac: '#b497f0', roofPeach: '#ffad80', roofMint: '#6fd3b2',
  wood: '#d3a679', woodDark: '#a8774f', stone: '#efeaf6', stoneDark: '#c9c0dc', gold: '#ffcf5a',
  soil: '#b98b68', water: '#8fdcff', carrot: '#ff8a2b', leaf: '#5cc466', white: '#ffffff', ink: '#4a4370',
};

export interface KingdomProps {
  group: Group;
  /** Lamps that glow at night (positions of the flame), and their glowing material. */
  lamps: V3[];
  lampMat: MeshStandardMaterial;
  windowMat: MeshStandardMaterial;
  /** Materials whose shader reads uTime (flags, swaying plants). */
  timed: { uniforms: { uTime: { value: number } } }[];
  clock: { hour: Object3D; minute: Object3D }[];
  fountains: V3[];
  balloons: { obj: Object3D; base: V3; seed: number }[];
  basket: Group;
  /** Trampolines (their pads squash when bounced on). */
  pads: { obj: Object3D; x: number; z: number }[];
  /** The village campfire: its flames (they flicker) and where it burns. */
  fire: { flames: Object3D[]; pos: V3 };
  materials: Material[];
  geometries: BufferGeometry[];
}

export function buildProps(k: Kingdom): KingdomProps {
  const group = new Group();
  const materials: Material[] = [];
  const geometries: BufferGeometry[] = [];
  const matCache = new Map<string, MeshStandardMaterial>();
  const mat = (color: string, rough = 0.75, extra: MeshStandardMaterialParameters = {}) => {
    const key = color + rough + JSON.stringify(Object.keys(extra));
    let m = matCache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: rough, ...extra });
      matCache.set(key, m);
      materials.push(m);
    }
    return m;
  };
  const lampMat = new MeshStandardMaterial({ color: '#ffe6a8', emissive: '#ffb84d', emissiveIntensity: 0.3, roughness: 0.4 });
  const windowMat = new MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffbf5e', emissiveIntensity: 0.05, roughness: 0.5 });
  materials.push(lampMat, windowMat);
  const timed: KingdomProps['timed'] = [];

  const add = (geo: BufferGeometry, m: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, parent: Object3D = group, ry = 0, rx = 0, rz = 0) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  };
  const at = (x: number, y: number, z: number, yaw = 0) => {
    const g = new Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    group.add(g);
    return g;
  };
  const face = (i: Island, x: number, z: number) => Math.atan2(i.x - x, i.z - z);
  const onIsland = (i: Island, u: number, v: number): [number, number] => [i.x + u * i.rx, i.z + v * i.rz];

  // Flags: a cloth that ripples in the wind (a sine along its length, bigger at the free end).
  const flagMat = (color: string) => {
    const m = new MeshStandardMaterial({ color, roughness: 0.7, side: DoubleSide });
    const uniforms = { uTime: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float fx = position.x;
        transformed.z += sin(uTime * 3.2 - fx * 5.0 + position.y * 2.0) * 0.12 * fx;
        transformed.y -= fx * fx * 0.05;`,
      );
    };
    m.customProgramCacheKey = () => 'rabbit-flag';
    materials.push(m);
    timed.push({ uniforms });
    return m;
  };
  const flagMats = ['#ff8fb1', '#87b2ff', '#ffd166', '#7fdcb6', '#b497f0'].map(flagMat);
  const flag = (x: number, y: number, z: number, h: number, ci: number, yaw = 0) => {
    const g = at(x, y, z, yaw);
    add(GEO.cyl8, mat(C.white, 0.4), 0, h / 2, 0, 0.035, h, 0.035, g);
    add(GEO.small, mat(C.gold, 0.3, { metalness: 0.4 }), 0, h + 0.05, 0, 0.07, 0.07, 0.07, g);
    add(GEO.flag, flagMats[ci % flagMats.length], 0.03, h - 0.3, 0, 0.8, 0.8, 1, g).userData.keep = true;
  };

  const lamps: V3[] = [];
  const lantern = (x: number, y: number, z: number, h = 1.5) => {
    const g = at(x, y, z);
    add(GEO.cyl8, mat(C.woodDark, 0.6), 0, h / 2, 0, 0.05, h, 0.05, g);
    add(GEO.box, mat(C.woodDark, 0.6), 0.14, h, 0, 0.3, 0.04, 0.04, g);
    add(GEO.cyl8, mat(C.gold, 0.35, { metalness: 0.5 }), 0.27, h - 0.08, 0, 0.11, 0.05, 0.11, g);
    add(GEO.sphere, lampMat, 0.27, h - 0.24, 0, 0.12, 0.15, 0.12, g);
    add(GEO.cone, mat(C.roofPink, 0.6), 0.27, h - 0.02, 0, 0.13, 0.12, 0.13, g);
    lamps.push([x + 0.27, y + h - 0.24, z]);
  };

  const cottage = (i: Island, u: number, v: number, wall: string, roof: string, s = 1, carrot = false) => {
    const [x, z] = onIsland(i, u, v);
    const g = at(x, i.y, z, face(i, x, z));
    g.scale.setScalar(s);
    if (carrot) {
      // A carrot-shaped house: an orange cone point-down, leafy top.
      add(GEO.cone, mat(C.carrot, 0.7), 0, 1.15, 0, 0.95, 2.3, 0.95, g, 0, Math.PI);
      for (let j = 0; j < 5; j++) add(GEO.cone, mat(C.leaf, 0.7), Math.cos(j * 1.3) * 0.25, 2.65, Math.sin(j * 1.3) * 0.25, 0.18, 0.9, 0.18, g, 0, Math.cos(j * 1.3) * 0.4, Math.sin(j * 1.3) * 0.4);
      add(GEO.cyl, mat(C.wood, 0.7), 0, 0.45, 0.62, 0.22, 0.75, 0.05, g, 0, Math.PI / 2 - 0.25);
      add(GEO.sphere, windowMat, 0, 1.5, 0.62, 0.13, 0.13, 0.05, g);
      return;
    }
    add(GEO.cyl, mat(wall, 0.85), 0, 0.75, 0, 1.0, 1.5, 1.0, g);
    add(GEO.torus, mat(C.white, 0.9), 0, 0.08, 0, 1.0, 1.0, 1.3, g, 0, Math.PI / 2);
    add(GEO.cone, mat(roof, 0.6), 0, 1.95, 0, 1.25, 1.1, 1.25, g);
    add(GEO.small, mat(roof, 0.6), 0, 2.55, 0, 0.12, 0.12, 0.12, g);
    // Door (round-topped), windows, step, chimney with a little cloud puff.
    add(GEO.box, mat(C.woodDark, 0.6), 0, 0.42, 0.97, 0.42, 0.8, 0.08, g);
    add(GEO.cyl, mat(C.woodDark, 0.6), 0, 0.82, 0.97, 0.21, 0.08, 0.21, g, 0, Math.PI / 2);
    add(GEO.small, mat(C.gold, 0.3, { metalness: 0.5 }), 0.12, 0.42, 1.03, 0.03, 0.03, 0.03, g);
    add(GEO.cyl, windowMat, -0.55, 0.95, 0.8, 0.17, 0.06, 0.17, g, -0.6, Math.PI / 2);
    add(GEO.cyl, windowMat, 0.55, 0.95, 0.8, 0.17, 0.06, 0.17, g, 0.6, Math.PI / 2);
    add(GEO.cyl, windowMat, 0, 1.05, -0.98, 0.17, 0.06, 0.17, g, 0, Math.PI / 2);
    add(GEO.cyl, mat(C.stone, 0.8), 0, 0.03, 1.15, 0.35, 0.06, 0.25, g);
    add(GEO.box, mat(C.stoneDark, 0.8), 0.55, 2.2, -0.3, 0.22, 0.6, 0.22, g);
    // Window boxes with flowers.
    add(GEO.box, mat(C.wood, 0.8), -0.55, 0.78, 0.88, 0.32, 0.08, 0.1, g, -0.6);
    add(GEO.small, mat('#ff8fb1', 0.6), -0.6, 0.85, 0.92, 0.07, 0.07, 0.07, g);
    add(GEO.small, mat('#ffd34d', 0.6), -0.48, 0.85, 0.96, 0.06, 0.06, 0.06, g);
  };

  const bench = (x: number, y: number, z: number, yaw: number, color = C.wood) => {
    const g = at(x, y, z, yaw);
    add(GEO.box, mat(color, 0.7), 0, 0.32, 0, 1.2, 0.07, 0.38, g);
    add(GEO.box, mat(color, 0.7), 0, 0.6, -0.18, 1.2, 0.3, 0.05, g);
    for (const sx of [-0.5, 0.5]) add(GEO.box, mat(C.woodDark, 0.7), sx, 0.16, 0, 0.07, 0.32, 0.34, g);
  };

  const fountains: V3[] = [];
  const fountain = (x: number, y: number, z: number, s = 1) => {
    const g = at(x, y, z);
    g.scale.setScalar(s);
    add(GEO.cyl, mat(C.stone, 0.6), 0, 0.22, 0, 1.25, 0.44, 1.25, g);
    add(GEO.cyl, mat(C.water, 0.1, { transparent: true, opacity: 0.85, emissive: '#5fc6ff', emissiveIntensity: 0.15 }), 0, 0.43, 0, 1.1, 0.04, 1.1, g);
    add(GEO.cyl, mat(C.stone, 0.6), 0, 0.8, 0, 0.18, 1.0, 0.18, g);
    add(GEO.cyl, mat(C.stone, 0.6), 0, 1.25, 0, 0.6, 0.12, 0.6, g);
    add(GEO.cyl, mat(C.water, 0.1, { transparent: true, opacity: 0.85, emissive: '#5fc6ff', emissiveIntensity: 0.15 }), 0, 1.32, 0, 0.5, 0.03, 0.5, g);
    // A little carrot statue on top.
    add(GEO.cone, mat(C.carrot, 0.5), 0, 1.6, 0, 0.12, 0.5, 0.12, g, 0, Math.PI);
    add(GEO.cone, mat(C.leaf, 0.5), 0, 1.92, 0, 0.08, 0.2, 0.08, g);
    fountains.push([x, y + 1.75 * s, z]);
  };

  const stall = (x: number, y: number, z: number, yaw: number, stripe: string, goods: string) => {
    const g = at(x, y, z, yaw);
    add(GEO.box, mat(C.wood, 0.7), 0, 0.45, 0, 1.5, 0.9, 0.6, g);
    add(GEO.box, mat(C.cream, 0.8), 0, 0.92, 0, 1.55, 0.06, 0.65, g);
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.25, 0.25]) add(GEO.cyl8, mat(C.white, 0.6), sx, 1.25, sz, 0.035, 1.3, 0.035, g);
    // A striped awning.
    for (let j = 0; j < 6; j++) add(GEO.box, mat(j % 2 ? C.white : stripe, 0.7), -0.65 + j * 0.26, 1.95, 0.05, 0.26, 0.06, 0.95, g, 0, -0.25);
    for (let j = 0; j < 6; j++) add(GEO.sphere, mat(j % 2 ? C.white : stripe, 0.7), -0.65 + j * 0.26, 1.82, 0.52, 0.13, 0.1, 0.06, g);
    for (let j = 0; j < 5; j++) add(GEO.sphere, mat(goods, 0.5), -0.5 + j * 0.25, 1.0, 0.1 + (j % 2) * 0.12, 0.09, 0.09, 0.09, g);
  };

  // Plaza: a paved stage in the middle (kept clear), a ring path, lanterns round it, flags and reading corners at the rim.
  const P = k.islands.plaza;
  {
    const pave = add(GEO.cyl, mat('#f3ecfb', 0.9), P.x, P.y - 0.031, P.z, k.clearX + 1.2, 0.06, k.clearZ + 1.2);
    pave.renderOrder = -1;
    const ring = add(GEO.torus, mat('#e4d6f7', 0.85), P.x, P.y - 0.115, P.z, (k.clearX + 2.4), (k.clearZ + 2.4), 4, undefined, 0, Math.PI / 2);
    ring.scale.set(k.clearX + 2.6, k.clearZ + 2.6, 1);
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2 + Math.PI / 12;
      const x = P.x + Math.cos(a) * (k.clearX + 4.1), z = P.z + Math.sin(a) * (k.clearZ + 3.9);
      if (Math.hypot((x - P.x) / P.rx, (z - P.z) / P.rz) > 0.9) continue;
      lantern(x, P.y, z, 1.6);
    }
    for (let j = 0; j < 8; j++) {
      const a = Math.PI + (j / 7) * Math.PI;
      // Not in front of the school corner or the music corner.
      if (Math.abs(a - SCHOOL_ANGLE) < 0.3 || Math.abs(a - Math.PI * 1.75) < 0.2) continue;
      const x = P.x + Math.cos(a) * P.rx * 0.93, z = P.z + Math.sin(a) * P.rz * 0.93;
      flag(x, P.y, z, 2.6, j);
    }
    // Reading corners: a bench and a stack of books.
    for (const s of k.spots.filter((s) => s.act === 'read')) {
      const [bx, bz] = local(s, 0, -0.45);
      bench(bx, P.y, bz, s.face);
      const [sx, sz] = local(s, 0.9, -0.2);
      for (let j = 0; j < 4; j++) add(GEO.box, mat(['#6f8cff', '#ff8fb1', '#7fdcb6', '#ffd166'][j], 0.6), sx, P.y + 0.06 + j * 0.1, sz, 0.38, 0.09, 0.28, group, j * 0.4);
    }
    // The school corner: a chalkboard, the teacher's lectern with a globe, three little desks with cushions, a bookshelf.
    const { board, teach, desks } = k.school;
    const g = at(board.x, P.y, board.z, board.face);
    add(GEO.box, mat('#3e5a4c', 0.9), 0, 1.3, 0, 2.2, 1.1, 0.08, g);
    add(GEO.box, mat(C.wood, 0.7), 0, 1.3, -0.03, 2.4, 1.3, 0.06, g);
    for (const sx of [-0.9, 0.9]) add(GEO.cyl8, mat(C.woodDark, 0.7), sx, 0.4, 0, 0.05, 0.8, 0.05, g);
    for (let j = 0; j < 4; j++) add(GEO.box, mat('#f4f4ea', 0.9), -0.5 + j * 0.34, 1.4 + (j % 2) * 0.1, 0.05, 0.22, 0.22, 0.01, g, 0, 0, 0.2 * j);
    // A little bar chart in chalk (it is a school about structures, after all).
    for (let j = 0; j < 5; j++) add(GEO.box, mat('#f4f4ea', 0.9), 0.35 + j * 0.13, 1.0 + ((j * 37) % 5) * 0.03, 0.05, 0.08, 0.12 + ((j * 37) % 5) * 0.06, 0.01, g);
    add(GEO.box, mat(C.wood, 0.7), 0, 0.72, 0.08, 2.0, 0.04, 0.12, g);
    for (let j = 0; j < 3; j++) add(GEO.box, mat(['#ffffff', '#ffd166', '#ff8fb1'][j], 0.8), -0.6 + j * 0.15, 0.755, 0.08, 0.1, 0.025, 0.025, g);
    {
      const [lx, lz] = local(teach, -1.0, -0.15);
      const lec = at(lx, P.y, lz, teach.face);
      add(GEO.box, mat(C.wood, 0.7), 0, 0.42, 0, 0.5, 0.84, 0.36, lec);
      add(GEO.box, mat(C.woodDark, 0.7), 0, 0.86, -0.02, 0.58, 0.05, 0.44, lec, 0, -0.25);
      add(GEO.box, mat('#6f8cff', 0.6), -0.08, 0.92, 0, 0.26, 0.05, 0.18, lec, 0.2);
      add(GEO.cyl8, mat(C.gold, 0.35, { metalness: 0.5 }), 0.17, 0.98, 0, 0.02, 0.18, 0.02, lec);
      add(GEO.sphere, mat('#87b2ff', 0.5), 0.17, 1.15, 0, 0.11, 0.11, 0.11, lec);
      add(GEO.sphere, mat('#7fd38a', 0.6), 0.2, 1.18, 0.04, 0.06, 0.05, 0.06, lec);
    }
    desks.forEach((d, j) => {
      const [dx, dz] = local(d, 0, 0.5);
      const desk = at(dx, P.y, dz, d.face);
      add(GEO.box, mat(['#ffd9a8', '#d8ecff', '#ffd9e4'][j % 3], 0.7), 0, 0.36, 0, 0.72, 0.05, 0.38, desk, 0, -0.12);
      for (const [sx, sz] of [[-0.3, -0.14], [0.3, -0.14], [-0.3, 0.14], [0.3, 0.14]] as const) add(GEO.cyl8, mat(C.woodDark, 0.7), sx, 0.17, sz, 0.025, 0.34, 0.025, desk);
      add(GEO.cyl8, mat(['#ff8fb1', '#87b2ff', '#ffd166'][j % 3], 0.6), 0.25, 0.42, 0.05, 0.04, 0.08, 0.04, desk);
      add(GEO.sphere, mat(['#ffb3c8', '#b8e2ff', '#fff1a8'][j % 3], 0.95), d.x, P.y + 0.06, d.z, 0.36, 0.1, 0.32);
    });
    {
      const [sx, sz] = local(board, 1.75, 0.15);
      const shelf = at(sx, P.y, sz, board.face);
      add(GEO.box, mat(C.wood, 0.7), 0, 0.6, 0, 0.8, 1.2, 0.3, shelf);
      for (let r = 0; r < 3; r++) {
        add(GEO.box, mat(C.woodDark, 0.7), 0, 0.2 + r * 0.38, 0.02, 0.74, 0.03, 0.28, shelf);
        for (let j = 0; j < 5; j++) add(GEO.box, mat(['#6f8cff', '#ff8fb1', '#7fdcb6', '#ffd166', '#b497f0'][(j + r) % 5], 0.6), -0.28 + j * 0.13, 0.33 + r * 0.38, 0.04, 0.09, 0.22 + ((j + r) % 3) * 0.03, 0.2, shelf);
      }
    }
  }

  // Kingdom island: the castle at the back, the clock tower, market stalls, the fountain square.
  const K = k.islands.castle;
  const clock: KingdomProps['clock'] = [];
  {
    const g = at(K.x, K.y, K.z - K.rz * 0.38);
    const wall = mat('#fbefff', 0.75), roof = mat(C.roofLilac, 0.55), roof2 = mat(C.roofPink, 0.55);
    add(GEO.box, wall, 0, 1.6, 0, 3.4, 3.2, 2.4, g);
    for (let j = 0; j < 7; j++) add(GEO.box, wall, -1.5 + j * 0.5, 3.35, 1.15, 0.28, 0.3, 0.2, g);
    add(GEO.cone, roof, 0, 4.1, 0, 1.6, 1.8, 1.4, g);
    for (const [sx, sz, h] of [[-2.1, 1.3, 4.2], [2.1, 1.3, 4.2], [-2.1, -1.3, 5], [2.1, -1.3, 5]] as const) {
      add(GEO.cyl, wall, sx, h / 2, sz, 0.75, h, 0.75, g);
      add(GEO.cone, sz > 0 ? roof2 : roof, sx, h + 0.75, sz, 0.95, 1.5, 0.95, g);
      add(GEO.cyl, windowMat, sx, h * 0.7, sz + 0.72, 0.16, 0.05, 0.16, g, 0, Math.PI / 2);
      const fx = K.x + sx, fz = K.z - K.rz * 0.38 + sz;
      flag(fx, K.y + h + 1.45, fz, 0.9, Math.abs(Math.round(sx + sz * 3)));
    }
    // The gate.
    add(GEO.box, mat(C.woodDark, 0.6), 0, 0.75, 1.22, 1.0, 1.5, 0.08, g);
    add(GEO.cyl, mat(C.woodDark, 0.6), 0, 1.5, 1.22, 0.5, 0.08, 0.5, g, 0, Math.PI / 2);
    for (const sx of [-1, 1]) add(GEO.cyl, windowMat, sx * 1.0, 2.3, 1.22, 0.22, 0.05, 0.22, g, 0, Math.PI / 2);
    // A heart crest over the gate.
    add(GEO.sphere, mat('#ff6f8f', 0.4), -0.09, 2.85, 1.24, 0.12, 0.12, 0.05, g);
    add(GEO.sphere, mat('#ff6f8f', 0.4), 0.09, 2.85, 1.24, 0.12, 0.12, 0.05, g);
    add(GEO.cone, mat('#ff6f8f', 0.4), 0, 2.72, 1.24, 0.17, 0.2, 0.05, g, 0, Math.PI);
  }
  {
    // The clock tower, at the side of the square: its hands keep the kingdom's time.
    const [x, z] = onIsland(K, -0.68, -0.15);
    const g = at(x, K.y, z, face(K, x, z));
    const wall = mat('#fff6ea', 0.7);
    add(GEO.box, wall, 0, 2.4, 0, 1.3, 4.8, 1.3, g);
    add(GEO.box, mat(C.roofBlue, 0.55), 0, 4.95, 0, 1.5, 0.3, 1.5, g);
    add(GEO.cone, mat(C.roofBlue, 0.55), 0, 5.8, 0, 1.05, 1.5, 1.05, g, Math.PI / 4);
    add(GEO.small, mat(C.gold, 0.3, { metalness: 0.5 }), 0, 6.65, 0, 0.12, 0.12, 0.12, g);
    add(GEO.cyl, mat(C.white, 0.5), 0, 4.0, 0.66, 0.5, 0.05, 0.5, g, 0, Math.PI / 2);
    add(GEO.torus, mat(C.gold, 0.35, { metalness: 0.5 }), 0, 4.0, 0.69, 0.5, 0.5, 0.5, g);
    const hour = new Group();
    hour.position.set(0, 4.0, 0.72);
    add(GEO.box, mat(C.ink, 0.5), 0, 0.14, 0, 0.05, 0.28, 0.02, hour);
    const minute = new Group();
    minute.position.set(0, 4.0, 0.74);
    add(GEO.box, mat(C.ink, 0.5), 0, 0.2, 0, 0.035, 0.4, 0.02, minute);
    hour.userData.keep = minute.userData.keep = true;
    g.add(hour, minute);
    clock.push({ hour, minute });
    add(GEO.box, mat(C.woodDark, 0.6), 0, 0.5, 0.66, 0.5, 1.0, 0.05, g);
    add(GEO.cyl, windowMat, 0, 2.4, 0.66, 0.18, 0.04, 0.18, g, 0, Math.PI / 2);
  }
  k.spots.filter((s) => s.island === 'castle' && s.act === 'shop').forEach((s, j) => {
    const [x, z] = local(s, 0, 0.85);
    stall(x, K.y, z, s.face + Math.PI, ['#ff8fb1', '#87b2ff', '#7fdcb6'][j % 3], [C.carrot, '#ff6f8f', '#ffd166'][j % 3]);
  });
  {
    const f = k.spots.find((s) => s.island === 'castle' && s.act === 'fountain')!;
    fountain((f.x + k.spots.filter((s) => s.island === 'castle' && s.act === 'fountain')[1].x) / 2, K.y, f.z - 1.25, 1);
    const b = k.spots.find((s) => s.island === 'castle' && s.act === 'bench')!;
    const [bx, bz] = local(b, 0, -0.4);
    bench(bx, K.y, bz, b.face);
    for (const [u, v] of [[0.75, 0.35], [-0.78, 0.25], [0.35, 0.72], [-0.4, 0.72]] as const) {
      const [x, z] = onIsland(K, u, v);
      lantern(x, K.y, z);
    }
  }

  // Village: cottages round a green with a well.
  const V = k.islands.village;
  {
    const walls = [C.pink, C.mint, C.cream, C.lilac, C.peach, C.sky];
    const roofs = [C.roofPink, C.roofMint, C.roofPeach, C.roofLilac, C.roofBlue, C.roofPink];
    const at6: [number, number][] = [[-0.62, -0.42], [-0.08, -0.7], [0.5, -0.5], [-0.75, 0.15], [0.72, 0.38], [-0.3, 0.72]];
    at6.forEach(([u, v], j) => cottage(V, u, v, walls[j], roofs[j], 0.95 + (j % 3) * 0.08, j === 4));
    // The well, off to one side of the green (the middle is the campfire's).
    const [wx, wz] = onIsland(V, 0.42, -0.22);
    const g = at(wx, V.y, wz);
    add(GEO.cyl, mat(C.stone, 0.8), 0, 0.35, 0, 0.55, 0.7, 0.55, g);
    add(GEO.cyl, mat(C.water, 0.15), 0, 0.68, 0, 0.45, 0.04, 0.45, g);
    for (const sx of [-0.45, 0.45]) add(GEO.cyl8, mat(C.woodDark, 0.7), sx, 1.0, 0, 0.05, 1.3, 0.05, g);
    add(GEO.cone, mat(C.roofPink, 0.6), 0, 1.8, 0, 0.75, 0.6, 0.75, g);
    const b = k.spots.find((s) => s.island === 'village' && s.act === 'bench')!;
    const [bx, bz] = local(b, 0, -0.4);
    bench(bx, V.y, bz, b.face, '#ffb3c8');
    for (const s of k.spots.filter((s) => s.island === 'village' && s.act === 'sleep')) {
      // A cushion by each door (the village's beds).
      add(GEO.sphere, mat('#ffd7e6', 0.95), s.x, V.y + 0.08, s.z, 0.45, 0.12, 0.38);
    }
    for (const [u, v] of [[0.2, -0.15], [-0.4, 0.42], [0.55, 0.1]] as const) {
      const [x, z] = onIsland(V, u, v);
      lantern(x, V.y, z);
    }
    const [fgx, fgz] = onIsland(V, -0.35, -0.22);
    flag(fgx, V.y, fgz, 2.2, 3);
  }
  // The campfire on the village green: a ring of stones, crossed logs, flames, and log benches at the sides.
  const flames: Object3D[] = [];
  {
    const [fx, fy, fz] = k.fire;
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2;
      add(GEO.sphere, mat(j % 2 ? '#c9c0dc' : '#b3aac6', 0.85), fx + Math.cos(a) * 0.62, fy + 0.08, fz + Math.sin(a) * 0.62, 0.17, 0.12, 0.15, group, a);
    }
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI;
      add(GEO.cyl8, mat(C.woodDark, 0.8), fx, fy + 0.14, fz, 0.07, 0.95, 0.07, group, a, Math.PI / 2 - 0.25);
    }
    add(GEO.sphere, mat('#ff8a3d', 0.6, { emissive: '#ff6a1f', emissiveIntensity: 1.4 }), fx, fy + 0.1, fz, 0.32, 0.08, 0.32);
    const flame = new Group();
    flame.position.set(fx, fy + 0.12, fz);
    flame.userData.keep = true;
    group.add(flame);
    const outer = mat('#ff9a3c', 0.5, { emissive: '#ff6a1f', emissiveIntensity: 2.2, transparent: true, opacity: 0.92 });
    const innerF = mat('#ffe27a', 0.5, { emissive: '#ffcf4d', emissiveIntensity: 2.6 });
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      flames.push(add(GEO.cone, outer, Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14, 0.17, 0.62, 0.17, flame));
    }
    flames.push(add(GEO.cone, outer, 0, 0.42, 0, 0.24, 0.85, 0.24, flame));
    flames.push(add(GEO.cone, innerF, 0, 0.3, 0, 0.13, 0.55, 0.13, flame));
    for (const a of [Math.PI * 0.45, Math.PI * 1.55]) {
      const x = fx + Math.sin(a) * 3.5, z = fz - Math.cos(a) * 3.5;
      add(GEO.cyl, mat(C.wood, 0.85), x, fy + 0.22, z, 0.2, 1.5, 0.2, group, -a, Math.PI / 2);
    }
    lamps.push([fx, fy + 0.6, fz]);
  }

  // Carrot farm: rows of soil with carrot tops, a fence, a cart of carrots, a scarecrow (a straw rabbit).
  const Fm = k.islands.farm;
  const carrotTops: { x: number; y: number; z: number; s: number }[] = [];
  {
    for (let r = 0; r < 4; r++) {
      const z = Fm.z - Fm.rz * 0.45 + r * Fm.rz * 0.3;
      const x0 = Fm.x - Fm.rx * 0.55, x1 = Fm.x + Fm.rx * 0.25;
      add(GEO.box, mat(C.soil, 0.95), (x0 + x1) / 2, Fm.y + 0.04, z, x1 - x0, 0.12, 0.7);
      for (let c = 0; c <= 9; c++) {
        const x = x0 + 0.3 + (c / 9) * (x1 - x0 - 0.6);
        carrotTops.push({ x, y: Fm.y + 0.1, z, s: 0.8 + ((r * 7 + c * 3) % 5) * 0.1 });
        add(GEO.cone, mat(C.carrot, 0.6), x, Fm.y + 0.12, z, 0.07, 0.12, 0.07);
      }
    }
    // Fence along the front.
    for (let j = 0; j < 9; j++) {
      const a = Math.PI * 0.15 + (j / 8) * Math.PI * 0.7;
      const x = Fm.x + Math.cos(a) * Fm.rx * 0.9, z = Fm.z + Math.sin(a) * Fm.rz * 0.9;
      add(GEO.box, mat('#fff6ea', 0.8), x, Fm.y + 0.35, z, 0.1, 0.7, 0.1);
      if (j < 8) {
        const a2 = Math.PI * 0.15 + ((j + 1) / 8) * Math.PI * 0.7;
        const x2 = Fm.x + Math.cos(a2) * Fm.rx * 0.9, z2 = Fm.z + Math.sin(a2) * Fm.rz * 0.9;
        const l = Math.hypot(x2 - x, z2 - z);
        for (const h of [0.25, 0.5]) add(GEO.box, mat('#fff6ea', 0.8), (x + x2) / 2, Fm.y + h, (z + z2) / 2, l, 0.06, 0.05, group, Math.atan2(-(z2 - z), x2 - x));
      }
    }
    const [cx, cz] = onIsland(Fm, 0.55, -0.2);
    const cart = at(cx, Fm.y, cz, 0.4);
    add(GEO.box, mat(C.wood, 0.7), 0, 0.55, 0, 1.2, 0.4, 0.8, cart);
    for (const sx of [-0.45, 0.45]) add(GEO.cyl, mat(C.woodDark, 0.6), sx, 0.3, 0.45, 0.28, 0.06, 0.28, cart, 0, Math.PI / 2);
    for (let j = 0; j < 9; j++) add(GEO.cone, mat(C.carrot, 0.6), -0.4 + (j % 3) * 0.4, 0.85, -0.25 + Math.floor(j / 3) * 0.25, 0.08, 0.4, 0.08, cart, 0, 0, Math.PI / 2 + 0.2 * (j % 2));
    // The scarecrow: a straw rabbit on a pole.
    const [sx, sz] = onIsland(Fm, 0.5, 0.35);
    const sc = at(sx, Fm.y, sz, -0.5);
    add(GEO.cyl8, mat(C.woodDark, 0.7), 0, 0.8, 0, 0.05, 1.6, 0.05, sc);
    add(GEO.box, mat(C.woodDark, 0.7), 0, 1.2, 0, 1.0, 0.05, 0.05, sc);
    add(GEO.sphere, mat('#f2d38a', 0.95), 0, 1.25, 0, 0.3, 0.38, 0.25, sc);
    add(GEO.sphere, mat('#f2d38a', 0.95), 0, 1.75, 0, 0.22, 0.2, 0.2, sc);
    for (const ex of [-0.08, 0.08]) add(GEO.sphere, mat('#f2d38a', 0.95), ex, 2.1, 0, 0.05, 0.25, 0.03, sc, 0, 0, -ex * 2);
    add(GEO.cyl, mat('#ff97b7', 0.7), 0, 1.92, 0, 0.3, 0.03, 0.3, sc);
    lantern(Fm.x + Fm.rx * 0.2, Fm.y, Fm.z + Fm.rz * 0.55);
    lantern(Fm.x - Fm.rx * 0.65, Fm.y, Fm.z + Fm.rz * 0.25);
  }

  // Flower garden: giant flowers (stems, petals, a centre), bushes, a pond, a bench.
  const Gd = k.islands.garden;
  const flowers: { x: number; y: number; z: number; h: number; color: string; r: number }[] = [];
  {
    const R = rng(91);
    const cols = ['#ff8fb1', '#ffd34d', '#b497f0', '#ff9f68', '#87b2ff', '#ffffff', '#ff6f8f'];
    for (let j = 0; j < 30; j++) {
      const a = R() * Math.PI * 2, r = 0.2 + R() * 0.7;
      const x = Gd.x + Math.cos(a) * r * Gd.rx, z = Gd.z + Math.sin(a) * r * Gd.rz;
      // Keep the paths to the activity spots open.
      if (k.spots.some((s) => s.island === 'garden' && Math.hypot(s.x - x, s.z - z) < 1.1)) continue;
      flowers.push({ x, y: Gd.y, z, h: 0.6 + R() * 1.4, color: cols[j % cols.length], r: 0.18 + R() * 0.2 });
    }
    // Big feature flowers by each sniffing spot.
    for (const s of k.spots.filter((s) => s.island === 'garden' && (s.act === 'sniff' || s.act === 'garden'))) {
      const [x, z] = local(s, 0, 0.75);
      flowers.push({ x, y: Gd.y, z, h: 1.1 + (Math.abs(s.x * 13) % 1) * 0.6, color: cols[Math.floor(Math.abs(s.z * 7)) % cols.length], r: 0.38 });
    }
    const b = k.spots.find((s) => s.island === 'garden' && s.act === 'bench')!;
    const [bx, bz] = local(b, 0, -0.4);
    bench(bx, Gd.y, bz, b.face, '#ffffff');
    const pond = add(GEO.cyl, mat(C.water, 0.1, { transparent: true, opacity: 0.9, emissive: '#5fc6ff', emissiveIntensity: 0.12 }), Gd.x + 0.3, Gd.y + 0.01, Gd.z - 0.3, 1.3, 0.04, 0.9);
    pond.renderOrder = 1;
    for (let j = 0; j < 4; j++) add(GEO.cyl, mat('#7fd38a', 0.6), Gd.x + 0.3 + Math.cos(j * 1.7) * 0.7, Gd.y + 0.04, Gd.z - 0.3 + Math.sin(j * 1.7) * 0.45, 0.18, 0.02, 0.18);
    // An arch of roses at the garden's entrance (towards the plaza).
    const [ax, az] = clampTo(Gd, Gd.x - Gd.rx, Gd.z - Gd.rz * 0.15, 0.8);
    const arch = at(ax, Gd.y, az, Math.PI / 2);
    const ar = add(GEO.torus, mat('#7fd38a', 0.7), 0, 0, 0, 1.0, 1.4, 1.2, arch);
    ar.scale.set(1.0, 1.6, 1.4);
    for (let j = 0; j < 9; j++) {
      const t = (j / 8) * Math.PI;
      add(GEO.small, mat(j % 2 ? '#ff8fb1' : '#ffffff', 0.6), Math.cos(t) * 1.0, Math.sin(t) * 1.6, 0, 0.12, 0.12, 0.12, arch);
    }
    lantern(Gd.x + Gd.rx * 0.6, Gd.y, Gd.z - Gd.rz * 0.5);
    lantern(Gd.x - Gd.rx * 0.5, Gd.y, Gd.z + Gd.rz * 0.6);
  }

  // Play cloud: trampolines, the play slide, the climbing tower, balloons, a seesaw.
  const Pl = k.islands.play;
  const pads: KingdomProps['pads'] = [];
  const balloons: KingdomProps['balloons'] = [];
  const trampoline = (x: number, y: number, z: number, color: string, r = 0.85) => {
    const g = at(x, y, z);
    add(GEO.torus, mat(color, 0.5), 0, 0.4, 0, r, r, r, g, 0, Math.PI / 2);
    for (let j = 0; j < 4; j++) add(GEO.cyl8, mat(C.white, 0.5), Math.cos(j * Math.PI / 2 + 0.78) * r, 0.2, Math.sin(j * Math.PI / 2 + 0.78) * r, 0.05, 0.4, 0.05, g);
    const pad = add(GEO.cyl, mat('#5b5f86', 0.8), 0, 0.4, 0, r * 0.92, 0.03, r * 0.92, g);
    pads.push({ obj: pad, x, z });
  };
  {
    const cols = ['#ff8fb1', '#87b2ff', '#ffd166'];
    k.spots.filter((s) => s.island === 'play' && s.act === 'bounce').forEach((s, j) => trampoline(s.x, Pl.y, s.z, cols[j % 3]));
    const sl = k.spots.find((s) => s.island === 'play' && s.act === 'slide')!;
    {
      const g = at(sl.x, Pl.y, sl.z, sl.face);
      const top = PLAY_SLIDE.top, lz = PLAY_SLIDE.ladder;
      for (const sx of [-0.35, 0.35]) add(GEO.cyl8, mat('#87b2ff', 0.5), sx, top / 2 + 0.3, lz - 0.1, 0.05, top + 0.6, 0.05, g);
      for (let j = 1; j <= 5; j++) add(GEO.cyl8, mat(C.white, 0.5), 0, (j / 6) * top, lz - 0.1, 0.03, 0.7, 0.03, g, 0, 0, Math.PI / 2);
      add(GEO.box, mat('#ffd166', 0.5), 0, top, lz + 0.3, 0.9, 0.08, 0.8, g);
      const dz = PLAY_SLIDE.end - (lz + 0.6), dy = top - 0.15;
      const len = Math.hypot(dz, dy);
      add(GEO.box, mat('#ff8fb1', 0.35), 0, 0.15 + dy / 2, lz + 0.6 + dz / 2, 0.8, 0.06, len, g, 0, Math.atan2(dy, dz));
      for (const sx of [-0.42, 0.42]) add(GEO.box, mat('#ff6f8f', 0.35), sx, 0.3 + dy / 2, lz + 0.6 + dz / 2, 0.06, 0.25, len, g, 0, Math.atan2(dy, dz));
    }
    const cl = k.spots.find((s) => s.island === 'play' && s.act === 'climb')!;
    {
      const g = at(cl.x, Pl.y, cl.z);
      add(GEO.cyl, mat('#7fdcb6', 0.6), 0, 1.4, 0, 1.1, 0.12, 1.1, g);
      for (let j = 0; j < 6; j++) add(GEO.cyl8, mat(C.white, 0.5), Math.cos(j * 1.047) * 1.0, 0.7, Math.sin(j * 1.047) * 1.0, 0.05, 1.4, 0.05, g);
      for (const h of [0.45, 0.95]) {
        const ring = add(GEO.torus, mat('#ffd166', 0.5), 0, h, 0, 1.0, 1.0, 1.0, g, 0, Math.PI / 2);
        ring.scale.set(1.0, 1.0, 0.4);
      }
      flag(cl.x, Pl.y + 1.45, cl.z, 1.2, 2);
    }
    const bl = k.spots.find((s) => s.island === 'play' && s.act === 'balloon')!;
    const bcols = ['#ff8fb1', '#87b2ff', '#ffd166', '#7fdcb6', '#b497f0', '#ff9f68'];
    for (let j = 0; j < 6; j++) {
      const [x, z] = local(bl, -1 + (j % 3) * 0.35, -0.9 - Math.floor(j / 3) * 0.3);
      const g = at(x, Pl.y, z);
      add(GEO.box, mat(C.woodDark, 0.6), 0, 0.1, 0, 0.2, 0.2, 0.2, g);
      const b = new Group();
      add(GEO.cyl8, mat(C.white, 0.9), 0, 0.9, 0, 0.008, 1.6, 0.008, b);
      add(GEO.sphere, mat(bcols[j], 0.25, { emissive: bcols[j], emissiveIntensity: 0.06 }), 0, 1.9, 0, 0.3, 0.36, 0.3, b);
      add(GEO.cone, mat(bcols[j], 0.25), 0, 1.53, 0, 0.05, 0.07, 0.05, b);
      b.userData.keep = true;
      g.add(b);
      balloons.push({ obj: b, base: [x, Pl.y, z], seed: j });
    }
    // Seesaw.
    const [sx, sz] = onIsland(Pl, 0.0, -0.1);
    const ss = at(sx, Pl.y, sz, 0.5);
    add(GEO.cone, mat(C.white, 0.6), 0, 0.2, 0, 0.22, 0.4, 0.22, ss);
    const plank = add(GEO.box, mat('#b497f0', 0.6), 0, 0.42, 0, 2.4, 0.07, 0.3, ss, 0, 0, 0.18);
    plank.userData.keep = true;
    balloons.push({ obj: plank, base: [sx, Pl.y, sz], seed: -1 });
    lantern(Pl.x + Pl.rx * 0.65, Pl.y, Pl.z + Pl.rz * 0.1);
    lantern(Pl.x - Pl.rx * 0.6, Pl.y, Pl.z - Pl.rz * 0.15);
  }

  // Hop academy: the obstacle course (hurdles on an oval), jumping platforms, ramps, and the launch trampoline.
  const T = k.islands.training;
  {
    const course = k.spots.find((s) => s.act === 'practice')!;
    // The track.
    const track = add(GEO.torus, mat('#ffd9a8', 0.9), course.x, T.y + 0.01, course.z, 1, 1, 1, group, 0, Math.PI / 2);
    track.scale.set(COURSE.rx, COURSE.rz, 0.3);
    for (const h of COURSE.hurdles) {
      const x = course.x + Math.cos(h) * COURSE.rx, z = course.z + Math.sin(h) * COURSE.rz;
      const tang = Math.atan2(-Math.sin(h) * COURSE.rx, Math.cos(h) * COURSE.rz);
      const g = at(x, T.y, z, tang + Math.PI / 2);
      for (const sx of [-0.4, 0.4]) add(GEO.cyl8, mat(C.white, 0.5), sx, 0.25, 0, 0.04, 0.5, 0.04, g);
      for (let j = 0; j < 4; j++) add(GEO.box, mat(j % 2 ? '#ffffff' : '#ff6f8f', 0.5), -0.3 + j * 0.2, 0.45, 0, 0.2, 0.07, 0.07, g);
    }
    // Jumping platforms of rising heights and a cloud ramp.
    const [px, pz] = onIsland(T, -0.5, 0.3);
    for (let j = 0; j < 4; j++) add(GEO.cyl, mat(['#87b2ff', '#7fdcb6', '#ffd166', '#ff8fb1'][j], 0.6), px + j * 0.85, T.y + (0.15 + j * 0.2), pz + Math.sin(j) * 0.4, 0.38, 0.3 + j * 0.4, 0.38);
    const [rx2, rz2] = onIsland(T, -0.15, 0.68);
    add(GEO.box, mat('#e6dcfb', 0.8), rx2, T.y + 0.3, rz2, 1.6, 0.12, 2.0, group, 0.3, 0.3);
    trampoline(k.launch[0], T.y, k.launch[2], '#ffd166', 1.0);
    // A tiny podium.
    const [dx, dz] = onIsland(T, 0.65, -0.35);
    for (const [ox, h, c] of [[0, 0.6, C.gold], [-0.55, 0.4, '#d6dce8'], [0.55, 0.28, '#e8b68a']] as const) add(GEO.box, mat(c, 0.4, { metalness: 0.2 }), dx + ox, T.y + h / 2, dz, 0.5, h, 0.5);
    flag(T.x + T.rx * 0.7, T.y, T.z + T.rz * 0.2, 2, 0);
    lantern(T.x - T.rx * 0.7, T.y, T.z + T.rz * 0.05);
    lantern(T.x + T.rx * 0.2, T.y, T.z + T.rz * 0.75);
  }

  // Dozy cloud: cloud beds with pillows and blankets, tables and chairs, a little lamp by each bed.
  const S = k.islands.sleep;
  {
    const blankets = ['#c9b8ff', '#ffc4d8', '#b8e2ff', '#c8f2d8'];
    k.spots.filter((s) => s.island === 'sleep' && s.act === 'sleep').forEach((s, j) => {
      const g = at(s.x, S.y, s.z, s.face);
      add(GEO.sphere, mat('#ffffff', 0.95), 0, 0.14, 0, 0.6, 0.2, 0.75, g);
      add(GEO.sphere, mat('#fff6fb', 0.95), 0, 0.3, -0.45, 0.32, 0.12, 0.2, g);
      add(GEO.box, mat(blankets[j % 4], 0.9), 0, 0.3, 0.25, 0.95, 0.06, 0.6, g);
    });
    for (const s of k.spots.filter((s) => s.island === 'sleep' && s.act === 'rest')) {
      const [tx, tz] = local(s, 0, 0.7);
      add(GEO.cyl, mat(C.wood, 0.7), tx, S.y + 0.55, tz, 0.5, 0.06, 0.5);
      add(GEO.cyl8, mat(C.woodDark, 0.7), tx, S.y + 0.27, tz, 0.07, 0.55, 0.07);
      add(GEO.cyl, mat('#fff4e6', 0.6), tx, S.y + 0.62, tz, 0.08, 0.1, 0.08);
      add(GEO.cyl, mat('#ffb3c8', 0.8), s.x, S.y + 0.2, s.z, 0.3, 0.06, 0.3);
    }
    cottage(S, 0.62, -0.5, C.lilac, C.roofBlue, 0.9);
    cottage(S, -0.72, 0.42, C.sky, C.roofLilac, 0.85);
    for (const [u, v] of [[-0.1, -0.62], [0.05, 0.62], [-0.75, -0.25], [0.75, 0.3]] as const) {
      const [x, z] = onIsland(S, u, v);
      lantern(x, S.y, z, 1.2);
    }
    // A soft landing cushion where rabbits drop down from the plaza.
    const drop = k.links.find((l) => l.kind === 'drop')!;
    const end = drop.pts[1];
    add(GEO.sphere, mat('#ffe0ef', 0.95), end[0], S.y + 0.05, end[2], 1.0, 0.18, 1.0);
    // And on the plaza, a little diving board to step off.
    const st = drop.pts[0];
    const yaw = Math.atan2(end[0] - st[0], end[2] - st[2]);
    add(GEO.box, mat('#87b2ff', 0.5), st[0] + Math.sin(yaw) * 0.6, P.y + 0.05, st[2] + Math.cos(yaw) * 0.6, 0.7, 0.08, 1.6, group, yaw);
  }

  // The lookout: a gazebo, telescopes, a star flag.
  const Lk = k.islands.lookout;
  {
    const g = at(Lk.x, Lk.y, Lk.z - 0.6);
    for (let j = 0; j < 6; j++) add(GEO.cyl8, mat(C.white, 0.5), Math.cos(j * 1.047) * 1.5, 1.1, Math.sin(j * 1.047) * 1.5, 0.07, 2.2, 0.07, g);
    const dome = add(GEO.sphere, mat(C.roofLilac, 0.5), 0, 2.2, 0, 1.75, 0.9, 1.75, g);
    dome.scale.y = 0.9;
    add(GEO.cone, mat(C.gold, 0.3, { metalness: 0.5 }), 0, 3.25, 0, 0.12, 0.4, 0.12, g);
    for (const s of k.spots.filter((s) => s.island === 'lookout' && s.act === 'gaze')) {
      const [tx, tz] = local(s, 0.45, 0.3);
      const t = at(tx, Lk.y, tz, s.face);
      for (let j = 0; j < 3; j++) add(GEO.cyl8, mat(C.woodDark, 0.6), Math.cos(j * 2.1) * 0.15, 0.4, Math.sin(j * 2.1) * 0.15, 0.025, 0.85, 0.025, t, 0, Math.sin(j * 2.1) * 0.2, -Math.cos(j * 2.1) * 0.2);
      add(GEO.cyl, mat('#d9a948', 0.3, { metalness: 0.6 }), 0, 0.95, 0.1, 0.07, 0.8, 0.07, t, 0, -0.9);
    }
    flag(Lk.x + Lk.rx * 0.6, Lk.y, Lk.z + Lk.rz * 0.3, 2.4, 4);
    lantern(Lk.x - Lk.rx * 0.65, Lk.y, Lk.z + Lk.rz * 0.2, 1.2);
  }

  // The gym at the academy: a weight bench, a rack of dumbbells, a barbell, a stretching mat, a jumping mat, a cool-down bench with a water cooler.
  {
    const spot = (act: string) => k.spots.find((s) => s.island === 'training' && s.act === act)!;
    const iron = mat('#4a4a58', 0.4, { metalness: 0.6 });
    const w = spot('weights');
    {
      const [bx, bz] = local(w, 0, -0.8);
      const b = at(bx, T.y, bz, w.face);
      add(GEO.box, mat('#ff5a5f', 0.6), 0, 0.42, 0, 0.42, 0.12, 1.1, b);
      add(GEO.box, iron, 0, 0.2, 0, 0.3, 0.4, 0.9, b);
      const [rx, rz] = local(w, 1.25, -0.35);
      const rack = at(rx, T.y, rz, w.face - Math.PI / 2);
      add(GEO.box, iron, 0, 0.5, 0, 1.2, 0.04, 0.32, rack, 0, -0.2);
      add(GEO.box, iron, 0, 0.25, 0.05, 1.2, 0.04, 0.32, rack, 0, -0.2);
      for (const sx of [-0.55, 0.55]) add(GEO.box, iron, sx, 0.32, 0, 0.05, 0.64, 0.3, rack);
      for (let j = 0; j < 4; j++) for (const [h, z2] of [[0.56, -0.04], [0.31, 0.03]] as const) {
        const x = -0.4 + j * 0.27;
        add(GEO.cyl8, iron, x, h, z2, 0.02, 0.2, 0.02, rack, 0, 0, Math.PI / 2);
        for (const e of [-0.09, 0.09]) add(GEO.cyl, mat(['#ff5a5f', '#87b2ff', '#ffd166', '#7fdcb6'][j], 0.5), x + e, h, z2, 0.05 + j * 0.006, 0.035, 0.05 + j * 0.006, rack, 0, 0, Math.PI / 2);
      }
      const [px, pz] = local(w, -1.3, -0.5);
      const bar = at(px, T.y, pz, w.face);
      for (const sx of [-0.55, 0.55]) add(GEO.cyl8, iron, sx, 0.35, 0, 0.04, 0.7, 0.04, bar);
      add(GEO.cyl8, mat('#9aa0b4', 0.3, { metalness: 0.8 }), 0, 0.7, 0, 0.022, 1.6, 0.022, bar, 0, 0, Math.PI / 2);
      for (const sx of [-0.68, -0.6, 0.6, 0.68]) add(GEO.cyl, mat('#2f2c3a', 0.5), sx, 0.7, 0, 0.17, 0.05, 0.17, bar, 0, 0, Math.PI / 2);
    }
    const st = spot('stretch');
    add(GEO.box, mat('#b497f0', 0.9), st.x, T.y + 0.012, st.z, 0.9, 0.02, 1.5, group, st.face);
    const jm = spot('jumps');
    add(GEO.cyl, mat('#7fdcb6', 0.9), jm.x, T.y + 0.012, jm.z, 0.65, 0.02, 0.65);
    const cd = spot('cooldown');
    {
      const [bx, bz] = local(cd, 0, -0.42);
      bench(bx, T.y, bz, cd.face, '#87b2ff');
      const [wx, wz] = local(cd, 1.0, -0.3);
      const cool = at(wx, T.y, wz, cd.face);
      add(GEO.box, mat(C.white, 0.6), 0, 0.4, 0, 0.32, 0.8, 0.32, cool);
      add(GEO.cyl, mat('#8fd3ff', 0.1, { transparent: true, opacity: 0.8 }), 0, 0.98, 0, 0.15, 0.36, 0.15, cool);
      add(GEO.box, mat('#87b2ff', 0.5), 0, 0.55, 0.17, 0.08, 0.06, 0.04, cool);
      add(GEO.box, mat('#ff8fb1', 0.9), -0.4, 0.33, 0.0, 0.32, 0.03, 0.2, cool);
    }
  }

  // The cloud office on the dozy cloud: a desk with a glowing monitor and a keyboard, a cushion to sit on, a beanbag, a computer tower, a mug, a plant.
  {
    const c = k.spots.find((s) => s.act === 'computer')!;
    const [dx, dz] = local(c, 0, 0.62);
    const d = at(dx, S.y, dz, c.face + Math.PI);
    add(GEO.box, mat('#ffffff', 0.5), 0, 0.42, 0, 1.0, 0.05, 0.5, d);
    for (const [sx, sz] of [[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]] as const) add(GEO.cyl8, mat('#c9c0dc', 0.5), sx, 0.2, sz, 0.03, 0.4, 0.03, d);
    add(GEO.box, mat('#2a2638', 0.4), 0, 0.73, -0.08, 0.58, 0.38, 0.04, d);
    add(GEO.box, mat('#9fd0ff', 0.3, { emissive: '#6fb6ff', emissiveIntensity: 0.9 }), 0, 0.74, -0.055, 0.52, 0.32, 0.01, d);
    // Lines of code on the screen.
    const code = ['#ffd166', '#ff8fb1', '#7fdcb6'].map((h) => mat(h, 0.4, { emissive: h, emissiveIntensity: 0.8 }));
    for (let j = 0; j < 5; j++) add(GEO.box, code[j % 3], -0.12 + (j % 2) * 0.05, 0.84 - j * 0.05, -0.048, 0.18 + ((j * 7) % 4) * 0.04, 0.018, 0.004, d);
    add(GEO.cyl8, mat('#2a2638', 0.4), 0, 0.5, -0.1, 0.03, 0.12, 0.03, d);
    add(GEO.box, mat('#e6e3f0', 0.5), 0, 0.46, 0.1, 0.42, 0.025, 0.14, d);
    add(GEO.sphere, mat('#e6e3f0', 0.5), 0.32, 0.46, 0.1, 0.04, 0.02, 0.055, d);
    add(GEO.cyl, mat('#ff8fb1', 0.5), -0.38, 0.5, 0.05, 0.05, 0.12, 0.05, d);
    add(GEO.cyl, mat(C.soil, 0.8), 0.4, 0.5, -0.12, 0.06, 0.1, 0.06, d);
    add(GEO.sphere, mat(C.leaf, 0.7), 0.4, 0.62, -0.12, 0.09, 0.12, 0.09, d);
    add(GEO.box, mat('#2a2638', 0.4), 0.72, 0.28, -0.05, 0.2, 0.56, 0.42, d);
    add(GEO.small, lampMat, 0.72, 0.48, 0.17, 0.02, 0.02, 0.02, d);
    add(GEO.sphere, mat('#b8e2ff', 0.95), c.x, S.y + 0.06, c.z, 0.38, 0.1, 0.34);
    const l = k.spots.find((s) => s.act === 'lounge')!;
    add(GEO.sphere, mat('#9fb3ff', 0.95), l.x, S.y + 0.18, l.z, 0.55, 0.28, 0.5);
    const [ux, uz] = local(l, 0, -0.35);
    add(GEO.sphere, mat('#9fb3ff', 0.95), ux, S.y + 0.4, uz, 0.45, 0.3, 0.25);
  }

  // A little amp at each music corner.
  for (const m of k.spots.filter((s) => s.act === 'music')) {
    const [ax, az] = local(m, 0.6, 0.15);
    const amp = at(ax, k.islands[m.island].y, az, m.face);
    add(GEO.box, mat('#2a2638', 0.5), 0, 0.2, 0, 0.32, 0.4, 0.22, amp);
    add(GEO.cyl, mat('#4a4458', 0.8), 0, 0.2, 0.112, 0.11, 0.01, 0.11, amp, 0, Math.PI / 2);
    add(GEO.box, mat(C.gold, 0.35, { metalness: 0.5 }), 0, 0.37, 0.112, 0.22, 0.02, 0.01, amp);
  }

  // Lanterns at the ends of the bridges.
  for (const l of k.links) {
    if (l.kind !== 'rainbow' && l.kind !== 'cloud') continue;
    for (const end of [l.pts[0], l.pts[l.pts.length - 1]]) {
      const other = end === l.pts[0] ? l.pts[2] : l.pts[l.pts.length - 3];
      const dx = other[0] - end[0], dz = other[2] - end[2];
      const d = Math.hypot(dx, dz) || 1;
      lantern(end[0] - (dx / d) * 0.6 + (-dz / d) * 1.05, end[1], end[2] - (dz / d) * 0.6 + (dx / d) * 1.05, 1.3);
    }
  }

  // The balloon lift's basket: hangs from three balloons.
  const basket = new Group();
  basket.userData.keep = true;
  {
    add(GEO.cyl, mat(C.wood, 0.8), 0, 0.15, 0, 0.75, 0.5, 0.75, basket);
    add(GEO.torus, mat(C.woodDark, 0.7), 0, 0.4, 0, 0.75, 0.75, 0.75, basket, 0, Math.PI / 2);
    for (let j = 0; j < 3; j++) {
      const a = j * 2.094;
      add(GEO.cyl8, mat(C.white, 0.9), Math.cos(a) * 0.4, 1.4, Math.sin(a) * 0.4, 0.01, 2.0, 0.01, basket, 0, Math.sin(a) * 0.2, -Math.cos(a) * 0.2);
      add(GEO.sphere, mat(['#ff8fb1', '#87b2ff', '#ffd166'][j], 0.25, { emissive: ['#ff8fb1', '#87b2ff', '#ffd166'][j], emissiveIntensity: 0.08 }), Math.cos(a) * 0.65, 2.75, Math.sin(a) * 0.65, 0.65, 0.75, 0.65, basket);
    }
    group.add(basket);
    // Little posts where it lands.
    for (const p of [k.lift.bottom, k.lift.top]) {
      add(GEO.cyl, mat('#fff4e6', 0.8), p[0], p[1] + 0.02, p[2], 1.0, 0.05, 1.0);
      lantern(p[0] + 1.3, p[1], p[2], 1.3);
    }
  }

  // Swaying plants (grass tufts, flowers, carrot tops) as instanced meshes, bent in the vertex shader by height above their base.
  const swayMat = (rough: number, sway: number) => {
    const m = new MeshStandardMaterial({ roughness: rough, color: '#ffffff' });
    const uniforms = { uTime: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\nattribute float aBase;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        float hh = max(0.0, wp.y - aBase);
        float sw = sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.27) + 0.45 * sin(uTime * 2.1 + wp.z * 0.8);
        wp.x += sw * ${sway.toFixed(3)} * hh * hh;
        wp.z += sw * ${(sway * 0.6).toFixed(3)} * hh * hh;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    };
    m.customProgramCacheKey = () => `rabbit-sway-${sway}`;
    materials.push(m);
    timed.push({ uniforms });
    return m;
  };
  const instanced = (geo: BufferGeometry, m: Material, list: { x: number; y: number; z: number; sx: number; sy: number; sz: number; base: number; color: string; ry?: number; rx?: number; rz?: number }[]) => {
    const im = new InstancedMesh(geo, m, Math.max(1, list.length));
    const base = new Float32Array(Math.max(1, list.length));
    const o = new Object3D();
    const c = new Color();
    list.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
      o.scale.set(it.sx, it.sy, it.sz);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, c.set(it.color));
      base[i] = it.base;
    });
    im.count = list.length;
    im.geometry = geo.clone();
    im.geometry.setAttribute('aBase', new InstancedBufferAttribute(base, 1));
    geometries.push(im.geometry);
    im.frustumCulled = false;
    group.add(im);
    return im;
  };

  // Grass tufts over every island's turf (not on the plaza's paved middle, nor under the props' busiest spots).
  const grass: Parameters<typeof instanced>[2] = [];
  const R = rng(7);
  const greens = ['#7fd38a', '#9be29a', '#6cc77e', '#b5eaa8'];
  for (const i of Object.values(k.islands)) {
    const n = Math.round(i.rx * i.rz * 2.2);
    for (let j = 0; j < n; j++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.93;
      const x = i.x + Math.cos(a) * r * i.rx, z = i.z + Math.sin(a) * r * i.rz;
      if (i.id === 'plaza' && Math.hypot((x - i.x) / (k.clearX + 2.8), (z - i.z) / (k.clearZ + 2.8)) < 1) continue;
      const h = 0.25 + R() * 0.3;
      for (let b = 0; b < 3; b++) grass.push({ x: x + (R() - 0.5) * 0.15, y: i.y, z: z + (R() - 0.5) * 0.15, sx: 1, sy: h * (0.7 + R() * 0.5), sz: 1, base: i.y, color: greens[(j + b) % 4], rx: (R() - 0.5) * 0.5, rz: (R() - 0.5) * 0.5 });
    }
  }
  instanced(GEO.blade, swayMat(0.9, 0.35), grass);
  // Carrot tops.
  const tops: Parameters<typeof instanced>[2] = [];
  for (const c of carrotTops) for (let b = 0; b < 3; b++) tops.push({ x: c.x, y: c.y, z: c.z, sx: 1.6, sy: 0.45 * c.s, sz: 1.6, base: c.y, color: '#4fbf5c', rx: (b - 1) * 0.4, rz: (b - 1) * 0.25 });
  instanced(GEO.blade, swayMat(0.8, 0.5), tops);
  // Flowers: a stem, a ring of petals, a centre. Small flowers are scattered over the other islands too.
  const R2 = rng(33);
  const smallCols = ['#ff8fb1', '#ffd34d', '#ffffff', '#b497f0', '#87b2ff'];
  for (const i of Object.values(k.islands)) {
    if (i.id === 'garden') continue;
    const n = Math.round(i.rx * i.rz * 0.18);
    for (let j = 0; j < n; j++) {
      const a = R2() * Math.PI * 2, r = 0.55 + R2() * 0.38;
      flowers.push({ x: i.x + Math.cos(a) * r * i.rx, y: i.y, z: i.z + Math.sin(a) * r * i.rz, h: 0.25 + R2() * 0.25, color: smallCols[j % smallCols.length], r: 0.07 + R2() * 0.05 });
    }
  }
  const stems: Parameters<typeof instanced>[2] = [];
  const petals: Parameters<typeof instanced>[2] = [];
  const centres: Parameters<typeof instanced>[2] = [];
  for (const f of flowers) {
    stems.push({ x: f.x, y: f.y, z: f.z, sx: f.r * 0.35 + 0.3, sy: f.h, sz: f.r * 0.35 + 0.3, base: f.y, color: '#5cc466' });
    const top = f.y + f.h;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      petals.push({ x: f.x + Math.cos(a) * f.r * 0.85, y: top, z: f.z + Math.sin(a) * f.r * 0.85, sx: f.r * 0.62, sy: f.r * 0.18, sz: f.r * 0.4, base: f.y, color: f.color, ry: -a });
    }
    centres.push({ x: f.x, y: top + f.r * 0.08, z: f.z, sx: f.r * 0.42, sy: f.r * 0.25, sz: f.r * 0.42, base: f.y, color: f.color === '#ffd34d' ? '#ff9f43' : '#ffd34d' });
    // Big ones get two leaves.
    if (f.h > 0.8) for (const s of [-1, 1]) petals.push({ x: f.x + s * 0.12, y: f.y + f.h * 0.4, z: f.z, sx: 0.16, sy: 0.04, sz: 0.08, base: f.y, color: '#6cc77e', rz: s * 0.5 });
  }
  instanced(GEO.blade, swayMat(0.8, 0.12), stems);
  instanced(GEO.petal, swayMat(0.55, 0.12), petals);
  instanced(GEO.petal, swayMat(0.6, 0.12), centres);
  // Round bushes on the islands' edges.
  const bushes: Parameters<typeof instanced>[2] = [];
  for (const i of Object.values(k.islands)) {
    if (i.id === 'plaza' || i.id === 'lookout') continue;
    for (let j = 0; j < 6; j++) {
      const a = R() * Math.PI * 2;
      const x = i.x + Math.cos(a) * i.rx * 0.88, z = i.z + Math.sin(a) * i.rz * 0.88;
      if (k.links.some((l) => [l.pts[0], l.pts[l.pts.length - 1]].some((p) => Math.hypot(p[0] - x, p[2] - z) < 2.2))) continue;
      const s = 0.35 + R() * 0.3;
      bushes.push({ x, y: i.y + s * 0.6, z, sx: s, sy: s * 0.85, sz: s, base: i.y - 1, color: ['#8ad99a', '#a5e3a0', '#ffc4d8'][j % 3] });
    }
  }
  instanced(GEO.sphere, swayMat(0.9, 0.01), bushes);

  mergeStatic(group, geometries);

  return { group, lamps, lampMat, windowMat, timed, clock, fountains, balloons, basket, pads, fire: { flames, pos: k.fire }, materials, geometries };
}

/** Merges every prop that never moves into one mesh per material (a few dozen draw calls instead of hundreds). */
function mergeStatic(group: Group, geometries: BufferGeometry[]): void {
  group.updateMatrixWorld(true);
  const buckets = new Map<Material, BufferGeometry[]>();
  const drop: Mesh[] = [];
  const kept = (o: Object3D | null): boolean => {
    for (let p = o; p && p !== group; p = p.parent) if (p.userData.keep) return true;
    return false;
  };
  group.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || (m as unknown as InstancedMesh).isInstancedMesh || kept(m)) return;
    const mat = m.material as Material;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (g.index === null || !g.attributes.uv) return;
    let list = buckets.get(mat);
    if (!list) buckets.set(mat, (list = []));
    list.push(g);
    drop.push(m);
  });
  for (const m of drop) m.removeFromParent();
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    geometries.push(merged);
    const mesh = new Mesh(merged, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
}

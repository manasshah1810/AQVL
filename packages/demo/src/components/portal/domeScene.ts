import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DOME_WORLDS, type DomeWorld } from './portalWorlds';

/**
 * The world dome: a glass snow-globe holding a live miniature of a world.
 * Raw three.js on its own small canvas (no React Three Fiber) so it stays
 * cheap enough to put on the homepage and the settings page at once.
 *
 * Travel between worlds is a journey, not a swap: the camera dives through
 * the glass, a swirling portal irises shut, the world changes behind it,
 * and the iris opens on the new place while the camera pulls back out.
 */

interface Palette {
  skyTop: string;
  skyBot: string;
  light: string;
  hemiGround: string;
  base: string;
  accent: string;
  rim: string;
  bar: string;
  aurora: number;
  stars: number;
  sun: number;
}

const PALETTE: Record<DomeWorld, Palette> = {
  panda: { skyTop: '#f6e7b8', skyBot: '#a9d98a', light: '#fff2cf', hemiGround: '#6f9a4a', base: '#34502b', accent: '#8cc152', rim: '#c8ff8a', bar: '#ead7a0', aurora: 0, stars: 0, sun: 1 },
  penguin: { skyTop: '#07101f', skyBot: '#24598d', light: '#cfe6ff', hemiGround: '#3a6a9a', base: '#1b3656', accent: '#8fd3ff', rim: '#7fe9ff', bar: '#c4e6ff', aurora: 1, stars: 1, sun: 0 },
  rabbit: { skyTop: '#a994ff', skyBot: '#ffd4ea', light: '#fff3ff', hemiGround: '#d9c9ff', base: '#54448f', accent: '#ff8fa3', rim: '#ffb8e6', bar: '#f7f2ff', aurora: 0, stars: 0.5, sun: 0.4 },
  studio: { skyTop: '#252333', skyBot: '#4a4560', light: '#fff0e6', hemiGround: '#3a3649', base: '#1e1c27', accent: '#e9a03b', rim: '#ebc0a3', bar: '#f0e6dd', aurora: 0, stars: 0.25, sun: 0 },
};

const DOME_R = 2.4;
const DOME_Y = 0.9;
const BAR_VALUES = [5, 2, 6, 1, 7, 3, 4];

const ease = {
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function bubbleOps(values: number[]) {
  const a = values.slice();
  const ops: { i: number; swap: boolean }[] = [];
  for (let p = 0; p < a.length - 1; p++) {
    for (let j = 0; j < a.length - p - 1; j++) {
      const swap = a[j] > a[j + 1];
      ops.push({ i: j, swap });
      if (swap) [a[j], a[j + 1]] = [a[j + 1], a[j]];
    }
  }
  return ops;
}
const OPS = bubbleOps(BAR_VALUES);

const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
function std(color: string, rough = 0.65, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}
function blob(mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
function cyl(mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, parent: THREE.Object3D, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

interface Crew {
  group: THREE.Group;
  head: THREE.Object3D;
  arms: THREE.Object3D[];
  phase: number;
}

function makePenguin(scale: number, phase: number): Crew {
  const g = new THREE.Group();
  const dark = std('#253047', 0.5);
  const white = std('#f6f3ec', 0.7);
  const orange = std('#f39a2e', 0.55);
  blob(dark, 0.34, 0.46, 0.3, 0, 0.5, 0, g);
  blob(white, 0.25, 0.36, 0.2, 0, 0.46, 0.13, g);
  const head = new THREE.Group();
  head.position.y = 1.0;
  g.add(head);
  blob(dark, 0.26, 0.24, 0.24, 0, 0, 0, head);
  blob(white, 0.07, 0.07, 0.05, -0.1, 0.04, 0.19, head);
  blob(white, 0.07, 0.07, 0.05, 0.1, 0.04, 0.19, head);
  blob(std('#101420'), 0.035, 0.035, 0.03, -0.1, 0.04, 0.23, head);
  blob(std('#101420'), 0.035, 0.035, 0.03, 0.1, 0.04, 0.23, head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 8), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.03, 0.27);
  head.add(beak);
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.33, 0.7, 0);
    pivot.rotation.z = s * -0.35;
    blob(dark, 0.075, 0.27, 0.14, 0, -0.2, 0, pivot);
    g.add(pivot);
    arms.push(pivot);
    blob(orange, 0.12, 0.04, 0.17, s * 0.13, 0.03, 0.1, g);
  }
  g.scale.setScalar(scale);
  return { group: g, head, arms, phase };
}

function makePanda(scale: number, phase: number): Crew {
  const g = new THREE.Group();
  const white = std('#f5f2ea', 0.8);
  const black = std('#1d1d22', 0.7);
  blob(white, 0.4, 0.38, 0.34, 0, 0.42, 0, g);
  blob(black, 0.41, 0.1, 0.35, 0, 0.55, 0, g);
  for (const s of [-1, 1]) blob(black, 0.14, 0.2, 0.15, s * 0.22, 0.12, 0.1, g);
  const head = new THREE.Group();
  head.position.y = 0.98;
  g.add(head);
  blob(white, 0.32, 0.28, 0.28, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    blob(black, 0.1, 0.1, 0.07, s * 0.24, 0.24, -0.02, head);
    const patch = blob(black, 0.07, 0.1, 0.05, s * 0.13, 0.03, 0.24, head);
    patch.rotation.z = s * 0.45;
    blob(white, 0.022, 0.022, 0.02, s * 0.13, 0.05, 0.285, head);
  }
  blob(black, 0.06, 0.04, 0.04, 0, -0.06, 0.28, head);
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.38, 0.62, 0.05);
    pivot.rotation.z = s * -0.25;
    blob(black, 0.11, 0.26, 0.12, 0, -0.18, 0, pivot);
    g.add(pivot);
    arms.push(pivot);
  }
  const stalk = cyl(std('#8cc152', 0.6), 0.025, 0.025, 0.55, 0.22, 0.6, 0.32, g, 8);
  stalk.rotation.z = 0.25;
  g.scale.setScalar(scale);
  return { group: g, head, arms, phase };
}

function makeBunny(scale: number, phase: number): Crew {
  const g = new THREE.Group();
  const white = std('#f7efe2', 0.85);
  const pink = std('#ffb3c7', 0.7);
  blob(white, 0.34, 0.36, 0.32, 0, 0.38, 0, g);
  blob(white, 0.1, 0.1, 0.1, 0, 0.3, -0.34, g);
  for (const s of [-1, 1]) blob(white, 0.1, 0.07, 0.17, s * 0.17, 0.05, 0.12, g);
  const head = new THREE.Group();
  head.position.y = 0.86;
  g.add(head);
  blob(white, 0.27, 0.24, 0.24, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.12, 0.2, 0);
    ear.rotation.z = s * -0.18;
    blob(white, 0.07, 0.3, 0.05, 0, 0.26, 0, ear);
    blob(pink, 0.035, 0.22, 0.03, 0, 0.26, 0.03, ear);
    head.add(ear);
    blob(std('#2b2546'), 0.03, 0.036, 0.025, s * 0.09, 0.03, 0.21, head);
    blob(pink, 0.05, 0.035, 0.02, s * 0.15, -0.05, 0.2, head).material = std('#ffc6d3', 0.9, { transparent: true, opacity: 0.8 });
  }
  blob(pink, 0.04, 0.03, 0.03, 0, -0.03, 0.235, head);
  g.scale.setScalar(scale);
  return { group: g, head, arms: [], phase };
}

interface Particles {
  mesh: THREE.InstancedMesh;
  n: number;
  pos: Float32Array;
  vel: Float32Array;
  ph: Float32Array;
  rise: boolean;
  spin: number;
}

function makeParticles(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, rise: boolean, speed: number, spin: number): Particles {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const p: Particles = { mesh, n, pos: new Float32Array(n * 3), vel: new Float32Array(n), ph: new Float32Array(n), rise, spin };
  for (let i = 0; i < n; i++) {
    p.vel[i] = speed * (0.6 + Math.random() * 0.8);
    p.ph[i] = Math.random() * 100;
    respawn(p, i, true);
  }
  return p;
}

function limitAt(y: number) {
  const d = y - DOME_Y;
  return Math.sqrt(Math.max(0, (DOME_R - 0.25) * (DOME_R - 0.25) - d * d));
}

function respawn(p: Particles, i: number, anywhere: boolean) {
  const y = p.rise ? 0.1 + Math.random() * (anywhere ? 2.8 : 0.4) : anywhere ? 0.1 + Math.random() * 2.9 : 2.9;
  const lim = Math.max(0.2, limitAt(y) - 0.1);
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * lim;
  p.pos[i * 3] = Math.cos(a) * r;
  p.pos[i * 3 + 1] = y;
  p.pos[i * 3 + 2] = Math.sin(a) * r;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function stepParticles(p: Particles, t: number, dt: number) {
  for (let i = 0; i < p.n; i++) {
    const ph = p.ph[i];
    let y = p.pos[i * 3 + 1] + (p.rise ? 1 : -1) * p.vel[i] * dt;
    let x = p.pos[i * 3] + Math.sin(t * 0.8 + ph) * 0.12 * dt;
    let z = p.pos[i * 3 + 2] + Math.cos(t * 0.6 + ph) * 0.12 * dt;
    if (y < 0.04 || y > 3.1) {
      respawn(p, i, false);
      y = p.pos[i * 3 + 1];
      x = p.pos[i * 3];
      z = p.pos[i * 3 + 2];
    }
    const r = Math.hypot(x, z);
    const lim = limitAt(y);
    if (r > lim) {
      const k = (lim / r) * 0.98;
      x *= k;
      z *= k;
    }
    p.pos[i * 3] = x;
    p.pos[i * 3 + 1] = y;
    p.pos[i * 3 + 2] = z;
    _p.set(x, y, z);
    _e.set(t * p.spin + ph, t * p.spin * 0.7 + ph * 2, ph);
    _q.setFromEuler(_e);
    _s.setScalar(0.7 + ((ph * 7) % 1) * 0.6);
    _m.compose(_p, _q, _s);
    p.mesh.setMatrixAt(i, _m);
  }
  p.mesh.instanceMatrix.needsUpdate = true;
}

interface WorldRig {
  group: THREE.Group;
  tick: (t: number, dt: number, beat: number) => void;
  particles?: Particles;
}

function floorDisc(color: string, rough: number, y = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(2.22, 2.22, 0.14, 72), std(color, rough, extra));
  m.position.y = y - 0.04;
  return m;
}

function ringOn(parent: THREE.Object3D, r: number, tube: number, color: string, y = 0.01, emissive = 0) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, tube, 8, 96),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: emissive }),
  );
  m.rotation.x = Math.PI / 2;
  m.position.y = y + 0.04;
  parent.add(m);
  return m;
}

function ring(count: number, r0: number, r1: number, a0: number, a1: number, fn: (x: number, z: number, i: number, a: number) => void) {
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / count;
    const r = r0 + (r1 - r0) * ((i * 0.618) % 1);
    fn(Math.cos(a) * r, Math.sin(a) * r, i, a);
  }
}

function buildPenguin(): WorldRig {
  const group = new THREE.Group();
  group.add(floorDisc('#dcecf9', 0.35));
  ringOn(group, 2.2, 0.05, '#8fd3ff', 0.0, 0.6);
  const ice = std('#bfe3ff', 0.15, { transparent: true, opacity: 0.88, flatShading: true });
  ring(6, 1.55, 1.85, Math.PI * 1.08, Math.PI * 1.95, (x, z, i) => {
    const h = 0.9 + ((i * 0.37) % 1) * 0.9;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28 + (i % 3) * 0.06, h, 5), ice);
    c.position.set(x, h / 2 - 0.02, z);
    c.rotation.y = i;
    group.add(c);
  });
  const igloo = new THREE.Group();
  const snow = std('#f3f9ff', 0.8);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), snow);
  igloo.add(dome);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16, 1, false, 0, Math.PI), snow);
  tunnel.rotation.set(0, Math.PI / 2, Math.PI / 2);
  tunnel.position.set(0, 0.17, 0.5);
  igloo.add(tunnel);
  blob(std('#ff9d4d', 0.5, { emissive: '#ff9d4d', emissiveIntensity: 0.6 }), 0.14, 0.17, 0.05, 0, 0.17, 0.68, igloo);
  igloo.position.set(-1.25, 0, -1.0);
  igloo.rotation.y = 0.7;
  group.add(igloo);
  const crewA = makePenguin(1, 0);
  crewA.group.position.set(-1.75, 0, 0.25);
  crewA.group.rotation.y = 0.7;
  const crewB = makePenguin(0.78, 2);
  crewB.group.position.set(1.7, 0, -0.2);
  crewB.group.rotation.y = -0.6;
  group.add(crewA.group, crewB.group);
  const flake = makeParticles(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 90, false, 0.28, 0);
  group.add(flake.mesh);
  return {
    group,
    particles: flake,
    tick: (t, _dt, beat) => {
      for (const c of [crewA, crewB]) {
        const hop = Math.abs(Math.sin(t * 2.4 + c.phase)) * 0.04 + beat * 0.12 * Math.abs(Math.sin(t * 9));
        c.group.position.y = hop;
        c.group.rotation.z = Math.sin(t * 2.4 + c.phase) * 0.06;
        c.head.rotation.y = Math.sin(t * 0.9 + c.phase) * 0.4;
        c.arms[0].rotation.z = 0.35 + Math.sin(t * 3 + c.phase) * 0.12 + beat * 0.7;
        c.arms[1].rotation.z = -0.35 - Math.sin(t * 3 + c.phase + 1) * 0.12 - beat * 0.7;
      }
    },
  };
}

function buildPanda(): WorldRig {
  const group = new THREE.Group();
  group.add(floorDisc('#92c85e', 0.9));
  ringOn(group, 2.2, 0.05, '#c8ff8a', 0.0, 0.45);
  const stalk = std('#8cc152', 0.55);
  const node = std('#5f8a33', 0.6);
  const leaf = std('#6fae3a', 0.7, { side: THREE.DoubleSide });
  const stalks: THREE.Object3D[] = [];
  ring(8, 1.6, 2.0, Math.PI * 1.02, Math.PI * 1.98, (x, z, i) => {
    const s = new THREE.Group();
    const h = 2.0 + ((i * 0.53) % 1) * 0.9;
    cyl(stalk, 0.06, 0.07, h, 0, h / 2, 0, s);
    for (let k = 1; k < 5; k++) cyl(node, 0.075, 0.075, 0.035, 0, (h * k) / 5, 0, s);
    for (let k = 0; k < 3; k++) {
      const l = blob(leaf, 0.3, 0.015, 0.07, Math.cos(k * 2.1) * 0.2, h - 0.2 - k * 0.12, Math.sin(k * 2.1) * 0.2, s);
      l.rotation.y = -k * 2.1;
      l.rotation.z = 0.35;
    }
    s.position.set(x, 0, z);
    group.add(s);
    stalks.push(s);
  });
  const rock = std('#a8a08a', 0.9, { flatShading: true });
  blob(rock, 0.45, 0.28, 0.4, 1.5, 0.1, 0.5, group);
  blob(rock, 0.28, 0.2, 0.25, -1.1, 0.06, -0.9, group);
  const crewA = makePanda(1, 0);
  crewA.group.position.set(-1.75, 0, 0.3);
  crewA.group.rotation.y = 0.7;
  const crewB = makePanda(0.72, 2.4);
  crewB.group.position.set(1.8, 0, -0.35);
  crewB.group.rotation.y = -0.7;
  group.add(crewA.group, crewB.group);
  const leaves = makeParticles(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshBasicMaterial({ color: '#7cbf3f', side: THREE.DoubleSide }), 40, false, 0.32, 1.6);
  group.add(leaves.mesh);
  return {
    group,
    particles: leaves,
    tick: (t, _dt, beat) => {
      stalks.forEach((s, i) => (s.rotation.z = Math.sin(t * 0.8 + i) * 0.03));
      for (const c of [crewA, crewB]) {
        c.group.position.y = beat * 0.14 * Math.abs(Math.sin(t * 8));
        c.head.rotation.x = Math.sin(t * 5 + c.phase) * 0.07 * (1 + beat);
        c.head.rotation.y = Math.sin(t * 0.8 + c.phase) * 0.35;
        c.arms[0].rotation.z = 0.25 + Math.sin(t * 2 + c.phase) * 0.06 + beat * 0.6;
        c.arms[1].rotation.z = -0.25 - Math.sin(t * 2 + c.phase) * 0.06 - beat * 0.6;
      }
    },
  };
}

function buildRabbit(): WorldRig {
  const group = new THREE.Group();
  const cloud = std('#ffffff', 0.95);
  group.add(floorDisc('#ffffff', 0.95));
  const puffs: THREE.Mesh[] = [];
  ring(18, 2.0, 2.15, 0, Math.PI * 2, (x, z, i) => {
    const r = 0.2 + ((i * 0.37) % 1) * 0.16;
    puffs.push(blob(cloud, r, r * 0.85, r, x, 0.0, z, group));
  });
  const clouds: THREE.Group[] = [];
  for (const [x, y, z, s] of [[-1.2, 2.2, -0.9, 1], [1.3, 2.5, -0.6, 0.8]]) {
    const c = new THREE.Group();
    for (const [dx, dr] of [[-0.25, 0.22], [0, 0.3], [0.28, 0.2]]) blob(cloud, dr, dr * 0.8, dr, dx, 0, 0, c);
    c.position.set(x, y, z);
    c.scale.setScalar(s);
    group.add(c);
    clouds.push(c);
  }
  const arcs = new THREE.Group();
  ['#ff8fa3', '#ffd96e', '#8be0a8', '#8cc8ff', '#b79cff'].forEach((c, i) => {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(1.95 - i * 0.12, 0.06, 8, 64, Math.PI),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.35 }),
    );
    arcs.add(t);
  });
  arcs.position.set(0, 0, -1.25);
  arcs.rotation.y = 0.12;
  group.add(arcs);
  const crewA = makeBunny(1, 0);
  crewA.group.position.set(-1.75, 0, 0.3);
  crewA.group.rotation.y = 0.7;
  const crewB = makeBunny(0.78, 1.8);
  crewB.group.position.set(1.75, 0, -0.1);
  crewB.group.rotation.y = -0.7;
  group.add(crewA.group, crewB.group);
  const sparkle = makeParticles(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#fff2a8' }), 36, true, 0.18, 2);
  const petals = makeParticles(new THREE.PlaneGeometry(0.09, 0.13), new THREE.MeshBasicMaterial({ color: '#ffb3c9', side: THREE.DoubleSide }), 26, false, 0.24, 1.4);
  group.add(sparkle.mesh, petals.mesh);
  let step = 0;
  return {
    group,
    particles: sparkle,
    tick: (t, dt, beat) => {
      stepParticles(petals, t, dt);
      step++;
      clouds.forEach((c, i) => (c.position.y = (i ? 2.5 : 2.2) + Math.sin(t * 0.8 + i * 2) * 0.1));
      puffs.forEach((p, i) => p.scale.setScalar((0.2 + ((i * 0.37) % 1) * 0.16) * (1 + Math.sin(t * 1.2 + i) * 0.05)));
      for (const c of [crewA, crewB]) {
        const hop = Math.max(0, Math.sin(t * 2.2 + c.phase * 2)) * 0.12 + beat * 0.25 * Math.abs(Math.sin(t * 9));
        c.group.position.y = hop;
        c.head.rotation.z = Math.sin(t * 1.4 + c.phase) * 0.1;
        c.head.rotation.y = Math.sin(t * 0.9 + c.phase) * 0.35;
      }
      void step;
    },
  };
}

function buildStudio(): WorldRig {
  const group = new THREE.Group();
  group.add(floorDisc('#3a3649', 0.45, 0, { metalness: 0.2 }));
  for (const [r, c, e] of [[2.2, '#ebc0a3', 0.5], [1.7, '#5d5873', 0.15], [1.2, '#5d5873', 0.15]] as [number, string, number][]) ringOn(group, r, 0.018, c, 0.0, e);
  const shapes: THREE.Mesh[] = [];
  const amber = new THREE.MeshStandardMaterial({ color: '#e9a03b', roughness: 0.3, emissive: '#e9a03b', emissiveIntensity: 0.25 });
  const cream = std('#f5d8c6', 0.35);
  const wire = new THREE.MeshBasicMaterial({ color: '#ebc0a3', wireframe: true });
  const defs: [THREE.BufferGeometry, THREE.Material, number, number, number][] = [
    [new THREE.IcosahedronGeometry(0.34), amber, -1.7, 1.3, 0.2],
    [new THREE.TorusGeometry(0.3, 0.09, 12, 32), cream, 1.7, 1.6, -0.3],
    [new THREE.OctahedronGeometry(0.3), wire, 0.2, 2.3, -1.0],
    [new THREE.BoxGeometry(0.4, 0.4, 0.4), std('#8e8ba3', 0.4), -0.9, 2.0, -1.2],
    [new THREE.ConeGeometry(0.25, 0.5, 4), amber, 1.1, 0.8, -1.2],
  ];
  defs.forEach(([g, m, x, y, z]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.userData.y = y;
    group.add(mesh);
    shapes.push(mesh);
  });
  const dust = makeParticles(new THREE.OctahedronGeometry(0.03), new THREE.MeshBasicMaterial({ color: '#ebc0a3' }), 44, true, 0.08, 1);
  group.add(dust.mesh);
  return {
    group,
    particles: dust,
    tick: (t, _dt, beat) => {
      shapes.forEach((s, i) => {
        s.rotation.x = t * (0.4 + i * 0.1);
        s.rotation.y = t * (0.5 - i * 0.05);
        s.position.y = (s.userData.y as number) + Math.sin(t * 0.9 + i * 1.7) * 0.12 + beat * 0.15;
      });
    },
  };
}

const BUILDERS: Record<DomeWorld, () => WorldRig> = { panda: buildPanda, penguin: buildPenguin, rabbit: buildRabbit, studio: buildStudio };

/* ── Shaders ─────────────────────────────────────────────────────────── */

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop; uniform vec3 uBot; uniform float uTime;
uniform float uAurora; uniform float uStars; uniform float uSun;
float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y*0.5+0.5;
  vec3 col = mix(uBot,uTop,smoothstep(0.15,0.95,h));
  vec3 sp = floor(d*55.);
  float hs = hash(sp);
  col += step(0.985,hs)*uStars*(0.55+0.45*sin(uTime*2.+hs*40.));
  float band = sin(d.x*5.+uTime*0.4+sin(d.z*3.+uTime*0.3)*1.5)*0.5+0.5;
  float a = smoothstep(0.4,0.7,h)*smoothstep(0.98,0.62,h)*band;
  col += uAurora*a*mix(vec3(0.15,1.,0.65),vec3(0.6,0.45,1.),d.x*0.5+0.5)*0.75;
  vec3 sd = normalize(vec3(-0.4,0.45,-0.75));
  float s = max(dot(d,sd),0.);
  col += uSun*(pow(s,48.)*vec3(1.,0.92,0.65)+pow(s,6.)*vec3(0.25,0.2,0.08));
  gl_FragColor = vec4(col,1.);
  #include <colorspace_fragment>
}`;

const GLASS_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix*vec4(position,1.);
  vN = normalize(normalMatrix*normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix*mv;
}`;
const GLASS_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vV;
uniform vec3 uRim; uniform float uFlash; uniform float uOpacity;
void main(){
  float nv = abs(dot(normalize(vN),normalize(vV)));
  float fres = pow(1.-nv,3.);
  vec3 L = normalize(vec3(-0.5,0.8,0.6));
  float spec = pow(max(dot(reflect(-L,normalize(vN)),normalize(vV)),0.),60.);
  float streak = smoothstep(0.93,0.97,dot(normalize(vN),normalize(vec3(-0.55,0.55,0.62))))*0.5;
  vec3 col = uRim*(fres*1.3+uFlash*fres*2.)+vec3(1.)*(spec+streak);
  float a = (fres*0.65+spec*0.9+streak*0.6+0.035+uFlash*fres)*uOpacity;
  gl_FragColor = vec4(col,clamp(a,0.,1.));
  #include <colorspace_fragment>
}`;

const WARP_VERT = /* glsl */ `
attribute float aAngle; attribute float aRadius; attribute float aZ; attribute float aEnd; attribute float aSpeed;
uniform float uTime; uniform float uWarp;
varying float vA;
void main(){
  float L = 14.;
  float z = mod(aZ + uTime*aSpeed*(0.5+uWarp*3.), L) - L;
  float len = 0.25 + uWarp*3.2;
  vec3 p = vec3(cos(aAngle)*aRadius, sin(aAngle)*aRadius, z - aEnd*len);
  vA = (1.-aEnd)*smoothstep(-L,-L*0.6,z)*clamp(uWarp*1.4,0.,1.);
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const WARP_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main(){
  gl_FragColor = vec4(uColor,vA);
  #include <colorspace_fragment>
}`;

const IRIS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
const IRIS_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uCover; uniform float uHole; uniform float uAspect; uniform float uTime;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uGlow;
void main(){
  vec2 p = (vUv-0.5)*vec2(uAspect,1.)*2.;
  float d = length(p);
  float ang = atan(p.y,p.x);
  float R = 2.6;
  float outer = uCover*R;
  float inner = uHole*R;
  float swirl = 0.5+0.5*sin(ang*3.+d*5.-uTime*7.+uHole*8.);
  vec3 col = mix(mix(uA,uB,swirl),uGlow,0.25+0.25*swirl*swirl);
  float fill = smoothstep(outer,outer-0.06,d)*smoothstep(inner-0.06,inner,d);
  float edgeO = exp(-pow((d-outer)*9.,2.))*step(0.001,uCover)*(1.-step(0.999,uHole));
  float edgeI = exp(-pow((d-inner)*9.,2.))*step(0.001,uHole);
  vec3 outc = col + uGlow*(edgeO+edgeI)*1.6;
  float a = max(fill, (edgeO+edgeI)*0.8);
  float edge = min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
  a *= smoothstep(0.0,0.2,edge);
  gl_FragColor = vec4(outc,clamp(a,0.,1.));
  #include <colorspace_fragment>
}`;

/* ── The scene ───────────────────────────────────────────────────────── */

export interface DomeOptions {
  reduced: boolean;
  onStep?: (dir: 1 | -1) => void;
}

interface Journey {
  t: number;
  dur: number;
  from: number;
  to: number;
  dir: 1 | -1;
  swapped: boolean;
  spinFrom: number;
}

const _c = new THREE.Color();

export class DomeScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  private dome = new THREE.Group();
  private inner = new THREE.Group();
  private rigs: (WorldRig | null)[] = [null, null, null, null];
  private current = 0;
  private journey: Journey | null = null;
  private pendingTo: number | null = null;
  private time = 0;
  private beat = 0;
  private baseZ = 8.4;
  private aspect = 1;
  private opts: DomeOptions;
  private dragging = false;
  private dragX = 0;
  private lastMoveX = 0;
  private lastMoveT = 0;
  private flick = 0;
  private yawDrag = 0;
  private spin = 0;
  private hover = { x: 0, y: 0, tx: 0, ty: 0 };
  private popScale = 1;
  private bars: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; x: number; v: number }[] = [];
  private slots: number[] = [];
  private opT = 0;
  private opIdx = 0;
  private hold = 0;
  private doneWave = -1;
  private pal: Record<keyof Palette, THREE.Color | number>;
  private tgt: Palette;
  private skyMat: THREE.ShaderMaterial;
  private glassMat: THREE.ShaderMaterial;
  private warpMat: THREE.ShaderMaterial;
  private irisMat: THREE.ShaderMaterial;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private baseMat: THREE.MeshStandardMaterial;
  private baseRing: THREE.MeshStandardMaterial;
  private glow: THREE.Mesh;
  private glowMat: THREE.MeshBasicMaterial;
  private iris: THREE.Mesh;
  private warp: THREE.LineSegments;
  private disposed = false;
  private listeners: [string, EventListener, EventTarget][] = [];

  constructor(canvas: HTMLCanvasElement, startIndex: number, opts: DomeOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.current = startIndex;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.scene.add(this.camera);

    const p0 = PALETTE[DOME_WORLDS[startIndex]];
    this.tgt = p0;
    this.pal = {
      skyTop: new THREE.Color(p0.skyTop), skyBot: new THREE.Color(p0.skyBot), light: new THREE.Color(p0.light), hemiGround: new THREE.Color(p0.hemiGround),
      base: new THREE.Color(p0.base), accent: new THREE.Color(p0.accent), rim: new THREE.Color(p0.rim), bar: new THREE.Color(p0.bar),
      aurora: p0.aurora, stars: p0.stars, sun: p0.sun,
    };
    const col = (k: keyof Palette) => this.pal[k] as THREE.Color;

    this.hemi = new THREE.HemisphereLight(col('skyTop').clone(), col('hemiGround').clone(), 1.1);
    this.key = new THREE.DirectionalLight(col('light').clone(), 2.3);
    this.key.position.set(3, 5, 4);
    this.fill = new THREE.PointLight(col('accent').clone(), 14, 7, 2);
    this.fill.position.set(0, 2.2, 1.2);
    this.scene.add(this.hemi, this.key, this.fill);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: SKY_FRAG,
      uniforms: { uTop: { value: col('skyTop').clone() }, uBot: { value: col('skyBot').clone() }, uTime: { value: 0 }, uAurora: { value: p0.aurora }, uStars: { value: p0.stars }, uSun: { value: p0.sun } },
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(DOME_R - 0.05, 40, 24), this.skyMat);
    sky.position.y = DOME_Y;
    sky.renderOrder = -2;

    const glassGeo = new THREE.SphereGeometry(DOME_R, 64, 40, 0, Math.PI * 2, 0, Math.acos(-DOME_Y / DOME_R));
    this.glassMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      uniforms: { uRim: { value: col('rim').clone() }, uFlash: { value: 0 }, uOpacity: { value: 1 } },
    });
    const glass = new THREE.Mesh(glassGeo, this.glassMat);
    glass.position.y = DOME_Y;
    glass.renderOrder = 5;

    this.baseMat = std(p0.base, 0.45, { metalness: 0.05, emissive: p0.base, emissiveIntensity: 0.35 });
    this.baseRing = new THREE.MeshStandardMaterial({ color: p0.accent, emissive: p0.accent, emissiveIntensity: 1.1, roughness: 0.3 });
    const baseBody = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.5, 64), this.baseMat);
    baseBody.position.y = -0.25;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 3.0, 0.16, 64), this.baseMat);
    plinth.position.y = -0.58;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.46, 0.045, 10, 96), this.baseRing);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.0;
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(2.93, 0.025, 8, 96), this.baseRing);
    rim2.rotation.x = Math.PI / 2;
    rim2.position.y = -0.5;

    this.dome.add(sky, this.inner, glass, baseBody, plinth, rim, rim2);
    this.scene.add(this.dome);

    // The pad of light the globe hovers over.
    this.glowMat = new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, color: col('accent').clone(), opacity: 0.7, blending: THREE.AdditiveBlending });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.scale.setScalar(6.6);
    this.glow.position.y = -0.75;
    this.glow.renderOrder = -3;
    this.scene.add(this.glow);

    this.buildBars();
    this.activate(startIndex);

    // Warp streaks, parented to the camera.
    const N = 260;
    const pos = new Float32Array(N * 2 * 3);
    const aAngle = new Float32Array(N * 2);
    const aRadius = new Float32Array(N * 2);
    const aZ = new Float32Array(N * 2);
    const aEnd = new Float32Array(N * 2);
    const aSpeed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.pow(Math.random(), 0.7) * 5;
      const z = Math.random() * 14;
      const sp = 3 + Math.random() * 6;
      for (let e = 0; e < 2; e++) {
        const k = i * 2 + e;
        aAngle[k] = a;
        aRadius[k] = r;
        aZ[k] = z;
        aEnd[k] = e;
        aSpeed[k] = sp;
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    wg.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1));
    wg.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
    wg.setAttribute('aZ', new THREE.BufferAttribute(aZ, 1));
    wg.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
    wg.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
    this.warpMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: WARP_VERT,
      fragmentShader: WARP_FRAG,
      uniforms: { uTime: { value: 0 }, uWarp: { value: 0 }, uColor: { value: col('rim').clone() } },
    });
    this.warp = new THREE.LineSegments(wg, this.warpMat);
    this.warp.frustumCulled = false;
    this.warp.renderOrder = 900;
    this.warp.visible = false;
    this.camera.add(this.warp);

    this.irisMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: IRIS_VERT,
      fragmentShader: IRIS_FRAG,
      uniforms: { uCover: { value: 0 }, uHole: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } },
    });
    this.iris = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.irisMat);
    this.iris.frustumCulled = false;
    this.iris.renderOrder = 1000;
    this.iris.visible = false;
    this.scene.add(this.iris);

    this.bindPointer();
  }

  /* ── pieces ─────────────────────────────────────────────────────── */

  private buildBars() {
    const geo = new RoundedBoxGeometry(0.3, 1, 0.3, 3, 0.07);
    const shadow = radialTexture();
    BAR_VALUES.forEach((v, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: '#000000' });
      const mesh = new THREE.Mesh(geo, mat);
      const h = 0.22 + v * 0.17;
      mesh.scale.y = h;
      mesh.position.set(this.slotX(i), h / 2, 0.55);
      this.inner.add(mesh);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: shadow, color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(this.slotX(i), 0.045, 0.55);
      this.inner.add(sh);
      this.bars.push({ mesh, mat, x: this.slotX(i), v });
      mesh.userData.shadow = sh;
      this.slots.push(i);
    });
  }

  private slotX(k: number) {
    return (k - (BAR_VALUES.length - 1) / 2) * 0.41;
  }

  private activate(idx: number) {
    const w = DOME_WORLDS[idx];
    this.rigs.forEach((r) => r && (r.group.visible = false));
    let rig = this.rigs[idx];
    if (!rig) {
      rig = BUILDERS[w]();
      this.rigs[idx] = rig;
      this.inner.add(rig.group);
    }
    rig.group.visible = true;
    this.current = idx;
  }

  private resetBars() {
    this.slots = BAR_VALUES.map((_, i) => i);
    this.opIdx = 0;
    this.opT = 0;
    this.hold = 0;
    this.doneWave = -1;
    this.bars.forEach((b, i) => {
      b.mesh.position.x = this.slotX(i);
      (b.mesh.userData.shadow as THREE.Object3D).position.x = this.slotX(i);
    });
  }

  /* ── public ─────────────────────────────────────────────────────── */

  get index() {
    return this.journey ? this.journey.to : this.current;
  }

  setSize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.baseZ = Math.max(8.2, 3.35 / (half * this.aspect));
    this.irisMat.uniforms.uAspect.value = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  travelTo(idx: number) {
    if (idx === this.index) return;
    if (this.journey) {
      this.pendingTo = idx;
      return;
    }
    const n = DOME_WORLDS.length;
    const fwd = (idx - this.current + n) % n;
    const dir: 1 | -1 = fwd <= n / 2 ? 1 : -1;
    this.journey = { t: 0, dur: this.opts.reduced ? 0.5 : 2.1, from: this.current, to: idx, dir, swapped: false, spinFrom: this.spin };
    this.warp.visible = !this.opts.reduced;
    this.iris.visible = !this.opts.reduced;
    const from = PALETTE[DOME_WORLDS[this.current]];
    const to = PALETTE[DOME_WORLDS[idx]];
    const u = this.irisMat.uniforms;
    u.uA.value.set(from.skyBot);
    u.uB.value.set(to.skyTop);
    u.uGlow.value.set(to.accent);
    this.warpMat.uniforms.uColor.value.set(to.rim);
  }

  /** Call every frame while visible. */
  frame(dtRaw: number) {
    if (this.disposed) return;
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    const t = this.time;
    const reduced = this.opts.reduced;

    this.stepBars(dt);
    this.beat = Math.max(0, this.beat - dt * 1.8);
    const rig = this.rigs[this.current];
    if (rig) {
      rig.tick(t, dt, this.beat);
      if (rig.particles) stepParticles(rig.particles, t, dt);
    }

    // Palette easing (everything shared between worlds moves toward the target together).
    const k = 1 - Math.exp(-dt * 4.5);
    for (const key of ['skyTop', 'skyBot', 'light', 'hemiGround', 'base', 'accent', 'rim', 'bar'] as const) {
      (this.pal[key] as THREE.Color).lerp(_c.set(this.tgt[key]), k);
    }
    for (const key of ['aurora', 'stars', 'sun'] as const) this.pal[key] = (this.pal[key] as number) + (this.tgt[key] - (this.pal[key] as number)) * k;
    const pc = (key: keyof Palette) => this.pal[key] as THREE.Color;
    this.skyMat.uniforms.uTop.value.copy(pc('skyTop'));
    this.skyMat.uniforms.uBot.value.copy(pc('skyBot'));
    this.skyMat.uniforms.uTime.value = t;
    this.skyMat.uniforms.uAurora.value = this.pal.aurora;
    this.skyMat.uniforms.uStars.value = this.pal.stars;
    this.skyMat.uniforms.uSun.value = this.pal.sun;
    this.glassMat.uniforms.uRim.value.copy(pc('rim'));
    this.hemi.color.copy(pc('skyTop')).lerp(_c.set('#ffffff'), 0.45);
    this.hemi.groundColor.copy(pc('hemiGround'));
    this.key.color.copy(pc('light'));
    this.fill.color.copy(pc('accent'));
    this.baseMat.color.copy(pc('base'));
    this.baseMat.emissive.copy(pc('base'));
    this.baseRing.color.copy(pc('accent'));
    this.baseRing.emissive.copy(pc('accent'));
    this.glowMat.color.copy(pc('accent'));

    // Idle motion, drag and hover parallax.
    this.hover.x += (this.hover.tx - this.hover.x) * (1 - Math.exp(-dt * 5));
    this.hover.y += (this.hover.ty - this.hover.y) * (1 - Math.exp(-dt * 5));
    if (!this.dragging) {
      this.flick *= Math.exp(-dt * 6);
      this.yawDrag *= Math.exp(-dt * 7);
    }
    let camZ = this.baseZ;
    let camY = 2.0;
    let camX = 0;
    let lookY = 0.95;
    let fov = 36;
    let warp = 0;
    let spinNow = this.spin;
    this.popScale = 1;
    this.glassMat.uniforms.uFlash.value = 0;

    const J = this.journey;
    if (J) {
      J.t += dt;
      const u = clamp01(J.t / J.dur);
      if (reduced) {
        if (!J.swapped && u >= 0.5) this.swap(J);
        this.popScale = J.swapped ? ease.outBack(clamp01((u - 0.5) / 0.5)) * 0.3 + 0.7 : 1 - ease.inCubic(u * 2) * 0.3;
      } else {
        const e1 = ease.inCubic(clamp01(u / 0.5));
        const e2 = ease.outCubic(clamp01((u - 0.5) / 0.5));
        const dolly = u < 0.5 ? e1 : 1 - e2;
        camZ = THREE.MathUtils.lerp(this.baseZ, 1.7, dolly);
        camY = THREE.MathUtils.lerp(2.0, 1.2, dolly);
        lookY = THREE.MathUtils.lerp(0.95, 1.1, dolly);
        camX = J.dir * Math.sin(Math.PI * u) * 0.9;
        fov = 36 + 34 * dolly;
        warp = Math.pow(Math.sin(Math.PI * u), 1.4);
        spinNow = J.spinFrom + J.dir * ease.inOut(u) * Math.PI * 2;
        this.irisMat.uniforms.uCover.value = ease.inOut(clamp01((u - 0.2) / 0.3));
        this.irisMat.uniforms.uHole.value = ease.inOut(clamp01((u - 0.5) / 0.32));
        this.irisMat.uniforms.uTime.value = t;
        if (!J.swapped && u >= 0.5) this.swap(J);
        this.popScale = J.swapped ? Math.max(0.0001, ease.outBack(clamp01((u - 0.52) / 0.38)) * 0.45 + 0.55) : 1 - ease.inCubic(clamp01(u / 0.5)) * 0.1;
        this.glassMat.uniforms.uFlash.value = Math.sin(Math.PI * clamp01((u - 0.4) / 0.4)) * 1.2;
      }
      if (u >= 1) {
        this.journey = null;
        this.spin = J.spinFrom + (reduced ? 0 : J.dir * Math.PI * 2);
        this.spin = this.spin % (Math.PI * 2);
        this.warp.visible = false;
        this.iris.visible = false;
        this.irisMat.uniforms.uCover.value = 0;
        this.irisMat.uniforms.uHole.value = 0;
        if (this.pendingTo !== null) {
          const to = this.pendingTo;
          this.pendingTo = null;
          this.travelTo(to);
        }
      }
    } else if (!reduced) {
      this.spin += dt * 0.18;
    }

    const floatY = reduced ? 0 : Math.sin(t * 0.9) * 0.06;
    this.dome.position.y = floatY;
    this.dome.rotation.y = (J ? spinNow : this.spin) + this.yawDrag + this.hover.x * 0.5;
    this.dome.rotation.x = reduced ? 0 : this.hover.y * 0.12 + (J ? Math.sin(Math.PI * clamp01(J.t / J.dur)) * 0.12 : 0);
    this.inner.scale.setScalar(this.popScale);
    this.glow.scale.setScalar(6.6 + Math.sin(t * 1.2) * 0.2 + warp * 1.2);

    this.camera.fov = fov;
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(0, lookY, 0);
    this.camera.updateProjectionMatrix();
    this.warpMat.uniforms.uTime.value = t;
    this.warpMat.uniforms.uWarp.value = warp;
    this.glassMat.uniforms.uOpacity.value = 1;

    this.renderer.render(this.scene, this.camera);
  }

  private swap(J: Journey) {
    J.swapped = true;
    this.activate(J.to);
    this.tgt = PALETTE[DOME_WORLDS[J.to]];
    this.resetBars();
    this.beat = 1;
  }

  private stepBars(dt: number) {
    const baseColor = this.pal.bar as THREE.Color;
    const accent = this.pal.accent as THREE.Color;
    let i0 = -1;
    let i1 = -1;
    let swapE = 0;
    let isSwap = false;
    const op = OPS[this.opIdx];
    if (op) {
      this.opT += dt;
      const dur = 0.78;
      const u = this.opT / dur;
      i0 = op.i;
      i1 = op.i + 1;
      isSwap = op.swap;
      swapE = ease.inOut(clamp01((u - 0.4) / 0.5));
      if (u >= 1) {
        if (op.swap) {
          const a = this.slots[op.i];
          this.slots[op.i] = this.slots[op.i + 1];
          this.slots[op.i + 1] = a;
          this.beat = Math.max(this.beat, 0.7);
        }
        this.opIdx++;
        this.opT = 0;
        i0 = -1;
        i1 = -1;
      }
    } else {
      this.hold += dt;
      this.doneWave = Math.min(this.slots.length + 2, this.hold * 9);
      if (this.hold > 2.2) this.resetBars();
    }
    const highlight = i0 >= 0 ? Math.sin(Math.PI * clamp01(this.opT / 0.5)) : 0;
    for (let k = 0; k < this.slots.length; k++) {
      const b = this.bars[this.slots[k]];
      let x = this.slotX(k);
      let lift = 0;
      if (isSwap && (k === i0 || k === i1)) {
        const other = k === i0 ? i1 : i0;
        x = THREE.MathUtils.lerp(this.slotX(k), this.slotX(other), swapE);
        lift = Math.sin(Math.PI * swapE) * 0.32 * (k === i0 ? 1 : 0.55);
      }
      const h = b.mesh.scale.y;
      b.mesh.position.x = x;
      b.mesh.position.y = h / 2 + lift;
      (b.mesh.userData.shadow as THREE.Object3D).position.x = x;
      const hot = k === i0 || k === i1 ? highlight : 0;
      const done = this.doneWave > k ? clamp01(this.doneWave - k) : 0;
      b.mat.color.copy(baseColor).lerp(accent, hot * 0.7 + done * 0.35);
      b.mat.emissive.copy(accent).multiplyScalar(hot * 0.55 + done * 0.22 * (0.6 + 0.4 * Math.sin(this.time * 6 - k)));
    }
  }

  /* ── pointer ────────────────────────────────────────────────────── */

  private listen(target: EventTarget, type: string, fn: (e: PointerEvent) => void) {
    target.addEventListener(type, fn as EventListener);
    this.listeners.push([type, fn as EventListener, target]);
  }

  private bindPointer() {
    const c = this.canvas;
    this.listen(c, 'pointerdown', (e) => {
      if (this.journey) return;
      this.dragging = true;
      this.dragX = 0;
      this.lastMoveX = e.clientX;
      this.lastMoveT = performance.now();
      this.flick = 0;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
    });
    this.listen(c, 'pointermove', (e) => {
      const r = c.getBoundingClientRect();
      this.hover.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      this.hover.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!this.dragging) return;
      const dx = e.clientX - this.lastMoveX;
      const now = performance.now();
      this.flick = dx / Math.max(1, now - this.lastMoveT);
      this.lastMoveX = e.clientX;
      this.lastMoveT = now;
      this.dragX += dx;
      this.yawDrag = this.dragX * 0.012;
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (Math.abs(this.dragX) > 56 || Math.abs(this.flick) > 0.6) this.opts.onStep?.(this.dragX + this.flick * 80 < 0 ? 1 : -1);
    };
    this.listen(c, 'pointerup', end);
    this.listen(c, 'pointercancel', end);
    this.listen(c, 'pointerleave', () => {
      this.hover.tx = 0;
      this.hover.ty = 0;
    });
  }

  dispose() {
    this.disposed = true;
    this.listeners.forEach(([t, f, target]) => target.removeEventListener(t, f));
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) {
        const withMap = mat as THREE.MeshBasicMaterial;
        withMap.map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

let _radial: THREE.CanvasTexture | null = null;
function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  _radial.colorSpace = THREE.SRGBColorSpace;
  return _radial;
}

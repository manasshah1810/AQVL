import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Euler,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { rng } from '../../three/glsl';

/**
 * The reef's own life, independent of the algorithm: schools of small fish
 * that wheel about the edges, a few jellyfish drifting and pulsing in the
 * blue, and a sea turtle that paddles past now and then. Everything here is
 * a function of the ambient clock (it pauses in calm mode) and keeps clear
 * of the structures: it lives around them, never in front of them.
 */

export interface Area {
  cx: number;
  cz: number;
  /** Half the width and depth the structures cover. */
  halfX: number;
  halfZ: number;
  floorY: number;
  /** Top of the structures above the floor. */
  top: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler(0, 0, 0, 'YXZ');

// ── Fish ───────────────────────────────────────────────────────────────────

/** One small fish: a lens-shaped body and a forked tail, nose at +z, about 0.3 long. */
function fishGeometry(): BufferGeometry {
  const body = new SphereGeometry(0.5, 10, 7);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Laterally flat, deep in the middle, tapering to the tail.
    const taper = 1 - Math.max(0, -z) * 0.9;
    p.setXYZ(i, x * 0.09 * taper, y * 0.15 * taper, z * 0.3);
  }
  body.computeVertexNormals();
  const tail = new BufferGeometry();
  const t = new Float32Array([0, 0, -0.12, 0, 0.09, -0.24, 0, 0.0, -0.19, 0, 0, -0.12, 0, 0.0, -0.19, 0, -0.09, -0.24]);
  tail.setAttribute('position', new BufferAttribute(t, 3));
  tail.computeVertexNormals();
  // Merge by hand (positions + normals), so the school is one draw call.
  const a = body.toNonIndexed();
  const pos = new Float32Array(a.attributes.position.array.length + t.length);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(t, a.attributes.position.array.length);
  const nrm = new Float32Array(pos.length);
  nrm.set(a.attributes.normal.array as Float32Array, 0);
  for (let i = a.attributes.position.array.length; i < pos.length; i += 3) {
    nrm[i] = 1;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  body.dispose();
  tail.dispose();
  a.dispose();
  return g;
}

function fishMaterial(time: { value: number }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.25, side: DoubleSide });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSeed;\nvarying float vBelly;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // The tail half swings side to side.
        float back = max(0.0, -position.z);
        transformed.x += sin(uTime * (9.0 + aSeed * 5.0) + aSeed * 30.0 - position.z * 9.0) * back * back * 1.3;
        vBelly = position.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBelly;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * 1.25 + 0.08, diffuseColor.rgb * 0.7, smoothstep(-0.03, 0.05, vBelly));');
  };
  m.customProgramCacheKey = () => 'aqvl-reef-fish';
  return m;
}

interface School {
  count: number;
  /** Centre path: a slow loop round the area; each fish keeps a place in the shoal. */
  rx: number;
  rz: number;
  y: number;
  speed: number;
  phase: number;
  offsets: Float32Array;
  color: Color;
  size: number;
  /** Fish this school has scattered from (a whale passing close), and when. */
  scatter: number;
}

export interface FishLayer {
  mesh: InstancedMesh;
  update(now: number, area: Area, avoid: { x: number; y: number; z: number; r: number }[], calm: boolean): void;
  dispose(): void;
}

/** Shoals of small fish wheeling slowly around the structures (behind, beside, and high above them; never in front). */
export function buildFish(time: { value: number }, quality: number): FishLayer {
  const r = rng(91);
  const palettes = ['#cfe8ff', '#ffd45c', '#9ff0e0', '#ff9e7a'];
  const schools: School[] = [];
  const counts = quality >= 2 ? [22, 16, 12, 9] : quality === 1 ? [16, 12, 8, 6] : [10, 8, 0, 0];
  counts.forEach((count, i) => {
    if (count === 0) return;
    const offsets = new Float32Array(count * 4);
    for (let f = 0; f < count; f++) {
      offsets[f * 4] = (r() - 0.5) * 1.6;
      offsets[f * 4 + 1] = (r() - 0.5) * 0.7;
      offsets[f * 4 + 2] = (r() - 0.5) * 1.3;
      offsets[f * 4 + 3] = r();
    }
    schools.push({
      count,
      rx: 1 + i * 0.18,
      rz: 1 + i * 0.12,
      y: [1.6, 3.2, 0.9, 2.4][i],
      speed: [0.045, -0.034, 0.06, -0.05][i],
      phase: r() * Math.PI * 2,
      offsets,
      color: new Color(palettes[i]),
      size: [1.0, 1.25, 0.85, 1.1][i],
      scatter: 0,
    });
  });
  const total = schools.reduce((n, s) => n + s.count, 0);
  const geo = fishGeometry();
  const seeds = new Float32Array(Math.max(1, total));
  for (let i = 0; i < total; i++) seeds[i] = r();
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  const mat = fishMaterial(time);
  const mesh = new InstancedMesh(geo, mat, Math.max(1, total));
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  let n = 0;
  for (const s of schools) for (let f = 0; f < s.count; f++) mesh.setColorAt(n++, new Color(s.color).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12));
  const prev = new Float32Array(total * 3);
  let first = true;

  /** Centre of school i at time t: an elongated loop around the structures, held back from the front. */
  const centre = (s: School, area: Area, t: number, out: Vector3) => {
    const a = s.phase + t * s.speed;
    const RX = (area.halfX + 5.5) * s.rx;
    const RZ = (area.halfZ + 4.5) * s.rz;
    const wob = Math.sin(a * 2.3 + s.phase) * 0.18;
    // Behind the structures (never over them) and above their tops.
    out.set(area.cx + Math.cos(a) * RX * (1 + wob), area.floorY + s.y + area.top * 0.7 + 0.8 + Math.sin(a * 3.1 + s.phase) * 0.6, area.cz - area.halfZ - 3.2 - Math.abs(Math.sin(a)) * RZ * 0.6);
    return out;
  };

  const c0 = new Vector3();
  const c1 = new Vector3();
  return {
    mesh,
    update(now, area, avoid, calm) {
      let i = 0;
      for (const s of schools) {
        centre(s, area, now, c0);
        centre(s, area, now + 0.25, c1);
        const dx = c1.x - c0.x, dy = c1.y - c0.y, dz = c1.z - c0.z;
        const yaw = Math.atan2(dx, dz);
        const pitch = Math.atan2(dy, Math.hypot(dx, dz));
        // A whale swimming close makes the shoal spread out and turn away, then close up again.
        let near = 0;
        for (const w of avoid) near = Math.max(near, 1 - Math.min(1, Math.hypot(w.x - c0.x, w.y - c0.y, w.z - c0.z) / (w.r + 2.4)));
        s.scatter += (near - s.scatter) * 0.08;
        const spread = 1 + s.scatter * 1.6;
        for (let f = 0; f < s.count; f++) {
          const o = s.offsets;
          const ph = o[f * 4 + 3] * 20;
          const wig = calm ? 0 : Math.sin(now * 1.3 + ph) * 0.12;
          // Each fish keeps its place in the shoal, drifting a little within it; the shoal turns as one.
          const lx = (o[f * 4] + wig) * spread, ly = o[f * 4 + 1] * spread + Math.sin(now * 0.9 + ph) * 0.06, lz = o[f * 4 + 2] * spread;
          const cy = Math.cos(yaw), sy = Math.sin(yaw);
          _p.set(c0.x + lx * cy + lz * sy, c0.y + ly, c0.z - lx * sy + lz * cy);
          // Facing: the way it actually moves (so a fish turning in the shoal turns its body).
          const px = prev[i * 3], py = prev[i * 3 + 1], pz = prev[i * 3 + 2];
          let fy = yaw, fp = pitch;
          if (!first) {
            const vx = _p.x - px, vy = _p.y - py, vz = _p.z - pz;
            if (Math.hypot(vx, vz) > 1e-4) {
              fy = Math.atan2(vx, vz);
              fp = Math.max(-0.6, Math.min(0.6, Math.atan2(vy, Math.hypot(vx, vz))));
            }
          }
          prev[i * 3] = _p.x;
          prev[i * 3 + 1] = _p.y;
          prev[i * 3 + 2] = _p.z;
          _q.setFromEuler(_e.set(-fp, fy, 0));
          const sz = s.size * (0.8 + o[f * 4 + 3] * 0.4);
          _s.set(sz, sz, sz);
          mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
          i++;
        }
      }
      first = false;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// ── Jellyfish ──────────────────────────────────────────────────────────────

const BELL_VERTEX = /* glsl */ `
uniform float uPulse;
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  vec3 p = position;
  // The bell contracts at the rim as it pulses.
  float rim = smoothstep(0.0, 1.0, 1.0 - p.y);
  p.xz *= 1.0 - uPulse * 0.22 * rim;
  p.y *= 1.0 + uPulse * 0.12;
  vH = position.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

const BELL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.8);
  float bands = 0.5 + 0.5 * sin(atan(vN.z, vN.x) * 8.0);
  float a = (0.12 + rim * 0.55 + bands * 0.05) * (0.6 + 0.4 * smoothstep(0.0, 0.6, vH));
  vec3 c = uColor * (0.6 + rim * 1.2) * (0.8 + uGlow);
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`;

const TENTACLE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSeed;
attribute float aT;
varying float vT;
void main() {
  vec3 p = position;
  float t = aT;
  p.x += sin(uTime * 1.3 + t * 5.0 + uSeed * 9.0 + position.z * 4.0) * 0.12 * t;
  p.z += cos(uTime * 1.1 + t * 4.0 + uSeed * 5.0 + position.x * 4.0) * 0.1 * t;
  vT = t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const TENTACLE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vT;
void main() {
  gl_FragColor = vec4(uColor, (1.0 - vT) * 0.5);
  #include <colorspace_fragment>
}
`;

export interface Jelly {
  group: Group;
  bell: ShaderMaterial;
  tentacles: ShaderMaterial;
  seed: number;
  color: Color;
  /** Where it drifts about (it rises slowly with each pulse and sinks between them). */
  home: Vector3;
  glowUntil: number;
}

function buildJelly(color: string, size: number, seed: number, time: { value: number }): Jelly {
  const group = new Group();
  const bellGeo = new SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const bell = new ShaderMaterial({
    uniforms: { uPulse: { value: 0 }, uColor: { value: new Color(color) }, uGlow: { value: 0 } },
    vertexShader: BELL_VERTEX,
    fragmentShader: BELL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
  const bellMesh = new Mesh(bellGeo, bell);
  group.add(bellMesh);
  // Tentacles: a fringe of long wavy lines under the bell, and four frilly oral arms.
  const strands = 10;
  const segs = 14;
  const pos: number[] = [];
  const ts: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < strands; k++) {
    const a = (k / strands) * Math.PI * 2;
    const inner = k % 3 === 0;
    const r0 = inner ? 0.12 : 0.42;
    const len = inner ? 1.1 : 1.6 + (k % 2) * 0.4;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      pos.push(Math.cos(a) * r0 * (1 - t * 0.3), -t * len + 0.05, Math.sin(a) * r0 * (1 - t * 0.3));
      ts.push(t);
      if (j > 0) idx.push(k * (segs + 1) + j - 1, k * (segs + 1) + j);
    }
  }
  const tg = new BufferGeometry();
  tg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  tg.setAttribute('aT', new BufferAttribute(new Float32Array(ts), 1));
  tg.setIndex(idx);
  const tentacles = new ShaderMaterial({
    uniforms: { uTime: time, uSeed: { value: seed }, uColor: { value: new Color(color) } },
    vertexShader: TENTACLE_VERTEX,
    fragmentShader: TENTACLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const lines = new LineSegments(tg, tentacles);
  group.add(lines);
  group.scale.setScalar(size);
  group.traverse((o) => {
    o.frustumCulled = false;
    o.renderOrder = 6;
  });
  return { group, bell, tentacles, seed, color: new Color(color), home: new Vector3(), glowUntil: -1 };
}

export interface JellyLayer {
  group: Group;
  jellies: Jelly[];
  update(now: number, wall: number, area: Area, calm: boolean): void;
  dispose(): void;
}

/** A handful of jellies drifting in the blue around the reef (far enough back and high enough to stay out of the way). */
export function buildJellies(time: { value: number }, quality: number): JellyLayer {
  const group = new Group();
  const specs: [string, number, number, number, number][] = [
    // colour, size, angle round the area, height above the structures, distance factor
    ['#9fd8ff', 0.8, 2.3, 2.6, 1.0],
    ['#e6a8ff', 0.6, 0.9, 3.4, 1.15],
    ['#ffc2d9', 0.7, 1.6, 1.4, 1.3],
    ['#a8fff0', 0.5, 2.8, 4.2, 1.2],
    ['#d0b8ff', 0.55, 0.35, 2.2, 1.35],
  ];
  const jellies = specs.slice(0, quality >= 1 ? 5 : 3).map(([c, s], i) => buildJelly(c, s, i * 1.37 + 0.2, time));
  jellies.forEach((j) => group.add(j.group));
  return {
    group,
    jellies,
    update(now, wall, area, calm) {
      jellies.forEach((j, i) => {
        const [, , ang, h, dist] = specs[i];
        // Pulse: a quick contraction, a slow relax; each pulse lifts it a little, it sinks between.
        const period = 2.6 + i * 0.37;
        const ph = ((now + j.seed * 3) % period) / period;
        const pulse = ph < 0.22 ? Math.sin((ph / 0.22) * Math.PI * 0.5) : Math.cos(((ph - 0.22) / 0.78) * Math.PI * 0.5);
        j.bell.uniforms.uPulse.value = calm ? 0 : pulse;
        const glow = wall < j.glowUntil ? (j.glowUntil - wall) / 2.2 : 0;
        j.bell.uniforms.uGlow.value = glow * 1.4;
        const a = ang + Math.sin(now * 0.021 + j.seed) * 0.35;
        const R = (Math.max(area.halfX, area.halfZ) + 5.5) * dist;
        const bob = Math.sin(now * 0.31 + j.seed * 2) * 0.6 + (calm ? 0 : -0.15 * Math.cos(ph * Math.PI * 2));
        j.home.set(area.cx + Math.cos(a) * R, area.floorY + area.top + h + bob, area.cz - Math.abs(Math.sin(a)) * R - 1.5);
        j.group.position.copy(j.home);
        j.group.rotation.set(Math.sin(now * 0.4 + j.seed) * 0.12, now * 0.05, Math.cos(now * 0.33 + j.seed) * 0.12);
      });
    },
    dispose() {
      for (const j of jellies) {
        j.bell.dispose();
        j.tentacles.dispose();
        j.group.traverse((o) => {
          const g = (o as Mesh).geometry;
          if (g) g.dispose();
        });
      }
    },
  };
}

// ── The turtle ─────────────────────────────────────────────────────────────

const SHELL_FRAGMENT = /* glsl */ `
vec2 tHash(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
`;

export interface TurtleLayer {
  group: Group;
  update(now: number, area: Area, calm: boolean): void;
  dispose(): void;
}

/** A green sea turtle that glides across the back of the reef every so often, sculling with its long front flippers. */
export function buildTurtle(): TurtleLayer {
  const group = new Group();
  group.rotation.order = 'YXZ';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const shellMat = keep(new MeshStandardMaterial({ color: '#7b6a3e', roughness: 0.55 }));
  shellMat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSh;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSh = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSh;\n${SHELL_FRAGMENT}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // Scutes: a cell pattern with pale seams and a warm centre in each plate.
          vec2 p = vSh.xz * 3.2;
          vec2 n = floor(p); vec2 f = fract(p);
          float d1 = 8.0, d2 = 8.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = 0.5 + 0.3 * (tHash(n + g) - 0.5);
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
          }
          float seam = 1.0 - smoothstep(0.02, 0.09, d2 - d1);
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.1 - d1 * 0.5), vec3(0.85, 0.78, 0.55), seam * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.82, 0.62), smoothstep(-0.02, -0.1, vSh.y));
        }`,
      );
  };
  shellMat.customProgramCacheKey = () => 'aqvl-reef-turtle-shell';
  const skinMat = keep(new MeshStandardMaterial({ color: '#8a9a6a', roughness: 0.7 }));
  const ball = keep(new SphereGeometry(1, 20, 12));
  const shell = new Mesh(ball, shellMat);
  shell.scale.set(0.42, 0.13, 0.55);
  group.add(shell);
  const head = new Mesh(ball, skinMat);
  head.scale.set(0.11, 0.1, 0.15);
  head.position.set(0, 0.02, 0.62);
  group.add(head);
  const eyeMat = keep(new MeshStandardMaterial({ color: '#111', roughness: 0.2 }));
  for (const s of [-1, 1]) {
    const eye = new Mesh(ball, eyeMat);
    eye.scale.setScalar(0.022);
    eye.position.set(s * 0.085, 0.045, 0.68);
    group.add(eye);
  }
  const flipperGeo = keep(new SphereGeometry(1, 12, 8));
  const flippers = [
    { side: -1, front: true },
    { side: 1, front: true },
    { side: -1, front: false },
    { side: 1, front: false },
  ].map(({ side, front }) => {
    const pivot = new Group();
    pivot.position.set(side * (front ? 0.3 : 0.22), -0.02, front ? 0.28 : -0.38);
    const f = new Mesh(flipperGeo, skinMat);
    f.scale.set(front ? 0.36 : 0.15, 0.025, front ? 0.11 : 0.08);
    f.position.set(side * (front ? 0.32 : 0.12), 0, front ? -0.08 : -0.06);
    f.rotation.y = side * (front ? 0.5 : 0.7);
    pivot.add(f);
    group.add(pivot);
    return { pivot, side, front };
  });
  const tailGeo = keep(new CylinderGeometry(0.0, 0.05, 0.16, 6));
  const tail = new Mesh(tailGeo, skinMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -0.6);
  group.add(tail);
  group.traverse((o) => (o.frustumCulled = false));
  group.scale.setScalar(1.4);
  const PERIOD = 48;
  return {
    group,
    update(now, area, calm) {
      // A pass every PERIOD seconds: in at one side of the back of the reef, slowly across, out at the other.
      const cyc = Math.floor(now / PERIOD);
      const u = (now % PERIOD) / 26;
      const visible = u < 1 && !calm;
      group.visible = visible;
      if (!visible) return;
      const dir = cyc % 2 === 0 ? 1 : -1;
      const span = area.halfX + 16;
      const x = area.cx - dir * span + dir * 2 * span * u;
      const z = area.cz - area.halfZ - 6.5 - (cyc % 3) * 1.6 + Math.sin(u * 5) * 0.6;
      const y = area.floorY + area.top * 0.4 + 1.8 + (cyc % 2) * 1.4 + Math.sin(u * 7 + 1) * 0.35;
      group.position.set(x, y, z);
      group.rotation.set(-0.06 * Math.cos(u * 7 + 1), dir > 0 ? Math.PI / 2 - 0.15 : -Math.PI / 2 + 0.15, Math.sin(now * 0.8) * 0.06);
      // Front flippers: a slow, deep, wing-like stroke; the back ones steer.
      const st = now * 1.4;
      for (const f of flippers) {
        if (f.front) {
          f.pivot.rotation.z = f.side * (0.15 + Math.sin(st) * 0.55);
          f.pivot.rotation.y = f.side * Math.cos(st) * 0.3;
        } else {
          f.pivot.rotation.z = f.side * 0.1 * Math.sin(st * 0.5);
        }
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

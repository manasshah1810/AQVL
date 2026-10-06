import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { StageSample } from '../../model/sampler';
import { NO_SHADOW_LAYER } from '../../three/StageEnvironment';
import { FOG, NOISE, fogUniforms, rng } from './glsl';
import { worldLayout } from './layout';
import { buildPanda, createBlobShadow, type Rig } from './rigs';
import { ParticlePool, hash } from './particles';
import type { WorldProps } from './PolarWorld';

const SKY = /* glsl */ `
uniform float uTime;
vec3 groveSky(vec3 d) {
  float h = d.y;
  vec3 top = vec3(0.56, 0.78, 0.76);
  vec3 low = vec3(0.97, 0.9, 0.78);
  vec3 col = mix(low, top, smoothstep(-0.02, 0.5, h));
  vec3 sd = normalize(vec3(0.55, 0.16, -0.82));
  float s = max(dot(d, sd), 0.0);
  col += vec3(1.0, 0.86, 0.6) * (pow(s, 12.0) * 0.35 + pow(s, 300.0) * 0.9);
  float az = atan(d.z, d.x);
  float cloud = smoothstep(0.55, 0.85, fbm(vec2(az * 3.0 + uTime * 0.004, h * 9.0)));
  col = mix(col, vec3(1.0, 0.97, 0.92), cloud * smoothstep(0.03, 0.15, h) * 0.55);
  return col;
}
`;

const GROUND_FRAGMENT = /* glsl */ `
${NOISE}
${FOG}
uniform vec2 uCenter;
uniform vec2 uClear;
uniform vec3 uEarth;
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec2 q = (p - uCenter) / uClear;
  float r = length(q);
  float wobble = (fbm(p * 0.25) - 0.5) * 0.22;
  float rr = r + wobble;
  float clearing = 1.0 - smoothstep(0.95, 1.02, rr);

  // Swept earth: soft and even where the structures stand, raked in rings further out.
  vec3 earth = uEarth * (0.94 + 0.1 * fbm(p * 0.5));
  float rake = smoothstep(0.55, 1.0, sin(rr * 46.0)) * smoothstep(0.62, 0.72, rr);
  earth *= 1.0 - rake * 0.07;
  earth = mix(earth, earth * vec3(0.9, 0.88, 0.8), smoothstep(0.75, 0.95, rr) * 0.5);

  // Pebbles ringing the clearing.
  vec2 v = voronoi(p * 2.6);
  float band = smoothstep(0.93, 0.97, rr) * (1.0 - smoothstep(1.0, 1.06, rr));
  float stone = smoothstep(0.08, 0.14, v.y) * band;
  vec3 pebble = mix(vec3(0.62, 0.6, 0.55), vec3(0.78, 0.76, 0.7), hash12(floor(p * 2.6)));

  // Moss and grass beyond, with a few flowers and fallen leaves.
  float m = fbm(p * 0.35 + 3.0);
  vec3 moss = mix(vec3(0.33, 0.45, 0.2), vec3(0.5, 0.62, 0.29), m);
  moss = mix(moss, vec3(0.62, 0.68, 0.36), smoothstep(0.62, 0.8, fbm(p * 1.3)) * 0.5);
  vec2 cell = floor(p * 5.0);
  float f = hash12(cell);
  vec2 fp = fract(p * 5.0) - 0.5;
  float dotMask = 1.0 - smoothstep(0.07, 0.11, length(fp - (vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5) * 0.6));
  vec3 flower = f > 0.985 ? vec3(0.98, 0.72, 0.8) : (f > 0.97 ? vec3(1.0, 0.95, 0.75) : (f > 0.955 ? vec3(0.95, 0.97, 1.0) : moss));
  moss = mix(moss, flower, dotMask * step(0.955, f));
  float leaf = step(0.9, hash12(floor(p * 3.0) + 11.0)) * (1.0 - smoothstep(0.12, 0.2, length(fract(p * 3.0) - 0.5)));
  moss = mix(moss, vec3(0.72, 0.62, 0.3), leaf * 0.6);

  vec3 col = mix(moss, earth, clearing);
  col = mix(col, pebble, stone);
  col = applyFog(col, length(vWorld - cameraPosition));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const WORLD_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const MOUNTAIN_FRAGMENT = /* glsl */ `
${NOISE}
uniform vec3 uColor;
uniform float uSeed;
uniform float uBase;
uniform float uAmp;
varying vec2 vUv;
void main() {
  float ridge = uBase + uAmp * (fbm(vec2(vUv.x * 9.0 + uSeed, uSeed)) * 0.75 + 0.25 * vnoise(vec2(vUv.x * 40.0, uSeed)));
  if (vUv.y > ridge) discard;
  vec3 col = mix(uColor, uColor * 1.08 + 0.04, smoothstep(0.0, ridge, vUv.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const POND_FRAGMENT = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uSplash;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ripple = sin(r * 22.0 - uTime * 1.6) * 0.5 + 0.5;
  float splash = step(0.0, uSplash) * sin(r * 30.0 - uSplash * 12.0) * exp(-uSplash * 1.8) * (1.0 - smoothstep(uSplash * 1.2, uSplash * 1.2 + 0.25, r));
  vec3 deep = vec3(0.15, 0.36, 0.33);
  vec3 shallow = vec3(0.45, 0.66, 0.58);
  vec3 col = mix(deep, shallow, smoothstep(0.35, 1.0, r));
  col += vec3(0.9, 0.95, 0.85) * (ripple * 0.035 + max(splash, 0.0) * 0.25);
  col += vec3(1.0, 0.95, 0.8) * 0.12 * smoothstep(0.6, 0.9, fbm(p * 2.0 + vec2(uTime * 0.05, 0.0)));
  float a = 1.0 - smoothstep(0.94, 1.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

const SHAFT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uPhase;
varying vec2 vUv;
void main() {
  float across = sin(vUv.x * 3.14159);
  float a = across * across * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
  a *= 0.2 + 0.08 * sin(uTime * 0.35 + uPhase);
  gl_FragColor = vec4(1.0, 0.93, 0.72, a);
}
`;

/** Sway shared by stalks, leaves and grass: the higher on the stalk, the further it moves. */
const SWAY = /* glsl */ `
uniform float uTime;
vec2 sway(vec4 s, float h) {
  float since = uTime - s.w;
  float shake = since >= 0.0 && since < 3.0 ? 0.55 * exp(-since * 1.6) * sin(since * 13.0) : 0.0;
  float k = h * h;
  return vec2(sin(uTime * 0.85 + s.x) * s.y + shake, cos(uTime * 0.63 + s.x * 1.3) * s.y * 0.6 + shake * 0.4) * k;
}
`;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();

/** Leaf outline: a long lance, base at the origin, pointing along +x. */
function leafShape(length: number, width: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(length * 0.35, width, length, 0);
  s.quadraticCurveTo(length * 0.35, -width, 0, 0);
  return s;
}

function swayingMaterial(base: MeshStandardMaterial, uniforms: { uTime: { value: number } }, opts: { stalk: boolean; flutter: boolean; key: string }): MeshStandardMaterial {
  base.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aSway;\nattribute float aHeight;\nvarying float vH;\n${SWAY}`)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
${opts.stalk ? 'float hf = position.y;' : 'float hf = aHeight;'}
${opts.stalk ? 'vH = position.y * aHeight;' : 'vH = 0.0;'}
mvPosition.xz += sway(aSway, hf);
${opts.flutter ? 'mvPosition.y += sin(uTime * 3.2 + aSway.x * 5.0 + position.x * 5.0) * 0.035 * position.x;' : ''}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`,
      );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;');
    if (opts.stalk) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  float seg = 0.95;
  float f = fract(vH / seg);
  float ring = 1.0 - smoothstep(0.0, 0.035, min(f, 1.0 - f));
  float above = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.03, 0.12, f));
  diffuseColor.rgb *= 1.0 - ring * 0.38;
  diffuseColor.rgb += vec3(0.08, 0.09, 0.03) * above;
  diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 2.5, vH);
}`,
      );
    }
  };
  base.customProgramCacheKey = () => `aqvl-grove-${opts.key}`;
  return base;
}

/**
 * The pandas' world: a clearing of swept earth in a bamboo grove at dawn.
 * Bamboo and grass sway, leaves drift down, light falls in shafts, motes
 * glow. Click a stalk to shake it, a lantern to light or douse it, the pond
 * to make a koi leap, an onlooker to make it roll; click the ground for a
 * swirl of leaves.
 */
export function BambooWorld({ model, bounds, driver, calm, clock }: WorldProps) {
  const invalidate = useThree((s) => s.invalidate);
  const palette = model.palette;
  const floorY = model.floorY;
  const { radius: R } = bounds;
  const { cx, cz, halfX, halfZ, lift } = useMemo(() => worldLayout(model), [model]);
  const clearX = halfX + 5.2;
  const clearZ = Math.max(halfZ + 4.8, halfX * 0.55 + 4.3) + lift * 0.6;
  const fogNear = R * 2.6 + 10;
  const fogFar = R * 8 + 55;
  const haze = '#e6e6cf';
  const time = useMemo(() => ({ value: 0 }), []);

  const sky = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: time },
        vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `${NOISE}\n${SKY}\nvarying vec3 vDir;\nvoid main() { gl_FragColor = vec4(groveSky(normalize(vDir)), 1.0);\n#include <colorspace_fragment>\n}`,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [time],
  );
  const ground = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: time,
          uCenter: { value: [cx, cz] },
          uClear: { value: [clearX, clearZ] },
          uEarth: { value: new Color(palette.floor) },
          ...fogUniforms(haze, fogNear, fogFar),
        },
        vertexShader: WORLD_VERTEX,
        fragmentShader: GROUND_FRAGMENT,
        toneMapped: false,
      }),
    [time, cx, cz, clearX, clearZ, palette.floor, fogNear, fogFar],
  );

  const scene = useMemo(() => {
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T): T => {
      disposables.push(x);
      return x;
    };
    const r = rng(23);
    const group = new Group();

    // ── Bamboo: clumps round the back and sides of the clearing (the front stays open to the camera).
    type Stalk = { x: number; z: number; h: number; thick: number; phase: number; amp: number; tint: number };
    const stalks: Stalk[] = [];
    const clumps = 26;
    for (let c = 0; c < clumps; c++) {
      const a = Math.PI + (c / (clumps - 1)) * Math.PI * 1.35 - 0.17 * Math.PI;
      if (Math.sin(a) > 0.42) continue;
      const depth = 1.06 + r() * 0.5 + (Math.sin(a) < -0.6 ? r() * 0.4 : 0);
      const ccx = cx + Math.cos(a) * clearX * depth;
      const ccz = cz + Math.sin(a) * clearZ * depth;
      const n = 3 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2;
        const d = r() * 1.1;
        stalks.push({
          x: ccx + Math.cos(ang) * d,
          z: ccz + Math.sin(ang) * d,
          h: 6 + r() * 8,
          thick: 0.13 + r() * 0.1,
          phase: r() * 6.28,
          amp: 0.05 + r() * 0.06,
          tint: r(),
        });
      }
    }
    const nearStalks = stalks.length;
    // A second, deeper ring for density behind.
    for (let i = 0; i < 46; i++) {
      const a = Math.PI + r() * Math.PI;
      const depth = 1.7 + r() * 1.3;
      stalks.push({ x: cx + Math.cos(a) * clearX * depth, z: cz + Math.sin(a) * clearZ * depth, h: 9 + r() * 8, thick: 0.16 + r() * 0.12, phase: r() * 6.28, amp: 0.05 + r() * 0.05, tint: r() });
    }
    const stalkGeo = keep(new CylinderGeometry(0.5, 0.56, 1, 12, 24));
    stalkGeo.translate(0, 0.5, 0);
    const stalkSway = new InstancedBufferAttribute(new Float32Array(stalks.length * 4), 4);
    stalkSway.setUsage(DynamicDrawUsage);
    const stalkHeight = new InstancedBufferAttribute(new Float32Array(stalks.length), 1);
    stalkGeo.setAttribute('aSway', stalkSway);
    stalkGeo.setAttribute('aHeight', stalkHeight);
    const stalkMat = keep(swayingMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0 }), { uTime: time }, { stalk: true, flutter: false, key: 'stalk' }));
    const stalkMesh = new InstancedMesh(stalkGeo, stalkMat, stalks.length);
    const greens = [new Color('#7fa846'), new Color('#93b553'), new Color('#6b9a3c'), new Color('#a9b65a')];
    stalks.forEach((s, i) => {
      _p.set(s.x, floorY - 0.05, s.z);
      _q.identity();
      _s.set(s.thick, s.h, s.thick);
      stalkMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      const c = greens[Math.floor(s.tint * greens.length)].clone().multiplyScalar(0.92 + s.tint * 0.16);
      stalkMesh.setColorAt(i, c);
      stalkSway.setXYZW(i, s.phase, s.amp, 0, -100);
      stalkHeight.setX(i, s.h);
    });
    // stalkMesh is mounted on its own below (it takes clicks).

    // Leaves in sprays at the nodes, from head height up.
    const leaves: { stalk: number; x: number; y: number; z: number; ry: number; rz: number; len: number }[] = [];
    stalks.forEach((s, si) => {
      // The deep ring is hazed by distance: fewer sprays there.
      const deep = si >= nearStalks;
      const sprays = deep ? 2 + Math.floor(r() * 2) : 4 + Math.floor(r() * 4);
      for (let k = 0; k < sprays; k++) {
        // Most sprays where the camera can see them (head height to a few metres up), a few higher.
        const y = k < 3 ? 1.3 + r() * 3.2 : 2 + r() * (s.h - 2);
        const per = deep ? 3 : 4 + Math.floor(r() * 3);
        const base = r() * Math.PI * 2;
        for (let l = 0; l < per; l++) leaves.push({ stalk: si, x: s.x, y, z: s.z, ry: base + (l / per) * 1.9 + r() * 0.4, rz: -0.2 - r() * 0.7, len: 1.0 + r() * 0.7 });
      }
    });
    const leafGeo = keep(new ShapeGeometry(leafShape(0.62, 0.075), 3));
    const leafSway = new InstancedBufferAttribute(new Float32Array(leaves.length * 4), 4);
    leafSway.setUsage(DynamicDrawUsage);
    const leafHeight = new InstancedBufferAttribute(new Float32Array(leaves.length), 1);
    leafGeo.setAttribute('aSway', leafSway);
    leafGeo.setAttribute('aHeight', leafHeight);
    const leafMat = keep(swayingMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0, side: DoubleSide }), { uTime: time }, { stalk: false, flutter: true, key: 'leaf' }));
    const leafMesh = new InstancedMesh(leafGeo, leafMat, leaves.length);
    const leafGreens = [new Color('#6fa23a'), new Color('#86b84a'), new Color('#5c8f33'), new Color('#9cc35a')];
    const leavesOf: number[][] = stalks.map(() => []);
    leaves.forEach((l, i) => {
      _p.set(l.x, floorY + l.y, l.z);
      _q.setFromEuler(_e.set(0.3 * (r() - 0.5), l.ry, l.rz, 'YXZ'));
      _s.set(l.len, l.len, l.len);
      leafMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      leafMesh.setColorAt(i, leafGreens[Math.floor(r() * leafGreens.length)]);
      const s = stalks[l.stalk];
      leafSway.setXYZW(i, s.phase, s.amp, 0, -100);
      leafHeight.setX(i, l.y / s.h);
      leavesOf[l.stalk].push(i);
    });
    group.add(leafMesh);

    // Grass tufts round the edge of the clearing.
    const grassGeo = keep(new ConeGeometry(0.03, 1, 3, 1));
    grassGeo.translate(0, 0.5, 0);
    const blades: number[][] = [];
    for (let t = 0; t < 70; t++) {
      const a = r() * Math.PI * 2;
      if (Math.sin(a) > 0.35) continue;
      const d = 1.1 + Math.pow(r(), 1.4) * 0.7;
      const tx = cx + Math.cos(a) * clearX * d, tz = cz + Math.sin(a) * clearZ * d;
      const n = 10 + Math.floor(r() * 10);
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2, rr = Math.pow(r(), 0.7) * 0.32;
        blades.push([tx + Math.cos(ang) * rr, tz + Math.sin(ang) * rr, 0.22 + r() * 0.3, r() * 6.28, Math.cos(ang) * rr * 1.1]);
      }
    }
    const grassSway = new InstancedBufferAttribute(new Float32Array(blades.length * 4), 4);
    const grassHeight = new InstancedBufferAttribute(new Float32Array(blades.length), 1);
    grassGeo.setAttribute('aSway', grassSway);
    grassGeo.setAttribute('aHeight', grassHeight);
    const grassMat = keep(swayingMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0 }), { uTime: time }, { stalk: false, flutter: false, key: 'grass' }));
    const grassMesh = new InstancedMesh(grassGeo, grassMat, blades.length);
    const grassGreens = [new Color('#7d9a3f'), new Color('#93ad4c'), new Color('#6a8a35'), new Color('#a7b85a')];
    blades.forEach(([x, z, h, ph, tilt], i) => {
      _p.set(x, floorY, z);
      _q.setFromEuler(_e.set(tilt, ph, tilt * 0.7));
      _s.set(1, h, 1);
      grassMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      grassMesh.setColorAt(i, grassGreens[Math.floor(hash(i, 3) * 4)]);
      grassSway.setXYZW(i, ph, 0.05, 0, -100);
      grassHeight.setX(i, 1);
    });
    group.add(grassMesh);

    // Mossy rocks.
    const rockGeo = keep(new DodecahedronGeometry(1, 1));
    const rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const v = new Vector3().fromBufferAttribute(rp, i);
      const n = 0.85 + 0.3 * hash(9, Math.round((v.x * 11 + v.y * 5 + v.z * 3) * 10));
      rp.setXYZ(i, v.x * n, v.y * n, v.z * n);
    }
    rockGeo.computeVertexNormals();
    const rockMat = keep(new MeshStandardMaterial({ color: '#8f9182', roughness: 0.92, metalness: 0, flatShading: true }));
    const rocks: number[][] = [
      [cx - clearX * 0.98, cz - clearZ * 0.35, 0.9, 0.55],
      [cx + clearX * 0.96, cz - clearZ * 0.2, 0.7, 0.45],
      [cx - clearX * 0.82, cz - clearZ * 0.9, 0.55, 0.4],
      [cx + clearX * 0.2, cz - clearZ * 1.05, 0.8, 0.5],
      [cx - clearX * 0.88, cz + clearZ * 0.35, 0.45, 0.32],
      [cx + clearX * 0.9, cz + clearZ * 0.45, 0.4, 0.3],
    ];
    const rockMesh = new InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach(([x, z, w, h], i) => {
      _p.set(x, floorY + h * 0.3, z);
      _q.setFromEuler(_e.set(0, hash(i, 1) * 6, 0));
      _s.set(w, h, w * 0.85);
      rockMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      rockMesh.setColorAt(i, new Color(i % 2 ? '#8b927a' : '#959585'));
    });
    group.add(rockMesh);

    // Stone lanterns (tōrō) at the front corners.
    const stoneMat = keep(new MeshStandardMaterial({ color: '#a9a596', roughness: 0.95, metalness: 0 }));
    const lanternSpots: [number, number][] = [
      [cx - clearX * 0.82, cz - clearZ * 0.3],
      [cx + clearX * 0.78, cz - clearZ * 0.12],
    ];
    const lanterns = lanternSpots.map(([x, z]) => {
      const g = new Group();
      g.position.set(x, floorY, z);
      const add = (geo: CylinderGeometry | BoxGeometry | ConeGeometry | SphereGeometry, y: number, m = stoneMat, ry = 0) => {
        keep(geo);
        const mesh = new Mesh(geo, m);
        mesh.position.y = y;
        mesh.rotation.y = ry;
        g.add(mesh);
        return mesh;
      };
      add(new CylinderGeometry(0.34, 0.42, 0.16, 8), 0.08);
      add(new CylinderGeometry(0.11, 0.14, 0.78, 8), 0.55);
      add(new BoxGeometry(0.62, 0.1, 0.62), 0.97);
      const glowMat = keep(new MeshStandardMaterial({ color: '#3a2a12', emissive: new Color('#ffc46b'), emissiveIntensity: 2.2, roughness: 1 }));
      const box = add(new BoxGeometry(0.4, 0.34, 0.4), 1.19, glowMat);
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const post = add(new BoxGeometry(0.06, 0.36, 0.06), 1.19);
        post.position.x = px * 0.19;
        post.position.z = pz * 0.19;
      }
      add(new ConeGeometry(0.52, 0.32, 4), 1.53, stoneMat, Math.PI / 4);
      add(new SphereGeometry(0.075, 10, 8), 1.74);
      const light = new PointLight('#ffb760', 3.2, 6, 1.6);
      light.position.y = 1.2;
      g.add(light);
      group.add(g);
      return { group: g, glowMat, box, light, x, z };
    });

    // The koi pond, behind on the right, with lily pads and three koi.
    const px = cx - halfX * 0.45 - 1.6, pz = cz - Math.max(clearZ * 0.84, halfZ + 4.7 + lift);
    const pondMat = keep(new ShaderMaterial({ uniforms: { uTime: time, uSplash: { value: -1 } }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: POND_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false }));
    const pond = new Mesh(keep(new PlaneGeometry(1, 1)), pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(3.6, 2.4, 1);
    pond.position.set(px, floorY + 0.008, pz);
    pond.layers.set(NO_SHADOW_LAYER);
    group.add(pond);
    const padMat = keep(new MeshStandardMaterial({ color: '#6d9a45', roughness: 0.6, metalness: 0, side: DoubleSide }));
    const padGeo = keep(new CircleGeometry(0.2, 20, 0.3, Math.PI * 2 - 0.6));
    for (let i = 0; i < 5; i++) {
      const pad = new Mesh(padGeo, padMat);
      pad.rotation.set(-Math.PI / 2, 0, r() * 6.28);
      const a = r() * 6.28, d = 0.35 + r() * 0.55;
      pad.position.set(px + Math.cos(a) * d * 1.5, floorY + 0.02, pz + Math.sin(a) * d);
      pad.scale.setScalar(0.8 + r() * 0.6);
      group.add(pad);
    }
    const koiMats = [keep(new MeshStandardMaterial({ color: '#f07a2b', roughness: 0.35 })), keep(new MeshStandardMaterial({ color: '#f5efe6', roughness: 0.35 })), keep(new MeshStandardMaterial({ color: '#e8502e', roughness: 0.35 }))];
    const koiGeo = keep(new SphereGeometry(0.5, 14, 10));
    const finGeo = keep(new ConeGeometry(0.08, 0.14, 3));
    const koi = koiMats.map((m) => {
      const g = new Group();
      const b = new Mesh(koiGeo, m);
      b.scale.set(0.09, 0.05, 0.26);
      g.add(b);
      const t = new Mesh(finGeo, m);
      t.rotation.x = -Math.PI / 2;
      t.scale.set(1, 1, 0.3);
      t.position.z = -0.16;
      g.add(t);
      group.add(g);
      return g;
    });

    // Light shafts slanting down through the grove.
    const shafts: ShaderMaterial[] = [];
    for (let i = 0; i < 5; i++) {
      const m = keep(new ShaderMaterial({ uniforms: { uTime: time, uPhase: { value: i * 1.7 } }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: SHAFT_FRAGMENT, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
      shafts.push(m);
      const shaft = new Mesh(keep(new PlaneGeometry(2.2 + r() * 1.8, 16)), m);
      shaft.position.set(cx - clearX * 0.7 + i * clearX * 0.38 + (r() - 0.5), floorY + 6.5, cz - clearZ * (0.75 + r() * 0.4));
      shaft.rotation.set(0, 0.15, -0.38);
      shaft.layers.set(NO_SHADOW_LAYER);
      group.add(shaft);
    }

    // Distant hills, hazy, for whoever orbits round.
    const hills = [
      { r: 90, h: 34, color: '#a9c2a8', base: 0.18, amp: 0.4, seed: 1 },
      { r: 130, h: 52, color: '#bfd0b6', base: 0.2, amp: 0.45, seed: 4 },
      { r: 180, h: 70, color: '#d3dcc5', base: 0.25, amp: 0.4, seed: 9 },
    ].map((hl) => {
      const m = keep(new ShaderMaterial({ uniforms: { uColor: { value: new Color(hl.color) }, uSeed: { value: hl.seed }, uBase: { value: hl.base }, uAmp: { value: hl.amp } }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: MOUNTAIN_FRAGMENT, side: BackSide, fog: false, depthWrite: false }));
      const mesh = new Mesh(keep(new CylinderGeometry(hl.r, hl.r, hl.h, 128, 1, true)), m);
      mesh.position.set(cx, floorY + hl.h / 2 - 3, cz);
      mesh.renderOrder = 2;
      mesh.layers.set(NO_SHADOW_LAYER);
      group.add(mesh);
      return mesh;
    });
    // Far to near, after the sky (they don't write depth, so the nearer ridge must be drawn last).
    hills.reverse().forEach((h, i) => (h.renderOrder = 2 + i));

    // Falling leaves.
    const fallGeo = keep(new ShapeGeometry(leafShape(0.32, 0.06), 2));
    const fallMat = keep(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: DoubleSide }));
    const falling = new InstancedMesh(fallGeo, fallMat, 46);
    falling.instanceMatrix.setUsage(DynamicDrawUsage);
    const fallTints = [new Color('#a4c45c'), new Color('#d6c25a'), new Color('#86b14b'), new Color('#c9a64a')];
    for (let i = 0; i < 46; i++) falling.setColorAt(i, fallTints[i % 4]);
    group.add(falling);

    // A shishi-odoshi: a bamboo tube that fills from a spout, tips, pours into a stone basin, and clacks back.
    const caneMat = keep(new MeshStandardMaterial({ color: '#9bb85a', roughness: 0.45, metalness: 0 }));
    const caneDark = keep(new MeshStandardMaterial({ color: '#6f8f3a', roughness: 0.5, metalness: 0 }));
    const fx = cx + clearX * 0.74, fz = cz + clearZ * 0.6;
    const fountain = new Group();
    fountain.position.set(fx, floorY, fz);
    fountain.rotation.y = FOUNTAIN_YAW;
    fountain.scale.setScalar(FOUNTAIN_SCALE);
    const basin = new Mesh(keep(new CylinderGeometry(0.42, 0.48, 0.22, 18)), stoneMat);
    basin.position.set(-0.6, 0.11, 0);
    fountain.add(basin);
    const basinWater = new Mesh(keep(new CircleGeometry(0.36, 20)), keep(new MeshStandardMaterial({ color: '#5f8f86', roughness: 0.1, metalness: 0.1 })));
    basinWater.rotation.x = -Math.PI / 2;
    basinWater.position.set(-0.6, 0.215, 0);
    fountain.add(basinWater);
    for (const z of [-0.13, 0.13]) {
      const post = new Mesh(keep(new CylinderGeometry(0.035, 0.04, 0.62, 8)), caneDark);
      post.position.set(0, 0.31, z);
      fountain.add(post);
    }
    const pivot = new Group();
    pivot.position.set(0, 0.52, 0);
    fountain.add(pivot);
    // The tube lies along x; its open mouth is at -x (over the basin), the closed heavy end at +x.
    const tube = new Mesh(keep(new CylinderGeometry(0.065, 0.07, 1.0, 12)), caneMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = -0.12;
    pivot.add(tube);
    for (const x of [0.18, -0.4]) {
      const ring = new Mesh(keep(new CylinderGeometry(0.075, 0.075, 0.025, 12)), caneDark);
      ring.rotation.z = Math.PI / 2;
      ring.position.x = x;
      pivot.add(ring);
    }
    // The spout that feeds it, on its own post, and the thin stream.
    const spoutPost = new Mesh(keep(new CylinderGeometry(0.04, 0.045, 1.1, 8)), caneDark);
    spoutPost.position.set(-1.25, 0.55, -0.05);
    fountain.add(spoutPost);
    const spout = new Mesh(keep(new CylinderGeometry(0.045, 0.045, 0.62, 10)), caneMat);
    spout.rotation.z = Math.PI / 2 + 0.2;
    spout.position.set(-0.98, 1.0, -0.05);
    fountain.add(spout);
    const stream = new Mesh(keep(new CylinderGeometry(0.012, 0.012, 0.24, 6)), keep(new MeshStandardMaterial({ color: '#d8efff', transparent: true, opacity: 0.55, roughness: 0.1 })));
    stream.position.set(-0.7, 0.8, -0.05);
    fountain.add(stream);
    group.add(fountain);

    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, fountain, pivot, fx, fz, stalks, stalkMesh, stalkSway, leafMesh, leafSway, leavesOf, grassMesh, rockMesh, lanterns, px, pz, pondMat, koi, falling, disposables };
  }, [cx, cz, halfX, halfZ, lift, clearX, clearZ, floorY, time]);

  useEffect(
    () => () => {
      scene.disposables.forEach((d) => d.dispose());
      [scene.stalkMesh, scene.leafMesh, scene.grassMesh, scene.rockMesh, scene.falling].forEach((m) => m.dispose());
    },
    [scene],
  );

  const motes = useMemo(() => {
    const n = 70;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    const r = rng(77);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.95 + r() * 0.7;
      pos[i * 3] = cx + Math.cos(a) * clearX * d;
      pos[i * 3 + 1] = floorY + 0.3 + r() * 3.2;
      pos[i * 3 + 2] = cz + Math.sin(a) * clearZ * d - 1;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    }
    const material = new ShaderMaterial({
      uniforms: { uTime: time },
      vertexShader: /* glsl */ `
uniform float uTime;
attribute vec4 aSeed;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * (0.2 + aSeed.x * 0.3) + aSeed.y * 6.28) * 0.6;
  p.y += sin(uTime * (0.3 + aSeed.z * 0.3) + aSeed.x * 6.28) * 0.3;
  p.z += cos(uTime * (0.25 + aSeed.y * 0.2) + aSeed.z * 6.28) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (3.0 + aSeed.w * 4.0) * (40.0 / -mv.z);
  vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.z * 30.0));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, d)) * vA * 0.5;
  gl_FragColor = vec4(1.0, 0.86, 0.45, a);
}`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { pos, seed, material };
  }, [time, cx, cz, clearX, clearZ, floorY]);
  useEffect(() => () => motes.material.dispose(), [motes]);

  // Onlookers: a big panda lounging by the rocks with a cane to munch, and a cub.
  const onlookers = useMemo(() => {
    const rigs: Rig[] = [buildPanda({ prop: 'bamboo', scale: 1.2 }), buildPanda({ prop: null, scale: 0.78 })];
    const holders = rigs.map(() => new Group());
    holders.forEach((h, i) => h.add(rigs[i].root));
    const shadows = rigs.map(() => createBlobShadow(palette.shadow, palette.shadowOpacity * 0.75));
    return { rigs, holders, shadows };
  }, [palette]);
  useEffect(
    () => () => {
      onlookers.rigs.forEach((r) => r.dispose());
      onlookers.shadows.forEach((s) => s.dispose());
    },
    [onlookers],
  );

  const pool = useMemo(() => new ParticlePool(220, false), []);
  useEffect(() => () => pool.dispose(), [pool]);
  const events = useRef({ fountainAt: 0, koi: -100, lantern: [1, 1], lanternAt: [-100, -100], onlooker: [-100, -100], puffs: [] as { x: number; z: number; t: number }[], shakes: [] as { stalk: number; t: number }[], endAt: -1, lastK: -1 });

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const now = clock.now;
        const wall = performance.now() / 1000;
        const ev = events.current;
        time.value = now;

        const last = sample.k === model.frameCount - 1 && sample.k > 0;
        if (last && ev.lastK !== sample.k) ev.endAt = wall;
        if (!last) ev.endAt = -1;
        ev.lastK = sample.k;

        // Onlookers by the back-left rocks.
        const spots: [number, number, number][] = [
          [scene.px - 2.2, scene.pz + 0.35, 0.45],
          [scene.px - 2.95, scene.pz + 0.95, 0.6],
        ];
        for (let i = 0; i < 2; i++) {
          const [x, z, yaw] = spots[i];
          const h = onlookers.holders[i];
          h.position.set(x, floorY, z);
          h.rotation.y = yaw;
          let pose: 'idle' | 'inspect' | 'cheer' = i === 0 ? 'inspect' : 'idle';
          let poseTime = now * 0.6 + i;
          if (ev.endAt > 0 && !calm) {
            pose = 'cheer';
            poseTime = wall - ev.endAt + i * 0.3;
          }
          const re = wall - ev.onlooker[i];
          onlookers.rigs[i].update({
            gait: 'stand', gaitPhase: 0, gaitWeight: 0,
            pose, poseWeight: pose === 'idle' ? 0 : 1, poseTime,
            prevPose: 'idle', prevWeight: 0,
            lookLocal: [0.3, 0.5, 3],
            react: re < 1.2 ? re : -1,
            time: now + i * 3.3,
            seed: 7 + i * 1.9,
          });
          const sh = onlookers.shadows[i].mesh;
          sh.position.set(x, floorY + 0.004, z);
          sh.scale.setScalar(i === 0 ? 1.05 : 0.7);
        }

        // Lanterns: light or douse on click, flicker gently.
        scene.lanterns.forEach((l, i) => {
          const target = ev.lantern[i];
          const since = wall - ev.lanternAt[i];
          const k = since < 0.6 ? (target ? since / 0.6 : 1 - since / 0.6) : target;
          const flicker = calm ? 1 : 0.92 + 0.08 * Math.sin(now * 7.3 + i * 2) * Math.sin(now * 3.1 + i);
          l.glowMat.emissiveIntensity = 0.15 + 2.1 * k * flicker;
          l.light.intensity = 3.2 * k * flicker;
        });

        // Koi swim slow circles; one leaps when the pond is clicked.
        const kt = wall - ev.koi;
        scene.koi.forEach((f, i) => {
          const a = now * (0.35 + i * 0.08) + i * 2.1;
          const rx = 0.9 - i * 0.18, rz = 0.55 - i * 0.1;
          let x = scene.px + Math.cos(a) * rx, z = scene.pz + Math.sin(a) * rz, y = floorY + 0.012;
          let pitch = 0;
          if (i === 0 && kt >= 0 && kt < 1.0) {
            const u = kt;
            y += Math.sin(Math.PI * u) * 0.9;
            pitch = -Math.cos(Math.PI * u) * 1.0;
            x = scene.px + (u - 0.5) * 0.9;
            z = scene.pz;
          }
          f.position.set(x, y, z);
          const heading = i === 0 && kt >= 0 && kt < 1.0 ? Math.PI / 2 : Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz);
          f.rotation.set(0, heading, 0);
          f.rotateX(pitch);
        });
        scene.pondMat.uniforms.uSplash.value = kt < 3 ? kt : -1;

        // Shishi-odoshi: fills (the mouth sinks as water collects), tips and pours, clacks back. Clicking tips it early.
        const cyc = calm ? 0 : (((now - ev.fountainAt) % FOUNTAIN_PERIOD) + FOUNTAIN_PERIOD) % FOUNTAIN_PERIOD;
        scene.pivot.rotation.z = -fountainTilt(cyc);
        const pour = cyc > 6.0 && cyc < 6.8 ? cyc - 6.0 : -1;

        // Shaken stalks: write the shake time into their sway attribute (and their leaves').
        if (ev.shakes.length) {
          for (const sh of ev.shakes) {
            scene.stalkSway.setW(sh.stalk, sh.t);
            for (const li of scene.leavesOf[sh.stalk]) scene.leafSway.setW(li, sh.t);
          }
          scene.stalkSway.needsUpdate = true;
          scene.leafSway.needsUpdate = true;
          ev.shakes = [];
        }

        // Falling leaves: drift down across the view, tumbling.
        const span = 7;
        for (let i = 0; i < 46; i++) {
          const speed = 0.35 + hash(i, 1) * 0.35;
          const f = calm ? hash(i, 2) : (now * speed / span + hash(i, 2)) % 1;
          const x = cx + (hash(i, 3) - 0.5) * clearX * 2.3 + Math.sin(now * 0.7 + i) * 0.5;
          const z = cz + (hash(i, 4) - 0.65) * clearZ * 2;
          const y = floorY + span * (1 - f) + 0.05;
          _p.set(x, y, z);
          _q.setFromEuler(_e.set(now * (1 + hash(i, 5)) + i, now * 0.7 + i * 2, Math.sin(now * 1.3 + i) * 0.9));
          const vis = smoothFade(f);
          _s.setScalar(1.35 * vis);
          scene.falling.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        scene.falling.instanceMatrix.needsUpdate = true;

        // Particles: pond splash, leaf swirls where the ground was clicked, leaves shaken loose.
        pool.begin();
        if (kt >= 0 && kt < 1.6) {
          for (const st of [0, 0.95]) {
            const tt = kt - st;
            if (tt < 0 || tt > 0.6) continue;
            for (let p = 0; p < 16; p++) {
              const a = hash(p, 2) * Math.PI * 2;
              const v = 0.5 + hash(p, 3) * 0.7;
              const y = floorY + 0.05 + (1.5 + hash(p, 4)) * tt - 4.5 * tt * tt;
              if (y < floorY) continue;
              pool.add(scene.px - 0.45 + st * 0.9 + Math.cos(a) * v * tt, y, scene.pz + Math.sin(a) * v * tt, 0.75, 0.9, 0.95, (1 - tt / 0.6) * 0.9, 0.06);
            }
          }
        }
        if (pour >= 0 && !calm) {
          // Water pouring from the tipped mouth into the basin.
          for (let p = 0; p < 20; p++) {
            const f = (pour * 2.4 + hash(p, 31)) % 1;
            const lx = -0.6 + (hash(p, 32) - 0.5) * 0.14;
            const ly = 0.55 - f * 0.33 + Math.sin(f * Math.PI) * 0.06;
            const lz = (hash(p, 33) - 0.5) * 0.14;
            _p.set(lx, ly, lz).applyAxisAngle(UP, FOUNTAIN_YAW);
            _p.multiplyScalar(FOUNTAIN_SCALE);
            pool.add(scene.fx + _p.x, floorY + _p.y, scene.fz + _p.z, 0.8, 0.92, 1, 0.8 * (1 - pour / 0.8), 0.05);
          }
        }
        ev.puffs = ev.puffs.filter((pf) => wall - pf.t < 1.6);
        for (const pf of ev.puffs) {
          const tt = wall - pf.t;
          for (let p = 0; p < 28; p++) {
            const a = hash(p, 8) * Math.PI * 2 + tt * 2.5;
            const rr = 0.25 + hash(p, 9) * 0.6 + tt * 0.5;
            const y = floorY + 0.05 + (hash(p, 10) * 1.2 + 0.4) * Math.sin(Math.min(1, tt / 1.6) * Math.PI);
            const c = p % 3 === 0 ? [0.85, 0.75, 0.35] : p % 3 === 1 ? [0.55, 0.72, 0.3] : [0.95, 0.72, 0.78];
            pool.add(pf.x + Math.cos(a) * rr, y, pf.z + Math.sin(a) * rr, c[0], c[1], c[2], (1 - tt / 1.6) * 0.95, 0.13 + hash(p, 12) * 0.05);
          }
        }
        pool.end();

        const busy = kt < 3 || ev.puffs.length > 0 || ev.lanternAt.some((t0) => wall - t0 < 0.7) || ev.onlooker.some((t0) => wall - t0 < 1.3);
        if (busy) invalidate();
      }),
    [driver, model, time, scene, onlookers, pool, clock, calm, cx, cz, clearX, clearZ, floorY, invalidate],
  );

  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(() => () => ground.dispose(), [ground]);

  const floorSize = Math.max(260, R * 40);
  const click = (fn: (wall: number) => void) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    fn(performance.now() / 1000);
    invalidate();
  };
  const pointer = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };

  return (
    <>
      <color attach="background" args={[haze]} />
      <fog attach="fog" args={[haze, fogNear, fogFar]} />
      {/* Drawn after the ground and bodies: depth testing skips every pixel they already cover. */}
      <mesh material={sky} renderOrder={1} frustumCulled={false} layers={NO_SHADOW_LAYER} position={[cx, floorY, cz]}>
        <sphereGeometry args={[480, 48, 24]} />
      </mesh>
      <mesh
        material={ground}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, floorY, cz]}
        renderOrder={-1}
        layers={NO_SHADOW_LAYER}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          events.current.puffs.push({ x: e.point.x, z: e.point.z, t: performance.now() / 1000 });
          if (events.current.puffs.length > 5) events.current.puffs.shift();
          invalidate();
        }}
      >
        <planeGeometry args={[floorSize, floorSize]} />
      </mesh>

      <hemisphereLight args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[cx - R * 0.6 - 4, floorY + R * 1.4 + 8, cz + R + 8]} />
      <directionalLight color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[cx + R + 6, floorY + R * 0.6 + 3, cz - R * 0.4 - 6]} />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color="#fff4dc" intensity={2} position={[-3, 7, 8]} scale={[14, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#d8f0c8" intensity={1.1} position={[8, 4, 2]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#ffe2b0" intensity={0.9} position={[-8, 4, -4]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#a8b070" intensity={0.5} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      <primitive object={scene.group} />
      <primitive
        object={scene.stalkMesh}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId === undefined) return;
          events.current.shakes.push({ stalk: e.instanceId, t: clock.now });
          const s = scene.stalks[e.instanceId];
          events.current.puffs.push({ x: s.x, z: s.z + 0.4, t: performance.now() / 1000 });
          invalidate();
        }}
        {...pointer}
      />
      {scene.lanterns.map((l, i) => (
        <mesh
          key={i}
          position={[l.x, floorY + 0.9, l.z]}
          visible={false}
          onClick={click((w) => {
            events.current.lantern[i] = events.current.lantern[i] ? 0 : 1;
            events.current.lanternAt[i] = w;
          })}
          {...pointer}
        >
          <cylinderGeometry args={[0.5, 0.5, 1.9, 10]} />
        </mesh>
      ))}
      <mesh
        position={[scene.fx - 0.5 * Math.cos(FOUNTAIN_YAW), floorY + 0.6, scene.fz + 0.5 * Math.sin(FOUNTAIN_YAW)]}
        rotation={[0, FOUNTAIN_YAW, 0]}
        visible={false}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // Tip it now: put the cycle just before the tip.
          events.current.fountainAt = clock.now - 5.85;
          invalidate();
        }}
        {...pointer}
      >
        <boxGeometry args={[2.2, 1.2, 0.8]} />
      </mesh>
      <mesh position={[scene.px, floorY + 0.15, scene.pz]} scale={[1.8, 1, 1.2]} visible={false} onClick={click((w) => (events.current.koi = w))} {...pointer}>
        <cylinderGeometry args={[1, 1, 0.3, 20]} />
      </mesh>
      {onlookers.holders.map((h, i) => (
        <primitive key={i} object={h} onClick={click((w) => (events.current.onlooker[i] = w))} onPointerOver={pointer.onPointerOver} onPointerOut={pointer.onPointerOut} />
      ))}
      {onlookers.shadows.map((s, i) => (
        <primitive key={`os${i}`} object={s.mesh} />
      ))}
      <points frustumCulled={false} material={motes.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[motes.seed, 4]} />
        </bufferGeometry>
      </points>
      <primitive object={pool.points} />
    </>
  );
}

const UP = new Vector3(0, 1, 0);
const FOUNTAIN_YAW = -0.35;
const FOUNTAIN_PERIOD = 7;
const FOUNTAIN_SCALE = 1.3;

/** The shishi-odoshi's tilt through its cycle (positive: mouth up). */
function fountainTilt(t: number): number {
  if (t < 5.9) return 0.32 - (t / 5.9) * 0.3;
  if (t < 6.15) return 0.02 - ((t - 5.9) / 0.25) * 0.62;
  if (t < 6.45) return -0.6;
  const u = Math.min(1, (t - 6.45) / 0.55);
  return -0.6 + 0.92 * Math.min(1, u * 1.6) - 0.12 * Math.sin(u * Math.PI * 3) * (1 - u);
}

/** Leaves appear near the top of their fall and fade before they land. */
function smoothFade(f: number): number {
  const a = Math.min(1, f / 0.08);
  const b = Math.min(1, (1 - f) / 0.12);
  return Math.max(0, Math.min(a, b));
}

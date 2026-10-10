import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  AdditiveBlending,
  HemisphereLight,
  Points,
  Sprite,
  SpriteMaterial,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type Object3D,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  type DirectionalLight,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
  Vector4,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { StageSample } from '../../model/sampler';
import { NO_SHADOW_LAYER } from '../../three/StageEnvironment';
import { FOG, NOISE, dotTexture, fogUniforms, rng } from './glsl';
import { FOUNTAIN_YAW, GROVE_SPREAD, groveClearing, pandaSpots, worldLayout } from './layout';
import { buildColonyProps } from './colonyProps';
import { batchStatic } from '../../three/batch';
import { LightPool } from '../../three/lightPool';
import { swingAngle } from '../idle';
import { ParticlePool, hash } from './particles';
import type { WorldProps } from './PolarWorld';
import { useGovernedInvalidate } from '../../three/perf';

const SKY = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uDay;
uniform float uNight;
uniform float uDusk;
vec3 groveSky(vec3 d) {
  float h = d.y;
  // Day: pale teal over warm haze. Dusk and dawn: a rosy, golden band low down. Night: deep blue.
  vec3 top = mix(vec3(0.56, 0.78, 0.76), vec3(0.45, 0.52, 0.7), uDusk * 0.55);
  vec3 low = mix(vec3(0.97, 0.9, 0.78), vec3(1.0, 0.68, 0.48), uDusk * 0.8);
  top = mix(top, vec3(0.03, 0.05, 0.12), uNight);
  low = mix(low, vec3(0.1, 0.13, 0.24), uNight);
  vec3 col = mix(low, top, smoothstep(-0.02, 0.5, h));
  float sunUp = smoothstep(-0.12, 0.04, uSun.y);
  float s = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.86, 0.6) * (pow(s, 12.0) * 0.35 + pow(s, 300.0) * 0.9) * sunUp;
  col = mix(col, vec3(1.0, 0.94, 0.74) * 1.2, smoothstep(0.99905, 0.99935, s) * sunUp);
  col += vec3(1.0, 0.5, 0.25) * pow(s, 5.0) * 0.35 * uDusk;
  float az = atan(d.z, d.x);
  float cloud = smoothstep(0.55, 0.85, fbm(vec2(az * 3.0 + uTime * 0.004, h * 9.0)));
  float cloudy = cloud * smoothstep(0.03, 0.15, h);
  // Stars, twinkling, above the bamboo, behind the clouds.
  vec2 sp = vec2(az * 70.0, h * 90.0);
  vec2 sc = floor(sp);
  float star = step(0.985, hash12(sc)) * (1.0 - smoothstep(0.05, 0.22, length(fract(sp) - 0.5)));
  star *= 0.55 + 0.45 * sin(uTime * (1.5 + hash12(sc + 4.0) * 3.0) + hash12(sc + 9.0) * 30.0);
  col += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.08, 0.3, h) * (1.0 - cloudy);
  // The moon: a pale disc with soft grey seas, and a halo of moonlight round it.
  float m = dot(d, uMoon);
  float moonUp = smoothstep(-0.06, 0.06, uMoon.y) * (1.0 - 0.8 * uDay);
  float disc = smoothstep(0.9979, 0.9983, m);
  vec3 mx = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
  vec3 my = cross(mx, uMoon);
  vec2 mp = vec2(dot(d, mx), dot(d, my)) * 16.0;
  vec3 moon = vec3(0.96, 0.95, 0.88) * (0.82 + 0.18 * smoothstep(0.35, 0.65, fbm(mp * 3.0 + 7.0)));
  col = mix(col, moon, disc * moonUp);
  col += vec3(0.55, 0.65, 0.9) * (pow(max(m, 0.0), 60.0) * 0.34 + pow(max(m, 0.0), 700.0) * 0.55) * moonUp * (1.0 - disc);
  vec3 cloudCol = mix(mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.78, 0.66), uDusk * 0.7), vec3(0.16, 0.19, 0.29) + vec3(0.25, 0.28, 0.35) * pow(max(m, 0.0), 30.0) * moonUp, uNight);
  col = mix(col, cloudCol, cloudy * 0.55);
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
uniform vec3 uTint;
uniform vec3 uLamps[LAMPS];
uniform vec4 uSeg[SEGS];
uniform vec4 uPad[PADS];
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

  // The paths between the colony's places (packed earth with flat stepping stones), and the pads the places stand on.
  float pd = 1e3;
  for (int i = 0; i < SEGS; i++) {
    vec4 sg = uSeg[i];
    vec2 pa = p - sg.xy;
    vec2 ba = sg.zw - sg.xy;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    pd = min(pd, length(pa - ba * h));
  }
  float pedge = (fbm(p * 1.9 + 5.0) - 0.5) * 0.32;
  float pathM = 1.0 - smoothstep(0.4, 0.62, pd + pedge);
  vec2 vc = voronoi(p * 1.5);
  float flag = smoothstep(0.09, 0.17, vc.y);
  vec3 pathCol = mix(vec3(0.7, 0.62, 0.47), vec3(0.8, 0.77, 0.69), flag * (1.0 - smoothstep(0.2, 0.45, pd)));
  pathCol *= 0.94 + 0.1 * fbm(p * 3.0);
  col = mix(col, pathCol, pathM * 0.9);
  for (int i = 0; i < PADS; i++) {
    vec4 pv = uPad[i];
    float dd = length(p - pv.xy) / pv.z + pedge * 0.4;
    float on = 1.0 - smoothstep(0.9, 1.0, dd);
    vec3 pc = pv.w < 0.5 ? mix(vec3(0.24, 0.21, 0.19), vec3(0.6, 0.56, 0.48), smoothstep(0.08, 0.5, dd))
      : pv.w < 1.5 ? vec3(0.87, 0.79, 0.6) * (0.95 + 0.06 * sin(p.x * 8.0 + fbm(p) * 3.0))
      : pv.w < 2.5 ? vec3(0.8, 0.7, 0.4) * (0.9 + 0.14 * fbm(p * 6.0))
      : vec3(0.74, 0.66, 0.5) * (0.95 + 0.08 * fbm(p * 4.0));
    float rim = smoothstep(0.78, 0.88, dd) * (1.0 - smoothstep(0.92, 1.0, dd));
    pc = mix(pc, mix(vec3(0.55, 0.53, 0.47), vec3(0.78, 0.76, 0.7), hash12(floor(p * 3.0))), rim * 0.6);
    col = mix(col, pc, on * 0.92);
  }
  // Daylight (or moonlight), and warm pools of light round the lanterns after dark.
  col *= uTint;
  vec3 pool = vec3(0.0);
  for (int i = 0; i < LAMPS; i++) {
    vec2 dl = p - uLamps[i].xy;
    pool += vec3(1.0, 0.6, 0.28) * uLamps[i].z * exp(-dot(dl, dl) / (4.5 + 2.6 * max(0.0, uLamps[i].z - 0.8)));
  }
  col += pool * (0.45 + 0.55 * col);
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
uniform vec3 uTint;
uniform float uNight;
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
  col *= uTint;
  // Moonlight glinting on the ripples.
  col += vec3(0.75, 0.82, 1.0) * uNight * (0.12 * smoothstep(0.62, 0.9, fbm(p * 3.0 + vec2(uTime * 0.08, 1.0))) + 0.05 * ripple);
  float a = 1.0 - smoothstep(0.94, 1.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

const SHAFT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uDay;
varying vec2 vUv;
void main() {
  float across = sin(vUv.x * 3.14159);
  float a = across * across * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
  a *= (0.2 + 0.08 * sin(uTime * 0.35 + uPhase)) * uDay;
  gl_FragColor = vec4(1.0, 0.93, 0.72, a);
}
`;

/**
 * Sway shared by stalks, leaves and grass: the higher on the stalk, the further it moves. A slow gust front rolls
 * across the grove (each stalk meets it a little after its neighbour), every stalk has its own rhythm, lean direction
 * and amplitude, and the time only ever enters through sines of fixed frequency (so nothing ever jumps).
 */
const SWAY = /* glsl */ `
uniform float uTime;
uniform float uWind;
vec2 sway(vec4 s, float h, vec2 bp) {
  float since = uTime - s.w;
  float shake = since >= 0.0 && since < 4.5 ? 0.16 * exp(-since * 0.9) * sin(since * 6.2) : 0.0;
  float k = h * h;
  float front = 0.5 + 0.5 * sin(uTime * 0.42 - dot(bp, vec2(0.21, 0.13)) + s.x * 0.2);
  float amp = s.y * (0.55 + 0.9 * front * (0.35 + uWind * 1.4));
  float dirA = 0.7 + 0.4 * sin(s.x * 1.7) + 0.15 * sin(uTime * 0.11 + s.x);
  vec2 d = vec2(cos(dirA), sin(dirA));
  vec2 across = vec2(-d.y, d.x);
  float rate = 0.5 + 0.18 * fract(s.x * 3.1);
  float a = sin(uTime * rate + s.x) * 0.65 + sin(uTime * rate * 0.53 + s.x * 2.3) * 0.35;
  float b = sin(uTime * rate * 0.77 + s.x * 1.4 + 1.0);
  vec2 off = d * (a * amp + amp * 0.5 * front) + across * (b * amp * 0.3);
  vec2 jolt = vec2(cos(s.x * 3.0), sin(s.x * 3.0)) * shake;
  return (off + jolt) * k;
}
`;

/** Gusts of wind: shared by every swaying thing in the grove (stalks, leaves, grass). */
const WIND = { value: 0 };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _focus = new Vector3();
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
    shader.uniforms.uWind = WIND;
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
#ifdef USE_INSTANCING
vec2 bp = instanceMatrix[3].xz;
#else
vec2 bp = vec2(0.0);
#endif
mvPosition.xz += sway(aSway, hf, bp);
${opts.flutter ? 'mvPosition.y += sin(uTime * 1.7 + aSway.x * 5.0 + position.x * 4.0) * 0.02 * position.x;' : ''}
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
  const invalidate = useGovernedInvalidate();
  const palette = model.palette;
  const floorY = model.floorY;
  const { radius: R } = bounds;
  const { cx, cz, halfX, halfZ, lift } = useMemo(() => worldLayout(model), [model]);
  const { clearX, clearZ } = useMemo(() => groveClearing(model), [model]);
  // The grove is about three times the ground it was: the haze, the hills and the bamboo behind all stand further back.
  const fogNear = R * 2.6 + 10 + clearZ * 0.5;
  const fogFar = R * 8 + 55 + Math.max(clearX, clearZ) * 2.2;
  const haze = '#e6e6cf';
  const time = useMemo(() => ({ value: 0 }), []);
  // The time of day, shared by every shader in the grove (the sky, the ground, the pond, the hills, the light shafts).
  const sky$ = useMemo(
    () => ({
      uSun: { value: new Vector3(0.57, 0.17, -0.8) },
      uMoon: { value: new Vector3(-0.57, -0.17, -0.8) },
      uDay: { value: 1 },
      uNight: { value: 0 },
      uDusk: { value: 0 },
      uTint: { value: new Color(1, 1, 1) },
      uLamps: { value: Array.from({ length: LAMPS }, () => new Vector3(0, 0, 0)) },
    }),
    [],
  );
  // The paths and the pads the colony's places stand on (drawn into the ground).
  const trails = useMemo(() => {
    const places = pandaSpots(model).places;
    const segs: Vector4[] = [];
    for (const path of places.paths) for (let i = 0; i + 1 < path.length; i++) segs.push(new Vector4(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
    const pads = places.pads.map(([x, z, r, kind]) => new Vector4(x, z, r, kind));
    return { segs, pads };
  }, [model]);

  const sky = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: time, uSun: sky$.uSun, uMoon: sky$.uMoon, uDay: sky$.uDay, uNight: sky$.uNight, uDusk: sky$.uDusk },
        vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `${NOISE}\n${SKY}\nvarying vec3 vDir;\nvoid main() { gl_FragColor = vec4(groveSky(normalize(vDir)), 1.0);\n#include <colorspace_fragment>\n}`,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [time, sky$],
  );
  const ground = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: time,
          uCenter: { value: [cx, cz] },
          uClear: { value: [clearX, clearZ] },
          uEarth: { value: new Color(palette.floor) },
          uTint: sky$.uTint,
          uLamps: sky$.uLamps,
          uSeg: { value: trails.segs },
          uPad: { value: trails.pads },
          ...fogUniforms(haze, fogNear, fogFar),
        },
        vertexShader: WORLD_VERTEX,
        fragmentShader: `#define LAMPS ${LAMPS}\n#define SEGS ${trails.segs.length}\n#define PADS ${trails.pads.length}\n${GROUND_FRAGMENT}`,
        toneMapped: false,
      }),
    [time, cx, cz, clearX, clearZ, palette.floor, fogNear, fogFar, sky$, trails],
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
    const clumps = Math.round(26 * GROVE_SPREAD * 0.9);
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
    // Clumps of bamboo that stand in the front strip, where pandas stop to eat: they rustle when a panda is at them.
    const spots = pandaSpots(model);
    const snackStalks: number[][] = [];
    spots.snack.forEach((clump) => {
      const ids: number[] = [];
      clump.stalks.forEach(([x, z], i) => {
        ids.push(stalks.length);
        stalks.push({ x, z, h: 6.2 + i * 0.8, thick: 0.15 + i * 0.015, phase: r() * 6.28, amp: 0.05 + r() * 0.04, tint: r() });
      });
      snackStalks.push(ids);
    });
    const nearStalks = stalks.length;
    // A second, deeper ring for density behind.
    for (let i = 0; i < 96; i++) {
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
    for (let t = 0; t < 130; t++) {
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
    const rocks = spots.stones.rocks;
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
    const lanternSpots = spots.stones.lanterns;
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
      // A source for the light pool (hidden: the pool lends a real light to the ones that matter).
      const light = new PointLight('#ffb760', 3.2, 6, 1.6);
      light.position.y = 1.2;
      light.visible = false;
      g.add(light);
      group.add(g);
      return { group: g, glowMat, box, light, x, z };
    });

    // The koi pond, behind on the right, with lily pads and three koi.
    const px = spots.pond.x, pz = spots.pond.z;
    const pondMat = keep(new ShaderMaterial({ uniforms: { uTime: time, uSplash: { value: -1 }, uTint: sky$.uTint, uNight: sky$.uNight }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: POND_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false }));
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
      const m = keep(new ShaderMaterial({ uniforms: { uTime: time, uPhase: { value: i * 1.7 }, uDay: sky$.uDay }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: SHAFT_FRAGMENT, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
      shafts.push(m);
      const shaft = new Mesh(keep(new PlaneGeometry(2.2 + r() * 1.8, 16)), m);
      shaft.position.set(cx - clearX * 0.7 + i * clearX * 0.38 + (r() - 0.5), floorY + 6.5, cz - clearZ * (0.75 + r() * 0.4));
      shaft.rotation.set(0, 0.15, -0.38);
      shaft.layers.set(NO_SHADOW_LAYER);
      group.add(shaft);
    }

    // Distant hills, hazy, for whoever orbits round.
    const hillTones: { mat: ShaderMaterial; day: Color; dusk: Color; night: Color }[] = [];
    const hills = [
      { r: 90, h: 34, color: '#a9c2a8', dusk: '#b59a95', night: '#1d2638', base: 0.18, amp: 0.4, seed: 1 },
      { r: 130, h: 52, color: '#bfd0b6', dusk: '#c8a59a', night: '#232d42', base: 0.2, amp: 0.45, seed: 4 },
      { r: 180, h: 70, color: '#d3dcc5', dusk: '#d8b2a0', night: '#29344b', base: 0.25, amp: 0.4, seed: 9 },
    ].map((hl) => {
      const m = keep(new ShaderMaterial({ uniforms: { uColor: { value: new Color(hl.color) }, uSeed: { value: hl.seed }, uBase: { value: hl.base }, uAmp: { value: hl.amp } }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: MOUNTAIN_FRAGMENT, side: BackSide, fog: false, depthWrite: false }));
      hillTones.push({ mat: m, day: new Color(hl.color), dusk: new Color(hl.dusk), night: new Color(hl.night) });
      const reach = Math.max(1, (Math.max(clearX, clearZ) * 3.4) / 100);
      const mesh = new Mesh(keep(new CylinderGeometry(hl.r * reach, hl.r * reach, hl.h * reach, 128, 1, true)), m);
      mesh.position.set(cx, floorY + (hl.h * reach) / 2 - 3, cz);
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
    const falling = new InstancedMesh(fallGeo, fallMat, LEAVES);
    falling.instanceMatrix.setUsage(DynamicDrawUsage);
    const fallTints = [new Color('#a4c45c'), new Color('#d6c25a'), new Color('#86b14b'), new Color('#c9a64a')];
    for (let i = 0; i < LEAVES; i++) falling.setColorAt(i, fallTints[i % 4]);
    group.add(falling);

    // A shishi-odoshi: a bamboo tube that fills from a spout, tips, pours into a stone basin, and clacks back.
    const caneMat = keep(new MeshStandardMaterial({ color: '#9bb85a', roughness: 0.45, metalness: 0 }));
    const caneDark = keep(new MeshStandardMaterial({ color: '#6f8f3a', roughness: 0.5, metalness: 0 }));
    const [fx, fz] = spots.stones.fountain;
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

    // The bamboo gym: a lashed deck on bamboo legs, a ladder of two poles with rungs, a beam with a rope and a bead.
    const gym = spots.gym;
    const strut = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number, mat: MeshStandardMaterial) => {
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const mesh = new Mesh(keep(new CylinderGeometry(radius, radius * 1.06, len, 9)), mat);
      mesh.position.set((ax + bx) / 2, floorY + (ay + by) / 2, (az + bz) / 2);
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(bx - ax, by - ay, bz - az).normalize());
      group.add(mesh);
      return mesh;
    };
    const H = gym.height;
    for (const sx of [-0.62, 0.62]) {
      strut(gym.x + sx, 0, gym.z - 0.42, gym.x + sx, 2.15, gym.z - 0.42, 0.075, caneMat);
      strut(gym.x + sx, 0, gym.z + 0.46, gym.x + sx, H - 0.04, gym.z + 0.46, 0.065, caneDark);
      strut(gym.x + sx * 0.88, H - 0.1, gym.z - 0.5, gym.x + sx * 0.88, H - 0.1, gym.z + 0.55, 0.05, caneDark);
    }
    for (let i = 0; i < 8; i++) strut(gym.x - 0.7, H, gym.z - 0.46 + i * 0.13, gym.x + 0.7, H, gym.z - 0.46 + i * 0.13, 0.055, i % 2 ? caneMat : caneDark);
    strut(gym.x - 0.7, 2.15, gym.z - 0.42, gym.x + 0.7, 2.15, gym.z - 0.42, 0.06, caneDark);
    for (const ox of [-0.2, 0.2]) strut(gym.base[0] + ox, 0, gym.base[1], gym.top[0] + ox, H, gym.top[1], 0.055, caneMat);
    for (let i = 1; i <= 4; i++) {
      const u = i / 5;
      strut(gym.base[0] - 0.2 + (gym.top[0] - gym.base[0]) * u, H * u, gym.base[1] + (gym.top[1] - gym.base[1]) * u, gym.base[0] + 0.2 + (gym.top[0] - gym.base[0]) * u, H * u, gym.base[1] + (gym.top[1] - gym.base[1]) * u, 0.032, caneDark);
    }
    // A rope with a bead hangs from the beam and sways in the wind.
    const dangle = new Group();
    dangle.position.set(gym.x + 0.25, floorY + 2.15, gym.z - 0.42);
    const cord = new Mesh(keep(new CylinderGeometry(0.012, 0.012, 1.1, 5)), keep(new MeshStandardMaterial({ color: '#c9a66b', roughness: 0.9 })));
    cord.position.y = -0.55;
    dangle.add(cord);
    const bead = new Mesh(keep(new SphereGeometry(0.1, 12, 10)), keep(new MeshStandardMaterial({ color: '#d9553b', roughness: 0.5 })));
    bead.position.y = -1.12;
    dangle.add(bead);
    group.add(dangle);

    // The slide: a lashed platform on four bamboo legs, a ladder up the back, and a smooth chute down to the left.
    const sl = spots.slide;
    const chuteMat = keep(new MeshStandardMaterial({ color: '#d8a24e', roughness: 0.32, metalness: 0.05 }));
    const deckMat = keep(new MeshStandardMaterial({ color: '#c9a65f', roughness: 0.75, metalness: 0 }));
    {
      const [tx, tz] = [sl.top[0], sl.top[1] - 0.15];
      const SH = sl.height;
      for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.42], [0.45, 0.42]]) strut(tx + ox, 0, tz + oz, tx + ox, SH + 0.55, tz + oz, 0.055, caneMat);
      for (let i = 0; i < 7; i++) strut(tx - 0.5, SH, tz - 0.42 + i * 0.14, tx + 0.5, SH, tz - 0.42 + i * 0.14, 0.05, i % 2 ? caneMat : caneDark);
      // Hand rails round the platform (open on the chute's side).
      strut(tx - 0.45, SH + 0.5, tz - 0.45, tx + 0.45, SH + 0.5, tz - 0.45, 0.035, caneDark);
      strut(tx + 0.45, SH + 0.5, tz - 0.45, tx + 0.45, SH + 0.5, tz + 0.42, 0.035, caneDark);
      strut(tx - 0.45, SH + 0.5, tz + 0.42, tx + 0.45, SH + 0.5, tz + 0.42, 0.035, caneDark);
      // The ladder, from its foot up to the back of the platform.
      const [bx, bz] = sl.base;
      for (const ox of [-0.2, 0.2]) strut(bx + ox, 0, bz, tx + ox, SH + 0.3, tz - 0.48, 0.04, caneMat);
      for (let i = 1; i <= 5; i++) {
        const u = i / 6;
        const y = (SH + 0.3) * u;
        const zz = bz + (tz - 0.48 - bz) * u;
        strut(bx - 0.2 + (tx - bx) * u, y, zz, bx + 0.2 + (tx - bx) * u, y, zz, 0.026, caneDark);
      }
      // The chute: a bed with raised sides, from the platform's edge down to a short run-out above the ground.
      const sx = tx - 0.5, sy = SH - 0.02, ex = sl.end[0] + 0.25, ey = sl.endHeight + 0.02;
      const len = Math.hypot(sx - ex, sy - ey);
      const slope = Math.atan2(sy - ey, sx - ex);
      const chute = new Group();
      chute.position.set((sx + ex) / 2, floorY + (sy + ey) / 2, sl.end[1]);
      chute.rotation.z = slope;
      const bed = new Mesh(keep(new BoxGeometry(len, 0.05, 0.62)), chuteMat);
      chute.add(bed);
      for (const oz of [-0.32, 0.32]) {
        const side = new Mesh(keep(new BoxGeometry(len, 0.16, 0.04)), chuteMat);
        side.position.set(0, 0.06, oz);
        chute.add(side);
        const rail = new Mesh(keep(new CylinderGeometry(0.03, 0.03, len, 8)), caneDark);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 0.15, oz);
        chute.add(rail);
      }
      group.add(chute);
      const lip = new Mesh(keep(new BoxGeometry(0.62, 0.05, 0.62)), chuteMat);
      lip.position.set(sl.end[0] - 0.05, floorY + sl.endHeight, sl.end[1]);
      group.add(lip);
      for (const oz of [-0.25, 0.25]) strut(sl.end[0], 0, sl.end[1] + oz, sl.end[0], sl.endHeight, sl.end[1] + oz, 0.04, caneDark);
      const midX = (sx + ex) / 2;
      for (const oz of [-0.25, 0.25]) strut(midX, 0, sl.end[1] + oz, midX, (sy + ey) / 2 - 0.04, sl.end[1] + oz, 0.04, caneDark);
    }

    // The swing: an A-frame of bamboo at each end of a cross bar, two ropes and a plank seat (swung by the world).
    const sw = spots.swing;
    const fwd = [Math.sin(sw.face), Math.cos(sw.face)];
    const right = [Math.cos(sw.face), -Math.sin(sw.face)];
    const SPAN = 0.85;
    for (const side of [-1, 1]) {
      const ax = sw.x + right[0] * SPAN * side, az = sw.z + right[1] * SPAN * side;
      for (const f of [-1, 1]) strut(ax + fwd[0] * 0.75 * f, 0, az + fwd[1] * 0.75 * f, ax, sw.top + 0.04, az, 0.055, caneMat);
      strut(ax + fwd[0] * 0.5, 0.6, az + fwd[1] * 0.5, ax - fwd[0] * 0.5, 0.6, az - fwd[1] * 0.5, 0.035, caneDark);
    }
    strut(sw.x - right[0] * (SPAN + 0.15), sw.top + 0.04, sw.z - right[1] * (SPAN + 0.15), sw.x + right[0] * (SPAN + 0.15), sw.top + 0.04, sw.z + right[1] * (SPAN + 0.15), 0.06, caneDark);
    const swingPivot = new Group();
    swingPivot.position.set(sw.x, floorY + sw.top, sw.z);
    swingPivot.rotation.y = sw.face;
    const swingArm = new Group();
    swingPivot.add(swingArm);
    const ropeMat = keep(new MeshStandardMaterial({ color: '#c9a66b', roughness: 0.9 }));
    for (const ox of [-0.33, 0.33]) {
      const rope = new Mesh(keep(new CylinderGeometry(0.014, 0.014, sw.length, 5)), ropeMat);
      rope.position.set(ox, -sw.length / 2, 0);
      swingArm.add(rope);
    }
    const plank = new Mesh(keep(new BoxGeometry(0.8, 0.06, 0.34)), deckMat);
    plank.position.set(0, -sw.length - 0.03, 0);
    swingArm.add(plank);
    group.add(swingPivot);

    // Paper lanterns on bamboo posts round the clearing: dim red paper by day, glowing at night.
    const paperMats: MeshStandardMaterial[] = [];
    const hanging = spots.lanterns.map(([x, z], i) => {
      const g = new Group();
      g.position.set(x, floorY, z);
      const toward = Math.atan2(cx - x, cz - z);
      g.rotation.y = toward;
      const post = new Mesh(keep(new CylinderGeometry(0.05, 0.06, 2.3, 8)), caneMat);
      post.position.y = 1.15;
      g.add(post);
      const arm = new Mesh(keep(new CylinderGeometry(0.03, 0.03, 0.62, 6)), caneDark);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(0, 2.18, 0.28);
      g.add(arm);
      const hang = new Group();
      hang.position.set(0, 2.16, 0.54);
      g.add(hang);
      const paper = keep(new MeshStandardMaterial({ color: i % 3 === 1 ? '#e2b34f' : '#c23a26', roughness: 0.8, emissive: new Color(i % 3 === 1 ? '#ffb347' : '#ff6a2a'), emissiveIntensity: 0.12 }));
      paperMats.push(paper);
      const cord = new Mesh(keep(new CylinderGeometry(0.008, 0.008, 0.16, 4)), caneDark);
      cord.position.y = -0.08;
      hang.add(cord);
      const shade = new Mesh(keep(new SphereGeometry(0.2, 14, 10)), paper);
      shade.scale.set(1, 1.2, 1);
      shade.position.y = -0.38;
      hang.add(shade);
      for (const y of [-0.15, -0.61]) {
        const cap = new Mesh(keep(new CylinderGeometry(0.1, 0.1, 0.05, 10)), caneDark);
        cap.position.y = y;
        hang.add(cap);
      }
      const tassel = new Mesh(keep(new CylinderGeometry(0.015, 0.03, 0.16, 6)), caneDark);
      tassel.position.y = -0.72;
      hang.add(tassel);
      // Three of them light the ground and the pandas round them (the rest glow, and pool light on the earth).
      let light: PointLight | null = null;
      if (i === 0 || i === 3 || i === 5) {
        light = new PointLight('#ffa552', 0, 7, 1.6);
        light.position.set(0, 1.75, 0.54);
        light.visible = false;
        g.add(light);
      }
      group.add(g);
      return { x, z, hang, light, glowX: x + Math.sin(toward) * 0.54, glowZ: z + Math.cos(toward) * 0.54 };
    });

    // Fireflies over the grass and between the stalks after dark.
    const flies = (() => {
      const n = 220;
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = 0.3 + Math.sqrt(r()) * 0.95;
        pos[i * 3] = cx + Math.cos(a) * clearX * d;
        pos[i * 3 + 1] = floorY + 0.25 + r() * 2.4;
        pos[i * 3 + 2] = cz + Math.sin(a) * clearZ * d;
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
      }
      const geo = keep(new BufferGeometry());
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
      const mat = keep(
        new ShaderMaterial({
          uniforms: { uTime: time, uNight: sky$.uNight },
          vertexShader: /* glsl */ `
uniform float uTime;
uniform float uNight;
attribute vec4 aSeed;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * (0.25 + aSeed.x * 0.25);
  p.x += sin(t + aSeed.y * 6.28) * 1.1 + sin(t * 2.3 + aSeed.z * 9.0) * 0.3;
  p.y += sin(t * 1.3 + aSeed.x * 6.28) * 0.45;
  p.z += cos(t * 0.9 + aSeed.z * 6.28) * 0.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float blink = pow(0.5 + 0.5 * sin(uTime * (0.9 + aSeed.w * 1.6) + aSeed.y * 40.0), 4.0);
  vA = uNight * (0.15 + 0.85 * blink);
  gl_PointSize = (5.0 + aSeed.w * 4.0) * (40.0 / -mv.z) * step(0.01, uNight);
  gl_Position = projectionMatrix * mv;
}`,
          fragmentShader: /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.35, d);
  float glow = 1.0 - smoothstep(0.0, 1.0, d);
  gl_FragColor = vec4(vec3(0.8, 1.0, 0.45) * (core + glow * 0.6), (core * 0.9 + glow * 0.45) * vA);
}`,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
      );
      const pts = new Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 6;
      pts.layers.set(NO_SHADOW_LAYER);
      group.add(pts);
      return pts;
    })();

    // Butterflies in the clearing and birds far off over the grove, each a pair of wings that beat.
    const flyer = (count: number, wing: number, seedBase: number, colors: string[], fog: boolean) => {
      const geo = keep(new BufferGeometry());
      // Two triangles meeting at the body: a V of wings (x is the span), flapped in the shader.
      geo.setAttribute('position', new Float32BufferAttribute([0, 0, 0.5, -1, 0, 0.9, -0.85, 0, -0.55, 0, 0, 0.5, 1, 0, 0.9, 0.85, 0, -0.55], 3));
      const phase = new InstancedBufferAttribute(new Float32Array(count), 1);
      for (let i = 0; i < count; i++) phase.setX(i, hash(i + seedBase, 3) * 6.28);
      geo.setAttribute('aPhase', phase);
      const mat = keep(
        new ShaderMaterial({
          uniforms: { uTime: time, uWing: { value: wing } },
          vertexShader: /* glsl */ `
uniform float uTime;
uniform float uWing;
attribute float aPhase;
varying vec3 vColor;
void main() {
  vec3 p = position * uWing;
  float beat = sin(uTime * ${wing > 0.5 ? '4.2' : '15.0'} + aPhase);
  p.y += beat * abs(position.x) * uWing * ${wing > 0.5 ? '0.35' : '0.9'};
  vColor = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`,
          fragmentShader: /* glsl */ `
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }`,
          side: DoubleSide,
          fog: false,
          toneMapped: false,
        }),
      );
      void fog;
      const mesh = new InstancedMesh(geo, mat, count);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      for (let i = 0; i < count; i++) mesh.setColorAt(i, new Color(colors[i % colors.length]));
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    const butterflies = flyer(5, 0.12, 100, ['#f4a52e', '#f7f3e3', '#e9728f', '#6fa8f0', '#f6d84a'], false);
    const birds = flyer(7, 0.8, 200, ['#2e3a3f', '#3b474b'], true);

    // The colony's furniture and equipment: beds and mats, chairs, a desk, a board, the gym, the campfire, a fence, lamp posts.
    const props = buildColonyProps(spots.places, floorY);
    group.add(props.group);
    disposables.push({ dispose: () => props.dispose() });

    // Seven lanterns and fires, three real lights: the pool lends them to whichever matter most to where the camera looks.
    const lightPool = new LightPool(3);
    group.add(...lightPool.lights);
    const lightSources = [...lanterns.map((l) => l.light), ...hanging.flatMap((h) => (h.light ? [h.light] : [])), props.fire.light];
    // The still scenery (stone lanterns, fountain, slide, swing frame, gym) becomes a few meshes per material;
    // what the world moves stays its own object. The colony props were batched when they were built.
    batchStatic(group, {
      dynamic: new Set<Object3D>([dangle, pivot, swingArm, ...koi, ...hanging.map((h) => h.hang)]),
      keep: new Set<Object3D>([props.group]),
      onGeometry: (geo) => disposables.push(geo),
    });
    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, props, lightPool, lightSources, gym, snackStalks, dangle, butterflies, birds, fountain, pivot, fx, fz, stalks, stalkMesh, stalkSway, leafMesh, leafSway, leavesOf, grassMesh, rockMesh, lanterns, px, pz, pondMat, koi, falling, hillTones, swingArm, hanging, paperMats, flies, disposables };
  }, [cx, cz, clearX, clearZ, floorY, time, model, sky$]);

  useEffect(
    () => () => {
      scene.disposables.forEach((d) => d.dispose());
      [scene.stalkMesh, scene.leafMesh, scene.grassMesh, scene.rockMesh, scene.falling].forEach((m) => m.dispose());
    },
    [scene],
  );

  const motes = useMemo(() => {
    const n = 130;
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
      uniforms: { uTime: time, uDay: sky$.uDay },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uDay;
attribute vec4 aSeed;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * (0.2 + aSeed.x * 0.3) + aSeed.y * 6.28) * 0.6;
  p.y += sin(uTime * (0.3 + aSeed.z * 0.3) + aSeed.x * 6.28) * 0.3;
  p.z += cos(uTime * (0.25 + aSeed.y * 0.2) + aSeed.z * 6.28) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (3.0 + aSeed.w * 4.0) * (40.0 / -mv.z);
  vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.z * 30.0))) * (0.15 + 0.85 * uDay);
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
  }, [time, cx, cz, clearX, clearZ, floorY, sky$]);
  useEffect(() => () => motes.material.dispose(), [motes]);

  const pool = useMemo(() => new ParticlePool(220, false), []);
  useEffect(() => () => pool.dispose(), [pool]);
  const keyLight = useRef<DirectionalLight>(null);
  const fillLight = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const three = useThree((s) => s.scene);
  const controls = useThree((s) => s.controls) as { target?: Vector3 } | null;
  const focus = useRef<Vector3 | null>(null);
  focus.current = controls?.target ?? null;
  const poolAt = useRef(0);
  // Halos round the lanterns after dark.
  const halos = useMemo(() => {
    const tex = typeof document === 'undefined' ? null : dotTexture();
    const list = Array.from({ length: LAMPS }, () => {
      const m = new SpriteMaterial({ map: tex, color: new Color('#ffb15c'), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, fog: false });
      const sp = new Sprite(m);
      sp.renderOrder = 6;
      sp.visible = false;
      return sp;
    });
    return { tex, list };
  }, []);
  useEffect(
    () => () => {
      halos.tex?.dispose();
      halos.list.forEach((h) => h.material.dispose());
    },
    [halos],
  );
  const rustled = useRef<Float32Array>(new Float32Array(0));
  const bursts = useRef<{ x: number; z: number; y: number; t: number }[]>([]);
  const events = useRef({ fountainAt: 0, koi: -100, lantern: [1, 1], lanternAt: [-100, -100], puffs: [] as { x: number; z: number; t: number }[], shakes: [] as { stalk: number; t: number }[], endAt: -1, lastK: -1, windAt: 0, punchAmp: 0 });

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const now = clock.now;
        const wall = performance.now() / 1000;
        const ev = events.current;
        time.value = now;

        // Wind: now and then a gust sweeps through the bamboo, leaves and grass (still in calm mode).
        const gust = calm ? 0 : Math.max(0, Math.sin(now * 0.31) + Math.sin(now * 0.17 + 2.0) - 0.85) * 0.55;
        const windDt = Math.min(0.1, Math.max(0, clock.now - ev.windAt));
        WIND.value += (gust - WIND.value) * (1 - Math.exp(-windDt * 1.5));
        ev.windAt = clock.now;
        // The time of day: the sun and the moon cross the sky, the light goes golden, then blue, then comes back.
        const day = clock.day;
        const nightW = day.night;
        const duskW = day.dusk;
        sky$.uSun.value.set(day.sun[0], day.sun[1], day.sun[2]);
        sky$.uMoon.value.set(day.moon[0], day.moon[1], day.moon[2]);
        sky$.uDay.value = day.day;
        sky$.uNight.value = nightW;
        sky$.uDusk.value = duskW;
        sky$.uTint.value.copy(TONE.white).lerp(TONE.dusk, duskW * 0.85).lerp(TONE.night, nightW);
        _c.copy(TONE.haze).lerp(TONE.hazeDusk, duskW).lerp(TONE.hazeNight, nightW);
        if (three.background instanceof Color) three.background.copy(_c);
        if (three.fog) three.fog.color.copy(_c);
        (ground.uniforms.uFogColor.value as Color).copy(_c);
        three.environmentIntensity = palette.lights.envIntensity * (1 - 0.5 * nightW);
        if (hemi.current) {
          hemi.current.color.set(palette.lights.sky).lerp(TONE.skyNight, nightW);
          hemi.current.groundColor.set(palette.lights.ground).lerp(TONE.groundNight, nightW);
          hemi.current.intensity = palette.lights.ambient * (1 - 0.2 * nightW);
        }
        // The moon is a light of its own: it rims everything from behind (the pandas, the stalks, the beds), where it stands in the sky.
        if (fillLight.current) {
          fillLight.current.color.set(palette.lights.fill).lerp(TONE.fillNight, nightW);
          fillLight.current.intensity = palette.lights.fillIntensity * (1 + 2.2 * nightW);
          _moonPos.set(cx + day.moon[0] * 70, floorY + Math.max(8, day.moon[1] * 70), cz + day.moon[2] * 70);
          fillLight.current.position.lerpVectors(_fillHome.set(cx + R + 6, floorY + R * 0.6 + 3, cz - R * 0.4 - 6), _moonPos, nightW);
        }
        // Light: clouds drift over the sun, the grove brightens and dims a little; moonlight is cooler and softer.
        if (keyLight.current) {
          keyLight.current.color.set(palette.lights.key).lerp(TONE.keyDusk, duskW).lerp(TONE.keyNight, nightW);
          // Moonlight, from the front and above: nearly as strong as the sun, cold and blue.
          keyLight.current.intensity = palette.lights.keyIntensity * (1 - 0.12 * duskW - 0.12 * nightW) * (calm ? 1 : 1 + 0.07 * Math.sin(now * 0.13) * Math.sin(now * 0.07 + 1.0));
        }
        scene.hillTones.forEach((h) => {
          (h.mat.uniforms.uColor.value as Color).copy(h.day).lerp(h.dusk, duskW).lerp(h.night, nightW);
        });
        // Lit at dusk, glowing all night.
        const lit = Math.min(1, Math.max(nightW * 1.2, duskW * 0.55 * (1 - day.day * 0.5)));

        // The rope under the beam of the gym sways with the wind.
        scene.dangle.rotation.z = calm ? 0 : 0.1 * Math.sin(now * 1.3) + WIND.value * 0.5;
        scene.dangle.rotation.x = calm ? 0 : 0.06 * Math.sin(now * 0.9 + 1);

        const last = sample.k === model.frameCount - 1 && sample.k > 0;
        if (last && ev.lastK !== sample.k) ev.endAt = wall;
        if (!last) ev.endAt = -1;
        ev.lastK = sample.k;

        // Lanterns: light or douse on click, flicker gently; brighter after dark, when they light the ground round them.
        const lamps = sky$.uLamps.value;
        scene.lanterns.forEach((l, i) => {
          const target = ev.lantern[i];
          const since = wall - ev.lanternAt[i];
          const k = since < 0.6 ? (target ? since / 0.6 : 1 - since / 0.6) : target;
          const flicker = calm ? 1 : 0.92 + 0.08 * Math.sin(now * 7.3 + i * 2) * Math.sin(now * 3.1 + i);
          l.glowMat.emissiveIntensity = (0.15 + 2.1 * k * flicker) * (1 + 0.5 * lit);
          l.light.intensity = 3.2 * k * flicker * (1 + 0.9 * lit);
          l.light.distance = 6 + 3 * lit;
          lamps[i].set(l.x, l.z, 0.75 * k * flicker * lit);
          const h = halos.list[i];
          h.visible = lit * k > 0.02;
          if (h.visible) {
            h.position.set(l.x, floorY + 1.19, l.z);
            h.scale.setScalar(1.5 + 0.08 * flicker);
            h.material.opacity = 0.55 * lit * k * flicker;
          }
        });
        scene.hanging.forEach((h, i) => {
          const flicker = calm ? 1 : 0.9 + 0.1 * Math.sin(now * 6.1 + i * 1.7) * Math.sin(now * 2.3 + i * 0.6);
          scene.paperMats[i].emissiveIntensity = 0.12 + 1.35 * lit * flicker;
          if (h.light) h.light.intensity = 2.6 * lit * flicker;
          h.hang.rotation.z = calm ? 0 : 0.05 * Math.sin(now * 1.1 + i * 2.1) + WIND.value * 0.25;
          h.hang.rotation.x = calm ? 0 : 0.04 * Math.sin(now * 0.8 + i);
          lamps[2 + i].set(h.glowX, h.glowZ, 0.7 * lit * flicker);
          const halo = halos.list[2 + i];
          halo.visible = lit > 0.02;
          if (halo.visible) {
            h.hang.getWorldPosition(_p);
            halo.position.set(_p.x, _p.y - 0.38, _p.z);
            halo.scale.setScalar(1.7 + 0.1 * flicker);
            halo.material.opacity = 0.6 * lit * flicker;
          }
        });
        // The campfire: flames dancing, light flickering (a warm pool on the ground, a halo round it), sparks; it burns all day, but it is the night's light.
        const props = scene.props;
        const fl = calm ? 1 : 1 + 0.16 * Math.sin(now * 9.1) * Math.sin(now * 5.3 + 1) + 0.07 * Math.sin(now * 17.3);
        props.fire.light.intensity = (1.6 + 16 * lit) * fl;
        props.fire.flames.forEach((f, i) => {
          const wob = calm ? 1 : 0.85 + 0.22 * Math.sin(now * (6.5 + f.seed) + f.seed * 3) + 0.1 * Math.sin(now * 13.7 + f.seed);
          f.mesh.scale.y = f.base * wob;
          f.mesh.scale.x = f.mesh.scale.z = (0.14 + 0.2 * (1 - i * 0.2)) * (0.92 + 0.12 * Math.sin(now * 8 + f.seed));
          f.mesh.rotation.z = calm ? 0 : 0.1 * Math.sin(now * 4.4 + f.seed * 2) + WIND.value * 0.15;
        });
        lamps[8].set(props.fire.x, props.fire.z, 2.5 * (0.3 + 0.7 * lit) * fl);
        const fireHalo = halos.list[8];
        fireHalo.visible = true;
        fireHalo.position.set(props.fire.x, floorY + 0.75, props.fire.z);
        fireHalo.scale.setScalar((3.2 + 0.5 * lit) * (0.97 + 0.05 * fl));
        fireHalo.material.opacity = (0.22 + 0.38 * lit) * Math.min(1.2, fl);
        props.lamps.forEach((l, i) => {
          const flick = calm ? 1 : 0.9 + 0.1 * Math.sin(now * 5.7 + i * 2.1) * Math.sin(now * 2.1 + i);
          l.mat.emissiveIntensity = 0.12 + 1.5 * lit * flick;
          lamps[9 + i].set(l.x, l.z, 0.62 * lit * flick);
          const halo = halos.list[9 + i];
          halo.visible = lit > 0.02;
          if (halo.visible) {
            halo.position.set(l.x, floorY + 1.8, l.z);
            halo.scale.setScalar(1.5 + 0.08 * flick);
            halo.material.opacity = 0.5 * lit * flick;
          }
        });
        // The laptop's screen glows (brighter in the dark, and busier while someone types); the barbell is off its rack while it is lifted; the punching log swings when it is hit.
        const typing = clock.colony.members.some((m) => m.act === 'type');
        props.screen.emissiveIntensity = (0.55 + 1.5 * nightW) * (typing && !calm ? 1 + 0.12 * Math.sin(now * 11) * Math.sin(now * 2.3) : 1);
        // The few real lights go to the lanterns and the fire that matter to where the camera looks.
        scene.lightPool.update(Math.min(0.1, Math.max(0, now - poolAt.current)), scene.lightSources, focus.current ?? _focus.set(cx, floorY, cz));
        poolAt.current = now;
        const lifting = clock.colony.members.some((m) => m.act === 'lift');
        for (const bar of props.rackBar) bar.visible = !lifting;
        const punching = clock.colony.members.some((m) => m.act === 'punch');
        ev.punchAmp += ((punching ? 0.2 : 0) - ev.punchAmp) * 0.08;
        for (const pl of props.punch) {
          pl.pivot.rotation.z = calm ? 0 : -ev.punchAmp * (0.5 + 0.5 * Math.sin(now * 4.6)) + 0.03 * Math.sin(now * 0.9);
          pl.pivot.rotation.x = calm ? 0 : 0.02 * Math.sin(now * 0.7);
        }
        // Sparks rise from the fire and go out.
        if (!calm) {
          for (let sp = 0; sp < 7; sp++) {
            const f = (now * (0.35 + hash(sp, 91) * 0.25) + hash(sp, 92)) % 1;
            const a = hash(sp, 93) * Math.PI * 2 + now * 0.4;
            const rr = (0.1 + 0.3 * f) * (0.5 + hash(sp, 94));
            pool.add(props.fire.x + Math.cos(a) * rr + WIND.value * f, floorY + 0.5 + f * 2.2, props.fire.z + Math.sin(a) * rr, 1, 0.55 + 0.3 * (1 - f), 0.18, (1 - f) * 0.9, 0.035);
          }
        }
        // The swing: carries whoever is on it, and drifts a little in the wind when it is empty.
        const rider = clock.colony.swing;
        scene.swingArm.rotation.x = rider.rider ? -swingAngle(now - rider.start, rider.dur) : calm ? 0 : -(0.04 * Math.sin(now * 0.9) + WIND.value * 0.12);

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

        // The grove reacts to the pandas: bamboo they brush past shakes and drops a few leaves; a stalk they chew from rustles now and then.
        if (!calm) {
          if (rustled.current.length !== scene.stalks.length) rustled.current = new Float32Array(scene.stalks.length).fill(-100);
          const last = rustled.current;
          const shake = (si: number, strong: boolean) => {
            if (now - last[si] < 1.6) return;
            last[si] = now;
            ev.shakes.push({ stalk: si, t: now });
            const st = scene.stalks[si];
            bursts.current.push({ x: st.x, z: st.z, y: 2.2 + hash(si, 5) * 2.2, t: wall });
            if (strong) bursts.current.push({ x: st.x + 0.1, z: st.z, y: 3 + hash(si, 6), t: wall + 0.2 });
            if (bursts.current.length > 24) bursts.current.splice(0, bursts.current.length - 24);
          };
          clock.crew.forEach((c, i) => {
            if (c.speed > 0.6) {
              for (let si = 0; si < scene.stalks.length; si++) {
                const st = scene.stalks[si];
                if (Math.abs(st.x - c.x) < 1.15 && Math.abs(st.z - c.z) < 1.15) shake(si, c.speed > 2.4);
              }
            }
            const patch = clock.chew[i];
            if (patch >= 0 && scene.snackStalks[patch]) {
              const ids = scene.snackStalks[patch];
              shake(ids[Math.floor(now / 1.7 + i) % ids.length], false);
            }
          });
        }

        // Butterflies wander the clearing in loose loops; birds cross the sky far behind.
        for (let i = 0; i < 5; i++) {
          const a = now * (0.22 + hash(i, 7) * 0.2) + hash(i, 8) * 6.28;
          const bx = cx + (hash(i, 9) - 0.5) * clearX * 1.5, bz = cz + clearZ * (0.1 + hash(i, 10) * 0.55);
          const x = bx + Math.cos(a) * 1.7 + Math.sin(a * 2.3) * 0.6;
          const z = bz + Math.sin(a * 1.3) * 1.2;
          const y = floorY + 1.0 + hash(i, 11) * 1.1 + Math.sin(a * 3.1) * 0.35;
          const dx = -Math.sin(a) * 1.7, dz = Math.cos(a * 1.3) * 1.56;
          _p.set(x, y, z);
          _q.setFromEuler(_e.set(0.25, Math.atan2(dx, dz), Math.sin(now * 2.2 + i) * 0.35, 'YXZ'));
          _s.setScalar(calm ? 0 : Math.min(1, Math.max(0, day.day * 1.6 - 0.3)));
          scene.butterflies.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        scene.butterflies.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 7; i++) {
          const speed = 0.9 + hash(i, 12) * 0.6;
          const f = (((now * speed * 0.012 + hash(i, 13)) % 1) + 1) % 1;
          const x = cx - clearX * 3.4 + f * clearX * 6.8;
          const z = cz - clearZ * 3.4 - hash(i, 14) * 12;
          const y = floorY + 16 + hash(i, 15) * 9 + Math.sin(now * 0.4 + i) * 1.1;
          _p.set(x, y, z);
          _q.setFromEuler(_e.set(0, Math.PI / 2 + Math.sin(now * 0.3 + i) * 0.08, Math.sin(now * 0.5 + i * 2) * 0.12, 'YXZ'));
          _s.setScalar(calm ? 0 : Math.min(1, Math.max(0, day.day * 1.6 - 0.3)));
          scene.birds.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        scene.birds.instanceMatrix.needsUpdate = true;

        // Falling leaves: drift down across the view, tumbling.
        const span = 7;
        for (let i = 0; i < LEAVES; i++) {
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
        // Leaves shaken loose from bamboo (by a passing panda or a chewing one) flutter down.
        bursts.current = bursts.current.filter((b) => wall - b.t < 2.4);
        for (const b of bursts.current) {
          const tt = wall - b.t;
          if (tt < 0) continue;
          for (let p = 0; p < 7; p++) {
            const f = tt / (1.6 + hash(p, 61) * 0.8);
            if (f > 1) continue;
            const y = floorY + b.y * (1 - f) + 0.05;
            pool.add(b.x + (hash(p, 62) - 0.5) * 0.9 + Math.sin(tt * 3 + p) * 0.18, y, b.z + 0.2 + (hash(p, 63) - 0.5) * 0.7, 0.5 + hash(p, 64) * 0.25, 0.7 + hash(p, 65) * 0.12, 0.28, (1 - f) * 0.85, 0.075);
          }
        }
        pool.end();

        const busy = bursts.current.length > 0 || kt < 3 || ev.puffs.length > 0 || ev.lanternAt.some((t0) => wall - t0 < 0.7);
        if (busy) invalidate();
      }),
    [driver, model, time, scene, pool, clock, calm, cx, cz, clearX, clearZ, floorY, invalidate, sky$, ground, three, palette, halos, fogFar, R],
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

      <hemisphereLight ref={hemi} args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight ref={keyLight} color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[cx - R * 0.6 - 4, floorY + R * 1.4 + 8, cz + R + 8]} />
      <directionalLight ref={fillLight} color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[cx + R + 6, floorY + R * 0.6 + 3, cz - R * 0.4 - 6]} />
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
      <points frustumCulled={false} material={motes.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[motes.seed, 4]} />
        </bufferGeometry>
      </points>
      <primitive object={pool.points} />
      {halos.list.map((h, i) => (
        <primitive key={`h${i}`} object={h} />
      ))}
    </>
  );
}

const UP = new Vector3(0, 1, 0);
/** Lanterns that pool light on the ground at night: the two stone ones and the six paper ones. */
const LAMPS = 15;
/** Falling leaves (more of them, over the bigger grove). */
const LEAVES = 70;
/** The colours the grove's light goes through in a day: full day, the golden hour, moonlit night. */
const TONE = {
  white: new Color(1, 1, 1),
  dusk: new Color(1.0, 0.78, 0.62),
  night: new Color(0.5, 0.6, 0.96),
  haze: new Color('#e6e6cf'),
  hazeDusk: new Color('#e8b48e'),
  hazeNight: new Color('#1b2640'),
  skyNight: new Color('#9bb0f0'),
  groundNight: new Color('#33405c'),
  keyDusk: new Color('#ffbd85'),
  keyNight: new Color('#b8caff'),
  fillNight: new Color('#8fb0ff'),
};
const _c = new Color();
const _moonPos = new Vector3();
const _fillHome = new Vector3();
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

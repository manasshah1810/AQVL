import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Vector3,
  Euler,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StageModel } from '../../../model/StageModel';
import type { StageSample } from '../../../model/sampler';
import type { StageDriver } from '../../../three/driver';
import type { SceneBounds } from '../../../three/StageEnvironment';
import { NO_SHADOW_LAYER } from '../../../three/StageEnvironment';
import { NOISE, rng } from '../../three/glsl';
import { hash } from '../../three/particles';
import { worldLayout } from '../../three/layout';
import type { WorldClock } from '../../three/WorldLayer';
import { CAUSTICS, OCEAN } from '../glsl';
import { BubblePool } from './bubbles';
import { buildFish, buildJellies, buildTurtle, type Area } from './life';

/** Water colours (linear-ready hex): the open blue at eye level (the fog), the deep, and the light under the surface. */
export const WATER = { haze: '#0d4d66', deep: '#03192a', shallow: '#4cc3d9' };

/** Where the reef sets its things, around (never inside) the space the structures use. */
export interface ReefSpots {
  /** The clearing the structures stand in (half sizes about the centre). */
  cx: number;
  cz: number;
  clearX: number;
  clearZ: number;
  /** Height of the surface above the seabed. */
  surface: number;
  /** The clam, the vents and the drop-off behind. */
  clam: [number, number];
  vents: [number, number][];
  dropZ: number;
  area: Area;
}

export function reefSpots(model: StageModel): ReefSpots {
  const { cx, cz, halfX, halfZ, lift } = worldLayout(model);
  const f = model.footprint();
  const clearX = halfX + 3.2;
  const clearZ = halfZ + 2.6;
  return {
    cx,
    cz,
    clearX,
    clearZ,
    surface: Math.max(15, f.top - model.floorY + 11),
    clam: [cx + halfX + 3.1, cz + halfZ * 0.35 + 0.6],
    vents: [
      [cx - halfX - 5.2, cz - halfZ - 2.5 - lift * 0.3],
      [cx + halfX + 6.5, cz - halfZ - 4.2 - lift * 0.3],
      [cx - halfX * 0.2, cz - halfZ - 8 - lift * 0.6],
    ],
    dropZ: cz - halfZ - 10 - lift * 0.6,
    area: { cx, cz, halfX, halfZ, floorY: model.floorY, top: Math.max(1, f.top - model.floorY) },
  };
}

const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
vec3 applyFog(vec3 c, float dist) {
  return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist));
}
`;

/** The water all around: brighter towards the surface (with the bright window straight above), dark in the depths. */
const DOME_FRAGMENT = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uHaze;
uniform vec3 uDeep;
uniform vec3 uShallow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHaze, uDeep, smoothstep(0.0, -0.55, h));
  col = mix(col, uShallow * 0.55, smoothstep(0.05, 0.75, h));
  // Snell's window: the sky seen through the surface, a bright disc overhead with rippling edges.
  float win = smoothstep(0.72, 0.8, h + (fbm(d.xz * 6.0 + uTime * 0.12) - 0.5) * 0.06);
  float ripple = fbm(d.xz / max(0.2, h) * 3.0 + vec2(uTime * 0.15, -uTime * 0.1));
  col += uShallow * win * (0.55 + 0.6 * ripple);
  // Faint far-off shafts of light, leaning with the sun.
  float az = atan(d.z, d.x);
  float shafts = smoothstep(0.55, 0.95, fbm(vec2(az * 5.0 + h * 1.4 + uTime * 0.02, 0.5))) * smoothstep(-0.25, 0.25, h) * (1.0 - smoothstep(0.35, 0.8, h));
  col += uShallow * shafts * 0.08;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const SEABED_VERTEX = /* glsl */ `
${NOISE}
uniform vec2 uCenter;
uniform vec2 uClear;
uniform float uDropZ;
varying vec3 vWorld;
varying float vRelief;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  // Flat where the structures stand; dunes and mounds further out; behind, the seabed falls away into the deep.
  vec2 q = (w.xz - uCenter) / uClear;
  float out1 = smoothstep(1.1, 2.2, length(q));
  float dunes = (fbm(w.xz * 0.07) - 0.45) * 2.4 + (vnoise(w.xz * 0.25) - 0.5) * 0.5;
  float drop = smoothstep(0.0, 22.0, uDropZ - w.z);
  w.y += dunes * out1 - drop * drop * 9.0 - drop * 1.5;
  vRelief = dunes * out1;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const SEABED_FRAGMENT = /* glsl */ `
${NOISE}
${CAUSTICS}
${FOG_GLSL}
uniform float uOceanTime;
uniform float uCaustic;
uniform vec2 uCenter;
uniform vec2 uClear;
uniform vec3 uSand;
uniform vec3 uSandLight;
uniform vec3 uFloor;
uniform float uFloorY;
varying vec3 vWorld;
varying float vRelief;
void main() {
  vec2 p = vWorld.xz;
  vec2 q = (p - uCenter) / uClear;
  float clearing = 1.0 - smoothstep(0.85, 1.35, length(q));
  // Sand ripples, bent by the current, with darker troughs.
  float warp = fbm(p * 0.18) * 5.0;
  float ripple = sin(p.x * 3.1 + p.y * 1.3 + warp) * 0.5 + 0.5;
  ripple = smoothstep(0.15, 0.95, ripple);
  float sandPatch = fbm(p * 0.11 + 4.0);
  vec3 sand = mix(uSand, uSandLight, sandPatch * 0.8 + ripple * 0.25);
  // Gravel and shell grit scattered about.
  vec2 v = voronoi(p * 2.4);
  float grit = (1.0 - smoothstep(0.05, 0.12, v.x)) * step(0.6, hash12(floor(p * 2.4)));
  sand = mix(sand, sand * 0.72, grit * 0.5);
  // Where the structures stand the sand is smooth and settles to the stage's floor colour (the inks read on it).
  vec3 col = mix(sand, mix(uFloor, uSandLight * 0.9, 0.18 + ripple * 0.08), clearing * 0.82);
  // Deeper water further down: the drop-off darkens.
  float depth = clamp((uFloorY - vWorld.y) / 9.0, 0.0, 1.0);
  col *= 1.0 - depth * 0.75;
  col += max(0.0, vRelief) * 0.025;
  // Caustics: brightest in the open, gentler where the structures stand, fading with depth and distance.
  float c = caustics(p, uOceanTime) * uCaustic;
  col += vec3(0.5, 0.82, 0.88) * c * mix(0.2, 0.075, clearing) * (1.0 - depth);
  col = applyFog(col, length(vWorld - cameraPosition));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const RAY_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const RAY_FRAGMENT = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uSeed;
uniform float uStrength;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  // Soft-edged, brightest near the surface, fading towards the seabed; it flickers as the surface moves.
  float edge = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
  float fall = smoothstep(0.0, 0.55, vUv.y) * (0.35 + 0.65 * vUv.y);
  float flicker = 0.55 + 0.45 * fbm(vec2(vUv.x * 3.0 + uSeed * 7.0, vUv.y * 0.6 - uTime * 0.18 + uSeed));
  float a = edge * fall * flicker * uStrength;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}
`;

const SNOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uBox;
uniform vec3 uOrigin;
attribute vec4 aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  // Marine snow: drifting slowly down and along with the current, never falling straight.
  p.y = mod(p.y - uTime * (0.05 + aSeed.x * 0.08), uBox.y);
  p.x = mod(p.x + uTime * (0.08 + aSeed.y * 0.06) + sin(uTime * 0.3 + aSeed.z * 6.28) * 0.4 + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
  p.z += cos(uTime * (0.2 + aSeed.z * 0.2) + aSeed.y * 6.28) * 0.3;
  vec4 mv = modelViewMatrix * vec4(uOrigin + p, 1.0);
  gl_PointSize = (1.2 + aSeed.w * 2.4) * (60.0 / -mv.z);
  vAlpha = smoothstep(0.0, 1.5, p.y) * smoothstep(uBox.y, uBox.y - 2.0, p.y) * (0.22 + 0.4 * aSeed.w) * smoothstep(2.0, 6.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const SNOW_FRAGMENT = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.82, 0.95, 0.96, a);
}
`;

const VENT_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uHeight;
attribute vec4 aSeed;
attribute vec2 aVent;
varying float vAlpha;
void main() {
  // A stream of bubbles: each rises from its vent, quicker as it goes, wobbling, growing a little.
  float life = fract(uTime * (0.09 + aSeed.x * 0.05) + aSeed.y);
  float y = life * life * 0.4 * uHeight + life * 0.6 * uHeight;
  vec3 p = vec3(aVent.x + sin(uTime * 3.0 + aSeed.z * 20.0 + y * 2.0) * (0.05 + life * 0.25), position.y + y, aVent.y + cos(uTime * 2.6 + aSeed.w * 20.0 + y * 1.7) * (0.05 + life * 0.25));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (0.06 + aSeed.w * 0.09) * (1.0 + life * 0.8) * (520.0 / -mv.z);
  vAlpha = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.75, 1.0, life)) * 0.75;
  gl_Position = projectionMatrix * mv;
}
`;

const VENT_FRAGMENT = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float rim = smoothstep(0.6, 0.85, d) * (1.0 - smoothstep(0.88, 1.0, d));
  float glint = 1.0 - smoothstep(0.0, 0.18, length(q - vec2(-0.16, -0.16)));
  float a = (rim * 0.8 + glint * 0.8 + (1.0 - d) * 0.1) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.88, 0.98, 1.0, a);
}
`;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();

/** Plants sway with the current: the higher up the stalk, the further. Shared by kelp, sea grass and fans. */
function swayMaterial(color: string, opts: { rough?: number; tipColor?: string; strength: number; time: { value: number }; key: string; emissive?: string }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, roughness: opts.rough ?? 0.7, side: DoubleSide, emissive: new Color(opts.emissive ?? '#000000'), emissiveIntensity: 0.25 });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = opts.time;
    shader.uniforms.uTip = { value: new Color(opts.tipColor ?? color) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSeed;\nvarying float vH;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hh = max(0.0, position.y);
        vH = hh;
        float sw = sin(uTime * 0.55 + aSeed * 6.28 + hh * 0.9) * 0.6 + sin(uTime * 0.23 + aSeed * 3.1) * 0.4;
        transformed.x += sw * hh * hh * ${opts.strength.toFixed(3)};
        transformed.z += cos(uTime * 0.41 + aSeed * 4.0 + hh * 0.7) * hh * hh * ${(opts.strength * 0.5).toFixed(3)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTip;\nvarying float vH;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTip, smoothstep(0.0, 1.0, vH));');
  };
  m.customProgramCacheKey = () => `aqvl-reef-sway-${opts.key}`;
  return m;
}

/** One kelp frond: a tall ribbon (height 1, scaled per plant) with blades off it, swaying from the holdfast. */
function kelpGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const stem = new PlaneGeometry(0.07, 1, 1, 18);
  stem.translate(0, 0.5, 0);
  parts.push(stem);
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const y = 0.12 + i * 0.095;
    const blade = new PlaneGeometry(0.16, 0.09, 4, 1);
    // A long blade off one side, drooping.
    const p = blade.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) + 0.08;
      p.setXYZ(k, x * (i % 2 ? -1 : 1), p.getY(k) - x * x * 1.6, p.getZ(k) + (r() - 0.5) * 0.02);
    }
    blade.rotateY(r() * Math.PI);
    blade.translate(0, y, 0);
    parts.push(blade);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  parts.forEach((p) => p.dispose());
  return g;
}

/** A clump of sea grass: thin blades fanning out from one point (height 1). */
function grassGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const r = rng(13);
  for (let i = 0; i < 7; i++) {
    const b = new PlaneGeometry(0.035, 1, 1, 6);
    b.translate(0, 0.5, 0);
    const p = b.attributes.position;
    const lean = (r() - 0.5) * 0.5;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      p.setX(k, p.getX(k) * (1 - y * 0.8) + lean * y * y);
    }
    b.rotateY(r() * Math.PI);
    b.scale(1, 0.6 + r() * 0.5, 1);
    b.translate((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12);
    parts.push(b.toNonIndexed());
    b.dispose();
  }
  return mergeGeometries(parts);
}

/** A branching coral: tapering limbs that fork twice, merged into one piece (height about 1). */
function branchCoral(seed: number): BufferGeometry {
  const r = rng(seed);
  const parts: BufferGeometry[] = [];
  const limb = (x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, rad: number, depth: number) => {
    const g = new CylinderGeometry(rad * 0.7, rad, len, 7, 1);
    g.translate(0, len / 2, 0);
    const dir = new Vector3(dx, dy, dz).normalize();
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
    g.translate(x, y, z);
    parts.push(g);
    const ex = x + dir.x * len, ey = y + dir.y * len, ez = z + dir.z * len;
    if (depth > 0) {
      for (let k = 0; k < 2 + (depth > 1 ? 1 : 0); k++) {
        const a = r() * Math.PI * 2;
        limb(ex, ey, ez, dir.x + Math.cos(a) * 0.6, dir.y + 0.3, dir.z + Math.sin(a) * 0.6, len * 0.72, rad * 0.7, depth - 1);
      }
    } else {
      const tip = new SphereGeometry(rad * 0.75, 6, 4);
      tip.translate(ex, ey, ez);
      parts.push(tip);
    }
  };
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r();
    limb(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35, 0.42, 0.07, 2);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  return g;
}

function coralMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCo = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCo;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Polyps: a fine stipple, paler towards the tips.
        float st = fract(sin(dot(floor(vCo * 40.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        diffuseColor.rgb *= 0.86 + 0.14 * st;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.05, smoothstep(0.4, 1.2, vCo.y));`,
      );
  };
  m.customProgramCacheKey = () => 'aqvl-reef-coral';
  return m;
}

/** Brain coral: a low dome covered in meandering ridges. */
function brainMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: '#d9a35e', roughness: 0.8 });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBr = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBr;\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mz = sin(vBr.x * 22.0 + fbm(vBr.xz * 3.0) * 9.0 + vBr.z * 6.0);
        diffuseColor.rgb *= 0.7 + 0.3 * smoothstep(-0.3, 0.6, mz);`,
      );
  };
  m.customProgramCacheKey = () => 'aqvl-reef-brain';
  return m;
}

/** Rocks: lumpy, darker below, with a fuzz of green algae on top. */
function rockMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: '#4b5d63', roughness: 0.92, flatShading: false });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRn;\nvarying vec3 vRp;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvRn = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRp = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRn;\nvarying vec3 vRp;\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float moss = smoothstep(0.35, 0.85, vRn.y) * smoothstep(0.35, 0.65, fbm(vRp.xz * 3.0 + vRp.y));
        diffuseColor.rgb *= 0.8 + 0.35 * fbm(vRp.xy * 4.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.5, 0.3), moss * 0.7);`,
      );
  };
  m.customProgramCacheKey = () => 'aqvl-reef-rock';
  return m;
}

function starfishGeometry(): BufferGeometry {
  const s = new Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 0.5 : 0.2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export interface ReefProps {
  model: StageModel;
  bounds: SceneBounds;
  driver: StageDriver;
  calm: boolean;
  clock: WorldClock;
}

/**
 * The whales' world: a sunlit reef at the bottom of a clear blue sea. The
 * structures stand in a sandy clearing; around it, rocks crusted with coral,
 * sea fans and sponges, kelp swaying up towards the light, vents trickling
 * bubbles; behind, the seabed falls away into the deep. Light comes down in
 * slanting shafts and plays over everything in caustics; marine snow drifts
 * through it all. Shoals of fish wheel round the edges, jellies drift in the
 * blue, a turtle paddles past now and then. Click the sand for a puff of
 * silt, the clam to make it open, a jelly to make it glow.
 */
export function ReefWorld({ model, bounds, driver, calm, clock }: ReefProps) {
  const invalidate = useThree((s) => s.invalidate);
  const palette = model.palette;
  const floorY = model.floorY;
  const { radius: R } = bounds;
  const spots = useMemo(() => reefSpots(model), [model]);
  const { cx, cz, clearX, clearZ, area } = spots;
  const fogNear = R * 1.6 + 12;
  const fogFar = R * 5.2 + 52;
  const quality = 2;
  const time = useMemo(() => ({ value: 0 }), []);

  useEffect(() => {
    OCEAN.uFloorY.value = floorY;
    OCEAN.uSurfaceY.value = floorY + spots.surface;
    OCEAN.uCaustic.value = 1;
  }, [floorY, spots.surface]);

  const dome = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: time, uHaze: { value: new Color(WATER.haze) }, uDeep: { value: new Color(WATER.deep) }, uShallow: { value: new Color(WATER.shallow) } },
        vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: DOME_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [time],
  );
  const seabed = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          ...OCEAN,
          uCenter: { value: [cx, cz] },
          uClear: { value: [clearX, clearZ] },
          uDropZ: { value: spots.dropZ },
          uSand: { value: new Color('#2f6670') },
          uSandLight: { value: new Color('#5d8f8c') },
          uFloor: { value: new Color(palette.floor) },
          uFogColor: { value: new Color(WATER.haze) },
          uFogNear: { value: fogNear },
          uFogFar: { value: fogFar },
        },
        vertexShader: SEABED_VERTEX,
        fragmentShader: SEABED_FRAGMENT,
        toneMapped: false,
      }),
    [cx, cz, clearX, clearZ, spots.dropZ, palette.floor, fogNear, fogFar],
  );

  // Shafts of light from the surface, leaning with the sun, spread across and behind the clearing.
  const rays = useMemo(() => {
    const r = rng(23);
    const group = new Group();
    const geo = new PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mats: ShaderMaterial[] = [];
    const count = 9;
    for (let i = 0; i < count; i++) {
      const mat = new ShaderMaterial({
        uniforms: { uTime: time, uSeed: { value: r() * 10 }, uStrength: { value: 0.05 + r() * 0.06 }, uColor: { value: new Color('#bff4ff') } },
        vertexShader: RAY_VERTEX,
        fragmentShader: RAY_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
        fog: false,
      });
      mats.push(mat);
      const mesh = new Mesh(geo, mat);
      const x = cx - clearX - 6 + (i / (count - 1)) * (clearX * 2 + 12) + (r() - 0.5) * 2;
      const z = cz - clearZ * (0.2 + r() * 1.6) - 2;
      const h = spots.surface + 4;
      mesh.position.set(x, floorY - 1, z);
      mesh.scale.set(1.4 + r() * 2.6, h, 1);
      mesh.rotation.z = 0.24 + (r() - 0.5) * 0.06;
      mesh.renderOrder = 7;
      mesh.layers.set(NO_SHADOW_LAYER);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return { group, mats, geo };
  }, [time, cx, cz, clearX, clearZ, floorY, spots.surface]);

  const snow = useMemo(() => {
    const count = 900;
    const box = new Vector3(R * 5 + 40, spots.surface, R * 4 + 30);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const r = rng(41);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * box.x;
      pos[i * 3 + 1] = r() * box.y;
      pos[i * 3 + 2] = (r() - 0.65) * box.z;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    }
    const material = new ShaderMaterial({
      uniforms: { uTime: time, uBox: { value: box }, uOrigin: { value: new Vector3(cx, floorY, cz) } },
      vertexShader: SNOW_VERTEX,
      fragmentShader: SNOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { pos, seed, material };
  }, [R, cx, cz, floorY, spots.surface, time]);

  const vents = useMemo(() => {
    const per = 26;
    const count = per * spots.vents.length;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const vent = new Float32Array(count * 2);
    const r = rng(77);
    spots.vents.forEach(([x, z], v) => {
      for (let i = 0; i < per; i++) {
        const k = v * per + i;
        pos[k * 3 + 1] = floorY + (z < spots.dropZ + 4 ? -1.2 : 0.1);
        vent[k * 2] = x + (r() - 0.5) * 0.25;
        vent[k * 2 + 1] = z + (r() - 0.5) * 0.25;
        for (let j = 0; j < 4; j++) seed[k * 4 + j] = r();
      }
    });
    const material = new ShaderMaterial({
      uniforms: { uTime: time, uHeight: { value: spots.surface } },
      vertexShader: VENT_VERTEX,
      fragmentShader: VENT_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { pos, seed, vent, material };
  }, [spots, floorY, time]);

  // ── The reef: rocks, coral, fans, sponges, kelp, grass, starfish, the clam ──
  const reef = useMemo(() => {
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T): T => {
      disposables.push(x);
      return x;
    };
    const r = rng(19);
    const group = new Group();
    // Anything placed must stay out of the clearing and out of the strip in front of it (where the pod works).
    const inClearing = (x: number, z: number, pad = 0) => Math.abs(x - cx) < clearX + pad && z > cz - clearZ - pad;
    const ring = (n: number, minR: number, maxR: number, back: number, seedOff: number) => {
      const out: [number, number, number][] = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 40) {
        const a = Math.PI + r() * Math.PI; // the back half (behind and beside)
        const rr = minR + r() * (maxR - minR);
        const x = cx + Math.cos(a) * (clearX + rr) * 1.15;
        const z = cz + Math.sin(a) * (clearZ + rr * back) + (r() - 0.5) * 1.5;
        if (inClearing(x, z, 0.8)) continue;
        // Right behind the structures stays open (the reef frames them, it does not stand behind the data).
        if (Math.abs(x - cx) < clearX * 0.85 && z > cz - clearZ - 5.5) continue;
        out.push([x, z, hash(seedOff, out.length)]);
      }
      return out;
    };

    // Rocks: big ones further out (they frame the clearing), smaller ones near it.
    const rawRock = new IcosahedronGeometry(1, 4);
    rawRock.deleteAttribute('normal');
    rawRock.deleteAttribute('uv');
    const rockGeo = keep(mergeVertices(rawRock));
    rawRock.dispose();
    const rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const v = new Vector3().fromBufferAttribute(rp, i);
      // Lumpy but smooth: a few broad bulges and some finer knobs, a flatter underside.
      const n = 0.86 + 0.16 * Math.sin(v.x * 2.1 + v.z * 1.3 + 0.5) * Math.cos(v.y * 1.7 - v.x) + 0.08 * Math.sin(v.x * 6.3 + v.y * 4.1) * Math.sin(v.z * 5.2) + 0.05 * Math.sin(v.y * 9 + v.z * 7);
      rp.setXYZ(i, v.x * n, v.y * n * (v.y < 0 ? 0.45 : 0.78), v.z * n);
    }
    rockGeo.computeVertexNormals();
    const rockMat = keep(rockMaterial());
    const rocks = ring(quality >= 2 ? 30 : 18, 0.5, 9, 0.9, 3);
    // Two ridges at the back corners give the drop-off an edge.
    rocks.push([cx - clearX - 4.5, spots.dropZ + 2.5, 0.9], [cx + clearX + 5, spots.dropZ + 3.5, 0.7], [cx - clearX - 1.5, spots.dropZ + 4.5, 0.4]);
    const rockMesh = new InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach(([x, z, h], i) => {
      const big = i >= rocks.length - 3 ? 3.2 : 0.35 + h * h * 1.8;
      _p.set(x, floorY - big * 0.25, z);
      _q.setFromEuler(_e.set((r() - 0.5) * 0.3, r() * Math.PI * 2, (r() - 0.5) * 0.3));
      _s.set(big * (0.9 + r() * 0.6), big * (0.7 + r() * 0.5), big * (0.9 + r() * 0.5));
      rockMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(rockMesh);

    // Branching coral in warm colours, on and around the rocks.
    const coralMat = keep(coralMaterial());
    const coralGeos = [keep(branchCoral(4)), keep(branchCoral(9))];
    const coralColors = ['#ff8d7e', '#ffb35c', '#c18cff', '#ff74a8', '#ffd66e', '#7fe0c8'];
    coralGeos.forEach((geo, gi) => {
      const spotsC = ring(quality >= 2 ? 16 : 10, 0.2, 6, 0.85, 11 + gi);
      const mesh = new InstancedMesh(geo, coralMat, spotsC.length);
      spotsC.forEach(([x, z, h], i) => {
        const sc = 0.55 + h * 0.9;
        _p.set(x, floorY - 0.05, z);
        _q.setFromEuler(_e.set(0, r() * Math.PI * 2, 0));
        _s.set(sc, sc * (0.8 + r() * 0.5), sc);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        mesh.setColorAt(i, new Color(coralColors[(i + gi * 3) % coralColors.length]));
      });
      group.add(mesh);
    });

    // Brain coral domes.
    const brainGeo = keep(new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2));
    const brainMat = keep(brainMaterial());
    const brains = ring(quality >= 2 ? 9 : 5, 0.0, 5, 0.8, 23);
    const brainMesh = new InstancedMesh(brainGeo, brainMat, brains.length);
    brains.forEach(([x, z, h], i) => {
      const sc = 0.35 + h * 0.5;
      _p.set(x, floorY - 0.04, z);
      _q.identity();
      _s.set(sc, sc * 0.62, sc);
      brainMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      brainMesh.setColorAt(i, new Color(['#d9a35e', '#c98a6a', '#a7b56a'][i % 3]));
    });
    group.add(brainMesh);

    // Tube sponges: clusters of open tubes.
    const tubeGeo = keep(new CylinderGeometry(0.11, 0.08, 1, 12, 1, true));
    tubeGeo.translate(0, 0.5, 0);
    const tubeMat = keep(new MeshStandardMaterial({ color: '#b07ad8', roughness: 0.8, side: DoubleSide }));
    const tubesAt = ring(quality >= 2 ? 7 : 4, 0.6, 5, 0.9, 31);
    const tubeMesh = new InstancedMesh(tubeGeo, tubeMat, tubesAt.length * 4);
    let ti = 0;
    tubesAt.forEach(([x, z, h], c) => {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + c;
        _p.set(x + Math.cos(a) * 0.14, floorY - 0.05, z + Math.sin(a) * 0.14);
        _q.setFromEuler(_e.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18));
        _s.set(1 + h * 0.3, 0.5 + hash(c, k) * 0.9, 1 + h * 0.3);
        tubeMesh.setMatrixAt(ti, _m.compose(_p, _q, _s));
        tubeMesh.setColorAt(ti, new Color(['#b07ad8', '#e48b5c', '#e2c35a'][c % 3]));
        ti++;
      }
    });
    group.add(tubeMesh);

    // Sea fans: flat lattices standing across the current, swaying.
    const fanShape = new Shape();
    fanShape.moveTo(0, 0);
    fanShape.absarc(0, 0.55, 0.55, -0.15, Math.PI + 0.15, false);
    fanShape.lineTo(0, 0);
    const fanGeo = keep(new ExtrudeGeometry(fanShape, { depth: 0.01, bevelEnabled: false, curveSegments: 18 }));
    const fanSeeds = new Float32Array(16);
    for (let i = 0; i < 16; i++) fanSeeds[i] = r();
    fanGeo.setAttribute('aSeed', new InstancedBufferAttribute(fanSeeds, 1));
    const fanMat = keep(swayMaterial('#d0577a', { tipColor: '#ff9ab8', strength: 0.05, time, key: 'fan', rough: 0.8 }));
    fanMat.alphaTest = 0.5;
    const fanBase = fanMat.onBeforeCompile;
    fanMat.onBeforeCompile = (shader, renderer) => {
      fanBase(shader, renderer);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFan;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFan = position.xy;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFan;')
        .replace(
          '#include <alphatest_fragment>',
          `float lat = max(smoothstep(0.8, 0.95, abs(sin(vFan.x * 40.0 + vFan.y * 9.0))), smoothstep(0.82, 0.95, abs(sin(length(vFan - vec2(0.0, 0.0)) * 34.0))));
          float stem = 1.0 - smoothstep(0.015, 0.03, abs(vFan.x));
          diffuseColor.a = max(lat, stem);
          #include <alphatest_fragment>`,
        );
    };
    fanMat.customProgramCacheKey = () => 'aqvl-reef-fan';
    const fansAt = ring(quality >= 2 ? 8 : 5, 0.4, 6, 0.85, 41);
    const fanMesh = new InstancedMesh(fanGeo, fanMat, fansAt.length);
    fansAt.forEach(([x, z, h], i) => {
      const sc = 0.9 + h * 1.0;
      _p.set(x, floorY - 0.02, z);
      _q.setFromEuler(_e.set(0, (r() - 0.5) * 0.8, 0));
      _s.set(sc, sc, sc);
      fanMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      fanMesh.setColorAt(i, new Color(['#d0577a', '#9f62d6', '#e08a3c'][i % 3]));
    });
    group.add(fanMesh);

    // Kelp: a forest at the back corners rising towards the light, a few strands closer in at the sides.
    const kelpGeo = keep(kelpGeometry());
    const kelpAt: [number, number, number][] = [];
    for (let i = 0; i < (quality >= 2 ? 46 : 28); i++) {
      const left = i % 2 === 0;
      const x = cx + (left ? -1 : 1) * (clearX + 2.5 + r() * 9);
      const z = cz - clearZ * (0.1 + r() * 1.2) - r() * 6 + (i < 6 ? clearZ * 0.9 : 0);
      if (inClearing(x, z, 1)) continue;
      kelpAt.push([x, z, r()]);
    }
    const kelpSeeds = new Float32Array(kelpAt.length);
    kelpAt.forEach((k, i) => (kelpSeeds[i] = k[2]));
    kelpGeo.setAttribute('aSeed', new InstancedBufferAttribute(kelpSeeds, 1));
    const kelpMat = keep(swayMaterial('#4d6b2c', { tipColor: '#b0a23e', strength: 0.045, time, key: 'kelp', rough: 0.6, emissive: '#1d2a0c' }));
    const kelpMesh = new InstancedMesh(kelpGeo, kelpMat, kelpAt.length);
    kelpAt.forEach(([x, z, h], i) => {
      const H = 4.5 + h * (spots.surface * 0.55);
      _p.set(x, floorY - 0.05, z);
      _q.setFromEuler(_e.set(0, h * Math.PI * 2, 0));
      _s.set(1.8, H, 1.8);
      kelpMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(kelpMesh);

    // Sea grass in clumps round the edge of the clearing (low, so it never hides a node).
    const grassGeo = keep(grassGeometry());
    const grassAt: [number, number, number][] = [];
    for (let i = 0; i < (quality >= 2 ? 70 : 40); i++) {
      const a = r() * Math.PI * 2;
      const rr = 1.05 + r() * 0.5;
      const x = cx + Math.cos(a) * clearX * rr * 1.1;
      const z = cz + Math.sin(a) * clearZ * rr + (Math.sin(a) > 0 ? 1.4 : 0);
      if (inClearing(x, z, 0.3)) continue;
      grassAt.push([x, z, r()]);
    }
    const grassSeeds = new Float32Array(grassAt.length);
    grassAt.forEach((g, i) => (grassSeeds[i] = g[2]));
    grassGeo.setAttribute('aSeed', new InstancedBufferAttribute(grassSeeds, 1));
    const grassMat = keep(swayMaterial('#3f7a4a', { tipColor: '#9ccf6a', strength: 0.32, time, key: 'grass', rough: 0.7 }));
    const grassMesh = new InstancedMesh(grassGeo, grassMat, Math.max(1, grassAt.length));
    grassAt.forEach(([x, z, h], i) => {
      const H = 0.35 + h * 0.55;
      _p.set(x, floorY - 0.02, z);
      _q.setFromEuler(_e.set(0, h * 6.28, 0));
      _s.set(1.2, H, 1.2);
      grassMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(grassMesh);

    // Starfish and shells on the sand.
    const starGeo = keep(starfishGeometry());
    const starMat = keep(new MeshStandardMaterial({ color: '#ff8a4c', roughness: 0.85 }));
    const starAt = ring(9, -0.3, 4, 0.7, 51);
    starAt.push([cx - clearX - 0.4, cz + clearZ + 0.6, 0.3], [cx + clearX + 0.8, cz + clearZ + 1.4, 0.7]);
    const starMesh = new InstancedMesh(starGeo, starMat, starAt.length);
    starAt.forEach(([x, z, h], i) => {
      const sc = 0.22 + h * 0.18;
      _p.set(x, floorY + 0.01, z);
      _q.setFromEuler(_e.set(0, h * 6.28, 0));
      _s.set(sc, sc, sc);
      starMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      starMesh.setColorAt(i, new Color(['#ff8a4c', '#ffcf5a', '#e2556f', '#b26cff'][i % 4]));
    });
    group.add(starMesh);
    const shellGeo = keep(new ConeGeometry(0.09, 0.22, 9));
    shellGeo.rotateX(Math.PI / 2.4);
    const shellMat = keep(new MeshStandardMaterial({ color: '#f1e3c8', roughness: 0.5 }));
    const shellAt = ring(14, -0.4, 3, 0.6, 61);
    const shellMesh = new InstancedMesh(shellGeo, shellMat, shellAt.length);
    shellAt.forEach(([x, z, h], i) => {
      _p.set(x, floorY + 0.04, z);
      _q.setFromEuler(_e.set(0, h * 6.28, 0.3));
      _s.setScalar(0.8 + h);
      shellMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(shellMesh);

    // The clam: two ribbed shells on the sand, hinged at the back, a pearl inside.
    const clam = new Group();
    const [kx, kz] = spots.clam;
    clam.position.set(kx, floorY, kz);
    clam.rotation.y = -0.6;
    const valveGeo = keep(new SphereGeometry(0.42, 26, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const vp = valveGeo.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i);
      const rib = 1 + 0.06 * Math.cos(Math.atan2(z, x) * 14);
      vp.setXYZ(i, x * rib, y * 0.45, z * rib);
    }
    valveGeo.computeVertexNormals();
    const valveMat = keep(new MeshStandardMaterial({ color: '#c9b9e6', roughness: 0.55, side: DoubleSide }));
    const lower = new Mesh(valveGeo, valveMat);
    lower.rotation.x = Math.PI;
    lower.position.y = 0.19;
    const upperPivot = new Group();
    upperPivot.position.set(0, 0.19, -0.4);
    const upper = new Mesh(valveGeo, valveMat);
    upper.position.z = 0.4;
    upperPivot.add(upper);
    const pearlMat = keep(new MeshStandardMaterial({ color: '#fbf6ff', roughness: 0.12, metalness: 0.15, emissive: new Color('#e9e2ff'), emissiveIntensity: 0.3 }));
    const pearl = new Mesh(keep(new SphereGeometry(0.1, 18, 12)), pearlMat);
    pearl.position.set(0, 0.24, 0.05);
    clam.add(lower, upperPivot, pearl);
    group.add(clam);

    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, disposables, upperPivot, pearlMat, instanced: [rockMesh, brainMesh, tubeMesh, fanMesh, kelpMesh, grassMesh, starMesh, shellMesh] };
  }, [cx, cz, clearX, clearZ, floorY, spots, time]);

  useEffect(
    () => () => {
      reef.disposables.forEach((d) => d.dispose());
      reef.instanced.forEach((m) => m.dispose());
    },
    [reef],
  );

  const life = useMemo(() => ({ fish: buildFish(time, quality), jellies: buildJellies(time, quality), turtle: buildTurtle() }), [time]);
  useEffect(
    () => () => {
      life.fish.dispose();
      life.jellies.dispose();
      life.turtle.dispose();
    },
    [life],
  );

  const pool = useMemo(() => new BubblePool(320), []);
  useEffect(() => () => pool.dispose(), [pool]);
  const events = useRef({ clam: -100, nextClam: 14, puffs: [] as { x: number; z: number; t: number }[] });
  const jellyHits = useRef<(Mesh | null)[]>([]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        void sample;
        const now = clock.now;
        const wall = performance.now() / 1000;
        time.value = now;
        OCEAN.uOceanTime.value = now;
        const ev = events.current;
        // The pod's whereabouts (shoals part for a passing whale).
        const avoid = clock.crew.map((c, i) => ({ x: c.x, y: c.y, z: c.z, r: i === 0 ? 1.4 : 0.7 }));
        life.fish.update(now, area, avoid, calm);
        life.jellies.update(now, wall, area, calm);
        life.turtle.update(now, area, calm);
        life.jellies.jellies.forEach((j, i) => {
          const hit = jellyHits.current[i];
          if (hit) hit.position.copy(j.home);
        });

        // The clam opens now and then (and when clicked), lets out a stream of bubbles, and closes.
        if (!calm && now > ev.nextClam) {
          ev.clam = wall;
          ev.nextClam = now + 18 + hash(now, 3) * 14;
        }
        const ct = wall - ev.clam;
        const open = ct >= 0 && ct < 4 ? Math.sin(Math.min(1, ct / 0.5) * Math.PI * 0.5) * (1 - smoothstepJs(3.2, 4, ct)) : 0;
        reef.upperPivot.rotation.x = -open * 0.75;
        reef.pearlMat.emissiveIntensity = 0.3 + open * 0.9;

        pool.begin();
        if (ct >= 0 && ct < 4) {
          for (let p = 0; p < 22; p++) {
            const st = hash(p, 1) * 2.6 + 0.3;
            const tt = ct - st;
            if (tt < 0 || tt > 2.2) continue;
            const [kx, kz] = spots.clam;
            const y = floorY + 0.3 + tt * (1.2 + hash(p, 2) * 0.8) + tt * tt * 0.4;
            pool.bubble(kx + Math.sin(tt * 6 + p) * 0.08 * tt + (hash(p, 3) - 0.5) * 0.2, y, kz + Math.cos(tt * 5 + p) * 0.08 * tt, (1 - tt / 2.2) * 0.9, 0.05 + hash(p, 4) * 0.07);
          }
        }
        // Puffs of silt where the sand was clicked, with a few bubbles.
        ev.puffs = ev.puffs.filter((pf) => wall - pf.t < 2.4);
        for (const pf of ev.puffs) {
          const tt = wall - pf.t;
          for (let p = 0; p < 30; p++) {
            const a = hash(p, 8) * Math.PI * 2;
            const v = 0.4 + hash(p, 9) * 0.9;
            const out = 1 - Math.exp(-tt * 2.2);
            const y = floorY + 0.05 + (0.3 + hash(p, 10) * 0.6) * out - Math.max(0, tt - 1) * 0.1;
            pool.puff(pf.x + Math.cos(a) * v * out, y, pf.z + Math.sin(a) * v * out, 0.62, 0.74, 0.7, (1 - tt / 2.4) * 0.5, 0.18 + hash(p, 11) * 0.16 + tt * 0.1);
          }
          for (let p = 0; p < 6; p++) {
            const tt2 = tt - hash(p, 12) * 0.3;
            if (tt2 < 0) continue;
            pool.bubble(pf.x + (hash(p, 13) - 0.5) * 0.4, floorY + 0.1 + tt2 * 1.4, pf.z + (hash(p, 14) - 0.5) * 0.4, (1 - tt / 2.4) * 0.9, 0.06 + hash(p, 15) * 0.05);
          }
        }
        pool.end();
        const busy = ct < 4.2 || ev.puffs.length > 0 || life.jellies.jellies.some((j) => wall < j.glowUntil);
        if (busy) invalidate();
      }),
    [driver, clock, time, life, area, calm, reef, pool, spots, floorY, invalidate],
  );

  useEffect(() => () => dome.dispose(), [dome]);
  useEffect(() => () => seabed.dispose(), [seabed]);
  useEffect(
    () => () => {
      rays.mats.forEach((m) => m.dispose());
      rays.geo.dispose();
    },
    [rays],
  );
  useEffect(() => () => snow.material.dispose(), [snow]);
  useEffect(() => () => vents.material.dispose(), [vents]);

  const floorSize = Math.max(260, R * 40);
  const pointer = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
  const surfaceY = floorY + spots.surface;

  return (
    <>
      <color attach="background" args={[WATER.haze]} />
      <fog attach="fog" args={[WATER.haze, fogNear, fogFar]} />
      <mesh material={dome} renderOrder={1} frustumCulled={false} layers={NO_SHADOW_LAYER} position={[cx, floorY, cz]}>
        <sphereGeometry args={[420, 48, 24]} />
      </mesh>
      <mesh
        material={seabed}
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
        <planeGeometry args={[floorSize, floorSize, 180, 180]} />
      </mesh>

      {/* Sunlight through the water: a cool key from high up, a blue fill from the open water, the surface glow from above. */}
      <hemisphereLight args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[cx - R * 0.5 - 6, surfaceY + 6, cz + R * 0.6 + 6]} />
      <directionalLight color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[cx + R * 0.6 + 4, floorY + 3, cz - R - 8]} />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color="#d8fbff" intensity={2.2} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 14, 1]} />
        <Lightformer form="rect" color="#7fd4ec" intensity={0.8} position={[-4, 5, 8]} scale={[14, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#3f9fc0" intensity={0.5} position={[3, 2, -10]} scale={[16, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#0b3a4a" intensity={0.6} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      <primitive object={reef.group} />
      <primitive object={rays.group} />
      <primitive object={life.fish.mesh} />
      <primitive object={life.jellies.group} />
      <primitive object={life.turtle.group} />
      <mesh position={[spots.clam[0], floorY + 0.25, spots.clam[1]]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); events.current.clam = performance.now() / 1000; invalidate(); }} {...pointer} visible={false}>
        <sphereGeometry args={[0.7, 12, 8]} />
      </mesh>
      {life.jellies.jellies.map((j, i) => (
        <mesh
          key={i}
          ref={(m) => {
            jellyHits.current[i] = m;
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            j.glowUntil = performance.now() / 1000 + 2.2;
            invalidate();
          }}
          {...pointer}
          visible={false}
        >
          <sphereGeometry args={[0.6, 10, 8]} />
        </mesh>
      ))}
      <points frustumCulled={false} material={snow.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[snow.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[snow.seed, 4]} />
        </bufferGeometry>
      </points>
      <points frustumCulled={false} material={vents.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[vents.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[vents.seed, 4]} />
          <bufferAttribute attach="attributes-aVent" args={[vents.vent, 2]} />
        </bufferGeometry>
      </points>
      <primitive object={pool.points} />
    </>
  );
}

function smoothstepJs(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export { BufferAttribute };

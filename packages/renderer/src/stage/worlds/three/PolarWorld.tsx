import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  Vector4,
  type DirectionalLight,
  type HemisphereLight,
} from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import type { SceneBounds } from '../../three/StageEnvironment';
import { NO_SHADOW_LAYER } from '../../three/StageEnvironment';
import { FOG, NOISE, dotTexture, fogUniforms, rng } from './glsl';
import { polarSpots, worldLayout } from './layout';
import { penguinSpots, polarClearing } from './polarLayout';
import { buildPolarColonyProps, iglooTexture } from './polarProps';
import { ParticlePool, hash } from './particles';
import type { WorldClock } from './WorldLayer';
import { useGovernedInvalidate } from '../../three/perf';

/**
 * The sky over the ice: by day a pale polar blue with a low white sun, rosy at dusk and dawn; by night deep blue-black
 * with stars, aurora curtains and a bright moon. Also what the ice and the pool reflect. The sun and the moon are
 * directions (uSun, uMoon): they belong to the sky, not to the camera, so turning the view never moves them.
 */
const SKY = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uDay;
uniform float uNight;
uniform float uDusk;
vec3 polarSky(vec3 d, int layers) {
  float h = d.y;
  // Linear values. Night: the horizon is the night fog colour (#13283f), the zenith a deep #060b1a.
  vec3 zenN = vec3(0.0018, 0.0034, 0.0103);
  vec3 horN = vec3(0.0065, 0.0212, 0.0497);
  vec3 zenD = vec3(0.13, 0.32, 0.66);
  vec3 horD = vec3(0.62, 0.76, 0.88);
  vec3 horK = vec3(0.98, 0.56, 0.46);
  vec3 zen = mix(zenD, vec3(0.16, 0.18, 0.42), uDusk * 0.6);
  vec3 hor = mix(horD, horK, uDusk * 0.85);
  zen = mix(zen, zenN, uNight);
  hor = mix(hor, horN, uNight);
  vec3 col = mix(hor, zen, smoothstep(-0.05, 0.6, h));
  float az = atan(d.z, d.x);
  // The sun: a small white disc, a soft glow, a warm flare at dusk.
  float sunUp = smoothstep(-0.12, 0.04, uSun.y);
  float s = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.92, 0.8) * (pow(s, 10.0) * 0.32 + pow(s, 280.0) * 0.9) * sunUp;
  col = mix(col, vec3(1.0, 0.97, 0.9) * 1.25, smoothstep(0.99915, 0.99945, s) * sunUp);
  col += vec3(1.0, 0.45, 0.3) * pow(s, 4.0) * 0.4 * uDusk;
  // Aurora (at night, a hint of it at dusk): curtains with a crisp lower hem that fade upwards, shimmering, drifting.
  float aur = clamp(uNight + uDusk * 0.15, 0.0, 1.0);
  for (int i = 0; i < 2; i++) {
    if (i >= layers) break;
    float fi = float(i);
    float base = 0.13 + fi * 0.09 + 0.06 * sin(az * (2.0 + fi) + uTime * 0.04 + fi * 2.0) + 0.05 * fbm(vec2(az * 2.5 + fi * 7.0, uTime * 0.025));
    float above = h - base;
    float curtain = smoothstep(-0.012, 0.018, above) * exp(-max(above, 0.0) * (5.0 + fi * 3.0));
    float rays = 0.45 + 0.55 * fbm(vec2(az * 34.0 + uTime * 0.15 + fi * 13.0, uTime * 0.06));
    float pmask = smoothstep(0.24, 0.6, fbm(vec2(az * 1.4 - uTime * 0.018 + fi * 4.0, 2.3 + fi)));
    vec3 c = mix(vec3(0.2, 1.0, 0.62), vec3(0.58, 0.38, 1.0), smoothstep(0.02, 0.22, above) * (0.6 + 0.4 * fi));
    col += c * curtain * rays * pmask * (0.62 - fi * 0.2) * aur;
  }
  // Stars, above the aurora's hem, twinkling.
  vec2 sp = vec2(az * 140.0, h * 260.0);
  float st = hash12(floor(sp));
  float star = step(0.9965, st) * smoothstep(0.04, 0.25, h) * (0.55 + 0.45 * sin(uTime * 1.7 + st * 90.0));
  col += vec3(0.85, 0.92, 1.0) * star * uNight;
  // The moon: a bright disc with soft grey seas, and a wide halo of moonlight.
  float m = dot(d, uMoon);
  float moonUp = smoothstep(-0.06, 0.06, uMoon.y) * (1.0 - 0.75 * uDay);
  float disc = smoothstep(0.99905, 0.9993, m);
  vec3 mx = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
  vec3 my = cross(mx, uMoon);
  vec2 mp = vec2(dot(d, mx), dot(d, my)) * 24.0;
  vec3 moon = vec3(0.97, 0.97, 0.92) * (0.84 + 0.16 * smoothstep(0.35, 0.65, fbm(mp * 3.0 + 7.0)));
  col = mix(col, moon, disc * moonUp);
  col += vec3(0.4, 0.55, 0.85) * (pow(max(m, 0.0), 40.0) * 0.22 + pow(max(m, 0.0), 500.0) * 0.5) * moonUp * (1.0 - disc);
  return col;
}
`;

const SKY_FRAGMENT = /* glsl */ `
${NOISE}
${SKY}
varying vec3 vDir;
void main() {
  gl_FragColor = vec4(polarSky(normalize(vDir), 2), 1.0);
  #include <colorspace_fragment>
}
`;

const GROUND_FRAGMENT = /* glsl */ `
${NOISE}
${SKY}
${FOG}
uniform vec2 uCenter;
uniform vec2 uIce;
uniform vec3 uIceColor;
uniform vec3 uIceDay;
uniform vec3 uSnowColor;
uniform vec3 uTint;
uniform vec3 uLamps[LAMPS];
uniform vec4 uSeg[SEGS];
uniform vec4 uPad[PADS];
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec2 q = (p - uCenter) / vec2(uIce.x, p.y > uCenter.y ? uIce.y * 1.2 : uIce.y);
  float r = length(q);
  float wobble = (fbm(p * 0.12) - 0.5) * 0.22;
  float ice = 1.0 - smoothstep(0.93, 1.05, r + wobble);

  // The ice: deep and uneven, with cracks of two sizes, mirroring the sky (the aurora and the moon at night, the blue by day).
  vec2 v = voronoi(p * 0.3 + vec2(vnoise(p * 0.4), vnoise(p * 0.4 + 9.0)) * 0.8);
  float crack = (1.0 - smoothstep(0.0, 0.025, v.y)) * smoothstep(0.38, 0.7, fbm(p * 0.35 + 2.0)) * (0.5 + 0.5 * vnoise(p * 3.0));
  vec2 v2 = voronoi(p * 1.3 + 3.1);
  float crack2 = (1.0 - smoothstep(0.0, 0.018, v2.y)) * smoothstep(0.5, 0.8, vnoise(p * 0.6 + 5.0));
  float depth = fbm(p * 0.16 + 3.0);
  vec3 base = mix(uIceColor, uIceDay, uDay);
  vec3 iceCol = mix(base * 0.78, base * 1.22, depth);
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
  R.xz += (vec2(vnoise(p * 0.5), vnoise(p * 0.5 + 5.0)) - 0.5) * 0.12;
  vec3 refl = polarSky(normalize(vec3(R.x, R.y * 0.42, R.z)), 1);
  float fres = 0.18 + 0.82 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 3.0);
  vec3 sky0 = mix(vec3(0.0065, 0.0212, 0.0497), vec3(0.4, 0.55, 0.72), uDay);
  vec3 aur = max(refl - sky0, 0.0);
  float streak = smoothstep(0.45, 0.85, fbm(vec2(p.x * 0.9, p.y * 0.12) + uTime * 0.01));
  iceCol = mix(iceCol, iceCol * 0.8 + sky0 * 0.4, 0.4 * fres) + aur * (0.12 + 0.4 * streak) * fres;
  // The glint of the moon (at night) and the sun (by day) on the ice.
  float glintM = pow(max(dot(normalize(R), uMoon), 0.0), 60.0) * smoothstep(-0.05, 0.1, uMoon.y) * uNight;
  float glintS = pow(max(dot(normalize(R), uSun), 0.0), 90.0) * smoothstep(-0.05, 0.1, uSun.y) * uDay;
  iceCol += (vec3(0.55, 0.68, 0.85) * glintM * 1.3 + vec3(1.0, 0.95, 0.85) * glintS * 0.5) * (0.5 + 0.5 * vnoise(p * 4.0));
  iceCol += vec3(0.5, 0.72, 0.95) * (crack * 0.16 + crack2 * 0.05) * (0.6 + 0.4 * uNight);
  // Polished centre: a soft sheen where the structures stand.
  iceCol += vec3(0.08, 0.14, 0.22) * (1.0 - smoothstep(0.0, 0.4, r)) * (1.0 - 0.5 * uDay);

  // Snow beyond the ice, in drifts; the edge a soft rim of packed snow.
  float drift = fbm(p * 0.3 + 7.0);
  vec3 snowCol = uSnowColor * (0.78 + 0.32 * drift);
  float rim = smoothstep(0.9, 1.02, r + wobble) * (1.0 - smoothstep(1.02, 1.2, r + wobble));
  snowCol = mix(snowCol, uSnowColor * 1.12, rim * 0.6);
  float g = hash12(floor(p * 26.0));
  float sparkle = step(0.9955, g) * (0.5 + 0.5 * sin(uTime * 2.6 + g * 120.0));
  snowCol += vec3(0.7, 0.85, 1.0) * sparkle * 0.7;
  vec3 col = mix(snowCol, iceCol, ice);
  col += vec3(0.6, 0.85, 1.0) * sparkle * 0.25 * ice;

  // The paths between the colony's places (packed snow, trodden), and the pads of snow the places stand on.
  float pd = 1e3;
  for (int i = 0; i < SEGS; i++) {
    vec4 sg = uSeg[i];
    vec2 pa = p - sg.xy;
    vec2 ba = sg.zw - sg.xy;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    pd = min(pd, length(pa - ba * hh));
  }
  float pedge = (fbm(p * 1.7 + 5.0) - 0.5) * 0.3;
  float pathM = 1.0 - smoothstep(0.42, 0.62, pd + pedge);
  vec3 pathCol = mix(uSnowColor * 0.92, uSnowColor * 1.08, fbm(p * 3.0));
  // Little footprints along the middle of the path.
  vec2 fp = fract(p * 2.2) - 0.5;
  pathCol *= 1.0 - 0.12 * (1.0 - smoothstep(0.08, 0.14, length(fp))) * step(0.6, hash12(floor(p * 2.2))) * (1.0 - smoothstep(0.1, 0.3, pd));
  col = mix(col, pathCol, pathM * 0.85);
  for (int i = 0; i < PADS; i++) {
    vec4 pv = uPad[i];
    float dd = length(p - pv.xy) / pv.z + pedge * 0.3;
    float on = 1.0 - smoothstep(0.88, 1.0, dd);
    vec3 pc = pv.w < 0.5 ? mix(uSnowColor * 0.55, uSnowColor * 0.95, smoothstep(0.1, 0.5, dd))
      : pv.w < 1.5 ? mix(uSnowColor * 0.95, vec3(0.62, 0.72, 0.84), 0.3 * smoothstep(0.6, 0.9, sin(p.x * 6.0) * 0.5 + 0.5))
      : uSnowColor * (0.96 + 0.08 * fbm(p * 5.0));
    float rimP = smoothstep(0.8, 0.9, dd) * (1.0 - smoothstep(0.93, 1.0, dd));
    pc = mix(pc, uSnowColor * 1.12, rimP * 0.5);
    col = mix(col, pc, on * 0.88);
  }

  // Daylight or moonlight, and warm pools of light round the lanterns and the fire after dark.
  col *= uTint;
  vec3 pool = vec3(0.0);
  for (int i = 0; i < LAMPS; i++) {
    vec2 dl = p - uLamps[i].xy;
    pool += vec3(1.0, 0.62, 0.3) * uLamps[i].z * exp(-dot(dl, dl) / (4.0 + 3.0 * max(0.0, uLamps[i].z - 0.8)));
  }
  col += pool * (0.4 + 0.6 * col);
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

const SNOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uBox;
uniform vec3 uOrigin;
attribute vec4 aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float fall = 0.45 + aSeed.x * 0.55;
  p.y = mod(p.y - uTime * fall, uBox.y);
  // Each flake drifts on its own slow eddy (two sines of different rates, never in step with its neighbour).
  p.x += sin(uTime * (0.31 + aSeed.y * 0.4) + aSeed.z * 6.28) * 0.35 + sin(uTime * 0.13 + aSeed.w * 6.28) * 0.2;
  p.z += cos(uTime * (0.23 + aSeed.z * 0.3) + aSeed.y * 6.28) * 0.25;
  vec4 mv = modelViewMatrix * vec4(uOrigin + p, 1.0);
  gl_PointSize = (1.6 + aSeed.w * 2.6) * (55.0 / -mv.z);
  vAlpha = smoothstep(0.0, 1.2, p.y) * smoothstep(uBox.y, uBox.y - 2.0, p.y) * (0.45 + 0.4 * aSeed.w);
  gl_Position = projectionMatrix * mv;
}
`;

const SNOW_FRAGMENT = /* glsl */ `
uniform float uDay;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, d)) * vAlpha * (1.0 - 0.35 * uDay);
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.92, 0.96, 1.0, a);
}
`;

const HOLE_FRAGMENT = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uSplash;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ripple = sin(r * 26.0 - uTime * 3.0) * 0.5 + 0.5;
  float splash = sin(r * 34.0 - uSplash * 14.0) * exp(-uSplash * 2.2) * step(0.0, uSplash) * (1.0 - smoothstep(uSplash * 1.4, uSplash * 1.4 + 0.2, r));
  vec3 deep = vec3(0.01, 0.05, 0.11);
  vec3 col = mix(vec3(0.05, 0.16, 0.26), deep, smoothstep(0.0, 0.85, 1.0 - r));
  col += vec3(0.25, 0.5, 0.7) * (ripple * 0.06 + max(splash, 0.0) * 0.35);
  col += vec3(0.2, 0.9, 0.6) * 0.05 * fbm(p * 3.0 + uTime * 0.2);
  col *= mix(vec3(1.0), uTint, 0.5);
  float a = 1.0 - smoothstep(0.92, 1.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

/**
 * The pool: dark, clear water in an opening in the ice. Ripples run across it, rings spread from wherever a penguin
 * goes in or comes out (uRings: x, z, age), the sky shows in it (the moon's path at night), and it is lighter at the edge.
 */
const POOL_FRAGMENT = /* glsl */ `
${NOISE}
${SKY}
uniform vec2 uC;
uniform vec2 uR;
uniform vec3 uTint;
uniform vec3 uRings[6];
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec2 q = (p - uC) / uR;
  float r = length(q);
  if (r > 1.0) discard;
  // Two slow wave trains crossing (fixed frequencies: nothing ever jumps), and the rings of the splashes.
  float w = sin(dot(p, vec2(1.7, 0.6)) * 2.4 - uTime * 1.3) * 0.5 + sin(dot(p, vec2(-0.5, 1.4)) * 3.1 - uTime * 1.7) * 0.5;
  float rings = 0.0;
  for (int i = 0; i < 6; i++) {
    float age = uRings[i].z;
    if (age < 0.0 || age > 4.0) continue;
    float d = length(p - uRings[i].xy);
    rings += sin(d * 9.0 - age * 7.0) * exp(-age * 0.9) * (1.0 - smoothstep(age * 1.3, age * 1.3 + 0.4, d)) * smoothstep(0.0, 0.15, d);
  }
  vec3 n = normalize(vec3((w * 0.06 + rings * 0.12) * vec2(0.8, 0.6), 1.0)).xzy;
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 R = reflect(V, n);
  vec3 refl = polarSky(normalize(vec3(R.x, max(R.y, 0.02), R.z)), 1);
  float fres = 0.12 + 0.88 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 4.0);
  vec3 deep = mix(vec3(0.004, 0.025, 0.06), vec3(0.03, 0.2, 0.32), uDay);
  vec3 shallow = mix(vec3(0.02, 0.09, 0.16), vec3(0.18, 0.5, 0.62), uDay);
  vec3 col = mix(deep, shallow, smoothstep(0.55, 1.0, r));
  col = mix(col, refl, fres * 0.7);
  col += vec3(0.6, 0.8, 1.0) * max(rings, 0.0) * 0.18;
  // Light under the surface: caustics by day.
  col += vec3(0.3, 0.6, 0.7) * 0.08 * smoothstep(0.55, 0.85, fbm(p * 1.6 + vec2(uTime * 0.12, -uTime * 0.08))) * uDay;
  col *= mix(vec3(1.0), uTint, 0.6);
  // The moon's glitter on the water.
  col += vec3(0.75, 0.85, 1.0) * pow(max(dot(normalize(R), uMoon), 0.0), 30.0) * smoothstep(-0.05, 0.1, uMoon.y) * uNight * (0.6 + 0.4 * w);
  float a = 1.0 - smoothstep(0.93, 1.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

export interface WorldProps {
  model: StageModel;
  bounds: SceneBounds;
  driver: StageDriver;
  calm: boolean;
  clock: WorldClock;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();
const _c = new Color();
const _moonPos = new Vector3();
const _sunPos = new Vector3();

/** The colours the shelf's light goes through in a day: full day, the golden hour, the moonlit night. */
const TONE = {
  white: new Color(1, 1, 1),
  dusk: new Color(1.0, 0.8, 0.72),
  night: new Color(0.62, 0.72, 1.0),
  hazeDay: new Color('#cfdcea'),
  hazeDusk: new Color('#d8b4b0'),
  hazeNight: new Color('#13283f'),
  skyDay: new Color('#dfeaf7'),
  groundDay: new Color('#7f97b0'),
  keyDay: new Color('#fff6ea'),
  keyDusk: new Color('#ffc9a0'),
  keyNight: new Color('#c4d6ff'),
  fillNight: new Color('#9ab8ff'),
};

/**
 * The penguins' world: an ice shelf about three times the size it was, under a sky with a day and a night (an 18
 * minute day, shared with the grove). By day the ice is a polar blue under a low sun; at dusk it goes rosy; at night
 * the aurora comes out over it and a strong moon lights it, the ice lanterns and the igloo doorways glow, and the fire
 * throws a warm pool of light. The ice mirrors the sky, cracks catch the light, snow drifts ring it, ice cliffs stand
 * behind, and snow falls. The colony's places stand on it (see polarLayout.ts): the fire, the gym, the classroom, the
 * tech corner, the igloo village, the pool, the ice slide, the play area. The crew's igloo, fishing hole and fish
 * bucket stand where they always did, beside the structures. Click the igloo, the fishing hole, a crystal cluster or a
 * lantern; click the snow for a puff.
 */
export function PolarWorld({ model, bounds, driver, calm, clock }: WorldProps) {
  const invalidate = useGovernedInvalidate();
  const three = useThree((s) => s.scene);
  const palette = model.palette;
  const floorY = model.floorY;
  const { radius: R } = bounds;
  const { cx, cz } = useMemo(() => worldLayout(model), [model]);
  const { clearX, clearZ } = useMemo(() => polarClearing(model), [model]);
  const ice = useMemo(() => penguinSpots(model), [model]);
  const crew = useMemo(() => polarSpots(model), [model]);
  // The shelf is about three times the ice it was: the haze, the cliffs and the drifts all stand further back.
  const fogNear = R * 2.6 + 12 + clearZ * 0.6;
  const fogFar = R * 8 + 60 + Math.max(clearX, clearZ) * 2.4;
  const horizon = '#13283f';
  const LAMPS = ice.lanterns.length + 1;

  // The time of day, shared by every shader on the shelf (the sky, the ice, the pool).
  const sky$ = useMemo(
    () => ({
      uTime: { value: 0 },
      uSun: { value: new Vector3(0.57, 0.17, -0.8) },
      uMoon: { value: new Vector3(-0.57, -0.17, -0.8) },
      uDay: { value: 1 },
      uNight: { value: 0 },
      uDusk: { value: 0 },
      uTint: { value: new Color(1, 1, 1) },
      uLamps: { value: Array.from({ length: LAMPS }, () => new Vector3(0, 0, 0)) },
    }),
    [LAMPS],
  );
  const trails = useMemo(() => {
    const segs: Vector4[] = [];
    for (const path of ice.places.paths) for (let i = 0; i + 1 < path.length; i++) segs.push(new Vector4(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
    if (!segs.length) segs.push(new Vector4(1e4, 1e4, 1e4, 1e4));
    const pads = ice.places.pads.map(([x, z, r, kind]) => new Vector4(x, z, r, kind));
    if (!pads.length) pads.push(new Vector4(1e4, 1e4, 1, 0));
    return { segs, pads };
  }, [ice]);

  const sky = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: sky$.uTime, uSun: sky$.uSun, uMoon: sky$.uMoon, uDay: sky$.uDay, uNight: sky$.uNight, uDusk: sky$.uDusk },
        vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [sky$],
  );
  const ground = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: sky$.uTime,
          uSun: sky$.uSun,
          uMoon: sky$.uMoon,
          uDay: sky$.uDay,
          uNight: sky$.uNight,
          uDusk: sky$.uDusk,
          uTint: sky$.uTint,
          uLamps: sky$.uLamps,
          uCenter: { value: [cx, cz] },
          uIce: { value: [clearX, clearZ] },
          uIceColor: { value: new Color(palette.floor) },
          uIceDay: { value: new Color('#5d8fbd') },
          uSnowColor: { value: new Color('#97adc9') },
          uSeg: { value: trails.segs },
          uPad: { value: trails.pads },
          ...fogUniforms(horizon, fogNear, fogFar),
        },
        vertexShader: WORLD_VERTEX,
        fragmentShader: `#define LAMPS ${LAMPS}\n#define SEGS ${trails.segs.length}\n#define PADS ${trails.pads.length}\n${GROUND_FRAGMENT}`,
        toneMapped: false,
      }),
    [cx, cz, clearX, clearZ, palette.floor, fogNear, fogFar, sky$, trails, LAMPS],
  );
  const poolMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: sky$.uTime,
          uSun: sky$.uSun,
          uMoon: sky$.uMoon,
          uDay: sky$.uDay,
          uNight: sky$.uNight,
          uDusk: sky$.uDusk,
          uTint: sky$.uTint,
          uC: { value: [ice.places.pool.x, ice.places.pool.z] },
          uR: { value: [ice.places.pool.rx, ice.places.pool.rz] },
          uRings: { value: Array.from({ length: 6 }, () => new Vector3(0, 0, -1)) },
        },
        vertexShader: WORLD_VERTEX,
        fragmentShader: POOL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [sky$, ice],
  );
  const snow = useMemo(() => {
    const count = 1700;
    const box = new Vector3(clearX * 2.4 + 24, 13, clearZ * 2.4 + 22);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const r = rng(41);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * box.x;
      pos[i * 3 + 1] = r() * box.y;
      pos[i * 3 + 2] = (r() - 0.6) * box.z;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    }
    const material = new ShaderMaterial({
      uniforms: { uTime: sky$.uTime, uDay: sky$.uDay, uBox: { value: box }, uOrigin: { value: new Vector3(cx, floorY, cz) } },
      vertexShader: SNOW_VERTEX,
      fragmentShader: SNOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { pos, seed, material };
  }, [clearX, clearZ, cx, cz, floorY, sky$]);

  // ── Scenery ────────────────────────────────────────────────────────────
  const props = useMemo(() => {
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T): T => {
      disposables.push(x);
      return x;
    };
    const r = rng(7);
    const group = new Group();

    // Ice cliffs: a broken wall of pale ice behind the shelf, and lower ones round its sides.
    const cliffGeo = keep(new IcosahedronGeometry(1, 1));
    const cp = cliffGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const v = new Vector3().fromBufferAttribute(cp, i);
      const n = 0.82 + 0.36 * hash(3, Math.round((v.x * 13 + v.y * 7 + v.z * 5) * 10));
      cp.setXYZ(i, v.x * n, v.y * n, v.z * n);
    }
    cliffGeo.computeVertexNormals();
    const cliffMat = keep(new MeshStandardMaterial({ color: '#9fbfdc', roughness: 0.4, metalness: 0, flatShading: true, emissive: new Color('#0d2036'), emissiveIntensity: 0.5 }));
    const cliffs: [number, number, number, number, number, number][] = [];
    for (let i = 0; i < 44; i++) {
      // Round the back half of the shelf, from one side to the other, beyond the snow.
      const a = Math.PI + (i / 43) * Math.PI + (r() - 0.5) * 0.05;
      const rr = 1.45 + r() * 0.2 + Math.abs(Math.sin(a)) * 0.1;
      const x = cx + Math.cos(a) * clearX * rr;
      const z = cz + Math.sin(a) * clearZ * rr;
      const back = -Math.sin(a);
      // Low at the sides, taller behind: the sky (the sun, the moon, the aurora) shows over them.
      const h = (1.0 + r() * 1.8) * (0.45 + 0.75 * back) + back * 1.0;
      cliffs.push([x, z, 1.6 + r() * 2.4, h, 1.6 + r() * 1.8, r() * Math.PI]);
    }
    const cliffMesh = new InstancedMesh(cliffGeo, cliffMat, cliffs.length);
    cliffs.forEach(([x, z, w, h, d, rot], i) => {
      _p.set(x, floorY + h * 0.35, z);
      _q.setFromEuler(_e.set(0, rot, (r() - 0.5) * 0.2));
      _s.set(w, h, d);
      cliffMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(cliffMesh);

    // Snow drifts round the rim of the ice (the front kept clear, where the camera looks in).
    const driftGeo = keep(new SphereGeometry(1, 20, 12));
    const driftMat = keep(new MeshStandardMaterial({ color: '#c6d6e9', roughness: 0.95, metalness: 0, emissive: new Color('#122640'), emissiveIntensity: 0.3 }));
    const drifts: number[][] = [];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + r() * 0.08;
      if (Math.sin(a) > 0.62) continue;
      const rr = 1.06 + r() * 0.14;
      drifts.push([cx + Math.cos(a) * clearX * rr, cz + Math.sin(a) * clearZ * rr, 0.8 + r() * 1.5, 0.2 + r() * 0.35, 0.6 + r() * 0.9, a]);
    }
    const driftMesh = new InstancedMesh(driftGeo, driftMat, drifts.length);
    drifts.forEach(([x, z, w, h, d, a], i) => {
      _p.set(x, floorY - h * 0.15, z);
      _q.setFromEuler(_e.set(0, -a, 0));
      _s.set(w, h, d);
      driftMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(driftMesh);

    // Crystals: clusters of glassy blue shards that chime (sparkle) when clicked.
    const shardGeo = keep(new OctahedronGeometry(0.5, 0));
    const shardMat = keep(new MeshStandardMaterial({ color: '#8fd3ff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, emissive: new Color('#2f7fc0'), emissiveIntensity: 0.55 }));
    const clusterAt = ice.crystals;
    const shards: number[][] = [];
    clusterAt.forEach(([x, z], c) => {
      for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 2;
        const d = r() * 0.55;
        const h = 0.6 + r() * 1.4 * (k === 0 ? 1.6 : 1);
        shards.push([x + Math.cos(a) * d, z + Math.sin(a) * d, 0.28 + r() * 0.2, h, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6, c]);
      }
    });
    const shardMesh = new InstancedMesh(shardGeo, shardMat, shards.length);
    shards.forEach(([x, z, w, h, rx, rz], i) => {
      _p.set(x, floorY + h * 0.35, z);
      _q.setFromEuler(_e.set(rx, r() * Math.PI, rz));
      _s.set(w, h, w);
      shardMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(shardMesh);

    // The crew's igloo, behind on the left, its door glowing.
    const igloo = new Group();
    const ix = crew.igloo.x, iz = crew.igloo.z;
    igloo.position.set(ix, floorY, iz);
    igloo.rotation.y = crew.igloo.yaw;
    const brick = iglooTexture();
    if (brick) keep(brick);
    const domeMat = keep(new MeshStandardMaterial({ map: brick ?? undefined, roughness: 0.75, metalness: 0, emissive: new Color('#203a58'), emissiveIntensity: 0.35 }));
    igloo.add(new Mesh(keep(new SphereGeometry(1.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat));
    const tunnel = new Mesh(keep(new CylinderGeometry(0.62, 0.62, 1.1, 24, 1, true, -Math.PI / 2, Math.PI)), domeMat);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.set(0, 0, 1.55);
    igloo.add(tunnel);
    const doorMat = keep(new MeshStandardMaterial({ color: '#2a1606', emissive: new Color('#ffa64d'), emissiveIntensity: 1.6, roughness: 1 }));
    const door = new Mesh(keep(new CircleGeometry(0.56, 24, 0, Math.PI)), doorMat);
    door.position.set(0, 0.0, 1.62);
    igloo.add(door);
    group.add(igloo);

    // The fishing hole, beside the structures on the right.
    const hx = crew.hole.x, hz = crew.hole.z;
    const holeMat = keep(
      new ShaderMaterial({ uniforms: { uTime: sky$.uTime, uSplash: { value: -1 }, uTint: sky$.uTint }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: HOLE_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false }),
    );
    const hole = new Mesh(keep(new PlaneGeometry(2.2, 2.2)), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(hx, floorY + 0.006, hz);
    hole.layers.set(NO_SHADOW_LAYER);
    group.add(hole);
    const lip = new Mesh(keep(new TorusGeometry(1.08, 0.16, 10, 40)), driftMat);
    lip.rotation.x = Math.PI / 2;
    lip.scale.set(1, 1, 0.55);
    lip.position.set(hx, floorY + 0.03, hz);
    group.add(lip);

    // A fish (it jumps from the hole).
    const fish = new Group();
    const fishMat = keep(new MeshStandardMaterial({ color: '#9fb6c8', roughness: 0.25, metalness: 0.55, emissive: new Color('#1d3348'), emissiveIntensity: 0.3 }));
    const fishBody = new Mesh(keep(new SphereGeometry(0.5, 16, 10)), fishMat);
    fishBody.scale.set(0.11, 0.13, 0.32);
    fish.add(fishBody);
    const fishTail = new Mesh(keep(new ConeGeometry(0.1, 0.16, 3)), fishMat);
    fishTail.rotation.x = -Math.PI / 2;
    fishTail.scale.set(0.3, 1, 1);
    fishTail.position.z = -0.2;
    fish.add(fishTail);
    fish.visible = false;
    group.add(fish);

    // The fish bucket, front right: where the crew fetches a snack.
    const bucket = new Group();
    bucket.position.set(crew.bucket.x, floorY, crew.bucket.z);
    const pailMat = keep(new MeshStandardMaterial({ color: '#5f86ad', roughness: 0.4, metalness: 0.15, emissive: new Color('#0d2036'), emissiveIntensity: 0.4 }));
    const pail = new Mesh(keep(new CylinderGeometry(0.46, 0.36, 0.5, 24, 1, true)), pailMat);
    pail.position.y = 0.25;
    bucket.add(pail);
    const pailBase = new Mesh(keep(new CylinderGeometry(0.36, 0.36, 0.04, 24)), pailMat);
    pailBase.position.y = 0.02;
    bucket.add(pailBase);
    const pailRim = new Mesh(keep(new TorusGeometry(0.46, 0.035, 8, 28)), pailMat);
    pailRim.rotation.x = Math.PI / 2;
    pailRim.position.y = 0.5;
    bucket.add(pailRim);
    const heap = new Mesh(keep(new SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new MeshStandardMaterial({ color: '#c6d6e9', roughness: 0.9 })));
    heap.position.y = 0.42;
    bucket.add(heap);
    for (let i = 0; i < 4; i++) {
      const bf = new Mesh(fishBody.geometry, fishMat);
      bf.scale.set(0.11, 0.13, 0.34);
      bf.position.set(Math.cos(i * 1.7) * 0.2, 0.62 + (i % 2) * 0.04, Math.sin(i * 1.7) * 0.2);
      bf.rotation.set(0.5 - i * 0.2, i * 1.1, 0.4);
      bucket.add(bf);
    }
    group.add(bucket);

    // The colony's furniture and places.
    const colony = buildPolarColonyProps(ice.places, ice.lanterns, floorY);
    disposables.push(colony);
    group.add(colony.group);

    // The pool's water.
    const pl = ice.places.pool;
    const water = new Mesh(keep(new CircleGeometry(1, 48)), poolMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(pl.rx, pl.rz, 1);
    water.position.set(pl.x, floorY + 0.012, pl.z);
    water.renderOrder = 2;
    water.layers.set(NO_SHADOW_LAYER);
    group.add(water);

    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, cliffMesh, cliffMat, driftMesh, shardMesh, shardMat, clusterAt, igloo, ix, iz, doorMat, holeMat, hx, hz, fish, colony, disposables };
  }, [cx, cz, clearX, clearZ, floorY, ice, crew, sky$, poolMat]);

  useEffect(
    () => () => {
      props.disposables.forEach((d) => d.dispose());
      props.cliffMesh.dispose();
      props.driftMesh.dispose();
      props.shardMesh.dispose();
    },
    [props],
  );

  // Halos round the lanterns and the fire after dark.
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
  }, [LAMPS]);
  useEffect(
    () => () => {
      halos.tex?.dispose();
      halos.list.forEach((h) => h.material.dispose());
    },
    [halos],
  );

  const keyLight = useRef<DirectionalLight>(null);
  const fillLight = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const pool = useMemo(() => new ParticlePool(320, true), []);
  useEffect(() => () => pool.dispose(), [pool]);
  // Viewer interactions (wall-clock seconds when they happened).
  const events = useRef({
    igloo: -100,
    fish: -100,
    fishSeen: -100,
    crystals: ice.crystals.map(() => -100),
    lantern: ice.lanterns.map(() => 1),
    lanternAt: ice.lanterns.map(() => -100),
    puffs: [] as { x: number; z: number; t: number }[],
    punchAmp: 0,
  });
  const nextFish = useRef(6);

  useEffect(
    () =>
      driver.register((_sample: StageSample) => {
        const now = clock.now;
        const wall = performance.now() / 1000;
        const ev = events.current;
        sky$.uTime.value = now;

        // The time of day: the sun and the moon cross the sky, the light goes golden, then a cold blue, then comes back.
        const day = clock.day;
        const nightW = day.night;
        const duskW = day.dusk;
        sky$.uSun.value.set(day.sun[0], day.sun[1], day.sun[2]);
        sky$.uMoon.value.set(day.moon[0], day.moon[1], day.moon[2]);
        sky$.uDay.value = day.day;
        sky$.uNight.value = nightW;
        sky$.uDusk.value = duskW;
        sky$.uTint.value.copy(TONE.white).lerp(TONE.dusk, duskW * 0.8).lerp(TONE.night, nightW);
        _c.copy(TONE.hazeDay).lerp(TONE.hazeDusk, duskW * 0.8).lerp(TONE.hazeNight, nightW);
        if (three.background instanceof Color) three.background.copy(_c);
        if (three.fog) three.fog.color.copy(_c);
        (ground.uniforms.uFogColor.value as Color).copy(_c);
        three.environmentIntensity = palette.lights.envIntensity * (1 + 0.5 * day.day);
        if (hemi.current) {
          hemi.current.color.copy(TONE.skyDay).lerp(_c.set(palette.lights.sky), nightW);
          hemi.current.groundColor.copy(TONE.groundDay).lerp(_c.set(palette.lights.ground), nightW);
          hemi.current.intensity = palette.lights.ambient * (1.1 - 0.15 * nightW);
        }
        // The key light comes from the sun by day and from the moon by night (high enough to light the whole shelf):
        // moonlight is strong here, cold and blue, so the colony stays easy to see.
        const sunUp = Math.max(0, Math.min(1, day.day * 1.2));
        _sunPos.set(cx + day.sun[0] * 70, floorY + Math.max(18, day.sun[1] * 70), cz + Math.abs(day.sun[2]) * 40 + 20);
        _moonPos.set(cx + day.moon[0] * 70, floorY + Math.max(18, day.moon[1] * 70), cz + Math.abs(day.moon[2]) * 40 + 20);
        if (keyLight.current) {
          keyLight.current.position.lerpVectors(_moonPos, _sunPos, sunUp);
          keyLight.current.color.copy(TONE.keyDay).lerp(TONE.keyDusk, duskW).lerp(TONE.keyNight, nightW);
          keyLight.current.intensity = palette.lights.keyIntensity * (1 + 0.15 * day.day - 0.18 * duskW - 0.12 * nightW);
        }
        // The fill rims everything from behind, from where the moon stands at night.
        if (fillLight.current) {
          fillLight.current.color.set(palette.lights.fill).lerp(TONE.fillNight, nightW);
          fillLight.current.intensity = palette.lights.fillIntensity * (1 + 2.6 * nightW);
          _moonPos.set(cx + day.moon[0] * 70, floorY + Math.max(8, day.moon[1] * 70), cz + day.moon[2] * 70);
          fillLight.current.position.lerpVectors(_p.set(cx + R * 0.5, floorY + 5, cz - R - 10), _moonPos, nightW);
        }
        // The cliffs glow faintly blue in the dark, and are plain sunlit ice by day.
        props.cliffMat.emissiveIntensity = 0.5 - 0.3 * day.day;

        // Lit at dusk, glowing all night.
        const lit = Math.min(1, Math.max(nightW * 1.2, duskW * 0.55 * (1 - day.day * 0.5)));
        const lamps = sky$.uLamps.value;
        const colony = props.colony;
        colony.lamps.forEach((l, i) => {
          const target = ev.lantern[i] ?? 1;
          const since = wall - (ev.lanternAt[i] ?? -100);
          const k = since < 0.6 ? (target ? since / 0.6 : 1 - since / 0.6) : target;
          const flick = calm ? 1 : 0.9 + 0.1 * Math.sin(now * 5.7 + i * 2.1) * Math.sin(now * 2.1 + i);
          l.mat.emissiveIntensity = 0.15 + 2.2 * lit * flick * k;
          lamps[i].set(l.x, l.z, 0.62 * lit * flick * k);
          const h = halos.list[i];
          h.visible = lit * k > 0.02;
          if (h.visible) {
            h.position.set(l.x, floorY + 1.4, l.z);
            h.scale.setScalar(1.5 + 0.08 * flick);
            h.material.opacity = 0.5 * lit * flick * k;
          }
        });
        // The campfire: flames dancing, light flickering (a warm pool on the ice, a halo), sparks; it is the night's light.
        const fl = calm ? 1 : 1 + 0.16 * Math.sin(now * 9.1) * Math.sin(now * 5.3 + 1) + 0.07 * Math.sin(now * 17.3);
        colony.fire.light.intensity = (2 + 18 * lit) * fl;
        colony.fire.flames.forEach((f, i) => {
          const wob = calm ? 1 : 0.85 + 0.22 * Math.sin(now * (6.5 + f.seed) + f.seed * 3) + 0.1 * Math.sin(now * 13.7 + f.seed);
          f.mesh.scale.y = f.base * wob;
          f.mesh.scale.x = f.mesh.scale.z = (0.14 + 0.2 * (1 - i * 0.2)) * (0.92 + 0.12 * Math.sin(now * 8 + f.seed));
          f.mesh.rotation.z = calm ? 0 : 0.1 * Math.sin(now * 4.4 + f.seed * 2);
        });
        const fi = LAMPS - 1;
        lamps[fi].set(colony.fire.x, colony.fire.z, 2.4 * (0.3 + 0.7 * lit) * fl);
        const fireHalo = halos.list[fi];
        fireHalo.visible = true;
        fireHalo.position.set(colony.fire.x, floorY + 0.75, colony.fire.z);
        fireHalo.scale.setScalar((3.2 + 0.5 * lit) * (0.97 + 0.05 * fl));
        fireHalo.material.opacity = (0.2 + 0.4 * lit) * Math.min(1.2, fl);
        // Igloo doorways glow in the dark; the laptop screen glows (busier while someone types).
        for (const d of colony.doors) d.emissiveIntensity = 0.35 + 1.6 * lit * (calm ? 1 : 0.95 + 0.05 * Math.sin(now * 3.1));
        const typing = clock.colony.members.some((m) => m.act === 'type');
        colony.screen.emissiveIntensity = (0.55 + 1.5 * nightW) * (typing && !calm ? 1 + 0.12 * Math.sin(now * 11) * Math.sin(now * 2.3) : 1);
        // The barbell is off its rack while it is lifted; the punching bag swings when it is hit.
        const lifting = clock.colony.members.some((m) => m.act === 'lift');
        for (const bar of colony.rackBar) bar.visible = !lifting;
        const punching = clock.colony.members.some((m) => m.act === 'punch');
        ev.punchAmp += ((punching ? 0.22 : 0) - ev.punchAmp) * 0.08;
        for (const pb of colony.punch) {
          pb.pivot.rotation.z = calm ? 0 : -ev.punchAmp * (0.5 + 0.5 * Math.sin(now * 4.6)) + 0.02 * Math.sin(now * 0.9);
          pb.pivot.rotation.x = calm ? 0 : 0.02 * Math.sin(now * 0.7);
        }
        // Floes bob gently in the pool, each at its own pace; the ball rocks.
        for (const f of colony.floes) {
          f.mesh.position.y = floorY + 0.02 + (calm ? 0 : 0.015 * Math.sin(now * (0.9 + (f.seed % 0.4)) + f.seed * 3));
          f.mesh.rotation.y = f.seed + (calm ? 0 : 0.05 * Math.sin(now * 0.21 + f.seed));
          f.mesh.rotation.z = calm ? 0 : 0.02 * Math.sin(now * 1.1 + f.seed * 2);
        }
        if (colony.ball) colony.ball.rotation.z = calm ? 0 : 0.06 * Math.sin(now * 0.8);

        // The pool's rings: where penguins went in or came out.
        const rings = poolMat.uniforms.uRings.value as Vector3[];
        for (let i = 0; i < rings.length; i++) {
          const sp = clock.splashes[clock.splashes.length - 1 - i];
          if (sp) rings[i].set(sp.x, sp.z, now - sp.at);
          else rings[i].set(0, 0, -1);
        }

        // The fish: jumps every so often by itself, when the hole is clicked, or when a penguin fishes.
        if (clock.fishAt > ev.fishSeen) {
          ev.fish = clock.fishAt;
          ev.fishSeen = clock.fishAt;
        }
        if (!calm && now > nextFish.current) {
          ev.fish = wall;
          nextFish.current = now + 8 + hash(now, 1) * 6;
        }
        const ft = wall - ev.fish;
        const fish = props.fish;
        if (ft >= 0 && ft < 1.1) {
          const u = ft / 1.1;
          fish.visible = true;
          fish.position.set(props.hx - 0.5 + u * 1.0, floorY + Math.sin(Math.PI * u) * 1.3 - 0.1, props.hz);
          fish.rotation.set(0, Math.PI / 2, 0);
          fish.rotateX(-Math.cos(Math.PI * u) * 1.1);
          props.holeMat.uniforms.uSplash.value = ft;
        } else {
          fish.visible = false;
          props.holeMat.uniforms.uSplash.value = ft < 3 ? ft : -1;
        }

        // The crew's igloo door brightens when clicked, and glows at night.
        const it = wall - ev.igloo;
        props.doorMat.emissiveIntensity = 0.6 + 1.2 * lit + (it < 3.2 ? 1.2 * Math.sin(Math.min(1, it / 3.2) * Math.PI) : 0) + 0.15 * Math.sin(now * 3.1) * (calm ? 0 : 1);

        pool.begin();
        // Splash droplets at the fishing hole.
        for (const st of [0, 1.0]) {
          const tt = ft - st;
          if (tt < 0 || tt > 0.7) continue;
          for (let p = 0; p < 18; p++) {
            const a = hash(p, 2) * Math.PI * 2;
            const v = 0.6 + hash(p, 3) * 0.8;
            const y = floorY + 0.05 + (1.6 + hash(p, 4)) * tt - 4.5 * tt * tt;
            if (y < floorY) continue;
            pool.add(props.hx - 0.5 + st + Math.cos(a) * v * tt, y, props.hz + Math.sin(a) * v * tt, 0.6, 0.85, 1, (1 - tt / 0.7) * 0.9, 0.06);
          }
        }
        // Splashes in the pool, where a penguin went through the surface.
        for (const sp of clock.splashes) {
          const tt = now - sp.at;
          if (tt < 0 || tt > 0.8) continue;
          for (let p = 0; p < 16; p++) {
            const a = hash(p, 21) * Math.PI * 2;
            const v = 0.5 + hash(p, 22) * 0.9;
            const y = floorY + 0.05 + (1.8 + hash(p, 23)) * tt - 5 * tt * tt;
            if (y < floorY) continue;
            pool.add(sp.x + Math.cos(a) * v * tt, y, sp.z + Math.sin(a) * v * tt, 0.7, 0.9, 1, (1 - tt / 0.8) * 0.9, 0.06);
          }
        }
        // Sparks rise from the fire and go out.
        if (!calm) {
          for (let sp = 0; sp < 8; sp++) {
            const f = (now * (0.35 + hash(sp, 91) * 0.25) + hash(sp, 92)) % 1;
            const a = hash(sp, 93) * Math.PI * 2 + now * 0.4;
            const rr = (0.1 + 0.3 * f) * (0.5 + hash(sp, 94));
            pool.add(colony.fire.x + Math.cos(a) * rr, floorY + 0.5 + f * 2.2, colony.fire.z + Math.sin(a) * rr, 1, 0.55 + 0.3 * (1 - f), 0.18, (1 - f) * 0.9, 0.035);
          }
          // At night, diamond dust: a few ice crystals glinting in the air in the lantern light near the places.
          if (lit > 0.05) {
            for (let k = 0; k < 24; k++) {
              const lamp = colony.lamps[k % Math.max(1, colony.lamps.length)];
              if (!lamp) break;
              const f = (now * (0.05 + hash(k, 71) * 0.05) + hash(k, 72)) % 1;
              const a = hash(k, 73) * Math.PI * 2 + now * 0.07;
              const rr = 0.4 + hash(k, 74) * 1.6;
              const tw = 0.5 + 0.5 * Math.sin(now * (2 + hash(k, 75) * 3) + k);
              pool.add(lamp.x + Math.cos(a) * rr, floorY + 0.4 + f * 2.4, lamp.z + Math.sin(a) * rr, 1, 0.9, 0.75, Math.sin(f * Math.PI) * tw * 0.6 * lit, 0.03);
            }
          }
        }
        // Crystal chimes: sparkles spiralling up the shards.
        ev.crystals.forEach((t0, c) => {
          const tt = wall - t0;
          if (tt < 0 || tt > 1.8) return;
          const [x, z] = props.clusterAt[c];
          for (let p = 0; p < 30; p++) {
            const a = hash(p, 5 + c) * Math.PI * 2 + tt * 3;
            const rr = 0.3 + hash(p, 6) * 0.8 + tt * 0.4;
            const y = floorY + 0.2 + hash(p, 7) * 2 + tt * 0.9;
            pool.add(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, 0.6, 0.9, 1, (1 - tt / 1.8) * 0.95, 0.08);
          }
        });
        props.shardMat.emissiveIntensity = 0.55 + 0.4 * nightW + ev.crystals.reduce((acc, t0) => acc + Math.max(0, 1 - (wall - t0) / 1.2) * 1.1, 0);
        // Snow puffs where the viewer clicked the ground.
        ev.puffs = ev.puffs.filter((pf) => wall - pf.t < 1.2);
        for (const pf of ev.puffs) {
          const tt = wall - pf.t;
          for (let p = 0; p < 34; p++) {
            const a = hash(p, 8) * Math.PI * 2;
            const v = 0.5 + hash(p, 9) * 1.4;
            const y = floorY + (1.4 + hash(p, 10) * 1.5) * tt - 3.2 * tt * tt;
            if (y < floorY) continue;
            pool.add(pf.x + Math.cos(a) * v * tt, y + 0.03, pf.z + Math.sin(a) * v * tt, 0.9, 0.96, 1, (1 - tt / 1.2) * 0.9, 0.1 + hash(p, 11) * 0.07);
          }
        }
        pool.end();
        const busy = wall - ev.igloo < 3.3 || ft < 3 || ev.puffs.length > 0 || ev.crystals.some((t0) => wall - t0 < 1.9) || ev.lanternAt.some((t0) => wall - t0 < 0.7);
        if (busy) invalidate();
      }),
    [driver, model, sky$, ground, poolMat, props, pool, clock, calm, cx, cz, floorY, invalidate, three, palette, halos, LAMPS, R],
  );

  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(() => () => ground.dispose(), [ground]);
  useEffect(() => () => poolMat.dispose(), [poolMat]);
  useEffect(() => () => snow.material.dispose(), [snow]);

  const floorSize = Math.max(300, R * 40, Math.max(clearX, clearZ) * 8);
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
      <color attach="background" args={[horizon]} />
      <fog attach="fog" args={[horizon, fogNear, fogFar]} />
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
          // A puff of snow where the ground was clicked.
          events.current.puffs.push({ x: e.point.x, z: e.point.z, t: performance.now() / 1000 });
          if (events.current.puffs.length > 5) events.current.puffs.shift();
          invalidate();
        }}
      >
        <planeGeometry args={[floorSize, floorSize]} />
      </mesh>

      <hemisphereLight ref={hemi} args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight ref={keyLight} color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[cx - R * 0.6 - 4, floorY + R * 1.4 + 8, cz + R + 8]} />
      <directionalLight ref={fillLight} color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[cx + R * 0.5, floorY + 5, cz - R - 10]} />
      <pointLight color="#ffb35c" intensity={6} distance={9} decay={1.6} position={[props.ix + 0.6, floorY + 0.8, props.iz + 2.2]} />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color="#dbe9ff" intensity={2} position={[-3, 7, 8]} scale={[14, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#b7c9e6" intensity={0.5} position={[2, 2.5, -10]} scale={[16, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#c9dcff" intensity={0.9} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
        <Lightformer form="rect" color="#9d86ff" intensity={0.8} position={[-9, 5, -4]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#16324f" intensity={0.6} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      <primitive object={props.group} />
      {/* Click targets for the props (simple invisible volumes over them). */}
      <mesh position={[props.ix, floorY + 0.8, props.iz]} onClick={click((w) => (events.current.igloo = w))} {...pointer} visible={false}>
        <sphereGeometry args={[1.9, 12, 8]} />
      </mesh>
      <mesh position={[props.hx, floorY + 0.2, props.hz]} onClick={click((w) => (events.current.fish = w))} {...pointer} visible={false}>
        <cylinderGeometry args={[1.15, 1.15, 0.4, 16]} />
      </mesh>
      {props.clusterAt.map(([x, z], c) => (
        <mesh key={c} position={[x, floorY + 0.9, z]} onClick={click((w) => (events.current.crystals[c] = w))} {...pointer} visible={false}>
          <cylinderGeometry args={[0.9, 0.9, 1.8, 12]} />
        </mesh>
      ))}
      {ice.lanterns.map(([x, z], i) => (
        <mesh
          key={`l${i}`}
          position={[x, floorY + 0.9, z]}
          visible={false}
          onClick={click((w) => {
            events.current.lantern[i] = events.current.lantern[i] ? 0 : 1;
            events.current.lanternAt[i] = w;
          })}
          {...pointer}
        >
          <cylinderGeometry args={[0.4, 0.4, 1.8, 10]} />
        </mesh>
      ))}
      <points frustumCulled={false} material={snow.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[snow.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[snow.seed, 4]} />
        </bufferGeometry>
      </points>
      <primitive object={pool.points} />
      {halos.list.map((h, i) => (
        <primitive key={`h${i}`} object={h} />
      ))}
    </>
  );
}

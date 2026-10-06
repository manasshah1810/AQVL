import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  BackSide,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
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
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  Euler,
} from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import type { SceneBounds } from '../../three/StageEnvironment';
import { NO_SHADOW_LAYER } from '../../three/StageEnvironment';
import { FOG, NOISE, fogUniforms, rng } from './glsl';
import { worldLayout } from './layout';
import { buildPenguin, createBlobShadow, type Rig } from './rigs';
import { ParticlePool, hash } from './particles';

/** The night sky: a deep gradient, stars, a moon, and aurora curtains. Also what the ice reflects. */
const SKY = /* glsl */ `
uniform float uTime;
vec3 polarSky(vec3 d, int layers) {
  float h = d.y;
  // Linear values: the horizon is exactly the fog colour (#13283f), the zenith a deep #060b1a.
  vec3 zenith = vec3(0.0018, 0.0034, 0.0103);
  vec3 horizon = vec3(0.0065, 0.0212, 0.0497);
  vec3 col = mix(horizon, zenith, smoothstep(-0.05, 0.6, h));
  float az = atan(d.z, d.x);
  // Aurora: curtains with a crisp lower hem that fade upwards, shimmering rays, drifting slowly.
  for (int i = 0; i < 2; i++) {
    if (i >= layers) break;
    float fi = float(i);
    float base = 0.13 + fi * 0.09 + 0.06 * sin(az * (2.0 + fi) + uTime * 0.04 + fi * 2.0) + 0.05 * fbm(vec2(az * 2.5 + fi * 7.0, uTime * 0.025));
    float above = h - base;
    float curtain = smoothstep(-0.012, 0.018, above) * exp(-max(above, 0.0) * (5.0 + fi * 3.0));
    float rays = 0.45 + 0.55 * fbm(vec2(az * 34.0 + uTime * 0.15 + fi * 13.0, uTime * 0.06));
    float pmask = smoothstep(0.24, 0.6, fbm(vec2(az * 1.4 - uTime * 0.018 + fi * 4.0, 2.3 + fi)));
    vec3 c = mix(vec3(0.2, 1.0, 0.62), vec3(0.58, 0.38, 1.0), smoothstep(0.02, 0.22, above) * (0.6 + 0.4 * fi));
    col += c * curtain * rays * pmask * (0.62 - fi * 0.2);
  }
  // Stars (above the aurora's hem, twinkling).
  vec2 sp = vec2(az * 140.0, h * 260.0);
  float st = hash12(floor(sp));
  float star = step(0.9965, st) * smoothstep(0.04, 0.25, h) * (0.55 + 0.45 * sin(uTime * 1.7 + st * 90.0));
  col += vec3(0.85, 0.92, 1.0) * star;
  // Moon.
  vec3 md = normalize(vec3(-0.5, 0.36, -0.79));
  float m = dot(d, md);
  col += vec3(0.95, 0.97, 1.0) * smoothstep(0.99935, 0.99955, m);
  col += vec3(0.12, 0.18, 0.32) * pow(max(m, 0.0), 260.0);
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
uniform vec3 uSnowColor;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec2 q = (p - uCenter) / vec2(uIce.x, p.y > uCenter.y ? uIce.y * 1.45 : uIce.y);
  float r = length(q);
  float wobble = (fbm(p * 0.22) - 0.5) * 0.35;
  float ice = 1.0 - smoothstep(0.92, 1.08, r + wobble);

  // The ice: deep and uneven, with cracks of two sizes, mirroring the sky (the aurora shows in it).
  vec2 v = voronoi(p * 0.3 + vec2(vnoise(p * 0.4), vnoise(p * 0.4 + 9.0)) * 0.8);
  float crack = (1.0 - smoothstep(0.0, 0.025, v.y)) * smoothstep(0.38, 0.7, fbm(p * 0.35 + 2.0)) * (0.5 + 0.5 * vnoise(p * 3.0));
  vec2 v2 = voronoi(p * 1.3 + 3.1);
  float crack2 = (1.0 - smoothstep(0.0, 0.018, v2.y)) * smoothstep(0.5, 0.8, vnoise(p * 0.6 + 5.0));
  float depth = fbm(p * 0.16 + 3.0);
  vec3 iceCol = mix(uIceColor * 0.78, uIceColor * 1.22, depth);
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
  R.xz += (vec2(vnoise(p * 0.5), vnoise(p * 0.5 + 5.0)) - 0.5) * 0.12;
  vec3 refl = polarSky(normalize(vec3(R.x, R.y * 0.42, R.z)), 1);
  float fres = 0.18 + 0.82 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 3.0);
  vec3 sky0 = vec3(0.0065, 0.0212, 0.0497);
  vec3 aur = max(refl - sky0, 0.0);
  // Streaks of aurora light lying on the ice, stretched towards the viewer like real reflections.
  float streak = smoothstep(0.45, 0.85, fbm(vec2(p.x * 0.9, p.y * 0.12) + uTime * 0.01));
  iceCol = mix(iceCol, iceCol * 0.8 + sky0 * 0.4, 0.4 * fres) + aur * (0.12 + 0.4 * streak) * fres;
  // The moon's glint.
  vec3 md = normalize(vec3(-0.5, 0.36, -0.79));
  float glint = pow(max(dot(normalize(R), md), 0.0), 60.0);
  iceCol += vec3(0.55, 0.68, 0.85) * glint * (0.5 + 0.5 * vnoise(p * 4.0));
  iceCol += vec3(0.5, 0.72, 0.95) * (crack * 0.16 + crack2 * 0.05);
  // Polished centre: a soft sheen where the structures stand.
  iceCol += vec3(0.08, 0.14, 0.22) * (1.0 - smoothstep(0.0, 0.75, r));

  // Snow beyond the ice, in drifts; the edge is a soft rim of packed snow.
  float drift = fbm(p * 0.3 + 7.0);
  vec3 snowCol = uSnowColor * (0.78 + 0.32 * drift);
  float rim = smoothstep(0.9, 1.02, r + wobble) * (1.0 - smoothstep(1.02, 1.2, r + wobble));
  snowCol = mix(snowCol, uSnowColor * 1.12, rim * 0.6);
  float g = hash12(floor(p * 26.0));
  float sparkle = step(0.9955, g) * (0.5 + 0.5 * sin(uTime * 2.6 + g * 120.0));
  snowCol += vec3(0.7, 0.85, 1.0) * sparkle * 0.7;

  vec3 col = mix(snowCol, iceCol, ice);
  col += vec3(0.6, 0.85, 1.0) * sparkle * 0.25 * ice;
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
  p.x += sin(uTime * (0.4 + aSeed.y) + aSeed.z * 6.28) * 0.35;
  p.z += cos(uTime * (0.3 + aSeed.z * 0.5) + aSeed.y * 6.28) * 0.25;
  vec4 mv = modelViewMatrix * vec4(uOrigin + p, 1.0);
  gl_PointSize = (1.6 + aSeed.w * 2.6) * (55.0 / -mv.z);
  vAlpha = smoothstep(0.0, 1.2, p.y) * smoothstep(uBox.y, uBox.y - 2.0, p.y) * (0.45 + 0.4 * aSeed.w);
  gl_Position = projectionMatrix * mv;
}
`;

const SNOW_FRAGMENT = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.92, 0.96, 1.0, a);
}
`;

const HOLE_FRAGMENT = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uSplash;
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
  float a = 1.0 - smoothstep(0.92, 1.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

/** Bricks for the igloo, drawn once on a canvas. */
function iglooTexture(): CanvasTexture {
  const w = 512, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
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

export interface WorldProps {
  model: StageModel;
  bounds: SceneBounds;
  driver: StageDriver;
  calm: boolean;
  clock: { now: number };
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();

/**
 * The penguins' world: an ice shelf at night under the aurora. The ice
 * mirrors the sky, cracks catch the light, snow drifts ring it, ice cliffs
 * stand behind, and snow falls. An igloo (click it), a fishing hole (click
 * it), a cluster of crystals (click them) and two onlookers who cheer when
 * the run finishes. Clicking the snow throws up a puff.
 */
export function PolarWorld({ model, bounds, driver, calm, clock }: WorldProps) {
  const invalidate = useThree((s) => s.invalidate);
  const palette = model.palette;
  const floorY = model.floorY;
  const { radius: R } = bounds;
  const { cx, cz, halfX, halfZ, lift } = useMemo(() => worldLayout(model), [model]);
  const iceRx = halfX + 5.5;
  const iceRz = Math.max(halfZ + 5.5, halfX * 0.6 + 4.6) + lift * 0.5;
  const fogNear = R * 3 + 12;
  const fogFar = R * 9 + 60;
  const horizon = '#13283f';

  const sky = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  const ground = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uCenter: { value: [cx, cz] },
          uIce: { value: [iceRx, iceRz] },
          uIceColor: { value: new Color(palette.floor) },
          uSnowColor: { value: new Color('#97adc9') },
          ...fogUniforms(horizon, fogNear, fogFar),
        },
        vertexShader: WORLD_VERTEX,
        fragmentShader: GROUND_FRAGMENT,
        toneMapped: false,
      }),
    [cx, cz, iceRx, iceRz, palette.floor, fogNear, fogFar],
  );
  const snow = useMemo(() => {
    const count = 1100;
    const box = new Vector3(R * 5 + 34, 13, R * 3.5 + 26);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const r = rng(41);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * box.x;
      pos[i * 3 + 1] = r() * box.y;
      pos[i * 3 + 2] = (r() - 0.7) * box.z;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = r();
    }
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBox: { value: box }, uOrigin: { value: new Vector3(cx, floorY, cz) } },
      vertexShader: SNOW_VERTEX,
      fragmentShader: SNOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { pos, seed, material };
  }, [R, cx, cz, floorY]);

  // ── Props ──────────────────────────────────────────────────────────────
  const props = useMemo(() => {
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T): T => {
      disposables.push(x);
      return x;
    };
    const r = rng(7);
    const group = new Group();

    // Ice cliffs: a broken wall of pale ice behind the shelf.
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
    const span = iceRx * 3 + 24;
    for (let i = 0; i < 26; i++) {
      const f = i / 25;
      const x = cx - span / 2 + f * span + (r() - 0.5) * 2;
      const back = halfZ + lift + 22 + r() * 8 - Math.abs(f - 0.5) * 6;
      const h = 1.4 + r() * 2.6 + (1 - Math.abs(f - 0.5) * 2) * 1.8;
      cliffs.push([x, back, 1.4 + r() * 2.2, h, 1.6 + r() * 1.8, r() * Math.PI]);
    }
    const cliffMesh = new InstancedMesh(cliffGeo, cliffMat, cliffs.length);
    cliffs.forEach(([x, back, w, h, d, rot], i) => {
      _p.set(x, floorY + h * 0.35, cz - back);
      _q.setFromEuler(_e.set(0, rot, (r() - 0.5) * 0.2));
      _s.set(w, h, d);
      cliffMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(cliffMesh);

    // Snow drifts round the rim of the ice.
    const driftGeo = keep(new SphereGeometry(1, 20, 12));
    const driftMat = keep(new MeshStandardMaterial({ color: '#c6d6e9', roughness: 0.95, metalness: 0, emissive: new Color('#122640'), emissiveIntensity: 0.3 }));
    const drifts: number[][] = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + r() * 0.12;
      // Keep the front (towards the camera) clear: drifts only behind and at the sides.
      if (Math.sin(a) > 0.55) continue;
      const rr = 1.08 + r() * 0.16;
      drifts.push([cx + Math.cos(a) * iceRx * rr, cz + Math.sin(a) * iceRz * rr, 0.7 + r() * 1.2, 0.18 + r() * 0.3, 0.5 + r() * 0.8, a]);
    }
    const driftMesh = new InstancedMesh(driftGeo, driftMat, drifts.length);
    drifts.forEach(([x, z, w, h, d, a], i) => {
      _p.set(x, floorY - h * 0.15, z);
      _q.setFromEuler(_e.set(0, -a, 0));
      _s.set(w, h, d);
      driftMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    group.add(driftMesh);

    // Crystals: three clusters of glassy blue shards that chime (sparkle) when clicked.
    const shardGeo = keep(new OctahedronGeometry(0.5, 0));
    const shardMat = keep(
      new MeshStandardMaterial({ color: '#8fd3ff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, emissive: new Color('#2f7fc0'), emissiveIntensity: 0.55 }),
    );
    const clusterAt: [number, number][] = [
      [cx + halfX + 4.6, cz - halfZ - 3.6 - lift],
      [cx - halfX - 4.4, cz + halfZ * 0.1],
      [cx + halfX * 0.25, cz - halfZ - 8 - lift],
    ];
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

    // The igloo, behind on the left, its door glowing.
    const igloo = new Group();
    const ix = cx - halfX * 0.55 - 2.6, iz = cz - Math.max(iceRz * 0.86, halfZ + 6.2 + lift);
    igloo.position.set(ix, floorY, iz);
    igloo.rotation.y = 0.5;
    const brick = keep(iglooTexture());
    const domeMat = keep(new MeshStandardMaterial({ map: brick, roughness: 0.75, metalness: 0, emissive: new Color('#203a58'), emissiveIntensity: 0.35 }));
    const dome = new Mesh(keep(new SphereGeometry(1.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat);
    igloo.add(dome);
    const tunnel = new Mesh(keep(new CylinderGeometry(0.62, 0.62, 1.1, 24, 1, true, -Math.PI / 2, Math.PI)), domeMat);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.set(0, 0, 1.55);
    igloo.add(tunnel);
    const doorMat = keep(new MeshStandardMaterial({ color: '#2a1606', emissive: new Color('#ffa64d'), emissiveIntensity: 1.6, roughness: 1 }));
    const door = new Mesh(keep(new CircleGeometry(0.56, 24, 0, Math.PI)), doorMat);
    door.position.set(0, 0.0, 1.62);
    igloo.add(door);
    group.add(igloo);

    // The fishing hole, behind on the right.
    const hx = cx + halfX + 2.7, hz = cz + halfZ * 0.15 - 0.6;
    const holeMat = keep(
      new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSplash: { value: -1 } }, vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: HOLE_FRAGMENT, transparent: true, depthWrite: false, toneMapped: false }),
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

    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, cliffMesh, driftMesh, shardMesh, shardMat, clusterAt, igloo, ix, iz, door, doorMat, hole, holeMat, hx, hz, fish, disposables };
  }, [cx, cz, halfX, halfZ, lift, iceRx, iceRz, floorY]);

  useEffect(
    () => () => {
      props.disposables.forEach((d) => d.dispose());
      props.cliffMesh.dispose();
      props.driftMesh.dispose();
      props.shardMesh.dispose();
    },
    [props],
  );

  // Onlookers: two penguins by the igloo, and a chick who peeks out when the igloo is clicked.
  const onlookers = useMemo(() => {
    const rigs: Rig[] = [buildPenguin({ scarf: null, scale: 1.3 }), buildPenguin({ scarf: ['#e4b33b', '#f6e7d2'], scale: 1.2 }), buildPenguin({ scarf: null, chick: true, scale: 0.85 })];
    const holders = rigs.map(() => new Group());
    holders.forEach((h, i) => h.add(rigs[i].root));
    const shadows = rigs.map(() => createBlobShadow(palette.shadow, palette.shadowOpacity * 0.7));
    return { rigs, holders, shadows };
  }, [palette]);
  useEffect(
    () => () => {
      onlookers.rigs.forEach((r) => r.dispose());
      onlookers.shadows.forEach((s) => s.dispose());
    },
    [onlookers],
  );

  const pool = useMemo(() => new ParticlePool(260, true), []);
  useEffect(() => () => pool.dispose(), [pool]);
  // Viewer interactions (wall-clock seconds when they happened).
  const events = useRef({ igloo: -100, fish: -100, crystals: [-100, -100, -100], onlooker: [-100, -100, -100], puffs: [] as { x: number; z: number; t: number }[], endAt: -1, lastK: -1 });
  const nextFish = useRef(6);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const now = clock.now;
        const wall = performance.now() / 1000;
        const ev = events.current;
        sky.uniforms.uTime.value = now;
        ground.uniforms.uTime.value = now;
        snow.material.uniforms.uTime.value = now;
        props.holeMat.uniforms.uTime.value = now;

        // The finale: onlookers cheer once the last step is reached.
        const last = sample.k === model.frameCount - 1 && sample.k > 0;
        if (last && ev.lastK !== sample.k) ev.endAt = wall;
        if (!last) ev.endAt = -1;
        ev.lastK = sample.k;

        // Onlookers stand by the igloo, watching the structures.
        // Beside the igloo, on the side away from the structures, so labels above the cells never land on them.
        const spots: [number, number][] = [
          [props.ix - 1.55, props.iz + 1.75],
          [props.ix - 0.55, props.iz + 2.55],
        ];
        for (let i = 0; i < 3; i++) {
          const h = onlookers.holders[i];
          const rig = onlookers.rigs[i];
          let x: number, z: number, yaw: number;
          let pose: 'idle' | 'cheer' | 'present' = 'idle';
          let poseTime = now + i * 3;
          if (i < 2) {
            [x, z] = spots[i];
            yaw = Math.atan2(cx - x, cz + 1 - z) * 0.7 - 0.2;
            if (ev.endAt > 0 && !calm) {
              pose = 'cheer';
              poseTime = wall - ev.endAt + i * 0.2;
            }
          } else {
            // The chick: inside the door, unless the igloo was just clicked.
            const t = wall - ev.igloo;
            const out = t < 3.2 ? Math.min(1, t / 0.5) * (1 - Math.max(0, (t - 2.6) / 0.6)) : 0;
            const door = new Vector3(0, 0, 1.25 + out * 1.1).applyEuler(props.igloo.rotation);
            x = props.ix + door.x;
            z = props.iz + door.z;
            yaw = props.igloo.rotation.y;
            h.visible = out > 0.02;
            if (out > 0.5) {
              pose = 'present';
              poseTime = t - 0.5;
            }
          }
          h.position.set(x, floorY, z);
          h.rotation.y = yaw;
          rig.update({
            gait: 'stand', gaitPhase: 0, gaitWeight: 0,
            pose, poseWeight: pose === 'idle' ? 0 : 1, poseTime,
            prevPose: 'idle', prevWeight: 0,
            lookLocal: [0, 0.6, 3],
            react: wall - ev.onlooker[i] < 1.2 ? wall - ev.onlooker[i] : -1,
            time: now + i * 4.1,
            seed: 5 + i * 2.3,
          });
          const sh = onlookers.shadows[i].mesh;
          sh.position.set(x, floorY + 0.004, z);
          sh.scale.setScalar(i === 2 ? 0.55 : 0.85);
          sh.visible = h.visible;
        }

        // The fish: jumps every so often by itself, or when the hole is clicked.
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

        // The igloo door brightens when the chick comes out.
        const it = wall - ev.igloo;
        props.doorMat.emissiveIntensity = 1.6 + (it < 3.2 ? 1.2 * Math.sin(Math.min(1, it / 3.2) * Math.PI) : 0) + 0.15 * Math.sin(now * 3.1) * (calm ? 0 : 1);

        pool.begin();
        // Splash droplets.
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
        props.shardMat.emissiveIntensity = 0.55 + ev.crystals.reduce((acc, t0) => acc + Math.max(0, 1 - (wall - t0) / 1.2) * 1.1, 0);
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
        const busy = wall - ev.igloo < 3.3 || ft < 3 || ev.puffs.length > 0 || ev.crystals.some((t0) => wall - t0 < 1.9) || ev.onlooker.some((t0) => wall - t0 < 1.3);
        if (busy) invalidate();
      }),
    [driver, model, sky, ground, snow, props, onlookers, pool, clock, calm, cx, cz, floorY, invalidate],
  );

  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(() => () => ground.dispose(), [ground]);
  useEffect(() => () => snow.material.dispose(), [snow]);

  const floorSize = Math.max(240, R * 40);
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

      <hemisphereLight args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[cx - R * 0.6 - 4, floorY + R * 1.4 + 8, cz + R + 8]} />
      <directionalLight color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[cx + R * 0.5, floorY + 5, cz - R - 10]} />
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
      {onlookers.holders.map((h, i) => (
        <primitive
          key={i}
          object={h}
          onClick={click((w) => (events.current.onlooker[i] = w))}
          onPointerOver={pointer.onPointerOver}
          onPointerOut={pointer.onPointerOut}
        />
      ))}
      {onlookers.shadows.map((s, i) => (
        <primitive key={`os${i}`} object={s.mesh} />
      ))}
      <points frustumCulled={false} material={snow.material} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[snow.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[snow.seed, 4]} />
        </bufferGeometry>
      </points>
      <primitive object={pool.points} />
    </>
  );
}

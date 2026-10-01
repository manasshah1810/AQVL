// The ONE shared AQVL-world rig: environment, light language, glass material, edges, floor, reflections, camera.
import React, {createContext, useContext, useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {V3} from './motion';

export const COL = {
  fog: '#0b121c',
  ice: '#8cc4ff',
  iceDeep: '#2f5f9e',
  amber: '#ffb02e', // = executing / active, everywhere
  mint: '#5cf2c8', // = resolved / final, everywhere
  coolRim: '#7fd0ff',
};
const C = (h: string) => new THREE.Color(h);
const ICE = C(COL.ice), AMBER = C(COL.amber), MINT = C(COL.mint);

export const FOG = {near: 20, far: 85};

const Reflect = createContext(false);

const glassVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const glassFrag = /* glsl */ `
uniform vec3 uColor; uniform vec3 uAccent; uniform vec3 uFogColor;
uniform float uActive; uniform float uAlpha; uniform float uReflect; uniform float uFogNear; uniform float uFogFar;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 2.4);
  vec3 Lk = normalize(vec3(0.35, 0.9, 0.45));    // soft key
  vec3 Lr = normalize(vec3(-0.7, 0.35, -0.8));   // cool rim
  vec3 Lw = normalize(vec3(0.85, 0.05, 0.45));   // warm accent
  float key = max(dot(N, Lk), 0.0);
  float rimL = 0.45 + 0.55 * max(dot(N, Lr) * 0.5 + 0.5, 0.0);
  float warmL = max(dot(N, Lw), 0.0);
  vec3 body = uColor * (0.10 + 0.30 * key) * (0.6 + 0.4 * ndv);
  vec3 rim = vec3(0.50, 0.82, 1.0) * fres * rimL * 1.15 + vec3(1.0, 0.62, 0.28) * fres * warmL * 0.55;
  float spec = pow(max(dot(reflect(-Lk, N), V), 0.0), 70.0) * 0.9;
  float inner = uActive * (0.30 + 0.70 * ndv);
  vec3 col = body + rim * mix(vec3(1.0), uAccent * 1.3 + 0.2, uActive * 0.7) + uAccent * inner * 0.85 + vec3(spec);
  col += uColor * fres * 0.35;
  float a = clamp(0.20 + fres * 0.85 + uActive * 0.35 + spec, 0.0, 1.0) * uAlpha;
  float d = length(cameraPosition - vW);
  float f = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uFogColor, f);
  a *= (1.0 - f * 0.9);
  float refl = exp(-abs(vW.y) * 0.55);
  a *= mix(1.0, 0.55 * refl, uReflect);
  gl_FragColor = vec4(col, a);
}`;

const sphereGeo = new THREE.IcosahedronGeometry(1, 4);
const boxGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.14);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);

const mkGlass = (reflect: boolean) =>
  new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: {value: new THREE.Color()}, uAccent: {value: new THREE.Color()}, uFogColor: {value: C(COL.fog)},
      uActive: {value: 0}, uAlpha: {value: 1}, uReflect: {value: reflect ? 1 : 0}, uFogNear: {value: FOG.near}, uFogFar: {value: FOG.far},
    },
  });

export type NodeP = {
  p: V3;
  size?: V3 | number;
  shape?: 'sphere' | 'box';
  active?: number; // 0..1 executing (amber)
  done?: number; // 0..1 resolved (mint)
  appear?: number; // spring-driven scale 0..~1.1
  alpha?: number;
  rot?: V3;
};

export const Glass: React.FC<NodeP> = ({p, size = 1, shape = 'sphere', active = 0, done = 0, appear = 1, alpha = 1, rot}) => {
  const reflect = useContext(Reflect);
  const mat = useMemo(() => mkGlass(reflect), [reflect]);
  const col = ICE.clone().lerp(MINT, done).lerp(AMBER, active);
  (mat.uniforms.uColor.value as THREE.Color).copy(col);
  (mat.uniforms.uAccent.value as THREE.Color).copy(active > done ? AMBER : MINT);
  mat.uniforms.uActive.value = Math.max(active, done * 0.55);
  mat.uniforms.uAlpha.value = alpha;
  const s: V3 = typeof size === 'number' ? [size, size, size] : size;
  if (appear <= 0.001) return null;
  return (
    <mesh position={p} scale={[s[0] * appear, s[1] * appear, s[2] * appear]} rotation={rot ?? [0, 0, 0]} geometry={shape === 'sphere' ? sphereGeo : boxGeo} material={mat} renderOrder={reflect ? 1 : 4} />
  );
};

const tubeVert = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const tubeFrag = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uReflect; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
varying vec3 vW;
void main(){
  float d = length(cameraPosition - vW);
  float f = smoothstep(uFogNear, uFogFar, d);
  vec3 col = mix(uColor, uFogColor, f);
  float a = uAlpha * (1.0 - f * 0.9);
  a *= mix(1.0, 0.5 * exp(-abs(vW.y) * 0.55), uReflect);
  gl_FragColor = vec4(col, a);
}`;
const mkTube = (reflect: boolean, additive: boolean) =>
  new THREE.ShaderMaterial({
    vertexShader: tubeVert, fragmentShader: tubeFrag, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {uColor: {value: new THREE.Color()}, uAlpha: {value: 1}, uReflect: {value: reflect ? 1 : 0}, uFogColor: {value: C(COL.fog)}, uFogNear: {value: FOG.near}, uFogFar: {value: FOG.far}},
  });

export type EdgeP = {a: V3; b: V3; grow?: number; active?: number; done?: number; r?: number; alpha?: number};
const _up = new THREE.Vector3(0, 1, 0);
export const Edge: React.FC<EdgeP> = ({a, b, grow = 1, active = 0, done = 0, r = 0.04, alpha = 1}) => {
  const reflect = useContext(Reflect);
  const core = useMemo(() => mkTube(reflect, false), [reflect]);
  const halo = useMemo(() => mkTube(reflect, true), [reflect]);
  const col = C('#6fa6dc').lerp(MINT, done).lerp(AMBER, active);
  (core.uniforms.uColor.value as THREE.Color).copy(col).lerp(C('#ffffff'), 0.25 + active * 0.3);
  core.uniforms.uAlpha.value = (0.75 + 0.25 * Math.max(active, done)) * alpha;
  (halo.uniforms.uColor.value as THREE.Color).copy(col);
  halo.uniforms.uAlpha.value = (0.10 + 0.22 * Math.max(active, done)) * alpha;
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length() * grow;
  if (len < 0.001) return null;
  const mid = A.clone().add(dir.clone().multiplyScalar(grow / 2));
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
  const rr = r * (1 + active * 0.8);
  return (
    <group position={mid} quaternion={q}>
      <mesh geometry={cylGeo} material={core} scale={[rr, len, rr]} renderOrder={reflect ? 1 : 3} />
      <mesh geometry={cylGeo} material={halo} scale={[rr * 4.5, len, rr * 4.5]} renderOrder={reflect ? 1 : 3} />
    </group>
  );
};

const floorFrag = /* glsl */ `
uniform vec3 uFogColor; uniform float uFade; uniform vec2 uPool; uniform float uFogNear; uniform float uFogFar;
varying vec3 vW;
void main(){
  float d = length(cameraPosition - vW);
  float f = smoothstep(uFogNear * 0.7, uFogFar * 0.85, d);
  vec3 base = vec3(0.035, 0.062, 0.10);
  float pool = exp(-dot(vW.xz - uPool, vW.xz - uPool) / 90.0);
  vec3 col = base + vec3(0.05, 0.10, 0.17) * pool;
  // faint metric grid: depth + parallax cue, not a wireframe
  vec2 gp = vW.xz / 2.0;
  vec2 g = abs(fract(gp - 0.5) - 0.5) / max(fwidth(gp), vec2(0.0001));
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  col += vec3(0.22, 0.38, 0.6) * line * 0.07 * (0.4 + pool);
  // grazing sheen from the cool rim
  vec3 V = normalize(cameraPosition - vW);
  float graze = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  col += vec3(0.20, 0.34, 0.52) * graze * 0.14;
  col = mix(col, uFogColor, f);
  gl_FragColor = vec4(col, 0.74 * uFade * (1.0 - f));
}`;
export const Floor: React.FC<{fade?: number; pool?: [number, number]}> = ({fade = 1, pool = [0, 0]}) => {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: tubeVert, fragmentShader: floorFrag, transparent: true, depthWrite: false,
      uniforms: {uFogColor: {value: C(COL.fog)}, uFade: {value: 1}, uPool: {value: new THREE.Vector2()}, uFogNear: {value: FOG.near}, uFogFar: {value: FOG.far}},
    }), []);
  mat.uniforms.uFade.value = fade;
  (mat.uniforms.uPool.value as THREE.Vector2).set(pool[0], pool[1]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={2}><planeGeometry args={[400, 400]} /></mesh>;
};

export type Cam = {pos: V3; look: V3; fov: number};
const Camera: React.FC<{cam: Cam}> = ({cam}) => {
  const {camera} = useThree();
  const c = camera as THREE.PerspectiveCamera;
  c.position.set(...cam.pos);
  c.fov = cam.fov;
  c.near = 0.1;
  c.far = 400;
  c.lookAt(...cam.look);
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return null;
};

/** One camera, one floor, a mirrored duplicate of the scene for reflections. */
export const World: React.FC<{cam: Cam; width: number; height: number; floorFade?: number; pool?: [number, number]; children: React.ReactNode}> = ({cam, width, height, floorFade = 1, pool, children}) => (
  <ThreeCanvas width={width} height={height} gl={{antialias: true, alpha: false}} camera={{fov: cam.fov, position: cam.pos}} style={{position: 'absolute', inset: 0}}>
    <color attach="background" args={[COL.fog]} />
    <Camera cam={cam} />
    <Reflect.Provider value={true}>
      <group scale={[1, -1, 1]}>{children}</group>
    </Reflect.Provider>
    <Floor fade={floorFade} pool={pool} />
    <Reflect.Provider value={false}>{children}</Reflect.Provider>
  </ThreeCanvas>
);

/** Same camera maths for HTML overlays (labels, bursts, focus pull). */
export const makeProjector = (cam: Cam, width: number, height: number) => {
  const c = new THREE.PerspectiveCamera(cam.fov, width / height, 0.1, 400);
  c.position.set(...cam.pos);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = new THREE.Vector3();
  return (p: V3) => {
    v.set(...p).project(c);
    const dist = Math.hypot(p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]);
    return {x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, depth: dist, visible: v.z < 1 && v.z > -1};
  };
};

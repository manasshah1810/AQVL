import * as THREE from 'three';
import {lin, NEON, PEACH, PURPLE, TWILIGHT} from '../lib/palette';

const v3 = (c: [number, number, number]) => new THREE.Vector3(...c);

// Uniforms shared by every material in the AQVL world: one fixed light rig,
// one fog, one set of burst lights. Same values in every scene.
export const shared = {
  uPeach: {value: v3(lin(PEACH))},
  uPurple: {value: v3(lin(PURPLE))},
  uNeon: {value: v3(lin(NEON))},
  uFogColor: {value: v3(lin(TWILIGHT))},
  uFogStart: {value: 14.0},
  uFogDensity: {value: 0.055},
  // key: soft cool-neutral from front-left-above; fill: low and wide;
  // rim: peach from behind.
  uKeyDir: {value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize()},
  uFillDir: {value: new THREE.Vector3(0.7, 0.25, 0.4).normalize()},
  uRimDir: {value: new THREE.Vector3(0.25, 0.45, -1).normalize()},
  uReflect: {value: 0},
  uBursts: {value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0))},
};

const common = /* glsl */ `
uniform vec3 uPeach; uniform vec3 uPurple; uniform vec3 uNeon;
uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogDensity;
uniform vec3 uKeyDir; uniform vec3 uFillDir; uniform vec3 uRimDir;
uniform float uReflect;
uniform vec4 uBursts[4];
float fogF(vec3 w){
  float d = length(w - cameraPosition);
  float f = max(d - uFogStart, 0.0) * uFogDensity;
  return 1.0 - exp(-f * f);
}
vec3 burstLight(vec3 w, vec3 n){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = uBursts[i].xyz - w;
    float l = length(d) + 1e-3;
    float wrap = max(dot(n, d / l) * 0.6 + 0.4, 0.0);
    acc += uNeon * uBursts[i].w * wrap / (1.0 + l * l * 1.2);
  }
  return acc;
}
float reflectFade(vec3 w){
  return uReflect > 0.5 ? exp(-max(-w.y, 0.0) * 0.55) : 1.0;
}
`;

const glassVert = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const glassFrag = /* glsl */ `
${common}
varying vec3 vN; varying vec3 vW; varying vec3 vL;
uniform vec3 uHalf; uniform float uActive; uniform float uOpacity; uniform float uHot;
uniform float uDone;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  float key = max(dot(N, uKeyDir), 0.0);
  float fill = dot(N, uFillDir) * 0.5 + 0.5;
  float rimL = max(dot(N, uRimDir), 0.0);
  float edge = 0.0;
  if (uHalf.x > 0.0) {
    vec3 q = abs(vL) / uHalf;
    float mx = max(q.x, max(q.y, q.z));
    float mn = min(q.x, min(q.y, q.z));
    float mid = q.x + q.y + q.z - mx - mn;
    edge = smoothstep(0.82, 0.97, mid);
  }
  vec3 body = uPurple * (0.09 + 0.32 * key + 0.12 * fill);
  // frosted scattering: a soft inner glow strongest face-on
  vec3 glow = uPurple * 0.36 * pow(ndv, 1.5) + uPeach * 0.035 * pow(ndv, 3.0);
  vec3 rim = uPeach * (fres * (0.45 + 1.7 * rimL) + edge * (0.22 + 0.9 * fres + 0.7 * rimL + 0.25 * key));
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) * 0.55;
  vec3 col = body + glow + rim + vec3(1.0, 0.96, 0.93) * spec;
  col += burstLight(vW, N);
  // settled / finished state: warmer peach body
  col = mix(col, col * 0.7 + uPeach * (0.12 + 0.5 * fres + 0.35 * edge), uDone);
  vec3 act = uNeon * (1.2 + 2.6 * fres + 1.6 * edge + uHot * 3.0) + vec3(1.0) * spec;
  col = mix(col, act, uActive);
  float alpha = clamp(0.36 + 0.55 * fres + edge * 0.55, 0.0, 1.0);
  alpha = mix(alpha, 0.94, uActive);
  float rf = reflectFade(vW);
  col *= uReflect > 0.5 ? 0.6 * rf : 1.0;
  col = mix(col, uReflect > 0.5 ? vec3(0.0) : uFogColor, fogF(vW));
  gl_FragColor = vec4(col, alpha * uOpacity * rf);
}`;

export type GlassUniforms = {
  uHalf: {value: THREE.Vector3};
  uActive: {value: number};
  uOpacity: {value: number};
  uHot: {value: number};
  uDone: {value: number};
};

export const makeGlass = (half: [number, number, number] | null) => {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uHalf: {value: new THREE.Vector3(...(half ?? [0, 0, 0]))},
      uActive: {value: 0},
      uOpacity: {value: 1},
      uHot: {value: 0},
      uDone: {value: 0},
    },
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    transparent: true,
    depthWrite: true,
  });
  return m;
};

// Luminous connection lines (thin tubes with a soft glow carried by bloom).
const lineFrag = /* glsl */ `
${common}
varying vec3 vN; varying vec3 vW; varying vec3 vL;
uniform float uActive; uniform float uOpacity; uniform float uDone;
void main(){
  vec3 c = mix(uPeach * 0.55, uPeach * 1.3, uDone);
  c = mix(c, uNeon * 3.2, uActive);
  float rf = reflectFade(vW);
  c *= uReflect > 0.5 ? 0.6 * rf : 1.0;
  c = mix(c, uReflect > 0.5 ? vec3(0.0) : uFogColor, fogF(vW));
  gl_FragColor = vec4(c, uOpacity * rf * mix(0.75, 1.0, uActive));
}`;

export const makeLine = () =>
  new THREE.ShaderMaterial({
    uniforms: {...shared, uActive: {value: 0}, uOpacity: {value: 1}, uDone: {value: 0}},
    vertexShader: glassVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
  });

// Glossy dark floor: blurred planar reflection, fresnel, a soft lift under
// the hero, a whisper of grid for scale and parallax.
const floorVert = /* glsl */ `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const floorFrag = /* glsl */ `
${common}
varying vec3 vW;
uniform sampler2D uRefl; uniform vec2 uRes;
uniform vec3 uPool; uniform vec3 uBase; uniform vec3 uLift; uniform float uGrid; uniform float uVis;
void main(){
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 refl = texture2D(uRefl, suv).rgb;
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.35 + 0.65 * pow(1.0 - max(V.y, 0.0), 3.0);
  float r = length(vW.xz - uPool.xy);
  vec3 base = uBase + uLift * exp(-r * r / uPool.z);
  vec2 gp = vW.xz / 1.6;
  vec2 g = abs(fract(gp - 0.5) - 0.5) / fwidth(gp);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float gfade = exp(-r * r / (uPool.z * 6.0));
  base += uPurple * line * uGrid * gfade;
  base += burstLight(vW, vec3(0.0, 1.0, 0.0)) * 0.5;
  vec3 col = base + refl * fres * 0.85;
  col = mix(col, uFogColor, fogF(vW));
  gl_FragColor = vec4(mix(uFogColor, col, uVis), 1.0);
}`;

export const makeFloor = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uRefl: {value: null},
      uRes: {value: new THREE.Vector2(1, 1)},
      uPool: {value: new THREE.Vector3(0, 0, 40)},
      uBase: {value: v3(lin('#0d0a14'))},
      uLift: {value: v3(lin('#21182e'))},
      uGrid: {value: 0.09},
      uVis: {value: 1},
    },
    vertexShader: floorVert,
    fragmentShader: floorFrag,
  });

// Localized light burst: additive camera-facing glow in the neon accent.
const burstFrag = /* glsl */ `
varying vec2 vUv;
uniform vec3 uNeon; uniform float uI; uniform float uR;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float core = exp(-d * d * 18.0);
  float halo = exp(-d * d * 5.0) * 0.35;
  float ring = exp(-pow((d - uR) * 9.0, 2.0)) * 0.5 * (1.0 - uR);
  float a = (core + halo + ring) * uI * smoothstep(1.0, 0.6, d);
  gl_FragColor = vec4(uNeon * a * 2.5, 1.0);
}`;
export const makeBurst = () =>
  new THREE.ShaderMaterial({
    uniforms: {uNeon: shared.uNeon, uI: {value: 0}, uR: {value: 0}},
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
      vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
      mv.xy += position.xy * s;
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: burstFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

// Faint floor shockwave ring under a burst.
export const makeRing = () =>
  new THREE.ShaderMaterial({
    uniforms: {uNeon: shared.uNeon, uI: {value: 0}, uR: {value: 0.5}},
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform vec3 uNeon; uniform float uI; uniform float uR;
      void main(){ float d = length(vUv*2.0-1.0); float a = exp(-pow((d-uR)*14.0,2.0))*uI*(1.0-uR);
      gl_FragColor = vec4(uNeon*a*1.6, 1.0);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

// Linear view depth for the depth-of-field pass.
export const depthMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: /* glsl */ `varying float vD; void main(){ gl_FragColor = vec4(vD,0.0,0.0,1.0); }`,
});

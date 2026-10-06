import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { CAUSTICS, OCEAN } from '../glsl';
import type { PodMood } from '../pod';

/**
 * A whale, built from scratch out of one swept body and a few attached
 * parts (no model files). The body is a single smooth surface along a spine
 * from the snout (s = 0) to the tail stock (s = 1); a vertex shader bends
 * that spine every frame (the vertical stroke of the flukes, the curve of a
 * turn, the arch of a dive), and the flukes, fins, eyes and smile are
 * placed with the same spine function so they ride the bend exactly.
 *
 * The skin is countershaded (slate above, cream below, with a wavy line
 * between), has throat pleats under the head, a few pale scars and freckles
 * on an adult, a soft rim of scattered light, and the caustics of the
 * surface playing over the back.
 */

export interface WhaleOptions {
  /** Body length in world units. */
  length: number;
  /** Max body radius. */
  radius: number;
  /** Back, belly and fin-underside colours. */
  back: string;
  belly: string;
  /** 0..1: freckles and scars (an adult has a few, a calf none). */
  marks: number;
  /** Eye size relative to the body (a calf's are bigger). */
  eye: number;
  /** Pectoral fin length relative to the body. */
  fin: number;
  /** A faint blush on the cheeks (the calf). */
  blush?: boolean;
  seed: number;
}

export interface WhaleInput {
  /** Ambient seconds (stops in calm mode). */
  time: number;
  /** Speed through the water (units / s at 1x) and how hard it is pushing (0..1). */
  speed: number;
  effort: number;
  /** Turning rate (radians / s, + to the left) and climbing / diving (radians / s). */
  turn: number;
  climb: number;
  /** The point the eyes turn to, in the whale's own frame (+z ahead, +y up). */
  look: [number, number, number];
  mood: PodMood;
  moodTime: number;
  moodWeight: number;
  /** 0..1: blowing a bubble (cheeks fill, then the breath goes out). */
  blow: number;
  /** Seconds since the viewer clicked it (-1: not reacting). */
  react: number;
  /** 0 hovering in place .. 1 roaming (idle life): a slower, longer stroke. */
  roam: number;
  /** An idle flourish while roaming: a roll, a spyhop... (0 none). */
  trick: { kind: 'none' | 'roll' | 'spyhop' | 'loop' | 'nod'; t: number; weight: number };
}

export interface WhaleRig {
  /** Position, yaw, pitch and roll go on the root (rotation order YXZ; pitch = -rotation.x). */
  root: Group;
  /** Where the blowhole and the mouth are, in the root's frame (bubbles come from them). */
  blowhole: Vector3;
  mouth: Vector3;
  /** Tail tip, in the root's frame (wake bubbles). */
  tail: Vector3;
  hit: Object3D[];
  update(input: WhaleInput): void;
  dispose(): void;
}

const RING = 36;
const SEGS = 72;

/** Radius of the body at s (0 snout .. 1 tail stock), as a fraction of the max radius. */
function profile(s: number): number {
  if (s < 0.2) {
    // A rounded snout that fills out into a broad head: a softened elliptic cap.
    const u = (0.2 - s) / 0.2;
    return 0.86 * Math.pow(Math.max(0, 1 - u * u), 0.62) + 0.03;
  }
  if (s < 0.38) return 0.89 + 0.11 * Math.sin(((s - 0.2) / 0.18) * (Math.PI / 2));
  const u = (s - 0.36) / 0.64;
  const taper = 0.5 + 0.5 * Math.cos(Math.PI * Math.pow(u, 0.92));
  return 0.085 + 0.915 * Math.pow(taper, 0.95);
}

/** Width and height of the cross-section at s (the tail stock is narrow and deep; the belly a touch flatter). */
function section(s: number): { w: number; h: number; drop: number } {
  const k = Math.min(1, Math.max(0, (s - 0.55) / 0.45));
  const w = 1 - 0.5 * k * k;
  // The head is a little flatter than deep; the tail stock deep and narrow.
  const head = Math.max(0, 1 - s / 0.4);
  const h = 0.9 - 0.08 * head + 0.15 * k;
  // The jaw line sits a little lower than the crown at the front.
  const drop = s < 0.3 ? -0.06 * (1 - s / 0.3) : 0;
  return { w, h, drop };
}

function buildBody(length: number, radius: number, nose: number): BufferGeometry {
  const verts = (SEGS + 1) * (RING + 1);
  const pos = new Float32Array(verts * 3);
  const ring = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  let v = 0;
  for (let i = 0; i <= SEGS; i++) {
    // Denser rings near the snout, where the curvature is.
    const t = i / SEGS;
    const s = t < 0.2 ? 0.2 * Math.pow(t / 0.2, 1.6) : t;
    const r = profile(s) * radius;
    const { w, h, drop } = section(s);
    const z = nose - s * length;
    for (let j = 0; j <= RING; j++) {
      const a = (j / RING) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      // Belly flatter than back towards the front.
      const belly = sn < 0 ? 1 - 0.1 * (1 - s) : 1;
      pos[v * 3] = c * r * w;
      pos[v * 3 + 1] = sn * r * h * belly + drop * radius;
      pos[v * 3 + 2] = z;
      ring[v * 3] = s;
      ring[v * 3 + 1] = c;
      ring[v * 3 + 2] = sn;
      uv[v * 2] = s;
      uv[v * 2 + 1] = j / RING;
      v++;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < SEGS; i++) {
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j, b = a + RING + 1;
      // Counter-clockwise seen from outside (rings run anticlockwise round +z, the body runs towards -z).
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aRing', new BufferAttribute(ring, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // Close the snout: weld the first ring's normals to point forward.
  const n = g.attributes.normal as BufferAttribute;
  for (let j = 0; j <= RING; j++) n.setXYZ(j, 0, 0, 1);
  return g;
}

/**
 * The spine's bend at s: displacement (x, y) and its slope along z, for the stroke phase, stroke amplitude,
 * lateral curve and vertical arch. Mirrored exactly in the vertex shader.
 */
function bend(s: number, phase: number, amp: number, yawBend: number, pitchBend: number, length: number) {
  const w = smoothstep(0.22, 1.0, s);
  const k = 4.4;
  const wave = Math.sin(phase - s * k);
  const tail = Math.max(0, s - 0.3);
  const dy = amp * length * w * w * wave + pitchBend * tail * tail * length - amp * length * 0.05 * (1 - s) * Math.sin(phase + 0.9);
  const dx = yawBend * tail * tail * length;
  // d/ds of the above, then over dz/ds = -length.
  const dw = s > 0.22 && s < 1 ? (6 * ((s - 0.22) / 0.78) * (1 - (s - 0.22) / 0.78)) / 0.78 : 0;
  const ddy = amp * length * (2 * w * dw * wave - w * w * k * Math.cos(phase - s * k)) + 2 * pitchBend * tail * length + amp * length * 0.05 * Math.sin(phase + 0.9);
  const ddx = 2 * yawBend * tail * length;
  return { dx, dy, slopeY: -ddy / length, slopeX: -ddx / length };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const BEND_GLSL = /* glsl */ `
uniform vec4 uSwim;   // phase, amplitude, lateral bend, vertical arch
uniform float uLen;
attribute vec3 aRing;
varying vec3 vRing;
varying vec3 vWorldPos;
float wsmooth(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec4 spineBend(float s) {
  float w = wsmooth(0.22, 1.0, s);
  float k = 4.4;
  float wave = sin(uSwim.x - s * k);
  float tail = max(0.0, s - 0.3);
  float dy = uSwim.y * uLen * w * w * wave + uSwim.w * tail * tail * uLen - uSwim.y * uLen * 0.05 * (1.0 - s) * sin(uSwim.x + 0.9);
  float dx = uSwim.z * tail * tail * uLen;
  float q = clamp((s - 0.22) / 0.78, 0.0, 1.0);
  float dw = (s > 0.22 && s < 1.0) ? 6.0 * q * (1.0 - q) / 0.78 : 0.0;
  float ddy = uSwim.y * uLen * (2.0 * w * dw * wave - w * w * k * cos(uSwim.x - s * k)) + 2.0 * uSwim.w * tail * uLen + uSwim.y * uLen * 0.05 * sin(uSwim.x + 0.9);
  float ddx = 2.0 * uSwim.z * tail * uLen;
  return vec4(dx, dy, -ddx / uLen, -ddy / uLen);
}
`;

interface SkinParams {
  back: Color;
  belly: Color;
  marks: number;
  blush: number;
  seed: number;
}

/** The body's material: countershading, pleats, marks, a rim of scattered light and caustics. */
function skinMaterial(p: SkinParams, length: number, uniforms: { uSwim: { value: number[] }; uLen: { value: number }; uPuff: { value: number } }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.0 });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms, OCEAN, {
      uBack: { value: p.back },
      uBelly: { value: p.belly },
      uMarks: { value: p.marks },
      uBlush: { value: p.blush },
      uSeed: { value: p.seed },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND_GLSL}\nuniform float uPuff;`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec4 bnd = spineBend(aRing.x);
        objectNormal.z -= objectNormal.y * bnd.w + objectNormal.x * bnd.z;
        objectNormal = normalize(objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRing = aRing;
        // Cheeks fill when it blows a bubble.
        float cheek = uPuff * exp(-pow((aRing.x - 0.12) / 0.07, 2.0)) * smoothstep(-0.6, 0.2, -aRing.z) * 0.12;
        transformed.xy += normalize(vec2(aRing.y, aRing.z) + 1e-5) * cheek;
        transformed.x += bnd.x;
        transformed.y += bnd.y;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uBack;
        uniform vec3 uBelly;
        uniform float uMarks;
        uniform float uBlush;
        uniform float uSeed;
        uniform float uOceanTime;
        uniform float uFloorY;
        uniform float uSurfaceY;
        uniform float uCaustic;
        varying vec3 vRing;
        varying vec3 vWorldPos;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.0) * 43758.5453); }
        ${CAUSTICS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float s = vRing.x;
          float up = vRing.z;
          float ang = atan(vRing.z, vRing.y);
          // Countershading: the line between back and belly runs low along the flank and waves a little.
          float line = -0.3 + 0.07 * sin(s * 17.0 + 1.3) + 0.16 * smoothstep(0.3, 0.9, s) - 0.08 * (1.0 - smoothstep(0.0, 0.22, s));
          float belly = 1.0 - smoothstep(line - 0.07, line + 0.07, up);
          vec3 col = mix(uBack, uBelly, belly);
          // The back darkens towards the ridge.
          col *= 1.0 - 0.18 * smoothstep(0.3, 1.0, up);
          // Throat pleats: long grooves under the head and chest.
          float pleat = smoothstep(0.4, 0.5, abs(fract(ang * 11.0) - 0.5)) * belly * (1.0 - smoothstep(0.3, 0.48, s)) * smoothstep(0.04, 0.1, s);
          col = mix(col, col * vec3(0.8, 0.84, 0.9), pleat * 0.6);
          // Freckles and pale scars on the back (adult).
          // A few pale scars and barnacle freckles, mostly on the head and shoulders.
          vec2 cell = floor(vec2(s * 40.0, ang * 6.0));
          float h = wHash(cell);
          vec2 inC = fract(vec2(s * 40.0, ang * 6.0)) - 0.5;
          float dot1 = step(0.93, h) * (1.0 - smoothstep(0.08, 0.22, length(inC * vec2(1.0, 1.8)))) * (1.0 - belly) * (1.0 - smoothstep(0.25, 0.6, s));
          col = mix(col, mix(uBack, uBelly, 0.45), dot1 * uMarks * 0.55);
          // Blush on the cheeks (calf).
          float cheek = exp(-pow((s - 0.13) / 0.04, 2.0)) * exp(-pow((up + 0.12) / 0.16, 2.0)) * smoothstep(0.3, 0.6, abs(vRing.y));
          col = mix(col, vec3(0.98, 0.62, 0.66), cheek * uBlush * 0.45);
          diffuseColor.rgb = col;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 nrm = normalize(vNormal);
          float rim = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 2.6);
          totalEmissiveRadiance += vec3(0.25, 0.62, 0.78) * rim * 0.32;
          // Light bounced up from the sand onto the pale belly.
          float under = smoothstep(0.0, -0.8, vRing.z);
          totalEmissiveRadiance += uBelly * under * 0.1;
          // Surface light playing on the back.
          float facing = smoothstep(0.1, 0.9, vRing.z);
          float depth = clamp((vWorldPos.y - uFloorY) / max(1.0, uSurfaceY - uFloorY), 0.0, 1.0);
          float c = caustics(vWorldPos.xz * 1.1, uOceanTime) * facing * uCaustic;
          totalEmissiveRadiance += vec3(0.55, 0.85, 0.95) * c * (0.1 + 0.12 * depth);
        }`,
      );
  };
  m.customProgramCacheKey = () => `aqvl-whale-skin-${length.toFixed(2)}`;
  return m;
}

function flukeShape(span: number, chord: number): Shape {
  // Two lobes swept back from the stock to pointed tips, a concave trailing edge with a notch in the middle;
  // drawn in x (span) / y (chord, + forward, the stock at the origin).
  const s = new Shape();
  const h = span / 2;
  s.moveTo(0, chord * 0.18);
  s.bezierCurveTo(h * 0.3, chord * 0.2, h * 0.7, chord * 0.02, h, -chord * 0.62);
  s.bezierCurveTo(h * 0.82, -chord * 0.6, h * 0.55, -chord * 0.42, h * 0.32, -chord * 0.44);
  s.bezierCurveTo(h * 0.16, -chord * 0.46, h * 0.06, -chord * 0.36, 0, -chord * 0.24);
  s.bezierCurveTo(-h * 0.06, -chord * 0.36, -h * 0.16, -chord * 0.46, -h * 0.32, -chord * 0.44);
  s.bezierCurveTo(-h * 0.55, -chord * 0.42, -h * 0.82, -chord * 0.6, -h, -chord * 0.62);
  s.bezierCurveTo(-h * 0.7, chord * 0.02, -h * 0.3, chord * 0.2, 0, chord * 0.18);
  return s;
}

function finShape(len: number, wid: number): Shape {
  // A long paddle, its leading edge gently knobbled (humpback-like), round at the tip; drawn along -y from the root.
  const s = new Shape();
  s.moveTo(-wid * 0.5, 0);
  s.bezierCurveTo(-wid * 0.62, -len * 0.3, -wid * 0.45, -len * 0.75, -wid * 0.12, -len);
  s.bezierCurveTo(wid * 0.1, -len * 1.04, wid * 0.32, -len * 0.92, wid * 0.36, -len * 0.7);
  s.bezierCurveTo(wid * 0.42, -len * 0.4, wid * 0.55, -len * 0.18, wid * 0.5, 0);
  s.lineTo(-wid * 0.5, 0);
  return s;
}

/** A part's own two-tone material: the back's colour on top, the belly's beneath. */
function partMaterial(back: Color, belly: Color, length: number, tag: string): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uBack = { value: back };
    shader.uniforms.uBelly = { value: belly };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vUpN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUpN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBack;\nuniform vec3 uBelly;\nvarying vec3 vUpN;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(uBelly * 0.96, uBack, smoothstep(-0.25, 0.25, vUpN.y));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimP = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += vec3(0.25, 0.62, 0.78) * rimP * 0.25;`,
      );
  };
  m.customProgramCacheKey = () => `aqvl-whale-part-${tag}-${length.toFixed(2)}`;
  return m;
}

export function buildWhale(o: WhaleOptions): WhaleRig {
  const L = o.length;
  const R = o.radius;
  const nose = L * 0.48;
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const back = new Color(o.back);
  const belly = new Color(o.belly);
  const uniforms = { uSwim: { value: [0, 0, 0, 0] }, uLen: { value: L }, uPuff: { value: 0 } };

  const root = new Group();
  root.rotation.order = 'YXZ';
  const gesture = new Group();
  gesture.rotation.order = 'YXZ';
  root.add(gesture);

  const skin = keep(skinMaterial({ back, belly, marks: o.marks, blush: o.blush ? 1 : 0, seed: o.seed }, L, uniforms));
  const body = new Mesh(keep(buildBody(L, R, nose)), skin);
  body.frustumCulled = false;
  gesture.add(body);

  const partMat = keep(partMaterial(back, belly, L, 'fin'));
  const dark = keep(new MeshStandardMaterial({ color: new Color(o.back).multiplyScalar(0.4), roughness: 0.6 }));

  // ── Flukes, on a pivot at the tail stock ──
  const flukePivot = new Group();
  const flukeGeo = keep(new ExtrudeGeometry(flukeShape(L * 0.5, L * 0.22), { depth: R * 0.025, bevelEnabled: true, bevelThickness: R * 0.022, bevelSize: R * 0.02, bevelSegments: 3, curveSegments: 20 }));
  flukeGeo.translate(0, 0, -R * 0.0125);
  // The tips droop a little (flukes are never quite flat).
  {
    const fp = flukeGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i) / (L * 0.25);
      fp.setZ(i, fp.getZ(i) + x * x * R * 0.12);
    }
    flukeGeo.computeVertexNormals();
  }
  const flukes = new Mesh(flukeGeo, partMat);
  // The shape is drawn in x/y with +y forward: lay it flat so forward stays +z (the lobes sweep back behind the stock).
  flukes.rotation.x = Math.PI / 2;
  flukes.position.z = -L * 0.02;
  flukePivot.add(flukes);
  gesture.add(flukePivot);

  // ── Pectoral fins ──
  const finGeo = keep(new ExtrudeGeometry(finShape(L * o.fin, L * o.fin * 0.26), { depth: R * 0.025, bevelEnabled: true, bevelThickness: R * 0.022, bevelSize: R * 0.022, bevelSegments: 3, curveSegments: 16 }));
  finGeo.translate(0, 0, -R * 0.025);
  // Lay the blade flat (thickness up), pointing back from its root.
  finGeo.rotateX(Math.PI / 2);
  const fins = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.rotation.order = 'YZX';
    const fin = new Mesh(finGeo, partMat);
    pivot.add(fin);
    pivot.position.set(side * R * 0.74, -R * 0.5, nose - L * 0.27);
    gesture.add(pivot);
    return { pivot, side };
  });

  // ── Dorsal hump (a small, soft fin two thirds of the way back) ──
  const dShape = new Shape();
  dShape.moveTo(-R * 0.42, 0);
  dShape.bezierCurveTo(-R * 0.2, R * 0.05, -R * 0.02, R * 0.16, R * 0.06, R * 0.24);
  dShape.bezierCurveTo(R * 0.08, R * 0.14, R * 0.12, R * 0.05, R * 0.3, 0);
  dShape.lineTo(-R * 0.42, 0);
  const dorsalGeo = keep(new ExtrudeGeometry(dShape, { depth: R * 0.05, bevelEnabled: true, bevelThickness: R * 0.02, bevelSize: R * 0.02, bevelSegments: 2, curveSegments: 10 }));
  dorsalGeo.translate(0, -R * 0.04, -R * 0.025);
  // Drawn in x (along the body, + backwards) / y (up): turn it to run along -z.
  dorsalGeo.rotateY(Math.PI / 2);
  const dorsal = new Mesh(dorsalGeo, partMat);
  gesture.add(dorsal);

  // ── Eyes: dark and glossy, set into the head behind the corner of the mouth, a glint in each, lids to blink ──
  const eyeR = R * 0.085 * o.eye;
  const irisMat = keep(new MeshStandardMaterial({ color: '#0d1420', roughness: 0.12, metalness: 0.0 }));
  const ringMat = keep(new MeshStandardMaterial({ color: new Color(o.back).lerp(new Color(o.belly), 0.35), roughness: 0.5 }));
  const glintMat = keep(new MeshStandardMaterial({ color: '#ffffff', emissive: new Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.2 }));
  const lidMat = keep(new MeshStandardMaterial({ color: new Color(o.back).lerp(new Color(o.belly), 0.15), roughness: 0.5 }));
  const ball = keep(new SphereGeometry(1, 20, 14));
  const eyes = [-1, 1].map((side) => {
    const g = new Group();
    const sEye = 0.2;
    const r = profile(sEye) * R;
    const { h, drop } = section(sEye);
    const ang = -0.28;
    // Set into the head (only the front of the eye shows), just above the corner of the mouth.
    g.position.set(side * Math.cos(ang) * r * 0.985, Math.sin(ang) * r * h * 0.97 + drop * R, nose - sEye * L);
    // Turned to look out of the side of the head, a little forward.
    g.rotation.y = side * 0.35;
    const ring = new Mesh(ball, ringMat);
    ring.scale.set(eyeR * 0.55, eyeR * 1.25, eyeR * 1.55);
    g.add(ring);
    const look = new Group();
    g.add(look);
    const iris = new Mesh(ball, irisMat);
    iris.scale.set(eyeR * 0.75, eyeR * 0.95, eyeR * 1.1);
    iris.position.set(side * eyeR * 0.18, 0, 0);
    look.add(iris);
    const glint = new Mesh(ball, glintMat);
    glint.scale.setScalar(eyeR * 0.3);
    glint.position.set(side * eyeR * 0.85, eyeR * 0.38, eyeR * 0.35);
    look.add(glint);
    const lid = new Mesh(ball, lidMat);
    lid.scale.set(eyeR * 1.0, eyeR * 1.2, eyeR * 1.5);
    lid.position.set(side * eyeR * 0.12, eyeR * 1.2, 0);
    g.add(lid);
    gesture.add(g);
    return { g, look, lid, side };
  });

  // ── The smile: the line of the mouth along each side of the jaw, from the tip of the snout, curving up at the end ──
  const smileGeo: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const s = 0.012 + u * 0.18;
      const r = profile(s) * R * 1.005;
      const { h, drop } = section(s);
      // Round the ring from the front (the tip) along the lower flank, rising at the corner.
      const ang = -0.5 + 0.12 * u + 0.32 * Math.pow(u, 3);
      const x = Math.cos(ang) * r * (u < 0.1 ? u / 0.1 : 1);
      pts.push(new Vector3(side * x, Math.sin(ang) * r * h + drop * R, nose - s * L + 0.004));
    }
    smileGeo.push(keep(new TubeGeometry(new CatmullRomCurve3(pts), 28, R * 0.016, 6, false)));
  }
  const smileMat = keep(new MeshStandardMaterial({ color: new Color(o.back).multiplyScalar(0.55), roughness: 0.6 }));
  const smiles = smileGeo.map((g) => new Mesh(g, smileMat));
  smiles.forEach((m) => gesture.add(m));

  // ── Blowhole ──
  const hole = new Mesh(ball, dark);
  hole.scale.set(R * 0.07, R * 0.025, R * 0.11);
  hole.position.set(0, profile(0.24) * R * 0.93, nose - 0.24 * L);
  gesture.add(hole);

  const blowhole = new Vector3(0, profile(0.24) * R + 0.02, nose - 0.24 * L);
  const mouth = new Vector3(0, -R * 0.2, nose + 0.02);
  const tail = new Vector3(0, 0, nose - L * 1.08);

  let phase = o.seed * 3.1;
  let last = -1;
  let yawBend = 0;
  let pitchBend = 0;
  let flukeLag = 0;

  function place(obj: Object3D, s: number, x: number, y: number, ph: number, amp: number) {
    const b = bend(s, ph, amp, yawBend, pitchBend, L);
    obj.position.set(x + b.dx, y + b.dy, nose - s * L);
    return b;
  }

  function update(i: WhaleInput): void {
    const dt = last < 0 ? 0 : Math.max(0, Math.min(0.1, i.time - last));
    last = i.time;
    // Tail beat: slow and long while hovering, quicker and deeper when it swims or pushes.
    const speed = Math.max(0, i.speed);
    const freq = 0.32 + Math.min(1.15, speed * 0.14) + i.effort * 0.55 - i.roam * 0.06;
    phase += dt * Math.PI * 2 * freq;
    if (dt === 0 && i.time === 0) phase = o.seed * 3.1;
    const amp = 0.035 + Math.min(0.075, speed * 0.016) + i.effort * 0.03 + i.roam * 0.012;
    // The body curves into a turn and arches into a climb (eased, so a sudden turn does not snap it).
    const tYaw = Math.max(-0.22, Math.min(0.22, -i.turn * 0.1));
    const tPitch = Math.max(-0.12, Math.min(0.12, -i.climb * 0.06));
    const ease = 1 - Math.exp(-dt * 5);
    yawBend += (tYaw - yawBend) * (dt > 0 ? ease : 1);
    pitchBend += (tPitch - pitchBend) * (dt > 0 ? ease : 1);
    uniforms.uSwim.value[0] = phase;
    uniforms.uSwim.value[1] = amp;
    uniforms.uSwim.value[2] = yawBend;
    uniforms.uSwim.value[3] = pitchBend;

    // Flukes ride the end of the spine and flick a little behind its stroke.
    const end = bend(1, phase, amp, yawBend, pitchBend, L);
    flukeLag = Math.cos(phase - 4.4 - 0.9) * amp * 4.2;
    flukePivot.position.set(end.dx, end.dy, nose - L);
    flukePivot.rotation.set(-Math.atan(end.slopeY) * 1.1 + flukeLag * 0.9, Math.atan(end.slopeX), 0);
    // Flukes are a little wider than the stock where they meet it.
    const dor = place(dorsal, 0.68, 0, profile(0.68) * R * section(0.68).h * 0.96, phase, amp);
    dorsal.rotation.x = -Math.atan(dor.slopeY);
    dorsal.rotation.y = Math.atan(dor.slopeX);
    place(hole, 0.24, 0, profile(0.24) * R * 0.93, phase, amp);

    // Mood gestures, on the gesture group (about the body's centre).
    const w = i.moodWeight;
    const t = i.moodTime;
    let gYaw = 0, gPitch = 0, gRoll = 0, gLift = 0;
    let finOut = 0; // fins spread (+) or tucked (-)
    let finWave = 0; // one fin waves
    let squint = 0;
    switch (i.mood) {
      case 'compare':
        // Head tilted, weighing it up.
        gRoll = 0.16 * Math.sin(t * 1.6) * w;
        gPitch = -0.05 * w;
        break;
      case 'match':
        gPitch = 0.12 * Math.sin(Math.min(1, t / 0.9) * Math.PI * 2) * w;
        squint = 0.6 * w * Math.exp(-t * 0.8);
        finOut = 0.5 * w;
        break;
      case 'push':
        finOut = -0.5 * w;
        gPitch = -0.04 * w;
        break;
      case 'blow':
        finOut = 0.3 * w;
        break;
      case 'farewell':
        finWave = Math.sin(t * 7) * Math.exp(-t * 0.8) * w;
        break;
      case 'tap':
        finOut = 0.25 * w;
        break;
      case 'visit':
        gPitch = -0.1 * Math.sin(Math.min(1, t / 0.6) * Math.PI) * w;
        break;
      case 'shake':
        gYaw = 0.22 * Math.sin(t * 13) * Math.exp(-t * 2.2) * w;
        break;
      case 'happy':
        gRoll = 0.3 * Math.sin(t * 6) * Math.exp(-t * 1.6) * w;
        finOut = 0.6 * w * Math.exp(-t * 0.8);
        squint = 0.5 * w * Math.exp(-t * 0.7);
        break;
      case 'celebrate': {
        // A full barrel roll, then fins out and a happy squint.
        const u = Math.min(1, t / 1.5);
        gRoll = (u * u * (3 - 2 * u)) * Math.PI * 2 * w;
        gLift = Math.sin(u * Math.PI) * 0.25 * w;
        finOut = 0.8 * w;
        squint = 0.7 * w;
        break;
      }
      case 'confused':
        gRoll = 0.24 * Math.sin(t * 1.3) * w;
        gYaw = 0.12 * Math.sin(t * 0.7 + 1) * w;
        finOut = 0.35 * Math.sin(t * 1.3) * w;
        break;
      case 'escort':
        gRoll = 0.05 * Math.sin(i.time * 0.9 + o.seed) * w;
        break;
      default:
        break;
    }
    // Idle tricks while roaming.
    const tr = i.trick;
    if (tr.weight > 0) {
      if (tr.kind === 'roll') gRoll += Math.sin(Math.min(1, tr.t / 2.4) * Math.PI) * 0 + (tr.t < 2.4 ? smoothstep(0, 2.4, tr.t) * Math.PI * 2 : 0) * tr.weight;
      if (tr.kind === 'nod') gPitch += 0.16 * Math.sin(tr.t * 4) * Math.exp(-tr.t * 0.9) * tr.weight;
      if (tr.kind === 'spyhop') gPitch += 0.85 * Math.sin(Math.min(1, tr.t / 3.2) * Math.PI) * tr.weight;
    }
    // Clicked: a happy wiggle and a roll.
    if (i.react >= 0 && i.react < 1.6) {
      const u = i.react / 1.6;
      gRoll += Math.sin(u * Math.PI) * 0.6 * Math.sin(i.react * 9) * (1 - u);
      squint = Math.max(squint, Math.sin(u * Math.PI));
      finOut = Math.max(finOut, Math.sin(u * Math.PI));
    }
    // Hovering: a slow breathing lift and roll.
    gLift += 0.03 * Math.sin(i.time * 0.8 + o.seed);
    gRoll += 0.035 * Math.sin(i.time * 0.53 + o.seed * 2);
    gesture.rotation.set(-gPitch, gYaw, gRoll);
    gesture.position.y = gLift;

    // Pectoral fins: a slow scull while hovering, tucked back when swimming fast or pushing, spread to brake, steer in turns.
    const fast = Math.min(1, speed / 4);
    for (const f of fins) {
      const scull = Math.sin(i.time * 1.6 + o.seed + (f.side > 0 ? 0 : 0.6)) * 0.18 * (1 - fast);
      const steer = -f.side * i.turn * 0.12;
      const wave = f.side > 0 ? finWave : 0;
      // Root angles: splayed out from the flank (y), drooping down (z), the leading edge tipped up a touch (x).
      f.pivot.rotation.y = f.side * (0.32 + 0.3 * finOut - 0.22 * fast + steer * 0.5);
      f.pivot.rotation.z = -f.side * (0.85 - 0.3 * finOut + 0.15 * fast - scull - wave * 0.9);
      f.pivot.rotation.x = 0.12 + scull * 0.4;
    }

    // Eyes: blink now and then; look towards the target; squint when happy.
    const blinkCycle = (i.time + o.seed * 2.3) % 4.6;
    const blink = blinkCycle < 0.14 ? Math.sin((blinkCycle / 0.14) * Math.PI) : 0;
    const lid = Math.max(blink, squint * 0.55);
    const [lx, ly, lz] = i.look;
    for (const e of eyes) {
      // The eye turns (a little) towards the target, within what the socket allows.
      const dx = lx - e.g.position.x, dy = ly - e.g.position.y, dz = lz - e.g.position.z;
      const yaw = Math.max(-0.45, Math.min(0.45, Math.atan2(dz, Math.max(0.15, dx * e.side + 0.5)) * 0.4));
      const pitch = Math.max(-0.35, Math.min(0.35, Math.atan2(dy, Math.hypot(dx, dz)) * 0.5));
      e.look.rotation.set(0, -e.side * yaw, e.side * pitch * 0.6);
      e.lid.position.y = eyeR * (1.2 - 1.1 * lid);
      e.lid.visible = lid > 0.02;
    }
    uniforms.uPuff.value = i.blow;
  }

  update({ time: 0, speed: 0, effort: 0, turn: 0, climb: 0, look: [0, 0, 4], mood: 'hover', moodTime: 0, moodWeight: 0, blow: 0, react: -1, roam: 0, trick: { kind: 'none', t: 0, weight: 0 } });

  return {
    root,
    blowhole,
    mouth,
    tail,
    hit: [body],
    update,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** The pair: a slate-blue adult with a few pale marks, and her lighter, round-eyed calf. */
export function buildPodRigs(): WhaleRig[] {
  return [
    buildWhale({ length: 2.75, radius: 0.5, back: '#365c86', belly: '#eef2f1', marks: 1, eye: 1.1, fin: 0.25, seed: 0.4 }),
    buildWhale({ length: 1.4, radius: 0.29, back: '#6b90b6', belly: '#f3f5f2', marks: 0, eye: 1.45, fin: 0.23, blush: true, seed: 1.7 }),
  ];
}

export type { Material };

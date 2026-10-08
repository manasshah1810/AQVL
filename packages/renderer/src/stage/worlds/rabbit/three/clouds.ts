import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NOISE } from '../../three/glsl';
import type { V3 } from '../kingdom';

/**
 * The kingdom's soft stuff: cloud puffs (lit by hand so they can turn pink
 * at sunset and catch silver moonlight on their tops and edges at night),
 * the sky dome (sun, a big moon, stars, a sea of clouds below), the turf on
 * the islands (with cloud shadows drifting over it) and the swept ribbons
 * the bridges and the slide are made of.
 */

/** Uniforms every day-lit shader here shares (one object, updated once a frame). */
export function dayUniforms() {
  return {
    uSun: { value: new Vector3(0, 1, 0) },
    uMoon: { value: new Vector3(0, -1, 0) },
    uDay: { value: 1 },
    uNight: { value: 0 },
    uDusk: { value: 0 },
    uTime: { value: 0 },
    uFogColor: { value: new Color('#cfeaff') },
    uFogNear: { value: 80 },
    uFogFar: { value: 340 },
  };
}
export type DayUniforms = ReturnType<typeof dayUniforms>;

export interface Puff {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Vertical squash (1: round). */
  sy?: number;
  tint: string;
}

let unit: BufferGeometry | null = null;
function unitPuff(): BufferGeometry {
  if (!unit) {
    const g = mergeVertices(new IcosahedronGeometry(1, 3));
    g.deleteAttribute('uv');
    // Lumpy, not a perfect ball.
    const p = g.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.07 * Math.sin(x * 5.1 + y * 3.3) + 0.05 * Math.sin(z * 6.7 - x * 2.1) + 0.04 * Math.sin(y * 9.1 + z * 4.3);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    unit = g;
  }
  return unit;
}

/** One geometry for many puffs (one draw call), each tinted. */
export function puffGeometry(puffs: Puff[]): BufferGeometry {
  const base = unitPuff();
  const parts: BufferGeometry[] = [];
  const c = new Color();
  for (const pf of puffs) {
    const g = base.clone();
    g.scale(pf.r, pf.r * (pf.sy ?? 1), pf.r);
    g.rotateY(pf.x * 1.7 + pf.z);
    g.translate(pf.x, pf.y, pf.z);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    c.set(pf.tint);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    parts.push(g);
  }
  const merged = parts.length ? mergeGeometries(parts, false) : new BufferGeometry();
  parts.forEach((g) => g.dispose());
  return merged;
}

const CLOUD_VERTEX = /* glsl */ `
attribute vec3 color;
varying vec3 vN;
varying vec3 vW;
varying vec3 vC;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vC = color;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const CLOUD_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uDay;
uniform float uNight;
uniform float uDusk;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGlow;
varying vec3 vN;
varying vec3 vW;
varying vec3 vC;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float sd = dot(n, uSun) * 0.5 + 0.5;
  float md = dot(n, uMoon) * 0.5 + 0.5;
  float rim = pow(1.0 - max(0.0, dot(n, v)), 2.4);
  float up = smoothstep(-0.4, 1.0, n.y);
  // Day: bright white tops, soft lilac in the shade.
  vec3 day = mix(vec3(0.78, 0.78, 0.94), vec3(1.0, 0.995, 0.985), smoothstep(0.1, 0.85, sd) * 0.7 + up * 0.3);
  // Sunset: pink and gold.
  day = mix(day, day * vec3(1.0, 0.8, 0.76) + vec3(0.1, 0.03, 0.05), uDusk * 0.85);
  // Night: deep blue, silvered where the moon reaches.
  vec3 night = mix(vec3(0.15, 0.18, 0.38), vec3(0.56, 0.63, 0.94), smoothstep(0.25, 0.95, md) * 0.75 + up * 0.25);
  vec3 col = mix(night, day, uDay) * vC;
  col += vec3(0.62, 0.74, 1.0) * rim * (0.3 + 0.7 * md) * uNight * 0.85;
  col += vec3(0.45, 0.58, 1.0) * smoothstep(0.4, 1.0, n.y) * uNight * 0.18;
  col += vec3(1.0) * rim * 0.1 * uDay;
  col += vec3(1.0, 0.72, 0.55) * rim * uDusk * 0.3;
  // A faint glow from within at night (the clouds of a magic kingdom).
  col += vec3(0.32, 0.26, 0.6) * uNight * uGlow * (1.0 - up * 0.6);
  float dist = length(vW - cameraPosition);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function cloudMaterial(u: DayUniforms, glow = 0.35): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...u, uGlow: { value: glow } },
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
  });
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const SKY_FRAGMENT = /* glsl */ `
${NOISE}
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uDay;
uniform float uNight;
uniform float uDusk;
uniform float uTime;
varying vec3 vDir;
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 zen = mix(vec3(0.03, 0.05, 0.17), vec3(0.33, 0.62, 0.98), uDay);
  vec3 hor = mix(vec3(0.13, 0.19, 0.42), vec3(0.8, 0.9, 1.0), uDay);
  zen = mix(zen, vec3(0.38, 0.4, 0.78), uDusk * 0.55);
  hor = mix(hor, vec3(1.0, 0.68, 0.58), uDusk * 0.85);
  vec3 col = mix(hor, zen, smoothstep(-0.02, 0.6, h));
  // The sun: a warm glow round it (strong at sunset), and its disc.
  float sd = max(0.0, dot(d, uSun));
  col += vec3(1.0, 0.62, 0.42) * pow(sd, 5.0) * uDusk * 0.75;
  col += vec3(1.0, 0.95, 0.82) * pow(sd, 48.0) * uDay * 0.55;
  col = mix(col, vec3(1.25, 1.18, 1.0), smoothstep(0.99935, 0.99965, sd) * (1.0 - uNight));
  // Stars: tiny, twinkling, only at night and only above the horizon.
  vec3 sp = d * 170.0;
  vec3 cell = floor(sp);
  float r = hash13(cell);
  vec3 f = fract(sp) - 0.5;
  float star = step(0.975, r) * smoothstep(0.16, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * (1.5 + r * 3.0) + r * 60.0));
  col += vec3(0.9, 0.93, 1.0) * star * uNight * smoothstep(0.0, 0.18, h) * 1.4;
  // A soft band of the milky way.
  float band = exp(-pow(dot(d, normalize(vec3(0.4, 0.2, 1.0))) * 3.2, 2.0)) * fbm(d.xy * 7.0 + d.z * 3.0);
  col += vec3(0.4, 0.42, 0.75) * band * uNight * 0.35 * smoothstep(0.0, 0.3, h);
  // The moon: big and bright, with a halo; faintly there in the day too.
  float md = dot(d, uMoon);
  col += vec3(0.55, 0.66, 1.0) * pow(max(0.0, md), 90.0) * (0.15 + 0.55 * uNight);
  float disc = smoothstep(0.9962, 0.9968, md);
  vec3 mu = cross(uMoon, vec3(0.0, 1.0, 0.0));
  vec2 mq = vec2(dot(d, normalize(mu)), dot(d, normalize(cross(mu, uMoon)))) * 40.0;
  float maria = fbm(mq * 1.4 + 3.0);
  vec3 moon = vec3(1.0, 0.98, 0.9) * (1.05 - 0.28 * smoothstep(0.45, 0.7, maria));
  col = mix(col, moon * 1.3, disc * (0.25 + 0.75 * uNight));
  // Below: a sea of cloud far down, lit like the clouds.
  float below = smoothstep(0.03, -0.1, h);
  vec2 uv = d.xz / (abs(h) + 0.12);
  float c = fbm(uv * 0.9 + vec2(uTime * 0.004, uTime * 0.002));
  vec3 seaDay = mix(vec3(0.8, 0.82, 0.96), vec3(1.0, 0.99, 1.0), c);
  seaDay = mix(seaDay, seaDay * vec3(1.0, 0.78, 0.74), uDusk * 0.8);
  vec3 seaNight = mix(vec3(0.1, 0.13, 0.3), vec3(0.32, 0.38, 0.66), c);
  vec3 sea = mix(seaNight, seaDay, uDay);
  col = mix(col, mix(hor, sea, 0.85), below);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function skyMaterial(u: DayUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: u,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
}

/** The colour of the sky at the horizon (the fog, the background), from the day. */
export function horizonColor(day: number, dusk: number, out: Color): Color {
  const n = new Color(0.13, 0.19, 0.42), dd = new Color(0.8, 0.9, 1.0), ds = new Color(1.0, 0.68, 0.58);
  return out.copy(n).lerp(dd, day).lerp(ds, dusk * 0.85);
}

/** Turf on an island's top: the island's colour, a little uneven, with cloud shadows drifting across it by day. */
export function turfMaterial(color: string, u: DayUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, roughness: 0.95 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.uniforms.uDay = u.uDay;
    sh.vertexShader = 'varying vec3 vTurf;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTurf = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTime;\nuniform float uDay;\nvarying vec3 vTurf;\n${NOISE}\n` + sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      diffuseColor.rgb *= 0.93 + 0.12 * fbm(vTurf.xz * 0.45);
      float shade = smoothstep(0.52, 0.7, fbm(vTurf.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.007)));
      diffuseColor.rgb *= 1.0 - shade * 0.2 * uDay;`,
    );
  };
  m.customProgramCacheKey = () => 'rabbit-turf';
  return m;
}

/**
 * A ribbon swept along a path: strips across it (each its own colour), a top, an underside and two sides.
 * Used for the rainbow bridges, the cloud walkways and the slide.
 */
export function sweep(pts: V3[], strips: { from: number; to: number; color: string }[], thick: number): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color();
  const side: [number, number][] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  });
  const quad = (a: V3, b: V3, cc: V3, d: V3) => {
    pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  };
  const at = (i: number, off: number, dy: number): V3 => [pts[i][0] + side[i][0] * off, pts[i][1] + dy, pts[i][2] + side[i][1] * off];
  const lo = Math.min(...strips.map((s) => s.from)), hi = Math.max(...strips.map((s) => s.to));
  for (let i = 0; i < pts.length - 1; i++) {
    for (const s of strips) {
      c.set(s.color);
      quad(at(i, s.from, 0), at(i, s.to, 0), at(i + 1, s.to, 0), at(i + 1, s.from, 0));
      quad(at(i, s.to, -thick), at(i, s.from, -thick), at(i + 1, s.from, -thick), at(i + 1, s.to, -thick));
    }
    c.set(strips[0].color);
    quad(at(i, lo, -thick), at(i, lo, 0), at(i + 1, lo, 0), at(i + 1, lo, -thick));
    c.set(strips[strips.length - 1].color);
    quad(at(i, hi, 0), at(i, hi, -thick), at(i + 1, hi, -thick), at(i + 1, hi, 0));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

/** A material for swept ribbons: vertex colours, with a glow of their own colour that can rise at night. */
export function ribbonMaterial(glow: { value: number }, rough = 0.55): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: rough, side: 2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glow;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uGlow;');
  };
  m.customProgramCacheKey = () => 'rabbit-ribbon';
  return m;
}

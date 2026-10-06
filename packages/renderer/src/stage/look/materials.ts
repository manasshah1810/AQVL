import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/** How a node body is finished: the studio's porcelain, a world's ice block or bamboo crate. */
export type NodeFinish = 'porcelain' | 'ice' | 'bamboo';

/** Ice: frosted edges, a cool rim where the face turns away, faint bubbles; the face centre stays clear for the value. */
const ICE_FRAGMENT = /* glsl */ `
{
  vec3 q = abs(vObj) * 2.0;
  float edge = smoothstep(0.62, 0.98, max(max(min(q.x, q.y), min(q.y, q.z)), min(q.x, q.z)));
  float n = fract(sin(dot(floor(vObj * 38.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float speck = step(0.93, n) * 0.06;
  float vertical = 1.0 - smoothstep(0.8, 0.95, abs(normalize(vNormal).y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), edge * 0.32 * vertical + speck);
  // Frozen-in bubbles and a faint seam, so a ball rolling across the ice visibly turns.
  vec3 cell = floor(vObj * 5.0);
  vec3 within = fract(vObj * 5.0) - 0.5;
  float hb = fract(sin(dot(cell, vec3(31.7, 17.3, 53.1))) * 12345.678);
  float bubble = step(0.72, hb) * (1.0 - smoothstep(0.08, 0.2, length(within)));
  float seam = 1.0 - smoothstep(0.0, 0.012, abs(vObj.y * 0.9 + vObj.x * 0.45));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.9, 1.0), bubble * 0.4 + seam * 0.1);
}
`;
const ICE_EMISSIVE = /* glsl */ `
{
  float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += vec3(0.42, 0.72, 1.0) * rim * 0.14;
}
`;
/** Bamboo crate: upright slats with dark seams, a little grain, and lashed bands top and bottom. */
const BAMBOO_FRAGMENT = /* glsl */ `
{
  vec3 o = vObj;
  float across = abs(o.z) > 0.49 ? o.x : (abs(o.x) > 0.49 ? o.z : o.x);
  float seam = smoothstep(0.43, 0.5, abs(fract(across * 4.0 + 0.5) - 0.5));
  float grain = 0.5 + 0.5 * sin(o.y * 46.0 + sin(across * 23.0) * 2.4);
  float band = smoothstep(0.36, 0.4, abs(o.y)) * (1.0 - smoothstep(0.46, 0.5, abs(o.y)));
  float face = 1.0 - smoothstep(0.18, 0.3, max(abs(across), abs(o.y)) - 0.12);
  float k = 1.0 - seam * 0.22 - grain * 0.035 * (1.0 - face);
  diffuseColor.rgb *= k;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.52, 0.36), band * 0.75);
}
`;

/**
 * Node bodies: satin porcelain with soft rounded edges. Per instance it
 * takes a colour (instanceColor) and `aFx` = (lit, finish):
 *  - lit adds a little of the body colour as emission (hover; zero otherwise);
 *  - finish blends from a light satin polish (0) to fully matte (1, "settled").
 * No rim light and no glow: the shape reads from the lighting alone.
 * A world can ask for ice or bamboo instead; the state colours stay the same.
 */
export function createNodeMaterial(finish: NodeFinish = 'porcelain'): MeshPhysicalMaterial {
  const ice = finish === 'ice';
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: ice ? 0.22 : finish === 'bamboo' ? 0.62 : 0.46,
    metalness: 0,
    clearcoat: ice ? 0.55 : finish === 'bamboo' ? 0.12 : 0.3,
    clearcoatRoughness: ice ? 0.2 : 0.42,
    ior: ice ? 1.31 : 1.45,
    specularIntensity: ice ? 0.75 : 0.45,
    envMapIntensity: ice ? 1.05 : 1,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFx;\nvarying vec2 vFx;\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = aFx;\nvObj = position;');
    let fragment = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFx;\nvarying vec3 vObj;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.8, vFx.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x;')
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= (1.0 - vFx.y);\n#endif',
      );
    if (ice) {
      fragment = fragment
        .replace('#include <color_fragment>', `#include <color_fragment>\n${ICE_FRAGMENT}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${ICE_EMISSIVE}`);
    } else if (finish === 'bamboo') {
      fragment = fragment.replace('#include <color_fragment>', `#include <color_fragment>\n${BAMBOO_FRAGMENT}`);
    }
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `aqvl-node-v4-${finish}`;
  return material;
}

/** Edge rods: satin, lit, coloured per instance. */
export function createEdgeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
}

/** The dot that travels along an edge a step uses: flat colour, painted (never added as light). */
export function createPulseMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
}

/** Call-stack frame slabs. */
export function createSlabMaterial(color: string): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.4 });
}

const DECAL_VERTEX = /* glsl */ `
attribute vec4 aColor;
attribute vec3 aShape;
varying vec4 vColor;
varying vec3 vShape;
varying vec2 vLocal;
void main() {
  vColor = aColor;
  vShape = aShape;
  vLocal = (uv - 0.5) * aShape.yz;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const DECAL_FRAGMENT = /* glsl */ `
varying vec4 vColor;
varying vec3 vShape;
varying vec2 vLocal;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float fill(float d) {
  float aa = fwidth(d) * 1.2;
  return 1.0 - smoothstep(-aa, aa, d);
}

void main() {
  float shape = vShape.x;
  vec2 size = vShape.yz;
  vec2 p = vLocal;
  float a = 0.0;
  if (shape < 0.5) {
    float r = min(0.38, min(size.x, size.y) * 0.5);
    float d = sdRoundBox(p, size * 0.5, r);
    a = fill(d) * (0.86 + 0.14 * smoothstep(-0.5, 0.0, d));
  } else if (shape < 2.5) {
    float r = min(0.38, min(size.x, size.y) * 0.5);
    float d = abs(sdRoundBox(p, size * 0.5 - 0.03, r)) - 0.022;
    a = fill(d);
    if (shape > 1.5) a *= step(0.45, fract((p.x + p.y) * 2.4));
  } else if (shape < 5.5) {
    float R = size.x * 0.5 - 0.05;
    float d = abs(length(p) - R) - 0.034;
    if (shape > 4.5) d = min(d, abs(length(p) - (R - 0.15)) - 0.022);
    a = fill(d);
    if (shape > 3.5 && shape < 4.5) a *= step(0.42, fract(atan(p.y, p.x) / 6.2831853 * 20.0));
  } else {
    // Chevron pointing at -z (towards the node it marks).
    vec2 q = vec2(abs(p.x), p.y);
    float d = max(q.x * 0.866 + p.y * 0.5, -p.y) - size.y * 0.25;
    a = fill(d);
  }
  if (a <= 0.002) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  #include <colorspace_fragment>
}
`;

/** Floor marks: footprints, regions, halos, ripples and cursors, drawn as signed-distance shapes. */
export function createDecalMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DECAL_VERTEX,
    fragmentShader: DECAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

const GRID_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uCenter;
uniform float uRadius;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  vec2 g5 = abs(fract(p / 5.0 - 0.5) - 0.5) / fwidth(p / 5.0);
  float major = 1.0 - min(min(g5.x, g5.y), 1.0);
  float fade = 1.0 - smoothstep(uRadius * 0.35, uRadius, distance(p, uCenter));
  float a = (line * 0.35 + major * 0.65) * uAlpha * fade;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

/** A faint hairline grid that fades out around the scene: it gives the floor scale without adding noise. */
export function createGridMaterial(color: string, alpha: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uAlpha: { value: alpha },
      uCenter: { value: [0, 0] },
      uRadius: { value: 20 },
    },
    vertexShader: /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`,
    fragmentShader: GRID_FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

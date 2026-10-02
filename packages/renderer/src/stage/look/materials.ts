import {
  AdditiveBlending,
  NormalBlending,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/**
 * Node bodies: a clear-coated resin with crisp bevels. Per instance it
 * takes a colour (instanceColor) and `aFx` = (glow, finish):
 *  - glow adds the body colour as emission (only a mutation goes past the bloom threshold);
 *  - finish blends from glossy clear coat (0) to matte and still (1, "settled").
 * A fresnel rim in the rim-light colour separates every body from the void.
 */
export function createNodeMaterial(rim: string, rimStrength: number): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ior: 1.5,
    specularIntensity: 0.6,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new Color(rim),
    envMapIntensity: 1,
  });
  const rimColor = { value: new Color(rim) };
  const rimAmount = { value: rimStrength };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRimColor = rimColor;
    shader.uniforms.uRimStrength = rimAmount;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFx;\nvarying vec2 vFx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = aFx;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFx;\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.78, vFx.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x;')
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= (1.0 - vFx.y);\n#endif',
      )
      .replace(
        '#include <lights_fragment_begin>',
        '#include <lights_fragment_begin>\nfloat rimF = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);\ntotalEmissiveRadiance += uRimColor * rimF * uRimStrength * (1.0 - 0.6 * vFx.y);',
      );
  };
  material.customProgramCacheKey = () => 'aqvl-node-v2';
  return material;
}

/** Edge rods: satin, lit, coloured per instance. */
export function createEdgeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.1, envMapIntensity: 0.8 });
}

/** Travelling light on an edge: unlit and bright enough to bloom only when it is a mutation (added on a dark ground, painted on a light one). */
export function createPulseMaterial(additive = true): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending });
}

/** Call-stack frame slabs. */
export function createSlabMaterial(color: string): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 });
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
  float a = (line * 0.3 + major * 0.75) * uAlpha * fade;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

/** A hairline grid that fades out around the scene, like the site's hairlines. */
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

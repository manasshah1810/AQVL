import {
  CircleGeometry,
  Color,
  LatheGeometry,
  ShaderMaterial,
  Vector2,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * What makes the kingdom read as soft and toy-like rather than built from
 * primitives: shapes with rounded edges (boxes, drums, plump cones), a
 * shading that cools and darkens the undersides of everything (a cheap
 * ambient occlusion) and lifts the silhouettes with a gentle rim of light
 * (so things stand off the pastel sky), and soft contact shadows that sit
 * every object and rabbit down on its cloud.
 */

/** A unit box (1×1×1) with rounded edges. */
export function roundBox(radius = 0.14, segments = 3): BufferGeometry {
  return new RoundedBoxGeometry(1, 1, 1, segments, radius);
}

/** A unit drum (radius 1, height 1, centred) whose top and bottom edges are rounded over. */
export function roundCylinder(bevel = 0.14, radial = 24, arc = 4): BufferGeometry {
  const pts: Vector2[] = [new Vector2(0, -0.5)];
  for (let i = 0; i <= arc; i++) {
    const a = -Math.PI / 2 + (i / arc) * (Math.PI / 2);
    pts.push(new Vector2(1 - bevel + Math.cos(a) * bevel, -0.5 + bevel + Math.sin(a) * bevel));
  }
  for (let i = 0; i <= arc; i++) {
    const a = (i / arc) * (Math.PI / 2);
    pts.push(new Vector2(1 - bevel + Math.cos(a) * bevel, 0.5 - bevel + Math.sin(a) * bevel));
  }
  pts.push(new Vector2(0, 0.5));
  return new LatheGeometry(pts, radial);
}

/** A unit cone (radius 1 at the base, height 1, centred) that bulges a little and has a rounded base and tip: a plump roof. */
export function plumpCone(radial = 24, bulge = 0.78): BufferGeometry {
  const pts: Vector2[] = [new Vector2(0, -0.5)];
  const b = 0.06;
  for (let i = 0; i <= 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * (Math.PI / 2);
    pts.push(new Vector2(1 - b + Math.cos(a) * b, -0.5 + b + Math.sin(a) * b));
  }
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    // Convex (fuller than a straight cone), easing round at the tip.
    const r = (1 - t) ** bulge * Math.sqrt(1 - t ** 6) * (1 - b * 0.4);
    pts.push(new Vector2(Math.max(0, r), -0.5 + b + t * (1 - b)));
  }
  pts.push(new Vector2(0, 0.5));
  return new LatheGeometry(pts, radial);
}

/**
 * Softens a standard (or physical) material: undersides and faces turned
 * away from the sky are cooled towards lilac and darkened (a hint of
 * ambient occlusion and depth), and a soft rim of the material's own colour
 * lifts the silhouette. All such materials share one program per variant.
 */
export function softToy<T extends MeshStandardMaterial>(m: T, rim = 0.22, occ = 0.22): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec3 softUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float softF = dot(normal, softUp);
        vec3 softShade = mix(vec3(${(1 - occ * 1.05).toFixed(3)}, ${(1 - occ * 1.1).toFixed(3)}, ${(1 - occ * 0.55).toFixed(3)}), vec3(1.0), smoothstep(-0.85, 0.45, softF));
        diffuseColor.rgb *= softShade;
        float softRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += (diffuseColor.rgb * 0.6 + vec3(0.4)) * softRim * ${rim.toFixed(3)} * (0.45 + 0.55 * smoothstep(-0.3, 0.8, softF));
      }`,
    );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `rabbit-soft-${rim}-${occ}-${key ? key() : ''}`;
  return m;
}

/** A soft round shadow on the ground (a radial fade), for one mesh or many instances. */
export function shadowMaterial(color = '#5b4a8c', opacity = 0.26): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.6) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** A unit disc lying flat (diameter 1). */
export function shadowDisc(): BufferGeometry {
  return new CircleGeometry(0.5, 28).rotateX(-Math.PI / 2);
}

export function disposeAll(list: (Material | BufferGeometry)[]): void {
  list.forEach((x) => x.dispose());
}

/**
 * Shader pieces shared by everything underwater: the light network the
 * surface throws on whatever faces up (caustics), and the time and depths
 * it is drawn at. One uniform object is shared by every material that uses
 * it, so the world sets the time once per frame and the seabed, the whales
 * and the nodes shimmer in step.
 */

export const OCEAN = {
  uOceanTime: { value: 0 },
  /** Height of the seabed under the structures, and of the surface far above. */
  uFloorY: { value: 0 },
  uSurfaceY: { value: 14 },
  /** 0..1: how strong the caustics are (0 in calm mode they stand still, they do not vanish). */
  uCaustic: { value: 1 },
};

/** Caustics: two drifting cell networks whose bright seams cross like light through ripples. */
export const CAUSTICS = /* glsl */ `
vec2 ocHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float ocNet(vec2 p, float t) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = ocHash22(n + g);
      vec2 o = 0.5 + 0.38 * sin(t * (0.6 + 0.5 * h) + 6.2831 * h);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return 1.0 - smoothstep(0.0, 0.13, d2 - d1);
}
float ocNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = ocHash22(i).x, b = ocHash22(i + vec2(1.0, 0.0)).x, c = ocHash22(i + vec2(0.0, 1.0)).x, d = ocHash22(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// 0..~1: threads of light on surfaces that face the surface. The networks are warped by slow noise, so the
// cells are irregular and wander (never a tiled pool floor), and they fade in and out in patches.
float caustics(vec2 p, float t) {
  vec2 w = vec2(ocNoise(p * 0.21 + t * 0.05), ocNoise(p * 0.21 + 7.3 - t * 0.04)) - 0.5;
  vec2 q = p + w * 2.6;
  float a = ocNet(q * 0.78 + vec2(t * 0.04, t * 0.025), t * 0.8);
  float b = ocNet(q * 1.21 + vec2(4.7 - t * 0.035, 1.3 + t * 0.02), t * 1.05);
  float patchy = smoothstep(0.25, 0.75, ocNoise(p * 0.09 + t * 0.02));
  return pow(a * 0.55 + b * 0.45, 2.6) * (0.35 + 0.65 * patchy);
}
`;

import React, { useEffect, useMemo } from 'react';
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { StageModel } from '../model/StageModel';
import type { StageSample } from '../model/sampler';
import type { StageDriver } from './driver';
import { NO_SHADOW_LAYER } from './StageEnvironment';

/** Above this height a body is too far from the floor to darken it. */
const REACH = 2.8;

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _q = new Quaternion();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/**
 * A soft shadow under every body, drawn straight down onto the floor: a
 * rounded footprint (round under spheres) with a gaussian edge that widens,
 * softens and fades as the body rises, and is gone above REACH. It is what
 * makes things stand on the floor rather than float over it, and being a
 * pure function of the sample it is exact, stable and cheap on every tier.
 */
export function NodeShadows({ model, driver, color, opacity }: { model: StageModel; driver: StageDriver; color: string; opacity: number }) {
  const n = model.slots.length;
  const parts = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    // (half width, half depth, corner radius, softness) in world units, and strength.
    const shape = new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 4), 4);
    const strength = new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1);
    shape.setUsage(DynamicDrawUsage);
    strength.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aShape', shape);
    geometry.setAttribute('aStrength', strength);
    const material = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
      vertexShader: /* glsl */ `
attribute vec4 aShape;
attribute float aStrength;
varying vec2 vLocal;
varying vec4 vShape;
varying float vStrength;
void main() {
  vShape = aShape;
  vStrength = aStrength;
  // The quad is scaled to the shadow's full extent; recover world-unit coordinates from its uv.
  vec2 extent = 2.0 * (aShape.xy + 2.5 * aShape.w);
  vLocal = (uv - 0.5) * extent;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vLocal;
varying vec4 vShape;
varying float vStrength;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  float d = sdRoundBox(vLocal, vShape.xy, vShape.z);
  // A gaussian falloff outside the footprint, gently darker towards its middle.
  float outside = max(d, 0.0) / vShape.w;
  float a = exp(-outside * outside * 1.6) * (0.78 + 0.22 * smoothstep(0.0, -0.45, d));
  a *= vStrength * uOpacity;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new InstancedMesh(geometry, material, Math.max(1, n));
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.layers.set(NO_SHADOW_LAYER);
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
    return { mesh, geometry, material, shape, strength };
  }, [n, color, opacity]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const { mesh, shape, strength } = parts;
        const sa = shape.array as Float32Array;
        const st = strength.array as Float32Array;
        const floorY = model.floorY;
        for (let s = 0; s < n; s++) {
          const presence = sample.presence[s];
          const bottom = sample.pos[s * 3 + 1] - (sample.dims[s * 3 + 1] * presence) / 2;
          const h = Math.max(0, bottom - floorY);
          if (presence <= 0.01 || h >= REACH) {
            mesh.setMatrixAt(s, HIDDEN);
            continue;
          }
          const lift = h / REACH;
          const round = model.slots[s].shape === 'sphere';
          const hw = sample.dims[s * 3] * 0.5 * presence * (round ? 0.62 : 0.92);
          const hd = sample.dims[s * 3 + 2] * 0.5 * presence * (round ? 0.62 : 0.92);
          const soft = 0.1 + 0.55 * lift;
          sa[s * 4] = hw;
          sa[s * 4 + 1] = hd;
          sa[s * 4 + 2] = round ? Math.min(hw, hd) : Math.min(hw, hd) * 0.3;
          sa[s * 4 + 3] = soft;
          st[s] = (1 - lift) * (1 - lift) * Math.min(1, presence * 1.2);
          _p.set(sample.pos[s * 3], floorY + 0.006, sample.pos[s * 3 + 2]);
          _s.set(2 * (hw + 2.5 * soft), 1, 2 * (hd + 2.5 * soft));
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(s, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        shape.needsUpdate = true;
        strength.needsUpdate = true;
      }),
    [driver, parts, model, n],
  );

  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.material.dispose();
      parts.mesh.dispose();
    },
    [parts],
  );

  return <primitive object={parts.mesh} />;
}

import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { MAX_RINGS } from '../model/sampler';
import type { StageDriver } from './driver';
import { NO_SHADOW_LAYER } from './StageEnvironment';

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/**
 * Halo rings around emphasised nodes that float above the floor: a thin
 * ring turned to the camera (solid = visited / changed, dashed = marked,
 * double = a role). Two instances per ring so a double ring is two rings.
 */
export function HaloRings({ driver }: { driver: StageDriver }) {
  const camera = useThree((s) => s.camera);
  const parts = useMemo(() => {
    const geometry = new TorusGeometry(1, 0.028, 8, 96);
    const color = new InstancedBufferAttribute(new Float32Array(MAX_RINGS * 2 * 4), 4);
    const style = new InstancedBufferAttribute(new Float32Array(MAX_RINGS * 2), 1);
    color.setUsage(DynamicDrawUsage);
    style.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aColor', color);
    geometry.setAttribute('aStyle', style);
    const material = new ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
attribute vec4 aColor;
attribute float aStyle;
varying vec4 vColor;
varying float vStyle;
varying vec2 vUv;
void main() {
  vColor = aColor;
  vStyle = aStyle;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
varying vec4 vColor;
varying float vStyle;
varying vec2 vUv;
void main() {
  if (vStyle > 0.5 && vStyle < 1.5 && fract(vUv.x * 18.0) < 0.42) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a);
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new InstancedMesh(geometry, material, MAX_RINGS * 2);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.layers.set(NO_SHADOW_LAYER);
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
    return { mesh, geometry, material, color, style };
  }, []);

  useEffect(
    () =>
      driver.register((sample) => {
        const { mesh, color, style } = parts;
        const ca = color.array as Float32Array;
        const sa = style.array as Float32Array;
        let n = 0;
        for (let j = 0; j < sample.ringCount; j++) {
          const kind = sample.ringStyle[j];
          const copies = kind === 2 ? 2 : 1;
          for (let c = 0; c < copies; c++) {
            const r = sample.ring[j * 5 + 3] * (c === 1 ? 0.84 : 1);
            _p.set(sample.ring[j * 5], sample.ring[j * 5 + 1], sample.ring[j * 5 + 2]);
            _s.set(r, r, r);
            _m.compose(_p, camera.quaternion, _s);
            mesh.setMatrixAt(n, _m);
            ca[n * 4] = sample.ringColor[j * 3];
            ca[n * 4 + 1] = sample.ringColor[j * 3 + 1];
            ca[n * 4 + 2] = sample.ringColor[j * 3 + 2];
            ca[n * 4 + 3] = sample.ring[j * 5 + 4];
            sa[n] = kind === 2 ? 0 : kind;
            n++;
          }
        }
        for (let i = n; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
        mesh.instanceMatrix.needsUpdate = true;
        color.needsUpdate = true;
        style.needsUpdate = true;
      }),
    [driver, parts, camera],
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

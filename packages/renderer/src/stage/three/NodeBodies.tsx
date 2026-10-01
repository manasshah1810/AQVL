import React, { useEffect, useMemo } from 'react';
import {
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type MeshPhysicalMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TraceShape } from '@aqvl/runtime';
import type { StageModel } from '../model/StageModel';
import type { StageSample } from '../model/sampler';
import { createNodeMaterial } from '../look/materials';
import type { StageDriver } from './driver';

interface ShapeBatch {
  shape: TraceShape;
  slots: number[];
  mesh: InstancedMesh;
  fx: InstancedBufferAttribute;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _axis = new Vector3(0, 0, 1);
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

function geometryFor(shape: TraceShape, sphereSegments: number): BufferGeometry {
  if (shape === 'sphere') return new SphereGeometry(0.5, sphereSegments, Math.round(sphereSegments * 0.7));
  if (shape === 'cylinder') return new CylinderGeometry(0.5, 0.5, 1, sphereSegments);
  return new RoundedBoxGeometry(1, 1, 1, 4, 0.11);
}

/**
 * Every node body, one instanced mesh per shape: one draw call per shape
 * however long the array or big the tree.
 */
export function NodeBodies({
  model,
  driver,
  shadows,
  sphereSegments,
}: {
  model: StageModel;
  driver: StageDriver;
  shadows: boolean;
  sphereSegments: number;
}) {
  const material = useMemo<MeshPhysicalMaterial>(
    () => createNodeMaterial(model.palette.lights.rim, model.theme === 'dark' ? 0.38 : 0.18),
    [model],
  );

  const batches = useMemo<ShapeBatch[]>(() => {
    const byShape = new Map<TraceShape, number[]>();
    model.slots.forEach((slot, i) => {
      const list = byShape.get(slot.shape) ?? [];
      list.push(i);
      byShape.set(slot.shape, list);
    });
    return [...byShape.entries()].map(([shape, slots]) => {
      const geometry = geometryFor(shape, sphereSegments);
      const fx = new InstancedBufferAttribute(new Float32Array(slots.length * 2), 2);
      fx.setUsage(DynamicDrawUsage);
      geometry.setAttribute('aFx', fx);
      const mesh = new InstancedMesh(geometry, material, slots.length);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < slots.length; i++) {
        mesh.setMatrixAt(i, HIDDEN);
        mesh.setColorAt(i, material.color);
      }
      return { shape, slots, mesh, fx };
    });
  }, [model, material, sphereSegments]);

  useEffect(() => {
    for (const b of batches) {
      b.mesh.castShadow = shadows;
      b.mesh.receiveShadow = shadows;
    }
  }, [batches, shadows]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        for (const b of batches) {
          const { mesh, fx, slots } = b;
          const colors = mesh.instanceColor!.array as Float32Array;
          const fxa = fx.array as Float32Array;
          for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const presence = sample.presence[s];
            if (presence <= 0.001) {
              mesh.setMatrixAt(i, HIDDEN);
              continue;
            }
            _p.set(sample.pos[s * 3], sample.pos[s * 3 + 1], sample.pos[s * 3 + 2]);
            _q.setFromAxisAngle(_axis, sample.tilt[s]);
            _s.set(sample.dims[s * 3] * presence, sample.dims[s * 3 + 1] * presence, sample.dims[s * 3 + 2] * presence);
            _m.compose(_p, _q, _s);
            mesh.setMatrixAt(i, _m);
            colors[i * 3] = sample.color[s * 3];
            colors[i * 3 + 1] = sample.color[s * 3 + 1];
            colors[i * 3 + 2] = sample.color[s * 3 + 2];
            fxa[i * 2] = sample.glow[s];
            fxa[i * 2 + 1] = sample.finish[s];
          }
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor!.needsUpdate = true;
          fx.needsUpdate = true;
        }
      }),
    [batches, driver],
  );

  useEffect(
    () => () => {
      for (const b of batches) {
        b.mesh.geometry.dispose();
        b.mesh.dispose();
      }
    },
    [batches],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      {batches.map((b) => (
        <primitive key={b.shape} object={b.mesh} />
      ))}
    </>
  );
}

import React, { useEffect, useMemo } from 'react';
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { MAX_DECALS } from '../model/sampler';
import { createDecalMaterial } from '../look/materials';
import type { StageDriver } from './driver';

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _q = new Quaternion();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/** Footprints, regions, halos, ripples and cursors: one instanced draw on the floor. */
export function FloorDecals({ driver, floorY }: { driver: StageDriver; floorY: number }) {
  const parts = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const color = new InstancedBufferAttribute(new Float32Array(MAX_DECALS * 4), 4);
    const shape = new InstancedBufferAttribute(new Float32Array(MAX_DECALS * 3), 3);
    color.setUsage(DynamicDrawUsage);
    shape.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aColor', color);
    geometry.setAttribute('aShape', shape);
    const material = createDecalMaterial();
    const mesh = new InstancedMesh(geometry, material, MAX_DECALS);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    for (let i = 0; i < MAX_DECALS; i++) mesh.setMatrixAt(i, HIDDEN);
    return { mesh, color, shape, material, geometry };
  }, []);

  useEffect(
    () =>
      driver.register((sample) => {
        const { mesh, color, shape } = parts;
        const ca = color.array as Float32Array;
        const sa = shape.array as Float32Array;
        // Draw lower layers first so footprints sit under regions under halos.
        let written = 0;
        for (let layer = 0; layer <= 9; layer++) {
          for (let i = 0; i < sample.decalCount; i++) {
            if (Math.min(9, sample.decal[i * 6 + 5]) !== layer) continue;
            const w = Math.max(0.01, sample.decal[i * 6 + 2]);
            const kind = sample.decal[i * 6 + 4];
            const d = kind >= 3 && kind <= 5 ? w : Math.max(0.01, sample.decal[i * 6 + 3]);
            _p.set(sample.decal[i * 6], floorY + 0.004 + layer * 0.0016, sample.decal[i * 6 + 1]);
            _s.set(w, 1, d);
            _m.compose(_p, _q, _s);
            mesh.setMatrixAt(written, _m);
            ca[written * 4] = sample.decalColor[i * 4];
            ca[written * 4 + 1] = sample.decalColor[i * 4 + 1];
            ca[written * 4 + 2] = sample.decalColor[i * 4 + 2];
            ca[written * 4 + 3] = sample.decalColor[i * 4 + 3];
            sa[written * 3] = kind;
            sa[written * 3 + 1] = w;
            sa[written * 3 + 2] = d;
            written++;
          }
        }
        for (let i = written; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
        mesh.instanceMatrix.needsUpdate = true;
        color.needsUpdate = true;
        shape.needsUpdate = true;
      }),
    [driver, parts, floorY],
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

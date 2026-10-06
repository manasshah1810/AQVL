import React, { useEffect, useMemo } from 'react';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { StageModel } from '../model/StageModel';
import { MAX_PULSES, type StageSample } from '../model/sampler';
import { createEdgeMaterial, createPulseMaterial } from '../look/materials';
import type { StageDriver } from './driver';
import { NO_SHADOW_LAYER } from './StageEnvironment';

/** Segments per edge: enough for the curved pointer routes to read as smooth. */
const SEGMENTS = 14;

const _m = new Matrix4();
const _q = new Quaternion();
const _a = new Vector3();
const _b = new Vector3();
const _mid = new Vector3();
const _dir = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _white = new Color(1, 1, 1);
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

function point(sample: StageSample, e: number, q: number, into: Vector3): Vector3 {
  const i = e * 3;
  const a = (1 - q) * (1 - q);
  const b = 2 * (1 - q) * q;
  const c = q * q;
  return into.set(
    a * sample.edgeP0[i] + b * sample.edgeCtrl[i] + c * sample.edgeP1[i],
    a * sample.edgeP0[i + 1] + b * sample.edgeCtrl[i + 1] + c * sample.edgeP1[i + 1],
    a * sample.edgeP0[i + 2] + b * sample.edgeCtrl[i + 2] + c * sample.edgeP1[i + 2],
  );
}

/**
 * Edges as lit rods (instanced cylinder segments along each edge's curve),
 * arrowheads for directed edges, and the small dot that travels along an
 * edge when a step uses it.
 */
export function EdgeRods({ model, driver }: { model: StageModel; driver: StageDriver }) {
  const E = model.edgeSlots.length;
  const parts = useMemo(() => {
    const rodMaterial = createEdgeMaterial(model.world === 'ocean');
    const rods = new InstancedMesh(new CylinderGeometry(1, 1, 1, 10, 1, true), rodMaterial, Math.max(1, E * SEGMENTS));
    const heads = new InstancedMesh(new ConeGeometry(1, 1, 18), rodMaterial, Math.max(1, E));
    const pulseMaterial = createPulseMaterial();
    const pulses = new InstancedMesh(new SphereGeometry(1, 16, 12), pulseMaterial, MAX_PULSES);
    for (const mesh of [rods, heads, pulses]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, HIDDEN);
        mesh.setColorAt(i, _white);
      }
    }
    pulses.renderOrder = 5;
    pulses.layers.set(NO_SHADOW_LAYER);
    return { rods, heads, pulses, rodMaterial, pulseMaterial };
  }, [E, model.world]);

  useEffect(
    () =>
      driver.register((sample) => {
        const { rods, heads, pulses } = parts;
        const rodColor = rods.instanceColor!.array as Float32Array;
        const headColor = heads.instanceColor!.array as Float32Array;
        for (let e = 0; e < E; e++) {
          const vis = sample.edgeVisible[e];
          const base = e * SEGMENTS;
          if (vis <= 0.002) {
            for (let k = 0; k < SEGMENTS; k++) rods.setMatrixAt(base + k, HIDDEN);
            heads.setMatrixAt(e, HIDDEN);
            continue;
          }
          const r = sample.edgeWidth[e];
          const cr = sample.edgeColor[e * 3];
          const cg = sample.edgeColor[e * 3 + 1];
          const cb = sample.edgeColor[e * 3 + 2];
          const arrow = sample.edgeArrow[e] === 1;
          // Stop the shaft where the arrowhead begins.
          const end = vis * (arrow ? 0.94 : 1);
          for (let k = 0; k < SEGMENTS; k++) {
            const q0 = (k / SEGMENTS) * end;
            const q1 = ((k + 1) / SEGMENTS) * end;
            point(sample, e, q0, _a);
            point(sample, e, q1, _b);
            _dir.subVectors(_b, _a);
            const len = _dir.length();
            if (len < 1e-5) {
              rods.setMatrixAt(base + k, HIDDEN);
              continue;
            }
            _mid.addVectors(_a, _b).multiplyScalar(0.5);
            _q.setFromUnitVectors(_up, _dir.multiplyScalar(1 / len));
            _s.set(r, len * 1.02, r);
            _m.compose(_mid, _q, _s);
            rods.setMatrixAt(base + k, _m);
            const ci = (base + k) * 3;
            rodColor[ci] = cr;
            rodColor[ci + 1] = cg;
            rodColor[ci + 2] = cb;
          }
          if (arrow && vis > 0.6) {
            point(sample, e, vis * 0.94, _a);
            point(sample, e, vis, _b);
            _dir.subVectors(_b, _a).normalize();
            const size = 0.13 + r * 1.6;
            _mid.copy(_a).addScaledVector(_dir, size * 0.5);
            _q.setFromUnitVectors(_up, _dir);
            const grow = Math.min(1, (vis - 0.6) / 0.3);
            _s.set(size * 0.62 * grow, size * grow * 1.15, size * 0.62 * grow);
            _m.compose(_mid, _q, _s);
            heads.setMatrixAt(e, _m);
            headColor[e * 3] = cr;
            headColor[e * 3 + 1] = cg;
            headColor[e * 3 + 2] = cb;
          } else {
            heads.setMatrixAt(e, HIDDEN);
          }
        }
        rods.instanceMatrix.needsUpdate = true;
        rods.instanceColor!.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        heads.instanceColor!.needsUpdate = true;

        const pulseColor = pulses.instanceColor!.array as Float32Array;
        for (let j = 0; j < MAX_PULSES; j++) {
          if (j >= sample.pulseCount) {
            pulses.setMatrixAt(j, HIDDEN);
            continue;
          }
          const size = sample.pulse[j * 4 + 3];
          _mid.set(sample.pulse[j * 4], sample.pulse[j * 4 + 1], sample.pulse[j * 4 + 2]);
          _s.set(size, size, size);
          _m.compose(_mid, _q.identity(), _s);
          pulses.setMatrixAt(j, _m);
          pulseColor[j * 3] = sample.pulseColor[j * 3];
          pulseColor[j * 3 + 1] = sample.pulseColor[j * 3 + 1];
          pulseColor[j * 3 + 2] = sample.pulseColor[j * 3 + 2];
        }
        pulses.instanceMatrix.needsUpdate = true;
        pulses.instanceColor!.needsUpdate = true;
      }),
    [driver, parts, E, model],
  );

  useEffect(
    () => () => {
      parts.rods.geometry.dispose();
      parts.heads.geometry.dispose();
      parts.pulses.geometry.dispose();
      parts.rodMaterial.dispose();
      parts.pulseMaterial.dispose();
      parts.rods.dispose();
      parts.heads.dispose();
      parts.pulses.dispose();
    },
    [parts],
  );

  return (
    <>
      <primitive object={parts.rods} />
      <primitive object={parts.heads} />
      <primitive object={parts.pulses} />
    </>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  Group,
  type BufferGeometry,
  type MeshPhysicalMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TraceShape } from '@aqvl/runtime';
import type { StageModel } from '../model/StageModel';
import type { StageSample } from '../model/sampler';
import { createNodeMaterial } from '../look/materials';
import { STATE_TREATMENTS } from '../look/treatments';
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
  return new RoundedBoxGeometry(1, 1, 1, 5, 0.15);
}

/**
 * Every node body, one instanced mesh per shape: one draw call per shape
 * however long the array or big the tree.
 */
export function NodeBodies({ model, driver, sphereSegments }: { model: StageModel; driver: StageDriver; sphereSegments: number }) {
  const finish = model.world === 'penguin' ? 'ice' : model.world === 'panda' ? 'bamboo' : 'porcelain';
  const material = useMemo<MeshPhysicalMaterial>(() => createNodeMaterial(finish), [finish]);
  const invalidate = useThree((s) => s.invalidate);
  // Hover: the node under the pointer brightens a touch, and a small tag says what it is.
  const hovered = useRef(-1);
  const step = useRef(0);
  const tagAnchor = useMemo(() => new Group(), []);
  const [tag, setTag] = useState<{ slot: number; text: string } | null>(null);
  const describe = (slot: number): string => {
    const rest = model.rest(step.current);
    if (!rest.present[slot]) return '';
    const where = model.slots[slot].structure;
    const caption = rest.caption[slot];
    const name = where ? (/^\d+$/.test(caption) ? `${where}[${caption}]` : where) : caption || 'node';
    const value = rest.text[slot];
    return `${name}${value !== '' ? ` = ${value}` : ''} · ${STATE_TREATMENTS[rest.state[slot]].word}`;
  };
  const hover = (slot: number) => {
    if (hovered.current === slot) return;
    hovered.current = slot;
    const text = slot >= 0 ? describe(slot) : '';
    setTag(slot >= 0 && text ? { slot, text } : null);
    if (typeof document !== 'undefined') document.body.style.cursor = slot >= 0 ? 'pointer' : '';
    invalidate();
  };
  useEffect(() => () => {
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  }, []);

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

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const h = hovered.current;
        if (sample.k !== step.current) {
          step.current = sample.k;
          // The step moved on under the pointer: say what the node is now.
          if (h >= 0) {
            const text = describe(h);
            queueMicrotask(() => setTag(text ? { slot: h, text } : null));
          }
        }
        if (h >= 0 && sample.presence[h] > 0.001) {
          tagAnchor.position.set(sample.pos[h * 3], sample.pos[h * 3 + 1] + sample.dims[h * 3 + 1] / 2 + 0.12, sample.pos[h * 3 + 2]);
        }
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
            // Hover: a gentle brightening (shape untouched, so printed values stay exactly on the face).
            fxa[i * 2] = sample.glow[s] + (s === h ? 0.12 : 0);
            fxa[i * 2 + 1] = sample.finish[s];
          }
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor!.needsUpdate = true;
          fx.needsUpdate = true;
          // Instances move every frame: let the pointer's raycast recompute where they are.
          mesh.boundingSphere = null;
        }
      }),
    [batches, driver, tagAnchor],
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

  const palette = model.palette;
  return (
    <>
      {batches.map((b) => (
        <primitive
          key={b.shape}
          object={b.mesh}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (e.instanceId !== undefined) hover(b.slots[e.instanceId]);
          }}
          onPointerOut={() => hover(-1)}
        />
      ))}
      <primitive object={tagAnchor}>
        {tag && (
          <Html center position={[0, 0.34, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
            <div
              role="tooltip"
              style={{
                whiteSpace: 'nowrap',
                font: '500 12px/1.2 "JetBrains Mono", ui-monospace, monospace',
                padding: '5px 9px',
                borderRadius: 7,
                background: palette.frame,
                color: palette.frameText,
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                transform: 'translateY(-50%)',
              }}
            >
              {tag.text}
            </div>
          </Html>
        )}
      </primitive>
    </>
  );
}

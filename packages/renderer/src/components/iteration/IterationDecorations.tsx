import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneElement } from '@aqvl/runtime';
import type { IterationOverlayState } from './IterationDirector';
import { IterationCursor } from './IterationCursor';
import { SortedRegionIndicator } from '../array/SortedRegionIndicator';
import { getIterationTreatment, iterationStateFor } from './iterationStates';
import type { RenderableElement, Vec3 } from '../generic/types';

const LIFT_LERP_RATE = 9;

function positionOf(elements: SceneElement[], structureId: string, index: number): Vec3 | null {
  const el = elements.find((e) => (e as any).logicalParent === structureId && (e as any).logicalIndex === index);
  return el ? el.position : null;
}

/**
 * Applies the iteration state table (iterationStates.ts) to an array cell: the
 * shared-token colour, dimming and scale, plus the lift (returned separately so
 * `LiftGroup` can ease it in rather than snapping).
 */
export function applyIterationTreatment(
  node: RenderableElement,
  el: SceneElement,
  overlay: IterationOverlayState
): { node: RenderableElement; liftY: number } {
  const structureId = (el as any).logicalParent;
  const index = (el as any).logicalIndex;
  if (typeof index !== 'number' || !structureId) return { node, liftY: 0 };
  const underCursor = overlay.cursors.some((c) => c.structureId === structureId && c.index === index);
  const treatment = getIterationTreatment(iterationStateFor(el.state, underCursor));
  const scale = node.scale ?? { x: 1, y: 1, z: 1 };
  return {
    node: {
      ...node,
      color: treatment.color,
      emissiveColor: treatment.emissiveColor,
      emissiveIntensity: treatment.emissiveIntensity,
      opacity: treatment.opacity,
      scale: { x: scale.x * treatment.scale, y: scale.y * treatment.scale, z: scale.z * treatment.scale },
    },
    liftY: treatment.liftY,
  };
}

/** Eases its children up/down by `liftY` — the cell rises under the cursor instead of teleporting. */
export const LiftGroup: React.FC<{ liftY: number; children: React.ReactNode }> = ({ liftY, children }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_s, delta) => {
    if (!ref.current) return;
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, liftY, Math.min(1, delta * LIFT_LERP_RATE));
  });
  return <group ref={ref}>{children}</group>;
};

/** Loop cursors and the binary-search window band. */
export const IterationDecorations: React.FC<{ elements: SceneElement[]; overlay: IterationOverlayState }> = ({ elements, overlay }) => (
  <>
    {overlay.windows.map((w) => {
      const start = positionOf(elements, w.structureId, w.startIndex);
      const end = positionOf(elements, w.structureId, w.endIndex);
      if (!start || !end) return null;
      return (
        <SortedRegionIndicator
          key={`window-${w.structureId}`}
          startPosition={start}
          endPosition={end}
          variant="band"
          tone="AUXILIARY"
          label={w.label}
        />
      );
    })}
    {overlay.cursors.map((c) => {
      const at = positionOf(elements, c.structureId, c.index);
      if (!at) return null;
      return <IterationCursor key={`cursor-${c.depth}`} position={at} depth={c.depth} label={c.label} />;
    })}
  </>
);

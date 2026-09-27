import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneElement } from '@aqvl/runtime';
import type { RenderableElement } from '../generic/types';
import type { LinearActiveEnd, LinearOverlayState } from './LinearDirector';
import { getLinearTreatment, linearRoleAccent } from './linearStates';

const FOLLOW_RATE = 10;

/**
 * Applies the linear role table (linearStates.ts) to a stack item / queue
 * item / list node. Scale and opacity MULTIPLY the runtime's own (animated)
 * values, so a popped item's fade and shrink still play out under the
 * 'removed' tint. The lift is returned separately for `LiftGroup` to ease in.
 */
export function applyLinearTreatment(
  node: RenderableElement,
  el: SceneElement,
  overlay: LinearOverlayState
): { node: RenderableElement; liftY: number } {
  const role = overlay.roles[el.id];
  if (!role || role === 'default') return { node, liftY: 0 };
  const treatment = getLinearTreatment(role);
  const scale = node.scale ?? { x: 1, y: 1, z: 1 };
  // A PEEK / FRONT read keeps the runtime's amber "being read" colour.
  const keepsRuntimeColour = el.state === 'EVALUATING' && (role === 'top' || role === 'front');
  return {
    node: {
      ...node,
      ...(keepsRuntimeColour
        ? {}
        : { color: treatment.color, emissiveColor: treatment.emissiveColor, emissiveIntensity: treatment.emissiveIntensity }),
      opacity: Math.min(node.opacity ?? 1, treatment.opacity),
      scale: { x: scale.x * treatment.scale, y: scale.y * treatment.scale, z: scale.z * treatment.scale },
    },
    liftY: treatment.liftY,
  };
}

/**
 * Marks where the next operation happens: beside a stack's top ("next POP"),
 * under a queue's front ("next out"), under the list node a traversal
 * pointer is on. It glides after the element as the structure changes, so
 * the eye follows the active end rather than re-finding it.
 */
export const ActiveEndMarker: React.FC<{ end: LinearActiveEnd; element: SceneElement }> = ({ end, element }) => {
  const group = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const beside = end.kind === 'STACK';
  const accent = linearRoleAccent(end.role);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const p = element.position;
    const bob = Math.sin(state.clock.getElapsedTime() * 3) * 0.06;
    const target = beside ? new THREE.Vector3(p.x + 1.05 + bob, p.y, p.z) : new THREE.Vector3(p.x, p.y - 1.05 - bob, p.z);
    if (!placed.current) {
      g.position.copy(target);
      placed.current = true;
    } else {
      g.position.lerp(target, Math.min(1, delta * FOLLOW_RATE));
    }
  });

  return (
    <group ref={group}>
      {/* Chevron pointing at the element: left for a stack's side marker, up for the others. */}
      <mesh rotation={[0, 0, beside ? Math.PI / 2 : 0]}>
        <coneGeometry args={[0.16, 0.32, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
      </mesh>
      <Text
        position={beside ? [0.3, 0, 0] : [0, -0.36, 0]}
        fontSize={0.24}
        color={accent}
        outlineWidth={0.02}
        outlineColor="#0b1120"
        anchorX={beside ? 'left' : 'center'}
        anchorY={beside ? 'middle' : 'top'}
      >
        {end.label}
      </Text>
    </group>
  );
};

export const LinearDecorations: React.FC<{ elements: Map<string, SceneElement>; overlay: LinearOverlayState }> = ({ elements, overlay }) => (
  <>
    {overlay.ends.map((end) => {
      const element = elements.get(end.elementId);
      if (!element) return null;
      return <ActiveEndMarker key={`end-${end.structureId}-${end.kind}`} end={end} element={element} />;
    })}
  </>
);

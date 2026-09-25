import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getUnifiedMaterialConfig } from '@aqvl/shared';
import { Vec3 } from '../generic/types';

export interface SortedRegionIndicatorProps {
  /** Live position of the array element at the sorted region's start index. */
  startPosition: Vec3;
  /** Live position of the array element at the sorted region's end index. */
  endPosition: Vec3;
}

const STRIP_Y_OFFSET = -0.52;
const STRIP_DEPTH = 0.15;
const STRIP_HEIGHT = 0.03;
const EDGE_MARGIN = 0.5;
const LERP_RATE = 4;

/**
 * Renders the sorted-region progress marker (array-visual-language-spec.md §4.3): a thin
 * glowing SUCCESS-green floor strip spanning the confirmed-sorted elements. Both edges ease
 * toward their target position every frame (rather than snapping) so growth reads as a
 * continuous progress bar — this also means the strip works whether the confirmed region
 * grows left-to-right, right-to-left, or (as for bubble sort) shrinks from one end while
 * held fixed at the other, since both edges are driven independently off live element
 * positions rather than a single "just append" assumption.
 */
export const SortedRegionIndicator: React.FC<SortedRegionIndicatorProps> = ({
  startPosition,
  endPosition,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentLeft = useRef<number | null>(null);
  const currentRight = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);
  const currentZ = useRef<number | null>(null);

  const targetLeft = Math.min(startPosition.x, endPosition.x) - EDGE_MARGIN;
  const targetRight = Math.max(startPosition.x, endPosition.x) + EDGE_MARGIN;
  const targetY = startPosition.y + STRIP_Y_OFFSET;
  const targetZ = startPosition.z;

  const matConfig = getUnifiedMaterialConfig({ category: 'EDGE', state: 'SUCCESS', opacity: 0.9 });
  const color = `#${matConfig.color.getHexString()}`;
  const emissiveColor = `#${matConfig.emissive.getHexString()}`;

  useFrame((_state, delta) => {
    if (currentLeft.current === null) currentLeft.current = targetLeft;
    if (currentRight.current === null) currentRight.current = targetRight;
    if (currentY.current === null) currentY.current = targetY;
    if (currentZ.current === null) currentZ.current = targetZ;

    const t = Math.min(1, delta * LERP_RATE);
    currentLeft.current = THREE.MathUtils.lerp(currentLeft.current, targetLeft, t);
    currentRight.current = THREE.MathUtils.lerp(currentRight.current, targetRight, t);
    currentY.current = THREE.MathUtils.lerp(currentY.current, targetY, t);
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ, t);

    const width = Math.max(0.001, currentRight.current - currentLeft.current);
    const centerX = (currentLeft.current + currentRight.current) / 2;

    if (meshRef.current) {
      meshRef.current.position.set(centerX, currentY.current, currentZ.current);
      meshRef.current.scale.set(width, 1, 1);
    }
  });

  return (
    // No castShadow/receiveShadow — an informational floor strip, not scene geometry.
    // depthWrite disabled for the same reason as PartitionBoundary's planes: correct
    // translucent compositing regardless of draw order relative to the array elements above it.
    <mesh ref={meshRef} position={[(targetLeft + targetRight) / 2, targetY, targetZ]} renderOrder={1}>
      <boxGeometry args={[1, STRIP_HEIGHT, STRIP_DEPTH]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.8}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </mesh>
  );
};

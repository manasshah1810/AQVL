import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { getUnifiedMaterialConfig } from '@aqvl/shared';
import { Vec3 } from '../generic/types';

/**
 * 'strip' (default): Sorting's thin floor progress strip — unchanged.
 * 'band': a wider translucent slab under a live index range, for regions that
 * shrink rather than grow (binary search's [low .. high] window).
 */
export type RegionIndicatorVariant = 'strip' | 'band';

export interface SortedRegionIndicatorProps {
  /** Live position of the array element at the sorted region's start index. */
  startPosition: Vec3;
  /** Live position of the array element at the sorted region's end index. */
  endPosition: Vec3;
  /** Defaults to 'strip', Sorting's original look. */
  variant?: RegionIndicatorVariant;
  /** Semantic palette state for the colour. Defaults to 'SUCCESS' (sorted = green). */
  tone?: string;
  /** Optional caption under the region (e.g. "low = 2 … high = 5"). */
  label?: string;
}

const VARIANT_GEOMETRY: Record<RegionIndicatorVariant, { yOffset: number; depth: number; height: number; margin: number; opacity: number; emissive: number }> = {
  strip: { yOffset: -0.52, depth: 0.15, height: 0.03, margin: 0.5, opacity: 0.9, emissive: 0.8 },
  band: { yOffset: -0.56, depth: 1.5, height: 0.06, margin: 0.62, opacity: 0.35, emissive: 1.1 },
};

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
  variant = 'strip',
  tone = 'SUCCESS',
  label,
}) => {
  const geometry = VARIANT_GEOMETRY[variant];
  const labelRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const currentLeft = useRef<number | null>(null);
  const currentRight = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);
  const currentZ = useRef<number | null>(null);

  const targetLeft = Math.min(startPosition.x, endPosition.x) - geometry.margin;
  const targetRight = Math.max(startPosition.x, endPosition.x) + geometry.margin;
  const targetY = startPosition.y + geometry.yOffset;
  const targetZ = startPosition.z;

  const matConfig = getUnifiedMaterialConfig({ category: 'EDGE', state: tone, opacity: geometry.opacity });
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
    if (labelRef.current) {
      labelRef.current.position.set(centerX, currentY.current - 0.32, currentZ.current + geometry.depth / 2);
    }
  });

  return (
    // No castShadow/receiveShadow — an informational floor strip, not scene geometry.
    // depthWrite disabled for the same reason as PartitionBoundary's planes: correct
    // translucent compositing regardless of draw order relative to the array elements above it.
    <>
      <mesh ref={meshRef} position={[(targetLeft + targetRight) / 2, targetY, targetZ]} renderOrder={1}>
        <boxGeometry args={[1, geometry.height, geometry.depth]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={geometry.emissive}
          transparent
          opacity={geometry.opacity}
          depthWrite={false}
        />
      </mesh>
      {label && (
        <group ref={labelRef} position={[(targetLeft + targetRight) / 2, targetY - 0.32, targetZ + geometry.depth / 2]}>
          <Text fontSize={0.26} color={color} outlineWidth={0.015} outlineColor="#0b1120" anchorX="center" anchorY="middle">
            {label}
          </Text>
        </group>
      )}
    </>
  );
};

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getUnifiedMaterialConfig } from '@aqvl/shared';
import { Vec3 } from '../generic/types';

export interface PartitionBoundaryProps {
  /** Live position of the array element currently at the partition's start index. */
  startPosition: Vec3;
  /** Live position of the array element currently at the partition's end index. */
  endPosition: Vec3;
  /**
   * Nesting depth within the same structure's boundary stack (0 = outermost). Recursive
   * algorithms like quick sort can have several boundaries active at once — deeper levels
   * render shorter and more opaque so nested partitions read as distinct layers rather than
   * merging into one plane (array-visual-language-spec.md §4.2).
   */
  depth?: number;
  /** Optional label rendered above the boundary, e.g. a recursion call's name. */
  label?: string;
}

const BASE_HEIGHT = 2.2;
const HEIGHT_STEP_PER_DEPTH = 0.35;
const MIN_HEIGHT = 0.6;
const BASE_OPACITY = 0.3;
const OPACITY_STEP_PER_DEPTH = 0.12;
const MAX_OPACITY = 0.75;
const EDGE_MARGIN = 0.55;
const LERP_RATE = 6;

function heightForDepth(depth: number): number {
  return Math.max(MIN_HEIGHT, BASE_HEIGHT - depth * HEIGHT_STEP_PER_DEPTH);
}

function opacityForDepth(depth: number): number {
  return Math.min(MAX_OPACITY, BASE_OPACITY + depth * OPACITY_STEP_PER_DEPTH);
}

const BoundaryPlane: React.FC<{ targetX: number; y: number; z: number; height: number; opacity: number; color: string; emissiveColor: string; emissiveIntensity: number }> = ({
  targetX,
  y,
  z,
  height,
  opacity,
  color,
  emissiveColor,
  emissiveIntensity,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentX = useRef<number | null>(null);

  useFrame((_state, delta) => {
    if (currentX.current === null) currentX.current = targetX;
    currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, Math.min(1, delta * LERP_RATE));
    if (meshRef.current) {
      meshRef.current.position.set(currentX.current, y, z);
    }
  });

  return (
    // castShadow/receiveShadow intentionally omitted (defaults to false): this is an
    // informational overlay, not scene geometry, and should never participate in shadowing.
    // depthWrite disabled so this translucent plane composites correctly over/under array
    // elements regardless of draw order, rather than occasionally z-fighting or incorrectly
    // occluding a box behind it (docs/design/array-visual-polish-notes.md).
    <mesh ref={meshRef} position={[targetX, y, z]} renderOrder={1}>
      <planeGeometry args={[0.12, height]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

/**
 * Renders the partition boundary indicator (array-visual-language-spec.md §4.2): a pair of
 * translucent violet (AUXILIARY) vertical planes bracketing the active partition, positioned
 * off the live positions of its start/end elements (not fixed pixel bounds) so the markers
 * track the array whenever the layout engine repositions elements. The planes slide smoothly
 * to a new position rather than jump-cutting when the partition narrows.
 */
export const PartitionBoundary: React.FC<PartitionBoundaryProps> = ({
  startPosition,
  endPosition,
  depth = 0,
  label,
}) => {
  const matConfig = getUnifiedMaterialConfig({ category: 'CONTAINER', state: 'AUXILIARY' });
  const color = `#${matConfig.color.getHexString()}`;
  const emissiveColor = `#${matConfig.emissive.getHexString()}`;
  const opacity = opacityForDepth(depth);
  const height = heightForDepth(depth);
  const y = startPosition.y;
  const z = startPosition.z;

  const leftX = Math.min(startPosition.x, endPosition.x) - EDGE_MARGIN;
  const rightX = Math.max(startPosition.x, endPosition.x) + EDGE_MARGIN;

  return (
    <group>
      <BoundaryPlane
        targetX={leftX}
        y={y}
        z={z}
        height={height}
        opacity={opacity}
        color={color}
        emissiveColor={emissiveColor}
        emissiveIntensity={matConfig.emissiveIntensity}
      />
      <BoundaryPlane
        targetX={rightX}
        y={y}
        z={z}
        height={height}
        opacity={opacity}
        color={color}
        emissiveColor={emissiveColor}
        emissiveIntensity={matConfig.emissiveIntensity}
      />
      {label && (
        <Text
          position={[(leftX + rightX) / 2, y + height / 2 + 0.3, z]}
          fontSize={0.28}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  );
};

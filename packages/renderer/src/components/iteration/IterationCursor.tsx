import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getNestingDepthToken } from '@aqvl/shared';
import { Vec3 } from '../generic/types';

export interface IterationCursorProps {
  /** Live position of the cell the loop is on. */
  position: Vec3;
  /** Loop nesting depth (0 = outermost): picks colour and float height from NESTING_DEPTH_TOKENS. */
  depth: number;
  /** e.g. "i = 3". */
  label: string;
}

const LERP_RATE = 10;
const BOB_AMPLITUDE = 0.06;
const BOB_HZ = 1.4;

/**
 * A loop's "you are here" marker: a downward chevron floating over the current
 * cell with the counter's name and value. It glides from cell to cell (never
 * jump-cuts) so each pass of the loop reads as one step of a sweep. Nested
 * loops stack: the outer loop's cursor floats highest, each inner loop's sits
 * lower and in its own colour, so "i" and "j" can never be confused.
 */
export const IterationCursor: React.FC<IterationCursorProps> = ({ position, depth, label }) => {
  const token = getNestingDepthToken(depth);
  const groupRef = useRef<THREE.Group>(null);
  const current = useRef<THREE.Vector3 | null>(null);

  useFrame((state, delta) => {
    const target = new THREE.Vector3(position.x, position.y + token.cursorHeight, position.z);
    if (!current.current) current.current = target.clone();
    current.current.lerp(target, Math.min(1, delta * LERP_RATE));
    const bob = Math.sin(state.clock.getElapsedTime() * Math.PI * 2 * BOB_HZ + depth) * BOB_AMPLITUDE;
    groupRef.current?.position.set(current.current.x, current.current.y + bob, current.current.z);
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + token.cursorHeight, position.z]}>
      {/* Chevron pointing down at the cell. */}
      <mesh rotation={[Math.PI, 0, 0]} renderOrder={2}>
        <coneGeometry args={[0.2, 0.34, 4]} />
        <meshStandardMaterial color={token.color} emissive={token.emissiveColor} emissiveIntensity={1.2} />
      </mesh>
      <Text
        position={[0, 0.38, 0]}
        fontSize={0.28}
        color={token.color}
        outlineWidth={0.02}
        outlineColor="#0b1120"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
};

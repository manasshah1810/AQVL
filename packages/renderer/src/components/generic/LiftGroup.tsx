import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const LIFT_LERP_RATE = 9;

/** Eases its children up/down by `liftY` — the cell rises under the cursor instead of teleporting. */
export const LiftGroup: React.FC<{ liftY: number; children: React.ReactNode }> = ({ liftY, children }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_s, delta) => {
    if (!ref.current) return;
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, liftY, Math.min(1, delta * LIFT_LERP_RATE));
  });
  return <group ref={ref}>{children}</group>;
};

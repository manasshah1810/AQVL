import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Torus } from '@react-three/drei';
import {
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import * as THREE from 'three';

export interface HighlightRingProps {
  type: 'box' | 'sphere' | 'cylinder';
  color: string;
  emissiveColor: string;
  opacity: number; // 0.0 to 1.0
  scaleFactor?: number;
}

export const HighlightRing: React.FC<HighlightRingProps> = ({
  type,
  color,
  emissiveColor,
  opacity,
  scaleFactor = 1.0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const initialMatConfig = getUnifiedMaterialConfig({
    category: 'RING',
    color,
    emissiveColor,
    opacity,
  });

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Subtle breathing/pulsing animation for sphere halo
    const pulse = Math.sin(time * 5.0) * 0.05 + 1.0;
    const currentScale = scaleFactor * pulse;
    groupRef.current.scale.set(currentScale, currentScale, currentScale);

    if (type === 'sphere') {
      groupRef.current.rotation.z = time * 0.5;
      groupRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
    }

    if (materialRef.current) {
      const matConfig = getUnifiedMaterialConfig({
        category: 'RING',
        color,
        emissiveColor,
        opacity,
        time,
      });

      applyUnifiedMaterial(materialRef.current, matConfig);
    }
  });

  // Remove skeleton box around box elements during operations
  if (type === 'box' || opacity <= 0.001) return null;

  return (
    <group ref={groupRef}>
      <Torus args={[0.75, 0.04, 16, 48]}>
        <meshStandardMaterial
          ref={materialRef}
          color={initialMatConfig.color}
          emissive={initialMatConfig.emissive}
          emissiveIntensity={initialMatConfig.emissiveIntensity}
          roughness={MATERIAL_PRESETS.RING.roughness}
          metalness={MATERIAL_PRESETS.RING.metalness}
          transparent
          opacity={opacity}
        />
      </Torus>
    </group>
  );
};

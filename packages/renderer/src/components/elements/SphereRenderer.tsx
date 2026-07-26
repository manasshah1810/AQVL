import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Sphere } from '@react-three/drei';
import { SceneElement } from '@aqvl/runtime';
import {
  isElementActive,
  getHighlightAccentColor,
  getHighlightConfig,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import { HighlightRing } from './HighlightRing';
import * as THREE from 'three';

export interface SphereRendererProps {
  element: SceneElement;
}

export const SphereRenderer: React.FC<SphereRendererProps> = ({ element }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const highlightProgress = useRef<number>(0);
  const [ringOpacity, setRingOpacity] = useState<number>(0);

  const initialMatConfig = getUnifiedMaterialConfig({
    category: 'NODE',
    state: element.state,
    color: element.color,
    emissiveColor: element.emissiveColor,
    emissiveIntensity: element.emissiveIntensity,
    opacity: element.opacity,
    highlightProgress: 0,
  });

  useFrame((state, delta) => {
    const active = isElementActive(element);
    const highlightAccent = getHighlightAccentColor(element);
    const highlightConfig = getHighlightConfig(element);
    const time = state.clock.getElapsedTime();

    // Smoothly animate highlightProgress between 0.0 (inactive) and 1.0 (active)
    const targetProgress = active ? 1.0 : 0.0;
    highlightProgress.current = THREE.MathUtils.lerp(
      highlightProgress.current,
      targetProgress,
      Math.min(1.0, delta * 12)
    );

    const currentProgress = highlightProgress.current;

    // Update ring opacity state for R3F re-render when visible
    if (Math.abs(ringOpacity - currentProgress * highlightConfig.ringOpacity) > 0.02) {
      setRingOpacity(currentProgress * highlightConfig.ringOpacity);
    }

    if (groupRef.current) {
      if (element.position) {
        groupRef.current.position.set(element.position.x, element.position.y, element.position.z);
      }

      // Calculate smooth scale boost (+18% at full active highlight)
      const scaleBoost = 1.0 + (highlightConfig.scaleMultiplier - 1.0) * currentProgress;
      const baseScaleX = element.scale?.x ?? 1;
      const baseScaleY = element.scale?.y ?? 1;
      const baseScaleZ = element.scale?.z ?? 1;

      groupRef.current.scale.set(
        baseScaleX * scaleBoost,
        baseScaleY * scaleBoost,
        baseScaleZ * scaleBoost
      );
    }

    if (materialRef.current) {
      const matConfig = getUnifiedMaterialConfig({
        category: 'NODE',
        state: element.state,
        color: element.color,
        emissiveColor: element.emissiveColor,
        emissiveIntensity: element.emissiveIntensity,
        opacity: element.opacity,
        highlightProgress: currentProgress,
        time,
      });

      applyUnifiedMaterial(materialRef.current, matConfig);
    }
  });

  const highlightAccent = getHighlightAccentColor(element);

  return (
    <group>
      <group ref={groupRef}>
        <Sphere args={[0.6, 32, 32]} castShadow receiveShadow>
          <meshStandardMaterial
            ref={materialRef}
            color={initialMatConfig.color}
            emissive={initialMatConfig.emissive}
            emissiveIntensity={initialMatConfig.emissiveIntensity}
            roughness={initialMatConfig.roughness}
            metalness={initialMatConfig.metalness}
            opacity={initialMatConfig.opacity}
            transparent={initialMatConfig.transparent}
          />
        </Sphere>

        {/* 3D Highlight Ring Halo overlay */}
        <HighlightRing
          type="sphere"
          color={highlightAccent.color}
          emissiveColor={highlightAccent.emissiveColor}
          opacity={ringOpacity}
        />

        <Text
          position={[0, 0, 0.61]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {String((element as any).value ?? '')}
        </Text>

        {(element as any).label && (
          <Text
            position={[0, -0.9, 0]}
            fontSize={0.25}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            {(element as any).label}
          </Text>
        )}
      </group>
    </group>
  );
};

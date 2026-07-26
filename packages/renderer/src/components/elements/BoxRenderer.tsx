import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import { BoxElement } from '@aqvl/runtime';
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

export interface BoxRendererProps {
  element: BoxElement;
}

export const BoxRenderer: React.FC<BoxRendererProps> = ({ element }) => {
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
        <RoundedBox
          args={[1, 1, 1]}
          radius={MATERIAL_PRESETS.NODE.bevelRadius ?? 0.1}
          smoothness={4}
          castShadow
          receiveShadow
        >
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
        </RoundedBox>

        {/* 3D Highlight Ring overlay */}
        <HighlightRing
          type="box"
          color={highlightAccent.color}
          emissiveColor={highlightAccent.emissiveColor}
          opacity={ringOpacity}
        />

        <Text
          position={[0, 0, 0.51]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {String(element.value)}
        </Text>

        {element.label && element.logicalIndex !== undefined && (
          <Text
            position={[0, -0.8, 0]}
            fontSize={0.25}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            {element.label}
          </Text>
        )}
      </group>
    </group>
  );
};

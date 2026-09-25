import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox, Sphere, Cylinder } from '@react-three/drei';
import {
  isElementActive,
  getHighlightAccentColor,
  getHighlightConfig,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import { HighlightRing } from '../elements/HighlightRing';
import * as THREE from 'three';
import { HighlightState, PrimitiveShape, Vec3 } from './types';

export interface PrimitiveNodeProps {
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  shape: PrimitiveShape;
  color: string;
  emissiveColor?: string;
  emissiveIntensity?: number;
  opacity?: number;
  label?: string;
  value?: any;
  highlightState?: HighlightState;
}

const DEG2RAD = Math.PI / 180;

export const PrimitiveNode: React.FC<PrimitiveNodeProps> = ({
  position,
  rotation,
  scale,
  shape,
  color,
  emissiveColor,
  emissiveIntensity,
  opacity,
  label,
  value,
  highlightState,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const highlightProgress = useRef<number>(0);
  const [ringOpacity, setRingOpacity] = useState<number>(0);

  const initialMatConfig = getUnifiedMaterialConfig({
    category: 'NODE',
    state: highlightState?.state,
    color,
    emissiveColor,
    emissiveIntensity,
    opacity,
    highlightProgress: 0,
  });

  useFrame((state, delta) => {
    const active = isElementActive(highlightState ?? {});
    const highlightAccent = getHighlightAccentColor(highlightState ?? {});
    const highlightConfig = getHighlightConfig(highlightState ?? {});
    const time = state.clock.getElapsedTime();

    const targetProgress = active ? 1.0 : 0.0;
    highlightProgress.current = THREE.MathUtils.lerp(
      highlightProgress.current,
      targetProgress,
      Math.min(1.0, delta * 12)
    );

    const currentProgress = highlightProgress.current;

    if (Math.abs(ringOpacity - currentProgress * highlightConfig.ringOpacity) > 0.02) {
      setRingOpacity(currentProgress * highlightConfig.ringOpacity);
    }

    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);

      if (rotation) {
        groupRef.current.rotation.set(
          rotation.x * DEG2RAD,
          rotation.y * DEG2RAD,
          rotation.z * DEG2RAD
        );
      }

      const scaleBoost = 1.0 + (highlightConfig.scaleMultiplier - 1.0) * currentProgress;
      const baseScaleX = scale?.x ?? 1;
      const baseScaleY = scale?.y ?? 1;
      const baseScaleZ = scale?.z ?? 1;

      groupRef.current.scale.set(
        baseScaleX * scaleBoost,
        baseScaleY * scaleBoost,
        baseScaleZ * scaleBoost
      );
    }

    if (materialRef.current) {
      const matConfig = getUnifiedMaterialConfig({
        category: 'NODE',
        state: highlightState?.state,
        color,
        emissiveColor,
        emissiveIntensity,
        opacity,
        highlightProgress: currentProgress,
        time,
      });

      applyUnifiedMaterial(materialRef.current, matConfig);
    }
  });

  const highlightAccent = getHighlightAccentColor(highlightState ?? {});
  const labelZOffset = shape === 'sphere' ? 0.61 : 0.51;

  return (
    <group>
      <group ref={groupRef}>
        {shape === 'box' && (
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
        )}

        {shape === 'sphere' && (
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
        )}

        {shape === 'cylinder' && (
          <Cylinder args={[0.55, 0.55, 1, 32]} castShadow receiveShadow>
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
          </Cylinder>
        )}

        <HighlightRing
          type={shape}
          color={highlightAccent.color}
          emissiveColor={highlightAccent.emissiveColor}
          opacity={ringOpacity}
        />

        {value !== undefined && (
          <Text
            position={[0, 0, labelZOffset]}
            fontSize={0.4}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {String(value)}
          </Text>
        )}

        {label && (
          <Text
            position={[0, -0.8, 0]}
            fontSize={0.25}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        )}
      </group>
    </group>
  );
};

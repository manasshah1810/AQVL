import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';
import {
  getSemanticColorToken,
  getUnifiedMaterialConfig,
  MATERIAL_PRESETS,
} from '@aqvl/shared';

export interface StackRendererProps {
  parentName: string;
  elements: any[];
  sceneState: SceneState;
}

export const StackRenderer: React.FC<StackRendererProps> = ({ parentName, elements, sceneState }) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let z = 0;

  elements.forEach(el => {
    if (el.position) {
      if (el.position.x < minX) minX = el.position.x;
      if (el.position.x > maxX) maxX = el.position.x;
      if (el.position.y < minY) minY = el.position.y;
      z = el.position.z;
    }
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 0;
    minY = 0;
  }

  const neutralToken = getSemanticColorToken('NEUTRAL');

  const containerMatConfig = getUnifiedMaterialConfig({
    category: 'CONTAINER',
    state: 'AUXILIARY',
  });

  // Draw an open-top container (U shape) around the stack
  const containerWidth = 2.0;
  const containerHeight = Math.max(2, (elements.length + 1) * 1.2);
  const centerX = (minX + maxX) / 2;
  const baseCenterY = minY - 0.7;

  return (
    <group>
      {/* Container Left Wall */}
      <mesh position={[centerX - containerWidth / 2, baseCenterY + containerHeight / 2, z]}>
        <boxGeometry args={[0.2, containerHeight, 1.2]} />
        <meshStandardMaterial
          color={containerMatConfig.color}
          emissive={containerMatConfig.emissive}
          emissiveIntensity={containerMatConfig.emissiveIntensity}
          roughness={MATERIAL_PRESETS.CONTAINER.roughness}
          metalness={MATERIAL_PRESETS.CONTAINER.metalness}
          transparent={containerMatConfig.transparent}
          opacity={containerMatConfig.opacity}
        />
      </mesh>
      
      {/* Container Right Wall */}
      <mesh position={[centerX + containerWidth / 2, baseCenterY + containerHeight / 2, z]}>
        <boxGeometry args={[0.2, containerHeight, 1.2]} />
        <meshStandardMaterial
          color={containerMatConfig.color}
          emissive={containerMatConfig.emissive}
          emissiveIntensity={containerMatConfig.emissiveIntensity}
          roughness={MATERIAL_PRESETS.CONTAINER.roughness}
          metalness={MATERIAL_PRESETS.CONTAINER.metalness}
          transparent={containerMatConfig.transparent}
          opacity={containerMatConfig.opacity}
        />
      </mesh>
      
      {/* Container Base */}
      <mesh position={[centerX, baseCenterY, z]}>
        <boxGeometry args={[containerWidth + 0.2, 0.2, 1.2]} />
        <meshStandardMaterial
          color={containerMatConfig.color}
          emissive={containerMatConfig.emissive}
          emissiveIntensity={containerMatConfig.emissiveIntensity}
          roughness={MATERIAL_PRESETS.CONTAINER.roughness}
          metalness={MATERIAL_PRESETS.CONTAINER.metalness}
          transparent={containerMatConfig.transparent}
          opacity={containerMatConfig.opacity}
        />
      </mesh>

      {/* Stack Label below the container */}
      <Text
        position={[centerX, baseCenterY - 0.8, z]}
        fontSize={0.5}
        color={neutralToken.color}
        anchorX="center"
        anchorY="top"
      >
        {parentName}
      </Text>

      {/* Render the actual elements */}
      {elements.map(el => (
        <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
      ))}
    </group>
  );
};

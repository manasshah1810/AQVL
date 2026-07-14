import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';

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

  // Draw an open-top container (U shape) around the stack if we want
  // The bottom of the stack is at minY, we can draw a base slightly below minY
  const containerWidth = 2.0;
  const containerHeight = Math.max(2, (elements.length + 1) * 1.2);
  const centerX = (minX + maxX) / 2;
  const baseCenterY = minY - 0.7;

  return (
    <group>
      {/* Container Left Wall */}
      <mesh position={[centerX - containerWidth / 2, baseCenterY + containerHeight / 2, z]}>
        <boxGeometry args={[0.2, containerHeight, 1.2]} />
        <meshStandardMaterial color="#666666" transparent opacity={0.5} />
      </mesh>
      
      {/* Container Right Wall */}
      <mesh position={[centerX + containerWidth / 2, baseCenterY + containerHeight / 2, z]}>
        <boxGeometry args={[0.2, containerHeight, 1.2]} />
        <meshStandardMaterial color="#666666" transparent opacity={0.5} />
      </mesh>
      
      {/* Container Base */}
      <mesh position={[centerX, baseCenterY, z]}>
        <boxGeometry args={[containerWidth + 0.2, 0.2, 1.2]} />
        <meshStandardMaterial color="#666666" transparent opacity={0.5} />
      </mesh>

      {/* Stack Label below the container */}
      <Text
        position={[centerX, baseCenterY - 0.8, z]}
        fontSize={0.5}
        color="#aaaaaa"
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

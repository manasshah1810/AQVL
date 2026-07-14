import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';

export interface QueueRendererProps {
  parentName: string;
  elements: any[];
  sceneState: SceneState;
}

export const QueueRenderer: React.FC<QueueRendererProps> = ({ parentName, elements, sceneState }) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let y = 0;
  let z = 0;

  elements.forEach(el => {
    if (el.position) {
      if (el.position.x < minX) minX = el.position.x;
      if (el.position.x > maxX) maxX = el.position.x;
      y = el.position.y;
      z = el.position.z;
    }
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 0;
  }

  // Draw an open tube (top and bottom borders) to represent the queue pipeline
  const containerWidth = Math.max(2, (elements.length + 1) * 1.5);
  const centerX = (minX + maxX) / 2;
  const topY = y + 0.7;
  const bottomY = y - 0.7;

  return (
    <group>
      {/* Container Top Wall */}
      <mesh position={[centerX, topY, z]}>
        <boxGeometry args={[containerWidth, 0.2, 1.2]} />
        <meshStandardMaterial color="#5c6bc0" transparent opacity={0.4} />
      </mesh>
      
      {/* Container Bottom Wall */}
      <mesh position={[centerX, bottomY, z]}>
        <boxGeometry args={[containerWidth, 0.2, 1.2]} />
        <meshStandardMaterial color="#5c6bc0" transparent opacity={0.4} />
      </mesh>

      {/* Queue Label above the container */}
      <Text
        position={[centerX, topY + 0.5, z]}
        fontSize={0.5}
        color="#aaaaaa"
        anchorX="center"
        anchorY="bottom"
      >
        {parentName}
      </Text>
      
      {/* Front and Rear labels */}
      {elements.length > 0 && (
        <>
          <Text
            position={[minX - 1.2, y, z]}
            fontSize={0.3}
            color="#ef5350"
            anchorX="right"
            anchorY="middle"
          >
            Front
          </Text>
          <Text
            position={[maxX + 1.2, y, z]}
            fontSize={0.3}
            color="#66bb6a"
            anchorX="left"
            anchorY="middle"
          >
            Rear
          </Text>
        </>
      )}

      {/* Render the actual elements */}
      {elements.map(el => (
        <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
      ))}
    </group>
  );
};

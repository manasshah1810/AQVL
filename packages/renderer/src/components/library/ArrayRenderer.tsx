import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';

export interface ArrayRendererProps {
  parentName: string;
  elements: any[];
  sceneState: SceneState;
}

export const ArrayRenderer: React.FC<ArrayRendererProps> = ({ parentName, elements, sceneState }) => {
  // Sort elements by logical index
  const sortedElements = [...elements].sort((a, b) => (a.logicalIndex || 0) - (b.logicalIndex || 0));

  // Determine bounds to render brackets or a bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let y = 0;
  let z = 0;

  sortedElements.forEach(el => {
    if (el.position) {
      if (el.position.x < minX) minX = el.position.x;
      if (el.position.x > maxX) maxX = el.position.x;
      y = el.position.y; // Assume roughly same y
      z = el.position.z; // Assume same z
    }
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 0;
  }

  // Draw a subtle bracket around the array
  const padding = 0.8;
  const leftX = minX - padding;
  const rightX = maxX + padding;

  return (
    <group>
      {/* Array Label */}
      <Text
        position={[(minX + maxX) / 2, y + 1.2, z]}
        fontSize={0.4}
        color="#888888"
        anchorX="center"
        anchorY="bottom"
      >
        {parentName}
      </Text>

      {/* Array Elements */}
      {sortedElements.map(el => (
        <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
      ))}
    </group>
  );
};

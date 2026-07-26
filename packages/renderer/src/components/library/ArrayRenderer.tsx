import React from 'react';
import { SceneElement, SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';
import { getSemanticColorToken } from '@aqvl/shared';

export interface ArrayRendererProps {
  parentName: string;
  elements: SceneElement[];
  sceneState: SceneState;
}

export const ArrayRenderer: React.FC<ArrayRendererProps> = ({ parentName, elements, sceneState }) => {
  if (!elements || elements.length === 0) return null;

  // Sort array elements by logicalIndex
  const sortedElements = [...elements].sort((a, b) => {
    const idxA = (a as any).logicalIndex ?? 0;
    const idxB = (b as any).logicalIndex ?? 0;
    return idxA - idxB;
  });

  const auxToken = getSemanticColorToken('AUXILIARY');
  const minX = sortedElements[0]?.position?.x ?? 0;
  const maxX = sortedElements[sortedElements.length - 1]?.position?.x ?? 0;
  const y = sortedElements[0]?.position?.y ?? 0;
  const z = sortedElements[0]?.position?.z ?? 0;

  return (
    <group>
      {/* Array Label */}
      <Text
        position={[(minX + maxX) / 2, y + 1.2, z]}
        fontSize={0.4}
        color={auxToken.color}
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

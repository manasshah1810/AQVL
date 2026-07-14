import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { Text } from '@react-three/drei';

export interface LinkedListRendererProps {
  parentName: string;
  elements: any[]; // Nodes and edges
  sceneState: SceneState;
}

export const LinkedListRenderer: React.FC<LinkedListRendererProps> = ({ parentName, elements, sceneState }) => {
  const nodes = elements.filter(el => el.originalType === 'LINKEDLIST_NODE');
  const edges = elements.filter(el => el.type === 'edge');

  let minX = Infinity;
  let maxX = -Infinity;
  let y = 0;
  let z = 0;

  nodes.forEach(el => {
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

  return (
    <group>
      {/* Linked List Label positioned above the list */}
      {nodes.length > 0 && (
        <Text
          position={[(minX + maxX) / 2, y + 1.5, z]}
          fontSize={0.4}
          color="#aaaaaa"
          anchorX="center"
          anchorY="bottom"
        >
          {parentName}
        </Text>
      )}

      {/* Render Edges first so they appear slightly behind if they overlap */}
      {edges.map(el => (
        <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
      ))}
      
      {/* Render Nodes */}
      {nodes.map(el => (
        <SceneElementRenderer key={el.id} element={el} sceneState={sceneState} />
      ))}
    </group>
  );
};

import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { EdgeRenderer } from '../elements/EdgeRenderer';

export interface TreeRendererProps {
  parentName: string;
  elements: any[];
  sceneState: SceneState;
}

export const TreeRenderer: React.FC<TreeRendererProps> = ({ parentName, elements, sceneState }) => {
  const nodes = elements.filter(el => el.originalType === 'TREE_NODE');
  const edges = elements.filter(el => el.originalType === 'EDGE');

  return (
    <group>
      {/* Edges rendered behind nodes */}
      {edges.map(edge => (
        <EdgeRenderer key={edge.id} element={edge} sceneState={sceneState} />
      ))}
      
      {/* Nodes rendered in front */}
      {nodes.map(node => (
        <SceneElementRenderer key={node.id} element={node} sceneState={sceneState} />
      ))}
    </group>
  );
};

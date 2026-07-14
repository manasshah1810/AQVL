import React from 'react';
import { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from '../SceneElementRenderer';
import { EdgeRenderer } from '../elements/EdgeRenderer';

export interface GraphRendererProps {
  parentName: string;
  elements: any[];
  sceneState: SceneState;
}

export const GraphRenderer: React.FC<GraphRendererProps> = ({ parentName, elements, sceneState }) => {
  const nodes = elements.filter(el => el.originalType === 'VERTEX');
  const edges = elements.filter(el => el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE');

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

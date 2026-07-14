import React from 'react';
import { SceneElement, BoxElement, EdgeElement, SceneState } from '@aqvl/runtime';
import { BoxRenderer } from './elements/BoxRenderer';
import { EdgeRenderer } from './elements/EdgeRenderer';
import { SphereRenderer } from './elements/SphereRenderer';

export interface SceneElementRendererProps {
  element: SceneElement;
  sceneState: SceneState;
  key?: React.Key;
}

export const SceneElementRenderer: React.FC<SceneElementRendererProps> = ({ element, sceneState }) => {
  switch (element.type) {
    case 'box':
      return <BoxRenderer element={element as BoxElement} />;
    case 'sphere':
      return <SphereRenderer element={element} />;
    case 'edge':
      return <EdgeRenderer element={element as EdgeElement} sceneState={sceneState} />;
    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }
};

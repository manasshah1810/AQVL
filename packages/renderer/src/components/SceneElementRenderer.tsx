import React from 'react';
import { SceneElement, BoxElement } from '@aqvl/runtime';
import { BoxRenderer } from './elements/BoxRenderer';

export interface SceneElementRendererProps {
  element: SceneElement;
  key?: React.Key;
}

export const SceneElementRenderer: React.FC<SceneElementRendererProps> = ({ element }) => {
  switch (element.type) {
    case 'box':
      return <BoxRenderer element={element as BoxElement} />;
    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }
};

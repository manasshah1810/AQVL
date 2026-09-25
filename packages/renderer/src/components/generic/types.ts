export type PrimitiveShape = 'box' | 'sphere' | 'cylinder';
export type EdgeStyle = 'solid' | 'dashed' | 'arrow';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HighlightState {
  isHighlighted?: boolean;
  state?: string;
  highlightType?: string;
}

/** Structure-agnostic description of a single renderable node. */
export interface RenderableElement {
  id: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  shape: PrimitiveShape;
  color: string;
  emissiveColor?: string;
  emissiveIntensity?: number;
  opacity?: number;
  label?: string;
  value?: any;
  highlightState?: HighlightState;
}

/** Structure-agnostic description of a single renderable connection between two nodes. */
export interface RenderableConnection {
  id: string;
  fromId: string;
  toId: string;
  from: Vec3;
  to: Vec3;
  style: EdgeStyle;
  color?: string;
  emissiveColor?: string;
  highlightState?: HighlightState;
}

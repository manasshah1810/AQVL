export type PrimitiveShape = 'box' | 'sphere' | 'cylinder';
export type EdgeStyle = 'solid' | 'dashed' | 'arrow';

/**
 * Path of a connection: straight (optionally shifted up/down by `offset`,
 * so two opposite arrows between the same nodes don't overlap), an `arc`
 * bulging `height` above (or, negative, below) the straight line, or a
 * `loop` from a node back to itself.
 */
export interface EdgeRoute {
  kind: 'straight' | 'arc' | 'loop';
  offset?: number;
  height?: number;
}

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
  /** Small labels stacked above the node, e.g. HEAD, TAIL, or the pointer variables (`curr`) that point at it. */
  tags?: string[];
  /** Where the tags stack: 'above' (default) or 'below' the node — tree nodes below the root use 'below', clear of the arrow from their parent. */
  tagPlacement?: 'above' | 'below';
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
  route?: EdgeRoute;
  /** Pointer kind for linked-list edges (`next` / `prev`); drawn bolder with larger arrowheads. */
  pointer?: string;
}

export type LifecycleState = 'SPAWNING' | 'ACTIVE' | 'REMOVING' | 'DESTROYED';

export interface SceneElement {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  emissiveIntensity: number;
  emissiveColor: string;
  state?: string;
  logicalParent?: string;
  originalType?: string;
  lifecycleState?: LifecycleState;
  visible?: boolean;
  opacity?: number;
  layoutSlot?: number | string;
  animationLayer?: boolean;
  worldTarget?: { x: number; y: number; z: number };
}

export interface BoxElement extends SceneElement {
  type: 'box';
  value: any;
  index: number;
  logicalIndex?: number;
  label?: string;
  row?: number;
  col?: number;
  columns?: number;
}

export interface EdgeElement extends SceneElement {
  type: 'edge';
  sourceId: string;
  targetId: string;
  directed: boolean;
  relationType?: string;
}

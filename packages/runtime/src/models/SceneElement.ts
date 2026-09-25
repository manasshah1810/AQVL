import { SemanticState } from '@aqvl/shared';

export type LifecycleState = 'SPAWNING' | 'ACTIVE' | 'REMOVING' | 'DESTROYED';

export interface SceneElement {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  emissiveIntensity: number;
  emissiveColor: string;
  state?: SemanticState | string;
  isHighlighted?: boolean;
  highlightType?: string;
  logicalParent?: string;
  originalType?: string;
  lifecycleState?: LifecycleState;

  visible?: boolean;
  opacity?: number;
  layoutSlot?: number | string;
  animationLayer?: boolean;
  worldTarget?: { x: number; y: number; z: number };

  /**
   * Degrees, X→Y→Z application order. Absent = {0,0,0} — no AQIR
   * SET_ROTATION has ever targeted this element (see
   * docs/design/aqir-geometry-spec.md §2).
   */
  rotation?: { x: number; y: number; z: number };

  /**
   * True once an AQIR SET_POSITION pin is active for this element.
   * LayoutManager should skip a pinned element on its owning structure's
   * next COMPUTE_LAYOUT pass. Cleared by SET_POSITION with x=y=z=null
   * (POSITION ... AT ()) or by the element's removal.
   */
  layoutPinned?: boolean;
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

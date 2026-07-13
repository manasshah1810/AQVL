export interface SceneElement {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  emissiveIntensity: number;
  emissiveColor: string;
}

export interface BoxElement extends SceneElement {
  type: 'box';
  value: any;
  index: number;
  logicalIndex?: number;
  label?: string;
}

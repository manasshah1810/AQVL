declare module 'troika-three-text' {
  import type { Color, Material, Mesh } from 'three';

  /** The subset of troika's SDF text mesh the stage uses. */
  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    anchorX: number | 'left' | 'center' | 'right' | string;
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | string;
    color: string | number | Color;
    fillOpacity: number;
    outlineWidth: number | string;
    outlineBlur: number | string;
    outlineColor: string | number | Color;
    outlineOpacity: number;
    letterSpacing: number;
    depthOffset: number;
    sdfGlyphSize: number | null;
    material: Material;
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void,
  ): void;
}

import type { SceneElement } from '@aqvl/runtime';
import type { Vec3 } from './types';

/** Where a node will settle (its layout target), falling back to where it is now. */
export function restingPosition(el: SceneElement): Vec3 {
  return (el as any).worldTarget ?? el.position;
}

/** Resolves the live position of a structure's element at `index` — never a cached/fixed value, since layout can reposition elements between frames. */
export function findElementPosition(elements: SceneElement[], structureId: string, index: number): Vec3 | null {
  const el = elements.find(
    (e) => (e as any).logicalParent === structureId && (e as any).logicalIndex === index
  );
  return el ? el.position : null;
}

import type { StageModel } from '../../model/StageModel';

export interface WorldLayout {
  /** Centre of the ground the run covers. */
  cx: number;
  cz: number;
  /** Half its width (x) and depth (z). */
  halfX: number;
  halfZ: number;
  /**
   * How much further back scenery must stand so it clears the top of a tall
   * structure on screen (the camera looks down about 25°, so ground at depth
   * d behind a structure appears level with height d * tan(25°) on it).
   */
  lift: number;
}

/** Where a world lays out its scenery: around everything the run ever covers, never inside it. */
export function worldLayout(model: StageModel): WorldLayout {
  const f = model.footprint();
  return {
    cx: (f.minX + f.maxX) / 2,
    cz: (f.minZ + f.maxZ) / 2,
    halfX: (f.maxX - f.minX) / 2,
    halfZ: (f.maxZ - f.minZ) / 2,
    lift: Math.max(0, f.top - 2.6) * 2.0,
  };
}

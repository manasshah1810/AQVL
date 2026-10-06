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

/** Where the polar world puts its props (the igloo, the fishing hole, the fish bucket): the crew walks to them when idle. */
export interface PolarSpots {
  igloo: { x: number; z: number; yaw: number; door: [number, number]; approach: [number, number]; center: [number, number] };
  hole: { x: number; z: number };
  bucket: { x: number; z: number };
  iceRx: number;
  iceRz: number;
}

export function polarSpots(model: StageModel): PolarSpots {
  const { cx, cz, halfX, halfZ, lift } = worldLayout(model);
  const iceRz = Math.max(halfZ + 5.5, halfX * 0.6 + 4.6) + lift * 0.5;
  const ix = cx - halfX * 0.55 - 2.6;
  const iz = cz - Math.max(iceRz * 0.86, halfZ + 6.2 + lift);
  const yaw = 0.5;
  const at = (d: number): [number, number] => [ix + Math.sin(yaw) * d, iz + Math.cos(yaw) * d];
  return {
    igloo: { x: ix, z: iz, yaw, door: at(1.8), approach: at(3.4), center: [ix, iz] },
    hole: { x: cx + halfX + 2.7, z: cz + halfZ * 0.15 - 0.6 },
    bucket: { x: cx + halfX + 2.1, z: cz + halfZ + 1.5 },
    iceRx: halfX + 5.5,
    iceRz,
  };
}

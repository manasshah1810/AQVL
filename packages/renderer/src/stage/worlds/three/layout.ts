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

/** Where the grove puts the things the pandas use when nothing is asked of them: the bamboo gym, the snack stalks, the pond's edge. */
export interface PandaSpots {
  gym: {
    /** Centre of the deck, and its height above the floor. */
    x: number;
    z: number;
    height: number;
    /** Where an animal starts the climb and where the ladder pole meets the deck. */
    base: [number, number];
    top: [number, number];
    /** Where an animal that slips off the deck lands. */
    drop: [number, number];
  };
  /** Clumps of bamboo that stand in the front strip: the stalk positions, and where an animal stands to eat from them. */
  snack: { stalks: [number, number][]; at: [number, number]; face: number }[];
  pond: { x: number; z: number; at: [number, number]; face: number };
  /** The clearing, as the bamboo world lays it out. */
  clearX: number;
  clearZ: number;
}

const FACE_CAMERA = -0.16;

export function pandaSpots(model: StageModel): PandaSpots {
  const { cx, cz, halfX, halfZ, lift } = worldLayout(model);
  const f = model.footprint();
  const clearX = halfX + 5.2;
  const clearZ = Math.max(halfZ + 4.8, halfX * 0.55 + 4.3) + lift * 0.6;
  const gx = f.minX - 1.0, gz = f.maxZ + 3.0;
  const clump = (sx: number, sz: number) => ({
    stalks: [[sx, sz], [sx + 0.38, sz - 0.3], [sx - 0.34, sz - 0.34]] as [number, number][],
    at: [sx - 1.0, sz + 0.55] as [number, number],
    face: FACE_CAMERA,
  });
  const px = cx - halfX * 0.45 - 1.6;
  const pz = cz - Math.max(clearZ * 0.84, halfZ + 4.7 + lift);
  return {
    gym: { x: gx, z: gz, height: 1.05, base: [gx - 1.05, gz + 0.8], top: [gx - 0.55, gz + 0.1], drop: [gx + 0.9, gz + 1.2] },
    snack: [clump(f.maxX + 2.6, f.maxZ + 2.6), clump(f.maxX + 4.4, f.maxZ + 0.6)],
    pond: { x: px, z: pz, at: [px + 2.4, pz + 0.4], face: -Math.PI / 2 },
    clearX,
    clearZ,
  };
}

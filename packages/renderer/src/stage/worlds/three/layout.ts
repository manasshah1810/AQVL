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
  /** The slide, behind the structures on the right: a ladder up to a platform, a chute down to the left. */
  slide: { base: [number, number]; top: [number, number]; height: number; end: [number, number]; endHeight: number; land: [number, number] };
  /** The swing, on the left: its frame stands across `face`, the way the seat swings. */
  swing: { x: number; z: number; height: number; length: number; top: number; face: number; seat: [number, number]; approach: [number, number] };
  /** Where the students sit for a lesson (in a row in front of the structures, facing them). */
  seats: { at: [number, number]; face: number }[];
  /** Where each member of the colony likes to be (it wanders off from there and back). */
  dens: [number, number][];
  /** Paper lanterns on bamboo posts round the edge of the clearing (lit at night). */
  lanterns: [number, number][];
  /** The stone lanterns, the rocks, the fountain (x, z, radius): props the colony walks round. */
  stones: { lanterns: [number, number][]; rocks: [number, number, number, number][]; fountain: [number, number] };
  /** Everything on the ground the colony walks round. */
  obstacles: { x: number; z: number; r: number }[];
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
  const gym = { x: gx, z: gz, height: 1.05, base: [gx - 1.05, gz + 0.8] as [number, number], top: [gx - 0.55, gz + 0.1] as [number, number], drop: [gx + 0.9, gz + 1.2] as [number, number] };
  const snack = [clump(f.maxX + 2.6, f.maxZ + 2.6), clump(f.maxX + 4.4, f.maxZ + 0.6)];
  // Keeps a point well inside the clearing (the bamboo stands beyond it).
  const within = (x: number, z: number, r: number): [number, number] => {
    const q = Math.hypot((x - cx) / clearX, (z - cz) / clearZ);
    return q <= r ? [x, z] : [cx + (x - cx) * (r / q), cz + (z - cz) * (r / q)];
  };

  // The slide: back right, clear of the structures, the chute running down to the left (seen side on from the camera).
  const SLIDE_H = 1.55;
  const CHUTE = 2.7;
  const [tx, tz] = within(cx + clearX * 0.6, Math.min(cz - clearZ * 0.5, f.minZ - 2.4) - lift * 0.4, 0.8);
  const slide = {
    base: [tx + 0.05, tz - 1.05] as [number, number],
    top: [tx, tz - 0.25] as [number, number],
    height: SLIDE_H,
    end: [tx - CHUTE, tz] as [number, number],
    endHeight: 0.24,
    land: [tx - CHUTE - 0.75, tz + 0.15] as [number, number],
  };

  // The swing: on the left, between the stone lantern and the structures, swinging towards the front right.
  const [wx, wz] = within(Math.min(cx - clearX * 0.66, f.minX - 2.1), Math.min(cz - clearZ * 0.06, f.maxZ + 0.4), 0.78);
  const face = 0.85;
  const SEAT = 0.52;
  const ROPE = 1.5;
  const swing = {
    x: wx,
    z: wz,
    height: SEAT,
    length: ROPE,
    top: SEAT + ROPE,
    face,
    seat: [wx, wz] as [number, number],
    approach: [wx + Math.sin(face) * 0.85, wz + Math.cos(face) * 0.85] as [number, number],
  };

  // The students' seats: a row in the open in front of the structures, each turned towards them, kept clear of the
  // gym and the snack stalks.
  const avoid: [number, number, number][] = [
    [gym.x, gym.z, 1.5],
    [gym.base[0], gym.base[1], 1.1],
    ...snack.flatMap((c) => [[c.at[0], c.at[1], 1.2] as [number, number, number], [c.stalks[0][0], c.stalks[0][1], 1.2] as [number, number, number]]),
  ];
  const seats = [-1.6, -0.15, 1.3].map((dx, i) => {
    let x = cx - 0.2 + dx;
    let z = f.maxZ + 4.0 + (i === 1 ? 0.25 : 0);
    for (let k = 0; k < 6 && avoid.some(([ax, az, r]) => Math.hypot(ax - x, az - z) < r); k++) {
      z += 0.45;
      x -= 0.15;
    }
    // Turned a little to the right of square-on, so the camera (front left) catches the open book in profile.
    const tgtX = cx + (x - cx) * 0.35;
    return { at: [x, z] as [number, number], face: Math.atan2(tgtX - x, cz - z) - 0.32 };
  });

  // Paper lanterns on posts, round the edge of the clearing (none in the open front, where the camera looks in).
  const lanterns = [-2.45, -1.85, -1.25, -0.6, 0.12, 2.95].map((a) => within(cx + Math.cos(a) * clearX * 0.93, cz + Math.sin(a) * clearZ * 0.93, 0.93));

  const stoneLanterns: [number, number][] = [
    [cx - clearX * 0.82, cz - clearZ * 0.3],
    [cx + clearX * 0.78, cz - clearZ * 0.12],
  ];
  const rocks: [number, number, number, number][] = [
    [cx - clearX * 0.98, cz - clearZ * 0.35, 0.9, 0.55],
    [cx + clearX * 0.96, cz - clearZ * 0.2, 0.7, 0.45],
    [cx - clearX * 0.82, cz - clearZ * 0.9, 0.55, 0.4],
    [cx + clearX * 0.2, cz - clearZ * 1.05, 0.8, 0.5],
    [cx - clearX * 0.88, cz + clearZ * 0.35, 0.45, 0.32],
    [cx + clearX * 0.9, cz + clearZ * 0.45, 0.4, 0.3],
  ];
  const fountain: [number, number] = [cx + clearX * 0.74, cz + clearZ * 0.6];

  // Where each of the colony likes to be: round the back and sides, by the pond, near the play things.
  const dens: [number, number][] = [
    within(px + 2.6, pz + 1.6, 0.8),
    within(cx + clearX * 0.05, cz - clearZ * 0.62, 0.8),
    within(cx + clearX * 0.66, cz - clearZ * 0.3, 0.8),
    within(cx - clearX * 0.55, cz + clearZ * 0.42, 0.8),
    within(cx + clearX * 0.35, cz - clearZ * 0.75, 0.8),
    within(cx - clearX * 0.45, cz - clearZ * 0.55, 0.8),
    within(cx + clearX * 0.5, cz + clearZ * 0.55, 0.8),
    within(cx + clearX * 0.15, cz - clearZ * 0.38, 0.8),
  ];

  // A den in among the structures (a deep or tall one fills the clearing) moves out to the nearest open side.
  for (let i = 0; i < dens.length; i++) {
    const [x, z] = dens[i];
    const m = 1.4;
    if (x > f.minX - m && x < f.maxX + m && z > f.minZ - m && z < f.maxZ + m) {
      const exits: [number, number, number][] = [
        [f.minX - m, z, x - f.minX],
        [f.maxX + m, z, f.maxX - x],
        [x, f.minZ - m, z - f.minZ],
      ];
      exits.sort((a, b) => a[2] - b[2]);
      dens[i] = [exits[0][0], exits[0][1]];
    }
  }
  const fx = Math.cos(FOUNTAIN_YAW), fz = -Math.sin(FOUNTAIN_YAW);
  const obstacles = [
    { x: gym.x, z: gym.z, r: 1.05 },
    { x: tx, z: tz - 0.4, r: 0.75 },
    { x: tx - CHUTE * 0.4, z: tz, r: 0.45 },
    { x: tx - CHUTE * 0.8, z: tz, r: 0.4 },
    { x: wx, z: wz, r: 0.95 },
    { x: px - 0.9, z: pz, r: 1.2 },
    { x: px + 0.9, z: pz, r: 1.2 },
    { x: fountain[0] - 0.6 * fx * 1.3, z: fountain[1] - 0.6 * fz * 1.3, r: 1.0 },
    { x: fountain[0] - 1.3 * fx * 1.3, z: fountain[1] - 1.3 * fz * 1.3, r: 0.5 },
    ...stoneLanterns.map(([x, z]) => ({ x, z, r: 0.55 })),
    ...lanterns.map(([x, z]) => ({ x, z, r: 0.35 })),
    ...rocks.map(([x, z, w]) => ({ x, z, r: w * 0.95 + 0.1 })),
    ...snack.map((c) => ({ x: c.stalks[0][0], z: c.stalks[0][1] - 0.2, r: 0.62 })),
  ];

  return {
    gym,
    snack,
    pond: { x: px, z: pz, at: [px + 2.4, pz + 0.4], face: -Math.PI / 2 },
    clearX,
    clearZ,
    slide,
    swing,
    seats,
    dens,
    lanterns,
    stones: { lanterns: stoneLanterns, rocks, fountain },
    obstacles,
  };
}

/** How the shishi-odoshi stands (its mouth over the basin points along -x, turned by this much about y). */
export const FOUNTAIN_YAW = -0.35;

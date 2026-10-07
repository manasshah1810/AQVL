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
  /** The colony's own places: the fire, the gym yard, the beds, the tech corner, the classroom, the seats, the paths. */
  places: ColonyPlaces;
}

const FACE_CAMERA = -0.16;

/**
 * How much wider the grove's clearing is than the structures need: about three times the ground (1.75 on each side),
 * so the colony has room for its own places (the fire, the gym yard, the beds, the classroom) and its paths.
 */
export const GROVE_SPREAD = 1.75;

/** The clearing of the pandas' grove (half width, half depth): the world and the colony both lay themselves out in it. */
export function groveClearing(model: StageModel): { clearX: number; clearZ: number } {
  const { halfX, halfZ, lift } = worldLayout(model);
  return {
    clearX: (halfX + 5.2) * GROVE_SPREAD,
    clearZ: (Math.max(halfZ + 4.8, halfX * 0.55 + 4.3) + lift * 0.6) * GROVE_SPREAD,
  };
}

/** A piece of bamboo furniture or equipment, for the world to build. `yaw` is the way it faces. */
export type PropKind = 'bed' | 'mat' | 'chair' | 'stool' | 'table' | 'desk' | 'board' | 'bench' | 'log' | 'rack' | 'pullup' | 'punch' | 'jug' | 'dumbbells' | 'fence' | 'arch' | 'teatable' | 'lectern';
export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  yaw: number;
  /** A colour (beds, mats), or a size. */
  tone?: number;
}

/** Where a panda settles to sit, lie or stand about, the height of its feet there, and the way it faces. */
export interface Perch {
  at: [number, number];
  y: number;
  face: number;
}

/** What the colony has set out in the grove (see `colonyPlaces`). */
export interface ColonyPlaces {
  /** The fire: where it burns, the log seats round it, the standing places for the noon gathering, the musician's seat. */
  camp: { x: number; z: number; seats: Perch[]; ring: Perch[]; stage: Perch };
  /** The gym yard: where each kind of exercise is done, a loop to jog round. */
  yard: { x: number; z: number; r: number; jog: [number, number][]; lift: Perch; pull: Perch; punch: Perch; mat: Perch; squat: Perch; drink: Perch };
  /** Somewhere to sleep for every member of the colony (a bed or a mat), and the point in front of it to step up from. */
  beds: (Perch & { approach: [number, number]; kind: 'bed' | 'mat' })[];
  /** The tech corner: the chair at the desk, and the desk's screen (for the glow). */
  desk: { seat: Perch; screen: [number, number, number]; x: number; z: number };
  /** The classroom: the board, where the teacher stands, and the mats the students sit on. */
  school: { board: [number, number]; teacher: Perch; seats: Perch[] };
  /** Chairs, benches and mats to sit about on (and the table the tea is on). */
  nooks: (Perch & { kind: 'chair' | 'bench' | 'mat'; table: boolean })[];
  /** Paths between the places: lines of waypoints. */
  paths: [number, number][][];
  /** The pads the paths and the places are drawn on (x, z, radius, kind: 0 fire, 1 yard, 2 dorm, 3 school). */
  pads: [number, number, number, number][];
  /** Lamp posts at the places (lit at night). */
  posts: [number, number][];
  props: Prop[];
}

export function pandaSpots(model: StageModel): PandaSpots {
  const { cx, cz, halfX, halfZ, lift } = worldLayout(model);
  const f = model.footprint();
  const { clearX, clearZ } = groveClearing(model);
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
    [cx - clearX * 0.52, cz - clearZ * 1.1, 0.55, 0.4],
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
    within(cx - clearX * 0.15, cz + clearZ * 0.72, 0.8),
    within(cx + clearX * 0.82, cz + clearZ * 0.3, 0.8),
    within(cx - clearX * 0.86, cz + clearZ * 0.02, 0.8),
    within(cx + clearX * 0.18, cz - clearZ * 0.9, 0.8),
    within(cx - clearX * 0.5, cz + clearZ * 0.8, 0.8),
    within(cx + clearX * 0.6, cz + clearZ * 0.72, 0.8),
    within(cx - clearX * 0.3, cz - clearZ * 0.85, 0.8),
    within(cx + clearX * 0.88, cz - clearZ * 0.4, 0.8),
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

  // ── The colony's own places ────────────────────────────────────────────
  // Each stands in the open, well clear of the structures (a deep or tall run fills the middle of the grove), and is
  // joined to the others by a path.
  const at = (fx: number, fz: number): [number, number] => within(cx + clearX * fx, cz + clearZ * fz, 0.9);
  const clearOf = ([x, z]: [number, number], pad: number): [number, number] => {
    if (!(x > f.minX - pad && x < f.maxX + pad && z > f.minZ - pad && z < f.maxZ + pad)) return [x, z];
    const exits: [number, number, number][] = [
      [f.minX - pad, z, x - f.minX],
      [f.maxX + pad, z, f.maxX - x],
      [x, f.maxZ + pad, f.maxZ - z],
    ];
    exits.sort((a, b) => a[2] - b[2]);
    return [exits[0][0], exits[0][1]];
  };
  const toward = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const props: Prop[] = [];
  const pads: [number, number, number, number][] = [];
  const posts: [number, number][] = [];
  const placeObstacles: { x: number; z: number; r: number }[] = [];

  // The fire: a ring of stones, with log seats round it (the musician's is the one at the back, facing the camera).
  const [fx0, fz0] = clearOf(at(-0.4, 0.42), 5.4);
  const logs: Perch[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * (Math.PI / 3);
    const lx = fx0 + Math.cos(a) * 2.6, lz = fz0 + Math.sin(a) * 2.6;
    props.push({ kind: 'log', x: lx, z: lz, yaw: toward(lx, lz, fx0, fz0) });
    placeObstacles.push({ x: lx, z: lz, r: 0.42 });
    const sx = fx0 + Math.cos(a) * 2.6, sz = fz0 + Math.sin(a) * 2.6;
    logs.push({ at: [sx, sz], y: 0.3, face: toward(sx, sz, fx0, fz0) });
  }
  const ring: Perch[] = [];
  for (const [r, count, shift] of [[1.75, 9, 0.5], [3.7, 11, 0.2]] as const) {
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + ((k + shift) / count) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.5) continue;
      const rx = fx0 + Math.cos(a) * r, rz = fz0 + Math.sin(a) * r;
      ring.push({ at: [rx, rz], y: 0, face: toward(rx, rz, fx0, fz0) });
    }
  }
  placeObstacles.push({ x: fx0, z: fz0, r: 1.05 });
  pads.push([fx0, fz0, 5.6, 0]);
  posts.push([fx0 + Math.cos(2.5) * 4.9, fz0 + Math.sin(2.5) * 4.9]);

  // The gym yard: a rack with a barbell, a pull-up bar, a punching log, a mat, a loop to jog round.
  const [gx0, gz0] = clearOf(at(0.32, 0.62), 5.0);
  props.push({ kind: 'rack', x: gx0 - 2.2, z: gz0 - 0.6, yaw: FACE_CAMERA });
  props.push({ kind: 'pullup', x: gx0 + 2.0, z: gz0 - 0.9, yaw: 0 });
  props.push({ kind: 'punch', x: gx0 - 0.1, z: gz0 - 0.9, yaw: 0 });
  props.push({ kind: 'mat', x: gx0 + 0.5, z: gz0 + 1.5, yaw: 0, tone: 2 });
  props.push({ kind: 'dumbbells', x: gx0 - 1.9, z: gz0 + 1.5, yaw: 0.4 });
  props.push({ kind: 'jug', x: gx0 + 2.55, z: gz0 + 1.2, yaw: 0 });
  placeObstacles.push({ x: gx0 - 2.2, z: gz0 - 0.6, r: 0.85 }, { x: gx0 + 2.0, z: gz0 - 0.9, r: 0.7 }, { x: gx0 - 0.1, z: gz0 - 0.9, r: 0.5 });
  pads.push([gx0, gz0, 4.8, 1]);
  posts.push([gx0 - 4.0, gz0 - 1.6]);
  const yard = {
    x: gx0,
    z: gz0,
    r: 4.8,
    jog: [[gx0 + 3.7, gz0 + 0.2], [gx0 + 0.4, gz0 + 3.3], [gx0 - 3.7, gz0 + 0.4], [gx0 - 0.6, gz0 - 2.7]] as [number, number][],
    lift: { at: [gx0 - 2.2, gz0 + 0.55] as [number, number], y: 0, face: FACE_CAMERA },
    pull: { at: [gx0 + 2.0, gz0 - 1.0] as [number, number], y: 0.3, face: FACE_CAMERA },
    punch: { at: [gx0 + 0.6, gz0 - 0.9] as [number, number], y: 0, face: -Math.PI / 2 },
    mat: { at: [gx0 + 0.5, gz0 + 1.5] as [number, number], y: 0.03, face: FACE_CAMERA },
    squat: { at: [gx0 - 0.8, gz0 + 0.5] as [number, number], y: 0, face: FACE_CAMERA },
    drink: { at: [gx0 + 2.1, gz0 + 1.2] as [number, number], y: 0, face: Math.PI / 2 },
  };

  // The sleeping quarters: nine bamboo beds in three rows, three mats in front of them, a fence behind.
  // (kept left of the pond and well inside the ring of bamboo: the back corners of a wide, shallow clearing are tight)
  const [dxa, dza] = clearOf(at(-0.5, -0.5), 5.4);
  const dx0 = Math.min(dxa, px - 1.8 - 0.8 - 1.75 - 0.75);
  const backReach = clearZ * Math.sqrt(Math.max(0.1, 0.93 - ((Math.abs(dx0 - cx) + 1.75) / clearX) ** 2));
  const dz0 = Math.max(dza, cz - backReach + 3.0);
  const beds: ColonyPlaces['beds'] = [];
  const bedAt = (x: number, z: number, y: number, kind: 'bed' | 'mat', count: number) => {
    props.push({ kind, x, z, yaw: 0, tone: count });
    beds.push({ at: [x, z], y, face: FACE_CAMERA + (hash01(count * 3.7) - 0.5) * 0.5, approach: [x, z + (kind === 'bed' ? 1.15 : 1.0)], kind });
    placeObstacles.push({ x, z, r: kind === 'bed' ? 0.85 : 0.62 });
  };
  let bedCount = 0;
  for (const dz of [-3.0, -0.9, 1.2]) for (const dx of [-1.75, 0, 1.75]) bedAt(dx0 + dx, dz0 + dz, 0.3, 'bed', bedCount++);
  for (const dx of [-1.75, 0, 1.75]) bedAt(dx0 + dx, dz0 + 3.2, 0.03, 'mat', bedCount++);
  props.push({ kind: 'fence', x: dx0, z: dz0 - 4.3, yaw: 0, tone: 7.4 });
  props.push({ kind: 'arch', x: dx0, z: dz0 + 5.3, yaw: 0 });
  pads.push([dx0, dz0 + 0.1, 5.6, 2]);
  posts.push([dx0 - 3.7, dz0 - 0.4], [dx0 + 3.7, dz0 - 0.4]);
  // Two more mats by the fire (a night owl nods off where it is).
  for (const a of [Math.PI * 0.93, 0.22]) {
    bedAt(fx0 + Math.cos(a) * 5.0, fz0 + Math.sin(a) * 4.4, 0.03, 'mat', bedCount++);
  }

  // The tech corner: a chair at a desk with a laptop (the screen faces the chair).
  const [kx, kz] = clearOf(at(-0.74, 0.3), 3.4);
  props.push({ kind: 'chair', x: kx - 0.05, z: kz, yaw: Math.PI / 2 });
  props.push({ kind: 'desk', x: kx + 0.95, z: kz, yaw: -Math.PI / 2 });
  placeObstacles.push({ x: kx + 0.95, z: kz, r: 0.95 });
  bedAt(kx - 0.2, kz + 2.5, 0.03, 'mat', bedCount++);
  posts.push([kx - 1.5, kz - 1.5]);
  const desk = { seat: { at: [kx, kz] as [number, number], y: 0.2, face: Math.PI / 2 }, screen: [kx + 0.8, 0.85, kz] as [number, number, number], x: kx + 0.95, z: kz };

  // The classroom: a board, the teacher's table, and five mats facing it.
  const [sx0, sz0] = clearOf(at(0.5, -0.14), 4.2);
  props.push({ kind: 'board', x: sx0, z: sz0, yaw: 0 });
  props.push({ kind: 'lectern', x: sx0 + 2.3, z: sz0 + 0.05, yaw: 0 });
  placeObstacles.push({ x: sx0 - 0.8, z: sz0, r: 0.8 }, { x: sx0 + 0.8, z: sz0, r: 0.8 }, { x: sx0 + 2.3, z: sz0 + 0.05, r: 0.5 });
  const schoolSeats: Perch[] = [];
  [[-1.8, 2.5], [0, 2.5], [1.8, 2.5], [-0.9, 3.7], [0.9, 3.7]].forEach(([dx, dz], i) => {
    props.push({ kind: 'mat', x: sx0 + dx, z: sz0 + dz, yaw: 0, tone: i });
    schoolSeats.push({ at: [sx0 + dx, sz0 + dz], y: 0.03, face: Math.PI });
  });
  pads.push([sx0, sz0 + 2.2, 4.1, 3]);
  posts.push([sx0 - 3.2, sz0 + 0.6]);
  const school = { board: [sx0, sz0] as [number, number], teacher: { at: [sx0 + 2.0, sz0 + 0.9] as [number, number], y: 0, face: toward(sx0 + 2.0, sz0 + 0.9, sx0, sz0 + 3.0) }, seats: schoolSeats };

  // Seats to sit about on: two chairs round a tea table, a bench by the pond, mats in the open.
  const [tx0, tz0] = clearOf(at(-0.3, -0.36), 3.6);
  props.push({ kind: 'teatable', x: tx0, z: tz0, yaw: 0 });
  props.push({ kind: 'chair', x: tx0 - 1.05, z: tz0, yaw: Math.PI / 2 }, { kind: 'chair', x: tx0 + 1.05, z: tz0, yaw: -Math.PI / 2 });
  placeObstacles.push({ x: tx0, z: tz0, r: 0.65 });
  const nooks: ColonyPlaces['nooks'] = [
    { at: [tx0 - 1.0, tz0], y: 0.2, face: Math.PI / 2, kind: 'chair', table: true },
    { at: [tx0 + 1.0, tz0], y: 0.2, face: -Math.PI / 2, kind: 'chair', table: true },
  ];
  props.push({ kind: 'bench', x: px + 0.3, z: pz + 1.95, yaw: Math.PI });
  for (const o of [-0.4, 0.4]) nooks.push({ at: [px + 0.3 + o, pz + 1.9], y: 0.22, face: Math.PI, kind: 'bench', table: false });
  for (const [mfx, mfz, tone] of [[0.8, 0.26, 1], [0.2, -0.64, 3]] as const) {
    const [mx, mz] = clearOf(at(mfx, mfz), 2.8);
    props.push({ kind: 'mat', x: mx, z: mz, yaw: 0.2, tone });
    nooks.push({ at: [mx, mz], y: 0.03, face: FACE_CAMERA + 0.3, kind: 'mat', table: false });
  }
  for (const k of [0, 2, 4]) nooks.push({ at: logs[k].at, y: logs[k].y, face: logs[k].face, kind: 'bench', table: false });

  // The paths: from the open ground in front of the structures out to each place, and between them.
  const plaza: [number, number] = [cx - 0.3, f.maxZ + 3.9];
  const mid = (a: [number, number], b: [number, number], k = 0.5): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const paths: [number, number][][] = [
    [[fx0 + 1.8, fz0 - 0.6], mid([fx0 + 1.8, fz0 - 0.6], plaza), plaza],
    [plaza, mid(plaza, [gx0 - 3.2, gz0 - 0.2]), [gx0 - 3.2, gz0 - 0.2]],
    [plaza, mid(plaza, [sx0 - 2.4, sz0 + 2.4]), [sx0 - 2.4, sz0 + 2.4]],
    [plaza, mid(plaza, [kx + 1.2, kz + 1.6], 0.55), [kx + 1.2, kz + 1.6]],
    [[fx0 - 1.2, fz0 - 2.2], mid([fx0 - 1.2, fz0 - 2.2], [dx0 + 2.6, dz0 + 4.6]), [dx0 + 2.6, dz0 + 4.6]],
    [[dx0 + 3.0, dz0 + 0.2], mid([dx0 + 3.0, dz0 + 0.2], [tx0 - 1.2, tz0 + 1.2]), [tx0 - 1.2, tz0 + 1.2]],
    [[sx0 + 1.2, sz0 + 0.6], mid([sx0 + 1.2, sz0 + 0.6], [slide.base[0], slide.base[1] + 0.9]), [slide.base[0], slide.base[1] + 0.9]],
    [[gx0 + 3.4, gz0 - 0.4], mid([gx0 + 3.4, gz0 - 0.4], [fountain[0] - 1.6, fountain[1] - 0.4]), [fountain[0] - 1.6, fountain[1] - 0.4]],
    [[tx0 + 0.6, tz0 - 0.6], mid([tx0 + 0.6, tz0 - 0.6], [px + 0.3, pz + 2.8]), [px + 0.3, pz + 2.8]],
  ];

  const places: ColonyPlaces = {
    camp: { x: fx0, z: fz0, seats: logs, ring, stage: logs[0] },
    yard,
    beds,
    desk,
    school,
    nooks,
    paths,
    pads,
    posts,
    props,
  };
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
    ...placeObstacles,
  ];

  // Nobody starts out in the middle of a bed, a desk or a fire: a den that landed on one moves to the nearest open ground.
  const blocked = (x: number, z: number) =>
    obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.1) ||
    (x > f.minX - 1.4 && x < f.maxX + 1.4 && z > f.minZ - 1.4 && z < f.maxZ + 1.4) ||
    Math.hypot((x - cx) / clearX, (z - cz) / clearZ) > 0.82;
  dens.forEach(([dx, dz], i) => {
    if (!blocked(dx, dz)) return;
    for (let r = 1.2; r < 16; r += 1.2) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + i;
        const x = dx + Math.cos(a) * r, z = dz + Math.sin(a) * r * 0.8;
        if (!blocked(x, z)) {
          dens[i] = [x, z];
          return;
        }
      }
    }
  });

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
    places,
  };
}

/** How the shishi-odoshi stands (its mouth over the basin points along -x, turned by this much about y). */
export const FOUNTAIN_YAW = -0.35;

/** A stable number in 0..1 from a seed (the beds are each a little differently turned). */
function hash01(x: number): number {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

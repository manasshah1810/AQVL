import type { StageModel } from '../../model/StageModel';
import { polarSpots, worldLayout, type ColonyPlaces, type Perch } from './layout';

/**
 * Where everything stands on the penguins' ice shelf: about three times the
 * ice it used to be, with the colony's own places on it (the fire, the gym,
 * the classroom, the tech corner, the igloo village, the pool, the ice slide,
 * the play area, somewhere to sit about) joined by paths.
 */

const FACE_CAMERA = -0.16;

/**
 * How much wider the penguins' ice shelf is than the structures need: about three times the ice it was (1.75 on each
 * side), so the colony has room for its places (the fire, the gym, the classroom, the igloos, the pool, the ice slide).
 */
export const POLAR_SPREAD = 1.75;

/** The ice shelf before it grew (half width, half depth): what the crew's igloo, hole and bucket are laid out round. */
export function polarIce(model: StageModel): { iceRx: number; iceRz: number } {
  const { halfX, halfZ, lift } = worldLayout(model);
  return { iceRx: halfX + 5.5, iceRz: Math.max(halfZ + 5.5, halfX * 0.6 + 4.6) + lift * 0.5 };
}

/** The ice shelf of the penguins' world (half width, half depth): the world and the colony both lay themselves out on it. */
export function polarClearing(model: StageModel): { clearX: number; clearZ: number } {
  const { iceRx, iceRz } = polarIce(model);
  return { clearX: iceRx * POLAR_SPREAD, clearZ: iceRz * POLAR_SPREAD };
}

/** A piece of the colony's ice and snow furniture, for the polar world to build. */
export type PolarPropKind =
  | 'snowbed'
  | 'icemat'
  | 'snowchair'
  | 'icetable'
  | 'icedesk'
  | 'board'
  | 'lectern'
  | 'bench'
  | 'iceblock'
  | 'rack'
  | 'pullup'
  | 'punch'
  | 'dumbbells'
  | 'jug'
  | 'igloo'
  | 'snowman'
  | 'ball'
  | 'crate'
  | 'ledge'
  | 'floe';

export interface PolarProp {
  kind: PolarPropKind;
  x: number;
  z: number;
  yaw: number;
  /** A colour (beds, mats), or a size. */
  tone?: number;
}

/** A slide: the foot of its ladder, the platform at the top (and its height), the end of the chute (and its height), where it lands. */
export interface SlideSpot {
  base: [number, number];
  top: [number, number];
  height: number;
  end: [number, number];
  endHeight: number;
  land: [number, number];
}

/** What the penguin colony has set out on the ice: the panda colony's kinds of place, and the places only penguins have. */
export interface PolarPlaces extends Omit<ColonyPlaces, 'props'> {
  props: PolarProp[];
  /** The swimming pool: an opening in the ice (an ellipse), the places to get in and out, and the diving ledge. */
  pool: { x: number; z: number; rx: number; rz: number; entries: Perch[]; ledge: Perch };
  /** The ice slide: steps up the back of a snow hill to the top, a lane down its front, and the run out across the ice. */
  ramp: { base: [number, number]; top: [number, number]; height: number; end: [number, number]; run: [number, number]; dir: number; x: number; z: number };
  /** The play area: a little ice slide (ladder, platform, chute), a snowman, a ball. */
  play: { x: number; z: number; slide: SlideSpot; ball: [number, number] };
  /** Crates of fish to help oneself from (where to stand, facing them). */
  fish: Perch[];
}

export interface PenguinSpots {
  clearX: number;
  clearZ: number;
  /** Where the students sit for a lesson (in a row in front of the structures, facing them). */
  seats: { at: [number, number]; face: number }[];
  /** Where each member of the colony starts out. */
  dens: [number, number][];
  /** Ice lanterns on posts along the paths and at the places (lit at night). */
  lanterns: [number, number][];
  /** The crystal clusters. */
  crystals: [number, number][];
  /** Everything on the ice the colony walks round. */
  obstacles: { x: number; z: number; r: number }[];
  places: PolarPlaces;
}

/**
 * Each of the colony's places claims a round patch of open ice (clear of the structures, of the crew's igloo, fishing
 * hole and bucket, and of the places already set out) as near as it can to where it likes to be; paths join them all,
 * out from the open ice in front of the structures and round the shelf from each place to its neighbour.
 */
export function penguinSpots(model: StageModel): PenguinSpots {
  const { cx, cz } = worldLayout(model);
  const f = model.footprint();
  const { clearX, clearZ } = polarClearing(model);
  const crew = polarSpots(model);
  const toward = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const inBox = (x: number, z: number, m: number) => x > f.minX - m && x < f.maxX + m && z > f.minZ - m && z < f.maxZ + m;
  const ell = (x: number, z: number) => Math.hypot((x - cx) / clearX, (z - cz) / clearZ);
  const taken: [number, number, number][] = [
    [crew.igloo.x, crew.igloo.z, 2.3],
    [crew.hole.x, crew.hole.z, 1.5],
    [crew.bucket.x, crew.bucket.z, 0.9],
    // The open ice in front of the structures, where the students sit and the crew comes and goes.
    [cx, f.maxZ + 4.2, 2.6],
  ];
  /** The whole round patch lies on the ice (which reaches a little further at the front, towards the camera). */
  const onIce = (x: number, z: number, r: number) => {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.hypot((px - cx) / clearX, (pz - cz) / (clearZ * (pz > cz ? 1.15 : 1))) > 0.95) return false;
    }
    return true;
  };
  const fits = (x: number, z: number, r: number, strict: boolean) =>
    !inBox(x, z, r + 0.7) && onIce(x, z, r) && ell(x, z) <= 0.9 && (!strict || !taken.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < r + tr + 0.35));
  /**
   * A round patch of open ice for a place, as near as possible to (fx, fz) of the shelf. On a small shelf with no room
   * left, the patch that overlaps the places already there the least.
   */
  const claim = (fx: number, fz: number, r: number): [number, number] => {
    const x0 = cx + clearX * fx, z0 = cz + clearZ * fz;
    let best: [number, number] | null = null;
    let bestGap = -Infinity;
    for (let d = 0; d < Math.max(clearX, clearZ) * 1.6; d += 0.5) {
      const n = d === 0 ? 1 : Math.max(8, Math.round(d * 5));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + fx * 3;
        const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
        if (!fits(x, z, r, false)) continue;
        if (fits(x, z, r, true)) {
          taken.push([x, z, r]);
          return [x, z];
        }
        const gap = Math.min(...taken.map(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) - r - tr)) - d * 0.01;
        if (gap > bestGap) {
          bestGap = gap;
          best = [x, z];
        }
      }
    }
    const at = best ?? [x0, z0];
    taken.push([at[0], at[1], r]);
    return at;
  };

  const props: PolarProp[] = [];
  const pads: [number, number, number, number][] = [];
  const posts: [number, number][] = [];
  const obs: { x: number; z: number; r: number }[] = [];
  const beds: ColonyPlaces['beds'] = [];
  const bedAt = (x: number, z: number, y: number, kind: 'bed' | 'mat', count: number) => {
    props.push({ kind: kind === 'bed' ? 'snowbed' : 'icemat', x, z, yaw: 0, tone: count });
    beds.push({ at: [x, z], y, face: FACE_CAMERA + (hash01(count * 3.7 + 1) - 0.5) * 0.5, approach: [x, z + (kind === 'bed' ? 1.1 : 0.95)], kind });
    obs.push({ x, z, r: kind === 'bed' ? 0.82 : 0.6 });
  };

  // The fire, front left: ice-block seats round it (the musician's at the back, facing the camera), places to stand.
  const [fx0, fz0] = claim(-0.42, 0.45, 4.2);
  const logs: Perch[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * (Math.PI / 3);
    const lx = fx0 + Math.cos(a) * 2.4, lz = fz0 + Math.sin(a) * 2.4;
    props.push({ kind: 'iceblock', x: lx, z: lz, yaw: toward(lx, lz, fx0, fz0) });
    obs.push({ x: lx, z: lz, r: 0.42 });
    logs.push({ at: [lx, lz], y: 0.32, face: toward(lx, lz, fx0, fz0) });
  }
  const ring: Perch[] = [];
  for (const [r, count, shift] of [[1.6, 8, 0.5], [3.5, 11, 0.2]] as const) {
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + ((k + shift) / count) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.5) continue;
      const rx = fx0 + Math.cos(a) * r, rz = fz0 + Math.sin(a) * r;
      // Never a standing place on top of an ice-block seat.
      if (logs.some((l) => Math.hypot(l.at[0] - rx, l.at[1] - rz) < 0.75)) continue;
      ring.push({ at: [rx, rz], y: 0, face: toward(rx, rz, fx0, fz0) });
    }
  }
  obs.push({ x: fx0, z: fz0, r: 1.0 });
  pads.push([fx0, fz0, 4.6, 0]);
  posts.push([fx0 + Math.cos(2.5) * 4.3, fz0 + Math.sin(2.5) * 4.3], [fx0 + Math.cos(0.4) * 4.3, fz0 + Math.sin(0.4) * 4.3]);

  // The gym, front right: a barbell rack, a pull-up bar, a punching bag, a mat, dumbbells, a water jug, a loop to run round.
  const [gx0, gz0] = claim(0.4, 0.58, 3.9);
  props.push({ kind: 'rack', x: gx0 - 1.9, z: gz0 - 0.6, yaw: FACE_CAMERA });
  props.push({ kind: 'pullup', x: gx0 + 1.8, z: gz0 - 0.9, yaw: 0 });
  props.push({ kind: 'punch', x: gx0 - 0.1, z: gz0 - 0.9, yaw: 0 });
  props.push({ kind: 'icemat', x: gx0 + 0.5, z: gz0 + 1.4, yaw: 0, tone: 2 });
  props.push({ kind: 'dumbbells', x: gx0 - 1.7, z: gz0 + 1.4, yaw: 0.4 });
  props.push({ kind: 'jug', x: gx0 + 2.3, z: gz0 + 1.1, yaw: 0 });
  obs.push({ x: gx0 - 1.9, z: gz0 - 0.6, r: 0.85 }, { x: gx0 + 1.8, z: gz0 - 0.9, r: 0.7 }, { x: gx0 - 0.1, z: gz0 - 0.9, r: 0.5 });
  pads.push([gx0, gz0, 4.2, 1]);
  posts.push([gx0 - 3.6, gz0 - 1.5], [gx0 + 3.6, gz0 - 1.5]);
  const yard = {
    x: gx0,
    z: gz0,
    r: 4.2,
    jog: [[gx0 + 3.3, gz0 + 0.2], [gx0 + 0.4, gz0 + 3.0], [gx0 - 3.3, gz0 + 0.4], [gx0 - 0.6, gz0 - 2.5]] as [number, number][],
    lift: { at: [gx0 - 1.9, gz0 + 0.5] as [number, number], y: 0, face: FACE_CAMERA },
    pull: { at: [gx0 + 1.8, gz0 - 1.0] as [number, number], y: 0.3, face: FACE_CAMERA },
    punch: { at: [gx0 + 0.6, gz0 - 0.9] as [number, number], y: 0, face: -Math.PI / 2 },
    mat: { at: [gx0 + 0.5, gz0 + 1.4] as [number, number], y: 0.03, face: FACE_CAMERA },
    squat: { at: [gx0 - 0.8, gz0 + 0.5] as [number, number], y: 0, face: FACE_CAMERA },
    drink: { at: [gx0 + 1.9, gz0 + 1.1] as [number, number], y: 0, face: Math.PI / 2 },
  };

  // The igloo village, back left: nine snow beds in three rows, three ice mats, two igloos behind.
  const [dx0, dz0] = claim(-0.5, -0.55, 4.7);
  let bedCount = 0;
  for (const dz of [-2.2, -0.3, 1.6]) for (const dx of [-1.6, 0, 1.6]) bedAt(dx0 + dx, dz0 + dz, 0.26, 'bed', bedCount++);
  for (const dx of [-1.6, 0, 1.6]) bedAt(dx0 + dx, dz0 + 3.2, 0.03, 'mat', bedCount++);
  for (const sx of [-1, 1]) {
    props.push({ kind: 'igloo', x: dx0 + sx * 2.4, z: dz0 - 3.7, yaw: -sx * 0.35, tone: 1.05 });
    obs.push({ x: dx0 + sx * 2.4, z: dz0 - 3.7, r: 1.35 });
  }
  pads.push([dx0, dz0, 5.1, 2]);
  posts.push([dx0 - 3.4, dz0 - 0.4], [dx0 + 3.4, dz0 - 0.4]);
  // Two more mats by the fire (a night owl nods off where it is).
  for (const a of [Math.PI * 0.93, 0.22]) bedAt(fx0 + Math.cos(a) * 4.0, fz0 + Math.sin(a) * 3.6, 0.03, 'mat', bedCount++);

  // The tech corner, left: a snow chair at an ice desk with a laptop (the screen faces the chair), a mat for naps.
  const [kx, kz] = claim(-0.74, 0.12, 2.4);
  props.push({ kind: 'snowchair', x: kx - 0.05, z: kz, yaw: Math.PI / 2 });
  props.push({ kind: 'icedesk', x: kx + 0.95, z: kz, yaw: -Math.PI / 2 });
  obs.push({ x: kx + 0.95, z: kz, r: 0.95 });
  bedAt(kx - 0.2, kz + 1.9, 0.03, 'mat', bedCount++);
  posts.push([kx - 1.4, kz - 1.4]);
  pads.push([kx + 0.3, kz + 0.5, 2.6, 3]);
  const desk = { seat: { at: [kx, kz] as [number, number], y: 0.2, face: Math.PI / 2 }, screen: [kx + 0.8, 0.85, kz] as [number, number, number], x: kx + 0.95, z: kz };

  // The classroom, right: a board of ice, the teacher's lectern, five mats facing the board.
  const [sx0, szc] = claim(0.62, -0.08, 3.4);
  const sz0 = szc - 1.6;
  props.push({ kind: 'board', x: sx0, z: sz0, yaw: 0 });
  props.push({ kind: 'lectern', x: sx0 + 2.2, z: sz0 + 0.05, yaw: 0 });
  obs.push({ x: sx0 - 0.8, z: sz0, r: 0.8 }, { x: sx0 + 0.8, z: sz0, r: 0.8 }, { x: sx0 + 2.2, z: sz0 + 0.05, r: 0.5 });
  const schoolSeats: Perch[] = [];
  [[-1.7, 2.2], [0, 2.2], [1.7, 2.2], [-0.85, 3.3], [0.85, 3.3]].forEach(([dx, dz], i) => {
    props.push({ kind: 'icemat', x: sx0 + dx, z: sz0 + dz, yaw: 0, tone: 5 + i });
    schoolSeats.push({ at: [sx0 + dx, sz0 + dz], y: 0.03, face: Math.PI });
  });
  pads.push([sx0, szc, 3.8, 3]);
  posts.push([sx0 - 3.0, sz0 + 0.6]);
  const school = { board: [sx0, sz0] as [number, number], teacher: { at: [sx0 + 1.9, sz0 + 0.9] as [number, number], y: 0, face: toward(sx0 + 1.9, sz0 + 0.9, sx0, sz0 + 2.8) }, seats: schoolSeats };

  // The pool, back right: an opening in the ice to swim in, with places to slip in and climb out, and a diving ledge.
  const [qx, qz] = claim(0.5, -0.62, 3.8);
  const prx = 3.1, prz = 2.2;
  const entries: Perch[] = [];
  for (const a of [Math.PI * 0.5, Math.PI * 0.18, Math.PI * 0.82, -Math.PI * 0.1, Math.PI * 1.1]) {
    const ex = qx + Math.cos(a) * (prx + 0.45), ez = qz + Math.sin(a) * (prz + 0.45);
    entries.push({ at: [ex, ez], y: 0, face: toward(ex, ez, qx, qz) });
  }
  const la = -Math.PI * 0.62;
  const lx0 = qx + Math.cos(la) * (prx + 0.55), lz0 = qz + Math.sin(la) * (prz + 0.55);
  props.push({ kind: 'ledge', x: lx0, z: lz0, yaw: toward(lx0, lz0, qx, qz) });
  const ledge = { at: [lx0, lz0] as [number, number], y: 0.42, face: toward(lx0, lz0, qx, qz) };
  for (let k = 0; k < 3; k++) {
    const a = 0.6 + k * 2.1;
    props.push({ kind: 'floe', x: qx + Math.cos(a) * prx * 0.55, z: qz + Math.sin(a) * prz * 0.5, yaw: a, tone: 0.45 + hash01(k + 7) * 0.3 });
  }
  obs.push({ x: qx, z: qz, r: prz + 0.25 }, { x: qx - (prx - prz), z: qz, r: prz + 0.1 }, { x: qx + (prx - prz), z: qz, r: prz + 0.1 }, { x: lx0, z: lz0, r: 0.5 });
  posts.push([qx + prx + 1.1, qz - 0.6]);
  const pool = { x: qx, z: qz, rx: prx, rz: prz, entries, ledge };

  // The ice slide, at the back: steps up the back of a snow hill, a polished lane down its front, a long run out on the ice.
  const [rx0, rz0] = claim(0.0, -0.82, 3.4);
  const dir = rx0 > cx ? -1 : 1;
  const ramp = {
    x: rx0,
    z: rz0,
    base: [rx0 - dir * 2.75, rz0 + 0.35] as [number, number],
    top: [rx0 - dir * 1.7, rz0] as [number, number],
    height: 1.3,
    end: [rx0 + dir * 1.75, rz0 + 0.15] as [number, number],
    run: [rx0 + dir * 4.4, rz0 + 0.8] as [number, number],
    dir,
  };
  for (let k = 0; k < 3; k++) obs.push({ x: rx0 - dir * (1.5 - k * 1.1), z: rz0, r: 0.78 - k * 0.14 });
  posts.push([rx0, rz0 - 1.9]);

  // The play area: a little slide of ice, a snowman, a ball to chase about.
  const [ax0, az0] = claim(0.78, 0.3, 2.8);
  const play = {
    x: ax0,
    z: az0,
    slide: {
      base: [ax0 + 1.05, az0 - 1.1] as [number, number],
      top: [ax0 + 1.0, az0 - 0.3] as [number, number],
      height: 1.2,
      end: [ax0 - 1.4, az0 - 0.05] as [number, number],
      endHeight: 0.2,
      land: [ax0 - 2.1, az0 + 0.2] as [number, number],
    },
    ball: [ax0 + 0.3, az0 + 1.6] as [number, number],
  };
  props.push({ kind: 'snowman', x: ax0 - 1.6, z: az0 + 1.5, yaw: FACE_CAMERA, tone: 1 });
  props.push({ kind: 'ball', x: play.ball[0], z: play.ball[1], yaw: 0 });
  obs.push({ x: ax0 + 1.0, z: az0 - 0.7, r: 0.7 }, { x: ax0 - 0.2, z: az0 - 0.15, r: 0.45 }, { x: ax0 - 1.6, z: az0 + 1.5, r: 0.6 });
  pads.push([ax0, az0 + 0.3, 3.0, 4]);

  // Places to sit about: two snow chairs round an ice table (with a crate of fish beside it), a bench by the pool.
  const [tx0, tz0] = claim(-0.25, -0.24, 2.3);
  props.push({ kind: 'icetable', x: tx0, z: tz0, yaw: 0 });
  props.push({ kind: 'snowchair', x: tx0 - 1.0, z: tz0, yaw: Math.PI / 2 }, { kind: 'snowchair', x: tx0 + 1.0, z: tz0, yaw: -Math.PI / 2 });
  props.push({ kind: 'crate', x: tx0 + 0.2, z: tz0 - 1.5, yaw: 0.2 });
  obs.push({ x: tx0, z: tz0, r: 0.62 }, { x: tx0 + 0.2, z: tz0 - 1.5, r: 0.5 });
  const nooks: ColonyPlaces['nooks'] = [
    { at: [tx0 - 0.95, tz0], y: 0.22, face: Math.PI / 2, kind: 'chair', table: true },
    { at: [tx0 + 0.95, tz0], y: 0.22, face: -Math.PI / 2, kind: 'chair', table: true },
  ];
  const fish: Perch[] = [{ at: [tx0 + 0.25, tz0 - 0.75], y: 0, face: Math.PI }, { at: [tx0 - 0.6, tz0 - 1.4], y: 0, face: Math.PI / 2 }];
  pads.push([tx0, tz0 - 0.4, 2.4, 3]);
  // A bench at the edge of the pool, facing the water.
  const ba = Math.PI * 0.32;
  const bx = qx + Math.cos(ba) * (prx + 1.5), bz = qz + Math.sin(ba) * (prz + 1.5);
  const bf = toward(bx, bz, qx, qz);
  props.push({ kind: 'bench', x: bx, z: bz, yaw: bf });
  for (const o of [-0.4, 0.4]) nooks.push({ at: [bx + Math.cos(bf) * o, bz - Math.sin(bf) * o], y: 0.24, face: bf, kind: 'bench', table: false });
  obs.push({ x: bx, z: bz, r: 0.55 });
  for (const k of [0, 2, 4]) nooks.push({ at: logs[k].at, y: logs[k].y, face: logs[k].face, kind: 'bench', table: false });
  // A mat in the open by the gym, for a lie down in the sun.
  nooks.push({ at: yard.mat.at, y: 0.03, face: FACE_CAMERA + 0.3, kind: 'mat', table: false });

  // The paths: out from the open ice in front of the structures to the places, and round the shelf from each place to
  // its neighbour (never under the structures).
  const plaza: [number, number] = [cx - 0.3, f.maxZ + 3.8];
  // (x, z, and the half width and depth of the place: the pool is an ellipse, the rest round.)
  const centres: [number, number, number, number][] = [
    [fx0, fz0, 3.7, 3.7],
    [gx0, gz0, 3.5, 3.5],
    [dx0, dz0, 4.2, 4.2],
    [kx + 0.3, kz + 0.5, 2.2, 2.2],
    [sx0, szc, 3.1, 3.1],
    [qx, qz, (prx + 0.9) / 0.85, (prz + 0.9) / 0.85],
    [rx0, rz0, 2.6, 2.6],
    [ax0, az0, 2.4, 2.4],
    [tx0, tz0, 1.9, 1.9],
  ];
  /** Where a path to (tx, tz) leaves the place: at its edge (for the pool, beyond the water), never more than halfway there. */
  const edge = (c: [number, number, number, number], tx: number, tz: number): [number, number] => {
    const d = Math.hypot(tx - c[0], tz - c[1]) || 1;
    const ux = (tx - c[0]) / d, uz = (tz - c[1]) / d;
    const reach = 0.85 / Math.hypot(ux / c[2], uz / c[3]);
    const r = Math.min(reach, d * 0.45);
    return [c[0] + ux * r, c[1] + uz * r];
  };
  const cuts = (a: [number, number], b: [number, number]) => {
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      if (inBox(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0.9)) return true;
    }
    return false;
  };
  const line = (a: [number, number], b: [number, number]): [number, number][] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const bend = (hash01(a[0] * 1.3 + b[1] * 0.7) - 0.5) * Math.min(2, len * 0.15);
    const m: [number, number] = [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * bend, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * bend];
    return [a, m, b];
  };
  const paths: [number, number][][] = [];
  for (const c of centres) {
    const a = edge(c, plaza[0], plaza[1]);
    if (!cuts(a, plaza)) paths.push(line(plaza, a));
  }
  const order = centres.map((c) => ({ c, a: Math.atan2(c[1] - cz, c[0] - cx) })).sort((p, q) => p.a - q.a);
  for (let k = 0; k < order.length; k++) {
    const p = order[k].c, q = order[(k + 1) % order.length].c;
    const a = edge(p, q[0], q[1]), b = edge(q, p[0], p[1]);
    if (!cuts(a, b)) paths.push(line(a, b));
  }

  // Ice lanterns at the places, and one beside the middle of each longer path.
  const lanterns: [number, number][] = [...posts];
  for (const pth of paths) {
    const a = pth[0], b = pth[2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 7) continue;
    const m = pth[1];
    const lx = m[0] + ((b[1] - a[1]) / len) * 1.1, lz = m[1] - ((b[0] - a[0]) / len) * 1.1;
    // Not in among the structures, nor on top of anything else.
    if (inBox(lx, lz, 1.6) || obs.some((o) => Math.hypot(o.x - lx, o.z - lz) < o.r + 0.7) || lanterns.some(([x, z]) => Math.hypot(x - lx, z - lz) < 2)) continue;
    lanterns.push([lx, lz]);
  }

  // The crystal clusters: wherever there is room left round the edge of the shelf.
  const crystals: [number, number][] = [claim(0.86, -0.3, 0.9), claim(-0.86, -0.12, 0.9), claim(-0.1, -0.92, 0.9)];

  const places: PolarPlaces = {
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
    pool,
    ramp,
    play,
    fish,
  };

  const obstacles = [
    { x: crew.igloo.x, z: crew.igloo.z, r: 1.85 },
    { x: crew.hole.x, z: crew.hole.z, r: 1.15 },
    { x: crew.bucket.x, z: crew.bucket.z, r: 0.55 },
    ...crystals.map(([x, z]) => ({ x, z, r: 0.85 })),
    ...lanterns.map(([x, z]) => ({ x, z, r: 0.32 })),
    ...obs,
  ];

  // The students' seats: a row on the open ice in front of the structures, turned towards them.
  const seats = [-1.6, -0.15, 1.3].map((dx, i) => {
    let x = cx - 0.2 + dx;
    let z = f.maxZ + 4.0 + (i === 1 ? 0.25 : 0);
    for (let k = 0; k < 6 && obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.7); k++) {
      z += 0.45;
      x -= 0.15;
    }
    const tgtX = cx + (x - cx) * 0.35;
    return { at: [x, z] as [number, number], face: Math.atan2(tgtX - x, cz - z) - 0.32 };
  });

  // Where each of the colony starts out: spread round the shelf, on open ice.
  const blocked = (x: number, z: number) => obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.0) || inBox(x, z, 1.4) || ell(x, z) > 0.8;
  const dens: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + 0.4;
    const r = 0.38 + 0.36 * ((i * 0.618) % 1);
    let x = cx + Math.cos(a) * clearX * r, z = cz + Math.sin(a) * clearZ * r;
    if (blocked(x, z)) {
      search: for (let rr = 1.0; rr < 18; rr += 1.0) {
        for (let k = 0; k < 12; k++) {
          const b = (k / 12) * Math.PI * 2 + i;
          const nx = x + Math.cos(b) * rr, nz = z + Math.sin(b) * rr * 0.8;
          if (!blocked(nx, nz)) {
            x = nx;
            z = nz;
            break search;
          }
        }
      }
    }
    dens.push([x, z]);
  }

  return { clearX, clearZ, seats, dens, lanterns, crystals, obstacles, places };
}

/** A stable number in 0..1 from a seed. */
function hash01(x: number): number {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

import type { StageModel } from '../../model/StageModel';
import { worldLayout } from '../three/layout';

/**
 * The cloud kingdom: a ring of floating islands at different heights around
 * the plaza the structures stand on, joined by rainbow bridges, cloud
 * bridges, stepping clouds, floating platforms, a slide, a trampoline that
 * throws a rabbit back up to the plaza, a soft drop onto a lower cloud and a
 * balloon lift up to the lookout.
 *
 * Everything here is pure layout, a function of the model's footprint (so a
 * long array gets a bigger plaza and the kingdom moves out round it): the
 * scene draws it, and the rabbits find their way about it on the same graph.
 * The plaza's turf is exactly at the model's floor, so plinths, footprints
 * and shadows lie on it as they lie on the studio floor.
 */

export type V3 = [number, number, number];

export type IslandId = 'plaza' | 'castle' | 'village' | 'play' | 'farm' | 'garden' | 'sleep' | 'training' | 'lookout';

export interface Island {
  id: IslandId;
  name: string;
  /** Centre of the walkable top, its height, and its half sizes. */
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  /** Turf colour of the top, and the tint of its cloud body. */
  turf: string;
  tint: string;
  /** How far the cloud body hangs below the top. */
  depth: number;
}

/** How a link is crossed. `oneWay` links go from `a` to `b` only. */
export type LinkKind = 'rainbow' | 'cloud' | 'steps' | 'platforms' | 'slide' | 'bounce' | 'drop' | 'lift';

export interface Link {
  a: IslandId;
  b: IslandId;
  kind: LinkKind;
  /** From a's port to b's port. Bridges and slides: a dense curve; steps and platforms: the pads hopped across; the rest: two ends. */
  pts: V3[];
  oneWay: boolean;
  /** Length along the way (for path costs and walking speed). */
  length: number;
}

/** What a rabbit does at a spot. */
export type Act =
  | 'eat' | 'harvest' | 'garden' | 'sniff' | 'bounce' | 'slide' | 'balloon' | 'climb' | 'practice'
  | 'shop' | 'fountain' | 'bench' | 'chat' | 'read' | 'gaze' | 'sleep' | 'rest' | 'stroll' | 'watch'
  // The gym, the cloud office, the school, the music corners.
  | 'weights' | 'stretch' | 'jumps' | 'cooldown' | 'computer' | 'lounge' | 'teach' | 'study' | 'music'
  // Not places but things to do anywhere (the warren makes a spot for them on the way).
  | 'roam' | 'wander' | 'observe' | 'explore' | 'listen' | 'drift' | 'follow' | 'hide' | 'roll' | 'campfire';

export interface Spot {
  island: IslandId;
  x: number;
  z: number;
  /** Which way a rabbit faces there (yaw: 0 looks down +z). */
  face: number;
  act: Act;
}

export interface Kingdom {
  cx: number;
  cz: number;
  floorY: number;
  islands: Record<IslandId, Island>;
  links: Link[];
  spots: Spot[];
  /** Small islets that only float (not walked on), and their bob phase. */
  islets: { x: number; y: number; z: number; r: number; seed: number; tree: boolean }[];
  /** Where the balloon lift's basket rides between (bottom on the castle island, top on the lookout). */
  lift: { bottom: V3; top: V3 };
  /** The trampoline that throws rabbits back up to the plaza, and the slide's start. */
  launch: V3;
  /** The plaza's half sizes, and the clear space the structures use inside it. */
  plazaRx: number;
  plazaRz: number;
  clearX: number;
  clearZ: number;
  /** How far the kingdom reaches from the plaza's centre (navigation limits, sky). */
  reach: number;
  /** The campfire on the village green (the noon gathering), on the village's top. */
  fire: V3;
  /** The plaza's school corner: the board, where the teacher stands, and the students' desks (each facing the board). */
  school: { board: Spot; teach: Spot; desks: Spot[] };
}

const ISLAND_NAMES: Record<IslandId, string> = {
  plaza: 'Learning Plaza',
  castle: 'Kingdom Island',
  village: 'Burrow Village',
  play: 'Play Cloud',
  farm: 'Carrot Farm',
  garden: 'Flower Garden',
  sleep: 'Dozy Cloud',
  training: 'Hop Academy',
  lookout: 'Star Lookout',
};

const cache = new WeakMap<StageModel, Kingdom>();

export function kingdomOf(model: StageModel): Kingdom {
  let k = cache.get(model);
  if (!k) {
    k = build(model);
    cache.set(model, k);
  }
  return k;
}

/** A point on the island's rim towards (tx, tz), pulled in to `inset` of its radius. */
export function rimToward(i: Island, tx: number, tz: number, inset = 0.86): V3 {
  const a = Math.atan2((tz - i.z) / i.rz, (tx - i.x) / i.rx);
  return [i.x + Math.cos(a) * i.rx * inset, i.y, i.z + Math.sin(a) * i.rz * inset];
}

/** Keeps (x, z) on the island's walkable top. */
export function clampTo(i: Island, x: number, z: number, inset = 0.9): [number, number] {
  const dx = (x - i.x) / (i.rx * inset), dz = (z - i.z) / (i.rz * inset);
  const d = Math.hypot(dx, dz);
  if (d <= 1) return [x, z];
  return [i.x + (dx / d) * i.rx * inset, i.z + (dz / d) * i.rz * inset];
}

export function lengthOf(pts: V3[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return l;
}

/** Point at distance `d` along a polyline (clamped), written into `out`. Returns the segment's heading. */
export function along(pts: V3[], d: number, out: V3): number {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (left <= l || i === pts.length - 1) {
      const t = l > 0 ? Math.min(1, left / l) : 1;
      out[0] = a[0] + (b[0] - a[0]) * t;
      out[1] = a[1] + (b[1] - a[1]) * t;
      out[2] = a[2] + (b[2] - a[2]) * t;
      return Math.atan2(b[0] - a[0], b[2] - a[2]);
    }
    left -= l;
  }
  const p = pts[pts.length - 1];
  out[0] = p[0]; out[1] = p[1]; out[2] = p[2];
  return 0;
}

/** An arched curve from a to b: `rise` above the straight line at the middle. */
function arch(a: V3, b: V3, rise: number, n = 28): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + rise * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

/** Pads between a and b, evenly spaced, wobbling a little off the line. */
function pads(a: V3, b: V3, count: number, seed: number, dip = 0): V3[] {
  const out: V3[] = [a];
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  const sx = -dz / l, sz = dx / l;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const wob = Math.sin(seed * 3.1 + i * 2.3) * 0.9;
    out.push([a[0] + dx * t + sx * wob, a[1] + (b[1] - a[1]) * t - dip * Math.sin(t * Math.PI) + Math.sin(seed + i * 1.7) * 0.25, a[2] + dz * t + sz * wob]);
  }
  out.push(b);
  return out;
}

/** A slide: out over the rim, curling down to the lower island. */
function chute(a: V3, b: V3, n = 34): V3[] {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Steep first, easing out at the bottom, with a gentle sideways swing.
    const fall = 1 - (1 - t) * (1 - t);
    const swing = Math.sin(t * Math.PI) * 1.6;
    const l = Math.hypot(dx, dz) || 1;
    out.push([a[0] + dx * t + (-dz / l) * swing, a[1] + (b[1] - a[1]) * fall, a[2] + dz * t + (dx / l) * swing]);
  }
  return out;
}

function link(a: Island, b: Island, kind: LinkKind, pts: V3[], oneWay = false): Link {
  return { a: a.id, b: b.id, kind, pts, oneWay, length: lengthOf(pts) };
}

function build(model: StageModel): Kingdom {
  const { cx, cz, halfX, halfZ, lift } = worldLayout(model);
  const F = model.floorY;
  const clearX = halfX + 2.2;
  const clearZ = halfZ + 2.2;
  const RX = halfX + 7;
  const RZ = halfZ + 6.5;
  const L = Math.min(lift, 12);

  const isl = (id: IslandId, x: number, y: number, z: number, rx: number, rz: number, turf: string, tint: string, depth: number): Island => ({
    id, name: ISLAND_NAMES[id], x, y, z, rx, rz, turf, tint, depth,
  });
  const islands: Record<IslandId, Island> = {
    plaza: isl('plaza', cx, F, cz, RX, RZ, '#cfe8c4', '#f4f0ff', 5 + Math.max(RX, RZ) * 0.35),
    castle: isl('castle', cx, F + 4.5 + L * 0.3, cz - RZ - 14 - L * 0.5, 11, 9, '#c4e6c0', '#fff0f6', 7),
    village: isl('village', cx - RX - 12.5, F + 1.6, cz - RZ * 0.3 - 4.5, 9.5, 8, '#cdeab5', '#fff6ea', 6),
    play: isl('play', cx + RX + 12.5, F + 2.6, cz - RZ * 0.3 - 5, 9, 7.8, '#bfe7d8', '#f2f6ff', 6),
    farm: isl('farm', cx - RX - 13.5, F - 2.6, cz + RZ * 0.5 + 7.5, 9, 7.5, '#bfe0a6', '#fff7ee', 5.5),
    garden: isl('garden', cx + RX + 13.5, F - 2.1, cz + RZ * 0.5 + 6.5, 9, 7.8, '#c8eebd', '#fff0fa', 5.5),
    sleep: isl('sleep', cx - RX * 0.42 - 5, F - 7.5, cz + RZ + 13.5, 8, 6.8, '#d6dcf7', '#eef0ff', 5),
    training: isl('training', cx + RX * 0.42 + 6, F - 8.5, cz + RZ + 14.5, 8.5, 7, '#c6e7c9', '#f0fbff', 5),
    lookout: isl('lookout', cx + 15, F + 16 + L * 0.5, cz - RZ - 28 - L * 0.5, 5.5, 5, '#d8d6f6', '#f6f0ff', 6),
  };
  const I = islands;

  const port = (from: Island, to: Island, inset = 0.86) => rimToward(from, to.x, to.z, inset);
  const links: Link[] = [];
  const bridge = (a: Island, b: Island, kind: 'rainbow' | 'cloud') => {
    const p = port(a, b), q = port(b, a);
    const d = Math.hypot(q[0] - p[0], q[2] - p[2]);
    links.push(link(a, b, kind, arch(p, q, kind === 'rainbow' ? 2 + d * 0.12 : 0.45 + d * 0.03)));
  };
  bridge(I.plaza, I.castle, 'rainbow');
  bridge(I.plaza, I.garden, 'rainbow');
  bridge(I.castle, I.play, 'rainbow');
  bridge(I.plaza, I.village, 'cloud');
  bridge(I.plaza, I.play, 'cloud');
  bridge(I.village, I.farm, 'cloud');
  bridge(I.castle, I.village, 'cloud');
  bridge(I.sleep, I.training, 'cloud');
  // Stepping clouds and floating platforms: hopped across one by one.
  const hops = (a: Island, b: Island, kind: 'steps' | 'platforms', seed: number) => {
    const p = port(a, b), q = port(b, a);
    const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const n = Math.max(2, Math.round(d / (kind === 'steps' ? 2.1 : 2.6)) - 1);
    links.push(link(a, b, kind, pads(p, q, n, seed, kind === 'steps' ? 0.3 : 0)));
  };
  hops(I.plaza, I.farm, 'steps', 1);
  hops(I.play, I.garden, 'steps', 2);
  hops(I.garden, I.training, 'platforms', 3);
  hops(I.farm, I.sleep, 'platforms', 4);
  // The slide down from the plaza's front rim to the academy, and the trampoline that sends a rabbit back up.
  const slideTop = rimToward(I.plaza, I.training.x + 3, I.training.z, 0.9);
  const slideEnd = rimToward(I.training, I.plaza.x, I.plaza.z, 0.7);
  links.push(link(I.plaza, I.training, 'slide', chute(slideTop, slideEnd), true));
  const launch: V3 = [I.training.x - I.training.rx * 0.35, I.training.y, I.training.z - I.training.rz * 0.42];
  const landing = rimToward(I.plaza, launch[0], launch[2], 0.78);
  links.push(link(I.training, I.plaza, 'bounce', [launch, landing], true));
  // A soft drop off the plaza onto the sleepy cloud below (ears out, drifting down).
  const dropFrom = rimToward(I.plaza, I.sleep.x, I.sleep.z, 0.93);
  const dropTo = rimToward(I.sleep, I.plaza.x, I.plaza.z, 0.55);
  links.push(link(I.plaza, I.sleep, 'drop', [dropFrom, dropTo], true));
  // The balloon lift: from the castle island's back up to the lookout.
  const liftBottom = rimToward(I.castle, I.lookout.x, I.lookout.z, 0.74);
  const liftTop = rimToward(I.lookout, I.castle.x, I.castle.z, 0.62);
  links.push(link(I.castle, I.lookout, 'lift', [liftBottom, liftTop]));

  const spots: Spot[] = [];
  const at = (island: Island, u: number, v: number, act: Act, face?: number) => {
    const x = island.x + u * island.rx, z = island.z + v * island.rz;
    spots.push({ island: island.id, x, z, face: face ?? Math.atan2(island.x - x, island.z - z), act });
  };
  // Carrot farm: rows of carrots to nibble and pull.
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) at(I.farm, -0.35 + c * 0.42, -0.35 + r * 0.32, c === 0 ? 'harvest' : 'eat', Math.PI / 2);
  // Flower garden: big flowers to sniff and tend, and a bench.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    at(I.garden, Math.cos(a) * 0.5, Math.sin(a) * 0.45, i % 2 ? 'garden' : 'sniff');
  }
  at(I.garden, 0.05, 0.62, 'bench', Math.PI);
  // Play cloud: trampolines, the play slide, balloons and the climbing frame.
  at(I.play, -0.42, 0.15, 'bounce');
  at(I.play, -0.15, 0.48, 'bounce');
  at(I.play, 0.35, -0.3, 'slide', 0);
  at(I.play, 0.38, 0.32, 'balloon');
  at(I.play, -0.25, -0.42, 'climb', 0);
  // Hop academy: the obstacle course loops, the ramps.
  // Two lanes of the same course (the rabbits on it run half a lap apart).
  at(I.training, 0.22, 0.28, 'practice');
  at(I.training, 0.22, 0.28, 'practice');
  // Kingdom island: the market stalls, the fountain, benches round the castle square.
  at(I.castle, -0.55, 0.42, 'shop', Math.PI * 0.85);
  at(I.castle, -0.25, 0.55, 'shop', Math.PI);
  at(I.castle, 0.52, 0.45, 'shop', -Math.PI * 0.85);
  at(I.castle, 0.12, 0.3, 'fountain');
  at(I.castle, -0.12, 0.3, 'fountain');
  at(I.castle, 0.62, 0.05, 'bench', -Math.PI / 2);
  at(I.castle, 0, 0.1, 'stroll');
  // Village: chats at doorsteps, the bench, the well.
  at(I.village, -0.3, 0.3, 'chat');
  at(I.village, 0.15, 0.4, 'chat');
  at(I.village, 0.45, 0.05, 'bench', Math.PI / 2);
  at(I.village, -0.05, 0, 'stroll');
  // The lookout: telescopes and a quiet place to watch the sky.
  at(I.lookout, 0.25, 0.1, 'gaze', Math.PI);
  at(I.lookout, -0.3, 0.2, 'gaze', Math.PI);
  // The plaza's learning corners (benches at the rim, books).
  const pr = (a: number, act: Act) => at(I.plaza, Math.cos(a) * 0.84, Math.sin(a) * 0.84, act);
  pr(Math.PI * 0.86, 'read');
  pr(Math.PI * 0.14, 'read');
  // Dozy cloud: tables and chairs to rest at (the beds are below).
  at(I.sleep, 0.42, -0.25, 'rest', -Math.PI / 2);
  at(I.sleep, 0.5, 0.15, 'rest', -Math.PI / 2);
  // Beds: cloud beds on the dozy cloud, cushions by the village doors.
  for (let i = 0; i < 8; i++) {
    const u = -0.55 + (i % 4) * 0.28, v = i < 4 ? -0.3 : 0.22;
    at(I.sleep, u, v, 'sleep', 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 1.05 + (i / 5) * Math.PI * 0.9;
    at(I.village, Math.cos(a) * 0.5, Math.sin(a) * 0.5 + 0.08, 'sleep');
  }

  // The gym at the academy: a weight bench, a stretching mat, a spot for jumping jacks, and a bench to cool down on.
  at(I.training, 0.3, -0.6, 'weights', 0);
  at(I.training, 0.05, -0.33, 'stretch', 0);
  at(I.training, 0.47, -0.1, 'jumps', 0);
  at(I.training, -0.02, -0.6, 'cooldown', 0);
  // The cloud office on the dozy cloud: a desk and a computer (facing along the island), a beanbag beside it.
  at(I.sleep, 0.36, 0.5, 'computer', -Math.PI / 2);
  at(I.sleep, 0.62, 0.42, 'lounge', -Math.PI * 0.4);
  // Music corners: the castle square, the garden, the plaza's back, and the dozy cloud for a quiet tune at night.
  at(I.castle, 0.4, 0.2, 'music', 0);
  at(I.garden, -0.45, -0.45, 'music');
  at(I.sleep, -0.2, 0.62, 'music', 0.4);
  {
    const a = Math.PI * 1.75;
    const x = I.plaza.x + Math.cos(a) * RX * 0.82, z = I.plaza.z + Math.sin(a) * RZ * 0.82;
    spots.push({ island: 'plaza', x, z, face: Math.atan2(I.plaza.x - x, I.plaza.z - z), act: 'music' });
  }
  // The school at the plaza's back left: a board near the rim, the teacher's place, three desks in a row facing it.
  const school = ((): Kingdom['school'] => {
    const P = I.plaza;
    const a = SCHOOL_ANGLE;
    const ex = Math.cos(a) * RX, ez = Math.sin(a) * RZ;
    const len = Math.hypot(ex, ez);
    const dx = ex / len, dz = ez / len;
    const out = (fromRim: number) => [P.x + ex * (1 - fromRim / len), P.z + ez * (1 - fromRim / len)] as const;
    const [bx, bz] = out(1.0);
    const [tx, tz] = out(2.0);
    const [sx, sz] = out(3.4);
    const toBoard = Math.atan2(dx, dz);
    const board: Spot = { island: 'plaza', x: bx, z: bz, face: toBoard + Math.PI, act: 'teach' };
    const teach: Spot = { island: 'plaza', x: tx, z: tz, face: toBoard + Math.PI, act: 'teach' };
    const desks: Spot[] = [-1.45, 0, 1.45].map((o) => ({ island: 'plaza', x: sx - dz * o, z: sz + dx * o, face: toBoard, act: 'study' as const }));
    spots.push(teach, ...desks);
    return { board, teach, desks };
  })();

  // Islets: little clouds that only float about, some with a tree.
  const islets: Kingdom['islets'] = [];
  const reach = Math.max(RX, RZ) + 36;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.sin(i * 7.7) * 0.2;
    const d = reach * (0.62 + ((i * 37) % 11) / 11 * 0.5);
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d * 0.9;
    // Keep the view in front of the plaza clear.
    if (z > cz + RZ + 4 && Math.abs(x - cx) < RX + 6) continue;
    islets.push({ x, y: F - 12 + ((i * 53) % 17) * 1.6, z, r: 1.6 + ((i * 29) % 7) * 0.45, seed: i, tree: i % 3 === 0 });
  }

  return {
    cx, cz, floorY: F, islands, links, spots, islets,
    lift: { bottom: liftBottom, top: liftTop },
    launch,
    plazaRx: RX, plazaRz: RZ, clearX, clearZ,
    reach,
    fire: [I.village.x, I.village.y, I.village.z + I.village.rz * 0.1],
    school,
  };
}

/** Which way from the plaza's centre the school corner lies (back left, clear of the bridges). */
export const SCHOOL_ANGLE = Math.PI * 1.3;

/** The ways out of an island (a link, and whether it is taken backwards). */
export function exitsOf(k: Kingdom, from: IslandId): { link: Link; reverse: boolean; to: IslandId }[] {
  const out: { link: Link; reverse: boolean; to: IslandId }[] = [];
  for (const l of k.links) {
    if (l.a === from) out.push({ link: l, reverse: false, to: l.b });
    else if (l.b === from && !l.oneWay) out.push({ link: l, reverse: true, to: l.a });
  }
  return out;
}

/** What crossing a link costs a rabbit (the lift and the trampoline take a while; a slide is quick fun). */
function costOf(l: Link): number {
  switch (l.kind) {
    case 'lift': return 26;
    case 'bounce': return 6;
    case 'drop': return 4;
    case 'slide': return l.length * 0.4;
    default: return l.length;
  }
}

/** The links to cross from one island to another (fewest costly crossings, walking distance included). */
export function routeBetween(k: Kingdom, from: IslandId, to: IslandId, x = k.islands[from].x, z = k.islands[from].z): { link: Link; reverse: boolean }[] {
  if (from === to) return [];
  const dist = new Map<IslandId, number>([[from, 0]]);
  const prev = new Map<IslandId, { link: Link; reverse: boolean; from: IslandId }>();
  const pos = new Map<IslandId, [number, number]>([[from, [x, z]]]);
  const open = new Set<IslandId>([from]);
  const done = new Set<IslandId>();
  while (open.size) {
    let best: IslandId | null = null;
    for (const id of open) if (best === null || dist.get(id)! < dist.get(best)!) best = id;
    const cur = best!;
    open.delete(cur);
    if (cur === to) break;
    done.add(cur);
    const [px, pz] = pos.get(cur)!;
    for (const e of exitsOf(k, cur)) {
      if (done.has(e.to)) continue;
      const start = e.reverse ? e.link.pts[e.link.pts.length - 1] : e.link.pts[0];
      const end = e.reverse ? e.link.pts[0] : e.link.pts[e.link.pts.length - 1];
      const d = dist.get(cur)! + Math.hypot(start[0] - px, start[2] - pz) + costOf(e.link);
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d);
        prev.set(e.to, { link: e.link, reverse: e.reverse, from: cur });
        pos.set(e.to, [end[0], end[2]]);
        open.add(e.to);
      }
    }
  }
  const path: { link: Link; reverse: boolean }[] = [];
  let at: IslandId = to;
  while (at !== from) {
    const p = prev.get(at);
    if (!p) return [];
    path.unshift({ link: p.link, reverse: p.reverse });
    at = p.from;
  }
  return path;
}

/** The balloon lift's cycle: waits at the bottom, rises, waits at the top, comes down. */
export const LIFT_PERIOD = 28;
export function liftAt(k: Kingdom, t: number, out: V3): 'bottom' | 'up' | 'top' | 'down' {
  const p = ((t % LIFT_PERIOD) + LIFT_PERIOD) % LIFT_PERIOD;
  const { bottom: b, top: tp } = k.lift;
  let f: number;
  let phase: 'bottom' | 'up' | 'top' | 'down';
  if (p < 6) { f = 0; phase = 'bottom'; }
  else if (p < 14) { const u = (p - 6) / 8; f = u * u * (3 - 2 * u); phase = 'up'; }
  else if (p < 20) { f = 1; phase = 'top'; }
  else { const u = (p - 20) / 8; f = 1 - u * u * (3 - 2 * u); phase = 'down'; }
  out[0] = b[0] + (tp[0] - b[0]) * f;
  out[1] = b[1] + (tp[1] - b[1]) * f + Math.sin(f * Math.PI) * 1.2;
  out[2] = b[2] + (tp[2] - b[2]) * f;
  return phase;
}

/** Which island (if any) has (x, z) on its top. */
export function islandAt(k: Kingdom, x: number, z: number, y: number): IslandId | null {
  let best: IslandId | null = null;
  let bestDy = Infinity;
  for (const i of Object.values(k.islands)) {
    const dx = (x - i.x) / i.rx, dz = (z - i.z) / i.rz;
    if (dx * dx + dz * dz > 1.05) continue;
    const dy = Math.abs(y - i.y);
    if (dy < bestDy) { bestDy = dy; best = i.id; }
  }
  return best;
}

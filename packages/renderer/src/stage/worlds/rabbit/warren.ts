import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import { DAY_LENGTH, GATHER_SECONDS, NOON, gatherAt, type DayState } from '../daycycle';
import { rng } from '../three/glsl';
import { along, clampTo, exitsOf, kingdomOf, liftAt, routeBetween, type Act, type IslandId, type Kingdom, type Link, type Spot, type V3 } from './kingdom';

/**
 * The warren: everyone who lives in the cloud kingdom, each a character with
 * a look, a temper and a routine of its own.
 *
 * Bansaree (the teacher) and Deep (the one with the enormous glasses) are the
 * crew: while a run plays they hop to the cells each step is about and act it
 * out, explaining and peering. Lin, Tao and Yuki are the students: they come to
 * the front to watch a run and take notes, sit at the school's desks when
 * Bansaree teaches, and at night put their bags down beside their beds. The
 * rest live their days: Yash at the gym, Manas at his computer (or dozing
 * near it), Manan with his guitar (at noon he goes to the village campfire
 * and the others drift over to listen, dance and chat), Tirrth roaming in his
 * green hat and keeping half an eye on where Dishi goes, Dishi slipping away
 * when she notices, Aastha wandering, Siddhant turning up wherever Aastha
 * happens to be (now and then), Deep peering at things and tripping over his
 * own feet once in a while.
 *
 * Nothing is scripted to the second: each rabbit picks what to do next from
 * its own weighted routine, with its own random stream, so no two days look
 * alike and the relationships only show if you watch for a while.
 *
 * Unlike the stage this is a small simulation stepped by ambient time: the
 * rabbits walk about on the kingdom's graph (kingdom.ts), crossing bridges,
 * hopping stepping clouds, riding the lift, sliding and bouncing.
 */

export type Accessory =
  | 'scarf' | 'bow' | 'hat' | 'crown' | 'glasses' | 'flowers' | 'apron' | 'headband' | 'backpack'
  | 'tank' | 'sweatband' | 'wristbands' | 'hoodie' | 'specs' | 'beanie' | 'fedora' | 'chain' | 'shades' | 'jacket'
  | 'cardigan' | 'pearls' | 'bun' | 'bigglasses' | 'bowtie' | 'dress' | 'blush' | 'cap' | 'clip';

/** How the body is built: an ordinary rabbit, a gym rabbit, a comfortable one, a cartoon (big head, small body). */
export type Build = 'normal' | 'muscle' | 'chubby' | 'cartoon';

export interface BunnyLook {
  fur: string;
  belly: string;
  inner: string;
  /** A second coat colour for patches (null: plain). */
  patch: string | null;
  lop: boolean;
  scale: number;
  acc: Accessory[];
  accColor: string;
  /** Colours for particular accessories (the rest use accColor). */
  colors?: Partial<Record<Accessory, string>>;
  build?: Build;
  /** A bare head of this colour (no fur on top). */
  skin?: string;
  /** Ear length (1: ordinary). */
  ears?: number;
  /** Leaning forward (a slouch, > 0) or back (chest out, < 0). */
  slouch?: number;
  /** Struts: a little roll of the head with every hop. */
  swagger?: boolean;
  /** What it carries about: a school bag, or a guitar (slung on its back, played in front). */
  gear?: { kind: 'bag' | 'guitar'; color: string; trim: string };
  /** A student's notebook cover. */
  book?: string;
}

export type Role = 'crew' | 'student' | 'resident';

/** What it does at the noon gathering (one at a time, now and then another). */
export type FireMood = 'listen' | 'dance' | 'chat' | 'clap' | 'watch' | 'sit' | 'nap';

type Weighted<T> = [T, number][];

export interface BunnyInfo {
  name: string;
  role: Role;
  look: BunnyLook;
  /** The day's routine: a list of stages taken in turn, each a weighted choice of what to do. */
  cycle: Weighted<Act>[];
  /** Stays up at night, with these things to do (null: goes to bed). */
  owl: Weighted<Act> | null;
  /** Where it sleeps: 'sleep' (the dozy cloud) or 'village'. */
  home: IslandId;
  /** Walking speed (units / s). */
  speed: number;
  /** How long an activity lasts (seconds, min and max). */
  stay: [number, number];
  /** What it likes doing at the noon gathering, and the chance it misses it altogether. */
  fire: Weighted<FireMood>;
  skipFire: number;
  /** Chance it does not come over to watch a run (students and crew always do). */
  skipWatch: number;
  /** Trips over its own feet now and then. */
  clumsy?: boolean;
}

const L = (fur: string, belly: string, o: Partial<BunnyLook> = {}): BunnyLook => ({ fur, belly, inner: '#f6b4c4', patch: null, lop: false, scale: 0.86, acc: [], accColor: '#ff8fb1', ...o });

/** The crew first (Bansaree, Deep), then everyone else. */
export const WARREN: BunnyInfo[] = [
  {
    name: 'Bansaree', role: 'crew',
    look: L('#ecdccb', '#fbf4ec', { scale: 0.95, acc: ['cardigan', 'pearls', 'bun'], accColor: '#b497f0', colors: { pearls: '#fffaf0', bun: '#e2cdb8' } }),
    cycle: [[['teach', 1]], [['teach', 0.7], ['read', 0.3]], [['roam', 0.45], ['garden', 0.2], ['shop', 0.2], ['fountain', 0.15]], [['teach', 1]]],
    owl: null, home: 'village', speed: 1.7, stay: [40, 80],
    fire: [['listen', 0.45], ['chat', 0.35], ['clap', 0.2]], skipFire: 0.1, skipWatch: 0,
  },
  {
    name: 'Deep', role: 'crew',
    look: L('#c9a27c', '#f1e2cf', { scale: 0.9, build: 'cartoon', acc: ['bigglasses', 'bowtie'], accColor: '#2f2a44', colors: { bowtie: '#ff6f6f' } }),
    cycle: [[['explore', 0.75], ['roam', 0.25]], [['explore', 0.5], ['bench', 0.25], ['fountain', 0.25]], [['roam', 0.6], ['explore', 0.4]]],
    owl: null, home: 'village', speed: 1.5, stay: [14, 28],
    fire: [['dance', 0.4], ['clap', 0.3], ['watch', 0.3]], skipFire: 0.15, skipWatch: 0, clumsy: true,
  },
  {
    name: 'Yash', role: 'resident',
    look: L('#8a6248', '#e7cdb0', { scale: 1.06, build: 'muscle', slouch: -0.08, acc: ['tank', 'sweatband', 'wristbands'], accColor: '#ff5a5f', colors: { wristbands: '#ffffff', sweatband: '#ffffff' } }),
    cycle: [[['weights', 0.65], ['stretch', 0.35]], [['jumps', 0.35], ['practice', 0.4], ['weights', 0.25]], [['cooldown', 0.75], ['rest', 0.25]], [['roam', 0.55], ['bounce', 0.25], ['climb', 0.2]]],
    owl: null, home: 'village', speed: 2.2, stay: [24, 48],
    fire: [['dance', 0.55], ['clap', 0.3], ['chat', 0.15]], skipFire: 0.15, skipWatch: 0.25,
  },
  {
    name: 'Manas', role: 'resident',
    look: L('#d8d3cc', '#f6f2ec', { scale: 1.0, build: 'chubby', slouch: 0.12, acc: ['hoodie', 'specs'], accColor: '#5a7bd8', colors: { specs: '#2b2b3a' } }),
    cycle: [[['computer', 1]], [['lounge', 0.6], ['rest', 0.4]], [['computer', 0.6], ['lounge', 0.4]], [['wander', 0.55], ['eat', 0.45]]],
    owl: [['computer', 0.8], ['lounge', 0.2]], home: 'sleep', speed: 1.15, stay: [45, 90],
    fire: [['sit', 0.6], ['nap', 0.25], ['listen', 0.15]], skipFire: 0.35, skipWatch: 0.4,
  },
  {
    name: 'Manan', role: 'resident',
    look: L('#f1e6d8', '#fffaf3', { scale: 0.92, acc: ['beanie'], accColor: '#ff9f43', gear: { kind: 'guitar', color: '#c47a3a', trim: '#5a3a22' } }),
    cycle: [[['music', 1]], [['roam', 0.55], ['listen', 0.45]], [['music', 1]], [['roam', 0.7], ['chat', 0.3]]],
    owl: [['music', 0.7], ['roam', 0.3]], home: 'sleep', speed: 1.7, stay: [30, 60],
    fire: [['dance', 1]], skipFire: 0, skipWatch: 0.2,
  },
  {
    name: 'Tirrth', role: 'resident',
    look: L('#bfb3a8', '#efe8e0', { scale: 0.95, skin: '#f0c9a6', ears: 0.5, acc: ['fedora'], accColor: '#2f9e4f' }),
    cycle: [[['roam', 1]], [['explore', 0.6], ['roam', 0.4]], [['bench', 0.3], ['fountain', 0.25], ['rest', 0.2], ['roam', 0.25]]],
    owl: null, home: 'village', speed: 1.8, stay: [10, 24],
    fire: [['watch', 0.45], ['sit', 0.35], ['clap', 0.2]], skipFire: 0.1, skipWatch: 0.25,
  },
  {
    name: 'Aastha', role: 'resident',
    look: L('#fff7fa', '#ffffff', { scale: 0.6, inner: '#ffaec4', acc: ['bow', 'blush'], accColor: '#ff8fb1' }),
    cycle: [[['wander', 1]], [['observe', 1]], [['bench', 0.35], ['rest', 0.2], ['fountain', 0.2], ['sniff', 0.25]], [['roam', 0.5], ['garden', 0.25], ['roll', 0.25]]],
    owl: null, home: 'sleep', speed: 1.55, stay: [10, 22],
    fire: [['sit', 0.5], ['watch', 0.3], ['clap', 0.2]], skipFire: 0.15, skipWatch: 0.25,
  },
  {
    name: 'Siddhant', role: 'resident',
    look: L('#4a4046', '#d8cfd4', { scale: 0.96, swagger: true, acc: ['jacket', 'chain', 'shades'], accColor: '#2a2638', colors: { chain: '#ffcf3a', shades: '#141218' } }),
    cycle: [[['roam', 0.8], ['shop', 0.2]], [['explore', 0.6], ['roam', 0.4]], [['drift', 0.45], ['roam', 0.35], ['rest', 0.2]]],
    owl: [['roam', 1]], home: 'village', speed: 1.75, stay: [10, 24],
    fire: [['dance', 0.5], ['chat', 0.3], ['watch', 0.2]], skipFire: 0.15, skipWatch: 0.3,
  },
  {
    name: 'Dishi', role: 'resident',
    look: L('#f6c9a8', '#fff1e4', { scale: 0.8, lop: true, acc: ['flowers', 'dress', 'blush'], accColor: '#ff6fa8' }),
    cycle: [[['roam', 0.6], ['explore', 0.4]], [['garden', 0.35], ['sniff', 0.25], ['bounce', 0.15], ['slide', 0.15], ['balloon', 0.1]], [['rest', 0.35], ['bench', 0.3], ['roll', 0.35]], [['roam', 1]]],
    owl: null, home: 'sleep', speed: 1.8, stay: [16, 32],
    fire: [['dance', 0.4], ['chat', 0.35], ['clap', 0.25]], skipFire: 0.1, skipWatch: 0.25,
  },
  {
    name: 'Lin', role: 'student',
    look: L('#ffffff', '#fff6f8', { scale: 0.72, acc: ['scarf'], accColor: '#f2c14e', gear: { kind: 'bag', color: '#d4553f', trim: '#8f2f22' }, book: '#2f6db5' }),
    cycle: [[['study', 0.55], ['roam', 0.45]], [['bounce', 0.3], ['slide', 0.3], ['climb', 0.2], ['practice', 0.2]], [['eat', 0.3], ['chat', 0.3], ['read', 0.4]]],
    owl: null, home: 'sleep', speed: 1.9, stay: [24, 45],
    fire: [['dance', 0.4], ['clap', 0.35], ['chat', 0.25]], skipFire: 0.05, skipWatch: 0,
  },
  {
    name: 'Tao', role: 'student',
    look: L('#a7764d', '#e9d3b5', { scale: 0.74, acc: ['cap'], accColor: '#e0a43a', gear: { kind: 'bag', color: '#3d7cc0', trim: '#244d7c' }, book: '#e0a43a' }),
    cycle: [[['study', 0.65], ['read', 0.35]], [['roam', 0.6], ['explore', 0.4]], [['practice', 0.4], ['gaze', 0.3], ['harvest', 0.3]]],
    owl: null, home: 'sleep', speed: 1.8, stay: [24, 45],
    fire: [['listen', 0.45], ['chat', 0.35], ['clap', 0.2]], skipFire: 0.05, skipWatch: 0,
  },
  {
    name: 'Yuki', role: 'student',
    look: L('#dcdce6', '#f7f7fb', { scale: 0.7, lop: true, acc: ['clip'], accColor: '#8a4fb0', gear: { kind: 'bag', color: '#e3b43a', trim: '#a8811f' }, book: '#8a4fb0' }),
    cycle: [[['roam', 0.45], ['roll', 0.2], ['balloon', 0.35]], [['study', 0.55], ['sniff', 0.45]], [['bounce', 0.4], ['slide', 0.3], ['chat', 0.3]]],
    owl: null, home: 'sleep', speed: 1.9, stay: [20, 40],
    fire: [['dance', 0.5], ['clap', 0.3], ['chat', 0.2]], skipFire: 0.05, skipWatch: 0,
  },
];

export const CREW = 2;

export type Gait = 'stand' | 'hop' | 'slide' | 'leap' | 'float' | 'ride';
export type Pose =
  | 'idle' | 'sit' | 'eat' | 'dig' | 'sniff' | 'sleep' | 'read' | 'gaze' | 'chat' | 'hold'
  | 'cheer' | 'inspect' | 'push' | 'tap' | 'point' | 'nod' | 'startle' | 'shrug' | 'present' | 'watch'
  | 'lift' | 'stretch' | 'jumps' | 'type' | 'nap' | 'lazy' | 'guitar' | 'sing' | 'teach' | 'notes' | 'raise' | 'ponder'
  | 'adjust' | 'stumble' | 'dance' | 'listen' | 'cool' | 'hide' | 'drink' | 'roll' | 'peer' | 'wave' | 'clap' | 'look';

/** Every pose (for tests and tools). */
export const POSES: Pose[] = [
  'idle', 'sit', 'eat', 'dig', 'sniff', 'sleep', 'read', 'gaze', 'chat', 'hold', 'cheer', 'inspect', 'push', 'tap', 'point', 'nod', 'startle', 'shrug', 'present', 'watch',
  'lift', 'stretch', 'jumps', 'type', 'nap', 'lazy', 'guitar', 'sing', 'teach', 'notes', 'raise', 'ponder', 'adjust', 'stumble', 'dance', 'listen', 'cool', 'hide', 'drink', 'roll', 'peer', 'wave', 'clap', 'look',
];

/** What a rabbit is holding (drawn by the layer). */
export type Held = 'balloon' | 'lantern' | 'book' | 'carrot' | 'telescope' | 'dumbbell' | 'bottle' | 'pointer' | 'notebook' | null;

/** Where its bag or guitar is: on its back, in its paws (the guitar, playing), or put down beside it (asleep). */
export type GearAt = 'worn' | 'play' | 'aside';

type Leg =
  | { kind: 'walk'; x: number; z: number }
  | { kind: 'cross'; link: Link; reverse: boolean };

export type Intent = 'free' | 'home' | 'sleep' | 'audience' | 'crew' | 'fire';

export interface Bunny {
  info: BunnyInfo;
  index: number;
  // Where it is and how it is moving.
  island: IslandId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  gait: Gait;
  /** Hop cycle, counting up (the fraction is how far through a hop). */
  hop: number;
  /** Height of the current hop (0 when not hopping). */
  air: number;
  pose: Pose;
  held: Held;
  gear: GearAt;
  /** How far through a one-off move it is (a stumble, a roll), 0..1. */
  cue: number;
  /** A point it is looking at (head turns towards it), or null. */
  look: V3 | null;
  // What it is doing.
  plan: Leg[];
  legT: number;
  riding: boolean;
  spot: Spot | null;
  /** When (ambient seconds) the current activity ends, how long it means to stay once there, and when it got there. */
  until: number;
  stayFor: number;
  since: number;
  /** Why it is going where it is going. */
  intent: Intent;
  /** The cheer it gives when a run finishes (ambient seconds). */
  cheerAt: number;
  rand: () => number;
  /** Where it is in its routine (which stage comes next). */
  stage: number;
  /** Speed for the current trip (running away is quick, following someone is slow). */
  rush: number;
  /** A mood for a while (at the gathering), and when it changes. */
  mood: Pose | null;
  moodUntil: number;
  /** Moments: a stumble, a start (seen something), the next look round. */
  stumbleAt: number;
  startleAt: number;
  nextCheck: number;
  /** Tirrth's tailing of Dishi: until when, and when he next looks where she went. */
  chase: { until: number; next: number } | null;
  /** The noon gathering: which day it was planned for, when it joins and leaves (seconds after noon), whether it goes at all. */
  fireDay: number;
  join: number;
  leave: number;
  skipFire: boolean;
  /** Watching a run: when it heads over (seconds after the run started) and whether it comes at all. */
  watchDelay: number;
  skipWatch: boolean;
  /** Nods off during this session at the desk. */
  dozy: boolean;
  /** Trips to another island so far, and where the latest one goes (others can notice). */
  trips: number;
  tripTo: IslandId;
  /** Which of someone's trips it last noticed. */
  seen: number;
}

export interface WarrenInput {
  model: StageModel;
  sample: StageSample;
  now: number;
  dt: number;
  day: DayState;
  playing: boolean;
  /** True while the crew should be at work (playing, or a step is shown and the run rested only briefly). */
  working: boolean;
  calm: boolean;
}

const HOP_LEN = 0.62;
const STEP_HOP = 0.58;
const SLIDE_SPEED = 7;
/** How long one of Deep's stumbles takes, start to finish (glasses straightened). */
export const STUMBLE = 2.4;

/** The play slide on the play cloud (in the spot's own frame: z along its face). */
export const PLAY_SLIDE = { ladder: -1.3, top: 2.1, end: 2.2 };
/** The academy's obstacle course: an oval round the spot with hurdles at these angles. */
export const COURSE = { rx: 2.4, rz: 1.5, hurdles: [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5], period: 10 };

/** Spots a rabbit sits exactly at (a desk, a bench in the gym): no shuffle on arrival. */
const EXACT = new Set<Act>(['stroll', 'practice', 'computer', 'lounge', 'study', 'teach', 'weights', 'cooldown', 'music', 'stretch', 'jumps']);
/** Activities that are just a pause on the way (a rabbit doing one is open to a chat). */
const LOOSE = new Set<Act>(['roam', 'wander', 'explore', 'observe', 'stroll', 'drift', 'roll']);

export function local(s: Spot, lx: number, lz: number): [number, number] {
  const c = Math.cos(s.face), sn = Math.sin(s.face);
  return [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
}

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function pick<T>(list: Weighted<T>, r: number): T {
  let total = 0;
  for (const [, w] of list) total += w;
  let x = r * total;
  for (const [v, w] of list) {
    x -= w;
    if (x <= 0) return v;
  }
  return list[list.length - 1][0];
}

const reversed = new WeakMap<Link, V3[]>();
function ptsOf(l: Link, reverse: boolean): V3[] {
  if (!reverse) return l.pts;
  let r = reversed.get(l);
  if (!r) {
    r = [...l.pts].reverse();
    reversed.set(l, r);
  }
  return r;
}

const _p: V3 = [0, 0, 0];

export class Warren {
  readonly bunnies: Bunny[];
  readonly kingdom: Kingdom;
  /** Seconds the run has been resting (the audience drifts off after a while), and how long the audience has been gathering. */
  private restFor = 1e9;
  private watchFor = 0;
  private lastK = -1;
  private byName = new Map<string, Bunny>();

  constructor(readonly model: StageModel, day: DayState) {
    this.kingdom = kingdomOf(model);
    const k = this.kingdom;
    const taken = new Set<Spot>();
    this.bunnies = WARREN.map((info, index) => {
      const rand = rng(hashName(info.name));
      const b: Bunny = {
        info, index, island: 'plaza', x: k.cx, y: k.floorY, z: k.cz, yaw: 0,
        gait: 'stand', hop: 0, air: 0, pose: 'idle', held: null, gear: 'worn', cue: 0, look: null,
        plan: [], legT: 0, riding: false, spot: null, until: 0, stayFor: 0, since: 0, intent: 'free', cheerAt: -100, rand,
        stage: Math.floor(rand() * info.cycle.length), rush: 1, mood: null, moodUntil: 0,
        stumbleAt: -100, startleAt: -100, nextCheck: 10 + rand() * 30, chase: null,
        fireDay: -1, join: 0, leave: 0, skipFire: false, watchDelay: 0, skipWatch: false, dozy: false,
        trips: 0, tripTo: 'plaza', seen: 0,
      };
      this.byName.set(info.name, b);
      // Start somewhere fitting for the time of day, already there.
      const asleep = day.night > 0.55 && !info.owl;
      const acts = info.owl && day.night > 0.55 ? info.owl : info.cycle[b.stage % info.cycle.length];
      const spot = asleep ? this.bedFor(b, taken) : this.spotFor(b, pick(acts, rand()), taken);
      if (spot) {
        taken.add(spot);
        b.island = spot.island;
        const jitter = EXACT.has(spot.act) ? 0 : 0.4;
        b.x = spot.x + (rand() - 0.5) * jitter;
        b.z = spot.z + (rand() - 0.5) * jitter;
        b.y = k.islands[spot.island].y;
        b.yaw = spot.face;
        b.spot = spot;
        b.until = 10 + rand() * 30;
        b.intent = asleep ? 'sleep' : 'free';
        b.tripTo = spot.island;
        if (asleep) b.gear = 'aside';
      }
      return b;
    });
  }

  /** A rabbit by name (for the relationships between them). */
  who(name: string): Bunny | undefined {
    return this.byName.get(name);
  }

  /** The bed a rabbit sleeps in (the same one every night). */
  private bedFor(b: Bunny, taken: Set<Spot>): Spot | null {
    const beds = this.kingdom.spots.filter((s) => s.act === 'sleep' && s.island === b.info.home);
    const free = beds.filter((s) => !taken.has(s));
    const list = free.length ? free : beds;
    return list[(b.index * 7) % Math.max(1, list.length)] ?? null;
  }

  private occupied(): Set<Spot> {
    const s = new Set<Spot>();
    for (const b of this.bunnies) if (b.spot) s.add(b.spot);
    return s;
  }

  /** A place for `act`: one of the kingdom's spots, or (for the things done anywhere) a point made up on the way. */
  private spotFor(b: Bunny, act: Act, taken = this.occupied()): Spot | null {
    const k = this.kingdom;
    const r = b.rand;
    const point = (island: IslandId, reach: number, a: Act, face = r() * Math.PI * 2): Spot => {
      const i = k.islands[island];
      const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * reach;
      const [x, z] = clampTo(i, i.x + Math.cos(ang) * i.rx * d, i.z + Math.sin(ang) * i.rz * d, 0.8);
      return { island, x, z, face, act: a };
    };
    const near = (o: Bunny, dmin: number, dmax: number, a: Act): Spot => {
      const i = k.islands[o.island];
      const ang = r() * Math.PI * 2, d = dmin + r() * (dmax - dmin);
      const [x, z] = clampTo(i, o.x + Math.cos(ang) * d, o.z + Math.sin(ang) * d, 0.8);
      return { island: o.island, x, z, face: Math.atan2(o.x - x, o.z - z), act: a };
    };
    const ids = Object.keys(k.islands) as IslandId[];
    // Here and the islands one crossing away (most trips are short ones).
    const nearby = [b.island, ...exitsOf(k, b.island).filter((e) => e.link.kind !== 'lift').map((e) => e.to)];
    switch (act) {
      case 'roam': {
        // Somewhere else in the kingdom: mostly nearby, now and then far off (Tirrth, now and then, wherever Dishi is).
        const dishi = this.who('Dishi');
        if (b.info.name === 'Tirrth' && dishi && r() < 0.2) return point(dishi.island, 0.6, 'roam');
        const others = ids.filter((id) => id !== b.island && (id !== 'lookout' || r() < 0.3));
        const island = r() < 0.6 || !others.length ? nearby[Math.floor(r() * nearby.length)] : others[Math.floor(r() * others.length)];
        return point(island, 0.65, 'roam');
      }
      case 'wander': {
        // Mostly round where it is, sometimes over to the next island.
        const next = exitsOf(k, b.island).filter((e) => e.link.kind !== 'lift');
        const island = r() < 0.7 || !next.length ? b.island : next[Math.floor(r() * next.length)].to;
        return point(island, 0.7, 'wander');
      }
      case 'roll': return point(b.island === 'plaza' || b.island === 'lookout' ? 'garden' : b.island, 0.55, 'roll');
      case 'observe': {
        // Someone nearby to watch for a while (from a little way off).
        const o = this.nearest(b, 14, true);
        return o ? near(o, 2.2, 3.4, 'observe') : point(b.island, 0.7, 'wander');
      }
      case 'explore': {
        // Something to look at closely: a stall, a flower, a trampoline, a telescope.
        const skip: Act[] = ['sleep', 'study', 'teach', 'computer', 'lounge', 'watch', 'stroll'];
        const close = r() < 0.7;
        const all = k.spots.filter((s) => !skip.includes(s.act) && (s.island !== 'lookout' || r() < 0.3));
        const near = all.filter((s) => nearby.includes(s.island));
        const things = close && near.length ? near : all;
        const s = things[Math.floor(r() * things.length)];
        const i = k.islands[s.island];
        const a = r() * Math.PI * 2;
        const [x, z] = clampTo(i, s.x + Math.cos(a) * 0.9, s.z + Math.sin(a) * 0.9, 0.85);
        return { island: s.island, x, z, face: Math.atan2(s.x - x, s.z - z), act: 'explore' };
      }
      case 'listen': {
        // Manan stops by wherever Bansaree is (not too close), listens a little, goes back to his music.
        const t = this.who('Bansaree');
        if (t && t.intent === 'free' && t.island !== 'lookout') return near(t, 2.6, 3.8, 'listen');
        return this.spotFor(b, 'music', taken);
      }
      case 'drift': {
        // Siddhant ends up where Aastha is: somewhere on her island, never right beside her.
        const a = this.who('Aastha');
        if (a && a.intent !== 'sleep') return r() < 0.5 ? near(a, 3, 5.5, 'drift') : point(a.island, 0.65, 'drift');
        return point(b.island, 0.6, 'roam');
      }
      default: {
        // One of the kingdom's places (a favourite if free; the busy ones can be shared).
        // The nearer ones more often than the far ones.
        const options = k.spots.filter((s) => s.act === act && (!taken.has(s) || act === 'stroll'));
        const cost = (s: Spot) => Math.hypot(s.x - b.x, s.z - b.z) + Math.abs(k.islands[s.island].y - b.y) * 2;
        options.sort((a, c) => cost(a) - cost(c));
        if (options.length) return options[Math.floor(Math.pow(r(), 1.8) * options.length)];
        return point(b.island, 0.65, 'roam');
      }
    }
  }

  /** Plans a way from where the rabbit is to (island, x, z). */
  private goTo(b: Bunny, island: IslandId, x: number, z: number): void {
    const legs: Leg[] = [];
    // A rabbit in the middle of a crossing finishes it first.
    const keep = b.plan.length && b.plan[0].kind === 'cross' && b.legT > 0 ? b.plan[0] : null;
    let from = b.island, px = b.x, pz = b.z;
    if (keep && keep.kind === 'cross') {
      from = keep.reverse ? keep.link.a : keep.link.b;
      const end = keep.reverse ? keep.link.pts[0] : keep.link.pts[keep.link.pts.length - 1];
      px = end[0];
      pz = end[2];
      legs.push(keep);
    }
    for (const step of routeBetween(this.kingdom, from, island, px, pz)) {
      const start = step.reverse ? step.link.pts[step.link.pts.length - 1] : step.link.pts[0];
      legs.push({ kind: 'walk', x: start[0], z: start[2] });
      legs.push({ kind: 'cross', link: step.link, reverse: step.reverse });
    }
    const [cx, cz] = clampTo(this.kingdom.islands[island], x, z);
    legs.push({ kind: 'walk', x: cx, z: cz });
    if (!keep) b.legT = 0;
    b.plan = legs;
    if (island !== b.island) {
      b.trips++;
      b.tripTo = island;
    }
  }

  private send(b: Bunny, spot: Spot, intent: Intent, now: number, stay: number, rush = 1): void {
    b.spot = spot;
    b.intent = intent;
    b.until = now + stay;
    b.stayFor = stay;
    b.rush = rush;
    b.mood = null;
    const jitter = EXACT.has(spot.act) || intent === 'fire' || intent === 'audience' ? 0 : 0.35;
    this.goTo(b, spot.island, spot.x + (b.rand() - 0.5) * jitter, spot.z + (b.rand() - 0.5) * jitter);
  }

  /** Picks what to do next from the rabbit's routine (its next stage, now and then any stage at all). */
  private choose(b: Bunny, input: WarrenInput): void {
    const { now, day } = input;
    const info = b.info;
    let list: Weighted<Act>;
    if (day.night > 0.55 && info.owl) list = info.owl;
    else {
      const stage = b.rand() < 0.15 ? Math.floor(b.rand() * info.cycle.length) : b.stage++;
      list = info.cycle[stage % info.cycle.length];
    }
    // A lesson draws the students: when Bansaree is at the board they would much rather be at a desk.
    if (info.role === 'student' && this.lesson()) list = list.map(([a, w]): [Act, number] => [a, a === 'study' ? w * 4 + 0.6 : w]);
    const spot = this.spotFor(b, pick(list, b.rand()));
    if (!spot) return;
    const [lo, hi] = info.stay;
    let stay = lo + b.rand() * (hi - lo);
    if (spot.act === 'roam' || spot.act === 'wander') stay = 5 + b.rand() * 9;
    else if (LOOSE.has(spot.act)) stay = 10 + b.rand() * 12;
    else if (spot.act === 'listen') stay = 8 + b.rand() * 12;
    // Manas nods off at his desk now and then (more likely late at night).
    b.dozy = spot.act === 'computer' && b.rand() < (day.night > 0.6 ? 0.8 : 0.3);
    this.send(b, spot, 'free', now, stay);
    // Siddhant, drifting past: by the spot near her and on to his own.
    if (spot.act === 'drift' && b.rand() < 0.4) {
      const a = this.who('Aastha');
      if (a && a.island === spot.island) {
        const [px, pz] = clampTo(this.kingdom.islands[a.island], a.x + 1.1, a.z + 0.8, 0.8);
        const last = b.plan.pop();
        b.plan.push({ kind: 'walk', x: px, z: pz });
        if (last) b.plan.push(last);
      }
    }
  }

  /** True while Bansaree is at the board (a lesson is on). */
  private lesson(): boolean {
    const t = this.who('Bansaree');
    return !!t && t.spot?.act === 'teach' && !t.plan.length && t.intent === 'free';
  }

  /** Where member `i` of the audience sits round the structures (two rows in front and at the sides, facing in). */
  private seat(i: number, n: number): Spot {
    const k = this.kingdom;
    const row = i % 2;
    const j = Math.floor(i / 2);
    const per = Math.ceil(n / 2);
    const a = Math.PI * (0.06 + 0.88 * ((j + 0.5 + row * 0.5) / (per + 0.5)));
    const rx = k.clearX + 1.3 + row * 1.25, rz = k.clearZ + 1.1 + row * 1.2;
    const x = k.cx + Math.cos(a) * rx, z = k.cz + Math.sin(a) * rz;
    return { island: 'plaza', x, z, face: Math.atan2(k.cx - x, k.cz - z), act: 'watch' };
  }

  /** The seats in order of how good the view is (the front row's middle first). */
  private seats(n: number): Spot[] {
    const k = this.kingdom;
    const all = Array.from({ length: n }, (_, i) => ({ s: this.seat(i, n), row: i % 2 }));
    all.sort((a, b) => a.row - b.row || Math.abs(a.s.x - k.cx) - Math.abs(b.s.x - k.cx));
    return all.map((a) => a.s);
  }

  /** A place in the ring round the campfire (Manan stands at its back, facing out, with his guitar). */
  private fireSpot(b: Bunny): Spot {
    const [fx, , fz] = this.kingdom.fire;
    if (b.info.name === 'Manan') return { island: 'village', x: fx, z: fz - 1.5, face: 0, act: 'campfire' };
    // Round the front and the sides (the back is the musician's), alternating a near and a far ring.
    const a = Math.PI * (0.62 + 1.76 * ((b.index * 0.618) % 1)) + (b.rand() - 0.5) * 0.12;
    const r = 2.1 + (b.index % 2) * 0.65;
    const x = fx + Math.sin(a) * r, z = fz - Math.cos(a) * r;
    return { island: 'village', x, z, face: Math.atan2(fx - x, fz - z), act: 'campfire' };
  }

  update(input: WarrenInput): void {
    const { now, dt, day, playing, working, sample } = input;
    const restWas = this.restFor;
    this.restFor = playing ? 0 : this.restFor + dt;
    const audience = playing || this.restFor < 8;
    const started = audience && restWas >= 8;
    this.watchFor = audience ? this.watchFor + dt : 0;
    const finished = !playing && sample.k === this.model.frameCount - 1 && sample.k !== this.lastK;
    if (sample.k !== this.lastK) this.lastK = sample.k;
    const kind = this.model.frames[Math.max(0, Math.min(sample.k, this.model.frameCount - 1))]?.event.kind;
    const settling = kind === 'settle' && sample.tau < 1.4;
    const night = day.night > 0.55;
    const evening = !night && day.phase > 0.41 && day.phase < 0.5;
    const gather = gatherAt(day);
    // Seconds since noon (negative in the morning): the gathering runs from the musician's walk over to the last to leave.
    const sinceNoon = (day.phase - NOON) * DAY_LENGTH;

    // A run starts: who comes over to watch, and how soon each notices.
    if (started) {
      for (const b of this.bunnies) {
        const sure = b.info.role !== 'resident';
        b.skipWatch = !sure && b.rand() < b.info.skipWatch;
        b.watchDelay = sure ? b.rand() * 1.5 : 0.5 + b.rand() * 6;
      }
    }
    const watchers = audience ? this.bunnies.filter((b) => b.info.role !== 'crew' && !b.skipWatch && (!night || !!b.info.owl)) : [];
    watchers.sort((a, b) => (a.info.role === 'student' ? 0 : 1) - (b.info.role === 'student' ? 0 : 1) || a.index - b.index);
    const seats = this.seats(watchers.length);

    for (const b of this.bunnies) {
      const info = b.info;
      // Wake a little apart from each other in the morning.
      const awake = !night || !!info.owl;
      const wakeUp = day.day > 0.25 + ((b.index * 37) % 10) / 22;
      // The noon gathering: a new plan for it each day (who goes, who is late, who slips off early).
      if (b.fireDay !== gather.day) {
        b.fireDay = gather.day;
        const lead = info.name === 'Manan';
        b.join = lead ? -14 : 5 + b.rand() * 40;
        b.leave = GATHER_SECONDS + (b.rand() < 0.2 ? -15 - b.rand() * 35 : b.rand() * 30);
        b.skipFire = !lead && b.rand() < info.skipFire;
      }
      const atFire = !night && !b.skipFire && sinceNoon >= b.join && sinceNoon < b.leave;
      const seatAt = watchers.indexOf(b);

      if (info.role === 'crew' && working) {
        if (b.intent !== 'crew') {
          b.intent = 'crew';
          b.spot = null;
          b.chase = null;
          b.rush = 1;
          if (b.island !== 'plaza') this.goTo(b, 'plaza', this.kingdom.cx, this.kingdom.cz + this.kingdom.clearZ);
          else b.plan = [];
        }
      } else if (seatAt >= 0 && this.watchFor >= b.watchDelay) {
        const seat = seats[seatAt];
        if (b.intent !== 'audience' || !b.spot || Math.hypot(b.spot.x - seat.x, b.spot.z - seat.z) > 0.6) {
          this.send(b, seat, 'audience', now, 1e9);
          b.chase = null;
          b.gear = 'worn';
        }
        if (finished) b.cheerAt = now + b.rand() * 0.6;
      } else {
        if (b.intent === 'crew' || b.intent === 'audience') {
          // Back to its own day.
          b.intent = 'free';
          b.until = now;
        }
        if (!awake && b.intent !== 'sleep') {
          const bed = this.bedFor(b, this.occupied());
          b.chase = null;
          if (bed) this.send(b, bed, 'sleep', now, 1e9, 0.85);
        } else if (b.intent === 'sleep' && awake && wakeUp) {
          b.intent = 'free';
          b.until = now;
          b.gear = 'worn';
        } else if (atFire && b.intent !== 'fire' && b.intent !== 'sleep') {
          b.chase = null;
          this.send(b, this.fireSpot(b), 'fire', now, 1e9, info.name === 'Manan' ? 1.15 : 1);
        } else if (!atFire && b.intent === 'fire') {
          b.intent = 'free';
          b.until = now;
          b.mood = null;
        } else if (evening && !info.owl && b.intent === 'free' && now >= b.until && !b.plan.length) {
          // Evening: head back towards home and wind down there.
          const homeActs: Act[] = info.home === 'sleep' ? ['rest', 'sleep', 'lounge'] : ['bench', 'chat'];
          const spot = this.kingdom.spots.find((s) => s.island === info.home && homeActs.includes(s.act) && !this.occupied().has(s));
          if (spot) this.send(b, spot, 'home', now, 1e9, 0.8);
        } else if (b.intent === 'home' && !evening && !night) {
          b.intent = 'free';
          b.until = now;
        }
        if (b.intent === 'free') this.notice(b, input);
        if (b.intent === 'free' && now >= b.until && !b.plan.length) this.choose(b, input);
      }
      this.step(b, input, settling, seatAt);
    }
  }

  /**
   * The little things a free rabbit notices: Tirrth catching sight of Dishi (and tagging along for a while,
   * from a distance, until he loses her), Dishi noticing him (and slipping off, or not), Siddhant seeing
   * Aastha head off somewhere (and, once in a while, finding a reason to go that way too), two rabbits
   * who stop near each other having a chat.
   */
  private notice(b: Bunny, input: WarrenInput): void {
    const { now } = input;
    const k = this.kingdom;
    const r = b.rand;
    const name = b.info.name;
    if (name === 'Tirrth') {
      const d = this.who('Dishi');
      if (!d) return;
      const free = d.intent === 'free';
      if (b.chase) {
        if (!free || now > b.chase.until) {
          b.chase = null;
          b.until = now;
        } else if (now >= b.chase.next) {
          b.chase.next = now + 4 + r() * 4;
          const dist = Math.hypot(d.x - b.x, d.z - b.z);
          if (d.island !== b.island && r() < 0.35) {
            // Lost her: back to his own wandering.
            b.chase = null;
            b.until = now;
          } else if (dist > 5 || d.island !== b.island) {
            const i = k.islands[d.island];
            const a = Math.atan2(b.x - d.x, b.z - d.z) + (r() - 0.5) * 1.6;
            const off = 3.4 + r() * 1.6;
            const [x, z] = clampTo(i, d.x + Math.sin(a) * off, d.z + Math.cos(a) * off, 0.8);
            this.send(b, { island: d.island, x, z, face: Math.atan2(d.x - x, d.z - z), act: 'follow' }, 'free', now, b.chase.until - now, 0.85);
          }
        }
      } else if (free && now >= b.nextCheck) {
        b.nextCheck = now + 30 + r() * 45;
        if (r() < (d.island === b.island ? 0.55 : 0.25)) b.chase = { until: now + 20 + r() * 30, next: now };
      }
      return;
    }
    if (name === 'Dishi') {
      const t = this.who('Tirrth');
      if (!t?.chase || t.island !== b.island || now < b.nextCheck) return;
      if (Math.hypot(t.x - b.x, t.z - b.z) > 7.5) return;
      b.nextCheck = now + 9 + r() * 12;
      const x = r();
      const i = k.islands[b.island];
      if (x < 0.3) {
        // Off to another island altogether (whichever way is open from here: a bridge, the slide, the drop).
        const away = exitsOf(k, b.island).filter((e) => e.link.kind !== 'lift');
        const to = away.length ? away[Math.floor(r() * away.length)].to : b.island;
        const ti = k.islands[to];
        const ang = r() * Math.PI * 2;
        const [sx, sz] = clampTo(ti, ti.x + Math.cos(ang) * ti.rx * 0.5, ti.z + Math.sin(ang) * ti.rz * 0.5, 0.8);
        this.send(b, { island: to, x: sx, z: sz, face: r() * 6.28, act: 'roam' }, 'free', now, 6 + r() * 8, 1.7);
        b.startleAt = now;
      } else if (x < 0.55) {
        // Hop away to the far side of this island.
        const a = Math.atan2(b.x - t.x, b.z - t.z) + (r() - 0.5) * 0.8;
        const [sx, sz] = clampTo(i, i.x + Math.sin(a) * i.rx * 0.75, i.z + Math.cos(a) * i.rz * 0.75, 0.8);
        this.send(b, { island: b.island, x: sx, z: sz, face: a, act: 'wander' }, 'free', now, 5 + r() * 6, 1.45);
        b.startleAt = now;
      } else if (x < 0.72) {
        // Duck behind something: the island's place farthest from him, on its far side.
        let best: Spot | null = null, bd = -1;
        for (const s of k.spots) {
          if (s.island !== b.island) continue;
          const d = Math.hypot(s.x - t.x, s.z - t.z);
          if (d > bd) { bd = d; best = s; }
        }
        if (best) {
          const a = Math.atan2(best.x - t.x, best.z - t.z);
          const [sx, sz] = clampTo(i, best.x + Math.sin(a) * 0.9, best.z + Math.cos(a) * 0.9, 0.85);
          this.send(b, { island: b.island, x: sx, z: sz, face: a + Math.PI, act: 'hide' }, 'free', now, 8 + r() * 8, 1.3);
          b.startleAt = now;
        }
      }
      // Otherwise she pays him no mind.
      return;
    }
    if (name === 'Siddhant') {
      const a = this.who('Aastha');
      if (a && a.trips !== b.seen) {
        b.seen = a.trips;
        // She's off somewhere; once in a while he finds he has business there too (and gets there a bit after).
        if (a.intent === 'free' && a.tripTo !== b.island && b.island === a.island && !b.plan.length && r() < 0.2) {
          const i = k.islands[a.tripTo];
          const ang = r() * Math.PI * 2;
          const [x, z] = clampTo(i, i.x + Math.cos(ang) * i.rx * 0.6, i.z + Math.sin(ang) * i.rz * 0.6, 0.8);
          this.send(b, { island: a.tripTo, x, z, face: r() * 6.28, act: 'drift' }, 'free', now, 8 + r() * 10, 0.9);
          return;
        }
      }
    }
    // A chat with whoever has stopped nearby (not too often).
    if (now < b.nextCheck || b.plan.length || !b.spot || !LOOSE.has(b.spot.act)) return;
    b.nextCheck = now + 14 + r() * 20;
    for (const o of this.bunnies) {
      if (o === b || o.intent !== 'free' || o.plan.length || o.island !== b.island || !o.spot || !LOOSE.has(o.spot.act)) continue;
      if (o.info.name === 'Tirrth' || o.info.name === 'Dishi') continue;
      if (Math.hypot(o.x - b.x, o.z - b.z) > 3 || r() > 0.55) continue;
      const until = now + 6 + r() * 7;
      for (const [p, q] of [[b, o], [o, b]] as const) {
        p.spot = { island: p.island, x: p.x, z: p.z, face: Math.atan2(q.x - p.x, q.z - p.z), act: 'chat' };
        p.until = until;
        p.nextCheck = until + 25 + r() * 20;
      }
      break;
    }
  }

  /** The crew's station for this step, and how to stand there. */
  private station(b: Bunny, input: WarrenInput): { x: number; z: number; face: number; pose: Pose; look: V3 | null } {
    const { model, sample } = input;
    const k = this.kingdom;
    const i = b.index;
    const step = Math.max(0, Math.min(sample.k, model.frameCount - 1));
    const ev = model.frames[step]?.event;
    const actors: number[] = [];
    if (ev && step > 0) {
      for (const id of ev.actors) {
        const s = model.slotOf.get(id);
        if (s !== undefined && sample.presence[s] > 0.05 && !actors.includes(s)) actors.push(s);
        if (actors.length === 2) break;
      }
    }
    const homeX = k.cx + (i === 0 ? -1 : 1) * Math.max(1.4, k.clearX * 0.35);
    const homeZ = k.cz + k.clearZ + 0.4;
    if (!actors.length) return { x: homeX, z: homeZ, face: Math.PI + (i === 0 ? 0.25 : -0.25), pose: 'idle', look: null };
    const slot = actors[Math.min(i, actors.length - 1)];
    const nx = sample.pos[slot * 3], ny = sample.pos[slot * 3 + 1], nz = sample.pos[slot * 3 + 2];
    const dz = sample.dims[slot * 3 + 2];
    const shared = actors.length < 2;
    const x = nx + (shared ? (i === 0 ? -0.42 : 0.42) : 0);
    const z = nz + dz / 2 + 0.55 + (shared && i === 1 ? 0.25 : 0);
    let pose = poseFor(ev!.kind, ev!.relation);
    // Deep looks at everything up close.
    if (b.info.clumsy && (pose === 'inspect' || pose === 'point')) pose = 'peer';
    return { x, z, face: Math.PI, pose, look: [nx, ny, nz] };
  }

  private step(b: Bunny, input: WarrenInput, settling: boolean, seatAt: number): void {
    const { now, dt, calm, day } = input;
    const k = this.kingdom;
    b.look = null;
    b.held = null;
    b.cue = 0;
    let pose: Pose = 'idle';
    let moving = false;
    const t = now + b.index * 3.7;
    const face = (yaw: number, rate = 4) => (b.yaw += wrap(yaw - b.yaw) * Math.min(1, dt * rate));
    const name = b.info.name;

    if (b.intent === 'crew' && b.island === 'plaza' && (!b.plan.length || b.plan[0].kind === 'walk')) {
      // At work: hop straight to the station (it moves with the step).
      const st = this.station(b, input);
      b.plan = [];
      const [sx, sz] = clampTo(k.islands.plaza, st.x, st.z, 0.95);
      const d = Math.hypot(sx - b.x, sz - b.z);
      if (calm || d < 0.04) {
        b.x = sx;
        b.z = sz;
      }
      if (d > 0.04 && !calm) {
        const v = Math.min(d, Math.max(3.2, d * 2.5) * dt);
        b.x += ((sx - b.x) / d) * v;
        b.z += ((sz - b.z) / d) * v;
        b.yaw += wrap(Math.atan2(sx - b.x, sz - b.z) - b.yaw) * Math.min(1, dt * 12);
        moving = d > 0.12;
      }
      if (!moving) {
        b.yaw += wrap(st.face - b.yaw) * Math.min(1, dt * 6);
        pose = settling ? 'cheer' : st.pose;
        b.look = st.look;
        if (name === 'Bansaree' && (pose === 'point' || pose === 'tap' || pose === 'present' || pose === 'inspect')) b.held = 'pointer';
      }
      b.y = k.islands.plaza.y;
      b.gait = moving ? 'hop' : 'stand';
      b.air = moving ? 0.22 : 0;
      if (moving) b.hop += (dt * Math.max(3.2, d * 2.5)) / HOP_LEN;
      b.pose = moving ? 'idle' : pose;
      return;
    }

    // Deep, mid-stumble: down he goes, a moment sat on the cloud, up again, glasses straightened.
    if (now - b.stumbleAt < STUMBLE && !calm) {
      b.cue = (now - b.stumbleAt) / STUMBLE;
      b.gait = 'stand';
      b.air = 0;
      b.pose = 'stumble';
      return;
    }
    // Dishi, the moment she notices: a start, a glance his way, then off.
    if (now - b.startleAt < 0.7 && b.plan.length && !calm) {
      const tt = this.who('Tirrth');
      b.gait = 'stand';
      b.air = 0;
      b.pose = 'startle';
      if (tt) {
        b.look = [tt.x, tt.y + 0.6, tt.z];
        face(Math.atan2(tt.x - b.x, tt.z - b.z), 8);
      }
      return;
    }

    if (b.plan.length) {
      this.follow(b, input);
      b.pose = b.gait === 'float' ? 'cheer' : 'idle';
      if (b.gear === 'play') b.gear = 'worn';
      // Things carried about: the teacher's book; a lantern for the night owls.
      if (name === 'Bansaree') b.held = 'book';
      else if (b.info.owl && day.night > 0.4 && !b.info.look.gear) b.held = 'lantern';
      return;
    }
    if (b.gear !== 'worn' && b.intent !== 'sleep') b.gear = 'worn';

    // At its spot, doing its thing.
    b.gait = 'stand';
    b.air = 0;
    b.y = k.islands[b.island].y;
    const s = b.spot;
    if (!s) {
      b.pose = 'idle';
      return;
    }
    const there = now - b.since;
    switch (s.act) {
      case 'eat': pose = 'eat'; b.held = 'carrot'; face(s.face); break;
      case 'harvest': pose = 'dig'; face(s.face); if (Math.sin(t * 0.7) > 0.8) b.held = 'carrot'; break;
      case 'garden': pose = 'dig'; face(s.face); break;
      case 'sniff': {
        pose = 'sniff';
        // Little hops from bloom to bloom.
        const c = (t / 4) % 1;
        if (c > 0.82) {
          const u = (c - 0.82) / 0.18;
          b.air = Math.sin(u * Math.PI) * 0.3;
          b.gait = 'hop';
          b.hop = Math.floor(t / 4) + u;
        }
        face(s.face + Math.sin(Math.floor(t / 4) * 2.4) * 0.8);
        break;
      }
      case 'bounce': {
        // Up and down on the trampoline, with a flip now and then.
        const c = (t / 1.0) % 1;
        b.y += 0.42 + Math.sin(c * Math.PI) * 1.7;
        b.gait = 'leap';
        b.hop = t;
        b.x += (s.x - b.x) * Math.min(1, dt * 3);
        b.z += (s.z - b.z) * Math.min(1, dt * 3);
        face(s.face + t * 0.4);
        pose = c > 0.3 && c < 0.7 ? 'cheer' : 'idle';
        break;
      }
      case 'slide': this.slideLoop(b, s, t, dt); return;
      case 'practice': this.course(b, s, now + (b.index % 2) * COURSE.period * 0.5, dt); return;
      case 'climb': {
        const c = (t / 8) % 1;
        const up = Math.min(1, Math.max(0, Math.min(c / 0.15, (1 - c) / 0.15)));
        const a = c * Math.PI * 2;
        b.x = s.x + Math.cos(a) * 0.7 * up;
        b.z = s.z + Math.sin(a) * 0.7 * up;
        b.y += up * 1.45 + (up > 0 && up < 1 ? Math.sin(up * Math.PI) * 0.4 : 0);
        b.yaw = a + Math.PI;
        b.gait = up > 0 && up < 1 ? 'leap' : 'stand';
        b.hop = t;
        pose = up >= 1 ? 'cheer' : 'idle';
        break;
      }
      case 'balloon': pose = 'hold'; b.held = 'balloon'; b.y += 0.12 + Math.sin(t * 1.3) * 0.12; face(s.face + Math.sin(t * 0.4) * 0.6); break;
      case 'shop': case 'chat': {
        // Talking, with a wave or a nod now and then.
        const c = (t / 9) % 1;
        pose = c < 0.1 ? 'wave' : c > 0.55 && c < 0.68 ? 'nod' : 'chat';
        face(s.face + Math.sin(t * 0.3) * 0.3);
        break;
      }
      case 'fountain': case 'bench': case 'rest': {
        pose = 'sit';
        face(s.face);
        if (name === 'Siddhant') pose = 'cool';
        else if (b.info.clumsy && (t / 11) % 1 < 0.15) pose = 'adjust';
        else if (name === 'Yash' && (t / 7) % 1 < 0.3) { pose = 'drink'; b.held = 'bottle'; }
        break;
      }
      case 'read': pose = 'read'; b.held = 'book'; face(s.face); break;
      case 'gaze': pose = 'gaze'; face(s.face); b.held = 'telescope'; break;
      case 'sleep': pose = b.intent === 'sleep' ? 'sleep' : 'sit'; face(s.face); if (b.intent === 'sleep') b.gear = 'aside'; break;
      case 'watch': this.watching(b, s, now, t, settling, seatAt, face); return;
      case 'stroll': {
        // Wander the island: a new point every little while.
        const i = k.islands[b.island];
        const a = b.rand() * Math.PI * 2, r = 0.25 + b.rand() * 0.5;
        this.goTo(b, b.island, i.x + Math.cos(a) * i.rx * r, i.z + Math.sin(a) * i.rz * r);
        b.pose = 'idle';
        return;
      }
      // The gym.
      case 'weights': {
        // Sets of curls, a breather between them (a shake of the arms, a look round).
        const c = (t / 14) % 1;
        pose = c < 0.72 ? 'lift' : c < 0.85 ? 'stretch' : 'look';
        if (pose === 'lift') b.held = 'dumbbell';
        face(s.face);
        break;
      }
      case 'stretch': pose = (t / 10) % 1 < 0.8 ? 'stretch' : 'look'; face(s.face); break;
      case 'jumps': {
        // Jumping jacks, then hops on the spot, then a breather.
        const c = (t / 12) % 1;
        pose = c < 0.5 ? 'jumps' : c < 0.85 ? 'idle' : 'look';
        if (c >= 0.5 && c < 0.85) {
          const u = (t * 2.2) % 1;
          b.y += Math.sin(u * Math.PI) * 0.35;
          b.gait = 'leap';
          b.hop = t * 2.2;
        }
        face(s.face);
        break;
      }
      case 'cooldown': {
        const c = (t / 9) % 1;
        pose = c < 0.25 ? 'drink' : c < 0.85 ? 'sit' : 'stretch';
        if (pose === 'drink') b.held = 'bottle';
        face(s.face);
        break;
      }
      // Manas's desk: typing, a long look at the screen, a stretch; and now and then his head drops onto the desk.
      case 'computer': {
        const c = (t / 16) % 1;
        pose = c < 0.62 ? 'type' : c < 0.85 ? 'look' : c < 0.93 ? 'stretch' : 'type';
        if (b.dozy && there > 22) pose = 'nap';
        if (pose === 'type' || pose === 'look') {
          const [lx, lz] = local(s, 0, 0.75);
          b.look = [lx, b.y + 0.62, lz];
        }
        face(s.face);
        break;
      }
      case 'lounge': {
        b.y += 0.2;
        pose = name === 'Manas' && there > 30 ? 'nap' : (t / 13) % 1 < 0.8 ? 'lazy' : 'stretch';
        face(s.face);
        break;
      }
      case 'music': {
        const c = (t / 20) % 1;
        if (b.info.look.gear?.kind === 'guitar') {
          pose = c < 0.55 ? 'guitar' : c < 0.85 ? 'sing' : 'idle';
          if (pose !== 'idle') b.gear = 'play';
        } else pose = c < 0.5 ? 'listen' : 'clap';
        face(s.face + Math.sin(t * 0.2) * 0.3);
        break;
      }
      case 'teach': this.teaching(b, s, t, dt); return;
      case 'study': this.studying(b, s, t); return;
      // Things done anywhere.
      case 'roam':
      case 'wander': {
        // A pause to look about (and, wandering, a sudden change of mind about where to go next).
        pose = (t / 5) % 1 < 0.4 ? 'look' : 'idle';
        face(s.face + Math.sin(t * 0.5) * 0.6, 2);
        if (s.act === 'wander' && !calm && b.rand() < dt * 0.12) b.until = now;
        break;
      }
      case 'roll': {
        // Rolling about on the grass (a slow drift round the spot, sitting up between rolls).
        const c = (t / 6) % 1;
        pose = c < 0.6 ? 'roll' : 'sit';
        if (c < 0.6) {
          b.cue = c / 0.6;
          const a = s.face + Math.floor(t / 6) * 1.3;
          const [tx, tz] = clampTo(k.islands[b.island], s.x + Math.sin(a) * c * 1.2, s.z + Math.cos(a) * c * 1.2, 0.85);
          b.x += (tx - b.x) * Math.min(1, dt * 3);
          b.z += (tz - b.z) * Math.min(1, dt * 3);
          b.yaw = a;
        }
        break;
      }
      case 'observe': {
        // Sits and watches someone, head following them about.
        pose = (t / 12) % 1 < 0.7 ? 'sit' : 'look';
        const o = this.nearest(b, 9, false);
        if (o) {
          b.look = [o.x, o.y + 0.5, o.z];
          face(Math.atan2(o.x - b.x, o.z - b.z), 1.5);
        } else face(s.face);
        break;
      }
      case 'explore': {
        // Deep peers at it, pushes his glasses up, peers again; the others just have a good look.
        const c = (t / 10) % 1;
        if (b.info.clumsy) pose = c < 0.45 ? 'peer' : c < 0.6 ? 'adjust' : c < 0.85 ? 'inspect' : 'look';
        else pose = c < 0.5 ? 'inspect' : c < 0.75 ? 'look' : name === 'Siddhant' ? 'cool' : 'sniff';
        face(s.face);
        break;
      }
      case 'listen': {
        // Manan near Bansaree: listens for a bit (a word or two, now and then).
        const o = this.who('Bansaree');
        pose = (t / 8) % 1 < 0.75 ? 'listen' : 'chat';
        if (o && o.island === b.island) {
          b.look = [o.x, o.y + 0.6, o.z];
          face(Math.atan2(o.x - b.x, o.z - b.z), 2);
        } else face(s.face);
        break;
      }
      case 'drift': {
        // Siddhant, being cool about it (he is not looking at her, mostly).
        pose = (t / 9) % 1 < 0.6 ? 'cool' : 'look';
        const a = this.who('Aastha');
        if (a && a.island === b.island && (t / 23) % 1 < 0.18) b.look = [a.x, a.y + 0.4, a.z];
        face(s.face + Math.sin(t * 0.3) * 0.5, 2);
        break;
      }
      case 'follow': {
        // Tirrth, a little way off: busy looking at anything else, with the odd glance her way.
        const d = this.who('Dishi');
        pose = (t / 7) % 1 < 0.5 ? 'look' : 'idle';
        if (d && d.island === b.island && (t / 6) % 1 < 0.35) b.look = [d.x, d.y + 0.5, d.z];
        face(s.face + Math.sin(t * 0.4) * 0.7, 2);
        break;
      }
      case 'hide': {
        // Crouched behind something, peeking out now and then.
        pose = 'hide';
        const tt = this.who('Tirrth');
        if (tt && (t / 4) % 1 < 0.4) b.look = [tt.x, tt.y + 0.5, tt.z];
        face(s.face);
        break;
      }
      case 'campfire': this.atFire(b, s, now, t, face); return;
    }
    if (calm) b.air = 0;
    b.pose = pose;
  }

  /** The nearest other rabbit on the same island within `within` (awake ones only, if asked). */
  private nearest(b: Bunny, within: number, awake = true): Bunny | null {
    let best: Bunny | null = null, bd = within;
    for (const o of this.bunnies) {
      if (o === b || o.island !== b.island || (awake && o.intent === 'sleep')) continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** In the audience: the students take notes (each at its own pace); everyone else watches, chats a little, cheers at the end. */
  private watching(b: Bunny, s: Spot, now: number, t: number, settling: boolean, seatAt: number, face: (y: number, r?: number) => void): void {
    face(s.face);
    const crew = this.bunnies[(b.index + Math.floor(t / 9)) % CREW];
    b.look = [crew.x, crew.y + 0.5, crew.z];
    let pose: Pose = 'watch';
    if (b.info.role === 'student') {
      const c = ((t + b.index * 2.3) / (13 + b.index)) % 1;
      pose = c < 0.45 ? 'notes' : c < 0.7 ? 'watch' : c < 0.82 ? 'ponder' : c < 0.88 && b.index % 2 ? 'raise' : 'notes';
      if (pose === 'notes') {
        b.held = 'notebook';
        b.look = null;
      }
    } else {
      const c = ((t + seatAt * 1.7) / 17) % 1;
      if (c > 0.8 && c < 0.88) {
        // A word with the neighbour.
        pose = 'chat';
        b.look = null;
      } else if (b.info.name === 'Manas') pose = c < 0.15 ? 'adjust' : 'watch';
      else if (b.info.name === 'Siddhant') pose = 'cool';
    }
    if ((now < b.cheerAt + 2.2 && now > b.cheerAt) || settling) pose = 'cheer';
    b.pose = pose;
  }

  /** At the campfire: Manan plays and sings; the others listen, dance, clap, chat or just sit, and change their minds now and then. */
  private atFire(b: Bunny, s: Spot, now: number, t: number, face: (y: number, r?: number) => void): void {
    const [fx, fy, fz] = this.kingdom.fire;
    b.y = fy;
    b.gait = 'stand';
    if (b.info.name === 'Manan') {
      face(s.face);
      b.pose = (t / 18) % 1 < 0.6 ? 'guitar' : 'sing';
      b.gear = 'play';
      return;
    }
    if (!b.mood || now >= b.moodUntil) {
      b.mood = pick(b.info.fire, b.rand());
      b.moodUntil = now + 14 + b.rand() * 18;
    }
    const manan = this.who('Manan');
    let yaw = Math.atan2(fx - b.x, fz - b.z);
    if (b.mood === 'dance') {
      // A little dance on the spot: bobbing, a turn this way and that.
      b.y = fy + Math.abs(Math.sin(t * 5.6)) * 0.16;
      yaw += Math.sin(t * 0.9) * 0.9;
    } else if (b.mood === 'chat') {
      const o = this.nearest(b, 3.5);
      if (o) yaw = Math.atan2(o.x - b.x, o.z - b.z);
    } else if (manan && manan.intent === 'fire' && b.mood !== 'nap') b.look = [manan.x, manan.y + 0.6, manan.z];
    face(yaw, 3);
    b.pose = b.mood;
  }

  /** At the board: teaching when there are students (walking round to look at their work), reading or writing on the board when not. */
  private teaching(b: Bunny, s: Spot, t: number, dt: number): void {
    const k = this.kingdom;
    const students = this.bunnies.filter((o) => o.info.role === 'student' && o.spot?.act === 'study' && !o.plan.length && o.intent === 'free');
    b.y = k.islands.plaza.y;
    let tx = s.x, tz = s.z, yaw = s.face;
    let pose: Pose;
    if (!students.length) {
      // No class: some reading, some writing on the board.
      const c = (t / 20) % 1;
      if (c < 0.55) { pose = 'read'; b.held = 'book'; }
      else { pose = 'tap'; b.held = 'pointer'; yaw = s.face + Math.PI; }
    } else {
      const P = 34;
      const c = (t % P) / P;
      const who = students[Math.floor(t / P) % students.length];
      const [dx, dz] = local(who.spot!, 0.75, 0.15);
      if (c < 0.32) {
        // At the board, explaining: turns to point at it, turns back to the class.
        const sub = ((c / 0.32) * 3) % 1;
        if (sub < 0.4) { pose = 'teach'; yaw = s.face + Math.PI; b.held = 'pointer'; }
        else if (sub < 0.7) { pose = 'present'; b.held = 'pointer'; }
        else pose = 'chat';
      } else if (c < 0.45) {
        tx = dx; tz = dz; pose = 'idle';
      } else if (c < 0.72) {
        // Beside a student's desk: a look at the notes, a nod.
        tx = dx; tz = dz;
        pose = c < 0.57 ? 'peer' : 'nod';
        yaw = Math.atan2(who.x - dx, who.z - dz);
        b.look = [who.x, who.y + 0.3, who.z];
      } else if (c < 0.85) {
        pose = 'idle';
      } else {
        pose = 'present';
        b.held = 'book';
      }
    }
    const d = Math.hypot(tx - b.x, tz - b.z);
    if (d > 0.05) {
      const v = Math.min(d, b.info.speed * 0.8 * dt);
      b.x += ((tx - b.x) / d) * v;
      b.z += ((tz - b.z) / d) * v;
      b.yaw += wrap(Math.atan2(tx - b.x, tz - b.z) - b.yaw) * Math.min(1, dt * 8);
      b.gait = 'hop';
      b.air = 0.18;
      b.hop += v / HOP_LEN;
      b.pose = 'idle';
      b.look = null;
      return;
    }
    b.yaw += wrap(yaw - b.yaw) * Math.min(1, dt * 4);
    b.pose = pose;
  }

  /** At a desk: notes, reading, a hand up (only when the teacher is there), a think. Each student at its own pace. */
  private studying(b: Bunny, s: Spot, t: number): void {
    const teacher = this.who('Bansaree');
    const lesson = this.lesson();
    b.yaw = s.face;
    const c = ((t + b.index * 1.9) / (11 + b.index * 0.7)) % 1;
    let pose: Pose;
    if (c < 0.42) { pose = 'notes'; b.held = 'notebook'; }
    else if (c < 0.66) { pose = 'read'; b.held = 'book'; }
    else if (c < 0.78) pose = lesson ? 'watch' : 'ponder';
    else if (c < 0.86) pose = lesson && b.index % 3 !== 1 ? 'raise' : 'ponder';
    else { pose = 'notes'; b.held = 'notebook'; }
    if (lesson && teacher && pose === 'watch') b.look = [teacher.x, teacher.y + 0.6, teacher.z];
    b.pose = pose;
  }

  /** The play slide: up the ladder, a sit at the top, whoosh down, and hop round to the ladder again. */
  private slideLoop(b: Bunny, s: Spot, t: number, dt: number): void {
    const P = 7;
    const c = (t % P) / P * P;
    const y0 = this.kingdom.islands[b.island].y;
    let lz: number, ly: number, lx = 0;
    b.gait = 'stand';
    b.pose = 'idle';
    if (c < 2) { lz = PLAY_SLIDE.ladder; ly = (c / 2) * PLAY_SLIDE.top; b.gait = 'hop'; b.hop = c * 3; b.air = 0.05; }
    else if (c < 2.6) { lz = PLAY_SLIDE.ladder + 0.3; ly = PLAY_SLIDE.top; b.pose = 'cheer'; }
    else if (c < 3.6) { const u = (c - 2.6); lz = PLAY_SLIDE.ladder + 0.3 + u * (PLAY_SLIDE.end - PLAY_SLIDE.ladder - 0.3); ly = PLAY_SLIDE.top * (1 - u) * (1 - u * 0.15); b.gait = 'slide'; }
    else { const u = (c - 3.6) / 3.4; const a = u * Math.PI; lx = Math.sin(a) * 1.2; lz = PLAY_SLIDE.end + (PLAY_SLIDE.ladder - PLAY_SLIDE.end) * u; ly = 0; b.gait = 'hop'; b.hop = c * 1.6; b.air = 0.2; }
    const [x, z] = local(s, lx, lz);
    const yaw = c >= 3.6 ? s.face + Math.PI + Math.cos((c - 3.6) / 3.4 * Math.PI) * 0.8 : s.face;
    b.yaw += wrap(yaw - b.yaw) * Math.min(1, dt * 8);
    b.x = x;
    b.z = z;
    b.y = y0 + Math.max(0, ly);
  }

  /** Laps of the obstacle course: a hop over each hurdle. */
  private course(b: Bunny, s: Spot, t: number, dt: number): void {
    const c = (t % COURSE.period) / COURSE.period;
    const a = c * Math.PI * 2;
    const [x, z] = [s.x + Math.cos(a) * COURSE.rx, s.z + Math.sin(a) * COURSE.rz];
    let jump = 0;
    for (const h of COURSE.hurdles) {
      const d = wrap(a - h);
      if (Math.abs(d) < 0.38) jump = Math.max(jump, Math.cos((d / 0.38) * Math.PI / 2) * 0.95);
    }
    b.x = x;
    b.z = z;
    b.y = this.kingdom.islands[b.island].y + jump;
    b.yaw += wrap(Math.atan2(-Math.sin(a) * COURSE.rx, Math.cos(a) * COURSE.rz) - b.yaw) * Math.min(1, dt * 10);
    b.gait = jump > 0.02 ? 'leap' : 'hop';
    b.hop = t * 2.2;
    b.air = jump > 0.02 ? 0 : 0.22;
    b.pose = jump > 0.5 ? 'cheer' : 'idle';
  }

  /** Moves along the plan. */
  private follow(b: Bunny, input: WarrenInput): void {
    const { dt, now, calm, day } = input;
    const k = this.kingdom;
    const leg = b.plan[0];
    const hurry = b.intent === 'crew' || b.intent === 'audience' ? 1.7 : b.rush;
    // Slower in the dark.
    const speed = b.info.speed * hurry * (1 - 0.25 * day.night);
    if (leg.kind === 'walk') {
      const dx = leg.x - b.x, dz = leg.z - b.z;
      const d = Math.hypot(dx, dz);
      const v = calm ? d : Math.min(d, speed * dt);
      if (d > 1e-4) {
        b.x += (dx / d) * v;
        b.z += (dz / d) * v;
        b.yaw += wrap(Math.atan2(dx, dz) - b.yaw) * Math.min(1, dt * 9);
      }
      b.y = k.islands[b.island].y;
      b.gait = 'hop';
      // Running is low and quick; strolling is high and bouncy.
      b.air = hurry > 1.3 ? 0.16 : 0.24;
      b.hop += (v / HOP_LEN) * (hurry > 1.3 ? 1.2 : 1);
      // Deep, now and then, trips over nothing at all.
      if (b.info.clumsy && !calm && b.intent === 'free' && d > 1 && b.rand() < dt * 0.015) b.stumbleAt = now;
      if (d - v < 0.02) {
        b.plan.shift();
        b.legT = 0;
        if (!b.plan.length) {
          // There: the stay starts now (however long the trip took).
          b.gait = 'stand';
          b.since = now;
          b.rush = 1;
          if (b.intent === 'free') b.until = Math.max(b.until, now + Math.min(b.stayFor, 1e6));
        }
      }
      return;
    }
    const { link, reverse } = leg;
    const pts = ptsOf(link, reverse);
    b.legT += calm ? 1e3 : dt;
    let done = false;
    switch (link.kind) {
      case 'rainbow':
      case 'cloud': {
        const d = b.legT * speed;
        const yaw = along(pts, d, _p);
        b.x = _p[0]; b.y = _p[1]; b.z = _p[2];
        b.yaw += wrap(yaw - b.yaw) * Math.min(1, dt * 9);
        b.gait = 'hop';
        b.air = 0.22;
        b.hop += (speed * dt) / HOP_LEN;
        done = d >= link.length;
        break;
      }
      case 'steps':
      case 'platforms': {
        // One hop per pad, a short pause on each (shorter when in a hurry).
        const per = (STEP_HOP + 0.22) / Math.max(1, hurry * 0.85);
        const j = Math.floor(b.legT / per);
        const u = Math.min(1, (b.legT - j * per) / (per * 0.72));
        if (j >= pts.length - 1) { done = true; break; }
        const a = pts[j], c = pts[j + 1];
        const h = 0.75 + Math.max(0, c[1] - a[1]);
        b.x = a[0] + (c[0] - a[0]) * u;
        b.z = a[2] + (c[2] - a[2]) * u;
        b.y = a[1] + (c[1] - a[1]) * u + Math.sin(u * Math.PI) * h;
        b.yaw += wrap(Math.atan2(c[0] - a[0], c[2] - a[2]) - b.yaw) * Math.min(1, dt * 12);
        b.gait = u < 1 ? 'leap' : 'stand';
        b.hop = j + u;
        b.air = 0;
        break;
      }
      case 'slide': {
        const d = b.legT * (1.5 + b.legT * SLIDE_SPEED * 0.5);
        const yaw = along(pts, d, _p);
        b.x = _p[0]; b.y = _p[1] + 0.12; b.z = _p[2];
        b.yaw += wrap(yaw - b.yaw) * Math.min(1, dt * 10);
        b.gait = 'slide';
        b.air = 0;
        done = d >= link.length;
        break;
      }
      case 'bounce': {
        // Onto the trampoline, a big boing, and up in an arc to the plaza.
        const D = 2.6;
        const u = Math.min(1, b.legT / D);
        const [a, c] = pts;
        const apex = Math.max(a[1], c[1]) + 4.5;
        const yLine = a[1] + (c[1] - a[1]) * u;
        const lift = (apex - (a[1] + c[1]) / 2) * 4 * u * (1 - u);
        b.x = a[0] + (c[0] - a[0]) * u;
        b.z = a[2] + (c[2] - a[2]) * u;
        b.y = yLine + lift;
        b.yaw += wrap(Math.atan2(c[0] - a[0], c[2] - a[2]) - b.yaw) * Math.min(1, dt * 8);
        b.gait = 'leap';
        b.hop = u;
        b.air = 0;
        done = u >= 1;
        break;
      }
      case 'drop': {
        // A hop off the edge, then ears out and a slow drift down onto the cloud.
        const [a, c] = pts;
        const D = 4.2;
        const u = Math.min(1, b.legT / D);
        const out = Math.min(1, u / 0.15);
        const fall = u < 0.15 ? 0 : (u - 0.15) / 0.85;
        const ease = fall * (2 - fall);
        b.x = a[0] + (c[0] - a[0]) * (0.18 * out + 0.82 * ease) + Math.sin(u * 9) * 0.25 * (1 - u);
        b.z = a[2] + (c[2] - a[2]) * (0.18 * out + 0.82 * ease);
        b.y = a[1] + Math.sin(out * Math.PI * 0.5) * 0.7 * (1 - fall) + (c[1] - a[1]) * fall;
        b.yaw += wrap(Math.atan2(c[0] - a[0], c[2] - a[2]) - b.yaw) * Math.min(1, dt * 6);
        b.gait = u < 0.15 ? 'leap' : 'float';
        b.hop = u;
        b.air = 0;
        done = u >= 1;
        break;
      }
      case 'lift': {
        const want = reverse ? 'top' : 'bottom';
        const arrive = reverse ? 'bottom' : 'top';
        const phase = liftAt(k, now, _p);
        if (!b.riding) {
          // Waits at the landing until the basket is there, then steps in.
          const [lx, , lz] = pts[0];
          b.x += (lx - b.x) * Math.min(1, dt * 4);
          b.z += (lz - b.z) * Math.min(1, dt * 4);
          b.gait = 'stand';
          b.air = 0;
          if (phase === want || calm) b.riding = true;
        } else {
          b.x = _p[0] + Math.sin(b.index * 2.1) * 0.35;
          b.y = _p[1] + 0.32;
          b.z = _p[2] + Math.cos(b.index * 2.1) * 0.35;
          b.gait = 'ride';
          if (phase === arrive || calm) done = true;
        }
        if (calm) done = true;
        break;
      }
    }
    if (done) {
      const end = pts[pts.length - 1];
      b.x = end[0]; b.y = end[1]; b.z = end[2];
      b.island = reverse ? link.a : link.b;
      b.riding = false;
      b.plan.shift();
      b.legT = 0;
      b.gait = 'stand';
    }
  }
}

/** What the crew does for each kind of step. */
export function poseFor(kind: string, relation?: '<' | '>' | '='): Pose {
  switch (kind) {
    case 'compare': return relation === '=' ? 'nod' : 'inspect';
    case 'swap':
    case 'move': return 'push';
    case 'write':
    case 'link':
    case 'assign': return 'tap';
    case 'create': return 'present';
    case 'remove': return 'startle';
    case 'discard': return 'shrug';
    case 'visit':
    case 'traverse':
    case 'mark': return 'point';
    case 'settle': return 'cheer';
    default: return 'idle';
  }
}

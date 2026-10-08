import { SEATED_ACTS, SWING_RATE, type IdleAct } from './three/rigs';
import { ROLL_RADIUS } from './cast';

/**
 * What the animals do when nobody asks anything of them. Not a pure
 * function of time (a pause is not a moment in the run), so this lives
 * beside the stage rather than in it: while the run is stopped and the step
 * has settled, each animal is let off its station and goes about its own
 * business (wanders the ice, looks about, preens, shakes off the snow,
 * fetches a fish from the bucket or the fishing hole and eats it, plays with
 * its friend, pops into the igloo). The moment the run moves again it goes
 * back to its station and the script takes over.
 */

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Spots {
  bucket?: [number, number];
  hole?: [number, number];
  igloo?: { door: [number, number]; approach: [number, number]; center: [number, number] };
  /** Pandas: stalks to chew (the animal stands in front of each, `at`, facing `face`), the bamboo gym, the pond's edge. */
  snack?: { at: [number, number]; face: number }[];
  gym?: { base: [number, number]; top: [number, number]; deck: [number, number]; height: number; drop: [number, number] };
  pond?: { at: [number, number]; face: number };
  /** The slide: the foot of its ladder, the platform at the top (and its height), the end of the chute (and its height), where it lands. */
  slide?: { base: [number, number]; top: [number, number]; height: number; end: [number, number]; endHeight: number; land: [number, number] };
  /** The swing: where the seat hangs at rest (its height), which way it swings (the rider faces it), and where to stand to get on. */
  swing?: { seat: [number, number]; height: number; length: number; face: number; approach: [number, number] };
  /** The colony's own places (pandas): the fire, the gym yard, the beds, the desk, the classroom, the seats, the paths. */
  camp?: { x: number; z: number; seats: Perch[]; ring: Perch[]; stage: Perch };
  yard?: { jog: [number, number][]; lift: Perch; pull: Perch; punch: Perch; mat: Perch; squat: Perch; drink: Perch };
  beds?: (Perch & { approach: [number, number] })[];
  desk?: { seat: Perch };
  school?: { board: [number, number]; teacher: Perch; seats: Perch[] };
  nooks?: (Perch & { kind: string; table: boolean })[];
  paths?: [number, number][][];
  /** Penguins: the pool (an ellipse of open water, the places to get in and out, the diving ledge), the ice slide, crates of fish. */
  pool?: { x: number; z: number; rx: number; rz: number; entries: Perch[]; ledge: Perch };
  ramp?: { base: [number, number]; top: [number, number]; height: number; end: [number, number]; run: [number, number] };
  fish?: Perch[];
}

/** Somewhere to settle: where, how high the feet are there, and which way to face. */
export interface Perch {
  at: [number, number];
  y: number;
  face: number;
}

/** The noon gathering round the fire (see daycycle.ts). */
export interface Gathering {
  on: boolean;
  /** The musician should be getting to the fire. */
  soon: boolean;
  /** Which day's (a new gathering each day). */
  day: number;
}

/**
 * What makes one panda itself: how much it likes each thing to do (a multiplier on the weight of that choice, 0 never),
 * who it drifts towards, trails or avoids (by name), how sociable it is, whether it leads the music or the lessons.
 */
export interface Persona {
  likes?: Record<string, number>;
  /** Drifts about near this one now and then (never glued to it). */
  near?: { name: string; chance: number };
  /** Trails after this one now and then, at a distance. */
  follows?: string;
  /** Notices that one trailing after it, and gets away. */
  avoids?: string;
  /** Chance (0..1) that it comes to the noon gathering on a given day. */
  social?: number;
  musician?: boolean;
  teacher?: boolean;
  /** Multiplies how readily it goes to bed at night (a night owl: less). */
  sleepy?: number;
  /** Wears a school bag, which comes off before bed. */
  bag?: boolean;
  /** Now and then slips on the ice (0..1: how often). */
  clumsy?: number;
}

/** Something on the ground the animals walk round (a prop of the world). */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** A lesson the students attend while the run plays: where this one sits, which way it faces, and whether it is on. */
export interface Lesson {
  on: boolean;
  seat: [number, number];
  face: number;
  /** The run has just finished: applause. */
  cheer: boolean;
}

/**
 * Everyone in the grove that goes about its own business (the crew when it is
 * free, and the rest of the colony): so no two take the same swing, no two do
 * the same thing at the same moment, nobody walks through anybody, and the
 * swing knows who is on it.
 */
export class Colony {
  readonly members: IdleBrain[] = [];
  /** The swing's rider, and the ambient second it pushed off (the world draws the seat from it). */
  swing: { rider: IdleBrain | null; start: number; dur: number } = { rider: null, start: 0, dur: 0 };

  join(b: IdleBrain): void {
    if (!this.members.includes(b)) this.members.push(b);
  }

  leave(b: IdleBrain): void {
    const i = this.members.indexOf(b);
    if (i >= 0) this.members.splice(i, 1);
    if (this.swing.rider === b) this.swing.rider = null;
    this.slots.delete(b);
  }

  /** Someone else is busy at this (a place or a pastime). */
  doing(what: string, except: IdleBrain): boolean {
    return this.members.some((m) => m !== except && m.roaming && m.doing === what);
  }

  /** How many others are in the middle of this act right now. */
  acting(act: IdleAct, except: IdleBrain): number {
    let n = 0;
    for (const m of this.members) if (m !== except && m.act === act) n++;
    return n;
  }

  /** The member of the colony with this name. */
  find(name: string): IdleBrain | null {
    return this.members.find((m) => m.name === name) ?? null;
  }

  /** Where this one stands for the gathering: the first free place from its own favourite, kept till the gathering is over. */
  private slots = new Map<IdleBrain, number>();
  claim(b: IdleBrain, count: number): number {
    const had = this.slots.get(b);
    if (had !== undefined && had < count) return had;
    const used = new Set(this.slots.values());
    let k = (b.index * 5 + 3) % count;
    for (let i = 0; i < count && used.has(k); i++) k = (k + 1) % count;
    this.slots.set(b, k);
    return k;
  }

  release(b: IdleBrain): void {
    this.slots.delete(b);
  }

  /** Someone to play with (free, not busy), picked at random. */
  partner(except: IdleBrain, r: number): IdleBrain | null {
    // (The penguin crew keeps to its own corner of the ice: only the colony is asked.)
    const free = this.members.filter((m) => m !== except && m.approachable && m.roaming && !m.anchored && (m.style === 'panda' || m.role !== 'crew'));
    return free.length ? free[Math.floor(r * free.length) % free.length] : null;
  }
}

/** The swing's angle (radians from hanging straight down) t seconds into a ride of `dur` seconds. */
export function swingAngle(t: number, dur: number): number {
  if (t < 0 || t > dur) return 0;
  const amp = 0.55 * Math.min(1, t / 3.5) * Math.min(1, Math.max(0, (dur - t) / 3));
  return amp * Math.sin(t * SWING_RATE);
}

export type IdleStyle = 'penguin' | 'panda';

export interface IdleContext {
  /** The animal may roam (the run is stopped and the step is at rest). */
  free: boolean;
  /** Seconds it has been free. */
  freeFor: number;
  home: { x: number; z: number; yaw: number };
  /** A box round everything standing on the ice: animals keep out of it (null: nothing there). */
  keepOut: Box | null;
  /** Where animals may roam. */
  area: Box;
  spots: Spots | null;
  /** The far trips (the igloo, the fishing hole) are allowed. */
  far: boolean;
  partner?: IdleBrain;
  /** The viewer's animals may roam this far from their station. */
  radius: number;
  /** The rest of the grove (pandas). */
  colony?: Colony;
  /** 0..1: how deep into the night it is (pandas sleep, doze, gaze at the stars, chase fireflies, go about with lanterns). */
  night?: number;
  /** Ambient seconds (the swing's clock). */
  now?: number;
  /** Props to walk round. */
  obstacles?: Circle[];
  /** Where the colony roams: the whole clearing (an ellipse), rather than round the animal's station. */
  roam?: { cx: number; cz: number; rx: number; rz: number };
  /** The students' lesson. */
  lesson?: Lesson;
  /** The noon gathering round the fire. */
  gather?: Gathering;
}

export interface IdleOut {
  x: number;
  z: number;
  yaw: number;
  gait: 'stand' | 'walk' | 'glide' | 'roll' | 'climb' | 'tumble' | 'swim';
  gaitPhase: number;
  /** Height of the feet above the floor (on the bamboo gym's deck), the lean of a climb, and whether it is on a prop of the world (so no climbing gear is drawn). */
  y: number;
  climbSlope: number;
  onProp: boolean;
  /** Pandas: which snack stalk it is chewing (-1: none), so the grove can shake it. */
  stalk: number;
  gaitWeight: number;
  act: IdleAct;
  actT: number;
  actWeight: number;
  fish: number;
  /** 0..1: how far it has gone into the igloo (it shrinks into the doorway). */
  hide: number;
  /** True while it is anywhere but its station (the caller uses these values, not the script's). */
  away: boolean;
  /** Set when it takes a fish from the water (the world makes the splash). */
  splash: boolean;
  /** 0..1: sitting on its haunches (held across a run of seated acts). */
  seat: number;
  /** 0..1: its lantern is out and lit. */
  lamp: number;
  /** 1: its school bag is on its back; 0: taken off and put down beside it. */
  bag: number;
}

export type Task =
  | { k: 'walk'; x: number; z: number; speed: number; face?: number; t?: number; goal?: [number, number] }
  | { k: 'go'; x: number; z: number; speed: number }
  | { k: 'act'; act: IdleAct; dur: number; t: number; face?: number; fish?: 'eat' | 'take' | 'peer'; stalk?: number }
  | { k: 'sync'; t: number; timeout: number; face: number }
  | { k: 'hide'; dur: number; t: number }
  | { k: 'face'; yaw: number }
  | { k: 'splash' }
  | { k: 'ascend'; ax: number; az: number; bx: number; bz: number; y0: number; y1: number; dur: number; t: number }
  | { k: 'fall'; x: number; z: number; tx: number; tz: number; y0: number; t: number }
  | { k: 'roll'; x: number; z: number; sx: number; sz: number; turns: number; speed: number; t: number }
  | { k: 'mark'; stalk: number }
  | { k: 'rgo'; x: number; z: number; speed: number }
  | { k: 'slide'; ax: number; az: number; ay: number; bx: number; bz: number; by: number; lx: number; lz: number; dur: number; t: number }
  | { k: 'swing'; x: number; z: number; height: number; length: number; face: number; dur: number; t: number; start: number; ax: number; az: number }
  | { k: 'lamp'; on: boolean }
  | { k: 'elevate'; ax: number; az: number; bx: number; bz: number; y0: number; y1: number; dur: number; t: number; face?: number }
  | { k: 'trail'; who: IdleBrain; dist: number; dur: number; t: number }
  | { k: 'bag'; off: boolean }
  | { k: 'swim'; x: number; z: number; speed: number; t: number; dive: number }
  | { k: 'plunge'; ax: number; az: number; bx: number; bz: number; y0: number; y1: number; dur: number; t: number; arc: number }
  | { k: 'belly'; ax: number; az: number; ay: number; bx: number; bz: number; by: number; lx: number; lz: number; dur: number; t: number };

/** Counts meetings between friends, so each can tell the other has already moved on. */
let meetings = 0;

const WALK = 1.55;
const RUSH = 5.2;
const STRIDE = 0.27;
const R = 0.5;
/** Pandas amble: a longer stride, a gentler pace, a trot rather than a slide when in a hurry. */
const PANDA = { walk: 1.45, rush: 3.4, stride: 0.46, climb: 2.3 };
/** How deep a swimming penguin floats (its feet below the surface of the ice), how deep it dives, how fast it swims. */
const FLOAT = -0.32;
const DIVE = -1.15;
const SWIM = 1.9;
const FALL_TIME = 0.9;
const RECOVER_TIME = 1.25;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function inside(b: Box, x: number, z: number, pad: number): boolean {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
}

/** Whether the straight way from (ax, az) to (bx, bz) crosses the box (sampled). */
function crosses(b: Box, ax: number, az: number, bx: number, bz: number, pad: number): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (inside(b, ax + (bx - ax) * u, az + (bz - az) * u, pad)) return true;
  }
  return false;
}

export class IdleBrain {
  x = 0;
  z = 0;
  yaw = 0;
  private phase = 0;
  private tasks: Task[] = [];
  private away = false;
  private fish = 0;
  private hiddenWeight = 0;
  private rng: () => number;
  private last = ['', ''];
  /** Which fidget it is in the middle of (a sync task waits for the partner to be at the same place). */
  waiting = false;
  private splash = false;
  /** When it last met its friend (a counter shared by all animals), and the counter's value when it started waiting. */
  metAt = 0;
  private syncStart = 0;
  /** What it is in the middle of ('bucket', 'hole', 'igloo', 'play', ...), so its friend picks something else. */
  doing = '';
  private gait: IdleOut['gait'] = 'stand';
  private gaitW = 0;
  private actName: IdleAct = 'none';
  private actT = 0;
  private actWeight = 0;
  private y = 0;
  private slope = 0;
  private onProp = false;
  private stalk = -1;
  private rollPhase = 0;
  private tumblePhase = 0;
  /** Sitting (held across a run of seated acts), the lantern, and an act that was cut short, fading out. */
  private seatW = 0;
  private lampOn = false;
  private lampW = 0;
  private linger: { act: IdleAct; t: number; w: number } = { act: 'none', t: 0, w: 0 };
  private night = 0;
  private colony: Colony | null = null;
  private rerouteIn = 0;
  /** Has a lantern to carry about at night. */
  lantern = false;
  /** Who it is (the others find it by name), and what it is like. */
  name = '';
  persona: Persona = {};
  /** The bag on its back: wears one, has taken it off, how far it is from its back (eased). */
  hasBag = false;
  private bagOff = false;
  private bagW = 1;
  /** Which bed or mat is its own. */
  bed = -1;
  /** The day it last decided about the gathering (and whether it is going), and the last time it ran off. */
  private gatherDay = -1;
  private gathering = false;
  private evadeCd = 0;
  /** Rough height of its head above its feet (where the world puts things over it). */
  height = 1;

  constructor(seed: number, readonly index: number, readonly style: IdleStyle = 'penguin', readonly role: 'crew' | 'student' | 'resident' = 'crew') {
    this.rng = mulberry32(seed * 7919 + index * 104729 + 13);
  }

  private get walkSpeed(): number {
    if (this.style === 'panda') return PANDA.walk * (1 - 0.25 * this.night);
    return this.role === 'crew' ? WALK : WALK * (1 - 0.22 * this.night);
  }

  /** Lives the colony's life (every panda, and the penguins of the colony; the penguin crew keeps its old ways). */
  private get colonyLife(): boolean {
    return this.style === 'panda' || this.role !== 'crew';
  }

  /** In the water (swimming, or under it). */
  get wet(): boolean {
    return this.y < -0.02;
  }

  /** The act it is in the middle of ('none' while it walks). */
  get act(): IdleAct {
    return this.actName;
  }

  /** Somewhere it cannot just walk away from (up on the gym or the slide, on the swing, at a lesson). */
  get anchored(): boolean {
    return this.y > 0.02 || this.wet || this.doing === 'swim' || this.doing === 'swing' || this.doing === 'lesson' || this.doing === 'sleep' || this.doing === 'gather' || this.doing === 'class';
  }

  /** Forget everything (a new scene, a new run). */
  reset(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.tasks = [];
    this.away = false;
    this.fish = 0;
    this.hiddenWeight = 0;
    this.waiting = false;
    this.y = 0;
    this.onProp = false;
    this.stalk = -1;
    this.seatW = 0;
    this.lampOn = false;
    this.lampW = 0;
    this.linger.w = 0;
    this.bagOff = false;
    this.bagW = 1;
    this.gathering = false;
    this.gatherDay = -1;
  }

  get roaming(): boolean {
    return this.away;
  }

  /** Not in the middle of anything it would not want interrupted (a fish, the igloo, a game): its friend may ask it to play. */
  get approachable(): boolean {
    if (this.waiting) return false;
    if (!this.away || this.tasks.length === 0) return true;
    return this.doing === 'wander' || this.doing === 'look' || this.doing === 'fidget';
  }

  /** The partner calls this to bring the animal to a meeting place. */
  invite(x: number, z: number, face: number, others: Task[], doing = 'play'): void {
    this.doing = doing;
    this.fish = 0;
    if (this.y > 0.02) this.tasks = [{ k: 'elevate', ax: this.x, az: this.z, bx: this.x + 0.5, bz: this.z + 0.6, y0: this.y, y1: 0, dur: 0.7, t: 0 }];
    else this.tasks = this.surface();
    this.tasks.push({ k: 'go', x, z, speed: this.walkSpeed }, { k: 'sync', t: 0, timeout: 7, face }, ...others);
  }

  update(dt: number, ctx: IdleContext): IdleOut {
    dt = Math.min(dt, 0.1);
    const was = { act: this.actName, t: this.actT, w: this.actWeight };
    this.splash = false;
    this.gait = 'stand';
    this.gaitW = 0;
    this.actName = 'none';
    this.actWeight = 0;
    this.slope = 0;
    this.stalk = -1;
    this.night = ctx.night ?? 0;
    if (ctx.colony !== this.colony) {
      this.colony?.leave(this);
      this.colony = ctx.colony ?? null;
      this.colony?.join(this);
    }
    this.evadeCd = Math.max(0, this.evadeCd - dt);
    if (this.persona.avoids) this.noticeTrailer(ctx);
    const out = this.step(dt, ctx);
    // The bag comes off for bed and stays off till morning (never on a sleeper's back).
    if (this.hasBag) {
      if (out.act === 'sleep' || this.doing === 'sleep') this.bagOff = true;
      this.bagW += ((this.bagOff ? 0 : 1) - this.bagW) * Math.min(1, dt * 2.6);
      if (this.bagW > 0.995) this.bagW = 1;
      if (this.bagW < 0.005) this.bagW = 0;
    }
    out.bag = this.hasBag ? this.bagW : 1;
    // An act cut short (the run starts again, the lesson begins) fades out rather than snapping off.
    if (out.act === 'none' && was.act !== 'none' && was.w > 0.05 && out.gait === 'stand') this.linger = { act: was.act, t: was.t, w: was.w };
    if (out.act !== 'none' || out.gait !== 'stand') this.linger.w = 0;
    if (this.linger.w > 0) {
      this.linger.w = Math.max(0, this.linger.w - dt * 2.6);
      this.linger.t += dt;
      out.act = this.linger.act;
      out.actT = this.linger.t;
      out.actWeight = this.linger.w * this.linger.w * (3 - 2 * this.linger.w);
      this.actName = this.linger.w > 0 ? this.linger.act : 'none';
    }
    // Stays down on its haunches from one seated act to the next; gets up smoothly when it has done.
    const seated = SEATED_ACTS.has(out.act) && out.actWeight > 0.02 && this.colonyLife;
    this.seatW += ((seated ? 1 : 0) - this.seatW) * Math.min(1, dt * (seated ? 4.5 : 3.2));
    if (out.gait !== 'stand' && out.gait !== 'climb' && out.gait !== 'swim') this.seatW = Math.max(0, this.seatW - dt * 6);
    out.seat = this.seatW;
    this.lampW += ((this.lampOn && this.night > 0.15 ? 1 : 0) - this.lampW) * Math.min(1, dt * 2.5);
    out.lamp = this.lampW;
    return out;
  }

  private step(dt: number, ctx: IdleContext): IdleOut {
    const inClass = this.doing === 'lesson' && !!ctx.lesson && (ctx.lesson.on || ctx.lesson.cheer);
    const atFire = this.gathering && !!ctx.gather && (ctx.gather.on || ctx.gather.soon);
    if (this.tasks.length === 0 && !inClass && !atFire) this.doing = '';
    if (!ctx.free) {
      this.lampOn = false;
      this.bagOff = false;
      this.gathering = false;
      this.tasks = [];
      this.doing = '';
      this.waiting = false;
      this.hiddenWeight = 0;
      this.fish = 0;
      if (this.away && this.y > 0.02) {
        // Up on the bamboo gym when the run starts again: hop down at once, the way it would.
        this.y = Math.max(0, this.y - 7 * dt);
        this.onProp = this.y > 0.02;
        this.gait = 'stand';
        return this.out();
      }
      this.y = 0;
      this.onProp = false;
      if (!this.away) {
        this.x = ctx.home.x;
        this.z = ctx.home.z;
      }
      // Up off the ground first, if it was lying down or sitting.
      if (this.away && this.linger.w > 0.35) return this.out();
      if (this.away) {
        // Back to the station, at a trot, the moment the run moves again.
        const dx = ctx.home.x - this.x;
        const dz = ctx.home.z - this.z;
        const d = Math.hypot(dx, dz);
        const speed = this.style === 'panda' ? (d > 1.4 ? PANDA.rush : PANDA.walk * 1.5) : d > 1.4 ? RUSH : WALK * 1.6;
        const step = Math.min(d, speed * dt);
        if (d < 0.03) {
          this.x = ctx.home.x;
          this.z = ctx.home.z;
          this.away = false;
        } else {
          this.moveTo(dx, dz, d, step, speed);
        }
        if (d >= 0.03) return this.out();
      }
      this.away = false;
      return this.out();
    }

    if (!this.away) {
      // Starts from the station.
      this.x = ctx.home.x;
      this.z = ctx.home.z;
      this.yaw = ctx.home.yaw;
    }
    // Settled for a moment first: a pause is not a cue to run off at once.
    if (ctx.freeFor < 1.4 && this.tasks.length === 0) return this.out();

    if (ctx.lesson) this.attend(ctx, ctx.lesson);
    if (ctx.gather && this.doing !== 'lesson') this.gather(ctx, ctx.gather);
    // Up with the sun: a sleeper wakes when the day comes back.
    if (this.night < 0.2 && this.doing === 'sleep') {
      const t0 = this.tasks[0];
      if (t0 && t0.k === 'act' && t0.act === 'sleep' && t0.t < t0.dur - 1.2) t0.t = t0.dur - 1.2;
    }
    if (this.tasks.length === 0) {
      if (ctx.lesson && (ctx.lesson.on || ctx.lesson.cheer) && this.doing === 'lesson') this.nextLesson(ctx.lesson);
      else if (atFire && this.doing === 'gather') this.nextGather(ctx, ctx.gather!);
      else {
        if (this.bagOff && this.doing !== 'sleep') this.bagOff = false;
        this.plan(ctx);
      }
    }
    this.away = true;
    this.run(dt, ctx);
    return this.out();
  }

  /** A student and the lesson: off to its seat the moment the run plays, back to its own business when it is over. */
  private attend(ctx: IdleContext, lesson: Lesson): void {
    if (lesson.on || lesson.cheer) {
      if (this.doing === 'lesson') return;
      // Down from wherever it is first (the gym, the slide, the swing), then to its seat at a trot.
      const tasks: Task[] = [];
      if (this.y > 0.02) tasks.push({ k: 'fall', x: this.x, z: this.z, tx: this.x + 0.5, tz: this.z + 0.6, y0: this.y, t: 0 });
      tasks.push(...this.surface());
      if (this.colony?.swing.rider === this) this.colony.swing.rider = null;
      tasks.push(...this.goVia(ctx, lesson.seat[0], lesson.seat[1], (this.style === 'panda' ? PANDA.walk : WALK) * 1.7), { k: 'face', yaw: lesson.face });
      this.tasks = tasks;
      this.doing = 'lesson';
      this.lampOn = false;
      this.gathering = false;
      this.bagOff = false;
      return;
    }
    if (this.doing === 'lesson') {
      // Class is over: a stretch (or a yawn), and off it goes.
      this.tasks = [{ k: 'act', act: this.rng() < 0.5 ? 'stretch' : 'yawn', dur: 3.2, t: 0 }];
      this.doing = 'fidget';
    }
  }

  private nextLesson(lesson: Lesson): void {
    if (lesson.cheer) {
      this.tasks = [{ k: 'act', act: 'clap', dur: 2.6 + this.rng() * 1.4, t: 0, face: lesson.face }];
      return;
    }
    const options: [string, number][] = [
      ['notes', 6],
      ['ponder', 1.6],
      ['sit', 1.8],
      ['raise', 0.5],
    ];
    if (this.night > 0.5) options.push(['doze', 0.8]);
    // Notes are what a lesson is for (each writes at its own pace); the rest, one at a time.
    const free = options
      .filter(([n]) => !this.colony || n === 'notes' || this.colony.acting(n as IdleAct, this) === 0)
      .map(([n, w]): [string, number] => [n, n === 'notes' && this.colony ? w / (1 + this.colony.acting('notes', this)) : w]);
    const act = this.pick(free.length ? free : options) as IdleAct;
    const dur = act === 'notes' ? 7 + this.rng() * 8 : act === 'raise' ? 2.4 : act === 'doze' ? 6 + this.rng() * 4 : 3.5 + this.rng() * 3;
    this.tasks = [{ k: 'act', act, dur, t: 0, face: lesson.face }];
  }

  private out(): IdleOut {
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      gait: this.gait,
      gaitPhase: this.gait === 'roll' ? this.rollPhase : this.gait === 'tumble' ? this.tumblePhase : this.phase,
      gaitWeight: this.gaitW,
      act: this.actName,
      actT: this.actT,
      actWeight: this.actWeight,
      fish: this.fish,
      hide: this.hiddenWeight,
      away: this.away,
      splash: this.splash,
      y: this.y,
      climbSlope: this.slope,
      onProp: this.y > 0.02,
      stalk: this.stalk,
      seat: this.seatW,
      lamp: this.lampW,
      bag: this.bagW,
    };
  }

  private moveTo(dx: number, dz: number, d: number, step: number, speed: number): void {
    const heading = Math.atan2(dx, dz);
    const dt = step / Math.max(speed, 0.01);
    this.yaw += wrap(heading - this.yaw) * Math.min(1, 9 * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    if (this.wet) {
      // Paddling: the flippers beat, slower than a walk.
      this.phase += (step / 0.5) * Math.PI;
      this.gait = 'swim';
    } else if (this.style === 'panda') {
      this.phase += (step / PANDA.stride) * Math.PI;
      this.gait = 'walk';
    } else {
      this.phase += (step / STRIDE) * Math.PI * (speed > WALK * 1.8 ? 0.25 : 1);
      this.gait = speed > WALK * 2 ? 'glide' : 'walk';
    }
    this.gaitW = 1;
  }

  private run(dt: number, ctx: IdleContext): void {
    const task = this.tasks[0];
    if (!task) return;
    switch (task.k) {
      case 'go': {
        // Somewhere it can no longer go (the run started and that is the crew's stage now): it forgets about it.
        if (ctx.keepOut && inside(ctx.keepOut, task.x, task.z, R * 0.6)) {
          this.tasks.shift();
          while (this.tasks.length && (this.tasks[0].k === 'act' || this.tasks[0].k === 'face') && this.doing !== 'lesson') this.tasks.shift();
          return;
        }
        // Route from here (the plan was made long before it is walked).
        const goal: [number, number] = [task.x, task.z];
        const legs = this.around(ctx, task.x, task.z).map(([x, z]) => ({ k: 'walk', x, z, speed: task.speed, goal }) as Task);
        this.tasks.splice(0, 1, ...legs);
        return;
      }
      case 'walk': {
        const dx = task.x - this.x;
        const dz = task.z - this.z;
        const d = Math.hypot(dx, dz);
        task.t = (task.t ?? 0) + dt;
        // Arrived (or, nudged about by the others for far too long, near enough).
        if (d < 0.05 || (task.t > 30 && d < 1.2)) {
          this.tasks.shift();
          if (task.face !== undefined) this.tasks.unshift({ k: 'face', yaw: task.face });
          return;
        }
        // Pushed off its way (round another panda, a prop) so that the rest of it now runs into the cells: a new way.
        this.rerouteIn -= dt;
        if (task.goal && ctx.keepOut && this.rerouteIn <= 0 && crosses(ctx.keepOut, this.x, this.z, task.x, task.z, R + 0.15)) {
          this.rerouteIn = 0.8;
          const goal = task.goal;
          // A penguin that keeps being turned back from somewhere tucked against the structures gives up on it.
          this.reroutes = this.lastGoal === goal ? this.reroutes + 1 : 0;
          this.lastGoal = goal;
          if (this.style === 'penguin' && this.reroutes > 5) {
            while (this.tasks.length && this.tasks[0].k === 'walk' && (this.tasks[0] as { goal?: [number, number] }).goal === goal) this.tasks.shift();
            return;
          }
          while (this.tasks.length && this.tasks[0].k === 'walk' && (this.tasks[0] as { goal?: [number, number] }).goal === goal) this.tasks.shift();
          this.tasks.unshift({ k: 'go', x: goal[0], z: goal[1], speed: task.speed });
          return;
        }
        // Slow down into the last stretch, speed up out of the first.
        const speed = task.speed * Math.min(1, 0.45 + d * 0.9);
        const step = Math.min(d, speed * dt);
        let [sx, sz] = this.steer(ctx, dx / d, dz / d, task.x, task.z, d);
        // Never nudged in towards the cells (the way itself was planned clear of them).
        const box = ctx.keepOut;
        if (box) {
          const near = boxGap(box, this.x + sx * step, this.z + sz * step);
          if (near < R + 0.35 && near < boxGap(box, this.x, this.z)) {
            sx = dx / d;
            sz = dz / d;
          }
        }
        this.moveTo(sx, sz, 1, step, speed);
        return;
      }
      case 'face': {
        const diff = wrap(task.yaw - this.yaw);
        if (Math.abs(diff) < 0.05) {
          this.tasks.shift();
          return;
        }
        this.yaw += Math.sign(diff) * Math.min(Math.abs(diff), 3.4 * dt);
        return;
      }
      case 'act': {
        if (task.t === 0) task.act = this.variant(task.act);
        task.t += dt;
        // The bag leaves its back (or goes back on it) part-way through the act.
        if (task.act === 'unbag') this.bagOff = task.t > 0.6;
        else if (task.act === 'rebag') this.bagOff = !(task.t > 0.6);
        if (task.face !== undefined) this.yaw += wrap(task.face - this.yaw) * Math.min(1, 5 * dt);
        this.actName = task.act;
        this.actT = task.t;
        this.actWeight = this.colonyLife && FADING.has(task.act) ? Math.max(0, Math.min(1, (task.dur - task.t) / (task.act === 'sleep' || task.act === 'lounge' ? 1.1 : 0.5))) : 1;
        if (task.stalk !== undefined) this.stalk = task.stalk;
        if (task.fish === 'take') this.fish = task.t > 0.55 ? 1 : 0;
        else if (task.fish === 'eat') this.fish = task.t < 0.9 ? 1 : Math.max(0, 1 - (task.t - 0.9) / 0.6);
        if (task.t >= task.dur) {
          this.tasks.shift();
          if (task.fish === 'take') this.fish = 1;
          else this.fish = task.fish === 'eat' ? 0 : this.fish;
        }
        return;
      }
      case 'sync': {
        task.t += dt;
        this.waiting = true;
        this.yaw += wrap(task.face - this.yaw) * Math.min(1, 6 * dt);
        const p = ctx.partner;
        // Met: its friend is waiting too, or has already gone on (it saw us, we are late).
        const there = !p || p.waiting || !p.roaming || p.metAt > this.syncStart;
        if ((there && task.t > 0.3) || task.t > task.timeout) {
          this.waiting = false;
          this.metAt = ++meetings;
          this.tasks.shift();
        } else if (task.t === dt) {
          this.syncStart = meetings;
        }
        return;
      }
      case 'hide': {
        task.t += dt;
        this.hiddenWeight = 1;
        if (task.t >= task.dur) {
          this.hiddenWeight = 0;
          this.tasks.shift();
        }
        return;
      }
      case 'splash':
        this.splash = true;
        this.tasks.shift();
        return;
      case 'mark':
        this.stalk = task.stalk;
        this.tasks.shift();
        return;
      case 'rgo': {
        // Route from here, rolling: one roll per leg of the way round the cells.
        let px = this.x, pz = this.z;
        const legs = this.around(ctx, task.x, task.z).map(([x, z]) => {
          const dist = Math.hypot(x - px, z - pz);
          const turns = Math.max(1, Math.round(dist / (2 * Math.PI * ROLL_RADIUS * 1.4)));
          const t: Task = { k: 'roll', x, z, sx: px, sz: pz, turns, speed: task.speed, t: 0 };
          px = x;
          pz = z;
          return t;
        });
        this.tasks.splice(0, 1, ...legs);
        return;
      }
      case 'ascend': {
        task.t += dt;
        const u = Math.min(1, task.t / task.dur);
        const e = u * u * (3 - 2 * u) * 0.3 + u * 0.7;
        this.x = task.ax + (task.bx - task.ax) * e;
        this.z = task.az + (task.bz - task.az) * e;
        this.y = task.y0 + (task.y1 - task.y0) * e;
        this.onProp = true;
        this.gait = 'climb';
        this.gaitW = 1;
        this.phase = ((this.y * 9) % (Math.PI * 200));
        this.slope = Math.atan2(Math.hypot(task.bx - task.ax, task.bz - task.az), Math.max(0.2, Math.abs(task.y1 - task.y0)));
        this.yaw += wrap(CAMERA_FACE - this.yaw) * Math.min(1, 6 * dt);
        if (u >= 1) this.tasks.shift();
        return;
      }
      case 'fall': {
        // Slips off the edge of the deck: arms flailing, down to the ground, a heap, a shake of the head.
        task.t += dt;
        const total = FALL_TIME + RECOVER_TIME;
        const t = Math.min(task.t, total);
        this.gait = 'tumble';
        this.gaitW = 1;
        if (t < FALL_TIME) {
          const u = t / FALL_TIME;
          this.tumblePhase = u * 0.999;
          this.y = task.y0 * Math.max(0, 1 - u * u);
          const e = u * u * (3 - 2 * u);
          this.x = this.x + (task.tx - this.x) * Math.min(1, dt * 4);
          this.z = this.z + (task.tz - this.z) * Math.min(1, dt * 4);
          void e;
          this.onProp = this.y > 0.05;
        } else {
          this.tumblePhase = 1 + (t - FALL_TIME) / RECOVER_TIME;
          this.y = 0;
          this.onProp = false;
        }
        this.slope = 0;
        if (task.t >= total) {
          this.y = 0;
          this.onProp = false;
          this.tasks.shift();
        }
        return;
      }
      case 'roll': {
        // Curled into a ball and rolling along: a whole number of turns, so it lands on its feet.
        const total = Math.hypot(task.x - task.sx, task.z - task.sz);
        const dx = task.x - this.x;
        const dz = task.z - this.z;
        const d = Math.hypot(dx, dz);
        task.t += dt;
        if (d < 0.05) {
          this.rollPhase = task.turns * Math.PI * 2;
          this.tasks.shift();
          return;
        }
        const ramp = Math.min(1, task.t / 0.25, d / 0.5 + 0.2);
        const step = Math.min(d, task.speed * (0.35 + 0.65 * ramp) * dt);
        const heading = Math.atan2(dx, dz);
        this.yaw += wrap(heading - this.yaw) * Math.min(1, 10 * dt);
        this.x += (dx / d) * step;
        this.z += (dz / d) * step;
        this.rollPhase = (1 - (d - step) / Math.max(total, 1e-3)) * task.turns * Math.PI * 2;
        this.gait = 'roll';
        this.gaitW = Math.min(1, ramp * 1.3, d / 0.3);
        return;
      }
      case 'slide': {
        // Down the chute, seated, faster and faster; off the end with a little hop onto the ground.
        task.t += dt;
        const u = Math.min(1, task.t / task.dur);
        const ride = 0.82;
        this.actName = 'slide';
        this.actT = task.t;
        this.actWeight = 1;
        if (u < ride) {
          const e = Math.pow(u / ride, 1.7);
          this.x = task.ax + (task.bx - task.ax) * e;
          this.z = task.az + (task.bz - task.az) * e;
          this.y = task.ay + (task.by - task.ay) * e;
        } else {
          const v = (u - ride) / (1 - ride);
          this.x = task.bx + (task.lx - task.bx) * v;
          this.z = task.bz + (task.lz - task.bz) * v;
          this.y = Math.max(0, task.by * (1 - v) + 0.22 * Math.sin(Math.PI * v));
          this.actWeight = 1 - v;
        }
        this.onProp = this.y > 0.02;
        this.yaw += wrap(Math.atan2(task.bx - task.ax, task.bz - task.az) - this.yaw) * Math.min(1, 10 * dt);
        if (u >= 1) {
          this.y = 0;
          this.onProp = false;
          this.tasks.shift();
        }
        return;
      }
      case 'swing': {
        // Up onto the seat, swinging higher and higher, slower, and off again (the world swings the seat along).
        const colony = this.colony;
        if (task.t === 0) {
          task.start = (ctx.now ?? 0) + 0.7;
          if (colony) colony.swing = { rider: this, start: task.start, dur: task.dur };
        }
        task.t += dt;
        const ride = (ctx.now ?? task.t) - task.start;
        const climb = Math.min(1, task.t / 0.7);
        const off = ride > task.dur ? Math.min(1, (ride - task.dur) / 0.6) : 0;
        const a = swingAngle(ride, task.dur);
        const fx = Math.sin(task.face), fz = Math.cos(task.face);
        const sx = task.x + fx * Math.sin(a) * task.length;
        const sz = task.z + fz * Math.sin(a) * task.length;
        const sy = task.height + (1 - Math.cos(a)) * task.length;
        const on = climb * (1 - off);
        this.x = task.ax + (sx - task.ax) * on;
        this.z = task.az + (sz - task.az) * on;
        this.y = sy * on - 0.04 * on;
        this.onProp = this.y > 0.02;
        this.yaw += wrap(task.face - this.yaw) * Math.min(1, 8 * dt);
        this.actName = 'swing';
        this.actT = Math.max(0, ride);
        this.actWeight = on;
        if (off >= 1) {
          this.y = 0;
          this.onProp = false;
          if (colony && colony.swing.rider === this) colony.swing.rider = null;
          this.tasks.shift();
        }
        return;
      }
      case 'lamp':
        this.lampOn = task.on;
        this.tasks.shift();
        return;
      case 'bag':
        this.bagOff = task.off;
        this.tasks.shift();
        return;
      case 'elevate': {
        // Steps up onto (or down off) a bed, a chair, a log, a bar: a hop of a step, turning to face the way it will sit.
        task.t += dt;
        const u = Math.min(1, task.t / task.dur);
        const e = u * u * (3 - 2 * u);
        this.x = task.ax + (task.bx - task.ax) * e;
        this.z = task.az + (task.bz - task.az) * e;
        this.y = task.y0 + (task.y1 - task.y0) * e + 0.06 * Math.sin(Math.PI * u);
        this.onProp = true;
        this.gait = 'walk';
        this.gaitW = 0.55 * Math.min(1, (1 - u) * 4 + 0.2);
        this.phase += dt * 7;
        const heading = task.face ?? Math.atan2(task.bx - task.ax, task.bz - task.az);
        if (Math.hypot(task.bx - task.ax, task.bz - task.az) > 0.05 || task.face !== undefined) this.yaw += wrap(heading - this.yaw) * Math.min(1, 6 * dt);
        if (u >= 1) {
          this.y = task.y1;
          this.tasks.shift();
        }
        return;
      }
      case 'trail': {
        // Follows another panda at a distance: closes up when it gets ahead, and loiters (peeking) when it stops.
        task.t += dt;
        const w = task.who;
        if (task.t >= task.dur || w.anchored || !w.roaming) {
          this.tasks.shift();
          return;
        }
        const dx = w.x - this.x, dz = w.z - this.z;
        const d = Math.hypot(dx, dz);
        // A penguin can lose sight of the one it is trailing (it got too far ahead, or into the water), and gives up; and
        // one that finds itself right beside her loses its nerve and wanders off.
        if (this.style === 'penguin' && (d > 11 || w.wet || d < 1.1)) {
          this.tasks.shift();
          return;
        }
        if (d > task.dist + 0.35) {
          const way = this.around(ctx, w.x, w.z)[0] ?? [w.x, w.z];
          const ex = way[0] - this.x, ez = way[1] - this.z;
          const ed = Math.hypot(ex, ez) || 1;
          // (A penguin falling behind hurries to catch up: a quick little trot.)
          const speed = this.style === 'penguin' ? (d > task.dist + 2.2 ? WALK * 1.75 : WALK * 1.05) : PANDA.walk * 1.1;
          const step = Math.min(ed, speed * dt);
          const [sx, sz] = this.steer(ctx, ex / ed, ez / ed, way[0], way[1], ed);
          this.moveTo(sx, sz, 1, step, speed);
        } else {
          this.yaw += wrap(Math.atan2(dx, dz) - this.yaw) * Math.min(1, 3 * dt);
          this.actName = 'look';
          this.actT = task.t % 4;
          this.actWeight = 1;
        }
        return;
      }
      case 'plunge': {
        // A hop into the water (or out of it onto the ice): up, over the edge, and down with a splash.
        task.t += dt;
        const u = Math.min(1, task.t / task.dur);
        const e = u * u * (3 - 2 * u);
        const was = this.y;
        this.x = task.ax + (task.bx - task.ax) * e;
        this.z = task.az + (task.bz - task.az) * e;
        this.y = task.y0 + (task.y1 - task.y0) * e + task.arc * Math.sin(Math.PI * u);
        // The splash, the moment it goes through the surface.
        if ((was >= -0.02) !== (this.y >= -0.02) && task.t > dt) this.splash = true;
        this.gait = task.y1 < task.y0 ? 'glide' : 'walk';
        this.gaitW = 0.4 + 0.6 * Math.sin(Math.PI * u);
        this.phase += dt * 9;
        if (Math.hypot(task.bx - task.ax, task.bz - task.az) > 0.05) this.yaw += wrap(Math.atan2(task.bx - task.ax, task.bz - task.az) - this.yaw) * Math.min(1, 8 * dt);
        if (u >= 1) {
          this.y = task.y1;
          this.tasks.shift();
        }
        return;
      }
      case 'swim': {
        // Swimming across the pool: strokes and glides; now and then under for a moment and up again.
        task.t += dt;
        const dx = task.x - this.x, dz = task.z - this.z;
        const d = Math.hypot(dx, dz);
        const under = task.dive > 0 ? Math.sin(Math.min(1, task.t / task.dive) * Math.PI) : 0;
        const target = FLOAT + (DIVE - FLOAT) * under;
        this.y += (target - this.y) * Math.min(1, dt * 4);
        this.y = Math.min(this.y, -0.05);
        if (d < 0.08 || task.t > 16) {
          this.tasks.shift();
          return;
        }
        const speed = task.speed * Math.min(1, 0.4 + d * 0.8) * (0.85 + 0.15 * Math.sin(task.t * 2.4));
        this.moveTo(dx, dz, d, Math.min(d, speed * dt), speed);
        return;
      }
      case 'belly': {
        // Down the ice slide on its belly, flippers back, faster and faster; then a long glide out across the ice.
        task.t += dt;
        const u = Math.min(1, task.t / task.dur);
        const ride = 0.45;
        if (u < ride) {
          const e = Math.pow(u / ride, 1.6);
          this.x = task.ax + (task.bx - task.ax) * e;
          this.z = task.az + (task.bz - task.az) * e;
          this.y = task.ay + (task.by - task.ay) * e;
        } else {
          // Friction: quick at first, slowing to a stop.
          const v = (u - ride) / (1 - ride);
          const e = 1 - (1 - v) * (1 - v);
          this.x = task.bx + (task.lx - task.bx) * e;
          this.z = task.bz + (task.lz - task.bz) * e;
          this.y = task.by * (1 - Math.min(1, v * 6));
        }
        this.onProp = this.y > 0.02;
        this.gait = 'glide';
        this.gaitW = u < 0.06 ? u / 0.06 : u > 0.92 ? (1 - u) / 0.08 : 1;
        const toward = u < ride ? Math.atan2(task.bx - task.ax, task.bz - task.az) : Math.atan2(task.lx - task.bx, task.lz - task.bz);
        this.yaw += wrap(toward - this.yaw) * Math.min(1, 6 * dt);
        if (u >= 1) {
          this.y = 0;
          this.onProp = false;
          this.tasks.shift();
        }
        return;
      }
      default:
        return;
    }
  }

  /** How often in a row it has been turned back on the way to the same place. */
  private reroutes = 0;
  private lastGoal: [number, number] | null = null;

  /** The pool it last swam in (so it can get out of it again). */
  private pool: Spots['pool'] | null = null;

  /** Out of the water first, if it is in it: a swim to the nearest edge of the pool and a hop out. */
  private surface(): Task[] {
    const p = this.pool;
    if (!this.wet || !p) return [];
    let best = p.entries[0];
    for (const e of p.entries) if (Math.hypot(e.at[0] - this.x, e.at[1] - this.z) < Math.hypot(best.at[0] - this.x, best.at[1] - this.z)) best = e;
    const wx = best.at[0] + Math.sin(best.face) * 0.95, wz = best.at[1] + Math.cos(best.face) * 0.95;
    return [
      { k: 'swim', x: wx, z: wz, speed: SWIM * 1.3, t: 0, dive: 0 },
      { k: 'plunge', ax: wx, az: wz, bx: best.at[0], bz: best.at[1], y0: this.y < FLOAT ? this.y : FLOAT, y1: 0, dur: 0.85, t: 0, arc: 0.4 },
      { k: 'act', act: 'shake', dur: 1.1, t: 0 },
    ];
  }

  /** Not quite the same act as another panda at the same moment: a near relation instead, if there is one free. */
  private variant(act: IdleAct): IdleAct {
    const c = this.colony;
    if (!c || !this.colonyLife || this.doing === 'gather' || this.doing === 'class' || c.acting(act, this) === 0) return act;
    const alt = (SWAPS[act] ?? []).filter((a) => c.acting(a, this) === 0 && (this.night > 0.4 || !NIGHT_ONLY.has(a)));
    return alt.length ? alt[Math.floor(this.rng() * alt.length)] : act;
  }

  /** Walking round the others and the props on the way (not round the one it is going to). */
  private steer(ctx: IdleContext, ux: number, uz: number, tx: number, tz: number, d: number): [number, number] {
    let px = 0, pz = 0;
    const c = this.colony;
    if (c) {
      for (const m of c.members) {
        if (m === this) continue;
        const ox = this.x - m.x, oz = this.z - m.z;
        const od = Math.hypot(ox, oz);
        // Only those in the way (ahead), and not the one it is walking up to.
        if (od < 1e-3 || od > 1.05 || Math.hypot(m.x - tx, m.z - tz) < 0.6 || ox * ux + oz * uz > 0.2) continue;
        const k = (1 - od / 1.05) * 1.3;
        px += (ox / od) * k;
        pz += (oz / od) * k;
      }
    }
    for (const o of ctx.obstacles ?? []) {
      if (Math.hypot(tx - o.x, tz - o.z) < o.r + 0.6) continue;
      const ox = this.x - o.x, oz = this.z - o.z;
      const od = Math.hypot(ox, oz);
      const gap = od - o.r;
      if (gap > 0.7 || od < 1e-3) continue;
      const k = (1 - Math.max(0, gap) / 0.7) * 1.2;
      px += (ox / od) * k;
      pz += (oz / od) * k;
    }
    if (px === 0 && pz === 0) return [ux, uz];
    // Sidestep rather than back away: keep the part of the push that is across the way, and a little of the rest.
    const along = px * ux + pz * uz;
    const sx = px - along * ux * (along < 0 ? 0.85 : 0), sz = pz - along * uz * (along < 0 ? 0.85 : 0);
    const near = Math.min(1, d / 0.8);
    let vx = ux + sx * near, vz = uz + sz * near;
    const l = Math.hypot(vx, vz) || 1;
    vx /= l;
    vz /= l;
    return [vx, vz];
  }

  // ── Choosing what to do next ───────────────────────────────────────────

  private pick(options: [string, number][]): string {
    const total = options.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [name, w] of options) {
      r -= w;
      if (r <= 0) return name;
    }
    return options[0][0];
  }

  private freePoint(ctx: IdleContext, radius: number): [number, number] | null {
    const roam = ctx.roam;
    for (let i = 0; i < (roam ? 24 : 12); i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 0.9 + this.rng() * radius;
      let x: number, z: number;
      if (roam) {
        // Anywhere in the clearing, mostly within a stroll of where it is now.
        x = this.x + Math.cos(a) * r;
        z = this.z + Math.sin(a) * r * 0.8;
        if (((x - roam.cx) / roam.rx) ** 2 + ((z - roam.cz) / roam.rz) ** 2 > 0.8) continue;
      } else {
        // The front of the ice is where there is room: nudge the walk towards the camera.
        x = ctx.home.x + Math.cos(a) * r;
        z = ctx.home.z + Math.sin(a) * r * 0.7 + 0.4;
        if (x < ctx.area.minX || x > ctx.area.maxX || z < ctx.area.minZ || z > ctx.area.maxZ) continue;
      }
      if (ctx.keepOut && (inside(ctx.keepOut, x, z, R + 0.35) || crosses(ctx.keepOut, this.x, this.z, x, z, R + 0.2))) continue;
      const p = ctx.partner;
      if (p && Math.hypot(p.x - x, p.z - z) < 1.2) continue;
      if (this.colony && this.colony.members.some((m) => m !== this && Math.hypot(m.x - x, m.z - z) < 1.3)) continue;
      if (ctx.obstacles && ctx.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.55 || segmentNear(this.x, this.z, x, z, o.x, o.z, o.r + 0.15))) continue;
      return [x, z];
    }
    return null;
  }

  /** A way round the cells: the shortest way past one or two corners of the box round them (out of it first, if need be). */
  private around(ctx: IdleContext, tx: number, tz: number): [number, number][] {
    const box = ctx.keepOut;
    if (!box || !crosses(box, this.x, this.z, tx, tz, R + 0.4)) return [[tx, tz]];
    const pts: [number, number][] = [];
    let x = this.x, z = this.z;
    if (inside(box, x, z, R + 0.25)) {
      // Caught inside the margin: out by the nearest side first.
      const exits: [number, number, number][] = [
        [box.minX - R - 0.5, z, x - box.minX],
        [box.maxX + R + 0.5, z, box.maxX - x],
        [x, box.maxZ + R + 0.5, box.maxZ - z],
        [x, box.minZ - R - 0.5, z - box.minZ],
      ];
      exits.sort((a, b) => a[2] - b[2]);
      x = exits[0][0];
      z = exits[0][1];
      pts.push([x, z]);
    }
    const m = R + 0.9;
    const corners: [number, number][] = [
      [box.minX - m, box.maxZ + m],
      [box.maxX + m, box.maxZ + m],
      [box.maxX + m, box.minZ - m],
      [box.minX - m, box.minZ - m],
    ];
    const clear = (ax: number, az: number, bx: number, bz: number) => !crosses(box, ax, az, bx, bz, R + 0.2);
    let best: [number, number][] | null = null;
    let bestLen = Infinity;
    const consider = (via: [number, number][]) => {
      let px = x, pz = z, len = 0;
      for (const [vx, vz] of [...via, [tx, tz] as [number, number]]) {
        if (!clear(px, pz, vx, vz)) return;
        len += Math.hypot(vx - px, vz - pz);
        px = vx;
        pz = vz;
      }
      if (len < bestLen) {
        bestLen = len;
        best = via;
      }
    };
    if (pts.length) consider([]);
    for (let i = 0; i < 4; i++) {
      consider([corners[i]]);
      consider([corners[i], corners[(i + 1) % 4]]);
      consider([corners[(i + 1) % 4], corners[i]]);
    }
    if (!best) {
      // Nothing clean (a target tucked against the cells): round the near side by the front, then straight there.
      const left = Math.abs(x - box.minX) < Math.abs(x - box.maxX);
      best = z > box.maxZ ? [left ? corners[0] : corners[1]] : left ? [corners[3], corners[0]] : [corners[2], corners[1]];
    }
    return [...pts, ...(best as [number, number][]), [tx, tz]];
  }

  /** A way to (tx, tz) that keeps clear of the cells, worked out from wherever the animal is when it sets off. */
  private goVia(_ctx: IdleContext, tx: number, tz: number, speed = this.walkSpeed): Task[] {
    return [{ k: 'go', x: tx, z: tz, speed }];
  }

  /** Walks to a perch and settles on it (up onto a chair, a bench, a bed, a log): the way up, from behind unless told. */
  private settle(ctx: IdleContext, p: Perch, approach?: [number, number], speed = this.walkSpeed): Task[] {
    if (p.y < 0.05) return [...this.goVia(ctx, p.at[0], p.at[1], speed), { k: 'face', yaw: p.face }];
    const ap = approach ?? [p.at[0] - Math.sin(p.face) * 0.85, p.at[1] - Math.cos(p.face) * 0.85];
    return [
      ...this.goVia(ctx, ap[0], ap[1], speed),
      { k: 'elevate', ax: ap[0], az: ap[1], bx: p.at[0], bz: p.at[1], y0: 0, y1: p.y, dur: 0.9, t: 0, face: p.face },
    ];
  }

  /** And down again, back to where it stepped up from. */
  private unsettle(p: Perch, approach?: [number, number]): Task[] {
    if (p.y < 0.05) return [];
    const ap = approach ?? [p.at[0] - Math.sin(p.face) * 0.85, p.at[1] - Math.cos(p.face) * 0.85];
    return [{ k: 'elevate', ax: p.at[0], az: p.at[1], bx: ap[0], bz: ap[1], y0: p.y, y1: 0, dur: 0.8, t: 0 }];
  }

  /** The noon gathering: whoever is going goes to the fire (the musician first, to play); when it is over everyone gets on with the day. */
  private gather(ctx: IdleContext, g: Gathering): void {
    const camp = ctx.spots?.camp;
    if (!camp || !this.colonyLife || this.role === 'crew') return;
    if (!g.on && !g.soon) {
      if (this.gathering) {
        this.gathering = false;
        this.colony?.release(this);
        if (this.doing === 'gather') {
          this.tasks = this.y > 0.02 ? [{ k: 'elevate', ax: this.x, az: this.z, bx: this.x, bz: this.z + 0.8, y0: this.y, y1: 0, dur: 0.8, t: 0 }] : [];
          this.tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'stretch' : 'wave', dur: 3.2, t: 0 });
          this.doing = 'fidget';
        }
      }
      return;
    }
    const musician = !!this.persona.musician;
    if (!musician && !g.on) return;
    if (this.gatherDay === g.day) return;
    this.gatherDay = g.day;
    // Some have better things to do (and a panda asleep or on the swing stays put).
    const roll = (Math.sin(this.index * 12.9898 + g.day * 78.233) * 43758.5453) % 1;
    const chance = musician ? 1 : this.persona.social ?? 0.7;
    if (Math.abs(roll) >= chance || this.doing === 'sleep' || this.doing === 'swing' || this.doing === 'lesson') return;
    this.gathering = true;
    this.doing = 'gather';
    this.lampOn = false;
    if (this.colony?.swing.rider === this) this.colony.swing.rider = null;
    const tasks: Task[] = [];
    if (this.y > 0.02) tasks.push({ k: 'elevate', ax: this.x, az: this.z, bx: this.x, bz: this.z + 0.8, y0: this.y, y1: 0, dur: 0.7, t: 0 });
    if (this.style === 'panda') {
      if (musician) tasks.push(...this.settle(ctx, camp.stage, undefined, PANDA.walk * 1.4));
      else {
        const slot = camp.ring[this.colony ? this.colony.claim(this, camp.ring.length) : 0];
        tasks.push(...this.goVia(ctx, slot.at[0], slot.at[1], PANDA.walk * 1.5), { k: 'face', yaw: slot.face });
      }
    } else {
      // Penguins notice the music each at its own moment: out of the water, a look round, and over at their own pace.
      tasks.push(...this.surface());
      if (!musician) tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'look' : 'sniff', dur: 0.8 + this.rng() * 6, t: 0 });
      if (musician) tasks.push(...this.settle(ctx, camp.stage, undefined, WALK * 1.4));
      else {
        const slot = camp.ring[this.colony ? this.colony.claim(this, camp.ring.length) : 0];
        tasks.push(...this.goVia(ctx, slot.at[0], slot.at[1], WALK * (1.15 + this.rng() * 0.45)), { k: 'face', yaw: slot.face });
      }
    }
    this.tasks = tasks;
  }

  /** What it does at the fire while the music plays: sits and listens near the flames, dances out in the ring, claps. */
  private nextGather(ctx: IdleContext, g: Gathering): void {
    const camp = ctx.spots!.camp!;
    if (this.persona.musician) {
      this.tasks = [{ k: 'act', act: 'guitar', dur: 12 + this.rng() * 8, t: 0, face: camp.stage.face }];
      return;
    }
    const slot = camp.ring[this.colony ? this.colony.claim(this, camp.ring.length) : 0];
    const inner = Math.hypot(slot.at[0] - camp.x, slot.at[1] - camp.z) < 2.6;
    const options: [string, number][] = inner
      ? [['sit', 5], ['clap', 2], ['wave', 0.8], ['dance', 1.4], ['look', 0.6]]
      : [['dance', 5], ['clap', 2], ['sit', 1.4], ['wave', 1.2], ['look', 0.5]];
    if (this.style === 'penguin') {
      // A penguin also chats with whoever stands beside it, plays about, preens, or takes a turn round the edge of the crowd.
      options.push(['play', 1.1], ['bow', 0.6], ['preen', 0.7]);
      if (!inner && this.rng() < 0.18) {
        const a = Math.atan2(slot.at[1] - camp.z, slot.at[0] - camp.x) + (this.rng() < 0.5 ? -1 : 1) * (0.35 + this.rng() * 0.3);
        const r = 3.9 + this.rng() * 0.6;
        const px = camp.x + Math.cos(a) * r, pz = camp.z + Math.sin(a) * r;
        this.tasks = [
          { k: 'walk', x: px, z: pz, speed: WALK * 0.8 },
          { k: 'act', act: 'look', dur: 2.5, t: 0, face: Math.atan2(camp.x - px, camp.z - pz) },
          { k: 'walk', x: slot.at[0], z: slot.at[1], speed: WALK * 0.8, face: slot.face },
        ];
        return;
      }
    }
    const act = this.pick(options) as IdleAct;
    const dur = act === 'sit' ? 6 + this.rng() * 6 : act === 'dance' ? 6 + this.rng() * 7 : act === 'clap' ? 3.5 + this.rng() * 3 : 2.4;
    this.tasks = [{ k: 'act', act, dur, t: 0, face: slot.face + (this.rng() - 0.5) * 0.5 }];
    void g;
  }

  /** It notices the one trailing after it (when that one gets close) and gets away: a quick look back, a change of direction, now and then a run. */
  private noticeTrailer(ctx: IdleContext): void {
    if (this.evadeCd > 0 || !this.away || this.y > 0.02 || this.wet || !ctx.free) return;
    if (['sleep', 'lesson', 'gather', 'class', 'swing', 'evade'].includes(this.doing)) return;
    const t = this.colony?.find(this.persona.avoids ?? '');
    if (!t || t.doing !== 'tail') return;
    if (Math.hypot(t.x - this.x, t.z - this.z) > 2.7) return;
    // A penguin does not always bother: now and then it just pretends not to have noticed.
    if (this.style === 'penguin' && this.rng() < 0.3) {
      this.evadeCd = 6 + this.rng() * 6;
      return;
    }
    const away = Math.atan2(this.x - t.x, this.z - t.z);
    const roam = ctx.roam;
    let best: [number, number] | null = null;
    for (let i = 0; i < 14 && !best; i++) {
      // Never straight on: it turns off to one side or the other as it goes.
      const a = away + (this.rng() < 0.5 ? -1 : 1) * (0.35 + this.rng() * 0.9);
      const r = 4.5 + this.rng() * 4;
      const x = this.x + Math.sin(a) * r, z = this.z + Math.cos(a) * r;
      if (roam && ((x - roam.cx) / roam.rx) ** 2 + ((z - roam.cz) / roam.rz) ** 2 > 0.7) continue;
      if (ctx.keepOut && (inside(ctx.keepOut, x, z, R + 0.5) || crosses(ctx.keepOut, this.x, this.z, x, z, R + 0.3))) continue;
      if (ctx.obstacles && ctx.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.7 || segmentNear(this.x, this.z, x, z, o.x, o.z, o.r + 0.2))) continue;
      best = [x, z];
    }
    if (!best) return;
    this.evadeCd = 11 + this.rng() * 7;
    this.doing = 'evade';
    this.fish = 0;
    this.tasks = [
      { k: 'act', act: 'glance', dur: 1.1, t: 0 },
      { k: 'go', x: best[0], z: best[1], speed: this.rng() < 0.4 ? PANDA.rush : (this.style === 'panda' ? PANDA.walk : WALK) * 1.6 },
      { k: 'act', act: 'glance', dur: 1.2, t: 0 },
    ];
  }

  /**
   * What a panda does with its time: sits and chews bamboo, climbs the climbing frame (and sometimes falls off it), goes
   * down the slide, swings, rolls about, scratches, stretches, lolls on its back, dances, drinks at the pond, explores,
   * plays, takes the paths from one place to the next, sits by the fire, on a chair or a bench, works out in the gym
   * yard, types at the desk. Each has its own likes (see `Persona`). At night most go to their beds (the bag comes off
   * first); the rest nod off where they sit, gaze at the stars, chase fireflies, go round with a lantern or sit by the fire.
   */
  private planPanda(ctx: IdleContext): void {
    const partner = ctx.partner;
    const spots = ctx.spots;
    const colony = this.colony;
    const n = this.night;
    const day = 1 - n;
    const like = (name: string, base = 1): number => this.persona.likes?.[name] ?? base;
    const taken = (what: string) => (partner?.roaming && partner.doing === what) || (colony ? colony.doing(what, this) : false);
    const lively = Math.max(0.05, 1 - n * 1.15);
    const options: [string, number][] = [
      ['sit', 2.0 * (0.4 + 0.6 * day) * like('sit')],
      ['look', 1.4 * like('look')],
      ['wander', 2.6 * (1 - 0.5 * n) * like('wander')],
      ['fidget', 2.0 * (1 - 0.4 * n) * like('fidget')],
    ];
    const add = (name: string, w: number, ok = true, shared = false) => {
      w *= like(name);
      if (ok && w > 0.01 && (shared || !taken(name))) options.push([name, w]);
    };
    add('roll', 1.3 * lively);
    add('dance', 1.0 * lively);
    add('lounge', 1.1 * lively);
    // One at the bamboo at a time (two chewing side by side would chew in step).
    const clumps = spots?.snack ?? [];
    const eating = clumps.some((_, i) => taken(`snack${i}`));
    add('snack', 2.2 * (1 - 0.6 * n), clumps.length > 0 && !eating);
    add('gym', 1.8 * lively, !!spots?.gym && ctx.freeFor > 2.5);
    const nearPlay = this.role !== 'crew' || ctx.far;
    add('slide', (this.role === 'crew' ? 1.2 : 2.1) * lively, !!spots?.slide && nearPlay);
    add('swing', (this.role === 'crew' ? 1.0 : 1.9) * lively, !!spots?.swing && nearPlay && (!colony || !colony.swing.rider));
    const mate = this.role === 'crew' ? (partner?.approachable ? partner : null) : colony?.partner(this, this.rng()) ?? null;
    if (mate) options.push(['play', 1.3 * (0.3 + 0.7 * day) * like('play')]);
    if (ctx.far || this.role !== 'crew') {
      add('explore', 1.4);
      add('pond', 1.0, !!spots?.pond);
    }
    // The colony's own places.
    const colonist = this.role !== 'crew';
    add('workout', 0.5 * lively, colonist && !!spots?.yard && ctx.freeFor > 2.5);
    add('compute', 0.1 * (0.6 + 0.4 * day), colonist && !!spots?.desk);
    add('nook', 1.5 * (0.5 + 0.5 * day), colonist && !!spots?.nooks?.length);
    add('stroll', 1.3 * (1 - 0.4 * n), colonist && !!spots?.paths?.length);
    // Penguins: a swim in the pool (a dive off the ledge now and then), a go down the ice slide on the belly, a fish from
    // the crate, and (for the clumsy) a slip on the ice.
    if (this.style === 'penguin') {
      add('swim', 1.6 * lively, colonist && !!spots?.pool, true);
      add('belly', 1.5 * lively, colonist && !!spots?.ramp);
      add('fish', 1.2 * (1 - 0.5 * n), colonist && !!spots?.fish?.length);
      add('slip', 2.4 * (this.persona.clumsy ?? 0) * (1 - 0.6 * n), (this.persona.clumsy ?? 0) > 0);
    }
    const music = colony ? colony.acting('guitar', this) > 0 : false;
    add('camp', (0.4 + 2.4 * n) * (music ? 3 : 1), colonist && !!spots?.camp);
    if (this.persona.musician) add('guitar', (0.9 + 0.8 * n) * (music ? 0 : 1), !!spots?.camp && !music);
    if (this.persona.teacher) {
      const pupils = colony ? colony.members.filter((m) => m !== this && m.approachable && m.roaming && m.y < 0.02 && !m.persona.teacher).length : 0;
      add('teach', 1.0 * day, !!spots?.school && pupils >= 2);
    }
    const trailed = this.persona.follows ? colony?.find(this.persona.follows) : null;
    if (trailed) add('tail', 2.4 * day, trailed.roaming && !trailed.anchored && trailed.doing !== 'sleep');
    const companion = this.persona.near ? colony?.find(this.persona.near.name) : null;
    if (companion && this.persona.near) add('near', 6 * this.persona.near.chance, companion.roaming && !companion.anchored && companion.doing !== 'sleep');
    if (n > 0.05) {
      const sleepers = colony ? colony.members.filter((m) => m !== this && m.doing === 'sleep').length : 0;
      add('sleep', 10 * n * (this.lantern ? 0.35 : 1) * (this.persona.sleepy ?? 1), sleepers < 11, true);
      add('doze', 1.6 * n);
      add('stargaze', 1.7 * n);
      add('chase', 1.5 * n);
      add('lamp', 9 * n, this.lantern);
      add('yawn', 0.8 * n);
    }
    // Not the same thing twice running (unless it is what it lives for).
    const filtered = options.filter(([name]) => (name !== this.last[0] && name !== this.last[1]) || like(name) >= 5);
    const choice = this.pick(filtered.length > 0 ? filtered : options);
    this.last = [choice, this.last[0]];
    this.doing = choice;
    const home = ctx.home;
    const back = (): Task[] => (this.role === 'crew' || this.rng() < 0.35 ? this.goVia(ctx, home.x, home.z) : []);
    const somewhere = (radius = ctx.radius) => this.freePoint(ctx, radius);
    /** Nobody else is on or at this place right now. */
    const vacant = (p: Perch) => !colony || !colony.members.some((m) => m !== this && Math.hypot(m.x - p.at[0], m.z - p.at[1]) < 0.9);

    switch (choice) {
      case 'sit': {
        this.tasks = [{ k: 'act', act: 'sit', dur: 5.5 + this.rng() * 3, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 0.9 }];
        if (this.rng() < 0.4) this.tasks.push({ k: 'act', act: 'look', dur: 3.4, t: 0 });
        break;
      }
      case 'look': {
        this.tasks = [{ k: 'act', act: 'look', dur: 4.2, t: 0 }];
        break;
      }
      case 'fidget': {
        const penguin = this.style === 'penguin';
        const act = this.pick([['scratch', penguin ? 1 : 3], ['stretch', 2.4], ['shake', penguin ? 2 : 1], ['yawn', 0.6 + n * 2], ['adjust', 2.6 * like('adjust', 0)], ['preen', penguin ? 3 : 0]]) as IdleAct;
        this.tasks = [{ k: 'act', act, dur: act === 'scratch' ? 2.6 : act === 'stretch' ? 3.2 : act === 'yawn' ? 3.6 : act === 'adjust' ? 2.6 : act === 'preen' ? 3.2 : 1.1, t: 0 }];
        break;
      }
      case 'wander': {
        const p = somewhere();
        if (!p) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        this.tasks = [...this.goVia(ctx, p[0], p[1])];
        if (this.rng() < 0.55) this.tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'look' : 'sniff', dur: 2.6, t: 0 });
        if (this.rng() < 0.4) this.tasks.push(...back());
        break;
      }
      case 'explore': {
        // Further afield: a different part of the grove, a sit and a look, then back (or not).
        const p = somewhere(ctx.radius * 2.2) ?? somewhere();
        if (!p) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        this.tasks = [
          ...this.goVia(ctx, p[0], p[1]),
          { k: 'act', act: 'sniff', dur: 2.2, t: 0 },
          { k: 'act', act: this.rng() < 0.5 ? 'sit' : 'look', dur: 4.5, t: 0, face: CAMERA_FACE },
        ];
        if (this.rng() < 0.6) this.tasks.push(...back());
        break;
      }
      case 'stroll': {
        // Along one of the paths from one place to the next, and a look about at the end.
        const list = spots!.paths!;
        const path = list[Math.floor(this.rng() * list.length)];
        const pts = this.rng() < 0.5 ? path : [...path].reverse();
        this.tasks = pts.flatMap((p, i) => this.goVia(ctx, p[0] + (this.rng() - 0.5) * 0.6, p[1] + (this.rng() - 0.5) * 0.6, this.walkSpeed * (i === 0 ? 1 : 0.95)));
        this.tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'look' : 'sniff', dur: 3, t: 0 });
        break;
      }
      case 'roll': {
        const p = somewhere();
        if (!p) {
          this.tasks = [{ k: 'act', act: 'play', dur: 2.6, t: 0 }];
          break;
        }
        // Rolls over to a spot for the fun of it, and lies about dizzy for a moment.
        this.tasks = [{ k: 'rgo', x: p[0], z: p[1], speed: 2.6 }, { k: 'act', act: this.rng() < 0.5 ? 'sit' : 'lounge', dur: 2.6 + this.rng() * 2, t: 0, face: CAMERA_FACE }];
        if (this.role === 'crew' && this.rng() < 0.5) this.tasks.push({ k: 'rgo', x: home.x, z: home.z, speed: 2.6 });
        break;
      }
      case 'dance': {
        this.tasks = [{ k: 'act', act: 'dance', dur: 3.5 + this.rng() * 3, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 0.6 }];
        if (this.rng() < 0.5) this.tasks.push({ k: 'act', act: 'wave', dur: 2.0, t: 0, face: CAMERA_FACE });
        break;
      }
      case 'lounge': {
        this.tasks = [{ k: 'act', act: 'lounge', dur: 6 + this.rng() * 6, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 1.6 }, { k: 'act', act: 'shake', dur: 1.1, t: 0 }];
        break;
      }
      case 'snack': {
        const list = spots!.snack!;
        const free = list.map((_, i) => i).filter((i) => !taken(`snack${i}`));
        const index = free[Math.floor(this.rng() * free.length)] ?? 0;
        this.doing = `snack${index}`;
        const sp = list[index];
        this.tasks = [
          ...this.goVia(ctx, sp.at[0], sp.at[1]),
          { k: 'face', yaw: sp.face },
          { k: 'act', act: 'chew', dur: 8.5 + this.rng() * 4, t: 0, face: sp.face, stalk: index },
          { k: 'act', act: this.rng() < 0.6 ? 'stretch' : 'scratch', dur: 3.2, t: 0 },
          ...back(),
        ];
        break;
      }
      case 'gym': {
        const g = spots!.gym!;
        const fall = this.rng() < 0.4;
        const tasks: Task[] = [
          ...this.goVia(ctx, g.base[0], g.base[1]),
          { k: 'ascend', ax: g.base[0], az: g.base[1], bx: g.top[0], bz: g.top[1], y0: 0, y1: g.height, dur: 1.5, t: 0 },
          { k: 'walk', x: g.deck[0], z: g.deck[1], speed: 0.9 },
          { k: 'act', act: 'wave', dur: 2.2, t: 0, face: CAMERA_FACE },
          { k: 'act', act: this.rng() < 0.3 ? 'lounge' : 'sit', dur: 4 + this.rng() * 2, t: 0, face: CAMERA_FACE },
        ];
        if (fall) {
          // Wanders to the edge, leans out for a better look, and over it goes.
          tasks.push({ k: 'walk', x: g.drop[0] * 0.5 + g.deck[0] * 0.5, z: g.drop[1] * 0.5 + g.deck[1] * 0.5, speed: 0.8 });
          tasks.push({ k: 'act', act: 'sniff', dur: 1.2, t: 0 });
          tasks.push({ k: 'fall', x: g.deck[0], z: g.deck[1], tx: g.drop[0], tz: g.drop[1], y0: g.height, t: 0 });
        } else {
          tasks.push({ k: 'walk', x: g.top[0], z: g.top[1], speed: 0.9 });
          tasks.push({ k: 'ascend', ax: g.top[0], az: g.top[1], bx: g.base[0], bz: g.base[1], y0: g.height, y1: 0, dur: 1.3, t: 0 });
        }
        if (this.rng() < 0.5) tasks.push({ k: 'act', act: 'shake', dur: 1.1, t: 0 });
        tasks.push(...(this.role === 'crew' ? this.goVia(ctx, home.x, home.z) : []));
        this.tasks = tasks;
        break;
      }
      case 'workout': {
        // A lap or two to warm up at a jog, then a few sets at the stations (never the same twice running), a drink.
        const y = spots!.yard!;
        const tasks: Task[] = [];
        if (this.rng() < 0.65) {
          tasks.push(...this.goVia(ctx, y.jog[0][0], y.jog[0][1], PANDA.rush * 0.8));
          for (let lap = 0; lap < (this.rng() < 0.5 ? 2 : 1); lap++) for (let i = 1; i <= 4; i++) tasks.push({ k: 'walk', x: y.jog[i % 4][0], z: y.jog[i % 4][1], speed: PANDA.rush * 0.8 });
        }
        const sets: [string, number][] = [['lift', 3], ['pull', 2.2], ['punch', 2], ['squat', 2], ['yoga', 1.2]];
        const count = like('workout') > 3 ? 3 : 1 + (this.rng() < 0.4 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const set = this.pick(sets);
          sets.splice(sets.findIndex(([s]) => s === set), 1);
          if (set === 'lift') tasks.push(...this.settle(ctx, y.lift), { k: 'act', act: 'lift', dur: 9 + this.rng() * 6, t: 0, face: y.lift.face });
          else if (set === 'pull') tasks.push(...this.settle(ctx, y.pull), { k: 'act', act: 'pullup', dur: 7 + this.rng() * 5, t: 0, face: y.pull.face }, ...this.unsettle(y.pull));
          else if (set === 'punch') tasks.push(...this.settle(ctx, y.punch), { k: 'act', act: 'punch', dur: 7 + this.rng() * 5, t: 0, face: y.punch.face });
          else if (set === 'squat') tasks.push(...this.settle(ctx, y.squat), { k: 'act', act: 'squat', dur: 8 + this.rng() * 5, t: 0, face: y.squat.face });
          else tasks.push(...this.settle(ctx, y.mat), { k: 'act', act: 'stretch', dur: 3.2, t: 0 }, { k: 'act', act: 'lounge', dur: 5 + this.rng() * 3, t: 0, face: y.mat.face });
          if (i < count - 1) tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'shake' : 'stretch', dur: 2.6, t: 0 });
        }
        tasks.push(...this.settle(ctx, y.drink), { k: 'act', act: 'drink', dur: 3.4, t: 0, face: y.drink.face });
        this.tasks = tasks;
        break;
      }
      case 'compute': {
        // Sits down at the desk and types: a stretch, a yawn or a scratch of the head now and then, and back to it.
        const d = spots!.desk!.seat;
        const tasks: Task[] = [...this.settle(ctx, d), { k: 'act', act: 'type', dur: 12 + this.rng() * 16, t: 0, face: d.face }];
        for (let i = 0; i < 1 + Math.floor(this.rng() * 2); i++) {
          tasks.push({ k: 'act', act: this.pick([['stretch', 2], ['yawn', 1.4], ['scratch', 2], ['ponder', 1.6]]) as IdleAct, dur: 3.4, t: 0, face: d.face });
          tasks.push({ k: 'act', act: 'type', dur: 9 + this.rng() * 14, t: 0, face: d.face });
        }
        tasks.push(...this.unsettle(d));
        this.tasks = tasks;
        break;
      }
      case 'nook': {
        const list = spots!.nooks!.filter(vacant);
        if (!list.length) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        const k = list[Math.floor(this.rng() * list.length)];
        const tasks: Task[] = [...this.settle(ctx, k)];
        if (k.table && this.style === 'penguin') tasks.push({ k: 'act', act: 'bow', dur: 1.3, t: 0, face: k.face, fish: 'take' }, { k: 'act', act: 'eat', dur: 3.3, t: 0, face: k.face, fish: 'eat' }, { k: 'act', act: 'sit', dur: 6 + this.rng() * 5, t: 0, face: k.face });
        else if (k.table) tasks.push({ k: 'act', act: 'chew', dur: 9 + this.rng() * 5, t: 0, face: k.face }, { k: 'act', act: 'sit', dur: 4 + this.rng() * 3, t: 0, face: k.face });
        else if (k.kind === 'mat') tasks.push({ k: 'act', act: this.rng() < 0.6 ? 'lounge' : 'sit', dur: 8 + this.rng() * 8, t: 0, face: k.face });
        else tasks.push({ k: 'act', act: n > 0.5 ? 'stargaze' : 'sit', dur: 9 + this.rng() * 8, t: 0, face: k.face }, { k: 'act', act: 'look', dur: 3.4, t: 0 });
        tasks.push(...this.unsettle(k));
        this.tasks = tasks;
        break;
      }
      case 'camp': {
        // Sits by the fire on a log or the ground, watching the flames (and the stars, late on); a song makes it dance.
        const c = spots!.camp!;
        const seats = [...c.seats.slice(1), ...c.ring.filter((r) => Math.hypot(r.at[0] - c.x, r.at[1] - c.z) < 2.6)].filter(vacant);
        const seat = seats[Math.floor(this.rng() * seats.length)];
        if (!seat) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        const tasks: Task[] = [...this.settle(ctx, seat)];
        tasks.push({ k: 'act', act: music && this.rng() < 0.4 ? 'dance' : 'sit', dur: 8 + this.rng() * 10, t: 0, face: seat.face });
        tasks.push({ k: 'act', act: n > 0.5 ? (this.rng() < 0.6 ? 'stargaze' : 'doze') : 'look', dur: n > 0.5 ? 10 + this.rng() * 12 : 3.4, t: 0, face: seat.face });
        tasks.push(...this.unsettle(seat));
        this.tasks = tasks;
        break;
      }
      case 'guitar': {
        // Takes a guitar to the fire, plays and sings for a while (the others come and sit to listen).
        const c = spots!.camp!;
        const seat = vacant(c.stage) ? c.stage : c.seats[3];
        this.tasks = [...this.settle(ctx, seat), { k: 'act', act: 'guitar', dur: 22 + this.rng() * 22, t: 0, face: seat.face }, ...this.unsettle(seat)];
        break;
      }
      case 'teach': {
        // Calls a few pandas to the mats in front of the board and gives a small lesson (a question or two, applause).
        const sc = spots!.school!;
        const pupils = (colony?.members ?? [])
          .filter((m) => m !== this && m.approachable && m.roaming && m.y < 0.02 && !m.persona.teacher)
          .sort(() => this.rng() - 0.5)
          .slice(0, 2 + Math.floor(this.rng() * 3));
        const total = 22 + this.rng() * 10;
        pupils.forEach((m, i) => {
          const seat = sc.seats[i % sc.seats.length];
          const plain: IdleAct[] = ['sit', 'ponder', 'raise', 'sit', 'clap'];
          const acts = m.role === 'student' ? (['sit', 'notes', 'ponder', 'notes', 'raise', 'clap'] as IdleAct[]) : plain;
          let left = total + 3;
          const tasks: Task[] = [];
          for (const a of acts) {
            const dur = a === 'notes' ? 6 + m.randomness() * 4 : a === 'raise' ? 2.4 : a === 'clap' ? 2.6 : 3.4 + m.randomness() * 2.5;
            tasks.push({ k: 'act', act: a, dur, t: 0, face: seat.face });
            left -= dur;
            if (left <= 0) break;
          }
          m.invite(seat.at[0], seat.at[1], seat.face, tasks, 'class');
        });
        const me = sc.teacher;
        const tasks: Task[] = [...this.goVia(ctx, me.at[0], me.at[1]), { k: 'face', yaw: me.face }];
        let left = total;
        while (left > 0) {
          const dur = 6 + this.rng() * 3;
          tasks.push({ k: 'act', act: 'teach', dur, t: 0, face: me.face }, { k: 'act', act: this.rng() < 0.5 ? 'look' : 'wave', dur: 1.8, t: 0, face: me.face });
          left -= dur + 1.8;
        }
        tasks.push({ k: 'act', act: 'bow', dur: 1.5, t: 0, face: me.face });
        this.tasks = tasks;
        break;
      }
      case 'tail': {
        // Strolls along some way behind another panda, in no hurry, pretending not to be.
        const who = trailed!;
        this.tasks = [{ k: 'trail', who, dist: 2.2 + this.rng() * 0.6, dur: 14 + this.rng() * 16, t: 0 }, { k: 'act', act: 'look', dur: 2.4, t: 0 }];
        break;
      }
      case 'near': {
        // Drifts to somewhere near another panda (not up to it), has a sit or a look there, and drifts off again.
        const who = companion!;
        let p: [number, number] | null = null;
        for (let i = 0; i < 12 && !p; i++) {
          const a = this.rng() * Math.PI * 2;
          const r = 2.3 + this.rng() * 1.7;
          const x = who.x + Math.cos(a) * r, z = who.z + Math.sin(a) * r;
          if (ctx.roam && ((x - ctx.roam.cx) / ctx.roam.rx) ** 2 + ((z - ctx.roam.cz) / ctx.roam.rz) ** 2 > 0.8) continue;
          if (ctx.keepOut && (inside(ctx.keepOut, x, z, R + 0.35) || crosses(ctx.keepOut, this.x, this.z, x, z, R + 0.2))) continue;
          if (ctx.obstacles && ctx.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.55)) continue;
          p = [x, z];
        }
        if (!p) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        this.tasks = [...this.goVia(ctx, p[0], p[1]), { k: 'act', act: this.pick([['sit', 3], ['look', 2], ['wave', 1], ['sniff', 1]]) as IdleAct, dur: 7 + this.rng() * 7, t: 0, face: Math.atan2(who.x - p[0], who.z - p[1]) }];
        break;
      }
      case 'slide': {
        // Up the ladder, a wave from the top, and down the chute; often straight round for another go.
        const sl = spots!.slide!;
        const rides = 1 + (this.rng() < 0.55 ? 1 : 0) + (this.rng() < 0.25 ? 1 : 0);
        const tasks: Task[] = [];
        for (let i = 0; i < rides; i++) {
          tasks.push(
            ...this.goVia(ctx, sl.base[0], sl.base[1], this.walkSpeed * (i > 0 ? 1.35 : 1)),
            { k: 'ascend', ax: sl.base[0], az: sl.base[1], bx: sl.top[0], bz: sl.top[1], y0: 0, y1: sl.height, dur: 1.5, t: 0 },
            { k: 'act', act: i === 0 || this.rng() < 0.4 ? 'wave' : 'look', dur: 1.4, t: 0, face: CAMERA_FACE },
            { k: 'slide', ax: sl.top[0], az: sl.top[1], ay: sl.height, bx: sl.end[0], bz: sl.end[1], by: sl.endHeight, lx: sl.land[0], lz: sl.land[1], dur: 1.7, t: 0 },
          );
        }
        tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'dance' : 'shake', dur: 2.4, t: 0, face: CAMERA_FACE });
        if (this.role === 'crew') tasks.push(...this.goVia(ctx, home.x, home.z));
        this.tasks = tasks;
        break;
      }
      case 'swing': {
        const sw = spots!.swing!;
        this.tasks = [
          ...this.goVia(ctx, sw.approach[0], sw.approach[1]),
          { k: 'face', yaw: sw.face },
          { k: 'swing', x: sw.seat[0], z: sw.seat[1], height: sw.height, length: sw.length, face: sw.face, dur: 9 + this.rng() * 9, t: 0, start: 0, ax: sw.approach[0], az: sw.approach[1] },
          { k: 'act', act: 'wave', dur: 1.8, t: 0, face: CAMERA_FACE },
          ...back(),
        ];
        break;
      }
      case 'pond': {
        const pd = spots!.pond!;
        this.tasks = [
          ...this.goVia(ctx, pd.at[0], pd.at[1]),
          { k: 'face', yaw: pd.face },
          { k: 'act', act: 'drink', dur: 3.4, t: 0, face: pd.face },
          { k: 'act', act: n > 0.5 ? 'stargaze' : 'look', dur: n > 0.5 ? 8 : 3.4, t: 0 },
          ...back(),
        ];
        break;
      }
      case 'play': {
        const p = mate!;
        let mx = (this.x + p.x) / 2;
        let mz = (this.z + p.z) / 2;
        if (ctx.keepOut && inside(ctx.keepOut, mx, mz, 1.2)) mz = ctx.keepOut.maxZ + 1.6;
        // Penguins meet on open ice (never on the water, against the structures or in among the furniture).
        if (this.style === 'penguin') {
          const open = (x: number, z: number) =>
            !(ctx.keepOut && inside(ctx.keepOut, x, z, 2.2)) && !(ctx.obstacles ?? []).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5);
          if (!open(mx, mz)) {
            const alt = this.freePoint(ctx, 3);
            const spot = alt && open(alt[0], alt[1]) ? alt : open(this.x, this.z) ? ([this.x, this.z] as [number, number]) : null;
            if (!spot) {
              this.tasks = [{ k: 'act', act: 'wave', dur: 2, t: 0 }];
              break;
            }
            [mx, mz] = spot;
          }
        }
        if (!ctx.roam) {
          mx = Math.min(ctx.area.maxX - 1, Math.max(ctx.area.minX + 1, mx));
          mz = Math.min(ctx.area.maxZ - 0.5, Math.max(ctx.area.minZ + 0.5, mz));
        }
        const left = this.x <= p.x ? -1 : 1;
        const gap = 1.1;
        const mine: [number, number] = [mx + left * gap, mz];
        const theirs: [number, number] = [mx - left * gap, mz];
        const faceMine = Math.atan2(theirs[0] - mine[0], 0.0001);
        const faceTheirs = Math.atan2(mine[0] - theirs[0], 0.0001);
        // One plays, the other dances along; they don't do the same thing.
        const routine = (face: number, lead: boolean): Task[] => [
          { k: 'act', act: lead ? 'wave' : 'bow', dur: 1.5, t: 0, face },
          { k: 'act', act: lead ? 'play' : 'dance', dur: 3.6, t: 0, face },
          { k: 'act', act: lead ? 'sit' : 'clap', dur: 2.6, t: 0, face },
          ...(this.role === 'crew' ? this.goVia(ctx, home.x, home.z) : []),
        ];
        this.tasks = [...this.goVia(ctx, mine[0], mine[1]), { k: 'sync', t: 0, timeout: 7, face: faceMine }, ...routine(faceMine, true)];
        p.invite(theirs[0], theirs[1], faceTheirs, routine(faceTheirs, false).slice(0, 3));
        break;
      }
      case 'sleep': {
        const bed = this.role !== 'crew' && this.bed >= 0 && spots?.beds?.length ? spots.beds[this.bed % spots.beds.length] : null;
        if (bed) {
          // To its own bed (or mat): the school bag comes off first and is put down beside it, then up, a big yawn, and down
          // it goes on its side till morning; in the morning the bag goes back on.
          const tasks: Task[] = [...this.goVia(ctx, bed.approach[0], bed.approach[1], this.walkSpeed * 0.85)];
          if (this.hasBag) tasks.push({ k: 'act', act: 'unbag', dur: 2.2, t: 0 });
          if (bed.y > 0.05) tasks.push({ k: 'elevate', ax: bed.approach[0], az: bed.approach[1], bx: bed.at[0], bz: bed.at[1], y0: 0, y1: bed.y, dur: 1.1, t: 0, face: bed.face });
          else tasks.push({ k: 'walk', x: bed.at[0], z: bed.at[1], speed: 0.9, face: bed.face });
          tasks.push({ k: 'act', act: 'yawn', dur: 3.6, t: 0 }, { k: 'act', act: 'sleep', dur: 45 + this.rng() * 100, t: 0, face: bed.face });
          tasks.push({ k: 'act', act: 'stretch', dur: 3.2, t: 0 });
          if (bed.y > 0.05) tasks.push({ k: 'elevate', ax: bed.at[0], az: bed.at[1], bx: bed.approach[0], bz: bed.approach[1], y0: bed.y, y1: 0, dur: 0.9, t: 0 });
          if (this.hasBag) tasks.push({ k: 'act', act: 'rebag', dur: 2.2, t: 0 });
          this.tasks = tasks;
          break;
        }
        // Finds a spot, a big yawn, and down it goes on its side till morning (or till it has had enough).
        const p = this.role === 'crew' ? null : somewhere(ctx.radius * 0.8);
        this.tasks = [
          ...(p ? this.goVia(ctx, p[0], p[1], this.walkSpeed * 0.8) : []),
          { k: 'act', act: 'yawn', dur: 3.6, t: 0 },
          { k: 'act', act: 'sleep', dur: 45 + this.rng() * 100, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 1.8 },
          { k: 'act', act: 'stretch', dur: 3.2, t: 0 },
        ];
        break;
      }
      case 'swim': {
        // In at one of the edges (or off the ledge, in a dive), a few lengths of the pool with a dive or two, out again.
        const pl = spots!.pool!;
        this.pool = pl;
        const open = pl.entries.filter(vacant);
        const pickEntry = () => (open.length ? open : pl.entries)[Math.floor(this.rng() * (open.length || pl.entries.length))];
        const inner = (e: Perch, d: number): [number, number] => [e.at[0] + Math.sin(e.face) * d, e.at[1] + Math.cos(e.face) * d];
        const tasks: Task[] = [];
        if (this.rng() < 0.35 && vacant(pl.ledge)) {
          const [ix, iz] = inner(pl.ledge, 1.7);
          tasks.push(...this.settle(ctx, pl.ledge), { k: 'act', act: 'look', dur: 1.4, t: 0, face: pl.ledge.face });
          tasks.push({ k: 'plunge', ax: pl.ledge.at[0], az: pl.ledge.at[1], bx: ix, bz: iz, y0: pl.ledge.y, y1: FLOAT, dur: 1.0, t: 0, arc: 0.55 });
        } else {
          const e = pickEntry();
          const [ix, iz] = inner(e, 0.95);
          tasks.push(...this.goVia(ctx, e.at[0], e.at[1]), { k: 'face', yaw: e.face }, { k: 'act', act: 'sniff', dur: 1.2, t: 0, face: e.face });
          tasks.push({ k: 'plunge', ax: e.at[0], az: e.at[1], bx: ix, bz: iz, y0: 0, y1: FLOAT, dur: 0.8, t: 0, arc: 0.3 });
        }
        const laps = 3 + Math.floor(this.rng() * 4);
        for (let i = 0; i < laps; i++) {
          const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * 0.72;
          tasks.push({ k: 'swim', x: pl.x + Math.cos(a) * pl.rx * r, z: pl.z + Math.sin(a) * pl.rz * r, speed: SWIM * (0.8 + this.rng() * 0.5), t: 0, dive: this.rng() < 0.35 ? 1.8 + this.rng() * 1.2 : 0 });
        }
        const out = pickEntry();
        const [ox, oz] = inner(out, 0.95);
        tasks.push(
          { k: 'swim', x: ox, z: oz, speed: SWIM, t: 0, dive: 0 },
          { k: 'plunge', ax: ox, az: oz, bx: out.at[0], bz: out.at[1], y0: FLOAT, y1: 0, dur: 0.85, t: 0, arc: 0.4 },
          { k: 'act', act: 'shake', dur: 1.1, t: 0 },
          { k: 'act', act: this.rng() < 0.6 ? 'preen' : 'stretch', dur: 3.2, t: 0 },
        );
        this.tasks = tasks;
        break;
      }
      case 'belly': {
        // Up the steps at the back of the snow hill, a look down from the top, and down the lane on its belly: wheee.
        const rp = spots!.ramp!;
        const rides = 1 + (this.rng() < 0.5 ? 1 : 0);
        const tasks: Task[] = [];
        for (let i = 0; i < rides; i++) {
          const lx = rp.run[0] + (this.rng() - 0.5) * 1.6, lz = rp.run[1] + (this.rng() - 0.5) * 1.4;
          tasks.push(
            ...this.goVia(ctx, rp.base[0], rp.base[1], this.walkSpeed * (i > 0 ? 1.3 : 1)),
            { k: 'ascend', ax: rp.base[0], az: rp.base[1], bx: rp.top[0], bz: rp.top[1], y0: 0, y1: rp.height, dur: 1.7, t: 0 },
            { k: 'act', act: i === 0 || this.rng() < 0.4 ? 'wave' : 'look', dur: 1.4, t: 0, face: CAMERA_FACE },
            { k: 'belly', ax: rp.top[0], az: rp.top[1], ay: rp.height, bx: rp.end[0], bz: rp.end[1], by: 0.04, lx, lz, dur: 3.0 + this.rng() * 0.8, t: 0 },
          );
          tasks.push({ k: 'act', act: this.pick([['shake', 2], ['dance', 1], ['play', 1.2], ['look', 1]]) as IdleAct, dur: 1.8, t: 0 });
        }
        this.tasks = tasks;
        break;
      }
      case 'fish': {
        // A fish from the crate: in the beak, back goes the head, down it goes.
        const list = spots!.fish!;
        const free = list.filter(vacant);
        const sp = (free.length ? free : list)[Math.floor(this.rng() * (free.length || list.length))];
        this.tasks = [
          ...this.goVia(ctx, sp.at[0], sp.at[1]),
          { k: 'face', yaw: sp.face },
          { k: 'act', act: 'bow', dur: 1.3, t: 0, fish: 'take', face: sp.face },
          { k: 'act', act: 'eat', dur: 3.3, t: 0, fish: 'eat', face: sp.face + 0.6 },
          { k: 'act', act: this.rng() < 0.5 ? 'preen' : 'look', dur: 3, t: 0 },
        ];
        break;
      }
      case 'slip': {
        // Off for a waddle, and halfway there the ice wins: feet up, a bump, a dazed moment, the glasses put straight.
        const p = somewhere();
        if (!p) {
          this.tasks = [{ k: 'act', act: 'adjust', dur: 2.6, t: 0 }];
          break;
        }
        const mx = this.x + (p[0] - this.x) * 0.55, mz = this.z + (p[1] - this.z) * 0.55;
        const d = Math.hypot(p[0] - this.x, p[1] - this.z) || 1;
        this.tasks = [
          ...this.goVia(ctx, mx, mz, this.walkSpeed * 1.15),
          { k: 'fall', x: mx, z: mz, tx: mx + ((p[0] - this.x) / d) * 0.5, tz: mz + ((p[1] - this.z) / d) * 0.5, y0: 0, t: 0 },
          { k: 'act', act: 'adjust', dur: 2.6, t: 0 },
          { k: 'act', act: 'shake', dur: 1.1, t: 0 },
          ...this.goVia(ctx, p[0], p[1], this.walkSpeed * 0.8),
          { k: 'act', act: 'look', dur: 3, t: 0 },
        ];
        break;
      }
      case 'doze': {
        this.tasks = [{ k: 'act', act: 'doze', dur: 10 + this.rng() * 14, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 1.2 }];
        break;
      }
      case 'stargaze': {
        const p = this.role === 'crew' ? null : somewhere();
        this.tasks = [...(p ? this.goVia(ctx, p[0], p[1], this.walkSpeed * 0.8) : []), { k: 'act', act: 'stargaze', dur: 12 + this.rng() * 14, t: 0, face: CAMERA_FACE + (this.rng() - 0.5) * 1.4 }];
        break;
      }
      case 'chase': {
        // After the fireflies: a few swipes here, a few steps on, a few more there.
        const tasks: Task[] = [{ k: 'act', act: 'chase', dur: 3 + this.rng() * 2.5, t: 0 }];
        const p = somewhere(2.2);
        if (p) tasks.push({ k: 'walk', x: p[0], z: p[1], speed: this.walkSpeed * 1.3 }, { k: 'act', act: 'chase', dur: 3 + this.rng() * 3, t: 0 });
        tasks.push({ k: 'act', act: 'sit', dur: 3, t: 0 });
        this.tasks = tasks;
        break;
      }
      case 'lamp': {
        // A slow round of the grove with a lantern: from one place to the next, a look about at each.
        const tasks: Task[] = [{ k: 'lamp', on: true }];
        for (let i = 0; i < 3; i++) {
          const p = somewhere(ctx.radius * 1.6);
          if (!p) break;
          tasks.push(...this.goVia(ctx, p[0], p[1], this.walkSpeed * 0.75), { k: 'act', act: i === 1 ? 'stargaze' : 'look', dur: i === 1 ? 6 : 3.6, t: 0 });
        }
        tasks.push({ k: 'lamp', on: false });
        this.tasks = tasks;
        break;
      }
      case 'yawn': {
        this.tasks = [{ k: 'act', act: 'yawn', dur: 3.6, t: 0 }, { k: 'act', act: 'sit', dur: 4 + this.rng() * 3, t: 0 }];
        break;
      }
      default:
        this.tasks = [{ k: 'act', act: 'look', dur: 3, t: 0 }];
    }
  }

  /** A number in 0..1 from its own stream (so a teacher can give each pupil its own pace). */
  randomness(): number {
    return this.rng();
  }

  private plan(ctx: IdleContext): void {
    // Whatever comes next, it gets out of the water first.
    if (this.wet) {
      this.tasks = this.surface();
      if (this.tasks.length) return;
    }
    if (this.colonyLife) {
      this.planPanda(ctx);
      return;
    }
    const partner = ctx.partner;
    const spots = ctx.spots;
    const options: [string, number][] = [
      ['look', 3],
      ['wander', 3],
      ['fidget', 2],
    ];
    const taken = (what: string) => partner?.roaming && partner.doing === what;
    if (spots?.bucket && !taken('bucket')) options.push(['bucket', 1.5]);
    if (partner && partner.approachable) options.push(['play', 1.6]);
    if (spots?.hole && ctx.far && !taken('hole')) options.push(['hole', 0.8]);
    if (spots?.igloo && ctx.far && !taken('igloo')) options.push(['igloo', 0.6]);
    // Not the same thing twice running.
    const filtered = options.filter(([n]) => n !== this.last[0] && n !== this.last[1]);
    const choice = this.pick(filtered.length > 0 ? filtered : options);
    this.last = [choice, this.last[0]];
    this.doing = choice;
    const home = ctx.home;

    switch (choice) {
      case 'look': {
        // Stops, looks about, goes on.
        this.tasks = [{ k: 'act', act: 'look', dur: 4.2, t: 0 }];
        break;
      }
      case 'fidget': {
        const act = this.pick([['preen', 3], ['shake', 2], ['sniff', 2]]) as IdleAct;
        this.tasks = [{ k: 'act', act, dur: act === 'preen' ? 3.2 : act === 'shake' ? 1.1 : 2.4, t: 0 }];
        break;
      }
      case 'wander': {
        const p = this.freePoint(ctx, ctx.radius);
        if (!p) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        this.tasks = [...this.goVia(ctx, p[0], p[1])];
        if (this.rng() < 0.55) this.tasks.push({ k: 'act', act: this.rng() < 0.5 ? 'look' : 'sniff', dur: 2.6, t: 0 });
        // Sometimes back home afterwards, sometimes it stays where it is for the next thing.
        if (this.rng() < 0.4) this.tasks.push(...this.goVia(ctx, home.x, home.z));
        break;
      }
      case 'bucket': {
        const [bx, bz] = spots!.bucket!;
        // Stand a little in front of the bucket, facing it.
        const sx = bx - 1.0 + (this.index === 1 ? 1.1 : 0), sz = bz + 0.9 + (this.index === 1 ? 0.6 : 0);
        this.tasks = [
          ...this.goVia(ctx, sx, sz),
          { k: 'face', yaw: Math.atan2(bx - sx, bz - sz) },
          { k: 'act', act: 'bow', dur: 1.3, t: 0, fish: 'take' },
          { k: 'act', act: 'eat', dur: 3.3, t: 0, fish: 'eat', face: CAMERA_FACE },
          ...this.goVia(ctx, home.x, home.z),
        ];
        break;
      }
      case 'hole': {
        const [hx, hz] = spots!.hole!;
        const sx = hx - 1.75, sz = hz + 0.75;
        this.tasks = [
          ...this.goVia(ctx, sx, sz),
          { k: 'face', yaw: Math.atan2(hx - sx, hz - sz) },
          { k: 'act', act: 'sniff', dur: 1.9, t: 0, fish: 'peer' },
          { k: 'splash' },
          { k: 'act', act: 'bow', dur: 1.4, t: 0, fish: 'take' },
          { k: 'act', act: 'eat', dur: 3.3, t: 0, fish: 'eat', face: CAMERA_FACE },
          ...this.goVia(ctx, home.x, home.z),
        ];
        break;
      }
      case 'igloo': {
        const { door, approach, center } = spots!.igloo!;
        this.tasks = [
          ...this.goVia(ctx, approach[0], approach[1]),
          { k: 'walk', x: door[0], z: door[1], speed: WALK },
          // In through the door; the dome hides the rest.
          { k: 'walk', x: center[0], z: center[1], speed: WALK * 0.8 },
          { k: 'hide', dur: 3.2, t: 0 },
          { k: 'walk', x: door[0], z: door[1], speed: WALK * 0.8 },
          { k: 'walk', x: approach[0], z: approach[1], speed: WALK },
          { k: 'act', act: 'shake', dur: 1.1, t: 0 },
          ...this.goVia(ctx, home.x, home.z),
        ];
        break;
      }
      case 'play': {
        const p = partner!;
        // Meet halfway (in the open), face to face.
        let mx = (this.x + p.x) / 2;
        let mz = (this.z + p.z) / 2;
        if (ctx.keepOut && inside(ctx.keepOut, mx, mz, 1.2)) mz = ctx.keepOut.maxZ + 1.6;
        mx = Math.min(ctx.area.maxX - 1, Math.max(ctx.area.minX + 1, mx));
        mz = Math.min(ctx.area.maxZ - 0.5, Math.max(ctx.area.minZ + 0.5, mz));
        const left = this.x <= p.x ? -1 : 1;
        const gap = 0.95;
        const mine: [number, number] = [mx + left * gap, mz];
        const theirs: [number, number] = [mx - left * gap, mz];
        const faceMine = Math.atan2(theirs[0] - mine[0], 0.0001);
        const faceTheirs = Math.atan2(mine[0] - theirs[0], 0.0001);
        const routine = (face: number, wave: boolean): Task[] => [
          { k: 'act', act: wave ? 'wave' : 'bow', dur: 1.5, t: 0, face },
          { k: 'act', act: 'play', dur: 3.2, t: 0, face },
          ...this.goVia(ctx, home.x, home.z),
        ];
        const t0 = this.goVia(ctx, mine[0], mine[1]);
        this.tasks = [...t0, { k: 'sync', t: 0, timeout: 7, face: faceMine }, ...routine(faceMine, true)];
        p.invite(theirs[0], theirs[1], faceTheirs, routine(faceTheirs, false).slice(0, 2));
        break;
      }
      default:
        this.tasks = [{ k: 'act', act: 'look', dur: 3, t: 0 }];
    }
  }
}

/** Facing the camera (the stage camera sits a little to the left). */
const CAMERA_FACE = -0.16;

/** Acts that settle into a posture (sitting, lying) and so ease out of it at the end rather than stopping dead. */
const FADING: ReadonlySet<IdleAct> = new Set<IdleAct>(['sit', 'chew', 'drink', 'sleep', 'doze', 'stargaze', 'lounge', 'notes', 'ponder', 'clap', 'dance', 'chase', 'guitar', 'type', 'lift', 'squat', 'pullup', 'punch', 'teach', 'unbag', 'rebag', 'adjust']);

/** Near relations of an act, done instead when another panda is already doing it. */
const SWAPS: Partial<Record<IdleAct, IdleAct[]>> = {
  look: ['sniff', 'scratch', 'shake', 'wave'],
  sniff: ['look', 'scratch', 'shake'],
  sit: ['lounge', 'look', 'scratch', 'stargaze', 'doze', 'sniff'],
  stretch: ['yawn', 'shake', 'scratch', 'look'],
  shake: ['scratch', 'stretch', 'look'],
  scratch: ['shake', 'look', 'stretch', 'sniff'],
  wave: ['bow', 'clap', 'look'],
  bow: ['wave', 'look'],
  yawn: ['stretch', 'scratch', 'shake'],
  dance: ['clap', 'wave', 'look'],
  play: ['dance', 'clap', 'wave'],
  chase: ['dance', 'look', 'sniff'],
  lounge: ['sit', 'stargaze', 'scratch', 'look'],
  doze: ['stargaze', 'sit', 'look'],
  stargaze: ['doze', 'sit', 'look'],
  ponder: ['notes', 'sit'],
  clap: ['wave', 'look'],
  raise: ['ponder', 'notes'],
};
/** Acts that only make sense in the dark. */
const NIGHT_ONLY: ReadonlySet<IdleAct> = new Set<IdleAct>(['stargaze', 'chase', 'doze']);

/** How far (x, z) is outside the box (0 inside it). */
function boxGap(b: Box, x: number, z: number): number {
  const gx = Math.max(b.minX - x, 0, x - b.maxX);
  const gz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(gx, gz);
}

/** Whether the segment (ax, az)-(bx, bz) passes within r of (cx, cz). */
function segmentNear(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, r: number): boolean {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  const u = l2 > 1e-9 ? Math.max(0, Math.min(1, ((cx - ax) * vx + (cz - az) * vz) / l2)) : 0;
  return Math.hypot(ax + vx * u - cx, az + vz * u - cz) < r;
}

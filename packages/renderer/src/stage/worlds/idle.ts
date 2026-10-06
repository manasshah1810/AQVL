import type { IdleAct } from './three/rigs';
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
}

export interface IdleOut {
  x: number;
  z: number;
  yaw: number;
  gait: 'stand' | 'walk' | 'glide' | 'roll' | 'climb' | 'tumble';
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
}

type Task =
  | { k: 'walk'; x: number; z: number; speed: number; face?: number }
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
  | { k: 'rgo'; x: number; z: number; speed: number };

/** Counts meetings between friends, so each can tell the other has already moved on. */
let meetings = 0;

const WALK = 1.55;
const RUSH = 5.2;
const STRIDE = 0.27;
const R = 0.5;
/** Pandas amble: a longer stride, a gentler pace, a trot rather than a slide when in a hurry. */
const PANDA = { walk: 1.45, rush: 3.4, stride: 0.46, climb: 2.3 };
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

  constructor(seed: number, readonly index: number, readonly style: IdleStyle = 'penguin') {
    this.rng = mulberry32(seed * 7919 + index * 104729 + 13);
  }

  private get walkSpeed(): number {
    return this.style === 'panda' ? PANDA.walk : WALK;
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
  invite(x: number, z: number, face: number, others: Task[]): void {
    this.doing = 'play';
    this.fish = 0;
    this.tasks = [{ k: 'walk', x, z, speed: this.walkSpeed }, { k: 'sync', t: 0, timeout: 7, face }, ...others];
  }

  update(dt: number, ctx: IdleContext): IdleOut {
    dt = Math.min(dt, 0.1);
    this.splash = false;
    this.gait = 'stand';
    this.gaitW = 0;
    this.actName = 'none';
    this.actWeight = 0;
    this.slope = 0;
    this.stalk = -1;

    if (this.tasks.length === 0) this.doing = '';
    if (!ctx.free) {
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

    if (this.tasks.length === 0) this.plan(ctx);
    this.away = true;
    this.run(dt, ctx);
    return this.out();
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
    };
  }

  private moveTo(dx: number, dz: number, d: number, step: number, speed: number): void {
    const heading = Math.atan2(dx, dz);
    const dt = step / Math.max(speed, 0.01);
    this.yaw += wrap(heading - this.yaw) * Math.min(1, 9 * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    if (this.style === 'panda') {
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
        // Route from here (the plan was made long before it is walked).
        const legs = this.around(ctx, task.x, task.z).map(([x, z]) => ({ k: 'walk', x, z, speed: task.speed }) as Task);
        this.tasks.splice(0, 1, ...legs);
        return;
      }
      case 'walk': {
        const dx = task.x - this.x;
        const dz = task.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) {
          this.tasks.shift();
          if (task.face !== undefined) this.tasks.unshift({ k: 'face', yaw: task.face });
          return;
        }
        // Slow down into the last stretch, speed up out of the first.
        const speed = task.speed * Math.min(1, 0.45 + d * 0.9);
        const step = Math.min(d, speed * dt);
        this.moveTo(dx, dz, d, step, speed);
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
        task.t += dt;
        if (task.face !== undefined) this.yaw += wrap(task.face - this.yaw) * Math.min(1, 5 * dt);
        this.actName = task.act;
        this.actT = task.t;
        this.actWeight = this.style === 'panda' && (task.act === 'sit' || task.act === 'chew' || task.act === 'drink') ? Math.max(0, Math.min(1, (task.dur - task.t) / 0.5)) : 1;
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
      default:
        return;
    }
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
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 0.9 + this.rng() * radius;
      // The front of the ice is where there is room: nudge the walk towards the camera.
      const x = ctx.home.x + Math.cos(a) * r;
      const z = ctx.home.z + Math.sin(a) * r * 0.7 + 0.4;
      if (x < ctx.area.minX || x > ctx.area.maxX || z < ctx.area.minZ || z > ctx.area.maxZ) continue;
      if (ctx.keepOut && (inside(ctx.keepOut, x, z, R + 0.35) || crosses(ctx.keepOut, this.x, this.z, x, z, R + 0.2))) continue;
      const p = ctx.partner;
      if (p && Math.hypot(p.x - x, p.z - z) < 1.2) continue;
      return [x, z];
    }
    return null;
  }

  /** A way round the cells: via the end of the row nearest the way. */
  private around(ctx: IdleContext, tx: number, tz: number): [number, number][] {
    const box = ctx.keepOut;
    if (!box || !crosses(box, this.x, this.z, tx, tz, R + 0.4)) return [[tx, tz]];
    const side = (this.x + tx) / 2 < (box.minX + box.maxX) / 2 ? box.minX - R - 1.0 : box.maxX + R + 1.0;
    const front = box.maxZ + R + 0.9;
    const back = box.minZ - R - 1.0;
    const pts: [number, number][] = [];
    if (this.z > box.maxZ) pts.push([side, front]);
    else if (this.z < box.minZ) pts.push([side, back]);
    else pts.push([side, this.z]);
    if (tz < box.minZ) pts.push([side, back]);
    else if (tz > box.maxZ) pts.push([side, front]);
    pts.push([tx, tz]);
    return pts;
  }

  /** A way to (tx, tz) that keeps clear of the cells, worked out from wherever the animal is when it sets off. */
  private goVia(_ctx: IdleContext, tx: number, tz: number, speed = this.walkSpeed): Task[] {
    return [{ k: 'go', x: tx, z: tz, speed }];
  }

  /** What a panda does with its time: sits and chews bamboo, climbs the gym (and sometimes falls off it), rolls about, scratches, stretches, drinks at the pond, explores, plays. */
  private planPanda(ctx: IdleContext): void {
    const partner = ctx.partner;
    const spots = ctx.spots;
    const taken = (what: string) => partner?.roaming && partner.doing === what;
    const options: [string, number][] = [
      ['sit', 2.4],
      ['look', 1.6],
      ['wander', 2.6],
      ['fidget', 2.2],
      ['roll', 1.5],
    ];
    if (spots?.snack && spots.snack.length > 0 && !taken('snack')) options.push(['snack', 2.4]);
    if (spots?.gym && ctx.freeFor > 2.5 && !taken('gym')) options.push(['gym', 2.0]);
    if (partner && partner.approachable) options.push(['play', 1.8]);
    if (ctx.far) {
      options.push(['explore', 1.4]);
      if (spots?.pond && !taken('pond')) options.push(['pond', 1.0]);
    }
    const filtered = options.filter(([n]) => n !== this.last[0] && n !== this.last[1]);
    const choice = this.pick(filtered.length > 0 ? filtered : options);
    this.last = [choice, this.last[0]];
    this.doing = choice;
    const home = ctx.home;

    switch (choice) {
      case 'sit': {
        this.tasks = [{ k: 'act', act: 'sit', dur: 5.5 + this.rng() * 3, t: 0, face: CAMERA_FACE }];
        if (this.rng() < 0.4) this.tasks.push({ k: 'act', act: 'look', dur: 3.4, t: 0 });
        break;
      }
      case 'look': {
        this.tasks = [{ k: 'act', act: 'look', dur: 4.2, t: 0 }];
        break;
      }
      case 'fidget': {
        const act = this.pick([['scratch', 3], ['stretch', 2.4], ['shake', 1]]) as IdleAct;
        this.tasks = [{ k: 'act', act, dur: act === 'scratch' ? 2.6 : act === 'stretch' ? 3.2 : 1.1, t: 0 }];
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
        if (this.rng() < 0.4) this.tasks.push(...this.goVia(ctx, home.x, home.z));
        break;
      }
      case 'explore': {
        // Further afield: a different part of the grove, a sit and a look, then back (or not).
        const p = this.freePoint(ctx, ctx.radius * 2.2) ?? this.freePoint(ctx, ctx.radius);
        if (!p) {
          this.tasks = [{ k: 'act', act: 'look', dur: 3.4, t: 0 }];
          break;
        }
        this.tasks = [
          ...this.goVia(ctx, p[0], p[1]),
          { k: 'act', act: 'sniff', dur: 2.2, t: 0 },
          { k: 'act', act: this.rng() < 0.5 ? 'sit' : 'look', dur: 4.5, t: 0, face: CAMERA_FACE },
        ];
        if (this.rng() < 0.6) this.tasks.push(...this.goVia(ctx, home.x, home.z));
        break;
      }
      case 'roll': {
        const p = this.freePoint(ctx, ctx.radius);
        if (!p) {
          this.tasks = [{ k: 'act', act: 'play', dur: 2.6, t: 0 }];
          break;
        }
        // Rolls over to a spot for the fun of it, and lies about dizzy for a moment.
        this.tasks = [{ k: 'rgo', x: p[0], z: p[1], speed: 2.6 }, { k: 'act', act: 'sit', dur: 2.6, t: 0, face: CAMERA_FACE }];
        if (this.rng() < 0.5) this.tasks.push({ k: 'rgo', x: home.x, z: home.z, speed: 2.6 });
        break;
      }
      case 'snack': {
        const list = spots!.snack!;
        const index = Math.floor(this.rng() * list.length);
        const sp = list[index];
        this.tasks = [
          ...this.goVia(ctx, sp.at[0], sp.at[1]),
          { k: 'face', yaw: sp.face },
          { k: 'act', act: 'chew', dur: 8.5 + this.rng() * 2, t: 0, face: sp.face, stalk: index },
          { k: 'act', act: 'stretch', dur: 3.2, t: 0 },
          ...this.goVia(ctx, home.x, home.z),
        ];
        break;
      }
      case 'gym': {
        const g = spots!.gym!;
        const fall = this.rng() < 0.45;
        const tasks: Task[] = [
          ...this.goVia(ctx, g.base[0], g.base[1]),
          { k: 'ascend', ax: g.base[0], az: g.base[1], bx: g.top[0], bz: g.top[1], y0: 0, y1: g.height, dur: 1.5, t: 0 },
          { k: 'walk', x: g.deck[0], z: g.deck[1], speed: 0.9 },
          { k: 'act', act: 'wave', dur: 2.2, t: 0, face: CAMERA_FACE },
          { k: 'act', act: 'sit', dur: 4 + this.rng() * 2, t: 0, face: CAMERA_FACE },
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
        tasks.push(...this.goVia(ctx, home.x, home.z));
        this.tasks = tasks;
        break;
      }
      case 'pond': {
        const pd = spots!.pond!;
        this.tasks = [
          ...this.goVia(ctx, pd.at[0], pd.at[1]),
          { k: 'face', yaw: pd.face },
          { k: 'act', act: 'drink', dur: 3.4, t: 0, face: pd.face },
          { k: 'act', act: 'look', dur: 3.4, t: 0 },
          ...this.goVia(ctx, home.x, home.z),
        ];
        break;
      }
      case 'play': {
        const p = partner!;
        let mx = (this.x + p.x) / 2;
        let mz = (this.z + p.z) / 2;
        if (ctx.keepOut && inside(ctx.keepOut, mx, mz, 1.2)) mz = ctx.keepOut.maxZ + 1.6;
        mx = Math.min(ctx.area.maxX - 1, Math.max(ctx.area.minX + 1, mx));
        mz = Math.min(ctx.area.maxZ - 0.5, Math.max(ctx.area.minZ + 0.5, mz));
        const left = this.x <= p.x ? -1 : 1;
        const gap = 1.1;
        const mine: [number, number] = [mx + left * gap, mz];
        const theirs: [number, number] = [mx - left * gap, mz];
        const faceMine = Math.atan2(theirs[0] - mine[0], 0.0001);
        const faceTheirs = Math.atan2(mine[0] - theirs[0], 0.0001);
        const routine = (face: number, wave: boolean): Task[] => [
          { k: 'act', act: wave ? 'wave' : 'bow', dur: 1.5, t: 0, face },
          { k: 'act', act: 'play', dur: 3.6, t: 0, face },
          { k: 'act', act: 'sit', dur: 2.6, t: 0, face },
          ...this.goVia(ctx, home.x, home.z),
        ];
        this.tasks = [...this.goVia(ctx, mine[0], mine[1]), { k: 'sync', t: 0, timeout: 7, face: faceMine }, ...routine(faceMine, true)];
        p.invite(theirs[0], theirs[1], faceTheirs, routine(faceTheirs, false).slice(0, 3));
        break;
      }
      default:
        this.tasks = [{ k: 'act', act: 'look', dur: 3, t: 0 }];
    }
  }

  private plan(ctx: IdleContext): void {
    if (this.style === 'panda') {
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

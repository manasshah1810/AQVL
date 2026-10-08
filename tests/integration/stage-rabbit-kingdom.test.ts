/**
 * The rabbits' cloud kingdom: nine islands at different heights round the plaza the structures stand on, every one
 * reachable from every other (bridges, stepping clouds, platforms, a slide, a trampoline, a drop, a balloon lift), and
 * the twelve rabbits who live there (nine characters and three students): by day they spread out over the islands
 * about their own routines, at noon they gather round Manan's campfire, at night all but the night owls go to bed
 * (the students with their bags put down beside them), and when a run plays the crew hop to the cells while the
 * students take the front row and take notes.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { DAY_LENGTH, NOON, blankDay, dayAt } from '../../packages/renderer/src/stage/worlds/daycycle';
import { WORLDS, isStageWorld } from '../../packages/renderer/src/stage/worlds/types';
import { WORLD_PALETTES } from '../../packages/renderer/src/stage/worlds/palettes';
import { groveNav } from '../../packages/renderer/src/stage/worlds/three/PandaNav';
import { kingdomOf, routeBetween, type IslandId } from '../../packages/renderer/src/stage/worlds/rabbit/kingdom';
import { CREW, POSES, STUMBLE, WARREN, Warren } from '../../packages/renderer/src/stage/worlds/rabbit/warren';
import { buildBunny, poseBunny } from '../../packages/renderer/src/stage/worlds/rabbit/three/bunny';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());
afterEach(() => {
  delete (globalThis as { __aqvlDayPhase?: number }).__aqvlDayPhase;
});

async function modelOf(id: string): Promise<StageModel> {
  const t = await recordTrace(compile(getExampleById(id)!.source) as any);
  return new StageModel(t, 'dark', getExampleById(id)!.source, 'rabbit');
}

function dayOf(phase: number) {
  (globalThis as { __aqvlDayPhase?: number }).__aqvlDayPhase = phase;
  return dayAt(0, blankDay());
}

/** Runs the warren for `seconds` at a fixed time of day; the step and play state come from `at`. */
function run(model: StageModel, warren: Warren, seconds: number, phase: number, at: (t: number) => { k: number; playing: boolean }, start = 0, onStep?: (t: number) => void) {
  const sample = new StageSample(model.slots.length, model.edgeSlots.length);
  const day = dayOf(phase);
  const dt = 0.1;
  for (let t = 0; t < seconds; t += dt) {
    const { k, playing } = at(t);
    sampleStage(model, k, 1, 1, sample, { reducedMotion: false });
    warren.update({ model, sample, now: start + t, dt, day, playing, working: playing, calm: false });
    onStep?.(t);
  }
  return start + seconds;
}

describe('Rabbit cloud kingdom: registration', () => {
  it('is a world of its own with a palette and a crew of two', () => {
    expect(isStageWorld('rabbit')).toBe(true);
    expect(WORLDS.rabbit.crew).toEqual(['Bansaree', 'Deep']);
    expect(WORLD_PALETTES.rabbit).toBeDefined();
    expect(WARREN.slice(0, CREW).map((b) => b.name)).toEqual(WORLDS.rabbit.crew);
  });

  it('is home to exactly the nine characters and the three students, each looking like no one else', () => {
    expect(WARREN.map((b) => b.name).sort()).toEqual(['Aastha', 'Bansaree', 'Deep', 'Dishi', 'Lin', 'Manan', 'Manas', 'Siddhant', 'Tao', 'Tirrth', 'Yash', 'Yuki']);
    expect(WARREN.filter((b) => b.role === 'student').map((b) => b.name)).toEqual(['Lin', 'Tao', 'Yuki']);
    const by = (n: string) => WARREN.find((b) => b.name === n)!.look;
    expect(by('Yash').build).toBe('muscle');
    expect(by('Manas').build).toBe('chubby');
    expect(by('Deep').acc).toContain('bigglasses');
    expect(by('Tirrth').acc).toContain('fedora');
    expect(by('Tirrth').skin).toBeDefined();
    expect(by('Siddhant').acc).toContain('chain');
    expect(by('Manan').gear?.kind).toBe('guitar');
    expect(by('Aastha').scale).toBeLessThan(Math.min(...WARREN.filter((b) => b.name !== 'Aastha').map((b) => b.look.scale)));
    for (const st of ['Lin', 'Tao', 'Yuki']) expect(by(st).gear?.kind).toBe('bag');
    // No two share a look.
    const keys = WARREN.map((b) => JSON.stringify([b.look.fur, b.look.acc, b.look.build, b.look.scale]));
    expect(new Set(keys).size).toBe(WARREN.length);
  });
});

describe('Rabbit cloud kingdom: layout', () => {
  it('stands the structures on the plaza, at the floor, with room round them', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = kingdomOf(model);
    const p = k.islands.plaza;
    expect(p.y).toBe(model.floorY);
    const f = model.footprint();
    // The whole footprint lies well inside the plaza.
    for (const [x, z] of [[f.minX, f.minZ], [f.maxX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.maxZ]]) {
      expect(Math.hypot((x - p.x) / p.rx, (z - p.z) / p.rz)).toBeLessThan(0.8);
    }
    // No activity spot sits in the clear space the structures use.
    for (const s of k.spots.filter((s) => s.island === 'plaza')) {
      expect(Math.hypot((s.x - p.x) / k.clearX, (s.z - p.z) / k.clearZ)).toBeGreaterThan(1);
    }
  });

  it('spreads the islands over several heights without overlapping', async () => {
    const k = kingdomOf(await modelOf('sorting-bubble-sort'));
    const list = Object.values(k.islands);
    const heights = new Set(list.map((i) => Math.round(i.y)));
    expect(heights.size).toBeGreaterThanOrEqual(6);
    expect(Math.max(...list.map((i) => i.y)) - Math.min(...list.map((i) => i.y))).toBeGreaterThan(20);
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const A = list[a], B = list[b];
        // Each island's radius along the line between them (they are ellipses).
        const ang = Math.atan2(B.z - A.z, B.x - A.x);
        const along = (i: typeof A) => 1 / Math.hypot(Math.cos(ang) / i.rx, Math.sin(ang) / i.rz);
        const gap = Math.hypot(A.x - B.x, A.z - B.z) - along(A) - along(B);
        // Either apart on the ground plan, or far apart in height.
        expect(gap > 0.5 || Math.abs(A.y - B.y) > 8).toBe(true);
      }
    }
  });

  it('connects every island to every other, with every kind of crossing', async () => {
    const k = kingdomOf(await modelOf('sorting-bubble-sort'));
    const ids = Object.keys(k.islands) as IslandId[];
    for (const a of ids) for (const b of ids) if (a !== b) expect(routeBetween(k, a, b).length, `${a} → ${b}`).toBeGreaterThan(0);
    const kinds = new Set(k.links.map((l) => l.kind));
    for (const kind of ['rainbow', 'cloud', 'steps', 'platforms', 'slide', 'bounce', 'drop', 'lift'] as const) expect(kinds.has(kind)).toBe(true);
    // Hops between stepping clouds and platforms are short enough to jump.
    for (const l of k.links.filter((l) => l.kind === 'steps' || l.kind === 'platforms')) {
      for (let i = 1; i < l.pts.length; i++) expect(Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][2] - l.pts[i - 1][2])).toBeLessThan(3.6);
    }
    // Bridges start and end on their islands' tops.
    for (const l of k.links) {
      expect(l.pts[0][1]).toBeCloseTo(k.islands[l.a].y, 5);
      expect(l.pts[l.pts.length - 1][1]).toBeCloseTo(k.islands[l.b].y, 5);
    }
  });

  it('grows with the structures', async () => {
    const small = kingdomOf(await modelOf('sorting-bubble-sort'));
    const ids = ['sorting-merge-sort', 'arrays-merge-sorted', 'linked-list-doubly', 'sorting-heap-sort'].filter((id) => getExampleById(id));
    for (const id of ids) {
      const k = kingdomOf(await modelOf(id));
      expect(k.plazaRx).toBeGreaterThan(k.clearX);
      expect(k.plazaRz).toBeGreaterThan(k.clearZ);
      expect(routeBetween(k, 'farm', 'lookout').length).toBeGreaterThan(0);
    }
    expect(small.reach).toBeGreaterThan(30);
  });

  it('lets the camera roam the whole kingdom and dip below the plaza', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = kingdomOf(model);
    const nav = groveNav(model);
    expect(nav.reachX).toBeGreaterThanOrEqual(k.reach);
    expect(nav.minY).toBeLessThan(Math.min(...Object.values(k.islands).map((i) => i.y)));
  });
});

describe('Rabbit cloud kingdom: the warren', () => {
  it('spreads out over the islands by day, crossing the links, and never falls off', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const k = warren.kingdom;
    const visited = new Set<IslandId>();
    const kinds = new Set<string>();
    run(model, warren, 600, 0.2, () => ({ k: 0, playing: false }), 0, () => {
      for (const b of warren.bunnies) {
        visited.add(b.island);
        if (b.plan[0]?.kind === 'cross' && b.legT > 0) kinds.add(b.plan[0].link.kind);
        expect(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)).toBe(true);
        // Standing still means standing on an island's top (a trampoline or the climbing tower at most a little above).
        if (b.gait === 'stand' && !b.plan.length) {
          const i = k.islands[b.island];
          expect(b.y - i.y).toBeGreaterThan(-0.01);
          expect(b.y - i.y).toBeLessThan(2.6);
          expect(Math.hypot((b.x - i.x) / i.rx, (b.z - i.z) / i.rz)).toBeLessThan(1.02);
        }
      }
    });
    expect(visited.size).toBeGreaterThanOrEqual(6);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    const doing = new Set(warren.bunnies.map((b) => b.spot?.act).filter(Boolean));
    expect(doing.size).toBeGreaterThanOrEqual(5);
  });

  it('goes to bed at night, except the night owls; the students put their bags down first', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    run(model, warren, 400, 0.75, () => ({ k: 0, playing: false }));
    for (const b of warren.bunnies) {
      if (b.info.owl) {
        expect(b.pose, b.info.name).not.toBe('sleep');
      } else {
        expect(b.pose, b.info.name).toBe('sleep');
        expect(b.island, b.info.name).toBe(b.info.home);
      }
      if (b.info.role === 'student') expect(b.gear, b.info.name).toBe('aside');
    }
    expect(warren.bunnies.filter((b) => b.info.owl).map((b) => b.info.name).sort()).toEqual(['Manan', 'Manas', 'Siddhant']);
  });

  it('keeps each character to its own routine', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const time = new Map<string, Map<string, number>>();
    run(model, warren, 1500, 0.2, () => ({ k: 0, playing: false }), 0, () => {
      for (const b of warren.bunnies) {
        let m = time.get(b.info.name);
        if (!m) time.set(b.info.name, (m = new Map()));
        const where = b.plan.length ? 'moving' : `${b.island}:${b.spot?.act}`;
        m.set(where, (m.get(where) ?? 0) + 1);
        m.set(b.island, (m.get(b.island) ?? 0) + 1);
      }
    });
    const share = (name: string, test: (k: string) => boolean) => {
      const m = time.get(name)!;
      let hit = 0, all = 0;
      for (const [k, v] of m) if (k.includes(':') || k === 'moving') { all += v; if (test(k)) hit += v; }
      return hit / all;
    };
    // Yash lives at the gym; Manas at his desk (or his beanbag); Manan with his guitar; the students at their desks a good while.
    expect(share('Yash', (k) => /weights|stretch|jumps|cooldown|practice/.test(k))).toBeGreaterThan(0.3);
    expect(share('Manas', (k) => /computer|lounge/.test(k))).toBeGreaterThan(0.35);
    expect(share('Manan', (k) => /music|listen/.test(k))).toBeGreaterThan(0.3);
    expect(share('Bansaree', (k) => /teach/.test(k))).toBeGreaterThan(0.25);
    expect(['Lin', 'Tao', 'Yuki'].some((n) => share(n, (k) => /study/.test(k)) > 0.1)).toBe(true);
    // The roamers get about.
    for (const n of ['Tirrth', 'Aastha', 'Siddhant', 'Dishi']) {
      const islands = [...time.get(n)!.keys()].filter((k) => !k.includes(':') && k !== 'moving');
      expect(islands.length, n).toBeGreaterThanOrEqual(4);
    }
  });

  it('lets Tirrth tag after Dishi now and then (never for long, and she sometimes slips away)', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const tirrth = warren.who('Tirrth')!, dishi = warren.who('Dishi')!;
    let chasing = 0, total = 0, startles = 0, lastStartle = -1, near = 0;
    run(model, warren, 2400, 0.2, () => ({ k: 0, playing: false }), 0, () => {
      total++;
      if (tirrth.chase) chasing++;
      if (dishi.startleAt !== lastStartle) { lastStartle = dishi.startleAt; startles++; }
      if (tirrth.island === dishi.island && Math.hypot(tirrth.x - dishi.x, tirrth.z - dishi.z) < 1.2) near++;
    });
    expect(chasing / total).toBeGreaterThan(0.05);
    expect(chasing / total).toBeLessThan(0.7);
    expect(startles).toBeGreaterThan(1);
    // He keeps his distance: hardly ever right beside her.
    expect(near / total).toBeLessThan(0.05);
  });

  it('gathers round Manan\'s campfire at noon, each doing its own thing', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const k = warren.kingdom;
    run(model, warren, 30, 0.2, () => ({ k: 0, playing: false }));
    run(model, warren, 240, NOON + 50 / DAY_LENGTH, () => ({ k: 0, playing: false }), 30);
    const [fx, , fz] = k.fire;
    const round = warren.bunnies.filter((b) => b.island === 'village' && !b.plan.length && Math.hypot(b.x - fx, b.z - fz) < 3.5);
    expect(round.length).toBeGreaterThanOrEqual(6);
    const manan = warren.who('Manan')!;
    expect(round).toContain(manan);
    expect(manan.pose).toMatch(/guitar|sing/);
    expect(manan.gear).toBe('play');
    // Not everyone does the same thing.
    expect(new Set(round.filter((b) => b !== manan).map((b) => b.pose)).size).toBeGreaterThanOrEqual(2);
    // Afterwards they drift back to their days (not all at once).
    run(model, warren, 200, NOON + 200 / DAY_LENGTH, () => ({ k: 0, playing: false }), 270);
    expect(warren.bunnies.filter((b) => b.intent === 'fire').length).toBe(0);
  });

  it('lets Deep stumble now and then, and get up again', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const deep = warren.who('Deep')!;
    let falls = 0, last = -100, stumbling = 0, total = 0;
    run(model, warren, 1800, 0.2, () => ({ k: 0, playing: false }), 0, () => {
      total++;
      if (deep.stumbleAt !== last) { last = deep.stumbleAt; falls++; }
      if (deep.pose === 'stumble') stumbling++;
    });
    expect(falls).toBeGreaterThan(1);
    // Clumsy, not constantly falling.
    expect(stumbling / total).toBeLessThan(0.15);
    expect(STUMBLE).toBeGreaterThan(1);
  });

  it('gathers at the plaza when a run plays, with the crew at the cells', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const k = warren.kingdom;
    let end = run(model, warren, 120, 0.2, () => ({ k: 0, playing: false }));
    const step = Math.min(6, model.frameCount - 1);
    end = run(model, warren, 240, 0.2, () => ({ k: step, playing: true }), end);
    const p = k.islands.plaza;
    // The crew and the students are always there; most of the others come over too.
    const there = warren.bunnies.filter((b) => b.island === 'plaza' && !b.plan.length);
    for (const b of warren.bunnies.filter((b) => b.info.role !== 'resident')) expect(there, b.info.name).toContain(b);
    expect(there.length).toBeGreaterThanOrEqual(8);
    // The audience sits outside the structures' space, facing in; the students in the front row's middle, taking notes.
    for (const b of there.slice(CREW).filter((b) => b.intent === 'audience')) {
      expect(b.pose).toMatch(/watch|cheer|notes|ponder|raise|chat|cool|adjust/);
      expect(Math.hypot((b.x - p.x) / k.clearX, (b.z - p.z) / k.clearZ)).toBeGreaterThan(1);
    }
    const students = warren.bunnies.filter((b) => b.info.role === 'student');
    for (const st of students) expect(Math.abs(st.x - p.x), st.info.name).toBeLessThan(k.clearX);
    expect(new Set(students.map((b) => b.pose)).size + new Set(students.map((b) => Math.round(b.yaw * 10))).size).toBeGreaterThan(2);
    // The crew stand right in front of the step's cells.
    const sample = new StageSample(model.slots.length, model.edgeSlots.length);
    sampleStage(model, step, 1, 1, sample, { reducedMotion: false });
    const slots = model.frames[step].event.actors.map((id) => model.slotOf.get(id)!).filter((s) => s !== undefined);
    for (const b of warren.bunnies.slice(0, CREW)) {
      const near = Math.min(...slots.map((s) => Math.hypot(sample.pos[s * 3] - b.x, sample.pos[s * 3 + 2] - b.z)));
      expect(near, b.info.name).toBeLessThan(1.6);
    }
    // When the run stops the audience drifts back to its day.
    run(model, warren, 200, 0.2, () => ({ k: step, playing: false }), end);
    expect(warren.bunnies.slice(CREW).filter((b) => b.island !== 'plaza').length).toBeGreaterThan(4);
  });

  it('builds and poses every rabbit without NaNs', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const warren = new Warren(model, dayOf(0.2));
    const rigs = warren.bunnies.map((b) => buildBunny(b.info.look));
    const gaits = ['stand', 'hop', 'slide', 'leap', 'float', 'ride'] as const;
    const gears = ['worn', 'play', 'aside'] as const;
    warren.bunnies.forEach((b, i) => {
      for (const gait of gaits) {
        for (const [n, pose] of POSES.entries()) {
          b.gait = gait;
          b.pose = pose;
          b.cue = (n % 7) / 7;
          b.gear = gears[n % 3];
          b.held = (['dumbbell', 'pointer', 'notebook', 'bottle', 'book', null] as const)[n % 6];
          b.hop = 0.4;
          b.air = 0.2;
          poseBunny(rigs[i], b, 3.2, 1 / 60, false);
          rigs[i].root.updateMatrixWorld(true);
          rigs[i].root.traverse((o) => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));
        }
      }
    });
  });
});

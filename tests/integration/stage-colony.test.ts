/**
 * The grove's colony: ten pandas (the crew, three students, five residents)
 * who live there, not just stand there. Students come and sit in front of a
 * running visualisation and take notes; everyone else gets on with their own
 * business, never two of them doing the same thing at once; the play things
 * get used; at night most of the grove sleeps and the rest potter about.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { Colony, IdleBrain, swingAngle, type IdleContext, type IdleOut, type Spots } from '../../packages/renderer/src/stage/worlds/idle';
import { pandaSpots, worldLayout } from '../../packages/renderer/src/stage/worlds/three/layout';
import { DAY_LENGTH, dayAt } from '../../packages/renderer/src/stage/worlds/daycycle';
import { buildPanda, type IdleAct } from '../../packages/renderer/src/stage/worlds/three/rigs';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function modelOf(id: string): Promise<StageModel> {
  const t = await recordTrace(compile(getExampleById(id)!.source) as any);
  return new StageModel(t, 'dark', getExampleById(id)!.source, 'panda');
}

const ROLES = ['student', 'student', 'student', 'resident', 'resident', 'resident', 'resident', 'resident'] as const;

interface Frame {
  t: number;
  outs: IdleOut[];
  doing: string[];
}

/** Runs the eight colony pandas for `seconds` (plus the two crew, held at their stations). */
function simulate(model: StageModel, seconds: number, opts: { night?: (t: number) => number; lesson?: (t: number) => boolean; seed?: number; every?: number } = {}) {
  const s = pandaSpots(model);
  const l = worldLayout(model);
  const f = model.footprint();
  const colony = new Colony();
  const spots: Spots = {
    snack: s.snack.map((c) => ({ at: c.at, face: c.face })),
    gym: { base: s.gym.base, top: s.gym.top, deck: [s.gym.x, s.gym.z], height: s.gym.height, drop: s.gym.drop },
    pond: { at: s.pond.at, face: s.pond.face },
    slide: s.slide,
    swing: { seat: s.swing.seat, height: s.swing.height, length: s.swing.length, face: s.swing.face, approach: s.swing.approach },
  };
  const crew = [new IdleBrain(11, 0, 'panda'), new IdleBrain(11, 1, 'panda')];
  crew.forEach((b, i) => {
    b.reset(f.minX + i * (f.maxX - f.minX), f.maxZ + 1.4, -0.16);
    colony.join(b);
  });
  const brains = ROLES.map((role, i) => {
    const b = new IdleBrain((opts.seed ?? 29) + i * 7, i + 2, 'panda', role);
    b.lantern = i === 5;
    const [x, z] = s.dens[i];
    b.reset(x, z, -0.16);
    colony.join(b);
    return b;
  });
  const keepOut = { minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ };
  const stage = { minX: f.minX - 0.8, maxX: f.maxX + 0.8, minZ: f.minZ - 0.4, maxZ: f.maxZ + 2.6 };
  const dt = 1 / 30;
  const frames: Frame[] = [];
  for (let k = 0; k * dt < seconds; k++) {
    const t = k * dt;
    const night = opts.night?.(t) ?? 0;
    const lesson = opts.lesson?.(t) ?? false;
    const outs = brains.map((b, i) => {
      const seat = ROLES[i] === 'student' ? s.seats[i] : null;
      const ctx: IdleContext = {
        free: true,
        freeFor: 20 + t,
        home: { x: s.dens[i][0], z: s.dens[i][1], yaw: -0.16 },
        keepOut: lesson ? stage : keepOut,
        area: { minX: l.cx - s.clearX, maxX: l.cx + s.clearX, minZ: l.cz - s.clearZ, maxZ: l.cz + s.clearZ },
        spots,
        far: true,
        radius: 4.2,
        colony,
        night,
        now: t,
        obstacles: s.obstacles,
        roam: { cx: l.cx, cz: l.cz, rx: s.clearX, rz: s.clearZ },
        lesson: seat ? { on: lesson, cheer: false, seat: seat.at, face: seat.face } : undefined,
      };
      return b.update(dt, ctx);
    });
    for (const c of crew) c.update(dt, { free: false, freeFor: 0, home: { x: c.x, z: c.z, yaw: -0.16 }, keepOut, area: { minX: -9, maxX: 9, minZ: 0, maxZ: 4 }, spots, far: false, radius: 3.6, colony, night, now: t });
    if (k % (opts.every ?? 3) === 0) frames.push({ t, outs: outs.map((o) => ({ ...o })), doing: brains.map((b) => b.doing) });
  }
  return { frames, spots: s, keepOut, stage, brains, colony };
}

describe('the colony', () => {
  it('has ten pandas: the crew, three students with a backpack and a book, and five residents', () => {
    expect(ROLES.length + 2).toBe(10);
    const student = buildPanda({ prop: null, bag: '#d4553f', book: '#2f6db5', glasses: true });
    const plain = buildPanda({ prop: null });
    let a = 0, b = 0;
    student.root.traverse(() => a++);
    plain.root.traverse(() => b++);
    expect(a).toBeGreaterThan(b + 10);
    student.dispose();
    plain.dispose();
  });

  it('by day every panda keeps busy with all sorts (sliding, swinging, climbing, rolling, eating, lolling, dancing, playing), never inside the structures or the props', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots, keepOut } = simulate(model, 600);
    const acts = new Set<string>();
    const doings = new Set<string>();
    const gaits = new Set<string>();
    let still = 0, total = 0;
    for (const fr of frames) {
      fr.outs.forEach((o, i) => {
        if (o.act !== 'none') acts.add(o.act);
        gaits.add(o.gait);
        doings.add(fr.doing[i].replace(/\d+$/, ''));
        total++;
        if (o.act === 'none' && o.gait === 'stand') still++;
        expect(o.x > keepOut.minX - 0.2 && o.x < keepOut.maxX + 0.2 && o.z > keepOut.minZ - 0.2 && o.z < keepOut.maxZ + 0.2).toBe(false);
      });
    }
    for (const a of ['slide', 'swing', 'chew', 'lounge', 'dance', 'sit', 'look']) expect(acts.has(a), a).toBe(true);
    for (const d of ['slide', 'swing', 'gym', 'snack', 'roll', 'wander']) expect(doings.has(d), d).toBe(true);
    expect(gaits.has('climb')).toBe(true);
    expect(gaits.has('roll')).toBe(true);
    // Hardly ever just standing there.
    expect(still / total).toBeLessThan(0.12);
    void spots;
  });

  it('no two pandas do the same thing at the same moment (sleep aside)', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 480);
    let clash = 0, n = 0;
    for (const fr of frames) {
      const seen = new Map<IdleAct, number>();
      for (const o of fr.outs) if (o.act !== 'none' && o.act !== 'sleep' && o.actWeight > 0.5) seen.set(o.act, (seen.get(o.act) ?? 0) + 1);
      n++;
      if ([...seen.values()].some((c) => c > 1)) clash++;
    }
    expect(clash / n).toBeLessThan(0.08);
  });

  it('when a run plays, the students come and sit in front of it and take notes; the rest carry on', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 150, { lesson: (t) => t > 30 && t < 120 });
    const late = frames.filter((fr) => fr.t > 75 && fr.t < 120);
    for (let i = 0; i < 3; i++) {
      const seated = late.filter((fr) => Math.hypot(fr.outs[i].x - spots.seats[i].at[0], fr.outs[i].z - spots.seats[i].at[1]) < 0.15 && fr.outs[i].seat > 0.8);
      expect(seated.length / late.length).toBeGreaterThan(0.9);
      expect(late.some((fr) => fr.outs[i].act === 'notes')).toBe(true);
    }
    // The residents do not stop to watch: they are all over the place doing different things.
    const residents = new Set<string>();
    for (const fr of late) for (let i = 3; i < 8; i++) residents.add(fr.doing[i]);
    expect(residents.size).toBeGreaterThan(4);
    // After the lesson they get up and go about their business.
    const after = frames.filter((fr) => fr.t > 140);
    for (let i = 0; i < 3; i++) expect(after.at(-1)!.doing[i]).not.toBe('lesson');
  });

  it('at night most of the grove sleeps, and the rest doze, stargaze, chase fireflies or go round with a lantern', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 300, { night: () => 1 });
    const late = frames.filter((fr) => fr.t > 150);
    const sleepers = late.map((fr) => fr.outs.filter((o) => o.act === 'sleep').length);
    const avg = sleepers.reduce((a, b) => a + b, 0) / sleepers.length;
    expect(avg).toBeGreaterThan(2.5);
    expect(Math.max(...sleepers)).toBeLessThan(8);
    const nightActs = new Set<string>();
    let lamp = 0;
    for (const fr of frames) {
      for (const o of fr.outs) if (['doze', 'stargaze', 'chase', 'yawn'].includes(o.act)) nightActs.add(o.act);
      if (fr.outs[5].lamp > 0.5) lamp++;
    }
    expect(nightActs.size).toBeGreaterThan(1);
    expect(lamp).toBeGreaterThan(0);
  });

  it('wakes with the sun', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 360, { night: (t) => (t < 200 ? 1 : 0) });
    const end = frames.filter((fr) => fr.t > 300);
    for (const fr of end) expect(fr.outs.filter((o) => o.act === 'sleep').length).toBe(0);
  });
});

describe('the colony in every shape of grove', () => {
  for (const id of ['tree-bst-insert-search', 'linked-list-singly', 'stacks-foundation', 'searching-matrix', 'arrays-foundation']) {
    it(`${id}: the play things and the seats stand clear of the structures, and nobody walks through them`, async () => {
      const model = await modelOf(id);
      const s = pandaSpots(model);
      const f = model.footprint();
      const clear = (x: number, z: number, m: number) => x < f.minX - m || x > f.maxX + m || z < f.minZ - m || z > f.maxZ + m;
      for (const o of s.obstacles) expect(clear(o.x, o.z, o.r * 0.5), JSON.stringify(o)).toBe(true);
      for (const seat of s.seats) expect(clear(seat.at[0], seat.at[1], 3)).toBe(true);
      expect(clear(s.slide.base[0], s.slide.base[1], 1)).toBe(true);
      expect(clear(s.swing.approach[0], s.swing.approach[1], 1)).toBe(true);
      const { frames, keepOut } = simulate(model, 240, { lesson: (t) => t > 120 && t < 200, every: 2 });
      for (const fr of frames) {
        fr.outs.forEach((o) => {
          expect(o.x > keepOut.minX - 0.15 && o.x < keepOut.maxX + 0.15 && o.z > keepOut.minZ - 0.15 && o.z < keepOut.maxZ + 0.15).toBe(false);
        });
      }
      const fr = frames.find((x) => x.t > 195)!;
      for (let i = 0; i < 3; i++) expect(Math.hypot(fr.outs[i].x - s.seats[i].at[0], fr.outs[i].z - s.seats[i].at[1])).toBeLessThan(0.2);
    });
  }
});

describe('the day', () => {
  it('lasts 18 minutes: a day, a dusk, a night with the moon up, a dawn', () => {
    expect(DAY_LENGTH).toBe(18 * 60);
    const at = (s: number) => dayAt(s);
    expect(at(0).day).toBe(1);
    expect(at(0).night).toBe(0);
    let nightFor = 0, dayFor = 0;
    for (let s = 0; s < DAY_LENGTH; s += 5) {
      const d = at(s);
      if (d.night > 0.95) {
        nightFor += 5;
        expect(d.moon[1]).toBeGreaterThan(0);
      }
      if (d.day > 0.95) {
        dayFor += 5;
        expect(d.sun[1]).toBeGreaterThan(0);
      }
    }
    expect(dayFor).toBeGreaterThan(6 * 60);
    expect(nightFor).toBeGreaterThan(5 * 60);
    expect(at(DAY_LENGTH).phase).toBeCloseTo(at(0).phase, 6);
  });

  it('the swing swings, and comes to rest', () => {
    expect(swingAngle(-1, 10)).toBe(0);
    expect(swingAngle(11, 10)).toBe(0);
    let peak = 0;
    for (let t = 0; t < 10; t += 0.05) peak = Math.max(peak, Math.abs(swingAngle(t, 10)));
    expect(peak).toBeGreaterThan(0.4);
  });
});

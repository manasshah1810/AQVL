/**
 * The penguins' colony: twelve penguins (three students and nine characters with routines of their own) who live on
 * an ice shelf about three times the size it was. Students come and sit in front of a running visualisation and take
 * notes; everyone else gets on with their own business (the gym, the laptop, the guitar, the classroom, the pool, the
 * ice slide, the fish crate), never in step; every noon the musician plays by the fire and most of the colony gathers;
 * at night the bags come off and most go to bed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { Colony, IdleBrain, type Gathering, type IdleContext, type IdleOut, type Spots } from '../../packages/renderer/src/stage/worlds/idle';
import { worldLayout } from '../../packages/renderer/src/stage/worlds/three/layout';
import { POLAR_SPREAD, penguinSpots, polarClearing, polarIce } from '../../packages/renderer/src/stage/worlds/three/polarLayout';
import { PENGUIN_MEMBERS } from '../../packages/renderer/src/stage/worlds/three/penguinCast';
import { buildColonyPenguin } from '../../packages/renderer/src/stage/worlds/three/penguinRig';
import { buildPenguin, type IdleAct } from '../../packages/renderer/src/stage/worlds/three/rigs';
import { groveNav } from '../../packages/renderer/src/stage/worlds/three/PandaNav';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function modelOf(id: string): Promise<StageModel> {
  const t = await recordTrace(compile(getExampleById(id)!.source) as any);
  return new StageModel(t, 'dark', getExampleById(id)!.source, 'penguin');
}

const idx = (name: string) => PENGUIN_MEMBERS.findIndex((m) => m.name === name);

interface Frame {
  t: number;
  outs: IdleOut[];
  doing: string[];
}

interface SimOptions {
  night?: (t: number) => number;
  lesson?: (t: number) => boolean;
  gather?: (t: number) => Gathering;
  seed?: number;
  every?: number;
}

function spotsOf(model: StageModel): Spots {
  const s = penguinSpots(model);
  return {
    slide: s.places.play.slide,
    camp: s.places.camp,
    yard: s.places.yard,
    beds: s.places.beds,
    desk: s.places.desk,
    school: s.places.school,
    nooks: s.places.nooks,
    paths: s.places.paths,
    pool: s.places.pool,
    ramp: s.places.ramp,
    fish: s.places.fish,
  };
}

/** Runs the colony for `seconds` (plus the two crew, held at their stations), as ColonyLayer does. */
function simulate(model: StageModel, seconds: number, opts: SimOptions = {}) {
  const s = penguinSpots(model);
  const l = worldLayout(model);
  const f = model.footprint();
  const colony = new Colony();
  const spots = spotsOf(model);
  const crew = [new IdleBrain(11, 0, 'penguin'), new IdleBrain(11, 1, 'penguin')];
  crew.forEach((b, i) => {
    b.reset(f.minX + i * (f.maxX - f.minX), f.maxZ + 1.4, -0.16);
    colony.join(b);
  });
  const brains = PENGUIN_MEMBERS.map((m, i) => {
    const b = new IdleBrain((opts.seed ?? 29) + i * 7 + 101, i + 2, 'penguin', m.role);
    b.name = m.name;
    b.persona = m.persona;
    b.hasBag = !!m.look.bag;
    b.bed = i;
    const [x, z] = s.dens[i % s.dens.length];
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
    const gather = opts.gather?.(t) ?? { on: false, soon: false, day: 0 };
    const outs = brains.map((b, i) => {
      const den = s.dens[i % s.dens.length];
      const seat = PENGUIN_MEMBERS[i].role === 'student' ? s.seats[i % s.seats.length] : null;
      const ctx: IdleContext = {
        free: true,
        freeFor: 20 + t,
        home: { x: den[0], z: den[1], yaw: -0.16 },
        keepOut: lesson ? stage : keepOut,
        area: { minX: l.cx - s.clearX, maxX: l.cx + s.clearX, minZ: l.cz - s.clearZ, maxZ: l.cz + s.clearZ },
        spots,
        far: true,
        radius: 6.5,
        colony,
        night,
        now: t,
        obstacles: s.obstacles,
        roam: { cx: l.cx, cz: l.cz, rx: s.clearX, rz: s.clearZ },
        lesson: seat ? { on: lesson, cheer: false, seat: seat.at, face: seat.face } : undefined,
        gather,
      };
      return b.update(dt, ctx);
    });
    for (const c of crew) c.update(dt, { free: false, freeFor: 0, home: { x: c.x, z: c.z, yaw: -0.16 }, keepOut, area: { minX: -9, maxX: 9, minZ: 0, maxZ: 4 }, spots: null, far: false, radius: 3.6, colony, now: t });
    if (k % (opts.every ?? 3) === 0) frames.push({ t, outs: outs.map((o) => ({ ...o })), doing: brains.map((b) => b.doing) });
  }
  return { frames, spots: s, keepOut, stage, brains, colony };
}

const meshCount = (o: { traverse(fn: (x: { type?: string }) => void): void }) => {
  let n = 0;
  o.traverse((x) => {
    if (x.type === 'Mesh') n++;
  });
  return n;
};

describe('the penguin colony', () => {
  it('has twelve penguins besides the crew: three students with a backpack and a book, and nine characters', () => {
    expect(PENGUIN_MEMBERS).toHaveLength(12);
    const students = PENGUIN_MEMBERS.filter((m) => m.role === 'student');
    expect(students).toHaveLength(3);
    for (const s of students) {
      expect(s.look.bag).toBeTruthy();
      expect(s.look.book).toBeTruthy();
      expect(s.persona.bag).toBe(true);
    }
    expect(PENGUIN_MEMBERS.filter((m) => m.role === 'resident').map((m) => m.name).sort()).toEqual(['Aastha', 'Bansaree', 'Deep', 'Dishi', 'Manan', 'Manas', 'Siddhant', 'Tirrth', 'Yash']);
    // Aastha is the small one; Yash the strong one.
    const scale = (n: string) => PENGUIN_MEMBERS[idx(n)].scale;
    for (const m of PENGUIN_MEMBERS) if (m.name !== 'Aastha') expect(scale('Aastha')).toBeLessThan(m.scale);
    expect(PENGUIN_MEMBERS[idx('Yash')].look.bulk).toBeGreaterThan(0);
  });

  it('every character is built with what sets it apart (more than a plain penguin has), and the rig never breaks', () => {
    const plain = meshCount(buildPenguin({ scarf: null }).root);
    const acts: IdleAct[] = ['sit', 'sleep', 'lounge', 'dance', 'guitar', 'type', 'lift', 'pullup', 'punch', 'teach', 'adjust', 'notes', 'clap', 'wave', 'eat', 'preen', 'stargaze', 'doze', 'unbag'];
    const gaits = ['stand', 'walk', 'glide', 'swim', 'roll', 'tumble', 'climb'] as const;
    for (const m of PENGUIN_MEMBERS) {
      const rig = buildColonyPenguin({ scale: m.scale, personality: m.personality, ...m.look });
      if (m.role === 'resident') expect(meshCount(rig.root), m.name).toBeGreaterThan(plain + 2);
      for (const act of acts) {
        for (const gait of gaits) {
          rig.update({ gait, gaitPhase: 1.3, gaitWeight: gait === 'stand' ? 0 : 1, pose: 'idle', poseWeight: 1, poseTime: 2, prevPose: 'idle', prevWeight: 0, lookLocal: [0.2, 0.6, 3], react: -1, time: 3.3, seed: 2.1, idle: { act, t: 1.4, weight: 0.8 }, seat: 0.5, bag: act === 'unbag' ? 0.4 : 1, bagAt: [1, 0.2, 1], fish: act === 'eat' ? 1 : 0 });
          rig.root.traverse((o) => {
            expect(Number.isFinite(o.position.x + o.position.y + o.position.z + o.rotation.x + o.rotation.y + o.rotation.z + o.scale.x + o.scale.y + o.scale.z), `${m.name} ${act} ${gait}`).toBe(true);
          });
        }
      }
      rig.dispose();
    }
  });

  it('by day every penguin keeps busy with all sorts, and the pool, the ice slide and the fish crate all get used', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, brains } = simulate(model, 360, { every: 3 });
    const doings = new Set(frames.flatMap((fr) => fr.doing));
    for (const d of ['swim', 'belly', 'fish', 'workout', 'compute', 'guitar', 'wander', 'stroll', 'nook', 'slip']) expect(doings.has(d), d).toBe(true);
    // Somebody swims (under the surface now and then), somebody slides on its belly, somebody eats a fish.
    expect(frames.some((fr) => fr.outs.some((o) => o.gait === 'swim'))).toBe(true);
    expect(frames.some((fr) => fr.outs.some((o) => o.y < -0.7))).toBe(true);
    expect(frames.some((fr) => fr.outs.some((o, i) => o.gait === 'glide' && fr.doing[i] === 'belly'))).toBe(true);
    expect(frames.some((fr) => fr.outs.some((o) => o.act === 'eat' && o.fish > 0))).toBe(true);
    // Each penguin does several different things.
    brains.forEach((_, i) => expect(new Set(frames.map((fr) => fr.doing[i])).size, PENGUIN_MEMBERS[i].name).toBeGreaterThan(2));
  });

  it('each character spends its time on its own thing: Yash at the gym, Manas at his laptop, Manan with the guitar, Aastha wandering, Deep slipping now and then', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 600, { every: 5 });
    const share = (name: string, test: (doing: string, o: IdleOut) => boolean) => {
      const i = idx(name);
      return frames.filter((fr) => test(fr.doing[i], fr.outs[i])).length / frames.length;
    };
    expect(share('Yash', (d) => d === 'workout')).toBeGreaterThan(0.45);
    expect(share('Manas', (d) => d === 'compute')).toBeGreaterThan(0.5);
    expect(share('Manan', (d, o) => d === 'guitar' || o.act === 'guitar')).toBeGreaterThan(0.2);
    // Aastha has nothing in particular to do: she wanders, explores, sits about and watches.
    expect(share('Aastha', (d) => ['wander', 'explore', 'stroll', 'look', 'sit', 'nook', 'fidget', 'near'].includes(d))).toBeGreaterThan(0.45);
    expect(share('Aastha', (d) => ['workout', 'compute', 'teach', 'guitar'].includes(d))).toBeLessThan(0.05);
    expect(share('Bansaree', (d) => d === 'teach')).toBeGreaterThan(0.12);
    // Deep slips, but not all the time.
    const slips = share('Deep', (d, o) => d === 'slip' && o.gait === 'tumble');
    expect(slips).toBeGreaterThan(0);
    expect(slips).toBeLessThan(0.1);
    // Nobody else ever slips.
    for (const m of PENGUIN_MEMBERS) if (m.name !== 'Deep') expect(share(m.name, (d) => d === 'slip')).toBe(0);
  });

  it('penguins rarely do the same thing at the same moment (never more than three alike), sleep and the gathering aside', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 300, { every: 4 });
    for (const fr of frames) {
      const counts = new Map<string, number>();
      fr.outs.forEach((o) => {
        if (o.act === 'none' || o.actWeight < 0.5 || o.act === 'sleep' || o.act === 'notes') return;
        counts.set(o.act, (counts.get(o.act) ?? 0) + 1);
      });
      for (const [, c] of counts) expect(c).toBeLessThanOrEqual(3);
    }
  });

  it('every penguin moves independently: nobody moves in step with anybody else', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 200, { every: 3 });
    const moving = (i: number) => frames.map((fr, k) => (k ? Math.hypot(fr.outs[i].x - frames[k - 1].outs[i].x, fr.outs[i].z - frames[k - 1].outs[i].z) > 0.01 : false));
    const all = PENGUIN_MEMBERS.map((_, i) => moving(i));
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const same = all[a].filter((v, k) => v === all[b][k]).length / all[a].length;
        expect(same, `${PENGUIN_MEMBERS[a].name}/${PENGUIN_MEMBERS[b].name}`).toBeLessThan(0.93);
      }
    }
  });

  it('swimmers stay in the pool and walkers stay out of it; nobody teleports', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 400, { every: 1 });
    const pl = spots.places.pool;
    const inPool = (o: IdleOut) => Math.hypot((o.x - pl.x) / pl.rx, (o.z - pl.z) / pl.rz);
    let swam = 0;
    for (let k = 0; k < frames.length; k++) {
      frames[k].outs.forEach((o, i) => {
        if (o.y < -0.05) {
          swam++;
          expect(inPool(o), PENGUIN_MEMBERS[i].name).toBeLessThan(1.0);
        }
        // Standing about (not getting in or out) never on the water.
        if (o.y >= 0 && o.gait === 'stand' && o.act !== 'none') expect(inPool(o)).toBeGreaterThan(0.85);
        if (k) {
          const p = frames[k - 1].outs[i];
          expect(Math.hypot(o.x - p.x, o.z - p.z), PENGUIN_MEMBERS[i].name).toBeLessThan(0.4);
          expect(Math.abs(o.y - p.y)).toBeLessThan(0.4);
        }
      });
    }
    expect(swam).toBeGreaterThan(0);
  });

  it('when a run plays, the students come and sit in front of it and take notes (each its own way); the rest carry on', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 260, { lesson: (t) => t > 120 && t < 240, every: 2 });
    const late = frames.filter((fr) => fr.t > 200 && fr.t < 238);
    for (let i = 0; i < 3; i++) {
      for (const fr of late) expect(Math.hypot(fr.outs[i].x - spots.seats[i].at[0], fr.outs[i].z - spots.seats[i].at[1])).toBeLessThan(0.25);
      expect(late.some((fr) => fr.outs[i].act === 'notes')).toBe(true);
    }
    // Not all three in step: at some moment they are doing different things.
    expect(late.some((fr) => new Set([fr.outs[0].act, fr.outs[1].act, fr.outs[2].act]).size > 1)).toBe(true);
    // The rest are not at the lesson.
    for (let i = 3; i < PENGUIN_MEMBERS.length; i++) expect(late.every((fr) => fr.doing[i] !== 'lesson')).toBe(true);
  });
});

describe('penguins at night', () => {
  it('most go to their own bed or mat (not all at once), the rest stay up', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 300, { night: (t) => Math.min(1, t / 40) });
    const late = frames.filter((fr) => fr.t > 240);
    const asleep = late.map((fr) => fr.outs.filter((o) => o.act === 'sleep').length);
    expect(Math.max(...asleep)).toBeGreaterThanOrEqual(7);
    expect(Math.min(...asleep)).toBeLessThan(PENGUIN_MEMBERS.length);
    // Sleepers are in their own beds.
    const fr = late[late.length - 1];
    fr.outs.forEach((o, i) => {
      if (o.act !== 'sleep' || fr.doing[i] !== 'sleep') return;
      const bed = spots.places.beds[i % spots.places.beds.length];
      expect(Math.hypot(o.x - bed.at[0], o.z - bed.at[1]), PENGUIN_MEMBERS[i].name).toBeLessThan(0.3);
    });
    // They do not all lie down at the same moment.
    const firstSleep = PENGUIN_MEMBERS.map((_, i) => frames.find((x) => x.outs[i].act === 'sleep')?.t ?? Infinity).filter(Number.isFinite);
    expect(new Set(firstSleep.map((t) => Math.round(t))).size).toBeGreaterThan(3);
  });

  it('the students take their bags off before they sleep; a sleeper never wears one', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 300, { night: (t) => Math.min(1, t / 40) });
    let slept = 0;
    for (const fr of frames) {
      for (let i = 0; i < 3; i++) {
        if (fr.outs[i].act === 'sleep' && fr.outs[i].actWeight > 0.5) {
          slept++;
          expect(fr.outs[i].bag).toBeLessThan(0.05);
        }
      }
    }
    expect(slept).toBeGreaterThan(0);
  });
});

describe('noon at the penguins\' fire', () => {
  it('Manan plays by the fire, the others drift over at their own pace to sit, listen, dance and chat, and afterwards go back to their day', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const gather = (t: number): Gathering => ({ on: t >= 60 && t < 150, soon: t >= 46 && t < 60, day: 1 });
    const { frames, spots } = simulate(model, 230, { gather, every: 2 });
    const camp = spots.places.camp;
    const near = (o: IdleOut) => Math.hypot(o.x - camp.x, o.z - camp.z) < 4.6;
    const at = frames.filter((fr) => fr.t > 110 && fr.t < 148);
    const m = idx('Manan');
    expect(at.filter((fr) => fr.outs[m].act === 'guitar').length / at.length).toBeGreaterThan(0.6);
    const crowd = at.map((fr) => fr.outs.filter(near).length);
    expect(Math.max(...crowd)).toBeGreaterThanOrEqual(6);
    // Different reactions at the same moment.
    expect(at.some((fr) => new Set(fr.outs.filter(near).map((o) => o.act)).size >= 3)).toBe(true);
    // They arrive at different times.
    const arrive = PENGUIN_MEMBERS.map((_, i) => frames.find((fr) => fr.t > 60 && near(fr.outs[i]))?.t ?? Infinity).filter(Number.isFinite);
    expect(Math.max(...arrive) - Math.min(...arrive)).toBeGreaterThan(4);
    // Afterwards the crowd thins out gradually.
    const after = frames.filter((fr) => fr.t > 200).map((fr) => fr.outs.filter(near).length);
    expect(Math.min(...after)).toBeLessThan(Math.max(...crowd));
  });
});

describe('penguin characters and each other', () => {
  it('Tirrth trails after Dishi now and then; Dishi sometimes notices and gets away, and sometimes sliding', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 900, { every: 3 });
    const t = idx('Tirrth'), d = idx('Dishi');
    const tailing = frames.filter((fr) => fr.doing[t] === 'tail').length / frames.length;
    expect(tailing).toBeGreaterThan(0.05);
    expect(tailing).toBeLessThan(0.8);
    const evading = frames.filter((fr) => fr.doing[d] === 'evade');
    expect(evading.length).toBeGreaterThan(0);
    // Trailing is from a distance, never right on her.
    const gaps = frames.filter((fr) => fr.doing[t] === 'tail').map((fr) => Math.hypot(fr.outs[t].x - fr.outs[d].x, fr.outs[t].z - fr.outs[d].z));
    expect(gaps.filter((g) => g < 1.2).length / gaps.length).toBeLessThan(0.05);
    expect(gaps.reduce((a, b) => a + b, 0) / gaps.length).toBeGreaterThan(2);
    // Now and then she gets away on her belly.
    expect(evading.some((fr) => fr.outs[d].gait === 'glide')).toBe(true);
  });

  it('Siddhant is often near Aastha, but not glued to her', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 1200, { every: 3 });
    const s = idx('Siddhant'), a = idx('Aastha');
    const gap = (fr: Frame, j: number) => Math.hypot(fr.outs[s].x - fr.outs[j].x, fr.outs[s].z - fr.outs[j].z);
    const mean = (j: number) => frames.reduce((acc, fr) => acc + gap(fr, j), 0) / frames.length;
    // Nearer her on the whole than to anybody else who wanders about...
    for (const o of ['Lin', 'Yuki', 'Deep', 'Dishi']) expect(mean(a), o).toBeLessThan(mean(idx(o)));
    // ...but not glued to her.
    const close = frames.filter((fr) => gap(fr, a) < 3.4).length / frames.length;
    expect(close).toBeGreaterThan(0.05);
    expect(close).toBeLessThan(0.7);
  });
});

describe('the ice shelf: about three times the ice, with places of its own, in every shape of run', () => {
  for (const id of ['sorting-bubble-sort', 'tree-bst-insert-search', 'linked-list-singly', 'stacks-foundation', 'searching-matrix', 'arrays-foundation']) {
    it(`${id}: the places stand clear of the structures, inside the shelf, and nobody walks through the structures`, async () => {
      const model = await modelOf(id);
      const s = penguinSpots(model);
      const f = model.footprint();
      const l = worldLayout(model);
      const clear = (x: number, z: number, m: number) => x < f.minX - m || x > f.maxX + m || z < f.minZ - m || z > f.maxZ + m;
      const old = polarIce(model);
      const { clearX, clearZ } = polarClearing(model);
      expect((clearX * clearZ) / (old.iceRx * old.iceRz)).toBeGreaterThan(2.8);
      expect((clearX * clearZ) / (old.iceRx * old.iceRz)).toBeLessThan(3.4);
      expect(POLAR_SPREAD ** 2).toBeGreaterThan(2.8);
      for (const o of s.obstacles) expect(clear(o.x, o.z, o.r * 0.5), JSON.stringify(o)).toBe(true);
      for (const seat of s.seats) expect(clear(seat.at[0], seat.at[1], 3)).toBe(true);
      const pl = s.places;
      expect(pl.beds.length).toBeGreaterThanOrEqual(PENGUIN_MEMBERS.length);
      for (const bed of pl.beds) expect(clear(bed.at[0], bed.at[1], 1.5)).toBe(true);
      expect(clear(pl.camp.x, pl.camp.z, 3)).toBe(true);
      expect(clear(pl.pool.x, pl.pool.z, pl.pool.rx)).toBe(true);
      expect(clear(pl.ramp.top[0], pl.ramp.top[1], 1)).toBe(true);
      expect(clear(pl.ramp.run[0], pl.ramp.run[1], 0.5)).toBe(true);
      const inside = (x: number, z: number) => ((x - l.cx) / clearX) ** 2 + ((z - l.cz) / clearZ) ** 2 <= 1.0;
      for (const p of [...pl.beds.map((b) => b.at), pl.camp.stage.at, pl.desk.seat.at, pl.school.board, pl.school.teacher.at, pl.yard.lift.at, [pl.pool.x, pl.pool.z] as [number, number], pl.ramp.top, pl.ramp.run, pl.play.slide.top]) expect(inside(p[0], p[1])).toBe(true);
      expect(pl.paths.length).toBeGreaterThanOrEqual(6);
      // The places keep to their own patches of ice: no two of them on top of each other.
      const areas: [string, number, number, number][] = [
        ['fire', pl.camp.x, pl.camp.z, 3.0],
        ['gym', pl.yard.x, pl.yard.z, 2.6],
        ['school', pl.school.board[0], pl.school.board[1] + 1.4, 2.4],
        ['pool', pl.pool.x, pl.pool.z, pl.pool.rx],
        ['slide', pl.ramp.top[0], pl.ramp.top[1], 1.5],
        ['play', pl.play.x, pl.play.z, 1.8],
        ['desk', pl.desk.x, pl.desk.z, 1.4],
      ];
      for (let a = 0; a < areas.length; a++) for (let b = a + 1; b < areas.length; b++) expect(Math.hypot(areas[a][1] - areas[b][1], areas[a][2] - areas[b][2]), `${areas[a][0]}/${areas[b][0]}`).toBeGreaterThan(areas[a][3] + areas[b][3]);
      for (const bed of pl.beds) for (const [n, x, z, r] of areas) if (n !== 'fire' && n !== 'desk') expect(Math.hypot(bed.at[0] - x, bed.at[1] - z), `bed/${n}`).toBeGreaterThan(r);
      // The camera can reach every place.
      const nav = groveNav(model);
      for (const p of [[pl.camp.x, pl.camp.z], [pl.pool.x, pl.pool.z], pl.ramp.top, pl.school.board, [pl.yard.x, pl.yard.z]] as [number, number][]) {
        expect(Math.abs(p[0])).toBeLessThan(nav.reachX);
        expect(Math.abs(p[1])).toBeLessThan(nav.reachZ);
      }
      const { frames, keepOut } = simulate(model, 200, { lesson: (t) => t > 100 && t < 180, every: 2 });
      for (const fr of frames) {
        fr.outs.forEach((o) => {
          expect(o.x > keepOut.minX - 0.15 && o.x < keepOut.maxX + 0.15 && o.z > keepOut.minZ - 0.15 && o.z < keepOut.maxZ + 0.15).toBe(false);
        });
      }
    });
  }
});

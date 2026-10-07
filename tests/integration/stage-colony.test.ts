/**
 * The grove's colony: seventeen pandas (the crew, three students, three old residents and nine characters with
 * routines of their own) who live there, not just stand there. Students come and sit in front of a running
 * visualisation and take notes; everyone else gets on with their own business, never two of them doing the same thing
 * at once; the play things get used; every noon the musician sings by the fire and most of the colony comes to listen
 * and dance; at night the bags come off and nearly everyone goes to bed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { Colony, IdleBrain, swingAngle, type Gathering, type IdleContext, type IdleOut, type Spots } from '../../packages/renderer/src/stage/worlds/idle';
import { pandaSpots, worldLayout, GROVE_SPREAD, groveClearing } from '../../packages/renderer/src/stage/worlds/three/layout';
import { MEMBERS } from '../../packages/renderer/src/stage/worlds/three/colonyCast';
import { DAY_LENGTH, GATHER_SECONDS, NOON, dayAt, gatherAt } from '../../packages/renderer/src/stage/worlds/daycycle';
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

const idx = (name: string) => MEMBERS.findIndex((m) => m.name === name);

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

/** Runs the colony for `seconds` (plus the two crew, held at their stations). */
function simulate(model: StageModel, seconds: number, opts: SimOptions = {}) {
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
    camp: s.places.camp,
    yard: s.places.yard,
    beds: s.places.beds,
    desk: s.places.desk,
    school: s.places.school,
    nooks: s.places.nooks,
    paths: s.places.paths,
  };
  const crew = [new IdleBrain(11, 0, 'panda'), new IdleBrain(11, 1, 'panda')];
  crew.forEach((b, i) => {
    b.reset(f.minX + i * (f.maxX - f.minX), f.maxZ + 1.4, -0.16);
    colony.join(b);
  });
  const brains = MEMBERS.map((m, i) => {
    const b = new IdleBrain((opts.seed ?? 29) + i * 7, i + 2, 'panda', m.role);
    b.lantern = !!m.lamp;
    b.name = m.name;
    b.persona = m.persona;
    b.hasBag = !!m.bag;
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
      const seat = MEMBERS[i].role === 'student' ? s.seats[i % s.seats.length] : null;
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
    for (const c of crew) c.update(dt, { free: false, freeFor: 0, home: { x: c.x, z: c.z, yaw: -0.16 }, keepOut, area: { minX: -9, maxX: 9, minZ: 0, maxZ: 4 }, spots, far: false, radius: 3.6, colony, night, now: t });
    if (k % (opts.every ?? 3) === 0) frames.push({ t, outs: outs.map((o) => ({ ...o })), doing: brains.map((b) => b.doing) });
  }
  return { frames, spots: s, keepOut, stage, brains, colony };
}

const dist = (a: IdleOut, b: IdleOut) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the colony', () => {
  it('has fifteen pandas besides the crew: three students with a backpack and a book, three old residents, nine characters', () => {
    expect(MEMBERS.length).toBe(15);
    expect(MEMBERS.filter((m) => m.role === 'student').length).toBe(3);
    for (const name of ['Yash', 'Manas', 'Manan', 'Tirrth', 'Aastha', 'Siddhant', 'Bansaree', 'Dishi', 'Deep']) expect(idx(name), name).toBeGreaterThanOrEqual(0);
    const student = buildPanda({ prop: null, bag: '#d4553f', book: '#2f6db5', glasses: true });
    const plain = buildPanda({ prop: null });
    let a = 0, b = 0;
    student.root.traverse(() => a++);
    plain.root.traverse(() => b++);
    expect(a).toBeGreaterThan(b + 10);
    student.dispose();
    plain.dispose();
  });

  it('every character is built with what sets it apart (more than a plain panda has) and none is the same', () => {
    const count = (o: Parameters<typeof buildPanda>[0]) => {
      const r = buildPanda(o);
      let n = 0;
      r.root.traverse(() => n++);
      r.dispose();
      return n;
    };
    const plain = count({ prop: null });
    for (const m of MEMBERS.filter((x) => x.look)) {
      expect(count({ prop: null, glasses: m.glasses, ...m.look }), m.name).toBeGreaterThan(plain);
    }
    expect(MEMBERS.find((m) => m.name === 'Deep')!.glasses).toBe('big');
    expect(MEMBERS.find((m) => m.name === 'Tirrth')!.look).toMatchObject({ hat: expect.any(String), bald: true });
    expect(MEMBERS.find((m) => m.name === 'Yash')!.look!.bulk).toBeGreaterThan(0.5);
    expect(MEMBERS.find((m) => m.name === 'Manas')!.personality.plump).toBeGreaterThan(1.2);
    expect(MEMBERS.find((m) => m.name === 'Aastha')!.scale).toBeLessThan(0.9);
  });

  it('by day every panda keeps busy with all sorts, never inside the structures or the props', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, keepOut } = simulate(model, 900);
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
    for (const a of ['slide', 'swing', 'chew', 'lounge', 'dance', 'sit', 'look', 'type', 'guitar', 'lift', 'teach', 'adjust']) expect(acts.has(a), a).toBe(true);
    for (const d of ['slide', 'swing', 'gym', 'snack', 'roll', 'wander', 'workout', 'compute', 'nook', 'stroll', 'camp']) expect(doings.has(d), d).toBe(true);
    expect(gaits.has('climb')).toBe(true);
    expect(gaits.has('roll')).toBe(true);
    // Hardly ever just standing there.
    expect(still / total).toBeLessThan(0.12);
  });

  it('each character spends its time on its own thing: Yash at the gym, Manas at his computer, Manan with the guitar, Aastha wandering', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 1200);
    const share = (name: string, test: (doing: string, o: IdleOut) => boolean) => {
      const i = idx(name);
      return frames.filter((fr) => test(fr.doing[i], fr.outs[i])).length / frames.length;
    };
    expect(share('Yash', (d) => d === 'workout')).toBeGreaterThan(0.45);
    expect(share('Yash', (_, o) => ['lift', 'pullup', 'squat', 'punch'].includes(o.act))).toBeGreaterThan(0.12);
    expect(share('Manas', (d) => d === 'compute')).toBeGreaterThan(0.5);
    expect(share('Manas', (_, o) => o.act === 'type')).toBeGreaterThan(0.25);
    expect(share('Manan', (d) => d === 'guitar')).toBeGreaterThan(0.12);
    const roams = share('Aastha', (d) => ['wander', 'explore', 'look', 'sit', 'stroll', 'pond', 'roll', 'near'].includes(d));
    expect(roams).toBeGreaterThan(0.45);
    expect(share('Aastha', (d) => ['workout', 'compute', 'teach'].includes(d))).toBe(0);
    // Everyone else does everything else too: nobody is only ever at one thing.
    for (const m of MEMBERS) {
      if (['Yash', 'Manas'].includes(m.name)) continue;
      const i = idx(m.name);
      const kinds = new Set(frames.map((fr) => fr.doing[i].replace(/\d+$/, '')));
      expect(kinds.size, m.name).toBeGreaterThan(5);
    }
  });

  it('pandas rarely do the same thing at the same moment (never more than three alike), sleep and the gathering aside', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 600);
    let crowd = 0, n = 0;
    for (const fr of frames) {
      const seen = new Map<IdleAct, number>();
      for (const o of fr.outs) if (o.act !== 'none' && o.act !== 'sleep' && o.actWeight > 0.5) seen.set(o.act, (seen.get(o.act) ?? 0) + 1);
      n++;
      if ([...seen.values()].some((c) => c > 3)) crowd++;
    }
    expect(crowd / n).toBeLessThan(0.05);
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
    // The others do not stop to watch: they are all over the place doing different things.
    const others = new Set<string>();
    for (const fr of late) for (let i = 3; i < MEMBERS.length; i++) others.add(fr.doing[i]);
    expect(others.size).toBeGreaterThan(5);
    const after = frames.filter((fr) => fr.t > 140);
    for (let i = 0; i < 3; i++) expect(after.at(-1)!.doing[i]).not.toBe('lesson');
  });
});

describe('night', () => {
  it('nearly everyone goes to their own bed or mat, the rest sit by the fire, doze, stargaze, chase fireflies or go round with a lantern', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 360, { night: () => 1 });
    const late = frames.filter((fr) => fr.t > 240);
    const sleepers = late.map((fr) => fr.outs.filter((o) => o.act === 'sleep').length);
    const avg = sleepers.reduce((a, b) => a + b, 0) / sleepers.length;
    expect(avg).toBeGreaterThan(6);
    expect(Math.max(...sleepers)).toBeLessThan(MEMBERS.length);
    // Each sleeper is lying on its own bed (or mat), at the bed's height.
    for (const fr of late) {
      fr.outs.forEach((o, i) => {
        if (o.act !== 'sleep' || o.actWeight < 0.9) return;
        const bed = spots.places.beds[i];
        expect(Math.hypot(o.x - bed.at[0], o.z - bed.at[1]), MEMBERS[i].name).toBeLessThan(0.25);
        expect(Math.abs(o.y - bed.y), MEMBERS[i].name).toBeLessThan(0.05);
      });
    }
    const nightActs = new Set<string>();
    let lamp = 0;
    for (const fr of frames) {
      for (const o of fr.outs) if (['doze', 'stargaze', 'chase', 'yawn', 'type', 'guitar'].includes(o.act)) nightActs.add(o.act);
      if (fr.outs[idx('Grandpa Wu')].lamp > 0.5) lamp++;
    }
    expect(nightActs.size).toBeGreaterThan(1);
    expect(lamp).toBeGreaterThan(0);
  });

  it('the students take their bags off before they sleep and put them back on in the morning; a sleeper never wears one', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 500, { night: (t) => (t < 300 ? 1 : 0) });
    let asleep = 0, off = 0, sawBagOff = false;
    for (const fr of frames) {
      for (let i = 0; i < 3; i++) {
        const o = fr.outs[i];
        if (o.bag < 0.99) sawBagOff = true;
        if (o.act === 'sleep') {
          asleep++;
          // Never on its back (the bag is off, and so is the act: no sleeper is ever shown with it).
          expect(o.bag, MEMBERS[i].name).toBeLessThan(0.02);
          off++;
        }
        // It only ever goes in a smooth, small step per frame (a bag does not jump).
      }
    }
    expect(asleep).toBeGreaterThan(100);
    expect(off).toBe(asleep);
    expect(sawBagOff).toBe(true);
    for (let i = 0; i < 3; i++) expect(frames.at(-1)!.outs[i].bag, MEMBERS[i].name).toBe(1);
    // The bag eases off and on (never jumps between frames).
    for (let i = 0; i < 3; i++) {
      for (let k = 1; k < frames.length; k++) expect(Math.abs(frames[k].outs[i].bag - frames[k - 1].outs[i].bag)).toBeLessThan(0.3);
    }
    void spots;
  });

  it('wakes with the sun', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 420, { night: (t) => (t < 200 ? 1 : 0) });
    const end = frames.filter((fr) => fr.t > 330);
    for (const fr of end) expect(fr.outs.filter((o) => o.act === 'sleep').length).toBe(0);
    for (const d of frames.at(-1)!.doing) expect(d).not.toBe('sleep');
  });
});

describe('noon at the fire', () => {
  const noon = (t: number): Gathering => ({ on: t >= 60 && t < 150, soon: t >= 45 && t < 60, day: 0 });

  it('the gathering is a minute and a half at noon, with the musician heading out first', () => {
    expect(GATHER_SECONDS).toBeGreaterThanOrEqual(60);
    expect(GATHER_SECONDS).toBeLessThanOrEqual(120);
    const at = (phase: number) => {
      const d = dayAt(0);
      d.phase = phase;
      d.count = 3;
      return gatherAt(d);
    };
    expect(at(NOON - 0.1).on).toBe(false);
    expect(at(NOON - 0.005).soon).toBe(true);
    expect(at(NOON + 0.001).on).toBe(true);
    expect(at(NOON + GATHER_SECONDS / DAY_LENGTH + 0.01).on).toBe(false);
    expect(at(NOON + 0.001).day).toBe(3);
    // The sun is at its highest at noon.
    for (let s = 0; s < DAY_LENGTH; s += 10) expect(dayAt(s).sun[1]).toBeLessThanOrEqual(dayAt((NOON - 0.06) * DAY_LENGTH).sun[1] + 0.2);
  });

  it('Manan plays by the fire, the others gather round to sit, listen, dance and clap, and afterwards everyone goes back to their day', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 260, { gather: noon });
    const camp = spots.places.camp;
    const manan = idx('Manan');
    const playing = frames.filter((fr) => fr.t > 80 && fr.t < 145).filter((fr) => fr.outs[manan].act === 'guitar');
    expect(playing.length / frames.filter((fr) => fr.t > 80 && fr.t < 145).length).toBeGreaterThan(0.8);
    // He is on the log at the back, facing the camera, before noon (the lead-in).
    const early = frames.find((fr) => fr.t > 58 && fr.t < 59)!;
    expect(Math.hypot(early.outs[manan].x - camp.stage.at[0], early.outs[manan].z - camp.stage.at[1])).toBeLessThan(0.3);
    // Most of the others are round the fire, doing different things.
    const mid = frames.filter((fr) => fr.t > 110 && fr.t < 145);
    const near = mid.map((fr) => fr.outs.filter((o, i) => i !== manan && Math.hypot(o.x - camp.x, o.z - camp.z) < 5.2).length);
    expect(near.reduce((a, b) => a + b, 0) / near.length).toBeGreaterThan(7);
    const acts = new Set<string>();
    for (const fr of mid) fr.outs.forEach((o, i) => i !== manan && Math.hypot(o.x - camp.x, o.z - camp.z) < 5.2 && o.act !== 'none' && acts.add(o.act));
    expect(acts.has('sit')).toBe(true);
    expect(acts.has('dance')).toBe(true);
    expect(acts.size).toBeGreaterThan(2);
    // Not all of them: some carry on with their own day (Manas at his laptop, Yash at the gym, those who are asleep).
    const away = mid.map((fr) => fr.outs.filter((o, i) => i !== manan && Math.hypot(o.x - camp.x, o.z - camp.z) > 8).length);
    expect(Math.max(...away)).toBeGreaterThanOrEqual(1);
    // Afterwards they are gone from the fire, back at what they do.
    const after = frames.filter((fr) => fr.t > 230);
    const still = after.map((fr) => fr.outs.filter((o) => Math.hypot(o.x - camp.x, o.z - camp.z) < 4).length);
    expect(Math.max(...still)).toBeLessThan(7);
    for (const fr of after) expect(fr.doing.filter((d) => d === 'gather').length).toBe(0);
  });
});

describe('characters and each other', () => {
  it('Tirrth trails after Dishi now and then, and Dishi notices and gets away (and not always at the same pace)', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 1500);
    const t = idx('Tirrth'), d = idx('Dishi');
    const tails = frames.filter((fr) => fr.doing[t] === 'tail').length / frames.length;
    expect(tails).toBeGreaterThan(0.04);
    expect(tails).toBeLessThan(0.5);
    const evades = frames.filter((fr) => fr.doing[d] === 'evade');
    expect(evades.length).toBeGreaterThan(30);
    // She changes direction while he is close behind, and sometimes runs.
    const speeds: number[] = [];
    for (let k = 1; k < frames.length; k++) {
      if (frames[k].doing[d] !== 'evade') continue;
      const step = Math.hypot(frames[k].outs[d].x - frames[k - 1].outs[d].x, frames[k].outs[d].z - frames[k - 1].outs[d].z) / (frames[k].t - frames[k - 1].t);
      speeds.push(step);
    }
    expect(Math.max(...speeds)).toBeGreaterThan(2.5);
    // They are not together all the time.
    const close = frames.filter((fr) => dist(fr.outs[t], fr.outs[d]) < 2.6).length / frames.length;
    expect(close).toBeLessThan(0.25);
  });

  it('Siddhant is often near Aastha, but not glued to her', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 1500);
    const sid = idx('Siddhant'), aa = idx('Aastha'), others = [idx('Dumpling'), idx('Bean'), idx('Deep')];
    const mean = (j: number) => frames.reduce((a, fr) => a + dist(fr.outs[sid], fr.outs[j]), 0) / frames.length;
    const toAastha = mean(aa);
    for (const o of others) expect(toAastha).toBeLessThan(mean(o));
    const glued = frames.filter((fr) => dist(fr.outs[sid], fr.outs[aa]) < 3.4).length / frames.length;
    expect(glued).toBeGreaterThan(0.08);
    expect(glued).toBeLessThan(0.55);
  });

  it('Bansaree gives lessons at the board: she calls pandas to the mats, and they sit, listen and go', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames, spots } = simulate(model, 900);
    const b = idx('Bansaree');
    const seats = spots.places.school.seats;
    const teaching = frames.filter((fr) => fr.outs[b].act === 'teach');
    expect(teaching.length).toBeGreaterThan(30);
    // While she teaches, at least two others are on the mats in front of the board.
    const withPupils = teaching.filter((fr) => fr.outs.filter((o, i) => i !== b && seats.some((s) => Math.hypot(o.x - s.at[0], o.z - s.at[1]) < 0.4)).length >= 2);
    expect(withPupils.length / teaching.length).toBeGreaterThan(0.4);
    // She stands by the board.
    for (const fr of teaching) expect(Math.hypot(fr.outs[b].x - spots.places.school.teacher.at[0], fr.outs[b].z - spots.places.school.teacher.at[1])).toBeLessThan(0.5);
  });

  it('every panda moves independently: nobody moves in step with anybody else', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const { frames } = simulate(model, 400);
    // The fraction of frames in which two pandas have the same gait and act at once is not 1 (they are not synchronised).
    let same = 0, pairs = 0;
    for (const fr of frames) {
      for (let i = 0; i < MEMBERS.length; i++) {
        for (let j = i + 1; j < MEMBERS.length; j++) {
          pairs++;
          if (fr.outs[i].act === fr.outs[j].act && fr.outs[i].gait === fr.outs[j].gait) same++;
        }
      }
    }
    expect(same / pairs).toBeLessThan(0.35);
  });
});

describe('the grove: about three times the ground, with places of its own, in every shape of grove', () => {
  for (const id of ['sorting-bubble-sort', 'tree-bst-insert-search', 'linked-list-singly', 'stacks-foundation', 'searching-matrix', 'arrays-foundation']) {
    it(`${id}: the play things, the places and the seats stand clear of the structures, and nobody walks through them`, async () => {
      const model = await modelOf(id);
      const s = pandaSpots(model);
      const f = model.footprint();
      const l = worldLayout(model);
      const clear = (x: number, z: number, m: number) => x < f.minX - m || x > f.maxX + m || z < f.minZ - m || z > f.maxZ + m;
      // The ground is about three times what it was.
      const old = { x: l.halfX + 5.2, z: Math.max(l.halfZ + 4.8, l.halfX * 0.55 + 4.3) + l.lift * 0.6 };
      const { clearX, clearZ } = groveClearing(model);
      expect((clearX * clearZ) / (old.x * old.z)).toBeGreaterThan(2.8);
      expect((clearX * clearZ) / (old.x * old.z)).toBeLessThan(3.4);
      expect(GROVE_SPREAD ** 2).toBeGreaterThan(2.8);
      for (const o of s.obstacles) expect(clear(o.x, o.z, o.r * 0.5), JSON.stringify(o)).toBe(true);
      for (const seat of s.seats) expect(clear(seat.at[0], seat.at[1], 3)).toBe(true);
      expect(clear(s.slide.base[0], s.slide.base[1], 1)).toBe(true);
      expect(clear(s.swing.approach[0], s.swing.approach[1], 1)).toBe(true);
      // The places: a bed for every panda, the fire, the gym yard, the desk, the classroom.
      const pl = s.places;
      expect(pl.beds.length).toBeGreaterThanOrEqual(MEMBERS.length);
      for (const bed of pl.beds) expect(clear(bed.at[0], bed.at[1], 1.5)).toBe(true);
      expect(clear(pl.camp.x, pl.camp.z, 3)).toBe(true);
      for (const r of pl.camp.ring) expect(clear(r.at[0], r.at[1], 1)).toBe(true);
      for (const j of pl.yard.jog) expect(clear(j[0], j[1], 1)).toBe(true);
      expect(clear(pl.desk.seat.at[0], pl.desk.seat.at[1], 1)).toBe(true);
      expect(clear(pl.school.board[0], pl.school.board[1], 2)).toBe(true);
      for (const seat of pl.school.seats) expect(clear(seat.at[0], seat.at[1], 1)).toBe(true);
      // All inside the clearing.
      const inside = (x: number, z: number) => ((x - l.cx) / clearX) ** 2 + ((z - l.cz) / clearZ) ** 2 <= 1.0;
      for (const p of [...pl.beds.map((b) => b.at), pl.camp.stage.at, pl.desk.seat.at, pl.school.board, pl.school.teacher.at, pl.yard.lift.at, pl.yard.pull.at]) expect(inside(p[0], p[1])).toBe(true);
      expect(pl.paths.length).toBeGreaterThanOrEqual(6);
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
    expect(at(DAY_LENGTH).count).toBe(at(0).count + 1);
  });

  it('the sun and the moon are fixed in the sky: their directions depend on the time alone, never on the camera', () => {
    // dayAt takes nothing but the time: the same moment gives the same sun and moon wherever anyone is looking from.
    const a = dayAt(300), b = dayAt(300);
    expect(a.sun).toEqual(b.sun);
    expect(a.moon).toEqual(b.moon);
    // And the moon is opposite the sun.
    for (let s = 0; s < DAY_LENGTH; s += 20) {
      const d = dayAt(s);
      if (d.sun[1] > 0.1) expect(d.moon[1]).toBeLessThan(0);
      if (d.moon[1] > 0.1) expect(d.sun[1]).toBeLessThan(0);
    }
  });

  it('the swing swings, and comes to rest', () => {
    expect(swingAngle(-1, 10)).toBe(0);
    expect(swingAngle(11, 10)).toBe(0);
    let peak = 0;
    for (let t = 0; t < 10; t += 0.05) peak = Math.max(peak, Math.abs(swingAngle(t, 10)));
    expect(peak).toBeGreaterThan(0.4);
  });
});

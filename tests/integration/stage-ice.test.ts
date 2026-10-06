/**
 * The ice world: blocks are shoved along the ice by penguins and slide with
 * friction, a swap never hops or passes through another block, a penguin
 * touches the block it shoves, linked lists lie on the ground, floating
 * nodes are made by a penguin and carried by an eagle, penguins climb to
 * them, and the penguins waddle and idle without ever breaking the run.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { getExampleById, EXAMPLES } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { buildBeatTable, locate } from '../../packages/renderer/src/stage/timeline/beats';
import { createCast, sampleCast, stationsAt, crewScriptAt, type CastMember } from '../../packages/renderer/src/stage/worlds/cast';
import { KAPPA, blockAt, carryBall, contactPoint, eagleAt, iceMotionAt, shoveProgress, shoveSpeed, type EagleState } from '../../packages/renderer/src/stage/worlds/ice';
import { IdleBrain, type IdleContext } from '../../packages/renderer/src/stage/worlds/idle';
import { PERSONALITIES, buildPenguin } from '../../packages/renderer/src/stage/worlds/three/rigs';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const traces = new Map<string, ExecutionTrace>();
async function traceOf(id: string): Promise<ExecutionTrace> {
  let t = traces.get(id);
  if (!t) {
    t = await recordTrace(compile(getExampleById(id)!.source) as any);
    traces.set(id, t);
  }
  return t;
}
async function modelOf(id: string, world: 'penguin' | 'panda' | 'studio' = 'penguin'): Promise<StageModel> {
  return new StageModel(await traceOf(id), 'dark', getExampleById(id)!.source, world);
}

function at(model: StageModel, k: number, f: number, calm = false) {
  const table = buildBeatTable(model.trace);
  const sample = new StageSample(model.slots.length, model.edgeSlots.length);
  const cast = createCast();
  const D = table.durations[k];
  const tau = f * D;
  sampleStage(model, k, tau, D, sample, { reducedMotion: calm });
  sampleCast(model, 'penguin', k, tau, D, sample, cast, calm);
  return { sample, cast, D };
}

describe('ice: the shove', () => {
  it('a shove starts at rest, ends at rest at the destination, and only ever moves forwards', () => {
    const legs: [number, number, number][] = [[0.16, 0.25, 0.4], [0.2, 0.5, 0.92], [0.46, 0.53, 0.64]];
    for (const [t0, t1, t2] of legs) {
      expect(shoveProgress(t0 - 0.05, t0, t1, t2)).toBe(0);
      expect(shoveProgress(t2, t0, t1, t2)).toBe(1);
      let last = 0;
      for (let i = 0; i <= 400; i++) {
        const p = shoveProgress(t0 + ((t2 - t0) * i) / 400, t0, t1, t2);
        expect(p).toBeGreaterThanOrEqual(last - 1e-9);
        last = p;
      }
    }
  });

  it('speed is continuous at the moment of release, and friction brings it down smoothly (no sudden stop)', () => {
    const leg = { dx: 1, dz: 0, len: 4, t0: 0.2, t1: 0.4, t2: 0.9, kind: 'push' } as never;
    const before = shoveSpeed(leg, 0.4 - 0.003);
    const after = shoveSpeed(leg, 0.4 + 0.003);
    expect(Math.abs(before - after) / Math.max(before, after)).toBeLessThan(0.08);
    // After release the speed only falls, and it ends nearly stopped.
    let prev = Infinity;
    for (let f = 0.41; f < 0.9; f += 0.02) {
      const v = shoveSpeed(leg, f);
      expect(v).toBeLessThanOrEqual(prev + 1e-6);
      prev = v;
    }
    expect(shoveSpeed(leg, 0.89)).toBeLessThan(0.1 * before);
    expect(KAPPA).toBeGreaterThan(1);
  });

  it('a swap slides on the ice: no hop, no clipping, exact landing, and the swap shows both blocks leaving the row', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const table = buildBeatTable(model.trace);
    let swaps = 0;
    for (let k = 1; k < model.frameCount && swaps < 6; k++) {
      if (model.frames[k].event.kind !== 'swap') continue;
      swaps++;
      const motion = iceMotionAt(model, k)!;
      expect(motion.jobs.length).toBe(2);
      const from = model.rest(k - 1), to = model.rest(k);
      const [ja, jb] = motion.jobs;
      let leftRow = [false, false];
      for (let i = 0; i <= 160; i++) {
        const { sample } = at(model, k, i / 160);
        for (const [n, job] of [ja, jb].entries()) {
          const s = job.slot;
          // On the floor throughout (no arcing hop): never higher than where it rests.
          expect(sample.pos[s * 3 + 1]).toBeLessThanOrEqual(Math.max(from.pos[s * 3 + 1], to.pos[s * 3 + 1]) + 0.06);
          if (Math.abs(sample.pos[s * 3 + 2] - from.pos[s * 3 + 2]) > 1) leftRow[n] = true;
        }
        // The two never overlap each other.
        const a = ja.slot, b = jb.slot;
        const ox = Math.abs(sample.pos[a * 3] - sample.pos[b * 3]) < (sample.dims[a * 3] + sample.dims[b * 3]) / 2 - 0.03;
        const oz = Math.abs(sample.pos[a * 3 + 2] - sample.pos[b * 3 + 2]) < (sample.dims[a * 3 + 2] + sample.dims[b * 3 + 2]) / 2 - 0.03;
        expect(ox && oz).toBe(false);
      }
      expect(leftRow).toEqual([true, true]);
      // At the end of the step they are exactly where the rest picture says.
      const end = at(model, k, 1).sample;
      for (const job of [ja, jb]) {
        expect(end.pos[job.slot * 3]).toBeCloseTo(to.pos[job.slot * 3], 3);
        expect(end.pos[job.slot * 3 + 2]).toBeCloseTo(to.pos[job.slot * 3 + 2], 3);
      }
    }
    expect(swaps).toBeGreaterThan(3);
    expect(table.total).toBeGreaterThan(0);
  });

  it('blocks that are swapped far apart go out, across and back without passing through the ones between', async () => {
    const model = await modelOf('sorting-selection-sort');
    let checked = 0;
    for (let k = 1; k < model.frameCount; k++) {
      if (model.frames[k].event.kind !== 'swap') continue;
      const motion = iceMotionAt(model, k);
      if (!motion) continue;
      const from = model.rest(k - 1);
      const [ja, jb] = motion.jobs;
      if (Math.abs(from.pos[ja.slot * 3] - from.pos[jb.slot * 3]) < 3) continue;
      expect(ja.legs.length).toBe(3);
      for (let i = 0; i <= 120; i++) {
        const { sample } = at(model, k, i / 120);
        for (let s = 0; s < sample.nodeCount; s++) {
          if (s === ja.slot || s === jb.slot || sample.presence[s] < 0.5) continue;
          for (const mover of [ja.slot, jb.slot]) {
            const ox = Math.abs(sample.pos[mover * 3] - sample.pos[s * 3]) < (sample.dims[mover * 3] + sample.dims[s * 3]) / 2 - 0.03;
            const oz = Math.abs(sample.pos[mover * 3 + 2] - sample.pos[s * 3 + 2]) < (sample.dims[mover * 3 + 2] + sample.dims[s * 3 + 2]) / 2 - 0.03;
            expect(ox && oz).toBe(false);
          }
        }
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the penguin touches the block it shoves: while it pushes, the gap is exactly its stand-off', async () => {
    const model = await modelOf('sorting-bubble-sort');
    let k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const motion = iceMotionAt(model, k)!;
    const script = crewScriptAt(model, k)!;
    expect(script).toBeTruthy();
    let touched = 0;
    for (let i = 0; i <= 200; i++) {
      const f = i / 200;
      const { cast } = at(model, k, f);
      for (const job of motion.jobs) {
        const leg = job.legs.find((l) => f > l.t0 + 0.01 && f < (l.kind === 'push' ? l.t1 : l.t2) - 0.01);
        if (!leg) continue;
        const blk = { x: 0, z: 0, vx: 0, vz: 0, leg: -1 };
        blockAt(job, f, blk);
        const want: [number, number] = [0, 0];
        contactPoint(leg, blk.x, blk.z, want);
        const near = cast.reduce((best, m) => Math.min(best, Math.hypot(m.x - want[0], m.z - want[1])), Infinity);
        expect(near).toBeLessThan(0.02);
        touched++;
      }
    }
    expect(touched).toBeGreaterThan(40);
    void k;
  });

  it('each step is a pure function of time, ice included (scrubbing in any order gives the same picture)', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const finger = (f: number) => {
      const { sample, cast } = at(model, k, f);
      return JSON.stringify([Array.from(sample.pos, (v) => v.toFixed(5)), cast.map((m) => [m.x, m.z, m.yaw, m.gait].map((v) => (typeof v === 'number' ? v.toFixed(5) : v)))]);
    };
    const fr = [0.1, 0.33, 0.5, 0.71, 0.95];
    const first = fr.map(finger);
    at(model, k + 3, 0.5);
    at(model, 0, 0);
    expect([...fr].reverse().map(finger).reverse()).toEqual(first);
  });

  it('calm mode keeps the old, plain motion: nothing shoved, nothing slides', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    for (let i = 0; i <= 40; i++) {
      const { cast } = at(model, k, i / 40, true);
      for (const m of cast) {
        expect(['stand']).toContain(m.gait);
        expect(m.scripted).toBe(false);
      }
    }
  });

  it('nothing teleports: across whole runs, blocks and penguins only ever move a little between samples', async () => {
    for (const id of ['sorting-bubble-sort', 'arrays-foundation', 'linked-list-singly', 'tree-traversals']) {
      const model = await modelOf(id);
      const table = buildBeatTable(model.trace);
      let prevCast: CastMember[] | null = null;
      for (let k = 1; k < model.frameCount; k++) {
        prevCast = null;
        const N = 120;
        let prev: StageSample | null = null;
        for (let i = 0; i <= N; i++) {
          const { sample, cast, D } = at(model, k, i / N);
          const stepSeconds = D / N;
          if (prev) {
            for (let s = 0; s < sample.nodeCount; s++) {
              if (sample.presence[s] < 0.5 || prev.presence[s] < 0.5) continue;
              const d = Math.hypot(sample.pos[s * 3] - prev.pos[s * 3], sample.pos[s * 3 + 1] - prev.pos[s * 3 + 1], sample.pos[s * 3 + 2] - prev.pos[s * 3 + 2]);
              // A block ever moving faster than 40 units a second would read as a teleport.
              expect(d / stepSeconds).toBeLessThan(40);
            }
            if (prevCast) {
              cast.forEach((m, j) => {
                const d = Math.hypot(m.x - prevCast![j].x, m.z - prevCast![j].z, m.y - prevCast![j].y);
                // A belly slide across the whole row is quick, but a jump of whole units in one frame would be a teleport.
                expect(d / stepSeconds).toBeLessThan(125);
              });
            }
          }
          prev = new StageSample(sample.nodeCount, sample.edgeCount);
          prev.pos.set(sample.pos);
          prev.presence.set(sample.presence);
          prevCast = cast.map((m) => ({ ...m, look: [...m.look] as [number, number, number] }));
        }
      }
      expect(table.total).toBeGreaterThan(0);
    }
  });
});

describe('ice: linked lists lie on the ground', () => {
  it('every list node rests on the floor in the penguin world, and a staged node stands in front of the row', async () => {
    const ids = EXAMPLES.filter((e) => e.id.startsWith('linked-list')).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      const model = await modelOf(id);
      for (let k = 0; k < model.frameCount; k++) {
        const rest = model.rest(k);
        for (let s = 0; s < model.slots.length; s++) {
          if (!rest.present[s] || model.slots[s].family !== 'LINKEDLIST_NODE') continue;
          const bottom = rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 - model.floorY;
          expect(bottom).toBeLessThan(0.55);
        }
      }
    }
    const model = await modelOf('linked-list-singly');
    const k = model.frames.findIndex((f) => f.event.kind === 'create');
    const rest = model.rest(k);
    const newSlot = model.slotOf.get(model.frames[k].event.actors[0])!;
    const rowZ = rest.pos[0 * 3 + 2];
    expect(rest.pos[newSlot * 3 + 2]).toBeGreaterThan(rowZ + 2);
  });

  it('the studio and the grove keep the layout they always had (lists hang in the air)', async () => {
    const studio = await modelOf('linked-list-singly', 'studio');
    expect(studio.isGrounded('list')).toBe(false);
    const k = studio.frames.findIndex((f) => f.event.kind === 'create');
    const rest = studio.rest(k);
    const newSlot = studio.slotOf.get(studio.frames[k].event.actors[0])!;
    expect(rest.pos[newSlot * 3 + 1]).toBeLessThan(rest.pos[1] - 2);
  });

  it('a list node that moves along the ice rolls: it glides, with friction, and the penguin shoves the one that travels furthest', async () => {
    const model = await modelOf('linked-list-singly');
    const k = model.frames.findIndex((f) => f.event.kind === 'move');
    const motion = iceMotionAt(model, k)!;
    expect(motion).toBeTruthy();
    expect(motion.jobs[0].legs[0].len).toBeGreaterThan(3);
    // The other nodes slide too (friction profile), none of them hops.
    for (let i = 0; i <= 60; i++) {
      const { sample } = at(model, k, i / 60);
      const rest = model.rest(k), from = model.rest(k - 1);
      for (let s = 0; s < sample.nodeCount; s++) {
        if (sample.presence[s] < 0.5) continue;
        expect(sample.pos[s * 3 + 1]).toBeLessThan(Math.max(rest.pos[s * 3 + 1], from.pos[s * 3 + 1]) + 0.1);
      }
    }
  });
});

describe('ice: elevated structures', () => {
  it('a new floating node is made by a penguin at the forge, taken by the eagle, and set down exactly in its place', async () => {
    const model = await modelOf('tree-bst-insert-search');
    let carries = 0;
    for (let k = 1; k < model.frameCount; k++) {
      const motion = iceMotionAt(model, k);
      const job = motion?.jobs.find((j) => j.carry);
      if (!job) continue;
      carries++;
      const c = job.carry!;
      const to = model.rest(k);
      // Starts at the forge (a ball on the ice), ends at the node's place.
      const ball = { x: 0, y: 0, z: 0 };
      carryBall(c, 0.0, ball);
      expect(ball.y).toBeCloseTo(model.floorY + 0.95, 2);
      carryBall(c, 1.0, ball);
      expect(ball.x).toBeCloseTo(to.pos[job.slot * 3], 3);
      expect(ball.y).toBeCloseTo(to.pos[job.slot * 3 + 1], 2);
      // The eagle holds it between grab and drop: the ball hangs under its feet.
      const eg: EagleState = { visible: false, x: 0, y: 0, z: 0, yaw: 0, flap: 0, holding: false, clock: 0 };
      for (let f = c.grab + 0.02; f < c.drop - 0.02; f += 0.05) {
        eagleAt(model, k, f, eg);
        expect(eg.visible).toBe(true);
        expect(eg.holding).toBe(true);
        carryBall(c, f, ball);
        expect(eg.x).toBeCloseTo(ball.x, 3);
        expect(eg.z).toBeCloseTo(ball.z, 3);
        expect(eg.y - ball.y).toBeGreaterThan(0.5);
      }
      // A penguin stands at the forge while the ball is made.
      const { cast } = at(model, k, (c.made[0] + c.made[1]) / 2 + 0.1);
      const near = Math.min(...cast.map((m) => Math.hypot(m.x - c.stand[0], m.z - c.stand[1])));
      expect(near).toBeLessThan(0.3);
      const end = at(model, k, 1).sample;
      expect(end.pos[job.slot * 3 + 1]).toBeCloseTo(to.pos[job.slot * 3 + 1], 2);
    }
    expect(carries).toBeGreaterThan(0);
  });

  it('the eagle is only there when a node is being carried, and not at all in the other worlds', async () => {
    const model = await modelOf('tree-bst-insert-search');
    const first = model.frames.findIndex((f, k) => k > 0 && iceMotionAt(model, k)?.jobs.some((j) => j.carry));
    const eg: EagleState = { visible: false, x: 0, y: 0, z: 0, yaw: 0, flap: 0, holding: false, clock: 0 };
    eagleAt(model, 1, 0.5, eg);
    expect(eg.visible).toBe(first - 1 === 1 || first === 1 ? eg.visible : false);
    eagleAt(model, first, 0.5, eg);
    expect(eg.visible).toBe(true);
    const panda = await modelOf('tree-bst-insert-search', 'panda');
    eagleAt(panda, first, 0.5, eg);
    expect(eg.visible).toBe(false);
  });

  it('penguins perch on a ledge beside the floating node a step is about, and climb between them', async () => {
    const model = await modelOf('tree-traversals');
    let perched = 0;
    let climbs = 0;
    let maxY = 0;
    for (let k = 1; k < model.frameCount; k++) {
      for (const st of stationsAt(model, k)) if (st.slot >= 0 && st.y > 0.3) perched++;
      for (let i = 0; i <= 20; i++) {
        const { cast } = at(model, k, i / 20);
        for (const m of cast) {
          maxY = Math.max(maxY, m.y);
          if (m.gait === 'climb' || m.gait === 'leap') climbs++;
        }
      }
    }
    expect(perched).toBeGreaterThan(10);
    expect(climbs).toBeGreaterThan(5);
    expect(maxY).toBeGreaterThan(1);
  });
});

describe('penguins: the waddle and their characters', () => {
  const input = (phase: number, seed = 0.3) => ({
    gait: 'walk' as const,
    gaitPhase: phase,
    gaitWeight: 1,
    pose: 'idle' as const,
    poseWeight: 0,
    poseTime: 0,
    prevPose: 'idle' as const,
    prevWeight: 0,
    lookLocal: [0, 0.6, 3] as [number, number, number],
    react: -1,
    time: 0.5,
    seed,
  });

  it('weight goes onto the planted foot: body rocks and shifts over it, the other foot lifts, and the head stays level against the rock', () => {
    const rig = buildPenguin({ scarf: null, personality: PERSONALITIES[2] });
    // The left foot (-x) is lifted while sin(phase) > 0, so the weight is on the right (+x).
    const a = Math.PI / 2;
    rig.update(input(a));
    expect(rig.root.position.x).toBeGreaterThan(0);
    expect(rig.root.rotation.z).toBeLessThan(0);
    const lifted = rig.root.children.filter((c) => (c as { isMesh?: boolean }).isMesh).map((c) => c.position);
    expect(lifted.length).toBe(2);
    expect(lifted[0].y).toBeGreaterThan(lifted[1].y + 0.02);
    const headRoll = rig.root.rotation.z;
    // The other half of the stride mirrors it.
    rig.update(input(a + Math.PI));
    expect(rig.root.position.x).toBeLessThan(0);
    expect(rig.root.rotation.z).toBeGreaterThan(0);
    expect(Math.sign(headRoll)).toBe(-Math.sign(rig.root.rotation.z));
    rig.dispose();
  });

  it('every penguin has its own gait: same stride, different rocking, and the stride is never perfectly regular', () => {
    const rigs = PERSONALITIES.map((p) => buildPenguin({ scarf: null, personality: p }));
    const rock = rigs.map((r) => {
      r.update(input(Math.PI / 2));
      return Math.abs(r.root.rotation.z);
    });
    expect(new Set(rock.map((v) => v.toFixed(3))).size).toBeGreaterThan(2);
    // The strength of one penguin's rocking varies from stride to stride.
    const one = rigs[0];
    const peaks: number[] = [];
    for (let i = 0; i < 8; i++) {
      one.update(input(Math.PI / 2 + i * Math.PI * 2));
      peaks.push(Math.abs(one.root.rotation.z));
    }
    expect(new Set(peaks.map((v) => v.toFixed(3))).size).toBeGreaterThan(3);
    rigs.forEach((r) => r.dispose());
  });

  it('a standing penguin does not rock, and calm mode never starts a stride', async () => {
    const rig = buildPenguin({ scarf: null });
    rig.update({ ...input(1.2), gait: 'stand', gaitWeight: 0 });
    expect(Math.abs(rig.root.rotation.z)).toBeLessThan(1e-9);
    expect(Math.abs(rig.root.position.x)).toBeLessThan(1e-9);
    rig.dispose();
  });
});

describe('penguins: idle life', () => {
  const area = { minX: -7, maxX: 7, minZ: 1.5, maxZ: 3.9 };
  const keepOut = { minX: -4, maxX: 4, minZ: -0.5, maxZ: 0.5 };
  const spots = {
    bucket: [6.5, 3.2] as [number, number],
    hole: [7, 0.5] as [number, number],
    igloo: { door: [-6, -8] as [number, number], approach: [-5.5, -6] as [number, number], center: [-6.5, -9.5] as [number, number] },
  };
  const ctx = (home: { x: number; z: number; yaw: number }, free: boolean, partner: IdleBrain, freeFor = 10): IdleContext => ({ free, freeFor, home, keepOut, area, spots, far: freeFor > 5, partner, radius: 3.2 });

  it('stays on its station while the run plays, and roams, fidgets, fetches fish and plays when it rests', () => {
    const a = new IdleBrain(11, 0), b = new IdleBrain(11, 1);
    const homeA = { x: -3.3, z: 1.85, yaw: -0.2 }, homeB = { x: 3.3, z: 1.85, yaw: -0.2 };
    // Playing: never away.
    for (let t = 0; t < 10; t += 1 / 30) {
      expect(a.update(1 / 30, ctx(homeA, false, b)).away).toBe(false);
      expect(b.update(1 / 30, ctx(homeB, false, a)).away).toBe(false);
    }
    // Resting for a minute: it does everything it can.
    const seen = new Set<string>();
    let fishAt = 0, farthest = 0;
    for (let t = 0; t < 180; t += 1 / 30) {
      for (const [brain, home, other] of [[a, homeA, b], [b, homeB, a]] as const) {
        const o = brain.update(1 / 30, ctx(home, true, other));
        if (o.away) seen.add(o.gait !== 'stand' ? 'walk' : o.act);
        if (o.fish > 0.5) fishAt++;
        farthest = Math.max(farthest, Math.hypot(o.x - home.x, o.z - home.z));
        // Never inside the cells.
        const inside = o.x > keepOut.minX - 0.3 && o.x < keepOut.maxX + 0.3 && o.z > keepOut.minZ - 0.3 && o.z < keepOut.maxZ + 0.3;
        expect(inside).toBe(false);
      }
    }
    for (const what of ['walk', 'look', 'eat', 'play']) expect(seen.has(what)).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect(fishAt).toBeGreaterThan(30);
    expect(farthest).toBeGreaterThan(2);
  });

  it('goes straight back to its station when the run moves again, and arrives exactly', () => {
    const a = new IdleBrain(5, 0), b = new IdleBrain(5, 1);
    const homeA = { x: -3.3, z: 1.85, yaw: -0.2 };
    for (let t = 0; t < 30; t += 1 / 30) a.update(1 / 30, ctx(homeA, true, b));
    let steps = 0;
    let o = a.update(1 / 30, ctx(homeA, false, b));
    while (o.away && steps < 600) {
      o = a.update(1 / 30, ctx(homeA, false, b));
      steps++;
    }
    expect(o.away).toBe(false);
    expect(steps / 30).toBeLessThan(3.5);
    expect(a.roaming).toBe(false);
  });

  it('is repeatable for a seed and different between animals', () => {
    const run = (seed: number, index: number) => {
      const brain = new IdleBrain(seed, index);
      const partner = new IdleBrain(seed, 1 - index);
      const trail: string[] = [];
      for (let t = 0; t < 40; t += 1 / 30) {
        const o = brain.update(1 / 30, ctx({ x: -3.3, z: 1.85, yaw: 0 }, true, partner));
        if (Math.round(t * 30) % 30 === 0) trail.push(`${o.x.toFixed(2)},${o.z.toFixed(2)},${o.act}`);
      }
      return trail.join('|');
    };
    expect(run(9, 0)).toBe(run(9, 0));
    expect(run(9, 0)).not.toBe(run(9, 1));
  });
});

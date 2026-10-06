/**
 * The bamboo grove: pandas physically take part. They walk to the block, lean
 * into it and push or tug it along the ground (it rolls, with friction, and
 * stops); linked lists lie on the ground; a new floating node is made in a
 * panda's arms and carried up a bamboo pole; the odd climb ends in a harmless
 * slip; pandas never teleport, and every step is still a pure function of time.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { buildBeatTable } from '../../packages/renderer/src/stage/timeline/beats';
import { createCast, sampleCast, stationsAt, crewScriptAt, type CastMember } from '../../packages/renderer/src/stage/worlds/cast';
import { EARTH_KAPPA, HUG, KAPPA, blockAt, carryBall, contactPoint, eagleAt, iceMotionAt, porterAt, type EagleState, type PorterPose } from '../../packages/renderer/src/stage/worlds/ice';
import { IdleBrain, type IdleContext } from '../../packages/renderer/src/stage/worlds/idle';
import { PANDA_PERSONALITIES, buildPanda } from '../../packages/renderer/src/stage/worlds/three/rigs';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const traces = new Map<string, ExecutionTrace>();
async function modelOf(id: string): Promise<StageModel> {
  let t = traces.get(id);
  if (!t) {
    t = await recordTrace(compile(getExampleById(id)!.source) as any);
    traces.set(id, t);
  }
  return new StageModel(t, 'dark', getExampleById(id)!.source, 'panda');
}

function at(model: StageModel, k: number, f: number, calm = false) {
  const table = buildBeatTable(model.trace);
  const sample = new StageSample(model.slots.length, model.edgeSlots.length);
  const cast = createCast();
  const D = table.durations[k];
  sampleStage(model, k, f * D, D, sample, { reducedMotion: calm });
  sampleCast(model, 'panda', k, f * D, D, sample, cast, calm);
  return { sample, cast, D };
}

describe('pandas: blocks are pushed along the ground', () => {
  it('a swap shoves both blocks along the earth (more friction than ice), and each panda touches the block it shoves', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const motion = iceMotionAt(model, k)!;
    expect(motion).toBeTruthy();
    expect(crewScriptAt(model, k)).toBeTruthy();
    for (const job of motion.jobs) for (const leg of job.legs) expect(leg.kappa).toBe(EARTH_KAPPA);
    expect(EARTH_KAPPA).toBeGreaterThan(KAPPA);
    let touched = 0;
    const leaned = [false, false];
    for (let i = 0; i <= 200; i++) {
      const f = i / 200;
      const { cast } = at(model, k, f);
      cast.forEach((m, j) => {
        if (m.gait === 'push' || m.gait === 'pull') leaned[j] = true;
      });
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
    expect(leaned).toEqual([true, true]);
  });

  it('a pushed block starts and ends at rest, exactly on its destination', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const to = model.rest(k);
    const end = at(model, k, 1).sample;
    for (let s = 0; s < end.nodeCount; s++) {
      if (!to.present[s]) continue;
      expect(end.pos[s * 3]).toBeCloseTo(to.pos[s * 3], 3);
      expect(end.pos[s * 3 + 2]).toBeCloseTo(to.pos[s * 3 + 2], 3);
    }
  });

  it('linked lists lie on the ground, and the node that travels furthest is shoved along it', async () => {
    const model = await modelOf('linked-list-singly');
    expect(model.isGrounded('list')).toBe(true);
    const k = model.frames.findIndex((f) => f.event.kind === 'move');
    const motion = iceMotionAt(model, k)!;
    expect(motion.jobs[0].legs[0].len).toBeGreaterThan(3);
    let pushed = false;
    for (let i = 0; i <= 120; i++) {
      const { cast } = at(model, k, i / 120);
      if (cast.some((m) => m.gait === 'push')) pushed = true;
    }
    expect(pushed).toBe(true);
  });

  it('calm mode keeps the plain motion: nothing shoved, nobody climbs', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    for (let i = 0; i <= 40; i++) for (const m of at(model, k, i / 40, true).cast) expect(m.gait).toBe('stand');
  });
});

describe('pandas: a new floating node is carried up a bamboo pole', () => {
  it('the ball is made in the arms, hugged all the way up, and set in its place exactly; no eagle', async () => {
    const model = await modelOf('tree-bst-insert-search');
    let carries = 0;
    for (let k = 1; k < model.frameCount; k++) {
      const job = iceMotionAt(model, k)?.jobs.find((j) => j.carry);
      if (!job) continue;
      carries++;
      const c = job.carry!;
      expect(c.porter).toBeTruthy();
      const to = model.rest(k);
      const ball = { x: 0, y: 0, z: 0 };
      const pose: PorterPose = { x: 0, y: 0, z: 0, phase: 'make', u: 0 };
      // Hugged to the chest from the moment it is lifted until it is let go.
      for (let f = c.grab; f < c.drop - 1e-6; f += 0.03) {
        porterAt(c, f, pose);
        carryBall(c, f, ball, model.floorY);
        expect(ball.x).toBeCloseTo(pose.x, 3);
        expect(ball.y).toBeCloseTo(model.floorY + pose.y + HUG.y, 3);
        expect(ball.z).toBeCloseTo(pose.z + HUG.z, 3);
      }
      carryBall(c, 1, ball, model.floorY);
      expect(ball.x).toBeCloseTo(to.pos[job.slot * 3], 3);
      expect(ball.y).toBeCloseTo(to.pos[job.slot * 3 + 1], 2);
      expect(ball.z).toBeCloseTo(to.pos[job.slot * 3 + 2], 3);
      // The panda climbs: its feet rise, never fall, from the foot of the pole to the perch beside the node.
      let lastY = -1;
      let top = 0;
      let carrying = 0;
      for (let f = 0; f <= 1.0001; f += 0.02) {
        const { cast } = at(model, k, Math.min(1, f));
        // The carrier is the one with its arms round the ball.
        const m = cast.find((x) => x.carry > 0.01);
        if (!m) continue;
        if (f >= c.porter!.climb0 && f <= c.porter!.climb1) {
          expect(m.y).toBeGreaterThanOrEqual(lastY - 1e-6);
          lastY = m.y;
        }
        top = Math.max(top, m.y);
        if (m.carry > 0.9) carrying++;
      }
      expect(top).toBeCloseTo(c.porter!.perch, 1);
      expect(carrying).toBeGreaterThan(10);
      const eg: EagleState = { visible: false, x: 0, y: 0, z: 0, yaw: 0, flap: 0, holding: false, clock: 0 };
      eagleAt(model, k, 0.5, eg);
      expect(eg.visible).toBe(false);
    }
    expect(carries).toBeGreaterThan(0);
  });

  it('pandas perch on a platform beside the floating node a step is about, and climb between them', async () => {
    const model = await modelOf('tree-traversals');
    let perched = 0;
    let climbs = 0;
    let maxY = 0;
    for (let k = 1; k < model.frameCount; k++) {
      for (const st of stationsAt(model, k)) if (st.slot >= 0 && st.y > 0.3) perched++;
      for (let i = 0; i <= 20; i++) {
        for (const m of at(model, k, i / 20).cast) {
          maxY = Math.max(maxY, m.y);
          if (m.gait === 'climb' || m.gait === 'leap') climbs++;
          // A pole stands wherever a panda is up in the air, unless it is climbing along a branch or leaping.
          if (m.y > 0.4 && m.gait !== 'leap' && m.gait !== 'tumble' && m.gait !== 'climb') expect(m.rope).toBeGreaterThan(0.5);
        }
      }
    }
    expect(perched).toBeGreaterThan(10);
    expect(climbs).toBeGreaterThan(5);
    expect(maxY).toBeGreaterThan(1);
  });

  it('now and then a climber slips, tumbles to the ground and tries again; most climbs are clean, and it is the same every time', async () => {
    let slips = 0;
    let climbsUp = 0;
    const seen = (model: StageModel) => {
      const out: string[] = [];
      for (let k = 1; k < model.frameCount; k++) {
        let tumbled = false;
        for (let i = 0; i <= 60; i++) if (at(model, k, i / 60).cast.some((m) => m.gait === 'tumble')) tumbled = true;
        out.push(tumbled ? 'slip' : '-');
      }
      return out;
    };
    for (const id of ['tree-traversals', 'tree-height-size', 'tree-mirror', 'tree-path-sum', 'graphs-dfs', 'graphs-components']) {
      const model = await modelOf(id);
      const first = seen(model);
      expect(seen(model)).toEqual(first);
      slips += first.filter((v) => v === 'slip').length;
      for (let k = 1; k < model.frameCount; k++) {
        const a = stationsAt(model, k - 1), b = stationsAt(model, k);
        if (a.some((st, i) => st.y < 0.35 && b[i].y > 0.35)) climbsUp++;
      }
      // The fall is brief and ends on the ground: nobody is in the air at rest.
      for (let k = 1; k < model.frameCount; k++) {
        const rest = at(model, k, 1).cast;
        stationsAt(model, k).forEach((st, i) => expect(rest[i].y).toBeCloseTo(st.y, 2));
      }
    }
    expect(climbsUp).toBeGreaterThan(3);
    expect(slips).toBeGreaterThan(0);
    expect(slips).toBeLessThan(climbsUp * 0.5);
  });
});

describe('pandas: they never teleport and the picture is a pure function of time', () => {
  it('across whole runs, pandas and blocks only ever move a little between samples (a fall is quick but continuous)', async () => {
    for (const id of ['sorting-bubble-sort', 'arrays-foundation', 'linked-list-singly', 'tree-traversals', 'tree-bst-insert-search']) {
      const model = await modelOf(id);
      for (let k = 1; k < model.frameCount; k++) {
        const N = 120;
        let prevCast: CastMember[] | null = null;
        let prev: StageSample | null = null;
        for (let i = 0; i <= N; i++) {
          const { sample, cast, D } = at(model, k, i / N);
          const stepSeconds = D / N;
          if (prev) {
            for (let s = 0; s < sample.nodeCount; s++) {
              if (sample.presence[s] < 0.5 || prev.presence[s] < 0.5) continue;
              const d = Math.hypot(sample.pos[s * 3] - prev.pos[s * 3], sample.pos[s * 3 + 1] - prev.pos[s * 3 + 1], sample.pos[s * 3 + 2] - prev.pos[s * 3 + 2]);
              expect(d / stepSeconds).toBeLessThan(75);
            }
            if (prevCast) {
              cast.forEach((m, j) => {
                const d = Math.hypot(m.x - prevCast![j].x, m.z - prevCast![j].z, m.y - prevCast![j].y);
                // A dash across the whole row is quick, but a jump of whole units in one frame would be a teleport.
                expect(d / stepSeconds).toBeLessThan(150);
              });
            }
          }
          prev = new StageSample(sample.nodeCount, sample.edgeCount);
          prev.pos.set(sample.pos);
          prev.presence.set(sample.presence);
          prevCast = cast.map((m) => ({ ...m, look: [...m.look] as [number, number, number] }));
        }
      }
    }
  });

  it('scrubbing in any order gives the same crew', async () => {
    const model = await modelOf('tree-bst-insert-search');
    const k = model.frames.findIndex((f, i) => i > 0 && iceMotionAt(model, i)?.jobs.some((j) => j.carry));
    const finger = (f: number) => {
      const { sample, cast } = at(model, k, f);
      return JSON.stringify([Array.from(sample.pos, (v) => v.toFixed(5)), cast.map((m) => [m.x, m.y, m.z, m.yaw, m.gait, m.carry, m.rope].map((v) => (typeof v === 'number' ? v.toFixed(5) : v)))]);
    };
    const fr = [0.05, 0.2, 0.4, 0.6, 0.8, 0.97];
    const first = fr.map(finger);
    at(model, Math.max(1, k - 1), 0.5);
    at(model, 0, 0);
    expect([...fr].reverse().map(finger).reverse()).toEqual(first);
  });
});

describe('pandas: characters and idle life', () => {
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

  it('walking shifts the weight: the body rocks over the planted foot, the feet and arms swing in opposition', () => {
    const rig = buildPanda({ prop: null, personality: PANDA_PERSONALITIES[0] });
    const root = rig.root;
    const center = root.children[0];
    rig.update(input(Math.PI / 2));
    const rockA = center.rotation.z;
    const swayA = center.position.x;
    rig.update(input(Math.PI / 2 + Math.PI));
    expect(Math.sign(center.rotation.z)).toBe(-Math.sign(rockA));
    expect(Math.sign(center.position.x)).toBe(-Math.sign(swayA));
    expect(Math.abs(rockA)).toBeGreaterThan(0.03);
    rig.dispose();
  });

  it('no two pandas move alike, and no stride is quite like the last', () => {
    const rigs = PANDA_PERSONALITIES.map((p) => buildPanda({ prop: null, personality: p }));
    const rock = rigs.map((r) => {
      r.update(input(Math.PI / 2));
      return Math.abs(r.root.children[0].rotation.z);
    });
    expect(new Set(rock.map((v) => v.toFixed(3))).size).toBeGreaterThan(2);
    const peaks: number[] = [];
    for (let i = 0; i < 8; i++) {
      rigs[0].update(input(Math.PI / 2 + i * Math.PI * 2));
      peaks.push(Math.abs(rigs[0].root.children[0].rotation.z));
    }
    expect(new Set(peaks.map((v) => v.toFixed(3))).size).toBeGreaterThan(3);
    rigs.forEach((r) => r.dispose());
  });

  const ctx = (over: Partial<IdleContext> = {}): IdleContext => ({
    free: true,
    freeFor: 20,
    home: { x: 0, z: 3, yaw: -0.16 },
    keepOut: { minX: -4, maxX: 4, minZ: -1, maxZ: 1 },
    area: { minX: -7, maxX: 7, minZ: 1.8, maxZ: 6 },
    spots: {
      snack: [{ at: [6, 3], face: -0.16 }],
      gym: { base: [-6, 4], top: [-5.5, 3.3], deck: [-5.3, 3.2], height: 1.05, drop: [-4.4, 4.4] },
      pond: { at: [2, -5], face: -1.57 },
    },
    far: true,
    radius: 3.6,
    ...over,
  });

  it('a resting panda is never idle: it strolls, sits and chews bamboo, climbs the gym, rolls, scratches, stretches, drinks and plays', () => {
    const seen = new Set<string>();
    let maxY = 0;
    let rolled = false;
    let climbed = false;
    let stalk = false;
    for (let seed = 1; seed <= 6; seed++) {
      const a = new IdleBrain(seed, 0, 'panda'), b = new IdleBrain(seed, 1, 'panda');
      a.reset(0, 3, -0.16);
      b.reset(2, 3, -0.16);
      for (let t = 0; t < 60 * 120; t++) {
        const oa = a.update(1 / 60, ctx({ freeFor: 20 + t / 60, partner: b }));
        b.update(1 / 60, ctx({ freeFor: 20 + t / 60, partner: a }));
        if (oa.act !== 'none') seen.add(oa.act);
        if (oa.gait === 'roll') rolled = true;
        if (oa.gait === 'climb') climbed = true;
        if (oa.stalk >= 0) stalk = true;
        maxY = Math.max(maxY, oa.y);
        // Never inside the cells.
        expect(oa.x > -4.3 && oa.x < 4.3 && oa.z > -1.3 && oa.z < 1.3).toBe(false);
      }
    }
    for (const act of ['sit', 'chew', 'scratch', 'stretch', 'look', 'drink']) expect(seen.has(act)).toBe(true);
    expect(rolled).toBe(true);
    expect(climbed).toBe(true);
    expect(stalk).toBe(true);
    expect(maxY).toBeGreaterThan(0.9);
  });

  it('goes straight back to its station when the run moves again, down off the gym if need be', () => {
    const brain = new IdleBrain(3, 0, 'panda');
    brain.reset(0, 3, -0.16);
    for (let t = 0; t < 60 * 60; t++) brain.update(1 / 60, ctx({ freeFor: 20 + t / 60 }));
    for (let t = 0; t < 60 * 20; t++) brain.update(1 / 60, ctx({ free: false }));
    const o = brain.update(1 / 60, ctx({ free: false }));
    expect(o.away).toBe(false);
    expect(o.y).toBe(0);
  });
});

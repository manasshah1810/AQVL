/**
 * The ocean: a whale and her calf physically take part. Nodes move through
 * water (nudged, steered, let go, slowed by drag, settled with a bob), the
 * swimmers' noses are on the nodes they push, nothing teleports, swapped
 * blocks never pass through each other, the pod keeps clear of the nodes,
 * and like everything on the stage it is a pure function of time.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { buildBeatTable, locate } from '../../packages/renderer/src/stage/timeline/beats';
import { WORLD_PALETTES } from '../../packages/renderer/src/stage/worlds/palettes';
import { STAGE_PALETTES, contrastRatio } from '../../packages/renderer/src/stage/look/palette';
import { WORLDS, hasCast, hasPhysics, isOcean } from '../../packages/renderer/src/stage/worlds/types';
import { WATER_DRAG, driftProgress, haulAt, waterMotionAt, type HaulPose } from '../../packages/renderer/src/stage/worlds/ocean/water';
import { SWIMMERS, contactPose, createPod, podStationsAt, samplePod, type Pose, type Swimmer } from '../../packages/renderer/src/stage/worlds/ocean/pod';
import { roamPose, trickAt, type RoamPose } from '../../packages/renderer/src/stage/worlds/ocean/roam';

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
  return new StageModel(t, 'dark', getExampleById(id)!.source, 'ocean');
}

function at(model: StageModel, k: number, f: number, calm = false) {
  const table = buildBeatTable(model.trace);
  const sample = new StageSample(model.slots.length, model.edgeSlots.length);
  const pod = createPod();
  const D = table.durations[k];
  sampleStage(model, k, f * D, D, sample, { reducedMotion: calm });
  samplePod(model, k, f * D, D, sample, pod, calm);
  return { sample, pod, D };
}

const EXAMPLES = ['sorting-bubble-sort', 'sorting-insertion-sort', 'searching-binary', 'linked-list-singly', 'tree-bst-insert-search', 'heaps-insert', 'stacks-foundation'];
const hp = (): HaulPose => ({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 });

describe('ocean: the world', () => {
  it('is a world with a crew of its own, and none of the walking physics', () => {
    expect(WORLDS.ocean.crew).toEqual(['Kai', 'Nami']);
    expect(hasCast('ocean')).toBe(true);
    expect(isOcean('ocean')).toBe(true);
    expect(hasPhysics('ocean')).toBe(false);
  });

  it('keeps every state colour, and its inks read on its seabed', () => {
    const p = WORLD_PALETTES.ocean;
    expect(p.states).toEqual(STAGE_PALETTES.dark.states);
    for (const ink of [p.plate, p.caption, p.tag]) expect(contrastRatio(ink, p.floor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.frameText, p.frame)).toBeGreaterThanOrEqual(7);
  });

  it('linked lists float in the water (they do not lie on the seabed as they do on the ice or the earth)', async () => {
    const model = await modelOf('linked-list-singly');
    const list = model.slots.find((s) => s.structure)!.structure;
    expect(model.isGrounded(list)).toBe(false);
  });
});

describe('ocean: water physics', () => {
  it('a push picks up speed and, let go, slows with drag to rest exactly at the end of its path', () => {
    const t0 = 0.2, t1 = 0.5, t2 = 0.85;
    expect(driftProgress(t0, t0, t1, t2)).toBe(0);
    expect(driftProgress(t2, t0, t1, t2)).toBe(1);
    // Monotone, and the speed is continuous at the release (no kick, no stall).
    let last = -1;
    for (let i = 0; i <= 400; i++) {
      const p = driftProgress(i / 400, t0, t1, t2);
      expect(p).toBeGreaterThanOrEqual(last - 1e-12);
      last = p;
    }
    const e = 1e-4;
    const before = (driftProgress(t1, t0, t1, t2) - driftProgress(t1 - e, t0, t1, t2)) / e;
    const after = (driftProgress(t1 + e, t0, t1, t2) - driftProgress(t1, t0, t1, t2)) / e;
    expect(Math.abs(before - after) / before).toBeLessThan(0.02);
    // After release the speed only falls, by the water's drag.
    const v = (f: number) => (driftProgress(f + e, t0, t1, t2) - driftProgress(f - e, t0, t1, t2)) / (2 * e);
    expect(v(0.6)).toBeLessThan(v(0.52));
    expect(v(0.8)).toBeLessThan(v(0.6));
    expect(v(0.8) / v(0.52)).toBeGreaterThan(Math.exp(-WATER_DRAG) * 0.5);
  });

  it.each(EXAMPLES)('%s: every hauled node leaves its old place and ends exactly in its new one', async (id) => {
    const model = await modelOf(id);
    const out = hp();
    let hauls = 0;
    for (let k = 1; k < model.frameCount; k++) {
      const w = waterMotionAt(model, k);
      if (!w) continue;
      const from = model.rest(k - 1), to = model.rest(k);
      for (const h of w.hauls) {
        hauls++;
        haulAt(h, 1, out);
        if (to.present[h.slot]) {
          expect(Math.hypot(out.x - to.pos[h.slot * 3], out.y - to.pos[h.slot * 3 + 1], out.z - to.pos[h.slot * 3 + 2])).toBeLessThan(1e-6);
          expect(out.presence).toBe(1);
        } else {
          expect(out.presence).toBeLessThan(0.01);
        }
        if (h.kind !== 'birth') {
          haulAt(h, 0, out);
          expect(Math.hypot(out.x - from.pos[h.slot * 3], out.y - from.pos[h.slot * 3 + 1], out.z - from.pos[h.slot * 3 + 2])).toBeLessThan(1e-6);
        }
      }
    }
    // Searches and insertion sort only look and write: nothing in them changes place.
    if (!['searching-binary', 'sorting-insertion-sort'].includes(id)) expect(hauls).toBeGreaterThan(0);
  });

  it('neighbours that swap on the seabed: one is lifted over while the other slides along the sand under it, and they never touch', async () => {
    const model = await modelOf('sorting-bubble-sort');
    let checked = 0;
    for (let k = 1; k < model.frameCount; k++) {
      if (model.frames[k].event.kind !== 'swap') continue;
      const w = waterMotionAt(model, k)!;
      expect(w.hauls.length).toBe(2);
      const [a, b] = w.hauls;
      expect(a.who).toBe(0);
      expect(b.who).toBe(1);
      const pa = hp(), pb = hp();
      let peakA = -Infinity, peakB = -Infinity;
      for (let i = 0; i <= 200; i++) {
        haulAt(a, i / 200, pa);
        haulAt(b, i / 200, pb);
        peakA = Math.max(peakA, pa.y);
        peakB = Math.max(peakB, pb.y);
        const apart = Math.abs(pa.x - pb.x) > a.half[0] + b.half[0] - 0.02 || Math.abs(pa.y - pb.y) > a.half[1] + b.half[1] - 0.02 || Math.abs(pa.z - pb.z) > a.half[2] + b.half[2] - 0.02;
        expect(apart).toBe(true);
      }
      // The slider stays close to the sand; the lifted one goes up and over.
      expect(peakB - b.ctrl[1]).toBeLessThan(0.2);
      expect(peakA - a.ctrl[1]).toBeGreaterThan(b.half[1] * 2);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('a block that rests on the seabed lifts off and lands with a puff of silt; one in open water bobs as it settles', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const h = waterMotionAt(model, k)!.hauls[0];
    expect(h.liftsOffFloor).toBe(true);
    expect(h.landsOnFloor).toBe(true);
    const out = hp();
    // Never below its resting height (it cannot sink into the sand), and still again by the end.
    for (let i = 0; i <= 100; i++) {
      haulAt(h, h.t2 + ((1 - h.t2) * i) / 100, out);
      expect(out.y).toBeGreaterThanOrEqual(h.ctrl[10] - 1e-9);
    }
  });

  it('a new node condenses from a bubble beside its place and is nudged in; a removed one floats up and away, dissolving', async () => {
    const tree = await modelOf('tree-bst-insert-search');
    const kc = tree.frames.findIndex((f) => f.event.kind === 'create' && f.index > 5);
    const birth = waterMotionAt(tree, kc)!.hauls.find((h) => h.kind === 'birth')!;
    expect(birth).toBeTruthy();
    expect(birth.grow![1]).toBeLessThanOrEqual(birth.t0 + 1e-9);
    const list = await modelOf('linked-list-singly');
    const kr = list.frames.findIndex((f) => f.event.kind === 'remove');
    const bye = waterMotionAt(list, kr)!.hauls.find((h) => h.kind === 'farewell')!;
    expect(bye).toBeTruthy();
    expect(bye.who).toBeGreaterThanOrEqual(0);
    const out = hp();
    haulAt(bye, bye.fade![0], out);
    const y0 = out.y;
    haulAt(bye, bye.fade![1] - 0.01, out);
    expect(out.y).toBeGreaterThan(y0);
  });
});

describe('ocean: the pod', () => {
  it('is a pure function of time (scrubbing in any order gives the same pod)', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const table = buildBeatTable(model.trace);
    const end = table.ends[table.ends.length - 1];
    const shot = (t: number) => {
      const p = locate(table, t);
      const sample = new StageSample(model.slots.length, model.edgeSlots.length);
      const pod = createPod();
      sampleStage(model, p.k, p.tau, p.duration, sample, { reducedMotion: false });
      samplePod(model, p.k, p.tau, p.duration, sample, pod, false);
      return JSON.stringify(pod.map((m) => [m.x, m.y, m.z, m.yaw, m.pitch, m.mood, m.contact].map((v) => (typeof v === 'number' ? v.toFixed(5) : v))));
    };
    const times = [0.37, 0.5, 0.9, 1.33, 2.1].map((f) => (f / 2.2) * end);
    const first = times.map(shot);
    shot(end);
    shot(0);
    const again = [...times].reverse().map(shot).reverse();
    expect(again).toEqual(first);
  });

  it.each(EXAMPLES)('%s: the whale and the calf never teleport (within a step and across step boundaries)', async (id) => {
    const model = await modelOf(id);
    const table = buildBeatTable(model.trace);
    const dt = 1 / 60;
    let prev: Swimmer[] | null = null;
    let worst = 0;
    const end = Math.min(table.total, 70);
    for (let t = 0; t <= end; t += dt) {
      const p = locate(table, t);
      const sample = new StageSample(model.slots.length, model.edgeSlots.length);
      const pod = createPod();
      sampleStage(model, p.k, p.tau, p.duration, sample, { reducedMotion: false });
      samplePod(model, p.k, p.tau, p.duration, sample, pod, false);
      if (prev) for (let i = 0; i < 2; i++) worst = Math.max(worst, Math.hypot(pod[i].x - prev[i].x, pod[i].y - prev[i].y, pod[i].z - prev[i].z));
      prev = pod.map((m) => ({ ...m }));
    }
    // A dart is quick (up to ~25 units a second at 1x) but continuous.
    expect(worst).toBeLessThan(0.45);
  });

  it.each(EXAMPLES)('%s: while a swimmer pushes, its nose is on the node it pushes', async (id) => {
    const model = await modelOf(id);
    let contacts = 0;
    for (let k = 1; k < model.frameCount; k++) {
      const w = waterMotionAt(model, k);
      if (!w) continue;
      for (const h of w.hauls) {
        if (h.who < 0) continue;
        for (let i = 1; i < 10; i++) {
          const f = h.t0 + ((h.t1 - h.t0) * i) / 10;
          const { pod, sample } = at(model, k, f);
          const m = pod[h.who];
          if (m.contact < 0.5) continue;
          contacts++;
          const size = SWIMMERS[h.who];
          const c = Math.cos(m.pitch);
          const nx = m.x + Math.sin(m.yaw) * c * size.nose, ny = m.y + Math.sin(m.pitch) * size.nose, nz = m.z + Math.cos(m.yaw) * c * size.nose;
          const s = h.slot;
          const dx = Math.max(0, Math.abs(nx - sample.pos[s * 3]) - sample.dims[s * 3] / 2);
          const dy = Math.max(0, Math.abs(ny - sample.pos[s * 3 + 1]) - sample.dims[s * 3 + 1] / 2);
          const dz = Math.max(0, Math.abs(nz - sample.pos[s * 3 + 2]) - sample.dims[s * 3 + 2] / 2);
          // Touching (a whale on the seabed stays above the sand, so a low node may be touched a little above its face).
          expect(Math.hypot(dx, dy, dz)).toBeLessThan(0.45);
        }
      }
    }
    if (['sorting-bubble-sort', 'linked-list-singly'].includes(id)) expect(contacts).toBeGreaterThan(5);
  });

  it.each(EXAMPLES)('%s: at rest the pod keeps clear of the nodes and of the seabed', async (id) => {
    const model = await modelOf(id);
    let bad = 0, total = 0;
    for (let k = 0; k < model.frameCount; k++) {
      const rest = model.rest(k);
      podStationsAt(model, k).forEach((st, who) => {
        total++;
        const size = SWIMMERS[who];
        const c = Math.cos(st.pitch);
        const hx = Math.sin(st.yaw) * c, hy = Math.sin(st.pitch), hz = Math.cos(st.yaw) * c;
        let worst = Infinity;
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          const along = size.nose - u * size.length * 0.9;
          // The snout tapers to its tip (a nose on a node touches it); the body is round behind it.
          const r = size.radius * (u === 0 ? 0.25 : u < 0.35 ? 0.75 : 1 - u * 0.8);
          const x = st.x + hx * along, y = st.y + hy * along, z = st.z + hz * along;
          worst = Math.min(worst, y - r - model.floorY);
          for (let s = 0; s < model.slots.length; s++) {
            if (!rest.present[s]) continue;
            const dx = Math.max(0, Math.abs(x - rest.pos[s * 3]) - rest.dims[s * 3] / 2);
            const dy = Math.max(0, Math.abs(y - rest.pos[s * 3 + 1]) - rest.dims[s * 3 + 1] / 2);
            const dz = Math.max(0, Math.abs(z - rest.pos[s * 3 + 2]) - rest.dims[s * 3 + 2] / 2);
            worst = Math.min(worst, Math.hypot(dx, dy, dz) - r);
          }
        }
        if (worst < -0.12) bad++;
      });
    }
    expect(bad / total).toBeLessThan(0.03);
  });

  it('pushes are seen side-on: the whale faces across the view, not into it', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const k = model.frames.findIndex((f) => f.event.kind === 'swap');
    const h = waterMotionAt(model, k)!.hauls[0];
    const p: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    for (let i = 1; i < 10; i++) {
      contactPose(model, h, h.t0 + ((h.t1 - h.t0) * i) / 10, 0, p);
      // |sin(yaw)| near 1: heading mostly along x.
      expect(Math.abs(Math.sin(p.yaw))).toBeGreaterThan(0.8);
      expect(Math.abs(p.pitch)).toBeLessThan(0.3);
    }
  });

  it('a finished run is celebrated above the structures; calm mode stills every gesture of travel', async () => {
    const model = await modelOf('sorting-bubble-sort');
    const last = model.frameCount - 1;
    const st = podStationsAt(model, last);
    const f = model.footprint();
    expect(st.map((s) => s.mood)).toEqual(['celebrate', 'celebrate']);
    for (const s of st) expect(s.y).toBeGreaterThan(f.top);
    const { pod } = at(model, 3, 0.5, true);
    for (const m of pod) expect(m.speed).toBe(0);
  });
});

describe('ocean: roaming when the run rests', () => {
  it("the pod roams behind and above the structures, the calf at her mother's side; tricks come and go", async () => {
    const model = await modelOf('sorting-bubble-sort');
    const f = model.footprint();
    const area = { cx: (f.minX + f.maxX) / 2, cz: (f.minZ + f.maxZ) / 2, halfX: (f.maxX - f.minX) / 2, halfZ: (f.maxZ - f.minZ) / 2, floorY: model.floorY, top: f.top - model.floorY };
    const a: RoamPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0 };
    const b: RoamPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0 };
    const tricks = new Set<string>();
    for (let t = 0; t < 400; t += 0.5) {
      roamPose(area, t, 0, a);
      roamPose(area, t, 1, b);
      expect(a.y).toBeGreaterThan(f.top + 0.3);
      expect(a.z).toBeLessThan(f.maxZ);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(6);
      expect(a.speed).toBeLessThan(2.5);
      tricks.add(trickAt(t, 0).kind);
      tricks.add(trickAt(t, 1).kind);
    }
    expect(tricks.size).toBeGreaterThan(3);
  });
});

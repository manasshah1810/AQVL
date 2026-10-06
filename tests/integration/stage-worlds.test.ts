/**
 * Worlds (penguins, pandas): the crew is part of the picture, so it gets
 * the same guarantees as the rest of the stage. It is a pure function of
 * time, it stands by the cells each step is about, it never stands inside a
 * cell or inside the other animal, it stays in frame, calm mode stills it,
 * and a world keeps the state colours while its own inks stay legible.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { buildBeatTable, locate } from '../../packages/renderer/src/stage/timeline/beats';
import { STAGE_PALETTES, contrastRatio } from '../../packages/renderer/src/stage/look/palette';
import { WORLD_PALETTES } from '../../packages/renderer/src/stage/worlds/palettes';
import { CAST_RADIUS, createCast, sampleCast, stationsAt, type CastMember, type CastStyle } from '../../packages/renderer/src/stage/worlds/cast';

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

async function modelOf(id: string, world: CastStyle): Promise<StageModel> {
  return new StageModel(await traceOf(id), 'dark', getExampleById(id)!.source, world);
}

/** The stage and the crew at time t. */
function castAt(model: StageModel, style: CastStyle, t: number, calm = false): { sample: StageSample; cast: CastMember[] } {
  const table = buildBeatTable(model.trace);
  const sample = new StageSample(model.slots.length, model.edgeSlots.length);
  const p = locate(table, t);
  sampleStage(model, p.k, p.tau, p.duration, sample, { reducedMotion: calm });
  const cast = createCast();
  sampleCast(model, style, p.k, p.tau, p.duration, sample, cast, calm);
  return { sample, cast };
}

function fingerprint(cast: CastMember[]): string {
  return JSON.stringify(cast.map((m) => [m.x, m.y, m.z, m.yaw, m.gait, m.gaitPhase, m.gaitWeight, m.pose, m.poseWeight, m.poseTime].map((v) => (typeof v === 'number' ? v.toFixed(5) : v))));
}

describe('worlds: palettes', () => {
  it('the studio keeps the site palette for each mode', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    expect(new StageModel(trace, 'dark').palette).toBe(STAGE_PALETTES.dark);
    expect(new StageModel(trace, 'light', undefined, 'studio').palette).toBe(STAGE_PALETTES.light);
  });

  it('a world keeps every state colour and its own inks stay legible on its ground', () => {
    for (const palette of Object.values(WORLD_PALETTES)) {
      expect(palette.states).toEqual(STAGE_PALETTES.dark.states);
      for (const ink of [palette.plate, palette.caption, palette.tag]) expect(contrastRatio(ink, palette.floor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.frameText, palette.frame)).toBeGreaterThanOrEqual(7);
    }
  });
});

describe.each<CastStyle>(['penguin', 'panda'])('worlds: the %s crew', (style) => {
  it('is a pure function of time (scrubbing in any order gives the same crew)', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    const end = table.ends[table.ends.length - 1];
    const times = [0.37, 0.5, 0.9, 1.33, 2.1].map((f) => (f / 2.2) * end);
    const first = times.map((t) => fingerprint(castAt(model, style, t).cast));
    // Visit them again in reverse, after jumping about.
    castAt(model, style, end);
    castAt(model, style, 0);
    const again = [...times].reverse().map((t) => fingerprint(castAt(model, style, t).cast)).reverse();
    expect(again).toEqual(first);
  });

  it('stands beside the cells each step is about', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    let checked = 0;
    for (let k = 1; k < model.frameCount; k++) {
      const rest = model.rest(k);
      const actors = model.frames[k].event.actors.map((id) => model.slotOf.get(id)!).filter((s) => s !== undefined && rest.present[s]).slice(0, 2);
      if (actors.length === 0) continue;
      const { cast } = castAt(model, style, table.ends[k] - 1e-4);
      for (const s of actors) {
        const near = Math.min(...cast.map((m) => Math.hypot(m.x - rest.pos[s * 3], m.z - rest.pos[s * 3 + 2])));
        expect(near).toBeLessThan(2.4);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('never stands inside a cell, nor inside the other animal, even mid-swap', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    const end = table.ends[table.ends.length - 1];
    for (let i = 0; i <= 600; i++) {
      const { sample, cast } = castAt(model, style, (i / 600) * end);
      for (const m of cast) {
        for (let s = 0; s < sample.nodeCount; s++) {
          if (sample.presence[s] < 0.5) continue;
          const bottom = sample.pos[s * 3 + 1] - (sample.dims[s * 3 + 1] * sample.presence[s]) / 2;
          if (bottom - model.floorY > 0.75) continue;
          const hw = (sample.dims[s * 3] * sample.presence[s]) / 2;
          const hd = (sample.dims[s * 3 + 2] * sample.presence[s]) / 2;
          const inside = Math.abs(m.x - sample.pos[s * 3]) < hw - 0.02 && Math.abs(m.z - sample.pos[s * 3 + 2]) < hd - 0.02;
          expect(inside).toBe(false);
        }
      }
      expect(Math.hypot(cast[0].x - cast[1].x, cast[0].z - cast[1].z)).toBeGreaterThan(2 * CAST_RADIUS - 0.02);
    }
  });

  it('stays inside the camera framing at every step', async () => {
    for (const id of ['sorting-bubble-sort', 'linked-list-reverse', 'tree-traversals']) {
      const model = await modelOf(id, style);
      for (let k = 0; k < model.frameCount; k++) {
        const view = model.framing(k);
        if (view.mode !== 'AUTO_FIT') continue;
        for (const st of stationsAt(model, k)) {
          if (st.slot < 0) continue;
          expect(st.x).toBeGreaterThanOrEqual(view.center[0] - view.half[0] - 0.4);
          expect(st.x).toBeLessThanOrEqual(view.center[0] + view.half[0] + 0.4);
          expect(st.z).toBeLessThanOrEqual(view.center[2] + view.half[2] + 0.05);
        }
      }
    }
  });

  it('travels: a short trip walks (or rolls), a long one slides (penguins) or rolls (pandas), and a roll lands upright', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    let longStep = -1;
    for (let k = 1; k < model.frameCount && longStep < 0; k++) {
      const a = stationsAt(model, k - 1), b = stationsAt(model, k);
      if (Math.max(...[0, 1].map((i) => Math.hypot(b[i].x - a[i].x, b[i].z - a[i].z))) > 4) longStep = k;
    }
    expect(longStep).toBeGreaterThan(0);
    const start = table.ends[longStep - 1];
    const mid = castAt(model, style, start + table.durations[longStep] * 0.25).cast;
    expect(mid.some((m) => m.gait === (style === 'penguin' ? 'glide' : 'roll'))).toBe(true);
    // At rest the crew stands, the right way up.
    const rest = castAt(model, style, table.ends[longStep] - 1e-4).cast;
    for (const m of rest) {
      expect(m.gaitWeight).toBeLessThan(1e-3);
      if (m.gait === 'roll') expect(Math.abs(Math.sin(m.gaitPhase / 2))).toBeLessThan(1e-3);
    }
  });

  it('acts out the step: inspect on a compare, push on a swap, cheer at the end', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    const poseAt = (k: number) => castAt(model, style, table.ends[k] - 1e-4).cast.map((m) => m.pose);
    const compare = model.frames.findIndex((f) => f.event.kind === 'compare');
    const swap = model.frames.findIndex((f) => f.event.kind === 'swap');
    expect(poseAt(compare)).toEqual(['inspect', 'inspect']);
    expect(poseAt(swap)).toEqual(['push', 'push']);
    expect(poseAt(model.frameCount - 1)).toEqual(['cheer', 'cheer']);
  });

  it('calm mode: no slides, rolls or waddles, only glides between places', async () => {
    const model = await modelOf('sorting-bubble-sort', style);
    const table = buildBeatTable(model.trace);
    const end = table.ends[table.ends.length - 1];
    for (let i = 0; i <= 200; i++) {
      const { cast } = castAt(model, style, (i / 200) * end, true);
      for (const m of cast) {
        expect(m.gait).toBe('stand');
        expect(m.gaitWeight).toBe(0);
      }
    }
  });
});

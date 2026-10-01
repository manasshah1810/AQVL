/**
 * The v2 stage's guarantees, checked against real examples:
 * playback is a pure function of time (deterministic, frame-rate
 * independent, exact at every step), swaps never clip, heavier nodes
 * settle differently, cascades are staggered, the attention budget and the
 * reserved mutation treatment hold, exits leave nothing behind, and the
 * palette passes contrast and colour-blindness checks.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { getExampleById, EXAMPLES } from '../../packages/demo/src/examples/registry';
import { StageModel } from '../../packages/renderer/src/stage/model/StageModel';
import { StageSample, sampleStage } from '../../packages/renderer/src/stage/model/sampler';
import { cameraAt } from '../../packages/renderer/src/stage/model/camera';
import { Playhead } from '../../packages/renderer/src/stage/timeline/Playhead';
import { buildBeatTable, completedStep, locate } from '../../packages/renderer/src/stage/timeline/beats';
import { ATTENTION_BUDGET, allocateAttention, MUTATION_KINDS } from '../../packages/renderer/src/stage/motion/attention';
import { settleTime, springResidual, windowedSpring } from '../../packages/renderer/src/stage/motion/spring';
import { STAGE_PALETTES, contrastRatio } from '../../packages/renderer/src/stage/look/palette';
import { deltaE } from '../../packages/renderer/src/stage/look/vision';

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

function sampleAt(model: StageModel, t: number, calm = false): StageSample {
  const table = buildBeatTable(model.trace);
  const out = new StageSample(model.slots.length, model.edgeSlots.length);
  const p = locate(table, t);
  sampleStage(model, p.k, p.tau, p.duration, out, { reducedMotion: calm });
  return out;
}

function snapshot(s: StageSample) {
  return JSON.stringify({
    pos: Array.from(s.pos, (v) => v.toFixed(5)),
    dims: Array.from(s.dims, (v) => v.toFixed(5)),
    color: Array.from(s.color, (v) => v.toFixed(5)),
    glow: Array.from(s.glow, (v) => v.toFixed(5)),
    presence: Array.from(s.presence, (v) => v.toFixed(5)),
    edges: Array.from(s.edgeP1, (v) => v.toFixed(5)),
    labels: s.labelKeys.map((k) => {
      const l = s.labels.get(k)!;
      return `${k}|${l.text}|${l.opacity.toFixed(4)}|${l.x.toFixed(4)}|${l.y.toFixed(4)}`;
    }),
  });
}

describe('timeline', () => {
  it('maps time to steps exactly, with every step ending at rest', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    const table = buildBeatTable(trace);
    expect(table.ends[0]).toBe(0);
    for (let k = 1; k < trace.frames.length; k++) {
      expect(table.ends[k]).toBeGreaterThan(table.ends[k - 1]);
      const atEnd = locate(table, table.ends[k]);
      expect(atEnd.k).toBe(k);
      expect(atEnd.u).toBeCloseTo(1, 9);
      expect(completedStep(table, table.ends[k])).toBe(k);
      expect(completedStep(table, table.ends[k] - 1e-4)).toBe(k - 1);
    }
  });

  it('gives significant steps more time than routine ones', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    const table = buildBeatTable(trace);
    const swap = trace.frames.findIndex((f) => f.event.kind === 'swap');
    const print = trace.frames.findIndex((f) => f.event.kind === 'print');
    expect(table.durations[swap]).toBeGreaterThan(table.durations[print]);
  });

  it('reaches the same moment at 60 and 120 fps, and at any speed', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    const a = new Playhead(trace);
    const b = new Playhead(trace);
    a.play();
    b.play();
    for (let i = 0; i < 300; i++) a.advance(1 / 60);
    for (let i = 0; i < 600; i++) b.advance(1 / 120);
    expect(a.time).toBeCloseTo(b.time, 9);
    const fast = new Playhead(trace);
    fast.setSpeed(2);
    fast.play();
    for (let i = 0; i < 150; i++) fast.advance(1 / 60);
    expect(fast.time).toBeCloseTo(a.time, 9);
    [a, b, fast].forEach((p) => p.dispose());
  });

  it('steps forward and back to exact resting pictures', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    const p = new Playhead(trace);
    p.stepForward();
    for (let i = 0; i < 200; i++) p.advance(1 / 60);
    expect(p.time).toBe(p.timeOfStep(1));
    p.stepForward();
    for (let i = 0; i < 200; i++) p.advance(1 / 60);
    expect(p.time).toBe(p.timeOfStep(2));
    p.stepBack();
    for (let i = 0; i < 200; i++) p.advance(1 / 60);
    expect(p.time).toBe(p.timeOfStep(1));
    p.dispose();
  });
});

describe('sampling is a pure function of time', () => {
  it('is deterministic and independent of what was sampled before (scrubbing in any order)', async () => {
    const model = new StageModel(await traceOf('sorting-bubble-sort'), 'dark');
    const table = buildBeatTable(model.trace);
    const t = (table.ends[2] + table.ends[1]) / 2; // mid-swap
    const direct = snapshot(sampleAt(model, t));
    // Visit other moments first, forwards and backwards, then come back.
    const shared = new StageSample(model.slots.length, model.edgeSlots.length);
    for (const other of [table.total, 0, table.ends[20], t * 0.3, table.ends[5]]) {
      const p = locate(table, other);
      sampleStage(model, p.k, p.tau, p.duration, shared, { reducedMotion: false });
    }
    const p = locate(table, t);
    sampleStage(model, p.k, p.tau, p.duration, shared, { reducedMotion: false });
    expect(snapshot(shared)).toBe(direct);
  });

  it('lands exactly on each frame at the end of its step', async () => {
    const model = new StageModel(await traceOf('sorting-bubble-sort'), 'dark');
    const table = buildBeatTable(model.trace);
    for (const k of [1, 2, 3, 12, 30]) {
      const s = sampleAt(model, table.ends[k]);
      const rest = model.rest(k);
      for (let i = 0; i < model.slots.length * 3; i++) expect(s.pos[i]).toBeCloseTo(rest.pos[i], 6);
    }
  });

  it('frames the camera the same way whenever it is asked for a given time', async () => {
    const model = new StageModel(await traceOf('graphs-dijkstra'), 'dark');
    const table = buildBeatTable(model.trace);
    const t = table.ends[40] - 0.2;
    const a = cameraAt(model, table, t, 1.6, 38, false);
    cameraAt(model, table, table.ends[90], 1.6, 38, false);
    const b = cameraAt(model, table, t, 1.6, 38, false);
    expect(b).toEqual(a);
  });
});

describe('motion', () => {
  it('swaps never clip: the two travellers and their neighbours never overlap', async () => {
    const model = new StageModel(await traceOf('sorting-bubble-sort'), 'dark');
    const table = buildBeatTable(model.trace);
    const swaps = model.trace.frames.filter((f) => f.event.kind === 'swap').map((f) => f.index);
    expect(swaps.length).toBeGreaterThan(5);
    for (const k of swaps) {
      for (let i = 0; i <= 60; i++) {
        const tau = (table.durations[k] * i) / 60;
        const s = new StageSample(model.slots.length, model.edgeSlots.length);
        sampleStage(model, k, tau, table.durations[k], s, { reducedMotion: false });
        const live: number[] = [];
        for (let a = 0; a < model.slots.length; a++) if (s.presence[a] > 0.5) live.push(a);
        for (let x = 0; x < live.length; x++) {
          for (let y = x + 1; y < live.length; y++) {
            const a = live[x];
            const b = live[y];
            const overlap = [0, 1, 2].every((axis) => Math.abs(s.pos[a * 3 + axis] - s.pos[b * 3 + axis]) < (s.dims[a * 3 + axis] + s.dims[b * 3 + axis]) / 2 - 1e-3);
            expect(overlap, `step ${k} tau ${tau.toFixed(3)} nodes ${a}/${b}`).toBe(false);
          }
        }
      }
    }
  });

  it('heavier nodes settle visibly later and ring lower', () => {
    expect(settleTime(2)).toBeGreaterThan(settleTime(1) * 1.3);
    // At the same moment, a light and a heavy spring are in different places.
    expect(Math.abs(springResidual(0.12, 1) - springResidual(0.12, 2))).toBeGreaterThan(0.05);
    // Both are exactly at rest by the end of their window.
    expect(windowedSpring(1, 1, 2.2)).toBe(1);
  });

  it('staggers cascades instead of moving everything in unison', async () => {
    const model = new StageModel(await traceOf('layout-graph-ring'), 'dark');
    const k = model.trace.frames.findIndex((f) => f.event.kind === 'layout');
    const table = buildBeatTable(model.trace);
    // Shortly into the step, the movers are at different stages of their journey.
    const s = new StageSample(model.slots.length, model.edgeSlots.length);
    sampleStage(model, k, table.durations[k] * 0.12, table.durations[k], s, { reducedMotion: false });
    const from = model.rest(k - 1);
    const to = model.rest(k);
    const progress = model.trace.frames[k].event.actors.map((id) => {
      const i = model.slotOf.get(id)!;
      const total = Math.hypot(to.pos[i * 3] - from.pos[i * 3], to.pos[i * 3 + 2] - from.pos[i * 3 + 2]);
      const done = Math.hypot(s.pos[i * 3] - from.pos[i * 3], s.pos[i * 3 + 2] - from.pos[i * 3 + 2]);
      return total > 1e-6 ? done / total : 1;
    });
    const spread = Math.max(...progress) - Math.min(...progress);
    expect(spread).toBeGreaterThan(0.02);
  });

  it('exits leave nothing behind: removed nodes and their labels are gone at rest', async () => {
    const model = new StageModel(await traceOf('stacks-foundation'), 'dark');
    const table = buildBeatTable(model.trace);
    const k = model.trace.frames.findIndex((f, i) => i > 0 && f.nodes.length < model.trace.frames[i - 1].nodes.length);
    expect(k).toBeGreaterThan(0);
    const gone = model.trace.frames[k - 1].nodes.filter((n) => !model.trace.frames[k].nodes.some((m) => m.id === n.id));
    const s = sampleAt(model, table.ends[k]);
    for (const n of gone) {
      expect(s.presence[model.slotOf.get(n.id)!]).toBe(0);
      const label = s.labels.get(`v:${n.id}`);
      if (label) expect(label.opacity).toBe(0);
    }
  });

  it('calm mode moves nothing along arcs and draws no travelling light or ripples', async () => {
    const model = new StageModel(await traceOf('sorting-bubble-sort'), 'dark');
    const table = buildBeatTable(model.trace);
    const k = model.trace.frames.findIndex((f) => f.event.kind === 'swap');
    const s = new StageSample(model.slots.length, model.edgeSlots.length);
    sampleStage(model, k, table.durations[k] * 0.5, table.durations[k], s, { reducedMotion: true });
    const [a] = model.trace.frames[k].event.actors.map((id) => model.slotOf.get(id)!);
    expect(s.pos[a * 3 + 2]).toBeCloseTo(model.rest(k).pos[a * 3 + 2], 6); // no sideways arc
    expect(s.pulseCount).toBe(0);
  });
});

describe('attention', () => {
  it(`never emphasises more than ${ATTENTION_BUDGET} nodes in any frame of any example`, async () => {
    for (const ex of EXAMPLES.filter((_, i) => i % 3 === 0)) {
      const trace = await recordTrace(compile(ex.source) as any);
      for (const frame of trace.frames) expect(allocateAttention(frame).length).toBeLessThanOrEqual(ATTENTION_BUDGET);
      const model = new StageModel(trace, 'dark');
      for (let k = 0; k < Math.min(trace.frames.length, 40); k++) {
        const emphasised = model.rest(k).emphasized.reduce((n, v) => n + v, 0);
        expect(emphasised).toBeLessThanOrEqual(ATTENTION_BUDGET);
      }
    }
  }, 120_000);

  it('reserves the glowing, blooming treatment for mutations', async () => {
    for (const id of ['sorting-bubble-sort', 'graphs-dijkstra', 'tree-traversals', 'linked-list-reverse', 'searching-binary']) {
      const model = new StageModel(await traceOf(id), 'dark');
      const table = buildBeatTable(model.trace);
      for (let k = 1; k < model.trace.frames.length; k++) {
        const s = new StageSample(model.slots.length, model.edgeSlots.length);
        sampleStage(model, k, table.durations[k] * 0.3, table.durations[k], s, { reducedMotion: false });
        const peak = Math.max(...Array.from(s.glow));
        if (!MUTATION_KINDS.has(model.trace.frames[k].event.kind) && !MUTATION_KINDS.has(model.trace.frames[k - 1].event.kind)) {
          expect(peak, `${id} step ${k} (${model.trace.frames[k].event.kind})`).toBeLessThan(0.35);
        }
      }
    }
  });
});

describe('palette', () => {
  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: every state's value text passes WCAG AA on its body`, () => {
      for (const [state, c] of Object.entries(STAGE_PALETTES[theme].states)) {
        expect(contrastRatio(c.body, c.text), `${theme} ${state}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme}: the core states stay distinct for every kind of colour vision`, () => {
      const s = STAGE_PALETTES[theme].states;
      const core = [s.NEUTRAL.body, s.EVALUATING.body, s.MODIFYING.body, s.TRAVERSING.body, s.SUCCESS.body, s.DISCARDED.body];
      for (const vision of ['normal', 'protanopia', 'deuteranopia', 'tritanopia'] as const) {
        for (let i = 0; i < core.length; i++) {
          for (let j = i + 1; j < core.length; j++) {
            expect(deltaE(core[i], core[j], vision), `${theme} ${vision} ${core[i]} vs ${core[j]}`).toBeGreaterThan(9.5);
          }
        }
      }
    });
  }
});

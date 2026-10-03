#!/usr/bin/env node
/**
 * Behavioral equivalence trace for the example corpus.
 *
 * For every example in packages/demo/src/examples/registry.ts (plus the
 * stand-alone .aqvl samples under examples/ and scripts/samples/), compiles
 * the program, runs it headlessly to completion and records everything a
 * change to the AQIR pipeline could observably alter:
 *
 *   - the exact instruction stream AnimationController.executeInstruction
 *     receives (key-exact: an `undefined`-valued key is distinct from a
 *     missing one),
 *   - every scene timeline frame the renderer can show (StateManager
 *     snapshots: elements, description, camera, partition/sorted regions),
 *   - every event the ExecutionEngine dispatches (name + payload),
 *   - every animation keyframe the scheduler hands the timeline (start time,
 *     tween parameters and which element / element sub-object it targets),
 *     so a refactor that keeps scene snapshots but changes how a step is
 *     animated still shows up as a difference,
 *   - the compile / runtime outcome.
 *
 * Usage:
 *   npx tsx scripts/aqir-trace.ts --out <file.json>              record
 *   npx tsx scripts/aqir-trace.ts --out <file.json> --compare <baseline.json>
 *
 * With --compare, prints per-example differences and exits non-zero if any
 * example differs from the baseline in any recorded channel.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { compile } from '../packages/compiler/src';
import { ExecutionEngine } from '../packages/runtime/src';
import { EXAMPLES } from '../packages/demo/src/examples/registry';

interface Trace {
  outcome: string;
  /** One key-exact JSON line per instruction AnimationController received. */
  handled: string[];
  /** One hash per StateManager timeline frame, with its description. */
  frames: string[];
  /** One `name:hash` per dispatched event. */
  events: string[];
  /** One line per timeline keyframe: `@<time> <target> <params>`. */
  animations: string[];
}

/** JSON with sorted keys; `undefined` values are kept as a marker, cycles and functions made explicit. */
function stable(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === undefined) return '"<undefined>"';
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function') return '"<fn>"';
    if (typeof value === 'number' && !Number.isFinite(value)) return `"<${value}>"`;
    return JSON.stringify(value);
  }
  if (seen.has(value as object)) return '"<cycle>"';
  seen.add(value as object);
  let out: string;
  if (value instanceof Map) {
    out = `{"<map>":[${[...value.entries()].map(([k, v]) => `[${stable(k, seen)},${stable(v, seen)}]`).join(',')}]}`;
  } else if (value instanceof Set) {
    out = `{"<set>":[${[...value].map((v) => stable(v, seen)).join(',')}]}`;
  } else if (Array.isArray(value)) {
    out = `[${value.map((v) => stable(v, seen)).join(',')}]`;
  } else {
    const keys = Object.keys(value as object).sort();
    out = `{${keys.map((k) => `${JSON.stringify(k)}:${stable((value as any)[k], seen)}`).join(',')}}`;
  }
  seen.delete(value as object);
  return out;
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

/**
 * The runtime stamps log payloads and some generated ids with Date.now() /
 * Math.random(); both are replaced by deterministic stand-ins, reset per
 * program, so two runs of unchanged code trace identically.
 */
function pinClockAndRandom(): void {
  let now = 1_700_000_000_000;
  Date.now = () => now++;
  let seed = 0x2f6b1c3d;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Names an animation target by the scene element it is (or is a sub-object of), so traces compare across runs. */
function describeTarget(engine: ExecutionEngine, target: unknown): string {
  if (target === null || typeof target !== 'object') return stable(target);
  if (Array.isArray(target)) return `[${target.map((t) => describeTarget(engine, t)).join(',')}]`;
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el === target) return `el:${el.id}`;
    for (const key of Object.keys(el)) {
      if (el[key] === target) return `el:${el.id}.${key}`;
    }
  }
  if ('id' in (target as any)) return `detached:${(target as any).id}`;
  return Object.keys(target as object).length === 0 ? '{}' : `obj:${stable(target)}`;
}

async function traceOne(source: string): Promise<Trace> {
  pinClockAndRandom();
  const trace: Trace = { outcome: 'pass', handled: [], frames: [], events: [], animations: [] };
  let aqir: any;
  try {
    aqir = compile(source);
  } catch (e: any) {
    trace.outcome = `compile-error: ${e?.name}: ${e?.message}`;
    return trace;
  }

  const engine = new ExecutionEngine({ headless: true });
  const controller = engine.animationController as any;
  const execute = controller.executeInstruction.bind(controller);
  controller.executeInstruction = (instruction: unknown) => {
    trace.handled.push(stable(instruction));
    return execute(instruction);
  };
  const timeline = engine.timelineEngine as any;
  const addKeyframe = timeline.addKeyframe.bind(timeline);
  timeline.addKeyframe = (params: any, time: number) => {
    const { targets, complete, ...rest } = params ?? {};
    trace.animations.push(`@${time} ${describeTarget(engine, targets)} ${stable(rest)}${complete ? ' +complete' : ''}`);
    return addKeyframe(params, time);
  };
  const dispatch = engine.eventDispatcher.dispatch.bind(engine.eventDispatcher);
  engine.eventDispatcher.dispatch = (event: string, payload?: any) => {
    trace.events.push(`${event}:${hash(stable(payload))}`);
    dispatch(event, payload);
  };

  try {
    engine.loadProgram(aqir);
    await engine.execute();
  } catch (e: any) {
    trace.outcome = `runtime-error: ${e?.name}: ${e?.message}`;
  }

  const states = engine.stateManager;
  const length = states.getTimelineLength();
  for (let i = 0; i < length; i++) {
    const s = states.jumpTo(i);
    trace.frames.push(`${s?.description ?? ''}#${hash(stable(s))}`);
  }
  return trace;
}

function collectPrograms(): { id: string; source: string }[] {
  const programs = EXAMPLES.map((ex) => ({ id: ex.id, source: ex.source }));
  for (const dir of ['examples', 'scripts/samples']) {
    const walk = (d: string) => {
      if (!existsSync(d)) return;
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.aqvl')) programs.push({ id: `file:${p.replace(/\\/g, '/')}`, source: readFileSync(p, 'utf-8') });
      }
    };
    walk(resolve(process.cwd(), dir));
  }
  return programs.map((p) => ({ ...p, id: p.id.replace(process.cwd().replace(/\\/g, '/') + '/', '') }));
}

function firstDifference(a: string[], b: string[]): string {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return `#${i} (${a.length} vs ${b.length})\n      baseline: ${(a[i] ?? '<none>').slice(0, 400)}\n      current:  ${(b[i] ?? '<none>').slice(0, 400)}`;
    }
  }
  return '';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const comparePath = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;

  const log = console.log;
  const error = console.error;
  const warn = console.warn;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  const results: Record<string, Trace> = {};
  for (const program of collectPrograms()) {
    results[program.id] = await traceOne(program.source);
  }

  console.log = log;
  console.error = error;
  console.warn = warn;

  const ids = Object.keys(results);
  const passing = ids.filter((id) => results[id].outcome === 'pass').length;
  console.log(`Traced ${ids.length} programs (${passing} ran to completion).`);
  if (outPath) {
    writeFileSync(resolve(process.cwd(), outPath), JSON.stringify(results), 'utf-8');
    console.log(`Wrote ${outPath}`);
  }

  if (comparePath) {
    const baseline: Record<string, Trace> = JSON.parse(readFileSync(resolve(process.cwd(), comparePath), 'utf-8'));
    let differing = 0;
    for (const id of new Set([...Object.keys(baseline), ...ids])) {
      const before = baseline[id];
      const after = results[id];
      if (!before || !after) {
        differing++;
        console.log(`DIFF ${id}: present only in ${before ? 'baseline' : 'current run'}`);
        continue;
      }
      const channels: string[] = [];
      if (before.outcome !== after.outcome) channels.push(`outcome\n      baseline: ${before.outcome}\n      current:  ${after.outcome}`);
      for (const channel of ['handled', 'frames', 'events', 'animations'] as const) {
        const d = firstDifference(before[channel] ?? [], after[channel] ?? []);
        if (d) channels.push(`${channel} ${d}`);
      }
      if (channels.length > 0) {
        differing++;
        console.log(`DIFF ${id}:\n  ${channels.join('\n  ')}`);
      }
    }
    console.log(differing === 0 ? 'All programs identical to baseline.' : `${differing} program(s) differ from baseline.`);
    if (differing > 0) process.exitCode = 1;
  }
}

main();

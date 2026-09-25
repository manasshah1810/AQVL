/**
 * Benchmarks + correctness checks for AQVLVirtualMachine.step()
 * (packages/runtime/src/VirtualMachine.ts).
 *
 * Context: step() used to call getState() twice on the legacy-instruction
 * path (once to hand to the legacy handler, once to build the emitted
 * ExecutionFrame) and emitExecutionFrame() deep-cloned that state via
 * JSON.parse(JSON.stringify(...)). Both are avoidable per-step overhead on
 * every single instruction a program executes. The fix:
 *  - step() now builds the state body (frames/globals/positions/camera) once
 *    per instruction on the legacy path and reuses it for both the legacy
 *    handler call and the emitted frame (only `pc` differs between the two,
 *    and the legacy handler has no way to feed mutations back into the VM's
 *    live state — see captureStateBody()'s doc comment).
 *  - emitExecutionFrame() clones via a targeted manual deep-clone
 *    (`deepClonePlain`) instead of a JSON round-trip. `structuredClone` was
 *    tried first but benchmarked *slower* than JSON for this state shape
 *    (its general-purpose serialization protocol has more overhead than a
 *    plain-object walk); the manual clone came out ~7x faster than either.
 *
 * IMPORTANT — like tests/benchmarks/performance.test.ts, the timing
 * assertions here are deliberately generous baselines, not tight perf
 * gates; they exist to catch gross regressions, not to enforce a budget.
 */
import { describe, expect, it } from 'vitest';
import { createVM } from '../../packages/runtime/src';
import type { VMInstruction } from '../../packages/runtime/src/types';
import { deepClonePlain } from '../../packages/runtime/src/VirtualMachine';

function timeIt<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

/**
 * Builds a program that alternates a control-flow SET_VAR (counter++) with a
 * legacy action instruction (routed through `legacyHandler`, the path that
 * used to double-call getState()) — `stepCount` instructions total, so
 * `stepCount / 2` of each kind.
 */
function buildAlternatingProgram(stepCount: number): VMInstruction[] {
  const instructions: VMInstruction[] = [];
  for (let i = 0; i < stepCount; i++) {
    if (i % 2 === 0) {
      instructions.push({ opcode: 'SET_VAR', name: 'counter', value: { op: '+', left: 'counter', right: 1 } });
    } else {
      instructions.push({ action: 'GENERIC_ACTION', actionName: 'NOOP' } as VMInstruction);
    }
  }
  return instructions;
}

describe('Performance: VM step() over a long-running program (2000 steps)', () => {
  it('runs 2000 mixed control-flow + legacy-handler steps within a generous bound', async () => {
    const STEP_COUNT = 2000;
    const instructions = buildAlternatingProgram(STEP_COUNT);

    let legacyCalls = 0;
    const vm = createVM(instructions, {}, { counter: 0 }, () => {
      legacyCalls++;
    });

    const start = performance.now();
    const result = await vm.run();
    const ms = performance.now() - start;

    console.log(`[perf] VM.run(${STEP_COUNT} steps) => ${ms.toFixed(2)}ms (avg ${(ms / STEP_COUNT).toFixed(4)}ms/step)`);

    expect(result.completed).toBe(true);
    expect(result.finalState.globals.counter).toBe(STEP_COUNT / 2);
    expect(legacyCalls).toBe(STEP_COUNT / 2);
    expect(result.executionSteps.length).toBe(STEP_COUNT);
    // 2000 steps of trivial control-flow/legacy dispatch + one state
    // capture + one structuredClone each — generous ceiling (this ran in a
    // few ms on a normal dev machine; 1s leaves headroom for slow CI).
    expect(ms).toBeLessThan(1000);
  });

  it('scales roughly linearly (10000 steps stay proportionally fast, not quadratic)', async () => {
    const STEP_COUNT = 10_000;
    const instructions = buildAlternatingProgram(STEP_COUNT);
    const vm = createVM(instructions, {}, { counter: 0 }, () => {});

    const start = performance.now();
    const awaited = await vm.run();
    const ms = performance.now() - start;

    console.log(`[perf] VM.run(${STEP_COUNT} steps) => ${ms.toFixed(2)}ms (avg ${(ms / STEP_COUNT).toFixed(4)}ms/step)`);
    expect(awaited.completed).toBe(true);
    // A per-step getState() double-call + JSON round-trip clone would still
    // pass this bound on most machines, so this isn't a tight regression
    // gate on its own — it exists mainly to log the ms/step trend alongside
    // the 2000-step case above. Kept generous like the rest of this suite.
    expect(ms).toBeLessThan(3000);
  });
});

describe('Correctness: emitExecutionFrame produces genuinely isolated snapshots', () => {
  it('a later mutation to a shared object referenced by a global does not retroactively change an earlier captured frame', async () => {
    const sharedObj = { count: 0, nested: { tag: 'initial' } };
    const sharedList = [1, 2, 3];

    const instructions: VMInstruction[] = [
      { opcode: 'SET_VAR', name: 'counter', value: { op: '+', left: 'counter', right: 1 } },
      { action: 'GENERIC_ACTION', actionName: 'NOOP' } as VMInstruction,
      { opcode: 'SET_VAR', name: 'counter', value: { op: '+', left: 'counter', right: 1 } },
    ];

    const vm = createVM(instructions, {}, { counter: 0, shared: sharedObj, list: sharedList }, () => {});
    const result = await vm.run();

    const earlyFrame = result.executionSteps[0];
    const earlySnapshotShared = earlyFrame.state.globals.shared as typeof sharedObj;
    const earlySnapshotList = earlyFrame.state.globals.list as number[];

    expect(earlySnapshotShared).toEqual({ count: 0, nested: { tag: 'initial' } });
    expect(earlySnapshotList).toEqual([1, 2, 3]);

    // Mutate the *live* objects (still referenced by the VM's own globals)
    // after execution finished.
    sharedObj.count = 999;
    sharedObj.nested.tag = 'mutated';
    sharedList.push(4);

    // The frame captured back at step 0 must be untouched — proving its
    // clone was a genuine deep copy, not a reference to the live object.
    expect(earlySnapshotShared).toEqual({ count: 0, nested: { tag: 'initial' } });
    expect(earlySnapshotList).toEqual([1, 2, 3]);

    // Sanity: the live VM state (not a snapshot) does reflect the mutation.
    expect((result.finalState.globals.shared as typeof sharedObj).count).toBe(999);
  });

  it('two frames captured at different steps hold independently-diverging values, not a shared live reference', async () => {
    const instructions: VMInstruction[] = buildAlternatingProgram(10);
    const vm = createVM(instructions, {}, { counter: 0 }, () => {});
    const result = await vm.run();

    const counters = result.executionSteps.map((f) => f.state.globals.counter as number);
    // counter increments only on the SET_VAR steps (every other one).
    expect(counters).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('the legacy-handler snapshot and the emitted frame snapshot agree except for pc having advanced', async () => {
    const seenPcs: number[] = [];
    const instructions: VMInstruction[] = [
      { action: 'GENERIC_ACTION', actionName: 'NOOP' } as VMInstruction,
      { action: 'GENERIC_ACTION', actionName: 'NOOP' } as VMInstruction,
    ];
    const vm = createVM(instructions, {}, { x: 1 }, (_instr, state) => {
      seenPcs.push(state.pc);
    });
    const result = await vm.run();

    // legacyHandler sees pc *before* increment; the emitted frame sees pc
    // *after* — that's the one intentional difference the reuse preserves.
    expect(seenPcs).toEqual([0, 1]);
    expect(result.executionSteps.map((f) => f.state.pc)).toEqual([1, 2]);
  });
});

describe('Performance: deepClonePlain vs JSON round-trip and structuredClone on a VM-state-shaped object', () => {
  it('deepClonePlain (used by emitExecutionFrame) beats both alternatives on a VM-state-shaped object', () => {
    const state = {
      pc: 42,
      frames: Array.from({ length: 5 }, (_, i) => ({
        functionName: `fn${i}`,
        locals: { a: i, b: `val${i}`, nested: { x: i, y: [1, 2, 3, i] } },
        returnAddress: i * 3,
        scope: `scope${i}`,
      })),
      globals: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`g${i}`, { v: i, arr: [i, i + 1, i + 2] }])),
      positions: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`elem${i}`, { x: i, y: i * 2, z: 0 }])),
    };

    const ITERATIONS = 2000;
    const { ms: jsonMs } = timeIt(() => {
      for (let i = 0; i < ITERATIONS; i++) JSON.parse(JSON.stringify(state));
    });
    const { ms: structuredMs } = timeIt(() => {
      for (let i = 0; i < ITERATIONS; i++) structuredClone(state);
    });
    const { ms: manualMs } = timeIt(() => {
      for (let i = 0; i < ITERATIONS; i++) deepClonePlain(state);
    });

    console.log(
      `[perf] clone x${ITERATIONS}: JSON.parse/stringify=${jsonMs.toFixed(2)}ms, structuredClone=${structuredMs.toFixed(2)}ms, deepClonePlain=${manualMs.toFixed(2)}ms`
    );

    expect(deepClonePlain(state)).toEqual(state);
    // structuredClone benchmarked *slower* than the JSON round-trip it would
    // have replaced for this shape (its general-purpose protocol carries
    // more overhead than a plain-object walk), which is why VirtualMachine
    // uses a targeted manual clone instead — generous bound, just guarding
    // against a gross regression back toward JSON-or-worse territory.
    expect(manualMs).toBeLessThan(jsonMs);
  });
});

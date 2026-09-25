/**
 * Regression coverage for ExecutionEngine.play()/execute() trusting
 * frame.state.pc with no iteration cap: a program whose control flow never
 * reaches the end of the instruction stream (a JUMP that targets itself, or
 * any other non-terminating loop, including the reverse-loop bug from
 * Prompt 4 before it's fixed) would previously spin the `while` loop in
 * execute() forever, hanging the runtime with no error surfaced to the UI.
 *
 * ExecutionEngine now caps the number of instructions executed per run and
 * throws MaxIterationsExceededError instead of hanging silently once the cap
 * is exceeded.
 *
 * The instruction stream is built by hand (bypassing the compiler) with a
 * single JUMP targeting itself, since AQVL's surface syntax only exposes a
 * bounded `LOOP i FROM a TO b` and has no way to express a genuinely
 * non-terminating loop at the source level.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExecutionEngine, MaxIterationsExceededError } from '../../packages/runtime/src';
import type { JumpInstruction } from '../../packages/runtime/src';

// ExecutionEngine's `AQIRProgram` type isn't re-exported from the package
// root, so the minimal program shape it needs is inlined here.
type AQIRProgram = {
  objects: unknown[];
  instructions: JumpInstruction[];
  functionTable?: Record<string, unknown>;
};

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function buildInfiniteLoopProgram(): AQIRProgram {
  const jump: JumpInstruction = { opcode: 'JUMP', target: 0 };
  return {
    objects: [],
    instructions: [jump],
    functionTable: {},
  } as unknown as AQIRProgram;
}

describe('ExecutionEngine caps iterations to guard against non-terminating programs', () => {
  it('execute() rejects with MaxIterationsExceededError instead of hanging on an infinite JUMP loop', async () => {
    const engine = new ExecutionEngine();
    engine.loadProgram(buildInfiniteLoopProgram());
    engine.setMaxExecutionIterations(1000);

    await expect(engine.execute()).rejects.toThrow(MaxIterationsExceededError);
    expect(engine.getIsPlaying()).toBe(false);
  }, 10_000);

  it('dispatches EXECUTION_ERROR with a clear message when the cap is exceeded', async () => {
    const engine = new ExecutionEngine();
    engine.loadProgram(buildInfiniteLoopProgram());
    engine.setMaxExecutionIterations(500);

    const handler = vi.fn();
    engine.eventDispatcher.on('EXECUTION_ERROR', handler);

    await expect(engine.execute()).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0];
    expect(payload.error).toBeInstanceOf(MaxIterationsExceededError);
    expect(payload.message).toMatch(/maximum allowed iteration count/i);
  }, 10_000);

  it('play() (fire-and-forget) halts instead of freezing the process', async () => {
    const engine = new ExecutionEngine();
    engine.loadProgram(buildInfiniteLoopProgram());
    engine.setMaxExecutionIterations(500);

    engine.play(); // not awaited, mirroring real UI call sites

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(engine.getIsPlaying()).toBe(false);
  }, 10_000);

  it('does not throw for a normal terminating program within the cap', async () => {
    const jump: JumpInstruction = { opcode: 'JUMP', target: 1 };
    const program: AQIRProgram = {
      objects: [],
      instructions: [jump],
      functionTable: {},
    } as unknown as AQIRProgram;

    const engine = new ExecutionEngine();
    engine.loadProgram(program);
    engine.setMaxExecutionIterations(10);

    await expect(engine.execute()).resolves.not.toThrow();
    expect(engine.getIsPlaying()).toBe(false);
  });
});

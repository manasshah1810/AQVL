/**
 * Regression coverage for ExecutionEngine.loadProgram() forwarding the
 * compiled program's `functionTable` and `objects` into the VM it creates.
 *
 * Before this fix, `loadProgram` called
 * `animationController.createExecutionVM(program.instructions)` with no
 * further arguments, so `functionTable`/`objects` silently defaulted to
 * `{}`/`[]` inside the VM. Any compiled program containing a user-defined
 * function call would throw `FunctionNotFoundError` on its first CALL
 * instruction, and any LAYOUT statement would resolve zero structure
 * elements (since `objects` never reached the VM's geometry state), so
 * SET_LAYOUT_STRATEGY/COMPUTE_LAYOUT computed no positions.
 *
 * This drives a real program — a function call feeding an array LAYOUT —
 * all the way through `ExecutionEngine` (not `createVM` directly, which
 * already forwarded these correctly and would not have caught this bug).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine, DivisionByZeroError } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('ExecutionEngine.loadProgram forwards functionTable/objects to the VM', () => {
  it('resolves a user-defined FUNCTION call without throwing FunctionNotFoundError', async () => {
    const source = `SCENE FunctionCallDemo
DECLARE
  FUNCTION double(x) {
    RETURN x * 2
  }

SEQUENCE
  result = double(21)
END
`;
    const aqir = compile(source);
    expect(Object.keys(aqir.functionTable)).toContain('double');

    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);
    await expect(engine.execute()).resolves.not.toThrow();

    const state = engine.getVMState();
    expect(state).not.toBeNull();
    expect(state!.globals.result).toBe(42);
    // The call completed and returned, so no frame should be left on the stack.
    expect(state!.frames).toHaveLength(0);
  });

  it('resolves array LAYOUT positions (proving `objects` reached the VM geometry state)', async () => {
    const source = `SCENE LayoutDemo
DECLARE
  ARRAY arr = [10, 20, 30]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1, axis=horizontal, origin=(0, 0, 0))
END
`;
    const aqir = compile(source);
    expect(aqir.objects.length).toBeGreaterThan(0);

    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const state = engine.getVMState();
    const arrElements = aqir.objects.filter((o) => o.logicalParent === 'arr');
    expect(arrElements).toHaveLength(3);

    for (const el of arrElements) {
      const pos = state!.positions?.[el.id];
      expect(pos, `expected a resolved position for ${el.id}`).toBeDefined();
      expect(pos!.y).toBe(0);
      expect(pos!.z).toBe(0);
    }
    // Evenly spaced, centered on origin: 3 elements at spacing 1 -> -1, 0, 1.
    const xs = arrElements
      .map((el) => state!.positions![el.id].x)
      .sort((a, b) => a - b);
    expect(xs).toEqual([-1, 0, 1]);
  });

  it('a program with both a function call and a LAYOUT statement resolves both correctly', async () => {
    const source = `SCENE CombinedDemo
DECLARE
  ARRAY arr = [1, 2, 3, 4]
  FUNCTION half(n) {
    RETURN n / 2
  }

SEQUENCE
  LAYOUT arr AS LINE(spacing=2, axis=horizontal, origin=(0, 0, 0))
  result = half(10)
END
`;
    const aqir = compile(source);
    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const state = engine.getVMState();
    expect(state!.globals.result).toBe(5);
    expect(state!.frames).toHaveLength(0);

    const arrElements = aqir.objects.filter((o) => o.logicalParent === 'arr');
    expect(arrElements).toHaveLength(4);
    for (const el of arrElements) {
      expect(state!.positions?.[el.id]).toBeDefined();
    }
  });
});

/**
 * Regression coverage for execute() being fire-and-forget: play() called
 * execute() without awaiting it and without a .catch(), so a thrown runtime
 * error (e.g. DivisionByZeroError) became an unhandled promise rejection,
 * isPlaying stayed true forever, and no error ever reached the UI.
 */
describe('ExecutionEngine surfaces runtime errors instead of failing silently', () => {
  const source = `SCENE Bad
SEQUENCE
  x = 5 / 0
END
`;

  it('execute() rejects with the underlying error and resets isPlaying to false', async () => {
    const aqir = compile(source);
    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);

    await expect(engine.execute()).rejects.toThrow(DivisionByZeroError);
    expect(engine.getIsPlaying()).toBe(false);
  });

  it('dispatches EXECUTION_ERROR with the error message so the UI can display feedback', async () => {
    const aqir = compile(source);
    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);

    const handler = vi.fn();
    engine.eventDispatcher.on('EXECUTION_ERROR', handler);

    await expect(engine.execute()).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0];
    expect(payload.error).toBeInstanceOf(DivisionByZeroError);
    expect(typeof payload.message).toBe('string');
    expect(payload.message.length).toBeGreaterThan(0);
  });

  it('play() (fire-and-forget, matching real UI call sites) does not produce an unhandled rejection and still resets isPlaying/dispatches the error', async () => {
    const aqir = compile(source);
    const engine = new ExecutionEngine();
    engine.loadProgram(aqir);

    const handler = vi.fn();
    engine.eventDispatcher.on('EXECUTION_ERROR', handler);

    engine.play(); // not awaited, mirroring App.tsx/Playground.tsx call sites

    // Let the microtask queue drain so the rejected execute() promise settles.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(engine.getIsPlaying()).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

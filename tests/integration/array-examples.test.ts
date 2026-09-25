/**
 * The Playground's Array examples, run end-to-end (compile -> ExecutionEngine
 * with the real AnimationController, animations completed instantly).
 *
 * Each example must compute its result from the data — loops, IF/ELSE and
 * WHILE over live element values — so these tests assert the final array
 * contents and the console output, plus the language features the examples
 * depend on and the step counter / step-back behaviour of the engine.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { ArrayScripts } from '../../packages/demo/src/examples/ArrayLibrary';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface RunResult {
  engine: ExecutionEngine;
  arrays: Record<string, unknown[]>;
  logs: string[];
}

function readArrays(engine: ExecutionEngine): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== 'ARRAY_ELEMENT') continue;
    (byName[el.logicalParent] ??= []).push(el);
  }
  const out: Record<string, unknown[]> = {};
  for (const [name, els] of Object.entries(byName)) {
    out[name] = els.sort((a, b) => a.logicalIndex - b.logicalIndex).map((el) => el.value);
  }
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { engine, arrays: readArrays(engine), logs };
}

const printed = (logs: string[], keyword?: string) => logs.filter((l) => !keyword || l.includes(keyword));

describe('Array examples produce correct results', () => {
  it('Array Foundation: insert / delete / update / swap act on the current slots, then linear search', async () => {
    const { arrays, logs } = await run(ArrayScripts.ArrayFoundation);
    expect(arrays.arr).toEqual([15, 30, 25, 20, 50]);
    expect(logs).toContain('After INSERT: [10, 20, 25, 30, 40, 50]');
    expect(logs).toContain('After DELETE: [10, 20, 25, 30, 50]');
    expect(logs).toContain('After UPDATE: [15, 20, 25, 30, 50]');
    expect(logs).toContain('After SWAP: [15, 30, 25, 20, 50]');
    expect(logs).toContain('Found 30 at index 1');
  });

  it('Reverse Array', async () => {
    const { arrays, logs } = await run(ArrayScripts.ArrayReverse);
    expect(arrays.arr).toEqual([6, 5, 4, 3, 2, 1]);
    expect(logs).toContain('Reversed: [6, 5, 4, 3, 2, 1]');
  });

  it('Reverse Array works for an odd length too', async () => {
    const { arrays } = await run(ArrayScripts.ArrayReverse.replace('[1, 2, 3, 4, 5, 6]', '[9, 8, 7, 6, 5, 4, 3]'));
    expect(arrays.arr).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('Sliding Window computes every window sum and the maximum', async () => {
    const { logs } = await run(ArrayScripts.SlidingWindow);
    expect(printed(logs, 'Window')).toEqual([
      'Window [0..2] sum = 8',
      'Window [1..3] sum = 7',
      'Window [2..4] sum = 9',
      'Window [3..5] sum = 6',
    ]);
    expect(logs).toContain('Maximum sum of 3 consecutive elements = 9');
  });

  it('Sliding Window adapts to other data', async () => {
    const { logs } = await run(ArrayScripts.SlidingWindow.replace('[2, 1, 5, 1, 3, 2]', '[4, 4, 4, 1, 9, 9, 9, 0]'));
    expect(logs).toContain('Maximum sum of 3 consecutive elements = 27');
  });

  it('Two Pointer Pair Sum decides each move from the actual sum', async () => {
    const { logs } = await run(ArrayScripts.TwoPointerPairSum);
    expect(logs).toContain('1 + 10 = 11 < 12  -> move left pointer right');
    expect(logs).toContain('3 + 10 = 13 > 12  -> move right pointer left');
    expect(logs).toContain('4 + 8 = 12  -> pair found at indices 2 and 4');
  });

  it('Two Pointer Pair Sum reports when no pair exists', async () => {
    const { logs } = await run(ArrayScripts.TwoPointerPairSum.replace('target = 12', 'target = 100'));
    expect(logs).toContain('No pair adds up to 100');
  });

  it('Find Maximum & Minimum', async () => {
    const { logs } = await run(ArrayScripts.FindMaxMin);
    expect(logs).toContain('Maximum = 9 (index 2)');
    expect(logs).toContain('Minimum = 1 (index 4)');
  });

  it('Rotate Array right by k (and k larger than the length)', async () => {
    expect((await run(ArrayScripts.RotateArrayRight)).arrays.arr).toEqual([4, 5, 1, 2, 3]);
    expect((await run(ArrayScripts.RotateArrayRight.replace('k = 2', 'k = 7'))).arrays.arr).toEqual([4, 5, 1, 2, 3]);
    expect((await run(ArrayScripts.RotateArrayRight.replace('k = 2', 'k = 5'))).arrays.arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('Find Duplicate finds the first repeated pair, or reports none', async () => {
    expect((await run(ArrayScripts.FindDuplicateInArray)).logs).toContain('Duplicate value 2 at indices 1 and 4');
    const unique = await run(ArrayScripts.FindDuplicateInArray.replace('[4, 2, 7, 5, 2, 9]', '[1, 2, 3]'));
    expect(unique.logs).toContain('No duplicates: every value is unique');
  });

  it('Merge Two Sorted Arrays, including uneven lengths', async () => {
    expect((await run(ArrayScripts.MergeTwoSortedArrays)).arrays.merged).toEqual([1, 2, 3, 4, 7, 8, 9]);
    const uneven = await run(
      ArrayScripts.MergeTwoSortedArrays.replace('[1, 4, 7, 9]', '[5]').replace('[2, 3, 8]', '[1, 2, 6, 7, 10]')
    );
    expect(uneven.arrays.merged).toEqual([1, 2, 5, 6, 7, 10]);
  });

  it('Prefix Sum builds prefix[] and answers a range query', async () => {
    const { arrays, logs } = await run(ArrayScripts.PrefixSumArray);
    expect(arrays.prefix).toEqual([3, 4, 8, 9, 14]);
    expect(logs).toContain('Sum of arr[1..3] = 6');
  });

  it('Move Zeroes keeps the non-zero order', async () => {
    expect((await run(ArrayScripts.MoveZeroesToEnd)).arrays.arr).toEqual([1, 3, 12, 0, 0]);
    const other = await run(ArrayScripts.MoveZeroesToEnd.replace('[0, 1, 0, 3, 12]', '[4, 0, 0, 5, 0, 6, 7]'));
    expect(other.arrays.arr).toEqual([4, 5, 6, 7, 0, 0, 0]);
  });

  it('Dutch National Flag sorts any mix of 0s, 1s and 2s', async () => {
    expect((await run(ArrayScripts.DutchNationalFlagSort)).arrays.arr).toEqual([0, 0, 1, 1, 2, 2]);
    const other = await run(ArrayScripts.DutchNationalFlagSort.replace('[2, 0, 2, 1, 1, 0]', '[1, 2, 0, 2, 1, 0, 0, 2, 1]'));
    expect(other.arrays.arr).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });
});

describe('Scene language features used by the array examples', () => {
  const program = (body: string, decl = 'ARRAY arr = [3, 1, 4]') => `SCENE T
DECLARE
  ${decl}
SEQUENCE
${body}
END
`;

  it('arr[i] in an expression reads the live element value', async () => {
    const { logs } = await run(program(`  total = 0
  LOOP i FROM 0 TO LENGTH(arr) - 1
    IF arr[i] > 2
      total = total + arr[i]
    END
  END
  PRINT total`));
    expect(logs).toContain('7');
  });

  it('operator precedence and parentheses', async () => {
    const { logs } = await run(program(`  n = 3
  PRINT 2 + 3 * 4 (2 + 3) * 4 10 - 4 - 3 7 % 3
  IF 1 < n - 1
    PRINT "ok"
  END`));
    expect(logs).toContain('14 20 3 1');
    expect(logs).toContain('ok');
  });

  it('ELSE IF chains, and an IF on the line after ELSE is a nested IF', async () => {
    const { logs } = await run(program(`  LOOP i FROM 0 TO 2
    IF arr[i] == 1
      PRINT "one"
    ELSE IF arr[i] == 3
      PRINT "three"
    ELSE
      IF arr[i] == 4
        PRINT "four"
      END
    END
  END`));
    expect(logs).toEqual(['three', 'one', 'four']);
  });

  it('WHILE with AND / OR', async () => {
    const { logs } = await run(program(`  i = 0
  WHILE i < LENGTH(arr) AND arr[i] != 4
    i = i + 1
  END
  IF i == 2 OR i == 99
    PRINT "stopped at" i
  END`));
    expect(logs).toContain('stopped at 2');
  });

  it('UPDATE / INSERT take variable indices and computed values; LENGTH follows the array', async () => {
    const { arrays, logs } = await run(program(`  j = 1
  UPDATE arr[j] arr[0] + arr[2]
  INSERT arr[LENGTH(arr)] 99
  DELETE arr[0]
  PRINT LENGTH(arr) arr`));
    expect(arrays.arr).toEqual([7, 4, 99]);
    expect(logs).toContain('3 [7, 4, 99]');
  });

  it('after SWAP / DELETE a literal index refers to the element now in that slot', async () => {
    const { arrays } = await run(program(`  SWAP arr[0] arr[2]
  DELETE arr[0]
  UPDATE arr[0] 50`));
    expect(arrays.arr).toEqual([50, 3]);
  });

  it('action arguments stop at the end of the line', async () => {
    const { logs } = await run(program(`  x = 1
  HIGHLIGHT arr[0]
  x = x + 1
  PRINT x`));
    expect(logs).toContain('2');
  });

  it('an out-of-range index is a runtime error naming the array and bounds', async () => {
    await expect(run(program(`  i = 3
  HIGHLIGHT arr[i]`))).rejects.toThrow("Index 3 is out of bounds for array 'arr' (valid indices are 0 to 2).");
  });

  it('a variable first assigned inside an IF is not visible after it (compile-time error)', () => {
    expect(() => compile(program(`  IF 1 == 1
    y = 5
  END
  PRINT y`))).toThrow(/Undeclared identifier 'y'/);
  });
});

describe('Step counter and step navigation', () => {
  /** Non-headless engine (so it computes its step total), with animations completed instantly. */
  function makeCountingEngine(): ExecutionEngine {
    const engine = new ExecutionEngine();
    const t = engine.timelineEngine as any;
    let onComplete: (() => void) | null = null;
    let frames: { p: any; o: number; i: number }[] = [];
    t.init = (cb?: () => void) => { onComplete = cb ?? null; frames = []; };
    t.addKeyframe = (p: any, o: any) => frames.push({ p, o: typeof o === 'number' ? o : 0, i: frames.length });
    t.play = () => {
      const fs = frames.sort((a, b) => a.o - b.o || a.i - b.i);
      frames = [];
      for (const f of fs) f.p.complete?.();
      const cb = onComplete; onComplete = null; cb?.();
    };
    t.triggerComplete = t.play;
    return engine;
  }

  it.each(Object.keys(ArrayScripts))('%s: "Step x of y" never exceeds y and ends exactly at y', async (name) => {
    const engine = makeCountingEngine();
    const seen: { current: number; total: number }[] = [];
    engine.eventDispatcher.on('ANIMATED_STEP', (p: any) => seen.push(p));
    engine.loadProgram(compile((ArrayScripts as any)[name]) as any);
    await new Promise((r) => setTimeout(r, 0)); // let the dry run publish the total
    const total = engine.getTotalAnimatedSteps();
    expect(total).toBeGreaterThan(0);

    await engine.execute();
    for (const p of seen) {
      if (p.total > 0) expect(p.current).toBeLessThanOrEqual(p.total);
    }
    expect(engine.getCurrentStep()).toBe(total);
    expect(engine.isAtEnd()).toBe(true);
  });

  it('stepping back restores the scene and program state, and playing on reproduces the same result', async () => {
    const engine = new ExecutionEngine({ headless: true });
    const logs: string[] = [];
    engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
    engine.loadProgram(compile(ArrayScripts.DutchNationalFlagSort) as any);
    await engine.execute();
    const finalStep = engine.getCurrentStep();
    expect(readArrays(engine).arr).toEqual([0, 0, 1, 1, 2, 2]);

    // Back to right after the first swap ([0, 0, 2, 1, 1, 2]).
    while (engine.getCurrentStep() > 2) engine.stepBackward();
    expect(readArrays(engine).arr).toEqual([0, 0, 2, 1, 1, 2]);

    // Step forward one step at a time: the loop variables were restored too.
    await engine.stepForward();
    expect(engine.getCurrentStep()).toBe(3);
    await engine.execute();
    expect(engine.getCurrentStep()).toBe(finalStep);
    expect(readArrays(engine).arr).toEqual([0, 0, 1, 1, 2, 2]);

    // Restart and replay from the beginning.
    engine.restart();
    expect(engine.getCurrentStep()).toBe(0);
    expect(readArrays(engine).arr).toEqual([2, 0, 2, 1, 1, 0]);
    await engine.execute();
    expect(readArrays(engine).arr).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

/**
 * The Playground's Sorting examples, run end-to-end (compile -> ExecutionEngine
 * with the real AnimationController, animations completed instantly).
 *
 * Every example is the real algorithm written with loops, IFs and recursive
 * FUNCTIONs, so besides checking each example's own output, every general
 * sort is re-run on other inputs (already sorted, reversed, duplicates, two
 * elements) by swapping the array literal in DECLARE.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { SortingScripts } from '../../packages/demo/src/examples/SortingLibrary';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface RunResult {
  arrays: Record<string, unknown[]>;
  logs: string[];
}

function readArrays(engine: ExecutionEngine): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== 'ARRAY_ELEMENT' || el.animationLayer) continue;
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
  return { arrays: readArrays(engine), logs };
}

/** The example with its first `ARRAY <name> = [...]` literal replaced. */
function withArray(source: string, name: string, values: number[]): string {
  const pattern = new RegExp(`ARRAY ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `ARRAY ${name} = [${values.join(', ')}]`);
}

const printed = (logs: string[], keyword: string) => logs.filter((l) => l.includes(keyword));

describe('Sorting examples produce correct results', () => {
  it('Bubble Sort: one pass per fixed cell, stops once a pass makes no swap', async () => {
    const { arrays, logs } = await run(SortingScripts.BubbleSort);
    expect(arrays.arr).toEqual([11, 12, 22, 25, 34, 64, 90]);
    expect(printed(logs, 'After pass')).toEqual([
      'After pass 1: [34, 25, 12, 22, 11, 64, 90]',
      'After pass 2: [25, 12, 22, 11, 34, 64, 90]',
      'After pass 3: [12, 22, 11, 25, 34, 64, 90]',
      'After pass 4: [12, 11, 22, 25, 34, 64, 90]',
      'After pass 5: [11, 12, 22, 25, 34, 64, 90]',
      'After pass 6: [11, 12, 22, 25, 34, 64, 90]',
    ]);
    expect(logs).toContain('Pass 6 made no swaps, so the array is already sorted');
  });

  it('Bubble Sort stops after one pass on sorted input', async () => {
    const { logs } = await run(withArray(SortingScripts.BubbleSort, 'arr', [1, 2, 3, 4]));
    expect(printed(logs, 'After pass')).toHaveLength(1);
    expect(logs).toContain('Pass 1 made no swaps, so the array is already sorted');
  });

  it('Selection Sort: one swap per pass at most', async () => {
    const { arrays, logs } = await run(SortingScripts.SelectionSort);
    expect(arrays.arr).toEqual([11, 12, 22, 25, 64]);
    expect(logs).toContain('Smallest of the rest is 11 at index 4, swap it into index 0');
    expect(logs).toContain('25 is already the smallest of the rest, no swap needed');
    expect(logs).toContain('Sorted with 3 swaps: [11, 12, 22, 25, 64]');
  });

  it('Insertion Sort: shifts larger values right and drops the key in the gap', async () => {
    const { arrays, logs } = await run(SortingScripts.InsertionSort);
    expect(arrays.arr).toEqual([5, 6, 11, 12, 13]);
    expect(printed(logs, 'placed at index')).toEqual([
      '  placed at index 0: [11, 12, 13, 5, 6]',
      '  placed at index 2: [11, 12, 13, 5, 6]',
      '  placed at index 0: [5, 11, 12, 13, 6]',
      '  placed at index 1: [5, 6, 11, 12, 13]',
    ]);
    expect(logs).toContain('Sorted with 7 shifts: [5, 6, 11, 12, 13]');
  });

  it('Cocktail Shaker Sort shrinks the window from both ends', async () => {
    const { arrays, logs } = await run(SortingScripts.CocktailShakerSort);
    expect(arrays.arr).toEqual([0, 1, 2, 2, 4, 5, 8]);
    expect(printed(logs, 'Window now')[0]).toBe('Window now [1..5]: [0, 1, 4, 2, 5, 2, 8]');
  });

  it('Quick Sort: every pivot is fixed in its final place', async () => {
    const { arrays, logs } = await run(SortingScripts.QuickSort);
    expect(arrays.arr).toEqual([10, 30, 40, 50, 70, 80, 90]);
    expect(printed(logs, 'is now fixed at')).toEqual([
      '  pivot 70 is now fixed at index 4: [10, 30, 40, 50, 70, 90, 80]',
      '  pivot 50 is now fixed at index 3: [10, 30, 40, 50, 70, 90, 80]',
      '  pivot 40 is now fixed at index 2: [10, 30, 40, 50, 70, 90, 80]',
      '  pivot 30 is now fixed at index 1: [10, 30, 40, 50, 70, 90, 80]',
      '  pivot 80 is now fixed at index 5: [10, 30, 40, 50, 70, 80, 90]',
    ]);
  });

  it('Merge Sort: merges bottom-up and leaves the temp buffer empty', async () => {
    const { arrays, logs } = await run(SortingScripts.MergeSort);
    expect(arrays.arr).toEqual([3, 9, 10, 27, 38, 43, 82]);
    expect(arrays.temp ?? []).toEqual([]);
    expect(printed(logs, 'Merged')).toEqual([
      'Merged [0..1]: [27, 38, 43, 3, 9, 82, 10]',
      'Merged [2..3]: [27, 38, 3, 43, 9, 82, 10]',
      'Merged [0..3]: [3, 27, 38, 43, 9, 82, 10]',
      'Merged [4..5]: [3, 27, 38, 43, 9, 82, 10]',
      'Merged [4..6]: [3, 27, 38, 43, 9, 10, 82]',
      'Merged [0..6]: [3, 9, 10, 27, 38, 43, 82]',
    ]);
  });

  it('Heap Sort: builds a max-heap, then moves the maximum out each round', async () => {
    const { arrays, logs } = await run(SortingScripts.HeapSort);
    expect(arrays.arr).toEqual([5, 6, 7, 11, 12, 13]);
    expect(logs).toContain('Max-heap (largest value at index 0): [13, 11, 12, 5, 6, 7]');
    expect(logs).toContain('Moved 13 to index 5: [12, 11, 7, 5, 6, 13]');
  });

  it('Shell Sort: gaps 4, 2, 1', async () => {
    const { arrays, logs } = await run(SortingScripts.ShellSort);
    expect(arrays.arr).toEqual([1, 2, 3, 8, 12, 23, 34, 54]);
    expect(printed(logs, 'after gap')).toEqual([
      '  after gap 4: [23, 12, 1, 3, 34, 54, 2, 8]',
      '  after gap 2: [1, 3, 2, 8, 23, 12, 34, 54]',
      '  after gap 1: [1, 2, 3, 8, 12, 23, 34, 54]',
    ]);
  });

  it('Counting Sort: tallies values, then writes them back in order', async () => {
    const { arrays, logs } = await run(SortingScripts.CountingSort);
    expect(arrays.arr).toEqual([1, 2, 2, 3, 3, 4, 8]);
    expect(arrays.output).toEqual([1, 2, 2, 3, 3, 4, 8]);
    expect(logs).toContain('Counts: [0, 1, 2, 2, 1, 0, 0, 0, 1]');
  });

  it('Radix Sort: one stable round per digit', async () => {
    const { arrays, logs } = await run(SortingScripts.RadixSort);
    expect(arrays.arr).toEqual([2, 24, 45, 66, 75, 90, 170, 802]);
    expect(printed(logs, 'Sorted by the digit')).toEqual([
      'Sorted by the digit worth 1: [170, 90, 802, 2, 24, 45, 75, 66]',
      'Sorted by the digit worth 10: [802, 2, 24, 45, 66, 170, 75, 90]',
      'Sorted by the digit worth 100: [2, 24, 45, 66, 75, 90, 170, 802]',
    ]);
  });

  it('Cycle Sort: each value written straight to its final place', async () => {
    const { arrays, logs } = await run(SortingScripts.CycleSort);
    expect(arrays.arr).toEqual([10, 20, 30, 40, 50]);
    expect(logs).toContain('Sorted with 5 writes: [10, 20, 30, 40, 50]');
  });

  it('Pancake Sort: only flips, at most two per pancake', async () => {
    const { arrays, logs } = await run(SortingScripts.PancakeSort);
    expect(arrays.arr).toEqual([1, 2, 3, 6, 7, 10]);
    expect(logs).toContain('Sorted with 8 flips: [1, 2, 3, 6, 7, 10]');
  });

  it('Exam Rank List keeps roll numbers paired and shares ranks on ties', async () => {
    const { arrays, logs } = await run(SortingScripts.ExamRankList);
    expect(arrays.marks).toEqual([95, 95, 88, 72, 64, 50]);
    expect(arrays.rollNo).toEqual([102, 105, 104, 101, 103, 106]);
    expect(printed(logs, '  Rank ')).toEqual([
      '  Rank 1: roll no 102 with 95 marks',
      '  Rank 1: roll no 105 with 95 marks',
      '  Rank 3: roll no 104 with 88 marks',
      '  Rank 4: roll no 101 with 72 marks',
      '  Rank 5: roll no 103 with 64 marks',
      '  Rank 6: roll no 106 with 50 marks',
    ]);
  });

  it('Game Leaderboard inserts new scores and keeps the board size', async () => {
    const { arrays, logs } = await run(SortingScripts.LeaderboardInsert);
    expect(arrays.board).toEqual([1000, 980, 900, 870, 870]);
    expect(logs).toContain('900 enters the board at rank 2: [980, 900, 870, 850, 640]');
    expect(logs).toContain('450 is too low for the top 5');
    expect(logs).toContain('1000 enters the board at rank 1: [1000, 980, 900, 870, 870]');
  });

  it('Count Inversions counts out-of-order pairs while sorting', async () => {
    const { arrays, logs } = await run(SortingScripts.CountInversions);
    expect(arrays.arr).toEqual([1, 2, 3, 4, 5]);
    expect(logs).toContain('Inversions: 4 (the most possible for 5 items is 10)');
    const reversed = await run(withArray(SortingScripts.CountInversions, 'arr', [6, 5, 4, 3, 2, 1]));
    expect(reversed.logs).toContain('Inversions: 15 (the most possible for 6 items is 15)');
    const sorted = await run(withArray(SortingScripts.CountInversions, 'arr', [1, 2, 3]));
    expect(sorted.logs).toContain('Inversions: 0 (the most possible for 3 items is 3)');
  });

  it('Quickselect finds the median without sorting everything', async () => {
    const { logs } = await run(SortingScripts.QuickSelectKth);
    expect(logs).toContain('Median time (position 4 of 7 in sorted order) is 23');
    const other = await run(withArray(SortingScripts.QuickSelectKth, 'times', [9, 1, 8, 2, 7]));
    expect(other.logs).toContain('Median time (position 3 of 5 in sorted order) is 7');
  });

  it('Sorted check & stability: equal prices keep their original order', async () => {
    const { arrays, logs } = await run(SortingScripts.SortCheckAndStability);
    expect(arrays.price).toEqual([150, 150, 200, 300, 300]);
    expect(arrays.itemId).toEqual([2, 4, 5, 1, 3]);
    expect(logs).toContain('Not sorted yet, running insertion sort');
    const sorted = await run(withArray(SortingScripts.SortCheckAndStability, 'price', [1, 2, 3, 4, 5]));
    expect(sorted.logs).toContain('Already sorted, nothing to do');
  });
});

describe('Every general sort works on other inputs', () => {
  const sorts: (keyof typeof SortingScripts)[] = [
    'BubbleSort', 'SelectionSort', 'InsertionSort', 'CocktailShakerSort', 'QuickSort', 'MergeSort',
    'HeapSort', 'ShellSort', 'CountingSort', 'RadixSort', 'CycleSort', 'PancakeSort',
  ];
  const inputs: [string, number[]][] = [
    ['already sorted', [1, 2, 3, 4, 5, 6]],
    ['reversed', [9, 8, 7, 6, 5, 4, 3, 2]],
    ['duplicates', [5, 1, 5, 3, 1, 3, 5]],
    ['all equal', [4, 4, 4, 4]],
    ['two elements', [2, 1]],
    ['with zeros', [0, 10, 0, 7, 100, 3]],
  ];
  for (const name of sorts) {
    for (const [label, values] of inputs) {
      it(`${name}: ${label}`, async () => {
        const { arrays } = await run(withArray(SortingScripts[name], 'arr', values));
        expect(arrays.arr).toEqual([...values].sort((a, b) => a - b));
      });
    }
  }
});

describe('Registry', () => {
  it('every Sorting example is listed, and no one-line built-in remains', () => {
    const sources = EXAMPLES.filter((e: any) => e.category === 'Sorting').map((e: any) => e.source);
    for (const script of Object.values(SortingScripts)) expect(sources).toContain(script);
    for (const source of sources) {
      expect(source).not.toMatch(/\b(BUBBLE|SELECTION|INSERTION|MERGE|QUICK)_SORT\b/);
    }
  });
});

describe('Arrays grown and shrunk inside FUNCTIONs', () => {
  it('DELETE with a literal index inside a function acts on the current element', async () => {
    const { arrays, logs } = await run(`SCENE P

DECLARE
  ARRAY temp = []

  FUNCTION fillAndEmpty(times)
    round = 0
    WHILE round < times
      k = 0
      WHILE k < 3
        INSERT temp[k] k * 10
        k = k + 1
      END
      WHILE LENGTH(temp) > 0
        DELETE temp[0]
      END
      round = round + 1
    END
    PRINT "left: " + LENGTH(temp)
  END

SEQUENCE
  fillAndEmpty(3)
  INSERT temp[0] 7
END
`);
    expect(logs).toContain('left: 0');
    expect(arrays.temp).toEqual([7]);
  });
});

describe('Docs', () => {
  it('the Sorting docs page shows the same code as the Playground examples', async () => {
    const { readFileSync } = await import('node:fs');
    const docs = readFileSync(new URL('../../packages/demo/src/pages/Docs.tsx', import.meta.url), 'utf-8')
      // Template literals turn CRLF into LF, so compare with LF line endings
      .replace(/\r\n/g, '\n');
    for (const name of ['BubbleSort', 'SelectionSort', 'InsertionSort', 'QuickSort'] as const) {
      expect(docs).toContain(SortingScripts[name].trimEnd());
    }
  });
});

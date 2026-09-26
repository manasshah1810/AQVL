/**
 * The Playground's Heaps examples, run end-to-end (compile -> ExecutionEngine
 * with the real AnimationController, animations completed instantly), plus
 * the heap-as-real-code features they rely on (HeapProgramEngine): h[i],
 * LENGTH(h), SWAP, `h[i] = v`, INSERT h v, DELETE of the last cell, with the
 * tree view and array view kept in sync.
 *
 * Every example is the real algorithm, so besides checking each example's
 * own output, the general ones are re-run on other inputs by swapping the
 * literal in DECLARE and checked against a plain TypeScript reference.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { HeapScripts } from '../../packages/demo/src/examples/HeapLibrary';
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
  /** Array view of every heap, in index order. */
  heaps: Record<string, unknown[]>;
  /** Tree view of every heap, in index order. */
  trees: Record<string, unknown[]>;
  arrays: Record<string, unknown[]>;
  logs: string[];
  engine: ExecutionEngine;
}

function collect(engine: ExecutionEngine, type: string): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== type || el.animationLayer) continue;
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
  const heaps = collect(engine, 'HEAP_ARRAY_ELEMENT');
  const trees = collect(engine, 'HEAP_NODE');
  // The two views of a heap must always hold the same values.
  expect(trees).toEqual(heaps);
  return { heaps, trees, arrays: collect(engine, 'ARRAY_ELEMENT'), logs, engine };
}

async function runError(source: string): Promise<string> {
  const engine = new ExecutionEngine({ headless: true });
  engine.loadProgram(compile(source) as any);
  try {
    await engine.execute();
  } catch (e: any) {
    return e.message;
  }
  throw new Error('expected the program to stop with an error');
}

/** The example with its first `<KIND> <name> = [...]` literal replaced. */
function withValues(source: string, kind: 'HEAP' | 'ARRAY', name: string, values: number[]): string {
  const pattern = new RegExp(`${kind} ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `${kind} ${name} = [${values.join(', ')}]`);
}

const printed = (logs: string[], keyword: string) => logs.filter((l) => l.includes(keyword));

function isMinHeap(values: unknown[]): boolean {
  const v = values as number[];
  return v.every((x, i) => i === 0 || v[Math.floor((i - 1) / 2)] <= x);
}
function isMaxHeap(values: unknown[]): boolean {
  const v = values as number[];
  return v.every((x, i) => i === 0 || v[Math.floor((i - 1) / 2)] >= x);
}
const ascending = (values: number[]) => [...values].sort((a, b) => a - b);

const INPUTS: Record<string, number[]> = {
  sorted: [1, 2, 3, 4, 5, 6, 7],
  reversed: [9, 8, 7, 6, 5, 4, 3, 2, 1],
  duplicates: [4, 1, 4, 1, 4, 1, 2],
  allEqual: [3, 3, 3, 3],
  twoElements: [2, 1],
  single: [5],
};

describe('Heap examples produce correct results', () => {
  it('Heap Index Map: parent and children of every index', async () => {
    const { logs } = await run(HeapScripts.HeapIndexMap);
    expect(logs).toContain('Index 0 holds 10: the root, it has no parent');
    expect(logs).toContain('Index 5 holds 30: its parent is index 2 (15)');
    expect(logs).toContain('  children: index 3 (40) and index 4 (50)');
    expect(printed(logs, 'no children')).toHaveLength(4);
    expect(logs).toContain('Indices 0 to 2 have children; indices 3 to 6 are leaves');
  });

  it('Is It a Min-Heap?: reports exactly the broken pairs', async () => {
    const { logs } = await run(HeapScripts.IsValidMinHeap);
    expect(printed(logs, 'Broken:')).toEqual([
      'Broken: parent 8 (index 2) is bigger than its left child 7 (index 5)',
      'Broken: parent 9 (index 3) is bigger than its right child 4 (index 8)',
    ]);
    expect(logs).toContain('Found 2 broken parent-child pair(s): this is NOT a min-heap');

    const valid = await run(withValues(HeapScripts.IsValidMinHeap, 'HEAP', 'h', [1, 3, 2, 7, 5, 4, 9]));
    expect(valid.logs).toContain('Every parent is <= its children: this IS a valid min-heap');
  });

  it('Insert and Sift Up: builds the heap from an empty one', async () => {
    const { heaps, logs } = await run(HeapScripts.MinHeapInsert);
    expect(printed(logs, 'After inserting')).toEqual([
      'After inserting 35: [35]',
      'After inserting 33: [33, 35]',
      'After inserting 42: [33, 35, 42]',
      'After inserting 10: [10, 33, 42, 35]',
      'After inserting 14: [10, 14, 42, 35, 33]',
      'After inserting 19: [10, 14, 19, 35, 33, 42]',
      'After inserting 27: [10, 14, 19, 35, 33, 42, 27]',
      'After inserting 44: [10, 14, 19, 35, 33, 42, 27, 44]',
      'After inserting 26: [10, 14, 19, 26, 33, 42, 27, 44, 35]',
    ]);
    expect(heaps.h).toEqual([10, 14, 19, 26, 33, 42, 27, 44, 35]);
  });

  it.each(Object.entries(INPUTS))('Insert and Sift Up keeps a min-heap on %s input', async (_name, values) => {
    const { heaps } = await run(withValues(HeapScripts.MinHeapInsert, 'ARRAY', 'arrivals', values));
    expect(isMinHeap(heaps.h)).toBe(true);
    expect(ascending(heaps.h as number[])).toEqual(ascending(values));
  });

  it('Extract Minimum: values leave smallest first', async () => {
    const { heaps, logs } = await run(HeapScripts.ExtractMin);
    expect(printed(logs, 'Extracted')).toEqual([
      'Extracted 5, heap is now: [8, 9, 11, 17, 12, 25, 20]',
      'Extracted 8, heap is now: [9, 12, 11, 17, 20, 25]',
      'Extracted 9, heap is now: [11, 12, 25, 17, 20]',
      'Extracted 11, heap is now: [12, 17, 25, 20]',
    ]);
    expect(heaps.h).toEqual([12, 17, 25, 20]);
  });

  it('Extract Minimum empties a four-value heap down to nothing', async () => {
    const { heaps, logs } = await run(withValues(HeapScripts.ExtractMin, 'HEAP', 'h', [2, 3, 7, 4]));
    expect(printed(logs, 'Extracted').map((l) => l.split(',')[0])).toEqual(['Extracted 2', 'Extracted 3', 'Extracted 4', 'Extracted 7']);
    expect(heaps.h ?? []).toEqual([]);
  });

  it('Max-Heap Auction: the highest bids win', async () => {
    const { heaps, logs } = await run(HeapScripts.MaxHeapAuction);
    expect(printed(logs, 'sold for')).toEqual(['Item 1 sold for 900', 'Item 2 sold for 750', 'Item 3 sold for 600']);
    expect(logs).toContain('Bid 150 received, highest so far: 400');
    expect(heaps.bids).toEqual([400, 250, 300, 150]);
    expect(isMaxHeap(heaps.bids)).toBe(true);
  });

  it("Build Heap Bottom-Up: Floyd's method, with the swap count returned by siftDown", async () => {
    const { heaps, logs } = await run(HeapScripts.BuildHeapBottomUp);
    expect(printed(logs, 'After sifting down index')).toEqual([
      'After sifting down index 3: [9, 4, 7, 1, 8, 2, 6, 3, 5]',
      'After sifting down index 2: [9, 4, 2, 1, 8, 7, 6, 3, 5]',
      'After sifting down index 1: [9, 1, 2, 3, 8, 7, 6, 4, 5]',
      'After sifting down index 0: [1, 3, 2, 4, 8, 7, 6, 9, 5]',
    ]);
    expect(logs).toContain('Min-heap built with 6 swaps; smallest value 1 is at the root');
    expect(isMinHeap(heaps.h)).toBe(true);
  });

  it.each(Object.entries(INPUTS))('Build Heap Bottom-Up gives a min-heap on %s input', async (_name, values) => {
    const { heaps } = await run(withValues(HeapScripts.BuildHeapBottomUp, 'HEAP', 'h', values));
    expect(isMinHeap(heaps.h)).toBe(true);
    expect(ascending(heaps.h as number[])).toEqual(ascending(values));
  });

  it('Heapify (Recursive): follows the bigger value down and stops at a leaf', async () => {
    const { heaps, logs } = await run(HeapScripts.HeapifyRecursive);
    expect(printed(logs, 'at index')).toEqual([
      '  20 at index 1 is bigger than its child 5: swap, then heapify index 4',
      '  20 at index 4 is bigger than its child 6: swap, then heapify index 9',
      '  20 at index 9 is not bigger than its children: stop',
    ]);
    expect(heaps.h).toEqual([1, 5, 2, 7, 6, 4, 9, 8, 10, 20, 11]);
    expect(isMinHeap(heaps.h)).toBe(true);
  });

  it('Decrease Key: sifts up, and rejects an increase', async () => {
    const { heaps, logs } = await run(HeapScripts.DecreaseKey);
    expect(printed(logs, 'heap is now')).toEqual([
      '  heap is now: [3, 4, 6, 8, 10, 9, 7, 12, 13]',
      '  heap is now: [3, 4, 5, 8, 10, 6, 7, 12, 13]',
    ]);
    expect(logs).toContain('Not a decrease: 20 is not smaller than 8, nothing changes');
    expect(logs).toContain('Closest town is now at distance 3');
    expect(isMinHeap(heaps.dist)).toBe(true);
  });

  it('Delete at Any Index: one delete sifts up, the other sifts down', async () => {
    const { heaps, logs } = await run(HeapScripts.DeleteAtIndex);
    expect(logs).toContain('  moved value 5 is smaller than its parent 11: sift up');
    expect(logs).toContain('Deleted 14 from index 8: [1, 5, 2, 10, 12, 3, 4, 13, 11, 15, 16]');
    expect(logs).toContain('  moved value 16 is not smaller than its parent: sift down');
    expect(logs).toContain('Deleted 2 from index 2: [1, 5, 3, 10, 12, 16, 4, 13, 11, 15]');
    expect(isMinHeap(heaps.h)).toBe(true);
  });

  it('Heap Sort (In Place): sorted ascending', async () => {
    const { heaps, logs } = await run(HeapScripts.HeapSortInPlace);
    expect(logs).toContain('Max-heap: [13, 11, 12, 9, 6, 7, 3, 5]');
    expect(heaps.h).toEqual([3, 5, 6, 7, 9, 11, 12, 13]);
  });

  it.each(Object.entries(INPUTS))('Heap Sort sorts %s input', async (_name, values) => {
    const { heaps } = await run(withValues(HeapScripts.HeapSortInPlace, 'HEAP', 'h', values));
    expect(heaps.h).toEqual(ascending(values));
  });

  it('Emergency Room: most urgent first, names stay paired with severities', async () => {
    const { heaps, arrays, logs } = await run(HeapScripts.EmergencyRoom);
    expect(printed(logs, 'Doctor sees')).toEqual([
      'Doctor sees Ben (severity 7)',
      'Doctor sees Diya (severity 9)',
      'Doctor sees Farah (severity 7)',
      'Doctor sees Chen (severity 5)',
      'Doctor sees Asha (severity 3)',
      'Doctor sees Eli (severity 2)',
    ]);
    expect(logs).toContain('Eli arrives with severity 2; next to be seen: Chen');
    expect(heaps.triage ?? []).toEqual([]);
    expect(arrays.patient ?? []).toEqual([]);
  });

  it('Top K Scores: keeps the best three', async () => {
    const { heaps, logs } = await run(HeapScripts.TopKScores);
    expect(logs).toContain('95 beats the weakest of the top 3 (88), which drops out');
    expect(logs).toContain('60 does not beat 92, ignored');
    expect(logs).toContain('Top 3 scores (weakest at the root): [92, 95, 99]');
    expect(isMinHeap(heaps.best)).toBe(true);
  });

  it('Top K Scores matches a sort on other inputs', async () => {
    const values = [5, 1, 9, 3, 7, 9, 2, 8];
    const { heaps } = await run(withValues(HeapScripts.TopKScores, 'ARRAY', 'scores', values));
    expect(ascending(heaps.best as number[])).toEqual(ascending(values).slice(-3));
  });

  it('Kth Smallest Delivery Time: the third smallest', async () => {
    const { logs } = await run(HeapScripts.KthSmallest);
    expect(logs).toContain('All times in a min-heap: [11, 23, 17, 30, 35, 58, 49, 42]');
    expect(logs).toContain('Fastest #3 delivery took 23 minutes');
    const other = await run(withValues(HeapScripts.KthSmallest, 'ARRAY', 'deliveryMinutes', [9, 9, 1, 4, 6]));
    expect(other.logs).toContain('Fastest #3 delivery took 6 minutes');
  });

  it('Connect Ropes: greedy minimum cost', async () => {
    const { heaps, logs } = await run(HeapScripts.ConnectRopes);
    expect(printed(logs, 'Join ')).toEqual([
      'Join 3 + 4 = 7 (total cost so far 7)',
      'Join 6 + 7 = 13 (total cost so far 20)',
      'Join 8 + 12 = 20 (total cost so far 40)',
      'Join 13 + 20 = 33 (total cost so far 73)',
    ]);
    expect(logs).toContain('One rope of length 33, minimum total cost 73');
    expect(heaps.ropes).toEqual([33]);
  });

  it('Connect Ropes matches a reference on other inputs', async () => {
    const values = [4, 3, 2, 6, 1, 1];
    let cost = 0;
    const pool = [...values];
    while (pool.length > 1) {
      pool.sort((a, b) => a - b);
      const joined = pool.shift()! + pool.shift()!;
      cost += joined;
      pool.push(joined);
    }
    const { logs } = await run(withValues(HeapScripts.ConnectRopes, 'HEAP', 'ropes', values));
    expect(logs).toContain(`One rope of length ${pool[0]}, minimum total cost ${cost}`);
  });

  it('Last Stone Weight: one stone of weight 1 is left', async () => {
    const { logs } = await run(HeapScripts.LastStoneWeight);
    expect(printed(logs, 'Smash')).toEqual([
      'Smash 8 and 7: a stone of 1 is left',
      'Smash 4 and 2: a stone of 2 is left',
      'Smash 2 and 1: a stone of 1 is left',
      'Smash 1 and 1: both are destroyed',
    ]);
    expect(logs).toContain('Last stone weighs 1');

    const none = await run(withValues(HeapScripts.LastStoneWeight, 'ARRAY', 'pile', [3, 3, 5, 5]));
    expect(none.logs).toContain('No stones are left');
  });

  it('Running Median: two heaps give the median after every number', async () => {
    const { heaps, logs } = await run(HeapScripts.RunningMedian);
    expect(printed(logs, 'median =')).toEqual([
      'After 5: median = 5',
      'After 15: median = 10',
      'After 1: median = 5',
      'After 3: median = 4',
      'After 8: median = 5',
      'After 7: median = 6',
      'After 9: median = 7',
      'After 10: median = 7.5',
    ]);
    expect(isMaxHeap(heaps.low)).toBe(true);
    expect(isMinHeap(heaps.high)).toBe(true);
  });

  it('Running Median matches a sorted reference on other inputs', async () => {
    const values = [2, 9, 4, 4, 1, 7, 3];
    const { logs } = await run(withValues(HeapScripts.RunningMedian, 'ARRAY', 'stream', values));
    const expected = values.map((x, i) => {
      const seen = ascending(values.slice(0, i + 1));
      const mid = Math.floor(seen.length / 2);
      const median = seen.length % 2 === 1 ? seen[mid] : (seen[mid - 1] + seen[mid]) / 2;
      return `After ${x}: median = ${median}`;
    });
    expect(printed(logs, 'median =')).toEqual(expected);
  });
});

describe('A HEAP driven by real code', () => {
  const scene = (declare: string, sequence: string) => `SCENE T\n\nDECLARE\n${declare}\n\nSEQUENCE\n${sequence}\nEND\n`;

  it('reads h[i] and LENGTH(h), and prints the array', async () => {
    const { logs } = await run(scene('  HEAP h = [5, 3, 7]', '  PRINT "n=" + LENGTH(h) + " second=" + h[1]\n  PRINT h'));
    expect(logs).toEqual(['n=3 second=3', '[5, 3, 7]']);
  });

  it('SWAP, assignment and UPDATE change both views', async () => {
    const { heaps, trees } = await run(scene('  HEAP h = [5, 3, 7]', '  SWAP h[0] h[1]\n  h[2] = h[0] + 10\n  UPDATE h[1] 1'));
    expect(heaps.h).toEqual([3, 1, 13]);
    expect(trees.h).toEqual([3, 1, 13]);
  });

  it('INSERT appends to an empty heap, wired to its parent, and DELETE removes the last cell', async () => {
    const { heaps, engine, logs } = await run(scene('  HEAP h = []', '  LOOP k FROM 1 TO 5\n    INSERT h k * 10\n  END\n  DELETE h[LENGTH(h) - 1]\n  PRINT LENGTH(h)'));
    expect(heaps.h).toEqual([10, 20, 30, 40]);
    expect(logs).toContain('4');
    const graph = engine.sceneManager.getSceneGraph() as any[];
    const node = (i: number) => graph.find((el) => el.originalType === 'HEAP_NODE' && el.logicalIndex === i);
    const edges = graph.filter((el) => el.originalType === 'EDGE' && el.logicalParent === 'h');
    // parent -> child edges for 1, 2, 3 (the 5th node and its edge are gone)
    expect(edges.map((e) => `${node(0).id === e.sourceId ? 0 : node(1).id === e.sourceId ? 1 : '?'}->${[1, 2, 3].find((i) => node(i).id === e.targetId)}`).sort()).toEqual(['0->1', '0->2', '1->3']);
  });

  it('lays the tree out by index with the array row underneath', async () => {
    const { engine } = await run(scene('  HEAP h = [1, 2, 3]', '  INSERT h 4\n  INSERT h 5'));
    const graph = engine.sceneManager.getSceneGraph() as any[];
    const at = (type: string, i: number) => graph.find((el) => el.originalType === type && el.logicalIndex === i).position;
    expect(at('HEAP_NODE', 1).y).toBeLessThan(at('HEAP_NODE', 0).y);
    expect(at('HEAP_NODE', 1).x).toBeLessThan(at('HEAP_NODE', 2).x);
    expect(at('HEAP_NODE', 3).y).toBeLessThan(at('HEAP_NODE', 1).y);
    expect(at('HEAP_NODE', 4).y).toBe(at('HEAP_NODE', 3).y);
    expect(at('HEAP_NODE', 3).x).toBeLessThan(at('HEAP_NODE', 4).x);
    expect(at('HEAP_ARRAY_ELEMENT', 0).y).toBeLessThan(at('HEAP_NODE', 4).y);
    expect(at('HEAP_ARRAY_ELEMENT', 0).x).toBeLessThan(at('HEAP_ARRAY_ELEMENT', 4).x);
  });

  it('works inside a FUNCTION, including LENGTH after INSERT', async () => {
    const { heaps } = await run(
      scene('  HEAP h = []\n\n  FUNCTION add(v)\n    INSERT h v\n    last = LENGTH(h) - 1\n    IF last > 0\n      IF h[last] < h[0]\n        SWAP h[last] h[0]\n      END\n    END\n  END', '  add(5)\n  add(9)\n  add(1)')
    );
    expect(heaps.h).toEqual([1, 9, 5]);
  });

  it('refuses to delete any cell but the last', async () => {
    const message = await runError(scene('  HEAP h = [1, 2, 3]', '  DELETE h[0]'));
    expect(message).toContain("Only the last cell of heap 'h' (index 2) can be deleted, not index 0");
  });

  it('reports an index outside the heap', async () => {
    expect(await runError(scene('  HEAP h = [1, 2, 3]', '  x = h[3]'))).toBe("Index 3 is out of bounds for heap 'h' (valid indices are 0 to 2).");
    expect(await runError(scene('  HEAP h = []', '  SWAP h[0] h[1]'))).toBe("Index 0 is out of bounds for heap 'h': the heap is empty.");
  });

  it('explains that a heap only grows at its end', async () => {
    expect(await runError(scene('  HEAP h = [1, 2]', '  INSERT h[0] 7'))).toContain('A heap only grows at its end: write INSERT h value');
  });

  it('refuses to SWAP a heap cell with an array cell', async () => {
    expect(await runError(scene('  HEAP h = [1, 2]\n  ARRAY a = [5]', '  SWAP h[0] a[0]'))).toContain('SWAP needs two heap cells');
  });
});

describe('Array fixes the heap examples rely on', () => {
  it('`arr[i] = value` stores the value (it used to be silently dropped)', async () => {
    const { arrays } = await run('SCENE T\n\nDECLARE\n  ARRAY a = [5, 3]\n\nSEQUENCE\n  a[0] = 42\n  a[1] = a[0] + 1\nEND\n');
    expect(arrays.a).toEqual([42, 43]);
  });

  it('LENGTH(arr) inside a FUNCTION sees INSERTs made in the function', async () => {
    const { arrays } = await run(
      'SCENE T\n\nDECLARE\n  ARRAY names = []\n\n  FUNCTION add(n)\n    INSERT names[LENGTH(names)] n\n  END\n\nSEQUENCE\n  add("Asha")\n  add("Ben")\n  add("Chen")\nEND\n'
    );
    expect(arrays.names).toEqual(['Asha', 'Ben', 'Chen']);
  });
});

describe('Heaps library, registry and docs', () => {
  const heapExamples = EXAMPLES.filter((e) => e.category === 'Heaps');

  it('lists all 16 examples, each written as real code', () => {
    expect(heapExamples).toHaveLength(16);
    expect(new Set(heapExamples.map((e) => e.source))).toEqual(new Set(Object.values(HeapScripts)));
    for (const example of heapExamples) {
      expect(example.source, example.id).not.toMatch(/\b(HEAP_INSERT|HEAP_EXTRACT|HEAP_DECREASE|BUILD_HEAP|HEAPIFY)\b/);
      // a loop, or recursion (Heapify calls itself)
      expect(example.source, example.id).toMatch(/\b(WHILE|LOOP)\b|heapify\(smallest\)/);
    }
  });

  it('every example runs without an error', async () => {
    for (const example of heapExamples) {
      await expect(run(example.source), example.id).resolves.toBeDefined();
    }
  });

  it("the Docs page's heap programs run and print what the page says", async () => {
    const docs = readFileSync(resolve(__dirname, '../../packages/demo/src/pages/Docs.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const program = (sceneName: string) => {
      const match = docs.match(new RegExp('code=\\{`(SCENE ' + sceneName + '\\n[\\s\\S]*?)`\\}'));
      expect(match, sceneName).not.toBeNull();
      return match![1];
    };
    const intro = await run(program('HeapIntro'));
    expect(intro.logs).toEqual(['Root (smallest): 10', 'Size: 5', 'Children of the root: 20 15']);
    const insert = await run(program('MinHeapInsert'));
    expect(insert.logs).toContain('After inserting 14: [10, 14, 42, 35, 33]');
    const extract = await run(program('ExtractMin'));
    expect(printed(extract.logs, 'Extracted')).toEqual(['Extracted 5', 'Extracted 8', 'Extracted 9']);
  });
});

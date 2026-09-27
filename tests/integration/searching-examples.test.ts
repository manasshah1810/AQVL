/**
 * The Playground's Searching examples, run end-to-end (compile -> ExecutionEngine
 * with the real AnimationController, animations completed instantly).
 *
 * Every example is the real algorithm written with loops, IFs and recursive
 * FUNCTIONs, so besides checking each example's own output, every general
 * array search is re-run with each element of its array as the target and
 * with values that are missing (below, between and above the elements).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { SearchingScripts } from '../../packages/demo/src/examples/SearchingLibrary';
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

/** The example with its SEQUENCE block replaced, keeping DECLARE (arrays and FUNCTIONs). */
function withSequence(source: string, body: string): string {
  const at = source.indexOf('\nSEQUENCE\n');
  expect(at).toBeGreaterThan(0);
  return `${source.slice(0, at)}\nSEQUENCE\n${body}\nEND\n`;
}

/** The example with its first `ARRAY <name> = [...]` literal replaced. */
function withArray(source: string, name: string, values: number[]): string {
  const pattern = new RegExp(`ARRAY ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `ARRAY ${name} = [${values.join(', ')}]`);
}

const printed = (logs: string[], keyword: string) => logs.filter((l) => l.includes(keyword));

describe('Searching examples produce correct results', () => {
  it('Linear Search: stops at the first match, checks every cell on a miss', async () => {
    const { logs } = await run(SearchingScripts.LinearSearch);
    expect(logs).toContain('Roll no 123 found at index 3 after 4 comparisons');
    expect(logs).toContain('Roll no 150 is absent: all 7 cells were checked');
    expect(logs).toContain('Best case: 1 comparison, worst case: 7 comparisons (O(n))');
  });

  it('All Occurrences: collects every matching index', async () => {
    const { arrays, logs } = await run(SearchingScripts.AllOccurrences);
    expect(arrays.matches).toEqual([2, 4, 6, 9]);
    expect(logs).toContain('Scored 3 goals in 4 matches, at indexes: [2, 4, 6, 9]');
    expect(logs).toContain('First time: match index 2, last time: match index 9');
  });

  it('Sentinel Search: tells a real match from the sentinel and restores the array', async () => {
    const { arrays, logs } = await run(SearchingScripts.SentinelLinearSearch);
    expect(logs).toContain('Barcode 9981 is at index 3');
    expect(logs).toContain('Barcode 3217 is at index 5');
    expect(logs).toContain('Barcode 1111 is not on the shelf (only the sentinel matched)');
    expect(arrays.codes).toEqual([5021, 7310, 4402, 9981, 6605, 3217]);
  });

  it('Binary Search: halves the window, reports misses and the worst case', async () => {
    const { logs } = await run(SearchingScripts.BinarySearch);
    expect(printed(logs, 'Step ').slice(0, 2)).toEqual([
      'Step 1: low=0 high=8 mid=4 (value 34)',
      'Step 2: low=5 high=8 mid=6 (value 90)',
    ]);
    expect(logs).toContain('Found 90 at index 6 in 2 steps');
    expect(logs).toContain('Found 11 at index 0 in 3 steps');
    expect(logs).toContain('50 is not in the list (window empty after 3 steps)');
    expect(logs).toContain('Never more than 4 steps for 9 prices (O(log n)); linear search may need 9');
  });

  it('Recursive Binary Search: one call per window, empty window means missing', async () => {
    const { logs } = await run(SearchingScripts.BinarySearchRecursive);
    expect(logs).toContain('Yes, chapter 8 starts on page 110');
    expect(logs).toContain('  depth 5: empty window, 50 is not a chapter start');
    expect(logs).toContain('No, page 50 is in the middle of a chapter');
  });

  it('First & Last Occurrence counts duplicates', async () => {
    const { logs } = await run(SearchingScripts.FirstAndLastOccurrence);
    expect(logs).toEqual(expect.arrayContaining([
      '67 marks: first at index 4, last at index 7, so 4 students',
      '42 marks: first at index 1, last at index 2, so 2 students',
      '35 marks: only index 0, so 1 student',
      'Nobody scored 70',
    ]));
  });

  it('Search Insert Position keeps the appointments sorted', async () => {
    const { arrays, logs } = await run(SearchingScripts.SearchInsertPosition);
    expect(arrays.slots).toEqual([830, 900, 930, 1015, 1030, 1100, 1245, 1400, 1500]);
    expect(logs).toContain('Booked 1030 at index 3: [900, 930, 1015, 1030, 1100, 1245, 1400]');
    expect(logs).toContain('Booked 1500 at index 8: [830, 900, 930, 1015, 1030, 1100, 1245, 1400, 1500]');
    expect(logs).toContain('1100 is already booked');
  });

  it('Jump Search jumps sqrt(n) cells, then scans one block', async () => {
    const { logs } = await run(SearchingScripts.JumpSearch);
    expect(logs).toContain('Block size = sqrt(16) = 4');
    expect(logs).toContain('  scan block [8..11] after 2 jumps');
    expect(logs).toContain('Seat 23 is sold (index 11)');
    expect(logs).toContain('Seat 8 is still free');
    expect(logs).toContain('Seat 31 is sold (index 15)');
  });

  it('Exponential Search doubles the bound, then binary searches', async () => {
    const { logs } = await run(SearchingScripts.ExponentialSearch);
    expect(logs).toContain('  bound stopped at 4, binary search in [2..4]');
    expect(logs).toContain('10 found at index 3');
    expect(logs).toContain('78 found at index 11');
    expect(logs).toContain('100 is not in the log');
  });

  it('Ternary Search keeps one third per round', async () => {
    const { logs } = await run(SearchingScripts.TernarySearch);
    expect(logs).toContain('45 -> index 7');
    expect(logs).toContain('13 -> index -1');
  });

  it('Interpolation Search needs one probe on evenly spaced values', async () => {
    const { logs } = await run(SearchingScripts.InterpolationSearch);
    expect(logs).toContain('House 70 found in 1 probe(s)');
    expect(logs).toContain('House 10 found in 1 probe(s)');
    expect(logs).toContain('House 55 is not on this street');
    expect(logs).toContain('House 500 is not on this street');
  });

  it('Rotated Array Search finds values on both sides of the wrap', async () => {
    const { logs } = await run(SearchingScripts.RotatedArraySearch);
    expect(logs).toContain('7 found at index 7');
    expect(logs).toContain('15 found at index 1');
    expect(logs).toContain('10 is not in the list');
  });

  it('Peak of a Trail finds the summit', async () => {
    const { logs } = await run(SearchingScripts.PeakElement);
    expect(logs).toContain('Summit: 460 m at index 5');
    const early = await run(withArray(SearchingScripts.PeakElement, 'elevation', [900, 500, 100]));
    expect(early.logs).toContain('Summit: 900 m at index 0');
    const late = await run(withArray(SearchingScripts.PeakElement, 'elevation', [1, 2, 3, 4]));
    expect(late.logs).toContain('Summit: 4 m at index 3');
  });

  it('Square Root by Binary Search', async () => {
    const { arrays } = await run(SearchingScripts.SquareRootSearch);
    expect(arrays.roots).toEqual([0, 1, 3, 4, 9, 31]);
  });

  it('Sorted Seat Map turns a position into row and column', async () => {
    const { logs } = await run(SearchingScripts.SortedMatrixSearch);
    expect(logs).toContain('Seat 117 is in row 1, column 2');
    expect(logs).toContain('Seat 126 is in row 2, column 1');
    expect(logs).toContain('Seat 111 does not exist');
  });

  it('Missing Roll Number', async () => {
    const { logs } = await run(SearchingScripts.MissingRollNumber);
    expect(logs).toContain('Missing roll number: 7');
    const first = await run(withArray(SearchingScripts.MissingRollNumber, 'handedIn', [2, 3, 4, 5]));
    expect(first.logs).toContain('Missing roll number: 1');
    const last = await run(withArray(SearchingScripts.MissingRollNumber, 'handedIn', [1, 2, 3, 4]));
    expect(last.logs).toContain('Missing roll number: 5');
  });

  it('Delivery Truck Capacity: smallest capacity that fits the days', async () => {
    const { logs } = await run(SearchingScripts.ShipWithinDays);
    expect(logs).toContain('Smallest truck for 3 days: 6 kg');
    const other = await run(withArray(SearchingScripts.ShipWithinDays, 'parcels', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    // Compare with a brute-force answer: try every capacity from the heaviest parcel up
    const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const days = (cap: number) => {
      let d = 1, load = 0;
      for (const w of weights) { if (load + w > cap) { d++; load = 0; } load += w; }
      return d;
    };
    let best = Math.max(...weights);
    while (days(best) > 3) best++;
    expect(other.logs).toContain(`Smallest truck for 3 days: ${best} kg`);
  });

  it('Contact Book Search compares names in dictionary order', async () => {
    const { logs } = await run(SearchingScripts.ContactBookSearch);
    expect(logs).toContain('Meera -> extension 301');
    expect(logs).toContain('Chen -> extension 238');
    expect(logs).toContain('Neha is not in the contacts');
  });

  it('BST Search follows one path, with a loop and with recursion', async () => {
    const { logs } = await run(SearchingScripts.BSTSearch);
    expect(logs).toContain('Loop: book 65 found after visiting 50 70 60');
    expect(logs).toContain('Loop: book 45 not found, path was 50 30 40');
    expect(logs).toContain('Recursive: book 35 found after comparing 4 nodes (a list of 9 could need 9)');
    expect(logs).toContain('Recursive: book 99 is not on the shelf');
  });

  it('Maze DFS backs out of dead ends and stops at the exit', async () => {
    const { logs } = await run(SearchingScripts.MazeDFS);
    expect(printed(logs, 'Enter ')).toEqual([
      'Enter Entry', 'Enter Hall', 'Enter Armory', 'Enter Dungeon',
      'Enter Garden', 'Enter Well', 'Enter Crypt', 'Enter Tower', 'Enter Exit',
    ]);
    expect(logs).toContain('  dead end behind Armory, back in Hall');
    expect(logs).toContain('Way out: Entry Hall Garden Tower Exit');
  });

  it('Nearest Hospital BFS stops at the first hospital dequeued', async () => {
    const { logs } = await run(SearchingScripts.NearestHospitalBFS);
    expect(printed(logs, 'Check ')).toHaveLength(5);
    expect(logs).toContain('Nearest hospital: Park, 2 road(s) away');
    expect(logs).toContain('Route: Home -> School -> Park');
  });
});

describe('Every general array search finds each element and rejects missing values', () => {
  // [example, array name, function name, extra arguments after the target]
  const searches: [keyof typeof SearchingScripts, string, string, string][] = [
    ['LinearSearch', 'rollNo', 'linearSearch', ''],
    ['SentinelLinearSearch', 'codes', 'sentinelSearch', ''],
    ['BinarySearch', 'price', 'binarySearch', ''],
    ['JumpSearch', 'sold', 'jumpSearch', ''],
    ['ExponentialSearch', 'ids', 'exponentialSearch', ''],
    ['TernarySearch', 'arr', 'ternarySearch', ''],
    ['InterpolationSearch', 'houses', 'interpolationSearch', ''],
    ['RotatedArraySearch', 'hours', 'searchRotated', ''],
    ['SortedMatrixSearch', 'seats', 'findSeat', ', 4'],
  ];
  for (const [name, arrayName, fn, extra] of searches) {
    it(name, async () => {
      const source = SearchingScripts[name];
      const literal = source.match(new RegExp(`ARRAY ${arrayName} = \\[([^\\]]*)\\]`))![1];
      const values = literal.split(',').map((v) => Number(v.trim()));
      const sortedValues = [...values].sort((a, b) => a - b);
      const missing = [sortedValues[0] - 1, sortedValues[sortedValues.length - 1] + 1];
      for (let i = 1; i < sortedValues.length; i++) {
        if (sortedValues[i] - sortedValues[i - 1] > 1) missing.push(sortedValues[i - 1] + 1);
      }
      let body = '';
      for (const v of [...values, ...missing]) body += `  PRINT "result " + ${fn}(${v}${extra})\n`;
      const { logs } = await run(withSequence(source, body));
      const results = printed(logs, 'result ').map((l) => Number(l.slice('result '.length)));
      expect(results).toEqual([...values.map((_, i) => i), ...missing.map(() => -1)]);
    });
  }

  it('Recursive Binary Search', async () => {
    const values = [1, 15, 32, 47, 60, 78, 95, 110, 126, 140];
    let body = '';
    for (const v of [...values, 0, 2, 100, 141]) {
      body += `  PRINT "result " + search(${v}, 0, LENGTH(chapterStart) - 1, 1)\n`;
    }
    const { logs } = await run(withSequence(SearchingScripts.BinarySearchRecursive, body));
    const results = printed(logs, 'result ').map((l) => Number(l.slice('result '.length)));
    expect(results).toEqual([...values.map((_, i) => i), -1, -1, -1, -1]);
  });

  it('Binary Search on a one-element and a two-element list', async () => {
    const one = withArray(SearchingScripts.BinarySearch, 'price', [7]);
    const a = await run(withSequence(one, '  PRINT "result " + binarySearch(7)\n  PRINT "result " + binarySearch(8)'));
    expect(printed(a.logs, 'result ')).toEqual(['result 0', 'result -1']);
    const two = withArray(SearchingScripts.BinarySearch, 'price', [3, 9]);
    const b = await run(withSequence(two, '  PRINT "result " + binarySearch(9)\n  PRINT "result " + binarySearch(3)\n  PRINT "result " + binarySearch(5)'));
    expect(printed(b.logs, 'result ')).toEqual(['result 1', 'result 0', 'result -1']);
  });

  it('Interpolation Search on equal values does not divide by zero', async () => {
    const same = withArray(SearchingScripts.InterpolationSearch, 'houses', [5, 5, 5]);
    const { logs } = await run(withSequence(same, '  PRINT "result " + interpolationSearch(5)\n  PRINT "result " + interpolationSearch(6)'));
    expect(printed(logs, 'result ')).toEqual(['result 0', 'result -1']);
  });
});

describe('Registry', () => {
  it('every Searching example is listed, and no hard-coded step list remains', () => {
    const sources = EXAMPLES.filter((e: any) => e.category === 'Searching').map((e: any) => e.source);
    expect(sources).toHaveLength(Object.keys(SearchingScripts).length);
    for (const script of Object.values(SearchingScripts)) expect(sources).toContain(script);
    for (const source of sources) {
      // A hard-coded search compares fixed cells such as `COMPARE arr[3] arr[5]`
      expect(source).not.toMatch(/COMPARE \w+\[\d+\] \w+\[\d+\]/);
      expect(source).not.toMatch(/^\s*(DFS|BFS|SEARCH) /m);
    }
  });
});

describe('Docs', () => {
  it('the Searching docs page shows the same code as the Playground examples', async () => {
    const { readFileSync } = await import('node:fs');
    const docs = readFileSync(new URL('../../packages/demo/src/pages/Docs.tsx', import.meta.url), 'utf-8')
      .replace(/\r\n/g, '\n');
    for (const name of ['LinearSearch', 'BinarySearch', 'BinarySearchRecursive', 'ShipWithinDays', 'NearestHospitalBFS'] as const) {
      expect(docs).toContain(SearchingScripts[name].replace(/\r\n/g, '\n').trimEnd());
    }
  });
});

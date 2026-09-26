/**
 * The Playground's Hash Maps examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly), plus the hash-map-as-real-code features they rely on
 * (HashMapProgramEngine): m[key] = v, m[key], CONTAINS, DELETE m[key],
 * LENGTH, KEY_AT, BUCKET_OF, CAPACITY, HIGHLIGHT, PRINT and the text
 * built-ins TEXT_LENGTH / CHAR_AT / CHAR_CODE.
 *
 * After every run the scene is checked against how a separate-chaining map
 * must look: each key in the bucket its hash picks, chains numbered 0, 1, 2
 * without gaps and drawn under their bucket, load factor at most 0.75.
 * The general examples are re-run on other inputs by swapping a literal and
 * checked against a plain TypeScript reference.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { HashMapScripts } from '../../packages/demo/src/examples/HashMapLibrary';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface MapState {
  capacity: number;
  /** key -> value, in bucket order */
  entries: [unknown, unknown][];
}

interface RunResult {
  maps: Record<string, MapState>;
  arrays: Record<string, unknown[]>;
  /** Every console line */
  logs: string[];
  /** PRINT lines only */
  printed: string[];
  keywords: string[];
  engine: ExecutionEngine;
}

/** The map's hash: integer keys key % capacity, text keys (sum of character codes) % capacity. */
function hashOf(key: unknown, capacity: number): number {
  if (typeof key === 'number' && Number.isInteger(key)) return ((key % capacity) + capacity) % capacity;
  const text = String(key);
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
  return sum % capacity;
}

/** Reads every map back from the scene and checks it is a well-formed separate-chaining map. */
function collectMaps(engine: ExecutionEngine): Record<string, MapState> {
  const graph = engine.sceneManager.getSceneGraph() as any[];
  const names = new Set(graph.filter((el) => el.originalType === 'HASHMAP_BUCKET').map((el) => el.logicalParent));
  const out: Record<string, MapState> = {};
  for (const name of names) {
    const buckets = graph.filter((el) => el.originalType === 'HASHMAP_BUCKET' && el.logicalParent === name);
    const entries = graph
      .filter((el) => el.originalType === 'HASHMAP_ENTRY' && el.logicalParent === name)
      .sort((a, b) => a.bucketIndex - b.bucketIndex || a.chainIndex - b.chainIndex);
    const capacity = buckets.length;
    // One bucket per index, no old row left over from a resize
    expect(buckets.map((b) => b.logicalIndex).sort((a, b) => a - b), name).toEqual([...Array(capacity).keys()]);
    expect(buckets.some((b) => b.pendingRemoval) || entries.some((e) => e.pendingRemoval), name).toBe(false);
    expect(entries.length / capacity, `${name} load factor`).toBeLessThanOrEqual(0.75);
    expect(new Set(entries.map((e) => JSON.stringify(e.key))).size, `${name} keys unique`).toBe(entries.length);
    for (let b = 0; b < capacity; b++) {
      const chain = entries.filter((e) => e.bucketIndex === b);
      expect(chain.map((e) => e.chainIndex), `${name} bucket ${b} chain`).toEqual([...Array(chain.length).keys()]);
      const bucket = buckets.find((el) => el.logicalIndex === b);
      for (const e of chain) {
        expect(hashOf(e.key, capacity), `${name}[${String(e.key)}] bucket`).toBe(b);
        // drawn under its own bucket, one slot per chain position
        expect(e.position.x).toBeCloseTo(bucket.position.x, 5);
        expect(e.position.y).toBeCloseTo(bucket.position.y - (e.chainIndex + 1) * 1.1, 5);
        expect(e.label).toBe(`${e.key}: ${typeof e.value === 'boolean' ? (e.value ? 'TRUE' : 'FALSE') : e.value}`);
      }
    }
    out[name] = { capacity, entries: entries.map((e) => [e.key, e.value]) };
  }
  return out;
}

function collectArrays(engine: ExecutionEngine): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== 'ARRAY_ELEMENT' || el.animationLayer) continue;
    (byName[el.logicalParent] ??= []).push(el);
  }
  const out: Record<string, unknown[]> = {};
  for (const [name, els] of Object.entries(byName)) out[name] = els.sort((a, b) => a.logicalIndex - b.logicalIndex).map((el) => el.value);
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  const keywords: string[] = [];
  const printed: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => {
    logs.push(e.message);
    keywords.push(e.keyword);
    if (e.keyword === 'PRINT') printed.push(e.message);
  });
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { maps: collectMaps(engine), arrays: collectArrays(engine), logs, printed, keywords, engine };
}

async function runError(source: string): Promise<string> {
  const engine = new ExecutionEngine({ headless: true });
  try {
    engine.loadProgram(compile(source) as any);
    await engine.execute();
  } catch (e: any) {
    return e.message;
  }
  throw new Error('expected the program to stop with an error');
}

const program = (declare: string, sequence: string) => `SCENE T\n\nDECLARE\n${declare}\n\nSEQUENCE\n${sequence}\nEND\n`;
const asObject = (m: MapState) => Object.fromEntries(m.entries.map(([k, v]) => [String(k), v]));

/** The example with its first `ARRAY <name> = [...]` literal replaced. */
function withArray(source: string, name: string, values: (number | string)[]): string {
  const pattern = new RegExp(`ARRAY ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  const literal = values.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ');
  return source.replace(pattern, `ARRAY ${name} = [${literal}]`);
}

/** The example with its first `<name> = <number>` / `<name> = "<text>"` assignment replaced. */
function withValue(source: string, name: string, value: number | string): string {
  const pattern = new RegExp(`(\\n\\s*)${name} = ("[^"]*"|-?\\d+)\\n`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `$1${name} = ${typeof value === 'string' ? `"${value}"` : value}\n`);
}

// ─── TypeScript references ────────────────────────────────────────────────────

function countOf<T>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}
function twoSumRef(nums: number[], target: number): [number, number] | null {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i])!, i];
    seen.set(nums[i], i);
  }
  return null;
}
function longestRunRef(nums: number[]): [number, number] {
  const set = new Set(nums);
  let bestStart = 0;
  let best = 0;
  for (const x of nums) {
    if (set.has(x - 1)) continue;
    let n = 1;
    while (set.has(x + n)) n++;
    if (n > best) {
      best = n;
      bestStart = x;
    }
  }
  return [bestStart, best];
}
function subarraySumRef(nums: number[], k: number): number {
  let count = 0;
  for (let a = 0; a < nums.length; a++) {
    let sum = 0;
    for (let b = a; b < nums.length; b++) {
      sum += nums[b];
      if (sum === k) count++;
    }
  }
  return count;
}
function longestSubstringRef(text: string): string {
  let best = '';
  for (let a = 0; a < text.length; a++) {
    for (let b = a + 1; b <= text.length; b++) {
      const part = text.slice(a, b);
      if (new Set(part).size === part.length && part.length > best.length) best = part;
    }
  }
  return best;
}
function firstUniqueRef(text: string): number {
  const counts = countOf([...text].filter((c) => c !== ' '));
  return [...text].findIndex((c) => c !== ' ' && counts.get(c) === 1);
}
function isAnagramRef(a: string, b: string): boolean {
  return [...a].sort().join('') === [...b].sort().join('');
}

// ─── The examples ─────────────────────────────────────────────────────────────

describe('Hash map examples produce correct results', () => {
  it('Hash Function by Hand: the hand-written hash matches the map, anagrams collide', async () => {
    const { printed, maps, logs } = await run(HashMapScripts.HashFunctionByHand);
    expect(printed).toEqual([
      'The map has 8 buckets, numbered 0 to 7',
      'cat -> bucket 0',
      'dog -> bucket 2',
      'act -> bucket 0',
      '  collision: cat is already in bucket 0',
      'bird -> bucket 1',
      'fish -> bucket 2',
      '  collision: dog is already in bucket 2',
      'god -> bucket 2',
      '  collision: dog is already in bucket 2',
      '  collision: fish is already in bucket 2',
      'Stored: {cat: 3, act: 3, bird: 4, dog: 3, fish: 4, god: 3}',
      'Anagrams (cat / act, dog / god) have the same letters, so the same sum and the same bucket',
    ]);
    expect(logs.some((l) => l.includes('disagrees'))).toBe(false);
    expect(maps.shelf.capacity).toBe(8);
    expect(logs).toContain('hash("cat"): character codes of "cat" add up to (99 + 97 + 116) = 312; 312 % 8 = 0 -> bucket 0');
  });

  it('Phone Book: store, overwrite, guarded reads, delete', async () => {
    const { printed, maps } = await run(HashMapScripts.PhoneBook);
    expect(printed).toEqual([
      'Phone book: {asha: 5550101, ben: 5550102, chen: 5550103, dia: 5550104}',
      'It holds 4 contacts',
      "Ben's old number: 5550102",
      "Ben's new number: 5550199",
      'Still 4 contacts: keys are unique',
      'ben: 5550199',
      'eli: not in the phone book',
      'chen: 5550103',
      'asha: 5550101',
      'Removed chen',
      'chen is gone; 3 contacts left: {asha: 5550101, ben: 5550199, dia: 5550104}',
    ]);
    expect(asObject(maps.phone)).toEqual({ asha: 5550101, ben: 5550199, dia: 5550104 });
  });

  it('Collisions and Chaining: chain positions give the comparison counts', async () => {
    const { printed, maps, logs } = await run(HashMapScripts.CollisionsAndChaining);
    expect(printed.filter((l) => l.startsWith('Finding'))).toEqual([
      'Finding locker 5 takes 1 comparison(s)',
      'Finding locker 13 takes 2 comparison(s)',
      'Finding locker 2 takes 1 comparison(s)',
      'Finding locker 21 takes 3 comparison(s)',
      'Finding locker 10 takes 2 comparison(s)',
      'Finding locker 29 takes 4 comparison(s)',
    ]);
    expect(printed).toContain('Locker 29 belongs to Farah');
    // the animated lookup agrees with the FUNCTION's count
    expect(logs).toContain('Looked up 29: hash(29): 29 % 8 = 5 -> bucket 5; found after 4 key comparisons, value Farah');
    expect(maps.lockers.entries.filter(([k]) => hashOf(k, 8) === 5).map(([k]) => k)).toEqual([5, 13, 21, 29]);
  });

  it('Load Factor and Resizing: doubles at the 7th and 13th key', async () => {
    const { printed, maps, keywords } = await run(HashMapScripts.LoadFactorAndResize);
    expect(printed.filter((l) => l.includes('RESIZE'))).toEqual(['  RESIZE: 8 -> 16 buckets, every key rehashed', '  RESIZE: 16 -> 32 buckets, every key rehashed']);
    expect(printed).toContain('Stored 623: 6 keys / 8 buckets = load factor 0.75');
    expect(printed).toContain('Stored 707: 7 keys / 16 buckets = load factor 0.4375');
    expect(printed).toContain('Final: 13 keys in 32 buckets');
    expect(maps.roll.capacity).toBe(32);
    expect(maps.roll.entries).toHaveLength(13);
    expect(keywords.filter((k) => k === 'RESIZE')).toHaveLength(2);

    // A key whose bucket changes when the capacity doubles
    const moved = await run(withArray(HashMapScripts.LoadFactorAndResize, 'ids', [13, 1, 2, 3, 4, 5, 6, 7]));
    expect(moved.printed).toContain('  key 13 moved from bucket 5 to bucket 13');
  });

  it('Shopping Cart Totals: quantities merged, bill totalled over KEY_AT', async () => {
    const { printed, maps } = await run(HashMapScripts.ShoppingCartTotals);
    expect(asObject(maps.cart)).toEqual({ apple: 10, milk: 2, rice: 3, bread: 1, eggs: 2 });
    expect(printed).toContain('Subtotal: 1000');
    expect(printed).toContain('Most spent on: rice (360)');
    expect(printed).toContain('10% off for orders of 1000 or more: -100');
    expect(printed).toContain('Total to pay: 900');
    expect(printed.filter((l) => / x \d+ = /.test(l))).toHaveLength(5);
  });

  it('Open Addressing by Hand: linear probing places and finds every key', async () => {
    const { printed, arrays } = await run(HashMapScripts.OpenAddressingByHand);
    expect(arrays.keys).toEqual([700, 50, 85, 92, 73, 101, 76]);
    expect(printed).toContain('85 % 7 = 1: taken, probed forward to slot 2');
    expect(printed).toContain('Search 101: found in slot 5 with value 7');
    expect(printed).toContain('Search 85: found in slot 2 with value 4');
    expect(printed).toContain('Search 64: not in the table');

    // Reference: the same probing in TypeScript, on other keys
    for (const incoming of [[10, 17, 24, 3], [6, 13, 20, 27, 34], [0, 7, 14, 21, 28, 35, 42]]) {
      const table = Array(7).fill(-1);
      for (const key of incoming) {
        let slot = key % 7;
        while (table[slot] !== -1 && table[slot] !== key) slot = (slot + 1) % 7;
        table[slot] = key;
      }
      const result = await run(withArray(HashMapScripts.OpenAddressingByHand, 'incoming', incoming));
      expect(result.arrays.keys, incoming.join(',')).toEqual(table);
    }
  });

  it('Word Frequency Counter: splits the sentence and counts every word', async () => {
    const { printed, maps } = await run(HashMapScripts.WordFrequencyCounter);
    expect(asObject(maps.freq)).toEqual({ the: 3, cat: 2, sat: 1, on: 1, mat: 1, and: 1, ran: 1 });
    expect(printed).toContain('7 different words');
    expect(printed).toContain('Most frequent: the (3 times)');

    for (const sentence of ['to be or not to be', 'one', 'a b a c b a', 'repeat repeat repeat']) {
      const result = await run(withValue(HashMapScripts.WordFrequencyCounter, 'sentence', sentence));
      const counts = countOf(sentence.split(' '));
      expect(asObject(result.maps.freq), sentence).toEqual(Object.fromEntries(counts));
      expect(result.printed).toContain(`${counts.size} different words`);
      const best = Math.max(...counts.values());
      expect(result.printed.find((l) => l.startsWith('Most frequent'))).toMatch(new RegExp(`\\(${best} times\\)$`));
    }
  });

  it('First Non-Repeating Character', async () => {
    const { printed } = await run(HashMapScripts.FirstUniqueCharacter);
    expect(printed).toContain('First character that appears only once: w at position 1');

    for (const text of ['aabbc', 'abcabc', 'leetcode', 'loveleetcode', 'z', 'aa bb cd']) {
      const result = await run(withValue(HashMapScripts.FirstUniqueCharacter, 'text', text));
      const at = firstUniqueRef(text);
      expect(result.printed.at(-1), text).toBe(
        at === -1 ? 'Every character repeats' : `First character that appears only once: ${text[at]} at position ${at}`
      );
    }
  });

  it('Valid Anagram', async () => {
    const { printed } = await run(HashMapScripts.ValidAnagram);
    expect(printed).toEqual([
      'listen / silent: anagrams',
      'triangle / integral: anagrams',
      'rat / car: not anagrams, letters left over: {a: 0, r: 0, c: -1, t: 1}',
      'aab / abb: not anagrams, letters left over: {a: 1, b: -1}',
    ]);

    const first = ['evil', 'abc', 'night', 'aabb', 'ab', 'x'];
    const second = ['vile', 'abd', 'thing', 'abab', 'abc', 'x'];
    let source = withArray(HashMapScripts.ValidAnagram, 'firstWords', first);
    source = withArray(source, 'secondWords', second);
    const result = await run(source);
    expect(result.printed.map((l) => l.includes(': anagrams'))).toEqual(first.map((a, i) => isAnagramRef(a, second[i])));
  });

  it('Two Sum', async () => {
    const { printed } = await run(HashMapScripts.TwoSum);
    expect(printed.at(-1)).toBe('nums[4] + nums[5] = 15 + 7 = 22');

    const cases: [number[], number][] = [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6], [[1, 2, 3], 100], [[5, -2, 8, 1], 6], [[0, 4, 3, 0], 0]];
    for (const [nums, target] of cases) {
      const result = await run(withValue(withArray(HashMapScripts.TwoSum, 'nums', nums), 'target', target));
      const ref = twoSumRef(nums, target);
      expect(result.printed.at(-1), `${nums} / ${target}`).toBe(
        ref ? `nums[${ref[0]}] + nums[${ref[1]}] = ${nums[ref[0]]} + ${nums[ref[1]]} = ${target}` : `No two numbers add up to ${target}`
      );
    }
  });

  it('First Reused Ticket', async () => {
    const { printed, maps } = await run(HashMapScripts.FirstDuplicate);
    expect(printed.at(-2)).toBe('Ticket 1093 scanned again at position 4 (first at position 1)');
    expect(printed.at(-1)).toBe('Stopped at the first reused ticket: 1093');
    expect(maps.firstSeen.entries).toHaveLength(4);

    for (const tickets of [[1, 2, 3], [7, 7], [5, 1, 2, 1, 5], [9, 8, 7, 6, 5, 4, 3, 2, 1, 9]]) {
      const result = await run(withArray(HashMapScripts.FirstDuplicate, 'tickets', tickets));
      const dup = tickets.find((t, i) => tickets.indexOf(t) < i);
      expect(result.printed.at(-1), tickets.join(',')).toBe(dup === undefined ? 'Every ticket is different' : `Stopped at the first reused ticket: ${dup}`);
    }
  });

  it('Longest Consecutive Run', async () => {
    const { printed, maps } = await run(HashMapScripts.LongestConsecutiveRun);
    expect(printed.at(-1)).toBe('Longest run: 1 to 5, length 5');
    expect(maps.present.capacity).toBe(16);

    for (const nums of [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1], [10], [5, 4, 3, 2, 1], [1, 3, 5, 7], [-2, -1, 0, 9]]) {
      const result = await run(withArray(HashMapScripts.LongestConsecutiveRun, 'nums', nums));
      const [start, len] = longestRunRef(nums);
      expect(result.printed.at(-1), nums.join(',')).toBe(`Longest run: ${start} to ${start + len - 1}, length ${len}`);
    }
  });

  it('Subarrays That Add Up to K', async () => {
    const { printed } = await run(HashMapScripts.SubarraySumEqualsK);
    expect(printed.at(-1)).toBe('Subarrays adding up to 7: 4');

    const cases: [number[], number][] = [[[1, 1, 1], 2], [[1, 2, 3], 3], [[1, -1, 0], 0], [[0, 0, 0], 0], [[5], 5], [[2, 4, -2, 2, 4], 4]];
    for (const [nums, k] of cases) {
      const result = await run(withValue(withArray(HashMapScripts.SubarraySumEqualsK, 'nums', nums), 'k', k));
      expect(result.printed.at(-1), `${nums} / ${k}`).toBe(`Subarrays adding up to ${k}: ${subarraySumRef(nums, k)}`);
    }
  });

  it('Longest Substring Without Repeats', async () => {
    const { printed } = await run(HashMapScripts.LongestSubstringWithoutRepeats);
    expect(printed.at(-1)).toBe('Longest part with no repeated letter: eksforg (7 letters, from position 2)');

    for (const text of ['abcabcbb', 'bbbbb', 'pwwkew', 'a', 'abba', 'dvdf']) {
      const result = await run(withValue(HashMapScripts.LongestSubstringWithoutRepeats, 'text', text));
      const best = longestSubstringRef(text);
      expect(result.printed.at(-1), text).toBe(
        `Longest part with no repeated letter: ${best} (${best.length} letters, from position ${text.indexOf(best)})`
      );
    }
  });

  it('Election Tally: winner and tie', async () => {
    const { printed, maps } = await run(HashMapScripts.ElectionTally);
    expect(asObject(maps.votes)).toEqual({ Asha: 3, Ben: 4, Chen: 2, Dia: 1 });
    expect(printed.at(-1)).toBe('Winner: Ben with 4 of 10 votes');

    const tie = await run(withArray(HashMapScripts.ElectionTally, 'ballots', ['Asha', 'Ben', 'Ben', 'Asha', 'Chen']));
    expect(tie.printed.at(-1)).toBe('A tie: 2 candidates have 2 votes');
    const single = await run(withArray(HashMapScripts.ElectionTally, 'ballots', ['Dia']));
    expect(single.printed.at(-1)).toBe('Winner: Dia with 1 of 1 votes');
  });

  it('Ransom Note: runs out of t; a note that fits is accepted', async () => {
    const { printed, maps } = await run(HashMapScripts.RansomNote);
    expect(printed).toContain('The magazine has 26 different letters');
    expect(printed).toContain('Ran out of t at position 8 of the note');
    expect(printed.at(-1)).toBe('The note cannot be made from the magazine');
    expect(asObject(maps.letters).t).toBe(0);

    const ok = await run(withValue(HashMapScripts.RansomNote, 'note', 'the dog'));
    expect(ok.printed.at(-1)).toBe('The note can be made from the magazine');
    const missing = await run(withValue(HashMapScripts.RansomNote, 'magazine', 'abc'));
    expect(missing.printed).toContain('The magazine has no t at all');
  });

  it('Memoized Fibonacci: each fib(n) computed once', async () => {
    const { printed, maps, engine } = await run(HashMapScripts.MemoizedFibonacci);
    expect(printed[0]).toBe('fib(12) = 144');
    expect(printed).toContain('Values remembered: 13');
    const fib = [0, 1];
    for (let n = 2; n <= 12; n++) fib.push(fib[n - 1] + fib[n - 2]);
    expect(printed.filter((l) => /^fib\(\d+\) = /.test(l)).slice(1)).toEqual(fib.map((v, n) => `fib(${n}) = ${v}`));
    expect(printed.at(-1)).toBe('fib(12) again = 144, still 13 values remembered');
    expect(Object.fromEntries(maps.memo.entries.map(([k, v]) => [k, v]))).toEqual(Object.fromEntries(fib.map((v, n) => [n, v])));
    expect(engine).toBeDefined();
  });
});

// ─── The engine ───────────────────────────────────────────────────────────────

describe('A HASH_MAP driven by real code', () => {
  it('stores, overwrites, reads, counts and prints', async () => {
    const { printed, maps } = await run(
      program('  HASH_MAP m = {a: 1}', '  m["b"] = 2\n  m["a"] = m["a"] + 10\n  PRINT m["a"] + m["b"]\n  PRINT LENGTH(m)\n  PRINT m')
    );
    expect(printed).toEqual(['13', '2', `{${[['a', 11], ['b', 2]].sort((x, y) => hashOf(x[0], 8) - hashOf(y[0], 8)).map(([k, v]) => `${k}: ${v}`).join(', ')}}`]);
    expect(asObject(maps.m)).toEqual({ a: 11, b: 2 });
  });

  it('keeps key types: 7 and "7" are different keys in the same bucket', async () => {
    const { printed, maps } = await run(program('  HASH_MAP m', '  m[7] = "number"\n  m["7"] = "text"\n  PRINT m[7] + " " + m["7"] + " " + LENGTH(m)'));
    expect(printed).toEqual(['number text 2']);
    expect(maps.m.entries.map(([k]) => typeof k).sort()).toEqual(['number', 'string']);
  });

  it('integer keys hash as key % capacity, text keys by character codes', async () => {
    const { printed } = await run(program('  HASH_MAP m', '  PRINT BUCKET_OF(m, 21) + " " + BUCKET_OF(m, "cat") + " " + BUCKET_OF(m, -3) + " " + CAPACITY(m)'));
    expect(printed).toEqual([`5 ${hashOf('cat', 8)} 5 8`]);
  });

  it('resizes on the 7th key and rehashes every key', async () => {
    const lines = [...Array(7).keys()].map((i) => `  m[${i * 8}] = ${i}`).join('\n');
    const { maps, logs } = await run(program('  HASH_MAP m', `${lines}\n  PRINT CAPACITY(m)`));
    expect(maps.m.capacity).toBe(16);
    expect(logs).toContain('16');
    expect(logs).toContain('Adding a key would make the load factor 7/8 = 0.875, above 0.75: doubling to 16 buckets and rehashing every key');
  });

  it('DELETE unlinks the key and the rest of its chain moves up', async () => {
    const { maps, printed } = await run(
      program('  HASH_MAP m', '  m[1] = "a"\n  m[9] = "b"\n  m[17] = "c"\n  DELETE m[9]\n  PRINT CONTAINS(m, 9)\n  PRINT m[17]\n  DELETE m["x" + ""]')
        .replace('  DELETE m["x" + ""]\n', '')
    );
    expect(printed).toEqual(['FALSE', 'c']);
    expect(maps.m.entries).toEqual([[1, 'a'], [17, 'c']]);
  });

  it('DELETE with a text literal key (the optimizer used to turn it into NaN)', async () => {
    const { maps } = await run(program('  HASH_MAP m = {bob: 1, amy: 2}', '  DELETE m["bob"]'));
    expect(asObject(maps.m)).toEqual({ amy: 2 });
  });

  it('KEY_AT walks every key bucket by bucket', async () => {
    const { printed } = await run(
      program('  HASH_MAP m = {x: 1, y: 2, z: 3}', '  keys = ""\n  k = 0\n  WHILE k < LENGTH(m)\n    keys = keys + KEY_AT(m, k)\n    k = k + 1\n  END\n  PRINT keys')
    );
    expect(printed).toEqual([['x', 'y', 'z'].sort((a, b) => hashOf(a, 8) - hashOf(b, 8)).join('')]);
  });

  it('HIGHLIGHT marks the entry and keeps the mark', async () => {
    const { engine, logs } = await run(program('  HASH_MAP m = {a: 1}', "  HIGHLIGHT m[\"a\"] 'SUCCESS'\n  m[\"b\"] = 2"));
    const entry = (engine.sceneManager.getSceneGraph() as any[]).find((el) => el.originalType === 'HASHMAP_ENTRY' && el.key === 'a');
    expect(entry.state).toBe('SUCCESS');
    expect(logs).toContain('Marked m["a"] = 1 as SUCCESS');
  });

  it('animates a lookup for reads in conditions and assignments, not in PRINT', async () => {
    const { keywords } = await run(program('  HASH_MAP m = {a: 1}', '  IF CONTAINS(m, "a")\n    x = m["a"]\n  END\n  PRINT m["a"]'));
    expect(keywords.filter((k) => k === 'LOOKUP')).toHaveLength(2);
  });

  it('AND short-circuits: a missing key on the right is never read', async () => {
    const { printed, keywords } = await run(program('  HASH_MAP m', '  IF CONTAINS(m, "k") AND m["k"] > 0\n    PRINT "yes"\n  ELSE\n    PRINT "no"\n  END'));
    expect(printed).toEqual(['no']);
    expect(keywords.filter((k) => k === 'LOOKUP')).toHaveLength(1);
  });

  it('maps are shared with FUNCTIONs', async () => {
    const { printed } = await run(program('  HASH_MAP m\n\n  FUNCTION add(key)\n    m[key] = TEXT_LENGTH(key)\n  END', '  add("tree")\n  add("hi")\n  PRINT m["tree"] + m["hi"]'));
    expect(printed).toEqual(['6']);
  });

  it('text built-ins', async () => {
    const { printed } = await run(program('', '  w = "hello"\n  PRINT TEXT_LENGTH(w) + " " + CHAR_AT(w, 4) + " " + CHAR_CODE(w, 0) + " " + CHAR_AT(407, 0)'));
    expect(printed).toEqual(['5 o 104 4']);
  });
});

describe('Hash map errors stop the program with a clear message', () => {
  it('reading a missing key', async () => {
    expect(await runError(program('  HASH_MAP m', '  x = m["mango"]'))).toMatch(/the key "mango" is not in hash map 'm'\. Check CONTAINS\(m, "mango"\) first/);
  });
  it('deleting a missing key', async () => {
    expect(await runError(program('  HASH_MAP m', '  DELETE m[5]'))).toMatch(/Cannot DELETE m\[5\]: the key 5 is not in hash map 'm'/);
  });
  it('KEY_AT out of range, and on an empty map', async () => {
    expect(await runError(program('  HASH_MAP m = {a: 1}', '  x = KEY_AT(m, 1)'))).toMatch(/index 1 is out of range for hash map 'm' \(valid indices are 0 to 0/);
    expect(await runError(program('  HASH_MAP m', '  x = KEY_AT(m, 0)'))).toMatch(/hash map 'm' is empty/);
  });
  it('a key that is not a number or text', async () => {
    expect(await runError(program('  HASH_MAP m', '  m[TRUE] = 1'))).toMatch(/must be a number or text, not TRUE/);
  });
  it('SWAP / COMPARE on hash map values', async () => {
    expect(await runError(program('  HASH_MAP m = {a: 1, b: 2}', '  SWAP m["a"] m["b"]'))).toMatch(/is a hash map value, not an array cell/);
  });
  it('CONTAINS on something that is not a hash map', async () => {
    expect(await runError(program('  ARRAY a = [1]', '  x = CONTAINS(a, 1)'))).toMatch(/CONTAINS needs a declared HASH_MAP as its first argument/);
  });
  it('an array-style statement on a map', async () => {
    expect(await runError(program('  HASH_MAP m', '  PUSH m 3'))).toMatch(/PUSH m is not a hash map statement/);
  });
  it('CHAR_AT out of range', async () => {
    expect(await runError(program('', '  x = CHAR_AT("cat", 3)'))).toMatch(/position 3 is out of range \(valid positions are 0 to 2\)/);
  });
});

describe('Hash Maps library, registry and docs', () => {
  const hashMapExamples = EXAMPLES.filter((e) => e.category === 'Hash Maps');

  it('lists all 17 examples, each written as real code', () => {
    expect(hashMapExamples).toHaveLength(17);
    expect(new Set(hashMapExamples.map((e) => e.source))).toEqual(new Set(Object.values(HashMapScripts)));
    expect(new Set(hashMapExamples.map((e) => e.id)).size).toBe(17);
    for (const example of hashMapExamples) {
      expect(example.source, example.id).not.toMatch(/\bHASHMAP_(INSERT|LOOKUP|DELETE)\b/);
      expect(example.source, example.id).toMatch(/\b(WHILE|LOOP)\b/);
      expect(example.source, example.id).toMatch(/\bIF\b/);
    }
  });

  it('every example runs without an error', async () => {
    for (const example of hashMapExamples) {
      await expect(run(example.source), example.id).resolves.toBeDefined();
    }
  });

  it("the Docs page's hash map programs run and print what the page says", async () => {
    const docs = readFileSync(resolve(__dirname, '../../packages/demo/src/pages/Docs.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const docProgram = (sceneName: string) => {
      const match = docs.match(new RegExp('code=\\{`(SCENE ' + sceneName + '\\n[\\s\\S]*?)`\\}'));
      expect(match, sceneName).not.toBeNull();
      return match![1];
    };
    const intro = await run(docProgram('HashMapIntro'));
    expect(intro.printed.slice(0, 3)).toEqual(['Apples: 6', 'No mangoes', 'Items: 3']);
    expect(intro.printed[3]).toMatch(/^Stock: \{.*apple: 6.*\}$/);
    const words = await run(docProgram('WordCount'));
    expect(words.printed).toEqual(['the: 3', 'cat: 2', 'Different words: 5']);
    const twoSum = await run(docProgram('TwoSum'));
    expect(twoSum.printed).toEqual(['Indices 4 and 5']);
    const byHand = await run(docProgram('HashByHand'));
    expect(byHand.printed).toEqual(['cat -> bucket 0', 'dog -> bucket 2', 'act -> bucket 0']);
    expect(byHand.maps.m.entries.map(([k]) => k)).toEqual(['cat', 'act', 'dog']);
  });
});

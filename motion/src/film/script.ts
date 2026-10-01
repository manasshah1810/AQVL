// The four hero programs: real .aqvl from the repo's example library
// (BuildHeapBottomUp, MergeSort, DijkstraDeliveryRoute, the STACK-based
// recursion pattern), abridged. Every 3D event fires with its source line;
// the editor panel and scrubber read the same events.
import {T} from './timeline';

export type Ev = {t: number; line: number; kind: string; a?: number; b?: number; v?: number};
export type Hero = {id: string; file: string; t0: number; t1: number; code: string[]; events: Ev[]};

// ---------------- 1. MinHeap: Floyd's bottom-up build ----------------------
export const HEAP_VALUES = [9, 4, 7, 1, 8, 2, 6, 3, 5];
const h0 = T.h1;
export const heap: Hero = {
  id: 'heap',
  file: 'build_heap.aqvl',
  t0: h0,
  t1: T.h2,
  code: [
    'SCENE BuildHeapBottomUp',
    'DECLARE',
    '  HEAP h = [9, 4, 7, 1, 8, 2, 6, 3, 5]',
    'SEQUENCE',
    '  i = lastParent',
    '  WHILE i >= 0',
    "    HIGHLIGHT h[i] 'MARKED'",
    '    swaps = swaps + siftDown(i)',
    '    i = i - 1',
    '  END',
    "  HIGHLIGHT h[0] 'SUCCESS'",
    'END',
  ],
  events: [
    {t: h0 + 0.0, line: 3, kind: 'enter'},
    {t: h0 + 1.05, line: 5, kind: 'morph'},
    {t: h0 + 1.85, line: 7, kind: 'mark', a: 3},
    {t: h0 + 2.05, line: 8, kind: 'compare', a: 7, b: 8},
    {t: h0 + 2.35, line: 7, kind: 'mark', a: 2},
    {t: h0 + 2.5, line: 8, kind: 'swap', a: 2, b: 5},
    {t: h0 + 2.85, line: 7, kind: 'mark', a: 1},
    {t: h0 + 3.0, line: 8, kind: 'swap', a: 1, b: 3},
    {t: h0 + 3.3, line: 8, kind: 'swap', a: 3, b: 7},
    {t: h0 + 3.6, line: 7, kind: 'mark', a: 0},
    {t: h0 + 3.75, line: 8, kind: 'swap', a: 0, b: 1},
    {t: h0 + 4.05, line: 8, kind: 'swap', a: 1, b: 3},
    {t: h0 + 4.35, line: 8, kind: 'swap', a: 3, b: 7},
    {t: h0 + 4.75, line: 11, kind: 'success', a: 0},
    {t: h0 + 5.3, line: 12, kind: 'exit'},
  ],
};

// ---------------- 2. MergeSort --------------------------------------------
export const MERGE_VALUES = [38, 27, 43, 3, 9, 82, 10];
const m0 = T.h2;
const mergeEvents: Ev[] = [
  {t: m0 + 0.0, line: 1, kind: 'enter'},
  {t: m0 + 0.7, line: 6, kind: 'split', v: 1},
  {t: m0 + 1.05, line: 6, kind: 'split', v: 2},
  {t: m0 + 1.4, line: 7, kind: 'split', v: 3},
];
// placements (bottom-up merges), each is COMPARE then INSERT
const placements: {level: number; t: number}[] = [];
[
  [3, m0 + 1.85, 0.1],
  [2, m0 + 2.65, 0.11],
  [1, m0 + 3.55, 0.12],
].forEach(([lvl, start, step]) => {
  for (let k = 0; k < 7; k++) placements.push({level: lvl - 1, t: start + k * step});
});
placements.forEach((p, k) => {
  mergeEvents.push({t: p.t - 0.03, line: 12, kind: 'compare', v: p.level, a: k % 7});
  mergeEvents.push({t: p.t, line: 13, kind: 'place', v: p.level, a: k % 7});
});
mergeEvents.push({t: m0 + 4.55, line: 15, kind: 'success'});
mergeEvents.push({t: m0 + 5.05, line: 16, kind: 'exit'});
export const merge: Hero = {
  id: 'merge',
  file: 'merge_sort.aqvl',
  t0: m0,
  t1: T.h3,
  code: [
    'ARRAY arr = [38, 27, 43, 3, 9, 82, 10]',
    'FUNCTION mergeSort(low, high)',
    '  IF low < high',
    '    total = low + high',
    '    mid = (total - total % 2) / 2',
    '    mergeSort(low, mid)',
    '    mergeSort(mid + 1, high)',
    '    merge(low, mid, high)',
    '  END',
    'END',
    'FUNCTION merge(low, mid, high)',
    '  COMPARE arr[i] arr[j]',
    '  INSERT temp[k] arr[i]',
    '  UPDATE arr[low + t] temp[t]',
    "  HIGHLIGHT arr[low + t] 'WINDOW'",
    'END',
  ],
  events: mergeEvents.sort((a, b) => a.t - b.t),
};

// ---------------- 3. Dijkstra ----------------------------------------------
export const DJ_NODES = ['Shop', 'Park', 'Mkt', 'Bank', 'Gym', 'Home'];
export const DJ_EDGES: [number, number, number][] = [
  [0, 2, 4],
  [0, 1, 1],
  [1, 2, 2],
  [2, 3, 5],
  [1, 4, 8],
  [3, 4, 3],
  [3, 5, 6],
  [4, 5, 2],
];
const d0 = T.h3;
export const dijkstra: Hero = {
  id: 'dijkstra',
  file: 'dijkstra.aqvl',
  t0: d0,
  t1: T.h4,
  code: [
    'GRAPH town = ["Shop-Mkt:4", "Shop-Park:1", ...]',
    'SEQUENCE',
    '  source.dist = 0',
    '  WHILE finished == FALSE',
    '    u.visited = TRUE',
    '    WHILE i < DEGREE(u)',
    '      v = NEIGHBOR(u, i)',
    '      candidate = u.dist + WEIGHT(u, v)',
    '      IF candidate < v.dist',
    '        v.dist = candidate',
    '        v.parent = u',
    '      END',
    '    END',
    '  END',
    '  PUSH route curr',
    'END',
  ],
  events: [
    {t: d0 + 0.0, line: 1, kind: 'enter'},
    {t: d0 + 1.0, line: 3, kind: 'source', a: 0, v: 0},
    {t: d0 + 1.2, line: 5, kind: 'visit', a: 0},
    {t: d0 + 1.3, line: 8, kind: 'relax', a: 0, b: 2, v: 4},
    {t: d0 + 1.42, line: 10, kind: 'relax', a: 0, b: 1, v: 1},
    {t: d0 + 1.95, line: 5, kind: 'visit', a: 1},
    {t: d0 + 2.05, line: 10, kind: 'relax', a: 1, b: 2, v: 3},
    {t: d0 + 2.17, line: 10, kind: 'relax', a: 1, b: 4, v: 9},
    {t: d0 + 2.65, line: 5, kind: 'visit', a: 2},
    {t: d0 + 2.75, line: 10, kind: 'relax', a: 2, b: 3, v: 8},
    {t: d0 + 3.2, line: 5, kind: 'visit', a: 3},
    {t: d0 + 3.3, line: 9, kind: 'reject', a: 3, b: 4},
    {t: d0 + 3.42, line: 10, kind: 'relax', a: 3, b: 5, v: 14},
    {t: d0 + 3.8, line: 5, kind: 'visit', a: 4},
    {t: d0 + 3.9, line: 10, kind: 'relax', a: 4, b: 5, v: 11},
    {t: d0 + 4.35, line: 5, kind: 'visit', a: 5},
    {t: d0 + 4.6, line: 15, kind: 'path', a: 5, b: 4},
    {t: d0 + 4.75, line: 15, kind: 'path', a: 4, b: 1},
    {t: d0 + 4.9, line: 15, kind: 'path', a: 1, b: 0},
    {t: d0 + 5.1, line: 16, kind: 'exit', a: 5},
  ],
};

// ---------------- 4. Fibonacci call stack ----------------------------------
// fib(4) with an explicit STACK of waiting calls, as in the repo's
// recursion examples. Calls are numbered in the order they start.
export type Call = {id: number; n: number; parent: number; depth: number; push: number; pop: number; ret: number};
const f0 = T.h4;
const calls: Call[] = [];
const fibEvents: Ev[] = [{t: f0, line: 13, kind: 'enter'}];
{
  let clock = f0 + 0.3;
  const step = 0.2;
  const run = (n: number, parent: number, depth: number): number => {
    const id = calls.length;
    const c: Call = {id, n, parent, depth, push: clock, pop: 0, ret: 0};
    calls.push(c);
    fibEvents.push({t: clock, line: 3, kind: 'push', a: id});
    clock += step;
    let value: number;
    if (n <= 1) value = n;
    else value = run(n - 1, id, depth + 1) + run(n - 2, id, depth + 1);
    c.pop = clock;
    c.ret = value;
    fibEvents.push({t: clock, line: n <= 1 ? 5 : 9, kind: 'pop', a: id, v: value});
    clock += step;
    return value;
  };
  run(4, -1, 0);
  fibEvents.push({t: clock + 0.15, line: 13, kind: 'success', a: 0});
  fibEvents.push({t: clock + 0.75, line: 14, kind: 'exit', a: 0});
}
export const FIB_CALLS = calls;
export const fib: Hero = {
  id: 'fib',
  file: 'fib_stack.aqvl',
  t0: f0,
  t1: T.tagline,
  code: [
    'STACK calls = []',
    'FUNCTION fib(n)',
    '  PUSH calls n',
    '  IF n <= 1',
    '    done = POP(calls)',
    '    RETURN n',
    '  END',
    '  value = fib(n - 1) + fib(n - 2)',
    '  done = POP(calls)',
    '  RETURN value',
    'END',
    'SEQUENCE',
    '  result = fib(4)',
    'END',
  ],
  events: fibEvents,
};

export const HEROES = [heap, merge, dijkstra, fib];

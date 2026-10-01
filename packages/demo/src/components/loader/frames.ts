/**
 * Deterministic frame tapes for the loader visualizations. Each generator
 * runs the real algorithm once on a fixed input and records a frame per
 * visible step, so what loops on screen is the algorithm, not a mimic.
 */

// ── Insertion sort ─────────────────────────────────────────────
export interface SortFrame {
  /** Bar ids in on-screen order. Bar id === its value. */
  order: number[];
  /** Positions being compared this step. */
  pair: [number, number] | null;
  /** Prefix [0, sorted) is known sorted. */
  sorted: number;
  caption: string;
}

export function insertionSortFrames(input = [5, 2, 8, 1, 6, 3, 7, 4]): SortFrame[] {
  const a = [...input];
  const frames: SortFrame[] = [{ order: [...a], pair: null, sorted: 1, caption: 'start' }];
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      frames.push({ order: [...a], pair: [j - 1, j], sorted: i, caption: `compare ${a[j - 1]} and ${a[j]}` });
      if (a[j - 1] <= a[j]) break;
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      frames.push({ order: [...a], pair: [j - 1, j], sorted: i, caption: `swap → ${a[j - 1]} before ${a[j]}` });
      j--;
    }
  }
  frames.push({ order: [...a], pair: null, sorted: a.length, caption: 'sorted' });
  return frames;
}

// ── Breadth-first search on a grid ─────────────────────────────
export interface GridFrame {
  /** distance per cell, -1 = unreached; walls are fixed. */
  dist: number[];
  /** Current frontier distance. */
  layer: number;
  caption: string;
}

export const GRID = { cols: 11, rows: 5 };
// '#' wall, 'S' start, '.' open
const GRID_MAP = [
  '.....#.....',
  '.###.#.###.',
  'S..#...#...',
  '.#.#.###.#.',
  '.#.......#.',
];

export const GRID_WALLS: boolean[] = GRID_MAP.join('').split('').map((c) => c === '#');

export function bfsFrames(): GridFrame[] {
  const { cols, rows } = GRID;
  const start = GRID_MAP.join('').indexOf('S');
  const dist = new Array(cols * rows).fill(-1);
  dist[start] = 0;
  let frontier = [start];
  let layer = 0;
  const frames: GridFrame[] = [{ dist: [...dist], layer: 0, caption: 'enqueue start' }];
  while (frontier.length) {
    const next: number[] = [];
    for (const cell of frontier) {
      const x = cell % cols;
      const y = Math.floor(cell / cols);
      const around = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of around) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = ny * cols + nx;
        if (GRID_WALLS[n] || dist[n] !== -1) continue;
        dist[n] = layer + 1;
        next.push(n);
      }
    }
    if (!next.length) break;
    layer++;
    frontier = next;
    frames.push({ dist: [...dist], layer, caption: `layer ${layer} · ${next.length} new` });
  }
  frames[frames.length - 1] = { ...frames[frames.length - 1], caption: `every open cell reached in ${layer} layers` };
  return frames;
}

// ── Binary search ──────────────────────────────────────────────
export interface SearchFrame {
  lo: number;
  hi: number;
  mid: number | null;
  found: boolean;
  caption: string;
}

export const SEARCH_VALUES = [2, 5, 8, 12, 16, 23, 38, 41, 56, 63, 72, 81, 90, 94, 99];
export const SEARCH_TARGET = 72;

export function binarySearchFrames(values = SEARCH_VALUES, target = SEARCH_TARGET): SearchFrame[] {
  let lo = 0;
  let hi = values.length - 1;
  const frames: SearchFrame[] = [{ lo, hi, mid: null, found: false, caption: `find ${target}` }];
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    frames.push({ lo, hi, mid, found: false, caption: `mid = ${values[mid]}` });
    if (values[mid] === target) {
      frames.push({ lo: mid, hi: mid, mid, found: true, caption: `found ${target} at index ${mid}` });
      break;
    }
    if (values[mid] < target) lo = mid + 1;
    else hi = mid - 1;
    frames.push({ lo, hi, mid: null, found: false, caption: values[mid] < target ? 'go right' : 'go left' });
  }
  return frames;
}

// ── Stack push / pop ───────────────────────────────────────────
export interface StackFrame {
  /** Item ids bottom → top. */
  items: { id: number; value: number }[];
  caption: string;
}

export function stackFrames(): StackFrame[] {
  const ops: (number | 'pop')[] = [4, 9, 2, 'pop', 7, 5, 'pop', 'pop', 3, 'pop', 'pop', 'pop'];
  let id = 0;
  const items: { id: number; value: number }[] = [];
  const frames: StackFrame[] = [{ items: [], caption: 'empty stack' }];
  for (const op of ops) {
    if (op === 'pop') {
      const top = items.pop();
      frames.push({ items: [...items], caption: `pop → ${top?.value}` });
    } else {
      items.push({ id: id++, value: op });
      frames.push({ items: [...items], caption: `push ${op}` });
    }
  }
  return frames;
}

// ── Dijkstra on a small weighted graph ─────────────────────────
export const DJ_NODES = [
  { id: 'A', x: 28, y: 62 },
  { id: 'B', x: 82, y: 22 },
  { id: 'C', x: 90, y: 98 },
  { id: 'D', x: 148, y: 52 },
  { id: 'E', x: 160, y: 104 },
  { id: 'F', x: 214, y: 66 },
];

export const DJ_EDGES: [string, string, number][] = [
  ['A', 'B', 4],
  ['A', 'C', 2],
  ['B', 'C', 1],
  ['B', 'D', 5],
  ['C', 'D', 8],
  ['C', 'E', 10],
  ['D', 'E', 2],
  ['D', 'F', 6],
  ['E', 'F', 3],
];

export interface DijkstraFrame {
  dist: Record<string, number>;
  settled: string[];
  current: string | null;
  /** Edge keys "A-B" in the current shortest-path tree. */
  tree: string[];
  caption: string;
}

export const edgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function dijkstraFrames(source = 'A'): DijkstraFrame[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of DJ_NODES) {
    dist[n.id] = Infinity;
    prev[n.id] = null;
  }
  dist[source] = 0;
  const settled: string[] = [];
  const tree = () =>
    Object.entries(prev)
      .filter(([, p]) => p)
      .map(([n, p]) => edgeKey(n, p as string));
  const frames: DijkstraFrame[] = [{ dist: { ...dist }, settled: [], current: null, tree: [], caption: `source ${source} = 0` }];
  while (settled.length < DJ_NODES.length) {
    let u: string | null = null;
    for (const n of DJ_NODES) {
      if (settled.includes(n.id)) continue;
      if (u === null || dist[n.id] < dist[u]) u = n.id;
    }
    if (u === null || dist[u] === Infinity) break;
    settled.push(u);
    frames.push({ dist: { ...dist }, settled: [...settled], current: u, tree: tree(), caption: `settle ${u} at ${dist[u]}` });
    let relaxed = 0;
    for (const [a, b, w] of DJ_EDGES) {
      const v = a === u ? b : b === u ? a : null;
      if (!v || settled.includes(v)) continue;
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
        relaxed++;
      }
    }
    if (relaxed) {
      frames.push({ dist: { ...dist }, settled: [...settled], current: u, tree: tree(), caption: `relax ${relaxed} edge${relaxed > 1 ? 's' : ''} from ${u}` });
    }
  }
  frames.push({ dist: { ...dist }, settled: [...settled], current: null, tree: tree(), caption: 'shortest-path tree' });
  return frames;
}

// ── Tower of Hanoi ─────────────────────────────────────────────
export interface HanoiFrame {
  /** pegs[p] = disk sizes bottom → top */
  pegs: number[][];
  caption: string;
}

export function hanoiFrames(n = 3): HanoiFrame[] {
  const pegs: number[][] = [[], [], []];
  for (let d = n; d >= 1; d--) pegs[0].push(d);
  const frames: HanoiFrame[] = [{ pegs: pegs.map((p) => [...p]), caption: `${n} disks · ${2 ** n - 1} moves` }];
  let move = 0;
  const solve = (k: number, from: number, to: number, via: number) => {
    if (k === 0) return;
    solve(k - 1, from, via, to);
    const disk = pegs[from].pop() as number;
    pegs[to].push(disk);
    move++;
    frames.push({ pegs: pegs.map((p) => [...p]), caption: `move ${move}: disk ${disk} → peg ${to + 1}` });
    solve(k - 1, via, to, from);
  };
  solve(n, 0, 2, 1);
  return frames;
}

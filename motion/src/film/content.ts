// Drawn content for the analog world: what is on each board, page and slide.
import {handArrow, handBox, hatch, Pt, resample, scribble, writeText} from './draw2d';
import {noise1} from '../lib/motion';

export type Stroke = {pts: Pt[]; t0: number; t1: number; w: number; color?: string; kind?: 'chalk' | 'ink' | 'marker'};

// Sequence strokes one after another between t0 and t1, weighted by length.
export const sequence = (lines: Pt[][], t0: number, t1: number, w: number, color?: string, gap = 0.15): Stroke[] => {
  const lens = lines.map((l) => {
    let s = 0;
    for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
    return Math.max(s, 1);
  });
  const total = lens.reduce((a, b) => a + b, 0);
  const span = (t1 - t0) * (1 - gap);
  const pause = ((t1 - t0) * gap) / Math.max(1, lines.length);
  let t = t0;
  return lines.map((pts, i) => {
    const d = (lens[i] / total) * span;
    const s: Stroke = {pts, t0: t, t1: t + d, w, color};
    t += d + pause;
    return s;
  });
};

export const progress = (s: Stroke, t: number) => (t <= s.t0 ? 0 : t >= s.t1 ? 1 : (t - s.t0) / (s.t1 - s.t0));

// ---------------------------------------------------------------------------
// BOARD (6144 x 1728): left = messy recursion tree; middle = the hook circle;
// right = dense chalk notes.
export const BOARD = {w: 7680, h: 1728};
export const HOOK_C: [number, number] = [1760, 900];
const BX = 1200; // tree region offset from the board's left edge

const tn = (label: string, x: number, y: number, seed: number, size = 70): Pt[][] => {
  const t = writeText(label, x - label.length * size * 0.36, y - size * 0.5, size, seed);
  return t;
};

// fib tree nodes on the board, pre-existing (static) mess
export const boardTree = (() => {
  const nodes: [string, number, number][] = [
    ['fib(4)', 1500, 260],
    ['fib(3)', 900, 560],
    ['fib(2)', 2150, 560],
    ['fib(2)', 560, 900],
    ['fib(1)', 1240, 900],
    ['fib(1)', 1860, 900],
    ['fib(0)', 2440, 900],
    ['fib(1)', 330, 1240],
    ['fib(0)', 780, 1240],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
    [3, 7],
    [3, 8],
  ];
  const lines: Pt[][] = [];
  nodes.forEach((n) => (n[1] += BX));
  nodes.forEach(([l, x, y], i) => lines.push(...tn(l, x, y, 100 + i)));
  edges.forEach(([a, b], i) => {
    const A = nodes[a];
    const B = nodes[b];
    lines.push(resample([[A[1], A[2] + 60], [B[1], B[2] - 70]], 10, 3, 200 + i));
  });
  // stray marks: arrows back up the tree, question marks, an erased ghost
  lines.push(...handArrow([1240 + BX, 980], [920 + BX, 640], 0.35, 301, 30)); // "return" arrow
  lines.push(...writeText('?', 1420 + BX, 1060, 110, 302));
  lines.push(...writeText('2+1=', 2300 + BX, 1180, 70, 303));
  return {nodes, lines};
})();

// The hook stroke: three violent loops around fib(2), then a hard slash out
// along a baseline. The logo resolves from exactly this stroke.
export const hookScribble = (): Pt[] => {
  const [cx, cy] = HOOK_C;
  const rx = 260;
  const ry = 170;
  const pts: Pt[] = [];
  const turns = 3;
  const n = 220;
  // counterclockwise on screen, ending at the bottom moving right
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = Math.PI / 2 - u * turns * Math.PI * 2 + Math.PI * 0.2 * (1 - u);
    const grow = 1 + 0.18 * Math.sin(u * 9) + 0.1 * noise1(u * 14, 3);
    pts.push([cx + Math.cos(a) * rx * grow + noise1(u * 30, 7) * 14, cy + Math.sin(a) * ry * grow + noise1(u * 30, 9) * 14]);
  }
  const [bx, by] = pts[pts.length - 1];
  for (let i = 1; i <= 40; i++) {
    const u = i / 40;
    pts.push([bx + u * 1250, by + u * 30 + noise1(u * 10, 11) * 10]);
  }
  return resample(pts, 6, 0, 5);
};

// Dense chalk notes on the right side of the board (static).
export const boardNotes = (() => {
  const lines: Pt[][] = [];
  const rows = [
    'fib(n) = fib(n-1) + fib(n-2)',
    'f(5) -> f(4) -> f(3) ->',
    'base: n = 0, n = 1',
    'calls = 2^n ?',
    'return -> ?? -> f(3)',
    'stack: f(2) f(3) f(4)',
  ];
  rows.forEach((r, i) => lines.push(...writeText(r, 3900 + (i % 2) * 60, 230 + i * 230, 92, 400 + i, 0.18)));
  lines.push(...handArrow([4000, 1600], [5500, 400], -0.25, 420, 50));
  lines.push(...handArrow([5300, 1550], [4100, 700], 0.3, 421, 50));
  return lines;
})();

// The fresh fib(5) tree drawn live in the "old way" montage (static positions,
// timed during the shot).
export const boardLive = (t0: number, t1: number): Stroke[] => {
  const lines: Pt[][] = [];
  const nodes: [string, number, number][] = [
    ['fib(5)', 6650, 760],
    ['fib(4)', 6150, 1040],
    ['fib(3)', 7150, 1040],
    ['fib(3)', 5900, 1330],
    ['fib(2)', 6420, 1330],
    ['fib(2)', 6920, 1330],
    ['fib(1)', 7380, 1330],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
  ];
  nodes.forEach(([l, x, y], i) => {
    lines.push(...tn(l, x, y, 500 + i, 64));
    const e = edges.find((e) => e[1] === i);
    if (e) {
      const A = nodes[e[0]];
      lines.push(resample([[A[1], A[2] + 40], [x, y - 50]], 10, 3, 520 + i));
    }
  });
  return sequence(lines, t0, t1, 15);
};

// ---------------------------------------------------------------------------
// NOTEBOOK pages (2048 x 2730)
export const PAGE = {w: 2048, h: 2730};
export const INK = '#231d30';

// A linked list drawn as boxes and pointer arrows.
export const listDiagram = (x: number, y: number, vals: string[], seed: number, scale = 1, wrongArrows = false) => {
  const lines: Pt[][] = [];
  const bw = 230 * scale;
  const bh = 120 * scale;
  const gap = 150 * scale;
  lines.push(...writeText('head', x - 40 * scale, y - 150 * scale, 60 * scale, seed));
  lines.push(...handArrow([x + 40 * scale, y - 70 * scale], [x + 60 * scale, y - 4], 0.1, seed + 1, 22 * scale));
  vals.forEach((v, i) => {
    const bx = x + i * (bw + gap);
    lines.push(...handBox(bx, y, bw, bh, seed + 10 + i));
    lines.push(resample([[bx + bw * 0.6, y + 4], [bx + bw * 0.6, y + bh - 4]], 8, 1.5, seed + 20 + i));
    lines.push(...writeText(v, bx + bw * 0.2, y + bh * 0.22, bh * 0.6, seed + 30 + i));
    const dot: Pt[] = [
      [bx + bw * 0.8, y + bh * 0.5],
      [bx + bw * 0.81, y + bh * 0.52],
    ];
    lines.push(dot);
    if (i < vals.length - 1) {
      if (wrongArrows && i % 2 === 1) {
        lines.push(...handArrow([bx + bw * 0.8, y + bh * 0.5], [bx - gap * 0.5, y + bh * 1.4], -0.6, seed + 40 + i, 22 * scale));
      } else {
        lines.push(...handArrow([bx + bw * 0.8, y + bh * 0.5], [bx + bw + gap - 6, y + bh * 0.5], wrongArrows ? 0.35 : 0.08, seed + 40 + i, 22 * scale));
      }
    } else {
      lines.push(...handArrow([bx + bw * 0.8, y + bh * 0.5], [bx + bw + gap * 0.9, y + bh * 0.5], 0.05, seed + 50, 22 * scale));
      lines.push(...writeText('NULL', bx + bw + gap, y + bh * 0.25, bh * 0.5, seed + 51));
    }
  });
  return lines;
};

// Notebook A: the hook page. Attempt one, crossed out; attempt two, crossed
// out harder; a question mark.
export const notebookA = (() => {
  const a1 = listDiagram(330, 520, ['7', '3', '9'], 600);
  const a2 = listDiagram(330, 1260, ['7', '3', '9'], 700, 1, true);
  const x1 = scribble(980, 600, 1250, 260, 610, 11);
  const x2 = hatch(260, 1150, 1500, 330, 710, 9);
  const x2b = scribble(1000, 1330, 1200, 220, 711, 13);
  const q = writeText('?', 1500, 1850, 420, 720, 0.1);
  return {a1, a2, x1, x2, x2b, q};
})();

// The clean redraw for the "oh, it's easy" payoff: reversed list, perfectly.
export const notebookClean = listDiagram(330, 1980, ['9', '3', '7'], 800, 1);

// Notebook B: tangle page (old way + wall + break)
export const notebookB = (() => {
  const base = listDiagram(300, 420, ['4', '8', '1', '6'], 900, 0.85);
  const tangles: Pt[][] = [];
  const pts: Pt[] = [
    [420, 600],
    [1500, 1500],
    [700, 1350],
    [1700, 520],
    [300, 1900],
    [1600, 2200],
    [900, 2500],
    [1850, 1150],
    [500, 1100],
    [1300, 820],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    tangles.push(...handArrow(pts[i], pts[i + 1], i % 2 ? 0.5 : -0.45, 950 + i, 34));
  }
  const qs: Pt[][] = [];
  [
    [1650, 1750, 240],
    [380, 2250, 180],
    [1200, 1100, 150],
    [1750, 2450, 200],
    [700, 1650, 130],
  ].forEach(([x, y, s], i) => qs.push(...writeText('?', x, y, s, 990 + i)));
  // copied code, half legible
  const code: Pt[][] = [];
  ['prev = NULL', 'curr = head', 'next = curr.next', 'curr.next = prev', 'prev = curr ?', 'curr = next ??'].forEach((l, i) =>
    code.push(...writeText(l, 260, 900 + i * 120, 62, 1000 + i, 0.15)),
  );
  return {base, tangles, qs, code};
})();

// ---------------------------------------------------------------------------
// PROJECTOR transparency (1600 x 1200): marker binary tree
export const SLIDE = {w: 1600, h: 1200};
export const transparency = (() => {
  const lines: Pt[][] = [];
  const nodes: [string, number, number][] = [
    ['8', 800, 200],
    ['3', 480, 470],
    ['10', 1120, 470],
    ['1', 300, 760],
    ['6', 640, 760],
    ['14', 1300, 760],
    ['4', 540, 1030],
    ['7', 780, 1030],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [4, 6],
    [4, 7],
  ];
  nodes.forEach(([l, x, y], i) => {
    const c: Pt[] = [];
    for (let k = 0; k <= 26; k++) {
      const a = (k / 26) * Math.PI * 2.08;
      c.push([x + Math.cos(a) * 80 + noise1(k, i) * 4, y + Math.sin(a) * 80 + noise1(k + 9, i) * 4]);
    }
    lines.push(c);
    lines.push(...writeText(l, x - l.length * 24, y - 34, 70, 1100 + i, 0.05));
  });
  edges.forEach(([a, b], i) => {
    const A = nodes[a];
    const B = nodes[b];
    const dx = B[1] - A[1];
    const dy = B[2] - A[2];
    const L = Math.hypot(dx, dy);
    lines.push(resample([[A[1] + (dx / L) * 85, A[2] + (dy / L) * 85], [B[1] - (dx / L) * 85, B[2] - (dy / L) * 85]], 10, 2, 1150 + i));
  });
  const live = handArrow([1450, 1080], [700, 820], 0.3, 1170, 40);
  return {lines, live};
})();

// ---------------------------------------------------------------------------
// WHITEBOARD (2400 x 1350): array with i / j pointers and swap arrows
export const WB = {w: 2400, h: 1350};
export const whiteboard = (() => {
  const lines: Pt[][] = [];
  const vals = ['5', '1', '4', '2', '8'];
  vals.forEach((v, i) => {
    lines.push(...handBox(300 + i * 360, 520, 300, 260, 1200 + i));
    lines.push(...writeText(v, 300 + i * 360 + 100, 560, 170, 1210 + i, 0.05));
  });
  lines.push(...writeText('i', 520, 960, 120, 1220));
  lines.push(...handArrow([540, 940], [450, 810], 0.05, 1221, 30));
  lines.push(...writeText('j', 890, 960, 120, 1222));
  lines.push(...handArrow([900, 940], [810, 810], 0.05, 1223, 30));
  const ghosts: Pt[][] = [];
  ghosts.push(...writeText('swap?', 1400, 1000, 110, 1230));
  ghosts.push(...handArrow([300, 300], [1500, 330], -0.2, 1231, 40));
  const swap1 = handArrow([450, 500], [810, 500], -0.5, 1240, 36);
  const swap2 = handArrow([810, 820], [450, 820], -0.5, 1241, 36);
  const swap3 = handArrow([1170, 480], [1530, 480], -0.6, 1242, 36);
  return {lines, ghosts, swap1, swap2, swap3};
})();

// ---------------------------------------------------------------------------
// HANDOUT and SLIDE code (printed, monospace)
export const handoutText = [
  'Algorithm 4.2  Reverse a singly linked list in place.',
  'Input: a pointer head to the first node of a list L.',
  'Maintain three pointers prev, curr and next. At each',
  'step, save curr.next in next, then redirect curr.next',
  'to prev, advance prev to curr and curr to next. The',
  'loop invariant states that the nodes before curr form',
  'a reversed list headed by prev, while the nodes from',
  'curr onward remain in their original order. When curr',
  'becomes NULL, prev points to the new head of L. Since',
  'each node is visited once, the running time is O(n)',
  'and the extra space is O(1). Exercise: prove that the',
  'invariant holds at the start of every iteration, and',
  'that the recursive formulation below uses O(n) stack.',
  '  REVERSE(node): if node = NIL or node.next = NIL',
  '      return node; rest <- REVERSE(node.next);',
  '      node.next.next <- node; node.next <- NIL;',
  'Lemma 4.3. For a heap of n keys, BUILD-HEAP performs',
  'at most 2n comparisons. Proof. Sum over heights h of',
  'ceil(n / 2^(h+1)) * O(h) = O(n). Apply SIFT-DOWN to',
  'every internal node from floor(n/2) down to 1 ...',
];

export const wallCode = [
  'struct node *reverse(struct node *head) {',
  '    struct node *prev = NULL, *curr = head;',
  '    while (curr != NULL) {',
  '        struct node *next = curr->next;',
  '        curr->next = prev;',
  '        prev = curr;',
  '        curr = next;',
  '    }',
  '    return prev;',
  '}',
  '',
  'int fib(int n) {',
  '    if (n <= 1) return n;',
  '    return fib(n - 1) + fib(n - 2);',
  '}',
  '',
  'void sift_down(int *h, int i, int n) {',
  '    int s = i, l = 2*i + 1, r = 2*i + 2;',
  '    if (l < n && h[l] < h[s]) s = l;',
  '    if (r < n && h[r] < h[s]) s = r;',
  '    if (s != i) { swap(&h[i], &h[s]);',
  '                  sift_down(h, s, n); }',
  '}',
  'void merge(int *a, int lo, int mid, int hi) {',
  '    int i = lo, j = mid + 1, k = 0, *t = tmp;',
  '    while (i <= mid && j <= hi)',
  '        t[k++] = a[i] <= a[j] ? a[i++] : a[j++];',
];

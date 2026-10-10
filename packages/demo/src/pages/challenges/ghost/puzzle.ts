import type { ExecutionTrace, TraceFrame, TraceNode } from '@aqvl/runtime';
import { CATALOGUE } from '../complete/catalogue';
import { runTest, testsOf } from '../complete/grade';
import { solutionTemplate } from '../complete/program';
import type { Kernel } from '../complete/types';

/**
 * Ghost Move: a puzzle is a short stretch of a known algorithm's recorded
 * run with a few prediction points. Everything is derived from the trace the
 * Playground would record for the solution: what the next step does (its
 * kind, actors, writes and edges) is the answer, so every structure and every
 * operation the runtime classifies is covered without per-algorithm
 * authoring. Grading is a comparison against that recorded step.
 */

/** What the learner is shown a score for. */
export type Category = 'Swaps' | 'Comparisons' | 'Writes' | 'Traversals' | 'Links' | 'Inserts' | 'Removals';
export const CATEGORIES: Category[] = ['Swaps', 'Comparisons', 'Writes', 'Traversals', 'Links', 'Inserts', 'Removals'];

/** A place a ghost can be dropped: an existing node, or a slot beside the last node of a row. */
export interface Target {
  id: string;
  /** The node it sits on (a slot at the end of a row sits beside `anchor`). */
  nodeId: string;
  /** World offset from the node's resting position (virtual end slots only). */
  offset?: [number, number, number];
  label: string;
  /** Position among its structure's members (for index / order distance). */
  rank?: number;
  structure?: string;
}

export interface Ask {
  id: string;
  /** What the ghost shows: a value, or a role ("next", "marker"). */
  ghost: string;
  /** The id of the right target. */
  answer: string;
  /** Asks sharing a group are interchangeable (the two sides of a comparison). */
  group?: number;
}

export interface Point {
  /** The step to predict (frame index); the run pauses at the picture before it. */
  frame: number;
  kind: string;
  category: Category;
  question: string;
  asks: Ask[];
  targets: Target[];
  /** What the learner reads once the step has played. */
  outcome: string;
}

export interface Puzzle {
  id: string;
  kernel: Kernel;
  /** Which of the kernel's visible inputs this run uses (0-based). */
  run: number;
  trace: ExecutionTrace;
  source: string;
  points: Point[];
}

export const PAR = 0.7;
const MAX_TARGETS = 40;
/** Windows of the run tried in turn until three prediction points fit. */
const WINDOWS = [15, 20, 26, 34, 50, 90];
const MAX_POINTS = 5;
const MIN_POINTS = 3;
/** Used only when no input of an algorithm is long enough for three. */
const FEWEST_POINTS = 2;

const LINEAR = ['ARRAY_ELEMENT', 'HEAP_ARRAY_ELEMENT', 'CONTAINER_ITEM'];

const byId = (frame: TraceFrame) => new Map(frame.nodes.map((n) => [n.id, n]));

function describe(n: TraceNode): string {
  const place = n.structure ? (n.index !== undefined ? `${n.structure}[${n.index}]` : n.structure) : '';
  const text = n.text !== '' ? n.text : n.caption;
  return place && text ? `${place} = ${text}` : place || text || n.id;
}

/** Order within a structure's members of one family: index, or rank by container order. */
function ranked(members: TraceNode[]): TraceNode[] {
  return [...members].sort((a, b) => (a.index ?? a.order ?? 0) - (b.index ?? b.order ?? 0));
}

function sameKind(prev: TraceFrame, like: TraceNode): TraceNode[] {
  return prev.nodes.filter((n) => n.structure === like.structure && n.family === like.family);
}

function nodeTargets(members: TraceNode[]): Target[] {
  const sorted = ranked(members);
  return sorted.map((n, i) => ({ id: n.id, nodeId: n.id, label: describe(n), rank: n.index ?? i, structure: n.structure }));
}

function groups(ids: string[], prev: Map<string, TraceNode>): Map<string, TraceNode[]> {
  const out = new Map<string, TraceNode[]>();
  for (const id of ids) {
    const n = prev.get(id);
    if (!n) continue;
    const key = `${n.structure ?? ''}|${n.family}`;
    out.set(key, [...(out.get(key) ?? []), n]);
  }
  return out;
}

function wordsFor(family: string): { noun: string; where: string } {
  switch (family) {
    case 'ARRAY_ELEMENT':
    case 'HEAP_ARRAY_ELEMENT':
    case 'MATRIX_ELEMENT':
    case 'GRID_ELEMENT':
      return { noun: 'cell', where: 'slot' };
    case 'CONTAINER_ITEM':
      return { noun: 'item', where: 'place' };
    case 'VERTEX':
      return { noun: 'vertex', where: 'vertex' };
    case 'HASHMAP_BUCKET':
    case 'HASHMAP_ENTRY':
      return { noun: 'entry', where: 'bucket' };
    default:
      return { noun: 'node', where: 'node' };
  }
}

/** The prediction a step offers, or null when this step is not one a learner can place. */
function pointFor(trace: ExecutionTrace, k: number): Point | null {
  const prevFrame = trace.frames[k - 1];
  const cur = trace.frames[k];
  const ev = cur.event;
  const prev = byId(prevFrame);
  const now = byId(cur);
  const point = (category: Category, question: string, asks: Ask[], targets: Target[], outcome: string): Point | null => {
    if (asks.length === 0 || targets.length < 2 || targets.length > MAX_TARGETS) return null;
    const ids = new Set(targets.map((t) => t.id));
    if (asks.some((a) => !ids.has(a.answer))) return null;
    return { frame: k, kind: ev.kind, category, question, asks, targets, outcome };
  };

  switch (ev.kind) {
    case 'swap': {
      // The two values trade places: each ghost is a value, dropped where it will land.
      const found = [...groups(ev.actors, prev).values()].filter((g) => g.length === 2).sort((a, b) => Number(b[0].family === 'HEAP_NODE') - Number(a[0].family === 'HEAP_NODE'))[0];
      if (!found) return null;
      const [a, b] = found;
      const ra = a.index ?? a.order;
      const rb = b.index ?? b.order;
      if (ra === undefined || rb === undefined || ra === rb || a.text === b.text || a.text === '' || b.text === '') return null;
      const { noun } = wordsFor(a.family);
      return point(
        'Swaps',
        `Two values trade places. Where does each one end up?`,
        [
          { id: 'a', ghost: a.text, answer: b.id },
          { id: 'b', ghost: b.text, answer: a.id },
        ],
        nodeTargets(sameKind(prevFrame, a)),
        `${a.text} and ${b.text} swapped ${noun}s.`,
      );
    }
    case 'compare': {
      const found = [...groups(ev.actors, prev).values()].filter((g) => g.length >= 2).sort((a, b) => Number(b[0].family === 'HEAP_NODE') - Number(a[0].family === 'HEAP_NODE'))[0];
      if (!found) return null;
      const [a, b] = found;
      const { noun } = wordsFor(a.family);
      return point(
        'Comparisons',
        `Which two ${noun}s are compared next? Place a marker on each.`,
        [
          { id: 'a', ghost: 'first', answer: a.id, group: 1 },
          { id: 'b', ghost: 'second', answer: b.id, group: 1 },
        ],
        nodeTargets(sameKind(prevFrame, a)),
        `${describe(a)} was compared with ${describe(b)}.`,
      );
    }
    case 'write': {
      const w = ev.writes.find((x) => prev.has(x.id) && prev.get(x.id)!.structure);
      if (w) {
        const node = prev.get(w.id)!;
        const { noun } = wordsFor(node.family);
        return point('Writes', `A value is written. Which ${noun} receives ${w.to}?`, [{ id: 'a', ghost: w.to, answer: node.id }], nodeTargets(sameKind(prevFrame, node)), `${w.to} was written into ${describe(node)}'s place (it held ${w.from || 'nothing'}).`);
      }
      const node = ev.actors.map((id) => prev.get(id)).find((n) => n && n.structure);
      if (!node) return null;
      const { noun } = wordsFor(node.family);
      return point('Writes', `Something on a ${noun} is updated. Which ${noun}?`, [{ id: 'a', ghost: 'update', answer: node.id }], nodeTargets(sameKind(prevFrame, node)), `${describe(node)} was updated.`);
    }
    case 'create': {
      const created = cur.nodes.filter((n) => !prev.has(n.id));
      // A row grows: the ghost is the new value, dropped on the place it takes.
      const row = created.find((n) => LINEAR.includes(n.family) && n.structure && (n.index !== undefined || n.order !== undefined));
      if (row) {
        const members = ranked(prevFrame.nodes.filter((n) => n.structure === row.structure && n.family === row.family));
        if (members.length < 2 || row.text === '') return null;
        const key = row.index ?? row.order!;
        const slot = members.filter((m) => (m.index ?? m.order ?? 0) < key).length;
        const stride: [number, number, number] = [
          members[members.length - 1].pos.x - members[members.length - 2].pos.x,
          members[members.length - 1].pos.y - members[members.length - 2].pos.y,
          members[members.length - 1].pos.z - members[members.length - 2].pos.z,
        ];
        const targets: Target[] = members.map((m, i) => ({ id: `slot:${i}`, nodeId: m.id, label: i === 0 ? `before ${describe(m)}` : `at ${m.structure}[${m.index ?? i}]`, rank: i, structure: row.structure }));
        const last = members[members.length - 1];
        targets.push({ id: `slot:${members.length}`, nodeId: last.id, offset: stride, label: `after ${describe(last)} (the end)`, rank: members.length, structure: row.structure });
        const { where } = wordsFor(row.family);
        return point('Inserts', `${row.text} is added to ${row.structure}. Which ${where} does it take?`, [{ id: 'a', ghost: row.text, answer: `slot:${Math.min(slot, members.length)}` }], targets, `${row.text} went into ${row.structure} at position ${slot}.`);
      }
      // A hash entry lands in the bucket its key hashes to.
      const entry = created.find((n) => n.family === 'HASHMAP_ENTRY');
      if (entry) {
        const buckets = prevFrame.nodes.filter((n) => n.family === 'HASHMAP_BUCKET' && n.structure === entry.structure);
        if (buckets.length < 2) return null;
        const home = buckets.reduce((best, b) => (Math.abs(b.pos.x - entry.pos.x) < Math.abs(best.pos.x - entry.pos.x) ? b : best));
        const targets = nodeTargets(buckets).map((t) => ({ ...t, label: `bucket ${prev.get(t.nodeId)?.index ?? t.rank}` }));
        return point('Inserts', `A key is added to ${entry.structure}. Which bucket does it hash to?`, [{ id: 'a', ghost: entry.text || 'entry', answer: home.id }], targets, `The key hashed to bucket ${home.index ?? ''}.`);
      }
      // A node grows off an existing one (trees, tries).
      const createdIds = new Set(created.map((n) => n.id));
      const hook = cur.edges.find((e) => createdIds.has(e.to) && prev.has(e.from));
      if (hook) {
        const child = now.get(hook.to)!;
        const parent = prev.get(hook.from)!;
        const { noun } = wordsFor(parent.family);
        return point('Inserts', `A new ${noun} (${child.text || 'new'}) is added. Which existing ${noun} does it hang from?`, [{ id: 'a', ghost: child.text || 'new', answer: parent.id }], nodeTargets(sameKind(prevFrame, parent)), `The new ${noun} attached under ${describe(parent)}.`);
      }
      return null;
    }
    case 'remove': {
      const gone = prevFrame.nodes.filter((n) => !now.has(n.id) && n.structure);
      const first = gone[0];
      if (!first) return null;
      const { noun } = wordsFor(first.family);
      return point('Removals', `One ${noun} leaves. Which one?`, [{ id: 'a', ghost: first.text || 'out', answer: first.id }], nodeTargets(sameKind(prevFrame, first)), `${describe(first)} was removed.`);
    }
    case 'link': {
      const changed = cur.edges.find((e) => {
        const before = prevFrame.edges.find((x) => x.id === e.id);
        return (!before || before.from !== e.from || before.to !== e.to) && prev.has(e.from) && prev.has(e.to);
      });
      if (!changed) return null;
      const from = prev.get(changed.from)!;
      const to = prev.get(changed.to)!;
      const { noun } = wordsFor(to.family);
      const pointer = changed.pointer ?? 'link';
      return point('Links', `A pointer is set. Which ${noun} does ${describe(from)}'s ${pointer} connect to?`, [{ id: 'a', ghost: `${pointer} →`, answer: to.id }], nodeTargets(sameKind(prevFrame, to)), `${describe(from)}.${pointer} now points to ${describe(to)}.`);
    }
    case 'call':
    case 'return':
    case 'traverse':
    case 'visit':
    case 'settle':
    case 'discard':
    case 'mark': {
      const node = ev.actors.map((id) => prev.get(id)).find((n) => n && n.structure);
      if (!node) return null;
      const { noun } = wordsFor(node.family);
      const question =
        ev.kind === 'call' ? `The recursion goes deeper. Which ${noun} does the next call enter?` : ev.kind === 'return' ? `A call finishes. Which ${noun} was it working on?` : ev.kind === 'settle' ? `Which ${noun} is marked as done?` : ev.kind === 'discard' ? `Which ${noun} is set aside?` : ev.kind === 'mark' ? `Which ${noun} is marked?` : `Which ${noun} is visited next?`;
      return point('Traversals', question, [{ id: 'a', ghost: 'next', answer: node.id }], nodeTargets(sameKind(prevFrame, node)), `${describe(node)} was ${ev.kind === 'call' ? 'entered' : ev.kind === 'return' ? 'finished' : ev.kind === 'settle' ? 'marked done' : ev.kind === 'discard' ? 'set aside' : ev.kind === 'mark' ? 'marked' : 'visited'}.`);
    }
    default:
      return null;
  }
}

/** Picks up to five points: spread through the run, never more than two of one category in a row of picks. */
function choose(eligible: Point[], min: number): Point[] {
  const want = Math.min(MAX_POINTS, eligible.length);
  const picked: Point[] = [];
  const perCategory = new Map<Category, number>();
  const used = new Set<Point>();
  for (let i = 0; i < want; i++) {
    const start = Math.floor((i * eligible.length) / want);
    for (let j = 0; j < eligible.length; j++) {
      const p = eligible[(start + j) % eligible.length];
      if (used.has(p) || (perCategory.get(p.category) ?? 0) >= 2) continue;
      used.add(p);
      picked.push(p);
      perCategory.set(p.category, (perCategory.get(p.category) ?? 0) + 1);
      break;
    }
  }
  if (picked.length < min) {
    for (const p of eligible) if (picked.length < min && !used.has(p)) picked.push(p);
  }
  return picked.sort((a, b) => a.frame - b.frame);
}

/** The prediction points of a recorded run, and the run cut to end at the last of them. */
export function pointsOf(trace: ExecutionTrace, min = MIN_POINTS): { points: Point[]; trace: ExecutionTrace } | null {
  if (trace.error || trace.truncated) return null;
  const total = trace.frames.length - 1;
  for (const window of [...WINDOWS, total]) {
    const end = Math.min(window, total);
    const eligible: Point[] = [];
    for (let k = 1; k <= end; k++) {
      const p = pointFor(trace, k);
      if (p) eligible.push(p);
    }
    if (eligible.length >= min || end === total) {
      if (eligible.length < min) return null;
      const points = choose(eligible, min);
      const last = points[points.length - 1].frame;
      const cut: ExecutionTrace = { ...trace, frames: trace.frames.slice(0, last + 1), diagnostics: [], final: undefined, truncated: false, error: null };
      return { points, trace: cut };
    }
  }
  return null;
}

/** How many visible inputs of a kernel are offered as runs. */
export const RUNS_PER_KERNEL = 2;

export function puzzleId(kernel: Kernel, run: number): string {
  return `${kernel.id}.${run + 1}`;
}

const cache = new Map<string, Promise<Puzzle[]>>();

/**
 * The kernel's puzzles: its solution recorded on each test input in turn
 * (visible first), keeping the first runs long enough to offer three
 * predictions. Where no input is, the first with two is used.
 */
export function puzzlesOf(kernel: Kernel): Promise<Puzzle[]> {
  let hit = cache.get(kernel.id);
  if (!hit) {
    hit = (async () => {
      const runs: { test: ReturnType<typeof testsOf>[number]; trace: ExecutionTrace; source: string }[] = [];
      for (const test of testsOf(kernel)) {
        const r = await runTest(solutionTemplate(kernel), kernel, test);
        if (r.trace && r.outcome.status === 'pass' && r.trace.frames.length > 1) runs.push({ test, trace: r.trace, source: r.source });
      }
      const make = (min: number, limit: number): Puzzle[] => {
        const out: Puzzle[] = [];
        for (const run of runs) {
          const cut = pointsOf(run.trace, min);
          if (cut) out.push({ id: puzzleId(kernel, out.length), kernel, run: out.length, trace: cut.trace, source: run.source, points: cut.points });
          if (out.length >= limit) break;
        }
        return out;
      };
      const full = make(MIN_POINTS, RUNS_PER_KERNEL);
      return full.length > 0 ? full : make(FEWEST_POINTS, 1);
    })();
    cache.set(kernel.id, hit);
  }
  return hit;
}

export async function buildPuzzle(kernel: Kernel, run: number): Promise<Puzzle | null> {
  return (await puzzlesOf(kernel))[run] ?? null;
}

export function findKernel(puzzle: string): { kernel: Kernel; run: number } | null {
  const m = /^(.+)\.(\d+)$/.exec(puzzle);
  if (!m) return null;
  const kernel = CATALOGUE.find((k) => k.id === m[1]);
  const run = Number(m[2]) - 1;
  return kernel && run >= 0 && run < RUNS_PER_KERNEL ? { kernel, run } : null;
}

// ── Distance and scoring ───────────────────────────────────────────────────

export interface Gap {
  /** 0 for a hit. */
  distance: number | null;
  unit: 'slot' | 'node';
}

function hops(frame: TraceFrame, from: string, to: string): number | null {
  if (from === to) return 0;
  const adj = new Map<string, string[]>();
  for (const e of frame.edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; frontier.length > 0 && d < 64; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of adj.get(id) ?? []) {
        if (seen.has(n)) continue;
        if (n === to) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** How far a placed target is from the right one: edge hops in a tree, graph or list; index distance in a row. */
export function gapBetween(trace: ExecutionTrace, point: Point, placed: string, answer: string): Gap {
  if (placed === answer) return { distance: 0, unit: 'slot' };
  const a = point.targets.find((t) => t.id === placed);
  const b = point.targets.find((t) => t.id === answer);
  if (!a || !b) return { distance: null, unit: 'slot' };
  const frame = trace.frames[point.frame - 1];
  const linked = frame.edges.length > 0 && !a.id.startsWith('slot:') && !b.id.startsWith('slot:');
  if (linked) {
    const h = hops(frame, a.nodeId, b.nodeId);
    if (h !== null) return { distance: h, unit: 'node' };
  }
  if (a.rank !== undefined && b.rank !== undefined && a.structure === b.structure) return { distance: Math.abs(a.rank - b.rank), unit: 'slot' };
  return { distance: null, unit: 'slot' };
}

export function scoreFor(distance: number | null): number {
  if (distance === null) return 0;
  return distance === 0 ? 1 : distance === 1 ? 0.5 : distance === 2 ? 0.25 : 0;
}

/** Phrase for a miss: "2 nodes away". */
export function awayText(gap: Gap): string {
  if (gap.distance === null) return 'far off';
  const unit = gap.unit === 'node' ? 'node' : 'slot';
  return `${gap.distance} ${unit}${gap.distance === 1 ? '' : 's'} away`;
}

export interface AskResult {
  ask: Ask;
  placed: string | null;
  /** The target actually right for this ask (interchangeable asks may be matched crosswise). */
  answer: string;
  gap: Gap;
  score: number;
}

export interface PointResult {
  point: Point;
  asks: AskResult[];
  rewinds: number;
  /** The most this prediction could score, lowered by each rewind. */
  cap: number;
  /** 0..1 */
  score: number;
  hit: boolean;
}

/** Each rewind costs a fifth of the prediction, to a floor of 40%. */
export function capFor(rewinds: number): number {
  return Math.max(0.4, 1 - 0.2 * rewinds);
}

export function gradePoint(trace: ExecutionTrace, point: Point, placed: Record<string, string | null>, rewinds: number): PointResult {
  const build = (answers: string[]): AskResult[] =>
    point.asks.map((ask, i) => {
      const p = placed[ask.id] ?? null;
      const gap = p ? gapBetween(trace, point, p, answers[i]) : { distance: null, unit: 'slot' as const };
      return { ask, placed: p, answer: answers[i], gap, score: p ? scoreFor(gap.distance) : 0 };
    });
  let asks = build(point.asks.map((a) => a.answer));
  // The two sides of a comparison may be placed either way round.
  const grouped = point.asks.filter((a) => a.group !== undefined);
  if (grouped.length === 2) {
    const swapped = build(point.asks.map((a) => (a === grouped[0] ? grouped[1].answer : a === grouped[1] ? grouped[0].answer : a.answer)));
    const sum = (r: AskResult[]) => r.reduce((s, x) => s + x.score, 0);
    if (sum(swapped) > sum(asks)) asks = swapped;
  }
  const cap = capFor(rewinds);
  const raw = asks.reduce((s, a) => s + a.score, 0) / asks.length;
  return { point, asks, rewinds, cap, score: raw * cap, hit: asks.every((a) => a.gap.distance === 0) };
}

export interface Summary {
  accuracy: number;
  stars: number;
  byCategory: { category: Category; hits: number; total: number }[];
}

export function summarize(results: PointResult[]): Summary {
  const accuracy = results.length === 0 ? 0 : results.reduce((s, r) => s + r.score, 0) / results.length;
  const stars = results.length === 0 ? 0 : accuracy >= 0.9 ? 3 : accuracy >= PAR ? 2 : 1;
  const byCategory = CATEGORIES.map((category) => {
    const mine = results.filter((r) => r.point.category === category);
    return { category, hits: mine.filter((r) => r.hit).length, total: mine.length };
  }).filter((c) => c.total > 0);
  return { accuracy, stars, byCategory };
}

/** The puzzle after this one: the kernel's next run, else the next algorithm that has something to place. */
export async function nextPuzzleId(current: Puzzle): Promise<string> {
  const mine = await puzzlesOf(current.kernel);
  if (mine[current.run + 1]) return mine[current.run + 1].id;
  const at = CATALOGUE.findIndex((k) => k.id === current.kernel.id);
  for (let i = 1; i <= CATALOGUE.length; i++) {
    const k = CATALOGUE[(at + i) % CATALOGUE.length];
    const all = await puzzlesOf(k);
    if (all.length > 0) return all[0].id;
  }
  return current.id;
}

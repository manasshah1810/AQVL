import type { TraceFrame } from '../trace/types';
import type { ErrorInfo, Scalar } from './types';
import { KIND_NAME, envOf } from './runtime';
import { enclosingWhile, evaluate, findAccesses, lineAt, maskLine, sourceLines, type Access } from './source';

/**
 * Logic problems: the program runs, but something it does cannot be what the
 * author meant. A detector reports only what no valid program does, or what
 * contradicts the program's own stated purpose; a different but legitimate way
 * of writing the same algorithm never matches. When in doubt, nothing is reported.
 */

export interface LogicContext {
  frames: TraceFrame[];
  source?: string;
  /** The run ended by itself (no error, not cut off at the step cap). */
  completed: boolean;
}

const COMPARISON = /(<=|>=|==|!=|<|>|=)/;

export interface SelfCompareCandidate {
  line: number;
  text: string;
  name: string;
  x: Access;
  y: Access;
  op: string;
}

/**
 * Lines that compare two cells of one structure (`IF arr[i] > arr[j]`,
 * `COMPARE arr[a] arr[b]`). Only these lines are checked as the program runs,
 * so a program without such a line costs nothing.
 */
export function selfCompareCandidates(source: string): Map<number, SelfCompareCandidate> {
  const out = new Map<number, SelfCompareCandidate>();
  sourceLines(source).forEach((text, i) => {
    const masked = maskLine(text);
    const accesses = findAccesses(text);
    for (let a = 0; a + 1 < accesses.length; a++) {
      const [x, y] = [accesses[a], accesses[a + 1]];
      const between = masked.slice(x.start + x.length, y.start);
      const isCompareStatement = /^\s*COMPARE\b/i.test(masked) && /^\s*$/.test(between);
      const isRelation = COMPARISON.test(between) && !/\b(AND|OR)\b/i.test(between) && !/[()]/.test(between.replace(/\s/g, ''));
      if (!isCompareStatement && !isRelation) continue;
      const name = /^([A-Za-z_]\w*)/.exec(x.text)?.[1];
      if (!name || !new RegExp(String.raw`^${name}\s*\[`).test(y.text)) continue;
      out.set(i + 1, { line: i + 1, text, name, x, y, op: COMPARISON.exec(between)?.[1] ?? 'COMPARE' });
      break;
    }
  });
  return out;
}

/** The moment `candidate` compares a cell with itself: both sides write the same index, so the cell can only equal itself. */
export function checkSelfCompare(c: SelfCompareCandidate, scene: TraceFrame, vars: Record<string, Scalar>): ErrorInfo | null {
  const env = envOf(scene, vars);
  const vx = evaluate(c.x.index, env);
  const vy = evaluate(c.y.index, env);
  if (typeof vx !== 'number' || typeof vy !== 'number' || vx !== vy) return null;
  // Same index *written twice* is a slip. Two different expressions that happen to meet (`low` and `mid` in a one-element window)
  // are how real algorithms behave, so those are left alone.
  if (c.x.index.replace(/\s+/g, '') !== c.y.index.replace(/\s+/g, '')) return null;
  const st = scene.structures.find((s) => s.name === c.name);
  return {
    type: 'SELF_COMPARISON',
    phase: 'logic',
    severity: 'warning',
    confidence: 'high',
    name: KIND_NAME.SELF_COMPARISON,
    line: c.line,
    column: c.x.start + 1,
    length: c.y.start + c.y.length - c.x.start,
    lineText: c.text,
    expression: c.text.slice(c.x.start, c.y.start + c.y.length),
    message: `${c.x.text} and ${c.y.text} are the same cell.`,
    frameIndex: null,
    structure: { name: c.name, kind: st?.kind ?? 'ARRAY', size: st?.nodeIds.length ?? 0 },
    actualIndex: vx,
    subject: c.name,
    operation: c.op,
    evidence: { left: c.x.text, right: c.y.text, index: vx },
    variables: vars,
  };
}

function numericCells(frame: TraceFrame, structure: string): number[] | null {
  const cells = frame.nodes
    .filter((n) => n.structure === structure && n.index !== undefined)
    .sort((p, q) => (p.index as number) - (q.index as number));
  if (cells.length === 0 || cells.some((c) => c.numeric === undefined)) return null;
  return cells.map((c) => c.numeric as number);
}

const ascending = (v: number[]) => v.every((x, i) => i === 0 || v[i - 1] <= x);
const descending = (v: number[]) => v.every((x, i) => i === 0 || v[i - 1] >= x);

/**
 * A scene whose name says it sorts, that finishes with its main array in
 * neither ascending nor descending order. Sorting the other way round is a
 * valid choice and is never reported; only a result that is not in order at
 * all is. The step shown is the last one that moved the array.
 */
function detectUnsortedResult({ frames, source, completed }: LogicContext): ErrorInfo[] {
  if (!source || !completed || frames.length < 3) return [];
  const sceneName = /^\s*SCENE\s+([A-Za-z_]\w*)/im.exec(source)?.[1];
  if (!sceneName || !/sort/i.test(sceneName)) return [];
  const first = frames[0];
  const last = frames[frames.length - 1];
  const main = first.structures
    .filter((s) => s.kind === 'ARRAY' && s.nodeIds.length >= 3)
    .map((s) => ({ s, start: numericCells(first, s.name) }))
    .filter((c): c is { s: (typeof first.structures)[number]; start: number[] } => c.start !== null)
    .sort((a, b) => b.start.length - a.start.length)[0];
  if (!main) return [];
  const name = main.s.name;
  const end = numericCells(last, name);
  if (!end || end.length !== main.start.length) return [];
  if (ascending(main.start) || descending(main.start)) return [];
  if (ascending(end) || descending(end)) return [];

  // The step that last moved the array, and what the program's own compare-then-swap pairs did.
  let moved = -1;
  let swapsWhenLess = 0;
  let swapsWhenGreater = 0;
  let compareLine: number | null = null;
  for (let k = 1; k < frames.length; k++) {
    const f = frames[k];
    const before = numericCells(frames[k - 1], name);
    const now = numericCells(f, name);
    if (before && now && before.some((v, i) => v !== now[i])) moved = k;
    if (f.event.kind === 'swap') {
      const p = frames[k - 1];
      const sameCells = p.event.kind === 'compare' && p.event.actors.length === 2 && p.event.actors.every((id) => f.event.actors.includes(id));
      if (sameCells && p.event.relation === '<') swapsWhenLess++;
      if (sameCells && p.event.relation === '>') swapsWhenGreater++;
      if (sameCells) compareLine = p.line;
    }
  }
  if (moved < 0) return [];
  const frame = frames[moved];
  const text = lineAt(source, frame.line);
  const shown = (v: number[]) => `[${v.join(', ')}]`;
  return [
    {
      type: 'UNSORTED_RESULT',
      phase: 'logic',
      severity: 'warning',
      confidence: 'high',
      name: KIND_NAME.UNSORTED_RESULT,
      line: frame.line,
      lineText: text,
      expression: text?.trim() ?? null,
      message: `${name} ends as ${shown(end)}, which is not in order.`,
      frameIndex: frame.index,
      structure: { name, kind: 'ARRAY', size: end.length },
      subject: name,
      evidence: {
        scene: sceneName,
        start: shown(main.start),
        end: shown(end),
        swapsWhenLess,
        swapsWhenGreater,
        compareLine: compareLine ?? -1,
      },
      variables: frame.vars,
    },
  ];
}

export function detectLogicalIssues(ctx: LogicContext): ErrorInfo[] {
  return detectUnsortedResult(ctx);
}

/**
 * A run cut off at the step cap whose picture stopped changing: the same
 * variable values and the same cell values for a long stretch. A program that
 * is still making progress changes at least a counter, so nothing like this
 * is a valid slow algorithm. Returns where the stall begins and how long one
 * trip around the loop is.
 */
export function detectStall(frames: TraceFrame[], minRun = 120): { start: number; period: number } | null {
  if (frames.length < minRun + 2) return null;
  const sig = (f: TraceFrame) => JSON.stringify([f.vars, f.nodes.map((n) => n.text), f.callStack.length]);
  const lastSig = sig(frames[frames.length - 1]);
  let start = frames.length - 1;
  while (start > 1 && sig(frames[start - 1]) === lastSig) start--;
  if (frames.length - start < minRun) return null;
  // One trip around the loop: the smallest repeat of the line sequence.
  for (let p = 1; p <= 40; p++) {
    let ok = true;
    for (let k = 0; k < p * 3 && start + k + p < frames.length; k++) {
      if (frames[start + k].line !== frames[start + k + p].line) {
        ok = false;
        break;
      }
    }
    if (ok) return { start, period: p };
  }
  return null;
}

/** The WHILE header a stalled loop belongs to, from the lines it keeps running. */
export function loopHeaderFor(source: string | undefined, frames: TraceFrame[], start: number, period: number): number | null {
  for (let k = 0; k < period; k++) {
    const w = enclosingWhile(source, frames[start + k]?.line ?? null);
    if (w) return w.line;
  }
  return null;
}

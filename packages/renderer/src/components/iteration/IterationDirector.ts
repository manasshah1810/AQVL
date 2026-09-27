/**
 * IterationDirector — the Loops & Control / Searching counterpart to what
 * SortAlgorithms + ArrayNarrativeGenerator give Sorting: cursors the camera
 * follows, nesting-aware depth, a live search window, and a narrator that
 * says what is being compared or accumulated on each pass.
 *
 * Loops and Searching run as ordinary VM programs (`HIGHLIGHT arr[i] ...`
 * inside LOOP / WHILE), not through a dedicated algorithm engine, so nothing
 * upstream knows "this is iteration 3 of the inner loop". This class derives
 * it from three things the engine already exposes:
 *   - INSTRUCTION_START -> the source line now running, and through the
 *     program's static structure (sourceStructure.ts) the loops enclosing it;
 *   - getVisibleVariables() -> loop counters, accumulators, low / high / mid;
 *   - STATE_UPDATED -> which cells just changed state (checked, passed, ruled out).
 *
 * Framework-agnostic (no React / three.js), like CharacterController: the
 * canvas reads `getOverlay()` / `subscribe()`, and the director pushes lines
 * to a CharacterController and emphasis to an ArrayCameraChoreographer.
 */

import { parseSourceStructure, type SourceStructure, type EnclosingLoop } from './sourceStructure';
import type { CharacterEmotion } from '../character/CharacterController';
import type { ArrayCameraInstruction, OperationSignificance } from '../array/ArrayCameraChoreographer';

export type IterationTopic = 'loops' | 'searching';

export interface IterationCursorState {
  structureId: string;
  index: number;
  /** 0 = outermost enclosing loop. */
  depth: number;
  /** e.g. "i = 3", "mid = 4". */
  label: string;
}

export interface IterationWindowState {
  structureId: string;
  startIndex: number;
  endIndex: number;
  label: string;
}

export interface IterationOverlayState {
  cursors: IterationCursorState[];
  windows: IterationWindowState[];
}

interface ElementLike {
  id: string;
  state?: string;
  position: { x: number; y: number; z: number };
  originalType?: string;
  logicalParent?: string;
  logicalIndex?: number;
  value?: unknown;
}

interface SceneLike {
  elements: Map<string, ElementLike> | Map<string, unknown>;
}

/** Structurally matches ExecutionEngine without importing @aqvl/runtime's class. */
export interface IterationEngineSource {
  eventDispatcher: {
    on(event: string, handler: (payload: any) => void): void;
    off(event: string, handler: (payload: any) => void): void;
  };
  getProgramInstructions(): ReadonlyArray<{ lineNumber?: number }> | null;
  getVisibleVariables(): Record<string, unknown>;
}

export interface IterationNarrator {
  say(text: string, options?: { emotion?: CharacterEmotion; pointAt?: unknown; durationMs?: number }): void;
  clear(): void;
}

export interface IterationCamera {
  registerInstruction(instruction: ArrayCameraInstruction): void;
}

const LOW_NAMES = ['low', 'lo', 'left', 'l'];
const HIGH_NAMES = ['high', 'hi', 'right', 'r'];
const MID_NAMES = ['mid', 'middle', 'm'];
const TARGET_NAMES = ['target', 'key', 'x', 'value'];

const EMPTY_OVERLAY: IterationOverlayState = { cursors: [], windows: [] };

function firstNumber(vars: Record<string, unknown>, names: string[]): { name: string; value: number } | null {
  for (const name of names) {
    const v = vars[name];
    if (typeof v === 'number' && Number.isFinite(v)) return { name, value: v };
  }
  return null;
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return String(v);
}

export class IterationDirector {
  private readonly structure: SourceStructure;
  private listeners: ((overlay: IterationOverlayState) => void)[] = [];
  private overlay: IterationOverlayState = EMPTY_OVERLAY;

  private currentLine: number | null = null;
  private previousLine: number | null = null;
  /** Live variables, refreshed on every instruction and state update. */
  private vars: Record<string, unknown> = {};
  /** Variables as they were when the current line started — the "before" for accumulator narration. */
  private lineStartVars: Record<string, unknown> = {};
  /** Last condition narrated, so the VM revisiting an IF line (scope pops, jumps) doesn't repeat it. */
  private lastConditionKeys = new Map<number, string>();
  private elementStates = new Map<string, string | undefined>();
  private elements: ElementLike[] = [];
  /** depth -> cursor, plus which loop (header line) owns it. */
  private cursors = new Map<number, IterationCursorState & { loopLine: number }>();
  private primaryStructure: string | null = null;

  private readonly onInstruction = (pc: number) => this.handleInstruction(pc);
  private readonly onState = (state: SceneLike) => this.handleState(state);
  private readonly onSceneLoaded = () => this.reset();

  constructor(
    private readonly engine: IterationEngineSource,
    source: string,
    private readonly topic: IterationTopic,
    private readonly narrator?: IterationNarrator,
    private readonly camera?: IterationCamera,
  ) {
    this.structure = parseSourceStructure(source);
    engine.eventDispatcher.on('INSTRUCTION_START', this.onInstruction);
    engine.eventDispatcher.on('STATE_UPDATED', this.onState);
    engine.eventDispatcher.on('SCENE_LOADED', this.onSceneLoaded);
  }

  dispose(): void {
    this.engine.eventDispatcher.off('INSTRUCTION_START', this.onInstruction);
    this.engine.eventDispatcher.off('STATE_UPDATED', this.onState);
    this.engine.eventDispatcher.off('SCENE_LOADED', this.onSceneLoaded);
    this.listeners = [];
  }

  getOverlay(): IterationOverlayState {
    return this.overlay;
  }

  subscribe(listener: (overlay: IterationOverlayState) => void): () => void {
    this.listeners.push(listener);
    listener(this.overlay);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private reset(): void {
    this.currentLine = null;
    this.previousLine = null;
    this.vars = {};
    this.lineStartVars = {};
    this.lastConditionKeys.clear();
    this.cursors.clear();
    this.elementStates.clear();
    this.publish();
  }

  // ── Line-by-line: loop structure, counters, accumulators, low/high ─────────

  private handleInstruction(pc: number): void {
    this.vars = this.engine.getVisibleVariables();
    const line = this.engine.getProgramInstructions()?.[pc]?.lineNumber;
    if (typeof line !== 'number' || line === this.currentLine) return;

    const before = this.lineStartVars;
    const after = this.vars;
    this.previousLine = this.currentLine;
    this.currentLine = line;
    this.lineStartVars = after;

    const loops = this.structure.loopsAt(line);
    this.pruneCursors(loops);
    this.followLoopCounters(loops);
    this.narrateAccumulator(before, after, loops);
    if (this.topic === 'searching') this.narrateWindowChange(before, after);
    this.narrateCondition(line, loops);
    this.publish();
  }

  /** Inner cursors disappear once their loop is left; a different loop at the same depth takes over that slot. */
  private pruneCursors(loops: readonly EnclosingLoop[]): void {
    for (const [depth, cursor] of this.cursors) {
      const owner = loops[depth];
      if (!owner || owner.line !== cursor.loopLine) this.cursors.delete(depth);
    }
  }

  /** A `LOOP i FROM ...` counter that is a valid index of the array moves its cursor every pass, highlighted or not. */
  private followLoopCounters(loops: readonly EnclosingLoop[]): void {
    const structureId = this.primaryStructure ?? this.firstArray();
    if (!structureId) return;
    const length = this.arrayLength(structureId);
    loops.forEach((loop, depth) => {
      if (loop.kind !== 'LOOP' || !loop.variable) return;
      const value = this.vars[loop.variable];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= length) return;
      const existing = this.cursors.get(depth);
      if (existing && existing.index === value && existing.structureId === structureId) return;
      this.moveCursor({ structureId, index: value, depth, label: `${loop.variable} = ${value}`, loopLine: loop.line }, 'routine');
    });
  }

  /** `sum = sum + marks[i]` just ran: say what it became. */
  private narrateAccumulator(before: Record<string, unknown>, after: Record<string, unknown>, loops: readonly EnclosingLoop[]): void {
    if (this.previousLine == null || loops.length === 0) return;
    const text = this.structure.textAt(this.previousLine);
    const m = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(text);
    if (!m) return;
    const [, name, rhs] = m;
    if (!new RegExp(`\\b${name}\\b`).test(rhs)) return; // not self-referential
    if (loops.some((l) => l.variable === name)) return; // a loop counter stepping, not an accumulator
    if ([...LOW_NAMES, ...HIGH_NAMES, 'step', 'comparisons'].includes(name) && this.topic === 'searching') return;
    const was = before[name];
    const now = after[name];
    if (now === undefined || was === now) return;
    const cursor = this.cursors.get(loops.length - 1);
    this.say(`${name}: ${formatValue(was)} → ${formatValue(now)}`, 'pointing', cursor ? this.pointAt(cursor) : undefined);
  }

  /** Binary search: low moved up = the middle was too low; high moved down = too high. */
  private narrateWindowChange(before: Record<string, unknown>, after: Record<string, unknown>): void {
    const lowBefore = firstNumber(before, LOW_NAMES);
    const lowAfter = firstNumber(after, LOW_NAMES);
    const highBefore = firstNumber(before, HIGH_NAMES);
    const highAfter = firstNumber(after, HIGH_NAMES);
    if (!lowAfter || !highAfter || !lowBefore || !highBefore) return;
    if (lowBefore.name !== lowAfter.name || highBefore.name !== highAfter.name) return;

    const mid = firstNumber(after, MID_NAMES);
    const target = firstNumber(after, TARGET_NAMES);
    const probe = mid ? this.describeCell(mid.value) : null;
    const structureId = this.primaryStructure ?? this.firstArray();

    if (lowAfter.value > lowBefore.value) {
      const why = probe && target ? `${probe.text} < ${target.value}` : 'the middle was too small';
      this.say(`Too low: ${why}. Everything left of it is out, so ${lowAfter.name} = ${lowAfter.value}.`, 'confused', probe?.element);
      if (structureId) this.emphasizeWindow(structureId, lowAfter.value, highAfter.value);
    } else if (highAfter.value < highBefore.value) {
      const why = probe && target ? `${probe.text} > ${target.value}` : 'the middle was too big';
      this.say(`Too high: ${why}. Everything right of it is out, so ${highAfter.name} = ${highAfter.value}.`, 'confused', probe?.element);
      if (structureId) this.emphasizeWindow(structureId, lowAfter.value, highAfter.value);
    }
    if (lowAfter.value > highAfter.value && (lowBefore.value <= highBefore.value)) {
      this.say(`The window is empty (${lowAfter.name} > ${highAfter.name}): the target is not in the array.`, 'confused');
    }
  }

  /** Before an IF / ELSE IF inside a loop runs: "Is marks[2] >= 60?  →  64 >= 60?" */
  private narrateCondition(line: number, loops: readonly EnclosingLoop[]): void {
    if (loops.length === 0) return;
    const text = this.structure.textAt(line);
    const m = /^(?:ELSE\s+)?IF\s+(.+)$/i.exec(text);
    if (!m) return;
    const condition = m[1];
    const substituted = this.substitute(condition);
    // LOOP counters only: a WHILE's own variable (low, high, ...) changes mid-pass, before the VM's jump back re-visits these lines.
    const counters = loops.map((l) => (l.kind === 'LOOP' && l.variable ? this.vars[l.variable] : null));
    const key = `${line}|${substituted}|${JSON.stringify(counters)}`;
    if (this.lastConditionKeys.get(line) === key) return;
    this.lastConditionKeys.set(line, key);
    const cursor = this.cursors.get(loops.length - 1);
    const pointAt = cursor ? this.pointAt(cursor) : undefined;
    this.say(substituted !== condition ? `${condition}  →  ${substituted} ?` : `${condition} ?`, 'thinking', pointAt);
  }

  // ── Element-state changes: checked / passed / ruled out / probed ────────────

  private handleState(state: SceneLike): void {
    if (!state?.elements) return;
    this.elements = Array.from((state.elements as Map<string, ElementLike>).values());
    this.vars = this.engine.getVisibleVariables();
    const changed: ElementLike[] = [];
    for (const el of this.elements) {
      if (el.originalType !== 'ARRAY_ELEMENT' && el.logicalIndex === undefined) continue;
      // A cell never seen before started out NEUTRAL, so a first-frame highlight still counts as a change.
      const previous = this.elementStates.get(el.id) ?? 'NEUTRAL';
      if (previous !== (el.state ?? 'NEUTRAL')) changed.push(el);
      this.elementStates.set(el.id, el.state);
    }
    for (const el of changed) this.handleElementChange(el);
    this.publish();
  }

  private handleElementChange(el: ElementLike): void {
    if (typeof el.logicalIndex !== 'number' || !el.logicalParent) return;
    this.primaryStructure = el.logicalParent;
    const loops = this.currentLine != null ? this.structure.loopsAt(this.currentLine) : [];
    const depth = Math.max(0, loops.length - 1);
    const owner = loops[depth];
    const name = `${el.logicalParent}[${el.logicalIndex}]`;
    const value = formatValue(el.value);
    const state = (el.state ?? '').toUpperCase();

    if (state === 'EVALUATING' || state === 'TRAVERSING' || state === 'AUXILIARY') {
      const label = this.cursorLabel(el.logicalIndex, owner);
      const significance: OperationSignificance = state === 'AUXILIARY' ? 'notable' : 'routine';
      this.moveCursor({ structureId: el.logicalParent, index: el.logicalIndex, depth, label, loopLine: owner?.line ?? -1 }, significance);
      if (state === 'AUXILIARY') {
        const isProbe = this.topic === 'searching' && firstNumber(this.vars, MID_NAMES) !== null;
        this.say(isProbe ? `Check the middle of the window: ${name} = ${value}` : `New mark: ${name} = ${value}`, 'pointing', el);
      }
    } else if (state === 'SUCCESS') {
      this.registerCamera([el], 'pivotal', 'CONFIRM');
      if (this.topic === 'searching') {
        this.say(`Found it! ${name} = ${value}`, 'celebrating', el);
      } else {
        this.say(`✓ ${name} = ${value}`, 'celebrating', el);
      }
    } else if (state === 'DISCARDED') {
      // Binary search greys out a whole half at once — its too high / too low line already explained it.
      const inBinarySearch = firstNumber(this.vars, LOW_NAMES) && firstNumber(this.vars, HIGH_NAMES);
      if (!inBinarySearch) this.say(`No: ${name} = ${value} is ruled out`, 'neutral', el);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** "i = 3" when the HIGHLIGHT line indexes with a plain name (or the loop owns one), else "[3]". */
  private cursorLabel(index: number, owner: EnclosingLoop | undefined): string {
    const text = this.currentLine != null ? this.structure.textAt(this.currentLine) : '';
    const m = /^HIGHLIGHT\s+[A-Za-z_]\w*\[\s*([A-Za-z_]\w*)\s*\]/i.exec(text);
    if (m) return `${m[1]} = ${index}`;
    if (owner?.variable && this.vars[owner.variable] === index) return `${owner.variable} = ${index}`;
    return `[${index}]`;
  }

  private moveCursor(cursor: IterationCursorState & { loopLine: number }, significance: OperationSignificance): void {
    this.cursors.set(cursor.depth, cursor);
    const el = this.elementAt(cursor.structureId, cursor.index);
    if (el) this.registerCamera([el], significance, 'CURSOR');
  }

  private emphasizeWindow(structureId: string, low: number, high: number): void {
    const inWindow = [low, high].map((i) => this.elementAt(structureId, i)).filter((e): e is ElementLike => !!e);
    if (inWindow.length > 0) this.registerCamera(inWindow, 'notable', 'WINDOW');
  }

  private registerCamera(elements: ElementLike[], significance: OperationSignificance, type: string): void {
    this.camera?.registerInstruction({ type, significance, participants: elements.map((e) => ({ ...e.position })) });
  }

  private say(text: string, emotion: CharacterEmotion, pointAt?: unknown): void {
    this.narrator?.say(text, { emotion, pointAt, durationMs: 2400 });
  }

  private pointAt(cursor: IterationCursorState): ElementLike | undefined {
    return this.elementAt(cursor.structureId, cursor.index);
  }

  private describeCell(index: number): { text: string; element: ElementLike } | null {
    const structureId = this.primaryStructure ?? this.firstArray();
    const el = structureId ? this.elementAt(structureId, index) : undefined;
    return el ? { text: `${structureId}[${index}] = ${formatValue(el.value)}`, element: el } : null;
  }

  private elementAt(structureId: string, index: number): ElementLike | undefined {
    return this.elements.find((e) => e.logicalParent === structureId && e.logicalIndex === index);
  }

  private firstArray(): string | null {
    const el = this.elements.find((e) => e.originalType === 'ARRAY_ELEMENT' && e.logicalParent);
    return el?.logicalParent ?? null;
  }

  private arrayLength(structureId: string): number {
    return this.elements.filter((e) => e.logicalParent === structureId && typeof e.logicalIndex === 'number').length;
  }

  /** Replaces `arr[expr]` with the cell's value and plain variable names with theirs: "marks[i] >= 60" -> "64 >= 60". */
  private substitute(expression: string): string {
    const withCells = expression.replace(/([A-Za-z_]\w*)\[([^\]]+)\]/g, (whole, arr: string, indexExpr: string) => {
      const index = this.evaluateIndex(indexExpr);
      if (index === null) return whole;
      const el = this.elementAt(arr, index);
      return el ? formatValue(el.value) : whole;
    });
    return withCells.replace(/\b([A-Za-z_]\w*)\b(?!\s*\()/g, (whole, name: string) => {
      if (/^(AND|OR|NOT|LENGTH|TRUE|FALSE)$/i.test(name)) return whole;
      const v = this.vars[name];
      return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? formatValue(v) : whole;
    });
  }

  /** `i`, `i + 1`, `mid - 1`, `3`: enough for the index expressions the examples use. */
  private evaluateIndex(expr: string): number | null {
    const m = /^\s*(?:([A-Za-z_]\w*)|(\d+))\s*(?:([+-])\s*(\d+))?\s*$/.exec(expr);
    if (!m) return null;
    const base = m[1] !== undefined ? this.vars[m[1]] : Number(m[2]);
    if (typeof base !== 'number') return null;
    const offset = m[4] !== undefined ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
    return base + offset;
  }

  private publish(): void {
    const cursors = [...this.cursors.values()]
      .sort((a, b) => a.depth - b.depth)
      .map(({ structureId, index, depth, label }) => ({ structureId, index, depth, label }));

    const windows: IterationWindowState[] = [];
    if (this.topic === 'searching') {
      const low = firstNumber(this.vars, LOW_NAMES);
      const high = firstNumber(this.vars, HIGH_NAMES);
      const structureId = this.primaryStructure ?? this.firstArray();
      if (low && high && structureId && low.value <= high.value) {
        const last = this.arrayLength(structureId) - 1;
        const startIndex = Math.max(0, low.value);
        const endIndex = Math.min(last, high.value);
        if (startIndex <= endIndex) {
          windows.push({ structureId, startIndex, endIndex, label: `${low.name} = ${low.value} … ${high.name} = ${high.value}` });
        }
      }
    }

    this.overlay = { cursors, windows };
    this.listeners.forEach((l) => l(this.overlay));
  }
}

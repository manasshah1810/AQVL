import { normalizeSemanticState } from '@aqvl/shared';
import { ExecutionEngine, type AQIRProgram } from '../core/ExecutionEngine';
import type { SceneElement } from '../models/SceneElement';
import { SnapTimelineEngine } from './SnapTimelineEngine';
import { classifyStep } from './classify';
import type {
  ExecutionTrace,
  TraceEdge,
  TraceEvent,
  TraceFrame,
  TraceLog,
  TraceNode,
  TraceShape,
  TraceStructure,
  Vec3,
} from './types';

export interface RecordTraceOptions {
  /** Most visible steps to record; the run stops (truncated) after this many. */
  maxSteps?: number;
  /** Most instructions to execute (guards against non-terminating loops). */
  maxInstructions?: number;
  /** Called every few hundred steps with the number recorded so far. */
  onProgress?: (steps: number) => void;
}

const DRAWN_SHAPES = new Set(['box', 'sphere', 'cylinder']);

const FAMILY_KIND: Record<string, string> = {
  ARRAY_ELEMENT: 'ARRAY',
  MATRIX_ELEMENT: 'MATRIX',
  GRID_ELEMENT: 'GRID',
  TREE_NODE: 'TREE',
  HEAP_NODE: 'HEAP',
  HEAP_ARRAY_ELEMENT: 'HEAP',
  VERTEX: 'GRAPH',
  LINKEDLIST_NODE: 'LINKED_LIST',
  STACK_ELEMENT: 'STACK',
  QUEUE_ELEMENT: 'QUEUE',
  HASHMAP_BUCKET: 'HASH_MAP',
  HASHMAP_ENTRY: 'HASH_MAP',
  TRIE_NODE: 'TRIE',
  CONTAINER_ITEM: 'CONTAINER',
  NODE: 'NODE',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : 'NaN';
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  return String(value);
}

function vec(v: { x: number; y: number; z: number } | undefined | null): Vec3 {
  return v ? { x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0 } : { x: 0, y: 0, z: 0 };
}

type AnyElement = SceneElement & Record<string, any>;

/**
 * Element positions the program itself asked for: the VM's resolved
 * position of an element whose structure has a LAYOUT statement, or that a
 * POSITION statement placed. (The compiler's default layouts carry no
 * source line; the runtime's own layout is the one shown for those.)
 */
interface PlacedPositions {
  positions: Record<string, Vec3>;
  explicit: Set<string>;
}

/** Pointer structures whose nodes come and go at run time: the runtime lays these out itself, the VM only knows their declared nodes. */
const RUNTIME_LAID_OUT = new Set(['TREE_NODE', 'HEAP_NODE', 'TRIE_NODE', 'LINKEDLIST_NODE']);

function restingPosition(el: AnyElement, placed: PlacedPositions | undefined): Vec3 {
  const vmPos = placed?.positions[el.id];
  if (vmPos && !RUNTIME_LAID_OUT.has(String(el.originalType)) && (placed!.explicit.has(el.id) || (el.logicalParent && placed!.explicit.has(el.logicalParent)))) return vec(vmPos);
  return vec(el.worldTarget ?? el.position);
}

function nodeCaption(el: AnyElement): string {
  const label = typeof el.label === 'string' ? el.label : '';
  // `arr[3]` under an array cell: the structure's name plate already says `arr`, so the cell shows its index.
  if (typeof el.logicalIndex === 'number' && el.logicalParent && label === `${el.logicalParent}[${el.logicalIndex}]`) {
    return String(el.logicalIndex);
  }
  return label;
}

function toNode(el: AnyElement, placed: PlacedPositions | undefined): TraceNode {
  const scale = vec(el.scale ?? { x: 1, y: 1, z: 1 });
  return {
    id: el.id,
    shape: (DRAWN_SHAPES.has(el.type) ? el.type : 'box') as TraceShape,
    family: String(el.originalType ?? el.type),
    structure: el.logicalParent,
    index: typeof el.logicalIndex === 'number' ? el.logicalIndex : undefined,
    text: formatValue(el.value),
    numeric: typeof el.value === 'number' && Number.isFinite(el.value) ? el.value : undefined,
    caption: nodeCaption(el),
    tags: Array.isArray(el.tags) ? el.tags.map(String) : [],
    tagPlacement: el.tagPlacement === 'below' ? 'below' : 'above',
    state: normalizeSemanticState(el.state),
    pos: restingPosition(el, placed),
    scale: { x: scale.x || 1, y: scale.y || 1, z: scale.z || 1 },
    opacity: typeof el.opacity === 'number' ? el.opacity : 1,
    detached: el.inHeap === true,
  };
}

function toEdge(el: AnyElement): TraceEdge {
  const label =
    el.originalType === 'GRAPH_EDGE' && el.properties?.label !== undefined && el.properties?.label !== null
      ? String(el.properties.label)
      : undefined;
  return {
    id: el.id,
    from: String(el.sourceId),
    to: String(el.targetId),
    directed: !!el.directed,
    pointer: el.pointer ? String(el.pointer) : undefined,
    label,
    structure: el.logicalParent,
    state: normalizeSemanticState(el.state),
  };
}

function isDrawnNode(el: AnyElement): boolean {
  if (!DRAWN_SHAPES.has(el.type)) return false;
  if (el.visible === false || el.lifecycleState === 'DESTROYED' || el.lifecycleState === 'REMOVING') return false;
  return (typeof el.opacity === 'number' ? el.opacity : 1) > 0.02;
}

function structuresOf(graph: AnyElement[], nodes: TraceNode[], placed: PlacedPositions | undefined): TraceStructure[] {
  const byName = new Map<string, TraceStructure>();
  const ensure = (name: string, kind: string): TraceStructure => {
    let s = byName.get(name);
    if (!s) {
      s = { name, kind, nodeIds: [] };
      byName.set(name, s);
    }
    return s;
  };
  for (const n of nodes) {
    if (!n.structure) continue;
    ensure(n.structure, FAMILY_KIND[n.family] ?? n.family).nodeIds.push(n.id);
  }
  for (const el of graph) {
    const name = el.logicalParent;
    if (!name) continue;
    switch (el.originalType) {
      case 'BINARYTREE': {
        const s = ensure(name, 'TREE');
        s.anchor = restingPosition(el, placed);
        if (!el.rootId) s.note = 'root = NULL';
        break;
      }
      case 'LINKEDLIST': {
        const s = ensure(name, 'LINKED_LIST');
        s.anchor = restingPosition(el, placed);
        if (!el.headId) s.note = 'head = NULL';
        break;
      }
      case 'CONTAINER': {
        const kind = el.kind === 'STACK' ? 'STACK' : 'QUEUE';
        const s = ensure(name, kind);
        s.kind = kind;
        s.anchor = restingPosition(el, placed);
        s.note = el.itemCount > 0 ? undefined : 'empty';
        break;
      }
      case 'GRAPH':
        ensure(name, 'GRAPH').note = [el.directed ? 'directed' : '', el.weighted ? 'weighted' : ''].filter(Boolean).join(' · ') || undefined;
        break;
      default:
        break;
    }
  }
  return [...byName.values()];
}

function callStackOf(graph: AnyElement[], engine: ExecutionEngine, params: Record<string, string[]>): string[] {
  const treeAnchor = graph.find((el) => el.originalType === 'BINARYTREE' && Array.isArray(el.callStack) && el.callStack.length > 0);
  if (treeAnchor) return (treeAnchor.callStack as unknown[]).map(String);
  const frames = engine.getVMState()?.frames ?? [];
  return frames.map((f) => {
    const names = params[f.functionName] ?? Object.keys(f.locals).slice(0, 3);
    const args = names.map((p) => `${p}=${formatValue(f.locals[p])}`).join(', ');
    return `${f.functionName}(${args})`;
  });
}

function primitiveVars(vars: Record<string, unknown>): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 48 && !/^(__|bt:|ll:|gv:|tr:)/.test(v)) out[k] = v;
  }
  return out;
}

function pickCaption(logs: TraceLog[], cue: string | null): string {
  const meaningful = logs.filter((l) => l.kind !== 'result');
  const chosen = meaningful[meaningful.length - 1] ?? logs[logs.length - 1];
  const text = chosen?.message ?? cue ?? '';
  return text.split('\n')[0].trim();
}

type ProgramInstruction = {
  lineNumber?: number;
  opcode?: string;
  action?: string;
  ops?: { kind: string; verb?: string; strategy?: string; target?: string; mode?: string }[];
};

const GEOMETRY_ACTIONS = new Set(['SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', 'SET_POSITION', 'SET_CAMERA', 'SET_ROTATION', 'SET_SCALE']);

/** What an instruction the runtime does not count as visible still means on screen: a WAIT beat, or a LAYOUT / POSITION / CAMERA change. */
function quietKind(instr: ProgramInstruction | undefined): 'hold' | 'geometry' | null {
  if (!instr) return null;
  if (instr.opcode === 'STEP') {
    const ops = instr.ops ?? [];
    if (ops.length === 0) return 'hold';
    return ops.every((op) => op.kind === 'TRANSFORM') ? 'geometry' : null;
  }
  if (instr.action === 'WAIT') return 'hold';
  return instr.action && GEOMETRY_ACTIONS.has(instr.action) ? 'geometry' : null;
}

function geometryCaption(instr: ProgramInstruction | undefined): string {
  const op = instr?.ops?.[0];
  if (op?.verb === 'arrange' || op?.verb === 'reflow') return op.strategy ? `LAYOUT ${op.target} AS ${op.strategy}` : `Layout of ${op.target} recomputed`;
  if (op?.verb === 'place') return `POSITION ${op.target ?? ''}: placed by hand`.trim();
  if (op?.verb === 'view') return `CAMERA ${op.mode ?? ''}`.trim();
  return 'Layout changed';
}

const INIT_EVENT: TraceEvent = { kind: 'init', actors: [], edges: [], writes: [] };

/**
 * Runs `program` to completion (headless, every animation landing instantly
 * on its final values) and records one TraceFrame per visible step, plus
 * one per WAIT and per LAYOUT / POSITION / CAMERA change.
 * Never throws: a runtime error ends the trace and is reported in `error`.
 */
export async function recordTrace(program: AQIRProgram, options: RecordTraceOptions = {}): Promise<ExecutionTrace> {
  const maxSteps = options.maxSteps ?? 4000;
  const engine = new ExecutionEngine({ headless: true, timelineEngine: new SnapTimelineEngine(150) });
  engine.setMaxExecutionIterations(options.maxInstructions ?? 200_000);

  const instructions = program.instructions as ProgramInstruction[];
  const explicitTargets = new Set<string>();
  for (const instr of instructions) {
    if (typeof instr.lineNumber !== 'number') continue;
    for (const op of instr.ops ?? []) {
      if (op.kind === 'TRANSFORM' && (op.verb === 'arrange' || op.verb === 'place') && op.target) explicitTargets.add(op.target);
    }
    const legacy = instr as ProgramInstruction & { targetId?: string; elementId?: string };
    if (instr.action === 'SET_LAYOUT_STRATEGY' && legacy.targetId) explicitTargets.add(legacy.targetId);
    if (instr.action === 'SET_POSITION' && legacy.elementId) explicitTargets.add(legacy.elementId);
  }
  const params: Record<string, string[]> = {};
  for (const [name, fn] of Object.entries(program.functionTable ?? {})) params[name] = fn.params;

  const frames: TraceFrame[] = [];
  const linesRun = new Set<number>();
  let currentLine: number | null = null;
  let startedPc = -1;
  let visibleThisInstruction = false;
  let pendingLogs: TraceLog[] = [];
  let pendingCue: string | null = null;
  let truncated = false;
  let error: ExecutionTrace['error'] = null;
  let geometryKey = '';

  let prevNodes = new Map<string, TraceNode>();
  let prevEdges = new Map<string, TraceEdge>();

  const keyOfGeometry = () => {
    const vm = engine.getVMState();
    return JSON.stringify([vm?.positions ?? null, vm?.camera ?? null]);
  };

  const build = (kind: 'initial' | 'step' | 'hold' | 'geometry'): TraceFrame => {
    const graph = engine.sceneManager.getSceneGraph() as AnyElement[];
    const vm = engine.getVMState();
    const placed: PlacedPositions | undefined = vm?.positions
      ? { positions: vm.positions as Record<string, Vec3>, explicit: explicitTargets }
      : undefined;
    const nodes = graph.filter(isDrawnNode).map((el) => toNode(el, placed));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph
      .filter((el) => el.type === 'edge' && el.visible !== false && el.lifecycleState !== 'DESTROYED')
      .map(toEdge)
      .filter((e) => ids.has(e.from) && ids.has(e.to));
    const state = engine.stateManager.getCurrentState();
    const logs = pendingLogs;
    let event: TraceEvent = INIT_EVENT;
    let caption = '';
    if (kind === 'hold') {
      event = { kind: 'hold', actors: [], edges: [], writes: [] };
      caption = 'WAIT: the scene holds for a beat';
    } else if (kind === 'geometry') {
      const base = classifyStep(prevNodes, nodes, prevEdges, edges, []);
      const movedIds = base.kind === 'move' ? base.actors : [];
      const cameraChanged = JSON.stringify(frames[frames.length - 1]?.camera ?? null) !== JSON.stringify(vm?.camera ?? null);
      event = { kind: movedIds.length > 0 || !cameraChanged ? 'layout' : 'camera', actors: movedIds, edges: [], writes: [] };
      caption = geometryCaption(instructions[startedPc]);
    } else if (kind === 'step') {
      event = classifyStep(prevNodes, nodes, prevEdges, edges, logs);
      caption = pickCaption(logs, pendingCue);
    }
    return {
      index: frames.length,
      line: kind === 'initial' ? null : currentLine,
      pc: kind === 'initial' || startedPc < 0 ? null : startedPc,
      event,
      caption,
      logs,
      nodes,
      edges,
      structures: structuresOf(graph, nodes, placed),
      regions: {
        partitions: (state?.partitionBoundaries ?? []).map((b) => ({
          structure: b.structureId,
          start: b.startIndex,
          end: b.endIndex,
          label: b.label,
          depth: b.depth,
        })),
        sorted: (state?.sortedRegions ?? []).map((r) => ({ structure: r.structureId, start: r.startIndex, end: r.endIndex })),
      },
      vars: primitiveVars(engine.getVisibleVariables()),
      callStack: callStackOf(graph, engine, params),
      camera: vm?.camera ? { ...vm.camera } : undefined,
    };
  };

  const commit = (frame: TraceFrame, replaceInitial = false) => {
    if (replaceInitial) frames[0] = { ...frame, index: 0, line: null, pc: null, event: INIT_EVENT, caption: '', logs: [] };
    else frames.push(frame);
    const last = frames[frames.length - 1];
    prevNodes = new Map(last.nodes.map((n) => [n.id, n]));
    prevEdges = new Map(last.edges.map((e) => [e.id, e]));
    pendingLogs = [];
    pendingCue = null;
    geometryKey = keyOfGeometry();
    if (frames.length % 250 === 0) options.onProgress?.(frames.length - 1);
    if (frames.length - 1 >= maxSteps) {
      truncated = true;
      engine.pause();
    }
  };

  engine.eventDispatcher.on('INSTRUCTION_START', (pc: number) => {
    startedPc = pc;
    visibleThisInstruction = false;
    const line = instructions[pc]?.lineNumber;
    if (typeof line === 'number') {
      currentLine = line;
      linesRun.add(line);
    }
  });
  engine.eventDispatcher.on('RUNTIME_LOG', (entry: { keyword?: string; message?: string; kind?: string }) => {
    pendingLogs.push({ keyword: String(entry.keyword ?? ''), message: String(entry.message ?? ''), kind: String(entry.kind ?? '') });
  });
  engine.eventDispatcher.on('NARRATIVE_CUE', (cue: { text: string }) => {
    pendingCue = cue.text;
  });
  engine.eventDispatcher.on('ANIMATED_STEP', () => {
    if (truncated) return;
    visibleThisInstruction = true;
    const frame = build('step');
    // The first step re-placing most of the scene is the runtime settling its
    // own layout, not something the program did: that is the starting picture.
    if (frames.length === 1 && frame.event.kind === 'move' && frame.event.actors.length * 2 >= frame.nodes.length) {
      const logs = pendingLogs;
      commit(frame, true);
      pendingLogs = logs;
      commit(build('step'));
      return;
    }
    commit(frame);
  });
  engine.eventDispatcher.on('INSTRUCTION_COMPLETE', () => {
    if (visibleThisInstruction || truncated) return;
    const quiet = quietKind(instructions[startedPc]);
    if (quiet === 'hold') {
      commit(build('hold'));
    } else if (quiet === 'geometry' && keyOfGeometry() !== geometryKey) {
      // LAYOUT / POSITION / CAMERA before anything has happened define the starting picture.
      if (frames.length === 1) commit(build('initial'), true);
      else commit(build('geometry'));
    }
  });

  try {
    engine.loadProgram(program);
    commit(build('initial'));
    await engine.execute();
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e), line: currentLine };
  }

  return { frames, error, truncated, linesRun: [...linesRun].sort((a, b) => a - b) };
}

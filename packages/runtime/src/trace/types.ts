/**
 * Execution trace: a program run once, headlessly, and recorded as one
 * frame per visible step. A renderer draws any moment of the run as a pure
 * function of (trace, time): frame k is the scene at rest after step k, and
 * the time between k and k+1 is step k+1's event playing out. Nothing about
 * playback depends on wall-clock time, frame rate, or what played before.
 */

import type { SemanticState } from '@aqvl/shared';
import type { CameraFrameState } from '../aqir/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type TraceShape = 'box' | 'sphere' | 'cylinder';

/** A drawn node: an array cell, a tree / heap / trie / list node, a graph vertex, a container item. */
export interface TraceNode {
  id: string;
  shape: TraceShape;
  /** The runtime's element family (ARRAY_ELEMENT, TREE_NODE, VERTEX, ...). */
  family: string;
  /** Owning structure name (`arr`, `t`, `g`), if any. */
  structure?: string;
  /** Position within its structure, for indexed structures. */
  index?: number;
  /** The value drawn on the node, already formatted. */
  text: string;
  /** The raw value, when it is a number (used for proportional height and comparisons). */
  numeric?: number;
  /** Secondary text under the node: `arr[3]`, `dist=4 parent=B`. */
  caption: string;
  /** Pointer variables / roles naming this node (HEAD, TOP, curr). */
  tags: string[];
  tagPlacement: 'above' | 'below';
  state: SemanticState;
  /** Resting position after this step. */
  pos: Vec3;
  scale: Vec3;
  opacity: number;
  /** Outside its structure: a list / tree node sitting in heap memory. */
  detached: boolean;
}

/** A drawn connection between two nodes. */
export interface TraceEdge {
  id: string;
  from: string;
  to: string;
  directed: boolean;
  /** `next` / `prev` for linked-list pointers. */
  pointer?: string;
  /** Text at the middle of the edge (a graph edge's weight). */
  label?: string;
  structure?: string;
  state: SemanticState;
}

/** A structure as a whole: what its name plate says and which nodes belong to it. */
export interface TraceStructure {
  name: string;
  /** ARRAY, TREE, GRAPH, LINKED_LIST, STACK, QUEUE, HEAP, HASH_MAP, TRIE, ... */
  kind: string;
  /** Extra words on the name plate: "root = NULL", "empty", "(stack)". */
  note?: string;
  nodeIds: string[];
  /** Where the structure's anchor sits (used for the name plate of an empty structure). */
  anchor?: Vec3;
}

export interface TraceRegions {
  /** Active partition boundaries (quick sort, merge sort), outermost first. */
  partitions: { structure: string; start: number; end: number; label?: string; depth: number }[];
  /** Confirmed-sorted ranges. */
  sorted: { structure: string; start: number; end: number }[];
}

/** What a step did, classified from the runtime's own state changes. */
export type TraceEventKind =
  | 'init'
  | 'compare'
  | 'swap'
  | 'write'
  | 'move'
  | 'create'
  | 'remove'
  | 'link'
  | 'traverse'
  | 'visit'
  | 'settle'
  | 'discard'
  | 'mark'
  | 'call'
  | 'return'
  | 'print'
  | 'assign'
  /** A LAYOUT / POSITION statement moved nodes. */
  | 'layout'
  /** A CAMERA statement changed the view. */
  | 'camera'
  /** WAIT: the scene holds still for a beat. */
  | 'hold'
  | 'none';

export interface TraceEvent {
  kind: TraceEventKind;
  /** The nodes this step is about, most important first. */
  actors: string[];
  /** Edges this step traversed / created / relaxed. */
  edges: string[];
  /** Nodes that changed value (for "old → new" readouts). */
  writes: { id: string; from: string; to: string }[];
  /** For a compare: the relation that held (`<`, `>`, `=`), when both sides are numbers. */
  relation?: '<' | '>' | '=';
  /** The runtime's keyword for the step (SWAP, COMPARE, PUSH, ...), from its log. */
  keyword?: string;
}

export interface TraceLog {
  keyword: string;
  message: string;
  kind: string;
}

export interface TraceFrame {
  index: number;
  /** Source line the step came from (1-based), if known. */
  line: number | null;
  /** Index of the program instruction that produced the step (null for the starting picture). */
  pc: number | null;
  event: TraceEvent;
  /** One sentence saying what just happened. */
  caption: string;
  logs: TraceLog[];
  nodes: TraceNode[];
  edges: TraceEdge[];
  structures: TraceStructure[];
  regions: TraceRegions;
  /** User variables visible at this point (numbers, strings, booleans only). */
  vars: Record<string, number | string | boolean>;
  /** Active calls, outermost first: `factorial(n=3)`. */
  callStack: string[];
  /** CAMERA statement in effect, if any. */
  camera?: CameraFrameState;
}

export interface ExecutionTrace {
  frames: TraceFrame[];
  /** Set when the run stopped on a runtime error (after the last recorded frame). */
  error: { message: string; line: number | null } | null;
  /** True when recording stopped at the step cap before the program finished. */
  truncated: boolean;
  /** Source lines that ever ran (for the editor's coverage gutter). */
  linesRun: number[];
}

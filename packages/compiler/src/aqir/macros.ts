/**
 * Compiler macros: every surface statement that used to compile to its own
 * AQIR opcode (SWAP_OBJECTS, LL_SET, MAP_PUT, TRIE_EDIT, ...) expands here
 * into a STEP of domain-neutral primitive ops. See
 * docs/design/aqir-primitives-spec.md §4 for the full table.
 *
 * Operands arrive already compiled / resolved by the generator (the same
 * values the old opcodes carried), so expansion never changes what the
 * runtime evaluates — only the vocabulary it is described in.
 *
 * Optional keys are copied only when present on the input (even with an
 * `undefined` value), so a STEP lowered back by the runtime's legacy bridge
 * is key-for-key identical to the instruction it replaces.
 */

import type {
  Address,
  CameraMode,
  GeometryParamValue,
  InvokeOp,
  LayoutStrategyName,
  Operand,
  PrimitiveOp,
  RelateOp,
  SetCameraInstruction,
  StepInstruction,
} from './InstructionSet';

const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** Copies each of `keys` from `from` onto a new object, only where `from` has the key. */
function pick<T extends object>(from: T, keys: (keyof T & string)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) if (has(from, key)) out[key] = from[key];
  return out;
}

/** Statement metadata a STEP carries alongside its ops. */
export interface StepMeta {
  lineNumber?: number;
  /** The statement as written, for console narration. */
  sourceText?: string;
}

/** Wraps `ops` into a STEP, copying `lineNumber` / `sourceText` only where given. */
export function step(ops: PrimitiveOp[], meta: StepMeta = {}): StepInstruction {
  return { opcode: 'STEP', ops, ...pick(meta, ['lineNumber', 'sourceText']) };
}

// ---------------------------------------------------------------------
// ANNOTATE
// ---------------------------------------------------------------------

/** COMPARE a b: the two entities are set against each other for this beat. */
export function compare(left: Operand, right: Operand): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'contrast', targets: [left, right] }];
}

/** A comparison link that stays shown until `hideComparisonLink`. */
export function showComparisonLink(a: Operand, b: Operand, options: { style?: string } = {}): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'contrast', targets: [a, b], persist: true, ...pick(options, ['style']) }];
}

export function hideComparisonLink(a: Operand, b: Operand): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'contrast', targets: [a, b], clear: true }];
}

/** HIGHLIGHT target color. */
export function highlight(target: Address, color: string | undefined): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'focus', targets: [target], color }];
}

/** HIGHLIGHT m[key] color: the member stored under `key`. */
export function highlightKey(collection: string, key: Operand, color: string | undefined): PrimitiveOp[] {
  return highlight({ at: 'key', collection, key }, color);
}

/** SET_STATE target state. */
export function setState(target: Address, state: string): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'state', targets: [target], state }];
}

/** A labelled boundary around `collection[start..end]`. */
export function setBoundary(collection: string, start: number, end: number, options: { label?: string } = {}): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'boundary', collection, range: [start, end], ...pick(options, ['label']) }];
}

export function clearBoundary(collection: string): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'boundary', collection, clear: true }];
}

/** `collection[start..end]` marked as a region in `state` (e.g. 'sorted'). */
export function markRegion(collection: string, start: number, end: number, state: string): PrimitiveOp[] {
  return [{ kind: 'ANNOTATE', verb: 'region', collection, range: [start, end], state }];
}

// ---------------------------------------------------------------------
// MUTATE
// ---------------------------------------------------------------------

/** SWAP a b: the two entities exchange contents. */
export function swap(left: Operand, right: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'exchange', target: left, with: right }];
}

/** `obj.field = value` — a named property (a pointer or a data field). */
export function setField(target: Operand, field: string, value: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'set', target, field, value }];
}

/** `arr[i] = value` / `UPDATE arr[i] value`: `ref` is the resolved slot, `index` the literal index (else undefined). */
export function setSlot(collection: string, ref: Operand, index: unknown, value: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'set', target: { at: 'slot', collection, ref, index }, value }];
}

/** `m[key] = value`. */
export function setKey(collection: string, key: Operand, value: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'set', target: { at: 'key', collection, key }, value }];
}

/** DELETE m[key]. */
export function destroyKey(collection: string, key: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'destroy', target: { at: 'key', collection, key } }];
}

/** NEW_NODE(collection, value): a new member, its reference bound to `bind`. */
export function create(collection: string, value: Operand, bind: string, assignTo: string | undefined): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'create', collection, value, bind, assignTo }];
}

/** FREE target. */
export function destroy(target: Operand): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'destroy', target }];
}

/** ADD_CHILD node label: a new entity, linked from `node` under `label`. */
export function addChild(node: Operand, label: Operand, nodeText: string): PrimitiveOp[] {
  return [
    { kind: 'MUTATE', verb: 'create' },
    { kind: 'RELATE', verb: 'link', source: node, target: { at: 'created', op: 0 }, label, texts: { source: nodeText } },
  ];
}

/** REMOVE_CHILD node label: the entity `node` reaches under `label` is destroyed. */
export function removeChild(node: Operand, label: Operand, nodeText: string): PrimitiveOp[] {
  return [{ kind: 'MUTATE', verb: 'destroy', target: { at: 'via', from: node, label }, texts: { from: nodeText } }];
}

// ---------------------------------------------------------------------
// RELATE
// ---------------------------------------------------------------------

/** LINK source target: a free-standing relation between two scene entities. */
export function link(source: Operand, target: Operand, directed: boolean | undefined, relationType: string | undefined): PrimitiveOp[] {
  return [{ kind: 'RELATE', verb: 'link', source, target, directed, label: relationType }];
}

/**
 * Positional operands of a collection edit, split into the ones `roles`
 * names and any beyond them (`extra`). Only operands actually given become
 * keys, so a short (malformed) list stays short when lowered.
 */
function operands<K extends string>(args: Operand[], roles: K[]): Partial<Record<K, Operand>> & { extra?: Operand[] } {
  const out: Partial<Record<K, Operand>> & { extra?: Operand[] } = {};
  roles.forEach((role, i) => {
    if (i < args.length) (out as Record<string, Operand>)[role] = args[i];
  });
  if (args.length > roles.length) out.extra = args.slice(roles.length);
  return out;
}

/**
 * ADD_VERTEX / REMOVE_VERTEX / ADD_EDGE / REMOVE_EDGE on graph `graph`, with
 * the edit's operands as written (arity errors stay the runtime's to report).
 */
export function graphEdit(op: string, graph: string, args: Operand[]): PrimitiveOp[] {
  switch (op) {
    case 'ADD_VERTEX': {
      const { key, extra } = operands(args, ['key']);
      return [{ kind: 'MUTATE', verb: 'create', collection: graph, ...(args.length > 0 ? { key } : {}), ...(extra ? { extra } : {}) }];
    }
    case 'REMOVE_VERTEX': {
      // Removing a vertex removes every edge touching it, then the vertex.
      const { key, extra } = operands(args, ['key']);
      const named = args.length > 0;
      return [
        { kind: 'RELATE', verb: 'unlink', collection: graph, ...(named ? { source: key } : {}), all: true } as RelateOp,
        { kind: 'MUTATE', verb: 'destroy', target: { at: 'key', collection: graph, ...(named ? { key } : {}) }, ...(extra ? { extra } : {}) },
      ];
    }
    case 'ADD_EDGE':
      return [{ kind: 'RELATE', verb: 'link', collection: graph, ...operands(args, ['source', 'target', 'weight']) }];
    case 'REMOVE_EDGE':
      return [{ kind: 'RELATE', verb: 'unlink', collection: graph, ...operands(args, ['source', 'target']) }];
    default:
      throw new Error(`No primitive expansion for graph edit "${op}".`);
  }
}

// ---------------------------------------------------------------------
// EMIT
// ---------------------------------------------------------------------

/** PRINT parts. */
export function print(parts: Operand[]): PrimitiveOp[] {
  return [{ kind: 'EMIT', verb: 'log', parts }];
}

// ---------------------------------------------------------------------
// TRANSFORM
// ---------------------------------------------------------------------

/** LAYOUT target AS strategy(params): records the strategy (a `reflow` materializes it). */
export function arrange(target: string, strategy: LayoutStrategyName, params: Record<string, GeometryParamValue>): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'arrange', target, strategy, params }];
}

/** Lays out `target` (a structure) with its current strategy; no target = the whole scene. */
export function reflow(target?: string): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'reflow', ...(target !== undefined ? { target } : {}) }];
}

/** POSITION target AT (x, y, z): pins the given axes; all null releases the pin. */
export function place(target: string, x: number | null, y: number | null, z: number | null): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'place', target, x, y, z }];
}

/** CAMERA mode(params). */
export function view(mode: CameraMode, params: SetCameraInstruction['params']): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'view', mode, params }];
}

export function orient(target: string, x: number, y: number, z: number): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'orient', target, x, y, z }];
}

export function scale(target: string, x: number, y: number, z: number): PrimitiveOp[] {
  return [{ kind: 'TRANSFORM', verb: 'scale', target, x, y, z }];
}

// ---------------------------------------------------------------------
// INVOKE (runtime procedure library)
// ---------------------------------------------------------------------

export interface InvokeOptions {
  subject?: string;
  scope?: { collection?: string; index?: unknown };
  bind?: string;
  assignTo?: string;
}

/**
 * A data-dependent library procedure (BUBBLE_SORT, PUSH, HASHMAP_INSERT,
 * INORDER, ...), expanded into primitives by the runtime when it runs.
 */
export function invoke(procedure: string, args: Operand[], options: InvokeOptions = {}): PrimitiveOp[] {
  const op: InvokeOp = { kind: 'INVOKE', procedure, args, ...pick(options, ['bind', 'assignTo', 'subject']) };
  if (options.scope) op.scope = pick(options.scope, ['collection', 'index']);
  return [op];
}

/** POP(s) / DEQUEUE(q) / PEEK(s) / FRONT(q) / REAR(q) read inside an expression, result bound to `bind`. */
export function containerRead(procedure: string, container: string, bind: string, assignTo: string | undefined): PrimitiveOp[] {
  return invoke(procedure, [container], { bind, assignTo });
}

// ---------------------------------------------------------------------
// Reference expansion of every former opcode
// ---------------------------------------------------------------------

/**
 * Expands one former action-based instruction into its STEP — the table of
 * spec §4 as code. The generator calls the builders above directly; this is
 * for tooling and for the round-trip tests (`lower(expandLegacy(x)) ≡ x`),
 * and covers the opcodes today's generator never emits too.
 */
export function expandLegacy(instr: { action: string; [field: string]: any }): StepInstruction {
  const meta = pick(instr, ['lineNumber', 'sourceText']) as StepMeta;
  const i = instr;
  switch (instr.action) {
    case 'COMPARE_OBJECTS':
      return step(compare(i.leftId, i.rightId), meta);
    case 'SHOW_COMPARISON_LINK':
      return step(showComparisonLink(i.elementIdA, i.elementIdB, pick(i, ['style']) as { style?: string }), meta);
    case 'HIDE_COMPARISON_LINK':
      return step(hideComparisonLink(i.elementIdA, i.elementIdB), meta);
    case 'SWAP_OBJECTS':
      return step(swap(i.leftId, i.rightId), meta);
    case 'HIGHLIGHT_OBJECT':
      return step(highlight(i.targetId, i.color), meta);
    case 'MAP_HIGHLIGHT':
      return step(highlightKey(i.map, i.key, i.color), meta);
    case 'SET_STATE':
      return step(setState(i.targetId, i.stateName), meta);
    case 'SET_PARTITION_BOUNDARY':
      return step(setBoundary(i.structureId, i.startIndex, i.endIndex, pick(i, ['label']) as { label?: string }), meta);
    case 'CLEAR_PARTITION_BOUNDARY':
      return step(clearBoundary(i.structureId), meta);
    case 'MARK_SORTED_REGION':
      return step(markRegion(i.structureId, i.startIndex, i.endIndex, 'sorted'), meta);
    case 'LINK_OBJECTS':
      return step(link(i.sourceId, i.targetId, i.directed, i.relationType), meta);
    case 'LL_SET':
      return step(setField(i.target, i.field, i.value), meta);
    case 'MAP_PUT':
      return step(setKey(i.map, i.key, i.value), meta);
    case 'MAP_DELETE':
      return step(destroyKey(i.map, i.key), meta);
    case 'LL_NEW':
      return step(create(i.list, i.value, i.resultVar, i.assignTo), meta);
    case 'LL_FREE':
      return step(destroy(i.target), meta);
    case 'TRIE_EDIT':
      return step(i.op === 'ADD_CHILD' ? addChild(i.node, i.ch, i.nodeText) : removeChild(i.node, i.ch, i.nodeText), meta);
    case 'GRAPH_EDIT':
      return step(graphEdit(i.op, i.graph, i.args), meta);
    case 'PRINT':
      return step(print(i.parts), meta);
    case 'WAIT':
      return step([], meta);
    case 'SET_LAYOUT_STRATEGY':
      return step(arrange(i.targetId, i.strategy, i.params), meta);
    case 'COMPUTE_LAYOUT':
      return step(reflow(i.targetId), meta);
    case 'UPDATE_LAYOUT':
      return step(reflow(), meta);
    case 'SET_POSITION':
      return step(place(i.elementId, i.x, i.y, i.z), meta);
    case 'SET_CAMERA':
      return step(view(i.mode, i.params), meta);
    case 'SET_ROTATION':
      return step(orient(i.elementId, i.x, i.y, i.z), meta);
    case 'SET_SCALE':
      return step(scale(i.elementId, i.x, i.y, i.z), meta);
    case 'CONTAINER_READ':
      return step(containerRead(i.op, i.container, i.resultVar, i.assignTo), meta);
    case 'GENERIC_ACTION': {
      const [ref, value] = i.args ?? [];
      const payload = i.payload ?? {};
      // `UPDATE arr[i] v` on a slot reference is a value write, like `arr[i] = v`.
      if (i.actionName === 'UPDATE' && isSlotUpdate(i)) {
        return step(setSlot(payload.logicalParent, ref, payload.logicalIndex, value), meta);
      }
      const options: InvokeOptions = {};
      if (has(i, 'targetId')) options.subject = i.targetId;
      if (has(i, 'payload')) {
        options.scope = { collection: payload.logicalParent, ...(has(payload, 'logicalIndex') ? { index: payload.logicalIndex } : {}) };
      }
      return step(invoke(i.actionName, i.args, options), meta);
    }
    default:
      throw new Error(`No primitive expansion for AQIR action "${instr.action}".`);
  }
}

/** The legacy `targetId` of a slot UPDATE: its reference when that is a static object id. */
export function slotSubject(ref: Operand): string | undefined {
  return typeof ref === 'string' && ref.includes('obj_') ? ref : undefined;
}

/** Whether `ref` is a runtime slot reference into `collection` (`arr#2`, `arr#i`). */
export function isSlotRef(ref: Operand, collection: string): boolean {
  return typeof ref === 'string' && ref.startsWith(`${collection}#`);
}

/** Whether a GENERIC_ACTION UPDATE writes one slot, in exactly the shape `setSlot` lowers back to. */
function isSlotUpdate(i: { [field: string]: any }): boolean {
  const payload = i.payload;
  return (
    Array.isArray(i.args) && i.args.length === 2 &&
    payload !== undefined && typeof payload.logicalParent === 'string' && isSlotRef(i.args[0], payload.logicalParent) &&
    has(payload, 'logicalIndex') && Object.keys(payload).length === 2 &&
    has(i, 'targetId') && i.targetId === slotSubject(i.args[0])
  );
}

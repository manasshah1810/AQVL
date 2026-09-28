/**
 * Legacy bridge (Phase 2.1): lowers a STEP of primitive ops back to the
 * action-based instruction AnimationController.executeInstruction has always
 * received, so the animation layer runs unchanged while the compiler emits
 * primitives. Deleted in Phase 2.2, when AnimationController consumes STEPs
 * directly. See docs/design/aqir-primitives-spec.md §4 and §6.
 *
 * The former opcode is chosen from the step's content alone — op kinds,
 * verbs, address forms and op count — never from a name tag. For each
 * composition the compiler's macros produce, `lowerStep` returns the
 * instruction the pre-2.1 generator emitted, key for key.
 */

import type { AQIRInstruction } from '@aqvl/shared';
import type { Address, InvokeOp, PrimitiveOp, RelateOp, StepInstruction } from './types';

export class UnsupportedStepError extends Error {
  constructor(step: StepInstruction) {
    super(`No legacy lowering for STEP ${JSON.stringify(step.ops)} (Phase 2.1 bridge covers the compositions in aqir-primitives-spec.md §4).`);
    this.name = 'UnsupportedStepError';
  }
}

type Legacy = AQIRInstruction & Record<string, unknown>;

const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

function addressKind(address: Address | undefined): 'slot' | 'key' | 'via' | 'created' | 'entity' {
  if (address !== null && typeof address === 'object' && typeof (address as { at?: unknown }).at === 'string') {
    return (address as { at: 'slot' | 'key' | 'via' | 'created' }).at;
  }
  return 'entity';
}

const field = (obj: object, key: string): any => (obj as Record<string, any>)[key];

/** The operands of a collection edit, in positional order: the named roles actually present, then any extras. */
function positional(op: object, roles: string[]): unknown[] {
  const out: unknown[] = [];
  for (const role of roles) {
    if (!has(op, role)) break;
    out.push(field(op, role));
  }
  return [...out, ...((field(op, 'extra') as unknown[] | undefined) ?? [])];
}

/** The `targetId` a slot UPDATE carried: its reference when that is a static object id. */
function slotSubject(ref: unknown): string | undefined {
  return typeof ref === 'string' && ref.includes('obj_') ? ref : undefined;
}

function lowerInvoke(op: InvokeOp): Legacy {
  if (has(op, 'bind')) {
    // A procedure read for its value inside an expression: POP(s), DEQUEUE(q), PEEK(s), ...
    return { action: 'CONTAINER_READ', op: op.procedure, container: op.args[0], resultVar: op.bind, assignTo: op.assignTo };
  }
  const legacy: Legacy = { action: 'GENERIC_ACTION', actionName: op.procedure };
  if (has(op, 'subject')) legacy.targetId = op.subject;
  legacy.args = op.args;
  if (op.scope) {
    legacy.payload = {
      logicalParent: op.scope.collection,
      ...(has(op.scope, 'index') ? { logicalIndex: op.scope.index } : {}),
    };
  }
  return legacy;
}

/** A single-op step. */
function lowerOp(op: PrimitiveOp): Legacy | null {
  const o = op as unknown as Record<string, any>;
  switch (op.kind) {
    case 'ANNOTATE': {
      const [first, second] = op.targets ?? [];
      switch (op.verb) {
        case 'contrast':
          if (op.persist) return { action: 'SHOW_COMPARISON_LINK', elementIdA: first, elementIdB: second, ...(has(op, 'style') ? { style: op.style } : {}) } as Legacy;
          if (op.clear) return { action: 'HIDE_COMPARISON_LINK', elementIdA: first, elementIdB: second } as Legacy;
          return { action: 'COMPARE_OBJECTS', leftId: first, rightId: second } as Legacy;
        case 'focus':
          if (addressKind(first) === 'key') {
            return { action: 'MAP_HIGHLIGHT', map: field(first as object, 'collection'), key: field(first as object, 'key'), color: op.color };
          }
          return { action: 'HIGHLIGHT_OBJECT', targetId: first, color: op.color } as Legacy;
        case 'state':
          return { action: 'SET_STATE', targetId: first, stateName: op.state } as Legacy;
        case 'boundary':
          if (op.clear) return { action: 'CLEAR_PARTITION_BOUNDARY', structureId: op.collection } as Legacy;
          return {
            action: 'SET_PARTITION_BOUNDARY',
            structureId: op.collection,
            startIndex: op.range?.[0],
            endIndex: op.range?.[1],
            ...(has(op, 'label') ? { label: op.label } : {}),
          } as Legacy;
        case 'region':
          if (op.state !== 'sorted') return null;
          return { action: 'MARK_SORTED_REGION', structureId: op.collection, startIndex: op.range?.[0], endIndex: op.range?.[1] } as Legacy;
      }
      return null;
    }

    case 'MUTATE':
      switch (op.verb) {
        case 'exchange':
          return { action: 'SWAP_OBJECTS', leftId: op.target, rightId: op.with } as Legacy;
        case 'set': {
          const target = op.target as Record<string, any>;
          switch (addressKind(op.target)) {
            case 'slot':
              return {
                action: 'GENERIC_ACTION',
                actionName: 'UPDATE',
                targetId: slotSubject(target.ref),
                args: [target.ref, op.value],
                payload: { logicalParent: target.collection, logicalIndex: target.index },
              };
            case 'key':
              return { action: 'MAP_PUT', map: target.collection, key: target.key, value: op.value };
            case 'entity':
              if (has(op, 'field')) return { action: 'LL_SET', target: op.target, field: op.field, value: op.value };
          }
          return null;
        }
        case 'create':
          if (has(op, 'bind')) {
            return { action: 'LL_NEW', list: op.collection, value: op.value, resultVar: op.bind, assignTo: op.assignTo };
          }
          if (has(op, 'collection')) return { action: 'GRAPH_EDIT', op: 'ADD_VERTEX', graph: op.collection, args: positional(op, ['key']) };
          return null;
        case 'destroy': {
          const target = op.target as Record<string, any>;
          switch (addressKind(op.target)) {
            case 'key':
              return { action: 'MAP_DELETE', map: target.collection, key: target.key };
            case 'via':
              return { action: 'TRIE_EDIT', op: 'REMOVE_CHILD', node: target.from, ch: target.label, nodeText: op.texts?.from };
            case 'entity':
              return { action: 'LL_FREE', target: op.target };
          }
          return null;
        }
      }
      return null;

    case 'RELATE':
      if (op.collection !== undefined) {
        return op.verb === 'link'
          ? { action: 'GRAPH_EDIT', op: 'ADD_EDGE', graph: op.collection, args: positional(op, ['source', 'target', 'weight']) }
          : { action: 'GRAPH_EDIT', op: 'REMOVE_EDGE', graph: op.collection, args: positional(op, ['source', 'target']) };
      }
      if (op.verb === 'link') {
        return { action: 'LINK_OBJECTS', sourceId: op.source, targetId: op.target, directed: op.directed, relationType: op.label } as Legacy;
      }
      return null;

    case 'EMIT':
      return { action: 'PRINT', parts: op.parts };

    case 'TRANSFORM':
      switch (op.verb) {
        case 'arrange':
          return { action: 'SET_LAYOUT_STRATEGY', targetId: o.target, strategy: o.strategy, params: o.params };
        case 'reflow':
          return has(op, 'target') ? { action: 'COMPUTE_LAYOUT', targetId: o.target } : { action: 'UPDATE_LAYOUT' };
        case 'place':
          return { action: 'SET_POSITION', elementId: o.target, x: o.x, y: o.y, z: o.z };
        case 'view':
          return { action: 'SET_CAMERA', mode: o.mode, params: o.params };
        case 'orient':
        case 'scale':
          return { action: op.verb === 'orient' ? 'SET_ROTATION' : 'SET_SCALE', elementId: o.target, x: o.x, y: o.y, z: o.z };
      }
      return null;

    case 'INVOKE':
      return lowerInvoke(op);
  }
  return null;
}

/** A two-op step: a trie child added, or a graph vertex removed with its edges. */
function lowerPair(first: PrimitiveOp, second: PrimitiveOp): Legacy | null {
  if (
    first.kind === 'MUTATE' && first.verb === 'create' && !has(first, 'collection') && !has(first, 'bind') &&
    second.kind === 'RELATE' && second.verb === 'link' && addressKind(second.target) === 'created'
  ) {
    return { action: 'TRIE_EDIT', op: 'ADD_CHILD', node: second.source, ch: second.label, nodeText: second.texts?.source };
  }
  if (
    first.kind === 'RELATE' && first.verb === 'unlink' && (first as RelateOp).all === true && first.collection !== undefined &&
    second.kind === 'MUTATE' && second.verb === 'destroy' && addressKind(second.target) === 'key'
  ) {
    return { action: 'GRAPH_EDIT', op: 'REMOVE_VERTEX', graph: first.collection, args: positional(second.target as object, ['key']).concat(second.extra ?? []) };
  }
  return null;
}

/** The action-based instruction `step` stands for, with its `lineNumber` / `sourceText` when it has them. */
export function lowerStep(step: StepInstruction): AQIRInstruction {
  const ops = step.ops;
  const legacy: Legacy | null =
    ops.length === 0 ? { action: 'WAIT' }
      : ops.length === 1 ? lowerOp(ops[0])
        : ops.length === 2 ? lowerPair(ops[0], ops[1])
          : null;
  if (!legacy) throw new UnsupportedStepError(step);
  if (has(step, 'sourceText')) legacy.sourceText = step.sourceText;
  if (has(step, 'lineNumber')) legacy.lineNumber = step.lineNumber;
  return legacy;
}

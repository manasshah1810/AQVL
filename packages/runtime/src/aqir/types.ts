/**
 * AQIR types, runtime side: the STEP / primitive-op model
 * (docs/design/aqir-primitives-spec.md) and the geometry shapes a STEP's
 * TRANSFORM ops lower to.
 *
 * Geometry AQIR types (LAYOUT / CAMERA / POSITION) — runtime side.
 *
 * This package intentionally does not depend on @aqvl/compiler (see
 * packages/runtime/src/types.ts's header comment for the established
 * pattern), so the 6 geometry instruction shapes are redeclared here
 * rather than imported — the two are kept in sync by convention with
 * packages/compiler/src/aqir/InstructionSet.ts. Both extend the existing
 * action-based `AQIRInstruction` from `@aqvl/shared`.
 *
 * `CameraFrameState` is the runtime-frame counterpart of `SetCameraInstruction`
 * (SceneState.camera — see docs/design/aqir-geometry-spec.md §2), consumed
 * by SceneState/AQVECanvas independent of the AQIR instruction stream
 * itself.
 */

import type { AQIRInstruction } from '@aqvl/shared';

export type LayoutStrategyName = 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM';

export type GeometryParamValue = number | string | [number, number, number];

export interface SetLayoutStrategyInstruction extends AQIRInstruction {
  action: 'SET_LAYOUT_STRATEGY';
  targetId: string;
  strategy: LayoutStrategyName;
  params: Record<string, GeometryParamValue>;
}

export interface SetPositionInstruction extends AQIRInstruction {
  action: 'SET_POSITION';
  elementId: string;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface ComputeLayoutInstruction extends AQIRInstruction {
  action: 'COMPUTE_LAYOUT';
  targetId: string;
}

export type CameraMode = 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';

export interface SetCameraInstruction extends AQIRInstruction {
  action: 'SET_CAMERA';
  mode: CameraMode;
  params: {
    targetId?: string;
    speed?: number;
    x?: number;
    y?: number;
    z?: number;
  };
}

export interface SetRotationInstruction extends AQIRInstruction {
  action: 'SET_ROTATION';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

export interface SetScaleInstruction extends AQIRInstruction {
  action: 'SET_SCALE';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

export type GeometryInstruction =
  | SetLayoutStrategyInstruction
  | SetPositionInstruction
  | ComputeLayoutInstruction
  | SetCameraInstruction
  | SetRotationInstruction
  | SetScaleInstruction;

/**
 * `SceneState.camera`'s shape — the resolved, current-frame counterpart of
 * the most recently executed SET_CAMERA instruction. Absent means AUTO_FIT
 * (today's always-on CameraRig behavior).
 */
export interface CameraFrameState {
  mode: CameraMode;
  targetId?: string;
  speed?: number;
  position?: { x: number; y: number; z: number };
}

// ---------------------------------------------------------------------
// STEP and the primitive ops — redeclared from
// packages/compiler/src/aqir/InstructionSet.ts (this package does not depend
// on @aqvl/compiler); tests/unit/aqir-primitives.test.ts checks the two
// vocabularies agree.
// ---------------------------------------------------------------------

/** The five effect kinds plus INVOKE (a call into the runtime's procedure library). */
export const PrimitiveKind = {
  MUTATE: 'MUTATE',
  TRANSFORM: 'TRANSFORM',
  RELATE: 'RELATE',
  ANNOTATE: 'ANNOTATE',
  EMIT: 'EMIT',
  INVOKE: 'INVOKE',
} as const;
export type PrimitiveKind = (typeof PrimitiveKind)[keyof typeof PrimitiveKind];

/** The closed verb list of each kind (INVOKE names a procedure instead). */
export const PRIMITIVE_VERBS = {
  MUTATE: ['set', 'exchange', 'create', 'destroy'],
  TRANSFORM: ['arrange', 'reflow', 'place', 'view', 'orient', 'scale'],
  RELATE: ['link', 'unlink'],
  ANNOTATE: ['focus', 'contrast', 'state', 'boundary', 'region'],
  EMIT: ['log'],
} as const;

/**
 * A compiled AQIR value (literal, variable name, `{ text }`, `{ op, left,
 * right }`, `{ member, object }`, `{ elem, index }`, `{ gfn, args }`,
 * `{ len }`) or a resolved entity reference (`obj_003`, `arr#i`,
 * `@expr:...`), evaluated by the host when the step runs.
 */
export type Operand = unknown;

/** Position `index` of ordered collection `collection` (`arr[i]`); `ref` is the resolved slot reference. */
export interface SlotAddress {
  at: 'slot';
  collection: string;
  ref: Operand;
  /** The index when it is a literal in source; `undefined` when computed at run time from `ref`. */
  index: unknown;
}

/** The member of keyed collection `collection` stored under `key` (`m[k]`, a graph vertex by name). */
export interface KeyAddress {
  at: 'key';
  collection: string;
  key?: Operand;
}

/** The entity reached from `from` along the relation labelled `label` (a trie child). */
export interface ViaAddress {
  at: 'via';
  from: Operand;
  label: Operand;
}

/** The entity created by op number `op` of the same STEP. */
export interface CreatedAddress {
  at: 'created';
  op: number;
}

/** What an op acts on: an entity operand, or a tagged address. */
export type Address = Operand | SlotAddress | KeyAddress | ViaAddress | CreatedAddress;

interface OpBase {
  /** How operands were written in source (e.g. `{ source: 'curr' }`), for error messages. */
  texts?: Record<string, string>;
  /** User-supplied operands beyond the verb's arity, passed through for the host to reject. */
  extra?: Operand[];
}

export interface MutateSetOp extends OpBase {
  kind: 'MUTATE';
  verb: 'set';
  target: Address;
  /** A named property of the target (`node.next`); omitted = the target's own value. */
  field?: string;
  value: Operand;
}

export interface MutateExchangeOp extends OpBase {
  kind: 'MUTATE';
  verb: 'exchange';
  target: Address;
  with: Address;
}

export interface MutateCreateOp extends OpBase {
  kind: 'MUTATE';
  verb: 'create';
  /** The collection gaining the member; omitted = the structure of the entity it is linked from. */
  collection?: string;
  key?: Operand;
  value?: Operand;
  /** Variable receiving the new entity's reference. */
  bind?: string;
  /** Display hint: the user variable `bind` is assigned to next. */
  assignTo?: string;
}

export interface MutateDestroyOp extends OpBase {
  kind: 'MUTATE';
  verb: 'destroy';
  target: Address;
}

export type MutateOp = MutateSetOp | MutateExchangeOp | MutateCreateOp | MutateDestroyOp;

export interface TransformArrangeOp extends OpBase {
  kind: 'TRANSFORM';
  verb: 'arrange';
  target: string;
  strategy: LayoutStrategyName;
  params: Record<string, GeometryParamValue>;
}

export interface TransformReflowOp extends OpBase {
  kind: 'TRANSFORM';
  verb: 'reflow';
  /** The structure to lay out; omitted = the whole scene. */
  target?: string;
}

export interface TransformPlaceOp extends OpBase {
  kind: 'TRANSFORM';
  verb: 'place';
  target: string;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface TransformViewOp extends OpBase {
  kind: 'TRANSFORM';
  verb: 'view';
  mode: CameraMode;
  params: SetCameraInstruction['params'];
}

export interface TransformOrientOp extends OpBase {
  kind: 'TRANSFORM';
  verb: 'orient' | 'scale';
  target: string;
  x: number;
  y: number;
  z: number;
}

export type TransformOp = TransformArrangeOp | TransformReflowOp | TransformPlaceOp | TransformViewOp | TransformOrientOp;

export interface RelateOp extends OpBase {
  kind: 'RELATE';
  verb: 'link' | 'unlink';
  source?: Address;
  target?: Address;
  /** `unlink` only: every relation of `source` (in `collection`), not one to `target`. */
  all?: boolean;
  /** The relation belongs to this collection's own edge set (a graph). */
  collection?: string;
  label?: Operand;
  directed?: boolean;
  weight?: Operand;
}

export interface AnnotateOp extends OpBase {
  kind: 'ANNOTATE';
  verb: 'focus' | 'contrast' | 'state' | 'boundary' | 'region';
  targets?: Address[];
  color?: string;
  state?: string;
  /** contrast: stays shown until cleared. */
  persist?: boolean;
  /** contrast / boundary: removes an earlier persistent mark. */
  clear?: boolean;
  style?: string;
  /** boundary / region: the collection the range indexes. */
  collection?: string;
  range?: [number, number];
  label?: string;
}

export interface EmitOp extends OpBase {
  kind: 'EMIT';
  verb: 'log';
  parts: Operand[];
}

/** Runs a named runtime library procedure (BUBBLE_SORT, PUSH, HASHMAP_INSERT, ...). */
export interface InvokeOp extends OpBase {
  kind: 'INVOKE';
  procedure: string;
  args: Operand[];
  /** Variable receiving the procedure's result (reads such as POP(s) in an expression). */
  bind?: string;
  assignTo?: string;
  /** The static object the call is about, when known at compile time. */
  subject?: string;
  /** The collection (and literal index) the call is scoped to. */
  scope?: { collection?: string; index?: unknown };
}

export type PrimitiveOp = MutateOp | TransformOp | RelateOp | AnnotateOp | EmitOp | InvokeOp;

/** One visible beat: `ops` applied in order. `ops: []` is a beat where nothing changes (WAIT). */
export interface StepInstruction {
  opcode: 'STEP';
  ops: PrimitiveOp[];
  lineNumber?: number;
  /** The statement as written, for console narration. */
  sourceText?: string;
}

export function isStepInstruction(instr: unknown): instr is StepInstruction {
  return instr !== null && typeof instr === 'object' && (instr as { opcode?: unknown }).opcode === 'STEP';
}

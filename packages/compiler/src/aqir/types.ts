/**
 * AQIR types.
 *
 * The instruction set (kernel opcodes + STEP of primitive ops, see
 * docs/design/aqir-primitives-spec.md), the program shape the generator
 * returns, and the runtime data shapes (`FrameInfo`, `RuntimeEnvironment`).
 * The legacy action-based types from `@aqvl/shared` are re-exported
 * unchanged: they are the form the runtime's legacy bridge lowers a STEP to.
 */

// --- Backward compatibility: re-export the existing action-based AQIR types unchanged. ---
import type { AQIRObject } from '@aqvl/shared';
export type {
  AQIRObject,
  AQIRInstruction,
  CompareObjectsInstruction,
  SwapObjectsInstruction,
  HighlightObjectInstruction,
  WaitInstruction,
  LinkObjectsInstruction,
  LoopInstruction,
  GenericActionInstruction,
  SetStateInstruction,
  UpdateLayoutInstruction,
} from '@aqvl/shared';

// --- Instruction set: kernel opcodes + STEP of primitive ops. ---
import type { ControlFlowInstruction, StepInstruction } from './InstructionSet';
export {
  AQIROpcode,
  LegacyAction,
  PrimitiveKind,
  PRIMITIVE_VERBS,
} from './InstructionSet';
export type {
  SourceLocation,
  Instruction,
  AQIRValue,
  JumpInstruction,
  JumpIfFalseInstruction,
  CallInstruction,
  RetInstruction,
  PushScopeInstruction,
  PopScopeInstruction,
  SetVarInstruction,
  ControlFlowInstruction,
  LayoutStrategyName,
  GeometryParamValue,
  SetLayoutStrategyInstruction,
  SetPositionInstruction,
  ComputeLayoutInstruction,
  CameraMode,
  SetCameraInstruction,
  SetRotationInstruction,
  SetScaleInstruction,
  GeometryInstruction,
  Operand,
  Address,
  SlotAddress,
  KeyAddress,
  ViaAddress,
  CreatedAddress,
  MutateOp,
  MutateSetOp,
  MutateExchangeOp,
  MutateCreateOp,
  MutateDestroyOp,
  TransformOp,
  TransformArrangeOp,
  TransformReflowOp,
  TransformPlaceOp,
  TransformViewOp,
  TransformOrientOp,
  RelateOp,
  AnnotateOp,
  EmitOp,
  InvokeOp,
  PrimitiveOp,
  StepInstruction,
} from './InstructionSet';

/**
 * Any instruction the generator emits: one of the 7 kernel (control-flow)
 * opcodes, or a STEP of primitive ops (docs/design/aqir-primitives-spec.md).
 * Assignable to the runtime package's `VMInstruction`
 * (packages/runtime/src/types.ts), which additionally still accepts
 * hand-written legacy action instructions.
 */
export type VMInstruction = ControlFlowInstruction | StepInstruction;

/**
 * Replacement for `@aqvl/shared`'s `AQIRProgram`: identical except
 * `instructions` holds kernel opcodes and STEPs instead of legacy
 * action-based instructions.
 */
export interface AQIRProgram {
  version: string;
  scene: string;
  objects: AQIRObject[];
  instructions: VMInstruction[];
  /**
   * User-defined functions declared in the scene, keyed by name — the
   * runtime-ready form of the generator's compile-time `FunctionTable`
   * (see `../codegen/functionTable.ts`), suitable to pass directly as
   * `@aqvl/runtime`'s `FunctionTable` to `createVM`/`runVM`.
   */
  functionTable: Record<string, { name: string; params: string[]; entryAddress: number }>;
}

/**
 * A single function-call activation record.
 *
 * Pushed by CALL, popped by RET. `locals` holds the callee's parameter and
 * local-variable bindings for the duration of the call; `scope` is the
 * scope id most recently pushed via PUSH_SCOPE inside this frame (used to
 * unwind orphaned scopes if a RET happens before a matching POP_SCOPE).
 */
export interface FrameInfo {
  functionName: string;
  locals: Record<string, unknown>;
  /** Instruction index to resume at in the caller after RET. */
  returnAddress: number;
  scope: string;
}

/**
 * Full runtime state for one execution of an AQIR program under VM mode.
 *
 * `frames` is the call stack (innermost frame last), `globals` holds
 * top-level/scene-level variable bindings outside any function, and `pc`
 * is the index of the next instruction to execute in the current
 * instruction array.
 */
export interface RuntimeEnvironment {
  frames: FrameInfo[];
  globals: Record<string, unknown>;
  pc: number;
}

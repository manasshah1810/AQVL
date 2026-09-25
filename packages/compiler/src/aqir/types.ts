/**
 * AQIR types — VM Mode extension.
 *
 * Re-exports the existing (compile-time) AQIR types from `@aqvl/shared`
 * unchanged for backward compatibility, and adds the new VM-mode
 * instruction types plus the runtime data shapes (`FrameInfo`,
 * `RuntimeEnvironment`) needed to execute them.
 *
 * Design-only: nothing here is consumed by the Optimizer or
 * AnimationController yet.
 */

// --- Backward compatibility: re-export the existing action-based AQIR types unchanged. ---
import type {
  AQIRObject,
  AQIRInstruction,
} from '@aqvl/shared';
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

// --- New: VM-mode instruction set (control flow). ---
import type { ControlFlowInstruction, GeometryInstruction } from './InstructionSet';
export {
  AQIROpcode,
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
} from './InstructionSet';

/**
 * Any instruction the generator may emit under VM mode: a "legacy"
 * action-based instruction (COMPARE_OBJECTS, SWAP_OBJECTS, ...), one of the
 * 6 control-flow opcodes, or one of the 6 geometry opcodes (LAYOUT/CAMERA/
 * POSITION) from ./InstructionSet. Mirrors the runtime package's
 * `VMInstruction` (packages/runtime/src/types.ts) — kept in sync by
 * convention since the runtime does not depend on @aqvl/compiler.
 */
export type VMInstruction = AQIRInstruction | ControlFlowInstruction | GeometryInstruction;

/**
 * VM-mode replacement for `@aqvl/shared`'s `AQIRProgram`: identical except
 * `instructions` now accepts control-flow opcodes alongside legacy
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

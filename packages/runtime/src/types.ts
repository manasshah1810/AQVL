/**
 * VM-mode runtime types.
 *
 * These are additive: the existing action-based `AQIRInstruction` model from
 * `@aqvl/shared` (COMPARE_OBJECTS, SWAP_OBJECTS, ...) keeps working exactly
 * as before. A `VMInstruction` is either one of those "legacy" instructions
 * (still animated by AnimationController.executeInstruction) or one of the
 * 6 new control-flow opcodes handled by AQVLVirtualMachine itself.
 *
 * This package intentionally does not depend on @aqvl/compiler, so the
 * opcode set is redeclared here rather than imported — the two are kept in
 * sync by convention (see packages/compiler/src/aqir/InstructionSet.ts).
 *
 * `AQIROpcode` is a `const` object + derived literal-union type rather than
 * a TS `enum`: string enums are nominally typed, so instructions built with
 * the compiler's separately-declared `AQIROpcode` would NOT structurally
 * match this one even with identical member names/values, which would force
 * every caller across the package boundary to cast. Plain string-literal
 * types compare structurally, so they don't.
 */

import type { AQIRInstruction } from '@aqvl/shared';
import type { CameraFrameState } from './aqir/types';

/** The 6 opcodes AQVLVirtualMachine executes directly (as opposed to delegating to animation). */
export const AQIROpcode = {
  JUMP: 'JUMP',
  JUMP_IF_FALSE: 'JUMP_IF_FALSE',
  CALL: 'CALL',
  RET: 'RET',
  PUSH_SCOPE: 'PUSH_SCOPE',
  POP_SCOPE: 'POP_SCOPE',
  SET_VAR: 'SET_VAR',
} as const;
export type AQIROpcode = (typeof AQIROpcode)[keyof typeof AQIROpcode];

interface ControlFlowInstructionBase {
  opcode: AQIROpcode;
  lineNumber?: number;
}

export interface JumpInstruction extends ControlFlowInstructionBase {
  opcode: 'JUMP';
  /** Absolute index into the instruction array to jump to. */
  target: number;
}

export interface JumpIfFalseInstruction extends ControlFlowInstructionBase {
  opcode: 'JUMP_IF_FALSE';
  /** Absolute index to jump to when `condition` evaluates falsy. */
  target: number;
  /** Variable name or literal, resolved via evaluateExpression at runtime. */
  condition: unknown;
}

export interface CallInstruction extends ControlFlowInstructionBase {
  opcode: 'CALL';
  functionName: string;
  /** Positional args (variable names or literals), matching the callee's declared params. */
  args: unknown[];
  /** Temp variable (in the caller's scope) to store the return value into once RET pops this call's frame. */
  resultVar?: string;
}

export interface RetInstruction extends ControlFlowInstructionBase {
  opcode: 'RET';
  returnValue?: unknown;
}

export interface PushScopeInstruction extends ControlFlowInstructionBase {
  opcode: 'PUSH_SCOPE';
  scopeId: string;
}

export interface PopScopeInstruction extends ControlFlowInstructionBase {
  opcode: 'POP_SCOPE';
}

export interface SetVarInstruction extends ControlFlowInstructionBase {
  opcode: 'SET_VAR';
  name: string;
  /** Variable name, literal, or {op,left,right} tree, resolved via evaluateExpression. */
  value: unknown;
}

export type ControlFlowInstruction =
  | JumpInstruction
  | JumpIfFalseInstruction
  | CallInstruction
  | RetInstruction
  | PushScopeInstruction
  | PopScopeInstruction
  | SetVarInstruction;

/** Any instruction the VM's instruction stream may contain. */
export type VMInstruction = AQIRInstruction | ControlFlowInstruction;

const CONTROL_FLOW_OPCODES: Set<string> = new Set(Object.values(AQIROpcode));

export function isControlFlowInstruction(instr: VMInstruction): instr is ControlFlowInstruction {
  return typeof (instr as ControlFlowInstruction).opcode === 'string'
    && CONTROL_FLOW_OPCODES.has((instr as ControlFlowInstruction).opcode);
}

/** A function's static signature + entry point, as known before execution starts. */
export interface FunctionDef {
  name: string;
  /** Parameter names, in declaration order — bound to CALL's `args` positionally. */
  params: string[];
  /** Instruction index of the function body's first instruction. */
  entryAddress: number;
}

export type FunctionTable = Record<string, FunctionDef>;

/** One call-stack activation record. */
export interface FrameInfo {
  functionName: string;
  /** Parameter/local bindings for this call (the frame's base scope). */
  locals: Record<string, unknown>;
  /** Instruction index to resume at in the caller after RET. */
  returnAddress: number;
  /** Id of the innermost scope currently pushed within this frame. */
  scope: string;
}

export interface ResolvedPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Per-structure layout bookkeeping the VM accumulates from SET_LAYOUT_STRATEGY
 * (see docs/design/aqir-geometry-spec.md §1.1) — the strategy/params most
 * recently set for a structure, materialized into `VMState.positions` by the
 * next COMPUTE_LAYOUT.
 */
export interface StructureLayoutState {
  strategy: string;
  params: Record<string, unknown>;
}

/** A snapshot of the VM's full state at a point in time. */
export interface VMState {
  pc: number;
  frames: FrameInfo[];
  globals: Record<string, unknown>;
  /** NEW — resolved element positions as of this point (elementId -> {x,y,z}), from SET_LAYOUT_STRATEGY/COMPUTE_LAYOUT/SET_POSITION. Absent/empty if no geometry instruction has run yet. */
  positions?: Record<string, ResolvedPosition>;
  /** NEW — current camera mode/params from the most recent SET_CAMERA. Absent = AUTO_FIT (see docs/design/aqir-geometry-spec.md §2). */
  camera?: CameraFrameState;
}

/** One recorded execution step, captured for animation/debugging/timeline playback. */
export interface ExecutionFrame {
  /** Monotonically increasing step counter (not the same as `state.pc`, which can jump/repeat). */
  index: number;
  instruction: VMInstruction;
  state: VMState;
}

export interface ExecutionResult {
  /** True if the VM ran off the end of the instruction stream; false if it stopped early (paused). */
  completed: boolean;
  returnValue?: unknown;
  executionSteps: ExecutionFrame[];
  finalState: VMState;
}

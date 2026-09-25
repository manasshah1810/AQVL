/**
 * AQIR Instruction Set — VM Mode extension.
 *
 * Phase 1 design surface for dynamic execution. This file introduces a
 * discriminated-union instruction model (`AQIROpcode` + per-opcode
 * interfaces) alongside the existing string-`action`-based instructions in
 * `@aqvl/shared` (packages/shared/src/aqir/types.ts).
 *
 * IMPORTANT: this is a design-only addition. Nothing here is wired into the
 * Optimizer, AQIRGenerator, or AnimationController yet — see Phase 2/1.4.
 * The `AQIROpcode` enum mirrors every existing `action` string so a future
 * migration can move instructions onto this model without renaming them,
 * plus the 6 new opcodes needed for runtime control flow.
 */

/**
 * Every opcode AQIR can emit, existing (compile-time-unrolled) actions
 * first, then the new VM-mode opcodes.
 *
 * Deliberately a `const` object + derived literal-union type rather than a
 * TS `enum`: string enums are nominally typed, so a value built from an
 * `enum` declared here would NOT structurally match the equivalent
 * `AQIROpcode` re-declared in `packages/runtime/src/types.ts` (which can't
 * import this one — see that file's header comment) even with identical
 * member names/values. Plain string-literal types compare structurally, so
 * instructions built with this object flow into the runtime's `VMInstruction`
 * without a cast.
 */
export const AQIROpcode = {
  // --- Existing opcodes (mirror of AQIRInstruction['action'] in @aqvl/shared) ---
  COMPARE_OBJECTS: 'COMPARE_OBJECTS',
  SWAP_OBJECTS: 'SWAP_OBJECTS',
  HIGHLIGHT_OBJECT: 'HIGHLIGHT_OBJECT',
  WAIT: 'WAIT',
  LINK_OBJECTS: 'LINK_OBJECTS',
  LOOP: 'LOOP',
  GENERIC_ACTION: 'GENERIC_ACTION',
  SET_STATE: 'SET_STATE',
  UPDATE_LAYOUT: 'UPDATE_LAYOUT',
  SHOW_COMPARISON_LINK: 'SHOW_COMPARISON_LINK',
  HIDE_COMPARISON_LINK: 'HIDE_COMPARISON_LINK',
  SET_PARTITION_BOUNDARY: 'SET_PARTITION_BOUNDARY',
  CLEAR_PARTITION_BOUNDARY: 'CLEAR_PARTITION_BOUNDARY',
  MARK_SORTED_REGION: 'MARK_SORTED_REGION',

  // --- New opcodes: runtime control flow (VM mode) ---
  JUMP: 'JUMP',
  JUMP_IF_FALSE: 'JUMP_IF_FALSE',
  CALL: 'CALL',
  RET: 'RET',
  PUSH_SCOPE: 'PUSH_SCOPE',
  POP_SCOPE: 'POP_SCOPE',
  SET_VAR: 'SET_VAR',
} as const;
export type AQIROpcode = (typeof AQIROpcode)[keyof typeof AQIROpcode];

/** Where an instruction came from in the original .aqvl source, for error messages and debugging. */
export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

/**
 * Base shape every AQIR instruction carries under the VM-mode model.
 * Existing action-based instructions do not implement this yet — it applies
 * only to instructions authored against `AQIROpcode`.
 */
export interface Instruction {
  opcode: AQIROpcode;
  /** 1-based source line, kept separate from `sourceLocation` for quick display in traces. */
  lineNumber: number;
  sourceLocation: SourceLocation;
}

/**
 * A value that can be used as a jump/branch condition or an argument/return
 * value. Left intentionally loose — parameter/return type checking is
 * Phase 2 (see SCOPE LIMITS).
 */
export type AQIRValue = unknown;

/**
 * JUMP — unconditional jump to an absolute instruction index in the
 * enclosing instruction stream.
 *
 * `target` is the index of the instruction to execute next; the VM sets
 * `pc = target` instead of falling through to `pc + 1`.
 */
export interface JumpInstruction extends Instruction {
  opcode: 'JUMP';
  /** Absolute index into the current instruction array to jump to. */
  target: number;
}

/**
 * JUMP_IF_FALSE — conditional jump used to compile `while` and `if`.
 *
 * If `condition` evaluates to falsy at runtime, the VM sets `pc = target`;
 * otherwise execution falls through to the next instruction. `condition` is
 * an AQIR expression reference (e.g. a symbol name or comparison result id)
 * rather than a literal, since it must be re-evaluated at runtime for loops.
 */
export interface JumpIfFalseInstruction extends Instruction {
  opcode: 'JUMP_IF_FALSE';
  /** Absolute index to jump to when the condition is falsy. */
  target: number;
  /** Reference to the runtime-evaluated condition (symbol name, object id, or comparison result). */
  condition: AQIRValue;
}

/**
 * CALL — invoke a user-defined function.
 *
 * Pushes a new call frame (see `FrameInfo` in ./types) recording the return
 * address, transfers control to the function's entry instruction, and binds
 * `args` to the callee's parameter names in its scope.
 */
export interface CallInstruction extends Instruction {
  opcode: 'CALL';
  /** Name of the function being invoked, as declared in the function table. */
  functionName: string;
  /** Evaluated/reference arguments, positional, matching the callee's parameter order. */
  args: AQIRValue[];
  /**
   * Name of a fresh temp variable (unique per call site) to store the
   * callee's return value into, in the *caller's* scope, once RET pops the
   * callee's frame. Lets a call nested inside a larger expression (e.g.
   * `fib(n-1) + fib(n-2)`) be re-read by name after control returns, instead
   * of colliding on a single shared "last return value" slot.
   */
  resultVar?: string;
}

/**
 * RET — return from the current function.
 *
 * Pops the active call frame and resumes execution at that frame's
 * `returnAddress`. `returnValue` is optional to support void functions.
 */
export interface RetInstruction extends Instruction {
  opcode: 'RET';
  returnValue?: AQIRValue;
}

/**
 * PUSH_SCOPE — open a new variable scope (function body, loop body, block).
 *
 * `scopeId` must be unique within the enclosing function/program so
 * PUSH_SCOPE/POP_SCOPE pairs can be matched during validation.
 */
export interface PushScopeInstruction extends Instruction {
  opcode: 'PUSH_SCOPE';
  scopeId: string;
}

/**
 * POP_SCOPE — discard the innermost variable scope, returning to the
 * enclosing one. Takes no arguments: it always pops whatever PUSH_SCOPE
 * pushed most recently.
 */
export interface PopScopeInstruction extends Instruction {
  opcode: 'POP_SCOPE';
}

/**
 * SET_VAR — store a computed value into a named variable (local if declared
 * in the current frame's scope chain, global otherwise), resolved the same
 * way `setVariable` resolves any other write. Used to compile assignment
 * statements (`x = expr`) and the LOOP iterator's init/increment, which
 * otherwise had no way to actually mutate state under the VM model.
 */
export interface SetVarInstruction extends Instruction {
  opcode: 'SET_VAR';
  name: string;
  /** Expression tree (literal, variable name, or {op,left,right}), resolved via evaluateExpression at runtime. */
  value: AQIRValue;
}

/** Union of the 7 new VM-mode instructions. */
export type ControlFlowInstruction =
  | JumpInstruction
  | JumpIfFalseInstruction
  | CallInstruction
  | RetInstruction
  | PushScopeInstruction
  | PopScopeInstruction
  | SetVarInstruction;

// ---------------------------------------------------------------------
// Geometry opcodes (LAYOUT / CAMERA / POSITION) — see
// docs/design/aqir-geometry-spec.md for field/timing rationale.
//
// Unlike the control-flow opcodes above (which use the `Instruction`/
// `opcode` discriminated union), these follow the existing action-based
// `AQIRInstruction` shape from `@aqvl/shared` (the same family as
// HIGHLIGHT_OBJECT, SWAP_OBJECTS, UPDATE_LAYOUT, ...), per the geometry
// spec's design decision to extend that model rather than the newer one.
// ---------------------------------------------------------------------

import type { AQIRInstruction } from '@aqvl/shared';

/** A LAYOUT strategy name, as parsed from `LAYOUT <target> AS <STRATEGY>(...)`. */
export type LayoutStrategyName = 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM';

/** A single strategy/camera parameter value: a number, an enum-like bareword (e.g. "horizontal"), or an (x,y,z) tuple. */
export type GeometryParamValue = number | string | [number, number, number];

/**
 * SET_LAYOUT_STRATEGY — records a structure's layout strategy + params.
 * Emitted once per `LAYOUT` statement (or synthesized once per structure
 * with no explicit `LAYOUT`, from the spatial-syntax-spec.md §4 default
 * table). Does not itself move any element — a COMPUTE_LAYOUT follows it.
 */
export interface SetLayoutStrategyInstruction extends AQIRInstruction {
  action: 'SET_LAYOUT_STRATEGY';
  targetId: string;
  strategy: LayoutStrategyName;
  params: Record<string, GeometryParamValue>;
}

/**
 * SET_POSITION — pins one element's coordinate(s), overriding its owning
 * structure's active layout strategy for the named axes. `null` on an axis
 * means "not overridden, defer to the strategy"; all three `null` (from
 * `POSITION target AT ()`) releases a prior pin entirely.
 */
export interface SetPositionInstruction extends AQIRInstruction {
  action: 'SET_POSITION';
  elementId: string;
  x: number | null;
  y: number | null;
  z: number | null;
}

/**
 * COMPUTE_LAYOUT — materializes `targetId`'s current layout strategy into
 * concrete positions for its non-pinned elements. Emitted once after every
 * SET_LAYOUT_STRATEGY for the same target, and (by convention) after every
 * structure-mutating instruction affecting it.
 */
export interface ComputeLayoutInstruction extends AQIRInstruction {
  action: 'COMPUTE_LAYOUT';
  targetId: string;
}

/** A CAMERA statement's mode, as parsed from `CAMERA <MODE>(...)`. */
export type CameraMode = 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';

/**
 * SET_CAMERA — changes camera behavior from this point in the timeline
 * onward. Emitted once per `CAMERA` statement (or synthesized as
 * instruction 0 with mode AUTO_FIT when source has no CAMERA statement).
 */
export interface SetCameraInstruction extends AQIRInstruction {
  action: 'SET_CAMERA';
  mode: CameraMode;
  params: {
    /** FOCUS only. */
    targetId?: string;
    /** ORBIT only, degrees/second. */
    speed?: number;
    /** POSITION only, absolute camera location. */
    x?: number;
    y?: number;
    z?: number;
  };
}

/**
 * SET_ROTATION — sets an element's resting orientation in degrees
 * (X→Y→Z application order). Not synthesized by the current compiler (no
 * AQVL grammar surfaces it yet); forward-compatible slot for a future
 * per-element orientation statement.
 */
export interface SetRotationInstruction extends AQIRInstruction {
  action: 'SET_ROTATION';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

/**
 * SET_SCALE — sets an element's resting scale multiplier (1 = natural
 * size), distinct from the transient animation-tween scale changes
 * AnimationController already runs for feedback. Not synthesized by the
 * current compiler; forward-compatible, same status as SET_ROTATION.
 */
export interface SetScaleInstruction extends AQIRInstruction {
  action: 'SET_SCALE';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

/** Union of the 6 geometry instructions. */
export type GeometryInstruction =
  | SetLayoutStrategyInstruction
  | SetPositionInstruction
  | ComputeLayoutInstruction
  | SetCameraInstruction
  | SetRotationInstruction
  | SetScaleInstruction;

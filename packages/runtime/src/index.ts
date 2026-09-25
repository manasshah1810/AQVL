export type { SceneElement, BoxElement, EdgeElement } from './models/SceneElement';
export type { SceneState, PartitionBoundaryRegion, SortedRegion } from './models/SceneState';
export type {
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
  CameraFrameState,
} from './aqir/types';
export { SceneManager } from './core/SceneManager';
export { StateManager } from './core/StateManager';
export { ExecutionEngine, MaxIterationsExceededError, DEFAULT_MAX_EXECUTION_ITERATIONS } from './core/ExecutionEngine';
export { LayoutManager } from './core/LayoutManager';
export { TimelineEngine } from './core/TimelineEngine';
export { AnimationController } from './core/AnimationController';
export { EventDispatcher } from './core/EventDispatcher';

// --- Graph data structures & algorithm scaffolding ---
export { Graph } from './data-structures/Graph';
export { Vertex } from './data-structures/Vertex';
export { Edge } from './data-structures/Edge';
export { UnionFind } from './data-structures/UnionFind';
export { GraphAlgorithm } from './core/algorithms/GraphEngine';
export type { AnimationFrame } from './core/algorithms/GraphEngine';
export { SortAlgorithm } from './core/algorithms/SortEngine';
export type { SortStep, SortResult, OperationIntent, OperationSignificance, AlgorithmName, AlgorithmPhase } from './core/algorithms/SortEngine';

// --- Narrative text generation (docs/design/array-narrative-ux-spec.md) ---
export { ArrayNarrativeGenerator } from './narrative/ArrayNarrativeGenerator';
export type { Instruction, StructureState } from './narrative/ArrayNarrativeGenerator';
export { PacingConfig, DEFAULT_PACING_CONFIG, DEFAULT_PACING_MULTIPLIERS, DEFAULT_UNTAGGED_MULTIPLIER } from './narrative/PacingConfig';
export type { PacingMultipliers } from './narrative/PacingConfig';

// --- VM mode: runtime execution of AQIR with control flow ---
export {
  AQVLVirtualMachine,
  JumpTargetError,
  FunctionNotFoundError,
  StackUnderflowError,
  UndefinedVariableError,
  ExecutionLimitExceededError,
  StackOverflowError,
  DivisionByZeroError,
} from './VirtualMachine';
export type { StepCallback, LegacyInstructionHandler } from './VirtualMachine';
export {
  AQIROpcode,
  isControlFlowInstruction,
} from './types';
export type {
  VMInstruction,
  ControlFlowInstruction,
  JumpInstruction,
  JumpIfFalseInstruction,
  CallInstruction,
  RetInstruction,
  PushScopeInstruction,
  PopScopeInstruction,
  SetVarInstruction,
  FunctionDef,
  FunctionTable,
  FrameInfo,
  VMState,
  ExecutionFrame,
  ExecutionResult,
  ResolvedPosition,
  StructureLayoutState,
} from './types';

// --- Layout engine: resolves SET_LAYOUT_STRATEGY + COMPUTE_LAYOUT into positions ---
export { LayoutEngine, UnknownLayoutStrategyError } from './layout/LayoutEngine';
export type { LayoutCalculator, LayoutElementInput, Position3D, PositionMap } from './layout/LayoutEngine';
export { LineLayout } from './layout/strategies/LineLayout';
export { GridLayout } from './layout/strategies/GridLayout';
export { HierarchyLayout } from './layout/strategies/HierarchyLayout';
export { CircularLayout } from './layout/strategies/CircularLayout';

import { AQVLVirtualMachine, type LegacyInstructionHandler } from './VirtualMachine';
import type { VMInstruction, FunctionTable, ExecutionResult } from './types';
import type { AQIRObject } from '@aqvl/shared';

/** Convenience factory: builds a VM ready to run() or step() through `instructions`. */
export function createVM(
  instructions: VMInstruction[],
  functionTable: FunctionTable = {},
  globals: Record<string, unknown> = {},
  legacyHandler?: LegacyInstructionHandler,
  objects: AQIRObject[] = []
): AQVLVirtualMachine {
  return new AQVLVirtualMachine(instructions, functionTable, globals, legacyHandler, objects);
}

/** Convenience one-shot: builds a VM and runs it to completion. */
export function runVM(
  instructions: VMInstruction[],
  functionTable: FunctionTable = {},
  globals: Record<string, unknown> = {},
  legacyHandler?: LegacyInstructionHandler,
  objects: AQIRObject[] = []
): Promise<ExecutionResult> {
  return createVM(instructions, functionTable, globals, legacyHandler, objects).run();
}

/**
 * AQVLVirtualMachine — executes an AQIR instruction stream with a real
 * program counter, call stack, and lexical scopes, instead of the
 * compile-time-unrolled sequential model.
 *
 * Legacy action-based instructions (COMPARE_OBJECTS, SWAP_OBJECTS, ...) are
 * not interpreted by the VM itself — they're handed off to an injected
 * `legacyHandler` (in practice, `AnimationController.executeInstruction`)
 * so existing animations keep working unchanged. The 6 control-flow opcodes
 * (JUMP, JUMP_IF_FALSE, CALL, RET, PUSH_SCOPE, POP_SCOPE) and the 4 geometry
 * opcodes (SET_LAYOUT_STRATEGY, COMPUTE_LAYOUT, SET_POSITION, SET_CAMERA —
 * see docs/design/aqir-geometry-spec.md) are interpreted directly here,
 * the latter via `LayoutEngine`.
 */

import type { AQIRInstruction, AQIRObject } from '@aqvl/shared';
import {
  RuntimeError,
  JumpTargetError,
  FunctionNotFoundError,
  StackUnderflowError,
  UndefinedVariableError,
  StackOverflowError,
  DivisionByZeroError,
} from '@aqvl/shared';
import {
  AQIROpcode,
  isControlFlowInstruction,
  type VMInstruction,
  type ControlFlowInstruction,
  type FunctionTable,
  type FrameInfo,
  type VMState,
  type ExecutionFrame,
  type ExecutionResult,
  type ResolvedPosition,
} from './types';
import { LayoutEngine, type LayoutElementInput, type LayoutEdgeInput } from './layout/LayoutEngine';
import type {
  SetLayoutStrategyInstruction,
  SetPositionInstruction,
  ComputeLayoutInstruction,
  SetCameraInstruction,
} from './aqir/types';
import type { CameraFrameState } from './aqir/types';

/**
 * Deep-clones plain JSON-like data (numbers/strings/booleans/null/arrays/
 * plain objects) — everything VM state is actually made of. Benchmarked
 * ~7x faster than both `JSON.parse(JSON.stringify(...))` and
 * `structuredClone` for state-shaped objects (see
 * tests/benchmarks/vm-step-performance.test.ts): no serialize/parse or
 * structured-clone-algorithm overhead, just a direct object walk. Anything
 * that isn't a plain object/array (a function, say) is passed through by
 * reference rather than cloned — matching what `JSON.stringify` used to
 * silently drop, harmlessly, since AQVL programs never store functions in
 * locals/globals.
 */
export function deepClonePlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = deepClonePlain(value[i]);
    return out as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const key in value as Record<string, unknown>) {
    out[key] = deepClonePlain((value as Record<string, unknown>)[key]);
  }
  return out as T;
}

/** The 4 geometry opcodes the VM resolves directly (see docs/design/aqir-geometry-spec.md §1). */
export const GEOMETRY_ACTIONS: ReadonlySet<string> = new Set([
  'SET_LAYOUT_STRATEGY',
  'COMPUTE_LAYOUT',
  'SET_POSITION',
  'SET_CAMERA',
]);

export {
  JumpTargetError,
  FunctionNotFoundError,
  StackUnderflowError,
  UndefinedVariableError,
  StackOverflowError,
  DivisionByZeroError,
};

export class ExecutionLimitExceededError extends RuntimeError {
  constructor(limit: number) {
    super(`Execution exceeded ${limit} steps — likely an infinite loop (JUMP/JUMP_IF_FALSE cycle with no progress).`);
  }
}

/** Internal call-frame bookkeeping. Structurally a superset of the public FrameInfo. */
interface InternalFrame extends FrameInfo {
  /** Stack of lexical scopes opened within this frame; index 0 is the frame's base (param) scope. */
  scopes: Record<string, unknown>[];
  scopeIds: string[];
  /** Temp variable (in the *caller's* scope) to store this call's return value into, once RET pops this frame. */
  resultVar?: string;
}

/** Called once per executed instruction. Return `false` to stop `run()` early (e.g. for pause). */
export type StepCallback = (frame: ExecutionFrame) => Promise<void | boolean> | void | boolean;

/** Called for every non-control-flow (legacy, action-based) instruction. */
export type LegacyInstructionHandler = (instruction: AQIRInstruction, state: VMState) => Promise<void> | void;

/** Opaque resumable VM state produced by `AQVLVirtualMachine.snapshot()`. */
export interface VMSnapshot {
  pc: number;
  frames: unknown[];
  globalScopes: Record<string, unknown>[];
  globalScopeIds: string[];
  lastReturnValue: unknown;
}

export class AQVLVirtualMachine {
  private readonly instructions: VMInstruction[];
  private readonly functionTable: FunctionTable;

  private pc = 0;
  private frames: InternalFrame[] = [];
  /** Stack of global-scope dicts; index 0 is the constructor-provided `globals`. */
  private globalScopes: Record<string, unknown>[];
  private globalScopeIds: string[] = ['global'];

  private stepCounter = 0;
  private lastReturnValue: unknown;

  // --- Geometry state (SET_LAYOUT_STRATEGY / COMPUTE_LAYOUT / SET_POSITION / SET_CAMERA) ---
  private readonly layoutEngine = new LayoutEngine();
  /** structureId ("arr", "tree1", ...) -> its member elementIds, ordered by logicalIndex, from the AQIRProgram's `objects`. */
  private readonly structureElements: Map<string, string[]> = new Map();
  /** structureId -> its GRAPH_EDGE members' {sourceId, targetId}, for edge-aware strategies (FORCE_DIRECTED). */
  private readonly structureEdges: Map<string, LayoutEdgeInput[]> = new Map();
  private structureStrategies: Map<string, { strategy: string; params: Record<string, unknown> }> = new Map();
  private positions: Map<string, ResolvedPosition> = new Map();
  /** Elements pinned by SET_POSITION — excluded from their structure's next COMPUTE_LAYOUT pass. */
  private pinnedElements: Set<string> = new Set();
  private cameraState?: CameraFrameState;

  private static readonly MAX_STEPS = 200_000;
  private static readonly MAX_CALL_DEPTH = 1_000;

  constructor(
    instructions: VMInstruction[],
    functionTable: FunctionTable = {},
    globals: Record<string, unknown> = {},
    private readonly legacyHandler?: LegacyInstructionHandler,
    objects: AQIRObject[] = []
  ) {
    this.instructions = instructions;
    this.functionTable = functionTable;
    this.globalScopes = [globals];

    const grouped = new Map<string, AQIRObject[]>();
    for (const obj of objects) {
      if (!obj.logicalParent) continue;
      if (obj.type === 'GRAPH_EDGE' || obj.type === 'EDGE') {
        // Edges aren't layout "elements" — they carry no position of their own,
        // only a source/target pair consumed by edge-aware strategies.
        const args = obj.args ?? [];
        if (args.length >= 2) {
          if (!this.structureEdges.has(obj.logicalParent)) this.structureEdges.set(obj.logicalParent, []);
          this.structureEdges.get(obj.logicalParent)!.push({ sourceId: String(args[0]), targetId: String(args[1]) });
        }
        continue;
      }
      if (!grouped.has(obj.logicalParent)) grouped.set(obj.logicalParent, []);
      grouped.get(obj.logicalParent)!.push(obj);
    }
    grouped.forEach((objs, parent) => {
      const ordered = [...objs].sort((a, b) => (a.logicalIndex ?? 0) - (b.logicalIndex ?? 0));
      this.structureElements.set(parent, ordered.map((o) => o.id));
    });
  }

  // ---------------------------------------------------------------------
  // Public introspection / state access
  // ---------------------------------------------------------------------

  public getCurrentFrame(): FrameInfo | undefined {
    return this.frames[this.frames.length - 1];
  }

  public getVariable(name: string): unknown {
    const frame = this.frames[this.frames.length - 1];
    if (frame) {
      for (let i = frame.scopes.length - 1; i >= 0; i--) {
        if (Object.prototype.hasOwnProperty.call(frame.scopes[i], name)) {
          return frame.scopes[i][name];
        }
      }
    }
    for (let i = this.globalScopes.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(this.globalScopes[i], name)) {
        return this.globalScopes[i][name];
      }
    }
    throw new UndefinedVariableError(name);
  }

  private hasVariable(name: string): boolean {
    const frame = this.frames[this.frames.length - 1];
    if (frame && frame.scopes.some((scope) => Object.prototype.hasOwnProperty.call(scope, name))) {
      return true;
    }
    return this.globalScopes.some((scope) => Object.prototype.hasOwnProperty.call(scope, name));
  }

  public setVariable(name: string, value: unknown): void {
    const frame = this.frames[this.frames.length - 1];
    if (frame) {
      for (let i = frame.scopes.length - 1; i >= 0; i--) {
        if (Object.prototype.hasOwnProperty.call(frame.scopes[i], name)) {
          frame.scopes[i][name] = value;
          return;
        }
      }
      // Not declared anywhere in this frame's scope chain: declare in the innermost scope.
      frame.scopes[frame.scopes.length - 1][name] = value;
      return;
    }

    for (let i = this.globalScopes.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(this.globalScopes[i], name)) {
        this.globalScopes[i][name] = value;
        return;
      }
    }
    this.globalScopes[0][name] = value;
  }

  private static readonly BINARY_OPS: Record<string, (l: any, r: any) => unknown> = {
    '+': (l, r) => l + r,
    '-': (l, r) => l - r,
    '*': (l, r) => l * r,
    '/': (l, r) => l / r,
    '<': (l, r) => l < r,
    '>': (l, r) => l > r,
    '<=': (l, r) => l <= r,
    '>=': (l, r) => l >= r,
    '==': (l, r) => l === r,
    '!=': (l, r) => l !== r,
    // '=' is AQVL's single-equals comparison operator in expression position
    // (assignment is a separate statement form, compiled to SET_VAR) — treat
    // it as equality, e.g. `IF n = 0`.
    '=': (l, r) => l === r,
    '%': (l, r) => l % r,
    // Evaluated eagerly (both sides), which is safe: AQVL expressions have no side effects.
    'AND': (l, r) => Boolean(l) && Boolean(r),
    'OR': (l, r) => Boolean(l) || Boolean(r),
  };

  /**
   * Reads the current value of `array[index]` for `{ elem, index }` operands
   * (the compiler's encoding of `arr[i]` used as a value). Supplied by the
   * host that owns the live data — the AnimationController reads it from
   * the scene graph — since array contents aren't VM variables.
   */
  private elementReader?: (arrayName: string, index: number) => unknown;
  /** Current length of an array, for `{ len }` operands (`LENGTH(arr)` of a resizable array). */
  private lengthReader?: (arrayName: string) => number;

  public setElementReader(
    reader: (arrayName: string, index: number) => unknown,
    lengthReader?: (arrayName: string) => number
  ): void {
    this.elementReader = reader;
    this.lengthReader = lengthReader;
  }

  /**
   * Resolves an operand to a concrete value: a known variable name resolves
   * to its current value (locals, then globals); a `{op, left, right}` tree
   * (compiled from a BinaryOpNode) is evaluated recursively; anything else
   * (numbers, booleans, already-literal values, or strings that aren't bound
   * variables) is returned as-is.
   */
  public evaluateExpression(expr: unknown): unknown {
    if (typeof expr === 'string') {
      return this.hasVariable(expr) ? this.getVariable(expr) : expr;
    }
    if (expr !== null && typeof expr === 'object' && 'len' in (expr as any) && !('op' in (expr as any))) {
      const arrayName = (expr as { len: string }).len;
      if (!this.lengthReader) {
        throw new Error(`Cannot read LENGTH(${arrayName}): no array data is attached to this program.`);
      }
      return this.lengthReader(arrayName);
    }
    if (expr !== null && typeof expr === 'object' && 'elem' in (expr as any) && 'index' in (expr as any)) {
      const { elem, index } = expr as { elem: string; index: unknown };
      const idx = Number(this.evaluateExpression(index));
      if (!this.elementReader) {
        throw new Error(`Cannot read ${elem}[${idx}]: no array data is attached to this program.`);
      }
      return this.elementReader(elem, idx);
    }
    if (expr !== null && typeof expr === 'object' && 'op' in (expr as any) && 'left' in (expr as any) && 'right' in (expr as any)) {
      const { op, left, right } = expr as { op: string; left: unknown; right: unknown };
      const apply = AQVLVirtualMachine.BINARY_OPS[op];
      if (!apply) {
        throw new Error(`Unsupported binary operator "${op}" in expression.`);
      }
      const leftValue = this.evaluateExpression(left);
      const rightValue = this.evaluateExpression(right);
      if (op === '/' && rightValue === 0) {
        throw new DivisionByZeroError(typeof left === 'string' ? left : undefined);
      }
      return apply(leftValue, rightValue);
    }
    return expr;
  }

  /**
   * Repositions the VM's program counter, e.g. to support scrubbing to an
   * arbitrary saved timeline state (restart/stepForward/stepBackward).
   * Resetting to 0 also clears the call stack and any pushed scopes, since
   * that's the only pc value guaranteed not to be mid-call. Repositioning
   * to any other pc leaves frames/scopes as-is — correct for purely
   * sequential (no CALL/JUMP) instruction streams, which is all the
   * generator currently emits; scrubbing through live control-flow
   * programs is not yet supported (Phase 1.4).
   */
  public resetTo(pc: number): void {
    this.pc = pc;
    if (pc === 0) {
      this.frames = [];
      this.globalScopes = [this.globalScopes[0]];
      this.globalScopeIds = ['global'];
      this.structureStrategies = new Map();
      this.positions = new Map();
      this.pinnedElements = new Set();
      this.cameraState = undefined;
    }
  }

  /**
   * Captures everything needed to resume execution later from exactly this
   * point — pc, call frames and every scope's variables — so the host can
   * rewind to an earlier step (step back / replay) and continue with the
   * loop counters and variables that were live at that step.
   */
  public snapshot(): VMSnapshot {
    return deepClonePlain({
      pc: this.pc,
      frames: this.frames,
      globalScopes: this.globalScopes,
      globalScopeIds: this.globalScopeIds,
      lastReturnValue: this.lastReturnValue,
    }) as VMSnapshot;
  }

  public restore(snap: VMSnapshot): void {
    const copy = deepClonePlain(snap) as VMSnapshot;
    this.pc = copy.pc;
    this.frames = copy.frames as InternalFrame[];
    // A frame's `locals` is the same object as its base scope; cloning split them.
    for (const frame of this.frames) frame.locals = frame.scopes[0];
    this.globalScopes = copy.globalScopes;
    this.globalScopeIds = copy.globalScopeIds;
    this.lastReturnValue = copy.lastReturnValue;
  }

  public getPc(): number {
    return this.pc;
  }

  public getState(): VMState {
    return { pc: this.pc, ...this.captureStateBody() };
  }

  /**
   * Builds everything in `VMState` except `pc`. Split out from `getState()`
   * so `step()` can capture this once per instruction and reuse it for both
   * the legacy-handler snapshot and the emitted execution frame — they only
   * ever differ in `pc` (the legacy handler receives no reference back into
   * the VM, so it cannot mutate frames/globals/positions/camera itself).
   */
  private captureStateBody(): Omit<VMState, 'pc'> {
    return {
      frames: this.frames.map((f) => ({
        functionName: f.functionName,
        locals: { ...f.locals },
        returnAddress: f.returnAddress,
        scope: f.scope,
      })),
      globals: { ...this.globalScopes[0] },
      positions: this.positions.size > 0 ? this.positionsToRecord() : undefined,
      camera: this.cameraState,
    };
  }

  private positionsToRecord(): Record<string, ResolvedPosition> {
    const record: Record<string, ResolvedPosition> = {};
    this.positions.forEach((pos, id) => {
      record[id] = pos;
    });
    return record;
  }

  /** Resolves SET_LAYOUT_STRATEGY / COMPUTE_LAYOUT / SET_POSITION / SET_CAMERA against VM-owned geometry state. */
  private executeGeometryInstruction(instr: AQIRInstruction): void {
    switch (instr.action) {
      case 'SET_LAYOUT_STRATEGY': {
        const i = instr as SetLayoutStrategyInstruction;
        this.structureStrategies.set(i.targetId, { strategy: i.strategy, params: i.params ?? {} });
        return;
      }

      case 'COMPUTE_LAYOUT': {
        const i = instr as ComputeLayoutInstruction;
        const record = this.structureStrategies.get(i.targetId);
        if (!record) return; // no SET_LAYOUT_STRATEGY seen yet for this structure — nothing to materialize.

        const elementIds = this.structureElements.get(i.targetId) ?? [];
        const elements: LayoutElementInput[] = elementIds
          .filter((id) => !this.pinnedElements.has(id))
          .map((id, logicalIndex) => ({ id, logicalIndex }));

        const edges = this.structureEdges.get(i.targetId);
        const computed = this.layoutEngine.computeLayout(i.targetId, record.strategy, record.params, elements, edges);
        computed.forEach((pos, id) => this.positions.set(id, pos));
        return;
      }

      case 'SET_POSITION': {
        const i = instr as SetPositionInstruction;
        if (i.x === null && i.y === null && i.z === null) {
          // POSITION ... AT () — release the pin; rejoins the structure's next COMPUTE_LAYOUT.
          this.pinnedElements.delete(i.elementId);
          return;
        }
        const current = this.positions.get(i.elementId) ?? { x: 0, y: 0, z: 0 };
        this.positions.set(i.elementId, {
          x: i.x ?? current.x,
          y: i.y ?? current.y,
          z: i.z ?? current.z,
        });
        this.pinnedElements.add(i.elementId);
        return;
      }

      case 'SET_CAMERA': {
        const i = instr as SetCameraInstruction;
        const hasPosition = i.params.x !== undefined || i.params.y !== undefined || i.params.z !== undefined;
        this.cameraState = {
          mode: i.mode,
          ...(i.params.targetId !== undefined ? { targetId: i.params.targetId } : {}),
          ...(i.params.speed !== undefined ? { speed: i.params.speed } : {}),
          ...(hasPosition
            ? { position: { x: i.params.x ?? 0, y: i.params.y ?? 0, z: i.params.z ?? 0 } }
            : {}),
        };
        return;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------

  /**
   * Captures a snapshot of `instr` + `state` for animation/timeline playback.
   * Frames must be genuinely independent of both the live VM state and each
   * other (locals/globals can hold arrays/objects that later steps mutate in
   * place), so this needs a real deep clone, not just the shallow per-key
   * copies `captureStateBody()` makes. `deepClonePlain` does that walk
   * directly, without the JSON-text round trip (or structuredClone's more
   * general-purpose serialization overhead) — see its doc comment.
   */
  public emitExecutionFrame(instr: VMInstruction, state: VMState): ExecutionFrame {
    let snapshot: VMState;
    try {
      snapshot = deepClonePlain(state);
    } catch {
      // Non-serializable values (functions, etc.) in locals/globals: fall back to a shallow copy.
      snapshot = {
        pc: state.pc,
        frames: state.frames.map((f) => ({ ...f, locals: { ...f.locals } })),
        globals: { ...state.globals },
        positions: state.positions ? { ...state.positions } : undefined,
        camera: state.camera ? { ...state.camera } : undefined,
      };
    }
    return {
      index: this.stepCounter++,
      instruction: instr,
      state: snapshot,
    };
  }

  private validateJumpTarget(target: number): void {
    if (!Number.isInteger(target) || target < 0 || target > this.instructions.length) {
      throw new JumpTargetError(target, this.instructions.length);
    }
  }

  private executeControlFlow(instr: ControlFlowInstruction): void {
    switch (instr.opcode) {
      case AQIROpcode.JUMP: {
        this.validateJumpTarget(instr.target);
        this.pc = instr.target;
        return;
      }

      case AQIROpcode.JUMP_IF_FALSE: {
        this.validateJumpTarget(instr.target);
        const condition = this.evaluateExpression(instr.condition);
        this.pc = condition ? this.pc + 1 : instr.target;
        return;
      }

      case AQIROpcode.CALL: {
        const fn = this.functionTable[instr.functionName];
        if (!fn) {
          throw new FunctionNotFoundError(instr.functionName);
        }
        if (this.frames.length >= AQVLVirtualMachine.MAX_CALL_DEPTH) {
          throw new StackOverflowError(AQVLVirtualMachine.MAX_CALL_DEPTH);
        }
        const locals: Record<string, unknown> = {};
        fn.params.forEach((param, i) => {
          locals[param] = this.evaluateExpression(instr.args[i]);
        });
        const baseScopeId = `${fn.name}#${this.stepCounter}`;
        const frame: InternalFrame = {
          functionName: fn.name,
          locals,
          returnAddress: this.pc + 1,
          scope: baseScopeId,
          scopes: [locals],
          scopeIds: [baseScopeId],
          resultVar: instr.resultVar,
        };
        this.frames.push(frame);
        this.pc = fn.entryAddress;
        return;
      }

      case AQIROpcode.RET: {
        if (this.frames.length === 0) {
          throw new StackUnderflowError('RET with no active call frame (unbalanced CALL/RET).');
        }
        const returnValue = instr.returnValue !== undefined
          ? this.evaluateExpression(instr.returnValue)
          : undefined;
        const frame = this.frames.pop()!;
        this.pc = frame.returnAddress;
        this.lastReturnValue = returnValue;
        // Store into the call site's temp variable, now that the callee's
        // frame is gone and the top of the stack is the caller's own frame
        // (or the global scope, for a call made outside any function).
        if (frame.resultVar) {
          this.setVariable(frame.resultVar, returnValue);
        }
        return;
      }

      case AQIROpcode.SET_VAR: {
        this.setVariable(instr.name, this.evaluateExpression(instr.value));
        this.pc++;
        return;
      }

      case AQIROpcode.PUSH_SCOPE: {
        const frame = this.frames[this.frames.length - 1];
        if (frame) {
          frame.scopes.push({});
          frame.scopeIds.push(instr.scopeId);
          frame.scope = instr.scopeId;
        } else {
          this.globalScopes.push({});
          this.globalScopeIds.push(instr.scopeId);
        }
        this.pc++;
        return;
      }

      case AQIROpcode.POP_SCOPE: {
        const frame = this.frames[this.frames.length - 1];
        if (frame) {
          if (frame.scopes.length <= 1) {
            throw new StackUnderflowError(`POP_SCOPE with no scope open in function "${frame.functionName}" beyond its base scope.`);
          }
          frame.scopes.pop();
          frame.scopeIds.pop();
          frame.scope = frame.scopeIds[frame.scopeIds.length - 1];
        } else {
          if (this.globalScopes.length <= 1) {
            throw new StackUnderflowError('POP_SCOPE with no scope open at global level.');
          }
          this.globalScopes.pop();
          this.globalScopeIds.pop();
        }
        this.pc++;
        return;
      }
    }
  }

  /** Executes exactly one instruction. Returns `done: true` once the PC runs off the end. */
  public async step(): Promise<{ done: boolean; frame: ExecutionFrame }> {
    if (this.stepCounter >= AQVLVirtualMachine.MAX_STEPS) {
      throw new ExecutionLimitExceededError(AQVLVirtualMachine.MAX_STEPS);
    }

    const instr = this.instructions[this.pc];

    // Reused across the legacy-handler call and the emitted frame below when
    // possible — see `captureStateBody()` for why that's safe: the legacy
    // handler can't feed mutations back into frames/globals/positions/camera,
    // so once captured, only `pc` (advanced right after) can still differ.
    let stateBody: Omit<VMState, 'pc'> | undefined;

    if (isControlFlowInstruction(instr)) {
      this.executeControlFlow(instr);
    } else if (GEOMETRY_ACTIONS.has((instr as AQIRInstruction).action)) {
      this.executeGeometryInstruction(instr as AQIRInstruction);
      this.pc++;
    } else {
      if (this.legacyHandler) {
        stateBody = this.captureStateBody();
        await this.legacyHandler(instr as AQIRInstruction, { pc: this.pc, ...stateBody });
      }
      this.pc++;
    }

    const finalState: VMState = stateBody ? { pc: this.pc, ...stateBody } : this.getState();
    const frame = this.emitExecutionFrame(instr, finalState);
    const done = this.pc >= this.instructions.length;
    return { done, frame };
  }

  /**
   * Runs from the current PC to completion (or until `onStep` returns
   * `false`, e.g. to implement pause). Safe to call again afterwards to
   * resume — the VM retains its pc/frame/scope state between calls.
   */
  public async run(onStep?: StepCallback): Promise<ExecutionResult> {
    const executionSteps: ExecutionFrame[] = [];

    while (this.pc < this.instructions.length) {
      const { frame } = await this.step();
      executionSteps.push(frame);

      if (onStep) {
        const keepGoing = await onStep(frame);
        if (keepGoing === false) break;
      }
    }

    return {
      completed: this.pc >= this.instructions.length,
      returnValue: this.lastReturnValue,
      executionSteps,
      finalState: this.getState(),
    };
  }
}

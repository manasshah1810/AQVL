import type { AQIRProgram as LegacyAQIRProgram, AQIRObject } from '@aqvl/shared';
import { AQVLVirtualMachine, GEOMETRY_ACTIONS, type VMSnapshot } from '../VirtualMachine';
import { isControlFlowInstruction } from '../types';
import type { VMInstruction, FunctionTable } from '../types';

/**
 * Accepts either the legacy (action-only) AQIRProgram or a VM-mode program
 * whose `instructions` may also contain control-flow opcodes (JUMP, CALL,
 * ...) — e.g. `@aqvl/compiler`'s `AQIRProgram`, which this package
 * intentionally doesn't depend on (see ../types.ts). `functionTable` is
 * optional since the legacy shape never carried one.
 */
export type AQIRProgram = Omit<LegacyAQIRProgram, 'instructions'> & {
  objects: AQIRObject[];
  instructions: VMInstruction[];
  functionTable?: FunctionTable;
};
import { SceneManager } from './SceneManager';
import { StateManager } from './StateManager';
import { LayoutManager } from './LayoutManager';
import { TimelineEngine, InstantTimelineEngine } from './TimelineEngine';
import { AnimationScheduler } from './AnimationScheduler';
import { AnimationController } from './AnimationController';
import { EventDispatcher } from './EventDispatcher';

import { LifecycleManager } from './LifecycleManager';
import { RelationshipManager } from './RelationshipManager';

/** Default cap on instructions executed per play() run, guarding against non-terminating programs. */
export const DEFAULT_MAX_EXECUTION_ITERATIONS = 100_000;

export class MaxIterationsExceededError extends Error {
  constructor(public readonly maxIterations: number) {
    super(`Execution exceeded the maximum allowed iteration count (${maxIterations}). This likely indicates a non-terminating loop in the program.`);
    this.name = 'MaxIterationsExceededError';
  }
}

/** Upper bound on instructions for the headless dry run that sizes the step counter. */
const STEP_COUNT_DRY_RUN_LIMIT = 20_000;

/**
 * A point the user can step to: taken right after every *visible*
 * instruction (see `isVisibleStep`), plus one for the initial state.
 * Restoring one puts back the exact scene (StateManager snapshot) AND the
 * exact VM state (pc, loop counters, variables), so stepping back and then
 * playing / stepping forward continues the program correctly from there.
 */
interface StepCheckpoint {
  /** StateManager timeline index holding the scene at this step. */
  stateIndex: number;
  vm: VMSnapshot;
}

/**
 * Instructions that change what the user sees (swap, highlight, update,
 * print, ...). Control flow, layout/camera bookkeeping and WAIT (a pure
 * pause) are not counted as steps: stepping onto one would appear to do nothing.
 */
function isVisibleStep(instr: VMInstruction): boolean {
  if (isControlFlowInstruction(instr)) return false;
  const action = (instr as any).action as string | undefined;
  return action !== 'WAIT' && !(action !== undefined && GEOMETRY_ACTIONS.has(action));
}

export interface ExecutionEngineOptions {
  /**
   * Run without real animation (every tween completes instantly). Used for
   * the dry run that counts a program's total steps up front; also handy
   * for tests.
   */
  headless?: boolean;
}

export class ExecutionEngine {
  public eventDispatcher: EventDispatcher;
  public sceneManager: SceneManager;
  public stateManager: StateManager;
  public layoutManager: LayoutManager;
  public timelineEngine: TimelineEngine;
  public animationScheduler: AnimationScheduler;
  public lifecycleManager: LifecycleManager;
  public relationshipManager: RelationshipManager;
  public animationController: AnimationController;

  private program: AQIRProgram | null = null;
  private readonly headless: boolean;

  constructor(options: ExecutionEngineOptions = {}) {
    this.headless = options.headless ?? false;
    this.eventDispatcher = new EventDispatcher();
    this.sceneManager = new SceneManager(this.eventDispatcher);
    this.stateManager = new StateManager();
    this.relationshipManager = new RelationshipManager(this.eventDispatcher);
    this.layoutManager = new LayoutManager(this.sceneManager, this.relationshipManager);
    this.timelineEngine = this.headless ? new InstantTimelineEngine() : new TimelineEngine();
    this.animationScheduler = new AnimationScheduler(this.timelineEngine);
    this.lifecycleManager = new LifecycleManager(this.sceneManager);
    this.animationController = new AnimationController(
      this.animationScheduler,
      this.sceneManager,
      this.layoutManager,
      this.stateManager,
      this.eventDispatcher,
      this.lifecycleManager,
      this.relationshipManager
    );

    // When a scene loads, calculate initial layout and save state
    this.eventDispatcher.on('SCENE_LOADED', () => {
      const layoutMap = this.layoutManager.updateLayout();
      this.layoutManager.applyLayoutInstantly(layoutMap);
      this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Initial State');
    });
  }

  private vm: AQVLVirtualMachine | null = null;
  /** True while the user wants playback to continue (cleared by pause / stepping). */
  private isPlaying: boolean = false;
  /** True while execute()'s loop is running (guards against overlapping runs). */
  private running: boolean = false;
  /** When set, execute() stops after the next visible step (Step Forward). */
  private singleStep: boolean = false;
  /** Navigation requested while an instruction was mid-animation; applied once it finishes. */
  private pendingNavigation: (() => void) | null = null;
  private currentInstructionIndex: number = 0;
  private maxExecutionIterations: number = DEFAULT_MAX_EXECUTION_ITERATIONS;

  /** checkpoints[k] = state after visible step k (checkpoints[0] = initial state). */
  private checkpoints: StepCheckpoint[] = [];
  /** Which checkpoint is on screen; < checkpoints.length - 1 after stepping back. */
  private cursor: number = 0;
  /** Total visible steps the program performs (from a headless dry run); null until known / if unknowable. */
  private totalSteps: number | null = null;

  public loadProgram(program: AQIRProgram) {
    this.program = program;
    this.sceneManager.loadScene(program.objects);
    this.relationshipManager.loadFromScene(this.sceneManager.getSceneGraph());
    this.currentInstructionIndex = 0;
    // VM-mode: drives the instruction stream (pc, call stack, scopes) while
    // legacy action-based instructions still animate via animationController.
    // functionTable/objects must be forwarded so CALL opcodes can resolve
    // user-defined functions and SET_LAYOUT_STRATEGY/COMPUTE_LAYOUT can see
    // the structure elements they position (globals aren't part of a
    // compiled program — the VM populates them itself while executing).
    this.vm = this.animationController.createExecutionVM(
      program.instructions as VMInstruction[],
      program.functionTable ?? {},
      {},
      program.objects
    );
    this.checkpoints = [{ stateIndex: this.stateManager.getCurrentIndex(), vm: this.vm.snapshot() }];
    this.cursor = 0;
    this.totalSteps = null;
    if (!this.headless) this.computeTotalSteps(program);
  }

  /**
   * The number of steps depends on the data (IF branches, WHILE loops), so
   * it can't be read off the instruction list — the program is executed
   * once, headlessly, and the visible steps counted. Broadcasts the result
   * via ANIMATED_STEP so the "Step x of y" counter is exact from the start.
   */
  private computeTotalSteps(program: AQIRProgram): void {
    const dryRun = new ExecutionEngine({ headless: true });
    dryRun.setMaxExecutionIterations(STEP_COUNT_DRY_RUN_LIMIT);
    dryRun.loadProgram(program);
    dryRun.execute().then(
      () => {
        if (this.program !== program) return; // a different program was loaded meanwhile
        this.totalSteps = dryRun.checkpoints.length - 1;
        this.dispatchStep();
      },
      () => {
        // Runtime error or too long to pre-count: the counter shows "Step x" without a total.
      }
    );
  }

  /** Configure the iteration cap used by execute()/play() to guard against non-terminating programs. */
  public setMaxExecutionIterations(max: number): void {
    this.maxExecutionIterations = max;
  }

  private dispatchStep(): void {
    this.eventDispatcher.dispatch('ANIMATED_STEP', {
      current: this.cursor,
      total: this.totalSteps ?? 0,
    });
  }

  private isFinished(): boolean {
    return !!this.vm && !!this.program && this.vm.getPc() >= this.program.instructions.length;
  }

  /** True when there is nothing left to play from the step currently shown. */
  public isAtEnd(): boolean {
    return this.isFinished() && this.cursor === this.checkpoints.length - 1;
  }

  public async execute() {
    if (!this.program || !this.vm) return;
    this.isPlaying = true;
    this.running = true;

    try {
      // Resuming from an earlier step (after Step Back): restore the VM exactly
      // as it was there, and drop the steps after it — they get re-executed.
      if (this.cursor < this.checkpoints.length - 1) {
        this.restoreCheckpoint(this.cursor);
        this.checkpoints = this.checkpoints.slice(0, this.cursor + 1);
      }

      let iterationCount = 0;
      while (this.vm.getPc() < this.program.instructions.length && this.isPlaying) {
        if (iterationCount >= this.maxExecutionIterations) {
          throw new MaxIterationsExceededError(this.maxExecutionIterations);
        }
        iterationCount++;

        const dispatchedIndex = this.vm.getPc();
        this.eventDispatcher.dispatch('INSTRUCTION_START', dispatchedIndex);

        // vm.step() executes exactly one instruction: a legacy action instruction
        // is animated via animationController.executeInstruction (awaited here),
        // while a control-flow opcode (JUMP/CALL/RET/...) is resolved internally
        // and moves the VM's pc accordingly.
        const { frame } = await this.vm.step();
        const instruction = frame.instruction;
        this.currentInstructionIndex = frame.state.pc;

        if (isVisibleStep(instruction)) {
          const actionLabel = (instruction as any).action ?? (instruction as any).opcode;
          this.stateManager.saveState(
            this.sceneManager.getSceneGraph(),
            `[${dispatchedIndex + 1}] ${actionLabel}`,
            this.animationScheduler.getCurrentTime()
          );
          this.checkpoints.push({ stateIndex: this.stateManager.getCurrentIndex(), vm: this.vm.snapshot() });
          this.cursor = this.checkpoints.length - 1;
          this.dispatchStep();
          if (this.singleStep) this.isPlaying = false;
        }

        this.eventDispatcher.dispatch('INSTRUCTION_COMPLETE', this.currentInstructionIndex);
      }

      this.isPlaying = false;
      if (this.isFinished()) {
        this.eventDispatcher.dispatch('EXECUTION_FINISHED', null);
      }
    } catch (error) {
      this.isPlaying = false;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ExecutionEngine] execute() failed:', error);
      this.eventDispatcher.dispatch('EXECUTION_ERROR', { error, message });
      throw error;
    } finally {
      this.running = false;
      this.singleStep = false;
      const navigate = this.pendingNavigation;
      this.pendingNavigation = null;
      navigate?.();
    }
  }

  /** Runs `action` now, or — if an instruction is mid-animation — as soon as it finishes. */
  private whenIdle(action: () => void): void {
    if (this.running) {
      this.pendingNavigation = action;
    } else {
      action();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /** Current VM state (call stack, globals, resolved positions) for the loaded program, or null before `loadProgram`. */
  public getVMState() {
    return this.vm?.getState() ?? null;
  }

  public getProgress(): number {
    return this.timelineEngine.getCurrentTime();
  }

  public getDuration(): number {
    return this.timelineEngine.getDuration();
  }

  /** Total number of visible steps the loaded program performs (0 until the dry run has counted them). */
  public getTotalAnimatedSteps(): number {
    return this.totalSteps ?? 0;
  }

  /** The visible step currently shown (0 = initial state). */
  public getCurrentStep(): number {
    return this.cursor;
  }

  public setPlaybackRate(rate: number): void {
    this.timelineEngine.setPlaybackRate(rate);
  }

  public play() {
    this.singleStep = false;
    this.pendingNavigation = null;
    if (this.running) {
      // Still finishing the current instruction (e.g. just paused): keep going.
      this.isPlaying = true;
      return;
    }
    if (this.isAtEnd()) return;
    // execute() already resets isPlaying and dispatches EXECUTION_ERROR on
    // failure; catch here only to prevent an unhandled promise rejection
    // since callers invoke play() without awaiting it.
    this.execute().catch((error) => {
      console.error('[ExecutionEngine] play() -> execute() failed:', error);
    });
  }

  public pause() {
    this.isPlaying = false;
  }

  /** Puts the scene and the VM back exactly as they were at checkpoint `index`. */
  private restoreCheckpoint(index: number): void {
    const checkpoint = this.checkpoints[index];
    this.cursor = index;
    this.vm?.restore(checkpoint.vm);
    this.currentInstructionIndex = checkpoint.vm.pc;
    const state = this.stateManager.jumpTo(checkpoint.stateIndex);
    if (state) this.syncToState(state);
  }

  private goToCheckpoint(index: number): void {
    if (index < 0 || index >= this.checkpoints.length) return;
    this.restoreCheckpoint(index);
    this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
    this.dispatchStep();
  }

  /**
   * Jumps directly to an arbitrary saved state snapshot (by index into the
   * StateManager timeline), restoring the exact scene graph recorded then.
   * The VM is rewound to the closest step at or before it, so playback
   * resumes correctly from there.
   */
  public jumpToStep(stateIndex: number) {
    this.isPlaying = false;
    this.whenIdle(() => {
      const state = this.stateManager.jumpTo(stateIndex);
      if (!state) return;
      let checkpointIndex = 0;
      for (let i = 0; i < this.checkpoints.length; i++) {
        if (this.checkpoints[i].stateIndex <= stateIndex) checkpointIndex = i;
      }
      this.cursor = checkpointIndex;
      this.vm?.restore(this.checkpoints[checkpointIndex].vm);
      this.currentInstructionIndex = this.checkpoints[checkpointIndex].vm.pc;
      this.syncToState(state);
      this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
      this.dispatchStep();
    });
  }

  /** Total number of saved state snapshots (i.e. scrubbable frames). */
  public getTimelineLength(): number {
    return this.stateManager.getTimelineLength();
  }

  /** Index of the currently active saved state snapshot. */
  public getCurrentStateIndex(): number {
    return this.stateManager.getCurrentIndex();
  }

  /** Seeks to whichever saved snapshot is current at `timeMs` (see jumpToStep). */
  public seek(timeMs: number) {
    this.isPlaying = false;
    const state = this.stateManager.getStateAtTime(timeMs);
    if (state) {
      this.jumpToStep(this.stateManager.getCurrentIndex());
    }
  }

  /**
   * Advances exactly one visible step, animating it. Replays forward after a
   * Step Back (the program is deterministic, so this reproduces the same
   * step), or executes the next instruction(s) live at the frontier.
   */
  public stepForward(): Promise<void> {
    this.isPlaying = false;
    if (this.running || this.isAtEnd()) return Promise.resolve();
    this.singleStep = true;
    return this.execute().catch((error) => {
      console.error('[ExecutionEngine] stepForward() failed:', error);
    });
  }

  /** Shows the previous step (instantly), with the program rewound to match. */
  public stepBackward() {
    this.isPlaying = false;
    this.whenIdle(() => this.goToCheckpoint(this.cursor - 1));
  }

  public restart() {
    this.isPlaying = false;
    this.whenIdle(() => this.goToCheckpoint(0));
  }

  public stepAnimateForward(onPause?: () => void) {
    this.stepForward().finally(() => onPause?.());
  }

  private syncToState(currentState: any) {
    console.log(`[ExecutionEngine] syncToState() - State Title: ${currentState.description}`);
    // Sync SceneGraph to State
    const currentGraph = this.sceneManager.getSceneGraph();
    const currentIds = new Set(currentGraph.map(el => el.id));
    
    // 1. Update existing and add missing elements from the snapshot
    currentState.elements.forEach((snapshotEl: any, id: string) => {
      if (currentIds.has(id)) {
        const graphEl = this.sceneManager.getElement(id);
        if (graphEl) Object.assign(graphEl, JSON.parse(JSON.stringify(snapshotEl)));
      } else {
        // Element was destroyed after this snapshot — restore it
        this.sceneManager.addElement(JSON.parse(JSON.stringify(snapshotEl)));
      }
    });

    // 2. Remove elements that were spawned AFTER this snapshot
    // Re-query the scene graph after additions so we don't miss newly added elements
    const freshGraph = this.sceneManager.getSceneGraph();
    freshGraph.forEach(graphEl => {
      if (!currentState.elements.has(graphEl.id)) {
        this.sceneManager.removeElement(graphEl.id);
      }
    });

    // 3. Sync relationship manager and notify renderer
    this.relationshipManager.loadFromScene(this.sceneManager.getSceneGraph());
    this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
  }
}

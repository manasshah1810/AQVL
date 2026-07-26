import type { AQIRProgram } from '@aqvl/shared';
import { SceneManager } from './SceneManager';
import { StateManager } from './StateManager';
import { LayoutManager } from './LayoutManager';
import { TimelineEngine } from './TimelineEngine';
import { AnimationScheduler } from './AnimationScheduler';
import { AnimationController } from './AnimationController';
import { EventDispatcher } from './EventDispatcher';

import { LifecycleManager } from './LifecycleManager';
import { RelationshipManager } from './RelationshipManager';

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

  constructor() {
    this.eventDispatcher = new EventDispatcher();
    this.sceneManager = new SceneManager(this.eventDispatcher);
    this.stateManager = new StateManager();
    this.relationshipManager = new RelationshipManager(this.eventDispatcher);
    this.layoutManager = new LayoutManager(this.sceneManager, this.relationshipManager);
    this.timelineEngine = new TimelineEngine();
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
      // State index 0 = initial state, maps to instruction index -1 (before any instruction)
      this.stateInstructionMap[0] = -1;
      this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Initial State');
    });
  }

  public loadProgram(program: AQIRProgram) {
    console.log('[ExecutionEngine] loadProgram called. Instructions:', program.instructions.length);
    this.program = program;
    this.sceneManager.loadScene(program.objects);
    this.relationshipManager.loadFromScene(this.sceneManager.getSceneGraph());
    this.currentInstructionIndex = 0;
    this.stateInstructionMap = [];
  }
  
  private isPlaying: boolean = false;
  private currentInstructionIndex: number = 0;

  // Maps each StateManager snapshot index to the program instruction index that produced it.
  // Used to restore currentInstructionIndex when stepping through states.
  private stateInstructionMap: number[] = [];

  public async execute() {
    console.log('[ExecutionEngine] execute() started');
    this.isPlaying = true;

    while (this.currentInstructionIndex < this.program!.instructions.length && this.isPlaying) {
      const instruction = this.program!.instructions[this.currentInstructionIndex];
      
      console.log(`[ExecutionEngine] Dispatching instruction ${this.currentInstructionIndex}`);
      this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
      
      // Wait for the instruction animation to complete
      await this.animationController.executeInstruction(instruction);
      
      console.log(`[ExecutionEngine] Instruction ${this.currentInstructionIndex} complete`);

      // Save a canonical state snapshot after every instruction so ALL operations
      // (traversals, property checks, highlights, etc.) are captured in the
      // step timeline — not just operations that happen to call saveState internally.
      const stateDesc = `[${this.currentInstructionIndex + 1}] ${instruction.action}`;
      const nextStateIdx = this.stateManager.getTimelineLength();
      this.stateManager.saveState(
        this.sceneManager.getSceneGraph(),
        stateDesc,
        this.animationScheduler.getCurrentTime()
      );
      // Record which instruction produced this state entry
      this.stateInstructionMap[nextStateIdx] = this.currentInstructionIndex;

      this.currentInstructionIndex++;
      this.eventDispatcher.dispatch('INSTRUCTION_COMPLETE', this.currentInstructionIndex);
      
      if (!this.isPlaying) {
        console.log('[ExecutionEngine] Execution paused.');
        break;
      }
    }

    if (this.currentInstructionIndex >= this.program!.instructions.length) {
      console.log('[ExecutionEngine] Execution finished entirely');
      this.isPlaying = false;
      this.eventDispatcher.dispatch('EXECUTION_FINISHED', null);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getProgress(): number {
    return this.timelineEngine.getCurrentTime();
  }

  public getDuration(): number {
    return this.timelineEngine.getDuration();
  }

  public setPlaybackRate(rate: number): void {
    console.log(`[ExecutionEngine] setPlaybackRate: ${rate}`);
    this.timelineEngine.setPlaybackRate(rate);
  }

  public play() {
    console.log('[ExecutionEngine] play() called');
    if (!this.isPlaying) {
      this.execute();
    }
  }

  public pause() {
    console.log('[ExecutionEngine] pause() called');
    this.isPlaying = false;
  }

  public seek(timeMs: number) {
    // Seeking is not compatible with sequential execution yet
  }

  public stepForward() {
    console.log('[ExecutionEngine] stepForward() called');
    this.isPlaying = false;
    // Navigate to the next saved state snapshot
    const nextState = this.stateManager.stepForward();
    if (nextState) {
      this.syncToState(nextState);
      // Restore instruction index from the map so progress bar stays accurate
      const stateIdx = this.stateManager.getCurrentIndex();
      const instrIdx = this.stateInstructionMap[stateIdx];
      if (instrIdx !== undefined && instrIdx >= 0) {
        this.currentInstructionIndex = instrIdx;
        this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
      }
    } else {
      console.log('[ExecutionEngine] No next state to step forward to');
    }
  }

  public stepBackward() {
    console.log('[ExecutionEngine] stepBackward() called');
    this.isPlaying = false;
    const prevState = this.stateManager.stepBackward();
    if (prevState) {
      this.syncToState(prevState);
      // Restore instruction index from the map so progress bar stays accurate
      const stateIdx = this.stateManager.getCurrentIndex();
      const instrIdx = this.stateInstructionMap[stateIdx];
      if (instrIdx !== undefined) {
        this.currentInstructionIndex = instrIdx >= 0 ? instrIdx : 0;
        this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
      }
    } else {
      console.log('[ExecutionEngine] Cannot step backward further');
    }
  }

  public restart() {
    console.log('[ExecutionEngine] restart() called');
    this.isPlaying = false;
    this.currentInstructionIndex = 0;
    // Jump to the very first saved state (index 0)
    const initialState = this.stateManager.jumpTo(0);
    if (initialState) {
      this.syncToState(initialState);
    }
    this.eventDispatcher.dispatch('INSTRUCTION_START', 0);
  }

  public stepAnimateForward(onPause?: () => void) {
    this.stepForward();
    if (onPause) onPause();
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

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
      this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Initial State');
    });
  }

  public loadProgram(program: AQIRProgram) {
    console.log('[ExecutionEngine] loadProgram called. Instructions:', program.instructions.length);
    this.program = program;
    this.sceneManager.loadScene(program.objects);
    this.relationshipManager.loadFromScene(this.sceneManager.getSceneGraph());
    this.currentInstructionIndex = 0;
  }
  
  private isPlaying: boolean = false;
  private currentInstructionIndex: number = 0;

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
    // Execute exactly one instruction manually
    if (this.currentInstructionIndex < this.program!.instructions.length) {
      const instruction = this.program!.instructions[this.currentInstructionIndex];
      this.eventDispatcher.dispatch('INSTRUCTION_START', this.currentInstructionIndex);
      
      this.animationController.executeInstruction(instruction).then(() => {
        this.currentInstructionIndex++;
        this.eventDispatcher.dispatch('INSTRUCTION_COMPLETE', this.currentInstructionIndex);
      });
    }
  }

  public stepBackward() {
    console.log('[ExecutionEngine] stepBackward() called');
    this.isPlaying = false;
    const prevState = this.stateManager.stepBackward();
    if (prevState) {
      this.syncToState(prevState);
      if (this.currentInstructionIndex > 0) {
        this.currentInstructionIndex--;
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
    this.eventDispatcher.dispatch('INSTRUCTION_START', 0);
  }

  public stepAnimateForward(onPause?: () => void) {
    this.stepForward();
    if (onPause) onPause();
  }

  private syncToState(currentState: any) {
    console.log(`[ExecutionEngine] syncToState() - State Title: ${currentState.title}`);
    // Sync SceneGraph to State
    const currentGraph = this.sceneManager.getSceneGraph();
    const currentIds = new Set(currentGraph.map(el => el.id));
    
    // 1. Update existing and add missing
    currentState.elements.forEach((snapshotEl: any, id: string) => {
        if (currentIds.has(id)) {
          const graphEl = this.sceneManager.getElement(id);
          if (graphEl) Object.assign(graphEl, JSON.parse(JSON.stringify(snapshotEl)));
        } else {
          // It was destroyed, need to add it back
          this.sceneManager.addElement(JSON.parse(JSON.stringify(snapshotEl)));
        }
      });
      
      // 2. Remove extra elements that were spawned after state 0
      currentGraph.forEach(graphEl => {
        if (!currentState.elements.has(graphEl.id)) {
          this.sceneManager.removeElement(graphEl.id);
        }
      });
      
      // 3. Sync relationship manager
      this.relationshipManager.loadFromScene(this.sceneManager.getSceneGraph());
      this.eventDispatcher.dispatch('STATE_UPDATED', currentState);
  }
}

import type { AQIRProgram } from '@aqvl/shared';
import { SceneManager } from './SceneManager';
import { StateManager } from './StateManager';
import { LayoutManager } from './LayoutManager';
import { TimelineEngine } from './TimelineEngine';
import { AnimationController } from './AnimationController';
import { EventDispatcher } from './EventDispatcher';

export class ExecutionEngine {
  public eventDispatcher: EventDispatcher;
  public sceneManager: SceneManager;
  public stateManager: StateManager;
  public layoutManager: LayoutManager;
  public timelineEngine: TimelineEngine;
  public animationController: AnimationController;

  private program: AQIRProgram | null = null;

  constructor() {
    this.eventDispatcher = new EventDispatcher();
    this.sceneManager = new SceneManager(this.eventDispatcher);
    this.stateManager = new StateManager();
    this.layoutManager = new LayoutManager(this.sceneManager);
    this.timelineEngine = new TimelineEngine();
    this.animationController = new AnimationController(
      this.timelineEngine,
      this.sceneManager,
      this.layoutManager,
      this.stateManager,
      this.eventDispatcher
    );

    // When a scene loads, calculate initial layout and save state
    this.eventDispatcher.on('SCENE_LOADED', () => {
      this.layoutManager.updateLayout();
      this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Initial State');
    });
  }

  public loadProgram(program: AQIRProgram) {
    this.program = program;
    this.sceneManager.loadScene(program.objects);
    this.animationController.buildAnimations(program.instructions);
  }
  
  public getIsPlaying(): boolean {
    return this.timelineEngine.getIsPlaying();
  }

  public play() {
    this.timelineEngine.play();
  }

  public pause() {
    this.timelineEngine.pause();
  }

  public restart() {
    this.timelineEngine.pause();
    this.timelineEngine.seek(0);
    this.stateManager.jumpTo(0);
    
    // Sync SceneGraph to State 0
    const currentState = this.stateManager.getCurrentState();
    if (currentState) {
      const currentGraph = this.sceneManager.getSceneGraph();
      currentGraph.forEach(graphEl => {
        const snapshotEl = currentState.elements.get(graphEl.id);
        if (snapshotEl) {
          Object.assign(graphEl, JSON.parse(JSON.stringify(snapshotEl)));
        }
      });
    }
  }
}

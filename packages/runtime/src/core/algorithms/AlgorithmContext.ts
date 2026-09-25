/**
 * Shared contract every structure's AlgorithmHandler (HeapEngine, BSTAlgorithms,
 * GraphAlgorithms, HashMapVisualizer, TrieVisualizer, ...) implements and is
 * called with. See docs/design/algorithm-engine-pattern.md for the full
 * pure-data-structure + AlgorithmHandler engine pattern these are built on —
 * read that before adding a new engine (e.g. for Array/Stack/Queue/LinkedList)
 * so it follows the same shape instead of drifting further.
 */
import { AnimationScheduler } from '../AnimationScheduler';
import { SceneManager } from '../SceneManager';
import { LayoutManager } from '../LayoutManager';
import { StateManager } from '../StateManager';
import { RelationshipManager } from '../RelationshipManager';
import { EventDispatcher } from '../EventDispatcher';
import { GenericActionInstruction } from '@aqvl/shared';
import { PacingConfig } from '../../narrative/PacingConfig';

export interface AlgorithmContext {
  scheduler: AnimationScheduler;
  sceneManager: SceneManager;
  layoutManager: LayoutManager;
  eventDispatcher: EventDispatcher;
  stateManager?: StateManager;
  relationshipManager?: RelationshipManager;

  // Expose the current tree being operated on
  activeTreeName?: string | null;
  defaultColor: string;
  /**
   * Significance-to-duration-multiplier mapping (docs/design/array-narrative-ux-spec.md §4).
   * Defaults to PacingConfig's built-in tiers when omitted — callers (e.g. a future Phase 6
   * user speed-control panel) can supply their own instance to override per-tier pacing
   * without touching handler code.
   */
  pacingConfig?: PacingConfig;
}

export interface AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void;
}

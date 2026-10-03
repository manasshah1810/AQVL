/**
 * BSTEngine — Animation handler for BST operations.
 *
 * Registered with AlgorithmRegistry for:
 *   BST_INSERT, BST_DELETE, BST_SEARCH, BST_CLEAR, ROTATE
 *
 * Also reached from AnimationController when generic INSERT / DELETE /
 * SEARCH / CLEAR / INORDER / ... are dispatched inside a BST context (i.e.
 * when the active data structure is a BST rather than an array).
 *
 * The tree lives in the scene as TREE_NODE elements linked by EDGE elements
 * labelled 'L' / 'R'; the scene is the source of truth. Every operation
 * rehydrates the pure BinarySearchTree (../../data-structures/BST.ts) from
 * it, runs there, and the steps it recorded are replayed onto the scene by
 * `replaySteps`. The scene-side work a step implies — adding a node and its
 * edge, rewiring edges for a rotation, removing nodes, the Reingold-Tilford
 * style layout — is done by the static scene helpers below.
 *
 * Visual color semantics:
 *   Visiting node     → TRAVERSING (blue glow)
 *   Comparison active → EVALUATING (yellow)
 *   Insert point      → SUCCESS / MODIFYING (green)
 *   Delete target     → red pulse
 *   Found             → SUCCESS (green pulse)
 *   Successor         → ACTIVE (orange/amber)
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { SceneManager } from '../SceneManager';
import { RelationshipManager } from '../RelationshipManager';
import { BinarySearchTree, BSTNodeRef, BSTSide, BSTStep, DepthFirstOrder } from '../../data-structures/BST';

export type { BSTNodeRef, DeleteCase } from '../../data-structures/BST';

export interface BSTInsertResult {
  /** Whether the insert succeeded */
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Nodes visited during the traversal (for animation) */
  traversalPath: BSTNodeRef[];
  /** Direction taken at each node: 'L' = left, 'R' = right */
  directions: string[];
  /** The node the new key hangs from (null: it becomes the root) */
  parentNode?: BSTNodeRef | null;
  /** Edge label from parent to new node */
  edgeLabel?: 'L' | 'R' | null;
}

export interface BSTSearchResult {
  /** Whether the value was found */
  found: boolean;
  /** The found node (if any) */
  targetNode?: BSTNodeRef;
  /** Nodes visited during the search */
  traversalPath: BSTNodeRef[];
  /** Human-readable comparison at each step */
  comparisons: string[];
}

export interface BSTIndex {
  left: Map<string, any>;
  right: Map<string, any>;
  parent: Map<string, any>;
  edgeLabel: Map<string, 'L' | 'R'>;
  /** Root element (node with no incoming edge), or null */
  root: any | null;
}

/** Last index per scene manager and tree, reused until the scene's revision moves. */
const indexCache = new WeakMap<SceneManager, Map<string, { revision: number; index: BSTIndex }>>();

const DELETE_CASE_MESSAGE: Record<string, (value: number) => string> = {
  LEAF: (value) => `Node ${value} is a leaf node.\nSimply removing it.`,
  ONE_CHILD: (value) => `Node ${value} has one child.\nBypassing node, connecting parent to child.`,
  TWO_CHILDREN: (value) => `Node ${value} has two children.\nFinding inorder successor...`,
};

export class BSTEngine implements AlgorithmHandler {
  /** Node color used for all BST sphere nodes */
  static readonly NODE_COLOR = '#4facfe';
  static readonly NODE_EMISSIVE = '#000000';
  static readonly NODE_EMISSIVE_INTENSITY = 0;

  // ── Layout parameters ──────────────────────────────────────────────────────
  private static readonly LEVEL_SPACING = 2.0;
  private static readonly MIN_SIBLING_SPACING = 1.8;

  /** The BST_* statements registered with AlgorithmRegistry. */
  static readonly ALGORITHMS = ['BST_INSERT', 'BST_DELETE', 'BST_SEARCH', 'BST_CLEAR', 'ROTATE'];

  /** Statements shared with other structures, handled here when they target a BST (see `isBSTTarget`). */
  static readonly SHARED_ACTIONS = [
    'INSERT', 'DELETE', 'SEARCH', 'CLEAR', 'INORDER', 'PREORDER', 'POSTORDER', 'LEVELORDER',
    'MIN', 'MIN_VALUE', 'MAX', 'MAX_VALUE', 'HEIGHT', 'SIZE', 'ROOT', 'IS_EMPTY',
  ];

  /**
   * The tree a scene's statements act on by default: its BST anchor (a BST
   * takes priority), else any TREE / BINARY_TREE anchor; null when there is
   * neither.
   */
  static detectActiveTree(sceneManager: SceneManager): { name: string; isBST: boolean } | null {
    const graph = sceneManager.getSceneGraph() as any[];
    const bstEl = graph.find(el => el.type === 'BST' || el.originalType === 'BST');
    if (bstEl) return { name: bstEl.logicalParent || bstEl.label || bstEl.id, isBST: true };
    const treeEl = graph.find(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
    if (treeEl) return { name: treeEl.logicalParent || treeEl.label || treeEl.id, isBST: false };
    return null;
  }

  /**
   * Whether the structure named `targetName` (an instruction's
   * payload.logicalParent) is a BST anchor in the scene, so bare INSERT /
   * DELETE / SEARCH instructions are routed by what they actually target.
   * Falls back to `fallback` (the scene-wide flag) when there is no name, or
   * no anchor of either kind for it.
   */
  static isBSTTarget(sceneManager: SceneManager, targetName: string | undefined, fallback: boolean): boolean {
    if (!targetName) return fallback;
    const graph = sceneManager.getSceneGraph() as any[];
    const anchor = graph.find(
      el => el.logicalParent === targetName && (el.type === 'BST' || el.originalType === 'BST')
    );
    if (anchor) return true;
    const nonBstAnchor = graph.find(
      el =>
        el.logicalParent === targetName &&
        (el.type === 'TREE' || el.type === 'BINARY_TREE' || el.originalType === 'TREE' || el.originalType === 'BINARY_TREE' ||
         el.type === 'ARRAY' || el.originalType === 'ARRAY_ELEMENT' || el.originalType === 'ARRAY')
    );
    if (nonBstAnchor) return false;
    return fallback;
  }

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();
    // A BST_* statement naming its tree marks the active tree as a BST.
    if ((instruction as any).payload?.logicalParent && ['BST_INSERT', 'BST_DELETE', 'BST_SEARCH', 'BST_CLEAR'].includes(action)) {
      context.activeTreeIsBST = true;
    }

    if (action === 'BST_INSERT' || action === 'INSERT') {
      this.bstInsert(context, instruction);
    } else if (action === 'BST_DELETE' || action === 'DELETE') {
      this.bstDelete(context, instruction);
    } else if (action === 'BST_SEARCH' || action === 'SEARCH') {
      this.bstSearch(context, instruction);
    } else if (action === 'BST_CLEAR' || action === 'CLEAR') {
      this.bstClear(context);
    } else if (action === 'ROTATE') {
      this.bstRotate(context, instruction);
    } else if (action === 'INORDER' || action === 'PREORDER' || action === 'POSTORDER') {
      this.traversal(context, action);
    } else if (action === 'LEVELORDER') {
      this.levelOrder(context);
    } else if (action === 'MIN' || action === 'MIN_VALUE') {
      this.minMax(context, 'MIN');
    } else if (action === 'MAX' || action === 'MAX_VALUE') {
      this.minMax(context, 'MAX');
    } else if (action === 'HEIGHT') {
      this.height(context);
    } else if (action === 'SIZE') {
      this.size(context);
    } else if (action === 'ROOT') {
      this.showRoot(context);
    } else if (action === 'IS_EMPTY') {
      this.isEmpty(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operations: rehydrate, run the pure operation, replay its steps
  // ─────────────────────────────────────────────────────────────────────────

  private treeName(context: AlgorithmContext): string {
    return context.activeTreeName || 'defaultBST';
  }

  /** The numeric key in args[0], or null after logging why it is not one. */
  private keyArg(context: AlgorithmContext, instruction: GenericActionInstruction, op: string): number | null {
    const rawValue = (instruction as any).args?.[0];
    const value = Number(rawValue);
    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". ${op} requires a numeric argument.`, 'warning');
      return null;
    }
    return value;
  }

  private bstInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = this.treeName(context);
    const value = this.keyArg(context, instruction, 'INSERT');
    if (value === null) return;

    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    if (!tree.insert(value)) {
      // A duplicate shows only where the key was met.
      this.replaySteps(context, treeName, tree.steps.filter((step) => step.type === 'DUPLICATE'));
      this.log(context, 'INSERT_ERROR', `Value ${value} already exists.`, 'warning');
      return;
    }

    this.log(context, 'INSERT', `Inserting ${value}...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    const attach = tree.steps.find((step) => step.type === 'ATTACH') as Extract<BSTStep, { type: 'ATTACH' }>;
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        const loc = attach.parent
          ? `as ${attach.side === 'L' ? 'Left' : 'Right'} child of ${attach.parent.value}`
          : 'as Root';
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'INSERT',
          message: `Inserted ${value} successfully ${loc}.`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Inserted ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private bstSearch(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = this.treeName(context);
    const value = this.keyArg(context, instruction, 'SEARCH');
    if (value === null) return;

    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    if (!tree.root) {
      this.log(context, 'SEARCH', 'Tree is empty. Nothing to search.', 'warning');
      return;
    }
    const found = tree.search(value) !== null;

    this.log(context, 'SEARCH', `Searching for ${value}...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', found
          ? { keyword: 'SEARCH_SUCCESS', message: `Value ${value} found!`, kind: 'result', timestamp: Date.now() }
          : { keyword: 'SEARCH_FAIL', message: `Value ${value} does not exist in the BST.`, kind: 'warning', timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }

  private bstDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = this.treeName(context);
    const value = this.keyArg(context, instruction, 'DELETE');
    if (value === null) return;

    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    if (!tree.root) {
      this.log(context, 'DELETE', 'Tree is empty. Nothing to delete.', 'warning');
      return;
    }

    if (!tree.delete(value)) {
      this.replaySteps(context, treeName, tree.steps);
      this.log(context, 'DELETE_ERROR', `Value ${value} not found.`, 'warning');
      return;
    }

    this.log(context, 'DELETE', `Deleting ${value}...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'DELETE',
          message: `Deleted ${value} successfully. BST property maintained.`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Deleted ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private bstClear(context: AlgorithmContext): void {
    const treeName = this.treeName(context);
    if (BSTEngine.getNodes(context.sceneManager, treeName).length === 0) {
      this.log(context, 'CLEAR', 'BST is already empty.', 'info');
      return;
    }
    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    tree.clear();

    this.log(context, 'CLEAR', 'Clearing BST...', 'operation');
    this.replaySteps(context, treeName, tree.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performClear(context.sceneManager, treeName);
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'CLEAR',
          message: 'BST cleared.',
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), 'Cleared BST', context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  /**
   * `ROTATE <value> <LEFT|RIGHT>` — rotates the subtree rooted at the node
   * holding `value`. Actually rewires parent/child edges and re-lays out
   * every node so the visible result is the real post-rotation shape, not an
   * acknowledgment tween.
   */
  private bstRotate(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = this.treeName(context);
    const rawValue = (instruction as any).args?.[0];
    const rawDirection = (instruction as any).args?.[1];
    const value = Number(rawValue);
    const direction = String(rawDirection ?? '').toUpperCase();

    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". ROTATE requires a numeric node value.`, 'warning');
      return;
    }
    if (direction !== 'LEFT' && direction !== 'RIGHT') {
      this.log(context, 'ERROR', `ROTATE requires a direction: "ROTATE ${rawValue} LEFT" or "ROTATE ${rawValue} RIGHT".`, 'warning');
      return;
    }

    const pivot = BSTEngine.findNodeByValue(context.sceneManager, treeName, value);
    if (!pivot) {
      this.log(context, 'ERROR', `Value ${value} not found in "${treeName}".`, 'warning');
      return;
    }

    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    const result = tree.rotate(pivot.id, direction === 'LEFT' ? 'L' : 'R');
    if (!result.success) {
      this.log(context, 'ERROR', result.error!, 'warning');
      return;
    }

    this.log(context, 'ROTATE', `Rotating ${direction} at ${value}...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    this.log(context, 'ROTATE', `Rotated ${direction} at ${value} in "${treeName}".`, 'result');
    if (context.stateManager) {
      context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Rotated ${direction} at ${value}`, context.scheduler.getCurrentTime());
      context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
    }
  }

  /** The rehydrated tree, or null after reporting that it is empty. */
  private nonEmptyTree(context: AlgorithmContext, treeName: string): BinarySearchTree | null {
    const tree = BSTEngine.rehydrate(context.sceneManager, treeName);
    if (!tree.root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return null;
    }
    return tree;
  }

  /** Every node a run of steps lit up, to fade back to neutral at the end. */
  private fadeNodesBack(context: AlgorithmContext, steps: BSTStep[], scale: boolean): void {
    steps.forEach((step) => {
      if (!('node' in step)) return;
      const el = context.sceneManager.getElement(step.node.id) as any;
      if (!el) return;
      context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveIntensity: 0, duration: 400 });
      if (scale) context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
    });
  }

  private traversal(context: AlgorithmContext, order: DepthFirstOrder): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;
    tree.traverse(order);

    this.log(context, order, `Starting ${order} Traversal...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    // Cleanup colors
    context.scheduler.enqueue({
      targets: {}, duration: 500, complete: () => {
        this.fadeNodesBack(context, tree.steps, false);
        context.scheduler.commitGroup(true);
      }
    });
    this.log(context, order, 'Traversal Complete', 'operation');
    context.scheduler.commitSequential();
  }

  private levelOrder(context: AlgorithmContext): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;
    tree.levelOrder();

    this.log(context, 'LEVELORDER', 'Starting Level-Order Traversal...', 'operation');
    this.replaySteps(context, treeName, tree.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 500, complete: () => {
        this.fadeNodesBack(context, tree.steps, false);
        context.scheduler.commitGroup(true);
      }
    });
    this.log(context, 'LEVELORDER', 'Traversal Complete', 'operation');
    context.scheduler.commitSequential();
  }

  private minMax(context: AlgorithmContext, type: 'MIN' | 'MAX'): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;
    if (type === 'MIN') tree.min();
    else tree.max();

    this.log(context, type, `Finding ${type}imum value...`, 'operation');
    this.replaySteps(context, treeName, tree.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.fadeNodesBack(context, tree.steps.filter((step) => step.type === 'DESCEND'), true);
        const edges = BSTEngine.getEdges(context.sceneManager, treeName);
        edges.forEach(e => context.scheduler.enqueue({ targets: e, color: '#888888', scale: { x: 1, y: 1, z: 1 }, duration: 400 }));
        context.scheduler.commitGroup(true);
      }
    });
    context.scheduler.commitSequential();
  }

  private height(context: AlgorithmContext): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;
    const totalHeight = tree.height();

    this.log(context, 'HEIGHT', 'Computing tree height recursively...', 'operation');
    this.replaySteps(context, treeName, tree.steps);
    this.log(context, 'HEIGHT', `Height = ${totalHeight}`, 'result');

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.fadeNodesBack(context, tree.steps, false);
        context.scheduler.commitGroup(true);
      }
    });
    context.scheduler.commitSequential();
  }

  private size(context: AlgorithmContext): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;
    const totalSize = tree.size();

    this.log(context, 'SIZE', 'Computing tree size...', 'operation');
    this.replaySteps(context, treeName, tree.steps);
    this.log(context, 'SIZE', `Total Nodes = ${totalSize}`, 'result');

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.fadeNodesBack(context, tree.steps, false);
        context.scheduler.commitGroup(true);
      }
    });
    context.scheduler.commitSequential();
  }

  private showRoot(context: AlgorithmContext): void {
    const treeName = this.treeName(context);
    const tree = this.nonEmptyTree(context, treeName);
    if (!tree) return;

    const el = context.sceneManager.getElement(tree.root!.id) as any;
    const successToken = getSemanticColorToken('SUCCESS');

    this.log(context, 'ROOT', 'Root Highlight', 'step');
    context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
    context.scheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    this.log(context, 'ROOT', `Root = ${tree.root!.value}`, 'result');
    context.scheduler.advanceCursor(500);

    context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveIntensity: 0, duration: 400 });
    context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.commitSequential();
  }

  private isEmpty(context: AlgorithmContext): void {
    const tree = BSTEngine.rehydrate(context.sceneManager, this.treeName(context));
    if (!tree.root) {
      this.log(context, 'IS_EMPTY', 'BST is Empty', 'result');
      return;
    }

    this.log(context, 'IS_EMPTY', 'BST is Not Empty', 'result');

    const el = context.sceneManager.getElement(tree.root.id) as any;
    const evaluatingToken = getSemanticColorToken('EVALUATING');

    context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.7, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveIntensity: 0, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Replay
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Turns the steps a pure BinarySearchTree recorded into scheduler animation
   * and scene changes on the tree `treeName`. Every operation funnels through
   * here; a step is drawn the same way whichever operation recorded it,
   * except where the step itself names the walk / traversal it belongs to.
   */
  replaySteps(context: AlgorithmContext, treeName: string, steps: BSTStep[]): void {
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const element = (node: BSTNodeRef) => context.sceneManager.getElement(node.id) as any;
    // A delete that will not find its key walks the path plainly, without anticipation.
    const deleteFails = steps.some((step) => step.type === 'NOT_FOUND' && step.walk === 'DELETE');
    const order: number[] = [];

    steps.forEach((step, index) => {
      switch (step.type) {
        case 'COMPARE': {
          const el = element(step.node);
          if (!el) return;
          if (step.walk === 'INSERT') {
            const comparison = step.side === 'L'
              ? `${step.value} < ${step.node.value} → Go Left`
              : `${step.value} > ${step.node.value} → Go Right`;
            AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
            el.state = 'TRAVERSING';
            context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300, easing: 'easeOutExpo' });
            context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300, easing: 'easeOutExpo' });
            context.scheduler.commitGroup(true);
            this.log(context, 'INSERT', `Compare with ${step.node.value}\n${comparison}`, 'step');
            context.scheduler.advanceCursor(350);
            el.state = 'NEUTRAL';
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250, easing: 'easeInOutQuad' });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
            context.scheduler.commitGroup(true);
          } else if (step.walk === 'SEARCH') {
            AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
            el.state = traversingToken.name;
            context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.9, duration: 350, easing: 'easeOutExpo' });
            context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350, easing: 'easeOutExpo' });
            context.scheduler.commitGroup(true);
            this.log(context, 'SEARCH', `${step.value} ${step.side === 'L' ? '<' : '>'} ${step.node.value} → Go ${step.side === 'L' ? 'Left' : 'Right'}`, 'step');
            context.scheduler.advanceCursor(400);
            el.state = 'NEUTRAL';
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 250 });
            context.scheduler.commitGroup(true);
          } else {
            if (!deleteFails) AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
            context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 280 });
            context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 280 });
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(250);
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 200 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
            context.scheduler.commitGroup(true);
          }
          return;
        }

        case 'FOUND': {
          const el = element(step.node);
          if (step.walk === 'SEARCH') {
            if (!el) return;
            AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
            el.state = successToken.name;
            context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 350, easing: 'easeOutExpo' });
            context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350, easing: 'easeOutExpo' });
            context.scheduler.commitGroup(true);
            this.log(context, 'SEARCH', `${step.value} = ${step.node.value} → Found!`, 'step');
            context.scheduler.advanceCursor(600);
            // Pulse effect for found node
            context.scheduler.enqueue({ targets: el.scale, x: 1.4, y: 1.4, z: 1.4, duration: 200, easing: 'easeOutQuad' });
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(150);
            context.scheduler.enqueue({ targets: el.scale, x: 1.1, y: 1.1, z: 1.1, duration: 200, easing: 'easeInOutQuad' });
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(200);
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 600 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
            context.scheduler.commitGroup(true);
            return;
          }
          // DELETE: the target turns red, then the case is announced.
          if (el) {
            AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'DELETION');
            context.scheduler.enqueue({ targets: el, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 400 });
            context.scheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
            context.scheduler.commitGroup(true);
          }
          const removal = steps.find((s) => s.type === 'REMOVE') as Extract<BSTStep, { type: 'REMOVE' }> | undefined;
          if (removal) this.log(context, 'DELETE', DELETE_CASE_MESSAGE[removal.deleteCase](step.value), 'step');
          context.scheduler.advanceCursor(500);
          return;
        }

        case 'NOT_FOUND':
          return;

        case 'DUPLICATE': {
          const el = element(step.node);
          if (!el) return;
          const errorToken = getSemanticColorToken('DISCARDED');
          context.scheduler.enqueue({ targets: el, color: errorToken.color, emissiveColor: errorToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
          context.scheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(400);
          context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 300 });
          context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
          context.scheduler.commitGroup(true);
          return;
        }

        case 'ATTACH':
          this.attach(context, treeName, step);
          return;

        case 'SUCCESSOR_WALK':
        case 'SUCCESSOR': {
          const el = element(step.node);
          if (!el) return;
          const isSuccessor = step.type === 'SUCCESSOR';
          const token = isSuccessor ? getSemanticColorToken('ACTIVE') : traversingToken;
          context.scheduler.enqueue({ targets: el, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
          context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(isSuccessor ? 0 : 300);
          if (!isSuccessor) {
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 200 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
            context.scheduler.commitGroup(true);
          }
          return;
        }

        case 'REMOVE':
          if (step.deleteCase === 'LEAF') this.removeLeaf(context, treeName, step);
          else if (step.deleteCase === 'ONE_CHILD') this.removeWithOneChild(context, treeName, step);
          else this.removeWithTwoChildren(context, treeName, step);
          return;

        case 'ROTATE':
          this.rotate(context, treeName, step);
          return;

        case 'VISIT': {
          const el = element(step.node);
          if (!el) return;
          AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
          context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
          context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 250 });
          this.log(context, step.order, `Visit ${step.node.value}`, 'step');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(250);
          context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.4, duration: 200 });
          context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
          context.scheduler.commitGroup(true);
          return;
        }

        case 'PROCESS': {
          const el = element(step.node);
          if (!el) return;
          order.push(step.node.value);
          context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
          context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 300 });
          if (step.order === 'LEVELORDER') {
            this.log(context, 'LEVELORDER', `Visit ${step.node.value}\nOrder: ${order.join(' → ')}`, 'result');
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(350);
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
            context.scheduler.commitGroup(true);
          } else {
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(350);
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
            context.scheduler.commitGroup(true);
            this.log(context, step.order, `Order: ${order.join(' → ')}`, 'result');
          }
          return;
        }

        case 'MOVE_LEFT':
        case 'MOVE_RIGHT':
        case 'BACKTRACK': {
          if (!element(step.node)) return;
          const edge = BSTEngine.getEdgeBetween(context.sceneManager, treeName, step.node.id, step.targetNode.id);
          const back = step.type === 'BACKTRACK';
          if (edge) {
            context.scheduler.enqueue(back
              ? { targets: edge, color: '#888888', scale: { x: 1, y: 1, z: 1 }, duration: 200 }
              : { targets: edge, color: traversingToken.color, scale: { x: 1.5, y: 1.5, z: 1.5 }, duration: 200 });
          }
          this.log(context, step.order, back ? 'Backtrack' : `Move ${step.type === 'MOVE_LEFT' ? 'Left' : 'Right'}`, 'step');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(200);
          return;
        }

        case 'ENQUEUE': {
          const el = element(step.node);
          if (!el) return;
          context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.5, duration: 200 });
          this.log(context, 'LEVELORDER', `Push ${step.node.value}\nQueue: [${step.queue.map(n => n.value).join(', ')}]`, 'step');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(200);
          return;
        }

        case 'DEQUEUE':
          if (!element(step.node)) return;
          this.log(context, 'LEVELORDER', `Dequeue ${step.node.value}\nQueue: [${step.queue.map(n => n.value).join(', ')}]`, 'step');
          context.scheduler.advanceCursor(100);
          return;

        case 'DESCEND': {
          const el = element(step.node);
          if (!el) return;
          context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
          context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 250 });
          this.log(context, step.toward, `Visit ${step.node.value}`, 'step');
          if (step.from) {
            const edge = BSTEngine.getEdgeBetween(context.sceneManager, treeName, step.from.id, step.node.id);
            if (edge) context.scheduler.enqueue({ targets: edge, color: evaluatingToken.color, scale: { x: 1.5, y: 1.5, z: 1.5 }, duration: 200 });
          }
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(250);
          if (steps[index + 1]?.type === 'DESCEND') {
            this.log(context, step.toward, `Move ${step.toward === 'MIN' ? 'Left' : 'Right'}`, 'step');
            context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
            context.scheduler.commitGroup(true);
          }
          return;
        }

        case 'EXTREME': {
          const leaf = element(step.node);
          this.log(context, step.toward, 'Stop', 'step');
          context.scheduler.advanceCursor(150);
          context.scheduler.enqueue({ targets: leaf, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
          context.scheduler.enqueue({ targets: leaf.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
          context.scheduler.commitGroup(true);
          this.log(context, step.toward, `${step.toward}imum Found\n${step.toward}imum Value = ${step.node.value}`, 'result');
          context.scheduler.advanceCursor(600);
          return;
        }

        case 'MEASURE': {
          const el = element(step.node);
          if (!el) return;
          context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.6, duration: 200 });
          this.log(context, 'HEIGHT', `Compute Height for ${step.node.value}`, 'step');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(200);
          return;
        }

        case 'HEIGHT': {
          const el = element(step.node);
          if (!el) return;
          context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
          this.log(context, 'HEIGHT', `Return\nHeight for ${step.node.value} = ${step.height}`, 'result');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(300);
          context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveIntensity: 0.3, duration: 200 });
          context.scheduler.commitGroup(true);
          return;
        }

        case 'COUNT': {
          const el = element(step.node);
          if (!el) return;
          context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 200 });
          this.log(context, 'SIZE', `Visit Node ${step.node.value}\nCounter = ${step.count}`, 'step');
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(250);
          context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveIntensity: 0.5, duration: 200 });
          context.scheduler.commitGroup(true);
          return;
        }

        case 'CLEAR': {
          // Nodes shrink out level by level (root-outward), in the order they are drawn.
          BSTEngine.getClearOrder(context.sceneManager, treeName).forEach((node, idx) => {
            const el = context.sceneManager.getElement(node.id) as any;
            if (!el) return;
            const delay = idx * 60; // stagger per node
            context.scheduler.enqueue({ targets: el.scale, x: 0, y: 0, z: 0, duration: 350, easing: 'easeInBack', delay });
            context.scheduler.enqueue({ targets: el, emissiveColor: '#f56565', emissiveIntensity: 0.6, duration: 200, delay });
          });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(200);
          return;
        }
      }
    });
  }

  /** ATTACH: the new node is created under its parent, every node glides to the new layout, and the new one pops in. */
  private attach(context: AlgorithmContext, treeName: string, step: Extract<BSTStep, { type: 'ATTACH' }>): void {
    const newEl = BSTEngine.insertNode(
      context.sceneManager,
      context.relationshipManager!,
      treeName,
      step.value,
      step.parent,
      step.side
    );

    // Recompute layout
    const layoutMap = BSTEngine.computeLayout(context.sceneManager, treeName);
    layoutMap.forEach((pos, id) => {
      const el = context.sceneManager.getElement(id) as any;
      if (el) el.worldTarget = pos;
    });

    // Place new node at its target x/z, start below the scene
    if (newEl.worldTarget) {
      newEl.position.x = newEl.worldTarget.x;
      newEl.position.z = newEl.worldTarget.z;
    }

    // Animate ALL existing nodes to their new positions
    const successToken = getSemanticColorToken('SUCCESS');
    BSTEngine.getNodes(context.sceneManager, treeName).forEach(n => {
      if (n.id === newEl.id) return;
      const pos = layoutMap.get(n.id);
      if (pos) {
        context.scheduler.enqueue({ targets: n.position, x: pos.x, y: pos.y, z: pos.z, duration: 500, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);

    // Pop in the new node
    context.scheduler.enqueue({ targets: newEl.position, y: newEl.worldTarget?.y ?? 0, duration: 600, easing: 'easeOutBounce' });
    context.scheduler.enqueue({ targets: newEl.scale, x: 1, y: 1, z: 1, duration: 600, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: newEl, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    // Fade new node to normal color
    context.scheduler.enqueue({ targets: newEl, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 500 });
    context.scheduler.enqueue({ targets: newEl.scale, x: 1, y: 1, z: 1, duration: 300 });
    context.scheduler.commitGroup(true);
  }

  /** REMOVE of a leaf: it drops away and is removed with its parent edge. */
  private removeLeaf(context: AlgorithmContext, treeName: string, step: Extract<BSTStep, { type: 'REMOVE' }>): void {
    const targetEl = context.sceneManager.getElement(step.node.id) as any;
    if (!targetEl) return;

    context.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 500, easing: 'easeInBack' });
    context.scheduler.enqueue({ targets: targetEl.position, y: '-=2', duration: 500, easing: 'easeInBack' });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performLeafDelete(context.sceneManager, context.relationshipManager!, treeName, step.node.id);
        this.reLayoutAndAnimate(context, treeName);
      }
    });
    context.scheduler.commitSequential();
  }

  /** REMOVE of a node with one child: the child is lit, the node shrinks away and the child takes its place. */
  private removeWithOneChild(context: AlgorithmContext, treeName: string, step: Extract<BSTStep, { type: 'REMOVE' }>): void {
    const targetEl = context.sceneManager.getElement(step.node.id) as any;
    const replacement = step.replacement!;
    const childEl = context.sceneManager.getElement(replacement.id) as any;

    if (!targetEl) return;

    if (childEl) {
      const activeToken = getSemanticColorToken('ACTIVE');
      context.scheduler.enqueue({ targets: childEl, color: activeToken.color, emissiveColor: activeToken.emissiveColor, emissiveIntensity: 0.8, duration: 350 });
      context.scheduler.enqueue({ targets: childEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 350 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(300);
      this.log(context, 'DELETE', `Child ${replacement.value} moves up to replace ${step.node.value}.`, 'step');
    }

    // Shrink and remove target
    context.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
    context.scheduler.enqueue({ targets: targetEl.position, y: '+=2', duration: 400, easing: 'easeInBack' });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performOneChildDelete(
          context.sceneManager,
          context.relationshipManager!,
          treeName,
          step.node.id,
          replacement.id,
          step.parent?.id || null,
          step.side
        );
        this.reLayoutAndAnimate(context, treeName);
        if (childEl) {
          childEl.color = BSTEngine.NODE_COLOR;
          childEl.emissiveIntensity = 0;
          childEl.scale = { x: 1, y: 1, z: 1 };
        }
      }
    });
    context.scheduler.commitSequential();
  }

  /** REMOVE of a node with two children: it takes its successor's key and the successor node shrinks away. */
  private removeWithTwoChildren(context: AlgorithmContext, treeName: string, step: Extract<BSTStep, { type: 'REMOVE' }>): void {
    const successor = step.successor!;
    this.log(context, 'DELETE', `Inorder Successor = ${successor.value}\nReplacing ${step.node.value} with ${successor.value}.\nDeleting successor node.`, 'step');
    context.scheduler.advanceCursor(500);

    // Animate target node changing its value (successor takes over)
    const targetEl = context.sceneManager.getElement(step.node.id) as any;
    const successorEl = context.sceneManager.getElement(successor.id) as any;

    if (targetEl) {
      const modifyingToken = getSemanticColorToken('MODIFYING');
      context.scheduler.enqueue({ targets: targetEl, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
      context.scheduler.enqueue({ targets: targetEl.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(300);
      context.scheduler.enqueue({ targets: targetEl, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 400 });
      context.scheduler.enqueue({ targets: targetEl.scale, x: 1, y: 1, z: 1, duration: 400 });
      context.scheduler.commitGroup(true);
    }

    // Shrink out the successor
    if (successorEl) {
      context.scheduler.enqueue({ targets: successorEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
      context.scheduler.enqueue({ targets: successorEl.position, y: '-=2', duration: 400, easing: 'easeInBack' });
      context.scheduler.commitGroup(true);
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performTwoChildrenDelete(
          context.sceneManager,
          context.relationshipManager!,
          treeName,
          step.node.id,
          successor.id
        );
        this.reLayoutAndAnimate(context, treeName);
      }
    });
    context.scheduler.commitSequential();
  }

  /** ROTATE: the pivot is lit, the edges are rewired at once, every node glides to the new shape. */
  private rotate(context: AlgorithmContext, treeName: string, step: Extract<BSTStep, { type: 'ROTATE' }>): void {
    const pivotEl = context.sceneManager.getElement(step.pivot.id) as any;
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    if (pivotEl) {
      context.scheduler.enqueue({ targets: pivotEl, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
      context.scheduler.commitGroup(true);
    }

    // The rewire is synchronous — like BST_INSERT's node/edge creation, it
    // must not be gated behind an animation `complete` callback, since the
    // tree's logical shape (what re-layout, subsequent operations, and tests
    // observe) should be correct immediately.
    BSTEngine.rewireRotation(context.sceneManager, context.relationshipManager!, treeName, step);
    this.reLayoutAndAnimate(context, treeName);

    const newRootEl = context.sceneManager.getElement(step.child.id) as any;
    [newRootEl, pivotEl].forEach((el) => {
      if (!el) return;
      context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 400 });
    });
    context.scheduler.commitGroup(true);
  }

  /** Recompute and animate all nodes to their new layout positions */
  private reLayoutAndAnimate(context: AlgorithmContext, treeName: string): void {
    const layoutMap = BSTEngine.computeLayout(context.sceneManager, treeName);
    const allNodes = BSTEngine.getNodes(context.sceneManager, treeName);
    allNodes.forEach(n => {
      (n as any).worldTarget = layoutMap.get(n.id);
      const pos = layoutMap.get(n.id);
      if (pos) {
        context.scheduler.enqueue({ targets: n.position, x: pos.x, y: pos.y, z: pos.z, duration: 600, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** All TREE_NODE elements belonging to the given BST group */
  static getNodes(sceneManager: SceneManager, treeName: string): any[] {
    return sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === treeName && el.originalType === 'TREE_NODE');
  }

  /** All EDGE elements belonging to the given BST group */
  static getEdges(sceneManager: SceneManager, treeName: string): any[] {
    return sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === treeName && el.originalType === 'EDGE');
  }

  /** Resolve node by numeric value from the scene */
  static findNodeByValue(sceneManager: SceneManager, treeName: string, value: number): any | null {
    const nodes = this.getNodes(sceneManager, treeName);
    return nodes.find((n: any) => Number(n.value) === value) || null;
  }

  /** Find the root (node with no parent edge pointing to it) */
  static getRoot(sceneManager: SceneManager, treeName: string): any | null {
    return this.buildIndex(sceneManager, treeName).root;
  }

  /** Get left child element of a node */
  static getLeftChild(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const lEdge = edges.find((e: any) => e.sourceId === nodeId && e.properties?.label === 'L');
    if (!lEdge) return null;
    return sceneManager.getElement(lEdge.targetId) || null;
  }

  /** Get right child element of a node */
  static getRightChild(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const rEdge = edges.find((e: any) => e.sourceId === nodeId && e.properties?.label === 'R');
    if (!rEdge) return null;
    return sceneManager.getElement(rEdge.targetId) || null;
  }

  /** Get parent element of a node */
  static getParent(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const pEdge = edges.find((e: any) => e.targetId === nodeId);
    if (!pEdge) return null;
    return sceneManager.getElement(pEdge.sourceId) || null;
  }

  /** Get which edge label ('L' or 'R') this node is relative to its parent */
  static getEdgeLabel(sceneManager: SceneManager, treeName: string, nodeId: string): 'L' | 'R' | null {
    const edges = this.getEdges(sceneManager, treeName);
    const pEdge = edges.find((e: any) => e.targetId === nodeId);
    if (!pEdge) return null;
    return (pEdge.properties?.label as 'L' | 'R') || null;
  }

  /** Get the edge between two specific nodes */
  static getEdgeBetween(sceneManager: SceneManager, treeName: string, sourceId: string, targetId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    return edges.find((e: any) => e.sourceId === sourceId && e.targetId === targetId) || null;
  }

  /**
   * Build an O(n) node-id → left/right/parent/edgeLabel index for the tree,
   * reused until the scene's revision moves (rehydrating the pure tree for
   * every operation of a lesson would otherwise rescan the scene each time).
   */
  static buildIndex(sceneManager: SceneManager, treeName: string): BSTIndex {
    const revision = sceneManager.getRevision();
    let perTree = indexCache.get(sceneManager);
    if (!perTree) indexCache.set(sceneManager, (perTree = new Map()));
    const cached = perTree.get(treeName);
    if (cached && cached.revision === revision) return cached.index;
    const index = this.scanIndex(sceneManager, treeName);
    perTree.set(treeName, { revision, index });
    return index;
  }

  private static scanIndex(sceneManager: SceneManager, treeName: string): BSTIndex {
    // One pass over the scene graph for both nodes and edges.
    const nodes: any[] = [];
    const edges: any[] = [];
    for (const el of sceneManager.getSceneGraph() as any[]) {
      if (el.logicalParent !== treeName) continue;
      if (el.originalType === 'TREE_NODE') nodes.push(el);
      else if (el.originalType === 'EDGE') edges.push(el);
    }
    const left = new Map<string, any>();
    const right = new Map<string, any>();
    const parent = new Map<string, any>();
    const edgeLabel = new Map<string, 'L' | 'R'>();
    const nodeById = new Map<string, any>(nodes.map((n) => [n.id, n]));
    const hasParent = new Set<string>();

    edges.forEach((e: any) => {
      if (nodeById.has(e.targetId)) hasParent.add(e.targetId);
      const label = e.properties?.label;
      const targetEl = nodeById.get(e.targetId) ?? sceneManager.getElement(e.targetId);
      const sourceEl = nodeById.get(e.sourceId) ?? sceneManager.getElement(e.sourceId);
      if (!targetEl || !sourceEl) return;
      if (label === 'L') left.set(e.sourceId, targetEl);
      if (label === 'R') right.set(e.sourceId, targetEl);
      parent.set(e.targetId, sourceEl);
      if (label === 'L' || label === 'R') edgeLabel.set(e.targetId, label);
    });

    const root = nodes.find((n: any) => !hasParent.has(n.id)) || null;
    return { left, right, parent, edgeLabel, root };
  }

  /** The pure tree the scene currently draws for `treeName`. */
  static rehydrate(sceneManager: SceneManager, treeName: string): BinarySearchTree {
    const index = this.buildIndex(sceneManager, treeName);
    const toRef = (el: any): BSTNodeRef | null => (el ? { id: el.id, value: Number(el.value) } : null);
    return BinarySearchTree.fromLinks(toRef(index.root), (id, side) => toRef((side === 'L' ? index.left : index.right).get(id)));
  }

  /**
   * The path an insert of `value` takes and where the new node would hang,
   * without changing anything (the pure insert runs on a rehydrated copy).
   */
  static computeInsertPath(sceneManager: SceneManager, treeName: string, value: number): BSTInsertResult {
    const tree = this.rehydrate(sceneManager, treeName);
    const inserted = tree.insert(value);
    const traversalPath: BSTNodeRef[] = [];
    const directions: string[] = [];
    let attach: Extract<BSTStep, { type: 'ATTACH' }> | undefined;
    for (const step of tree.steps) {
      if (step.type === 'COMPARE') {
        traversalPath.push(step.node);
        directions.push(step.side);
      } else if (step.type === 'DUPLICATE') {
        traversalPath.push(step.node);
      } else if (step.type === 'ATTACH') {
        attach = step;
      }
    }
    if (!inserted) return { success: false, error: `Value ${value} already exists.`, traversalPath, directions };
    return { success: true, traversalPath, directions, parentNode: attach!.parent, edgeLabel: attach!.side };
  }

  /** The path a search for `value` takes, with a comparison per node, without changing anything. */
  static computeSearchPath(sceneManager: SceneManager, treeName: string, value: number): BSTSearchResult {
    const tree = this.rehydrate(sceneManager, treeName);
    const target = tree.search(value);
    const traversalPath: BSTNodeRef[] = [];
    const comparisons: string[] = [];
    for (const step of tree.steps) {
      if (step.type === 'COMPARE') {
        traversalPath.push(step.node);
        comparisons.push(`${value} ${step.side === 'L' ? '<' : '>'} ${step.node.value} → Go ${step.side === 'L' ? 'Left' : 'Right'}`);
      } else if (step.type === 'FOUND') {
        traversalPath.push(step.node);
        comparisons.push(`${value} = ${step.node.value} → Found!`);
      }
    }
    return target ? { found: true, targetNode: target, traversalPath, comparisons } : { found: false, traversalPath, comparisons };
  }

  /**
   * Actually inserts a new node into the scene, hung from `parentNode` on
   * the `edgeLabel` side (no parent: the new root). Returns the new element.
   */
  static insertNode(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    value: number,
    parentNode: BSTNodeRef | null,
    edgeLabel: BSTSide | null
  ): any {
    const newId = `bst_node_${treeName}_${value}_${Date.now()}`;

    const newEl: any = {
      id: newId,
      type: 'sphere',
      originalType: 'TREE_NODE',
      logicalParent: treeName,
      value,
      label: String(value),
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: this.NODE_COLOR,
      emissiveColor: this.NODE_EMISSIVE,
      emissiveIntensity: this.NODE_EMISSIVE_INTENSITY,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };

    const revisionBefore = sceneManager.getRevision();
    sceneManager.addElement(newEl);

    if (parentNode) {
      const edgeId = `bst_edge_${parentNode.id}_${newId}`;
      const edgeEl: any = {
        id: edgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId: parentNode.id,
        targetId: newId,
        directed: true,
        properties: { label: edgeLabel },
      };
      sceneManager.addElement(edgeEl);
      relationshipManager.addRelationship({
        id: edgeId,
        sourceId: parentNode.id,
        targetId: newId,
        type: 'edge',
        directed: true,
      });
    }

    this.patchIndexAfterInsert(sceneManager, treeName, revisionBefore, newEl, parentNode, edgeLabel);
    return newEl;
  }

  /**
   * Inserting is a leaf add, so a still-current cached index can take the new
   * node and edge directly instead of being rebuilt on the next operation.
   * Only applies when exactly our own adds moved the revision.
   */
  private static patchIndexAfterInsert(
    sceneManager: SceneManager,
    treeName: string,
    revisionBefore: number,
    newEl: any,
    parentNode: BSTNodeRef | null,
    edgeLabel: BSTSide | null
  ): void {
    const cached = indexCache.get(sceneManager)?.get(treeName);
    if (!cached || cached.revision !== revisionBefore) return;
    const revision = sceneManager.getRevision();
    const parentEl = parentNode ? sceneManager.getElement(parentNode.id) : null;
    if (revision !== revisionBefore + (parentNode ? 2 : 1) || (parentNode && !parentEl)) return;
    const { index } = cached;
    if (parentEl) {
      if (edgeLabel === 'L') index.left.set(parentNode!.id, newEl);
      if (edgeLabel === 'R') index.right.set(parentNode!.id, newEl);
      index.parent.set(newEl.id, parentEl);
      if (edgeLabel) index.edgeLabel.set(newEl.id, edgeLabel);
    } else if (!index.root) {
      index.root = newEl;
    }
    cached.revision = revision;
  }

  /**
   * Rewires the scene's edges for a recorded rotation so the tree's logical
   * structure actually changes. Mirrors the classic single rotation used by
   * AVL / red-black rebalancing:
   *
   *  LEFT rotation at X (Y = X.right rises):
   *    B = Y.left; X.right = B; Y.left = X; Y takes X's former slot.
   *  RIGHT rotation at X (Y = X.left rises):
   *    C = Y.right; X.left = C; Y.right = X; Y takes X's former slot.
   *
   * Does NOT recompute layout/positions.
   */
  static rewireRotation(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    step: Extract<BSTStep, { type: 'ROTATE' }>
  ): void {
    const { direction, pivot, child, grandchild, parent, parentSide } = step;
    const removeEdgeBetween = (sourceId: string, targetId: string) => {
      const edge = this.getEdgeBetween(sceneManager, treeName, sourceId, targetId);
      if (edge) sceneManager.removeElement(edge.id);
    };
    const addEdge = (sourceId: string, targetId: string, label: BSTSide) => {
      const edgeId = `bst_edge_${sourceId}_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sceneManager.addElement({
        id: edgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId,
        targetId,
        directed: true,
        properties: { label },
      } as any);
      relationshipManager.addRelationship({ id: edgeId, sourceId, targetId, type: 'edge', directed: true });
    };

    // The inner subtree of the rising child moves over to the pivot; the pivot hangs from the child on the other side.
    const inner: BSTSide = direction === 'L' ? 'R' : 'L';
    removeEdgeBetween(pivot.id, child.id);
    if (grandchild) {
      removeEdgeBetween(child.id, grandchild.id);
      addEdge(pivot.id, grandchild.id, inner);
    }
    addEdge(child.id, pivot.id, direction);

    if (parent) {
      removeEdgeBetween(parent.id, pivot.id);
      addEdge(parent.id, child.id, parentSide ?? inner);
    }
    // else: pivot was the root — the child is now the root, inferred
    // automatically (computeLayout/getRoot find it by "no incoming edge").
  }

  /**
   * Execute a LEAF deletion: remove node and its parent edge.
   */
  static performLeafDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string
  ): void {
    const edges = this.getEdges(sceneManager, treeName);
    const parentEdge = edges.find((e: any) => e.targetId === targetId);
    if (parentEdge) sceneManager.removeElement(parentEdge.id);
    sceneManager.removeElement(targetId);
  }

  /**
   * Execute a ONE_CHILD deletion: bypass the node, reconnect parent to child.
   */
  static performOneChildDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string,
    childId: string,
    parentId: string | null,
    edgeLabel: BSTSide | null
  ): void {
    const edges = this.getEdges(sceneManager, treeName);
    // Remove all edges connected to targetId
    const connectedEdges = edges.filter((e: any) => e.sourceId === targetId || e.targetId === targetId);
    connectedEdges.forEach((e: any) => sceneManager.removeElement(e.id));

    if (parentId) {
      // Reconnect parent → child
      const newEdgeId = `bst_edge_${parentId}_${childId}_${Date.now()}`;
      sceneManager.addElement({
        id: newEdgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId: parentId,
        targetId: childId,
        directed: true,
        properties: { label: edgeLabel },
      } as any);
      relationshipManager.addRelationship({
        id: newEdgeId,
        sourceId: parentId,
        targetId: childId,
        type: 'edge',
        directed: true,
      });
    }
    // If no parent, child becomes new root — nothing to reconnect

    sceneManager.removeElement(targetId);
  }

  /**
   * Execute a TWO_CHILDREN deletion by copying successor value into target,
   * then deleting the successor (which is at most a one-child node).
   */
  static performTwoChildrenDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string,
    successorId: string
  ): void {
    const targetEl = sceneManager.getElement(targetId) as any;
    const successorEl = sceneManager.getElement(successorId) as any;
    if (!targetEl || !successorEl) return;

    // Copy successor value into target node (value replacement)
    targetEl.value = successorEl.value;
    targetEl.label = successorEl.label;

    // Now delete the successor node (it has at most one child — a right child)
    const successorRightChild = this.getRightChild(sceneManager, treeName, successorId);
    const successorParent = this.getParent(sceneManager, treeName, successorId);
    const successorEdgeLabel = this.getEdgeLabel(sceneManager, treeName, successorId);

    if (successorRightChild) {
      this.performOneChildDelete(
        sceneManager,
        relationshipManager,
        treeName,
        successorId,
        successorRightChild.id,
        successorParent?.id || null,
        successorEdgeLabel
      );
    } else {
      this.performLeafDelete(sceneManager, relationshipManager, treeName, successorId);
    }
  }

  /**
   * Returns all nodes ordered for a level-order clear animation, children in
   * the order their edges were drawn.
   */
  static getClearOrder(sceneManager: SceneManager, treeName: string): any[] {
    const nodes = this.getNodes(sceneManager, treeName);
    const edges = this.getEdges(sceneManager, treeName);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const hasParent = new Set<string>();
    const children = new Map<string, string[]>();
    edges.forEach((e: any) => {
      if (nodeIds.has(e.targetId)) hasParent.add(e.targetId);
      if (nodeIds.has(e.sourceId)) {
        if (!children.has(e.sourceId)) children.set(e.sourceId, []);
        children.get(e.sourceId)!.push(e.targetId);
      }
    });
    const root = nodes.find((n: any) => !hasParent.has(n.id));
    if (!root) return nodes;

    // Level-order
    const order: any[] = [];
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      order.push(cur);
      const ch = children.get(cur.id) || [];
      ch.forEach(cid => {
        const cEl = sceneManager.getElement(cid);
        if (cEl) queue.push(cEl);
      });
    }
    return order;
  }

  /**
   * Remove all nodes and edges from the scene.
   */
  static performClear(sceneManager: SceneManager, treeName: string): void {
    const nodes = this.getNodes(sceneManager, treeName);
    const edges = this.getEdges(sceneManager, treeName);
    edges.forEach((e: any) => sceneManager.removeElement(e.id));
    nodes.forEach((n: any) => sceneManager.removeElement(n.id));
  }

  /**
   * Compute Reingold-Tilford-style layout coordinates for all BST nodes.
   * Returns a map of nodeId → { x, y, z }.
   *
   * The root is placed at y=0, children descend in y.
   * Horizontal spacing is adaptive to the depth of the tree.
   */
  static computeLayout(sceneManager: SceneManager, treeName: string): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = this.getNodes(sceneManager, treeName);
    if (nodes.length === 0) return map;

    // Build adjacency from scene edges
    const edges = this.getEdges(sceneManager, treeName);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const leftChildMap = new Map<string, string>();
    const rightChildMap = new Map<string, string>();
    const hasParent = new Set<string>();

    edges.forEach((e: any) => {
      if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) return;
      hasParent.add(e.targetId);
      if (e.properties?.label === 'L') leftChildMap.set(e.sourceId, e.targetId);
      if (e.properties?.label === 'R') rightChildMap.set(e.sourceId, e.targetId);
    });

    const root = nodes.find((n: any) => !hasParent.has(n.id));
    if (!root) return map;

    // Measure tree depth to adapt horizontal spacing
    const treeDepth = (id: string): number => {
      const l = leftChildMap.get(id);
      const r = rightChildMap.get(id);
      if (!l && !r) return 1;
      return 1 + Math.max(l ? treeDepth(l) : 0, r ? treeDepth(r) : 0);
    };

    const depth = treeDepth(root.id);
    // Compact spacing: Knuth's in-order algorithm guarantees distinct X coordinates for all nodes
    const baseGap = this.MIN_SIBLING_SPACING;

    // Knuth's algorithm: in-order traversal assigns x positions
    let counter = 0;
    const xPos = new Map<string, number>();

    const inorder = (id: string) => {
      const l = leftChildMap.get(id);
      if (l) inorder(l);
      xPos.set(id, counter++ * baseGap);
      const r = rightChildMap.get(id);
      if (r) inorder(r);
    };
    inorder(root.id);

    // Center the tree
    const xs = Array.from(xPos.values());
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;

    // Calculate startY so the lowest leaf nodes rest at y = 0.5 above ground
    const startY = 0.5 + (depth - 1) * this.LEVEL_SPACING;

    // Assign y based on depth
    const assignY = (id: string, level: number) => {
      const x = (xPos.get(id) || 0) - midX;
      const y = startY - level * this.LEVEL_SPACING;
      map.set(id, { x, y, z: 0 });

      const l = leftChildMap.get(id);
      const r = rightChildMap.get(id);
      if (l) assignY(l, level + 1);
      if (r) assignY(r, level + 1);
    };
    assignY(root.id, 0);

    return map;
  }
}

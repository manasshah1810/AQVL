import type { AQIRInstruction, AQIRObject, SwapObjectsInstruction, CompareObjectsInstruction, HighlightObjectInstruction, LinkObjectsInstruction, GenericActionInstruction, SetPartitionBoundaryInstruction, ClearPartitionBoundaryInstruction, MarkSortedRegionInstruction } from '@aqvl/shared';
import { getSemanticColorToken } from '@aqvl/shared';
import { AQIROpcode } from '../types';
import { AnimationScheduler } from './AnimationScheduler';
import { SceneManager } from './SceneManager';
import { LayoutManager } from './LayoutManager';
import { StateManager } from './StateManager';
import { EventDispatcher } from './EventDispatcher';

import { LifecycleManager } from './LifecycleManager';
import { RelationshipManager } from './RelationshipManager';
import { AlgorithmRegistry, AlgorithmContext, BinaryTreeAlgorithms, BSTAlgorithms, SortAlgorithms, GraphAlgorithms, HeapEngine, HashMapVisualizer, TrieVisualizer, ArrayEngine, StackEngine, QueueEngine, LinkedListEngine } from './algorithms';
import { Graph } from '../data-structures/Graph';

// Register BinaryTree advanced algorithms
AlgorithmRegistry.register([
  'MIRROR', 'INVERT', 'CLONE', 'COPY', 'REMOVE_LEAVES', 'PRUNE',
  'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL',
  'MAX_VALUE', 'MIN_VALUE', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM'
], new BinaryTreeAlgorithms());

// Register BST CRUD operations
const _bstAlgorithmsInstance = new BSTAlgorithms();
AlgorithmRegistry.register([
  'BST_INSERT', 'BST_DELETE', 'BST_SEARCH', 'BST_CLEAR', 'ROTATE'
], _bstAlgorithmsInstance);

// Register array sorting algorithms
AlgorithmRegistry.register([
  'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT'
], new SortAlgorithms());

// Register graph traversal / shortest-path / MST / topological-sort algorithms
AlgorithmRegistry.register(['DFS', 'BFS', 'DIJKSTRA', 'BELLMAN_FORD', 'ASTAR', 'PRIM', 'KRUSKAL', 'TOPO_SORT'], new GraphAlgorithms());

// Register heap operations (real insert/extract/decrease-key/build-heap/heapify, backed by MinHeap)
AlgorithmRegistry.register(['HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP', 'HEAPIFY'], new HeapEngine());

// Register hash map operations (real chaining/resize/rehash, backed by HashMap)
AlgorithmRegistry.register(['HASHMAP_INIT', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE'], new HashMapVisualizer());

// Instruction-level tracing is off by default since it runs on every instruction and
// JSON.stringify's the payload; opt in with window.__AQVL_DEBUG_ANIMATION__ = true
// (or globalThis.__AQVL_DEBUG_ANIMATION__ in non-browser environments) when diagnosing an issue.
const DEBUG_ANIMATION: boolean =
  typeof globalThis !== 'undefined' && !!(globalThis as any).__AQVL_DEBUG_ANIMATION__;

// Register trie operations (real insert/search/startsWith/delete/autocomplete, backed by Trie)
AlgorithmRegistry.register(['TRIE_INIT', 'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_STARTSWITH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE'], new TrieVisualizer());

// Register stack / queue operations on STACK_ELEMENT / QUEUE_ELEMENT scenes (backed by Stack / Queue).
// Compiled STACK / QUEUE declarations are TreeEngine containers, routed before the registry is consulted.
AlgorithmRegistry.register(['PUSH', 'POP', 'PEEK'], new StackEngine());
AlgorithmRegistry.register(['ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR'], new QueueEngine());

import { AnticipationAnimation } from './animations';
import type { LinkedListContext } from './algorithms/LinkedListProgramEngine';
import { LinkedListProgramEngine } from './algorithms/LinkedListProgramEngine';
import { PrimitiveAnimator } from './algorithms/PrimitiveAnimator';
import { ArrayIndexOutOfRangeError } from './algorithms/ArrayEngine';
import { formatPrintValue } from './algorithms/formatValue';
import { TreeEngine, TreeError, type TreeContext } from './algorithms/TreeEngine';
import { HeapProgramEngine, HeapIndexError } from './algorithms/HeapProgramEngine';
import { HashMapProgramEngine } from './algorithms/HashMapProgramEngine';
import { TrieProgramEngine } from './algorithms/TrieProgramEngine';
import { GraphProgramEngine } from './algorithms/GraphProgramEngine';
import { AQVLVirtualMachine, type StepCallback } from '../VirtualMachine';
import type { VMInstruction, FunctionTable, ExecutionResult } from '../types';


export { ArrayIndexOutOfRangeError };

export class AnimationController {
  private defaultColor = getSemanticColorToken('NEUTRAL').color;
  private activeTreeName: string | null = null;
  /** Tracks whether the current active tree is a BST (so INSERT/DELETE/SEARCH/CLEAR route to BSTAlgorithms) */
  private activeTreeIsBST: boolean = false;
  /** Shared BSTAlgorithms instance used for dispatch-based BST routing */
  private bstAlgorithms: BSTAlgorithms = _bstAlgorithmsInstance;
  /** Arrays: the array-targeted INSERT / DELETE / UPDATE, and the reads a program makes of an array (see ArrayEngine.ts) */
  private arrayEngine: ArrayEngine = new ArrayEngine();
  /** Built-in linked-list operations: INSERT_HEAD, REVERSE, DELETE list[i], ... (see LinkedListEngine.ts) */
  private linkedListEngine: LinkedListEngine = new LinkedListEngine();
  /** Linked lists used by real code: pointer moves, field writes, NEW_NODE, FREE (see LinkedListProgramEngine.ts) */
  private linkedListProgram: LinkedListProgramEngine = new LinkedListProgramEngine();
  /** How each element-level AQIR primitive (focus, contrast, exchange, set, link, unlink) is animated (see PrimitiveAnimator.ts) */
  private primitives: PrimitiveAnimator = new PrimitiveAnimator();
  /** Pointer trees (BINARY_TREE / BST), their recursion and their queues / stacks (see TreeEngine.ts) */
  private treeEngine: TreeEngine = new TreeEngine();
  /** Graphs used by real code: vertex / edge references, fields, NEIGHBOR / DEGREE / ... (see GraphProgramEngine.ts) */
  private graphEngine: GraphProgramEngine = new GraphProgramEngine();
  /** Heaps used by real code: `h[i]`, LENGTH(h), SWAP, `h[i] = v`, INSERT h v, DELETE of the last cell (see HeapProgramEngine.ts) */
  private heapEngine: HeapProgramEngine = new HeapProgramEngine();
  /** Hash maps used by real code: `m[key] = v`, `m[key]`, CONTAINS, DELETE m[key], LENGTH, KEY_AT, ... (see HashMapProgramEngine.ts) */
  private hashMapEngine: HashMapProgramEngine = new HashMapProgramEngine();
  /** Tries used by real code: node references, t.root, GET_CHILD, HAS_CHILD, ADD_CHILD, node.isEnd, ... (see TrieProgramEngine.ts) */
  private trieEngine: TrieProgramEngine = new TrieProgramEngine();
  /**
   * Live reference to the currently-executing VM, set in `createExecutionVM`
   * so that `resolveElementId` can call `vm.getVariable()` to read loop
   * iterator values from their actual runtime scope (PUSH_SCOPE frames are
   * not reflected in the `state.globals` snapshot the legacy-handler receives).
   */
  private currentVM: AQVLVirtualMachine | null = null;


  constructor(
    private animationScheduler: AnimationScheduler,
    private sceneManager: SceneManager,
    private layoutManager: LayoutManager,
    private stateManager: StateManager,
    private eventDispatcher: EventDispatcher,
    private lifecycleManager: LifecycleManager,
    private relationshipManager: RelationshipManager
  ) {
    // SET_PARTITION_BOUNDARY / CLEAR_PARTITION_BOUNDARY / MARK_SORTED_REGION are dispatched by
    // algorithm handlers (e.g. SortAlgorithms) as generic AQIR_INSTRUCTION events, deferred to
    // land in sync with the animation beat they describe (see SortAlgorithms.dispatchInstruction).
    // Apply them to sticky StateManager state and re-broadcast STATE_UPDATED so the renderer's
    // partition boundary / sorted region indicators (array-visual-language-spec.md §4.2/§4.3)
    // pick up the change on the next frame.
    this.eventDispatcher.on('AQIR_INSTRUCTION', (instruction: AQIRInstruction) => {
      switch (instruction.action) {
        case 'SET_PARTITION_BOUNDARY': {
          const i = instruction as SetPartitionBoundaryInstruction;
          this.stateManager.setPartitionBoundary(i.structureId, i.startIndex, i.endIndex, i.label);
          break;
        }
        case 'CLEAR_PARTITION_BOUNDARY': {
          const i = instruction as ClearPartitionBoundaryInstruction;
          this.stateManager.clearPartitionBoundary(i.structureId);
          break;
        }
        case 'MARK_SORTED_REGION': {
          const i = instruction as MarkSortedRegionInstruction;
          this.stateManager.markSortedRegion(i.structureId, i.startIndex, i.endIndex);
          break;
        }
        default:
          return;
      }
      this.stateManager.saveState(this.sceneManager.getSceneGraph(), instruction.action, this.animationScheduler.getCurrentTime());
      this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
    });
  }

  private clearTransientActiveStates(): void {
    const neutralToken = getSemanticColorToken('NEUTRAL');
    for (const el of this.sceneManager.getSceneGraph()) {
      el.isHighlighted = false;
      el.highlightType = undefined;
      if (
        el.state === 'EVALUATING' ||
        el.state === 'MODIFYING' ||
        el.state === 'TRAVERSING' ||
        el.state === 'ACTIVE'
      ) {
        el.state = 'NEUTRAL';
        el.color = neutralToken.color;
        el.emissiveColor = neutralToken.emissiveColor;
        el.emissiveIntensity = neutralToken.emissiveIntensity;
      }
    }
  }

  /**
   * Scan the scene for a BST or TREE anchor object and auto-configure
   * activeTreeName / activeTreeIsBST.  This is called at the start of every
   * instruction so context is always in sync even before any explicit
   * TREE/BST sequence action is encountered (e.g. when BST is declared in
   * the DECLARE block and operations start immediately).
   */
  private autoDetectActiveTree(): void {
    // If already set, keep it — only override when scene changes
    if (this.activeTreeName) return;

    const graph = this.sceneManager.getSceneGraph() as any[];
    // Look for BST anchor first (BST takes priority over TREE)
    const bstEl = graph.find(el => el.type === 'BST' || el.originalType === 'BST');
    if (bstEl) {
      this.activeTreeName = bstEl.logicalParent || bstEl.label || bstEl.id;
      this.activeTreeIsBST = true;
      return;
    }
    // Fallback: any TREE or BINARY_TREE anchor
    const treeEl = graph.find(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
    if (treeEl) {
      this.activeTreeName = treeEl.logicalParent || treeEl.label || treeEl.id;
      this.activeTreeIsBST = false;
    }
  }

  /**
   * Determines whether the structure named `targetName` (as carried in an
   * instruction's payload.logicalParent) is a BST anchor in the current
   * scene. Falls back to activeTreeIsBST only when no explicit target name
   * is available, so bare INSERT/DELETE/SEARCH instructions are routed by
   * what they actually target rather than a scene-global flag.
   */
  private isTargetBST(targetName: string | undefined): boolean {
    if (!targetName) return this.activeTreeIsBST;
    const graph = this.sceneManager.getSceneGraph() as any[];
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
    // No matching anchor found for this target name — fall back to the
    // scene-global flag rather than guessing.
    return this.activeTreeIsBST;
  }

  /**
   * Builds a `Graph` instance from the VERTEX / GRAPH_EDGE (or EDGE) scene
   * elements belonging to `graphName`, so algorithm code (GraphAlgorithm)
   * has an adjacency-list view to operate on instead of querying the scene
   * directly. Vertex/edge scene elements are created elsewhere (graph
   * declaration handling); this only reads them.
   */
  public buildGraphFromScene(graphName: string, directed = false, weighted = false): Graph {
    const sceneElements = this.sceneManager.getSceneGraph() as any[];
    const vertexElements = sceneElements.filter(
      el => el.logicalParent === graphName && el.originalType === 'VERTEX'
    );
    const edgeElements = sceneElements.filter(
      el =>
        el.logicalParent === graphName &&
        (el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE')
    );

    const graph = new Graph<any>([], [], directed, weighted);
    for (const el of vertexElements) {
      graph.addVertex(el.id, el);
    }
    for (const el of edgeElements) {
      graph.addEdge(el.sourceId, el.targetId, el.weight);
    }

    return graph;
  }

  /**
   * Builds a VM over `instructions`, wiring every legacy (action-based)
   * instruction back through `executeInstruction` so existing animations
   * are unaffected. The 6 new control-flow opcodes (JUMP, JUMP_IF_FALSE,
   * CALL, RET, PUSH_SCOPE, POP_SCOPE) are handled by the VM itself and are
   * not animated yet (Phase 1.4).
   *
   * Callers that need pause/step semantics (e.g. ExecutionEngine) should
   * keep the returned VM and drive it via repeated `vm.step()` calls
   * instead of `runProgram()`, which always runs to completion.
   */
  public createExecutionVM(
    instructions: VMInstruction[],
    functionTable: FunctionTable = {},
    globals: Record<string, unknown> = {},
    objects: AQIRObject[] = []
  ): AQVLVirtualMachine {
    const vm = new AQVLVirtualMachine(
      instructions,
      functionTable,
      globals,
      (instruction) => {
        // Keep currentVM in sync so resolveElementId can call
        // vm.getVariable() to read loop iterators from their PUSH_SCOPE.
        this.currentVM = vm;
        return this.executeInstruction(instruction);
      },
      objects
    );
    // Conditions / assignments are evaluated by the VM itself (outside the
    // legacy handler), so it needs the current VM and live array values too.
    this.currentVM = vm;
    vm.setElementReader(
      (arrayName, index) =>
        this.heapEngine.isHeap(this.llContext(), arrayName)
          ? this.heapEngine.valueAt(this.llContext(), arrayName, index)
          : this.linkedListProgram.isList(this.llContext(), arrayName)
          ? this.linkedListProgram.valueAt(this.llContext(), arrayName, index)
          : this.arrayEngine.valueAt(this.llContext(), arrayName, index),
      (arrayName) =>
        this.hashMapEngine.isHashMap(this.llContext(), arrayName)
          ? this.hashMapEngine.length(this.llContext(), arrayName)
          : this.heapEngine.isHeap(this.llContext(), arrayName)
          ? this.heapEngine.length(this.llContext(), arrayName)
          : this.linkedListProgram.isList(this.llContext(), arrayName)
          ? this.linkedListProgram.length(this.llContext(), arrayName)
          : this.treeEngine.isTree(this.treeContext(), arrayName)
            ? this.treeEngine.size(this.treeContext(), arrayName)
            : this.treeEngine.isContainer(this.treeContext(), arrayName)
              ? this.treeEngine.containerLength(this.treeContext(), arrayName)
              : this.graphEngine.isGraph(this.treeContext(), arrayName)
                ? (this.graphEngine.read(this.treeContext(), 'VERTEX_COUNT', [arrayName], `LENGTH(${arrayName})`) as number)
                : this.arrayEngine.length(this.llContext(), arrayName)
    );
    // Linked lists and trees: `curr.next` / `node.left` reads, and
    // pointer-variable assignments (`curr = curr.next`) animated as steps
    // of their own.
    // Graphs: `NEIGHBOR(v, i)`, `DEGREE(v)`, `WEIGHT(u, w)`, ... read live from the scene.
    vm.setGraphReader((fn, args, text, argTexts) =>
      HashMapProgramEngine.READS.has(fn)
        ? this.hashMapEngine.read(this.llContext(), fn, args, text)
        : TrieProgramEngine.READS.has(fn)
        ? this.trieEngine.read(this.treeContext(), fn, args, text, argTexts)
        : this.graphEngine.read(this.treeContext(), fn, args, text, argTexts)
    );
    vm.setReadObserver((instr) => this.animateReads(vm, instr));
    vm.setMemberReader((object, member, objectExpr) =>
      this.trieEngine.owns(this.treeContext(), object) || this.nullBelongsToTrie(object)
        ? this.trieEngine.readMember(this.treeContext(), object, member, objectExpr)
        : this.graphEngine.owns(this.treeContext(), object)
        ? this.graphEngine.readMember(this.treeContext(), object, member, objectExpr)
        : this.pointerOwnerIsTree(object)
        ? this.treeEngine.readMember(this.treeContext(), object, member, objectExpr)
        : this.linkedListProgram.readMember(this.llContext(), object, member, objectExpr)
    );
    vm.setVariableObserver(
      async (name, value, previous, instr) => {
        // `n = NEW_NODE(...)` / `node = DEQUEUE(q)`: already shown by that step.
        if (typeof instr.value === 'string' && (instr.value.startsWith('__new_') || instr.value.startsWith('__take_'))) return false;
        // `node = GET_CHILD(node, ch)`, `node = t.root`: a trie node pointer moves.
        if (this.trieEngine.isPointerAssignment(this.treeContext(), value, previous)) {
          this.currentVM = vm;
          await this.executeInstruction({ action: 'TRIE_POINTER_MOVE', name, value, previous, sourceText: instr.sourceText, valueExpr: instr.value } as any);
          return true;
        }
        // `w = NEIGHBOR(v, i)`, `u = VERTEX(g, "A")`, `v = v.parent`: a vertex pointer moves.
        if (this.graphEngine.isPointerAssignment(this.treeContext(), value, previous) && !TreeEngine.isNodeRef(value) && !TreeEngine.isNodeRef(previous)) {
          this.currentVM = vm;
          await this.executeInstruction({ action: 'GRAPH_POINTER_MOVE', name, value, previous, sourceText: instr.sourceText, valueExpr: instr.value } as any);
          return true;
        }
        const tree = this.treeEngine.isPointerAssignment(this.treeContext(), value, previous) &&
          (TreeEngine.isNodeRef(value) || TreeEngine.isNodeRef(previous) || !this.linkedListProgram.hasAnyList(this.llContext()));
        if (!tree && !this.linkedListProgram.isPointerAssignment(this.llContext(), value, previous)) return false;
        this.currentVM = vm;
        await this.executeInstruction({
          action: tree ? 'TREE_POINTER_MOVE' : 'LL_POINTER_MOVE',
          name, value, previous, sourceText: instr.sourceText, valueExpr: instr.value,
        } as any);
        return true;
      },
      () => {
        this.linkedListProgram.onScopeExit(this.llContext());
        this.treeEngine.onScopeExit(this.treeContext());
        this.graphEngine.onScopeExit(this.treeContext());
        this.trieEngine.onScopeExit(this.treeContext());
      }
    );
    // Recursion over a tree: every call and return is a step (the node
    // passed in lights up, the call-stack panel grows / shrinks).
    vm.setCallObserver(async (event) => {
      if (this.treeEngine.hasAnyTree(this.treeContext())) {
        this.currentVM = vm;
        await this.executeInstruction({ action: 'TREE_CALL', event } as any);
        return true;
      }
      // Recursion over a trie (collect words, recursive delete, ...): the same, for trie nodes.
      if (this.trieEngine.hasAnyTrie(this.treeContext())) {
        this.currentVM = vm;
        await this.executeInstruction({ action: 'TRIE_CALL', event } as any);
        return true;
      }
      // Recursion over a graph (recursive DFS, ...): the same, for vertices.
      if (this.graphEngine.hasAnyGraph(this.treeContext())) {
        this.currentVM = vm;
        await this.executeInstruction({ action: 'GRAPH_CALL', event } as any);
        return true;
      }
      return false;
    });
    return vm;
  }

  /** A NULL read (`node.isEnd` after GET_CHILD returned NULL) in a program whose only pointers are trie nodes. */
  private nullBelongsToTrie(value: unknown): boolean {
    if (value !== null && value !== undefined) return false;
    const ctx = this.treeContext();
    return (
      this.trieEngine.hasAnyTrie(ctx) &&
      !this.treeEngine.hasAnyTree(ctx) &&
      !this.linkedListProgram.hasAnyList(this.llContext()) &&
      !this.graphEngine.hasAnyGraph(ctx)
    );
  }

  /**
   * Whether a pointer operand belongs to a tree rather than a linked list:
   * a tree / tree node, or NULL in a program that has trees but no lists.
   */
  private pointerOwnerIsTree(value: unknown): boolean {
    if (this.treeEngine.owns(this.treeContext(), value)) return true;
    if (LinkedListProgramEngine.isNodeRef(value) || this.linkedListProgram.isList(this.llContext(), value)) return false;
    return this.treeEngine.hasAnyTree(this.treeContext()) && !this.linkedListProgram.hasAnyList(this.llContext());
  }

  /** Context for TreeEngine: the usual handler context plus access to the running program's variables and call stack. */
  private treeContext(): TreeContext {
    return {
      ...this.llContext(),
      host: {
        ...this.llContext().host,
        callStack: () => (this.currentVM ? this.currentVM.getCallStack() : []),
      },
    };
  }

  /** The context every engine is called with (see AlgorithmContext). */
  private algorithmContext(): AlgorithmContext {
    return {
      scheduler: this.animationScheduler,
      sceneManager: this.sceneManager,
      layoutManager: this.layoutManager,
      eventDispatcher: this.eventDispatcher,
      stateManager: this.stateManager,
      relationshipManager: this.relationshipManager,
      lifecycleManager: this.lifecycleManager,
      activeTreeName: this.activeTreeName,
      defaultColor: this.defaultColor,
    };
  }

  /** Context for the program engines (lists, heaps, maps, ...): the usual handler context plus access to the running program's variables. */
  private llContext(): LinkedListContext {
    return {
      ...this.algorithmContext(),
      host: {
        evaluate: (expr) => (this.currentVM ? this.currentVM.evaluateExpression(expr) : expr),
        setVariable: (name, value) => this.currentVM?.setVariable(name, value),
        visibleVariables: () => (this.currentVM ? this.currentVM.getVisibleVariables() : {}),
      },
    };
  }

  /** Called when a program's scene has just been loaded, before its initial layout. */
  public onSceneLoaded(): void {
    this.currentVM = null; // the previous program's variables must not tag the new scene's nodes
    this.linkedListProgram.initialize(this.llContext());
    this.connectGraphRefs();
    this.treeEngine.initialize(this.treeContext());
    this.graphEngine.initialize(this.treeContext());
    this.trieEngine.initialize(this.treeContext());
  }

  /** Called after the scene is restored to an earlier step (step back / scrub). */
  public onStateRestored(): void {
    this.linkedListProgram.settleAfterRestore(this.llContext());
    this.treeEngine.settleAfterRestore(this.treeContext());
    this.graphEngine.settleAfterRestore(this.treeContext());
    this.trieEngine.settleAfterRestore(this.treeContext());
  }

  /** Queues / stacks (drawn by TreeEngine) may hold graph vertices or trie nodes: tell TreeEngine how to show them. */
  private connectGraphRefs(): void {
    const graphs = this.graphEngine.hasAnyGraph(this.treeContext());
    const tries = this.trieEngine.hasAnyTrie(this.treeContext());
    this.treeEngine.foreignRefs = graphs || tries
      ? {
          isRef: (v) => GraphProgramEngine.isRef(v) || TrieProgramEngine.isNodeRef(v),
          display: (v) =>
            TrieProgramEngine.isNodeRef(v)
              ? this.trieEngine.displayValue(this.treeContext(), v)
              : this.graphEngine.displayValue(this.treeContext(), v),
          afterRefresh: (temp) => {
            if (graphs) this.graphEngine.refresh(this.treeContext(), temp);
            if (tries) this.trieEngine.refresh(this.treeContext(), temp);
          },
        }
      : undefined;
  }

  /**
   * Runs a statement whose operands are cells of a HEAP (`SWAP h[i] h[j]`,
   * `COMPARE`, `HIGHLIGHT`, `h[i] = v` / UPDATE, `INSERT h v`, `DELETE h[i]`)
   * on HeapProgramEngine. Returns false for anything that is not about a heap.
   */
  private executeHeapStatement(instruction: AQIRInstruction): boolean {
    const ctx = this.llContext();
    if (!this.heapEngine.hasAnyHeap(ctx)) return false;
    const heapSlot = (id: unknown) => {
      const slot = this.resolveArraySlot(id);
      return slot && this.heapEngine.isHeap(ctx, slot.arrayName) ? { heap: slot.arrayName, index: slot.index } : null;
    };
    const action = instruction.action as string;

    if (action === 'SWAP_OBJECTS' || action === 'COMPARE_OBJECTS') {
      const i = instruction as SwapObjectsInstruction;
      const left = heapSlot(i.leftId);
      const right = heapSlot(i.rightId);
      if (!left && !right) return false;
      if (!left || !right) {
        throw new HeapIndexError(`${action === 'SWAP_OBJECTS' ? 'SWAP' : 'COMPARE'} needs two heap cells, e.g. ${action === 'SWAP_OBJECTS' ? 'SWAP' : 'COMPARE'} h[i] h[j]. To use a heap value elsewhere, copy it into a variable first (x = h[0]).`);
      }
      if (action === 'SWAP_OBJECTS') this.heapEngine.swap(ctx, left, right);
      else this.heapEngine.compare(ctx, left, right);
      return true;
    }
    if (action === 'HIGHLIGHT_OBJECT') {
      const hl = instruction as HighlightObjectInstruction;
      const slot = heapSlot(hl.targetId);
      if (!slot) return false;
      this.heapEngine.highlight(ctx, slot.heap, slot.index, hl.color || 'SUCCESS');
      return true;
    }
    if (action === 'GENERIC_ACTION') {
      const gen = instruction as GenericActionInstruction;
      const name = gen.actionName.toUpperCase();
      const args = gen.args ?? [];
      const value = () => (this.currentVM ? this.currentVM.evaluateExpression(args[args.length - 1]) : args[args.length - 1]);
      if (name === 'INSERT' && this.heapEngine.isHeap(ctx, args[0])) {
        if (args.length < 2) throw new HeapIndexError(`INSERT needs a value, e.g. INSERT ${args[0]} 42`);
        this.heapEngine.append(ctx, String(args[0]), value());
        return true;
      }
      const slot = heapSlot(args[0]);
      if (!slot) return false;
      if (name === 'UPDATE') {
        this.heapEngine.update(ctx, slot.heap, slot.index, value());
      } else if (name === 'DELETE') {
        this.heapEngine.removeLast(ctx, slot.heap, slot.index);
      } else if (name === 'INSERT') {
        throw new HeapIndexError(`A heap only grows at its end: write INSERT ${slot.heap} value (it becomes ${slot.heap}[LENGTH(${slot.heap}) - 1]), then sift it up.`);
      } else {
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Before an assignment, condition, call or RETURN runs, animates each read
   * it will make that is a step of its own: a hash-map lookup (`m[key]`,
   * CONTAINS(m, key)) or a trie check (`HAS_CHILD(node, ch)`, `node.isEnd`),
   * in the order the VM evaluates them — the right side of AND / OR only
   * when it will be evaluated. A read that cannot be worked out here (a
   * missing key inside another key) is left for the real evaluation to report.
   */
  private async animateReads(vm: AQVLVirtualMachine, instr: any): Promise<void> {
    const ctx = this.llContext();
    const maps = this.hashMapEngine.hasAnyHashMap(ctx);
    const tries = this.trieEngine.hasAnyTrie(ctx);
    if (!maps && !tries) return;
    const operands: unknown[] =
      instr.opcode === AQIROpcode.SET_VAR ? [instr.value]
        : instr.opcode === AQIROpcode.JUMP_IF_FALSE ? [instr.condition]
          : instr.opcode === AQIROpcode.CALL ? instr.args ?? []
            : [instr.returnValue];
    const reads: any[] = [];
    const walk = (expr: any): void => {
      if (expr === null || typeof expr !== 'object') return;
      if ('gfn' in expr) {
        (expr.args ?? []).forEach(walk);
        if (maps && (expr.gfn === 'MAP_GET' || expr.gfn === 'CONTAINS')) {
          const map = vm.evaluateExpression(expr.args[0]);
          if (this.hashMapEngine.isHashMap(ctx, map)) reads.push({ action: 'MAP_LOOKUP', map: String(map), key: vm.evaluateExpression(expr.args[1]) });
        }
        if (tries && expr.gfn === 'HAS_CHILD') {
          const node = vm.evaluateExpression(expr.args[0]);
          if (TrieProgramEngine.isNodeRef(node)) {
            reads.push({ action: 'TRIE_CHECK', kind: 'HAS_CHILD', node, ch: vm.evaluateExpression(expr.args[1]), text: expr.source });
          }
        }
        return;
      }
      if ('op' in expr && 'left' in expr) {
        walk(expr.left);
        if (expr.op === 'AND' || expr.op === 'OR') {
          const left = Boolean(vm.evaluateExpression(expr.left));
          if ((expr.op === 'AND') !== left) return;
        }
        walk(expr.right);
        return;
      }
      if ('elem' in expr) walk(expr.index);
      if ('member' in expr) {
        walk(expr.object);
        if (tries && String(expr.member).toLowerCase() === 'isend') {
          const node = vm.evaluateExpression(expr.object);
          if (TrieProgramEngine.isNodeRef(node)) {
            const source = typeof expr.object === 'string' ? `${expr.object}.isEnd` : 'isEnd';
            reads.push({ action: 'TRIE_CHECK', kind: 'IS_END', node, text: source });
          }
        }
      }
    };
    try {
      operands.forEach(walk);
    } catch {
      // The instruction's own evaluation reports this error.
    }
    for (const read of reads) {
      this.currentVM = vm;
      await this.executeInstruction(read);
    }
  }

  /**
   * Evaluates the `(array, index)` addressed by a compiled `arrayName#indexExpr`
   * reference. Returns null for ordinary object IDs. `indexExpr` is either a
   * JSON-encoded VM expression (`{"op":"-",...}`, `{"elem":...}`), or a plain
   * number / variable name / legacy `i+1`-style string.
   */
  private resolveArraySlot(id: unknown): { arrayName: string; index: number } | null {
    if (typeof id !== 'string' || !id.includes('#')) return null;
    const hashIdx = id.indexOf('#');
    const arrayName = id.slice(0, hashIdx);
    const indexExpr = id.slice(hashIdx + 1);

    if (indexExpr.startsWith('{')) {
      if (!this.currentVM) return null;
      const value = Number(this.currentVM.evaluateExpression(JSON.parse(indexExpr)));
      return Number.isFinite(value) ? { arrayName, index: Math.round(value) } : null;
    }

    const evalExpr = (expr: string): number => {
      expr = expr.trim();
      // Try to parse as a plain number literal first.
      const asNum = Number(expr);
      if (!isNaN(asNum)) return asNum;
      // Look up as a plain variable name — delegate to the live VM so
      // PUSH_SCOPE variables (e.g. loop iterators) are visible.
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(expr)) {
        if (!this.currentVM) return NaN;
        try {
          const val = this.currentVM.getVariable(expr);
          return typeof val === 'number' ? val : NaN;
        } catch {
          return NaN;
        }
      }
      // Binary + (rightmost, to handle left-associativity correctly for
      // subtraction) — split on last '+' or '-' that isn't part of a number.
      // We scan right-to-left to respect operator precedence for these simple
      // expressions (no parentheses in the compiler output).
      for (let i = expr.length - 1; i >= 0; i--) {
        const ch = expr[i];
        if ((ch === '+' || ch === '-') && i > 0) {
          const left = evalExpr(expr.slice(0, i));
          const right = evalExpr(expr.slice(i + 1));
          return ch === '+' ? left + right : left - right;
        }
      }
      // Multiplication / division (lower priority — handled after +/-)
      for (let i = expr.length - 1; i >= 0; i--) {
        const ch = expr[i];
        if (ch === '*' || ch === '/') {
          const left = evalExpr(expr.slice(0, i));
          const right = evalExpr(expr.slice(i + 1));
          return ch === '*' ? left * right : left / right;
        }
      }
      return NaN;
    };

    const computedIndex = Math.round(evalExpr(indexExpr));
    if (isNaN(computedIndex)) return null;
    return { arrayName, index: computedIndex };
  }

  /**
   * Resolves a compiled object ID to the scene element it currently refers
   * to. `arrayName#indexExpr` references (every `arr[...]` target in an
   * ARRAY) are looked up by *current* logical index, since SWAP / INSERT /
   * DELETE move elements between slots. Literal IDs (e.g. `obj_003`) are
   * returned as-is.
   */
  private resolveElementId(id: string): string {
    if (typeof id === 'string' && id.startsWith('@expr:')) {
      // `HIGHLIGHT curr.next` — evaluate to the node it currently refers to.
      const value = this.currentVM ? this.currentVM.evaluateExpression(JSON.parse(id.slice('@expr:'.length))) : null;
      return typeof value === 'string' ? value : String(value);
    }
    if (typeof id === 'string' && !id.includes('#') && !this.sceneManager.getElement(id) && this.currentVM) {
      // A pointer variable (`HIGHLIGHT curr`) holding a node reference.
      const value = this.currentVM.tryGetVariable(id);
      if (LinkedListProgramEngine.isNodeRef(value) || TreeEngine.isNodeRef(value)) return value;
    }
    const slot = this.resolveArraySlot(id);
    if (!slot) return id;
    if (this.linkedListProgram.isList(this.llContext(), slot.arrayName)) {
      return this.linkedListProgram.nodeAt(this.llContext(), slot.arrayName, slot.index);
    }
    return this.arrayEngine.slotElementId(this.llContext(), slot.arrayName, slot.index, id);
  }

  /**
   * Binds the runtime-only operands of an ARRAY-targeted GENERIC_ACTION
   * (`UPDATE arr[i] total`, `INSERT arr[k] x`, `DELETE arr[j]`): resolves
   * the `arr#expr` slot to the element currently there, and evaluates the
   * value expression. Returns a fresh instruction — the compiled one is
   * re-executed on every loop iteration, so it must not be mutated.
   */
  private bindArrayActionOperands(gen: GenericActionInstruction): GenericActionInstruction {
    const args = gen.args ?? [];
    const slot = this.resolveArraySlot(args[0]);
    if (!slot) return gen;
    if (this.linkedListProgram.isList(this.llContext(), slot.arrayName)) {
      // Linked lists resolve `list[i]` themselves (by walking from the head).
      return {
        ...gen,
        payload: { ...((gen as any).payload ?? {}), logicalParent: slot.arrayName, logicalIndex: slot.index },
      } as GenericActionInstruction;
    }
    return this.arrayEngine.bindSlotOperands(
      this.llContext(),
      gen,
      slot.arrayName,
      slot.index,
      this.currentVM ? (expr) => this.currentVM!.evaluateExpression(expr) : null
    );
  }

  /** Source-like text for a compiled operand, for console messages (`node.left`, `root`, `5`). */
  private describeOperand(operand: unknown): string {
    if (operand === null) return 'NULL';
    if (typeof operand === 'object' && operand && 'member' in (operand as any)) {
      return `${this.describeOperand((operand as any).object)}.${(operand as any).member}`;
    }
    // `arr[i]`, `LENGTH(arr)`, `a + b` — as written in the program.
    if (typeof operand === 'object' && operand && 'elem' in (operand as any) && 'index' in (operand as any)) {
      return `${(operand as any).elem}[${this.describeOperand((operand as any).index)}]`;
    }
    if (typeof operand === 'object' && operand && 'len' in (operand as any) && !('op' in (operand as any))) {
      return `LENGTH(${(operand as any).len})`;
    }
    if (typeof operand === 'object' && operand && 'op' in (operand as any) && 'left' in (operand as any)) {
      const { op, left, right } = operand as any;
      return `${this.describeOperand(left)} ${op} ${this.describeOperand(right)}`;
    }
    // A graph built-in (`VERTEX(g, "B")`, `NEIGHBOR(v, i)`) or a literal name.
    if (typeof operand === 'object' && operand && 'gfn' in (operand as any)) return String((operand as any).source);
    if (typeof operand === 'object' && operand && 'text' in (operand as any)) return `"${(operand as any).text}"`;
    if (typeof operand === 'object') return 'value';
    // A string operand is a variable's name, or else a string literal ("(").
    if (typeof operand === 'string' && this.currentVM && this.currentVM.tryGetVariable(operand) === undefined) return `"${operand}"`;
    return String(operand);
  }

  /** Runs `instructions` to completion through a fresh VM, returning the recorded execution timeline. */
  public async runProgram(
    instructions: VMInstruction[],
    functionTable: FunctionTable = {},
    globals: Record<string, unknown> = {},
    onStep?: StepCallback,
    objects: AQIRObject[] = []
  ): Promise<ExecutionResult> {
    const vm = this.createExecutionVM(instructions, functionTable, globals, objects);
    return vm.run(onStep);
  }

  public async executeInstruction(instruction: AQIRInstruction): Promise<void> {
    return new Promise((resolve) => {
      this.clearTransientActiveStates();
      this.linkedListProgram.restoreBaseColors(this.llContext());
      this.treeEngine.restoreBaseColors(this.treeContext());
      this.graphEngine.restoreBaseColors(this.treeContext());
      this.heapEngine.restoreBaseColors(this.llContext());
      this.hashMapEngine.restoreBaseColors(this.llContext());
      this.trieEngine.restoreBaseColors(this.llContext());
      this.animationScheduler.init(resolve);

      // Auto-configure tree context from scene objects (handles BST declared
      // in DECLARE block before any explicit TREE/BST sequence action).
      this.autoDetectActiveTree();
      
      if (DEBUG_ANIMATION) console.log(`[AnimationController] Executing instruction:`, JSON.stringify(instruction));

      if (this.executeHeapStatement(instruction)) {
        this.animationScheduler.play();
        return;
      }

      if (instruction.action === 'GENERIC_ACTION') {
        instruction = this.bindArrayActionOperands(instruction as GenericActionInstruction);
      }

      switch (instruction.action as string) {
        case 'PRINT': {
          const parts: unknown[] = (instruction as any).parts ?? [];
          const message = parts
            .map((part: any) => {
              if (part !== null && typeof part === 'object' && 'text' in part) return String(part.text);
              if (part !== null && typeof part === 'object' && 'trie' in part) {
                return this.trieEngine.format(this.llContext(), part.trie);
              }
              if (part !== null && typeof part === 'object' && 'hashmap' in part) {
                return this.hashMapEngine.format(this.llContext(), part.hashmap);
              }
              if (part !== null && typeof part === 'object' && 'array' in part && this.heapEngine.isHeap(this.llContext(), part.array)) {
                return this.heapEngine.format(this.llContext(), part.array);
              }
              if (part !== null && typeof part === 'object' && 'array' in part) {
                return this.arrayEngine.format(this.llContext(), part.array);
              }
              if (part !== null && typeof part === 'object' && 'list' in part) {
                return this.linkedListProgram.format(this.llContext(), part.list);
              }
              if (part !== null && typeof part === 'object' && 'tree' in part) {
                return this.treeEngine.format(this.treeContext(), part.tree);
              }
              if (part !== null && typeof part === 'object' && 'graph' in part) {
                return this.graphEngine.format(this.treeContext(), part.graph);
              }
              if (part !== null && typeof part === 'object' && 'container' in part) {
                return this.treeEngine.isContainer(this.treeContext(), part.container)
                  ? this.treeEngine.formatContainer(this.treeContext(), part.container)
                  : String(part.container);
              }
              const value = this.currentVM ? this.currentVM.evaluateExpression(part) : part;
              return (
                this.trieEngine.formatValue(this.treeContext(), value) ??
                this.graphEngine.formatValue(this.treeContext(), value) ??
                this.treeEngine.formatValue(this.treeContext(), value) ??
                this.linkedListProgram.formatValue(this.llContext(), value) ??
                formatPrintValue(value)
              );
            })
            .join(' ');
          this.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'PRINT',
            message,
            kind: 'result',
            timestamp: Date.now(),
          });
          break;
        }

        // Linked-list pointer code (see LinkedListEngine): a pointer variable
        // moving, a field / pointer write, NEW_NODE and FREE.
        case 'LL_POINTER_MOVE': {
          const i = instruction as any;
          this.linkedListProgram.animatePointerMove(this.llContext(), i.name, i.value, i.previous, i.sourceText, i.valueExpr);
          break;
        }
        // The same pointer statements, compiled alike for lists and trees:
        // routed by what the operand actually is when the step runs.
        case 'LL_SET': {
          const target = this.currentVM ? this.currentVM.evaluateExpression((instruction as any).target) : null;
          if (this.trieEngine.owns(this.treeContext(), target) || this.nullBelongsToTrie(target)) this.trieEngine.setField(this.treeContext(), instruction as any);
          else if (this.graphEngine.owns(this.treeContext(), target)) this.graphEngine.setField(this.treeContext(), instruction as any);
          else if (this.pointerOwnerIsTree(target)) this.treeEngine.setField(this.treeContext(), instruction as any);
          else this.linkedListProgram.setField(this.llContext(), instruction as any);
          break;
        }
        case 'LL_NEW':
          if (this.treeEngine.isTree(this.treeContext(), (instruction as any).list)) this.treeEngine.allocate(this.treeContext(), instruction as any);
          else this.linkedListProgram.allocate(this.llContext(), instruction as any);
          break;
        case 'LL_FREE': {
          const target = this.currentVM ? this.currentVM.evaluateExpression((instruction as any).target) : null;
          if (this.pointerOwnerIsTree(target)) this.treeEngine.free(this.treeContext(), instruction as any);
          else this.linkedListProgram.free(this.llContext(), instruction as any);
          break;
        }

        // Trees (see TreeEngine): pointer moves, recursion, queues / stacks of pointers.
        case 'TREE_POINTER_MOVE': {
          const i = instruction as any;
          this.treeEngine.animatePointerMove(this.treeContext(), i.name, i.value, i.previous, i.sourceText, i.valueExpr);
          break;
        }
        case 'TREE_CALL':
          this.treeEngine.onCall(this.treeContext(), (instruction as any).event);
          break;

        // Graphs written as code (see GraphProgramEngine).
        case 'GRAPH_POINTER_MOVE': {
          const i = instruction as any;
          this.graphEngine.animatePointerMove(this.treeContext(), i.name, i.value, i.previous, i.sourceText, i.valueExpr);
          break;
        }
        case 'GRAPH_CALL':
          this.graphEngine.onCall(this.treeContext(), (instruction as any).event);
          break;
        case 'GRAPH_EDIT':
          this.graphEngine.edit(this.treeContext(), instruction as any);
          break;

        // Tries written as code (see TrieProgramEngine).
        case 'TRIE_POINTER_MOVE': {
          const i = instruction as any;
          this.trieEngine.animatePointerMove(this.treeContext(), i.name, i.value, i.previous, i.sourceText, i.valueExpr);
          break;
        }
        case 'TRIE_CALL':
          this.trieEngine.onCall(this.treeContext(), (instruction as any).event);
          break;
        case 'TRIE_EDIT':
          this.trieEngine.edit(this.treeContext(), instruction as any);
          break;
        case 'TRIE_CHECK': {
          const i = instruction as any;
          this.trieEngine.check(this.treeContext(), i.kind, i.node, i.ch, i.text);
          break;
        }

        // Hash maps written as code (see HashMapProgramEngine): operands are evaluated now.
        case 'MAP_PUT': {
          const i = instruction as any;
          const evaluate = (v: unknown) => (this.currentVM ? this.currentVM.evaluateExpression(v) : v);
          this.hashMapEngine.put(this.llContext(), i.map, evaluate(i.key), evaluate(i.value));
          break;
        }
        case 'MAP_DELETE': {
          const i = instruction as any;
          this.hashMapEngine.remove(this.llContext(), i.map, this.currentVM ? this.currentVM.evaluateExpression(i.key) : i.key);
          break;
        }
        case 'MAP_HIGHLIGHT': {
          const i = instruction as any;
          this.hashMapEngine.highlight(this.llContext(), i.map, this.currentVM ? this.currentVM.evaluateExpression(i.key) : i.key, i.color);
          break;
        }
        case 'MAP_LOOKUP': {
          const i = instruction as any;
          this.hashMapEngine.lookup(this.llContext(), i.map, i.key);
          break;
        }
        case 'CONTAINER_READ': {
          const i = instruction as any;
          if (!this.treeEngine.isContainer(this.treeContext(), i.container)) {
            throw new TreeError(
              `${i.op}(${i.container}): '${i.container}' is not a declared QUEUE or STACK.`
            );
          }
          this.treeEngine.containerTake(this.treeContext(), i);
          break;
        }

        case 'HIGHLIGHT_OBJECT': {
          const hl = instruction as HighlightObjectInstruction;
          const targetEl = this.sceneManager.getElement(this.resolveElementId(hl.targetId));
          if (targetEl) this.primitives.focus(this.algorithmContext(), targetEl, hl);
          break;
        }

        case 'SWAP_OBJECTS': {
          const swp = instruction as SwapObjectsInstruction;
          const leftEl = this.sceneManager.getElement(this.resolveElementId(swp.leftId)) as any;
          const rightEl = this.sceneManager.getElement(this.resolveElementId(swp.rightId)) as any;
          
          if (leftEl && rightEl && TreeEngine.isNodeRef(leftEl.id) && TreeEngine.isNodeRef(rightEl.id)) {
            // Tree nodes keep their places: SWAP exchanges their values.
            this.treeEngine.swapValues(this.treeContext(), leftEl.id, rightEl.id);
          } else if (leftEl && rightEl && leftEl.originalType === 'LINKEDLIST_NODE' && rightEl.originalType === 'LINKEDLIST_NODE') {
            // Linked-list nodes have no slots to trade: SWAP exchanges their values.
            this.linkedListEngine.swapValues(this.algorithmContext(), leftEl, rightEl);
          } else if (leftEl && rightEl) {
            this.primitives.exchange(this.algorithmContext(), leftEl, rightEl, swp);
          }
          break;
        }

        case 'COMPARE_OBJECTS': {
          const cmp = instruction as CompareObjectsInstruction;
          const leftEl = this.sceneManager.getElement(this.resolveElementId(cmp.leftId)) as any;
          const rightEl = this.sceneManager.getElement(this.resolveElementId(cmp.rightId)) as any;
          
          if (leftEl && rightEl) this.primitives.contrast(this.algorithmContext(), leftEl, rightEl, cmp);
          break;
        }

        case 'GENERIC_ACTION': {
          const gen = instruction as GenericActionInstruction;
          const actionName = gen.actionName.toUpperCase();
          if (DEBUG_ANIMATION) console.log(`[AnimationController] Executing GENERIC_ACTION ${actionName} with targetId ${gen.targetId}`, gen);

          // A queue / stack (holds values, or node pointers in a tree program).
          if (['ENQUEUE', 'PUSH', 'DEQUEUE', 'POP', 'FRONT', 'PEEK', 'REAR'].includes(actionName) &&
              this.treeEngine.isContainer(this.treeContext(), gen.args?.[0])) {
            const name = String(gen.args[0]);
            if (actionName === 'ENQUEUE' || actionName === 'PUSH') {
              if (gen.args.length < 2) throw new TreeError(`${actionName} needs a value, e.g. ${actionName} ${name} node.left`);
              this.treeEngine.containerAdd(this.treeContext(), name, actionName, gen.args[1], `${actionName} ${name} ${this.describeOperand(gen.args[1])}`);
            } else {
              this.treeEngine.containerTake(this.treeContext(), { op: actionName, container: name });
            }
            break;
          }
          if (['SIZE', 'IS_EMPTY', 'CLEAR'].includes(actionName) && this.treeEngine.isContainer(this.treeContext(), gen.args?.[0])) {
            const name = String(gen.args[0]);
            if (actionName === 'CLEAR') this.treeEngine.containerClear(this.treeContext(), name);
            else this.treeEngine.containerReport(this.treeContext(), actionName as 'SIZE' | 'IS_EMPTY', name);
            break;
          }
          const treeTarget = this.treeEngine.resolveBuiltin(this.treeContext(), gen);
          if (treeTarget) {
            this.treeEngine.execute(this.treeContext(), gen, treeTarget.tree, treeTarget.args);
            break;
          }
          const namedTree = (gen as any).payload?.logicalParent;
          if (namedTree && this.treeEngine.isTree(this.treeContext(), namedTree)) {
            throw new TreeError(
              `${actionName} is not a built-in for the tree '${namedTree}'. Trees support INSERT, SEARCH, DELETE, INORDER, PREORDER, POSTORDER, LEVELORDER, HEIGHT, SIZE, LEAVES, MIN, MAX, MIRROR, ROTATE, CLEAR — anything else can be written as pointer code (see the Trees examples).`
            );
          }

          const listName = (gen as any).payload?.logicalParent;
          if (listName && this.linkedListProgram.isList(this.llContext(), listName)) {
            this.linkedListEngine.execute(this.llContext(), gen);
            break;
          }
          
          const handler = AlgorithmRegistry.getHandler(actionName);
          if (handler) {
            // Allow instruction payload to override activeTreeName (e.g. compiler-generated
            // BST_INSERT instructions from initialElements carry payload.logicalParent).
            const payloadTree = (gen as any).payload?.logicalParent;
            if (payloadTree) {
              this.activeTreeName = payloadTree;
              // If this is a BST action, ensure the flag is set
              if (['BST_INSERT', 'BST_DELETE', 'BST_SEARCH', 'BST_CLEAR'].includes(actionName)) {
                this.activeTreeIsBST = true;
              }
            }

            const context: AlgorithmContext = {
              scheduler: this.animationScheduler,
              sceneManager: this.sceneManager,
              layoutManager: this.layoutManager,
              eventDispatcher: this.eventDispatcher,
              stateManager: this.stateManager,
              relationshipManager: this.relationshipManager,
              activeTreeName: this.activeTreeName,
              defaultColor: this.defaultColor
            };
            handler.execute(context, gen);
            this.activeTreeName = context.activeTreeName ?? null; // Sync back in case it changed
            break;
          }

          
          const payloadTreeForRouting = (gen as any).payload?.logicalParent;
          if (
            ['INSERT', 'DELETE', 'SEARCH', 'CLEAR', 'INORDER', 'PREORDER', 'POSTORDER', 'LEVELORDER', 'MIN', 'MIN_VALUE', 'MAX', 'MAX_VALUE', 'HEIGHT', 'SIZE', 'ROOT', 'IS_EMPTY'].includes(actionName) &&
            this.isTargetBST(payloadTreeForRouting)
          ) {
            // Allow instruction payload to override the active tree name so
            // un-prefixed ops (INSERT 50 in a BST scene) resolve correctly.
            if (payloadTreeForRouting) this.activeTreeName = payloadTreeForRouting;

            const context: AlgorithmContext = {
              scheduler: this.animationScheduler,
              sceneManager: this.sceneManager,
              layoutManager: this.layoutManager,
              eventDispatcher: this.eventDispatcher,
              stateManager: this.stateManager,
              relationshipManager: this.relationshipManager,
              activeTreeName: this.activeTreeName,
              defaultColor: this.defaultColor
            };
            this.bstAlgorithms.execute(context, gen);
            break;
          }

          const ctx = this.algorithmContext();
          if (['INSERT', 'DELETE', 'UPDATE'].includes(actionName) && this.arrayEngine.targetsSlot(ctx, gen)) {
            this.arrayEngine.execute(ctx, gen);
          } else if (actionName === 'INSERT') {
            // A bare INSERT that addresses no array slot has nothing to animate.
          } else if (actionName === 'DELETE') {
            let targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            if (!targetEl && gen.args && gen.args.length > 0) {
              targetEl = this.sceneManager.getElement(String(gen.args[0])) as any;
            }
            if (targetEl && targetEl.originalType === 'TREE_NODE') {
              const edges = this.sceneManager.getSceneGraph().filter((el: any) => el.type === 'edge' && (el.sourceId === targetEl.id || el.targetId === targetEl.id));
              
              this.animationScheduler.enqueue({
                targets: targetEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.8, duration: 300
              });
              this.animationScheduler.enqueue({ targets: targetEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(400);
              
              this.animationScheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
              this.animationScheduler.enqueue({ targets: targetEl.position, y: '-=2', duration: 400, easing: 'easeInBack' });
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                edges.forEach(e => this.sceneManager.removeElement(e.id));
                this.sceneManager.removeElement(targetEl.id);
                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Deleted node ${targetEl.id}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'DELETE', message: `Deleted node ${targetEl.id} and its edges.`, kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'UPDATE') {
            let targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            if (!targetEl && gen.args && gen.args.length > 0) {
              targetEl = this.sceneManager.getElement(String(gen.args[0])) as any;
            }
            if (targetEl) this.primitives.set(ctx, targetEl, gen.args?.[gen.args.length - 1]);
          } else if (actionName === 'DISCONNECT') {
            const sourceId = gen.args[0];
            const targetId = gen.args[1];
            if (typeof sourceId === 'string' && typeof targetId === 'string') this.primitives.unlink(ctx, sourceId, targetId);
          } else if (actionName === 'TREE' || actionName === 'BINARY_TREE' || actionName === 'BST') {
            this.activeTreeName = gen.args[0];
            this.activeTreeIsBST = (actionName === 'BST');
            // Initialize an empty tree if it doesn't exist
            if (!this.sceneManager.getElement(this.activeTreeName!)) {
              this.sceneManager.addElement({
                id: this.activeTreeName!, type: actionName === 'BST' ? 'BST' : 'TREE', label: this.activeTreeName!
              } as any);
            }
            this.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: actionName,
              message: `${actionName === 'BST' ? 'BST' : 'Tree'} "${this.activeTreeName}" initialized.`,
              kind: 'operation',
              timestamp: Date.now(),
            });
          } else if (actionName === 'ROOT' || actionName === 'CHILD' || actionName === 'PARENT' || actionName === 'LEFT_CHILD' || actionName === 'RIGHT_CHILD') {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            let parentId = null;
            let childId = null;
            let edgeLabel = undefined;

            if (actionName === 'ROOT') {
              childId = String(gen.args[0]);
            } else if (actionName === 'CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
            } else if (actionName === 'PARENT') {
              childId = String(gen.args[0]);
              parentId = String(gen.args[1]);
            } else if (actionName === 'LEFT_CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
              edgeLabel = 'L';
            } else if (actionName === 'RIGHT_CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
              edgeLabel = 'R';
            }

            if (childId && activeTree) {
              const ptrChild = this.sceneManager.getElement(childId);
              const ptrParent = parentId ? this.sceneManager.getElement(parentId) : null;
              AnticipationAnimation.applyAnticipation(this.animationScheduler, [ptrChild, ptrParent].filter(Boolean), 'POINTER');

              // Ensure child node exists
              let childEl = this.sceneManager.getElement(childId);
              if (!childEl) {
                childEl = {
                  id: childId, type: 'sphere', value: childId, label: childId,
                  logicalParent: activeTree, originalType: 'TREE_NODE',
                  position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
                  color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
                  lifecycleState: 'ACTIVE', visible: true, opacity: 1
                } as any;
                this.sceneManager.addElement(childEl as any);
              }

              // Ensure parent node exists if it's a CHILD or PARENT action
              if (parentId) {
                let parentEl = this.sceneManager.getElement(parentId);
                if (!parentEl) {
                  parentEl = {
                    id: parentId, type: 'sphere', value: parentId, label: parentId,
                    logicalParent: activeTree, originalType: 'TREE_NODE',
                    position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
                    color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
                    lifecycleState: 'ACTIVE', visible: true, opacity: 1
                  } as any;
                  this.sceneManager.addElement(parentEl as any);
                }

                // Create edge
                const edgeId = `edge_${parentId}_${childId}`;
                if (!this.sceneManager.getElement(edgeId)) {
                  const edge: any = {
                    id: edgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
                    color: '#888888', sourceId: parentId, targetId: childId, directed: true,
                    logicalParent: activeTree, originalType: 'EDGE',
                    properties: edgeLabel ? { label: edgeLabel } : undefined
                  };
                  this.sceneManager.addElement(edge);
                  this.relationshipManager.addRelationship({
                    id: edgeId, sourceId: parentId, targetId: childId, type: 'edge', directed: true
                  });
                }
              }

              // Update Layout and animate
              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

              const allEls = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType !== 'EDGE');
              allEls.forEach(el => {
                if ((el as any).worldTarget) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: (el as any).worldTarget.x,
                    y: (el as any).worldTarget.y,
                    z: (el as any).worldTarget.z,
                    duration: 500,
                    easing: 'easeOutCubic'
                  });
                  if (el.id === childId || el.id === parentId) {
                    this.animationScheduler.enqueue({
                      targets: el.scale,
                      x: 1, y: 1, z: 1,
                      duration: 600,
                      easing: 'easeOutBack'
                    });
                  }
                }
              });
              this.animationScheduler.commitGroup(true);

              this.animationScheduler.enqueue({
                targets: {}, duration: 1, complete: () => {
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `${actionName} operation`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  // Emit textual log for structural tree operations
                  if (actionName === 'ROOT') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'ROOT',
                      message: `Node "${childId}" set as root of tree "${activeTree}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'CHILD',
                      message: `Node "${childId}" added as child of "${parentId}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'PARENT') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'PARENT',
                      message: `Node "${childId}" set as child of "${parentId}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'LEFT_CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'LEFT_CHILD',
                      message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Left Child of ${parentId}.\nInsertion Complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'RIGHT_CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'RIGHT_CHILD',
                      message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Right Child of ${parentId}.\nInsertion Complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  }
                }
              });
              this.animationScheduler.commitSequential();
            }
          } else if (['SIBLING', 'ANCESTORS', 'DESCENDANTS'].includes(actionName)) {
            const targetId = String(gen.args[0]);
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'EDGE');
            
            const children: Map<string, string[]> = new Map();
            const parentMap: Map<string, string> = new Map();
            treeEdges.forEach((e: any) => {
              if (!children.has(e.sourceId)) children.set(e.sourceId, []);
              children.get(e.sourceId)!.push(e.targetId);
              parentMap.set(e.targetId, e.sourceId);
            });
            
            const toHighlight: string[] = [];
            
            if (actionName === 'SIBLING') {
              const p = parentMap.get(targetId);
              if (p) {
                const sibs = (children.get(p) || []).filter(c => c !== targetId);
                toHighlight.push(...sibs);
              }
            } else if (actionName === 'ANCESTORS') {
              let curr = parentMap.get(targetId);
              while (curr) {
                toHighlight.push(curr);
                curr = parentMap.get(curr);
              }
            } else if (actionName === 'DESCENDANTS') {
              const q = [targetId];
              while (q.length > 0) {
                const curr = q.shift()!;
                const ch = children.get(curr) || [];
                toHighlight.push(...ch);
                q.push(...ch);
              }
            }
            
            toHighlight.forEach(id => {
              const realEl = this.sceneManager.getElement(id) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.8, duration: 400 });
              }
            });
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(600);
            
            toHighlight.forEach(id => {
              const realEl = this.sceneManager.getElement(id) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveIntensity: 0, duration: 400 });
              }
            });
            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName, message: `Highlighted ${toHighlight.length} ${actionName.toLowerCase()} of ${targetId}.`, kind: 'operation', timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
          } else if (actionName === 'CLEAR') {
            let activeTree = this.activeTreeName;
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree);
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'CLEAR', message: 'Clearing tree...', kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
              treeNodes.forEach(node => {
                const realEl = this.sceneManager.getElement(node.id) as any;
                if (realEl) {
                  this.animationScheduler.enqueue({ targets: realEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                treeNodes.forEach(node => this.sceneManager.removeElement(node.id));
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Tree Cleared', this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'IS_EMPTY') {
            let activeTree = this.activeTreeName;
            if (activeTree) {
              const count = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE').length;
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'IS_EMPTY', message: count === 0 ? 'Tree is Empty.' : `Tree is not empty (size: ${count}).`, kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'SEARCH') {
            const searchVal = gen.args[0];
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');
            
            const children: Map<string, string[]> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            const hasParent = new Set<string>();
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                hasParent.add(e.targetId);
              }
            });
            const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || (treeNodes[0]?.id);
            
            const order: string[] = [];
            let found = false;
            
            const dfsSearch = (id: string): void => {
              if (found) return;
              order.push(id);
              const node = treeNodes.find((n: any) => n.id === id) as any;
              if (node && (node.value == searchVal || node.label == searchVal || node.id == searchVal)) {
                found = true;
                return;
              }
              (children.get(id) || []).forEach((c: string) => dfsSearch(c));
            };
            
            if (root) dfsSearch(root);
            
            const visitedSoFar: string[] = [];
            const traversingToken = getSemanticColorToken('TRAVERSING');
            const successToken = getSemanticColorToken('SUCCESS');

            order.forEach((nodeId, idx) => {
               const realEl = this.sceneManager.getElement(nodeId) as any;
               const isTarget = idx === order.length - 1 && found;
               if (realEl) {
                  AnticipationAnimation.applyAnticipation(this.animationScheduler, [realEl], 'TRAVERSAL');

                  const targetToken = isTarget ? successToken : traversingToken;
                  realEl.state = targetToken.name;
                  this.animationScheduler.enqueue({
                    targets: realEl, 
                    color: targetToken.color, 
                    emissiveColor: targetToken.emissiveColor, 
                    emissiveIntensity: targetToken.emissiveIntensity, 
                    duration: 300, 
                    easing: 'easeOutExpo',
                    complete: () => {
                      visitedSoFar.push(realEl.label || realEl.id);
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'SEARCH', message: `Visited: ${visitedSoFar.join(' -> ')}`, kind: 'operation', timestamp: Date.now()
                      });
                      if (isTarget) {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'SEARCH_SUCCESS', message: `Value ${searchVal} found at node ${realEl.label || realEl.id}.`, kind: 'result', timestamp: Date.now()
                        });
                      } else if (idx === order.length - 1 && !found) {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'SEARCH_FAIL', message: `Value ${searchVal} not found in the tree.`, kind: 'result', timestamp: Date.now()
                        });
                      }
                    }
                  });
                  this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(400);
                  
                  if (!isTarget) {
                     this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveIntensity: 0.1, duration: 300 });
                     this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 300 });
                     this.animationScheduler.commitGroup(true);
                  }
               }
            });
          } else if (['PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'ZIGZAG', 'DFS', 'BFS'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              // Build parent->children adjacency map from edges
              const children: Map<string, string[]> = new Map();
              const leftChild: Map<string, string> = new Map();
              const rightChild: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                  if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                  if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
                }
              });
              // Find roots (nodes with no parent)
              const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
              const root = roots[0] || (treeNodes[0]?.id);

              // Traversal algorithms - return ordered array of node IDs
              const order: string[] = [];

              const preorder = (id: string): void => {
                order.push(id);
                (children.get(id) || []).forEach((c: string) => preorder(c));
              };
              const inorder = (id: string): void => {
                const ch = children.get(id) || [];
                const lc = leftChild.has(id) ? leftChild.get(id) : ch[0];
                const rc = rightChild.has(id) ? rightChild.get(id) : ch[1];
                if (lc) inorder(lc);
                order.push(id);
                if (rc) inorder(rc);
              };
              const postorder = (id: string): void => {
                (children.get(id) || []).forEach((c: string) => postorder(c));
                order.push(id);
              };
              const levelorder = (id: string): void => {
                const queue = [id];
                while (queue.length > 0) {
                  const cur = queue.shift()!;
                  order.push(cur);
                  (children.get(cur) || []).forEach((c: string) => queue.push(c));
                }
              };
              const reverselevelorder = (id: string): void => {
                const queue = [id];
                while (queue.length > 0) {
                  const cur = queue.shift()!;
                  order.push(cur);
                  const ch = children.get(cur) || [];
                  const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
                  const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
                  if (rc) queue.push(rc); // right first so reverse works out to left first
                  if (lc) queue.push(lc);
                }
                order.reverse();
              };
              const zigzag = (id: string): void => {
                let currentLevel = [id];
                let leftToRight = true;
                while (currentLevel.length > 0) {
                  const nextLevel: string[] = [];
                  const vals = leftToRight ? currentLevel : [...currentLevel].reverse();
                  order.push(...vals);
                  
                  for (const cur of currentLevel) {
                    const ch = children.get(cur) || [];
                    const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
                    const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
                    if (lc) nextLevel.push(lc);
                    if (rc) nextLevel.push(rc);
                  }
                  currentLevel = nextLevel;
                  leftToRight = !leftToRight;
                }
              };
              const dfs = (id: string): void => {
                const stack = [id];
                const visited = new Set<string>();
                while (stack.length > 0) {
                  const cur = stack.pop()!;
                  if (visited.has(cur)) continue;
                  visited.add(cur);
                  order.push(cur);
                  const ch = (children.get(cur) || []).slice().reverse();
                  ch.forEach((c: string) => stack.push(c));
                }
              };
              const bfs = (id: string): void => { levelorder(id); };

              if (root) {
                if (actionName === 'PREORDER')   preorder(root);
                else if (actionName === 'INORDER') inorder(root);
                else if (actionName === 'POSTORDER')  postorder(root);
                else if (actionName === 'LEVELORDER') levelorder(root);
                else if (actionName === 'REVERSELEVELORDER') reverselevelorder(root);
                else if (actionName === 'ZIGZAG') zigzag(root);
                else if (actionName === 'DFS')        dfs(root);
                else if (actionName === 'BFS')        bfs(root);
              }

              // Map node IDs to labels for display
              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
              const traversalLabels = order.map((id: string) => labelMap.get(id) || id);
              const traversalText = traversalLabels.join(' → ');

              // Emit header log event BEFORE animations start
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  let traversalName = actionName.charAt(0) + actionName.slice(1).toLowerCase();
                  if (actionName === 'LEVELORDER') traversalName = 'Level-Order';
                  else if (actionName === 'REVERSELEVELORDER') traversalName = 'Reverse Level-Order';
                  else if (actionName === 'ZIGZAG') traversalName = 'Zig-Zag';
                  else if (actionName === 'DFS') traversalName = 'DFS';
                  else if (actionName === 'BFS') traversalName = 'BFS';
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: `${traversalName} Traversal — Starting from root "${labelMap.get(root!) || root}"\nVisit Order:\n${traversalText}`,
                    kind: 'traversal',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // Animate each node glowing in traversal order, sequentially
              // Also emit per-node step logs synchronized with each highlight
              const GLOW_DURATION = 700;
              const traversingToken = getSemanticColorToken('TRAVERSING');
              const GLOW_COLOR = traversingToken.color;
              const visitedSoFar: string[] = [];
              order.forEach((nodeId: string, nodeIdx: number) => {
                const realEl = this.sceneManager.getElement(nodeId) as any;
                const nodeLabel = labelMap.get(nodeId) || nodeId;
                if (realEl) {
                  AnticipationAnimation.applyAnticipation(this.animationScheduler, [realEl], 'TRAVERSAL');
                  const origColor = realEl.color || this.defaultColor;
                  realEl.state = 'TRAVERSING';
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: GLOW_COLOR,
                    emissiveColor: traversingToken.emissiveColor,
                    emissiveIntensity: 0.9,
                    duration: 200,
                    easing: 'easeOutExpo',
                    complete: () => {
                      // Per-node step log — fires as each node is highlighted
                      visitedSoFar.push(nodeLabel);
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'VISITING',
                        message: visitedSoFar.join(' → '),
                        kind: 'step',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.25, y: 1.25, z: 1.25,
                    duration: 200, easing: 'easeOutExpo',
                  });
                  this.animationScheduler.commitGroup(true);

                  this.animationScheduler.advanceCursor(GLOW_DURATION - 400);

                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: origColor,
                    emissiveColor: '#000000',
                    emissiveIntensity: 0,
                    duration: 200, easing: 'easeInExpo',
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1, y: 1, z: 1,
                    duration: 200, easing: 'easeInExpo',
                  });
                  this.animationScheduler.commitGroup(true);
                }
              });
              this.animationScheduler.advanceCursor(200);
            }
          } else if (['HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              const children: Map<string, string[]> = new Map();
              const leftChild: Map<string, string> = new Map();
              const rightChild: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                  if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                  if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
                }
              });
              const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
              const root = roots[0] || treeNodes[0]?.id;

              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

              // We'll execute an animated sequence for counting or path finding.
              const nodesToHighlight: string[] = [];
              let finalMessage = '';
              let stepKeyword = '';
              let stepMessageFormat = '';

              if (['COUNT_NODES', 'SIZE'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.map((n: any) => n.id));
                finalMessage = `Total Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_NODES';
                stepMessageFormat = 'Node Found: {label}';
              } else if (['COUNT_LEAVES', 'LEAVES'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0)).map((n: any) => n.id));
                finalMessage = `Total Leaf Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_LEAVES';
                stepMessageFormat = 'Leaf Found: {label}';
              } else if (['COUNT_INTERNAL', 'INTERNAL'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0).map((n: any) => n.id));
                finalMessage = `Total Internal Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_INTERNAL';
                stepMessageFormat = 'Internal Node Found: {label}';
              } else if (actionName === 'COUNT_LEFT_LEAVES') {
                const leftLeaves = Array.from(leftChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
                nodesToHighlight.push(...leftLeaves);
                finalMessage = `Total Left Leaves = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_LEFT_LEAVES';
                stepMessageFormat = 'Left Leaf Found: {label}';
              } else if (actionName === 'COUNT_RIGHT_LEAVES') {
                const rightLeaves = Array.from(rightChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
                nodesToHighlight.push(...rightLeaves);
                finalMessage = `Total Right Leaves = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_RIGHT_LEAVES';
                stepMessageFormat = 'Right Leaf Found: {label}';
              } else if (actionName === 'COUNT_FULL') {
                nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 2).map((n: any) => n.id));
                finalMessage = `Total Full Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_FULL';
                stepMessageFormat = 'Full Node Found: {label}';
              } else if (actionName === 'COUNT_HALF') {
                nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 1).map((n: any) => n.id));
                finalMessage = `Total Half Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_HALF';
                stepMessageFormat = 'Half Node Found: {label}';
              } else if (['HEIGHT', 'MAX_DEPTH'].includes(actionName)) {
                let maxPath: string[] = [];
                const dfsPath = (id: string, currentPath: string[]) => {
                  currentPath.push(id);
                  const ch = children.get(id) || [];
                  if (ch.length === 0) {
                    if (currentPath.length > maxPath.length) maxPath = [...currentPath];
                  } else {
                    ch.forEach(c => dfsPath(c, [...currentPath]));
                  }
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...maxPath);
                finalMessage = `Max Depth / Height = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
                stepKeyword = actionName;
                stepMessageFormat = 'Traversing longest path: {label}';
              } else if (actionName === 'MIN_DEPTH') {
                let minPath: string[] = [];
                let minLen = Infinity;
                const dfsPath = (id: string, currentPath: string[]) => {
                  currentPath.push(id);
                  const ch = children.get(id) || [];
                  if (ch.length === 0) {
                    if (currentPath.length < minLen) {
                      minLen = currentPath.length;
                      minPath = [...currentPath];
                    }
                  } else {
                    ch.forEach(c => dfsPath(c, [...currentPath]));
                  }
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...minPath);
                finalMessage = `Minimum Depth = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
                stepKeyword = 'MIN_DEPTH';
                stepMessageFormat = 'Traversing shortest path: {label}';
              } else if (['DEPTH', 'LEVEL'].includes(actionName)) {
                const targetNode = gen.args[0];
                let path: string[] = [];
                const dfsPath = (id: string, currentPath: string[]): boolean => {
                  currentPath.push(id);
                  if (id === targetNode || labelMap.get(id) === targetNode) {
                    path = [...currentPath];
                    return true;
                  }
                  for (const c of (children.get(id) || [])) {
                    if (dfsPath(c, [...currentPath])) return true;
                  }
                  return false;
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...path);
                const d = path.length > 0 ? path.length - 1 : -1;
                finalMessage = `${actionName === 'LEVEL' ? 'Level' : 'Depth'} of "${targetNode || 'root'}" = ${d >= 0 ? d : '(not found)'}`;
                stepKeyword = actionName;
                stepMessageFormat = 'Traversing path to target: {label}';
              } else if (actionName === 'DEGREE') {
                 const degreeMap = treeNodes.map((n: any) => `${n.label || n.id}:${(children.get(n.id) || []).length}`);
                 finalMessage = `Degree per node: ${degreeMap.join(', ')}`;
                 stepKeyword = 'DEGREE';
              } else if (actionName === 'STATS') {
                 const totalNodes = treeNodes.length;
                 const leafNodes = treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0));
                 const internalNodes = treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0);
                 const treeHeight = (id: string): number => {
                   const ch = children.get(id) || [];
                   if (ch.length === 0) return 0;
                   return 1 + Math.max(...ch.map((c: string) => treeHeight(c)));
                 };
                 const height = root ? treeHeight(root) : 0;
                 finalMessage = `Size: ${totalNodes} | Height: ${height} | Leaves: ${leafNodes.length} | Internal: ${internalNodes.length} | Root: ${root ? (labelMap.get(root) || root) : 'none'}`;
                 stepKeyword = 'STATS';
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: `Executing ${actionName}...`,
                    kind: 'info',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              if (nodesToHighlight.length > 0 && stepMessageFormat) {
                // Animate sequentially
                const GLOW_DURATION = 500;
                nodesToHighlight.forEach((nodeId: string) => {
                  const realEl = this.sceneManager.getElement(nodeId) as any;
                  const nodeLabel = labelMap.get(nodeId) || nodeId;
                  if (realEl) {
                    const origColor = realEl.color || '#4facfe';
                    this.animationScheduler.enqueue({
                      targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 200, easing: 'easeOutExpo',
                      complete: () => {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: stepKeyword,
                          message: stepMessageFormat.replace('{label}', nodeLabel),
                          kind: 'step',
                          timestamp: Date.now(),
                        });
                      }
                    });
                    this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.25, y: 1.25, z: 1.25, duration: 200, easing: 'easeOutExpo' });
                    this.animationScheduler.commitGroup(true);
                    this.animationScheduler.advanceCursor(GLOW_DURATION - 400);
                    this.animationScheduler.enqueue({ targets: realEl, color: origColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200, easing: 'easeInExpo' });
                    this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 200, easing: 'easeInExpo' });
                    this.animationScheduler.commitGroup(true);
                  }
                });
              } else if (nodesToHighlight.length === 0 && !['DEGREE', 'STATS'].includes(actionName)) {
                  // Pulse all tree nodes briefly in purple to acknowledge the query if no specific nodes to highlight
                  const treeEls = treeNodes.map((n: any) => this.sceneManager.getElement(n.id)).filter(Boolean) as any[];
                  if (treeEls.length > 0) {
                    this.animationScheduler.enqueue({ targets: treeEls, emissiveColor: '#c486eb', emissiveIntensity: 0.6, duration: 300 });
                    this.animationScheduler.commitGroup(true);
                    this.animationScheduler.advanceCursor(400);
                    this.animationScheduler.enqueue({ targets: treeEls, emissiveIntensity: 0, duration: 300 });
                    this.animationScheduler.commitGroup(true);
                  }
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: finalMessage,
                    kind: 'result',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(200);
            } else {
              this.animationScheduler.advanceCursor(300);
            }
          } else if (['IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const leftChild: Map<string, string> = new Map();
            const rightChild: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            const hasParent = new Set<string>();
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                hasParent.add(e.targetId);
                if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
              }
            });
            const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || treeNodes[0]?.id;

            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

            let propertyPassed = true;
            let failReason = '';
            let failNodeId = '';
            const traversalOrder: string[] = [];

            const treeHeight = (id: string | undefined): number => {
              if (!id) return 0;
              const lc = leftChild.get(id);
              const rc = rightChild.get(id);
              return 1 + Math.max(treeHeight(lc), treeHeight(rc));
            };

            if (actionName === 'IS_FULL') {
              const queue = [root].filter(Boolean);
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                const rc = rightChild.get(cur);
                if ((lc && !rc) || (!lc && rc)) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has exactly one child.`;
                }
                if (lc) queue.push(lc);
                if (rc) queue.push(rc);
              }
              if (propertyPassed) failReason = 'Every node has either 0 or 2 children.';
            } else if (actionName === 'IS_COMPLETE') {
              const queue = [root].filter(Boolean);
              let seenEmpty = false;
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                if (cur === null) {
                  seenEmpty = true;
                } else {
                  traversalOrder.push(cur);
                  if (seenEmpty) {
                    propertyPassed = false;
                    failNodeId = cur;
                    failReason = `Tree contains missing nodes before occupied nodes (Found node ${labelMap.get(cur) || cur} after an empty spot).`;
                  } else {
                    queue.push(leftChild.get(cur) || (null as any));
                    queue.push(rightChild.get(cur) || (null as any));
                  }
                }
              }
              if (propertyPassed) failReason = 'All levels are filled left-to-right without gaps.';
            } else if (actionName === 'IS_PERFECT') {
              const h = treeHeight(root);
              const queue = [{id: root, level: 1}].filter(n => n.id);
              while (queue.length > 0 && propertyPassed) {
                const {id, level} = queue.shift()!;
                traversalOrder.push(id!);
                const lc = leftChild.get(id!);
                const rc = rightChild.get(id!);
                if (lc || rc) {
                  if (!lc || !rc) {
                    propertyPassed = false;
                    failNodeId = id!;
                    failReason = `Node ${labelMap.get(id!) || id!} is an internal node but doesn't have 2 children.`;
                  }
                } else if (level !== h) {
                  propertyPassed = false;
                  failNodeId = id!;
                  failReason = `Leaf node ${labelMap.get(id!) || id!} is at level ${level}, but expected level ${h}.`;
                }
                if (lc) queue.push({id: lc, level: level + 1});
                if (rc) queue.push({id: rc, level: level + 1});
              }
              if (propertyPassed) failReason = `All leaves are at level ${h} and internal nodes have 2 children.`;
            } else if (actionName === 'IS_BALANCED') {
              const checkBalance = (id: string | undefined): boolean => {
                if (!id) return true;
                traversalOrder.push(id);
                const lc = leftChild.get(id);
                const rc = rightChild.get(id);
                const lh = treeHeight(lc);
                const rh = treeHeight(rc);
                if (Math.abs(lh - rh) > 1) {
                  propertyPassed = false;
                  failNodeId = id;
                  failReason = `Node ${labelMap.get(id) || id} is unbalanced (left height: ${lh}, right height: ${rh}).`;
                  return false;
                }
                return checkBalance(lc) && checkBalance(rc);
              };
              if (root) checkBalance(root);
              if (propertyPassed) failReason = 'All nodes have height differences of at most 1 between subtrees.';
            } else if (actionName === 'IS_DEGENERATE') {
              const queue = [root].filter(Boolean);
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                const rc = rightChild.get(cur);
                if (lc && rc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has two children. Degenerate trees have at most one child per node.`;
                }
                if (lc) queue.push(lc);
                if (rc) queue.push(rc);
              }
              if (propertyPassed) failReason = 'Every node has at most one child (resembles a linked list).';
            } else if (actionName === 'IS_LEFT_SKEWED') {
              let cur = root;
              while (cur && propertyPassed) {
                traversalOrder.push(cur);
                const rc = rightChild.get(cur);
                if (rc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has a right child. Left skewed trees only have left children.`;
                }
                cur = leftChild.get(cur);
              }
              if (propertyPassed) failReason = 'All nodes only have left children.';
            } else if (actionName === 'IS_RIGHT_SKEWED') {
              let cur = root;
              while (cur && propertyPassed) {
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                if (lc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has a left child. Right skewed trees only have right children.`;
                }
                cur = rightChild.get(cur);
              }
              if (propertyPassed) failReason = 'All nodes only have right children.';
            } else if (actionName === 'IS_SYMMETRIC') {
              const isMirror = (node1: string | undefined, node2: string | undefined): boolean => {
                if (!node1 && !node2) return true;
                if (node1 && !node2) {
                  propertyPassed = false; failNodeId = node1; failReason = `Node ${labelMap.get(node1) || node1} has no mirror counterpart.`; return false;
                }
                if (!node1 && node2) {
                  propertyPassed = false; failNodeId = node2; failReason = `Node ${labelMap.get(node2) || node2} has no mirror counterpart.`; return false;
                }
                traversalOrder.push(node1!);
                traversalOrder.push(node2!);
                const el1 = this.sceneManager.getElement(node1!) as any;
                const el2 = this.sceneManager.getElement(node2!) as any;
                if (el1?.value !== el2?.value) {
                  propertyPassed = false; failNodeId = node1!; failReason = `Values do not match: ${el1?.value} vs ${el2?.value}`; return false;
                }
                return isMirror(leftChild.get(node1!), rightChild.get(node2!)) && isMirror(rightChild.get(node1!), leftChild.get(node2!));
              };
              if (root) isMirror(leftChild.get(root), rightChild.get(root));
              if (propertyPassed) failReason = 'The left and right subtrees are mirror images of each other.';
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              const readableName = actionName.replace('IS_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Checking ${readableName}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            traversalOrder.forEach((nodeId) => {
              const realEl = this.sceneManager.getElement(nodeId) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 250 });
                this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(100);
                this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 250 });
                this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 250 });
                this.animationScheduler.commitGroup(true);
              }
            });

            this.animationScheduler.advanceCursor(200);

            if (!propertyPassed && failNodeId) {
              const failEl = this.sceneManager.getElement(failNodeId) as any;
              if (failEl) {
                this.animationScheduler.enqueue({ targets: failEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 400 });
                this.animationScheduler.enqueue({ targets: failEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(600);
                this.animationScheduler.enqueue({ targets: failEl, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
                this.animationScheduler.enqueue({ targets: failEl.scale, x: 1, y: 1, z: 1, duration: 300 });
                this.animationScheduler.commitGroup(true);
              }
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              const resString = propertyPassed ? 'PASS' : 'FAIL';
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: `${actionName}_RESULT`,
                message: `Result: ${resString}\n${failReason}\nTree is ${propertyPassed ? '' : 'NOT '}the required property.`,
                kind: propertyPassed ? 'result' : 'warning',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(200);

          } else if (['LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const parent: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                parent.set(e.targetId, e.sourceId);
              }
            });

            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
            
            const resolveTarget = (arg: any): string => {
              const val = String(arg);
              const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
              return byLabel ? byLabel.id : val;
            };

            const getPathToRoot = (id: string): string[] => {
              const p: string[] = [];
              let cur: string | undefined = id;
              while (cur) {
                p.push(cur);
                cur = parent.get(cur);
              }
              return p;
            };

            let nodesToHighlight: string[] = [];
            let path1Highlight: string[] = [];
            let path2Highlight: string[] = [];
            let finalMessage = '';

            if (actionName === 'LCA' || actionName === 'DISTANCE') {
              const nodeA = resolveTarget(gen.args[0]);
              const nodeB = resolveTarget(gen.args[1]);
              
              if (allNodeIds.has(nodeA) && allNodeIds.has(nodeB)) {
                const pathA = getPathToRoot(nodeA).reverse();
                const pathB = getPathToRoot(nodeB).reverse();
                
                let lca = '';
                for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
                  if (pathA[i] === pathB[i]) lca = pathA[i];
                  else break;
                }
                
                if (actionName === 'LCA') {
                  path1Highlight = getPathToRoot(nodeA);
                  path2Highlight = getPathToRoot(nodeB);
                  nodesToHighlight = [lca];
                  finalMessage = `Lowest Common Ancestor of ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${labelMap.get(lca) || lca}.`;
                } else {
                  const distA = pathA.length - 1 - pathA.indexOf(lca);
                  const distB = pathB.length - 1 - pathB.indexOf(lca);
                  const totalDist = distA + distB;
                  nodesToHighlight = [nodeA, nodeB, lca];
                  finalMessage = `Distance between ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${totalDist} edges. (LCA: ${labelMap.get(lca) || lca})`;
                }
              } else {
                finalMessage = `Nodes not found for ${actionName}.`;
              }
            } else if (actionName === 'GRANDPARENT') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              if (gp) {
                path1Highlight = [node, p!, gp];
                nodesToHighlight = [gp];
                finalMessage = `Grandparent of ${labelMap.get(node) || node} is ${labelMap.get(gp) || gp}.`;
              } else {
                finalMessage = `${labelMap.get(node) || node} does not have a grandparent.`;
              }
            } else if (actionName === 'UNCLE') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              if (gp) {
                const uncle = (children.get(gp) || []).find(c => c !== p);
                if (uncle) {
                  path1Highlight = [node, p!, gp, uncle];
                  nodesToHighlight = [uncle];
                  finalMessage = `Uncle of ${labelMap.get(node) || node} is ${labelMap.get(uncle) || uncle}.`;
                } else {
                  finalMessage = `${labelMap.get(node) || node} does not have an uncle.`;
                }
              } else {
                finalMessage = `${labelMap.get(node) || node} does not have an uncle (no grandparent).`;
              }
            } else if (actionName === 'COUSINS') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              const cousins: string[] = [];
              if (gp) {
                const uncles = (children.get(gp) || []).filter(c => c !== p);
                uncles.forEach(u => cousins.push(...(children.get(u) || [])));
              }
              nodesToHighlight = cousins;
              if (cousins.length > 0) {
                finalMessage = `Cousins of ${labelMap.get(node) || node}: ${cousins.map(c => labelMap.get(c) || c).join(', ')}`;
              } else {
                finalMessage = `${labelMap.get(node) || node} has no cousins.`;
              }
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Executing ${actionName}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            const highlightSequence = (path: string[], color: string) => {
              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: color, emissiveColor: color, emissiveIntensity: 0.8, duration: 250 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.1, y: 1.1, z: 1.1, duration: 250 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(100);
                }
              });
            };

            if (path1Highlight.length > 0) highlightSequence(path1Highlight.reverse(), '#9f7aea'); // Animate from node to target
            if (path2Highlight.length > 0) highlightSequence(path2Highlight.reverse(), '#ed64a6');

            if (nodesToHighlight.length > 0) {
              this.animationScheduler.advanceCursor(200);
              nodesToHighlight.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 1.0, duration: 300 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 300 });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(600);
            }

            const allHighlighted = new Set([...path1Highlight, ...path2Highlight, ...nodesToHighlight]);
            allHighlighted.forEach(id => {
              const el = this.sceneManager.getElement(id) as any;
              if (el) {
                this.animationScheduler.enqueue({ targets: el, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
                this.animationScheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
              }
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: `${actionName}_RESULT`,
                message: finalMessage,
                kind: 'result',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(200);

          } else if (['ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const parent: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                parent.set(e.targetId, e.sourceId);
              }
            });

            const roots = treeNodes.filter((n: any) => !parent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || treeNodes[0]?.id;
            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
            
            const resolveTarget = (arg: any): string => {
              const val = String(arg);
              const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
              return byLabel ? byLabel.id : val;
            };

            const findAllPaths = (node: string, currentPath: string[], allPaths: string[][]) => {
              currentPath.push(node);
              const ch = children.get(node) || [];
              if (ch.length === 0) {
                allPaths.push([...currentPath]);
              } else {
                ch.forEach(c => findAllPaths(c, [...currentPath], allPaths));
              }
            };

            let pathsToHighlight: string[][] = [];
            let logHeader = '';

            if (actionName === 'ROOT_TO_NODE') {
              const targetNode = resolveTarget(gen.args[0]);
              if (allNodeIds.has(targetNode)) {
                let cur: string | undefined = targetNode;
                const path: string[] = [];
                while (cur) {
                  path.push(cur);
                  cur = parent.get(cur);
                }
                pathsToHighlight = [path.reverse()];
                logHeader = `Root to Node Path for ${labelMap.get(targetNode) || targetNode}`;
              }
            } else if (actionName === 'ROOT_TO_LEAVES') {
              if (root) findAllPaths(root, [], pathsToHighlight);
              logHeader = 'Root to Leaf Path';
            } else if (actionName === 'LONGEST_PATH') {
              const allPaths: string[][] = [];
              if (root) findAllPaths(root, [], allPaths);
              let maxLen = 0;
              allPaths.forEach(p => { if (p.length > maxLen) maxLen = p.length; });
              pathsToHighlight = allPaths.filter(p => p.length === maxLen);
              logHeader = 'Longest Path(s)';
            } else if (actionName === 'SHORTEST_PATH') {
              const allPaths: string[][] = [];
              if (root) findAllPaths(root, [], allPaths);
              let minLen = Infinity;
              allPaths.forEach(p => { if (p.length < minLen) minLen = p.length; });
              pathsToHighlight = allPaths.filter(p => p.length === minLen);
              logHeader = 'Shortest Path(s)';
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Executing ${logHeader}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            pathsToHighlight.forEach((path, idx) => {
              const readablePath = path.map(id => labelMap.get(id) || id).join(' → ');
              
              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: '#48bb78', emissiveColor: '#48bb78', emissiveIntensity: 0.9, duration: 200 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 200 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(100);
                }
              });

              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'PATH',
                  message: `${logHeader}\n\n${readablePath}`,
                  kind: 'result',
                  timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.advanceCursor(400);

              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
                }
              });
              this.animationScheduler.commitGroup(true);
            });
            this.animationScheduler.advanceCursor(200);

          } else if (['PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              const children: Map<string, string[]> = new Map();
              const parent: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  parent.set(e.targetId, e.sourceId);
                }
              });
              const roots = treeNodes.filter((n: any) => !parent.has(n.id));
              const root = roots[0]?.id;
              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

              const targetArg = gen.args[0];
              const targetArg2 = gen.args[1];

              let resultIds: string[] = [];
              let message = '';

              if (actionName === 'PARENTOF') {
                const p = parent.get(targetArg);
                resultIds = p ? [p] : [];
                message = p ? `Parent of "${targetArg}": ${labelMap.get(p) || p}` : `"${targetArg}" is the root (no parent)`;
              } else if (actionName === 'CHILDRENOF') {
                resultIds = children.get(targetArg) || [];
                const labels = resultIds.map((id: string) => labelMap.get(id) || id);
                message = labels.length > 0
                  ? `Children of "${targetArg}": ${labels.join(', ')}`
                  : `"${targetArg}" has no children (leaf node)`;
              } else if (actionName === 'ANCESTORS') {
                let cur = parent.get(targetArg);
                while (cur) { resultIds.push(cur); cur = parent.get(cur); }
                message = resultIds.length > 0
                  ? `Ancestors of "${targetArg}": ${resultIds.map((id: string) => labelMap.get(id) || id).join(' ← ')}`
                  : `"${targetArg}" has no ancestors (is root)`;
              } else if (actionName === 'DESCENDANTS') {
                const collectDesc = (id: string): void => {
                  (children.get(id) || []).forEach((c: string) => { resultIds.push(c); collectDesc(c); });
                };
                collectDesc(targetArg);
                message = resultIds.length > 0
                  ? `Descendants of "${targetArg}" (${resultIds.length}): ${resultIds.map((id: string) => labelMap.get(id) || id).join(', ')}`
                  : `"${targetArg}" has no descendants (leaf node)`;
              } else if (actionName === 'SIBLINGS') {
                const p = parent.get(targetArg);
                const sibs = p ? (children.get(p) || []).filter((c: string) => c !== targetArg) : [];
                resultIds = sibs;
                message = sibs.length > 0
                  ? `Siblings of "${targetArg}": ${sibs.map((id: string) => labelMap.get(id) || id).join(', ')}`
                  : `"${targetArg}" has no siblings`;
              } else if (actionName === 'PATH') {
                // PATH from arg0 to arg1
                const findPath = (from: string, to: string): string[] | null => {
                  if (from === to) return [from];
                  for (const c of (children.get(from) || [])) {
                    const sub = findPath(c, to);
                    if (sub) return [from, ...sub];
                  }
                  return null;
                };
                const path = root ? (findPath(targetArg, targetArg2) || findPath(root, targetArg2) || []) : [];
                resultIds = path;
                message = path.length > 0
                  ? `Path ${targetArg} → ${targetArg2}: ${path.map((id: string) => labelMap.get(id) || id).join(' → ')}`
                  : `No path found from "${targetArg}" to "${targetArg2}"`;
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message,
                    kind: 'relationship',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // Highlight result nodes in orange, sequentially
              const HIGHLIGHT_COLOR = '#f5a623';
              const targetsToAnimate = resultIds.length > 0 ? resultIds : [targetArg];
              targetsToAnimate.forEach((nodeId: string) => {
                const realEl = this.sceneManager.getElement(nodeId) as any;
                if (realEl) {
                  const origColor = realEl.color || '#4facfe';
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: HIGHLIGHT_COLOR,
                    emissiveColor: HIGHLIGHT_COLOR,
                    emissiveIntensity: 0.8,
                    duration: 250,
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.2, y: 1.2, z: 1.2,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(600);
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: origColor,
                    emissiveColor: '#000000',
                    emissiveIntensity: 0,
                    duration: 250,
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1, y: 1, z: 1,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                }
              });
              this.animationScheduler.advanceCursor(200);
            }
          } else if (actionName === 'INSERT' && gen.args?.length >= 2) {
            // Tree node insertion: INSERT <node> INTO <parent> or INSERT <node> CHILD <parent>
            // args[0] = nodeId, args[1] = parentId (from AQVL compiler)
            const newNodeId = gen.args[0];
            const targetParentId = gen.args[1];
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            const treeNodesList = activeTree
              ? this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE')
              : [];
            const labelMapInsert = new Map(treeNodesList.map((n: any) => [n.id, n.label || n.value || n.id]));
            const newNodeLabel = labelMapInsert.get(newNodeId) || newNodeId;
            const parentLabel = labelMapInsert.get(targetParentId) || targetParentId;

            this.animationScheduler.enqueue({
              targets: {}, duration: 1,
              complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'INSERT',
                  message: targetParentId
                    ? `Node "${newNodeLabel}" inserted as child of "${parentLabel}".\nTree restructured successfully.`
                    : `Node "${newNodeLabel}" inserted into tree as root.\nTree restructured successfully.`,
                  kind: 'operation',
                  timestamp: Date.now(),
                });
              }
            });
            this.animationScheduler.commitGroup(true);
          } else if (actionName === 'DELETE') {
            // Tree node deletion: DELETE <node>
            const targetNodeId = gen.args[0] || gen.targetId;
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            const treeNodesForDel = activeTree
              ? this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE')
              : [];
            const labelMapDel = new Map(treeNodesForDel.map((n: any) => [n.id, n.label || n.value || n.id]));
            const deletedLabel = labelMapDel.get(targetNodeId) || targetNodeId;

            // Animate: shrink and remove the node
            const delEl = targetNodeId ? this.sceneManager.getElement(targetNodeId) as any : null;
            if (delEl) {
              this.animationScheduler.enqueue({
                targets: delEl,
                color: '#f44336',
                emissiveColor: '#f44336',
                emissiveIntensity: 0.8,
                duration: 300,
                easing: 'easeOutExpo',
              });
              this.animationScheduler.enqueue({
                targets: delEl.scale,
                x: 0, y: 0, z: 0,
                duration: 400,
                easing: 'easeInBack',
              });
              this.animationScheduler.commitGroup(true);

              // Remove edges connected to deleted node
              const connectedEdges = this.sceneManager.getSceneGraph().filter((el: any) =>
                el.type === 'edge' && (el.sourceId === targetNodeId || el.targetId === targetNodeId)
              );
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  connectedEdges.forEach((e: any) => this.sceneManager.removeElement(e.id));
                  this.sceneManager.removeElement(targetNodeId);
                  if (activeTree) {
                    this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                    const remainingNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
                    remainingNodes.forEach((el: any) => {
                      if ((el as any).worldTarget) {
                        this.animationScheduler.enqueue({
                          targets: el.position,
                          x: (el as any).worldTarget.x,
                          y: (el as any).worldTarget.y,
                          z: (el as any).worldTarget.z,
                          duration: 500,
                          easing: 'easeOutCubic',
                        });
                      }
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Deleted node ${deletedLabel}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DELETE',
                    message: `Node "${deletedLabel}" removed from tree.\nTree restructured.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitSequential();
            } else {
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DELETE',
                    message: `Node "${deletedLabel}" not found in tree.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (actionName === 'SEARCH') {
            // Tree search: SEARCH <nodeId>
            const searchTarget = gen.args[0];
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              // Build adjacency map for BFS search
              const searchChildren: Map<string, string[]> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!searchChildren.has(e.sourceId)) searchChildren.set(e.sourceId, []);
                  searchChildren.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                }
              });
              const searchRoot = treeNodes.find((n: any) => !hasParent.has(n.id))?.id || treeNodes[0]?.id;
              const labelMapSearch = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
              const targetLabel = labelMapSearch.get(searchTarget) || searchTarget;

              // Emit search start log
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'SEARCH',
                    message: `Searching for node "${targetLabel}"...`,
                    kind: 'search',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // BFS traversal to find the node, animating + logging each visited node
              const searchVisited: string[] = [];
              let found = false;
              const bfsQueue = searchRoot ? [searchRoot] : [];
              const visited = new Set<string>();
              const SEARCH_GLOW = '#4ade80';
              const SEARCH_NOT_FOUND = '#f87171';

              while (bfsQueue.length > 0) {
                const curId = bfsQueue.shift()!;
                if (visited.has(curId)) continue;
                visited.add(curId);
                const curLabel = labelMapSearch.get(curId) || curId;
                searchVisited.push(curLabel);
                const isTarget = curId === searchTarget || curLabel === targetLabel;
                found = found || isTarget;

                const realEl = this.sceneManager.getElement(curId) as any;
                if (realEl) {
                  const color = isTarget ? '#22c55e' : SEARCH_GLOW;
                  const origColor = realEl.color || '#4facfe';
                  const visitedSnapshot = [...searchVisited];

                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color,
                    emissiveColor: color,
                    emissiveIntensity: isTarget ? 1.0 : 0.6,
                    duration: 250,
                    easing: 'easeOutExpo',
                    complete: () => {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'VISITING',
                        message: `Visited:\n${visitedSnapshot.join(' → ')}`,
                        kind: 'search',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.2, y: 1.2, z: 1.2,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(400);

                  if (!isTarget) {
                    this.animationScheduler.enqueue({
                      targets: realEl,
                      color: origColor,
                      emissiveIntensity: 0,
                      duration: 200,
                    });
                    this.animationScheduler.enqueue({
                      targets: realEl.scale,
                      x: 1, y: 1, z: 1,
                      duration: 200,
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                }

                if (isTarget) break;
                (searchChildren.get(curId) || []).forEach(c => bfsQueue.push(c));
              }

              // Final result log
              const visitedPath = searchVisited.join(' → ');
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'RESULT',
                    message: found
                      ? `Visited:\n${visitedPath}\n\nResult:\nNode "${targetLabel}" found.`
                      : `Visited:\n${visitedPath}\n\nResult:\nNode "${targetLabel}" not found.`,
                    kind: 'search',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(300);
            }
          }
          break;
        }

        case 'LINK_OBJECTS':
          this.primitives.link(this.algorithmContext(), instruction as LinkObjectsInstruction);
          break;

        case 'SET_STATE':
          console.warn(`[AnimationController] ${instruction.action} is not fully ported to sequential testing yet.`);
          break;
          
        case 'UPDATE_LAYOUT': {
          this.layoutManager.updateLayout();
          break;
        }

        case 'WAIT': {
          this.animationScheduler.advanceCursor(500);
          break;
        }
      }

      this.animationScheduler.play();
    });
  }
}


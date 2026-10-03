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
import { AlgorithmRegistry, AlgorithmContext, AlgorithmHandler, BinaryTreeEngine, BSTEngine, SortEngine, GraphEngine, HeapEngine, HashMapEngine, TrieEngine, ArrayEngine, StackEngine, QueueEngine, LinkedListEngine } from './algorithms';

// Every structure's built-in statements go to its engine (see docs/design/algorithm-engine-pattern.md).
// TREE_NODE tree algorithms (MIRROR, the views, the aggregates); the tree statements whose names other
// structures share (SEARCH, SIZE, INORDER, ...) reach the same engine through GENERIC_ACTION routing.
const _binaryTreeEngine = new BinaryTreeEngine();
AlgorithmRegistry.register(BinaryTreeEngine.ALGORITHMS, _binaryTreeEngine);
// BST_* statements; the shared ones (INSERT, SEARCH, ...) reach BSTEngine when they target a BST.
const _bstEngine = new BSTEngine();
AlgorithmRegistry.register(BSTEngine.ALGORITHMS, _bstEngine);
AlgorithmRegistry.register(SortEngine.ALGORITHMS, new SortEngine());
AlgorithmRegistry.register(GraphEngine.ALGORITHMS, new GraphEngine());
AlgorithmRegistry.register(HeapEngine.ALGORITHMS, new HeapEngine());
AlgorithmRegistry.register(HashMapEngine.ALGORITHMS, new HashMapEngine());
AlgorithmRegistry.register(TrieEngine.ALGORITHMS, new TrieEngine());
// Stacks / queues of STACK_ELEMENT / QUEUE_ELEMENT objects. Compiled STACK / QUEUE declarations are
// TreeEngine containers, routed before the registry is consulted.
AlgorithmRegistry.register(StackEngine.ALGORITHMS, new StackEngine());
AlgorithmRegistry.register(QueueEngine.ALGORITHMS, new QueueEngine());

// Instruction-level tracing is off by default since it runs on every instruction and
// JSON.stringify's the payload; opt in with window.__AQVL_DEBUG_ANIMATION__ = true
// (or globalThis.__AQVL_DEBUG_ANIMATION__ in non-browser environments) when diagnosing an issue.
const DEBUG_ANIMATION: boolean =
  typeof globalThis !== 'undefined' && !!(globalThis as any).__AQVL_DEBUG_ANIMATION__;

import type { LinkedListContext } from './algorithms/LinkedListProgramEngine';
import { LinkedListProgramEngine } from './algorithms/LinkedListProgramEngine';
import { PrimitiveAnimator } from './algorithms/PrimitiveAnimator';
import { ArrayIndexOutOfRangeError } from './algorithms/ArrayEngine';
import { formatPrintValue } from './algorithms/formatValue';
import { TreeEngine, type TreeContext } from './algorithms/TreeEngine';
import { HeapProgramEngine } from './algorithms/HeapProgramEngine';
import { HashMapProgramEngine } from './algorithms/HashMapProgramEngine';
import { TrieProgramEngine } from './algorithms/TrieProgramEngine';
import { GraphProgramEngine } from './algorithms/GraphProgramEngine';
import { AQVLVirtualMachine, type StepCallback } from '../VirtualMachine';
import type { VMInstruction, FunctionTable, ExecutionResult } from '../types';


export { ArrayIndexOutOfRangeError };

export class AnimationController {
  private defaultColor = getSemanticColorToken('NEUTRAL').color;
  private activeTreeName: string | null = null;
  /** Tracks whether the current active tree is a BST (so INSERT/DELETE/SEARCH/CLEAR route to BSTEngine) */
  private activeTreeIsBST: boolean = false;
  /** Shared BSTEngine instance used for dispatch-based BST routing */
  private bstEngine: BSTEngine = _bstEngine;
  /** Trees of TREE_NODE objects: TREE / ROOT / CHILD, traversals, measures, ... (see BinaryTreeEngine.ts) */
  private binaryTreeEngine: BinaryTreeEngine = _binaryTreeEngine;
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
    // algorithm handlers (e.g. SortEngine) as generic AQIR_INSTRUCTION events, deferred to
    // land in sync with the animation beat they describe (see SortEngine.dispatchInstruction).
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
   * Keeps activeTreeName / activeTreeIsBST in sync with the scene's tree
   * anchor (see BSTEngine.detectActiveTree). Called at the start of every
   * instruction so context is set even before any explicit TREE/BST
   * sequence action (e.g. a BST declared in the DECLARE block whose
   * operations start immediately). Once set it is kept.
   */
  private autoDetectActiveTree(): void {
    if (this.activeTreeName) return;
    const detected = BSTEngine.detectActiveTree(this.sceneManager);
    if (detected) {
      this.activeTreeName = detected.name;
      this.activeTreeIsBST = detected.isBST;
    }
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
      activeTreeIsBST: this.activeTreeIsBST,
      defaultColor: this.defaultColor,
    };
  }

  /** Runs a registered-style engine on `gen`; a TREE / BST statement may change which tree is active, so that is read back. */
  private runEngine(engine: AlgorithmHandler, gen: GenericActionInstruction): void {
    const context = this.algorithmContext();
    engine.execute(context, gen);
    this.activeTreeName = context.activeTreeName ?? null;
    this.activeTreeIsBST = context.activeTreeIsBST ?? false;
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
   * Before an assignment, condition, call or RETURN runs, animates each read
   * it will make that is a step of its own (a hash-map lookup, a trie check:
   * see the engines' `readStep`), in the order the VM evaluates them — the
   * right side of AND / OR only when it will be evaluated. A read that
   * cannot be worked out here (a missing key inside another key) is left for
   * the real evaluation to report.
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
    const evaluate = (expr: unknown) => vm.evaluateExpression(expr);
    const reads: any[] = [];
    const add = (read: Record<string, unknown> | null) => {
      if (read) reads.push(read);
    };
    const walk = (expr: any): void => {
      if (expr === null || typeof expr !== 'object') return;
      if ('gfn' in expr) {
        (expr.args ?? []).forEach(walk);
        if (maps) add(this.hashMapEngine.readStep(ctx, expr, evaluate));
        if (tries) add(this.trieEngine.readStep(expr, evaluate));
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
        if (tries) add(this.trieEngine.readStep(expr, evaluate));
      }
    };
    try {
      operands.forEach(walk);
    } catch {
      // The instruction's own evaluation reports this error.
    }
    for (const read of reads) {
      this.currentVM = vm;
      await this.executeInstruction(read as any);
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

      const evaluate = (expr: unknown) => (this.currentVM ? this.currentVM.evaluateExpression(expr) : expr);
      if (this.heapEngine.executeStatement(this.llContext(), instruction, (id) => this.resolveArraySlot(id), evaluate)) {
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
        case 'CONTAINER_READ':
          this.treeEngine.containerRead(this.treeContext(), instruction as any);
          break;

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
          const target = (gen as any).payload?.logicalParent;

          // Pointer trees and the queues / stacks they draw.
          if (this.treeEngine.dispatch(this.treeContext(), gen, (operand) => this.describeOperand(operand))) break;

          // Built-in operations on a linked list.
          if (target && this.linkedListProgram.isList(this.llContext(), target)) {
            this.linkedListEngine.execute(this.llContext(), gen);
            break;
          }

          // Registered engines; a statement naming its structure makes it the active tree.
          const handler = AlgorithmRegistry.getHandler(actionName);
          if (handler) {
            if (target) this.activeTreeName = target;
            this.runEngine(handler, gen);
            break;
          }

          // Statements shared with other structures, aimed at a BST.
          if (BSTEngine.SHARED_ACTIONS.includes(actionName) && BSTEngine.isBSTTarget(this.sceneManager, target, this.activeTreeIsBST)) {
            if (target) this.activeTreeName = target;
            this.runEngine(this.bstEngine, gen);
            break;
          }

          const ctx = this.algorithmContext();
          if (this.arrayEngine.targetsSlot(ctx, gen)) {
            this.arrayEngine.execute(ctx, gen);
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
          } else if (this.binaryTreeEngine.handles(actionName)) {
            this.runEngine(this.binaryTreeEngine, gen);
          }
          // Anything else (e.g. a bare INSERT that addresses no array slot) has nothing to animate.
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


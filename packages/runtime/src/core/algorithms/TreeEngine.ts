/**
 * TreeEngine — the runtime model and animations for AQVL binary trees
 * (`BINARY_TREE` and `BST` declarations).
 *
 * A tree lives entirely in the scene graph, so stepping back (which restores
 * scene snapshots) restores it exactly:
 *
 * - an anchor element `bt:<tree>` (not drawn) holding `rootId` and `kind`
 *   ('BINARY' | 'BST');
 * - one sphere per node, id `bt:<tree>:<n>` — a pointer value held in a VM
 *   variable is simply this id, and NULL is `null`;
 * - one edge per non-NULL child pointer, id `<node>>left` / `<node>>right`
 *   (labelled 'L' / 'R').
 *
 * Programs work on trees the way C code does — `curr = curr.left`,
 * `parent.right = n`, `n = NEW_NODE(t, 5)`, `FREE temp`, recursive
 * FUNCTIONs — and every pointer move, pointer write, allocation, free, call
 * and return is its own animated step with a console line (see
 * AnimationController, which routes them here). The classic operations
 * (INSERT, SEARCH, DELETE, traversals, HEIGHT, MIN, MAX, MIRROR, ROTATE, ...)
 * are kept as one-line shortcuts, but they too walk the tree node by node and
 * relink real pointers on screen.
 *
 * Heap memory: a node that is not part of the tree — freshly allocated, or
 * unlinked by a pointer write that cuts it out — moves to the tree's
 * heap-memory row below the tree and only disappears when FREE releases it.
 * A node that nothing points to any more is flagged LEAKED.
 *
 * QUEUEs and STACKs are animated here too. They hold values, or — in a
 * program that declares a tree — node pointers (`ENQUEUE q t.root`,
 * `node = DEQUEUE(q)`), drawn as labelled rows of boxes under the tree
 * (without a tree: queues as rows, stacks as vertical columns).
 */
import { AlgorithmContext } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken, RuntimeError } from '@aqvl/shared';

/** A tree misuse at run time: NULL dereference, use after free, empty queue, ... */
export class TreeError extends RuntimeError {
  constructor(message: string) {
    super(message);
    this.name = 'TreeError';
  }
}

/** What the engine needs from the program executing it (the VM, via AnimationController). */
export interface TreeHost {
  /** Evaluates a compiled expression operand to a value. */
  evaluate(expr: unknown): unknown;
  setVariable(name: string, value: unknown): void;
  /** User variables currently in scope — pointer variables become node tags. */
  visibleVariables(): Record<string, unknown>;
  /** Active user-function calls, outermost first. */
  callStack(): { functionName: string; locals: Record<string, unknown> }[];
}

export interface TreeContext extends AlgorithmContext {
  host: TreeHost;
}

type Side = 'left' | 'right';
type LogKind = 'traversal' | 'relationship' | 'operation' | 'info' | 'result' | 'step' | 'compare' | 'search';

interface LogEntry {
  keyword: string;
  message: string;
  kind: LogKind;
}

interface FrameOptions {
  logs?: LogEntry[];
  /** element id -> semantic state to highlight it with during this frame. */
  nodes?: Record<string, string>;
  /** edge id -> semantic state to highlight it with during this frame. */
  edges?: Record<string, string>;
  /** Newly created nodes / container items: placed at their slot, then scaled up from 0. */
  grow?: string[];
  /** Internal pointers of a built-in operation (e.g. `curr` while INSERT walks), shown as node tags. */
  temp?: Record<string, string | null>;
  /** Nodes a pointer write just cut out of the tree — they move to heap memory. */
  bypassed?: string[];
  duration?: number;
}

const EDGE_COLOR = '#cbd5e1';
const LEAK_COLOR = '#ef4444';
const TRANSIENT_STATES = new Set(['EVALUATING', 'TRAVERSING', 'MODIFYING', 'ACTIVE']);
const STEP_MS = 480;
const MOVE_MS = 520;
const LABEL: Record<Side, string> = { left: 'L', right: 'R' };

/** One-line operations available on a pointer tree (`INSERT t 65`, or `INSERT 65` when the program has one tree). */
const BUILTINS = new Set([
  'INSERT', 'SEARCH', 'FIND', 'DELETE', 'REMOVE',
  'INORDER', 'PREORDER', 'POSTORDER', 'LEVELORDER', 'BFS', 'DFS',
  'HEIGHT', 'MAX_DEPTH', 'SIZE', 'COUNT_NODES', 'LEAVES', 'COUNT_LEAVES',
  'MIN', 'MAX', 'MIN_VALUE', 'MAX_VALUE', 'MIRROR', 'INVERT', 'ROTATE', 'CLEAR', 'IS_EMPTY', 'ROOT',
]);

export class TreeEngine {
  // ---------------------------------------------------------------------
  // Model queries
  // ---------------------------------------------------------------------

  /** True for a tree-node reference (`bt:<tree>:<n>`), whether or not the node still exists. */
  public static isNodeRef(value: unknown): value is string {
    return typeof value === 'string' && /^bt:[^:]+:\d+$/.test(value);
  }

  private anchor(ctx: AlgorithmContext, tree: string): any {
    return ctx.sceneManager.getElement(`bt:${tree}`) as any;
  }

  public isTree(ctx: AlgorithmContext, name: unknown): boolean {
    return typeof name === 'string' && !!this.anchor(ctx, name);
  }

  public hasAnyTree(ctx: AlgorithmContext): boolean {
    return ctx.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'BINARYTREE');
  }

  /** Whether the program has a queue / stack drawn by this engine (every STACK is; see the compiler). */
  public hasAnyContainer(ctx: AlgorithmContext): boolean {
    return ctx.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'CONTAINER');
  }

  private treeNames(ctx: AlgorithmContext): string[] {
    return (ctx.sceneManager.getSceneGraph() as any[]).filter((el) => el.originalType === 'BINARYTREE').map((el) => el.logicalParent);
  }

  private requireTree(ctx: AlgorithmContext, tree: string): any {
    const a = this.anchor(ctx, tree);
    if (!a) throw new TreeError(`'${tree}' is not a tree.`);
    return a;
  }

  /** True when `value` belongs to a tree: a tree name or a (possibly freed) tree-node reference. */
  public owns(ctx: AlgorithmContext, value: unknown): boolean {
    return TreeEngine.isNodeRef(value) || this.isTree(ctx, value);
  }

  private node(ctx: AlgorithmContext, id: unknown): any {
    return TreeEngine.isNodeRef(id) ? (ctx.sceneManager.getElement(id) as any) : undefined;
  }

  private child(ctx: AlgorithmContext, id: string | null, side: Side): string | null {
    if (!id) return null;
    const edge = ctx.sceneManager.getElement(`${id}>${side}`) as any;
    return edge ? edge.targetId : null;
  }

  private val(ctx: AlgorithmContext, id: string | null): unknown {
    return this.node(ctx, id)?.value;
  }

  private nodesOf(ctx: AlgorithmContext, tree?: string): any[] {
    return (ctx.sceneManager.getSceneGraph() as any[]).filter(
      (el) => el.originalType === 'TREE_NODE' && TreeEngine.isNodeRef(el.id) && (tree === undefined || el.logicalParent === tree)
    );
  }

  /** Nodes reachable from the root (preorder), their depths, and whether they form a proper tree (no node reached twice). */
  private scan(ctx: AlgorithmContext, tree: string): { order: string[]; depth: Map<string, number>; proper: boolean } {
    const order: string[] = [];
    const depth = new Map<string, number>();
    let proper = true;
    const visit = (id: string | null, d: number) => {
      if (!id || !ctx.sceneManager.getElement(id)) return;
      if (depth.has(id)) {
        proper = false;
        return;
      }
      depth.set(id, d);
      order.push(id);
      visit(this.child(ctx, id, 'left'), d + 1);
      visit(this.child(ctx, id, 'right'), d + 1);
    };
    visit(this.anchor(ctx, tree)?.rootId ?? null, 0);
    return { order, depth, proper };
  }

  private inorderIds(ctx: AlgorithmContext, root: string | null): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string | null) => {
      if (!id || seen.has(id) || !ctx.sceneManager.getElement(id)) return;
      seen.add(id);
      visit(this.child(ctx, id, 'left'));
      out.push(id);
      visit(this.child(ctx, id, 'right'));
    };
    visit(root);
    return out;
  }

  public size(ctx: AlgorithmContext, tree: string): number {
    this.requireTree(ctx, tree);
    return this.scan(ctx, tree).order.length;
  }

  /** `Level 0: 50 | Level 1: 30 70 | Level 2: 20 40 60 80`. */
  public format(ctx: AlgorithmContext, tree: string): string {
    const { order, depth } = this.scan(ctx, tree);
    if (order.length === 0) return 'NULL (empty tree)';
    const levels: string[][] = [];
    // Breadth-first order within each level: a level-order walk.
    const queue: string[] = [order[0]];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const d = depth.get(id) ?? 0;
      (levels[d] ??= []).push(String(this.val(ctx, id)));
      for (const side of ['left', 'right'] as Side[]) {
        const c = this.child(ctx, id, side);
        if (c && ctx.sceneManager.getElement(c)) queue.push(c);
      }
    }
    return levels.map((vals, d) => `Level ${d}: ${vals.join(' ')}`).join(' | ');
  }

  /** How a pointer value reads in messages: `node 20`, `NULL`, or a freed node. */
  public describeRef(ctx: AlgorithmContext, ref: unknown): string {
    if (ref === null || ref === undefined) return 'NULL';
    if (TreeEngine.isNodeRef(ref)) {
      const el = this.node(ctx, ref);
      return el ? `node ${el.value}` : 'a freed node';
    }
    return String(ref);
  }

  /** Short form for call arguments / the call stack: `50`, `NULL`, `freed`, or the value itself. */
  private shortValue(ctx: AlgorithmContext, v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (TreeEngine.isNodeRef(v)) {
      const el = this.node(ctx, v);
      return el ? String(el.value) : 'freed';
    }
    if (typeof v === 'string') return `"${v}"`;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }

  /** Value formatting for PRINT: a node prints as `Node(20)`, NULL as `NULL`. */
  public formatValue(ctx: AlgorithmContext, value: unknown): string | null {
    if (value === null) return 'NULL';
    if (TreeEngine.isNodeRef(value)) {
      const el = this.node(ctx, value);
      return el ? `Node(${el.value})` : 'Node(freed)';
    }
    return null;
  }

  private static exprText(expr: unknown): string {
    if (typeof expr === 'string') return expr;
    if (expr && typeof expr === 'object' && 'member' in (expr as any)) {
      return `${TreeEngine.exprText((expr as any).object)}.${(expr as any).member}`;
    }
    if (expr === null) return 'NULL';
    return 'the value';
  }

  /** Throws a descriptive error unless `ref` is a live node. `what` names the operand (e.g. `curr`). */
  private requireNode(ctx: AlgorithmContext, ref: unknown, what: string): any {
    if (ref === null || ref === undefined) {
      throw new TreeError(`NULL pointer dereference: ${what} is NULL.`);
    }
    if (!TreeEngine.isNodeRef(ref)) {
      throw new TreeError(`${what} is not a tree node (its value is ${JSON.stringify(ref)}).`);
    }
    const el = this.node(ctx, ref);
    if (!el) throw new TreeError(`Use after free: ${what} points to a node whose memory was already freed.`);
    return el;
  }

  /** A pointer target must be a live node or NULL. */
  private requirePointerTarget(ctx: AlgorithmContext, value: unknown, what: string): string | null {
    if (value === null || value === undefined) return null;
    this.requireNode(ctx, value, what);
    return value as string;
  }

  /** `object.member` for a tree (`root`, `size`) or a node (`left`, `right`, `val`). */
  public readMember(ctx: AlgorithmContext, object: unknown, member: string, objectExpr: unknown): unknown {
    const what = TreeEngine.exprText(objectExpr);
    if (this.isTree(ctx, object)) {
      const tree = object as string;
      if (member === 'root') return this.anchor(ctx, tree).rootId ?? null;
      if (member === 'size' || member === 'length') return this.scan(ctx, tree).order.length;
      throw new TreeError(`A tree has no field '${member}' (use ${tree}.root, or LENGTH(${tree}) for the number of nodes).`);
    }
    if (object === null || object === undefined) {
      throw new TreeError(`NULL pointer dereference: cannot read ${what}.${member} because ${what} is NULL.`);
    }
    const el = this.requireNode(ctx, object, what);
    if (member === 'left' || member === 'right') return this.child(ctx, el.id, member);
    if (member === 'val' || member === 'value' || member === 'data' || member === 'key') return el.value;
    if (member === 'parent') {
      throw new TreeError(
        `${what}.parent does not exist: these tree nodes have only left and right pointers. Remember the parent in a variable as you walk down (parent = curr before curr = curr.left).`
      );
    }
    throw new TreeError(`A tree node has no field '${member}' (its fields are val, left, right).`);
  }

  // ---------------------------------------------------------------------
  // Scene mutation primitives
  // ---------------------------------------------------------------------

  private setChild(ctx: AlgorithmContext, sourceId: string, side: Side, targetId: string | null): void {
    const edgeId = `${sourceId}>${side}`;
    if (ctx.sceneManager.getElement(edgeId)) {
      ctx.sceneManager.removeElement(edgeId);
      ctx.relationshipManager?.removeRelationship(edgeId);
    }
    if (!targetId) return;
    const source = this.node(ctx, sourceId);
    ctx.sceneManager.addElement({
      id: edgeId,
      type: 'edge',
      originalType: 'EDGE',
      pointer: side,
      properties: { label: LABEL[side], pointer: side },
      sourceId,
      targetId,
      directed: true,
      logicalParent: source?.logicalParent,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: EDGE_COLOR,
      emissiveColor: EDGE_COLOR,
      emissiveIntensity: 0,
      state: 'NEUTRAL',
      visible: true,
      opacity: 1,
    } as any);
    ctx.relationshipManager?.addRelationship({ id: edgeId, sourceId, targetId, type: 'edge', directed: true });
  }

  /** Allocates an unlinked node in `tree`'s heap memory. */
  private createNode(ctx: AlgorithmContext, tree: string, value: unknown): string {
    const a = this.requireTree(ctx, tree);
    let id = `bt:${tree}:${a.nextNodeNumber ?? 0}`;
    while (ctx.sceneManager.getElement(id)) {
      a.nextNodeNumber = (a.nextNodeNumber ?? 0) + 1;
      id = `bt:${tree}:${a.nextNodeNumber}`;
    }
    a.nextNodeNumber = (a.nextNodeNumber ?? 0) + 1;
    a.heapCounter = (a.heapCounter ?? 0) + 1;
    const token = getSemanticColorToken('AUXILIARY');
    ctx.sceneManager.addElement({
      id,
      type: 'sphere',
      originalType: 'TREE_NODE',
      logicalParent: tree,
      value,
      label: '',
      inTree: false,
      inHeap: true,
      heapOrder: a.heapCounter,
      tags: [],
      position: { x: 0, y: -3, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: token.color,
      emissiveColor: token.emissiveColor,
      emissiveIntensity: token.emissiveIntensity,
      state: 'NEUTRAL',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
    return id;
  }

  // ---------------------------------------------------------------------
  // Derived state (tree vs heap membership, layout coordinates, tags, colors)
  // ---------------------------------------------------------------------

  /**
   * Recomputes, for every tree: which nodes are in the tree vs the heap area,
   * each tree node's layout coordinates (column, depth), each node's tags
   * (ROOT, pointer variables, LEAKED), the call-stack panel, container tags.
   */
  private refresh(ctx: TreeContext, temp: Record<string, string | null> = {}, bypassed: string[] = []): void {
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    const names = new Map<string, string[]>();
    const addName = (id: unknown, name: string) => {
      if (!TreeEngine.isNodeRef(id)) return;
      if (!names.has(id)) names.set(id, []);
      if (!names.get(id)!.includes(name)) names.get(id)!.push(name);
    };
    // A temp pointer of this frame shadows a program variable of the same name.
    for (const [name, value] of Object.entries(ctx.host.visibleVariables())) if (!(name in temp)) addName(value, name);
    for (const [name, value] of Object.entries(temp)) addName(value, name);

    // Nodes held by the arguments of calls that are waiting for a deeper call to return.
    const stack = ctx.host.callStack();
    const onStack = new Set<string>();
    for (const frame of stack.slice(0, -1)) {
      for (const v of Object.values(frame.locals)) if (TreeEngine.isNodeRef(v)) onStack.add(v);
    }

    const edges = graph.filter((el) => el.type === 'edge' && (el.pointer === 'left' || el.pointer === 'right'));
    const inTree = (id: string) => this.node(ctx, id)?.inTree !== false;
    const referencedByEdge = (id: string, fromTreeOnly: boolean) =>
      edges.some((e) => e.targetId === id && e.sourceId !== id && (!fromTreeOnly || inTree(e.sourceId)));

    for (const anchor of graph.filter((el) => el.originalType === 'BINARYTREE')) {
      const tree = anchor.logicalParent;
      if (anchor.rootId && !ctx.sceneManager.getElement(anchor.rootId)) anchor.rootId = null;
      const { order, depth, proper } = this.scan(ctx, tree);
      const reach = new Set(order);
      const treeNodes = this.nodesOf(ctx, tree);

      for (const n of treeNodes) {
        if (reach.has(n.id)) {
          n.inTree = true;
        } else if (n.inTree !== false) {
          // Cut out of the tree: to heap memory, unless a pointer variable
          // still holds it (e.g. `temp` while two subtrees are swapped).
          const named = (names.get(n.id) ?? []).length > 0;
          if (bypassed.includes(n.id) || (!named && !referencedByEdge(n.id, true))) {
            n.inTree = false;
            anchor.heapCounter = (anchor.heapCounter ?? 0) + 1;
            n.heapOrder = anchor.heapCounter;
          }
        }
      }

      const detached = treeNodes.filter((n) => n.inTree !== false && !reach.has(n.id));
      if (proper && detached.length === 0) {
        // A proper tree: columns by inorder position (left subtree to the
        // left, right subtree to the right, never overlapping), rows by depth.
        const inorder = this.inorderIds(ctx, anchor.rootId ?? null);
        const center = (inorder.length - 1) / 2;
        inorder.forEach((id, i) => {
          const el = this.node(ctx, id);
          el.layoutX = i - center;
          el.layoutDepth = depth.get(id) ?? 0;
        });
      } else {
        // Mid-restructure (a subtree held in a variable, or two pointers to
        // one node): keep every node where it is; a node that just joined
        // is placed under its parent.
        for (const id of order) {
          const el = this.node(ctx, id);
          if (el.layoutX !== undefined && el.layoutDepth !== undefined && el.wasInTree) continue;
          const parentEdge = edges.find((e) => e.targetId === id && reach.has(e.sourceId));
          const parent = parentEdge ? this.node(ctx, parentEdge.sourceId) : null;
          if (parent && parent.layoutX !== undefined) {
            el.layoutX = parent.layoutX + (parentEdge.pointer === 'left' ? -0.5 : 0.5);
            el.layoutDepth = (parent.layoutDepth ?? 0) + 1;
          } else {
            el.layoutX = el.layoutX ?? 0;
            el.layoutDepth = depth.get(id) ?? 0;
          }
        }
      }

      for (const n of treeNodes) {
        n.wasInTree = n.inTree !== false;
        const tags: string[] = [];
        if (n.id === anchor.rootId) tags.push('ROOT');
        tags.push(...(names.get(n.id) ?? []));
        const leaked = n.inTree === false && (names.get(n.id) ?? []).length === 0 && !referencedByEdge(n.id, false);
        if (leaked) tags.push('LEAKED');
        n.tags = tags;
        n.leaked = leaked;
        n.inHeap = n.inTree === false;
        n.onCallStack = onStack.has(n.id);
        // Tags go above the root (nothing points down into it) and below every other node.
        n.tagPlacement = n.id === anchor.rootId ? 'above' : 'below';
      }

      anchor.callStack = stack.map(
        (f) => `${f.functionName}(${Object.values(f.locals).length ? this.frameArgs(ctx, f) : ''})`
      );
    }

    // Containers: FRONT / REAR / TOP tags, and node values kept current.
    for (const c of graph.filter((el) => el.originalType === 'CONTAINER')) {
      const items = this.itemsOf(ctx, c.logicalParent);
      items.forEach((item, i) => {
        if (TreeEngine.isNodeRef(item.ref)) {
          const n = this.node(ctx, item.ref);
          item.value = n ? n.value : 'freed';
        }
        const tags: string[] = [];
        if (c.kind === 'QUEUE') {
          if (i === 0) tags.push('FRONT');
          if (i === items.length - 1) tags.push('REAR');
        } else if (i === items.length - 1) {
          tags.push('TOP');
        }
        item.tags = tags;
        item.slot = i;
      });
      c.itemCount = items.length;
    }
    this.restoreBaseColors(ctx);
  }

  /** The call's arguments as shown in the call-stack panel (parameters only, when the VM says which). */
  private frameArgs(ctx: AlgorithmContext, frame: { locals: Record<string, unknown> }): string {
    return Object.entries(frame.locals)
      .filter(([k]) => !k.startsWith('__'))
      .slice(0, 3)
      .map(([, v]) => this.shortValue(ctx, v))
      .join(', ');
  }

  /** Computes tags / heap membership / layout for freshly loaded trees and stacks (before any step runs). */
  public initialize(ctx: TreeContext): void {
    if (this.hasAnyTree(ctx) || this.hasAnyContainer(ctx)) this.refresh(ctx);
  }

  /** Resting colors: tree nodes neutral, heap nodes purple, leaked nodes red, nodes waiting on the call stack indigo. */
  public restoreBaseColors(ctx: AlgorithmContext): void {
    for (const n of this.nodesOf(ctx)) {
      if (n.state && n.state !== 'NEUTRAL') continue;
      const token = getSemanticColorToken(n.inTree === false ? 'AUXILIARY' : n.onCallStack ? 'STRUCTURAL' : 'NEUTRAL');
      n.color = n.leaked ? LEAK_COLOR : token.color;
      n.emissiveColor = n.leaked ? LEAK_COLOR : token.emissiveColor;
      n.emissiveIntensity = token.emissiveIntensity;
    }
    for (const e of ctx.sceneManager.getSceneGraph() as any[]) {
      if (e.type === 'edge' && (e.pointer === 'left' || e.pointer === 'right') && (!e.state || e.state === 'NEUTRAL')) {
        e.color = EDGE_COLOR;
        e.emissiveColor = EDGE_COLOR;
      }
      if (e.originalType === 'CONTAINER_ITEM' && (!e.state || e.state === 'NEUTRAL')) {
        const token = getSemanticColorToken('STRUCTURAL');
        e.color = token.color;
        e.emissiveColor = token.emissiveColor;
        e.emissiveIntensity = token.emissiveIntensity;
      }
    }
  }

  /** After a step-back restore: nodes are full size and exactly at their layout positions. */
  public settleAfterRestore(ctx: AlgorithmContext): void {
    if (!this.hasAnyTree(ctx) && !this.hasAnyContainer(ctx)) return;
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const n of graph) {
      if (n.originalType === 'TREE_NODE' && TreeEngine.isNodeRef(n.id)) n.scale = { x: 1, y: 1, z: 1 };
      if (n.originalType === 'CONTAINER_ITEM') n.scale = { x: 1, y: 1, z: 1 };
    }
    ctx.layoutManager.updateLayout(graph);
    for (const el of graph) {
      if (this.isTreeElement(el) && el.worldTarget) el.position = { ...el.worldTarget };
    }
  }

  private isTreeElement(el: any): boolean {
    return (
      (el.originalType === 'TREE_NODE' && TreeEngine.isNodeRef(el.id)) ||
      el.originalType === 'BINARYTREE' ||
      el.originalType === 'CONTAINER' ||
      el.originalType === 'CONTAINER_ITEM'
    );
  }

  // ---------------------------------------------------------------------
  // Frames: one visible beat of an operation
  // ---------------------------------------------------------------------

  private highlight(el: any, state: string): void {
    const token = getSemanticColorToken(state);
    // A lasting mark (e.g. HIGHLIGHT node 'SUCCESS' in the program) is not
    // replaced by a passing highlight such as a call or return touching it.
    if (TRANSIENT_STATES.has(token.name) && el.state && el.state !== 'NEUTRAL' && !TRANSIENT_STATES.has(el.state)) return;
    el.state = token.name;
    el.isHighlighted = true;
    el.highlightType = token.name;
    el.color = token.color;
    el.emissiveColor = token.emissiveColor;
    el.emissiveIntensity = token.emissiveIntensity;
  }

  /** Clears lasting highlights (e.g. the green of a previous traversal) from every tree node. */
  private clearMarks(ctx: TreeContext): void {
    for (const n of this.nodesOf(ctx)) {
      n.state = 'NEUTRAL';
      n.isHighlighted = false;
      n.highlightType = undefined;
    }
  }

  /**
   * Commits one visible beat: recomputes derived state and layout, applies
   * this beat's highlights, captures the scene as it looks now, and
   * schedules it to be shown (with its console lines) followed by the
   * nodes gliding to their new positions.
   */
  private frame(ctx: TreeContext, o: FrameOptions = {}): void {
    this.refresh(ctx, o.temp, o.bypassed);
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    ctx.layoutManager.updateLayout(graph);

    for (const el of graph) {
      const own = this.isTreeElement(el) || (el.type === 'edge' && (el.pointer === 'left' || el.pointer === 'right'));
      if (own && TRANSIENT_STATES.has(el.state)) {
        el.state = 'NEUTRAL';
        el.isHighlighted = false;
        el.highlightType = undefined;
      }
    }
    this.restoreBaseColors(ctx);
    for (const [id, state] of Object.entries(o.nodes ?? {})) {
      const el = ctx.sceneManager.getElement(id);
      if (el) this.highlight(el, state);
    }
    for (const [id, state] of Object.entries(o.edges ?? {})) {
      const el = ctx.sceneManager.getElement(id);
      if (el) this.highlight(el, state);
    }
    for (const id of o.grow ?? []) {
      const el = ctx.sceneManager.getElement(id) as any;
      if (el?.worldTarget) Object.assign(el.position, el.worldTarget);
    }

    const snapshot = ctx.stateManager?.captureSnapshot(graph, 'Tree', ctx.scheduler.getCurrentTime());
    const logs = o.logs ?? [];
    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        if (snapshot) ctx.eventDispatcher.dispatch('STATE_UPDATED', snapshot);
        for (const log of logs) {
          ctx.eventDispatcher.dispatch('RUNTIME_LOG', { ...log, timestamp: Date.now() });
        }
      },
    });
    ctx.scheduler.commitSequential();

    const duration = o.duration ?? STEP_MS;
    let moved = false;
    for (const el of graph) {
      if (!this.isTreeElement(el)) continue;
      const t = el.worldTarget;
      if (!t) continue;
      if (Math.abs(t.x - el.position.x) + Math.abs(t.y - el.position.y) + Math.abs(t.z - el.position.z) < 1e-3) continue;
      ctx.scheduler.enqueue({ targets: el.position, x: t.x, y: t.y, z: t.z, duration, easing: 'easeInOutCubic' });
      moved = true;
    }
    for (const id of o.grow ?? []) {
      const el = ctx.sceneManager.getElement(id) as any;
      if (!el) continue;
      ctx.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration, easing: 'easeOutBack' });
      moved = true;
    }
    if (moved) ctx.scheduler.commitGroup(true);
    else ctx.scheduler.advanceCursor(duration);
  }

  /** A frame for a step with nothing to animate but a console line (and optional highlights). */
  private note(ctx: TreeContext, keyword: string, message: string, kind: LogKind, extra: FrameOptions = {}): void {
    this.frame(ctx, { ...extra, logs: [...(extra.logs ?? []), { keyword, message, kind }] });
  }

  /** Releases a node: highlight, shrink, remove it and every pointer from/to it. */
  private freeNode(ctx: TreeContext, id: string, label: string, temp: Record<string, string | null> = {}, warn = true): void {
    const el = this.node(ctx, id);
    const value = el.value;
    const tree = el.logicalParent;
    const stillLinked = warn && el.inTree !== false && this.scan(ctx, tree).order.includes(id);
    const logs: LogEntry[] = [{ keyword: 'FREE', message: `FREE ${label}: releasing the memory of node ${value}.`, kind: 'operation' }];
    if (stillLinked) {
      logs.push({
        keyword: 'WARNING',
        message: `Node ${value} is still linked into '${tree}' — freeing it leaves a dangling pointer. Unlink it first (e.g. parent.left = NULL).`,
        kind: 'result',
      });
    }
    const orphans = (['left', 'right'] as Side[]).map((s) => this.child(ctx, id, s)).filter((c): c is string => !!c);
    this.frame(ctx, { nodes: { [id]: 'MODIFYING' }, logs, temp });

    ctx.scheduler.enqueue({ targets: el.scale, x: 0, y: 0, z: 0, duration: 420, easing: 'easeInBack' });
    ctx.scheduler.commitGroup(true);

    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const e of graph.filter((g) => g.type === 'edge' && (g.sourceId === id || g.targetId === id))) {
      ctx.sceneManager.removeElement(e.id);
      ctx.relationshipManager?.removeRelationship(e.id);
    }
    ctx.sceneManager.removeElement(id);
    const anchor = this.anchor(ctx, tree);
    if (anchor && anchor.rootId === id) anchor.rootId = null;

    const cleanTemp: Record<string, string | null> = {};
    for (const [name, v] of Object.entries(temp)) if (v !== id) cleanTemp[name] = v;
    const lost = warn ? orphans.filter((c) => this.node(ctx, c) && !this.scan(ctx, tree).order.includes(c)) : [];
    this.frame(ctx, {
      logs: [
        { keyword: 'RESULT', message: `Memory of node ${value} freed.`, kind: 'result' },
        ...(lost.length > 0
          ? [{
              keyword: 'WARNING',
              message: `Node ${value}'s children (${lost.map((c) => this.val(ctx, c)).join(', ')}) are no longer reachable — free children before their parent (postorder).`,
              kind: 'result' as LogKind,
            }]
          : []),
      ],
      temp: cleanTemp,
      duration: 320,
    });
  }

  // ---------------------------------------------------------------------
  // Program-level operations (pointer code)
  // ---------------------------------------------------------------------

  /** Whether an assignment of `value` (previously `previous`) involves a tree pointer and should be animated. */
  public isPointerAssignment(ctx: AlgorithmContext, value: unknown, previous: unknown): boolean {
    if (!this.hasAnyTree(ctx)) return false;
    return TreeEngine.isNodeRef(value) || TreeEngine.isNodeRef(previous) || value === null;
  }

  /**
   * `curr = curr.left` and friends: move the variable's tag, highlight the
   * node it now points to and every pointer the expression followed.
   */
  public animatePointerMove(ctx: TreeContext, name: string, value: unknown, previous: unknown, sourceText?: string, valueExpr?: unknown): void {
    const nodes: Record<string, string> = {};
    const edges: Record<string, string> = {};
    if (this.node(ctx, value)) nodes[value as string] = 'TRAVERSING';

    const members: string[] = [];
    let base: unknown = valueExpr;
    while (base && typeof base === 'object' && 'member' in (base as any)) {
      members.unshift((base as any).member);
      base = (base as any).object;
    }
    if (members.length > 0 && typeof base === 'string') {
      let i = 0;
      let at: unknown;
      if (this.isTree(ctx, base)) {
        at = members[0] === 'root' ? this.anchor(ctx, base).rootId : null;
        i = 1;
      } else {
        // The variable being assigned already holds its new value; the walk started from the old one.
        at = base === name ? previous : ctx.host.evaluate(base);
      }
      for (; i < members.length; i++) {
        const m = members[i];
        if ((m !== 'left' && m !== 'right') || !this.node(ctx, at)) break;
        edges[`${at}>${m}`] = 'TRAVERSING';
        at = this.child(ctx, at as string, m);
      }
    }

    const where = value === null || value === undefined
      ? `${name} is NULL`
      : this.node(ctx, value) ? `${name} → node ${this.node(ctx, value).value}` : `${name} → freed memory (dangling pointer)`;
    this.frame(ctx, {
      nodes,
      edges,
      duration: MOVE_MS,
      logs: [{ keyword: 'POINTER', message: `${sourceText ?? name}   ⟹   ${where}`, kind: 'traversal' }],
    });
  }

  /** Pointer variables went out of scope: drop their tags (shown immediately). */
  public onScopeExit(ctx: TreeContext): void {
    if (!this.hasAnyTree(ctx)) return;
    const before = this.nodesOf(ctx).map((n) => (n.tags ?? []).join(',')).join('|');
    this.refresh(ctx);
    const after = this.nodesOf(ctx).map((n) => (n.tags ?? []).join(',')).join('|');
    if (before !== after && ctx.stateManager) {
      ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager.captureSnapshot(ctx.sceneManager.getSceneGraph(), 'Scope exit'));
    }
  }

  /**
   * A user function was called / returned. Each is a step: the node passed
   * in lights up, the parameter's tag moves to it, the call-stack panel
   * grows / shrinks, and the console shows the call nested by depth.
   */
  public onCall(ctx: TreeContext, e: { kind: 'call' | 'return'; functionName: string; args?: Record<string, unknown>; value?: unknown; depth: number }): void {
    const args = e.args ?? {};
    const argText = Object.values(args).map((v) => this.shortValue(ctx, v)).join(', ');
    const indent = '│  '.repeat(Math.max(0, e.depth - 1));
    const nodes: Record<string, string> = {};
    for (const v of Object.values(args)) {
      if (this.node(ctx, v)) nodes[v as string] = e.kind === 'call' ? 'TRAVERSING' : 'EVALUATING';
    }
    if (e.kind === 'call') {
      const nullArg = Object.values(args).some((v) => v === null);
      this.frame(ctx, {
        nodes,
        duration: MOVE_MS,
        logs: [{
          keyword: 'CALL',
          message: `${indent}${e.functionName}(${argText})${nullArg && Object.keys(nodes).length === 0 ? '   ← NULL: reached past a leaf' : ''}`,
          kind: 'traversal',
        }],
      });
      return;
    }
    const returned = e.value === undefined ? '' : `   → returns ${this.returnText(ctx, e.value)}`;
    this.frame(ctx, {
      nodes,
      duration: MOVE_MS,
      logs: [{ keyword: 'RETURN', message: `${indent}${e.functionName}(${argText}) done${returned}`, kind: 'step' }],
    });
  }

  private returnText(ctx: AlgorithmContext, v: unknown): string {
    if (v === null) return 'NULL';
    if (TreeEngine.isNodeRef(v)) return this.describeRef(ctx, v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }

  /** `NEW_NODE(tree, value)`: allocate an unlinked node in heap memory. */
  public allocate(ctx: TreeContext, instr: { list: string; value: unknown; resultVar: string; assignTo?: string; sourceText?: string }): void {
    const value = ctx.host.evaluate(instr.value);
    const id = this.createNode(ctx, instr.list, value);
    ctx.host.setVariable(instr.resultVar, id);
    const text = instr.sourceText ?? `NEW_NODE(${instr.list}, ${value})`;
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp: { [instr.assignTo ?? 'new']: id },
      logs: [{ keyword: 'NEW_NODE', message: `${text}   ⟹   node ${value} allocated in heap memory (left = NULL, right = NULL)`, kind: 'info' }],
    });
  }

  /** `FREE ptr`. */
  public free(ctx: TreeContext, instr: { target: unknown; sourceText?: string }): void {
    const label = instr.sourceText ?? TreeEngine.exprText(instr.target);
    const ref = ctx.host.evaluate(instr.target);
    if (ref === null || ref === undefined) {
      this.note(ctx, 'FREE', `FREE ${label}: ${label} is NULL — nothing to free.`, 'info');
      return;
    }
    if (!TreeEngine.isNodeRef(ref)) {
      throw new TreeError(`FREE ${label}: ${label} is not a tree node.`);
    }
    if (!this.node(ctx, ref)) {
      throw new TreeError(`Double free: ${label} points to a node that was already freed.`);
    }
    this.freeNode(ctx, ref, label);
  }

  private isLeaf(ctx: AlgorithmContext, id: string): boolean {
    return !this.child(ctx, id, 'left') && !this.child(ctx, id, 'right');
  }

  /**
   * Whether re-pointing a pointer from `old` to `next` cuts `old` out of the
   * tree for good (a deletion): `parent.left = curr.right` skips over `curr`,
   * `parent.left = NULL` drops a leaf. Such a node moves to heap memory.
   */
  private cutsOut(ctx: AlgorithmContext, old: string | null, next: string | null): boolean {
    if (!old || old === next || !this.node(ctx, old)) return false;
    if (next === null) return this.isLeaf(ctx, old);
    return this.child(ctx, old, 'left') === next || this.child(ctx, old, 'right') === next;
  }

  /** `target.field = value` — a pointer write (`left`, `right`, `root`) or a value write (`val`). */
  public setField(ctx: TreeContext, instr: { target: unknown; field: string; value: unknown; sourceText?: string }): void {
    const what = TreeEngine.exprText(instr.target);
    const text = instr.sourceText ?? `${what}.${instr.field} = …`;
    const target = ctx.host.evaluate(instr.target);
    const value = ctx.host.evaluate(instr.value);
    const field = instr.field;

    if (this.isTree(ctx, target)) {
      const tree = target as string;
      if (field === 'size' || field === 'length') {
        throw new TreeError(`${tree}.${field} cannot be assigned — it is the number of nodes reachable from the root.`);
      }
      if (field !== 'root') throw new TreeError(`A tree has no field '${field}' (its only pointer is ${tree}.root).`);
      const newRoot = this.requirePointerTarget(ctx, value, TreeEngine.exprText(instr.value));
      if (newRoot && this.node(ctx, newRoot).logicalParent !== tree) {
        throw new TreeError(`${text}: that node belongs to tree '${this.node(ctx, newRoot).logicalParent}', not '${tree}'.`);
      }
      const anchor = this.anchor(ctx, tree);
      const oldRoot: string | null = anchor.rootId ?? null;
      anchor.rootId = newRoot;
      this.frame(ctx, {
        nodes: newRoot ? { [newRoot]: 'MODIFYING' } : {},
        bypassed: this.cutsOut(ctx, oldRoot, newRoot) ? [oldRoot!] : [],
        logs: [{ keyword: 'POINTER', message: `${text}   ⟹   ${tree}.root → ${this.describeRef(ctx, newRoot)}`, kind: 'relationship' }],
      });
      return;
    }

    const el = this.requireNode(ctx, target, what);
    if (field === 'left' || field === 'right') {
      const newTarget = this.requirePointerTarget(ctx, value, TreeEngine.exprText(instr.value));
      if (newTarget === el.id) {
        throw new TreeError(`${text}: a node cannot be its own child.`);
      }
      if (newTarget && this.node(ctx, newTarget).logicalParent !== el.logicalParent) {
        throw new TreeError(`${text}: node ${this.val(ctx, newTarget)} belongs to tree '${this.node(ctx, newTarget).logicalParent}', not '${el.logicalParent}'.`);
      }
      const old = this.child(ctx, el.id, field);
      const cut = this.cutsOut(ctx, old, newTarget);
      this.setChild(ctx, el.id, field, newTarget);
      const unchanged = old === newTarget ? ' (unchanged)' : '';
      this.frame(ctx, {
        nodes: { [el.id]: 'EVALUATING', ...(newTarget ? { [newTarget]: 'MODIFYING' } : {}) },
        edges: newTarget ? { [`${el.id}>${field}`]: 'MODIFYING' } : {},
        bypassed: cut ? [old!] : [],
        logs: [{
          keyword: 'POINTER',
          message: `${text}   ⟹   node ${el.value}.${field} → ${this.describeRef(ctx, newTarget)}${unchanged}${cut ? `; node ${this.val(ctx, old)} is unlinked` : ''}`,
          kind: 'relationship',
        }],
      });
      return;
    }
    if (field === 'val' || field === 'value' || field === 'data' || field === 'key') {
      const oldValue = el.value;
      el.value = value;
      this.frame(ctx, {
        nodes: { [el.id]: 'MODIFYING' },
        logs: [{ keyword: 'UPDATE', message: `${text}   ⟹   node value ${oldValue} → ${value}`, kind: 'operation' }],
      });
      return;
    }
    if (field === 'parent') {
      throw new TreeError(`${what}.parent does not exist: these tree nodes have only left and right pointers.`);
    }
    throw new TreeError(`A tree node has no field '${field}' (its fields are val, left, right).`);
  }

  /** `SWAP a b` on two tree nodes exchanges their values. */
  public swapValues(ctx: TreeContext, a: string, b: string): void {
    const ea = this.requireNode(ctx, a, 'the first node');
    const eb = this.requireNode(ctx, b, 'the second node');
    const va = ea.value;
    ea.value = eb.value;
    eb.value = va;
    this.frame(ctx, {
      nodes: { [a]: 'MODIFYING', [b]: 'MODIFYING' },
      logs: [{ keyword: 'SWAP', message: `Swapped the values of two nodes: ${eb.value} ⇄ ${ea.value}`, kind: 'operation' }],
    });
  }

  // ---------------------------------------------------------------------
  // Queues / stacks holding values or node pointers
  // ---------------------------------------------------------------------

  private containerAnchor(ctx: AlgorithmContext, name: unknown): any {
    return typeof name === 'string' ? (ctx.sceneManager.getElement(`ctr:${name}`) as any) : undefined;
  }

  public isContainer(ctx: AlgorithmContext, name: unknown): boolean {
    return !!this.containerAnchor(ctx, name);
  }

  private itemsOf(ctx: AlgorithmContext, name: string): any[] {
    return (ctx.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.originalType === 'CONTAINER_ITEM' && el.logicalParent === name)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  public containerLength(ctx: AlgorithmContext, name: string): number {
    return this.itemsOf(ctx, name).length;
  }

  /** A stored value as the console shows it: numbers as they are, text quoted (`"("`), so it can't be mistaken for the list's own brackets. */
  private static itemText(value: unknown): string {
    return typeof value === 'string' ? `"${value}"` : String(value);
  }

  /** `[50, 30, 70]` — front to rear for a queue, bottom to top for a stack. */
  public formatContainer(ctx: AlgorithmContext, name: string): string {
    return `[${this.itemsOf(ctx, name).map((it) => TreeEngine.itemText(it.value)).join(', ')}]`;
  }

  private containerLabel(ctx: AlgorithmContext, name: string): string {
    const kind = this.containerAnchor(ctx, name)?.kind === 'STACK' ? 'bottom → top' : 'front → rear';
    return `${name} (${kind}): ${this.formatContainer(ctx, name)}`;
  }

  /** `ENQUEUE q x` / `PUSH s x`: a value, or a node pointer (shown as the node's value). */
  public containerAdd(ctx: TreeContext, name: string, op: 'ENQUEUE' | 'PUSH', valueExpr: unknown, sourceText: string): void {
    const c = this.containerAnchor(ctx, name);
    if (op === 'ENQUEUE' && c.kind !== 'QUEUE') throw new TreeError(`${name} is a STACK — use PUSH ${name} value.`);
    if (op === 'PUSH' && c.kind !== 'STACK') throw new TreeError(`${name} is a QUEUE — use ENQUEUE ${name} value.`);
    const value = ctx.host.evaluate(valueExpr);
    if (value === undefined) throw new TreeError(`${sourceText}: nothing to add (the value is undefined).`);
    if (TreeEngine.isNodeRef(value) && !this.node(ctx, value)) {
      throw new TreeError(`Use after free: ${sourceText} adds a pointer to a node that was already freed.`);
    }
    let n = c.nextItemNumber ?? 0;
    while (ctx.sceneManager.getElement(`ctr:${name}:${n}`)) n++;
    c.nextItemNumber = n + 1;
    const last = this.itemsOf(ctx, name).pop();
    const id = `ctr:${name}:${n}`;
    const isRef = TreeEngine.isNodeRef(value);
    const token = getSemanticColorToken('STRUCTURAL');
    ctx.sceneManager.addElement({
      id,
      type: 'box',
      originalType: 'CONTAINER_ITEM',
      logicalParent: name,
      value: isRef ? this.val(ctx, value) : value,
      ref: isRef ? value : null,
      order: (last?.order ?? -1) + 1,
      label: '',
      tags: [],
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: token.color,
      emissiveColor: token.emissiveColor,
      emissiveIntensity: token.emissiveIntensity,
      state: 'NEUTRAL',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
    const where = op === 'ENQUEUE' ? 'joins the rear of' : 'goes on top of';
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING', ...(isRef ? { [value as string]: 'TRAVERSING' } : {}) },
      logs: [{
        keyword: op,
        message: `${sourceText}   ⟹   ${isRef ? `pointer to node ${this.val(ctx, value)}` : TreeEngine.itemText(value)} ${where} ${name}   ${this.containerLabel(ctx, name)}`,
        kind: 'operation',
      }],
    });
  }

  /**
   * `DEQUEUE(q)` / `POP(s)` remove and return the front / top element;
   * `FRONT(q)` / `PEEK(s)` return it without removing, `REAR(q)` returns
   * the last element of a queue (the one enqueued most recently). The result is stored
   * into `resultVar` (the expression's value); a node pointer comes back as
   * the pointer itself.
   */
  public containerTake(
    ctx: TreeContext,
    instr: { op: string; container: string; resultVar?: string; assignTo?: string; sourceText?: string }
  ): void {
    const name = instr.container;
    const c = this.containerAnchor(ctx, name);
    const op = instr.op.toUpperCase();
    const isStack = c.kind === 'STACK';
    if ((op === 'DEQUEUE' || op === 'FRONT' || op === 'REAR') && isStack) throw new TreeError(`${name} is a STACK — use POP(${name}) or PEEK(${name}).`);
    if ((op === 'POP' || op === 'PEEK') && !isStack) throw new TreeError(`${name} is a QUEUE — use DEQUEUE(${name}) or FRONT(${name}).`);
    const items = this.itemsOf(ctx, name);
    const text = instr.sourceText ?? `${op}(${name})`;
    if (items.length === 0) {
      throw new TreeError(
        `${text}: ${name} is empty (${isStack ? 'stack underflow' : 'queue underflow'}). Check IS_EMPTY(${name}) or LENGTH(${name}) > 0 first.`
      );
    }
    const fromEnd = isStack || op === 'REAR';
    const item = fromEnd ? items[items.length - 1] : items[0];
    const result = item.ref ?? item.value;
    if (instr.resultVar) ctx.host.setVariable(instr.resultVar, result);
    const removes = op === 'DEQUEUE' || op === 'POP';
    const refNode = TreeEngine.isNodeRef(item.ref) && this.node(ctx, item.ref) ? item.ref : null;
    const temp: Record<string, string | null> = instr.assignTo && TreeEngine.isNodeRef(result) ? { [instr.assignTo]: result as string } : {};
    const described = refNode ? `pointer to node ${this.val(ctx, refNode)}` : TreeEngine.itemText(item.value);
    const rest = items.filter((it) => it !== item).map((it) => TreeEngine.itemText(it.value));
    const after = removes ? `; ${name} is now [${rest.join(', ')}]` : '';
    this.frame(ctx, {
      nodes: { [item.id]: removes ? 'MODIFYING' : 'EVALUATING', ...(refNode ? { [refNode]: 'TRAVERSING' } : {}) },
      temp,
      logs: [{
        keyword: op,
        message: `${text}   ⟹   ${removes ? 'removed' : 'read'} ${described} from the ${isStack ? 'top' : fromEnd ? 'rear' : 'front'} of ${name}${after}`,
        kind: 'operation',
      }],
    });
    if (!removes) return;
    ctx.scheduler.enqueue({ targets: item.scale, x: 0, y: 0, z: 0, duration: 300, easing: 'easeInBack' });
    ctx.scheduler.commitGroup(true);
    ctx.sceneManager.removeElement(item.id);
    this.frame(ctx, { nodes: refNode ? { [refNode]: 'TRAVERSING' } : {}, temp, duration: 320 });
  }

  /** `SIZE s` / `IS_EMPTY s` as statements: report to the console. */
  public containerReport(ctx: TreeContext, op: 'SIZE' | 'IS_EMPTY', name: string): void {
    const count = this.containerLength(ctx, name);
    const message = op === 'SIZE'
      ? `SIZE ${name}   ⟹   ${count} element${count === 1 ? '' : 's'}   ${this.containerLabel(ctx, name)}`
      : `IS_EMPTY ${name}   ⟹   ${count === 0 ? 'TRUE (it holds nothing)' : `FALSE (it holds ${count})`}`;
    this.frame(ctx, { logs: [{ keyword: op, message, kind: 'info' }] });
  }

  /** `CLEAR s`: every element leaves at once; the container is empty afterwards. */
  public containerClear(ctx: TreeContext, name: string): void {
    const items = this.itemsOf(ctx, name);
    if (items.length > 0) {
      const nodes: Record<string, string> = {};
      for (const it of items) nodes[it.id] = 'MODIFYING';
      this.frame(ctx, { nodes });
      for (const it of items) ctx.scheduler.enqueue({ targets: it.scale, x: 0, y: 0, z: 0, duration: 300, easing: 'easeInBack' });
      ctx.scheduler.commitGroup(true);
      for (const it of items) ctx.sceneManager.removeElement(it.id);
    }
    this.frame(ctx, {
      duration: 320,
      logs: [{ keyword: 'CLEAR', message: `CLEAR ${name}   ⟹   removed ${items.length} element${items.length === 1 ? '' : 's'}; ${name} is now []`, kind: 'operation' }],
    });
  }

  // ---------------------------------------------------------------------
  // Built-in operations (one-line shortcuts that still animate every pointer)
  // ---------------------------------------------------------------------

  /**
   * Which tree a GENERIC_ACTION targets and its remaining operands:
   * `INSERT t 65` names it; a bare `INSERT 65` / `INORDER` means the only
   * tree in the program. Returns null when the action isn't a tree built-in.
   */
  public resolveBuiltin(ctx: AlgorithmContext, gen: GenericActionInstruction): { tree: string; args: unknown[] } | null {
    const action = gen.actionName.toUpperCase();
    if (!BUILTINS.has(action)) return null;
    const args = gen.args ?? [];
    if (typeof args[0] === 'string' && this.isTree(ctx, args[0])) return { tree: args[0], args: args.slice(1) };
    const parent = (gen as any).payload?.logicalParent;
    if (parent && this.isTree(ctx, parent)) return { tree: parent, args: args.slice(1) };
    if (parent) return null; // targets something else (an array slot, a list, ...)
    const trees = this.treeNames(ctx);
    if (trees.length === 1) return { tree: trees[0], args };
    return null;
  }

  /** Runs a tree built-in (see `resolveBuiltin`). */
  public execute(ctx: TreeContext, gen: GenericActionInstruction, tree: string, rawArgs: unknown[]): void {
    const action = gen.actionName.toUpperCase();
    const anchor = this.requireTree(ctx, tree);
    const arg = (i: number) => {
      const v = ctx.host.evaluate(rawArgs[i]);
      return typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
    };
    const needValue = (what: string) => {
      if (rawArgs.length === 0) throw new TreeError(`${action} needs a value, e.g. ${action} ${tree} 42 (${what}).`);
      return arg(0);
    };
    const isBST = anchor.kind === 'BST';
    this.clearMarks(ctx);
    switch (action) {
      case 'INSERT':
        return isBST ? this.bstInsert(ctx, tree, needValue('the key to insert')) : this.levelInsert(ctx, tree, needValue('the value to insert'));
      case 'SEARCH':
      case 'FIND':
        return isBST ? this.bstSearch(ctx, tree, needValue('the key to find')) : this.dfsSearch(ctx, tree, needValue('the value to find'));
      case 'DELETE':
      case 'REMOVE':
        if (!isBST) {
          throw new TreeError(
            `DELETE by value is defined for a BST. For the BINARY_TREE '${tree}', unlink the node with pointer code (parent.left = NULL, then FREE it).`
          );
        }
        return this.bstDelete(ctx, tree, needValue('the key to delete'));
      case 'INORDER':
      case 'PREORDER':
      case 'POSTORDER':
      case 'DFS':
        return this.depthFirst(ctx, tree, action === 'DFS' ? 'PREORDER' : action);
      case 'LEVELORDER':
      case 'BFS':
        return this.levelOrder(ctx, tree);
      case 'HEIGHT':
      case 'MAX_DEPTH':
        return this.height(ctx, tree);
      case 'SIZE':
      case 'COUNT_NODES':
        return this.countNodes(ctx, tree, false);
      case 'LEAVES':
      case 'COUNT_LEAVES':
        return this.countNodes(ctx, tree, true);
      case 'MIN':
      case 'MIN_VALUE':
        return this.extreme(ctx, tree, 'left');
      case 'MAX':
      case 'MAX_VALUE':
        return this.extreme(ctx, tree, 'right');
      case 'MIRROR':
      case 'INVERT':
        return this.mirror(ctx, tree);
      case 'ROTATE':
        return this.rotate(ctx, tree, needValue('the node to rotate at'), String(rawArgs[1] ?? 'LEFT'));
      case 'CLEAR':
        return this.clear(ctx, tree);
      case 'IS_EMPTY':
        this.note(ctx, 'RESULT', `IS_EMPTY ${tree}: ${anchor.rootId ? 'FALSE' : 'TRUE'} (root is ${this.describeRef(ctx, anchor.rootId)})`, 'result');
        return;
      case 'ROOT':
        this.note(ctx, 'RESULT', `${tree}.root → ${this.describeRef(ctx, anchor.rootId)}`, 'result', anchor.rootId ? { nodes: { [anchor.rootId]: 'EVALUATING' } } : {});
        return;
    }
  }

  private header(ctx: TreeContext, text: string): void {
    this.note(ctx, 'OPERATION', text, 'operation');
  }

  private done(ctx: TreeContext, tree: string, text: string, extra: FrameOptions = {}): void {
    this.note(ctx, 'RESULT', `${text}   ${tree}: ${this.format(ctx, tree)}`, 'result', extra);
  }

  /** Walks from the root toward `value` by BST order; one frame per comparison. Returns the last node and the side to continue on. */
  private bstWalk(ctx: TreeContext, tree: string, value: any, temp: Record<string, string | null> = {}): { found: string | null; parent: string | null; side: Side | null } {
    let curr: string | null = this.anchor(ctx, tree).rootId ?? null;
    let parent: string | null = null;
    let side: Side | null = null;
    if (curr) {
      this.frame(ctx, {
        nodes: { [curr]: 'TRAVERSING' },
        temp: { ...temp, curr },
        logs: [{ keyword: 'TRAVERSE', message: `curr = ${tree}.root   ⟹   node ${this.val(ctx, curr)}`, kind: 'traversal' }],
      });
    }
    while (curr) {
      const v = this.val(ctx, curr) as any;
      if (value === v) {
        this.frame(ctx, {
          nodes: { [curr]: 'SUCCESS' },
          temp: { ...temp, parent, curr },
          logs: [{ keyword: 'COMPARE', message: `${value} == ${v}   ⟹   found`, kind: 'compare' }],
        });
        return { found: curr, parent, side };
      }
      const dir: Side = value < v ? 'left' : 'right';
      const next = this.child(ctx, curr, dir);
      this.frame(ctx, {
        nodes: next ? { [next]: 'TRAVERSING', [curr]: 'EVALUATING' } : { [curr]: 'EVALUATING' },
        edges: next ? { [`${curr}>${dir}`]: 'TRAVERSING' } : {},
        temp: { ...temp, parent: curr, curr: next },
        logs: [{
          keyword: 'COMPARE',
          message: `${value} ${dir === 'left' ? '<' : '>'} ${v}   ⟹   go ${dir}: curr = curr.${dir}${next ? ` (node ${this.val(ctx, next)})` : ' (NULL)'}`,
          kind: 'compare',
        }],
      });
      parent = curr;
      side = dir;
      curr = next;
    }
    return { found: null, parent, side };
  }

  private bstInsert(ctx: TreeContext, tree: string, value: any): void {
    const anchor = this.anchor(ctx, tree);
    this.header(ctx, `INSERT ${tree} ${value}: walk down (smaller → left, larger → right) to an empty spot`);
    const { found, parent, side } = this.bstWalk(ctx, tree, value);
    if (found) {
      this.note(ctx, 'RESULT', `${value} is already in the BST — keys are unique, nothing inserted.`, 'result', { nodes: { [found]: 'SUCCESS' } });
      return;
    }
    const id = this.createNode(ctx, tree, value);
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp: { parent, newNode: id },
      logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${tree}, ${value})   ⟹   allocated in heap memory`, kind: 'info' }],
    });
    if (!parent) {
      anchor.rootId = id;
      this.frame(ctx, {
        nodes: { [id]: 'SUCCESS' },
        logs: [{ keyword: 'POINTER', message: `${tree}.root = newNode   ⟹   node ${value} is the root`, kind: 'relationship' }],
      });
    } else {
      this.setChild(ctx, parent, side!, id);
      this.frame(ctx, {
        nodes: { [id]: 'SUCCESS' },
        edges: { [`${parent}>${side}`]: 'MODIFYING' },
        temp: { parent },
        logs: [{ keyword: 'POINTER', message: `parent.${side} = newNode   ⟹   node ${this.val(ctx, parent)}.${side} → node ${value}`, kind: 'relationship' }],
      });
    }
    this.done(ctx, tree, `Inserted ${value}.`);
  }

  /** Binary tree (not BST): insert at the first free child slot in level order. */
  private levelInsert(ctx: TreeContext, tree: string, value: any): void {
    const anchor = this.anchor(ctx, tree);
    this.header(ctx, `INSERT ${tree} ${value}: level order — the first node with a free child slot gets the new node`);
    const id = this.createNode(ctx, tree, value);
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp: { newNode: id },
      logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${tree}, ${value})`, kind: 'info' }],
    });
    if (!anchor.rootId) {
      anchor.rootId = id;
      this.done(ctx, tree, `${tree}.root = newNode.`);
      return;
    }
    const queue: string[] = [anchor.rootId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      this.frame(ctx, {
        nodes: { [curr]: 'TRAVERSING' },
        temp: { curr, newNode: id },
        logs: [{ keyword: 'TRAVERSE', message: `curr = node ${this.val(ctx, curr)} (queue: [${queue.map((q) => this.val(ctx, q)).join(', ')}])`, kind: 'traversal' }],
      });
      for (const side of ['left', 'right'] as Side[]) {
        const c = this.child(ctx, curr, side);
        if (!c) {
          this.setChild(ctx, curr, side, id);
          this.frame(ctx, {
            nodes: { [id]: 'SUCCESS' },
            edges: { [`${curr}>${side}`]: 'MODIFYING' },
            temp: { curr },
            logs: [{ keyword: 'POINTER', message: `curr.${side} is NULL → curr.${side} = newNode   ⟹   node ${this.val(ctx, curr)}.${side} → node ${value}`, kind: 'relationship' }],
          });
          this.done(ctx, tree, `Inserted ${value}.`);
          return;
        }
        queue.push(c);
      }
    }
  }

  private bstSearch(ctx: TreeContext, tree: string, value: any): void {
    this.header(ctx, `SEARCH ${tree} ${value}: compare and go left or right — one path from the root`);
    const { found } = this.bstWalk(ctx, tree, value);
    if (found) this.note(ctx, 'RESULT', `Found ${value}.`, 'search', { nodes: { [found]: 'SUCCESS' }, temp: { curr: found } });
    else this.note(ctx, 'RESULT', `${value} is not in the BST (reached NULL).`, 'search');
  }

  private dfsSearch(ctx: TreeContext, tree: string, value: any): void {
    this.header(ctx, `SEARCH ${tree} ${value}: no ordering in a plain binary tree — visit nodes in preorder until found`);
    const { order } = this.scan(ctx, tree);
    for (const id of order) {
      const hit = this.val(ctx, id) === value;
      this.frame(ctx, {
        nodes: { [id]: hit ? 'SUCCESS' : 'EVALUATING' },
        temp: { curr: id },
        logs: [{ keyword: 'COMPARE', message: `node ${this.val(ctx, id)} ${hit ? '==' : '!='} ${value}`, kind: 'compare' }],
      });
      if (hit) {
        this.note(ctx, 'RESULT', `Found ${value}.`, 'search', { nodes: { [id]: 'SUCCESS' }, temp: { curr: id } });
        return;
      }
    }
    this.note(ctx, 'RESULT', `${value} is not in ${tree}.`, 'search');
  }

  private bstDelete(ctx: TreeContext, tree: string, value: any): void {
    const anchor = this.anchor(ctx, tree);
    this.header(ctx, `DELETE ${tree} ${value}: find the node, then unlink it (leaf / one child / two children)`);
    const { found, parent, side } = this.bstWalk(ctx, tree, value);
    if (!found) {
      this.note(ctx, 'RESULT', `${value} is not in the BST — nothing to delete.`, 'result');
      return;
    }
    const temp = { parent, curr: found };
    const l = this.child(ctx, found, 'left');
    const r = this.child(ctx, found, 'right');
    const relink = (replacement: string | null, why: string) => {
      if (!parent) {
        anchor.rootId = replacement;
        this.frame(ctx, {
          nodes: replacement ? { [replacement]: 'SUCCESS' } : {},
          temp,
          bypassed: [found],
          logs: [{ keyword: 'POINTER', message: `${tree}.root = ${why}   ⟹   node ${value} is unlinked`, kind: 'relationship' }],
        });
      } else {
        this.setChild(ctx, parent, side!, replacement);
        this.frame(ctx, {
          nodes: replacement ? { [replacement]: 'SUCCESS' } : {},
          edges: replacement ? { [`${parent}>${side}`]: 'MODIFYING' } : {},
          temp,
          bypassed: [found],
          logs: [{ keyword: 'POINTER', message: `parent.${side} = ${why}   ⟹   node ${value} is unlinked`, kind: 'relationship' }],
        });
      }
      this.freeNode(ctx, found, 'curr', { parent });
      this.done(ctx, tree, `Deleted ${value}.`);
    };
    if (!l && !r) {
      this.note(ctx, 'CASE', `Case 1 — node ${value} is a leaf: just unlink it.`, 'info', { nodes: { [found]: 'MODIFYING' }, temp });
      relink(null, 'NULL');
      return;
    }
    if (!l || !r) {
      const only = (l ?? r)!;
      this.note(ctx, 'CASE', `Case 2 — node ${value} has one child (${this.val(ctx, only)}): the parent adopts it.`, 'info', { nodes: { [found]: 'MODIFYING', [only]: 'EVALUATING' }, temp });
      relink(only, `curr.${l ? 'left' : 'right'}`);
      return;
    }
    // Two children: copy the inorder successor's key here, then delete the successor.
    this.note(ctx, 'CASE', `Case 3 — node ${value} has two children: replace its key with the inorder successor (smallest key in the right subtree).`, 'info', { nodes: { [found]: 'MODIFYING' }, temp });
    let succParent = found;
    let succ = r;
    this.frame(ctx, {
      nodes: { [succ]: 'TRAVERSING' },
      edges: { [`${found}>right`]: 'TRAVERSING' },
      temp: { curr: found, succParent, succ },
      logs: [{ keyword: 'TRAVERSE', message: `succ = curr.right   ⟹   node ${this.val(ctx, succ)}`, kind: 'traversal' }],
    });
    for (let next = this.child(ctx, succ, 'left'); next; next = this.child(ctx, succ, 'left')) {
      succParent = succ;
      succ = next;
      this.frame(ctx, {
        nodes: { [succ]: 'TRAVERSING' },
        edges: { [`${succParent}>left`]: 'TRAVERSING' },
        temp: { curr: found, succParent, succ },
        logs: [{ keyword: 'TRAVERSE', message: `succParent = succ; succ = succ.left   ⟹   node ${this.val(ctx, succ)}`, kind: 'traversal' }],
      });
    }
    const succValue = this.val(ctx, succ);
    this.node(ctx, found).value = succValue;
    this.frame(ctx, {
      nodes: { [found]: 'MODIFYING', [succ]: 'EVALUATING' },
      temp: { curr: found, succParent, succ },
      logs: [{ keyword: 'UPDATE', message: `curr.val = succ.val   ⟹   node ${value} becomes ${succValue}`, kind: 'operation' }],
    });
    const succRight = this.child(ctx, succ, 'right');
    const succSide: Side = succParent === found ? 'right' : 'left';
    this.setChild(ctx, succParent, succSide, succRight);
    this.frame(ctx, {
      edges: succRight ? { [`${succParent}>${succSide}`]: 'MODIFYING' } : {},
      temp: { curr: found, succParent, succ },
      bypassed: [succ],
      logs: [{ keyword: 'POINTER', message: `succParent.${succSide} = succ.right   ⟹   the old successor node is unlinked`, kind: 'relationship' }],
    });
    this.freeNode(ctx, succ, 'succ', { curr: found });
    this.done(ctx, tree, `Deleted ${value}.`);
  }

  private depthFirst(ctx: TreeContext, tree: string, order: string): void {
    const rule = order === 'INORDER' ? 'left, node, right' : order === 'PREORDER' ? 'node, left, right' : 'left, right, node';
    this.header(ctx, `${order} ${tree}: visit ${rule} (recursively)`);
    const visited: string[] = [];
    const marks: Record<string, string> = {};
    const walk = (id: string | null, depth: number) => {
      if (!id) return;
      const indent = '│  '.repeat(depth);
      const visit = () => {
        visited.push(String(this.val(ctx, id)));
        marks[id] = 'SUCCESS';
        this.frame(ctx, {
          nodes: { ...marks },
          temp: { node: id },
          logs: [{ keyword: 'VISIT', message: `${indent}visit ${this.val(ctx, id)}   ⟹   ${order.toLowerCase()} so far: ${visited.join(' ')}`, kind: 'traversal' }],
        });
      };
      this.frame(ctx, {
        nodes: { ...marks, [id]: marks[id] ?? 'TRAVERSING' },
        temp: { node: id },
        logs: [{ keyword: 'CALL', message: `${indent}${order.toLowerCase()}(${this.val(ctx, id)})`, kind: 'traversal' }],
      });
      if (order === 'PREORDER') visit();
      walk(this.child(ctx, id, 'left'), depth + 1);
      if (order === 'INORDER') visit();
      walk(this.child(ctx, id, 'right'), depth + 1);
      if (order === 'POSTORDER') visit();
    };
    walk(this.anchor(ctx, tree).rootId ?? null, 0);
    this.note(ctx, 'RESULT', `${order}: ${visited.length ? visited.join(' ') : '(empty tree)'}`, 'result', { nodes: marks });
  }

  private levelOrder(ctx: TreeContext, tree: string): void {
    this.header(ctx, `LEVELORDER ${tree}: breadth first — a queue holds the nodes waiting to be visited`);
    const root = this.anchor(ctx, tree).rootId ?? null;
    const visited: string[] = [];
    const marks: Record<string, string> = {};
    const queue: string[] = root ? [root] : [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      visited.push(String(this.val(ctx, id)));
      marks[id] = 'SUCCESS';
      for (const side of ['left', 'right'] as Side[]) {
        const c = this.child(ctx, id, side);
        if (c) queue.push(c);
      }
      this.frame(ctx, {
        nodes: { ...marks },
        temp: { node: id },
        logs: [{
          keyword: 'VISIT',
          message: `dequeue ${this.val(ctx, id)}, enqueue its children   ⟹   queue: [${queue.map((q) => this.val(ctx, q)).join(', ')}]`,
          kind: 'traversal',
        }],
      });
    }
    this.note(ctx, 'RESULT', `LEVELORDER: ${visited.length ? visited.join(' ') : '(empty tree)'}`, 'result', { nodes: marks });
  }

  private height(ctx: TreeContext, tree: string): void {
    this.header(ctx, `HEIGHT ${tree}: height(node) = 1 + max(height(left), height(right)); height(NULL) = 0`);
    const calc = (id: string | null, depth: number): number => {
      if (!id) return 0;
      const indent = '│  '.repeat(depth);
      const lh = calc(this.child(ctx, id, 'left'), depth + 1);
      const rh = calc(this.child(ctx, id, 'right'), depth + 1);
      const h = 1 + Math.max(lh, rh);
      this.frame(ctx, {
        nodes: { [id]: 'EVALUATING' },
        temp: { node: id },
        logs: [{ keyword: 'RETURN', message: `${indent}height(${this.val(ctx, id)}) = 1 + max(${lh}, ${rh}) = ${h}`, kind: 'step' }],
      });
      return h;
    };
    const h = calc(this.anchor(ctx, tree).rootId ?? null, 0);
    this.note(ctx, 'RESULT', `HEIGHT ${tree} = ${h} (levels, counting the root as 1)`, 'result');
  }

  private countNodes(ctx: TreeContext, tree: string, leavesOnly: boolean): void {
    const { order } = this.scan(ctx, tree);
    this.header(ctx, leavesOnly ? `LEAVES ${tree}: count the nodes with no children` : `SIZE ${tree}: count every node`);
    const marks: Record<string, string> = {};
    let count = 0;
    for (const id of order) {
      const leaf = this.isLeaf(ctx, id);
      if (!leavesOnly || leaf) {
        count++;
        marks[id] = 'SUCCESS';
      }
      this.frame(ctx, {
        nodes: { ...marks, [id]: marks[id] ?? 'EVALUATING' },
        temp: { node: id },
        logs: [{ keyword: 'COUNT', message: `node ${this.val(ctx, id)}${leavesOnly ? (leaf ? ' is a leaf' : ' has children') : ''}   ⟹   count = ${count}`, kind: 'traversal' }],
      });
    }
    this.note(ctx, 'RESULT', `${leavesOnly ? 'LEAVES' : 'SIZE'} ${tree} = ${count}`, 'result', { nodes: marks });
  }

  /** MIN (side 'left') / MAX (side 'right'): in a BST, follow one side to the end; otherwise check every node. */
  private extreme(ctx: TreeContext, tree: string, side: Side): void {
    const name = side === 'left' ? 'MIN' : 'MAX';
    const anchor = this.anchor(ctx, tree);
    if (!anchor.rootId) {
      this.note(ctx, 'RESULT', `${name} ${tree}: the tree is empty.`, 'result');
      return;
    }
    if (anchor.kind === 'BST') {
      this.header(ctx, `${name} ${tree}: keep going ${side} — the ${side === 'left' ? 'smallest' : 'largest'} key has no ${side} child`);
      let curr: string = anchor.rootId;
      this.frame(ctx, { nodes: { [curr]: 'TRAVERSING' }, temp: { curr }, logs: [{ keyword: 'TRAVERSE', message: `curr = ${tree}.root   ⟹   node ${this.val(ctx, curr)}`, kind: 'traversal' }] });
      for (let next = this.child(ctx, curr, side); next; next = this.child(ctx, curr, side)) {
        this.frame(ctx, {
          nodes: { [next]: 'TRAVERSING' },
          edges: { [`${curr}>${side}`]: 'TRAVERSING' },
          temp: { curr: next },
          logs: [{ keyword: 'TRAVERSE', message: `curr = curr.${side}   ⟹   node ${this.val(ctx, next)}`, kind: 'traversal' }],
        });
        curr = next;
      }
      this.note(ctx, 'RESULT', `${name} ${tree} = ${this.val(ctx, curr)}`, 'result', { nodes: { [curr]: 'SUCCESS' }, temp: { curr } });
      return;
    }
    this.header(ctx, `${name} ${tree}: a plain binary tree has no ordering — check every node`);
    let best: string | null = null;
    for (const id of this.scan(ctx, tree).order) {
      const v = this.val(ctx, id) as any;
      const better = best === null || (side === 'left' ? v < (this.val(ctx, best) as any) : v > (this.val(ctx, best) as any));
      if (better) best = id;
      this.frame(ctx, {
        nodes: { [id]: 'EVALUATING', ...(best ? { [best]: 'SUCCESS' } : {}) },
        temp: { node: id, best },
        logs: [{ keyword: 'COMPARE', message: `node ${v}   ⟹   ${name.toLowerCase()} so far ${this.val(ctx, best)}`, kind: 'compare' }],
      });
    }
    this.note(ctx, 'RESULT', `${name} ${tree} = ${this.val(ctx, best)}`, 'result', best ? { nodes: { [best]: 'SUCCESS' } } : {});
  }

  private mirror(ctx: TreeContext, tree: string): void {
    this.header(ctx, `MIRROR ${tree}: swap the left and right pointers of every node (postorder)`);
    const walk = (id: string | null) => {
      if (!id) return;
      walk(this.child(ctx, id, 'left'));
      walk(this.child(ctx, id, 'right'));
      const l = this.child(ctx, id, 'left');
      const r = this.child(ctx, id, 'right');
      this.setChild(ctx, id, 'left', r);
      this.setChild(ctx, id, 'right', l);
      this.frame(ctx, {
        nodes: { [id]: 'MODIFYING' },
        edges: { ...(r ? { [`${id}>left`]: 'MODIFYING' } : {}), ...(l ? { [`${id}>right`]: 'MODIFYING' } : {}) },
        temp: { node: id },
        logs: [{
          keyword: 'POINTER',
          message: `temp = node.left; node.left = node.right; node.right = temp   ⟹   node ${this.val(ctx, id)}: left ${this.shortValue(ctx, r)}, right ${this.shortValue(ctx, l)}`,
          kind: 'relationship',
        }],
      });
    };
    walk(this.anchor(ctx, tree).rootId ?? null);
    this.done(ctx, tree, 'Mirrored.');
  }

  private rotate(ctx: TreeContext, tree: string, value: any, dirRaw: string): void {
    const dir = dirRaw.replace(/"/g, '').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
    const up: Side = dir === 'LEFT' ? 'right' : 'left';   // the child that moves up
    const down: Side = dir === 'LEFT' ? 'left' : 'right'; // where the old top goes
    const anchor = this.anchor(ctx, tree);
    const target = this.scan(ctx, tree).order.find((id) => this.val(ctx, id) === value);
    if (!target) {
      this.note(ctx, 'ERROR', `ROTATE: ${value} is not in ${tree}.`, 'result');
      return;
    }
    const pivot = this.child(ctx, target, up);
    if (!pivot) {
      this.note(ctx, 'ERROR', `ROTATE ${value} ${dir}: node ${value} has no ${up} child to rotate up — nothing changed.`, 'result', { nodes: { [target]: 'EVALUATING' } });
      return;
    }
    const parentEdge = (ctx.sceneManager.getSceneGraph() as any[]).find(
      (e) => e.type === 'edge' && e.targetId === target && (e.pointer === 'left' || e.pointer === 'right')
    );
    this.header(ctx, `ROTATE ${value} ${dir}: node ${this.val(ctx, pivot)} moves up, node ${value} moves down`);
    const temp = { node: target, pivot };
    const inner = this.child(ctx, pivot, down);
    this.setChild(ctx, target, up, inner);
    this.frame(ctx, {
      edges: inner ? { [`${target}>${up}`]: 'MODIFYING' } : {},
      temp,
      logs: [{ keyword: 'POINTER', message: `node.${up} = pivot.${down}   ⟹   node ${value}.${up} → ${this.describeRef(ctx, inner)}`, kind: 'relationship' }],
    });
    this.setChild(ctx, pivot, down, target);
    this.frame(ctx, {
      edges: { [`${pivot}>${down}`]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `pivot.${down} = node   ⟹   node ${this.val(ctx, pivot)}.${down} → node ${value}`, kind: 'relationship' }],
    });
    if (parentEdge) {
      const parentSide: Side = parentEdge.pointer;
      this.setChild(ctx, parentEdge.sourceId, parentSide, pivot);
      this.frame(ctx, {
        edges: { [`${parentEdge.sourceId}>${parentSide}`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `parent.${parentSide} = pivot   ⟹   node ${this.val(ctx, parentEdge.sourceId)}.${parentSide} → node ${this.val(ctx, pivot)}`, kind: 'relationship' }],
      });
    } else {
      anchor.rootId = pivot;
      this.frame(ctx, {
        temp,
        logs: [{ keyword: 'POINTER', message: `${tree}.root = pivot   ⟹   node ${this.val(ctx, pivot)} is the new root`, kind: 'relationship' }],
      });
    }
    this.done(ctx, tree, 'Rotated.');
  }

  private clear(ctx: TreeContext, tree: string): void {
    const anchor = this.anchor(ctx, tree);
    if (!anchor.rootId) {
      this.note(ctx, 'RESULT', `CLEAR ${tree}: already empty.`, 'result');
      return;
    }
    this.header(ctx, `CLEAR ${tree}: free every node in postorder (children before their parent)`);
    const order: string[] = [];
    const walk = (id: string | null) => {
      if (!id) return;
      walk(this.child(ctx, id, 'left'));
      walk(this.child(ctx, id, 'right'));
      order.push(id);
    };
    walk(anchor.rootId);
    for (const id of order) this.freeNode(ctx, id, `node ${this.val(ctx, id)}`, {}, false);
    anchor.rootId = null;
    this.done(ctx, tree, 'Cleared.');
  }
}

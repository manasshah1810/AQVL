/**
 * LinkedListEngine — the runtime model and animations for AQVL linked lists.
 *
 * A list lives entirely in the scene graph, so stepping back (which restores
 * scene snapshots) restores it exactly:
 *
 * - an anchor element `ll:<list>` (not drawn) holding `headId` and `variant`;
 * - one sphere per node, id `ll:<list>:<n>` — a pointer value held in a VM
 *   variable is simply this id, and NULL is `null`;
 * - one edge per non-NULL pointer, id `<node>>next` / `<node>>prev`.
 *
 * Programs manipulate lists the way C code does — `curr = curr.next`,
 * `prev.next = curr.next`, `n = NEW_NODE(list, 5)`, `FREE temp` — and every
 * pointer move / pointer write / allocation / free is its own animated step
 * (see AnimationController, which routes LL_* instructions and pointer-variable
 * assignments here). The classic operations (INSERT_HEAD, INSERT_TAIL,
 * DELETE_HEAD, DELETE_TAIL, REVERSE, INSERT/DELETE/UPDATE list[i], SEARCH) are
 * kept as one-line shortcuts, but they too walk the list node by node and
 * relink real pointers on screen rather than teleporting nodes.
 *
 * Heap memory: a node that is not reachable from its list's head — freshly
 * allocated, or unlinked by a pointer write that bypasses it — moves to the
 * list's heap-memory row below the list, and only disappears when FREE
 * releases it. A node that nothing points to any more is flagged LEAKED.
 */
import { AlgorithmContext } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken, RuntimeError } from '@aqvl/shared';

/** A linked-list misuse at run time: NULL dereference, use after free, index out of range, ... */
export class LinkedListError extends RuntimeError {
  constructor(message: string) {
    super(message);
    this.name = 'LinkedListError';
  }
}

/** What the engine needs from the program executing it (the VM, via AnimationController). */
export interface LinkedListHost {
  /** Evaluates a compiled expression operand to a value. */
  evaluate(expr: unknown): unknown;
  setVariable(name: string, value: unknown): void;
  /** User variables currently in scope — pointer variables become node tags. */
  visibleVariables(): Record<string, unknown>;
}

export interface LinkedListContext extends AlgorithmContext {
  host: LinkedListHost;
}

type PointerKind = 'next' | 'prev';
type LogKind = 'traversal' | 'relationship' | 'operation' | 'info' | 'result' | 'step' | 'compare' | 'search';

interface LogEntry {
  keyword: string;
  message: string;
  kind: LogKind;
}

interface FrameOptions {
  logs?: LogEntry[];
  /** node id -> semantic state to highlight it with during this frame. */
  nodes?: Record<string, string>;
  /** edge id -> semantic state to highlight it with during this frame. */
  edges?: Record<string, string>;
  /** Newly allocated nodes: placed at their heap slot, then scaled up from 0. */
  grow?: string[];
  /** Internal pointers of a built-in operation (e.g. `curr` while INSERT_TAIL walks), shown as node tags. */
  temp?: Record<string, string | null>;
  /** Nodes a pointer write just bypassed — they are unlinked and move to heap memory. */
  bypassed?: string[];
  duration?: number;
}

const EDGE_COLOR = '#cbd5e1';
const LEAK_COLOR = '#ef4444';
const TRANSIENT_STATES = new Set(['EVALUATING', 'TRAVERSING', 'MODIFYING', 'ACTIVE']);
const STEP_MS = 480;
const MOVE_MS = 560;

export class LinkedListEngine {
  // ---------------------------------------------------------------------
  // Model queries
  // ---------------------------------------------------------------------

  /** True for a node reference (`ll:<list>:<n>`), whether or not the node still exists. */
  public static isNodeRef(value: unknown): value is string {
    return typeof value === 'string' && /^ll:[^:]+:\d+$/.test(value);
  }

  private anchor(ctx: AlgorithmContext, list: string): any {
    return ctx.sceneManager.getElement(`ll:${list}`) as any;
  }

  public isList(ctx: AlgorithmContext, name: unknown): boolean {
    return typeof name === 'string' && !!this.anchor(ctx, name);
  }

  public hasAnyList(ctx: AlgorithmContext): boolean {
    return ctx.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'LINKEDLIST');
  }

  private requireList(ctx: AlgorithmContext, list: string): any {
    const a = this.anchor(ctx, list);
    if (!a) throw new LinkedListError(`'${list}' is not a linked list.`);
    return a;
  }

  private node(ctx: AlgorithmContext, id: unknown): any {
    return LinkedListEngine.isNodeRef(id) ? (ctx.sceneManager.getElement(id) as any) : undefined;
  }

  private pointerOf(ctx: AlgorithmContext, id: string | null, kind: PointerKind): string | null {
    if (!id) return null;
    const edge = ctx.sceneManager.getElement(`${id}>${kind}`) as any;
    return edge ? edge.targetId : null;
  }

  private variantOf(ctx: AlgorithmContext, nodeEl: any): string {
    return this.anchor(ctx, nodeEl.logicalParent)?.variant ?? 'SINGLY';
  }

  /** Node ids reachable from the head by following `next`, in order (stops before a repeat). */
  private chain(ctx: AlgorithmContext, list: string): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    let cur: string | null = this.anchor(ctx, list)?.headId ?? null;
    while (cur && !seen.has(cur) && ctx.sceneManager.getElement(cur)) {
      ids.push(cur);
      seen.add(cur);
      cur = this.pointerOf(ctx, cur, 'next');
    }
    return ids;
  }

  private nodesOf(ctx: AlgorithmContext, list?: string): any[] {
    return ctx.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.originalType === 'LINKEDLIST_NODE' && (list === undefined || el.logicalParent === list));
  }

  public length(ctx: AlgorithmContext, list: string): number {
    this.requireList(ctx, list);
    return this.chain(ctx, list).length;
  }

  /** The node `index` hops from the head. */
  public nodeAt(ctx: AlgorithmContext, list: string, index: number): string {
    const ids = this.chain(ctx, list);
    if (!Number.isInteger(index) || index < 0 || index >= ids.length) {
      throw new LinkedListError(
        ids.length === 0
          ? `${list}[${index}] does not exist: linked list '${list}' is empty.`
          : `Index ${index} is out of range for linked list '${list}' (valid positions are 0 to ${ids.length - 1}).`
      );
    }
    return ids[index];
  }

  public valueAt(ctx: AlgorithmContext, list: string, index: number): unknown {
    return this.node(ctx, this.nodeAt(ctx, list, index)).value;
  }

  /** `10 -> 20 -> 30 -> NULL` (or `... -> back to 10` for a cycle). */
  public format(ctx: AlgorithmContext, list: string): string {
    const ids = this.chain(ctx, list);
    if (ids.length === 0) return 'NULL (empty)';
    const values = ids.map((id) => String(this.node(ctx, id).value));
    const after = this.pointerOf(ctx, ids[ids.length - 1], 'next');
    const end = after ? `back to ${this.node(ctx, after)?.value}` : 'NULL';
    return `${values.join(' -> ')} -> ${end}`;
  }

  /** How a pointer value reads in messages: `node 20`, `NULL`, or a freed node. */
  public describeRef(ctx: AlgorithmContext, ref: unknown): string {
    if (ref === null || ref === undefined) return 'NULL';
    if (LinkedListEngine.isNodeRef(ref)) {
      const el = this.node(ctx, ref);
      return el ? `node ${el.value}` : 'a freed node';
    }
    return String(ref);
  }

  /** Value formatting for PRINT: a node prints as `Node(20)`, NULL as `NULL`. */
  public formatValue(ctx: AlgorithmContext, value: unknown): string | null {
    if (value === null) return 'NULL';
    if (LinkedListEngine.isNodeRef(value)) {
      const el = this.node(ctx, value);
      return el ? `Node(${el.value})` : 'Node(freed)';
    }
    return null;
  }

  private static exprText(expr: unknown): string {
    if (typeof expr === 'string') return expr;
    if (expr && typeof expr === 'object' && 'member' in (expr as any)) {
      return `${LinkedListEngine.exprText((expr as any).object)}.${(expr as any).member}`;
    }
    if (expr === null) return 'NULL';
    return 'the value';
  }

  /** Throws a descriptive error unless `ref` is a live node. `what` names the operand (e.g. `curr`). */
  private requireNode(ctx: AlgorithmContext, ref: unknown, what: string): any {
    if (ref === null || ref === undefined) {
      throw new LinkedListError(`NULL pointer dereference: ${what} is NULL.`);
    }
    if (!LinkedListEngine.isNodeRef(ref)) {
      throw new LinkedListError(`${what} is not a linked-list node (its value is ${JSON.stringify(ref)}).`);
    }
    const el = this.node(ctx, ref);
    if (!el) throw new LinkedListError(`Use after free: ${what} points to a node whose memory was already freed.`);
    return el;
  }

  /** A pointer target must be a live node or NULL. */
  private requirePointerTarget(ctx: AlgorithmContext, value: unknown, what: string): string | null {
    if (value === null || value === undefined) return null;
    this.requireNode(ctx, value, what);
    return value as string;
  }

  /** `object.member` for a list (`head`, `tail`, `length`) or a node (`next`, `prev`, `val`). */
  public readMember(ctx: AlgorithmContext, object: unknown, member: string, objectExpr: unknown): unknown {
    const what = LinkedListEngine.exprText(objectExpr);
    if (this.isList(ctx, object)) {
      const list = object as string;
      if (member === 'head') return this.anchor(ctx, list).headId ?? null;
      if (member === 'tail') {
        const ids = this.chain(ctx, list);
        return ids.length ? ids[ids.length - 1] : null;
      }
      if (member === 'length' || member === 'size') return this.chain(ctx, list).length;
      throw new LinkedListError(`A linked list has no field '${member}' (use ${list}.head, ${list}.tail or LENGTH(${list})).`);
    }
    if (object === null || object === undefined) {
      throw new LinkedListError(`NULL pointer dereference: cannot read ${what}.${member} because ${what} is NULL.`);
    }
    const el = this.requireNode(ctx, object, what);
    if (member === 'next') return this.pointerOf(ctx, el.id, 'next');
    if (member === 'prev') {
      if (this.variantOf(ctx, el) !== 'DOUBLY') {
        throw new LinkedListError(`${what}.prev does not exist: only DOUBLY linked list nodes have a prev pointer.`);
      }
      return this.pointerOf(ctx, el.id, 'prev');
    }
    if (member === 'val' || member === 'value' || member === 'data') return el.value;
    throw new LinkedListError(`A node has no field '${member}' (its fields are val, next${this.variantOf(ctx, el) === 'DOUBLY' ? ', prev' : ''}).`);
  }

  // ---------------------------------------------------------------------
  // Scene mutation primitives
  // ---------------------------------------------------------------------

  private setPointer(ctx: AlgorithmContext, sourceId: string, kind: PointerKind, targetId: string | null): void {
    const edgeId = `${sourceId}>${kind}`;
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
      pointer: kind,
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

  /** Allocates an unlinked node in `list`'s heap memory. */
  private createNode(ctx: AlgorithmContext, list: string, value: unknown): string {
    const a = this.requireList(ctx, list);
    let id = `ll:${list}:${a.nextNodeNumber ?? 0}`;
    while (ctx.sceneManager.getElement(id)) {
      a.nextNodeNumber = (a.nextNodeNumber ?? 0) + 1;
      id = `ll:${list}:${a.nextNodeNumber}`;
    }
    a.nextNodeNumber = (a.nextNodeNumber ?? 0) + 1;
    a.heapCounter = (a.heapCounter ?? 0) + 1;
    const token = getSemanticColorToken('AUXILIARY');
    ctx.sceneManager.addElement({
      id,
      type: 'sphere',
      originalType: 'LINKEDLIST_NODE',
      logicalParent: list,
      value,
      label: '',
      slot: 0,
      inList: false,
      heapOrder: a.heapCounter,
      pointerVars: [],
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
  // Derived state (row / heap membership, slots, tags, colors)
  // ---------------------------------------------------------------------

  /**
   * Recomputes, for every list: which nodes are in the list row vs the heap
   * area, the row order (slots), and each node's tags (HEAD, pointer
   * variables, TAIL, LEAKED) and resting color.
   */
  private refresh(ctx: LinkedListContext, temp: Record<string, string | null> = {}, bypassed: string[] = []): void {
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    const names = new Map<string, string[]>();
    const addName = (id: unknown, name: string) => {
      if (!LinkedListEngine.isNodeRef(id)) return;
      if (!names.has(id)) names.set(id, []);
      if (!names.get(id)!.includes(name)) names.get(id)!.push(name);
    };
    // A temp pointer of this frame shadows a program variable of the same
    // name (e.g. `newNode` being re-pointed at a node just allocated).
    for (const [name, value] of Object.entries(ctx.host.visibleVariables())) if (!(name in temp)) addName(value, name);
    for (const [name, value] of Object.entries(temp)) addName(value, name);

    const edges = graph.filter((el) => el.type === 'edge' && (el.pointer === 'next' || el.pointer === 'prev'));
    const isInList = (id: string) => this.node(ctx, id)?.inList !== false;
    const referencedByEdge = (id: string, fromInListOnly: boolean) =>
      edges.some((e) => e.targetId === id && e.sourceId !== id && (!fromInListOnly || isInList(e.sourceId)));

    for (const anchor of graph.filter((el) => el.originalType === 'LINKEDLIST')) {
      const list = anchor.logicalParent;
      if (anchor.headId && !ctx.sceneManager.getElement(anchor.headId)) anchor.headId = null;
      const chainIds = this.chain(ctx, list);
      const reach = new Set(chainIds);
      const listNodes = this.nodesOf(ctx, list);

      const joined: any[] = [];
      for (const n of listNodes) {
        const refNames = names.get(n.id) ?? [];
        if (reach.has(n.id)) {
          if (n.inList === false) joined.push(n);
          n.inList = true;
        } else if (n.inList !== false) {
          if (bypassed.includes(n.id) || (!referencedByEdge(n.id, true) && refNames.length === 0)) {
            n.inList = false;
            anchor.heapCounter = (anchor.heapCounter ?? 0) + 1;
            n.heapOrder = anchor.heapCounter;
          }
        }
      }

      const row = listNodes.filter((n) => n.inList !== false);
      if (row.every((n) => reach.has(n.id))) {
        // The whole list is one chain from the head: order it by the pointers.
        chainIds.forEach((id, i) => {
          const el = this.node(ctx, id);
          if (el && el.logicalParent === list) el.slot = i;
        });
      } else {
        // Temporarily split (e.g. mid-reversal): keep positions stable, and
        // slot a node that just joined in right after its predecessor.
        for (const n of joined) {
          const idx = chainIds.indexOf(n.id);
          const pred = idx > 0 ? this.node(ctx, chainIds[idx - 1]) : null;
          n.slot = pred ? (pred.slot ?? 0) + 0.5 : Math.min(...row.map((r) => r.slot ?? 0)) - 1;
        }
      }

      const tail = chainIds.length ? chainIds[chainIds.length - 1] : null;
      for (const n of listNodes) {
        const tags: string[] = [];
        if (n.id === anchor.headId) tags.push('HEAD');
        tags.push(...(names.get(n.id) ?? []));
        if (n.id === tail) tags.push('TAIL');
        const leaked = n.inList === false && (names.get(n.id) ?? []).length === 0 && !referencedByEdge(n.id, false);
        if (leaked) tags.push('LEAKED');
        n.tags = tags;
        n.leaked = leaked;
        n.inHeap = n.inList === false;
      }
    }
    this.restoreBaseColors(ctx);
  }

  /** Computes tags / heap membership / colors for freshly loaded lists (before any step runs). */
  public initialize(ctx: LinkedListContext): void {
    if (this.hasAnyList(ctx)) this.refresh(ctx);
  }

  /** Resting colors: list nodes neutral, heap nodes purple, leaked nodes red (highlighted nodes untouched). */
  public restoreBaseColors(ctx: AlgorithmContext): void {
    for (const n of this.nodesOf(ctx)) {
      if (n.state && n.state !== 'NEUTRAL') continue;
      const token = getSemanticColorToken(n.inList === false ? 'AUXILIARY' : 'NEUTRAL');
      n.color = n.leaked ? LEAK_COLOR : token.color;
      n.emissiveColor = n.leaked ? LEAK_COLOR : token.emissiveColor;
      n.emissiveIntensity = token.emissiveIntensity;
    }
    for (const e of ctx.sceneManager.getSceneGraph() as any[]) {
      if (e.type === 'edge' && e.pointer && (!e.state || e.state === 'NEUTRAL')) {
        e.color = EDGE_COLOR;
        e.emissiveColor = EDGE_COLOR;
      }
    }
  }

  /** After a step-back restore: nodes are full size and exactly at their layout positions. */
  public settleAfterRestore(ctx: AlgorithmContext): void {
    if (!this.hasAnyList(ctx)) return;
    for (const n of this.nodesOf(ctx)) n.scale = { x: 1, y: 1, z: 1 };
    ctx.layoutManager.updateLayout(ctx.sceneManager.getSceneGraph());
    for (const el of ctx.sceneManager.getSceneGraph() as any[]) {
      if ((el.originalType === 'LINKEDLIST_NODE' || el.originalType === 'LINKEDLIST') && el.worldTarget) {
        el.position = { ...el.worldTarget };
      }
    }
  }

  // ---------------------------------------------------------------------
  // Frames: one visible beat of an operation
  // ---------------------------------------------------------------------

  private highlight(el: any, state: string): void {
    const token = getSemanticColorToken(state);
    el.state = token.name;
    el.isHighlighted = true;
    el.highlightType = token.name;
    el.color = token.color;
    el.emissiveColor = token.emissiveColor;
    el.emissiveIntensity = token.emissiveIntensity;
  }

  /**
   * Commits one visible beat: recomputes derived state and layout, applies
   * this beat's highlights, captures the scene as it looks now, and
   * schedules it to be shown (with its console lines) followed by the
   * nodes gliding to their new positions.
   */
  private frame(ctx: LinkedListContext, o: FrameOptions = {}): void {
    this.refresh(ctx, o.temp, o.bypassed);
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    ctx.layoutManager.updateLayout(graph);

    for (const el of graph) {
      const isLLEl = el.originalType === 'LINKEDLIST_NODE' || (el.type === 'edge' && el.pointer);
      if (isLLEl && TRANSIENT_STATES.has(el.state)) {
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

    const snapshot = ctx.stateManager?.captureSnapshot(graph, 'Linked list', ctx.scheduler.getCurrentTime());
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
      if (el.originalType !== 'LINKEDLIST_NODE' && el.originalType !== 'LINKEDLIST') continue;
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
  private note(ctx: LinkedListContext, keyword: string, message: string, kind: LogKind, extra: FrameOptions = {}): void {
    this.frame(ctx, { ...extra, logs: [...(extra.logs ?? []), { keyword, message, kind }] });
  }

  /** Releases a node: highlight, shrink, remove it and every pointer from/to it. */
  private freeNode(ctx: LinkedListContext, id: string, label: string, temp: Record<string, string | null> = {}): void {
    const el = this.node(ctx, id);
    const value = el.value;
    const list = el.logicalParent;
    const stillLinked = el.inList !== false && this.chain(ctx, list).includes(id);
    const logs: LogEntry[] = [{ keyword: 'FREE', message: `FREE ${label}: releasing the memory of node ${value}.`, kind: 'operation' }];
    if (stillLinked) {
      logs.push({
        keyword: 'WARNING',
        message: `Node ${value} is still linked into '${list}' — freeing it leaves dangling pointers. Unlink it first (e.g. prev.next = ${label}.next).`,
        kind: 'result',
      });
    }
    this.frame(ctx, { nodes: { [id]: 'MODIFYING' }, logs, temp });

    ctx.scheduler.enqueue({ targets: el.scale, x: 0, y: 0, z: 0, duration: 420, easing: 'easeInBack' });
    ctx.scheduler.commitGroup(true);

    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const e of graph.filter((g) => g.type === 'edge' && (g.sourceId === id || g.targetId === id))) {
      ctx.sceneManager.removeElement(e.id);
      ctx.relationshipManager?.removeRelationship(e.id);
    }
    ctx.sceneManager.removeElement(id);
    const anchor = this.anchor(ctx, list);
    if (anchor && anchor.headId === id) anchor.headId = null;

    const cleanTemp: Record<string, string | null> = {};
    for (const [name, v] of Object.entries(temp)) if (v !== id) cleanTemp[name] = v;
    this.frame(ctx, {
      logs: [{ keyword: 'RESULT', message: `Memory of node ${value} freed. ${list}: ${this.format(ctx, list)}`, kind: 'result' }],
      temp: cleanTemp,
      duration: 300,
    });
  }

  // ---------------------------------------------------------------------
  // Program-level operations (pointer code)
  // ---------------------------------------------------------------------

  /** Whether an assignment of `value` (previously `previous`) involves a pointer and should be animated. */
  public isPointerAssignment(ctx: AlgorithmContext, value: unknown, previous: unknown): boolean {
    if (!this.hasAnyList(ctx)) return false;
    return LinkedListEngine.isNodeRef(value) || LinkedListEngine.isNodeRef(previous) || value === null;
  }

  /**
   * `curr = curr.next` and friends: move the variable's tag, highlight the
   * node it now points to and every pointer the expression followed (both
   * arrows for `fast = fast.next.next`; none for `curr = list.head`).
   */
  public animatePointerMove(ctx: LinkedListContext, name: string, value: unknown, previous: unknown, sourceText?: string, valueExpr?: unknown): void {
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
      if (this.isList(ctx, base)) {
        at = members[0] === 'head' ? this.anchor(ctx, base).headId : null;
        i = 1;
      } else {
        // The variable being assigned already holds its new value; the walk started from the old one.
        at = base === name ? previous : ctx.host.evaluate(base);
      }
      for (; i < members.length; i++) {
        const m = members[i];
        if ((m !== 'next' && m !== 'prev') || !this.node(ctx, at)) break;
        edges[`${at}>${m}`] = 'TRAVERSING';
        at = this.pointerOf(ctx, at as string, m);
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
  public onScopeExit(ctx: LinkedListContext): void {
    if (!this.hasAnyList(ctx)) return;
    const before = this.nodesOf(ctx).map((n) => (n.tags ?? []).join(',')).join('|');
    this.refresh(ctx);
    const after = this.nodesOf(ctx).map((n) => (n.tags ?? []).join(',')).join('|');
    if (before !== after && ctx.stateManager) {
      ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager.captureSnapshot(ctx.sceneManager.getSceneGraph(), 'Scope exit'));
    }
  }

  /** `NEW_NODE(list, value)`: allocate an unlinked node in heap memory. */
  public allocate(ctx: LinkedListContext, instr: { list: string; value: unknown; resultVar: string; assignTo?: string; sourceText?: string }): void {
    const value = ctx.host.evaluate(instr.value);
    const id = this.createNode(ctx, instr.list, value);
    ctx.host.setVariable(instr.resultVar, id);
    const text = instr.sourceText ?? `NEW_NODE(${instr.list}, ${value})`;
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp: { [instr.assignTo ?? 'new']: id },
      logs: [{ keyword: 'NEW_NODE', message: `${text}   ⟹   node ${value} allocated in heap memory (next = NULL)`, kind: 'info' }],
    });
  }

  /** `FREE ptr`. */
  public free(ctx: LinkedListContext, instr: { target: unknown; sourceText?: string }): void {
    const label = instr.sourceText ?? LinkedListEngine.exprText(instr.target);
    const ref = ctx.host.evaluate(instr.target);
    if (ref === null || ref === undefined) {
      this.note(ctx, 'FREE', `FREE ${label}: ${label} is NULL — nothing to free.`, 'info');
      return;
    }
    if (!LinkedListEngine.isNodeRef(ref)) {
      throw new LinkedListError(`FREE ${label}: ${label} is not a linked-list node.`);
    }
    if (!this.node(ctx, ref)) {
      throw new LinkedListError(`Double free: ${label} points to a node that was already freed.`);
    }
    this.freeNode(ctx, ref, label);
  }

  /** `target.field = value` — a pointer write (`next`, `prev`, `head`) or a value write (`val`). */
  public setField(ctx: LinkedListContext, instr: { target: unknown; field: string; value: unknown; sourceText?: string }): void {
    const what = LinkedListEngine.exprText(instr.target);
    const text = instr.sourceText ?? `${what}.${instr.field} = …`;
    const target = ctx.host.evaluate(instr.target);
    const value = ctx.host.evaluate(instr.value);
    const field = instr.field;

    if (this.isList(ctx, target)) {
      const list = target as string;
      if (field === 'tail' || field === 'length' || field === 'size') {
        throw new LinkedListError(`${list}.${field} cannot be assigned. To change the tail, relink the last node's next pointer.`);
      }
      if (field !== 'head') throw new LinkedListError(`A linked list has no field '${field}'.`);
      const newHead = this.requirePointerTarget(ctx, value, LinkedListEngine.exprText(instr.value));
      const anchor = this.anchor(ctx, list);
      const oldHead: string | null = anchor.headId ?? null;
      anchor.headId = newHead;
      const bypassed = oldHead && oldHead !== newHead && this.pointerOf(ctx, oldHead, 'next') === newHead ? [oldHead] : [];
      this.frame(ctx, {
        nodes: newHead ? { [newHead]: 'MODIFYING' } : {},
        bypassed,
        logs: [{ keyword: 'POINTER', message: `${text}   ⟹   ${list}.head → ${this.describeRef(ctx, newHead)}`, kind: 'relationship' }],
      });
      return;
    }

    const el = this.requireNode(ctx, target, what);
    if (field === 'next' || field === 'prev') {
      if (field === 'prev' && this.variantOf(ctx, el) !== 'DOUBLY') {
        throw new LinkedListError(`${what}.prev does not exist: only DOUBLY linked list nodes have a prev pointer.`);
      }
      const newTarget = this.requirePointerTarget(ctx, value, LinkedListEngine.exprText(instr.value));
      const old = this.pointerOf(ctx, el.id, field);
      this.setPointer(ctx, el.id, field, newTarget);
      // Rewiring a pointer *around* a node (old target's own pointer is the
      // new target) unlinks that node: it moves to heap memory until FREE.
      const bypassed = old && old !== newTarget && this.pointerOf(ctx, old, field) === newTarget ? [old] : [];
      this.frame(ctx, {
        nodes: { [el.id]: 'EVALUATING' },
        edges: newTarget ? { [`${el.id}>${field}`]: 'MODIFYING' } : {},
        bypassed,
        logs: [{ keyword: 'POINTER', message: `${text}   ⟹   node ${el.value}.${field} → ${this.describeRef(ctx, newTarget)}`, kind: 'relationship' }],
      });
      return;
    }
    if (field === 'val' || field === 'value' || field === 'data') {
      const old = el.value;
      el.value = value;
      this.frame(ctx, {
        nodes: { [el.id]: 'MODIFYING' },
        logs: [{ keyword: 'UPDATE', message: `${text}   ⟹   node value ${old} → ${value}`, kind: 'operation' }],
      });
      return;
    }
    throw new LinkedListError(`A node has no field '${field}' (its fields are val, next${this.variantOf(ctx, el) === 'DOUBLY' ? ', prev' : ''}).`);
  }

  // ---------------------------------------------------------------------
  // Built-in operations (one-line shortcuts that still animate every pointer)
  // ---------------------------------------------------------------------

  /** Routes a GENERIC_ACTION on a linked list. Returns false if `actionName` isn't a list operation. */
  public execute(ctx: LinkedListContext, gen: GenericActionInstruction, list: string, index?: number): boolean {
    const action = gen.actionName.toUpperCase();
    const args = gen.args ?? [];
    const valueArg = () => ctx.host.evaluate(args[args.length - 1]);
    switch (action) {
      case 'INSERT_HEAD':
        this.insertHead(ctx, list, valueArg(), 'INSERT_HEAD');
        return true;
      case 'INSERT_TAIL':
        this.insertTail(ctx, list, valueArg());
        return true;
      case 'DELETE_HEAD':
        this.deleteHead(ctx, list, 'DELETE_HEAD');
        return true;
      case 'DELETE_TAIL':
        this.deleteTail(ctx, list);
        return true;
      case 'REVERSE':
        this.reverse(ctx, list);
        return true;
      case 'SEARCH':
        this.search(ctx, list, valueArg());
        return true;
      case 'INSERT':
        if (index === undefined) throw new LinkedListError(`INSERT on a linked list needs a position, e.g. INSERT ${list}[2] 25.`);
        this.insertAt(ctx, list, index, valueArg());
        return true;
      case 'DELETE':
        if (index === undefined) throw new LinkedListError(`DELETE on a linked list needs a position, e.g. DELETE ${list}[2].`);
        this.deleteAt(ctx, list, index);
        return true;
      case 'UPDATE':
        if (index === undefined) throw new LinkedListError(`UPDATE on a linked list needs a position, e.g. UPDATE ${list}[2] 25.`);
        this.updateAt(ctx, list, index, valueArg());
        return true;
      default:
        return false;
    }
  }

  private header(ctx: LinkedListContext, text: string): void {
    this.note(ctx, 'OPERATION', text, 'operation');
  }

  private done(ctx: LinkedListContext, list: string, text: string): void {
    this.note(ctx, 'RESULT', `${text} ${list}: ${this.format(ctx, list)}`, 'result');
  }

  /** Walks `steps` next-pointers from the head, one frame per hop, with a `curr` tag. Returns the node reached. */
  private walk(ctx: LinkedListContext, list: string, steps: number, label = 'curr', extraTemp: Record<string, string | null> = {}): string {
    let curr = this.anchor(ctx, list).headId as string;
    this.frame(ctx, {
      nodes: { [curr]: 'TRAVERSING' },
      temp: { ...extraTemp, [label]: curr },
      logs: [{ keyword: 'TRAVERSE', message: `${label} = ${list}.head   ⟹   node ${this.node(ctx, curr).value}`, kind: 'traversal' }],
    });
    for (let i = 0; i < steps; i++) {
      const next = this.pointerOf(ctx, curr, 'next')!;
      this.frame(ctx, {
        nodes: { [next]: 'TRAVERSING' },
        edges: { [`${curr}>next`]: 'TRAVERSING' },
        temp: { ...extraTemp, [label]: next },
        logs: [{ keyword: 'TRAVERSE', message: `${label} = ${label}.next   ⟹   node ${this.node(ctx, next).value}`, kind: 'traversal' }],
      });
      curr = next;
    }
    return curr;
  }

  /** Walks to the last node (the one whose next is NULL, or the head for a circular list). */
  private walkToTail(ctx: LinkedListContext, list: string, label = 'curr', extraTemp: Record<string, string | null> = {}): string {
    const ids = this.chain(ctx, list);
    return this.walk(ctx, list, ids.length - 1, label, extraTemp);
  }

  private insertHead(ctx: LinkedListContext, list: string, value: unknown, opName: string): void {
    const anchor = this.requireList(ctx, list);
    const variant = anchor.variant;
    this.header(ctx, `${opName} ${list} ${value}`);
    const id = this.createNode(ctx, list, value);
    const temp: Record<string, string | null> = { newNode: id };
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${list}, ${value})   ⟹   allocated in heap memory`, kind: 'info' }],
    });
    const head: string | null = anchor.headId;
    if (head) {
      this.setPointer(ctx, id, 'next', head);
      this.frame(ctx, {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = ${list}.head   ⟹   node ${value} → node ${this.node(ctx, head).value}`, kind: 'relationship' }],
      });
      if (variant === 'DOUBLY') {
        this.setPointer(ctx, head, 'prev', id);
        this.frame(ctx, {
          edges: { [`${head}>prev`]: 'MODIFYING' },
          temp,
          logs: [{ keyword: 'POINTER', message: `${list}.head.prev = newNode   ⟹   node ${this.node(ctx, head).value} ← node ${value}`, kind: 'relationship' }],
        });
      }
      if (variant === 'CIRCULAR') {
        const tail = this.walkToTail(ctx, list, 'tail', temp);
        this.setPointer(ctx, tail, 'next', id);
        this.frame(ctx, {
          edges: { [`${tail}>next`]: 'MODIFYING' },
          temp: { ...temp, tail },
          logs: [{ keyword: 'POINTER', message: `tail.next = newNode   ⟹   the last node now wraps around to node ${value}`, kind: 'relationship' }],
        });
      }
    } else if (variant === 'CIRCULAR') {
      this.setPointer(ctx, id, 'next', id);
      this.frame(ctx, {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = newNode   ⟹   a one-node circle`, kind: 'relationship' }],
      });
    }
    anchor.headId = id;
    this.frame(ctx, {
      nodes: { [id]: 'SUCCESS' },
      temp,
      logs: [{ keyword: 'POINTER', message: `${list}.head = newNode   ⟹   node ${value} is the new head`, kind: 'relationship' }],
    });
    this.done(ctx, list, 'Inserted at head.');
  }

  private insertTail(ctx: LinkedListContext, list: string, value: unknown): void {
    const anchor = this.requireList(ctx, list);
    if (!anchor.headId) {
      this.insertHead(ctx, list, value, 'INSERT_TAIL (empty list)');
      return;
    }
    this.header(ctx, `INSERT_TAIL ${list} ${value}: walk to the last node (O(n) without a tail pointer)`);
    const last = this.walkToTail(ctx, list);
    const id = this.createNode(ctx, list, value);
    const temp: Record<string, string | null> = { curr: last, newNode: id };
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${list}, ${value})   ⟹   allocated in heap memory`, kind: 'info' }],
    });
    if (anchor.variant === 'CIRCULAR') {
      this.setPointer(ctx, id, 'next', anchor.headId);
      this.frame(ctx, {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = ${list}.head   ⟹   keeps the circle closed`, kind: 'relationship' }],
      });
    }
    if (anchor.variant === 'DOUBLY') {
      this.setPointer(ctx, id, 'prev', last);
      this.frame(ctx, {
        edges: { [`${id}>prev`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.prev = curr   ⟹   node ${value} ← node ${this.node(ctx, last).value}`, kind: 'relationship' }],
      });
    }
    this.setPointer(ctx, last, 'next', id);
    this.frame(ctx, {
      nodes: { [id]: 'SUCCESS' },
      edges: { [`${last}>next`]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `curr.next = newNode   ⟹   node ${this.node(ctx, last).value} → node ${value}`, kind: 'relationship' }],
    });
    this.done(ctx, list, 'Inserted at tail.');
  }

  private deleteHead(ctx: LinkedListContext, list: string, opName: string): void {
    const anchor = this.requireList(ctx, list);
    const head: string | null = anchor.headId;
    if (!head) {
      this.note(ctx, 'OPERATION', `${opName} ${list}: the list is empty (head is NULL) — nothing to delete.`, 'operation');
      return;
    }
    this.header(ctx, `${opName} ${list}`);
    const temp: Record<string, string | null> = { temp: head };
    this.frame(ctx, {
      nodes: { [head]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `temp = ${list}.head   ⟹   node ${this.node(ctx, head).value}`, kind: 'traversal' }],
    });
    let newHead = this.pointerOf(ctx, head, 'next');
    if (anchor.variant === 'CIRCULAR') {
      if (newHead === head) {
        newHead = null;
      } else {
        const tail = this.walkToTail(ctx, list, 'tail', temp);
        this.setPointer(ctx, tail, 'next', newHead);
        this.frame(ctx, {
          edges: { [`${tail}>next`]: 'MODIFYING' },
          temp: { ...temp, tail },
          logs: [{ keyword: 'POINTER', message: `tail.next = temp.next   ⟹   the circle now skips node ${this.node(ctx, head).value}`, kind: 'relationship' }],
        });
      }
    }
    anchor.headId = newHead;
    this.frame(ctx, {
      nodes: newHead ? { [newHead]: 'SUCCESS' } : {},
      temp,
      bypassed: [head],
      logs: [{ keyword: 'POINTER', message: `${list}.head = temp.next   ⟹   head → ${this.describeRef(ctx, newHead)}; node ${this.node(ctx, head).value} is unlinked`, kind: 'relationship' }],
    });
    if (anchor.variant === 'DOUBLY' && newHead) {
      this.setPointer(ctx, newHead, 'prev', null);
      this.frame(ctx, {
        temp,
        logs: [{ keyword: 'POINTER', message: `${list}.head.prev = NULL`, kind: 'relationship' }],
      });
    }
    this.freeNode(ctx, head, 'temp');
  }

  private deleteTail(ctx: LinkedListContext, list: string): void {
    const anchor = this.requireList(ctx, list);
    const ids = this.chain(ctx, list);
    if (ids.length <= 1) {
      this.deleteHead(ctx, list, 'DELETE_TAIL');
      return;
    }
    this.header(ctx, `DELETE_TAIL ${list}: walk to the second-to-last node`);
    const prev = this.walk(ctx, list, ids.length - 2, 'prev');
    const last = ids[ids.length - 1];
    const temp: Record<string, string | null> = { prev, temp: last };
    this.frame(ctx, {
      nodes: { [last]: 'MODIFYING' },
      edges: { [`${prev}>next`]: 'TRAVERSING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `temp = prev.next   ⟹   node ${this.node(ctx, last).value} (the tail)`, kind: 'traversal' }],
    });
    const newNext = anchor.variant === 'CIRCULAR' ? anchor.headId : null;
    this.setPointer(ctx, prev, 'next', newNext);
    this.frame(ctx, {
      nodes: { [prev]: 'SUCCESS' },
      edges: newNext ? { [`${prev}>next`]: 'MODIFYING' } : {},
      temp,
      bypassed: [last],
      logs: [{
        keyword: 'POINTER',
        message: `prev.next = ${newNext ? `${list}.head` : 'NULL'}   ⟹   node ${this.node(ctx, prev).value} is the new tail; node ${this.node(ctx, last).value} is unlinked`,
        kind: 'relationship',
      }],
    });
    this.freeNode(ctx, last, 'temp', { prev });
  }

  private reverse(ctx: LinkedListContext, list: string): void {
    const anchor = this.requireList(ctx, list);
    const ids = this.chain(ctx, list);
    if (ids.length < 2) {
      this.note(ctx, 'OPERATION', `REVERSE ${list}: fewer than 2 nodes — already reversed.`, 'operation');
      return;
    }
    const circular = anchor.variant === 'CIRCULAR';
    const doubly = anchor.variant === 'DOUBLY';
    this.header(ctx, `REVERSE ${list}: flip every next pointer with prev / curr / next`);
    const oldHead = ids[0];
    let prev: string | null = null;
    let curr: string | null = oldHead;
    this.frame(ctx, {
      nodes: { [oldHead]: 'TRAVERSING' },
      temp: { prev, curr },
      logs: [{ keyword: 'POINTER', message: `prev = NULL, curr = ${list}.head`, kind: 'traversal' }],
    });
    for (let i = 0; i < ids.length && curr; i++) {
      const next: string | null = circular && i === ids.length - 1 ? null : this.pointerOf(ctx, curr, 'next');
      this.setPointer(ctx, curr, 'next', prev);
      if (doubly) this.setPointer(ctx, curr, 'prev', next);
      this.frame(ctx, {
        nodes: { [curr]: 'MODIFYING' },
        edges: prev ? { [`${curr}>next`]: 'MODIFYING' } : {},
        temp: { prev, curr, next },
        logs: [{
          keyword: 'POINTER',
          message: `next = curr.next; curr.next = prev${doubly ? '; curr.prev = next' : ''}   ⟹   node ${this.node(ctx, curr).value} now points to ${this.describeRef(ctx, prev)}`,
          kind: 'relationship',
        }],
      });
      prev = curr;
      curr = next;
      this.frame(ctx, {
        nodes: curr ? { [curr]: 'TRAVERSING' } : {},
        temp: { prev, curr },
        logs: [{ keyword: 'POINTER', message: `prev = curr; curr = next   ⟹   curr → ${this.describeRef(ctx, curr)}`, kind: 'traversal' }],
      });
    }
    if (circular) this.setPointer(ctx, oldHead, 'next', prev);
    anchor.headId = prev;
    this.frame(ctx, {
      nodes: prev ? { [prev]: 'SUCCESS' } : {},
      logs: [{
        keyword: 'POINTER',
        message: `${list}.head = prev${circular ? `; old head's next = new head (closes the circle)` : ''}   ⟹   node ${this.node(ctx, prev).value} is the new head`,
        kind: 'relationship',
      }],
    });
    this.done(ctx, list, 'Reversed.');
  }

  private search(ctx: LinkedListContext, list: string, value: unknown): void {
    const ids = this.chain(ctx, list);
    this.header(ctx, `SEARCH ${list} ${value}: follow next pointers from the head`);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const found = this.node(ctx, id).value === value;
      this.frame(ctx, {
        nodes: { [id]: found ? 'SUCCESS' : 'EVALUATING' },
        edges: i > 0 ? { [`${ids[i - 1]}>next`]: 'TRAVERSING' } : {},
        temp: { curr: id },
        logs: [{
          keyword: 'COMPARE',
          message: `curr.val = ${this.node(ctx, id).value} ${found ? '==' : '!='} ${value}`,
          kind: 'compare',
        }],
      });
      if (found) {
        this.note(ctx, 'RESULT', `Found ${value} at position ${i} of ${list}.`, 'search', { nodes: { [id]: 'SUCCESS' }, temp: { curr: id } });
        return;
      }
    }
    this.note(ctx, 'RESULT', `${value} is not in ${list} (reached NULL).`, 'search');
  }

  private insertAt(ctx: LinkedListContext, list: string, index: number, value: unknown): void {
    const anchor = this.requireList(ctx, list);
    const n = this.chain(ctx, list).length;
    if (!Number.isInteger(index) || index < 0 || index > n) {
      throw new LinkedListError(`Cannot insert at position ${index} of '${list}': valid positions are 0 to ${n}.`);
    }
    if (index === 0) {
      this.insertHead(ctx, list, value, `INSERT ${list}[0]`);
      return;
    }
    this.header(ctx, `INSERT ${list}[${index}] ${value}: walk to position ${index - 1}`);
    const prev = this.walk(ctx, list, index - 1, 'prev');
    const id = this.createNode(ctx, list, value);
    const temp: Record<string, string | null> = { prev, newNode: id };
    this.frame(ctx, {
      grow: [id],
      nodes: { [id]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${list}, ${value})`, kind: 'info' }],
    });
    const after = this.pointerOf(ctx, prev, 'next');
    if (after) {
      this.setPointer(ctx, id, 'next', after);
      this.frame(ctx, {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = prev.next   ⟹   node ${value} → node ${this.node(ctx, after).value}`, kind: 'relationship' }],
      });
    }
    if (anchor.variant === 'DOUBLY') {
      this.setPointer(ctx, id, 'prev', prev);
      if (after) this.setPointer(ctx, after, 'prev', id);
      this.frame(ctx, {
        edges: { [`${id}>prev`]: 'MODIFYING', ...(after ? { [`${after}>prev`]: 'MODIFYING' } : {}) },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.prev = prev${after ? '; newNode.next.prev = newNode' : ''}`, kind: 'relationship' }],
      });
    }
    this.setPointer(ctx, prev, 'next', id);
    this.frame(ctx, {
      nodes: { [id]: 'SUCCESS' },
      edges: { [`${prev}>next`]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `prev.next = newNode   ⟹   node ${this.node(ctx, prev).value} → node ${value}`, kind: 'relationship' }],
    });
    this.done(ctx, list, `Inserted ${value} at position ${index}.`);
  }

  private deleteAt(ctx: LinkedListContext, list: string, index: number): void {
    const anchor = this.requireList(ctx, list);
    const n = this.chain(ctx, list).length;
    if (!Number.isInteger(index) || index < 0 || index >= n) {
      throw new LinkedListError(
        n === 0 ? `Cannot delete ${list}[${index}]: the list is empty.` : `Cannot delete ${list}[${index}]: valid positions are 0 to ${n - 1}.`
      );
    }
    if (index === 0) {
      this.deleteHead(ctx, list, `DELETE ${list}[0]`);
      return;
    }
    this.header(ctx, `DELETE ${list}[${index}]: walk to position ${index - 1}`);
    const prev = this.walk(ctx, list, index - 1, 'prev');
    const target = this.pointerOf(ctx, prev, 'next')!;
    const temp: Record<string, string | null> = { prev, temp: target };
    this.frame(ctx, {
      nodes: { [target]: 'MODIFYING' },
      edges: { [`${prev}>next`]: 'TRAVERSING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `temp = prev.next   ⟹   node ${this.node(ctx, target).value}`, kind: 'traversal' }],
    });
    const after = this.pointerOf(ctx, target, 'next');
    this.setPointer(ctx, prev, 'next', after);
    this.frame(ctx, {
      edges: after ? { [`${prev}>next`]: 'MODIFYING' } : {},
      temp,
      bypassed: [target],
      logs: [{ keyword: 'POINTER', message: `prev.next = temp.next   ⟹   node ${this.node(ctx, target).value} is unlinked`, kind: 'relationship' }],
    });
    if (anchor.variant === 'DOUBLY' && after) {
      this.setPointer(ctx, after, 'prev', prev);
      this.frame(ctx, {
        edges: { [`${after}>prev`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `temp.next.prev = prev`, kind: 'relationship' }],
      });
    }
    this.freeNode(ctx, target, 'temp', { prev });
  }

  private updateAt(ctx: LinkedListContext, list: string, index: number, value: unknown): void {
    const n = this.chain(ctx, list).length;
    if (!Number.isInteger(index) || index < 0 || index >= n) {
      throw new LinkedListError(`Cannot update ${list}[${index}]: valid positions are 0 to ${n - 1}.`);
    }
    this.header(ctx, `UPDATE ${list}[${index}] ${value}: walk to position ${index}`);
    const curr = this.walk(ctx, list, index);
    const old = this.node(ctx, curr).value;
    this.node(ctx, curr).value = value;
    this.frame(ctx, {
      nodes: { [curr]: 'MODIFYING' },
      temp: { curr },
      logs: [{ keyword: 'UPDATE', message: `curr.val = ${value}   ⟹   ${old} → ${value}`, kind: 'operation' }],
    });
    this.done(ctx, list, 'Updated.');
  }
}

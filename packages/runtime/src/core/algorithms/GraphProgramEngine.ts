/**
 * GraphProgramEngine — the runtime model and animations for graph algorithms
 * written as real code (`GRAPH` declarations used with loops, IFs, queues,
 * stacks and recursion), the graph counterpart of TreeEngine.
 *
 * A graph lives entirely in the scene graph, so stepping back (which
 * restores scene snapshots) restores it exactly:
 *
 * - an anchor element `g:<graph>` (not drawn) holding `directed`,
 *   `weighted` and the next free edge number;
 * - one VERTEX box per vertex, id `gv:<graph>:<name>` — a vertex reference
 *   held in a VM variable is simply this id;
 * - one GRAPH_EDGE per edge, id `ge:<graph>:<n>` (numbered in the order the
 *   edges were listed / added), with its `weight` (1 when unweighted).
 *
 * Programs work on graphs the way textbook pseudocode does:
 *
 *   start = VERTEX(g, "A")            // a vertex by name
 *   LOOP i FROM 0 TO DEGREE(v) - 1    // v's neighbours, in edge order
 *     w = NEIGHBOR(v, i)
 *     IF w.visited == FALSE ...
 *   v.dist = 0                        // any field the algorithm needs
 *   w.parent = v                      // a field may hold a vertex
 *
 * Every field write, every vertex-pointer move, every call / return of a
 * recursive function over vertices and every edit (ADD_EDGE, ...) is its
 * own animated step with a console line. Fields are drawn under the vertex
 * (`dist=4 parent=A`), pointer variables above it. Resting colours come
 * from the fields: `visited` vertices are green, a vertex waiting on the
 * call stack of a recursive function is purple, `v.color = "GRAY"` (or 0, 1,
 * "RED", ...) paints the vertex, and the edge between a vertex and its
 * `parent` — or an edge with a field set to TRUE (`e.inMST = TRUE`) — is
 * drawn green, so the search / shortest-path / spanning tree appears as the
 * algorithm builds it.
 *
 * QUEUEs and STACKs of vertices are drawn by TreeEngine (which asks this
 * engine for a reference's display value).
 */
import { AlgorithmContext } from './AlgorithmContext';
import type { TreeContext } from './TreeEngine';
import { getSemanticColorToken, RuntimeError } from '@aqvl/shared';

/** A graph misuse at run time: unknown vertex, neighbour index out of range, unset field, ... */
export class GraphError extends RuntimeError {
  constructor(message: string) {
    super(message);
    this.name = 'GraphError';
  }
}

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
  /** Pointer tags of this frame that shadow program variables (e.g. the name a DEQUEUE result is about to be stored in). */
  temp?: Record<string, string | null>;
  /** Newly added vertices / edges: scaled up from 0. */
  grow?: string[];
  duration?: number;
}

const TRANSIENT_STATES = new Set(['EVALUATING', 'TRAVERSING', 'MODIFYING', 'ACTIVE']);
const STEP_MS = 480;
const MOVE_MS = 520;

/** Colours a program can paint a vertex with (`v.color = "GRAY"`, `v.color = 1`). */
const NAMED_COLORS: Record<string, string> = {
  WHITE: '#e2e8f0',
  GRAY: '#f59e0b',
  GREY: '#f59e0b',
  BLACK: '#475569',
  RED: '#ef4444',
  BLUE: '#3b82f6',
  GREEN: '#10b981',
  YELLOW: '#facc15',
  ORANGE: '#fb923c',
  PURPLE: '#a855f7',
  PINK: '#ec4899',
};
const INDEX_COLORS = ['#f472b6', '#a3e635', '#fbbf24', '#a855f7', '#22d3ee'];

/** Fields every vertex / edge has, computed from the graph itself (read-only). */
const VERTEX_BUILTIN_FIELDS = new Set(['name', 'val', 'value', 'label', 'degree']);
const EDGE_BUILTIN_FIELDS = new Set(['from', 'to', 'weight', 'source', 'target']);

export class GraphProgramEngine {
  // ---------------------------------------------------------------------
  // References
  // ---------------------------------------------------------------------

  /** True for a vertex reference (`gv:<graph>:<name>`), whether or not the vertex still exists. */
  public static isVertexRef(value: unknown): value is string {
    return typeof value === 'string' && /^gv:[^:]+:.+$/.test(value);
  }

  /** True for an edge reference (`ge:<graph>:<n>`). */
  public static isEdgeRef(value: unknown): value is string {
    return typeof value === 'string' && /^ge:[^:]+:\d+$/.test(value);
  }

  public static isRef(value: unknown): value is string {
    return GraphProgramEngine.isVertexRef(value) || GraphProgramEngine.isEdgeRef(value);
  }

  private anchor(ctx: AlgorithmContext, graph: unknown): any {
    return typeof graph === 'string' ? (ctx.sceneManager.getElement(`g:${graph}`) as any) : undefined;
  }

  public isGraph(ctx: AlgorithmContext, name: unknown): boolean {
    return !!this.anchor(ctx, name);
  }

  public hasAnyGraph(ctx: AlgorithmContext): boolean {
    return ctx.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'GRAPH' && el.type === 'GRAPH');
  }

  /** True when `value` belongs to a graph: a graph name or a vertex / edge reference. */
  public owns(ctx: AlgorithmContext, value: unknown): boolean {
    return GraphProgramEngine.isRef(value) || this.isGraph(ctx, value);
  }

  private requireGraph(ctx: AlgorithmContext, graph: unknown, text: string): any {
    const a = this.anchor(ctx, graph);
    if (!a) throw new GraphError(`${text}: '${String(graph)}' is not a declared GRAPH.`);
    return a;
  }

  private vertexEl(ctx: AlgorithmContext, ref: unknown): any {
    return GraphProgramEngine.isVertexRef(ref) ? (ctx.sceneManager.getElement(ref) as any) : undefined;
  }

  private edgeEl(ctx: AlgorithmContext, ref: unknown): any {
    return GraphProgramEngine.isEdgeRef(ref) ? (ctx.sceneManager.getElement(ref) as any) : undefined;
  }

  /** The graph's vertices, in the order they were declared / added. */
  private verticesOf(ctx: AlgorithmContext, graph?: string): any[] {
    return (ctx.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.originalType === 'VERTEX' && GraphProgramEngine.isVertexRef(el.id) && (graph === undefined || el.logicalParent === graph))
      .sort((a, b) => (a.logicalIndex ?? 0) - (b.logicalIndex ?? 0));
  }

  /** The graph's edges, in the order they were declared / added. */
  private edgesOf(ctx: AlgorithmContext, graph?: string): any[] {
    const number = (el: any) => Number(el.id.slice(el.id.lastIndexOf(':') + 1));
    return (ctx.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.originalType === 'GRAPH_EDGE' && GraphProgramEngine.isEdgeRef(el.id) && (graph === undefined || el.logicalParent === graph))
      .sort((a, b) => number(a) - number(b));
  }

  private isDirected(ctx: AlgorithmContext, graph: string): boolean {
    return !!this.anchor(ctx, graph)?.directed;
  }

  /** `v` — the vertex's name, for messages. */
  private nameOf(ctx: AlgorithmContext, ref: unknown): string {
    const el = this.vertexEl(ctx, ref);
    return el ? String(el.value) : 'a removed vertex';
  }

  /** The edges leaving `v` (for an undirected graph: every edge touching it), in edge order, each with the vertex at its other end. */
  private adjacency(ctx: AlgorithmContext, v: any): { edge: any; other: string }[] {
    const directed = this.isDirected(ctx, v.logicalParent);
    const out: { edge: any; other: string }[] = [];
    for (const e of this.edgesOf(ctx, v.logicalParent)) {
      if (e.sourceId === v.id) out.push({ edge: e, other: e.targetId });
      else if (!directed && e.targetId === v.id) out.push({ edge: e, other: e.sourceId });
    }
    return out;
  }

  /** The edge from `a` to `b` (either way round in an undirected graph), or undefined. */
  private edgeBetween(ctx: AlgorithmContext, a: string, b: string): any {
    const graph = this.vertexEl(ctx, a)?.logicalParent;
    const directed = this.isDirected(ctx, graph);
    return this.edgesOf(ctx, graph).find(
      (e) => (e.sourceId === a && e.targetId === b) || (!directed && e.sourceId === b && e.targetId === a)
    );
  }

  private static exprText(expr: unknown): string {
    if (typeof expr === 'string') return expr;
    if (expr && typeof expr === 'object') {
      if ('member' in (expr as any)) return `${GraphProgramEngine.exprText((expr as any).object)}.${(expr as any).member}`;
      if ('gfn' in (expr as any)) return (expr as any).source;
      if ('text' in (expr as any)) return `"${(expr as any).text}"`;
    }
    if (expr === null) return 'NULL';
    return 'the value';
  }

  /** Throws a descriptive error unless `ref` is a live vertex. `what` names the operand (e.g. `v`). */
  private requireVertex(ctx: AlgorithmContext, ref: unknown, what: string): any {
    if (ref === null || ref === undefined) {
      throw new GraphError(`NULL pointer dereference: ${what} is NULL, not a vertex.`);
    }
    if (GraphProgramEngine.isEdgeRef(ref)) {
      throw new GraphError(`${what} is an edge, not a vertex (use ${what}.from or ${what}.to for its end vertices).`);
    }
    if (!GraphProgramEngine.isVertexRef(ref)) {
      throw new GraphError(
        `${what} is not a vertex (its value is ${JSON.stringify(ref)}). Get a vertex with VERTEX(g, "A"), VERTEX_AT(g, i) or NEIGHBOR(v, i).`
      );
    }
    const el = this.vertexEl(ctx, ref);
    if (!el) throw new GraphError(`${what} refers to vertex ${ref.slice(ref.indexOf(':', 3) + 1)}, which was removed from the graph.`);
    return el;
  }

  private requireEdge(ctx: AlgorithmContext, ref: unknown, what: string): any {
    if (ref === null || ref === undefined) throw new GraphError(`NULL pointer dereference: ${what} is NULL, not an edge.`);
    const el = this.edgeEl(ctx, ref);
    if (!el) throw new GraphError(`${what} is not an edge of a graph (get one with EDGE_AT(g, i)).`);
    return el;
  }

  private static requireIndex(value: unknown, text: string): number {
    const n = Number(value);
    if (typeof value === 'boolean' || !Number.isInteger(n)) {
      throw new GraphError(`${text}: the index must be a whole number (got ${JSON.stringify(value)}).`);
    }
    return n;
  }

  /** A vertex given by reference or by name (`"A"`) within `graph`. */
  private resolveVertex(ctx: AlgorithmContext, graph: string, value: unknown, text: string): any {
    if (GraphProgramEngine.isVertexRef(value)) {
      const el = this.requireVertex(ctx, value, text);
      if (el.logicalParent !== graph) throw new GraphError(`${text}: vertex ${el.value} belongs to graph '${el.logicalParent}', not '${graph}'.`);
      return el;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const el = ctx.sceneManager.getElement(`gv:${graph}:${value}`) as any;
      if (!el) throw new GraphError(`${text}: graph '${graph}' has no vertex named "${value}". Its vertices are ${this.verticesOf(ctx, graph).map((v) => v.value).join(', ') || '(none)'}.`);
      return el;
    }
    throw new GraphError(`${text}: expected a vertex or a vertex name, got ${JSON.stringify(value)}.`);
  }

  // ---------------------------------------------------------------------
  // Reads: built-ins and fields (pure — no animation of their own)
  // ---------------------------------------------------------------------

  /** `VERTEX(g, "A")`, `NEIGHBOR(v, i)`, `DEGREE(v)`, ... with already-evaluated arguments. */
  public read(ctx: AlgorithmContext, fn: string, args: unknown[], text: string, argTexts: string[] = []): unknown {
    // `DEGREE(x): x is not a vertex ...` — the argument named as written.
    const arg = (i: number) => `${text}: ${argTexts[i] ?? `argument ${i + 1}`}`;
    switch (fn) {
      case 'VERTEX': {
        const a = this.requireGraph(ctx, args[0], text);
        return this.resolveVertex(ctx, a.logicalParent, args[1], text).id;
      }
      case 'VERTEX_AT': {
        const a = this.requireGraph(ctx, args[0], text);
        const vertices = this.verticesOf(ctx, a.logicalParent);
        const i = GraphProgramEngine.requireIndex(args[1], text);
        if (i < 0 || i >= vertices.length) {
          throw new GraphError(`${text}: index ${i} is out of range — '${a.logicalParent}' has ${vertices.length} vertices (indexes 0 to ${vertices.length - 1}).`);
        }
        return vertices[i].id;
      }
      case 'VERTEX_COUNT':
        return this.verticesOf(ctx, this.requireGraph(ctx, args[0], text).logicalParent).length;
      case 'EDGE_COUNT':
        return this.edgesOf(ctx, this.requireGraph(ctx, args[0], text).logicalParent).length;
      case 'EDGE_AT': {
        const a = this.requireGraph(ctx, args[0], text);
        const edges = this.edgesOf(ctx, a.logicalParent);
        const i = GraphProgramEngine.requireIndex(args[1], text);
        if (i < 0 || i >= edges.length) {
          throw new GraphError(`${text}: index ${i} is out of range — '${a.logicalParent}' has ${edges.length} edges (indexes 0 to ${edges.length - 1}).`);
        }
        return edges[i].id;
      }
      case 'DEGREE':
        return this.adjacency(ctx, this.requireVertex(ctx, args[0], arg(0))).length;
      case 'IN_DEGREE': {
        const v = this.requireVertex(ctx, args[0], arg(0));
        if (!this.isDirected(ctx, v.logicalParent)) return this.adjacency(ctx, v).length;
        return this.edgesOf(ctx, v.logicalParent).filter((e) => e.targetId === v.id).length;
      }
      case 'NEIGHBOR': {
        const v = this.requireVertex(ctx, args[0], arg(0));
        const adj = this.adjacency(ctx, v);
        const i = GraphProgramEngine.requireIndex(args[1], text);
        if (i < 0 || i >= adj.length) {
          throw new GraphError(
            adj.length === 0
              ? `${text}: vertex ${v.value} has no neighbours (DEGREE is 0), so there is no neighbour ${i}. (LOOP i FROM 0 TO DEGREE(v) - 1 counts down to -1 when DEGREE is 0 — use WHILE i < DEGREE(v) instead.)`
              : `${text}: vertex ${v.value} has ${adj.length} neighbour${adj.length === 1 ? '' : 's'} — valid indexes are 0 to ${adj.length - 1}, not ${i}. Loop with i = 0 / WHILE i < DEGREE(v) … i = i + 1.`
          );
        }
        return adj[i].other;
      }
      case 'WEIGHT': {
        const a = this.requireVertex(ctx, args[0], arg(0));
        const b = this.requireVertex(ctx, args[1], arg(1));
        const e = this.edgeBetween(ctx, a.id, b.id);
        if (!e) throw new GraphError(`${text}: there is no edge from ${a.value} to ${b.value}. Check HAS_EDGE first.`);
        return e.weight ?? 1;
      }
      case 'HAS_EDGE': {
        const a = this.requireVertex(ctx, args[0], arg(0));
        const b = this.requireVertex(ctx, args[1], arg(1));
        return !!this.edgeBetween(ctx, a.id, b.id);
      }
      default:
        throw new GraphError(`${text}: unknown graph function ${fn}.`);
    }
  }

  /** `v.dist`, `v.name`, `e.weight`, `e.from`, ... */
  public readMember(ctx: AlgorithmContext, object: unknown, member: string, objectExpr: unknown): unknown {
    const what = GraphProgramEngine.exprText(objectExpr);
    if (this.isGraph(ctx, object)) {
      const graph = object as string;
      if (member === 'size' || member === 'length' || member === 'vertices') return this.verticesOf(ctx, graph).length;
      if (member === 'edges') return this.edgesOf(ctx, graph).length;
      throw new GraphError(`A graph has no field '${member}'. Use VERTEX_COUNT(${graph}), EDGE_COUNT(${graph}), VERTEX(${graph}, "A") or VERTEX_AT(${graph}, i).`);
    }
    if (object === null || object === undefined) {
      throw new GraphError(`NULL pointer dereference: cannot read ${what}.${member} because ${what} is NULL.`);
    }
    if (GraphProgramEngine.isEdgeRef(object)) {
      const e = this.requireEdge(ctx, object, what);
      if (member === 'from' || member === 'source') return e.sourceId;
      if (member === 'to' || member === 'target') return e.targetId;
      if (member === 'weight') return e.weight ?? 1;
      const fields = e.fields ?? {};
      if (member in fields) return fields[member];
      throw new GraphError(
        `${what}.${member} has not been set yet. An edge's own fields are from, to and weight; set ${what}.${member} = … before reading it.`
      );
    }
    const v = this.requireVertex(ctx, object, what);
    if (member === 'name' || member === 'val' || member === 'value' || member === 'label') return v.value;
    if (member === 'degree') return this.adjacency(ctx, v).length;
    const fields = v.fields ?? {};
    if (member in fields) return fields[member];
    if (member === 'visited') return false;
    throw new GraphError(
      `${what}.${member} has not been set yet (vertex ${v.value}). Give every vertex a starting value first, e.g. LOOP i FROM 0 TO VERTEX_COUNT(g) - 1 … v.${member} = …`
    );
  }

  // ---------------------------------------------------------------------
  // Display
  // ---------------------------------------------------------------------

  /** A value as shown in a vertex label / call arguments: `4`, `∞`, `A`, `NULL`, `TRUE`. */
  private short(ctx: AlgorithmContext, v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '-∞';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
    if (GraphProgramEngine.isVertexRef(v)) return this.nameOf(ctx, v);
    if (GraphProgramEngine.isEdgeRef(v)) return this.edgeText(ctx, v);
    return String(v);
  }

  private edgeText(ctx: AlgorithmContext, ref: unknown): string {
    const e = this.edgeEl(ctx, ref);
    if (!e) return 'a removed edge';
    const graph = this.anchor(ctx, e.logicalParent);
    const arrow = graph?.directed ? '->' : '-';
    return `${this.nameOf(ctx, e.sourceId)}${arrow}${this.nameOf(ctx, e.targetId)}${graph?.weighted ? `(${e.weight ?? 1})` : ''}`;
  }

  /** The value a queue / stack box shows for a reference (see TreeEngine), or undefined when `ref` is not this engine's. */
  public displayValue(ctx: AlgorithmContext, ref: unknown): unknown {
    if (GraphProgramEngine.isVertexRef(ref)) return this.vertexEl(ctx, ref)?.value ?? 'removed';
    if (GraphProgramEngine.isEdgeRef(ref)) return this.edgeText(ctx, ref);
    return undefined;
  }

  /** Value formatting for PRINT: a vertex prints as its name, an edge as `A-B(4)`. */
  public formatValue(ctx: AlgorithmContext, value: unknown): string | null {
    if (value === Infinity) return 'INFINITY';
    if (value === -Infinity) return '-INFINITY';
    if (GraphProgramEngine.isRef(value)) return this.short(ctx, value);
    return null;
  }

  /** `PRINT g`: the adjacency list, e.g. `A: B(4) C(1) | B: A(4) D(1) | …`. */
  public format(ctx: AlgorithmContext, graph: string): string {
    const weighted = !!this.anchor(ctx, graph)?.weighted;
    const vertices = this.verticesOf(ctx, graph);
    if (vertices.length === 0) return '(empty graph)';
    return vertices
      .map((v) => {
        const adj = this.adjacency(ctx, v).map(({ edge, other }) => `${this.nameOf(ctx, other)}${weighted ? `(${edge.weight ?? 1})` : ''}`);
        return `${v.value}: ${adj.length > 0 ? adj.join(' ') : '-'}`;
      })
      .join(' | ');
  }

  // ---------------------------------------------------------------------
  // Derived state: tags, labels, resting colours
  // ---------------------------------------------------------------------

  /**
   * Recomputes every vertex's tags (pointer variables that point at it),
   * label (its fields) and resting colour, and every edge's resting colour.
   * `temp` adds tags of this frame (e.g. a DEQUEUE result about to be stored).
   */
  public refresh(ctx: TreeContext, temp: Record<string, string | null> = {}): void {
    if (!this.hasAnyGraph(ctx)) return;
    const names = new Map<string, string[]>();
    const addName = (id: unknown, name: string) => {
      if (!GraphProgramEngine.isVertexRef(id)) return;
      if (!names.has(id)) names.set(id, []);
      if (!names.get(id)!.includes(name)) names.get(id)!.push(name);
    };
    for (const [name, value] of Object.entries(ctx.host.visibleVariables())) if (!(name in temp)) addName(value, name);
    for (const [name, value] of Object.entries(temp)) addName(value, name);

    // Vertices held by calls that are waiting for a deeper call to return.
    const onStack = new Set<string>();
    const stack = ctx.host.callStack();
    for (const frame of stack.slice(0, -1)) {
      for (const v of Object.values(frame.locals)) if (GraphProgramEngine.isVertexRef(v)) onStack.add(v);
    }

    const treeEdges = new Set<string>();
    for (const v of this.verticesOf(ctx)) {
      const fields = v.fields ?? {};
      const parts: string[] = [];
      for (const [k, value] of Object.entries(fields)) {
        if (k === 'visited' || k === 'color') continue;
        parts.push(`${k}=${this.short(ctx, value)}`);
      }
      v.label = parts.slice(0, 3).join('  ');
      v.tags = names.get(v.id) ?? [];
      v.onCallStack = onStack.has(v.id);
      const parent = fields.parent;
      if (GraphProgramEngine.isVertexRef(parent) && this.vertexEl(ctx, parent)) {
        const e = this.edgeBetween(ctx, parent, v.id) ?? this.edgeBetween(ctx, v.id, parent);
        if (e) treeEdges.add(e.id);
      }
    }
    for (const e of this.edgesOf(ctx)) {
      e.marked = treeEdges.has(e.id) || Object.values(e.fields ?? {}).some((x) => x === true);
    }
    this.restoreBaseColors(ctx);
  }

  /** The colour a program painted a vertex with (`v.color = "GRAY"` / `1`), if any. */
  private static paint(value: unknown): string | undefined {
    if (typeof value === 'string') return NAMED_COLORS[value.toUpperCase()];
    // A negative number (e.g. -1 = "no colour yet") leaves the vertex unpainted.
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return INDEX_COLORS[value % INDEX_COLORS.length];
    return undefined;
  }

  /** Resting colours: painted > waiting on the call stack (purple) > visited (green) > unvisited (blue); marked edges green. */
  public restoreBaseColors(ctx: AlgorithmContext): void {
    if (!this.hasAnyGraph(ctx)) return;
    const neutral = getSemanticColorToken('NEUTRAL');
    for (const v of this.verticesOf(ctx)) {
      if (v.state && v.state !== 'NEUTRAL') continue;
      const fields = v.fields ?? {};
      const painted = GraphProgramEngine.paint(fields.color);
      const token = getSemanticColorToken(v.onCallStack ? 'AUXILIARY' : fields.visited === true ? 'SUCCESS' : 'NEUTRAL');
      v.color = painted ?? token.color;
      v.emissiveColor = painted ?? token.emissiveColor;
      v.emissiveIntensity = token.emissiveIntensity;
    }
    const success = getSemanticColorToken('SUCCESS');
    for (const e of this.edgesOf(ctx)) {
      if (e.state && e.state !== 'NEUTRAL') continue;
      e.color = e.marked ? success.color : neutral.color;
      e.emissiveColor = e.marked ? success.emissiveColor : neutral.emissiveColor;
      e.emissiveIntensity = e.marked ? success.emissiveIntensity : neutral.emissiveIntensity;
      e.isHighlighted = !!e.marked;
    }
  }

  /** Computes tags / labels / colours for freshly loaded graphs (before any step runs). */
  public initialize(ctx: TreeContext): void {
    if (!this.hasAnyGraph(ctx)) return;
    // The first layout is computed right after this; it must already see
    // the edges, or it places the vertices ignoring them and they all jump
    // to new places at the first step.
    ctx.relationshipManager?.loadFromScene(ctx.sceneManager.getSceneGraph());
    this.refresh(ctx);
  }

  /** After a step-back restore: every vertex full size and exactly at its layout position. */
  public settleAfterRestore(ctx: AlgorithmContext): void {
    if (!this.hasAnyGraph(ctx)) return;
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const v of this.verticesOf(ctx)) v.scale = { x: 1, y: 1, z: 1 };
    ctx.layoutManager.updateLayout(graph);
    for (const v of this.verticesOf(ctx)) if (v.worldTarget) v.position = { ...v.worldTarget };
  }

  private isGraphElement(el: any): boolean {
    return (el.originalType === 'VERTEX' && GraphProgramEngine.isVertexRef(el.id)) || (el.originalType === 'GRAPH_EDGE' && GraphProgramEngine.isEdgeRef(el.id));
  }

  private highlight(el: any, state: string): void {
    const token = getSemanticColorToken(state);
    el.state = token.name;
    el.isHighlighted = true;
    el.highlightType = token.name;
    el.color = token.color;
    el.emissiveColor = token.emissiveColor;
    el.emissiveIntensity = token.emissiveIntensity;
  }

  // ---------------------------------------------------------------------
  // Frames: one visible beat of a step
  // ---------------------------------------------------------------------

  /**
   * Commits one visible beat: recomputes tags / labels / colours and layout,
   * applies this beat's highlights, captures the scene as it looks now and
   * schedules it (with its console lines), then glides moved vertices.
   */
  private frame(ctx: TreeContext, o: FrameOptions = {}): void {
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const el of graph) {
      if (this.isGraphElement(el) && TRANSIENT_STATES.has(el.state)) {
        el.state = 'NEUTRAL';
        el.highlightType = undefined;
        el.isHighlighted = false;
      }
    }
    this.refresh(ctx, o.temp);
    ctx.layoutManager.updateLayout(graph);
    for (const [id, state] of Object.entries(o.nodes ?? {})) {
      const el = ctx.sceneManager.getElement(id);
      if (el) this.highlight(el, state);
    }
    for (const id of o.grow ?? []) {
      const el = ctx.sceneManager.getElement(id) as any;
      if (el?.worldTarget) Object.assign(el.position, el.worldTarget);
    }

    const snapshot = ctx.stateManager?.captureSnapshot(graph, 'Graph', ctx.scheduler.getCurrentTime());
    const logs = o.logs ?? [];
    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        if (snapshot) ctx.eventDispatcher.dispatch('STATE_UPDATED', snapshot);
        for (const log of logs) ctx.eventDispatcher.dispatch('RUNTIME_LOG', { ...log, timestamp: Date.now() });
      },
    });
    ctx.scheduler.commitSequential();

    const duration = o.duration ?? STEP_MS;
    let moved = false;
    for (const el of graph) {
      if (!(el.originalType === 'VERTEX' && GraphProgramEngine.isVertexRef(el.id))) continue;
      const t = el.worldTarget;
      if (!t) continue;
      if (Math.abs(t.x - el.position.x) + Math.abs(t.y - el.position.y) + Math.abs(t.z - el.position.z) < 1e-3) continue;
      ctx.scheduler.enqueue({ targets: el.position, x: t.x, y: t.y, z: t.z, duration, easing: 'easeInOutCubic' });
      moved = true;
    }
    for (const id of o.grow ?? []) {
      const el = ctx.sceneManager.getElement(id) as any;
      if (!el?.scale) continue;
      ctx.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration, easing: 'easeOutBack' });
      moved = true;
    }
    if (moved) ctx.scheduler.commitGroup(true);
    else ctx.scheduler.advanceCursor(duration);
  }

  // ---------------------------------------------------------------------
  // Program-level steps
  // ---------------------------------------------------------------------

  /** Whether an assignment of `value` (previously `previous`) moves a vertex / edge pointer and should be animated. */
  public isPointerAssignment(ctx: AlgorithmContext, value: unknown, previous: unknown): boolean {
    if (!this.hasAnyGraph(ctx)) return false;
    return GraphProgramEngine.isRef(value) || (GraphProgramEngine.isRef(previous) && value === null);
  }

  /**
   * `w = NEIGHBOR(v, i)`, `u = VERTEX(g, "A")`, `v = v.parent`: the variable's
   * tag moves to the vertex it now refers to, which lights up — and for
   * NEIGHBOR / parent the edge that was followed lights up too.
   */
  public animatePointerMove(ctx: TreeContext, name: string, value: unknown, previous: unknown, sourceText?: string, valueExpr?: unknown): void {
    const nodes: Record<string, string> = {};
    let where: string;
    if (value === null || value === undefined) {
      where = `${name} is NULL`;
    } else if (GraphProgramEngine.isEdgeRef(value)) {
      const e = this.edgeEl(ctx, value);
      if (e) {
        nodes[e.id] = 'TRAVERSING';
        nodes[e.sourceId] = 'EVALUATING';
        nodes[e.targetId] = 'EVALUATING';
      }
      where = `${name} → edge ${this.edgeText(ctx, value)}`;
    } else {
      nodes[value as string] = 'TRAVERSING';
      where = `${name} → vertex ${this.nameOf(ctx, value)}`;
      // The edge the expression followed: NEIGHBOR(v, i) from v, or `x.parent` back to x's parent.
      let from: unknown;
      const expr = valueExpr as any;
      if (expr && typeof expr === 'object' && expr.gfn === 'NEIGHBOR') {
        const base = expr.args?.[0];
        from = base === name ? previous : ctx.host.evaluate(base);
      } else if (expr && typeof expr === 'object' && 'member' in expr && expr.member === 'parent') {
        from = expr.object === name ? previous : ctx.host.evaluate(expr.object);
      }
      if (GraphProgramEngine.isVertexRef(from) && this.vertexEl(ctx, from)) {
        const e = this.edgeBetween(ctx, from, value as string) ?? this.edgeBetween(ctx, value as string, from);
        if (e) nodes[e.id] = 'TRAVERSING';
        if (from !== value) nodes[from] = 'EVALUATING';
      }
    }
    this.frame(ctx, {
      nodes,
      duration: MOVE_MS,
      logs: [{ keyword: 'POINTER', message: `${sourceText ?? name}   ⟹   ${where}`, kind: 'traversal' }],
    });
  }

  /** Pointer variables went out of scope: drop their tags. */
  public onScopeExit(ctx: TreeContext): void {
    if (!this.hasAnyGraph(ctx)) return;
    const before = this.verticesOf(ctx).map((v) => (v.tags ?? []).join(',')).join('|');
    this.refresh(ctx);
    const after = this.verticesOf(ctx).map((v) => (v.tags ?? []).join(',')).join('|');
    if (before !== after && ctx.stateManager) {
      ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager.captureSnapshot(ctx.sceneManager.getSceneGraph(), 'Scope exit'));
    }
  }

  /**
   * A user function was called / returned in a graph program (recursive DFS,
   * ...). Each is a step: the vertex passed in lights up, vertices of the
   * calls still waiting turn purple, and the console shows the call nested
   * by depth.
   */
  public onCall(ctx: TreeContext, e: { kind: 'call' | 'return'; functionName: string; args?: Record<string, unknown>; value?: unknown; depth: number }): void {
    const args = e.args ?? {};
    const argText = Object.values(args).map((v) => this.short(ctx, v)).join(', ');
    const indent = '│  '.repeat(Math.max(0, e.depth - 1));
    const nodes: Record<string, string> = {};
    for (const v of Object.values(args)) {
      if (this.vertexEl(ctx, v)) nodes[v as string] = e.kind === 'call' ? 'TRAVERSING' : 'EVALUATING';
    }
    if (e.kind === 'call') {
      this.frame(ctx, {
        nodes,
        duration: MOVE_MS,
        logs: [{ keyword: 'CALL', message: `${indent}${e.functionName}(${argText})`, kind: 'traversal' }],
      });
      return;
    }
    const returned = e.value === undefined ? '' : `   → returns ${this.short(ctx, e.value)}`;
    this.frame(ctx, {
      nodes,
      duration: MOVE_MS,
      logs: [{ keyword: 'RETURN', message: `${indent}${e.functionName}(${argText}) done${returned}`, kind: 'step' }],
    });
  }

  /** `v.dist = 0`, `w.parent = v`, `v.visited = TRUE`, `e.inMST = TRUE`. */
  public setField(ctx: TreeContext, instr: { target: unknown; field: string; value: unknown; sourceText?: string }): void {
    const what = GraphProgramEngine.exprText(instr.target);
    const text = instr.sourceText ?? `${what}.${instr.field} = …`;
    const target = ctx.host.evaluate(instr.target);
    const value = ctx.host.evaluate(instr.value);
    const field = instr.field;

    if (this.isGraph(ctx, target)) {
      throw new GraphError(`${text}: a graph has no fields to set. Set fields on its vertices, e.g. v.${field} = …`);
    }
    if (value === undefined) throw new GraphError(`${text}: the value is undefined.`);
    if (GraphProgramEngine.isVertexRef(value)) this.requireVertex(ctx, value, GraphProgramEngine.exprText(instr.value));

    if (GraphProgramEngine.isEdgeRef(target)) {
      const e = this.requireEdge(ctx, target, what);
      if (EDGE_BUILTIN_FIELDS.has(field)) {
        throw new GraphError(`${text}: ${what}.${field} is part of the edge itself and cannot be assigned. Use ADD_EDGE / REMOVE_EDGE to change the graph.`);
      }
      const old = (e.fields ?? {})[field];
      e.fields = { ...(e.fields ?? {}), [field]: value };
      this.frame(ctx, {
        nodes: { [e.id]: 'MODIFYING' },
        logs: [{
          keyword: 'UPDATE',
          message: `${text}   ⟹   edge ${this.edgeText(ctx, e.id)}: ${field} = ${this.short(ctx, value)}${old !== undefined ? ` (was ${this.short(ctx, old)})` : ''}`,
          kind: 'operation',
        }],
      });
      return;
    }

    const v = this.requireVertex(ctx, target, what);
    if (VERTEX_BUILTIN_FIELDS.has(field)) {
      throw new GraphError(
        `${text}: ${what}.${field} is ${field === 'degree' ? 'computed from the edges' : "the vertex's name"} and cannot be assigned. Store your own data in a field of your choice, e.g. ${what}.dist or ${what}.parent.`
      );
    }
    const old = (v.fields ?? {})[field];
    v.fields = { ...(v.fields ?? {}), [field]: value };
    const nodes: Record<string, string> = { [v.id]: 'MODIFYING' };
    if (field === 'parent' && GraphProgramEngine.isVertexRef(value)) {
      const e = this.edgeBetween(ctx, value, v.id) ?? this.edgeBetween(ctx, v.id, value);
      if (e) nodes[e.id] = 'MODIFYING';
      nodes[value] = 'EVALUATING';
    }
    const changed = old !== undefined ? ` (was ${this.short(ctx, old)})` : '';
    this.frame(ctx, {
      nodes,
      logs: [{
        keyword: field === 'visited' ? 'VISIT' : 'UPDATE',
        message: `${text}   ⟹   vertex ${v.value}: ${field} = ${this.short(ctx, value)}${changed}`,
        kind: field === 'visited' ? 'traversal' : 'operation',
      }],
    });
  }

  /** `ADD_VERTEX g "E"`, `ADD_EDGE g "A" "B" 4`, `REMOVE_EDGE g u w`, `REMOVE_VERTEX g "C"`. */
  public edit(ctx: TreeContext, instr: { op: string; graph: string; args: unknown[]; sourceText?: string }): void {
    const text = instr.sourceText ?? instr.op;
    const anchor = this.requireGraph(ctx, instr.graph, text);
    const graph = anchor.logicalParent as string;
    const args = instr.args.map((a) => ctx.host.evaluate(a));
    const arrow = anchor.directed ? '->' : '-';

    switch (instr.op) {
      case 'ADD_VERTEX': {
        if (args.length !== 1) throw new GraphError(`${text}: write ADD_VERTEX ${graph} "name".`);
        const name = args[0];
        if (typeof name !== 'string' && typeof name !== 'number') {
          throw new GraphError(`${text}: a vertex name must be text or a number, e.g. ADD_VERTEX ${graph} "E".`);
        }
        if (ctx.sceneManager.getElement(`gv:${graph}:${name}`)) {
          throw new GraphError(`${text}: graph '${graph}' already has a vertex named "${name}".`);
        }
        const id = this.createVertex(ctx, graph, String(name));
        this.frame(ctx, {
          grow: [id],
          nodes: { [id]: 'MODIFYING' },
          logs: [{ keyword: 'ADD_VERTEX', message: `${text}   ⟹   vertex ${name} added (no edges yet); ${graph} has ${this.verticesOf(ctx, graph).length} vertices`, kind: 'operation' }],
        });
        return;
      }
      case 'ADD_EDGE': {
        if (args.length < 2 || args.length > 3) throw new GraphError(`${text}: write ADD_EDGE ${graph} "A" "B" (and a weight, e.g. ADD_EDGE ${graph} "A" "B" 4).`);
        // Like the declaration, an edge to a name not in the graph yet creates that vertex.
        const created: string[] = [];
        for (const end of [args[0], args[1]]) {
          if ((typeof end === 'string' || typeof end === 'number') && !GraphProgramEngine.isVertexRef(end) && !ctx.sceneManager.getElement(`gv:${graph}:${end}`)) {
            created.push(this.createVertex(ctx, graph, String(end)));
          }
        }
        const a = this.resolveVertex(ctx, graph, args[0], text);
        const b = this.resolveVertex(ctx, graph, args[1], text);
        const weight = args.length === 3 ? Number(args[2]) : 1;
        if (!Number.isFinite(weight)) throw new GraphError(`${text}: the weight must be a number (got ${JSON.stringify(args[2])}).`);
        if (a.id === b.id) throw new GraphError(`${text}: an edge from ${a.value} to itself (a self-loop) is not allowed here.`);
        if (this.edgeBetween(ctx, a.id, b.id)) throw new GraphError(`${text}: there is already an edge ${a.value}${arrow}${b.value}.`);
        if (args.length === 3 && !anchor.weighted) {
          anchor.weighted = true;
          for (const e of this.edgesOf(ctx, graph)) e.properties = { ...(e.properties ?? {}), label: String(e.weight ?? 1) };
        }
        const n = anchor.nextEdgeNumber ?? 0;
        anchor.nextEdgeNumber = n + 1;
        const id = `ge:${graph}:${n}`;
        const neutral = getSemanticColorToken('NEUTRAL');
        ctx.sceneManager.addElement({
          id,
          type: 'edge',
          sourceId: a.id,
          targetId: b.id,
          directed: !!anchor.directed,
          logicalParent: graph,
          originalType: 'GRAPH_EDGE',
          weight,
          fields: {},
          properties: { directed: !!anchor.directed, weight, label: anchor.weighted ? String(weight) : undefined },
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          state: 'NEUTRAL',
          color: neutral.color,
          emissiveIntensity: neutral.emissiveIntensity,
          emissiveColor: neutral.emissiveColor,
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
        } as any);
        ctx.relationshipManager?.addRelationship({ id, sourceId: a.id, targetId: b.id, type: 'edge', directed: !!anchor.directed });
        const newVertices = created.length > 0 ? ` (new vertex ${created.map((c) => this.nameOf(ctx, c)).join(' and ')})` : '';
        this.frame(ctx, {
          grow: created,
          nodes: { [id]: 'MODIFYING', [a.id]: 'EVALUATING', [b.id]: 'EVALUATING' },
          logs: [{ keyword: 'ADD_EDGE', message: `${text}   ⟹   edge ${a.value}${arrow}${b.value}${anchor.weighted ? ` (weight ${weight})` : ''} added${newVertices}`, kind: 'relationship' }],
        });
        return;
      }
      case 'REMOVE_EDGE': {
        if (args.length !== 2) throw new GraphError(`${text}: write REMOVE_EDGE ${graph} "A" "B".`);
        const a = this.resolveVertex(ctx, graph, args[0], text);
        const b = this.resolveVertex(ctx, graph, args[1], text);
        const e = this.edgeBetween(ctx, a.id, b.id);
        if (!e) throw new GraphError(`${text}: there is no edge ${a.value}${arrow}${b.value} to remove.`);
        this.frame(ctx, { nodes: { [e.id]: 'MODIFYING' } });
        this.removeEdge(ctx, e.id);
        this.frame(ctx, {
          duration: 320,
          logs: [{ keyword: 'REMOVE_EDGE', message: `${text}   ⟹   edge ${a.value}${arrow}${b.value} removed`, kind: 'relationship' }],
        });
        return;
      }
      case 'REMOVE_VERTEX': {
        if (args.length !== 1) throw new GraphError(`${text}: write REMOVE_VERTEX ${graph} "A".`);
        const v = this.resolveVertex(ctx, graph, args[0], text);
        const touching = this.edgesOf(ctx, graph).filter((e) => e.sourceId === v.id || e.targetId === v.id);
        const nodes: Record<string, string> = { [v.id]: 'MODIFYING' };
        for (const e of touching) nodes[e.id] = 'MODIFYING';
        this.frame(ctx, { nodes });
        ctx.scheduler.enqueue({ targets: v.scale, x: 0, y: 0, z: 0, duration: 380, easing: 'easeInBack' });
        ctx.scheduler.commitGroup(true);
        for (const e of touching) this.removeEdge(ctx, e.id);
        ctx.sceneManager.removeElement(v.id);
        this.frame(ctx, {
          duration: 320,
          logs: [{
            keyword: 'REMOVE_VERTEX',
            message: `${text}   ⟹   vertex ${v.value} removed together with its ${touching.length} edge${touching.length === 1 ? '' : 's'}`,
            kind: 'operation',
          }],
        });
        return;
      }
      default:
        throw new GraphError(`${text}: unknown graph operation.`);
    }
  }

  private removeEdge(ctx: AlgorithmContext, id: string): void {
    ctx.sceneManager.removeElement(id);
    ctx.relationshipManager?.removeRelationship(id);
  }

  private createVertex(ctx: AlgorithmContext, graph: string, name: string): string {
    const id = `gv:${graph}:${name}`;
    const last = this.verticesOf(ctx, graph).pop();
    const neutral = getSemanticColorToken('NEUTRAL');
    ctx.sceneManager.addElement({
      id,
      type: 'box',
      originalType: 'VERTEX',
      logicalParent: graph,
      logicalIndex: (last?.logicalIndex ?? -1) + 1,
      value: name,
      label: '',
      tags: [],
      fields: {},
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      state: 'NEUTRAL',
      color: neutral.color,
      emissiveColor: neutral.emissiveColor,
      emissiveIntensity: neutral.emissiveIntensity,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
    return id;
  }
}

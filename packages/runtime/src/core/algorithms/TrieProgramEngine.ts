/**
 * TrieProgramEngine — a TRIE driven by real code instead of the one-line
 * built-ins (TRIE_INSERT, TRIE_SEARCH, ... stay with TrieEngine, which
 * also builds a declared trie).
 *
 * A trie lives entirely in the scene graph, so stepping back (which restores
 * scene snapshots) restores it exactly:
 *
 * - one TRIE_NODE per node, id `tn:<trie>:<prefix>` — the prefix is the path
 *   of characters from the root (the root's prefix is ""). A node reference
 *   held in a VM variable is simply this id. The node's `value` is the one
 *   character on the edge into it, `isEndOfWord` marks the end of a stored
 *   word and `fields` holds whatever else the program stores (`node.count`).
 * - one EDGE per parent -> child link, id `te:<trie>:<child prefix>`.
 *
 * Programs work on tries the way textbook code does:
 *
 *   node = t.root                          // start at the root
 *   IF HAS_CHILD(node, ch) == FALSE         // is there an edge for ch?
 *     ADD_CHILD node ch                     // no: create the child node
 *   END
 *   node = GET_CHILD(node, ch)              // follow the edge (NULL if missing)
 *   node.isEnd = TRUE                       // a word ends here
 *   LOOP i FROM 0 TO CHILD_COUNT(node) - 1  // children in alphabetical order
 *     child = CHILD_AT(node, i)             // child.char is its letter
 *   REMOVE_CHILD node ch                    // unlink a leaf child
 *   WORD_COUNT(t), NODE_COUNT(t)            // words stored / nodes incl. root
 *
 * Every pointer move, field write, ADD_CHILD / REMOVE_CHILD, recursive call /
 * return and every HAS_CHILD / isEnd check in a condition is its own animated
 * step with a console line. Nodes show their prefix underneath (and the
 * fields the program stores), pointer variables above; word ends are green,
 * nodes held by calls waiting on the call stack purple.
 */
import { AlgorithmContext } from './AlgorithmContext';
import type { TreeContext } from './TreeEngine';
import { getSemanticColorToken, RuntimeError } from '@aqvl/shared';

/** A trie misuse at run time: not a node, missing child, a two-letter edge, ... */
export class TrieError extends RuntimeError {
  constructor(message: string) {
    super(message);
    this.name = 'TrieError';
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
  /** Pointer tags of this frame that shadow program variables. */
  temp?: Record<string, string | null>;
  /** Newly added nodes: scaled up from 0. */
  grow?: string[];
  duration?: number;
}

const TRANSIENT_STATES = new Set(['EVALUATING', 'TRAVERSING', 'MODIFYING', 'ACTIVE']);
const STEP_MS = 480;
const MOVE_MS = 520;
const CHECK_MS = 380;

/** Fields every node has, worked out from the trie itself. */
const BUILTIN_FIELDS = new Set(['char', 'isend']);

export class TrieProgramEngine {
  /** Reads compiled to `{ gfn, args }`. */
  static readonly READS = new Set(['HAS_CHILD', 'GET_CHILD', 'CHILD_COUNT', 'CHILD_AT', 'WORD_COUNT', 'NODE_COUNT']);

  // ---------------------------------------------------------------------
  // References
  // ---------------------------------------------------------------------

  /** True for a trie node reference (`tn:<trie>:<prefix>`), whether or not the node still exists. */
  public static isNodeRef(value: unknown): value is string {
    return typeof value === 'string' && /^tn:[^:]+:/.test(value);
  }

  public static nodeId(trie: string, prefix: string): string {
    return `tn:${trie}:${prefix}`;
  }

  public static edgeId(trie: string, prefix: string): string {
    return `te:${trie}:${prefix}`;
  }

  /** The characters from the root to `el` (the root's prefix is ""). */
  public static prefixOf(el: any): string {
    if (typeof el.prefix === 'string') return el.prefix;
    return typeof el.id === 'string' && TrieProgramEngine.isNodeRef(el.id) ? el.id.slice(el.id.indexOf(':', 3) + 1) : String(el.label ?? '');
  }

  public isTrie(ctx: AlgorithmContext, name: unknown): boolean {
    return typeof name === 'string' && !TrieProgramEngine.isNodeRef(name) && !!ctx.sceneManager.getElement(TrieProgramEngine.nodeId(name, ''));
  }

  public hasAnyTrie(ctx: AlgorithmContext): boolean {
    return ctx.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'TRIE_NODE');
  }

  /** True when `value` belongs to a trie: a trie name or a node reference. */
  public owns(ctx: AlgorithmContext, value: unknown): boolean {
    return TrieProgramEngine.isNodeRef(value) || this.isTrie(ctx, value);
  }

  private node(ctx: AlgorithmContext, ref: unknown): any {
    return TrieProgramEngine.isNodeRef(ref) ? (ctx.sceneManager.getElement(ref) as any) : undefined;
  }

  /** Every node of `trie` (every trie when omitted), root first, then by prefix. */
  private nodesOf(ctx: AlgorithmContext, trie?: string): any[] {
    return (ctx.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.originalType === 'TRIE_NODE' && TrieProgramEngine.isNodeRef(el.id) && (trie === undefined || el.logicalParent === trie))
      .sort((a, b) => (TrieProgramEngine.prefixOf(a) < TrieProgramEngine.prefixOf(b) ? -1 : 1));
  }

  private edgesOf(ctx: AlgorithmContext, trie?: string): any[] {
    return (ctx.sceneManager.getSceneGraph() as any[]).filter(
      (el) => el.originalType === 'EDGE' && typeof el.id === 'string' && el.id.startsWith('te:') && (trie === undefined || el.logicalParent === trie)
    );
  }

  /** The child of `el` along `ch`, or undefined. */
  private child(ctx: AlgorithmContext, el: any, ch: string): any {
    return ctx.sceneManager.getElement(TrieProgramEngine.nodeId(el.logicalParent, TrieProgramEngine.prefixOf(el) + ch)) as any;
  }

  /** The children of `el`, in alphabetical order of their character. */
  private children(ctx: AlgorithmContext, el: any): any[] {
    const prefix = TrieProgramEngine.prefixOf(el);
    return this.nodesOf(ctx, el.logicalParent)
      .filter((n) => {
        const p = TrieProgramEngine.prefixOf(n);
        return p.length === prefix.length + 1 && p.startsWith(prefix);
      })
      .sort((a, b) => (String(a.value) < String(b.value) ? -1 : String(a.value) > String(b.value) ? 1 : 0));
  }

  /** Every stored word of `trie`, in alphabetical order (a depth-first walk visiting children a to z). */
  public words(ctx: AlgorithmContext, trie: string): string[] {
    const out: string[] = [];
    const root = ctx.sceneManager.getElement(TrieProgramEngine.nodeId(trie, '')) as any;
    const visit = (el: any) => {
      if (el.isEndOfWord) out.push(TrieProgramEngine.prefixOf(el));
      for (const c of this.children(ctx, el)) visit(c);
    };
    if (root) visit(root);
    return out;
  }

  private static exprText(expr: unknown): string {
    if (typeof expr === 'string') return expr;
    if (expr && typeof expr === 'object') {
      if ('member' in (expr as any)) return `${TrieProgramEngine.exprText((expr as any).object)}.${(expr as any).member}`;
      if ('gfn' in (expr as any)) return (expr as any).source;
      if ('text' in (expr as any)) return `"${(expr as any).text}"`;
    }
    if (expr === null) return 'NULL';
    return 'the value';
  }

  /** How a node is named in messages: `"ca"`, or `root`. */
  private static nodeText(el: any): string {
    const prefix = TrieProgramEngine.prefixOf(el);
    return prefix === '' ? 'root' : `"${prefix}"`;
  }

  private refText(ctx: AlgorithmContext, ref: unknown): string {
    const el = this.node(ctx, ref);
    return el ? TrieProgramEngine.nodeText(el) : 'a removed node';
  }

  /** Throws a descriptive error unless `ref` is a live trie node. `what` names the operand (e.g. `node`). */
  private requireNode(ctx: AlgorithmContext, ref: unknown, what: string): any {
    if (ref === null || ref === undefined) {
      throw new TrieError(
        `NULL pointer dereference: ${what} is NULL, not a trie node. GET_CHILD returns NULL when there is no child for that character — check HAS_CHILD first.`
      );
    }
    if (typeof ref === 'string' && this.isTrie(ctx, ref)) {
      throw new TrieError(`${what} is the trie '${ref}' itself, not one of its nodes. Start from its root: node = ${ref}.root`);
    }
    if (!TrieProgramEngine.isNodeRef(ref)) {
      throw new TrieError(
        `${what} is not a trie node (its value is ${JSON.stringify(ref)}). Get a node with t.root, GET_CHILD(node, "a") or CHILD_AT(node, i).`
      );
    }
    const el = this.node(ctx, ref);
    if (!el) {
      const prefix = ref.slice(ref.indexOf(':', 3) + 1);
      throw new TrieError(`${what} refers to the node "${prefix}", which was removed from the trie (REMOVE_CHILD).`);
    }
    return el;
  }

  private requireTrie(ctx: AlgorithmContext, name: unknown, text: string): string {
    if (!this.isTrie(ctx, name)) {
      throw new TrieError(`${text}: '${String(name)}' is not a declared TRIE.`);
    }
    return name as string;
  }

  /** One character: the label of a trie edge. A single digit number (a bit, 0 / 1) is used as its digit. */
  private static requireChar(value: unknown, text: string): string {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9) return String(value);
    if (typeof value === 'string' && value.length === 1) return value;
    if (typeof value === 'string') {
      throw new TrieError(
        value.length === 0
          ? `${text}: the character is empty text. Each trie edge holds exactly one character, e.g. CHAR_AT(word, i).`
          : `${text}: "${value}" has ${value.length} characters, but each trie edge holds exactly one. Walk the word one character at a time with CHAR_AT(word, i).`
      );
    }
    throw new TrieError(`${text}: expected one character such as "a", got ${value === null || value === undefined ? 'NULL' : JSON.stringify(value)}.`);
  }

  // ---------------------------------------------------------------------
  // Reads (pure — the animation of a check comes from `check`)
  // ---------------------------------------------------------------------

  /**
   * The check an expression read makes that is a step of its own —
   * `HAS_CHILD(node, ch)` on a trie node, or `node.isEnd` — as the
   * TRIE_CHECK instruction that animates it; null for any other read.
   */
  public readStep(expr: any, evaluate: (expr: unknown) => unknown): Record<string, unknown> | null {
    if ('gfn' in expr) {
      if (expr.gfn !== 'HAS_CHILD') return null;
      const node = evaluate(expr.args[0]);
      return TrieProgramEngine.isNodeRef(node) ? { action: 'TRIE_CHECK', kind: 'HAS_CHILD', node, ch: evaluate(expr.args[1]), text: expr.source } : null;
    }
    if ('member' in expr && String(expr.member).toLowerCase() === 'isend') {
      const node = evaluate(expr.object);
      if (!TrieProgramEngine.isNodeRef(node)) return null;
      const source = typeof expr.object === 'string' ? `${expr.object}.isEnd` : 'isEnd';
      return { action: 'TRIE_CHECK', kind: 'IS_END', node, text: source };
    }
    return null;
  }

  /** `HAS_CHILD(node, "a")`, `GET_CHILD(node, ch)`, `CHILD_AT(node, i)`, ... with already-evaluated arguments. */
  public read(ctx: AlgorithmContext, fn: string, args: unknown[], text: string, argTexts: string[] = []): unknown {
    const arg = (i: number) => `${text}: ${argTexts[i] ?? `argument ${i + 1}`}`;
    switch (fn) {
      case 'HAS_CHILD': {
        const el = this.requireNode(ctx, args[0], arg(0));
        return !!this.child(ctx, el, TrieProgramEngine.requireChar(args[1], text));
      }
      case 'GET_CHILD': {
        const el = this.requireNode(ctx, args[0], arg(0));
        return this.child(ctx, el, TrieProgramEngine.requireChar(args[1], text))?.id ?? null;
      }
      case 'CHILD_COUNT':
        return this.children(ctx, this.requireNode(ctx, args[0], arg(0))).length;
      case 'CHILD_AT': {
        const el = this.requireNode(ctx, args[0], arg(0));
        const kids = this.children(ctx, el);
        const i = Number(args[1]);
        if (typeof args[1] === 'boolean' || !Number.isInteger(i)) {
          throw new TrieError(`${text}: the index must be a whole number (got ${JSON.stringify(args[1])}).`);
        }
        if (i < 0 || i >= kids.length) {
          throw new TrieError(
            kids.length === 0
              ? `${text}: node ${TrieProgramEngine.nodeText(el)} has no children (CHILD_COUNT is 0), so there is no child ${i}. (LOOP i FROM 0 TO CHILD_COUNT(node) - 1 counts down to -1 when CHILD_COUNT is 0 — use WHILE i < CHILD_COUNT(node) instead.)`
              : `${text}: node ${TrieProgramEngine.nodeText(el)} has ${kids.length} child${kids.length === 1 ? '' : 'ren'} — valid indexes are 0 to ${kids.length - 1}, not ${i}.`
          );
        }
        return kids[i].id;
      }
      case 'WORD_COUNT':
        return this.words(ctx, this.requireTrie(ctx, args[0], text)).length;
      case 'NODE_COUNT':
        return this.nodesOf(ctx, this.requireTrie(ctx, args[0], text)).length;
      default:
        throw new TrieError(`${text}: unknown trie function ${fn}.`);
    }
  }

  /** `t.root`, `node.isEnd`, `node.char`, `node.count`, ... */
  public readMember(ctx: AlgorithmContext, object: unknown, fieldName: string, objectExpr: unknown): unknown {
    const what = TrieProgramEngine.exprText(objectExpr);
    const member = fieldName.toLowerCase();
    const shown = member === 'isend' ? 'isEnd' : fieldName;
    if (this.isTrie(ctx, object)) {
      if (member.toLowerCase() === 'root') return TrieProgramEngine.nodeId(object as string, '');
      throw new TrieError(`A trie has no field '${member}'. Use ${String(object)}.root, WORD_COUNT(${String(object)}) or NODE_COUNT(${String(object)}).`);
    }
    if (object === null || object === undefined) {
      throw new TrieError(
        `NULL pointer dereference: cannot read ${what}.${shown} because ${what} is NULL. GET_CHILD returns NULL when there is no child for that character — check for NULL (or use HAS_CHILD) first.`
      );
    }
    const el = this.requireNode(ctx, object, what);
    // Field names are case-insensitive (the compiler lower-cases them): `isEnd` arrives as `isend`.
    if (member === 'isend') return !!el.isEndOfWord;
    if (member === 'char') return String(el.value ?? '');
    const fields = el.fields ?? {};
    if (member in fields) return fields[member];
    throw new TrieError(
      `${what}.${member} has not been set yet (node ${TrieProgramEngine.nodeText(el)}). Give a node its starting value when you create it, e.g. ADD_CHILD node ch, then child = GET_CHILD(node, ch) and child.${member} = 0. A node's own fields are isEnd and char.`
    );
  }

  // ---------------------------------------------------------------------
  // Display
  // ---------------------------------------------------------------------

  private short(ctx: AlgorithmContext, v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
    if (TrieProgramEngine.isNodeRef(v)) return `node ${this.refText(ctx, v)}`;
    return typeof v === 'string' ? `"${v}"` : String(v);
  }

  /** The value a queue / stack box shows for a node reference, or undefined when `ref` is not a trie node. */
  public displayValue(ctx: AlgorithmContext, ref: unknown): unknown {
    if (!TrieProgramEngine.isNodeRef(ref)) return undefined;
    const el = this.node(ctx, ref);
    return el ? (TrieProgramEngine.prefixOf(el) || 'root') : 'removed';
  }

  /** PRINT of a node: `Node("ca")`, `Node(root)`. */
  public formatValue(ctx: AlgorithmContext, value: unknown): string | null {
    if (!TrieProgramEngine.isNodeRef(value)) return null;
    const el = this.node(ctx, value);
    if (!el) return 'Node(removed)';
    const prefix = TrieProgramEngine.prefixOf(el);
    return prefix === '' ? 'Node(root)' : `Node("${prefix}")`;
  }

  /** `PRINT t`: its words in alphabetical order, e.g. `[car, card, cat]`. */
  public format(ctx: AlgorithmContext, trie: string): string {
    return `[${this.words(ctx, trie).join(', ')}]`;
  }

  // ---------------------------------------------------------------------
  // Derived state: tags, labels, resting colours
  // ---------------------------------------------------------------------

  /**
   * Recomputes every node's tags (pointer variables pointing at it), label
   * (its prefix, then the fields the program stored) and resting colour.
   */
  public refresh(ctx: TreeContext, temp: Record<string, string | null> = {}): void {
    if (!this.hasAnyTrie(ctx)) return;
    const names = new Map<string, string[]>();
    const addName = (id: unknown, name: string) => {
      if (!TrieProgramEngine.isNodeRef(id)) return;
      if (!names.has(id)) names.set(id, []);
      if (!names.get(id)!.includes(name)) names.get(id)!.push(name);
    };
    for (const [name, value] of Object.entries(ctx.host.visibleVariables())) if (!(name in temp)) addName(value, name);
    for (const [name, value] of Object.entries(temp)) addName(value, name);

    // Nodes held by calls that are waiting for a deeper call to return.
    const onStack = new Set<string>();
    const stack = ctx.host.callStack ? ctx.host.callStack() : [];
    for (const frame of stack.slice(0, -1)) {
      for (const v of Object.values(frame.locals)) if (TrieProgramEngine.isNodeRef(v)) onStack.add(v);
    }

    for (const el of this.nodesOf(ctx)) {
      const parts = [TrieProgramEngine.prefixOf(el)];
      for (const [k, value] of Object.entries(el.fields ?? {})) parts.push(`${k}=${this.short(ctx, value)}`);
      el.label = parts.filter((p) => p !== '').slice(0, 3).join('  ');
      el.tags = names.get(el.id) ?? [];
      el.onCallStack = onStack.has(el.id);
    }
    this.restoreBaseColors(ctx);
  }

  /** Resting colours: waiting on the call stack (purple) > end of a word (green) > any other node. */
  public restoreBaseColors(ctx: AlgorithmContext): void {
    if (!this.hasAnyTrie(ctx)) return;
    for (const el of this.nodesOf(ctx)) {
      if (el.state && el.state !== 'NEUTRAL') continue;
      const token = getSemanticColorToken(el.onCallStack ? 'AUXILIARY' : el.isEndOfWord ? 'SUCCESS' : 'NEUTRAL');
      el.color = token.color;
      el.emissiveColor = token.emissiveColor;
      el.emissiveIntensity = token.emissiveIntensity;
      el.isHighlighted = false;
    }
    const neutral = getSemanticColorToken('NEUTRAL');
    for (const e of this.edgesOf(ctx)) {
      if (e.state && e.state !== 'NEUTRAL') continue;
      e.color = neutral.color;
      e.emissiveColor = neutral.emissiveColor;
      e.emissiveIntensity = neutral.emissiveIntensity;
      e.isHighlighted = false;
    }
  }

  /** Tags / labels / colours for freshly loaded tries. */
  public initialize(ctx: TreeContext): void {
    if (!this.hasAnyTrie(ctx)) return;
    ctx.relationshipManager?.loadFromScene(ctx.sceneManager.getSceneGraph());
    this.refresh(ctx);
  }

  /** After a step-back restore: every node full size and exactly at its layout position. */
  public settleAfterRestore(ctx: AlgorithmContext): void {
    if (!this.hasAnyTrie(ctx)) return;
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    ctx.relationshipManager?.loadFromScene(graph);
    for (const el of this.nodesOf(ctx)) el.scale = { x: 1, y: 1, z: 1 };
    ctx.layoutManager.updateLayout(graph);
    for (const el of this.nodesOf(ctx)) if (el.worldTarget) el.position = { ...el.worldTarget };
  }

  private isTrieElement(el: any): boolean {
    return (
      (el.originalType === 'TRIE_NODE' && TrieProgramEngine.isNodeRef(el.id)) ||
      (el.originalType === 'EDGE' && typeof el.id === 'string' && el.id.startsWith('te:'))
    );
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
   * schedules it (with its console lines), then glides moved nodes.
   */
  private frame(ctx: TreeContext, o: FrameOptions = {}): void {
    const graph = ctx.sceneManager.getSceneGraph() as any[];
    for (const el of graph) {
      if (this.isTrieElement(el) && TRANSIENT_STATES.has(el.state)) {
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

    const snapshot = ctx.stateManager?.captureSnapshot(graph, 'Trie', ctx.scheduler.getCurrentTime());
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
      if (!(el.originalType === 'TRIE_NODE' && TrieProgramEngine.isNodeRef(el.id))) continue;
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
    // Every node ends exactly full size at its layout place, whether or not the tweens ran (headless, skipped steps).
    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        for (const el of this.nodesOf(ctx)) {
          el.scale = { x: 1, y: 1, z: 1 };
          if (el.worldTarget) el.position = { ...el.worldTarget };
        }
      },
    });
    ctx.scheduler.commitSequential();
  }

  // ---------------------------------------------------------------------
  // Program-level steps
  // ---------------------------------------------------------------------

  /** Whether an assignment of `value` (previously `previous`) moves a trie node pointer and should be animated. */
  public isPointerAssignment(ctx: AlgorithmContext, value: unknown, previous: unknown): boolean {
    if (!this.hasAnyTrie(ctx)) return false;
    return TrieProgramEngine.isNodeRef(value) || (TrieProgramEngine.isNodeRef(previous) && value === null);
  }

  /**
   * `node = GET_CHILD(node, ch)`, `node = t.root`, `child = CHILD_AT(node, i)`:
   * the variable's tag moves to the node it now points at, which lights up,
   * together with the edge that was followed.
   */
  public animatePointerMove(ctx: TreeContext, name: string, value: unknown, previous: unknown, sourceText?: string, valueExpr?: unknown): void {
    const nodes: Record<string, string> = {};
    const expr = valueExpr as any;
    const followed = expr && typeof expr === 'object' && (expr.gfn === 'GET_CHILD' || expr.gfn === 'CHILD_AT');
    const from = followed ? (expr.args?.[0] === name ? previous : ctx.host.evaluate(expr.args?.[0])) : undefined;
    const fromEl = this.node(ctx, from);
    let where: string;
    if (value === null || value === undefined) {
      if (fromEl) nodes[fromEl.id] = 'DISCARDED';
      let ch: unknown;
      try {
        ch = expr?.gfn === 'GET_CHILD' ? ctx.host.evaluate(expr.args?.[1]) : undefined;
      } catch {
        ch = undefined;
      }
      where = fromEl && ch !== undefined
        ? `${name} is NULL: node ${TrieProgramEngine.nodeText(fromEl)} has no child '${String(ch)}'`
        : `${name} is NULL`;
    } else {
      const el = this.node(ctx, value);
      nodes[value as string] = 'TRAVERSING';
      if (fromEl && el) {
        nodes[TrieProgramEngine.edgeId(el.logicalParent, TrieProgramEngine.prefixOf(el))] = 'TRAVERSING';
        if (fromEl.id !== el.id) nodes[fromEl.id] = 'EVALUATING';
      }
      where = el
        ? `${name} → ${TrieProgramEngine.nodeText(el)}${fromEl && el.value ? ` (followed the edge '${el.value}')` : ''}${el.isEndOfWord ? ', the end of a word' : ''}`
        : `${name} → a removed node`;
    }
    this.frame(ctx, {
      nodes,
      duration: MOVE_MS,
      logs: [{ keyword: 'POINTER', message: `${sourceText ?? name}   ⟹   ${where}`, kind: 'traversal' }],
    });
  }

  /**
   * A check read inside a condition / assignment / RETURN:
   * `HAS_CHILD(node, "t")` (the node's edges are looked at for 't') or
   * `node.isEnd` (is a word stored exactly here?).
   */
  public check(ctx: TreeContext, kind: 'HAS_CHILD' | 'IS_END', ref: unknown, ch: unknown, text: string): void {
    const el = this.node(ctx, ref);
    if (!el) return;
    const nodes: Record<string, string> = { [el.id]: 'EVALUATING' };
    let message: string;
    if (kind === 'HAS_CHILD') {
      let letter: string;
      try {
        letter = TrieProgramEngine.requireChar(ch, text);
      } catch {
        return; // the real evaluation reports it
      }
      const kids = this.children(ctx, el).map((c) => String(c.value));
      const hit = this.child(ctx, el, letter);
      if (hit) {
        nodes[hit.id] = 'TRAVERSING';
        nodes[TrieProgramEngine.edgeId(el.logicalParent, TrieProgramEngine.prefixOf(hit))] = 'TRAVERSING';
      }
      const has = kids.length === 0 ? 'has no children' : `has children ${kids.join(', ')}`;
      message = `${text}   ⟹   node ${TrieProgramEngine.nodeText(el)} ${has} → ${hit ? 'TRUE' : 'FALSE'}`;
    } else {
      if (el.isEndOfWord) nodes[el.id] = 'SUCCESS';
      const why =
        TrieProgramEngine.prefixOf(el) === ''
          ? ' (the root stands for the empty word, which is never stored)'
          : this.children(ctx, el).length > 0
            ? ' (it is only the beginning of longer words)'
            : '';
      message = el.isEndOfWord
        ? `${text}   ⟹   a word ends at node ${TrieProgramEngine.nodeText(el)} → TRUE`
        : `${text}   ⟹   no word ends at node ${TrieProgramEngine.nodeText(el)}${why} → FALSE`;
    }
    this.frame(ctx, { nodes, duration: CHECK_MS, logs: [{ keyword: 'CHECK', message, kind: 'compare' }] });
  }

  /** Pointer variables went out of scope: drop their tags. */
  public onScopeExit(ctx: TreeContext): void {
    if (!this.hasAnyTrie(ctx)) return;
    const before = this.nodesOf(ctx).map((v) => (v.tags ?? []).join(',')).join('|');
    this.refresh(ctx);
    const after = this.nodesOf(ctx).map((v) => (v.tags ?? []).join(',')).join('|');
    if (before !== after && ctx.stateManager) {
      ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager.captureSnapshot(ctx.sceneManager.getSceneGraph(), 'Scope exit'));
    }
  }

  /**
   * A user function was called / returned in a trie program (recursive
   * search, collect, delete, ...). Each is a step: the node passed in lights
   * up, nodes of the calls still waiting turn purple, and the console shows
   * the call nested by depth.
   */
  public onCall(ctx: TreeContext, e: { kind: 'call' | 'return'; functionName: string; args?: Record<string, unknown>; value?: unknown; depth: number }): void {
    const args = e.args ?? {};
    const argText = Object.values(args).map((v) => this.short(ctx, v)).join(', ');
    const indent = '│  '.repeat(Math.max(0, e.depth - 1));
    const nodes: Record<string, string> = {};
    for (const v of Object.values(args)) {
      if (this.node(ctx, v)) nodes[v as string] = e.kind === 'call' ? 'TRAVERSING' : 'EVALUATING';
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

  /** `node.isEnd = TRUE`, `node.count = node.count + 1`, `node.meaning = "..."`. */
  public setField(ctx: TreeContext, instr: { target: unknown; field: string; value: unknown; sourceText?: string }): void {
    const what = TrieProgramEngine.exprText(instr.target);
    const text = instr.sourceText ?? `${what}.${instr.field} = …`;
    const target = ctx.host.evaluate(instr.target);
    const value = ctx.host.evaluate(instr.value);
    const field = instr.field.toLowerCase();

    if (this.isTrie(ctx, target)) {
      throw new TrieError(
        field === 'root'
          ? `${text}: a trie's root never changes. Point a variable at it instead: node = ${String(target)}.root`
          : `${text}: a trie has no fields to set. Set fields on its nodes, e.g. node.${field} = …`
      );
    }
    const el = this.requireNode(ctx, target, what);
    if (value === undefined) throw new TrieError(`${text}: the value is undefined.`);
    if (TrieProgramEngine.isNodeRef(value)) this.requireNode(ctx, value, TrieProgramEngine.exprText(instr.value));
    const at = `node ${TrieProgramEngine.nodeText(el)}`;

    if (field === 'char') {
      throw new TrieError(`${text}: ${what}.char is the letter on the edge into the node and cannot be changed. To store a different letter, ADD_CHILD a new node.`);
    }
    if (field === 'isend') {
      if (typeof value !== 'boolean') {
        throw new TrieError(`${text}: ${what}.isEnd must be TRUE or FALSE, not ${this.short(ctx, value)}.`);
      }
      const prefix = TrieProgramEngine.prefixOf(el);
      if (prefix === '' && value) {
        throw new TrieError(`${text}: the root stands for the empty word "", which a trie does not store. Mark the node of the word's last character instead.`);
      }
      const was = !!el.isEndOfWord;
      el.isEndOfWord = value;
      const words = this.words(ctx, el.logicalParent).length;
      const message = value
        ? was
          ? `${text}   ⟹   "${prefix}" was already a stored word (nothing changes)`
          : `${text}   ⟹   ${at} now marks the end of the word "${prefix}"; ${el.logicalParent} holds ${words} word${words === 1 ? '' : 's'}`
        : was
          ? `${text}   ⟹   "${prefix}" is no longer a stored word; ${el.logicalParent} holds ${words} word${words === 1 ? '' : 's'}`
          : `${text}   ⟹   no word ended at ${at} anyway (nothing changes)`;
      this.frame(ctx, {
        nodes: { [el.id]: value ? 'SUCCESS' : 'MODIFYING' },
        logs: [{ keyword: value ? 'MARK_END' : 'UNMARK_END', message, kind: 'operation' }],
      });
      return;
    }
    if (BUILTIN_FIELDS.has(field)) return;
    const old = (el.fields ?? {})[field];
    el.fields = { ...(el.fields ?? {}), [field]: value };
    const changed = old !== undefined ? ` (was ${this.short(ctx, old)})` : '';
    this.frame(ctx, {
      nodes: { [el.id]: 'MODIFYING' },
      logs: [{ keyword: 'UPDATE', message: `${text}   ⟹   ${at}: ${field} = ${this.short(ctx, value)}${changed}`, kind: 'operation' }],
    });
  }

  /** `ADD_CHILD node ch` / `REMOVE_CHILD node ch`. */
  public edit(ctx: TreeContext, instr: { op: string; node: unknown; ch: unknown; nodeText?: string; sourceText?: string }): void {
    const text = instr.sourceText ?? instr.op;
    const what = instr.nodeText ?? TrieProgramEngine.exprText(instr.node);
    const parent = this.requireNode(ctx, ctx.host.evaluate(instr.node), `${text}: ${what}`);
    const ch = TrieProgramEngine.requireChar(ctx.host.evaluate(instr.ch), text);
    const trie = parent.logicalParent as string;
    const prefix = TrieProgramEngine.prefixOf(parent) + ch;
    const existing = this.child(ctx, parent, ch);
    const at = TrieProgramEngine.nodeText(parent);

    if (instr.op === 'ADD_CHILD') {
      if (existing) {
        throw new TrieError(
          `${text}: node ${at} already has a child '${ch}' (a node has at most one child per character). Check HAS_CHILD(${what}, "${ch}") first, or move to it with GET_CHILD(${what}, "${ch}").`
        );
      }
      const id = this.createNode(ctx, trie, prefix, ch);
      const edge = TrieProgramEngine.edgeId(trie, prefix);
      const count = this.nodesOf(ctx, trie).length;
      this.frame(ctx, {
        grow: [id],
        nodes: { [id]: 'MODIFYING', [edge]: 'MODIFYING', [parent.id]: 'EVALUATING' },
        logs: [{
          keyword: 'ADD_CHILD',
          message: `${text}   ⟹   new node "${prefix}" under ${at} along the edge '${ch}'; ${trie} has ${count} nodes`,
          kind: 'operation',
        }],
      });
      return;
    }

    if (instr.op === 'REMOVE_CHILD') {
      if (!existing) {
        const kids = this.children(ctx, parent).map((c) => String(c.value));
        throw new TrieError(
          `${text}: node ${at} has no child '${ch}' to remove (its children are ${kids.length > 0 ? kids.join(', ') : 'none'}).`
        );
      }
      const grandchildren = this.children(ctx, existing).map((c) => String(c.value));
      if (grandchildren.length > 0) {
        throw new TrieError(
          `${text}: node "${prefix}" still has children (${grandchildren.join(', ')}), so removing it would cut off every word below it. Remove nodes from the bottom up: only a node with CHILD_COUNT 0 can be removed.`
        );
      }
      const edge = TrieProgramEngine.edgeId(trie, prefix);
      const wasWord = !!existing.isEndOfWord;
      this.frame(ctx, { nodes: { [existing.id]: 'DISCARDED', [edge]: 'DISCARDED', [parent.id]: 'EVALUATING' }, duration: 360 });
      ctx.scheduler.enqueue({ targets: existing.scale, x: 0, y: 0, z: 0, duration: 320, easing: 'easeInBack' });
      ctx.scheduler.commitGroup(true);
      ctx.sceneManager.removeElement(edge);
      ctx.relationshipManager?.removeRelationship(edge);
      ctx.sceneManager.removeElement(existing.id);
      const count = this.nodesOf(ctx, trie).length;
      const lost = wasWord ? ` (it was the end of "${prefix}", so that word is gone too)` : '';
      this.frame(ctx, {
        nodes: { [parent.id]: 'EVALUATING' },
        duration: 360,
        logs: [{
          keyword: 'REMOVE_CHILD',
          message: `${text}   ⟹   node "${prefix}" removed from under ${at}${lost}; ${trie} has ${count} nodes`,
          kind: 'operation',
        }],
      });
      return;
    }
    throw new TrieError(`${text}: unknown trie operation.`);
  }

  private createNode(ctx: AlgorithmContext, trie: string, prefix: string, ch: string): string {
    const id = TrieProgramEngine.nodeId(trie, prefix);
    const parentId = TrieProgramEngine.nodeId(trie, prefix.slice(0, -1));
    const parent = ctx.sceneManager.getElement(parentId) as any;
    const neutral = getSemanticColorToken('NEUTRAL');
    ctx.sceneManager.addElement({
      id,
      type: 'sphere',
      originalType: 'TRIE_NODE',
      logicalParent: trie,
      value: ch,
      prefix,
      label: prefix,
      isEndOfWord: false,
      tags: [],
      fields: {},
      position: parent ? { ...parent.position } : { x: 0, y: 0, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      state: 'NEUTRAL',
      color: neutral.color,
      emissiveColor: neutral.emissiveColor,
      emissiveIntensity: neutral.emissiveIntensity,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
    const edge = TrieProgramEngine.edgeId(trie, prefix);
    ctx.sceneManager.addElement({
      id: edge,
      type: 'edge',
      originalType: 'EDGE',
      logicalParent: trie,
      sourceId: parentId,
      targetId: id,
      directed: true,
      properties: { label: ch },
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      state: 'NEUTRAL',
      color: neutral.color,
      emissiveColor: neutral.emissiveColor,
      emissiveIntensity: neutral.emissiveIntensity,
      visible: true,
      opacity: 1,
    } as any);
    ctx.relationshipManager?.addRelationship({ id: edge, sourceId: parentId, targetId: id, type: 'edge', directed: true });
    return id;
  }
}

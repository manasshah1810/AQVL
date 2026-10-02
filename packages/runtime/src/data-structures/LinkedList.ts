/**
 * LinkedList — singly, doubly or circular linked list, modelled the way C
 * code sees it: nodes with `next` (and `prev`) pointers and a `head`.
 *
 * The pure layer behind LinkedListEngine (../core/algorithms/LinkedListEngine.ts),
 * which runs the built-in list operations (INSERT_HEAD, INSERT_TAIL,
 * DELETE_HEAD, DELETE_TAIL, REVERSE, SEARCH, INSERT / DELETE / UPDATE
 * list[i]). Those operations are taught pointer by pointer, so every step
 * here is one visible beat: the pointer writes it performs (applied before
 * the beat is shown), and what the beat shows — the nodes and pointers it
 * lights up, the pointer variables (`curr`, `prev`, `newNode`, ...) tagged on
 * nodes, and its console line.
 *
 * Nodes are named by id: the scene ids the engine rehydrates the list from,
 * and `new:<n>` for a node an operation allocates (the engine binds that to
 * the scene id it creates). Every operation resets `steps`.
 */
import type { StepPrimitives } from './steps';

export type ListVariant = 'SINGLY' | 'DOUBLY' | 'CIRCULAR';
export type PointerField = 'next' | 'prev';
/** A node id; `new:<n>` for a node allocated by the current operation. */
export type ListRef = string;

export interface ListNode<T = unknown> {
  id: ListRef;
  value: T;
  next: ListRef | null;
  prev: ListRef | null;
}

export interface ListLog {
  keyword: string;
  message: string;
  kind: string;
}

/** What one beat shows. Edge keys are `<node>>next` / `<node>>prev`; `temp` maps pointer-variable names to nodes. */
export interface ListBeat {
  nodes?: Record<ListRef, string>;
  edges?: Record<string, string>;
  temp?: Record<string, ListRef | null>;
  /** Nodes this beat's pointer writes just unlinked from the list. */
  bypassed?: ListRef[];
  /** Nodes allocated in this beat (they grow into view). */
  grow?: ListRef[];
  logs?: ListLog[];
}

export interface PointerWrite {
  node: ListRef;
  field: PointerField;
  to: ListRef | null;
}

/** Effects applied before a step's beat is shown. */
interface Writes {
  writes?: PointerWrite[];
  /** The list's head now points here. */
  head?: { to: ListRef | null };
}

export type LinkedListStep =
  /** A console line, with optional highlights (operation header, result, nothing-to-do). */
  | { type: 'NOTE'; beat: ListBeat }
  /** A pointer variable moves onto a node (walking the list). */
  | ({ type: 'VISIT'; beat: ListBeat } & Writes)
  /** A node's value is compared with the one searched for. */
  | { type: 'COMPARE'; beat: ListBeat }
  /** `node` is allocated in heap memory holding `value`. */
  | { type: 'CREATE'; node: ListRef; value: unknown; beat: ListBeat }
  /** Pointers are written so the list gains a link. */
  | ({ type: 'LINK'; beat: ListBeat } & Writes)
  /** Pointers are written so a node leaves the list (or a pointer becomes NULL). */
  | ({ type: 'UNLINK'; beat: ListBeat } & Writes)
  /** `node`'s value becomes `value`. */
  | { type: 'SET'; node: ListRef; value: unknown; beat: ListBeat }
  /** `node`'s memory is released (`label` is the pointer variable naming it). */
  | { type: 'FREE'; node: ListRef; label: string; temp: Record<string, ListRef | null> };

/** The AQIR primitive each list step realises (see ./steps.ts). */
export const LINKED_LIST_STEP_PRIMITIVES: StepPrimitives<LinkedListStep> = {
  NOTE: { kind: 'EMIT', verb: 'log' },
  VISIT: { kind: 'ANNOTATE', verb: 'focus' },
  COMPARE: { kind: 'ANNOTATE', verb: 'contrast' },
  CREATE: { kind: 'MUTATE', verb: 'create' },
  LINK: { kind: 'RELATE', verb: 'link' },
  UNLINK: { kind: 'RELATE', verb: 'unlink' },
  SET: { kind: 'MUTATE', verb: 'set' },
  FREE: { kind: 'MUTATE', verb: 'destroy' },
};

/** A position outside the list; the engine reports it as a LinkedListError. */
export class ListPositionError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'ListPositionError';
  }
}

export class LinkedList<T = unknown> {
  head: ListRef | null = null;
  readonly nodes = new Map<ListRef, ListNode<T>>();

  /** Steps recorded by the most recent operation. */
  steps: LinkedListStep[] = [];

  private created = 0;

  constructor(
    /** The list's name, as programs write it (used in the narration). */
    readonly name: string,
    readonly variant: ListVariant = 'SINGLY'
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  /** Node ids reachable from the head by following `next`, in order (stops before a repeat). */
  chain(): ListRef[] {
    const ids: ListRef[] = [];
    const seen = new Set<ListRef>();
    let cur = this.head;
    while (cur && !seen.has(cur) && this.nodes.has(cur)) {
      ids.push(cur);
      seen.add(cur);
      cur = this.nodes.get(cur)!.next;
    }
    return ids;
  }

  get length(): number {
    return this.chain().length;
  }

  values(): T[] {
    return this.chain().map((id) => this.nodes.get(id)!.value);
  }

  /** `10 -> 20 -> 30 -> NULL` (or `... -> back to 10` for a cycle). */
  format(): string {
    const ids = this.chain();
    if (ids.length === 0) return 'NULL (empty)';
    const values = ids.map((id) => String(this.value(id)));
    const after = this.pointer(ids[ids.length - 1], 'next');
    const end = after ? `back to ${this.nodes.get(after)?.value}` : 'NULL';
    return `${values.join(' -> ')} -> ${end}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operations
  // ─────────────────────────────────────────────────────────────────────────

  insertHead(value: T): void {
    this.steps = [];
    this.doInsertHead(value, 'INSERT_HEAD');
  }

  insertTail(value: T): void {
    this.steps = [];
    if (!this.head) {
      this.doInsertHead(value, 'INSERT_TAIL (empty list)');
      return;
    }
    this.header(`INSERT_TAIL ${this.name} ${value}: walk to the last node (O(n) without a tail pointer)`);
    const last = this.walkToTail();
    const id = this.allocate(value);
    const temp: Record<string, ListRef | null> = { curr: last, newNode: id };
    this.steps.push({
      type: 'CREATE', node: id, value,
      beat: {
        grow: [id],
        nodes: { [id]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${this.name}, ${value})   ⟹   allocated in heap memory`, kind: 'info' }],
      },
    });
    if (this.variant === 'CIRCULAR') {
      this.link([{ node: id, field: 'next', to: this.head }], {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = ${this.name}.head   ⟹   keeps the circle closed`, kind: 'relationship' }],
      });
    }
    if (this.variant === 'DOUBLY') {
      this.link([{ node: id, field: 'prev', to: last }], {
        edges: { [`${id}>prev`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.prev = curr   ⟹   node ${value} ← node ${this.value(last)}`, kind: 'relationship' }],
      });
    }
    this.link([{ node: last, field: 'next', to: id }], {
      nodes: { [id]: 'SUCCESS' },
      edges: { [`${last}>next`]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `curr.next = newNode   ⟹   node ${this.value(last)} → node ${value}`, kind: 'relationship' }],
    });
    this.done('Inserted at tail.');
  }

  deleteHead(): void {
    this.steps = [];
    this.doDeleteHead('DELETE_HEAD');
  }

  deleteTail(): void {
    this.steps = [];
    const ids = this.chain();
    if (ids.length <= 1) {
      this.doDeleteHead('DELETE_TAIL');
      return;
    }
    this.header(`DELETE_TAIL ${this.name}: walk to the second-to-last node`);
    const prev = this.walk(ids.length - 2, 'prev');
    const last = ids[ids.length - 1];
    const temp: Record<string, ListRef | null> = { prev, temp: last };
    this.steps.push({
      type: 'VISIT',
      beat: {
        nodes: { [last]: 'MODIFYING' },
        edges: { [`${prev}>next`]: 'TRAVERSING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `temp = prev.next   ⟹   node ${this.value(last)} (the tail)`, kind: 'traversal' }],
      },
    });
    const newNext = this.variant === 'CIRCULAR' ? this.head : null;
    this.unlink([{ node: prev, field: 'next', to: newNext }], undefined, {
      nodes: { [prev]: 'SUCCESS' },
      edges: newNext ? { [`${prev}>next`]: 'MODIFYING' } : {},
      temp,
      bypassed: [last],
      logs: [{
        keyword: 'POINTER',
        message: `prev.next = ${newNext ? `${this.name}.head` : 'NULL'}   ⟹   node ${this.value(prev)} is the new tail; node ${this.value(last)} is unlinked`,
        kind: 'relationship',
      }],
    });
    this.free(last, 'temp', { prev });
  }

  reverse(): void {
    this.steps = [];
    const ids = this.chain();
    if (ids.length < 2) {
      this.note('OPERATION', `REVERSE ${this.name}: fewer than 2 nodes — already reversed.`, 'operation');
      return;
    }
    const circular = this.variant === 'CIRCULAR';
    const doubly = this.variant === 'DOUBLY';
    this.header(`REVERSE ${this.name}: flip every next pointer with prev / curr / next`);
    const oldHead = ids[0];
    let prev: ListRef | null = null;
    let curr: ListRef | null = oldHead;
    this.steps.push({
      type: 'VISIT',
      beat: {
        nodes: { [oldHead]: 'TRAVERSING' },
        temp: { prev, curr },
        logs: [{ keyword: 'POINTER', message: `prev = NULL, curr = ${this.name}.head`, kind: 'traversal' }],
      },
    });
    for (let i = 0; i < ids.length && curr; i++) {
      const next: ListRef | null = circular && i === ids.length - 1 ? null : this.pointer(curr, 'next');
      const writes: PointerWrite[] = [{ node: curr, field: 'next', to: prev }];
      if (doubly) writes.push({ node: curr, field: 'prev', to: next });
      this.link(writes, {
        nodes: { [curr]: 'MODIFYING' },
        edges: prev ? { [`${curr}>next`]: 'MODIFYING' } : {},
        temp: { prev, curr, next },
        logs: [{
          keyword: 'POINTER',
          message: `next = curr.next; curr.next = prev${doubly ? '; curr.prev = next' : ''}   ⟹   node ${this.value(curr)} now points to ${this.describe(prev)}`,
          kind: 'relationship',
        }],
      });
      prev = curr;
      curr = next;
      this.steps.push({
        type: 'VISIT',
        beat: {
          nodes: curr ? { [curr]: 'TRAVERSING' } : {},
          temp: { prev, curr },
          logs: [{ keyword: 'POINTER', message: `prev = curr; curr = next   ⟹   curr → ${this.describe(curr)}`, kind: 'traversal' }],
        },
      });
    }
    this.link(circular ? [{ node: oldHead, field: 'next', to: prev }] : [], {
      nodes: prev ? { [prev]: 'SUCCESS' } : {},
      logs: [{
        keyword: 'POINTER',
        message: `${this.name}.head = prev${circular ? `; old head's next = new head (closes the circle)` : ''}   ⟹   node ${this.value(prev!)} is the new head`,
        kind: 'relationship',
      }],
    }, { to: prev });
    this.done('Reversed.');
  }

  search(value: T): void {
    this.steps = [];
    const ids = this.chain();
    this.header(`SEARCH ${this.name} ${value}: follow next pointers from the head`);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const found = this.value(id) === value;
      this.steps.push({
        type: 'COMPARE',
        beat: {
          nodes: { [id]: found ? 'SUCCESS' : 'EVALUATING' },
          edges: i > 0 ? { [`${ids[i - 1]}>next`]: 'TRAVERSING' } : {},
          temp: { curr: id },
          logs: [{ keyword: 'COMPARE', message: `curr.val = ${this.value(id)} ${found ? '==' : '!='} ${value}`, kind: 'compare' }],
        },
      });
      if (found) {
        this.note('RESULT', `Found ${value} at position ${i} of ${this.name}.`, 'search', { nodes: { [id]: 'SUCCESS' }, temp: { curr: id } });
        return;
      }
    }
    this.note('RESULT', `${value} is not in ${this.name} (reached NULL).`, 'search');
  }

  /** @throws ListPositionError unless 0 <= index <= length. */
  insertAt(index: number, value: T): void {
    this.steps = [];
    const n = this.chain().length;
    if (!Number.isInteger(index) || index < 0 || index > n) {
      throw new ListPositionError(`Cannot insert at position ${index} of '${this.name}': valid positions are 0 to ${n}.`);
    }
    if (index === 0) {
      this.doInsertHead(value, `INSERT ${this.name}[0]`);
      return;
    }
    this.header(`INSERT ${this.name}[${index}] ${value}: walk to position ${index - 1}`);
    const prev = this.walk(index - 1, 'prev');
    const id = this.allocate(value);
    const temp: Record<string, ListRef | null> = { prev, newNode: id };
    this.steps.push({
      type: 'CREATE', node: id, value,
      beat: {
        grow: [id],
        nodes: { [id]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${this.name}, ${value})`, kind: 'info' }],
      },
    });
    const after = this.pointer(prev, 'next');
    if (after) {
      this.link([{ node: id, field: 'next', to: after }], {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = prev.next   ⟹   node ${value} → node ${this.value(after)}`, kind: 'relationship' }],
      });
    }
    if (this.variant === 'DOUBLY') {
      const writes: PointerWrite[] = [{ node: id, field: 'prev', to: prev }];
      if (after) writes.push({ node: after, field: 'prev', to: id });
      this.link(writes, {
        edges: { [`${id}>prev`]: 'MODIFYING', ...(after ? { [`${after}>prev`]: 'MODIFYING' } : {}) },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.prev = prev${after ? '; newNode.next.prev = newNode' : ''}`, kind: 'relationship' }],
      });
    }
    this.link([{ node: prev, field: 'next', to: id }], {
      nodes: { [id]: 'SUCCESS' },
      edges: { [`${prev}>next`]: 'MODIFYING' },
      temp,
      logs: [{ keyword: 'POINTER', message: `prev.next = newNode   ⟹   node ${this.value(prev)} → node ${value}`, kind: 'relationship' }],
    });
    this.done(`Inserted ${value} at position ${index}.`);
  }

  /** @throws ListPositionError unless 0 <= index < length. */
  deleteAt(index: number): void {
    this.steps = [];
    const n = this.chain().length;
    if (!Number.isInteger(index) || index < 0 || index >= n) {
      throw new ListPositionError(
        n === 0 ? `Cannot delete ${this.name}[${index}]: the list is empty.` : `Cannot delete ${this.name}[${index}]: valid positions are 0 to ${n - 1}.`
      );
    }
    if (index === 0) {
      this.doDeleteHead(`DELETE ${this.name}[0]`);
      return;
    }
    this.header(`DELETE ${this.name}[${index}]: walk to position ${index - 1}`);
    const prev = this.walk(index - 1, 'prev');
    const target = this.pointer(prev, 'next')!;
    const temp: Record<string, ListRef | null> = { prev, temp: target };
    this.steps.push({
      type: 'VISIT',
      beat: {
        nodes: { [target]: 'MODIFYING' },
        edges: { [`${prev}>next`]: 'TRAVERSING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `temp = prev.next   ⟹   node ${this.value(target)}`, kind: 'traversal' }],
      },
    });
    const after = this.pointer(target, 'next');
    this.unlink([{ node: prev, field: 'next', to: after }], undefined, {
      edges: after ? { [`${prev}>next`]: 'MODIFYING' } : {},
      temp,
      bypassed: [target],
      logs: [{ keyword: 'POINTER', message: `prev.next = temp.next   ⟹   node ${this.value(target)} is unlinked`, kind: 'relationship' }],
    });
    if (this.variant === 'DOUBLY' && after) {
      this.link([{ node: after, field: 'prev', to: prev }], {
        edges: { [`${after}>prev`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `temp.next.prev = prev`, kind: 'relationship' }],
      });
    }
    this.free(target, 'temp', { prev });
  }

  /** @throws ListPositionError unless 0 <= index < length. */
  updateAt(index: number, value: T): void {
    this.steps = [];
    const n = this.chain().length;
    if (!Number.isInteger(index) || index < 0 || index >= n) {
      throw new ListPositionError(`Cannot update ${this.name}[${index}]: valid positions are 0 to ${n - 1}.`);
    }
    this.header(`UPDATE ${this.name}[${index}] ${value}: walk to position ${index}`);
    const curr = this.walk(index);
    const old = this.value(curr);
    this.nodes.get(curr)!.value = value;
    this.steps.push({
      type: 'SET', node: curr, value,
      beat: {
        nodes: { [curr]: 'MODIFYING' },
        temp: { curr },
        logs: [{ keyword: 'UPDATE', message: `curr.val = ${value}   ⟹   ${old} → ${value}`, kind: 'operation' }],
      },
    });
    this.done('Updated.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared parts
  // ─────────────────────────────────────────────────────────────────────────

  private doInsertHead(value: T, opName: string): void {
    this.header(`${opName} ${this.name} ${value}`);
    const id = this.allocate(value);
    const temp: Record<string, ListRef | null> = { newNode: id };
    this.steps.push({
      type: 'CREATE', node: id, value,
      beat: {
        grow: [id],
        nodes: { [id]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'NEW_NODE', message: `newNode = NEW_NODE(${this.name}, ${value})   ⟹   allocated in heap memory`, kind: 'info' }],
      },
    });
    const head = this.head;
    if (head) {
      this.link([{ node: id, field: 'next', to: head }], {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = ${this.name}.head   ⟹   node ${value} → node ${this.value(head)}`, kind: 'relationship' }],
      });
      if (this.variant === 'DOUBLY') {
        this.link([{ node: head, field: 'prev', to: id }], {
          edges: { [`${head}>prev`]: 'MODIFYING' },
          temp,
          logs: [{ keyword: 'POINTER', message: `${this.name}.head.prev = newNode   ⟹   node ${this.value(head)} ← node ${value}`, kind: 'relationship' }],
        });
      }
      if (this.variant === 'CIRCULAR') {
        const tail = this.walkToTail('tail', temp);
        this.link([{ node: tail, field: 'next', to: id }], {
          edges: { [`${tail}>next`]: 'MODIFYING' },
          temp: { ...temp, tail },
          logs: [{ keyword: 'POINTER', message: `tail.next = newNode   ⟹   the last node now wraps around to node ${value}`, kind: 'relationship' }],
        });
      }
    } else if (this.variant === 'CIRCULAR') {
      this.link([{ node: id, field: 'next', to: id }], {
        edges: { [`${id}>next`]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `newNode.next = newNode   ⟹   a one-node circle`, kind: 'relationship' }],
      });
    }
    this.link([], {
      nodes: { [id]: 'SUCCESS' },
      temp,
      logs: [{ keyword: 'POINTER', message: `${this.name}.head = newNode   ⟹   node ${value} is the new head`, kind: 'relationship' }],
    }, { to: id });
    this.done('Inserted at head.');
  }

  private doDeleteHead(opName: string): void {
    const head = this.head;
    if (!head) {
      this.note('OPERATION', `${opName} ${this.name}: the list is empty (head is NULL) — nothing to delete.`, 'operation');
      return;
    }
    this.header(`${opName} ${this.name}`);
    const temp: Record<string, ListRef | null> = { temp: head };
    this.steps.push({
      type: 'VISIT',
      beat: {
        nodes: { [head]: 'MODIFYING' },
        temp,
        logs: [{ keyword: 'POINTER', message: `temp = ${this.name}.head   ⟹   node ${this.value(head)}`, kind: 'traversal' }],
      },
    });
    let newHead = this.pointer(head, 'next');
    if (this.variant === 'CIRCULAR') {
      if (newHead === head) {
        newHead = null;
      } else {
        const tail = this.walkToTail('tail', temp);
        this.link([{ node: tail, field: 'next', to: newHead }], {
          edges: { [`${tail}>next`]: 'MODIFYING' },
          temp: { ...temp, tail },
          logs: [{ keyword: 'POINTER', message: `tail.next = temp.next   ⟹   the circle now skips node ${this.value(head)}`, kind: 'relationship' }],
        });
      }
    }
    this.unlink([], { to: newHead }, {
      nodes: newHead ? { [newHead]: 'SUCCESS' } : {},
      temp,
      bypassed: [head],
      logs: [{ keyword: 'POINTER', message: `${this.name}.head = temp.next   ⟹   head → ${this.describe(newHead)}; node ${this.value(head)} is unlinked`, kind: 'relationship' }],
    });
    if (this.variant === 'DOUBLY' && newHead) {
      this.unlink([{ node: newHead, field: 'prev', to: null }], undefined, {
        temp,
        logs: [{ keyword: 'POINTER', message: `${this.name}.head.prev = NULL`, kind: 'relationship' }],
      });
    }
    this.free(head, 'temp');
  }

  /** Walks `hops` next-pointers from the head, one beat per hop, with a `label` tag. Returns the node reached. */
  private walk(hops: number, label = 'curr', extraTemp: Record<string, ListRef | null> = {}): ListRef {
    let curr = this.head!;
    this.steps.push({
      type: 'VISIT',
      beat: {
        nodes: { [curr]: 'TRAVERSING' },
        temp: { ...extraTemp, [label]: curr },
        logs: [{ keyword: 'TRAVERSE', message: `${label} = ${this.name}.head   ⟹   node ${this.value(curr)}`, kind: 'traversal' }],
      },
    });
    for (let i = 0; i < hops; i++) {
      const next = this.pointer(curr, 'next')!;
      this.steps.push({
        type: 'VISIT',
        beat: {
          nodes: { [next]: 'TRAVERSING' },
          edges: { [`${curr}>next`]: 'TRAVERSING' },
          temp: { ...extraTemp, [label]: next },
          logs: [{ keyword: 'TRAVERSE', message: `${label} = ${label}.next   ⟹   node ${this.value(next)}`, kind: 'traversal' }],
        },
      });
      curr = next;
    }
    return curr;
  }

  /** Walks to the last node (the one whose next is NULL, or the head for a circular list). */
  private walkToTail(label = 'curr', extraTemp: Record<string, ListRef | null> = {}): ListRef {
    return this.walk(this.chain().length - 1, label, extraTemp);
  }

  private allocate(value: T): ListRef {
    const id = `new:${this.created++}`;
    this.nodes.set(id, { id, value, next: null, prev: null });
    return id;
  }

  private write(writes: PointerWrite[], head?: { to: ListRef | null }): void {
    for (const w of writes) {
      const node = this.nodes.get(w.node);
      if (node) node[w.field] = w.to;
    }
    if (head) this.head = head.to;
  }

  private link(writes: PointerWrite[], beat: ListBeat, head?: { to: ListRef | null }): void {
    this.write(writes, head);
    this.steps.push({ type: 'LINK', writes, ...(head ? { head } : {}), beat });
  }

  private unlink(writes: PointerWrite[], head: { to: ListRef | null } | undefined, beat: ListBeat): void {
    this.write(writes, head);
    this.steps.push({ type: 'UNLINK', writes, ...(head ? { head } : {}), beat });
  }

  /** Releases `node`: it and every pointer from / to it are gone. */
  private free(node: ListRef, label: string, temp: Record<string, ListRef | null> = {}): void {
    this.nodes.delete(node);
    for (const other of this.nodes.values()) {
      if (other.next === node) other.next = null;
      if (other.prev === node) other.prev = null;
    }
    if (this.head === node) this.head = null;
    this.steps.push({ type: 'FREE', node, label, temp });
  }

  private note(keyword: string, message: string, kind: string, extra: ListBeat = {}): void {
    this.steps.push({ type: 'NOTE', beat: { ...extra, logs: [...(extra.logs ?? []), { keyword, message, kind }] } });
  }

  private header(text: string): void {
    this.note('OPERATION', text, 'operation');
  }

  private done(text: string): void {
    this.note('RESULT', `${text} ${this.name}: ${this.format()}`, 'result');
  }

  private pointer(id: ListRef, field: PointerField): ListRef | null {
    return this.nodes.get(id)?.[field] ?? null;
  }

  private value(id: ListRef): T {
    return this.nodes.get(id)!.value;
  }

  /** How a pointer reads in messages: `node 20` or `NULL`. */
  private describe(ref: ListRef | null): string {
    return ref === null ? 'NULL' : `node ${this.value(ref)}`;
  }
}

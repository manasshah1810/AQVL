/**
 * BinarySearchTree — the pure layer behind BSTEngine
 * (../core/algorithms/BSTEngine.ts), which animates BST_INSERT / BST_DELETE /
 * BST_SEARCH / BST_CLEAR / ROTATE and the traversals and measures of a BST
 * drawn as TREE_NODE + EDGE scene objects.
 *
 * Nodes carry the id of the scene node they stand for (an opaque string
 * here) and a numeric key. Every operation resets `steps` and records what
 * it did, one step per visualizable micro-action, naming nodes by
 * `{ id, value }`. Where the same micro-action is drawn differently by
 * different operations (a key compared on the way down an insert, a search
 * or a delete; a node processed by a depth-first or a level-order
 * traversal) the step says which operation it belongs to.
 *
 * No runtime (scene / scheduler) dependencies.
 */
import type { StepPrimitives } from './steps';

export interface BSTNodeRef {
  /** Scene-graph element ID */
  id: string;
  /** Numeric BST key */
  value: number;
}

export interface BSTNode {
  id: string;
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
  parent: BSTNode | null;
}

export type BSTSide = 'L' | 'R';
export type DeleteCase = 'LEAF' | 'ONE_CHILD' | 'TWO_CHILDREN';
/** The operations that walk down from the root comparing keys. */
export type BSTWalk = 'INSERT' | 'SEARCH' | 'DELETE';
export type DepthFirstOrder = 'INORDER' | 'PREORDER' | 'POSTORDER';

export type BSTStep =
  /** `value` was compared with `node`'s key on the way down; `side` is where the walk goes next. */
  | { type: 'COMPARE'; walk: BSTWalk; node: BSTNodeRef; value: number; side: BSTSide }
  /** The walk reached the node holding `value`. */
  | { type: 'FOUND'; walk: 'SEARCH' | 'DELETE'; node: BSTNodeRef; value: number }
  /** The walk fell off the tree: `value` is not in it. */
  | { type: 'NOT_FOUND'; walk: 'SEARCH' | 'DELETE'; value: number }
  /** insert met `value` already in the tree, at `node`. */
  | { type: 'DUPLICATE'; node: BSTNodeRef; value: number }
  /** insert hung a new node for `value` on `parent`'s `side` (both null: it became the root). */
  | { type: 'ATTACH'; value: number; parent: BSTNodeRef | null; side: BSTSide | null }
  /** delete, looking for the inorder successor, passed `node`. */
  | { type: 'SUCCESSOR_WALK'; node: BSTNodeRef }
  /** delete found the inorder successor, `node`. */
  | { type: 'SUCCESSOR'; node: BSTNodeRef }
  /**
   * delete removed `node`: a leaf, or a node with one child (`replacement`
   * takes its place under `parent`), or a node with two children (it takes
   * `successor`'s key and the successor node is removed instead).
   */
  | {
      type: 'REMOVE';
      node: BSTNodeRef;
      deleteCase: DeleteCase;
      parent: BSTNodeRef | null;
      side: BSTSide | null;
      replacement: BSTNodeRef | null;
      successor: BSTNodeRef | null;
    }
  /**
   * A rotation at `pivot`: `child` (pivot's right child for a left rotation,
   * left child for a right one) rises into pivot's place under `parent`
   * (`parentSide`), pivot becomes child's child, and `grandchild` (child's
   * inner subtree) moves over to pivot.
   */
  | {
      type: 'ROTATE';
      direction: BSTSide;
      pivot: BSTNodeRef;
      child: BSTNodeRef;
      grandchild: BSTNodeRef | null;
      parent: BSTNodeRef | null;
      parentSide: BSTSide | null;
    }
  /** A depth-first traversal arrived at `node`. */
  | { type: 'VISIT'; order: DepthFirstOrder; node: BSTNodeRef }
  /** A traversal output `node`'s key. */
  | { type: 'PROCESS'; order: DepthFirstOrder | 'LEVELORDER'; node: BSTNodeRef }
  /** A depth-first traversal went down from `node` to `targetNode`, or came back up from `targetNode` to `node`. */
  | { type: 'MOVE_LEFT' | 'MOVE_RIGHT' | 'BACKTRACK'; order: DepthFirstOrder; node: BSTNodeRef; targetNode: BSTNodeRef }
  /** A level-order traversal queued / took `node`; `queue` is the queue afterwards. */
  | { type: 'ENQUEUE' | 'DEQUEUE'; node: BSTNodeRef; queue: BSTNodeRef[] }
  /** min / max stepped to `node` (from `from`, null at the root). */
  | { type: 'DESCEND'; toward: 'MIN' | 'MAX'; node: BSTNodeRef; from: BSTNodeRef | null }
  /** min / max ended at `node`: it holds the smallest / largest key. */
  | { type: 'EXTREME'; toward: 'MIN' | 'MAX'; node: BSTNodeRef }
  /** height started measuring the subtree at `node`. */
  | { type: 'MEASURE'; node: BSTNodeRef }
  /** height finished the subtree at `node`: it is `height` levels tall. */
  | { type: 'HEIGHT'; node: BSTNodeRef; height: number }
  /** size counted `node`, the `count`-th. */
  | { type: 'COUNT'; node: BSTNodeRef; count: number }
  /** clear removed all `count` nodes. */
  | { type: 'CLEAR'; count: number };

/** The AQIR primitive each BST step realises (see ./steps.ts). */
export const BST_STEP_PRIMITIVES: StepPrimitives<BSTStep> = {
  COMPARE: { kind: 'ANNOTATE', verb: 'contrast' },
  FOUND: { kind: 'ANNOTATE', verb: 'state' },
  NOT_FOUND: { kind: 'ANNOTATE', verb: 'state' },
  DUPLICATE: { kind: 'ANNOTATE', verb: 'state' },
  ATTACH: { kind: 'MUTATE', verb: 'create' },
  SUCCESSOR_WALK: { kind: 'ANNOTATE', verb: 'focus' },
  SUCCESSOR: { kind: 'ANNOTATE', verb: 'focus' },
  REMOVE: { kind: 'MUTATE', verb: 'destroy' },
  ROTATE: { kind: 'RELATE', verb: 'link' },
  VISIT: { kind: 'ANNOTATE', verb: 'focus' },
  PROCESS: { kind: 'ANNOTATE', verb: 'state' },
  MOVE_LEFT: { kind: 'ANNOTATE', verb: 'focus' },
  MOVE_RIGHT: { kind: 'ANNOTATE', verb: 'focus' },
  BACKTRACK: { kind: 'ANNOTATE', verb: 'focus' },
  ENQUEUE: { kind: 'ANNOTATE', verb: 'focus' },
  DEQUEUE: { kind: 'ANNOTATE', verb: 'focus' },
  DESCEND: { kind: 'ANNOTATE', verb: 'focus' },
  EXTREME: { kind: 'ANNOTATE', verb: 'state' },
  MEASURE: { kind: 'ANNOTATE', verb: 'focus' },
  HEIGHT: { kind: 'ANNOTATE', verb: 'state' },
  COUNT: { kind: 'ANNOTATE', verb: 'focus' },
  CLEAR: { kind: 'MUTATE', verb: 'destroy' },
};

const ref = (node: BSTNode): BSTNodeRef => ({ id: node.id, value: node.value });

export class BinarySearchTree {
  root: BSTNode | null = null;

  /** Steps recorded by the most recent operation. */
  steps: BSTStep[] = [];

  /**
   * Builds a tree from `root` and a child lookup (`childOf(id, 'L')` /
   * `childOf(id, 'R')`). A node's children are looked up the first time
   * they are read, so a walk from the root costs its depth, not the size of
   * the tree; a node reached twice is not followed again.
   */
  static fromLinks(root: BSTNodeRef | null, childOf: (id: string, side: BSTSide) => BSTNodeRef | null): BinarySearchTree {
    const tree = new BinarySearchTree();
    if (!root) return tree;
    const seen = new Set<string>([root.id]);
    const make = (r: BSTNodeRef, parent: BSTNode | null): BSTNode => {
      const node = { id: r.id, value: r.value, parent } as BSTNode;
      for (const [key, side] of [['left', 'L'], ['right', 'R']] as const) {
        let child: BSTNode | null | undefined;
        Object.defineProperty(node, key, {
          enumerable: true,
          get: () => {
            if (child === undefined) {
              const ref = childOf(r.id, side);
              child = ref && !seen.has(ref.id) ? (seen.add(ref.id), make(ref, node)) : null;
            }
            return child;
          },
          set: (value: BSTNode | null) => {
            child = value;
          },
        });
      }
      return node;
    };
    tree.root = make(root, null);
    return tree;
  }

  /** The node holding `value`, or null. */
  find(value: number): BSTNode | null {
    let current = this.root;
    while (current && current.value !== value) current = value < current.value ? current.left : current.right;
    return current;
  }

  private findById(id: string): BSTNode | null {
    const pending = this.root ? [this.root] : [];
    while (pending.length > 0) {
      const node = pending.pop()!;
      if (node.id === id) return node;
      if (node.left) pending.push(node.left);
      if (node.right) pending.push(node.right);
    }
    return null;
  }

  private sideOf(node: BSTNode): BSTSide | null {
    if (!node.parent) return null;
    return node.parent.left === node ? 'L' : 'R';
  }

  /** Replaces `node` with `replacement` under node's parent (or as the root). */
  private replace(node: BSTNode, replacement: BSTNode | null): void {
    if (!node.parent) this.root = replacement;
    else if (node.parent.left === node) node.parent.left = replacement;
    else node.parent.right = replacement;
    if (replacement) replacement.parent = node.parent;
  }

  /**
   * Walks down from the root comparing `value`, recording a COMPARE per node
   * passed; returns the node holding `value` (not recorded), or the last
   * node passed and the side `value` belongs on.
   */
  private walk(walk: BSTWalk, value: number): { match: BSTNode | null; last: BSTNode | null; side: BSTSide | null } {
    let current = this.root;
    let last: BSTNode | null = null;
    let side: BSTSide | null = null;
    while (current) {
      if (value === current.value) return { match: current, last, side };
      side = value < current.value ? 'L' : 'R';
      this.steps.push({ type: 'COMPARE', walk, node: ref(current), value, side });
      last = current;
      current = side === 'L' ? current.left : current.right;
    }
    return { match: null, last, side };
  }

  /**
   * Inserts `value` (as the node `id`). Records COMPARE per node passed, then
   * ATTACH — or DUPLICATE, and returns false, when the key is already there.
   */
  insert(value: number, id: string = String(value)): boolean {
    this.steps = [];
    const { match, last, side } = this.walk('INSERT', value);
    if (match) {
      this.steps.push({ type: 'DUPLICATE', node: ref(match), value });
      return false;
    }
    const node: BSTNode = { id, value, left: null, right: null, parent: last };
    if (!last) this.root = node;
    else if (side === 'L') last.left = node;
    else last.right = node;
    this.steps.push({ type: 'ATTACH', value, parent: last ? ref(last) : null, side: last ? side : null });
    return true;
  }

  /** Looks `value` up. Records COMPARE per node passed, then FOUND or NOT_FOUND. */
  search(value: number): BSTNodeRef | null {
    this.steps = [];
    const { match } = this.walk('SEARCH', value);
    if (!match) {
      this.steps.push({ type: 'NOT_FOUND', walk: 'SEARCH', value });
      return null;
    }
    this.steps.push({ type: 'FOUND', walk: 'SEARCH', node: ref(match), value });
    return ref(match);
  }

  /**
   * Deletes `value`. Records COMPARE per node passed, then NOT_FOUND (and
   * returns false), or FOUND, the walk to the inorder successor when the node
   * has two children (SUCCESSOR_WALK..., SUCCESSOR), and REMOVE.
   */
  delete(value: number): boolean {
    this.steps = [];
    const { match: target } = this.walk('DELETE', value);
    if (!target) {
      this.steps.push({ type: 'NOT_FOUND', walk: 'DELETE', value });
      return false;
    }
    this.steps.push({ type: 'FOUND', walk: 'DELETE', node: ref(target), value });
    const parent = target.parent ? ref(target.parent) : null;
    const side = this.sideOf(target);

    if (!target.left || !target.right) {
      const child = target.left ?? target.right;
      this.steps.push({
        type: 'REMOVE',
        node: ref(target),
        deleteCase: child ? 'ONE_CHILD' : 'LEAF',
        parent,
        side,
        replacement: child ? ref(child) : null,
        successor: null,
      });
      this.replace(target, child);
      return true;
    }

    // Two children: the inorder successor is the leftmost node of the right subtree.
    let successor = target.right;
    while (successor.left) {
      this.steps.push({ type: 'SUCCESSOR_WALK', node: ref(successor) });
      successor = successor.left;
    }
    this.steps.push({ type: 'SUCCESSOR', node: ref(successor) });
    this.steps.push({ type: 'REMOVE', node: ref(target), deleteCase: 'TWO_CHILDREN', parent, side, replacement: null, successor: ref(successor) });
    target.value = successor.value;
    this.replace(successor, successor.right);
    return true;
  }

  /**
   * Rotates at the node `pivotId`: `direction` 'L' lifts its right child,
   * 'R' its left child. Records ROTATE, or nothing when the rotation is
   * impossible (the error says why).
   */
  rotate(pivotId: string, direction: BSTSide): { success: boolean; error?: string } {
    this.steps = [];
    const pivot = this.findById(pivotId);
    if (!pivot) return { success: false, error: 'Node not found.' };
    const child = direction === 'L' ? pivot.right : pivot.left;
    if (!child) {
      const side = direction === 'L' ? 'right' : 'left';
      return { success: false, error: `Cannot rotate ${direction === 'L' ? 'left' : 'right'}: node ${pivot.value} has no ${side} child.` };
    }
    const grandchild = direction === 'L' ? child.left : child.right;
    this.steps.push({
      type: 'ROTATE',
      direction,
      pivot: ref(pivot),
      child: ref(child),
      grandchild: grandchild ? ref(grandchild) : null,
      parent: pivot.parent ? ref(pivot.parent) : null,
      parentSide: this.sideOf(pivot),
    });

    this.replace(pivot, child);
    if (direction === 'L') {
      pivot.right = grandchild;
      child.left = pivot;
    } else {
      pivot.left = grandchild;
      child.right = pivot;
    }
    if (grandchild) grandchild.parent = pivot;
    pivot.parent = child;
    return { success: true };
  }

  /** A depth-first traversal: VISIT on arrival, MOVE_LEFT / MOVE_RIGHT down and BACKTRACK up each edge, PROCESS where the order outputs the key. */
  traverse(order: DepthFirstOrder): number[] {
    this.steps = [];
    const output: number[] = [];
    const visit = (node: BSTNode) => {
      const nodeRef = ref(node);
      this.steps.push({ type: 'VISIT', order, node: nodeRef });
      const process = () => {
        output.push(node.value);
        this.steps.push({ type: 'PROCESS', order, node: nodeRef });
      };
      if (order === 'PREORDER') process();
      if (node.left) {
        const target = ref(node.left);
        this.steps.push({ type: 'MOVE_LEFT', order, node: nodeRef, targetNode: target });
        visit(node.left);
        this.steps.push({ type: 'BACKTRACK', order, node: nodeRef, targetNode: target });
      }
      if (order === 'INORDER') process();
      if (node.right) {
        const target = ref(node.right);
        this.steps.push({ type: 'MOVE_RIGHT', order, node: nodeRef, targetNode: target });
        visit(node.right);
        this.steps.push({ type: 'BACKTRACK', order, node: nodeRef, targetNode: target });
      }
      if (order === 'POSTORDER') process();
    };
    if (this.root) visit(this.root);
    return output;
  }

  /** Breadth-first traversal through a queue: ENQUEUE / DEQUEUE with the queue after each, PROCESS per key output. */
  levelOrder(): number[] {
    this.steps = [];
    const output: number[] = [];
    if (!this.root) return output;
    const queue: BSTNode[] = [this.root];
    const refs = () => queue.map(ref);
    this.steps.push({ type: 'ENQUEUE', node: ref(this.root), queue: refs() });
    while (queue.length > 0) {
      const current = queue.shift()!;
      this.steps.push({ type: 'DEQUEUE', node: ref(current), queue: refs() });
      output.push(current.value);
      this.steps.push({ type: 'PROCESS', order: 'LEVELORDER', node: ref(current) });
      for (const child of [current.left, current.right]) {
        if (!child) continue;
        queue.push(child);
        this.steps.push({ type: 'ENQUEUE', node: ref(child), queue: refs() });
      }
    }
    return output;
  }

  /** The smallest key (keep going left): DESCEND per node, then EXTREME. */
  min(): BSTNodeRef | null {
    return this.extreme('MIN');
  }

  /** The largest key (keep going right): DESCEND per node, then EXTREME. */
  max(): BSTNodeRef | null {
    return this.extreme('MAX');
  }

  private extreme(toward: 'MIN' | 'MAX'): BSTNodeRef | null {
    this.steps = [];
    let current = this.root;
    let from: BSTNode | null = null;
    while (current) {
      this.steps.push({ type: 'DESCEND', toward, node: ref(current), from: from ? ref(from) : null });
      const next: BSTNode | null = toward === 'MIN' ? current.left : current.right;
      if (!next) break;
      from = current;
      current = next;
    }
    if (!current) return null;
    this.steps.push({ type: 'EXTREME', toward, node: ref(current) });
    return ref(current);
  }

  /** Height in levels (0 for an empty tree), recursively: MEASURE on entering a subtree, HEIGHT on leaving it. */
  height(): number {
    this.steps = [];
    const measure = (node: BSTNode): number => {
      this.steps.push({ type: 'MEASURE', node: ref(node) });
      const left = node.left ? measure(node.left) : 0;
      const right = node.right ? measure(node.right) : 0;
      const h = Math.max(left, right) + 1;
      this.steps.push({ type: 'HEIGHT', node: ref(node), height: h });
      return h;
    };
    return this.root ? measure(this.root) : 0;
  }

  /** Number of nodes, counted in preorder: one COUNT per node. */
  size(): number {
    this.steps = [];
    let count = 0;
    const visit = (node: BSTNode) => {
      this.steps.push({ type: 'COUNT', node: ref(node), count: ++count });
      if (node.left) visit(node.left);
      if (node.right) visit(node.right);
    };
    if (this.root) visit(this.root);
    return count;
  }

  /** Removes every node: one CLEAR. */
  clear(): void {
    this.steps = [];
    let count = 0;
    const pending = this.root ? [this.root] : [];
    while (pending.length > 0) {
      const node = pending.pop()!;
      count++;
      if (node.left) pending.push(node.left);
      if (node.right) pending.push(node.right);
    }
    this.root = null;
    this.steps.push({ type: 'CLEAR', count });
  }
}

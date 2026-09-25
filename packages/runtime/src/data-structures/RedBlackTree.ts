/**
 * RedBlackTree — self-balancing BST maintaining the red-black invariants:
 *   1. Every node is RED or BLACK.
 *   2. The root is always BLACK.
 *   3. No RED node has a RED child (no red-red violations).
 *   4. Every path from a node to its descendant NIL leaves passes through
 *      the same number of BLACK nodes (equal black-height).
 *
 * NIL leaves are represented as `null` and treated as BLACK. Every mutating
 * operation records the recolors/rotations it performs into `steps`, so
 * callers (a RB animation engine) can replay the fixup sequence.
 */

export type Color = 'RED' | 'BLACK';

export type RBStep =
  | { type: 'COMPARE'; value: number; at: number }
  | { type: 'RECOLOR'; at: number; color: Color }
  | { type: 'ROTATE'; direction: 'LEFT' | 'RIGHT'; at: number };

export class RBNode {
  value: number;
  left: RBNode | null = null;
  right: RBNode | null = null;
  parent: RBNode | null = null;
  color: Color = 'RED';

  constructor(value: number) {
    this.value = value;
  }
}

function colorOf(node: RBNode | null): Color {
  return node ? node.color : 'BLACK';
}

export class RedBlackTree {
  root: RBNode | null = null;

  /** Steps recorded by the most recent insert/delete call. */
  steps: RBStep[] = [];

  private recolor(node: RBNode, color: Color): void {
    node.color = color;
    this.steps.push({ type: 'RECOLOR', at: node.value, color });
  }

  /** Left rotation around `node`, updating parent pointers. */
  rotateLeft(node: RBNode): void {
    const pivot = node.right!;
    node.right = pivot.left;
    if (pivot.left) pivot.left.parent = node;
    pivot.parent = node.parent;
    if (!node.parent) {
      this.root = pivot;
    } else if (node === node.parent.left) {
      node.parent.left = pivot;
    } else {
      node.parent.right = pivot;
    }
    pivot.left = node;
    node.parent = pivot;
    this.steps.push({ type: 'ROTATE', direction: 'LEFT', at: node.value });
  }

  /** Right rotation around `node`, updating parent pointers. */
  rotateRight(node: RBNode): void {
    const pivot = node.left!;
    node.left = pivot.right;
    if (pivot.right) pivot.right.parent = node;
    pivot.parent = node.parent;
    if (!node.parent) {
      this.root = pivot;
    } else if (node === node.parent.right) {
      node.parent.right = pivot;
    } else {
      node.parent.left = pivot;
    }
    pivot.right = node;
    node.parent = pivot;
    this.steps.push({ type: 'ROTATE', direction: 'RIGHT', at: node.value });
  }

  insert(value: number): void {
    this.steps = [];

    let parent: RBNode | null = null;
    let current = this.root;
    while (current) {
      this.steps.push({ type: 'COMPARE', value, at: current.value });
      parent = current;
      if (value === current.value) return; // Duplicates ignored.
      current = value < current.value ? current.left : current.right;
    }

    const node = new RBNode(value);
    node.parent = parent;
    if (!parent) {
      this.root = node;
    } else if (value < parent.value) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this.fixupInsert(node);
  }

  private fixupInsert(node: RBNode): void {
    while (node.parent && node.parent.color === 'RED') {
      const parent = node.parent;
      const grandparent = parent.parent!;

      if (parent === grandparent.left) {
        const uncle = grandparent.right;
        if (colorOf(uncle) === 'RED') {
          this.recolor(parent, 'BLACK');
          this.recolor(uncle!, 'BLACK');
          this.recolor(grandparent, 'RED');
          node = grandparent;
        } else {
          if (node === parent.right) {
            node = parent;
            this.rotateLeft(node);
          }
          this.recolor(node.parent!, 'BLACK');
          this.recolor(grandparent, 'RED');
          this.rotateRight(grandparent);
        }
      } else {
        const uncle = grandparent.left;
        if (colorOf(uncle) === 'RED') {
          this.recolor(parent, 'BLACK');
          this.recolor(uncle!, 'BLACK');
          this.recolor(grandparent, 'RED');
          node = grandparent;
        } else {
          if (node === parent.left) {
            node = parent;
            this.rotateRight(node);
          }
          this.recolor(node.parent!, 'BLACK');
          this.recolor(grandparent, 'RED');
          this.rotateLeft(grandparent);
        }
      }
    }

    if (this.root) this.recolor(this.root, 'BLACK');
  }

  private transplant(u: RBNode, v: RBNode | null): void {
    if (!u.parent) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }
    if (v) v.parent = u.parent;
  }

  private minimum(node: RBNode): RBNode {
    while (node.left) node = node.left;
    return node;
  }

  delete(value: number): void {
    this.steps = [];

    let target = this.root;
    while (target && target.value !== value) {
      this.steps.push({ type: 'COMPARE', value, at: target.value });
      target = value < target.value ? target.left : target.right;
    }
    if (!target) return;

    let removedColor = target.color;
    // `fixupParent` is the parent of the node that ends up in `target`'s
    // former position (which may be a NIL leaf), needed because a null
    // child carries no parent pointer of its own.
    let fixupNode: RBNode | null;
    let fixupParent: RBNode | null;

    if (!target.left) {
      fixupNode = target.right;
      fixupParent = target.parent;
      this.transplant(target, target.right);
    } else if (!target.right) {
      fixupNode = target.left;
      fixupParent = target.parent;
      this.transplant(target, target.left);
    } else {
      const successor = this.minimum(target.right);
      removedColor = successor.color;
      fixupNode = successor.right;

      if (successor.parent === target) {
        fixupParent = successor;
      } else {
        fixupParent = successor.parent;
        this.transplant(successor, successor.right);
        successor.right = target.right;
        successor.right.parent = successor;
      }

      this.transplant(target, successor);
      successor.left = target.left;
      successor.left.parent = successor;
      successor.color = target.color;
    }

    if (removedColor === 'BLACK') {
      this.fixupDelete(fixupNode, fixupParent);
    }
  }

  private fixupDelete(node: RBNode | null, parent: RBNode | null): void {
    while (node !== this.root && colorOf(node) === 'BLACK' && parent) {
      if (node === parent.left) {
        let sibling = parent.right;
        if (colorOf(sibling) === 'RED') {
          this.recolor(sibling!, 'BLACK');
          this.recolor(parent, 'RED');
          this.rotateLeft(parent);
          sibling = parent.right;
        }
        if (colorOf(sibling!.left) === 'BLACK' && colorOf(sibling!.right) === 'BLACK') {
          this.recolor(sibling!, 'RED');
          node = parent;
          parent = node.parent;
        } else {
          if (colorOf(sibling!.right) === 'BLACK') {
            if (sibling!.left) this.recolor(sibling!.left, 'BLACK');
            this.recolor(sibling!, 'RED');
            this.rotateRight(sibling!);
            sibling = parent.right;
          }
          this.recolor(sibling!, parent.color);
          this.recolor(parent, 'BLACK');
          if (sibling!.right) this.recolor(sibling!.right, 'BLACK');
          this.rotateLeft(parent);
          node = this.root;
          parent = null;
        }
      } else {
        let sibling = parent.left;
        if (colorOf(sibling) === 'RED') {
          this.recolor(sibling!, 'BLACK');
          this.recolor(parent, 'RED');
          this.rotateRight(parent);
          sibling = parent.left;
        }
        if (colorOf(sibling!.right) === 'BLACK' && colorOf(sibling!.left) === 'BLACK') {
          this.recolor(sibling!, 'RED');
          node = parent;
          parent = node.parent;
        } else {
          if (colorOf(sibling!.left) === 'BLACK') {
            if (sibling!.right) this.recolor(sibling!.right, 'BLACK');
            this.recolor(sibling!, 'RED');
            this.rotateLeft(sibling!);
            sibling = parent.left;
          }
          this.recolor(sibling!, parent.color);
          this.recolor(parent, 'BLACK');
          if (sibling!.left) this.recolor(sibling!.left, 'BLACK');
          this.rotateRight(parent);
          node = this.root;
          parent = null;
        }
      }
    }
    if (node) this.recolor(node, 'BLACK');
  }

  search(value: number): RBNode | null {
    let node = this.root;
    while (node) {
      if (value === node.value) return node;
      node = value < node.value ? node.left : node.right;
    }
    return null;
  }

  contains(value: number): boolean {
    return this.search(value) !== null;
  }

  /** Sorted (inorder) array of all values — useful for correctness checks. */
  inorder(): number[] {
    const result: number[] = [];
    const walk = (node: RBNode | null): void => {
      if (!node) return;
      walk(node.left);
      result.push(node.value);
      walk(node.right);
    };
    walk(this.root);
    return result;
  }

  /** True iff the root is black and no red node has a red child. */
  hasValidColors(): boolean {
    if (colorOf(this.root) !== 'BLACK') return false;
    let valid = true;
    const walk = (node: RBNode | null): void => {
      if (!node || !valid) return;
      if (node.color === 'RED') {
        if (colorOf(node.left) === 'RED' || colorOf(node.right) === 'RED') valid = false;
      }
      walk(node.left);
      walk(node.right);
    };
    walk(this.root);
    return valid;
  }

  /** Black height from the root to every NIL leaf, or -1 if it's unequal. */
  blackHeight(): number {
    const walk = (node: RBNode | null): number => {
      if (!node) return 1; // NIL leaves count as black.
      const left = walk(node.left);
      const right = walk(node.right);
      if (left === -1 || right === -1 || left !== right) return -1;
      return left + (node.color === 'BLACK' ? 1 : 0);
    };
    return walk(this.root);
  }

  /** True iff all red-black invariants hold. */
  isValid(): boolean {
    return this.hasValidColors() && this.blackHeight() !== -1;
  }
}

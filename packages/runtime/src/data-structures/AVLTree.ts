/**
 * AVLTree — self-balancing binary search tree maintaining |balanceFactor| <= 1
 * at every node via rotations after insert/delete.
 *
 * Every mutating operation records the rotations it performs into `steps`,
 * so callers (an AVL animation engine) can replay the exact rotation
 * sequence instead of just showing the before/after tree shape.
 */

export type RotationType = 'LL' | 'RR' | 'LR' | 'RL';

export type AVLStep =
  | { type: 'COMPARE'; value: number; at: number }
  | { type: 'ROTATE'; rotation: RotationType; at: number };

export class AVLNode {
  value: number;
  left: AVLNode | null = null;
  right: AVLNode | null = null;
  height = 1;

  constructor(value: number) {
    this.value = value;
  }

  get balanceFactor(): number {
    return AVLTree.getHeight(this.left) - AVLTree.getHeight(this.right);
  }
}

export class AVLTree {
  root: AVLNode | null = null;

  /** Steps recorded by the most recent insert/delete call. */
  steps: AVLStep[] = [];

  static getHeight(node: AVLNode | null): number {
    return node ? node.height : 0;
  }

  static getBalanceFactor(node: AVLNode | null): number {
    if (!node) return 0;
    return AVLTree.getHeight(node.left) - AVLTree.getHeight(node.right);
  }

  private updateHeight(node: AVLNode): void {
    node.height = 1 + Math.max(AVLTree.getHeight(node.left), AVLTree.getHeight(node.right));
  }

  /** Left rotation around `node`; returns the new subtree root. */
  rotateLeft(node: AVLNode): AVLNode {
    const newRoot = node.right!;
    node.right = newRoot.left;
    newRoot.left = node;
    this.updateHeight(node);
    this.updateHeight(newRoot);
    return newRoot;
  }

  /** Right rotation around `node`; returns the new subtree root. */
  rotateRight(node: AVLNode): AVLNode {
    const newRoot = node.left!;
    node.left = newRoot.right;
    newRoot.right = node;
    this.updateHeight(node);
    this.updateHeight(newRoot);
    return newRoot;
  }

  /** Rebalances `node` if |balanceFactor| > 1, handling LL/RR/LR/RL cases. */
  private rebalance(node: AVLNode): AVLNode {
    this.updateHeight(node);
    const bf = AVLTree.getBalanceFactor(node);

    if (bf > 1) {
      if (AVLTree.getBalanceFactor(node.left) < 0) {
        // LR case: left-right rotate
        node.left = this.rotateLeft(node.left!);
        this.steps.push({ type: 'ROTATE', rotation: 'LR', at: node.value });
      } else {
        this.steps.push({ type: 'ROTATE', rotation: 'LL', at: node.value });
      }
      return this.rotateRight(node);
    }

    if (bf < -1) {
      if (AVLTree.getBalanceFactor(node.right) > 0) {
        // RL case: right-left rotate
        node.right = this.rotateRight(node.right!);
        this.steps.push({ type: 'ROTATE', rotation: 'RL', at: node.value });
      } else {
        this.steps.push({ type: 'ROTATE', rotation: 'RR', at: node.value });
      }
      return this.rotateLeft(node);
    }

    return node;
  }

  insert(value: number): void {
    this.steps = [];
    this.root = this.insertNode(this.root, value);
  }

  private insertNode(node: AVLNode | null, value: number): AVLNode {
    if (!node) return new AVLNode(value);

    this.steps.push({ type: 'COMPARE', value, at: node.value });
    if (value < node.value) {
      node.left = this.insertNode(node.left, value);
    } else if (value > node.value) {
      node.right = this.insertNode(node.right, value);
    } else {
      // Duplicate values are ignored.
      return node;
    }

    return this.rebalance(node);
  }

  delete(value: number): void {
    this.steps = [];
    this.root = this.deleteNode(this.root, value);
  }

  private deleteNode(node: AVLNode | null, value: number): AVLNode | null {
    if (!node) return null;

    this.steps.push({ type: 'COMPARE', value, at: node.value });
    if (value < node.value) {
      node.left = this.deleteNode(node.left, value);
    } else if (value > node.value) {
      node.right = this.deleteNode(node.right, value);
    } else {
      if (!node.left || !node.right) {
        node = node.left ?? node.right ?? null;
      } else {
        // Two children: replace with inorder successor (min of right subtree).
        let successor = node.right;
        while (successor.left) successor = successor.left;
        node.value = successor.value;
        node.right = this.deleteNode(node.right, successor.value);
      }
    }

    if (!node) return null;
    return this.rebalance(node);
  }

  search(value: number): AVLNode | null {
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

  get height(): number {
    return AVLTree.getHeight(this.root);
  }

  /** Sorted (inorder) array of all values — useful for correctness checks. */
  inorder(): number[] {
    const result: number[] = [];
    const walk = (node: AVLNode | null): void => {
      if (!node) return;
      walk(node.left);
      result.push(node.value);
      walk(node.right);
    };
    walk(this.root);
    return result;
  }

  /** True iff every node satisfies |balanceFactor| <= 1. */
  isBalanced(): boolean {
    let balanced = true;
    const walk = (node: AVLNode | null): void => {
      if (!node || !balanced) return;
      if (Math.abs(AVLTree.getBalanceFactor(node)) > 1) balanced = false;
      walk(node.left);
      walk(node.right);
    };
    walk(this.root);
    return balanced;
  }
}

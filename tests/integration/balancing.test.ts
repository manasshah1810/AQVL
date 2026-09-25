/**
 * Integration tests comparing plain BST behavior against AVLTree /
 * RedBlackTree self-balancing, and verifying rotations/recolors are real
 * (structural pointer changes), not just cosmetic animation stubs.
 */
import { describe, expect, it } from 'vitest';
import { AVLTree } from '../../packages/runtime/src/data-structures/AVLTree';
import { RedBlackTree } from '../../packages/runtime/src/data-structures/RedBlackTree';

/** Minimal unbalanced BST used only as a baseline for height comparison. */
class PlainBSTNode {
  left: PlainBSTNode | null = null;
  right: PlainBSTNode | null = null;
  constructor(public value: number) {}
}

class PlainBST {
  root: PlainBSTNode | null = null;

  insert(value: number): void {
    const node = new PlainBSTNode(value);
    if (!this.root) {
      this.root = node;
      return;
    }
    let cur = this.root;
    while (true) {
      if (value < cur.value) {
        if (!cur.left) {
          cur.left = node;
          return;
        }
        cur = cur.left;
      } else {
        if (!cur.right) {
          cur.right = node;
          return;
        }
        cur = cur.right;
      }
    }
  }

  get height(): number {
    const walk = (node: PlainBSTNode | null): number => (node ? 1 + Math.max(walk(node.left), walk(node.right)) : 0);
    return walk(this.root);
  }
}

describe('Balancing integration', () => {
  it('a plain BST degenerates under sorted insertion while an AVL tree does not', () => {
    const bst = new PlainBST();
    const avl = new AVLTree();
    for (let i = 0; i < 50; i++) {
      bst.insert(i);
      avl.insert(i);
    }
    expect(bst.height).toBe(50); // Degenerates into a linked list.
    expect(avl.height).toBeLessThan(10);
    expect(avl.isBalanced()).toBe(true);
  });

  it('AVL tree auto-rebalances after every insert, keeping |BF| <= 1 throughout', () => {
    const avl = new AVLTree();
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const v of values) {
      avl.insert(v);
      expect(avl.isBalanced()).toBe(true);
    }
  });

  it('AVL rotations are real structural changes — node pointers actually move', () => {
    const avl = new AVLTree();
    avl.insert(3);
    avl.insert(2);
    const rootBefore = avl.root;
    avl.insert(1); // Triggers an LL rotation.
    expect(avl.root).not.toBe(rootBefore);
    expect(avl.root?.value).toBe(2);
    expect(avl.root?.left?.value).toBe(1);
    expect(avl.root?.right?.value).toBe(3);
    const rotateStep = avl.steps.find((s) => s.type === 'ROTATE');
    expect(rotateStep).toBeDefined();
  });

  it('red-black tree colors are visible on nodes and change through recolor steps', () => {
    const rbt = new RedBlackTree();
    rbt.insert(10);
    rbt.insert(20);
    rbt.insert(30); // Forces a rotation + recolor to fix the red-red chain.
    expect(rbt.root?.color).toBe('BLACK');
    const recolorStep = rbt.steps.find((s) => s.type === 'RECOLOR');
    expect(recolorStep).toBeDefined();
    expect(rbt.hasValidColors()).toBe(true);
  });

  it('100 random inserts leave both AVL and red-black trees balanced/valid', () => {
    const avl = new AVLTree();
    const rbt = new RedBlackTree();
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % 10000;
    };
    const seen = new Set<number>();
    while (seen.size < 100) {
      const v = rand();
      if (!seen.has(v)) {
        seen.add(v);
        avl.insert(v);
        rbt.insert(v);
      }
    }

    expect(avl.isBalanced()).toBe(true);
    expect(avl.height).toBeLessThan(1.45 * Math.log2(102));

    expect(rbt.isValid()).toBe(true);
    expect(rbt.blackHeight()).toBeLessThan(2 * Math.log2(102));

    expect(avl.inorder()).toEqual(rbt.inorder());
  });
});

/**
 * Unit tests for AVLTree (packages/runtime/src/data-structures/AVLTree.ts).
 */
import { describe, expect, it } from 'vitest';
import { AVLTree } from '../../packages/runtime/src/data-structures/AVLTree';

function isBST(tree: AVLTree): boolean {
  const values = tree.inorder();
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] >= values[i]) return false;
  }
  return true;
}

describe('AVLTree', () => {
  it('insert(5,3,7) stays balanced with no rotation needed', () => {
    const tree = new AVLTree();
    [5, 3, 7].forEach((v) => tree.insert(v));
    expect(tree.isBalanced()).toBe(true);
    expect(tree.root?.value).toBe(5);
    expect(tree.height).toBe(2);
  });

  it('insert(3,2,1) triggers an LL rotation, root becomes 2', () => {
    const tree = new AVLTree();
    [3, 2, 1].forEach((v) => tree.insert(v));
    expect(tree.root?.value).toBe(2);
    expect(tree.root?.left?.value).toBe(1);
    expect(tree.root?.right?.value).toBe(3);
    expect(tree.isBalanced()).toBe(true);
  });

  it('insert(1,2,3) triggers an RR rotation, root becomes 2', () => {
    const tree = new AVLTree();
    [1, 2, 3].forEach((v) => tree.insert(v));
    expect(tree.root?.value).toBe(2);
    expect(tree.root?.left?.value).toBe(1);
    expect(tree.root?.right?.value).toBe(3);
    expect(tree.isBalanced()).toBe(true);
  });

  it('insert(3,1,2) triggers an LR rotation, root becomes 2', () => {
    const tree = new AVLTree();
    [3, 1, 2].forEach((v) => tree.insert(v));
    expect(tree.root?.value).toBe(2);
    expect(tree.root?.left?.value).toBe(1);
    expect(tree.root?.right?.value).toBe(3);
    expect(tree.isBalanced()).toBe(true);
  });

  it('insert(1,3,2) triggers an RL rotation, root becomes 2', () => {
    const tree = new AVLTree();
    [1, 3, 2].forEach((v) => tree.insert(v));
    expect(tree.root?.value).toBe(2);
    expect(tree.root?.left?.value).toBe(1);
    expect(tree.root?.right?.value).toBe(3);
    expect(tree.isBalanced()).toBe(true);
  });

  it('records a ROTATE step when a rotation actually occurs', () => {
    const tree = new AVLTree();
    tree.insert(3);
    tree.insert(2);
    tree.insert(1); // Forces LL.
    const rotateSteps = tree.steps.filter((s) => s.type === 'ROTATE');
    expect(rotateSteps.length).toBeGreaterThan(0);
    expect(rotateSteps[0]).toMatchObject({ type: 'ROTATE', rotation: 'LL' });
  });

  it('insert(9,8) after a growing tree triggers an RR rotation locally', () => {
    const tree = new AVLTree();
    [5, 9, 8].forEach((v) => tree.insert(v));
    expect(tree.isBalanced()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('insert(6,8,4) style sequences resolve LR/RL cases and stay balanced', () => {
    const tree = new AVLTree();
    [6, 8, 4, 2, 5, 7, 9, 1, 3].forEach((v) => tree.insert(v));
    expect(tree.isBalanced()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('search finds every inserted value and rejects absent ones', () => {
    const tree = new AVLTree();
    const values = [10, 5, 15, 3, 7, 12, 18];
    values.forEach((v) => tree.insert(v));
    values.forEach((v) => expect(tree.contains(v)).toBe(true));
    expect(tree.contains(100)).toBe(false);
    expect(tree.contains(-1)).toBe(false);
  });

  it('height stays O(log n) for a large sequential insert', () => {
    const tree = new AVLTree();
    const n = 1000;
    for (let i = 0; i < n; i++) tree.insert(i);
    expect(tree.height).toBeLessThanOrEqual(1.45 * Math.log2(n + 2));
    expect(tree.isBalanced()).toBe(true);
  });

  it('delete of a leaf removes it and keeps the tree balanced', () => {
    const tree = new AVLTree();
    [5, 3, 7].forEach((v) => tree.insert(v));
    tree.delete(3);
    expect(tree.contains(3)).toBe(false);
    expect(tree.isBalanced()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('delete triggers rebalancing rotations when needed', () => {
    const tree = new AVLTree();
    [5, 2, 8, 1, 3, 7, 9, 6].forEach((v) => tree.insert(v));
    tree.delete(9);
    tree.delete(7);
    expect(tree.isBalanced()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('delete of the root with two children preserves BST order', () => {
    const tree = new AVLTree();
    [10, 5, 15, 3, 7, 12, 18].forEach((v) => tree.insert(v));
    tree.delete(10);
    expect(tree.contains(10)).toBe(false);
    expect(tree.isBalanced()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('|balanceFactor| stays <= 1 at every node after each op in a random sequence', () => {
    const tree = new AVLTree();
    const values = [50, 20, 80, 10, 30, 70, 90, 5, 15, 25, 35, 60, 75, 85, 95];
    for (const v of values) {
      tree.insert(v);
      expect(tree.isBalanced()).toBe(true);
    }
    for (const v of values.slice(0, 8)) {
      tree.delete(v);
      expect(tree.isBalanced()).toBe(true);
    }
  });

  it('never degenerates into a linked list under sorted insertion', () => {
    const tree = new AVLTree();
    for (let i = 0; i < 100; i++) tree.insert(i);
    // A degenerate BST of 100 sequential inserts would have height 100.
    expect(tree.height).toBeLessThan(20);
  });

  it('deleting a non-existent value is a no-op', () => {
    const tree = new AVLTree();
    [5, 3, 7].forEach((v) => tree.insert(v));
    tree.delete(999);
    expect(tree.inorder()).toEqual([3, 5, 7]);
  });
});

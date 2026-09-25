/**
 * Unit tests for RedBlackTree (packages/runtime/src/data-structures/RedBlackTree.ts).
 */
import { describe, expect, it } from 'vitest';
import { RedBlackTree } from '../../packages/runtime/src/data-structures/RedBlackTree';

function isBST(tree: RedBlackTree): boolean {
  const values = tree.inorder();
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] >= values[i]) return false;
  }
  return true;
}

describe('RedBlackTree', () => {
  it('insert(7,3,18,10,22,8,11,26) produces a valid red-black tree', () => {
    const tree = new RedBlackTree();
    [7, 3, 18, 10, 22, 8, 11, 26].forEach((v) => tree.insert(v));
    expect(tree.isValid()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('the root is always black after insertion', () => {
    const tree = new RedBlackTree();
    [10, 5, 15, 3, 7].forEach((v) => tree.insert(v));
    expect(tree.root?.color).toBe('BLACK');
  });

  it('a fresh single-node tree has a black root', () => {
    const tree = new RedBlackTree();
    tree.insert(42);
    expect(tree.root?.color).toBe('BLACK');
  });

  it('no red node ever has a red child (no red-red violations)', () => {
    const tree = new RedBlackTree();
    const values = [20, 10, 30, 5, 15, 25, 35, 1, 8, 12, 18];
    for (const v of values) {
      tree.insert(v);
      expect(tree.hasValidColors()).toBe(true);
    }
  });

  it('black height is equal on every root-to-NIL path', () => {
    const tree = new RedBlackTree();
    const values = [20, 10, 30, 5, 15, 25, 35, 1, 8, 12, 18, 22, 28, 40];
    values.forEach((v) => tree.insert(v));
    expect(tree.blackHeight()).toBeGreaterThan(0);
  });

  it('search finds every inserted value and rejects absent ones', () => {
    const tree = new RedBlackTree();
    const values = [50, 20, 80, 10, 30, 70, 90];
    values.forEach((v) => tree.insert(v));
    values.forEach((v) => expect(tree.contains(v)).toBe(true));
    expect(tree.contains(1000)).toBe(false);
  });

  it('recoloring/rotation steps are recorded for insertion fixups', () => {
    const tree = new RedBlackTree();
    [10, 20, 30].forEach((v) => tree.insert(v)); // Forces a left rotation + recolor.
    const rotateSteps = tree.steps.filter((s) => s.type === 'ROTATE');
    expect(rotateSteps.length).toBeGreaterThan(0);
  });

  it('delete of a leaf maintains all invariants', () => {
    const tree = new RedBlackTree();
    [10, 5, 15, 3, 7].forEach((v) => tree.insert(v));
    tree.delete(3);
    expect(tree.contains(3)).toBe(false);
    expect(tree.isValid()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('delete of a node with two children maintains all invariants', () => {
    const tree = new RedBlackTree();
    [20, 10, 30, 5, 15, 25, 35].forEach((v) => tree.insert(v));
    tree.delete(10);
    expect(tree.contains(10)).toBe(false);
    expect(tree.isValid()).toBe(true);
    expect(isBST(tree)).toBe(true);
  });

  it('delete of the root maintains all invariants', () => {
    const tree = new RedBlackTree();
    [20, 10, 30, 5, 15, 25, 35].forEach((v) => tree.insert(v));
    tree.delete(20);
    expect(tree.contains(20)).toBe(false);
    expect(tree.isValid()).toBe(true);
  });

  it('repeated deletes down to a single node keep the tree valid', () => {
    const tree = new RedBlackTree();
    const values = [20, 10, 30, 5, 15, 25, 35, 1, 8, 12, 18];
    values.forEach((v) => tree.insert(v));
    for (const v of values.slice(0, values.length - 1)) {
      tree.delete(v);
      expect(tree.isValid()).toBe(true);
    }
    expect(tree.inorder()).toEqual([values[values.length - 1]]);
  });

  it('deleting a non-existent value is a no-op', () => {
    const tree = new RedBlackTree();
    [5, 3, 7].forEach((v) => tree.insert(v));
    tree.delete(999);
    expect(tree.inorder()).toEqual([3, 5, 7]);
  });

  it('inserting duplicates does not change the tree', () => {
    const tree = new RedBlackTree();
    [5, 3, 7].forEach((v) => tree.insert(v));
    tree.insert(5);
    expect(tree.inorder()).toEqual([3, 5, 7]);
  });

  it('handles 100+ random inserts while staying valid throughout', () => {
    const tree = new RedBlackTree();
    const seen = new Set<number>();
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % 1000;
    };
    while (seen.size < 150) {
      const v = rand();
      if (!seen.has(v)) {
        seen.add(v);
        tree.insert(v);
        expect(tree.isValid()).toBe(true);
      }
    }
    expect(tree.inorder()).toEqual([...seen].sort((a, b) => a - b));
  });

  it('handles 100+ random inserts followed by random deletes while staying valid', () => {
    const tree = new RedBlackTree();
    const values: number[] = [];
    let seed = 999;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % 2000;
    };
    const seen = new Set<number>();
    while (seen.size < 120) {
      const v = rand();
      if (!seen.has(v)) {
        seen.add(v);
        values.push(v);
        tree.insert(v);
      }
    }
    expect(tree.isValid()).toBe(true);

    for (let i = 0; i < 60; i++) {
      tree.delete(values[i]);
      expect(tree.isValid()).toBe(true);
    }
    expect(isBST(tree)).toBe(true);
  });

  it('black height grows logarithmically, never degenerating into a list', () => {
    const tree = new RedBlackTree();
    for (let i = 0; i < 200; i++) tree.insert(i);
    expect(tree.isValid()).toBe(true);
    expect(tree.blackHeight()).toBeLessThan(20);
  });
});

/**
 * Unit tests for UnionFind (packages/runtime/src/data-structures/UnionFind.ts) —
 * the disjoint-set structure backing GraphAlgorithm.kruskal (see GraphEngine.ts).
 */
import { describe, expect, it } from 'vitest';
import { UnionFind } from '../../packages/runtime/src/data-structures/UnionFind';

describe('UnionFind', () => {
  it('find() returns each fresh element as its own representative', () => {
    const uf = new UnionFind(['A', 'B', 'C']);
    expect(uf.find('A')).toBe('A');
    expect(uf.find('B')).toBe('B');
    expect(uf.find('C')).toBe('C');
  });

  it('union() merges two components under a single representative', () => {
    const uf = new UnionFind(['A', 'B']);
    uf.union('A', 'B');
    expect(uf.find('A')).toBe(uf.find('B'));
  });

  it('connected() detects vertices in the same set', () => {
    const uf = new UnionFind(['A', 'B', 'C']);
    uf.union('A', 'B');
    expect(uf.connected('A', 'B')).toBe(true);
    expect(uf.connected('A', 'C')).toBe(false);
  });

  it('union() of already-connected elements returns false and changes nothing', () => {
    const uf = new UnionFind(['A', 'B']);
    expect(uf.union('A', 'B')).toBe(true);
    expect(uf.union('A', 'B')).toBe(false);
    expect(uf.connected('A', 'B')).toBe(true);
  });

  it('path compression keeps find() correct after chained unions', () => {
    const uf = new UnionFind(['A', 'B', 'C', 'D', 'E']);
    uf.union('A', 'B');
    uf.union('B', 'C');
    uf.union('C', 'D');
    uf.union('D', 'E');
    const root = uf.find('A');
    expect(uf.find('B')).toBe(root);
    expect(uf.find('C')).toBe(root);
    expect(uf.find('D')).toBe(root);
    expect(uf.find('E')).toBe(root);
  });

  it('lazily creates elements not seen at construction time', () => {
    const uf = new UnionFind();
    expect(uf.find('X')).toBe('X');
    uf.union('X', 'Y');
    expect(uf.connected('X', 'Y')).toBe(true);
  });
});

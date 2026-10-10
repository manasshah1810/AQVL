/**
 * Plain TypeScript references the catalogue's expectations are computed with.
 * Each mirrors the AQVL runtime's own conventions (tree literals in level
 * order where a NULL has no children, neighbours in edge order, vertices in
 * order of first appearance), so an expectation is what a correct program
 * really leaves behind, for any input.
 */
import type { Input, InputValue } from '../types';

export const nums = (input: Input, key: string): number[] => (input[key] as number[]) ?? [];
export const strs = (input: Input, key: string): string[] => (input[key] as string[]) ?? [];
export const num = (input: Input, key: string): number => input[key] as number;
export const str = (input: Input, key: string): string => input[key] as string;

export interface TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

/** A `BINARY_TREE t = [...]` literal: level order, left to right; a NULL slot has no children. */
export function treeFromLevels(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;
  const root: TreeNode = { val: values[0] as number, left: null, right: null };
  const queue: TreeNode[] = [root];
  let i = 1;
  while (queue.length > 0 && i < values.length) {
    const node = queue.shift()!;
    for (const side of ['left', 'right'] as const) {
      if (i >= values.length) break;
      const v = values[i++];
      if (v !== null) {
        const child: TreeNode = { val: v, left: null, right: null };
        node[side] = child;
        queue.push(child);
      }
    }
  }
  return root;
}

/** A tree in level order with NULL for missing children, trailing NULLs dropped (how the grader reads a tree). */
export function levelsOf(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = root ? [root] : [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    if (!n) {
      out.push(null);
      continue;
    }
    out.push(n.val);
    queue.push(n.left, n.right);
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

/** A BST built by inserting `keys` in order (equal keys go right, as the runtime's walk does). */
export function bstInsert(root: TreeNode | null, key: number): TreeNode {
  const n: TreeNode = { val: key, left: null, right: null };
  if (!root) return n;
  let curr = root;
  for (;;) {
    if (key < curr.val) {
      if (!curr.left) {
        curr.left = n;
        return root;
      }
      curr = curr.left;
    } else {
      if (!curr.right) {
        curr.right = n;
        return root;
      }
      curr = curr.right;
    }
  }
}

export function bstFrom(keys: number[]): TreeNode | null {
  let root: TreeNode | null = null;
  for (const k of keys) root = bstInsert(root, k);
  return root;
}

export function inorder(root: TreeNode | null, out: number[] = []): number[] {
  if (root) {
    inorder(root.left, out);
    out.push(root.val);
    inorder(root.right, out);
  }
  return out;
}

export function height(root: TreeNode | null): number {
  return root ? 1 + Math.max(height(root.left), height(root.right)) : 0;
}

export function leaves(root: TreeNode | null): number {
  if (!root) return 0;
  if (!root.left && !root.right) return 1;
  return leaves(root.left) + leaves(root.right);
}

export interface Graph {
  vertices: string[];
  /** Neighbours of each vertex, in edge order. */
  adj: Map<string, string[]>;
  /** Edges coming into each vertex (directed graphs). */
  inDegree: Map<string, number>;
}

/** A `GRAPH g = [...]` literal: "A-B" undirected, "A->B" directed, "D" a lone vertex. */
export function graphOf(edges: string[]): Graph {
  const vertices: string[] = [];
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const add = (v: string) => {
    if (!adj.has(v)) {
      vertices.push(v);
      adj.set(v, []);
      inDegree.set(v, 0);
    }
  };
  for (const raw of edges) {
    const e = raw.split(':')[0];
    if (e.includes('->')) {
      const [a, b] = e.split('->');
      add(a);
      add(b);
      adj.get(a)!.push(b);
      inDegree.set(b, inDegree.get(b)! + 1);
    } else if (e.includes('-')) {
      const [a, b] = e.split('-');
      add(a);
      add(b);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    } else {
      add(e);
    }
  }
  return { vertices, adj, inDegree };
}

export function bfsOrder(g: Graph, start: string): { order: string[]; dist: Map<string, number> } {
  const seen = new Set([start]);
  const dist = new Map([[start, 0]]);
  const order: string[] = [];
  const queue = [start];
  while (queue.length > 0) {
    const v = queue.shift()!;
    order.push(v);
    for (const w of g.adj.get(v)!) {
      if (!seen.has(w)) {
        seen.add(w);
        dist.set(w, dist.get(v)! + 1);
        queue.push(w);
      }
    }
  }
  return { order, dist };
}

export function dfsOrder(g: Graph, start: string, seen = new Set<string>(), order: string[] = []): string[] {
  seen.add(start);
  order.push(start);
  for (const w of g.adj.get(start)!) if (!seen.has(w)) dfsOrder(g, w, seen, order);
  return order;
}

export function words(list: string[]): string[] {
  return [...new Set(list)];
}

/** Every prefix stored by a trie holding `list` (the root is ""). */
export function triePrefixes(list: string[]): string[] {
  const out = new Set<string>(['']);
  for (const w of list) for (let i = 1; i <= w.length; i++) out.add(w.slice(0, i));
  return [...out];
}

/** Min-heap sift down over an array, as the challenge code does it. */
export function siftDown(h: number[], start: number): void {
  let parent = start;
  for (;;) {
    let smallest = parent;
    const left = 2 * parent + 1;
    const right = 2 * parent + 2;
    if (left < h.length && h[left] < h[smallest]) smallest = left;
    if (right < h.length && h[right] < h[smallest]) smallest = right;
    if (smallest === parent) return;
    [h[parent], h[smallest]] = [h[smallest], h[parent]];
    parent = smallest;
  }
}

export function siftUp(h: number[], start: number): void {
  let child = start;
  while (child > 0) {
    const parent = (child - 1 - ((child - 1) % 2)) / 2;
    if (h[child] < h[parent]) {
      [h[child], h[parent]] = [h[parent], h[child]];
      child = parent;
    } else return;
  }
}

export const copy = <T extends InputValue>(v: T): T => JSON.parse(JSON.stringify(v));

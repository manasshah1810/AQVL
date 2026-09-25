/**
 * Unit tests for MinHeap (packages/runtime/src/data-structures/PriorityQueue.ts) —
 * the indexed min-heap backing Dijkstra/A* in GraphEngine.
 */
import { describe, expect, it } from 'vitest';
import { MinHeap } from '../../packages/runtime/src/data-structures/PriorityQueue';

describe('MinHeap', () => {
  it('pops values in ascending priority order', () => {
    const heap = new MinHeap<string>();
    heap.push('C', 3);
    heap.push('A', 1);
    heap.push('B', 2);
    expect(heap.pop()).toBe('A');
    expect(heap.pop()).toBe('B');
    expect(heap.pop()).toBe('C');
  });

  it('handles pushes and pops interleaved with duplicate priorities', () => {
    const heap = new MinHeap<string>();
    heap.push('A', 1);
    heap.push('B', 1);
    heap.push('C', 0);
    expect(heap.pop()).toBe('C');
    const rest = [heap.pop(), heap.pop()].sort();
    expect(rest).toEqual(['A', 'B']);
  });

  it('updatePriority lowers a value so it pops sooner', () => {
    const heap = new MinHeap<string>();
    heap.push('A', 10);
    heap.push('B', 5);
    heap.push('C', 20);
    heap.updatePriority('C', 1);
    expect(heap.pop()).toBe('C');
    expect(heap.pop()).toBe('B');
    expect(heap.pop()).toBe('A');
  });

  it('updatePriority can also raise a value so it pops later', () => {
    const heap = new MinHeap<string>();
    heap.push('A', 1);
    heap.push('B', 2);
    heap.updatePriority('A', 5);
    expect(heap.pop()).toBe('B');
    expect(heap.pop()).toBe('A');
  });

  it('contains reflects membership as values are pushed and popped', () => {
    const heap = new MinHeap<string>();
    expect(heap.contains('A')).toBe(false);
    heap.push('A', 1);
    expect(heap.contains('A')).toBe(true);
    heap.pop();
    expect(heap.contains('A')).toBe(false);
  });

  it('isEmpty is true only when there are no entries', () => {
    const heap = new MinHeap<string>();
    expect(heap.isEmpty()).toBe(true);
    heap.push('A', 1);
    expect(heap.isEmpty()).toBe(false);
    heap.pop();
    expect(heap.isEmpty()).toBe(true);
  });

  it('pop on an empty heap returns undefined', () => {
    const heap = new MinHeap<string>();
    expect(heap.pop()).toBeUndefined();
  });

  it('pushing an existing value updates its priority instead of duplicating it', () => {
    const heap = new MinHeap<string>();
    heap.push('A', 10);
    heap.push('A', 1);
    expect(heap.size).toBe(1);
    expect(heap.pop()).toBe('A');
  });

  it('maintains heap order under a larger randomized workload', () => {
    const heap = new MinHeap<number>();
    const priorities = Array.from({ length: 50 }, () => Math.floor(Math.random() * 1000));
    priorities.forEach((p, i) => heap.push(i, p));

    const popped: number[] = [];
    while (!heap.isEmpty()) {
      const id = heap.pop()!;
      popped.push(priorities[id]);
    }

    const sorted = [...popped].sort((a, b) => a - b);
    expect(popped).toEqual(sorted);
  });
});

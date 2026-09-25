/**
 * Unit tests for MinHeap (packages/runtime/src/data-structures/Heap.ts) —
 * the array-based binary min-heap backing HEAP_INSERT / HEAP_EXTRACT /
 * HEAP_DECREASE / BUILD_HEAP / HEAPIFY (see ../../packages/runtime/src/core/algorithms/HeapEngine).
 */
import { describe, expect, it } from 'vitest';
import { MinHeap } from '../../packages/runtime/src/data-structures/Heap';

describe('MinHeap', () => {
  it('insert(5,3,7) maintains the min-heap property', () => {
    const heap = new MinHeap();
    heap.insert(5);
    heap.insert(3);
    heap.insert(7);
    expect(heap.isMinHeap()).toBe(true);
    expect(heap.peek()).toBe(3);
  });

  it('extractMin returns the smallest value and restores the heap property', () => {
    const heap = new MinHeap();
    [5, 3, 7].forEach((v) => heap.insert(v));
    expect(heap.extractMin()).toBe(3);
    expect(heap.isMinHeap()).toBe(true);
    expect(heap.toArray().sort((a, b) => a - b)).toEqual([5, 7]);
  });

  it('decreaseKey lowers a value and bubbles it up toward the root', () => {
    const heap = new MinHeap();
    [20, 10, 30, 40, 50].forEach((v) => heap.insert(v));
    const idx = heap.elements.indexOf(40);
    heap.decreaseKey(idx, 1);
    expect(heap.isMinHeap()).toBe(true);
    expect(heap.peek()).toBe(1);
  });

  it('decreaseKey throws when the new value is greater than the current one', () => {
    const heap = new MinHeap();
    heap.insert(10);
    expect(() => heap.decreaseKey(0, 20)).toThrow(RangeError);
  });

  it('decreaseKey throws on an out-of-bounds index', () => {
    const heap = new MinHeap();
    heap.insert(10);
    expect(() => heap.decreaseKey(5, 1)).toThrow(RangeError);
  });

  it('isMinHeap validates a correctly-ordered structure and rejects a broken one', () => {
    const heap = new MinHeap();
    [1, 3, 5, 7, 9].forEach((v) => heap.insert(v));
    expect(heap.isMinHeap()).toBe(true);

    // Directly corrupt the backing array to simulate a broken heap.
    heap.elements = [5, 1, 2];
    expect(heap.isMinHeap()).toBe(false);
  });

  it('toArray returns a copy, not the live backing array', () => {
    const heap = new MinHeap();
    heap.insert(1);
    const copy = heap.toArray();
    copy.push(999);
    expect(heap.elements).toEqual([1]);
  });

  it('sequential inserts then extracts yield ascending order', () => {
    const heap = new MinHeap();
    [9, 5, 1, 7, 3].forEach((v) => heap.insert(v));
    const out: number[] = [];
    while (!heap.isEmpty()) {
      out.push(heap.extractMin()!);
    }
    expect(out).toEqual([1, 3, 5, 7, 9]);
  });

  it('handles an empty heap: peek and extractMin return undefined', () => {
    const heap = new MinHeap();
    expect(heap.peek()).toBeUndefined();
    expect(heap.extractMin()).toBeUndefined();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.isMinHeap()).toBe(true);
  });

  it('handles a single-element heap', () => {
    const heap = new MinHeap();
    heap.insert(42);
    expect(heap.peek()).toBe(42);
    expect(heap.extractMin()).toBe(42);
    expect(heap.isEmpty()).toBe(true);
  });

  it('handles duplicate values without breaking the heap property', () => {
    const heap = new MinHeap();
    [5, 5, 5, 1, 1, 3].forEach((v) => heap.insert(v));
    expect(heap.isMinHeap()).toBe(true);
    const out: number[] = [];
    while (!heap.isEmpty()) out.push(heap.extractMin()!);
    expect(out).toEqual([1, 1, 3, 5, 5, 5]);
  });

  it('heapifyUp and heapifyDown are directly callable and keep the property intact', () => {
    const heap = new MinHeap();
    heap.elements = [1, 10, 3, 5, 8];
    heap.heapifyDown(1); // node 10 has children 5, 8 -> smallest child (5) should bubble up
    expect(heap.elements[1]).toBe(5);
    expect(heap.isMinHeap()).toBe(true);

    heap.elements = [10, 1, 2];
    heap.heapifyUp(1); // node 1 is smaller than root 10 -> should bubble to root
    expect(heap.elements[0]).toBe(1);
    expect(heap.isMinHeap()).toBe(true);
  });

  it('buildHeap constructs a valid heap from an arbitrary unordered array in place', () => {
    const heap = MinHeap.buildHeap([9, 4, 7, 1, -2, 6, 5]);
    expect(heap.isMinHeap()).toBe(true);
    expect(heap.peek()).toBe(-2);
    expect(heap.toArray().sort((a, b) => a - b)).toEqual([-2, 1, 4, 5, 6, 7, 9]);
  });

  it('maintains heap order under a larger randomized workload', () => {
    const heap = new MinHeap();
    const values = Array.from({ length: 200 }, () => Math.floor(Math.random() * 10000));
    values.forEach((v) => heap.insert(v));
    expect(heap.isMinHeap()).toBe(true);

    const out: number[] = [];
    while (!heap.isEmpty()) {
      out.push(heap.extractMin()!);
      expect(heap.isMinHeap()).toBe(true);
    }
    expect(out).toEqual([...values].sort((a, b) => a - b));
  });

  it('records COMPARE/SWAP steps for insert and extractMin (used to drive animation frames)', () => {
    const heap = new MinHeap();
    heap.insert(10);
    heap.insert(5);
    // 5 bubbles above 10 -> at least one swap recorded
    expect(heap.steps.some((s) => s.type === 'SWAP')).toBe(true);

    heap.insert(1);
    heap.extractMin();
    expect(heap.steps.length).toBeGreaterThan(0);
  });
});

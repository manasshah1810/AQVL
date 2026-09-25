/**
 * MinHeap — array-based binary min-heap over plain numbers.
 *
 * This is the "real" heap backing AQVL's HEAP_INSERT / HEAP_EXTRACT /
 * HEAP_DECREASE / BUILD_HEAP / HEAPIFY operations (see
 * ../core/algorithms/HeapEngine.ts), replacing the earlier stub that only
 * played a highlight animation without touching any actual data.
 *
 * Indices follow the standard implicit binary-tree layout:
 *   parent(i) = floor((i - 1) / 2)
 *   left(i)   = 2i + 1
 *   right(i)  = 2i + 2
 *
 * Every mutating operation records the COMPARE/SWAP steps it performs into
 * `steps`, so callers (HeapEngine) can replay the exact sequence of
 * comparisons and swaps as an animation instead of just showing the before
 * and after state.
 */

export type HeapStep =
  | { type: 'COMPARE'; i: number; j: number }
  | { type: 'SWAP'; i: number; j: number };

export class MinHeap {
  elements: number[] = [];

  /** Steps recorded by the most recent insert/extractMin/decreaseKey call (or accumulated across a buildHeap). */
  steps: HeapStep[] = [];

  get size(): number {
    return this.elements.length;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  private parentIndex(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftIndex(i: number): number {
    return 2 * i + 1;
  }

  private rightIndex(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.elements[i], this.elements[j]] = [this.elements[j], this.elements[i]];
    this.steps.push({ type: 'SWAP', i, j });
  }

  /** Returns the minimum element without removing it. */
  peek(): number | undefined {
    return this.elements[0];
  }

  /** Adds a new value at the end of the heap, then bubbles it up into place. */
  insert(value: number): void {
    this.steps = [];
    this.elements.push(value);
    this.heapifyUp(this.elements.length - 1);
  }

  /** Removes and returns the minimum element, restoring the heap property. */
  extractMin(): number | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;

    const min = this.elements[0];
    const last = this.elements.pop()!;

    if (this.elements.length > 0) {
      this.elements[0] = last;
      this.heapifyDown(0);
    }

    return min;
  }

  /**
   * Lowers the value at `index` and bubbles it up. Throws if the index is
   * out of bounds or the new value is not actually smaller (this is a
   * decrease-key, not a general update).
   */
  decreaseKey(index: number, newValue: number): void {
    this.steps = [];
    if (index < 0 || index >= this.elements.length) {
      throw new RangeError(`decreaseKey: index ${index} is out of bounds for heap of size ${this.elements.length}.`);
    }
    if (newValue > this.elements[index]) {
      throw new RangeError(`decreaseKey: newValue ${newValue} is greater than current value ${this.elements[index]} at index ${index}.`);
    }

    this.elements[index] = newValue;
    this.heapifyUp(index);
  }

  /** Bubbles the element at `index` up toward the root while it is smaller than its parent. */
  heapifyUp(index: number): void {
    let i = index;
    while (i > 0) {
      const p = this.parentIndex(i);
      this.steps.push({ type: 'COMPARE', i, j: p });
      if (this.elements[i] < this.elements[p]) {
        this.swap(i, p);
        i = p;
      } else {
        break;
      }
    }
  }

  /** Bubbles the element at `index` down toward the leaves while it is larger than a child. */
  heapifyDown(index: number): void {
    let i = index;
    const n = this.elements.length;

    while (true) {
      let smallest = i;
      const l = this.leftIndex(i);
      const r = this.rightIndex(i);

      if (l < n) {
        this.steps.push({ type: 'COMPARE', i: l, j: smallest });
        if (this.elements[l] < this.elements[smallest]) smallest = l;
      }
      if (r < n) {
        this.steps.push({ type: 'COMPARE', i: r, j: smallest });
        if (this.elements[r] < this.elements[smallest]) smallest = r;
      }

      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  /** Validates the min-heap property holds at every node. Used for testing/assertions. */
  isMinHeap(): boolean {
    for (let i = 0; i < this.elements.length; i++) {
      const l = this.leftIndex(i);
      const r = this.rightIndex(i);
      if (l < this.elements.length && this.elements[l] < this.elements[i]) return false;
      if (r < this.elements.length && this.elements[r] < this.elements[i]) return false;
    }
    return true;
  }

  /** Returns a shallow copy of the backing array. */
  toArray(): number[] {
    return [...this.elements];
  }

  /** Builds a heap from an arbitrary array in O(n) via bottom-up heapify. Steps accumulate across every heapifyDown call. */
  static buildHeap(values: number[]): MinHeap {
    const heap = new MinHeap();
    heap.elements = [...values];
    heap.steps = [];

    for (let i = Math.floor(heap.elements.length / 2) - 1; i >= 0; i--) {
      heap.heapifyDown(i);
    }

    return heap;
  }
}

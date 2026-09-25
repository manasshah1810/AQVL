/**
 * MinHeap — indexed binary min-heap keyed by an arbitrary priority.
 *
 * Backs Dijkstra/A* (see ../core/algorithms/GraphEngine), which both need
 * "insert with priority, pop the minimum, and lower an already-queued
 * vertex's priority" (decrease-key) in better than linear time. The
 * `indexMap` is what makes `contains`/`updatePriority` O(log n) instead of
 * an O(n) scan: it tracks each value's current position in the backing
 * array as swaps happen during sift up/down.
 */
export class MinHeap<T = string> {
  private heap: { value: T; priority: number }[] = [];
  private indexMap: Map<T, number> = new Map();

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  contains(value: T): boolean {
    return this.indexMap.has(value);
  }

  peek(): T | undefined {
    return this.heap[0]?.value;
  }

  peekPriority(): number | undefined {
    return this.heap[0]?.priority;
  }

  /** Inserts a new value, or updates its priority if already present. */
  push(value: T, priority: number): void {
    if (this.indexMap.has(value)) {
      this.updatePriority(value, priority);
      return;
    }

    this.heap.push({ value, priority });
    const idx = this.heap.length - 1;
    this.indexMap.set(value, idx);
    this.bubbleUp(idx);
  }

  /** Removes and returns the value with the lowest priority, or undefined if empty. */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop()!;
    this.indexMap.delete(top.value);

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.indexMap.set(last.value, 0);
      this.bubbleDown(0);
    }

    return top.value;
  }

  /** Changes an existing value's priority (decrease- or increase-key) and re-heapifies. */
  updatePriority(value: T, newPriority: number): void {
    const idx = this.indexMap.get(value);
    if (idx === undefined) {
      this.push(value, newPriority);
      return;
    }

    const oldPriority = this.heap[idx].priority;
    this.heap[idx].priority = newPriority;

    if (newPriority < oldPriority) {
      this.bubbleUp(idx);
    } else if (newPriority > oldPriority) {
      this.bubbleDown(idx);
    }
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.heap[parentIdx].priority <= this.heap[idx].priority) break;
      this.swap(idx, parentIdx);
      idx = parentIdx;
    }
  }

  private bubbleDown(idx: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < n && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === idx) break;

      this.swap(idx, smallest);
      idx = smallest;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    this.indexMap.set(this.heap[i].value, i);
    this.indexMap.set(this.heap[j].value, j);
  }
}

/**
 * Unit tests for SortAlgorithm (packages/runtime/src/core/algorithms/SortEngine.ts) —
 * the pure, scene-free bubble/selection/insertion sort implementations that
 * back the AQVL BUBBLE_SORT / SELECTION_SORT / INSERTION_SORT built-ins.
 */
import { describe, expect, it } from 'vitest';
import { SortAlgorithm, type SortResult } from '../../packages/runtime/src/core/algorithms/SortEngine';

type Runner = (array: number[]) => SortResult<number>;

const ALGORITHMS: Record<string, Runner> = {
  bubbleSort: (array) => SortAlgorithm.bubbleSort(array),
  selectionSort: (array) => SortAlgorithm.selectionSort(array),
  insertionSort: (array) => SortAlgorithm.insertionSort(array),
};

for (const [name, run] of Object.entries(ALGORITHMS)) {
  describe(`SortAlgorithm.${name}`, () => {
    it('sorts an unordered array of numbers ascending', () => {
      const input = [5, 2, 8, 1, 9];
      const result = run(input);
      expect(result.array).toEqual([1, 2, 5, 8, 9]);
    });

    it('handles an empty array', () => {
      const input: number[] = [];
      const result = run(input);
      expect(result.array).toEqual([]);
      expect(result.steps).toEqual([]);
      expect(result.comparisons).toBe(0);
      expect(result.swaps).toBe(0);
    });

    it('handles a single-element array', () => {
      const input = [42];
      const result = run(input);
      expect(result.array).toEqual([42]);
      expect(result.comparisons).toBe(0);
      expect(result.swaps).toBe(0);
    });

    it('leaves an already-sorted array unchanged with no swaps', () => {
      const input = [1, 2, 3];
      const result = run(input);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.swaps).toBe(0);
    });

    it('sorts a reverse-ordered array', () => {
      const input = [3, 2, 1];
      const result = run(input);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.swaps).toBeGreaterThan(0);
    });

    it('handles an array of all-duplicate values without unnecessary swaps', () => {
      const input = [5, 5, 5];
      const result = run(input);
      expect(result.array).toEqual([5, 5, 5]);
      expect(result.swaps).toBe(0);
    });

    it('sorts an array containing negative numbers', () => {
      const input = [4, -7, 0, -1, 9, -3];
      const result = run(input);
      expect(result.array).toEqual([-7, -3, -1, 0, 4, 9]);
    });

    it('sorts the array in place (same array reference returned)', () => {
      const input = [3, 1, 2];
      const result = run(input);
      expect(result.array).toBe(input);
      expect(input).toEqual([1, 2, 3]);
    });

    it('emits an animation frame (SWAP step) for every reported swap', () => {
      const input = [3, 1, 2];
      const result = run(input);
      const swapSteps = result.steps.filter((s) => s.type === 'SWAP');
      expect(swapSteps).toHaveLength(result.swaps);
      expect(result.swaps).toBeGreaterThan(0);
    });
  });
}

describe('SortAlgorithm complexity (O(n^2))', () => {
  it('bubbleSort comparisons scale quadratically on a reverse-sorted array', () => {
    const n = 20;
    const input = Array.from({ length: n }, (_, i) => n - i);
    const result = SortAlgorithm.bubbleSort(input);
    // Worst case: n*(n-1)/2 comparisons for bubble sort.
    expect(result.comparisons).toBe((n * (n - 1)) / 2);
  });

  it('selectionSort always performs exactly n*(n-1)/2 comparisons regardless of input order', () => {
    const n = 15;
    const sorted = Array.from({ length: n }, (_, i) => i);
    const reversed = [...sorted].reverse();
    const sortedResult = SortAlgorithm.selectionSort([...sorted]);
    const reversedResult = SortAlgorithm.selectionSort([...reversed]);
    expect(sortedResult.comparisons).toBe((n * (n - 1)) / 2);
    expect(reversedResult.comparisons).toBe((n * (n - 1)) / 2);
  });

  it('insertionSort comparisons scale quadratically on a reverse-sorted array', () => {
    const n = 20;
    const input = Array.from({ length: n }, (_, i) => n - i);
    const result = SortAlgorithm.insertionSort(input);
    expect(result.comparisons).toBe((n * (n - 1)) / 2);
  });
});

describe('SortAlgorithm custom comparator', () => {
  it('supports a descending comparator', () => {
    const input = [1, 5, 3, 2, 4];
    const result = SortAlgorithm.bubbleSort(input, (a, b) => b - a);
    expect(result.array).toEqual([5, 4, 3, 2, 1]);
  });
});

/**
 * mergeSort / quickSort — Phase 3.2. Both use true recursion (mergeSort /
 * quickSort call a private recursive helper that calls itself on each
 * half/partition, mirroring AQVL's own FUNCTION/CALL/RET recursion), so
 * unlike bubble/selection/insertion they run in O(n log n) (merge sort
 * always; quick sort on average).
 */
const nlogn = (n: number) => (n <= 1 ? 0 : n * Math.log2(n));

describe('SortAlgorithm.mergeSort', () => {
  it('sorts an unordered array of numbers ascending', () => {
    const result = SortAlgorithm.mergeSort([5, 2, 8, 1, 9]);
    expect(result.array).toEqual([1, 2, 5, 8, 9]);
  });

  it('handles an empty array', () => {
    const result = SortAlgorithm.mergeSort([]);
    expect(result.array).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it('handles a single-element array', () => {
    const result = SortAlgorithm.mergeSort([42]);
    expect(result.array).toEqual([42]);
    expect(result.steps).toEqual([]);
  });

  it('leaves an already-sorted array unchanged', () => {
    const result = SortAlgorithm.mergeSort([1, 2, 3, 4, 5]);
    expect(result.array).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts a reverse-ordered array', () => {
    const result = SortAlgorithm.mergeSort([5, 4, 3, 2, 1]);
    expect(result.array).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles an array of all-duplicate values', () => {
    const result = SortAlgorithm.mergeSort([7, 7, 7, 7]);
    expect(result.array).toEqual([7, 7, 7, 7]);
  });

  it('sorts 1000 elements correctly within an O(n log n) comparison bound', () => {
    const n = 1000;
    const input = Array.from({ length: n }, () => Math.floor(Math.random() * 100000));
    const expected = [...input].sort((a, b) => a - b);
    const result = SortAlgorithm.mergeSort(input);
    expect(result.array).toEqual(expected);
    // Merge sort is always O(n log n); allow generous headroom over the
    // theoretical n*log2(n) for the constant factor of per-level comparisons.
    expect(result.comparisons).toBeLessThan(nlogn(n) * 2);
  });

  it('sorts in place, emits OVERWRITE frames for merge writes, and performs far fewer comparisons than bubble sort on the same large reverse-ordered input', () => {
    const n = 500;
    const input = Array.from({ length: n }, (_, i) => n - i);
    const mergeResult = SortAlgorithm.mergeSort(input);
    expect(mergeResult.array).toBe(input);
    expect(mergeResult.steps.some((s) => s.type === 'OVERWRITE')).toBe(true);

    const bubbleResult = SortAlgorithm.bubbleSort(Array.from({ length: n }, (_, i) => n - i));
    expect(mergeResult.comparisons).toBeLessThan(bubbleResult.comparisons);
  });
});

describe('SortAlgorithm.quickSort', () => {
  it('sorts an unordered array of numbers ascending', () => {
    const result = SortAlgorithm.quickSort([5, 2, 8, 1, 9]);
    expect(result.array).toEqual([1, 2, 5, 8, 9]);
  });

  it('handles an empty array', () => {
    const result = SortAlgorithm.quickSort([]);
    expect(result.array).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it('handles a single-element array', () => {
    const result = SortAlgorithm.quickSort([42]);
    expect(result.array).toEqual([42]);
    expect(result.steps).toEqual([]);
  });

  it('leaves an already-sorted array correctly sorted', () => {
    const result = SortAlgorithm.quickSort([1, 2, 3, 4, 5]);
    expect(result.array).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts a reverse-ordered array', () => {
    const result = SortAlgorithm.quickSort([5, 4, 3, 2, 1]);
    expect(result.array).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles an array of all-duplicate values', () => {
    const result = SortAlgorithm.quickSort([7, 7, 7, 7]);
    expect(result.array).toEqual([7, 7, 7, 7]);
  });

  it('sorts 1000 random elements correctly, averaging O(n log n) comparisons', () => {
    const n = 1000;
    const input = Array.from({ length: n }, () => Math.floor(Math.random() * 100000));
    const expected = [...input].sort((a, b) => a - b);
    const result = SortAlgorithm.quickSort(input);
    expect(result.array).toEqual(expected);
    // Average case O(n log n); random input avoids the sorted-input worst
    // case of this Lomuto/last-element-pivot implementation.
    expect(result.comparisons).toBeLessThan(nlogn(n) * 4);
  });

  it('sorts in place, emits a PIVOT frame per partition, and (on random input) performs far fewer comparisons than bubble sort', () => {
    const n = 500;
    const input = Array.from({ length: n }, () => Math.floor(Math.random() * 100000));
    const toSort = [...input];
    const quickResult = SortAlgorithm.quickSort(toSort);
    expect(quickResult.array).toBe(toSort); // in-place: same reference as passed in
    expect(quickResult.steps.some((s) => s.type === 'PIVOT')).toBe(true);

    const bubbleResult = SortAlgorithm.bubbleSort([...input]);
    expect(quickResult.comparisons).toBeLessThan(bubbleResult.comparisons);
  });
});

describe('SortAlgorithm true recursion (mergeSort / quickSort)', () => {
  it('mergeSort and quickSort both agree with a naive sort on a large, non-trivial input', () => {
    const input = Array.from({ length: 2000 }, () => Math.floor(Math.random() * 1_000_000));
    const expected = [...input].sort((a, b) => a - b);
    expect(SortAlgorithm.mergeSort([...input]).array).toEqual(expected);
    expect(SortAlgorithm.quickSort([...input]).array).toEqual(expected);
  });

  it('partition() returns the pivot value\'s final sorted index', () => {
    const array = [4, 2, 7, 1, 9, 3];
    const pivotIndex = SortAlgorithm.partition(array, 0, array.length - 1);
    const pivotValue = array[pivotIndex];
    expect(array.slice(0, pivotIndex).every((v) => v <= pivotValue)).toBe(true);
    expect(array.slice(pivotIndex + 1).every((v) => v >= pivotValue)).toBe(true);
  });

  it('merge() combines two adjacent sorted runs in place', () => {
    const array = [1, 3, 5, 2, 4, 6];
    SortAlgorithm.merge(array, 0, 2, 5);
    expect(array).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

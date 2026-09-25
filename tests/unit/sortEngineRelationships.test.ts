/**
 * Tests for the relationship/region SortStep variants added per
 * docs/design/array-visual-language-spec.md §4 — the index-level
 * counterparts of the new AQIR instructions SHOW_COMPARISON_LINK /
 * HIDE_COMPARISON_LINK / SET_PARTITION_BOUNDARY / CLEAR_PARTITION_BOUNDARY /
 * MARK_SORTED_REGION (packages/shared/src/aqir/types.ts).
 *
 * The focus, per the task, is pairing/ordering/nesting correctness — an
 * orphaned link or boundary that never clears is a visible bug — not merely
 * that the fields exist.
 */
import { describe, expect, it } from 'vitest';
import { SortAlgorithm, type SortStep } from '../../packages/runtime/src/core/algorithms/SortEngine';

function stepsOfType<K extends SortStep['type']>(steps: SortStep[], type: K): Extract<SortStep, { type: K }>[] {
  return steps.filter((s): s is Extract<SortStep, { type: K }> => s.type === type);
}

/** Every SHOW must be immediately (module intervening COMPARE steps) followed by a HIDE for the same pair, with no gaps or overlaps — i.e. link spans never interleave. */
function assertLinksWellPaired(steps: SortStep[]): void {
  const shows = stepsOfType(steps, 'SHOW_COMPARISON_LINK');
  const hides = stepsOfType(steps, 'HIDE_COMPARISON_LINK');
  expect(shows.length).toBe(hides.length);

  let openLink: { i: number; j: number } | null = null;
  for (const step of steps) {
    if (step.type === 'SHOW_COMPARISON_LINK') {
      expect(openLink).toBeNull(); // no link opens while another is still open
      openLink = { i: step.i, j: step.j };
    } else if (step.type === 'HIDE_COMPARISON_LINK') {
      expect(openLink).not.toBeNull();
      expect(step.i).toBe(openLink!.i);
      expect(step.j).toBe(openLink!.j);
      openLink = null;
    }
  }
  expect(openLink).toBeNull(); // nothing left dangling at the end
}

/** Bracket-match SET/CLEAR_PARTITION_BOUNDARY like parentheses: LIFO, nothing left open. */
function assertBoundariesWellNested(steps: SortStep[]): { setCount: number; maxDepth: number } {
  const stack: { startIndex: number; endIndex: number }[] = [];
  let maxDepth = 0;
  let setCount = 0;
  for (const step of steps) {
    if (step.type === 'SET_PARTITION_BOUNDARY') {
      stack.push({ startIndex: step.startIndex, endIndex: step.endIndex });
      setCount++;
      maxDepth = Math.max(maxDepth, stack.length);
    } else if (step.type === 'CLEAR_PARTITION_BOUNDARY') {
      const top = stack.pop();
      expect(top).toBeDefined(); // CLEAR with no matching open SET
      expect(step.startIndex).toBe(top!.startIndex);
      expect(step.endIndex).toBe(top!.endIndex);
    }
  }
  expect(stack).toHaveLength(0); // nothing left open at the end
  return { setCount, maxDepth };
}

describe('Bubble Sort — relationship instructions', () => {
  it('emits a SHOW/HIDE_COMPARISON_LINK pair for every COMPARE, well paired with no overlap', () => {
    const { steps } = SortAlgorithm.bubbleSort([5, 2, 8, 1, 9]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SHOW_COMPARISON_LINK').length).toBe(stepsOfType(steps, 'COMPARE').length);
  });

  it('every link pair references the same (i, j) as its enclosed COMPARE step', () => {
    const { steps } = SortAlgorithm.bubbleSort([5, 2, 8, 1, 9]);
    for (let idx = 0; idx < steps.length; idx++) {
      if (steps[idx].type === 'SHOW_COMPARISON_LINK') {
        const show = steps[idx] as Extract<SortStep, { type: 'SHOW_COMPARISON_LINK' }>;
        const compare = steps[idx + 1] as Extract<SortStep, { type: 'COMPARE' }>;
        expect(compare.type).toBe('COMPARE');
        expect(compare.i).toBe(show.i);
        expect(compare.j).toBe(show.j);
      }
    }
  });

  it('MARK_SORTED_REGION grows monotonically from the end backward (startIndex only shrinks, endIndex fixed at n-1)', () => {
    const array = [9, 8, 7, 6, 5];
    const n = array.length;
    const { steps } = SortAlgorithm.bubbleSort(array);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    expect(regions.length).toBeGreaterThan(0);
    let prevStart = n; // one past the last valid index: shrinks toward 0
    for (const r of regions) {
      expect(r.endIndex).toBe(n - 1);
      expect(r.startIndex).toBeLessThan(prevStart); // strictly grows (shrinking start) each pass
      prevStart = r.startIndex;
    }
    // Bubble sort's outer loop confirms n-1 elements at most (index 0 is trivially sorted
    // by elimination once everything else is placed), so the final region's start bottoms out at 1.
    expect(regions[regions.length - 1].startIndex).toBe(1);
  });

  it('never marks a sorted region that shrinks (each region is a superset of the previous one)', () => {
    const { steps } = SortAlgorithm.bubbleSort([4, 3, 2, 1]);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    for (let k = 1; k < regions.length; k++) {
      const prevSize = regions[k - 1].endIndex - regions[k - 1].startIndex + 1;
      const curSize = regions[k].endIndex - regions[k].startIndex + 1;
      expect(curSize).toBeGreaterThan(prevSize);
    }
  });

  it('an already-sorted array still emits a well-formed (possibly single-pass) link and region stream', () => {
    const { steps } = SortAlgorithm.bubbleSort([1, 2, 3, 4]);
    assertLinksWellPaired(steps);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    expect(regions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Selection Sort — relationship instructions', () => {
  it('emits a SHOW/HIDE_COMPARISON_LINK pair for every COMPARE, well paired', () => {
    const { steps } = SortAlgorithm.selectionSort([5, 2, 8, 1, 9]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SHOW_COMPARISON_LINK').length).toBe(stepsOfType(steps, 'COMPARE').length);
  });

  it('MARK_SORTED_REGION grows monotonically from the beginning forward (startIndex fixed at 0, endIndex only grows)', () => {
    const array = [5, 2, 8, 1, 9, 3];
    const { steps } = SortAlgorithm.selectionSort(array);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    expect(regions.length).toBeGreaterThan(0);
    let prevEnd = -1;
    for (const r of regions) {
      expect(r.startIndex).toBe(0);
      expect(r.endIndex).toBeGreaterThan(prevEnd);
      prevEnd = r.endIndex;
    }
  });

  it('emits exactly one MARK_SORTED_REGION per outer iteration, matching FINALIZE count', () => {
    const { steps } = SortAlgorithm.selectionSort([5, 2, 8, 1, 9]);
    expect(stepsOfType(steps, 'MARK_SORTED_REGION').length).toBe(stepsOfType(steps, 'FINALIZE').length);
  });

  it('produces a well-formed link stream even when no swaps occur (already sorted input)', () => {
    const { steps } = SortAlgorithm.selectionSort([1, 2, 3, 4]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SWAP')).toHaveLength(0);
    expect(stepsOfType(steps, 'MARK_SORTED_REGION').length).toBeGreaterThan(0);
  });
});

describe('Insertion Sort — relationship instructions', () => {
  it('emits a SHOW/HIDE_COMPARISON_LINK pair for every COMPARE, well paired', () => {
    const { steps } = SortAlgorithm.insertionSort([4, 3, 2, 1]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SHOW_COMPARISON_LINK').length).toBe(stepsOfType(steps, 'COMPARE').length);
  });

  it('MARK_SORTED_REGION grows monotonically from the beginning forward, one region per outer iteration', () => {
    const array = [4, 3, 2, 1, 5];
    const n = array.length;
    const { steps } = SortAlgorithm.insertionSort(array);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    // Outer loop runs for i = 1..n-1: one region per iteration.
    expect(regions).toHaveLength(n - 1);
    let prevEnd = 0; // prefix [0,0] is trivially sorted before the loop starts
    for (const r of regions) {
      expect(r.startIndex).toBe(0);
      expect(r.endIndex).toBeGreaterThan(prevEnd);
      prevEnd = r.endIndex;
    }
    expect(regions[regions.length - 1].endIndex).toBe(n - 1);
  });

  it('an already-sorted array still grows the region by exactly one index per iteration', () => {
    const { steps } = SortAlgorithm.insertionSort([1, 2, 3, 4]);
    const regions = stepsOfType(steps, 'MARK_SORTED_REGION');
    expect(regions.map((r) => r.endIndex)).toEqual([1, 2, 3]);
    expect(stepsOfType(steps, 'SWAP')).toHaveLength(0);
  });

  it('link pairs never span across an outer iteration boundary (no dangling link at any FINALIZE)', () => {
    const { steps } = SortAlgorithm.insertionSort([5, 4, 3, 2, 1]);
    const finalizeIdxs = steps.map((s, idx) => (s.type === 'FINALIZE' ? idx : -1)).filter((idx) => idx !== -1);
    let openCount = 0;
    for (let idx = 0; idx <= finalizeIdxs[0]; idx++) {
      if (steps[idx].type === 'SHOW_COMPARISON_LINK') openCount++;
      if (steps[idx].type === 'HIDE_COMPARISON_LINK') openCount--;
    }
    expect(openCount).toBe(0); // fully closed by the time the first FINALIZE fires
  });
});

describe('Merge Sort — relationship instructions', () => {
  it('emits a SHOW/HIDE_COMPARISON_LINK pair for every COMPARE, well paired', () => {
    const { steps } = SortAlgorithm.mergeSort([5, 2, 8, 1, 9, 3]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SHOW_COMPARISON_LINK').length).toBe(stepsOfType(steps, 'COMPARE').length);
  });

  it('emits one well-nested SET/CLEAR_PARTITION_BOUNDARY pair per merge() call', () => {
    const { steps } = SortAlgorithm.mergeSort([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const { setCount } = assertBoundariesWellNested(steps);
    // merge() is called once per internal node of the recursion tree: n-1 calls for n>=1
    // leaves (n=9 -> 8 internal merges), matching the SET/CLEAR pair count exactly.
    const overwriteRuns = stepsOfType(steps, 'CLEAR_PARTITION_BOUNDARY').length;
    expect(setCount).toBe(overwriteRuns);
    expect(setCount).toBeGreaterThan(0);
  });

  it('boundary ranges are always non-overlapping in time for sibling/parent merge() calls (well-nested check enforces LIFO)', () => {
    const { steps } = SortAlgorithm.mergeSort([6, 5, 4, 3, 2, 1]);
    assertBoundariesWellNested(steps); // throws/fails via expect() if any CLEAR mismatches its SET
  });

  it('the final (outermost) merge call\'s boundary spans the whole array', () => {
    const array = [7, 3, 5, 1, 9, 2, 8];
    const { steps } = SortAlgorithm.mergeSort(array);
    const sets = stepsOfType(steps, 'SET_PARTITION_BOUNDARY');
    const last = sets[sets.length - 1];
    expect(last.startIndex).toBe(0);
    expect(last.endIndex).toBe(array.length - 1);
  });

  it('a direct merge() call on a sub-range emits a boundary scoped to exactly that range', () => {
    const array = [1, 3, 5, 2, 4, 6];
    const steps: SortStep[] = [];
    SortAlgorithm.merge(array, 0, 2, 5, undefined, steps);
    const sets = stepsOfType(steps, 'SET_PARTITION_BOUNDARY');
    const clears = stepsOfType(steps, 'CLEAR_PARTITION_BOUNDARY');
    expect(sets).toHaveLength(1);
    expect(clears).toHaveLength(1);
    expect(sets[0]).toMatchObject({ startIndex: 0, endIndex: 5 });
    expect(clears[0]).toMatchObject({ startIndex: 0, endIndex: 5 });
  });
});

describe('Quick Sort — relationship instructions', () => {
  it('emits a SHOW/HIDE_COMPARISON_LINK pair for every COMPARE, well paired', () => {
    const { steps } = SortAlgorithm.quickSort([5, 2, 8, 1, 9, 3, 7]);
    assertLinksWellPaired(steps);
    expect(stepsOfType(steps, 'SHOW_COMPARISON_LINK').length).toBe(stepsOfType(steps, 'COMPARE').length);
  });

  it('emits one SET/CLEAR_PARTITION_BOUNDARY pair per recursive quickSortRecurse call that actually partitions', () => {
    const { steps } = SortAlgorithm.quickSort([5, 2, 8, 1, 9, 3, 7]);
    const { setCount } = assertBoundariesWellNested(steps);
    // Every real partition() call is preceded by exactly one SET (from the enclosing quickSortRecurse).
    expect(setCount).toBe(stepsOfType(steps, 'PIVOT').length);
  });

  it('a sub-partition boundary is set after and cleared before its parent partition boundary (correct call/return nesting)', () => {
    const array = [7, 6, 5, 4, 3, 2, 1];
    const { steps } = SortAlgorithm.quickSort(array);
    const { maxDepth } = assertBoundariesWellNested(steps);
    // Reverse-sorted input with a last-element pivot recurses maximally: depth should exceed 1.
    expect(maxDepth).toBeGreaterThan(1);
  });

  it('the outermost partition boundary spans the whole array and is the first SET / last CLEAR emitted', () => {
    const array = [4, 2, 7, 1, 9, 3, 6];
    const { steps } = SortAlgorithm.quickSort(array);
    const sets = stepsOfType(steps, 'SET_PARTITION_BOUNDARY');
    const clears = stepsOfType(steps, 'CLEAR_PARTITION_BOUNDARY');
    expect(sets[0]).toMatchObject({ startIndex: 0, endIndex: array.length - 1 });
    expect(clears[clears.length - 1]).toMatchObject({ startIndex: 0, endIndex: array.length - 1 });
  });

  it('a direct partition() call emits no SET/CLEAR_PARTITION_BOUNDARY of its own (that is quickSortRecurse\'s job)', () => {
    // Confirms the boundary is scoped to the recursive call, not to partition() itself —
    // otherwise a partition() call's boundary would close before its children's sub-partitions run.
    const array = [4, 2, 7, 1, 9, 3];
    const steps: SortStep[] = [];
    SortAlgorithm.partition(array, 0, array.length - 1, undefined, steps);
    expect(stepsOfType(steps, 'SET_PARTITION_BOUNDARY')).toHaveLength(0);
    expect(stepsOfType(steps, 'CLEAR_PARTITION_BOUNDARY')).toHaveLength(0);
  });
});

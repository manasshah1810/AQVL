/**
 * Semantic-tagging tests for SortAlgorithm's SortStep enrichment
 * (packages/runtime/src/core/algorithms/SortEngine.ts) — verifies the
 * intent/significance/algorithmPhase/algorithmName metadata added per
 * docs/design/array-aqir-semantic-gap.md §1.5/§2 is not just present, but
 * semantically correct: the right tag on the right step at the right point
 * in each algorithm's trace.
 *
 * Pre-existing behavior (sort correctness, comparison/swap counts, step
 * types) is covered by sortEngine.test.ts and is untouched here — these new
 * fields are additive and optional.
 */
import { describe, expect, it } from 'vitest';
import { SortAlgorithm, type SortStep } from '../../packages/runtime/src/core/algorithms/SortEngine';

function stepsOfType<K extends SortStep['type']>(steps: SortStep[], type: K): Extract<SortStep, { type: K }>[] {
  return steps.filter((s): s is Extract<SortStep, { type: K }> => s.type === type);
}

describe('Bubble Sort — semantic tagging', () => {
  it('tags every COMPARE as adjacent-check/routine with algorithmName bubble-sort', () => {
    const { steps } = SortAlgorithm.bubbleSort([5, 2, 8, 1, 9]);
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.length).toBeGreaterThan(0);
    for (const c of compares) {
      expect(c.intent).toBe('adjacent-check');
      expect(c.significance).toBe('routine');
      expect(c.algorithmName).toBe('bubble-sort');
    }
  });

  it('tags every SWAP as adjacent-swap/notable', () => {
    const { steps } = SortAlgorithm.bubbleSort([3, 2, 1]);
    const swaps = stepsOfType(steps, 'SWAP');
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.intent).toBe('adjacent-swap');
      expect(s.significance).toBe('notable');
    }
  });

  it('emits a FINALIZE(final-placement, pivotal) for the max-of-suffix index after each completed pass', () => {
    const array = [3, 2, 1];
    const n = array.length;
    const { steps } = SortAlgorithm.bubbleSort(array);
    const finalizes = stepsOfType(steps, 'FINALIZE');
    // No early-exit possible on a fully reverse-sorted array of length 3: both passes run.
    expect(finalizes.map((f) => f.i)).toEqual([n - 1, n - 2]);
    for (const f of finalizes) {
      expect(f.intent).toBe('final-placement');
      expect(f.significance).toBe('pivotal');
      expect(f.algorithmName).toBe('bubble-sort');
    }
  });

  it('a FINALIZE for pass i always comes after every COMPARE/SWAP belonging to that pass', () => {
    const { steps } = SortAlgorithm.bubbleSort([9, 1, 8, 2, 7]);
    const n = 5;
    let passStart = 0;
    for (let pass = 0; pass < n - 1; pass++) {
      const finalizeIdx = steps.findIndex(
        (s, idx) => idx >= passStart && s.type === 'FINALIZE' && s.i === n - 1 - pass
      );
      if (finalizeIdx === -1) break; // early exit (already sorted)
      const passSlice = steps.slice(passStart, finalizeIdx);
      expect(
        passSlice.every((s) => s.type === 'COMPARE' || s.type === 'SWAP' || s.type === 'SHOW_COMPARISON_LINK' || s.type === 'HIDE_COMPARISON_LINK')
      ).toBe(true);
      // FINALIZE is immediately followed by this pass's MARK_SORTED_REGION — skip both before the next pass starts.
      passStart = finalizeIdx + (steps[finalizeIdx + 1]?.type === 'MARK_SORTED_REGION' ? 2 : 1);
    }
  });
});

describe('Selection Sort — semantic tagging', () => {
  it('tags the min-finding COMPAREs as candidate-check/routine, naming the running candidate', () => {
    const { steps } = SortAlgorithm.selectionSort([5, 2, 8, 1, 9]);
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.length).toBeGreaterThan(0);
    for (const c of compares) {
      expect(c.intent).toBe('candidate-check');
      expect(c.significance).toBe('routine');
      expect(c.algorithmName).toBe('selection-sort');
      expect(typeof c.candidate).toBe('number');
    }
  });

  it('tags the actual selection swap as selection-swap/notable, distinct from routine comparisons', () => {
    const { steps } = SortAlgorithm.selectionSort([5, 2, 8, 1, 9]);
    const swaps = stepsOfType(steps, 'SWAP');
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.intent).toBe('selection-swap');
      expect(s.significance).toBe('notable');
    }
    // The vocabularies must not overlap: no COMPARE step ever carries the swap's tag.
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.every((c) => c.intent !== 'selection-swap')).toBe(true);
  });

  it('emits exactly one FINALIZE per outer iteration, at index i, even when no swap was needed', () => {
    const { steps } = SortAlgorithm.selectionSort([1, 2, 3, 4]); // already sorted: minIdx === i every time, no swaps
    const finalizes = stepsOfType(steps, 'FINALIZE');
    expect(finalizes.map((f) => f.i)).toEqual([0, 1, 2]);
    expect(stepsOfType(steps, 'SWAP')).toHaveLength(0);
  });

  it('the candidate field tracks the running minimum as it updates mid-sweep', () => {
    // For i=0 sweeping [3,1,2]: candidate starts at 0, updates to 1 once array[1]=1 is seen smaller.
    const { steps } = SortAlgorithm.selectionSort([3, 1, 2]);
    const firstSweep = stepsOfType(steps, 'COMPARE').filter((c) => c.j <= 2 && c.candidate !== undefined).slice(0, 2);
    expect(firstSweep[0].candidate).toBe(0); // comparing candidate(0)=3 vs j=1 value 1
    expect(firstSweep[1].candidate).toBe(1); // minIdx updated to 1 before comparing against j=2
  });
});

describe('Insertion Sort — semantic tagging', () => {
  it('tags shift-check COMPAREs and routine shift SWAPs distinctly from the final placement', () => {
    const { steps } = SortAlgorithm.insertionSort([4, 3, 2, 1]);
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.length).toBeGreaterThan(0);
    for (const c of compares) {
      expect(c.intent).toBe('shift-check');
      expect(c.algorithmName).toBe('insertion-sort');
    }
  });

  it('retags only the last swap of each backward walk as insertion-placement/notable', () => {
    // [4,3,2,1] inserting index 3 (value 1) walks all the way back: 3 shifts, last one is the placement.
    const array = [4, 3, 2, 1];
    const { steps } = SortAlgorithm.insertionSort(array);
    const swaps = stepsOfType(steps, 'SWAP');
    expect(swaps.length).toBeGreaterThan(1);

    // Every backward walk ends in exactly one insertion-placement swap; every swap
    // before it in that same walk must be a routine shift.
    let runStart = 0;
    let placementCount = 0;
    for (let idx = 0; idx < swaps.length; idx++) {
      if (swaps[idx].intent === 'insertion-placement') {
        placementCount++;
        for (let k = runStart; k < idx; k++) {
          expect(swaps[k].intent).toBe('shift');
          expect(swaps[k].significance).toBe('routine');
        }
        expect(swaps[idx].significance).toBe('notable');
        runStart = idx + 1;
      }
    }
    // Every swap belongs to some walk that ended in a placement — none left dangling.
    expect(runStart).toBe(swaps.length);
    expect(placementCount).toBeGreaterThan(0);
  });

  it('an already-sorted array produces no shift/placement swaps at all', () => {
    const { steps } = SortAlgorithm.insertionSort([1, 2, 3, 4]);
    expect(stepsOfType(steps, 'SWAP')).toHaveLength(0);
    expect(stepsOfType(steps, 'COMPARE').every((c) => c.intent === 'shift-check')).toBe(true);
  });

  it('a single out-of-place element at the front produces exactly one insertion-placement swap per walk', () => {
    const { steps } = SortAlgorithm.insertionSort([2, 1, 3, 4]);
    const placements = stepsOfType(steps, 'SWAP').filter((s) => s.intent === 'insertion-placement');
    expect(placements).toHaveLength(1);
  });
});

describe('Merge Sort — semantic tagging', () => {
  it('tags every COMPARE as merge-comparison in the combine phase', () => {
    const { steps } = SortAlgorithm.mergeSort([5, 2, 8, 1, 9, 3]);
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.length).toBeGreaterThan(0);
    for (const c of compares) {
      expect(c.intent).toBe('merge-comparison');
      expect(c.algorithmPhase).toBe('combine');
      expect(c.algorithmName).toBe('merge-sort');
    }
  });

  it('tags every OVERWRITE as merge-write in the combine phase', () => {
    const { steps } = SortAlgorithm.mergeSort([5, 2, 8, 1, 9, 3]);
    const overwrites = stepsOfType(steps, 'OVERWRITE');
    expect(overwrites.length).toBeGreaterThan(0);
    for (const o of overwrites) {
      expect(o.intent).toBe('merge-write');
      expect(o.algorithmPhase).toBe('combine');
      expect(o.algorithmName).toBe('merge-sort');
    }
  });

  it('every emitted step belongs to the combine phase (divide itself produces no discrete step)', () => {
    const { steps } = SortAlgorithm.mergeSort([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.algorithmPhase === 'combine')).toBe(true);
  });

  it('a call to merge() directly on adjacent runs still tags its steps correctly', () => {
    const array = [1, 3, 5, 2, 4, 6];
    const steps: SortStep[] = [];
    SortAlgorithm.merge(array, 0, 2, 5, undefined, steps);
    expect(steps.some((s) => s.type === 'COMPARE' && s.intent === 'merge-comparison')).toBe(true);
    expect(steps.some((s) => s.type === 'OVERWRITE' && s.intent === 'merge-write')).toBe(true);
  });
});

describe('Quick Sort — semantic tagging', () => {
  it('emits exactly one pivot-selection PIVOT step per partition() call', () => {
    const array = [4, 2, 7, 1, 9, 3];
    const steps: SortStep[] = [];
    SortAlgorithm.partition(array, 0, array.length - 1, undefined, steps);
    const pivots = stepsOfType(steps, 'PIVOT');
    expect(pivots).toHaveLength(1);
    expect(pivots[0].intent).toBe('pivot-selection');
    expect(pivots[0].algorithmPhase).toBe('partition');
    expect(['notable', 'pivotal']).toContain(pivots[0].significance);
  });

  it('a full quickSort emits exactly one PIVOT per recursive partition() call invoked', () => {
    const { steps } = SortAlgorithm.quickSort([5, 2, 8, 1, 9, 3, 7]);
    const pivots = stepsOfType(steps, 'PIVOT');
    const finalizes = stepsOfType(steps, 'FINALIZE');
    // partition() always pushes exactly one PIVOT and one FINALIZE, so counts must match.
    expect(pivots.length).toBe(finalizes.length);
    expect(pivots.length).toBeGreaterThan(0);
  });

  it('tags in-loop comparisons as partition-boundary/routine, distinct from pivot-selection', () => {
    const array = [4, 2, 7, 1, 9, 3];
    const steps: SortStep[] = [];
    SortAlgorithm.partition(array, 0, array.length - 1, undefined, steps);
    const compares = stepsOfType(steps, 'COMPARE');
    expect(compares.length).toBeGreaterThan(0);
    for (const c of compares) {
      expect(c.intent).toBe('partition-boundary');
      expect(c.significance).toBe('routine');
    }
  });

  it('tags the pivot lock-in swap (or FINALIZE-only when no swap is needed) as final-placement/pivotal', () => {
    const array = [1, 2, 3, 9, 5]; // pivot=5 (index 4) is already >= everything left of it after partitioning
    const steps: SortStep[] = [];
    const pivotIndex = SortAlgorithm.partition(array, 0, array.length - 1, undefined, steps);
    const finalize = stepsOfType(steps, 'FINALIZE');
    expect(finalize).toHaveLength(1);
    expect(finalize[0].i).toBe(pivotIndex);
    expect(finalize[0].intent).toBe('final-placement');
    expect(finalize[0].significance).toBe('pivotal');

    const lockInSwaps = stepsOfType(steps, 'SWAP').filter((s) => s.intent === 'final-placement');
    expect(lockInSwaps.length).toBeLessThanOrEqual(1);
    // Every non-lock-in swap must be a routine partition-swap.
    for (const s of stepsOfType(steps, 'SWAP')) {
      if (s.intent !== 'final-placement') {
        expect(s.intent).toBe('partition-swap');
        expect(s.significance).toBe('routine');
      }
    }
  });

  it('FINALIZE always marks the value returned by partition() as the pivot final index', () => {
    const array = [8, 3, 5, 1, 9, 2];
    const steps: SortStep[] = [];
    const pivotIndex = SortAlgorithm.partition(array, 0, array.length - 1, undefined, steps);
    const finalize = stepsOfType(steps, 'FINALIZE')[0];
    expect(finalize.i).toBe(pivotIndex);
  });
});

describe('Cross-algorithm: algorithmName correctly distinguishes every step in a mixed run', () => {
  it('never mixes algorithmName across independently-run sorts', () => {
    const bubble = SortAlgorithm.bubbleSort([3, 1, 2]).steps;
    const selection = SortAlgorithm.selectionSort([3, 1, 2]).steps;
    const insertion = SortAlgorithm.insertionSort([3, 1, 2]).steps;
    const merge = SortAlgorithm.mergeSort([3, 1, 2]).steps;
    const quick = SortAlgorithm.quickSort([3, 1, 2]).steps;

    expect(bubble.every((s) => s.algorithmName === 'bubble-sort')).toBe(true);
    expect(selection.every((s) => s.algorithmName === 'selection-sort')).toBe(true);
    expect(insertion.every((s) => s.algorithmName === 'insertion-sort')).toBe(true);
    expect(merge.every((s) => s.algorithmName === 'merge-sort')).toBe(true);
    expect(quick.every((s) => s.algorithmName === 'quick-sort')).toBe(true);
  });
});

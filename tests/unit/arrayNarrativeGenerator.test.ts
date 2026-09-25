/**
 * Tests for ArrayNarrativeGenerator (packages/runtime/src/narrative/ArrayNarrativeGenerator.ts)
 * — verifies each backend-dependent template from docs/design/array-narrative-ux-spec.md §1
 * is produced with exact wording and correct substitution, plus that unrecognized/missing
 * intent data degrades gracefully instead of crashing or leaking "undefined" into the text.
 *
 * Per the spec's §5 backend-vs-frontend table, only templates 2/3/5/6/7/8/9 depend on
 * backend-only data — templates 1/4/10/11/12 are frontend-only and are not implemented
 * by this generator, so instructions that would map to one of those are expected to
 * fall back to the generic description rather than reproduce that content here.
 */
import { describe, expect, it } from 'vitest';
import { ArrayNarrativeGenerator, type StructureState } from '../../packages/runtime/src/narrative/ArrayNarrativeGenerator';
import type { SortStep } from '../../packages/runtime/src/core/algorithms/SortEngine';

const generator = new ArrayNarrativeGenerator();

function stateOf(structureName: string, values: Record<number, number>): StructureState {
  const arr: (number | undefined)[] = [];
  for (const [idx, v] of Object.entries(values)) arr[Number(idx)] = v;
  return { structureName, values: arr };
}

describe('Template 2/3 — compare outcome (bubble/insertion/quicksort-style adjacent decisions)', () => {
  it('produces the "will be swapped" text when the left value is greater (adjacent-check)', () => {
    const step: SortStep = { type: 'COMPARE', i: 2, j: 3, algorithmName: 'bubble-sort', intent: 'adjacent-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 2: 7, 3: 3 }));
    expect(text).toBe('7 > 3 — arr[2] and arr[3] will be swapped');
  });

  it('produces the "already in order" text when the left value is not greater (adjacent-check)', () => {
    const step: SortStep = { type: 'COMPARE', i: 0, j: 1, algorithmName: 'bubble-sort', intent: 'adjacent-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 1, 1: 5 }));
    expect(text).toBe('1 ≤ 5 — already in order, no swap needed');
  });

  it('applies the same outcome template to insertion sort\'s shift-check intent', () => {
    const step: SortStep = { type: 'COMPARE', i: 3, j: 4, algorithmName: 'insertion-sort', intent: 'shift-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('nums', { 3: 9, 4: 2 }));
    expect(text).toBe('9 > 2 — nums[3] and nums[4] will be swapped');
  });

  it('applies the same outcome template to quick sort\'s partition-boundary intent', () => {
    const step: SortStep = { type: 'COMPARE', i: 1, j: 5, algorithmName: 'quick-sort', algorithmPhase: 'partition', intent: 'partition-boundary', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 1: 4, 5: 10 }));
    expect(text).toBe('4 ≤ 10 — already in order, no swap needed');
  });

  it('equal values are treated as "already in order" (≤, not a swap)', () => {
    const step: SortStep = { type: 'COMPARE', i: 0, j: 1, algorithmName: 'bubble-sort', intent: 'adjacent-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 5, 1: 5 }));
    expect(text).toBe('5 ≤ 5 — already in order, no swap needed');
  });
});

describe('Template 5 — finalize (bubble/selection/insertion confirming a position)', () => {
  it('produces the exact finalize text for a bubble sort FINALIZE step', () => {
    const step: SortStep = { type: 'FINALIZE', i: 4, algorithmName: 'bubble-sort', intent: 'final-placement', significance: 'pivotal' };
    const text = generator.generateNarrative(step, stateOf('arr', { 4: 9 }));
    expect(text).toBe('arr[4] has reached its final sorted position');
  });

  it('produces the exact finalize text for a selection sort FINALIZE step', () => {
    const step: SortStep = { type: 'FINALIZE', i: 0, algorithmName: 'selection-sort', intent: 'final-placement', significance: 'pivotal' };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 1 }));
    expect(text).toBe('arr[0] has reached its final sorted position');
  });

  it('produces the exact finalize text for an insertion sort FINALIZE step', () => {
    const step: SortStep = { type: 'FINALIZE', i: 2, algorithmName: 'insertion-sort', intent: 'final-placement', significance: 'pivotal' };
    const text = generator.generateNarrative(step, stateOf('arr', { 2: 3 }));
    expect(text).toBe('arr[2] has reached its final sorted position');
  });
});

describe('Template 6 — pivot selection (quicksort)', () => {
  it('produces the exact pivot-selection text', () => {
    const step: SortStep = { type: 'PIVOT', i: 6, algorithmName: 'quick-sort', algorithmPhase: 'partition', intent: 'pivot-selection', significance: 'notable', left: 0, right: 6 };
    const text = generator.generateNarrative(step, stateOf('arr', { 6: 42 }));
    expect(text).toBe('Selecting arr[6]=42 as the pivot for this partition');
  });
});

describe('Template 7 — pivot lock-in + split (quicksort)', () => {
  it('produces correct text from a SWAP instruction tagged final-placement', () => {
    const step: SortStep = { type: 'SWAP', i: 3, j: 6, algorithmName: 'quick-sort', algorithmPhase: 'partition', intent: 'final-placement', significance: 'pivotal', left: 0, right: 6 };
    const text = generator.generateNarrative(step, stateOf('arr', { 3: 5 }));
    expect(text).toBe('Pivot 5 locked into its final position at arr[3] — partition splits into [0-2] and [4-6]');
  });

  it('produces the same text from a FINALIZE step when no physical swap was needed (pivot already resting)', () => {
    const step: SortStep = { type: 'FINALIZE', i: 6, algorithmName: 'quick-sort', algorithmPhase: 'partition', intent: 'final-placement', significance: 'pivotal', left: 2, right: 6 };
    const text = generator.generateNarrative(step, stateOf('arr', { 6: 99 }));
    expect(text).toBe('Pivot 99 locked into its final position at arr[6] — partition splits into [2-5] and [7-6]');
  });

  it('handles a pivot locking in at the left edge of its partition (empty left split)', () => {
    const step: SortStep = { type: 'SWAP', i: 0, j: 4, algorithmName: 'quick-sort', algorithmPhase: 'partition', intent: 'final-placement', significance: 'pivotal', left: 0, right: 4 };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 1 }));
    expect(text).toBe('Pivot 1 locked into its final position at arr[0] — partition splits into [0--1] and [1-4]');
  });
});

describe('Template 8 — new running candidate (selection sort)', () => {
  it('produces the exact "new minimum found" text when the challenger is smaller than the current candidate', () => {
    const step: SortStep = { type: 'COMPARE', i: 0, j: 3, candidate: 0, algorithmName: 'selection-sort', intent: 'candidate-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 8, 3: 2 }));
    expect(text).toBe('New minimum found: arr[3]=2 is now the candidate');
  });

  it('does not claim a new candidate when the challenger is not smaller (falls back gracefully, no template 8 text)', () => {
    const step: SortStep = { type: 'COMPARE', i: 0, j: 3, candidate: 0, algorithmName: 'selection-sort', intent: 'candidate-check', significance: 'routine' };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 2, 3: 8 }));
    expect(text).not.toContain('New minimum found');
    expect(text).toBe('Processing arr[0] and arr[3]');
  });
});

describe('Template 9 — merge step (merge sort)', () => {
  it('produces the exact merge-range text from a merge-comparison COMPARE step', () => {
    const step: SortStep = { type: 'COMPARE', i: 0, j: 3, algorithmName: 'merge-sort', algorithmPhase: 'combine', intent: 'merge-comparison', significance: 'routine', left: 0, mid: 2, right: 5 };
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 1, 3: 4 }));
    expect(text).toBe('Merging sorted runs [0-2] and [3-5]');
  });

  it('produces the same merge-range text from a merge-write OVERWRITE step', () => {
    const step: SortStep = { type: 'OVERWRITE', i: 3, value: 4, algorithmName: 'merge-sort', algorithmPhase: 'combine', intent: 'merge-write', significance: 'routine', left: 0, mid: 2, right: 5 };
    const text = generator.generateNarrative(step, stateOf('arr', {}));
    expect(text).toBe('Merging sorted runs [0-2] and [3-5]');
  });
});

describe('Graceful fallback — instructions with no intent tag or missing data', () => {
  it('degrades to a generic two-index description for a COMPARE step with no intent tag at all', () => {
    const step = { type: 'COMPARE', i: 1, j: 2 } as SortStep;
    const text = generator.generateNarrative(step, stateOf('arr', { 1: 5, 2: 9 }));
    expect(text).toBe('Processing arr[1] and arr[2]');
    expect(text).not.toContain('undefined');
  });

  it('degrades gracefully for an unrecognized intent string', () => {
    const step = { type: 'COMPARE', i: 0, j: 1, intent: 'some-future-intent' } as unknown as SortStep;
    const text = generator.generateNarrative(step, stateOf('arr', { 0: 1, 1: 2 }));
    expect(text).toBe('Processing arr[0] and arr[1]');
    expect(text).not.toContain('undefined');
  });

  it('does not crash and produces no "undefined" when the referenced values are missing from state', () => {
    const step: SortStep = { type: 'COMPARE', i: 5, j: 6, algorithmName: 'bubble-sort', intent: 'adjacent-check', significance: 'routine' };
    expect(() => generator.generateNarrative(step, stateOf('arr', {}))).not.toThrow();
    const text = generator.generateNarrative(step, stateOf('arr', {}));
    expect(text).not.toContain('undefined');
    expect(text).toBe('Processing arr[5] and arr[6]');
  });

  it('degrades gracefully for a plain SWAP with no notable intent (an ordinary mid-array swap)', () => {
    const step: SortStep = { type: 'SWAP', i: 2, j: 3, algorithmName: 'bubble-sort', intent: 'adjacent-swap', significance: 'notable' };
    const text = generator.generateNarrative(step, stateOf('arr', { 2: 4, 3: 1 }));
    expect(text).toBe('Processing arr[2] and arr[3]');
    expect(text).not.toContain('undefined');
  });

  it('degrades gracefully for a relationship/region step (not a narrated operation in this spec)', () => {
    const step: SortStep = { type: 'SET_PARTITION_BOUNDARY', startIndex: 0, endIndex: 5, algorithmName: 'quick-sort', algorithmPhase: 'partition' };
    const text = generator.generateNarrative(step, stateOf('arr', {}));
    expect(text).toBe('Processing arr');
    expect(text).not.toContain('undefined');
  });

  it('never throws regardless of instruction shape', () => {
    const weirdStep = { type: 'PIVOT', i: 0 } as SortStep; // no algorithmName/intent, and no value at index 0
    expect(() => generator.generateNarrative(weirdStep, stateOf('arr', {}))).not.toThrow();
    expect(generator.generateNarrative(weirdStep, stateOf('arr', {}))).not.toContain('undefined');
  });
});

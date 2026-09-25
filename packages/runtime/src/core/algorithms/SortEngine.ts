/**
 * SortEngine — pure in-place sorting algorithms (Bubble, Selection, Insertion,
 * Merge, Quick).
 *
 * Free of scene/animation dependencies, like BSTEngine. Each method mutates
 * `array` in place and returns the ordered list of steps (comparisons, swaps,
 * pivot picks, merge overwrites) so the animation layer (SortAlgorithms) can
 * replay them one at a time.
 *
 * Merge sort and quick sort use real recursive calls (mergeSort/quickSort ->
 * a private recursive helper that calls itself on each half/partition) — the
 * same "true recursion, not unrolled" shape as AQVL's own FUNCTION/CALL/RET
 * recursion (fibonacci, factorial): the call stack does the work, nothing is
 * flattened into a fixed-size loop at compile time.
 */

export type Comparator<T> = (a: T, b: T) => number;

/**
 * Why a step is happening, not just what kind it is. Vocabulary is per
 * docs/design/array-aqir-semantic-gap.md §1.5/§2 — these are the tags the
 * narrative/pacing layer (Phase 4/5) will key off of.
 */
export type OperationIntent =
  | 'adjacent-check'
  | 'adjacent-swap'
  | 'candidate-check'
  | 'selection-swap'
  | 'shift-check'
  | 'shift'
  | 'insertion-placement'
  | 'pivot-selection'
  | 'partition-boundary'
  | 'partition-swap'
  | 'final-placement'
  | 'merge-comparison'
  | 'merge-write';

/** Rough pacing tier: how much a renderer should slow down / call attention to this step. */
export type OperationSignificance = 'routine' | 'notable' | 'pivotal';

export type AlgorithmName = 'bubble-sort' | 'selection-sort' | 'insertion-sort' | 'merge-sort' | 'quick-sort';

/** Only meaningful for multi-phase algorithms (merge sort's combine, quick sort's partition). */
export type AlgorithmPhase = 'divide' | 'combine' | 'partition';

/** Optional narrative metadata threaded onto every SortStep variant. Additive — omitting it changes nothing for existing consumers. */
interface StepMeta {
  intent?: OperationIntent;
  significance?: OperationSignificance;
  algorithmName?: AlgorithmName;
  algorithmPhase?: AlgorithmPhase;
  /**
   * Active subrange bounds, when this step belongs to one — quick sort's current
   * partition (`left`/`right`) or merge sort's current merge call (`left`/`mid`/`right`).
   * Needed by docs/design/array-narrative-ux-spec.md templates 7 and 9 (pivot
   * lock-in split, merge-range caption), which name the resulting sub-ranges.
   */
  left?: number;
  mid?: number;
  right?: number;
}

export type SortStep<T = number> =
  | ({ type: 'COMPARE'; i: number; j: number; /** Selection sort: index of the current running-best candidate at comparison time. */ candidate?: number } & StepMeta)
  | ({ type: 'SWAP'; i: number; j: number } & StepMeta)
  /** A value is written into slot `i` without swapping identities (merge sort's merge step). */
  | ({ type: 'OVERWRITE'; i: number; value: T } & StepMeta)
  /** Marks index `i` as the chosen pivot (quick sort's partition step). */
  | ({ type: 'PIVOT'; i: number } & StepMeta)
  /** Marks index `i` as permanently placed in its final sorted position. */
  | ({ type: 'FINALIZE'; i: number } & StepMeta)
  /**
   * Relationship/region steps — index-level counterparts of the AQIR
   * instructions of the same name (packages/shared/src/aqir/types.ts),
   * per docs/design/array-visual-language-spec.md §4. The runtime replay
   * layer (SortAlgorithms.ts) resolves `i`/`j`/bounds to scene element ids
   * and a structure id before dispatching the real AQIR instruction.
   */
  | ({ type: 'SHOW_COMPARISON_LINK'; i: number; j: number; style?: string } & StepMeta)
  | ({ type: 'HIDE_COMPARISON_LINK'; i: number; j: number } & StepMeta)
  | ({ type: 'SET_PARTITION_BOUNDARY'; startIndex: number; endIndex: number; label?: string } & StepMeta)
  | ({ type: 'CLEAR_PARTITION_BOUNDARY'; startIndex: number; endIndex: number } & StepMeta)
  /** The currently-confirmed-sorted contiguous range [startIndex, endIndex] (inclusive). */
  | ({ type: 'MARK_SORTED_REGION'; startIndex: number; endIndex: number } & StepMeta);

export interface SortResult<T> {
  /** Same array reference passed in, sorted in place. */
  array: T[];
  steps: SortStep<T>[];
  comparisons: number;
  swaps: number;
}

/** Mutable accumulator threaded through recursive calls so every nested call contributes to one flat step list. */
interface SortStats {
  comparisons: number;
  swaps: number;
}

export class SortAlgorithm {
  static readonly defaultComparator: Comparator<number> = (a, b) => a - b;

  // ───────────────────────────────────────────────────────────────────────
  // Bubble / Selection / Insertion (Phase 3.1)
  // ───────────────────────────────────────────────────────────────────────

  /** Bubble sort: repeated adjacent-pair comparisons, swapping out-of-order pairs. Stops early once a pass makes no swaps. */
  static bubbleSort<T = number>(array: T[], comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>): SortResult<T> {
    const steps: SortStep<T>[] = [];
    let comparisons = 0;
    let swaps = 0;
    const n = array.length;
    const algorithmName: AlgorithmName = 'bubble-sort';

    for (let i = 0; i < n - 1; i++) {
      let swappedInPass = false;
      for (let j = 0; j < n - i - 1; j++) {
        steps.push({ type: 'SHOW_COMPARISON_LINK', i: j, j: j + 1, style: 'beam', algorithmName });
        steps.push({ type: 'COMPARE', i: j, j: j + 1, algorithmName, intent: 'adjacent-check', significance: 'routine' });
        comparisons++;
        steps.push({ type: 'HIDE_COMPARISON_LINK', i: j, j: j + 1, algorithmName });
        if (comparator(array[j], array[j + 1]) > 0) {
          [array[j], array[j + 1]] = [array[j + 1], array[j]];
          steps.push({ type: 'SWAP', i: j, j: j + 1, algorithmName, intent: 'adjacent-swap', significance: 'notable' });
          swaps++;
          swappedInPass = true;
        }
      }
      // The inner loop just excluded index n-1-i from further comparison — it now holds
      // the maximum of the unsorted prefix and is permanently in its final position.
      steps.push({ type: 'FINALIZE', i: n - 1 - i, algorithmName, intent: 'final-placement', significance: 'pivotal' });
      // Bubble sort confirms from the END backward — the sorted region always spans
      // [n-1-i, n-1] and grows leftward (its start index shrinks) as passes complete.
      steps.push({ type: 'MARK_SORTED_REGION', startIndex: n - 1 - i, endIndex: n - 1, algorithmName });
      if (!swappedInPass) break;
    }

    return { array, steps, comparisons, swaps };
  }

  /** Selection sort: for each position, find the minimum of the remaining elements and swap it into place. */
  static selectionSort<T = number>(array: T[], comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>): SortResult<T> {
    const steps: SortStep<T>[] = [];
    let comparisons = 0;
    let swaps = 0;
    const n = array.length;
    const algorithmName: AlgorithmName = 'selection-sort';

    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        const candidateBefore = minIdx;
        steps.push({ type: 'SHOW_COMPARISON_LINK', i: candidateBefore, j, style: 'beam', algorithmName });
        steps.push({ type: 'COMPARE', i: candidateBefore, j, candidate: candidateBefore, algorithmName, intent: 'candidate-check', significance: 'routine' });
        comparisons++;
        steps.push({ type: 'HIDE_COMPARISON_LINK', i: candidateBefore, j, algorithmName });
        if (comparator(array[j], array[minIdx]) < 0) {
          minIdx = j;
        }
      }
      if (minIdx !== i) {
        [array[i], array[minIdx]] = [array[minIdx], array[i]];
        steps.push({ type: 'SWAP', i, j: minIdx, algorithmName, intent: 'selection-swap', significance: 'notable' });
        swaps++;
      }
      // Whether or not a swap was needed, index i now holds its final sorted value.
      steps.push({ type: 'FINALIZE', i, algorithmName, intent: 'final-placement', significance: 'pivotal' });
      // Selection sort confirms from the BEGINNING forward — the sorted prefix [0, i]
      // only ever grows (its end index increases) as outer iterations complete.
      steps.push({ type: 'MARK_SORTED_REGION', startIndex: 0, endIndex: i, algorithmName });
    }

    return { array, steps, comparisons, swaps };
  }

  /** Insertion sort (swap-based/gnome-sort style): each new element bubbles left via adjacent swaps until it's in order. */
  static insertionSort<T = number>(array: T[], comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>): SortResult<T> {
    const steps: SortStep<T>[] = [];
    let comparisons = 0;
    let swaps = 0;
    const n = array.length;
    const algorithmName: AlgorithmName = 'insertion-sort';

    for (let i = 1; i < n; i++) {
      let j = i;
      let lastShift: Extract<SortStep<T>, { type: 'SWAP' }> | null = null;
      while (j > 0) {
        steps.push({ type: 'SHOW_COMPARISON_LINK', i: j - 1, j, style: 'beam', algorithmName });
        steps.push({ type: 'COMPARE', i: j - 1, j, algorithmName, intent: 'shift-check', significance: 'routine' });
        comparisons++;
        steps.push({ type: 'HIDE_COMPARISON_LINK', i: j - 1, j, algorithmName });
        if (comparator(array[j - 1], array[j]) > 0) {
          [array[j - 1], array[j]] = [array[j], array[j - 1]];
          const swapStep: Extract<SortStep<T>, { type: 'SWAP' }> = { type: 'SWAP', i: j - 1, j, algorithmName, intent: 'shift', significance: 'routine' };
          steps.push(swapStep);
          lastShift = swapStep;
          swaps++;
          j--;
        } else {
          break;
        }
      }
      // The last shift in this walk is the one that actually settles the element into its
      // resting position — distinct from the routine shifts that only moved it partway.
      if (lastShift) {
        lastShift.intent = 'insertion-placement';
        lastShift.significance = 'notable';
      }
      // Insertion sort confirms from the BEGINNING forward too: after this outer
      // iteration, [0, i] is a fully sorted prefix (same growth direction as selection sort).
      steps.push({ type: 'FINALIZE', i, algorithmName, intent: 'final-placement', significance: 'pivotal' });
      steps.push({ type: 'MARK_SORTED_REGION', startIndex: 0, endIndex: i, algorithmName });
    }

    return { array, steps, comparisons, swaps };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Merge Sort (Phase 3.2) — true recursion: mergeSort calls itself on each half
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Merge sort over `array[left..right]` (defaults to the whole array).
   * O(n log n) always, regardless of input order.
   */
  static mergeSort<T = number>(
    array: T[],
    comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>,
    left: number = 0,
    right: number = array.length - 1
  ): SortResult<T> {
    const steps: SortStep<T>[] = [];
    const stats: SortStats = { comparisons: 0, swaps: 0 };
    this.mergeSortRecurse(array, comparator, left, right, steps, stats);
    return { array, steps, comparisons: stats.comparisons, swaps: stats.swaps };
  }

  /** Recursive divide step: `mergeSort` calls this, and this calls itself — real recursion, not an unrolled loop. */
  private static mergeSortRecurse<T>(
    array: T[],
    comparator: Comparator<T>,
    left: number,
    right: number,
    steps: SortStep<T>[],
    stats: SortStats
  ): void {
    if (left >= right) return;
    const mid = Math.floor((left + right) / 2);
    this.mergeSortRecurse(array, comparator, left, mid, steps, stats);
    this.mergeSortRecurse(array, comparator, mid + 1, right, steps, stats);
    this.merge(array, left, mid, right, comparator, steps, stats);
  }

  /**
   * Merges the two already-sorted runs `array[left..mid]` and `array[mid+1..right]`
   * back into `array[left..right]` via a temp buffer, emitting an OVERWRITE
   * step (not a swap — merge sort moves values, not element identities) per
   * position written.
   */
  static merge<T = number>(
    array: T[],
    left: number,
    mid: number,
    right: number,
    comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>,
    steps: SortStep<T>[] = [],
    stats: SortStats = { comparisons: 0, swaps: 0 }
  ): void {
    const algorithmName: AlgorithmName = 'merge-sort';
    const algorithmPhase: AlgorithmPhase = 'combine';
    // Named so the narrative layer (docs/design/array-narrative-ux-spec.md template 9)
    // can say exactly which two runs are being merged.
    const bounds = { left, mid, right };
    // The current merge range being processed — set for the duration of this call only;
    // sequential sibling/parent merge() calls never overlap, so SET/CLEAR pairs never interleave.
    steps.push({ type: 'SET_PARTITION_BOUNDARY', startIndex: left, endIndex: right, label: 'merge', algorithmName, algorithmPhase });
    const leftRun = array.slice(left, mid + 1);
    const rightRun = array.slice(mid + 1, right + 1);
    let i = 0;
    let j = 0;
    let k = left;

    while (i < leftRun.length && j < rightRun.length) {
      steps.push({ type: 'SHOW_COMPARISON_LINK', i: left + i, j: mid + 1 + j, style: 'beam', algorithmName, algorithmPhase });
      steps.push({ type: 'COMPARE', i: left + i, j: mid + 1 + j, algorithmName, algorithmPhase, intent: 'merge-comparison', significance: 'routine', ...bounds });
      stats.comparisons++;
      steps.push({ type: 'HIDE_COMPARISON_LINK', i: left + i, j: mid + 1 + j, algorithmName, algorithmPhase });
      if (comparator(leftRun[i], rightRun[j]) <= 0) {
        array[k] = leftRun[i];
        steps.push({ type: 'OVERWRITE', i: k, value: leftRun[i], algorithmName, algorithmPhase, intent: 'merge-write', significance: 'routine', ...bounds });
        i++;
      } else {
        array[k] = rightRun[j];
        steps.push({ type: 'OVERWRITE', i: k, value: rightRun[j], algorithmName, algorithmPhase, intent: 'merge-write', significance: 'routine', ...bounds });
        j++;
      }
      stats.swaps++;
      k++;
    }
    while (i < leftRun.length) {
      array[k] = leftRun[i];
      steps.push({ type: 'OVERWRITE', i: k, value: leftRun[i], algorithmName, algorithmPhase, intent: 'merge-write', significance: 'routine', ...bounds });
      stats.swaps++;
      i++;
      k++;
    }
    while (j < rightRun.length) {
      array[k] = rightRun[j];
      steps.push({ type: 'OVERWRITE', i: k, value: rightRun[j], algorithmName, algorithmPhase, intent: 'merge-write', significance: 'routine', ...bounds });
      stats.swaps++;
      j++;
      k++;
    }

    steps.push({ type: 'CLEAR_PARTITION_BOUNDARY', startIndex: left, endIndex: right, algorithmName, algorithmPhase });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Quick Sort (Phase 3.2) — true recursion: quickSort calls itself on each partition
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Quick sort over `array[left..right]` (defaults to the whole array).
   * O(n log n) average case, O(n^2) worst case (already-sorted input with a
   * last-element pivot) — same asymptotic trade-off as the textbook algorithm.
   */
  static quickSort<T = number>(
    array: T[],
    comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>,
    left: number = 0,
    right: number = array.length - 1
  ): SortResult<T> {
    const steps: SortStep<T>[] = [];
    const stats: SortStats = { comparisons: 0, swaps: 0 };
    this.quickSortRecurse(array, comparator, left, right, steps, stats);
    return { array, steps, comparisons: stats.comparisons, swaps: stats.swaps };
  }

  /** Recursive step: `quickSort` calls this, and this calls itself on each side of the pivot — real recursion. */
  private static quickSortRecurse<T>(
    array: T[],
    comparator: Comparator<T>,
    left: number,
    right: number,
    steps: SortStep<T>[],
    stats: SortStats
  ): void {
    if (left >= right) return;
    const algorithmName: AlgorithmName = 'quick-sort';
    const algorithmPhase: AlgorithmPhase = 'partition';
    // Scoped to this recursive call (not to partition() itself) so that the two
    // recursive sub-calls' SET/CLEAR pairs are fully nested inside this one,
    // reflecting the real call/return order: parent SET first, parent CLEAR last.
    steps.push({ type: 'SET_PARTITION_BOUNDARY', startIndex: left, endIndex: right, algorithmName, algorithmPhase });
    const pivotIndex = this.partition(array, left, right, comparator, steps, stats);
    this.quickSortRecurse(array, comparator, left, pivotIndex - 1, steps, stats);
    this.quickSortRecurse(array, comparator, pivotIndex + 1, right, steps, stats);
    steps.push({ type: 'CLEAR_PARTITION_BOUNDARY', startIndex: left, endIndex: right, algorithmName, algorithmPhase });
  }

  /**
   * Lomuto partition scheme: picks `array[right]` as the pivot, moves every
   * element <= pivot to its left, then places the pivot in its final sorted
   * position. Returns that final pivot index.
   */
  static partition<T = number>(
    array: T[],
    left: number,
    right: number,
    comparator: Comparator<T> = SortAlgorithm.defaultComparator as unknown as Comparator<T>,
    steps: SortStep<T>[] = [],
    stats: SortStats = { comparisons: 0, swaps: 0 }
  ): number {
    const algorithmName: AlgorithmName = 'quick-sort';
    const algorithmPhase: AlgorithmPhase = 'partition';
    const pivot = array[right];
    steps.push({ type: 'PIVOT', i: right, algorithmName, algorithmPhase, intent: 'pivot-selection', significance: 'notable', left, right });

    let i = left - 1;
    for (let j = left; j < right; j++) {
      steps.push({ type: 'SHOW_COMPARISON_LINK', i: j, j: right, style: 'beam', algorithmName, algorithmPhase });
      steps.push({ type: 'COMPARE', i: j, j: right, algorithmName, algorithmPhase, intent: 'partition-boundary', significance: 'routine' });
      stats.comparisons++;
      steps.push({ type: 'HIDE_COMPARISON_LINK', i: j, j: right, algorithmName, algorithmPhase });
      if (comparator(array[j], pivot) <= 0) {
        i++;
        if (i !== j) {
          [array[i], array[j]] = [array[j], array[i]];
          steps.push({ type: 'SWAP', i, j, algorithmName, algorithmPhase, intent: 'partition-swap', significance: 'routine' });
          stats.swaps++;
        }
      }
    }

    if (i + 1 !== right) {
      [array[i + 1], array[right]] = [array[right], array[i + 1]];
      steps.push({ type: 'SWAP', i: i + 1, j: right, algorithmName, algorithmPhase, intent: 'final-placement', significance: 'pivotal', left, right });
      stats.swaps++;
    }
    // The pivot's swap-into-place above (or its already-correct resting spot, if no
    // swap was needed) is provably permanent the instant partition() returns.
    // left/right are carried so the narrative layer (template 7) can name the two
    // resulting sub-partitions the pivot's lock-in splits this range into.
    steps.push({ type: 'FINALIZE', i: i + 1, algorithmName, algorithmPhase, intent: 'final-placement', significance: 'pivotal', left, right });

    return i + 1;
  }
}

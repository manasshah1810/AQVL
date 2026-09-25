/**
 * ArrayNarrativeGenerator — turns an enriched SortStep (intent/significance/
 * algorithmPhase/left/mid/right, from subphases 2.1 and 2.2) into the exact
 * caption text specified by docs/design/array-narrative-ux-spec.md §1's
 * templates, so the frontend renders ready-made strings instead of
 * re-deriving "why is this happening" from raw instruction data itself.
 *
 * Scope, per the spec's own backend-vs-frontend dependency table (§5): only
 * the templates whose content genuinely depends on backend-only data are
 * implemented here —
 *   - Templates 2/3 (compare outcome: "will be swapped" / "no swap needed")
 *   - Template 5   (finalize — bubble/selection/insertion)
 *   - Template 6   (pivot selection)
 *   - Template 7   (pivot lock-in + partition split)
 *   - Template 8   (selection sort: new running candidate)
 *   - Template 9   (merge step)
 * Templates 1, 4, 10, 11, 12 are frontend-only per §5 (their content is
 * already fully available from the existing RUNTIME_LOG stream) and are
 * deliberately NOT reproduced here — instructions that would map to one of
 * those (e.g. an ordinary, non-lock-in SWAP) fall through to the generic
 * fallback below instead.
 */
import type { SortStep } from '../core/algorithms/SortEngine';

/** The instruction shape this generator narrates — SortEngine's enriched step model. */
export type Instruction = SortStep;

/**
 * A snapshot of the structure's current values, keyed by logical index —
 * exactly what a template needs to substitute `{v}`/`{v1}`/`{v2}` and is
 * cheap to build sparsely (only the indices a given instruction touches).
 */
export interface StructureState {
  /** The `{arr}` placeholder — the array/structure's logical name. */
  structureName: string;
  /** Value at each logical index. Sparse is fine — only indices actually referenced need to be set. */
  values: (number | undefined)[];
}

const EM_DASH = '—';
const LEQ = '≤';

export class ArrayNarrativeGenerator {
  /**
   * Produces the caption text for one instruction. Never throws and never
   * embeds a literal "undefined" — an instruction with no (or an
   * unrecognized) intent tag, or one whose referenced values aren't present
   * in `currentState`, degrades to a generic, still-correct description.
   */
  generateNarrative(instruction: Instruction, currentState: StructureState): string {
    const arr = currentState.structureName;
    const valueAt = (idx: number | undefined): number | undefined => {
      if (typeof idx !== 'number') return undefined;
      const v = currentState.values[idx];
      return typeof v === 'number' ? v : undefined;
    };

    try {
      switch (instruction.type) {
        case 'COMPARE':
          return this.narrateCompare(instruction, arr, valueAt);
        case 'SWAP':
          return this.narrateSwap(instruction, arr, valueAt);
        case 'FINALIZE':
          return this.narrateFinalize(instruction, arr, valueAt);
        case 'PIVOT':
          return this.narratePivot(instruction, arr, valueAt);
        case 'OVERWRITE':
          return this.narrateOverwrite(instruction, arr);
        default:
          // SHOW/HIDE_COMPARISON_LINK, SET/CLEAR_PARTITION_BOUNDARY, MARK_SORTED_REGION:
          // visual/structural signals (2.2), not narrated operations in this spec.
          return this.genericFallback(arr, (instruction as { i?: number }).i, (instruction as { j?: number }).j);
      }
    } catch {
      return this.genericFallback(arr);
    }
  }

  // ───────────────────────────────────────────────────────────────────────

  private narrateCompare(
    step: Extract<Instruction, { type: 'COMPARE' }>,
    arr: string,
    valueAt: (idx: number | undefined) => number | undefined
  ): string {
    // Template 9 — merge sort's per-comparison step also identifies the merge range.
    if (step.intent === 'merge-comparison' && this.hasMergeBounds(step)) {
      return this.mergeStepText(arr, step.left!, step.mid!, step.right!);
    }

    // Template 8 — selection sort: only the comparison that actually finds a new
    // minimum gets a dedicated template; a routine "still not smaller" check falls
    // through to the generic fallback (no template 1/8 hybrid is defined by the spec).
    if (step.intent === 'candidate-check' && typeof step.candidate === 'number') {
      const candidateValue = valueAt(step.candidate);
      const challengerValue = valueAt(step.j);
      if (typeof candidateValue === 'number' && typeof challengerValue === 'number' && challengerValue < candidateValue) {
        return `New minimum found: ${arr}[${step.j}]=${challengerValue} is now the candidate`;
      }
      return this.genericFallback(arr, step.i, step.j);
    }

    // Templates 2/3 — the generic "compare, resolved" outcome. Covers bubble sort's
    // adjacent-check, insertion sort's shift-check, and quick sort's partition-boundary
    // check against the pivot — all are "compare two slots, decide swap-or-not" in shape.
    if (step.intent === 'adjacent-check' || step.intent === 'shift-check' || step.intent === 'partition-boundary') {
      const v1 = valueAt(step.i);
      const v2 = valueAt(step.j);
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        if (v1 > v2) {
          return `${v1} > ${v2} ${EM_DASH} ${arr}[${step.i}] and ${arr}[${step.j}] will be swapped`;
        }
        return `${v1} ${LEQ} ${v2} ${EM_DASH} already in order, no swap needed`;
      }
    }

    return this.genericFallback(arr, step.i, step.j);
  }

  private narrateSwap(
    step: Extract<Instruction, { type: 'SWAP' }>,
    arr: string,
    valueAt: (idx: number | undefined) => number | undefined
  ): string {
    // Template 7 — quick sort's pivot lock-in swap (an ordinary mid-array swap has no
    // backend-exclusive content: its caption, template 4, is frontend-only per §5).
    if (step.intent === 'final-placement' && this.hasPartitionBounds(step)) {
      const text = this.pivotLockInText(arr, step.i, step.left!, step.right!, valueAt(step.i));
      if (text) return text;
    }
    return this.genericFallback(arr, step.i, step.j);
  }

  private narrateFinalize(
    step: Extract<Instruction, { type: 'FINALIZE' }>,
    arr: string,
    valueAt: (idx: number | undefined) => number | undefined
  ): string {
    // Quick sort's pivot lock-in always emits FINALIZE (even when no physical swap was
    // needed because the pivot was already resting in place) — template 7 either way.
    if (step.algorithmName === 'quick-sort' && this.hasPartitionBounds(step)) {
      const text = this.pivotLockInText(arr, step.i, step.left!, step.right!, valueAt(step.i));
      if (text) return text;
    }
    // Template 5 — bubble/selection/insertion sort confirming a position.
    return `${arr}[${step.i}] has reached its final sorted position`;
  }

  private narratePivot(
    step: Extract<Instruction, { type: 'PIVOT' }>,
    arr: string,
    valueAt: (idx: number | undefined) => number | undefined
  ): string {
    // Template 6 — pivot selection.
    const v = valueAt(step.i);
    if (typeof v === 'number') {
      return `Selecting ${arr}[${step.i}]=${v} as the pivot for this partition`;
    }
    return this.genericFallback(arr, step.i);
  }

  private narrateOverwrite(step: Extract<Instruction, { type: 'OVERWRITE' }>, arr: string): string {
    // Template 9 — merge sort's write-phase steps narrate the same merge operation
    // as its comparison steps do.
    if (step.intent === 'merge-write' && this.hasMergeBounds(step)) {
      return this.mergeStepText(arr, step.left!, step.mid!, step.right!);
    }
    return this.genericFallback(arr, step.i);
  }

  // ───────────────────────────────────────────────────────────────────────

  private hasMergeBounds(step: { left?: number; mid?: number; right?: number }): boolean {
    return typeof step.left === 'number' && typeof step.mid === 'number' && typeof step.right === 'number';
  }

  private hasPartitionBounds(step: { left?: number; right?: number }): boolean {
    return typeof step.left === 'number' && typeof step.right === 'number';
  }

  private mergeStepText(arr: string, left: number, mid: number, right: number): string {
    return `Merging sorted runs [${left}-${mid}] and [${mid + 1}-${right}]`;
  }

  /** Shared by the SWAP and FINALIZE paths — quick sort's pivot lock-in is the same event either way. */
  private pivotLockInText(arr: string, pivotIndex: number, left: number, right: number, pivotValue: number | undefined): string | null {
    if (typeof pivotValue !== 'number') return null;
    return `Pivot ${pivotValue} locked into its final position at ${arr}[${pivotIndex}] ${EM_DASH} partition splits into [${left}-${pivotIndex - 1}] and [${pivotIndex + 1}-${right}]`;
  }

  /**
   * Degrades gracefully for anything not covered above: an instruction with no intent
   * tag, an unrecognized intent, or missing value/bounds data. Only interpolates
   * fields it can confirm are present, so the result never contains "undefined".
   */
  private genericFallback(arr: string, i?: number, j?: number): string {
    if (typeof i === 'number' && typeof j === 'number') {
      return `Processing ${arr}[${i}] and ${arr}[${j}]`;
    }
    if (typeof i === 'number') {
      return `Processing ${arr}[${i}]`;
    }
    return `Processing ${arr}`;
  }
}

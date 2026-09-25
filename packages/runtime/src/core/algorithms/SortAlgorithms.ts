/**
 * SortAlgorithms — Animation handler for array sorting operations.
 *
 * Registered with AlgorithmRegistry for:
 *   BUBBLE_SORT, SELECTION_SORT, INSERTION_SORT, MERGE_SORT, QUICK_SORT
 *
 * Delegates the actual comparisons/swaps/merges to the pure SortEngine
 * (SortAlgorithm) and replays its step list against the ARRAY_ELEMENT scene
 * objects belonging to the named array:
 *  - COMPARE / SWAP reuse the compare (yellow) / swap (orange, logicalIndex +
 *    layout) animation language from COMPARE_OBJECTS / SWAP_OBJECTS.
 *  - PIVOT (quick sort) highlights the chosen pivot element distinctly.
 *  - OVERWRITE (merge sort's merge step) writes a value into a slot without
 *    swapping identities — merging combines two sorted runs by copying
 *    values through a temp buffer, it doesn't exchange elements pairwise.
 *
 * Each step is resolved against the *current* logicalIndex of the scene's
 * ARRAY_ELEMENT objects (not a fixed id captured up front), since earlier
 * steps in the same sort mutate logicalIndex synchronously as the timeline
 * is built — the same approach SWAP_OBJECTS itself relies on.
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import {
  AQIRInstruction,
  GenericActionInstruction,
  getSemanticColorToken,
  ShowComparisonLinkInstruction,
  HideComparisonLinkInstruction,
  SetPartitionBoundaryInstruction,
  ClearPartitionBoundaryInstruction,
  MarkSortedRegionInstruction,
} from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { SortAlgorithm, SortStep } from './SortEngine';
import { ArrayNarrativeGenerator, StructureState } from '../../narrative/ArrayNarrativeGenerator';
import { DEFAULT_PACING_CONFIG } from '../../narrative/PacingConfig';

type SortKind = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick';

const SORT_LABELS: Record<SortKind, string> = {
  bubble: 'Bubble Sort',
  selection: 'Selection Sort',
  insertion: 'Insertion Sort',
  merge: 'Merge Sort',
  quick: 'Quick Sort',
};

export class SortAlgorithms implements AlgorithmHandler {
  private static readonly narrativeGenerator = new ArrayNarrativeGenerator();

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'BUBBLE_SORT') {
      this.runSort(context, instruction, 'bubble');
    } else if (action === 'SELECTION_SORT') {
      this.runSort(context, instruction, 'selection');
    } else if (action === 'INSERTION_SORT') {
      this.runSort(context, instruction, 'insertion');
    } else if (action === 'MERGE_SORT') {
      this.runSort(context, instruction, 'merge');
    } else if (action === 'QUICK_SORT') {
      this.runSort(context, instruction, 'quick');
    }
  }

  private runSort(context: AlgorithmContext, instruction: GenericActionInstruction, kind: SortKind): void {
    const arrayName = (instruction as any).payload?.logicalParent || (instruction.args?.[0] as string | undefined);
    const label = SORT_LABELS[kind];

    if (!arrayName) {
      this.log(context, 'ERROR', `${label} requires an array argument.`, 'warning');
      return;
    }

    const elements = context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === arrayName && el.originalType === 'ARRAY_ELEMENT')
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);

    if (elements.length === 0) {
      this.log(context, 'SORT', `Array "${arrayName}" is empty. Nothing to sort.`, 'warning');
      return;
    }

    this.log(context, 'SORT', `Starting ${label} on ${arrayName}...`, 'operation');

    const values = elements.map((el: any) => Number(el.value));
    const comparator = SortAlgorithm.defaultComparator;

    let result;
    switch (kind) {
      case 'bubble':
        result = SortAlgorithm.bubbleSort(values, comparator);
        break;
      case 'selection':
        result = SortAlgorithm.selectionSort(values, comparator);
        break;
      case 'insertion':
        result = SortAlgorithm.insertionSort(values, comparator);
        break;
      case 'merge':
        result = SortAlgorithm.mergeSort(values, comparator);
        break;
      case 'quick':
        result = SortAlgorithm.quickSort(values, comparator);
        break;
    }

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const modifyingToken = getSemanticColorToken('MODIFYING');
    const activeToken = getSemanticColorToken('ACTIVE');
    const neutralColor = context.defaultColor;

    const getAt = (idx: number): any =>
      context.sceneManager
        .getSceneGraph()
        .find((el: any) => el.logicalParent === arrayName && el.originalType === 'ARRAY_ELEMENT' && el.logicalIndex === idx);

    result.steps.forEach((step: SortStep) => {
      if (step.type === 'COMPARE') {
        const elA = getAt(step.i);
        const elB = getAt(step.j);
        if (!elA || !elB) return;

        // Populated at the *start* of the comparison beat, per the narrative spec's
        // timing rule (§1: caption updates in sync with the animation's start, not
        // once it resolves) — the values are already known here, before any tween runs.
        const narrativeText = SortAlgorithms.narrativeGenerator.generateNarrative(
          step,
          this.stateFor(arrayName, [elA, elB])
        );
        const suggestedDurationMultiplier = this.pacingFor(context, step);

        AnticipationAnimation.applyAnticipation(context.scheduler, [elA, elB], 'COMPARISON');
        context.scheduler.enqueue({ targets: [elA, elB], color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250, narrativeText, suggestedDurationMultiplier });
        context.scheduler.enqueue({ targets: [elA.scale, elB.scale], x: 1.15, y: 1.15, z: 1.15, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);

        this.log(context, 'SORT', `Compare ${elA.value} and ${elB.value}`, 'step');

        context.scheduler.enqueue({ targets: [elA, elB], color: neutralColor, emissiveIntensity: 0, duration: 200 });
        context.scheduler.enqueue({ targets: [elA.scale, elB.scale], x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      } else if (step.type === 'SWAP') {
        const elA = getAt(step.i);
        const elB = getAt(step.j);
        if (!elA || !elB) return;

        // Only quick sort's pivot lock-in swap (intent 'final-placement') has backend-derived
        // narration (template 7); an ordinary swap's caption is frontend-only per the spec's
        // dependency table, so the generator gracefully falls back for it — harmless either way.
        const narrativeText = SortAlgorithms.narrativeGenerator.generateNarrative(
          step,
          this.stateFor(arrayName, [elA, elB])
        );
        const suggestedDurationMultiplier = this.pacingFor(context, step);

        AnticipationAnimation.applyAnticipation(context.scheduler, [elA, elB], 'SWAP');
        context.scheduler.enqueue({ targets: [elA, elB], color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.9, duration: 300, narrativeText, suggestedDurationMultiplier });
        context.scheduler.enqueue({ targets: [elA.scale, elB.scale], x: 1.2, y: 1.2, z: 1.2, duration: 300 });
        context.scheduler.commitGroup(true);

        const leftIndex = elA.logicalIndex;
        const rightIndex = elB.logicalIndex;
        elA.logicalIndex = rightIndex;
        elB.logicalIndex = leftIndex;
        context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

        if (elA.worldTarget) {
          context.scheduler.enqueue({ targets: elA.position, x: elA.worldTarget.x, y: elA.worldTarget.y, z: elA.worldTarget.z, duration: 450, easing: 'easeInOutSine' });
        }
        if (elB.worldTarget) {
          context.scheduler.enqueue({ targets: elB.position, x: elB.worldTarget.x, y: elB.worldTarget.y, z: elB.worldTarget.z, duration: 450, easing: 'easeInOutSine' });
        }
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);

        context.scheduler.enqueue({ targets: [elA.scale, elB.scale], x: 1, y: 1, z: 1, duration: 250 });
        context.scheduler.enqueue({ targets: [elA, elB], color: neutralColor, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);

        context.scheduler.enqueue({
          targets: {}, duration: 1, complete: () => {
            elA.label = `${arrayName}[${elA.logicalIndex}]`;
            elB.label = `${arrayName}[${elB.logicalIndex}]`;
            context.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: 'SORT',
              message: `Swapped ${elA.value} and ${elB.value}`,
              kind: 'swap',
              timestamp: Date.now(),
            });
          }
        });
        context.scheduler.commitGroup(true);
      } else if (step.type === 'PIVOT') {
        const pivotEl = getAt(step.i);
        if (!pivotEl) return;

        const narrativeText = SortAlgorithms.narrativeGenerator.generateNarrative(step, this.stateFor(arrayName, [pivotEl]));
        const suggestedDurationMultiplier = this.pacingFor(context, step);

        AnticipationAnimation.applyAnticipation(context.scheduler, [pivotEl], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: pivotEl, color: activeToken.color, emissiveColor: activeToken.emissiveColor, emissiveIntensity: 0.9, duration: 300, narrativeText, suggestedDurationMultiplier });
        context.scheduler.enqueue({ targets: pivotEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 300 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);

        this.log(context, 'SORT', `Pivot = ${pivotEl.value}`, 'step');

        context.scheduler.enqueue({ targets: pivotEl.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      } else if (step.type === 'OVERWRITE') {
        const el = getAt(step.i);
        if (!el) return;

        const narrativeText = SortAlgorithms.narrativeGenerator.generateNarrative(step, this.stateFor(arrayName, [el]));
        const suggestedDurationMultiplier = this.pacingFor(context, step);

        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'INSERTION');
        context.scheduler.enqueue({ targets: el, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.9, duration: 250, narrativeText, suggestedDurationMultiplier });
        context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);

        context.scheduler.enqueue({
          targets: {}, duration: 1, complete: () => {
            el.value = step.value;
            el.label = `${arrayName}[${el.logicalIndex}]`;
            context.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: 'SORT',
              message: `Write ${step.value} into ${arrayName}[${step.i}]`,
              kind: 'step',
              timestamp: Date.now(),
            });
          }
        });
        context.scheduler.commitGroup(true);

        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);
      } else if (step.type === 'FINALIZE') {
        // No dedicated visual yet (Phase 4/5 work) — this is purely a narrative-carrying
        // marker frame, same zero-duration pattern as dispatchInstruction below.
        const el = getAt(step.i);
        if (!el) return;
        const narrativeText = SortAlgorithms.narrativeGenerator.generateNarrative(step, this.stateFor(arrayName, [el]));
        const suggestedDurationMultiplier = this.pacingFor(context, step);
        context.scheduler.enqueue({ targets: {}, duration: 1, narrativeText, suggestedDurationMultiplier });
        context.scheduler.commitGroup(true);
      } else if (step.type === 'SHOW_COMPARISON_LINK') {
        const elA = getAt(step.i);
        const elB = getAt(step.j);
        if (!elA || !elB) return;
        this.dispatchInstruction(context, {
          action: 'SHOW_COMPARISON_LINK',
          elementIdA: elA.id,
          elementIdB: elB.id,
          style: step.style || 'beam',
        } as ShowComparisonLinkInstruction);
      } else if (step.type === 'HIDE_COMPARISON_LINK') {
        const elA = getAt(step.i);
        const elB = getAt(step.j);
        if (!elA || !elB) return;
        this.dispatchInstruction(context, {
          action: 'HIDE_COMPARISON_LINK',
          elementIdA: elA.id,
          elementIdB: elB.id,
        } as HideComparisonLinkInstruction);
      } else if (step.type === 'SET_PARTITION_BOUNDARY') {
        this.dispatchInstruction(context, {
          action: 'SET_PARTITION_BOUNDARY',
          structureId: arrayName,
          startIndex: step.startIndex,
          endIndex: step.endIndex,
          label: step.label,
        } as SetPartitionBoundaryInstruction);
      } else if (step.type === 'CLEAR_PARTITION_BOUNDARY') {
        this.dispatchInstruction(context, {
          action: 'CLEAR_PARTITION_BOUNDARY',
          structureId: arrayName,
        } as ClearPartitionBoundaryInstruction);
      } else if (step.type === 'MARK_SORTED_REGION') {
        this.dispatchInstruction(context, {
          action: 'MARK_SORTED_REGION',
          structureId: arrayName,
          startIndex: step.startIndex,
          endIndex: step.endIndex,
        } as MarkSortedRegionInstruction);
      }
    });

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'SORT',
          message: `${label} complete. ${result.comparisons} comparisons, ${result.swaps} swaps.`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `${label} on ${arrayName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  /**
   * Resolves the suggested duration multiplier for a step's significance tag, using
   * whatever PacingConfig the caller supplied on the context (e.g. a future Phase 6
   * user speed-control panel) or the built-in defaults otherwise.
   */
  private pacingFor(context: AlgorithmContext, step: SortStep): number {
    const pacingConfig = context.pacingConfig ?? DEFAULT_PACING_CONFIG;
    return pacingConfig.getMultiplier(step.significance);
  }

  /** Builds a StructureState populated only at the logical indices of the given (live) scene elements — cheap, and always reflects the array's current values at the moment of the call. */
  private stateFor(arrayName: string, elements: Array<{ logicalIndex: number; value: unknown }>): StructureState {
    const values: (number | undefined)[] = [];
    for (const el of elements) {
      values[el.logicalIndex] = Number(el.value);
    }
    return { structureName: arrayName, values };
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }

  /**
   * Dispatches a relationship/region AQIR instruction (docs/design/array-visual-language-spec.md
   * §4) to any listening frontend, scheduled at the current point in the timeline rather than
   * fired immediately — matching how RUNTIME_LOG events are already deferred via a 1ms
   * scheduler task so they land in sync with the animation they describe.
   */
  private dispatchInstruction(context: AlgorithmContext, instruction: AQIRInstruction): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('AQIR_INSTRUCTION', instruction);
      }
    });
    context.scheduler.commitGroup(true);
  }
}

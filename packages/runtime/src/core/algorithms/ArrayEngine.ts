/**
 * ArrayEngine — animation handler for arrays: the array-targeted forms of
 * the bare INSERT / DELETE / UPDATE statements (`INSERT arr[i] v`,
 * `DELETE arr[i]`, `arr[i] = v`), plus the reads a running program makes
 * of an array (`arr[i]`, LENGTH(arr), PRINT arr).
 *
 * Every operation runs on the pure ArrayStructure
 * (../../data-structures/ArrayStructure.ts), rehydrated from the array's
 * ARRAY_ELEMENT scene objects, and its recorded steps are replayed onto the
 * scene: INSERT / DELETE (MUTATE create / destroy) shift the neighbouring
 * cells and grow / shrink the new or removed one; SET (MUTATE set) is the
 * shared PrimitiveAnimator.set.
 *
 * Not registered with AlgorithmRegistry: the bare INSERT / DELETE / UPDATE
 * names are shared with BSTs, legacy trees and plain elements, so
 * AnimationController asks `targetsSlot` and routes here only when the
 * instruction addresses an array slot.
 */
import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { ArrayStructure, ArrayStep } from '../../data-structures/ArrayStructure';
import { PrimitiveAnimator } from './PrimitiveAnimator';
import { formatPrintValue } from './formatValue';

/** Raised when an `arr[i]` reference / read falls outside the array's current bounds. */
export class ArrayIndexOutOfRangeError extends Error {
  constructor(public readonly arrayName: string, public readonly index: number, public readonly length: number) {
    super(`Index ${index} is out of bounds for array '${arrayName}' (valid indices are 0 to ${length - 1}).`);
    this.name = 'ArrayIndexOutOfRangeError';
  }
}

/**
 * Ids of elements created by INSERT. Date.now() alone is not unique: a program
 * that empties an array and refills it (merge sort's temp buffer) inserts at
 * the same index many times within one millisecond, and two elements with the
 * same id make DELETE remove the wrong one.
 */
let insertedElementCounter = 0;

const primitives = new PrimitiveAnimator();

export class ArrayEngine implements AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();
    if (action === 'INSERT') this.insert(context, instruction);
    else if (action === 'DELETE') this.delete(context, instruction);
    else if (action === 'UPDATE') this.update(context, instruction);
  }

  /**
   * Whether a bare INSERT / DELETE / UPDATE addresses an array slot (its
   * payload names the array and index; DELETE and UPDATE also need the
   * element there) — the instructions this engine owns.
   */
  targetsSlot(context: AlgorithmContext, instruction: GenericActionInstruction): boolean {
    const action = instruction.actionName.toUpperCase();
    const payload = (instruction as any).payload;
    if (payload?.logicalParent === undefined || payload?.logicalIndex === undefined) return false;
    if (action === 'INSERT') return true;
    return (action === 'DELETE' || action === 'UPDATE') && !!this.targetElement(context, instruction);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Live elements of array `name`, in index order (elements mid-deletion excluded). */
  elements(context: AlgorithmContext, name: string): any[] {
    return (context.sceneManager.getSceneGraph() as any[])
      .filter((e: any) => e.logicalParent === name && e.originalType === 'ARRAY_ELEMENT' && !e.animationLayer)
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
  }

  private getValues(context: AlgorithmContext, name: string): unknown[] {
    return this.elements(context, name).map((el: any) => el.value);
  }

  private elementAt(context: AlgorithmContext, name: string, index: number): any {
    return this.elements(context, name).find((el: any) => el.logicalIndex === index);
  }

  /** The element an instruction names directly: its targetId, else its first argument. */
  private targetElement(context: AlgorithmContext, gen: GenericActionInstruction): any {
    let targetEl = gen.targetId ? context.sceneManager.getElement(gen.targetId) as any : null;
    if (!targetEl && gen.args && gen.args.length > 0) {
      targetEl = context.sceneManager.getElement(String(gen.args[0])) as any;
    }
    return targetEl;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reads made by a running program
  // ─────────────────────────────────────────────────────────────────────────

  /** Current value of `name[index]`, for `arr[i]` read inside an expression. */
  valueAt(context: AlgorithmContext, name: string, index: number): unknown {
    const els = this.elements(context, name);
    const el = els.find((e: any) => e.logicalIndex === index);
    if (!el) throw new ArrayIndexOutOfRangeError(name, index, els.length);
    return el.value;
  }

  length(context: AlgorithmContext, name: string): number {
    return this.elements(context, name).length;
  }

  /** `PRINT arr`: `[v0, v1, ...]`. */
  format(context: AlgorithmContext, name: string): string {
    return `[${this.elements(context, name).map((el: any) => formatPrintValue(el.value)).join(', ')}]`;
  }

  /**
   * The id of the element at `name[index]`, for an `arr[i]` operand;
   * `fallback` when `name` is not an array (another indexed structure).
   */
  slotElementId(context: AlgorithmContext, name: string, index: number, fallback: string): string {
    const els = this.elements(context, name);
    if (els.length === 0) return fallback; // not an ARRAY (e.g. another indexed structure) — leave unresolved
    const el = els.find((e: any) => e.logicalIndex === index);
    if (!el) throw new ArrayIndexOutOfRangeError(name, index, els.length);
    return el.id;
  }

  /**
   * Binds the runtime-only operands of an array-targeted INSERT / DELETE /
   * UPDATE whose first argument is the slot `name[index]`: the element now
   * there, and the evaluated value. Returns a fresh instruction (the
   * compiled one is re-executed on every loop iteration, so it must not be
   * mutated), or `gen` itself when `name` is not an array.
   */
  bindSlotOperands(
    context: AlgorithmContext,
    gen: GenericActionInstruction,
    name: string,
    index: number,
    evaluate: ((expr: unknown) => unknown) | null
  ): GenericActionInstruction {
    const args = gen.args ?? [];
    const els = this.elements(context, name);
    if (els.length === 0 && index !== 0) return gen; // not an ARRAY

    const actionName = gen.actionName.toUpperCase();
    const el = els.find((e: any) => e.logicalIndex === index);
    const appending = actionName === 'INSERT' && index === els.length;
    if (!el && !appending) {
      throw new ArrayIndexOutOfRangeError(name, index, els.length);
    }

    const boundArgs = [...args];
    if (el) boundArgs[0] = el.id;
    if ((actionName === 'UPDATE' || actionName === 'INSERT') && boundArgs.length > 1 && evaluate) {
      boundArgs[boundArgs.length - 1] = evaluate(boundArgs[boundArgs.length - 1]) as any;
    }

    return {
      ...gen,
      args: boundArgs,
      targetId: el ? el.id : gen.targetId,
      payload: { ...((gen as any).payload ?? {}), logicalParent: name, logicalIndex: index },
    } as GenericActionInstruction;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSERT / DELETE / UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  /** `INSERT arr[i] value` — no-ops if the instruction doesn't target an array index. */
  private insert(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = (gen as any).payload?.logicalParent;
    const index = (gen as any).payload?.logicalIndex;
    if (name === undefined || index === undefined) return;

    const array = new ArrayStructure();
    array.elements = this.getValues(context, name);
    array.insert(index, gen.args?.[gen.args.length - 1]);
    this.replaySteps(context, name, array.steps);
  }

  /** `DELETE arr[i]` — no-ops unless the instruction names an existing array element. */
  private delete(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = (gen as any).payload?.logicalParent;
    const index = (gen as any).payload?.logicalIndex;
    if (name === undefined || index === undefined || !this.targetElement(context, gen)) return;

    const array = new ArrayStructure();
    array.elements = this.getValues(context, name);
    array.delete(index);
    this.replaySteps(context, name, array.steps);
  }

  /** `UPDATE arr[i] value` / `arr[i] = value`. */
  private update(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = (gen as any).payload?.logicalParent;
    const index = (gen as any).payload?.logicalIndex;
    if (name === undefined || index === undefined || !this.targetElement(context, gen)) return;

    const array = new ArrayStructure();
    array.elements = this.getValues(context, name);
    array.set(index, gen.args?.[gen.args.length - 1]);
    this.replaySteps(context, name, array.steps);
  }

  /** Turns the recorded steps of one array operation into scene mutations and animation. */
  private replaySteps(context: AlgorithmContext, name: string, steps: ArrayStep[]): void {
    for (const step of steps) {
      if (step.type === 'INSERT') this.animateInsert(context, name, step.index, step.value);
      else if (step.type === 'DELETE') this.animateDelete(context, name, step.index, this.elementAt(context, name, step.index));
      else if (step.type === 'SET') primitives.set(context, this.elementAt(context, name, step.index), step.value);
    }
  }

  /** MUTATE create at `insertIndex`: later cells shift right, the new one drops in. */
  private animateInsert(context: AlgorithmContext, logicalParent: string, insertIndex: number, valueToInsert: unknown): void {
    const allArrayEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
    AnticipationAnimation.applyAnticipation(context.scheduler, allArrayEls, 'INSERTION');

    const elsToShift = allArrayEls.filter((el: any) => el.logicalIndex >= insertIndex);

    // Synchronous update
    elsToShift.forEach((el: any) => el.logicalIndex += 1);

    const modifyingToken = getSemanticColorToken('MODIFYING');
    const newEl: any = {
      id: `obj_dyn_${Date.now()}_${insertIndex}_${++insertedElementCounter}`,
      type: 'box',
      value: valueToInsert,
      logicalIndex: insertIndex,
      index: insertIndex,
      logicalParent: logicalParent,
      originalType: 'ARRAY_ELEMENT',
      label: `${logicalParent}[${insertIndex}]`,
      position: { x: 0, y: -5, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: modifyingToken.color,
      emissiveIntensity: modifyingToken.emissiveIntensity,
      emissiveColor: modifyingToken.emissiveColor,
      state: 'MODIFYING',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1
    };
    context.sceneManager.addElement(newEl);
    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    if (newEl.worldTarget) {
      newEl.position.x = newEl.worldTarget.x;
      newEl.position.z = newEl.worldTarget.z;
    }

    // Animate ALL array elements to their new centered world target
    const updatedArrayEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.id !== newEl.id);
    updatedArrayEls.forEach((el: any) => {
      if (el.worldTarget) {
        context.scheduler.enqueue({
          targets: el.position,
          x: el.worldTarget.x,
          y: el.worldTarget.y,
          z: el.worldTarget.z,
          duration: 500,
          easing: 'easeOutCubic'
        });
      }
    });
    context.scheduler.commitGroup(true);

    if (newEl.worldTarget) {
      context.scheduler.enqueue({
        targets: newEl.position,
        y: newEl.worldTarget.y,
        duration: 600,
        easing: 'easeOutBounce'
      });
      context.scheduler.enqueue({
        targets: newEl.scale,
        x: 1, y: 1, z: 1,
        duration: 600,
        easing: 'easeOutBack'
      });
      context.scheduler.commitGroup(true);
    }

    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        updatedArrayEls.forEach((el: any) => {
          el.label = `${el.logicalParent}[${el.logicalIndex}]`;
        });
        newEl.label = `${newEl.logicalParent}[${newEl.logicalIndex}]`;
        context.stateManager!.saveState(context.sceneManager.getSceneGraph(), `Inserted ${valueToInsert} at index ${insertIndex}`, context.scheduler.getCurrentTime());
        context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager!.getCurrentState());
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'INSERT',
          message: elsToShift.length > 0
            ? `Inserted value ${valueToInsert} at index ${insertIndex} in "${logicalParent}".\nElements to the right shifted one position forward.`
            : `Appended value ${valueToInsert} at index ${insertIndex} of "${logicalParent}".`,
          kind: 'operation',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();
  }

  /** MUTATE destroy of `targetEl` at `deleteIndex`: it shrinks away, later cells shift left. */
  private animateDelete(context: AlgorithmContext, logicalParent: string, deleteIndex: number, targetEl: any): void {
    AnticipationAnimation.applyAnticipation(context.scheduler, [targetEl], 'DELETION');

    const allArrayEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
    const elsToShift = allArrayEls.filter((el: any) => el.logicalIndex > deleteIndex && el.id !== targetEl.id);

    // Set the target element to the animation layer so it's ignored by the layout engine
    targetEl.animationLayer = true;

    // Synchronous layout update
    elsToShift.forEach((el: any) => el.logicalIndex -= 1);
    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    // Animate removal
    context.scheduler.enqueue({
      targets: targetEl.scale,
      x: 0, y: 0, z: 0,
      duration: 500,
      easing: 'easeInBack'
    });
    context.scheduler.enqueue({
      targets: targetEl.position,
      y: '+=2',
      duration: 500,
      easing: 'easeInBack'
    });
    context.scheduler.commitGroup(true);

    // Animate ALL remaining elements to re-center
    const remainingEls = allArrayEls.filter((el: any) => el.id !== targetEl.id);
    remainingEls.forEach((el: any) => {
      if (el.worldTarget) {
        context.scheduler.enqueue({
          targets: el.position,
          x: el.worldTarget.x,
          y: el.worldTarget.y,
          z: el.worldTarget.z,
          duration: 500,
          easing: 'easeOutCubic'
        });
      }
    });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        context.sceneManager.removeElement(targetEl.id);
        remainingEls.forEach((el: any) => {
          el.label = `${el.logicalParent}[${el.logicalIndex}]`;
        });
        context.stateManager!.saveState(context.sceneManager.getSceneGraph(), `Deleted item at index ${deleteIndex}`, context.scheduler.getCurrentTime());
        context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager!.getCurrentState());
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'DELETE',
          message: `Deleted element at index ${deleteIndex} from "${logicalParent}".\nElements to the right shifted one position back.\nDeletion complete.`,
          kind: 'operation',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();
  }
}

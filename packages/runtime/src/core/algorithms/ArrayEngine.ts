/**
 * ArrayEngine — animation logic for the array-targeted branches of the bare
 * INSERT / DELETE GENERIC_ACTION instructions (`INSERT arr[i] value`,
 * `DELETE arr[i]`), extracted from AnimationController.executeInstruction so
 * it's unit-testable without the full AnimationController (see
 * tests/unit/arrayEngine.test.ts).
 *
 * Not registered with AlgorithmRegistry: bare INSERT/DELETE action names are
 * shared with BST routing (see AnimationController.isTargetBST) and tree-node
 * deletion, so AnimationController still owns the dispatch order and calls
 * these methods directly instead of going through the registry.
 */
import { AlgorithmContext } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';

/**
 * Ids of elements created by INSERT. Date.now() alone is not unique: a program
 * that empties an array and refills it (merge sort's temp buffer) inserts at
 * the same index many times within one millisecond, and two elements with the
 * same id make DELETE remove the wrong one.
 */
let insertedElementCounter = 0;

export class ArrayEngine {
  /** Handles `INSERT arr[i] value` — no-ops (matching the original inline behavior) if the instruction doesn't target an array index. */
  insert(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const logicalParent = (gen as any).payload?.logicalParent;
    const insertIndex = (gen as any).payload?.logicalIndex;
    const valueToInsert = gen.args?.[gen.args.length - 1];

    if (logicalParent === undefined || insertIndex === undefined) return;

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

  /**
   * Handles `DELETE arr[i]` — returns `false` (doing nothing) when the
   * instruction doesn't target an array index, so the caller can fall back
   * to its own TREE_NODE deletion branch exactly as the original inline
   * `if/else if` did.
   */
  delete(context: AlgorithmContext, gen: GenericActionInstruction): boolean {
    const logicalParent = (gen as any).payload?.logicalParent;
    const deleteIndex = (gen as any).payload?.logicalIndex;
    let targetEl = gen.targetId ? context.sceneManager.getElement(gen.targetId) as any : null;
    if (!targetEl && gen.args && gen.args.length > 0) {
      targetEl = context.sceneManager.getElement(String(gen.args[0])) as any;
    }

    if (logicalParent === undefined || deleteIndex === undefined || !targetEl) return false;

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

    return true;
  }
}

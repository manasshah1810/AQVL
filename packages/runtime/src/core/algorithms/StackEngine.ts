/**
 * StackEngine — animation logic for PUSH / POP / PEEK, extracted from
 * AnimationController.buildAnimations so it's unit-testable without the full
 * AnimationController (see tests/unit/stackEngine.test.ts).
 *
 * buildAnimations pre-builds a whole instruction list's animations against a
 * `virtualGraph` snapshot (a plain-object clone of the scene graph) rather
 * than mutating the live scene graph directly the way executeInstruction's
 * handlers do, and defers actual scene spawn/remove to LifecycleManager
 * inside animation `complete` callbacks — so these methods take the
 * `virtualGraph` array and a `LifecycleManager` as explicit extra
 * parameters alongside the shared `AlgorithmContext`.
 */
import { AlgorithmContext } from './AlgorithmContext';
import { GenericActionInstruction, StackUnderflowError } from '@aqvl/shared';
import { LifecycleManager } from '../LifecycleManager';

export interface StackAnimationContext extends AlgorithmContext {
  lifecycleManager: LifecycleManager;
}

export class StackEngine {
  push(context: StackAnimationContext, gen: GenericActionInstruction, virtualGraph: any[]): void {
    const stackName = gen.args[0];
    const val = gen.args[1];

    // Find current top index
    const stackEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
    const newIndex = stackEls.length;

    const newId = `obj_${stackName}_new_${Date.now()}`;
    const newEl: any = {
      id: newId,
      type: 'box',
      value: val,
      logicalIndex: newIndex,
      logicalParent: stackName,
      originalType: 'STACK_ELEMENT',
      position: { x: 0, y: 10, z: 0 }, // Will be laid out but starts high
      scale: { x: 1, y: 1, z: 1 },
      color: '#4caf50',
      emissiveIntensity: 0.5,
      emissiveColor: '#4caf50',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 0,
    };

    virtualGraph.push(newEl);

    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        context.lifecycleManager.spawn(newEl, true);
        context.lifecycleManager.activate(newId);
      }
    });
    context.scheduler.commitGroup(true);

    const layoutMap = context.layoutManager.updateLayout(virtualGraph);
    const targetPos = layoutMap.get(newId);

    if (targetPos) {
      context.scheduler.enqueue({
        targets: {},
        duration: 1,
        complete: () => {
          const targetEl = context.sceneManager.getElement(newId) as any;
          if (targetEl) {
            targetEl.position.x = targetPos.x;
            targetEl.position.y = targetPos.y + 5; // Drop from above
            targetEl.position.z = targetPos.z;

            context.scheduler.enqueue({
              targets: targetEl.position,
              y: targetPos.y,
              duration: 500,
              easing: 'easeOutBounce'
            });
            context.scheduler.enqueue({
              targets: targetEl,
              opacity: 1,
              duration: 300,
            });
            context.scheduler.commitGroup(true);
          }
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(600);
      // Log after drop animation
      context.scheduler.enqueue({
        targets: {},
        duration: 1,
        complete: () => {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'PUSH',
            message: `Pushed ${val} onto stack "${stackName}".\nStack size: ${newIndex + 1}`,
            kind: 'operation',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
    }
  }

  /** @throws StackUnderflowError when the target stack is empty. */
  pop(context: StackAnimationContext, gen: GenericActionInstruction, virtualGraph: any[]): void {
    const stackName = gen.args[0];

    const stackEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
    if (stackEls.length === 0) {
      throw new StackUnderflowError(`Cannot POP from empty stack "${stackName}".`);
    }
    if (stackEls.length > 0) {
      const topEl = stackEls.sort((a: any, b: any) => b.logicalIndex - a.logicalIndex)[0];
      const targetId = topEl.id;

      const targetEl = context.sceneManager.getElement(targetId) as any;
      if (targetEl) {
        context.scheduler.enqueue({
          targets: targetEl.position,
          y: targetEl.position.y + 3,
          duration: 400,
          easing: 'easeInQuad'
        });
        context.scheduler.enqueue({
          targets: targetEl,
          opacity: 0,
          color: '#f44336',
          emissiveColor: '#f44336',
          emissiveIntensity: 0.8,
          duration: 400
        });
        context.scheduler.commitGroup(true);
      }

      const vElIdx = virtualGraph.findIndex((el: any) => el.id === targetId);
      if (vElIdx >= 0) virtualGraph.splice(vElIdx, 1);

      context.scheduler.enqueue({
        targets: {},
        duration: 1,
        complete: () => {
          const poppedVal = (topEl as any).value;
          const remainingSize = stackEls.length - 1;
          context.lifecycleManager.remove(targetId);
          context.lifecycleManager.destroy(targetId);
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'POP',
            message: `Popped "${poppedVal}" from stack "${stackName}".\nStack size: ${remainingSize}`,
            kind: 'operation',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(450);
    }
  }

  peek(context: StackAnimationContext, gen: GenericActionInstruction): void {
    const stackName = gen.args[0];
    const stackEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
    if (stackEls.length > 0) {
      const topEl = stackEls.sort((a: any, b: any) => b.logicalIndex - a.logicalIndex)[0];
      const targetEl = context.sceneManager.getElement(topEl.id) as any;
      if (targetEl) {
        context.scheduler.enqueue({
          targets: targetEl,
          emissiveColor: '#ff9800',
          emissiveIntensity: 0.8,
          duration: 200
        });
        context.scheduler.enqueue({
          targets: targetEl.scale,
          x: 1.1, y: 1.1, z: 1.1,
          duration: 200
        });
        context.scheduler.commitSequential();

        context.scheduler.enqueue({
          targets: targetEl,
          emissiveIntensity: 0,
          duration: 200
        });
        context.scheduler.enqueue({
          targets: targetEl.scale,
          x: 1, y: 1, z: 1,
          duration: 200
        });
        context.scheduler.commitSequential();
        context.scheduler.advanceCursor(100);
        context.scheduler.enqueue({
          targets: {},
          duration: 1,
          complete: () => {
            context.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: 'PEEK',
              message: `Top of stack "${stackName}": ${(topEl as any).value}`,
              kind: 'info',
              timestamp: Date.now(),
            });
          }
        });
        context.scheduler.commitGroup(true);
      }
    }
  }
}

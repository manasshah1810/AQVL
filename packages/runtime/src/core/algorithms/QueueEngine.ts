/**
 * QueueEngine — animation logic for ENQUEUE / DEQUEUE / FRONT / REAR, extracted
 * from AnimationController.buildAnimations so it's unit-testable without the
 * full AnimationController (see tests/unit/queueEngine.test.ts).
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

export interface QueueAnimationContext extends AlgorithmContext {
  lifecycleManager: LifecycleManager;
}

export class QueueEngine {
  enqueue(context: QueueAnimationContext, gen: GenericActionInstruction, virtualGraph: any[]): void {
    const queueName = gen.args[0];
    const val = gen.args[1];

    const queueEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT');
    const newIndex = queueEls.length;

    const newId = `obj_${queueName}_new_${Date.now()}`;
    const newEl: any = {
      id: newId,
      type: 'box',
      value: val,
      logicalIndex: newIndex,
      logicalParent: queueName,
      originalType: 'QUEUE_ELEMENT',
      position: { x: 10, y: 5, z: 0 }, // Start high and to the right
      scale: { x: 1, y: 1, z: 1 },
      color: '#5c6bc0',
      emissiveIntensity: 0.5,
      emissiveColor: '#5c6bc0',
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
            targetEl.position.y = targetPos.y + 5; // Drop into the pipeline
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

      // Shift existing elements slightly if the pipeline grew from the center
      layoutMap.forEach((pos, id) => {
        if (id !== newId) {
          const tel = context.sceneManager.getElement(id) as any;
          if (tel) {
            context.scheduler.enqueue({
              targets: tel.position,
              x: pos.x, y: pos.y, z: pos.z,
              duration: 400, easing: 'easeInOutQuad'
            });
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
            keyword: 'ENQUEUE',
            message: `Enqueued ${val} into queue "${queueName}".\nQueue size: ${newIndex + 1}`,
            kind: 'operation',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
    }
  }

  /** @throws StackUnderflowError when the target queue is empty. */
  dequeue(context: QueueAnimationContext, gen: GenericActionInstruction, virtualGraph: any[]): void {
    const queueName = gen.args[0];

    const queueEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);

    if (queueEls.length === 0) {
      throw new StackUnderflowError(`Cannot DEQUEUE from empty queue "${queueName}".`);
    }
    if (queueEls.length > 0) {
      const frontEl = queueEls[0];
      const targetId = frontEl.id;

      const targetEl = context.sceneManager.getElement(targetId) as any;
      if (targetEl) {
        context.scheduler.enqueue({
          targets: targetEl.position,
          x: targetEl.position.x - 3, // Slide out left
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

      // Shift remaining elements down in index
      virtualGraph.forEach((el: any) => {
        if (el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT' && el.logicalIndex > 0) {
          el.logicalIndex--;
        }
      });

      context.scheduler.enqueue({
        targets: {},
        duration: 1,
        complete: () => {
          const dequeuedVal = (frontEl as any).value;
          const remainingSize = queueEls.length - 1;
          context.lifecycleManager.remove(targetId);
          context.lifecycleManager.destroy(targetId);
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'DEQUEUE',
            message: `Dequeued "${dequeuedVal}" from front of queue "${queueName}".\nQueue size: ${remainingSize}`,
            kind: 'operation',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);

      // Update layout for remaining elements to slide them forward
      const layoutMap = context.layoutManager.updateLayout(virtualGraph);
      layoutMap.forEach((pos, id) => {
        const tel = context.sceneManager.getElement(id) as any;
        const vEl = virtualGraph.find((e: any) => e.id === id);
        if (vEl) {
          vEl.position.x = pos.x; vEl.position.y = pos.y; vEl.position.z = pos.z;
          if (tel) {
            context.scheduler.enqueue({
              targets: tel.position,
              x: pos.x, y: pos.y, z: pos.z,
              duration: 400, easing: 'easeInOutQuad'
            });
          }
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(450);
    }
  }

  /** Handles both FRONT and REAR — which end is read off `gen.actionName`. */
  peek(context: QueueAnimationContext, gen: GenericActionInstruction): void {
    const queueName = gen.args[0];
    const queueEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);

    if (queueEls.length > 0) {
      const targetNode = gen.actionName === 'FRONT' ? queueEls[0] : queueEls[queueEls.length - 1];
      const targetEl = context.sceneManager.getElement(targetNode.id) as any;

      if (targetEl) {
        const highlightColor = gen.actionName === 'FRONT' ? '#ef5350' : '#66bb6a';
        context.scheduler.enqueue({
          targets: targetEl,
          emissiveColor: highlightColor,
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
            const action = gen.actionName;
            context.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: action,
              message: `${action} of queue "${queueName}": ${(targetNode as any).value}`,
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

/**
 * QueueEngine — animation handler for ENQUEUE / DEQUEUE / FRONT / REAR on a
 * queue of QUEUE_ELEMENT scene objects.
 *
 * Registered with AlgorithmRegistry for ENQUEUE, DEQUEUE, FRONT, REAR. Every
 * operation runs on the pure Queue (../../data-structures/Queue.ts),
 * rehydrated from the queue's elements, and its recorded step is replayed
 * onto the scene: ENQUEUE (MUTATE create) drops a new box onto the rear,
 * DEQUEUE (MUTATE destroy) slides the front out and moves the rest forward,
 * FRONT / REAR (ANNOTATE focus) pulse that end.
 *
 * Compiled QUEUE declarations are TreeEngine containers, which
 * AnimationController routes to TreeEngine before consulting the registry;
 * this engine serves scenes whose queues are QUEUE_ELEMENT objects.
 */
import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, StackUnderflowError } from '@aqvl/shared';
import { Queue, QueueStep } from '../../data-structures/Queue';

export class QueueEngine implements AlgorithmHandler {
  static readonly NODE_COLOR = '#5c6bc0';

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();
    if (action === 'ENQUEUE') this.enqueue(context, instruction);
    else if (action === 'DEQUEUE') this.dequeue(context, instruction);
    else if (action === 'FRONT' || action === 'REAR') this.peek(context, instruction, action);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** The queue's elements, front first. */
  private getElements(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'QUEUE_ELEMENT')
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
  }

  private getValues(context: AlgorithmContext, name: string): unknown[] {
    return this.getElements(context, name).map((el: any) => el.value);
  }

  private elementAt(context: AlgorithmContext, name: string, index: number): any {
    return this.getElements(context, name)[index];
  }

  private rehydrate(context: AlgorithmContext, name: string): Queue {
    const queue = new Queue();
    queue.elements = this.getValues(context, name);
    return queue;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENQUEUE / DEQUEUE / FRONT / REAR
  // ─────────────────────────────────────────────────────────────────────────

  private enqueue(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = gen.args[0];
    const queue = this.rehydrate(context, name);
    queue.enqueue(gen.args[1]);
    this.replaySteps(context, name, queue);
  }

  /** @throws StackUnderflowError when the queue is empty. */
  private dequeue(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = gen.args[0];
    const queue = this.rehydrate(context, name);
    if (queue.isEmpty()) {
      throw new StackUnderflowError(`Cannot DEQUEUE from empty queue "${name}".`);
    }
    queue.dequeue();
    this.replaySteps(context, name, queue);
  }

  /** FRONT / REAR — does nothing on an empty queue. */
  private peek(context: AlgorithmContext, gen: GenericActionInstruction, end: 'FRONT' | 'REAR'): void {
    const name = gen.args[0];
    const queue = this.rehydrate(context, name);
    if (end === 'FRONT') queue.front();
    else queue.rear();
    this.replaySteps(context, name, queue);
  }

  /** Turns the recorded steps of one queue operation into scene mutations and animation. */
  private replaySteps(context: AlgorithmContext, name: string, queue: Queue): void {
    for (const step of queue.steps) {
      if (step.type === 'ENQUEUE') this.animateEnqueue(context, name, step, queue.size);
      else if (step.type === 'DEQUEUE') this.animateDequeue(context, name, step, queue.size);
      else this.animatePeek(context, name, step);
    }
  }

  /** MUTATE create at the rear: a new box drops into the line while the others settle. */
  private animateEnqueue(context: AlgorithmContext, name: string, step: QueueStep, size: number): void {
    const newId = `obj_${name}_new_${Date.now()}`;
    const newEl: any = {
      id: newId,
      type: 'box',
      value: step.value,
      logicalIndex: step.index,
      logicalParent: name,
      originalType: 'QUEUE_ELEMENT',
      position: { x: 10, y: 5, z: 0 }, // Start high and to the right
      scale: { x: 1, y: 1, z: 1 },
      color: QueueEngine.NODE_COLOR,
      emissiveIntensity: 0.5,
      emissiveColor: QueueEngine.NODE_COLOR,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 0,
    };
    this.spawn(context, newEl);

    const layoutMap = context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());
    const targetPos = layoutMap.get(newId);
    if (!targetPos) return;

    newEl.position.x = targetPos.x;
    newEl.position.y = targetPos.y + 5; // Drop into the pipeline
    newEl.position.z = targetPos.z;
    newEl.opacity = 0;

    context.scheduler.enqueue({ targets: newEl.position, y: targetPos.y, duration: 500, easing: 'easeOutBounce' });
    context.scheduler.enqueue({ targets: newEl, opacity: 1, duration: 300 });
    // Shift existing elements slightly if the pipeline grew from the center
    this.getElements(context, name).forEach((el: any) => {
      const pos = layoutMap.get(el.id);
      if (el.id !== newId && pos) {
        context.scheduler.enqueue({ targets: el.position, x: pos.x, y: pos.y, z: pos.z, duration: 400, easing: 'easeInOutQuad' });
      }
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(100);

    this.log(context, 'ENQUEUE', `Enqueued ${step.value} into queue "${name}".\nQueue size: ${size}`, 'operation');
  }

  /** MUTATE destroy at the front: it slides out, turns red and fades; the rest move forward. */
  private animateDequeue(context: AlgorithmContext, name: string, step: QueueStep, size: number): void {
    const remaining = this.getElements(context, name);
    const targetEl = remaining.shift();
    if (!targetEl) return;

    context.scheduler.enqueue({ targets: targetEl.position, x: targetEl.position.x - 3, duration: 400, easing: 'easeInQuad' }); // Slide out left
    context.scheduler.enqueue({
      targets: targetEl,
      opacity: 0,
      color: '#f44336',
      emissiveColor: '#f44336',
      emissiveIntensity: 0.8,
      duration: 400,
    });
    context.scheduler.commitGroup(true);

    // Everyone behind it moves one place forward.
    remaining.forEach((el: any) => { el.logicalIndex--; });
    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        this.despawn(context, targetEl.id);
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'DEQUEUE',
          message: `Dequeued "${step.value}" from front of queue "${name}".\nQueue size: ${size}`,
          kind: 'operation',
          timestamp: Date.now(),
        });
      },
    });
    context.scheduler.commitGroup(true);

    const layoutMap = context.layoutManager.updateLayout(context.sceneManager.getSceneGraph().filter((el: any) => el.id !== targetEl.id));
    remaining.forEach((el: any) => {
      const pos = layoutMap.get(el.id);
      if (pos) context.scheduler.enqueue({ targets: el.position, x: pos.x, y: pos.y, z: pos.z, duration: 400, easing: 'easeInOutQuad' });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(450);
  }

  /** ANNOTATE focus on one end: FRONT glows red, REAR green. */
  private animatePeek(context: AlgorithmContext, name: string, step: QueueStep): void {
    const targetEl = this.elementAt(context, name, step.index);
    if (!targetEl) return;

    const highlightColor = step.type === 'FRONT' ? '#ef5350' : '#66bb6a';
    context.scheduler.enqueue({ targets: targetEl, emissiveColor: highlightColor, emissiveIntensity: 0.8, duration: 200 });
    context.scheduler.enqueue({ targets: targetEl.scale, x: 1.1, y: 1.1, z: 1.1, duration: 200 });
    context.scheduler.commitSequential();

    context.scheduler.enqueue({ targets: targetEl, emissiveIntensity: 0, duration: 200 });
    context.scheduler.enqueue({ targets: targetEl.scale, x: 1, y: 1, z: 1, duration: 200 });
    context.scheduler.commitSequential();
    context.scheduler.advanceCursor(100);

    this.log(context, step.type, `${step.type} of queue "${name}": ${step.value}`, 'info');
  }

  private spawn(context: AlgorithmContext, el: any): void {
    if (context.lifecycleManager) {
      context.lifecycleManager.spawn(el, true);
      context.lifecycleManager.activate(el.id);
    } else {
      context.sceneManager.addElement(el);
    }
  }

  private despawn(context: AlgorithmContext, id: string): void {
    if (context.lifecycleManager) {
      context.lifecycleManager.remove(id);
      context.lifecycleManager.destroy(id);
    } else {
      context.sceneManager.removeElement(id);
    }
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string): void {
    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      },
    });
    context.scheduler.commitGroup(true);
  }
}

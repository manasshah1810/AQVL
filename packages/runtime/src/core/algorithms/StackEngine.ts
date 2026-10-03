/**
 * StackEngine — animation handler for PUSH / POP / PEEK on a stack of
 * STACK_ELEMENT scene objects.
 *
 * Registered with AlgorithmRegistry for PUSH, POP, PEEK. Every operation runs
 * on the pure Stack (../../data-structures/Stack.ts), rehydrated from the
 * stack's elements, and its recorded step is replayed onto the scene:
 * PUSH (MUTATE create) drops a new box onto the top, POP (MUTATE destroy)
 * lifts the top away, PEEK (ANNOTATE focus) pulses the top.
 *
 * Compiled STACK declarations are TreeEngine containers, which
 * AnimationController routes to TreeEngine before consulting the registry;
 * this engine serves scenes whose stacks are STACK_ELEMENT objects.
 */
import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, StackUnderflowError } from '@aqvl/shared';
import { Stack, StackStep } from '../../data-structures/Stack';

export class StackEngine implements AlgorithmHandler {
  /** The statements registered with AlgorithmRegistry. */
  static readonly ALGORITHMS = ['PUSH', 'POP', 'PEEK'];

  static readonly NODE_COLOR = '#4caf50';

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();
    if (action === 'PUSH') this.push(context, instruction);
    else if (action === 'POP') this.pop(context, instruction);
    else if (action === 'PEEK') this.peek(context, instruction);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** The stack's elements, bottom first. */
  private getElements(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'STACK_ELEMENT')
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
  }

  private getValues(context: AlgorithmContext, name: string): unknown[] {
    return this.getElements(context, name).map((el: any) => el.value);
  }

  private elementAt(context: AlgorithmContext, name: string, index: number): any {
    return this.getElements(context, name).find((el: any) => el.logicalIndex === index);
  }

  private rehydrate(context: AlgorithmContext, name: string): Stack {
    const stack = new Stack();
    stack.elements = this.getValues(context, name);
    return stack;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH / POP / PEEK
  // ─────────────────────────────────────────────────────────────────────────

  private push(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = gen.args[0];
    const stack = this.rehydrate(context, name);
    stack.push(gen.args[1]);
    this.replaySteps(context, name, stack);
  }

  /** @throws StackUnderflowError when the stack is empty. */
  private pop(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = gen.args[0];
    const stack = this.rehydrate(context, name);
    if (stack.isEmpty()) {
      throw new StackUnderflowError(`Cannot POP from empty stack "${name}".`);
    }
    stack.pop();
    this.replaySteps(context, name, stack);
  }

  /** Does nothing on an empty stack. */
  private peek(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const name = gen.args[0];
    const stack = this.rehydrate(context, name);
    stack.peek();
    this.replaySteps(context, name, stack);
  }

  /** Turns the recorded steps of one stack operation into scene mutations and animation. */
  private replaySteps(context: AlgorithmContext, name: string, stack: Stack): void {
    for (const step of stack.steps) {
      if (step.type === 'PUSH') this.animatePush(context, name, step, stack.size);
      else if (step.type === 'POP') this.animatePop(context, name, step, stack.size);
      else if (step.type === 'PEEK') this.animatePeek(context, name, step);
    }
  }

  /** MUTATE create on top: a new box drops onto the stack and fades in. */
  private animatePush(context: AlgorithmContext, name: string, step: StackStep, size: number): void {
    const newId = `obj_${name}_new_${Date.now()}`;
    const newEl: any = {
      id: newId,
      type: 'box',
      value: step.value,
      logicalIndex: step.index,
      logicalParent: name,
      originalType: 'STACK_ELEMENT',
      position: { x: 0, y: 10, z: 0 }, // Will be laid out but starts high
      scale: { x: 1, y: 1, z: 1 },
      color: StackEngine.NODE_COLOR,
      emissiveIntensity: 0.5,
      emissiveColor: StackEngine.NODE_COLOR,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 0,
    };
    this.spawn(context, newEl);

    const targetPos = context.layoutManager.updateLayout(context.sceneManager.getSceneGraph()).get(newId);
    if (!targetPos) return;

    newEl.position.x = targetPos.x;
    newEl.position.y = targetPos.y + 5; // Drop from above
    newEl.position.z = targetPos.z;
    newEl.opacity = 0;

    context.scheduler.enqueue({ targets: newEl.position, y: targetPos.y, duration: 500, easing: 'easeOutBounce' });
    context.scheduler.enqueue({ targets: newEl, opacity: 1, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(100);

    this.log(context, 'PUSH', `Pushed ${step.value} onto stack "${name}".\nStack size: ${size}`, 'operation');
  }

  /** MUTATE destroy of the top: it lifts off, turns red and fades, then leaves the scene. */
  private animatePop(context: AlgorithmContext, name: string, step: StackStep, size: number): void {
    const targetEl = this.elementAt(context, name, step.index);
    if (!targetEl) return;

    context.scheduler.enqueue({ targets: targetEl.position, y: targetEl.position.y + 3, duration: 400, easing: 'easeInQuad' });
    context.scheduler.enqueue({
      targets: targetEl,
      opacity: 0,
      color: '#f44336',
      emissiveColor: '#f44336',
      emissiveIntensity: 0.8,
      duration: 400,
    });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        this.despawn(context, targetEl.id);
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'POP',
          message: `Popped "${step.value}" from stack "${name}".\nStack size: ${size}`,
          kind: 'operation',
          timestamp: Date.now(),
        });
      },
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(450);
  }

  /** ANNOTATE focus on the top: it glows and pulses. */
  private animatePeek(context: AlgorithmContext, name: string, step: StackStep): void {
    const targetEl = this.elementAt(context, name, step.index);
    if (!targetEl) return;

    context.scheduler.enqueue({ targets: targetEl, emissiveColor: '#ff9800', emissiveIntensity: 0.8, duration: 200 });
    context.scheduler.enqueue({ targets: targetEl.scale, x: 1.1, y: 1.1, z: 1.1, duration: 200 });
    context.scheduler.commitSequential();

    context.scheduler.enqueue({ targets: targetEl, emissiveIntensity: 0, duration: 200 });
    context.scheduler.enqueue({ targets: targetEl.scale, x: 1, y: 1, z: 1, duration: 200 });
    context.scheduler.commitSequential();
    context.scheduler.advanceCursor(100);

    this.log(context, 'PEEK', `Top of stack "${name}": ${step.value}`, 'info');
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

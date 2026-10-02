/**
 * Stack — last in, first out.
 *
 * The pure layer behind StackEngine (../core/algorithms/StackEngine.ts),
 * which animates PUSH / POP / PEEK on a stack of STACK_ELEMENT scene
 * objects. `elements[0]` is the bottom, the last element the top. Every
 * operation resets `steps` and records what it did.
 */
import type { StepPrimitives } from './steps';

export type StackStep<T = unknown> =
  /** `value` was pushed; it now sits at `index` (the new top). */
  | { type: 'PUSH'; index: number; value: T }
  /** `value` was popped from `index` (the old top). */
  | { type: 'POP'; index: number; value: T }
  /** The top, at `index`, was read without removing it. */
  | { type: 'PEEK'; index: number; value: T };

/** The AQIR primitive each stack step realises (see ./steps.ts). */
export const STACK_STEP_PRIMITIVES: StepPrimitives<StackStep> = {
  PUSH: { kind: 'MUTATE', verb: 'create' },
  POP: { kind: 'MUTATE', verb: 'destroy' },
  PEEK: { kind: 'ANNOTATE', verb: 'focus' },
};

export class Stack<T = unknown> {
  elements: T[] = [];

  /** Steps recorded by the most recent push / pop / peek call. */
  steps: StackStep<T>[] = [];

  get size(): number {
    return this.elements.length;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  push(value: T): void {
    this.steps = [];
    this.elements.push(value);
    this.steps.push({ type: 'PUSH', index: this.elements.length - 1, value });
  }

  /** Removes and returns the top; undefined (and no step) when the stack is empty. */
  pop(): T | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;
    const value = this.elements.pop() as T;
    this.steps.push({ type: 'POP', index: this.elements.length, value });
    return value;
  }

  /** Returns the top without removing it; undefined (and no step) when the stack is empty. */
  peek(): T | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;
    const index = this.elements.length - 1;
    const value = this.elements[index];
    this.steps.push({ type: 'PEEK', index, value });
    return value;
  }

  toArray(): T[] {
    return [...this.elements];
  }
}

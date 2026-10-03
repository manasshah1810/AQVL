/**
 * Queue — first in, first out.
 *
 * The pure layer behind QueueEngine (../core/algorithms/QueueEngine.ts),
 * which animates ENQUEUE / DEQUEUE / FRONT / REAR on a queue of
 * QUEUE_ELEMENT scene objects. `elements[0]` is the front, the last element
 * the rear. Every operation resets `steps` and records what it did.
 */
import type { StepPrimitives } from './steps';

export type QueueStep<T = unknown> =
  /** `value` joined the rear, at `index`. */
  | { type: 'ENQUEUE'; index: number; value: T }
  /** `value` left the front (index 0); every remaining element moved one place forward. */
  | { type: 'DEQUEUE'; index: number; value: T }
  /** The front, at `index` 0, was read without removing it. */
  | { type: 'FRONT'; index: number; value: T }
  /** The rear, at `index`, was read without removing it. */
  | { type: 'REAR'; index: number; value: T };

/** The AQIR primitive each queue step realises (see ./steps.ts). */
export const QUEUE_STEP_PRIMITIVES: StepPrimitives<QueueStep> = {
  ENQUEUE: { kind: 'MUTATE', verb: 'create' },
  DEQUEUE: { kind: 'MUTATE', verb: 'destroy' },
  FRONT: { kind: 'ANNOTATE', verb: 'focus' },
  REAR: { kind: 'ANNOTATE', verb: 'focus' },
};

export class Queue<T = unknown> {
  elements: T[] = [];

  /** Steps recorded by the most recent enqueue / dequeue / front / rear call. */
  steps: QueueStep<T>[] = [];

  get size(): number {
    return this.elements.length;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  enqueue(value: T): void {
    this.steps = [];
    this.elements.push(value);
    this.steps.push({ type: 'ENQUEUE', index: this.elements.length - 1, value });
  }

  /** Removes and returns the front; undefined (and no step) when the queue is empty. */
  dequeue(): T | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;
    const value = this.elements.shift() as T;
    this.steps.push({ type: 'DEQUEUE', index: 0, value });
    return value;
  }

  /** Returns the front without removing it; undefined (and no step) when the queue is empty. */
  front(): T | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;
    const value = this.elements[0];
    this.steps.push({ type: 'FRONT', index: 0, value });
    return value;
  }

  /** Returns the rear without removing it; undefined (and no step) when the queue is empty. */
  rear(): T | undefined {
    this.steps = [];
    if (this.elements.length === 0) return undefined;
    const index = this.elements.length - 1;
    const value = this.elements[index];
    this.steps.push({ type: 'REAR', index, value });
    return value;
  }

  toArray(): T[] {
    return [...this.elements];
  }
}

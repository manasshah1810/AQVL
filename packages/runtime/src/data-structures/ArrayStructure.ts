/**
 * ArrayStructure — a plain dynamic array (named so because `Array` is the JS
 * global).
 *
 * The pure layer behind ArrayEngine (../core/algorithms/ArrayEngine.ts),
 * which handles the array-targeted INSERT / DELETE / UPDATE statements
 * (`INSERT arr[i] v`, `DELETE arr[i]`, `arr[i] = v`). Every mutating call
 * resets `steps` and records what it did, so the engine can replay it
 * against the scene without re-deriving it.
 */
import type { StepPrimitives } from './steps';

export type ArrayStep<T = unknown> =
  /** `value` was inserted at `index`; the `shifted` elements after it moved one slot right. */
  | { type: 'INSERT'; index: number; value: T; shifted: number }
  /** The element at `index` (holding `value`) was removed; the `shifted` elements after it moved one slot left. */
  | { type: 'DELETE'; index: number; value: T; shifted: number }
  /** Slot `index` now holds `value` instead of `previous`. */
  | { type: 'SET'; index: number; value: T; previous: T };

/** The AQIR primitive each array step realises (see ./steps.ts). */
export const ARRAY_STEP_PRIMITIVES: StepPrimitives<ArrayStep> = {
  INSERT: { kind: 'MUTATE', verb: 'create' },
  DELETE: { kind: 'MUTATE', verb: 'destroy' },
  SET: { kind: 'MUTATE', verb: 'set' },
};

export class ArrayStructure<T = unknown> {
  elements: T[] = [];

  /** Steps recorded by the most recent insert / delete / set call. */
  steps: ArrayStep<T>[] = [];

  get length(): number {
    return this.elements.length;
  }

  /** The value at `index`, or undefined when it is out of range. */
  get(index: number): T | undefined {
    return this.elements[index];
  }

  /** Inserts `value` at `index` (`index === length` appends), shifting later elements right. */
  insert(index: number, value: T): void {
    this.steps = [];
    const shifted = Math.max(0, this.elements.length - index);
    this.elements.splice(index, 0, value);
    this.steps.push({ type: 'INSERT', index, value, shifted });
  }

  /** Removes and returns the element at `index`, shifting later elements left; undefined (and no step) when out of range. */
  delete(index: number): T | undefined {
    this.steps = [];
    if (index < 0 || index >= this.elements.length) return undefined;
    const [value] = this.elements.splice(index, 1);
    this.steps.push({ type: 'DELETE', index, value, shifted: this.elements.length - index });
    return value;
  }

  /** Overwrites slot `index` with `value`, returning what it held. */
  set(index: number, value: T): T | undefined {
    this.steps = [];
    const previous = this.elements[index];
    this.elements[index] = value;
    this.steps.push({ type: 'SET', index, value, previous: previous as T });
    return previous;
  }

  toArray(): T[] {
    return [...this.elements];
  }
}

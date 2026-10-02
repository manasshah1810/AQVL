/**
 * Recorded steps — how every pure data structure reports what it did.
 *
 * A structure's mutating methods push one step per visualizable
 * micro-action into its `steps` array (see Heap.ts / docs/design/
 * algorithm-engine-pattern.md). A step's `type` names the micro-action in
 * the structure's own words (COMPARE, SWAP, PUSH, PROBE, ...); each
 * structure also declares, next to its step union, which AQIR primitive
 * (docs/design/aqir-primitives-spec.md §3) every step type is an instance of
 * — a COMPARE is an `ANNOTATE contrast`, a PUSH a `MUTATE create`, ... —
 * as a `StepPrimitives` table that the compiler checks against the closed
 * primitive vocabulary.
 *
 * That table is the contract between a structure and its engine: the engine
 * replays a step by the primitive it realises, never by inventing a new
 * kind of effect. Geometry (`TRANSFORM`) is deliberately absent — where
 * elements end up is the layout's job, not something a structure records.
 *
 * This module, like every file under data-structures/, has no runtime
 * (scene / scheduler) dependencies.
 */
import { PRIMITIVE_VERBS } from '../aqir/types';

/** The primitive kinds a recorded step may realise. */
export type StepKind = Exclude<keyof typeof PRIMITIVE_VERBS, 'TRANSFORM'>;

/** The closed verb list of `K`. */
export type StepVerb<K extends StepKind> = (typeof PRIMITIVE_VERBS)[K][number];

/** One AQIR primitive: a kind and one of its verbs. */
export type Primitive = { [K in StepKind]: { kind: K; verb: StepVerb<K> } }[StepKind];

/** For every step type of `S`, the AQIR primitive it is an instance of. */
export type StepPrimitives<S extends { type: string }> = { readonly [T in S['type']]: Primitive };

/** The AQIR primitive `step` realises, per its structure's table. */
export function primitiveOf<S extends { type: string }>(table: StepPrimitives<S>, step: S): Primitive {
  return table[step.type as S['type']];
}

/** Whether `p` names a real AQIR primitive (used by the tests that pin every table to the spec). */
export function isPrimitive(p: { kind: string; verb: string }): boolean {
  if (p.kind === 'TRANSFORM' || !(p.kind in PRIMITIVE_VERBS)) return false;
  return (PRIMITIVE_VERBS[p.kind as StepKind] as readonly string[]).includes(p.verb);
}

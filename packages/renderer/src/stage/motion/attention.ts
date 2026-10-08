import type { TraceEvent, TraceEventKind, TraceFrame } from '@aqvl/runtime';

/**
 * The attention budget. At most this many nodes are emphasised at once:
 * lifted, haloed, in focus, and (for a mutation) glowing. Everything else
 * may still show its state colour, but stays down and quiet.
 *
 * Deliberate exceptions (each is a motion, not an emphasis):
 *  - `layout`, `create` and `remove` steps move every node they touch, in a
 *    staggered cascade, but emphasise none beyond the first two;
 *  - persistent states (settled, ruled out) colour every node in them, since
 *    they describe the data, not this step;
 *  - a compare draws a bridge between its pair; the bridge belongs to the
 *    pair's emphasis and adds no third focus.
 */
export const ATTENTION_BUDGET = 2;

/**
 * The one event type that owns the highest-salience treatment (aqua, bloom,
 * ripple): the data changing. A value written, two values swapped, a
 * pointer re-aimed, an element created or removed. Nothing else glows.
 */
export const MUTATION_KINDS: ReadonlySet<TraceEventKind> = new Set(['swap', 'write', 'link', 'create', 'remove']);

/** Events whose actors are lifted and haloed. */
const EMPHASIS_KINDS: ReadonlySet<TraceEventKind> = new Set([
  'compare', 'swap', 'write', 'link', 'traverse', 'visit', 'settle', 'mark', 'call', 'return', 'create', 'discard', 'error',
]);

/**
 * The nodes a frame emphasises: its event's actors, in order, capped by the
 * budget. Actors that are no longer in the frame (a node just removed) are
 * skipped so the budget is spent on things that can be seen.
 */
export function allocateAttention(frame: TraceFrame | undefined, budget = ATTENTION_BUDGET): string[] {
  if (!frame || !EMPHASIS_KINDS.has(frame.event.kind)) return [];
  const present = new Set(frame.nodes.map((n) => n.id));
  const out: string[] = [];
  for (const id of orderedActors(frame.event, frame)) {
    if (out.length >= budget) break;
    if (present.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Actors in reading order: a compared or swapped pair left to right, so "a < b" reads naturally. */
function orderedActors(event: TraceEvent, frame: TraceFrame): string[] {
  if ((event.kind === 'compare' || event.kind === 'swap') && event.actors.length === 2) {
    const pos = new Map(frame.nodes.map((n) => [n.id, n]));
    const [a, b] = event.actors;
    const na = pos.get(a);
    const nb = pos.get(b);
    if (na && nb && event.kind === 'compare' && na.index !== undefined && nb.index !== undefined && na.index > nb.index) return [b, a];
  }
  return event.actors;
}

/** Whether a frame's step is a mutation (gets the reserved treatment). */
export function isMutation(frame: TraceFrame | undefined): boolean {
  return !!frame && MUTATION_KINDS.has(frame.event.kind);
}

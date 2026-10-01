import type { TraceEdge, TraceEvent, TraceEventKind, TraceLog, TraceNode } from './types';

const MOVE_EPSILON = 0.05;

function moved(a: TraceNode, b: TraceNode): boolean {
  return Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y) + Math.abs(a.pos.z - b.pos.z) > MOVE_EPSILON;
}

/** The node ids at the ends of `edgeIds` (both ends, or just the far one). */
function endpoints(edgeIds: string[], edges: TraceEdge[], which: 'both' | 'to'): string[] {
  const out: string[] = [];
  for (const id of edgeIds) {
    const e = edges.find((x) => x.id === id);
    if (!e) continue;
    if (which === 'both') out.push(e.from);
    out.push(e.to);
  }
  return out;
}

/** Runtime log keywords that name the step outright. */
const KEYWORD_KIND: Record<string, TraceEventKind> = {
  SWAP: 'swap',
  COMPARE: 'compare',
  CALL: 'call',
  RETURN: 'return',
  PRINT: 'print',
  PUSH: 'create',
  ENQUEUE: 'create',
  INSERT: 'create',
  POP: 'remove',
  DEQUEUE: 'remove',
  DELETE: 'remove',
  FREE: 'remove',
  LINK: 'link',
  UNLINK: 'link',
  POINTER: 'traverse',
  UPDATE: 'write',
  SET: 'write',
  ASSIGN: 'write',
};

/**
 * Says what a step did by diffing the scene before and after it. The
 * runtime clears transient states (EVALUATING, MODIFYING, TRAVERSING) at the
 * start of every instruction, so a node in one of those states after the
 * step is one this step touched.
 */
export function classifyStep(
  prevNodes: Map<string, TraceNode>,
  nodes: TraceNode[],
  prevEdges: Map<string, TraceEdge>,
  edges: TraceEdge[],
  logs: TraceLog[],
): TraceEvent {
  const created: string[] = [];
  const movedIds: string[] = [];
  const writes: TraceEvent['writes'] = [];
  const byState = new Map<string, string[]>();
  const stateChanged: string[] = [];

  for (const n of nodes) {
    const before = prevNodes.get(n.id);
    if (!before) {
      created.push(n.id);
      continue;
    }
    if (moved(before, n)) movedIds.push(n.id);
    if (before.text !== n.text) writes.push({ id: n.id, from: before.text, to: n.text });
    if (before.state !== n.state) stateChanged.push(n.id);
    if (n.state !== 'NEUTRAL' && (before.state !== n.state || ['EVALUATING', 'MODIFYING', 'TRAVERSING'].includes(n.state))) {
      const list = byState.get(n.state) ?? [];
      list.push(n.id);
      byState.set(n.state, list);
    }
  }
  const current = new Set(nodes.map((n) => n.id));
  const removed = [...prevNodes.keys()].filter((id) => !current.has(id));

  const newEdges = edges.filter((e) => !prevEdges.has(e.id)).map((e) => e.id);
  const activeEdges = edges
    .filter((e) => e.state !== 'NEUTRAL' && (prevEdges.get(e.id)?.state !== e.state || ['TRAVERSING', 'EVALUATING', 'MODIFYING'].includes(e.state)))
    .map((e) => e.id);
  const retargeted = edges
    .filter((e) => {
      const before = prevEdges.get(e.id);
      return before && (before.from !== e.from || before.to !== e.to);
    })
    .map((e) => e.id);
  const touchedEdges = [...new Set([...activeEdges, ...newEdges, ...retargeted])];

  const keyword = logs.length > 0 ? logs[0].keyword.toUpperCase() : undefined;
  const of = (state: string) => byState.get(state) ?? [];

  let kind: TraceEventKind = 'none';
  let actors: string[] = [];

  const swapPair = movedIds.length >= 2 && of('MODIFYING').length >= 2;
  if (keyword === 'SWAP' || swapPair) {
    kind = 'swap';
    actors = movedIds.length >= 2 ? movedIds : of('MODIFYING').length ? of('MODIFYING') : writes.map((w) => w.id);
  } else if (keyword === 'COMPARE' || of('EVALUATING').length >= 2) {
    kind = 'compare';
    actors = of('EVALUATING');
  } else if (writes.length > 0 && created.length === 0 && removed.length === 0) {
    kind = 'write';
    actors = writes.map((w) => w.id);
  } else if (created.length > 0) {
    kind = 'create';
    actors = created;
  } else if (removed.length > 0) {
    kind = 'remove';
    actors = [...of('MODIFYING'), ...of('TRAVERSING')];
  } else if (keyword === 'CALL' || keyword === 'RETURN') {
    kind = keyword === 'CALL' ? 'call' : 'return';
    actors = [...of('TRAVERSING'), ...of('EVALUATING'), ...of('MODIFYING')];
  } else if (newEdges.length > 0 || retargeted.length > 0) {
    kind = 'link';
    actors = endpoints(touchedEdges, edges, 'both');
  } else if (movedIds.length > 0) {
    kind = 'move';
    actors = movedIds;
  } else if (of('SUCCESS').length > 0) {
    kind = 'settle';
    actors = of('SUCCESS');
  } else if (of('TRAVERSING').length > 0 || activeEdges.length > 0) {
    kind = activeEdges.length > 0 ? 'traverse' : 'visit';
    actors = of('TRAVERSING').length ? of('TRAVERSING') : endpoints(activeEdges, edges, 'to');
  } else if (of('EVALUATING').length > 0) {
    kind = 'visit';
    actors = of('EVALUATING');
  } else if (of('MODIFYING').length > 0) {
    kind = 'write';
    actors = of('MODIFYING');
  } else if (of('DISCARDED').length > 0) {
    kind = 'discard';
    actors = of('DISCARDED');
  } else if (of('AUXILIARY').length > 0 || of('STRUCTURAL').length > 0) {
    kind = 'mark';
    actors = [...of('AUXILIARY'), ...of('STRUCTURAL')];
  } else if (stateChanged.length > 0) {
    kind = 'mark';
    actors = stateChanged;
  } else if (keyword && KEYWORD_KIND[keyword]) {
    kind = KEYWORD_KIND[keyword];
  } else if (keyword) {
    kind = 'assign';
  }

  // Comparing two numbers: which way it went.
  let relation: TraceEvent['relation'];
  if (kind === 'compare' && actors.length >= 2) {
    const a = nodes.find((n) => n.id === actors[0]);
    const b = nodes.find((n) => n.id === actors[1]);
    if (a?.numeric !== undefined && b?.numeric !== undefined) {
      relation = a.numeric < b.numeric ? '<' : a.numeric > b.numeric ? '>' : '=';
    }
  }

  return {
    kind,
    actors: [...new Set(actors)],
    edges: touchedEdges,
    writes,
    relation,
    keyword,
  };
}

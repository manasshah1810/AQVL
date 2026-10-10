import type { TraceFinal, TraceNode } from '@aqvl/runtime';
import type { Expectation } from './types';

/**
 * Reading what a finished program left behind, structure by structure, from
 * the run's final state, and comparing it with what the reference says it
 * must be. Values are compared as the stage shows them (`5`, `A`, `TRUE`).
 */

/** A value as the runtime prints it: integers plainly, other numbers to 3 places, booleans as TRUE / FALSE. */
export function canon(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

export type Actual =
  | { kind: 'values'; value: string[] }
  | { kind: 'tree'; value: (string | null)[] }
  | { kind: 'map'; value: Record<string, string> }
  | { kind: 'dlist'; forward: string[]; backward: string[] }
  | { kind: 'scalar'; value: string | null };

function byStructure(final: TraceFinal, name: string, families: string[]): TraceNode[] {
  return final.nodes.filter((n) => n.structure === name && families.includes(n.family));
}

/** Follow one kind of pointer from `start`; a cycle stops when it comes back to a node already seen. */
function follow(final: TraceFinal, start: string | undefined, pointer: string, name: string): string[] {
  if (!start) return [];
  const next = new Map<string, string>();
  for (const e of final.edges) if (e.pointer === pointer && (e.structure === name || e.structure === undefined)) next.set(e.from, e.to);
  const text = new Map(final.nodes.map((n) => [n.id, n.text]));
  const out: string[] = [];
  const seen = new Set<string>();
  let at: string | undefined = start;
  while (at && !seen.has(at) && text.has(at)) {
    seen.add(at);
    out.push(text.get(at)!);
    at = next.get(at);
  }
  return out;
}

function headOf(final: TraceFinal, name: string): string | undefined {
  return final.structures.find((s) => s.name === name)?.head;
}

export function readActual(final: TraceFinal, exp: Expectation): Actual {
  switch (exp.kind) {
    case 'array': {
      const cells = byStructure(final, exp.name, ['ARRAY_ELEMENT', 'HEAP_ARRAY_ELEMENT']).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return { kind: 'values', value: cells.map((n) => n.text) };
    }
    case 'stack':
    case 'queue': {
      const items = byStructure(final, exp.name, ['CONTAINER_ITEM']).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { kind: 'values', value: items.map((n) => n.text) };
    }
    case 'list':
      return { kind: 'values', value: follow(final, headOf(final, exp.name), 'next', exp.name) };
    case 'dlist': {
      const forward = follow(final, headOf(final, exp.name), 'next', exp.name);
      // The tail: the last node reached going forwards.
      const ids = (() => {
        const next = new Map<string, string>();
        for (const e of final.edges) if (e.pointer === 'next') next.set(e.from, e.to);
        const out: string[] = [];
        const seen = new Set<string>();
        let at = headOf(final, exp.name);
        while (at && !seen.has(at)) {
          seen.add(at);
          out.push(at);
          at = next.get(at);
        }
        return out;
      })();
      const backward = follow(final, ids[ids.length - 1], 'prev', exp.name);
      return { kind: 'dlist', forward, backward };
    }
    case 'tree': {
      const root = headOf(final, exp.name);
      const left = new Map<string, string>();
      const right = new Map<string, string>();
      for (const e of final.edges) {
        if (e.pointer === 'left') left.set(e.from, e.to);
        if (e.pointer === 'right') right.set(e.from, e.to);
      }
      const text = new Map(final.nodes.map((n) => [n.id, n.text]));
      const out: (string | null)[] = [];
      const queue: (string | null)[] = root ? [root] : [];
      const seen = new Set<string>();
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (id === null || seen.has(id)) {
          out.push(null);
          continue;
        }
        seen.add(id);
        out.push(text.get(id) ?? '?');
        queue.push(left.get(id) ?? null, right.get(id) ?? null);
      }
      while (out.length > 0 && out[out.length - 1] === null) out.pop();
      return { kind: 'tree', value: out };
    }
    case 'map': {
      const value: Record<string, string> = {};
      for (const n of byStructure(final, exp.name, ['HASHMAP_ENTRY'])) {
        const at = n.caption.indexOf(': ');
        if (at >= 0) value[n.caption.slice(0, at)] = n.text;
      }
      return { kind: 'map', value };
    }
    case 'trie':
      return { kind: 'values', value: byStructure(final, exp.name, ['TRIE_NODE']).map((n) => n.caption).sort() };
    case 'var':
      return { kind: 'scalar', value: exp.name in final.vars ? canon(final.vars[exp.name]) : null };
  }
}

/** The expectation's value in the same form as an Actual. */
export function expectedActual(exp: Expectation): Actual {
  switch (exp.kind) {
    case 'array':
    case 'stack':
    case 'queue':
    case 'list':
      return { kind: 'values', value: exp.value.map(canon) };
    case 'dlist': {
      const forward = exp.value.map(canon);
      return { kind: 'dlist', forward, backward: [...forward].reverse() };
    }
    case 'tree': {
      const value = exp.value.map((v) => (v === null ? null : canon(v)));
      while (value.length > 0 && value[value.length - 1] === null) value.pop();
      return { kind: 'tree', value };
    }
    case 'map': {
      const value: Record<string, string> = {};
      for (const [k, v] of Object.entries(exp.value)) value[k] = canon(v);
      return { kind: 'map', value };
    }
    case 'trie':
      return { kind: 'values', value: [...exp.value].sort() };
    case 'var':
      return { kind: 'scalar', value: canon(exp.value) };
  }
}

function key(a: Actual): string {
  if (a.kind === 'map') return JSON.stringify(Object.entries(a.value).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
  return JSON.stringify(a);
}

export function sameActual(a: Actual, b: Actual): boolean {
  return key(a) === key(b);
}

/** How an expectation or a result reads in the test list: `[1, 2, 5]`, `1 → 2 → NULL`, `found = TRUE`. */
export function describeActual(exp: Expectation, a: Actual): string {
  switch (a.kind) {
    case 'values':
      if (exp.kind === 'list') return a.value.length === 0 ? 'NULL' : `${a.value.join(' → ')} → NULL`;
      if (exp.kind === 'trie') return a.value.length <= 1 ? '(only the root)' : a.value.filter(Boolean).join(', ');
      return `[${a.value.join(', ')}]`;
    case 'dlist': {
      const fwd = a.forward.length === 0 ? 'NULL' : `${a.forward.join(' ⇄ ')}`;
      const intact = JSON.stringify(a.backward) === JSON.stringify([...a.forward].reverse());
      return intact ? fwd : `${fwd} (going back by prev: ${a.backward.length === 0 ? 'NULL' : a.backward.join(' ← ')})`;
    }
    case 'tree':
      return a.value.length === 0 ? 'empty (root = NULL)' : `[${a.value.map((v) => v ?? 'NULL').join(', ')}] by levels`;
    case 'map': {
      const entries = Object.entries(a.value).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
      return entries.length === 0 ? '{}' : `{${entries.map(([k, v]) => `${k}: ${v}`).join(', ')}}`;
    }
    case 'scalar':
      return a.value === null ? 'never set' : a.value;
  }
}

/** Which structure / variable an expectation is about, for labels: `arr`, `foundAt`. */
export function subjectOf(exp: Expectation): string {
  return exp.name;
}

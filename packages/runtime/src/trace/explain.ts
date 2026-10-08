import type { ExecutionTrace, TraceEvent, TraceFrame, TraceNode } from './types';

/**
 * Explanations: what a recorded step means, in words, written from the
 * step's own data (its event, the nodes it touched, the variables, the call
 * stack, the runtime's log). Nothing here knows about any particular
 * program: change the code or the values and the sentences change with them.
 * The same sentence is shown as the caption's long form and handed to the
 * voice, so the picture, the code highlight and the speech share one step.
 */

/** How much a step matters to someone listening: `key` is spoken in Key Steps mode, `detail` only in Full mode. */
export type ExplanationImportance = 'key' | 'detail';

export interface ExplanationContext {
  /** Values of the nodes the step is about, most important first. */
  values: string[];
  /** Their positions in their structure, when indexed. */
  indices: number[];
  /** The structure they belong to (`arr`, `list`, ...). */
  structure?: string;
  /** For a compare: the relation that held between the first two values. */
  relation?: '<' | '>' | '=';
  /** Variables that changed in this step: name → [before, after]. */
  changedVars: Record<string, [number | string | boolean | undefined, number | string | boolean]>;
}

export interface Explanation {
  /** The sentence(s) to read or speak. */
  text: string;
  importance: ExplanationImportance;
  /** What the step did (the event kind, upper-case), or ERROR / COMPLETE. */
  operation: string;
  /** Source line (1-based) the step came from, if known. */
  line: number | null;
  context: ExplanationContext;
}

export interface ExplainOptions {
  /** The program's source, so an error can quote the offending line. */
  source?: string;
}

type Scalar = number | string | boolean;

const KEY_KINDS = new Set<TraceEvent['kind']>(['swap', 'write', 'create', 'remove', 'link', 'call', 'return', 'settle', 'discard']);

function nodeById(frame: TraceFrame, id: string): TraceNode | undefined {
  return frame.nodes.find((n) => n.id === id);
}

/** "64" for a bare value; `node 10` style captions come through as the text already. */
function val(n: TraceNode | undefined): string {
  if (!n) return 'a value';
  return n.text === '' ? 'an empty node' : n.text;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function changedVars(frame: TraceFrame, prev: TraceFrame | undefined): ExplanationContext['changedVars'] {
  const out: ExplanationContext['changedVars'] = {};
  for (const [k, v] of Object.entries(frame.vars)) {
    const before = prev?.vars[k];
    if (before !== v) out[k] = [before, v];
  }
  return out;
}

/** The first line of the runtime's own account of the step, minus the arrow-shorthand it prints ("a = b   ⟹   a → node 10"). */
function runtimeSentence(frame: TraceFrame): string {
  const log = frame.logs.find((l) => l.kind !== 'result') ?? frame.logs[0];
  return (log?.message ?? frame.caption ?? '').split('\n')[0].replace(/\s{2,}⟹\s{2,}/, ': ').trim();
}

function describeVarChange(changed: ExplanationContext['changedVars'], max = 2): string {
  const parts = Object.entries(changed)
    .filter(([, [, after]]) => typeof after !== 'string' || after.length <= 24)
    .slice(0, max)
    .map(([name, [before, after]]) => (before === undefined ? `${name} is now ${after}` : `${name} goes from ${before} to ${after}`));
  return parts.length ? `${joinList(parts)}.` : '';
}

/** Where in its structure a node sat: "position 3 of arr". */
function spot(n: TraceNode | undefined, prevN?: TraceNode): string {
  const index = prevN?.index ?? n?.index;
  const where = n?.structure ?? prevN?.structure;
  if (index === undefined) return where ? `in ${where}` : '';
  return where ? `position ${index} of ${where}` : `position ${index}`;
}

function relationWords(rel: '<' | '>' | '=', a: string, b: string): string {
  if (rel === '>') return `${a} is greater than ${b}`;
  if (rel === '<') return `${a} is less than ${b}`;
  return `${a} is equal to ${b}`;
}

/** Does the next recorded step undo or act on this comparison (so the compare's result is already told by the swap)? */
function nextIs(trace: ExecutionTrace, index: number, kind: TraceEvent['kind']): boolean {
  return trace.frames[index + 1]?.event.kind === kind;
}

/** Looks back for a compare right before the step, so a swap can say why it happened. */
function precedingCompare(trace: ExecutionTrace, index: number): { a: string; b: string; relation: '<' | '>' | '=' } | null {
  const prev = trace.frames[index - 1];
  if (!prev || prev.event.kind !== 'compare' || !prev.event.relation) return null;
  const [x, y] = prev.event.actors.map((id) => nodeById(prev, id));
  if (!x || !y) return null;
  return { a: val(x), b: val(y), relation: prev.event.relation };
}

/**
 * Explains frame `index` of `trace`. Frame 0 is the starting picture; the
 * last frame also tells the learner the algorithm has finished (or, when the
 * run was cut short, that it was).
 */
export function explainFrame(trace: ExecutionTrace, index: number, _options: ExplainOptions = {}): Explanation {
  const frames = trace.frames;
  const i = Math.max(0, Math.min(frames.length - 1, index));
  const frame = frames[i];
  const prev = frames[i - 1];
  const ev = frame.event;
  const changed = changedVars(frame, prev);
  const actors = ev.actors.map((id) => nodeById(frame, id));
  const [a, b] = actors;
  const prevA = a && prev ? nodeById(prev, a.id) : undefined;
  const prevB = b && prev ? nodeById(prev, b.id) : undefined;
  const isLast = i === frames.length - 1 && i > 0;

  const context: ExplanationContext = {
    values: actors.filter(Boolean).map((n) => val(n)),
    indices: actors.flatMap((n) => (n?.index === undefined ? [] : [n.index])),
    structure: a?.structure,
    relation: ev.relation,
    changedVars: changed,
  };
  const make = (text: string, importance: ExplanationImportance, operation = ev.kind.toUpperCase()): Explanation => {
    let finalText = text;
    if (isLast && !trace.error) finalText += trace.truncated ? ' That is as far as this recording goes; the program keeps running after it.' : ' That was the last step: the program is complete.';
    return { text: finalText, importance: isLast && !trace.error ? 'key' : importance, operation: isLast && !trace.error && !trace.truncated ? `${operation}+COMPLETE` : operation, line: frame.line, context };
  };

  if (i === 0) {
    const structures = frame.structures.map((s) => `${s.name} (${s.kind.toLowerCase().replace('_', ' ')}${s.nodeIds.length ? ` of ${plural(s.nodeIds.length, 'element')}` : ''})`);
    const body = structures.length ? `Here is the starting picture: ${joinList(structures)}.` : 'Here is the starting picture.';
    const sample = frame.structures[0] && frame.structures[0].nodeIds.length <= 12 ? frame.structures[0].nodeIds.map((id) => val(nodeById(frame, id))) : [];
    const values = sample.length ? ` It holds ${joinList(sample)}.` : '';
    return { text: `${body}${values} ${plural(trace.frames.length - 1, 'step')} were recorded for this run.`, importance: 'key', operation: 'INIT', line: null, context };
  }

  const varNote = describeVarChange(changed);
  const sentence = runtimeSentence(frame);

  switch (ev.kind) {
    case 'compare': {
      if (a && b) {
        const rel = ev.relation;
        const where = a.index !== undefined && b.index !== undefined ? `, at positions ${a.index} and ${b.index}` : '';
        const verdict = rel ? ` ${relationWords(rel, val(a), val(b))}${rel === '>' && nextIs(trace, i, 'swap') ? ', so they are out of order and will be swapped' : rel === '<' && !nextIs(trace, i, 'swap') ? ', so they are already in order' : ''}.` : '';
        return make(`We are comparing ${val(a)} with ${val(b)}${where}.${verdict}`.replace('..', '.'), 'detail');
      }
      return make(`${sentence || 'A comparison is made'}${sentence.endsWith('.') ? '' : '.'}`, 'detail');
    }
    case 'swap': {
      const why = precedingCompare(trace, i);
      const reason = why ? ` Because ${relationWords(why.relation, why.a, why.b)}, they were out of order.` : '';
      if (a && b) {
        const from = spot(a, prevA);
        const to = spot(b, prevB);
        const move = from && to ? ` Swapping ${val(a)} from ${from} with ${val(b)} from ${to}.` : ` Swapping ${val(a)} and ${val(b)}.`;
        return make(`${move.trim()}${reason} They trade places.`, 'key');
      }
      return make(`${sentence || 'Two elements trade places'}.${reason}`, 'key');
    }
    case 'write': {
      const w = ev.writes[0];
      if (w) {
        const n = nodeById(frame, w.id);
        const at = spot(n);
        const extra = ev.writes.length > 1 ? ` ${plural(ev.writes.length - 1, 'other value')} changed too.` : '';
        return make(`The value ${w.from === '' ? 'is set' : `${w.from} is overwritten`} ${w.from === '' ? `to ${w.to}` : `with ${w.to}`}${at ? ` ${at}` : ''}.${extra}`, 'key');
      }
      return make(`${sentence || 'A value is updated'}${varNote ? ` ${varNote}` : ''}`.replace(/\.?$/, '.'), 'key');
    }
    case 'create': {
      const names = actors.filter(Boolean).slice(0, 3).map((n) => val(n));
      const into = a?.structure ? ` in ${a.structure}` : '';
      const kind = frame.structures.find((s) => s.name === a?.structure)?.kind;
      const verb = kind === 'STACK' ? 'pushed onto the stack' : kind === 'QUEUE' ? 'added to the back of the queue' : kind === 'LINKED_LIST' ? 'added to the list' : 'created';
      return make(`${joinList(names) || 'A new node'} ${names.length > 1 ? 'are' : 'is'} ${verb}${kind ? '' : into}.${kind === 'STACK' ? ' It sits on top, so it will be the first to leave.' : ''}${kind === 'QUEUE' ? ' Items leave from the front, so it waits its turn.' : ''}`, 'key');
    }
    case 'remove': {
      const gone = prev ? prev.nodes.filter((n) => !nodeById(frame, n.id)).map((n) => val(n)) : [];
      const names = gone.length ? gone : actors.filter(Boolean).map((n) => val(n));
      const kind = a ? frame.structures.find((s) => s.name === a.structure)?.kind : prev?.structures.find((s) => s.nodeIds.some((id) => !nodeById(frame, id)))?.kind;
      const verb = kind === 'STACK' ? 'popped off the top of the stack' : kind === 'QUEUE' ? 'removed from the front of the queue' : 'removed';
      return make(`${joinList(names.slice(0, 3)) || 'A node'} ${names.length > 1 ? 'are' : 'is'} ${verb}.`, 'key');
    }
    case 'link': {
      return make(`${sentence || 'A pointer is re-linked'}${sentence.endsWith('.') ? '' : '.'} The connection between nodes changes here.`, 'key');
    }
    case 'traverse':
    case 'visit': {
      const target = a ? `${val(a)}${a.index !== undefined ? ` at position ${a.index}` : ''}` : '';
      const text = target ? `We move on to ${target}${ev.edges.length ? ', following the link' : ''}.` : `${sentence || 'The walk continues'}.`;
      return make(`${text}${varNote ? ` ${varNote}` : ''}`, 'detail');
    }
    case 'call': {
      const top = frame.callStack[frame.callStack.length - 1] ?? sentence;
      const depth = frame.callStack.length;
      return make(`A function is called: ${top}.${depth > 1 ? ` This is call depth ${depth}: each call waits for the one above it to return.` : ''}`, 'key');
    }
    case 'return': {
      const depth = frame.callStack.length;
      return make(`${sentence || 'The function returns'}${sentence.endsWith('.') ? '' : '.'}${depth > 0 ? ` Control goes back to ${frame.callStack[depth - 1]}.` : ' Control goes back to the caller.'}`, 'key');
    }
    case 'settle': {
      const n = actors.filter(Boolean);
      const text = n.length === 1 ? `${val(n[0])}${spot(n[0]) ? ` ${spot(n[0])}` : ''} is in its final place.` : `${joinList(n.slice(0, 4).map((x) => val(x)))} are now in their final places.`;
      return make(text, 'key');
    }
    case 'discard': {
      const n = actors.filter(Boolean).slice(0, 3).map((x) => val(x));
      return make(`${joinList(n) || 'This part'} can be ruled out, so we do not need to look there any more.`, 'key');
    }
    case 'mark': {
      return make(`${sentence || 'Marking elements of interest'}${sentence.endsWith('.') ? '' : '.'}`, 'detail');
    }
    case 'print': {
      return make(`The program prints: ${sentence || 'a line of output'}.`.replace('..', '.'), 'key');
    }
    case 'assign': {
      return make(`${sentence || 'A variable is assigned'}${sentence.endsWith('.') ? '' : '.'}${varNote ? ` ${varNote}` : ''}`, 'detail');
    }
    case 'layout':
    case 'camera':
      return make(`${frame.caption || 'The view changes'}.`, 'detail');
    case 'hold':
      return make('A short pause, to let you take in the picture.', 'detail');
    case 'move':
      return make(`${plural(Math.max(1, ev.actors.length), 'element')} moved to a new position.`, 'detail');
    default: {
      const text = `${sentence || 'The program moves on'}${sentence.endsWith('.') ? '' : '.'}${varNote ? ` ${varNote}` : ''}`;
      return make(text, KEY_KINDS.has(ev.kind) ? 'key' : 'detail');
    }
  }
}

function sourceLine(source: string | undefined, line: number | null): string | null {
  if (!source || line === null) return null;
  const text = source.split(/\r?\n/)[line - 1]?.trim();
  return text || null;
}

/**
 * Explains the error that ended the run: where it happened, what went wrong,
 * the values involved, and what to change. Reads the runtime's own message
 * and the last frame's variables and structure sizes.
 */
export function explainError(trace: ExecutionTrace, options: ExplainOptions = {}): Explanation | null {
  if (!trace.error) return null;
  const { message, line } = trace.error;
  const last = trace.frames[trace.frames.length - 1];
  const vars = last?.vars ?? {};
  const code = sourceLine(options.source, line);
  const where = line !== null ? `on line ${line}${code ? `, which reads: ${code}` : ''}` : 'while the program was running';
  const shown = Object.entries(vars)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
    .slice(0, 4)
    .map(([k, v]) => `${k} is ${v}`);
  const state = shown.length ? ` At that moment ${joinList(shown)}.` : '';
  const sizes = last && !/valid indices/i.test(message)
    ? last.structures
        .filter((s) => s.nodeIds.length > 0)
        .slice(0, 2)
        .map((s) => `${s.name} has ${plural(s.nodeIds.length, 'element')}${s.kind === 'ARRAY' ? `, so its valid positions are 0 to ${s.nodeIds.length - 1}` : ''}`)
    : [];
  const clean = message.replace(/\s+/g, ' ').trim();

  let why: string;
  let fix: string;
  if (/out of (range|bounds)|index .* (is|was) (not valid|invalid)/i.test(clean)) {
    why = 'The program asked for a position that does not exist.';
    fix = 'Check the loop bounds and the index you compute: the last valid position is one less than the length, so a condition like "i + 1 less than length" keeps it inside the structure.';
  } else if (/null pointer|is null|dereference/i.test(clean)) {
    why = 'A pointer that points to nothing was followed.';
    fix = 'Test that the pointer is not NULL before reading from it, for example by stopping a traversal when the next node is NULL.';
  } else if (/double free|already freed/i.test(clean)) {
    why = 'The same node was freed twice.';
    fix = 'Free a node only once, and clear or reassign any pointer that still refers to it.';
  } else if (/key .*not in|no such key|not in hash map/i.test(clean)) {
    why = 'The program looked for a key that is not stored.';
    fix = 'Check that the key exists before reading or deleting it.';
  } else if (/empty|underflow|nothing to (pop|remove|dequeue)/i.test(clean)) {
    why = 'The program tried to take something out of an empty structure.';
    fix = 'Check that the structure has an element before you pop or dequeue.';
  } else if (/infinite|max(imum)? (execution|iteration)|too many/i.test(clean)) {
    why = 'The program ran for far too long, which usually means a loop never ends.';
    fix = 'Make sure something inside the loop moves it toward its stopping condition.';
  } else {
    why = 'The program hit a rule it cannot continue past.';
    fix = 'Read the message, then compare the values on that line with what the line expects.';
  }
  const text = `The program stopped with an error ${where}. ${clean.replace(/[.\s]*$/, '')}. ${why}${state}${sizes.length ? ` ${joinList(sizes)}.` : ''} ${fix}`;
  return {
    text,
    importance: 'key',
    operation: 'ERROR',
    line,
    context: { values: shown, indices: [], changedVars: {} },
  };
}

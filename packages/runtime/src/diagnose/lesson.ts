import type { ErrorInfo, ErrorKind, StripCell } from './types';
import type { TraceFrame } from '../trace/types';

/**
 * From facts to teaching. A lesson is what a learner is told about a mistake:
 * what happened, why, how to fix it, and the idea behind it. Every sentence is
 * built from the `ErrorInfo` (the real index, the real variable values, the
 * real line), so the same kind of error reads differently for different code.
 *
 * The lesson is the same in every theme. The presentation layer adds a voice
 * (Panda, Penguin, Rabbit, Default) on top of `facts` and the sections; it
 * never changes what is being said.
 */

export interface LessonStrip {
  structure: string;
  cells: StripCell[];
  /** Valid cells before / after the ones shown (the strip shows a window of a long structure). */
  hiddenBefore: number;
  hiddenAfter: number;
  /** One line under the strip: `Valid indices 0 to 2 · attempted 3`. */
  caption: string;
}

export interface LessonCode {
  /** What the snippet is: "One way to stop the loop in time". */
  caption: string;
  lines: string[];
}

/** The numbers and names a voice needs to phrase the same lesson its own way. */
export interface LessonFacts {
  structure?: string;
  index?: number;
  last?: number | null;
  size?: number;
  /** For an index: how it missed. */
  direction?: 'past-end' | 'before-start' | 'empty';
  operation?: string;
  subject?: string;
  line: number | null;
  expression: string | null;
  /** Variables in the expression: `{ i: 2 }`. */
  parts?: Record<string, number>;
  /** Items a structure received and gave back. */
  added?: number;
  removed?: number;
  suggestion?: string;
  found?: string;
  expected?: string;
  /** The single most useful action, as a short imperative: "stop the loop before index 3". */
  action: string;
  /** The single problem, as a short clause: "index 3 does not exist". */
  problem: string;
  /** The rule that makes it a problem: "the last valid index is 2". */
  limit: string;
}

export interface ErrorLesson {
  type: ErrorKind;
  phase: ErrorInfo['phase'];
  severity: ErrorInfo['severity'];
  name: string;
  title: string;
  line: number | null;
  where: string;
  expression: string | null;
  /** The offending line with the culprit marked: the editor and the panel point at exactly this. */
  pointer: { text: string; column: number; length: number } | null;
  /** What happened. */
  what: string;
  /** Why it happened. */
  why: string;
  /** How to fix it. */
  fix: string;
  /** The idea underneath, in one line. */
  concept: string;
  /** The right logic, shown as code the learner can compare with theirs (never applied for them). */
  correct: LessonCode | null;
  strip: LessonStrip | null;
  facts: LessonFacts;
  /** The three parts joined: the neutral spoken / captioned form. */
  summary: string;
  /** A logic warning can be dismissed and the run continued; an error ends the run. */
  canContinue: boolean;
}

// ── wording helpers ────────────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

const noun = (kind: string | undefined) =>
  ({ ARRAY: 'array', STACK: 'stack', QUEUE: 'queue', LINKED_LIST: 'linked list', HEAP: 'heap', HASH_MAP: 'hash map', GRAPH: 'graph', TREE: 'tree', TRIE: 'trie' })[kind ?? ''] ?? 'structure';

/** "indices 0, 1, and 2" / "indices 0 to 9" / "no valid index". */
function validIndices(range: [number, number] | null | undefined, word = 'indices'): string {
  if (!range) return 'no valid index';
  const [lo, hi] = range;
  if (lo === hi) return `only index ${lo}`;
  if (hi - lo <= 4) return `${word} ${joinList(Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)))}`;
  return `${word} ${lo} to ${hi}`;
}

const tail = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;

function lineLabel(line: number | null): string {
  return line === null ? 'The program' : `Line ${line}`;
}

function indexStrip(info: ErrorInfo, frame: TraceFrame | undefined): LessonStrip | null {
  if (info.type !== 'INDEX_ERROR' || !info.structure || info.actualIndex === undefined) return null;
  const size = info.structure.size;
  const attempted = info.actualIndex;
  const valueAt = (i: number) => frame?.nodes.find((n) => n.structure === info.structure!.name && n.index === i)?.text;
  const WINDOW = 5;
  const validIdx = Array.from({ length: size }, (_, i) => i);
  let shown = validIdx;
  let hiddenBefore = 0;
  let hiddenAfter = 0;
  if (size > WINDOW) {
    if (attempted < 0) {
      shown = validIdx.slice(0, WINDOW - 1);
    } else {
      shown = validIdx.slice(Math.max(0, size - (WINDOW - 1)));
    }
    hiddenBefore = shown.length ? shown[0] : 0;
    hiddenAfter = size - (shown.length ? shown[shown.length - 1] + 1 : 0);
  }
  const cells: StripCell[] = shown.map((i) => ({ index: i, value: valueAt(i), kind: 'valid' }));
  const bad: StripCell = { index: attempted, kind: 'attempted' };
  if (attempted < 0) cells.unshift(bad);
  else cells.push(bad);
  return {
    structure: info.structure.name,
    cells,
    hiddenBefore,
    hiddenAfter,
    caption: size === 0 ? `${info.structure.name} is empty · attempted ${attempted}` : `Valid ${validIndices(info.validRange, 'indices')} · attempted ${attempted}`,
  };
}

/** Rewrites a LOOP header so its upper bound stops `k` sooner: `... TO LENGTH(arr) - 1` becomes `... TO LENGTH(arr) - 2`. */
function tightenLoop(header: string, to: string, k: number): string {
  const m = /^(.*?)(\s*-\s*)(\d+)\s*$/.exec(to);
  const next = m ? `${m[1]}${m[2]}${Number(m[3]) + k}` : `${to} - ${k}`;
  const at = header.lastIndexOf(to);
  return at >= 0 ? `${header.slice(0, at)}${next}${header.slice(at + to.length)}` : header;
}

type Draft = Pick<ErrorLesson, 'what' | 'why' | 'fix' | 'concept' | 'correct'> & { facts: Pick<LessonFacts, 'action' | 'problem' | 'limit'> & Partial<LessonFacts> };

// ── per-kind teaching ──────────────────────────────────────────────────────

function teachIndex(info: ErrorInfo): Draft {
  const s = info.structure;
  const name = s?.name ?? 'the structure';
  const word = noun(s?.kind);
  const idx = info.actualIndex;
  const size = s?.size ?? 0;
  const last = info.validRange ? info.validRange[1] : null;
  const expr = info.expression ?? (idx !== undefined ? `${name}[${idx}]` : name);
  const ex = info.indexExpression;
  const parts = ex?.parts ?? {};
  const partNames = Object.keys(parts);
  const direction: LessonFacts['direction'] = size === 0 ? 'empty' : idx !== undefined && idx < 0 ? 'before-start' : 'past-end';
  const L = lineLabel(info.line);

  const what =
    idx === undefined
      ? `${L} asks ${name} for a position that does not exist.`
      : size === 0
        ? `${L} reads ${expr}, but ${name} is empty, so no index is valid.`
        : `${L} reads ${expr}, which asks for index ${idx}, but the ${word} ${name} only has ${validIndices(info.validRange)}.`;

  const reasons: string[] = [];
  if (ex && partNames.length > 0 && !/^-?\d+$/.test(ex.text)) {
    const values = partNames.map((p) => `${p} is ${parts[p]}`);
    const bare = /^[A-Za-z_]\w*$/.test(ex.text);
    reasons.push(bare ? `At that moment ${joinList(values)}.` : `At that moment ${joinList(values)}, so ${ex.text} works out to ${ex.value}.`);
  }
  if (idx !== undefined) {
    if (size === 0) reasons.push(`An empty ${word} has no positions at all.`);
    else if (idx < 0) reasons.push(`Indices start at 0, so ${idx} points before the first element.`);
    else if (idx === size) reasons.push(`Index ${idx} is just one past the last element, which sits at index ${last}.`);
    else reasons.push(`The last element sits at index ${last}, and ${idx} is ${tail(idx - (last as number))} beyond it.`);
  }
  const loop = info.loop;
  const loopVar = loop && parts[loop.variable] !== undefined ? loop.variable : undefined;
  const k = loopVar !== undefined && idx !== undefined ? idx - parts[loopVar] : undefined;
  if (loop && loopVar && loop.toValue !== undefined && parts[loopVar] === loop.toValue) {
    reasons.push(`The LOOP on line ${loop.line} lets ${loopVar} reach ${loop.toValue} (${loop.to}), and on that last pass ${expr} reaches past the end.`);
  }
  const why = reasons.join(' ') || 'The index is outside the range the structure covers.';

  let fix: string;
  let correct: LessonCode | null = null;
  let action: string;
  if (loop && loopVar && k !== undefined && k > 0 && idx !== undefined && direction === 'past-end') {
    action = `stop the loop ${tail(k)} sooner so the index never reaches ${idx}`;
    const nextHeader = tightenLoop(loop.header, loop.to, k);
    fix = `Either stop the loop ${tail(k)} sooner, so that ${ex!.text} is still a valid index on the last pass, or read the current element ${name}[${loopVar}] instead of the one after it.`;
    correct = {
      caption: 'One way to stop the loop in time',
      lines: [nextHeader, `  ${info.lineText?.trim() ?? expr}`, 'END'],
    };
  } else if (direction === 'empty') {
    action = `put something in ${name} before reading from it`;
    fix = `Make sure ${name} has elements before this line runs, or check LENGTH(${name}) > 0 first so the line is skipped when there is nothing to read.`;
    correct = { caption: 'Guard the read', lines: [`IF LENGTH(${name}) > 0`, `  ${info.lineText?.trim() ?? expr}`, 'END'] };
  } else if (direction === 'before-start') {
    action = `keep the index at 0 or above`;
    fix = `Make sure the index never goes below 0: fix the value that produces ${ex?.text ?? 'it'}, or check it is at least 0 before using it.`;
    correct = ex ? { caption: 'Check the index first', lines: [`IF ${ex.text} >= 0`, `  ${info.lineText?.trim() ?? expr}`, 'END'] } : null;
  } else {
    action = `keep the index at ${last} or below`;
    fix = `Keep the index inside the structure: change the value that produces ${ex?.text ?? 'it'} so it stays at ${last} or below, or check it against LENGTH(${name}) before reading.`;
    correct = ex ? { caption: 'Check the index first', lines: [`IF ${ex.text} < LENGTH(${name})`, `  ${info.lineText?.trim() ?? expr}`, 'END'] } : null;
  }
  return {
    what,
    why,
    fix,
    concept: `Indices start at 0, so a structure with N elements has indices 0 to N - 1. Anything outside that range does not exist.`,
    correct,
    facts: {
      structure: name,
      index: idx,
      last,
      size,
      direction,
      parts,
      action,
      problem: idx === undefined ? 'that position does not exist' : `index ${idx} does not exist`,
      limit: size === 0 ? `${name} is empty` : `the last valid index is ${last}`,
    },
  };
}

function teachEmpty(info: ErrorInfo): Draft {
  const name = info.subject ?? 'the structure';
  const kind = info.structure?.kind;
  const op = (info.operation ?? 'TAKE').toUpperCase();
  const verb = kind === 'STACK' ? 'pop from' : kind === 'QUEUE' ? 'take from the front of' : op === 'PEEK' || op === 'FRONT' || op === 'REAR' ? 'look at the top of' : 'take something out of';
  const L = lineLabel(info.line);
  const reasons: string[] = [];
  if (info.added !== undefined && info.removed !== undefined) {
    if (info.added === 0) reasons.push(`Nothing was ever added to ${name} before this line.`);
    else reasons.push(`${name} received ${plural(info.added, 'item')} and ${info.removed >= info.added ? 'all of them have' : `${info.removed} of them have`} already been taken out, so it is empty now.`);
  }
  const idea =
    kind === 'STACK'
      ? 'A stack hands back only what was pushed onto it, last in, first out; popping an empty stack is called underflow.'
      : kind === 'QUEUE'
        ? 'A queue hands back items in the order they arrived; dequeuing an empty queue is called underflow.'
        : 'You can only take out what has been put in; taking from an empty structure is called underflow.';
  const guard = kind === 'QUEUE' || kind === 'STACK' ? `IS_EMPTY(${name})` : `LENGTH(${name}) > 0`;
  return {
    what: `${L} tries to ${verb} ${name}, but ${name} is empty.`,
    why: reasons.join(' ') || `Every item that went in has already come out, so there is nothing left to give.`,
    fix: `Check that ${name} has something in it before you take from it, so the line is skipped when it is empty.`,
    concept: idea,
    correct: { caption: 'Guard the removal', lines: kind === 'QUEUE' || kind === 'STACK' ? [`IF NOT ${guard}`, `  ${info.lineText?.trim() ?? `${op} ${name}`}`, 'END'] : [`IF ${guard}`, `  ${info.lineText?.trim() ?? `${op} ${name}`}`, 'END'] },
    facts: { structure: name, size: 0, operation: op, added: info.added, removed: info.removed, action: `check that ${name} is not empty first`, problem: `${name} has nothing to take out`, limit: `${name} is empty` },
  };
}

function teachNull(info: ErrorInfo): Draft {
  const p = info.subject ?? 'the pointer';
  const L = lineLabel(info.line);
  const expr = info.expression ?? (info.member ? `${p}.${info.member}` : p);
  const became = info.assignedAtLine !== undefined ? `${p} was last set on line ${info.assignedAtLine}, and by then it had moved past the last node, so it holds NULL.` : `${p} moved past the last node, or never pointed at one, so it holds NULL.`;
  return {
    what: `${L} reads ${expr}, but ${p} is NULL: it points at nothing.`,
    why: `${became} NULL has no value and no next node to read.`,
    fix: `Test the pointer before using it: only read ${expr} while ${p} is not NULL, for example by looping WHILE ${p} != NULL.`,
    concept: 'NULL means "no node here". Following a pointer is only safe after checking that it points at something.',
    correct: { caption: 'Check before following', lines: [`WHILE ${p} != NULL`, `  ${info.lineText?.trim() ?? expr}`, 'END'] },
    facts: { subject: p, action: `check that ${p} is not NULL before using it`, problem: `${p} is NULL`, limit: `a NULL pointer points at nothing` },
  };
}

function teachUndefined(info: ErrorInfo): Draft {
  const n = info.subject ?? 'that name';
  const fn = info.operation === 'CALL';
  const L = lineLabel(info.line);
  const hint = info.suggestion ? ` The closest name that exists is ${info.suggestion}.` : '';
  if (fn) {
    return {
      what: `${L} calls ${n}, but no function with that name exists.`,
      why: `A function has to be defined before it can be called.${hint}`,
      fix: info.suggestion ? `Check the spelling: did you mean ${info.suggestion}? Otherwise define FUNCTION ${n} first.` : `Define FUNCTION ${n} in the program, or call one that exists.`,
      concept: 'A name only means something once it has been defined.',
      correct: null,
      facts: { subject: n, suggestion: info.suggestion, operation: 'CALL', action: info.suggestion ? `use ${info.suggestion}, or define ${n}` : `define ${n} before calling it`, problem: `${n} is not defined`, limit: 'a function must exist before it is called' },
    };
  }
  return {
    what: `${L} uses ${n}, but ${n} has not been given a value or declared.`,
    why: `A variable has to be created (by assigning it, or declaring a structure) before its value can be read.${hint}`,
    fix: info.suggestion ? `If you meant ${info.suggestion}, correct the spelling. Otherwise give ${n} a value on an earlier line.` : `Give ${n} a value on an earlier line, or fix the spelling if it should be a name that already exists.`,
    concept: 'A name only holds a value after something has put one there.',
    correct: info.suggestion && info.lineText ? { caption: 'With the name corrected', lines: [info.lineText.trim().replace(new RegExp(`\\b${n}\\b`), info.suggestion)] } : { caption: 'Give it a value first', lines: [`${n} = 0`, info.lineText?.trim() ?? n] },
    facts: { subject: n, suggestion: info.suggestion, action: info.suggestion ? `correct the spelling to ${info.suggestion}` : `give ${n} a value before using it`, problem: `${n} has no value`, limit: 'a name needs a value before it is read' },
  };
}

function teachDivision(info: ErrorInfo): Draft {
  const d = info.subject ?? 'the divisor';
  const L = lineLabel(info.line);
  const ex = info.indexExpression;
  const expr = info.expression ?? 'the division';
  const isName = /^[A-Za-z_]\w*$/.test(d);
  const mod = info.operation === 'MOD';
  return {
    what: `${L} ${mod ? 'takes a remainder' : 'divides'} by ${d}, and ${isName ? `${d} is ${ex?.value ?? 0}` : 'that works out to 0'}.`,
    why: `${expr} needs a nonzero ${mod ? 'divisor' : 'divisor'}: no number times 0 gives anything but 0, so dividing by 0 has no answer.`,
    fix: `Make sure ${d} cannot be 0 when this line runs: check it first, or fix the earlier line that gives it the value 0.`,
    concept: 'Division asks "how many times does this fit?", and nothing fits 0 times into a number in a way that makes sense.',
    correct: { caption: 'Guard the division', lines: [`IF ${d} != 0`, `  ${info.lineText?.trim() ?? expr}`, 'END'] },
    facts: { subject: d, parts: ex?.parts, action: `make sure ${d} is not 0`, problem: `${d} is 0`, limit: 'you cannot divide by zero' },
  };
}

function teachLoop(info: ErrorInfo): Draft {
  const L = info.loop ? `The loop on line ${info.loop.line}` : 'A loop';
  const cond = info.condition;
  const frozen = info.frozen ?? [];
  const why = cond
    ? frozen.length
      ? `Its condition, ${cond}, stays true because ${joinList(frozen)} never ${frozen.length === 1 ? 'changes' : 'change'} inside the loop, so the loop has no way to reach its stopping point.`
      : `Its condition, ${cond}, never becomes false, so the loop never reaches its stopping point.`
    : 'Nothing inside it moves it toward a stopping point.';
  const v = frozen[0];
  return {
    what: `${L} never finishes.`,
    why,
    fix: v
      ? `Change ${v} inside the loop so it moves toward making the condition false, for example by adding ${v} = ${v} + 1 at the end of each pass.`
      : 'Make something inside the loop move it toward its stopping condition on every pass.',
    concept: 'A WHILE loop keeps going as long as its condition is true, so the body must change something the condition looks at.',
    correct: v ? { caption: 'Move toward the stopping point', lines: [info.loop?.header ?? 'WHILE ...', `  ...`, `  ${v} = ${v} + 1`, 'END'] } : null,
    facts: { subject: v, action: v ? `change ${v} inside the loop` : 'make the loop move toward stopping', problem: 'the loop never ends', limit: 'a loop needs a way out' },
  };
}

function teachRecursion(info: ErrorInfo): Draft {
  const f = info.subject ?? 'The function';
  const stack = info.callStack ?? [];
  const sample = stack.length >= 2 ? `${stack[stack.length - 2]} then ${stack[stack.length - 1]}` : stack[0];
  return {
    what: `${f} kept calling itself until the call stack ran out of room.`,
    why: `${sample ? `The most recent calls were ${sample}. ` : ''}Each call waits for the next one to return, and no call ever returned, so the base case that should stop the chain is never reached.`,
    fix: `Add a base case that returns without calling ${f} again, and make sure every call changes its argument toward that base case.`,
    concept: 'Every recursive function needs a base case, and every recursive call must move closer to it.',
    correct: { caption: 'The shape of a safe recursion', lines: [`FUNCTION ${f}(n)`, '  IF n <= 0', '    RETURN 0', '  END', `  RETURN ${f}(n - 1)`, 'END'] },
    facts: { subject: f, action: 'add a base case and move toward it', problem: `${f} never stops calling itself`, limit: 'recursion needs a base case' },
  };
}

function teachGeneric(info: ErrorInfo): Draft {
  const L = lineLabel(info.line);
  const msg = info.message.replace(/\s+/g, ' ').replace(/[.\s]*$/, '');
  const known = info.type === 'KEY_ERROR' ? 'The program looked for a key that is not stored.' : info.type === 'TYPE_ERROR' ? 'A value of the wrong kind reached an operation that cannot use it.' : 'The program reached a step it cannot carry out.';
  const vars = Object.entries(info.variables).slice(0, 4).map(([k, v]) => `${k} is ${v}`);
  return {
    what: `${L} stopped the program: ${msg}.`,
    why: `${known}${vars.length ? ` At that moment ${joinList(vars)}.` : ''}`,
    fix: info.type === 'KEY_ERROR' ? 'Check that the key exists before reading or deleting it.' : 'Compare the values on that line with what the line expects, then change the value or the check that leads to it.',
    concept: 'A step can only run when the values it works with are the kind, and in the range, it expects.',
    correct: null,
    facts: { action: 'check the values on that line', problem: msg, limit: 'the step needs valid input' },
  };
}

function teachSyntax(info: ErrorInfo): Draft {
  const L = lineLabel(info.line);
  const noticed = info.noticedAtLine !== undefined && info.noticedAtLine !== info.line ? ` The compiler only noticed on line ${info.noticedAtLine}.` : '';
  const code = info.lineText?.trim();
  switch (info.type) {
    case 'MISSING_DELIMITER': {
      const open = info.subject ?? '(';
      const close = open === '[' ? ']' : open === '(' ? ')' : '}';
      const fixed = code ? `${code}${close}` : close;
      return {
        what: `${L} opens a "${open}" that is never closed.`,
        why: `The compiler kept reading after it, expecting the matching "${close}", and reached the end of the statement without one.${noticed}`,
        fix: `Add the missing "${close}" where the ${open === '[' ? 'list' : 'group'} should end.`,
        concept: 'Every opening bracket needs a matching closing bracket, in the right order.',
        correct: { caption: 'With the bracket closed', lines: [fixed] },
        facts: { subject: open, expected: close, action: `add the missing ${close}`, problem: `the ${open} is never closed`, limit: 'brackets come in pairs' },
      };
    }
    case 'INCOMPLETE_STATEMENT':
      return {
        what: `${L} stops before the statement is finished.`,
        why: `It ends with something that needs a value after it, but the next thing the compiler found was a new statement.${noticed}`,
        fix: 'Finish the statement: give the last operator or keyword the value it is waiting for.',
        concept: 'A statement has to be complete before the next one starts: an operator or keyword at the end of a line is waiting for more.',
        correct: null,
        facts: { action: 'finish the statement', problem: 'the statement is cut off', limit: 'a statement must be complete' },
      };
    case 'UNKNOWN_KEYWORD':
      return {
        what: `${L} starts with ${info.subject ?? 'a word'}, which is not an AQVL keyword.`,
        why: info.suggestion ? `The closest keyword is ${info.suggestion}, so this is probably a typo.` : 'AQVL only knows its own keywords at the start of a statement.',
        fix: info.suggestion ? `Replace ${info.subject} with ${info.suggestion}.` : 'Use one of the AQVL keywords to start the statement.',
        concept: 'Keywords have to be spelled exactly; the compiler cannot guess what was meant.',
        correct: info.suggestion && code && info.subject ? { caption: 'With the keyword corrected', lines: [code.replace(info.subject, info.suggestion)] } : null,
        facts: { subject: info.subject, suggestion: info.suggestion, action: info.suggestion ? `use ${info.suggestion}` : 'use a real keyword', problem: `${info.subject ?? 'that word'} is not a keyword`, limit: 'keywords must be spelled exactly' },
      };
    case 'SEMANTIC_ERROR': {
      const msg = info.message.replace(/\s+/g, ' ').replace(/[.\s]*$/, '');
      return {
        what: `${L}: ${msg}.`,
        why: 'The line is written correctly, but what it says does not make sense for this program.',
        fix: 'Change the line so it agrees with how the program declared things, then run it again.',
        concept: 'The compiler checks meaning as well as spelling.',
        correct: null,
        facts: { action: 'make the line agree with the declarations', problem: msg, limit: 'the line must make sense' },
      };
    }
    default: {
      const found = info.found ? `"${info.found}"` : null;
      const expected = info.expected ? info.expected.replace(/^"([^"]+)"$/, '$1') : null;
      const what = found && expected ? `${L} has ${found} where the compiler expected ${expected}.` : found ? `${L} has ${found} where the compiler did not expect it.` : `${L} is not valid AQVL: ${info.message.replace(/[.\s]*$/, '')}.`;
      return {
        what,
        why: found && expected ? `At that point the compiler needed ${expected}, but the next thing in the program was ${found}.${noticed}` : `The compiler reads a program one token at a time, and${found ? ` it reached ${found}` : ' it reached something'} that cannot come next in this statement.${noticed}`,
        fix: 'Compare the line with an example of the same statement in the docs, and fix the part the compiler stopped at.',
        concept: 'The compiler can only run a program whose every statement follows the grammar.',
        correct: null,
        facts: { found: info.found, expected: info.expected, action: 'fix the part the compiler stopped at', problem: info.found ? `"${info.found}" is not expected here` : 'the line is not valid', limit: 'statements must follow the grammar' },
      };
    }
  }
}

function teachLogic(info: ErrorInfo): Draft {
  const L = lineLabel(info.line);
  const ev = info.evidence ?? {};
  if (info.type === 'SELF_COMPARISON') {
    const left = String(ev.left);
    const right = String(ev.right);
    return {
      what: `${L} compares ${left} with ${right}, but both are the same cell, index ${ev.index}.`,
      why: `A value is always equal to itself, so ${info.expression ?? 'this comparison'} gives the same answer every time and tells the program nothing.`,
      fix: 'Compare two different cells, for example the current one with its neighbour, so the result can actually change what the program does.',
      concept: 'A comparison is only useful when its two sides can differ.',
      correct: null,
      facts: { structure: info.subject, index: Number(ev.index), action: 'compare two different cells', problem: 'a cell is compared with itself', limit: 'a comparison needs two different values' },
    };
  }
  const less = Number(ev.swapsWhenLess ?? 0);
  const greater = Number(ev.swapsWhenGreater ?? 0);
  const cl = Number(ev.compareLine ?? -1);
  const seen = greater + less > 0 ? `Its swaps followed ${greater > 0 ? `${plural(greater, 'comparison')} where the left value was greater` : ''}${greater > 0 && less > 0 ? ' and ' : ''}${less > 0 ? `${plural(less, 'comparison')} where the left value was smaller` : ''}${cl > 0 ? ` (the compare on line ${cl})` : ''}.` : '';
  return {
    what: `${String(ev.scene)} is meant to sort ${info.subject}, but it ends as ${String(ev.end)}, which is not in order, up or down.`,
    why: `${seen} ${greater > 0 && less > 0 ? 'Swapping in both directions undoes earlier work. ' : ''}Starting from ${String(ev.start)}, the passes did not finish the job.`.trim(),
    fix: 'Pick one direction and apply it everywhere: swap two neighbours only when they are out of order for that direction, and make the loops cover every pair.',
    concept: 'A sort works when every comparison points the same way and the loops visit every pair that could be out of order. Either direction is fine.',
    correct: { caption: 'For ascending order', lines: ['IF arr[j] > arr[j + 1]', '  SWAP arr[j] arr[j + 1]', 'END'] },
    facts: { structure: info.subject, action: 'make every comparison point the same way', problem: 'the result is not in order', limit: 'a sort ends in order' },
  };
}

// ── entry point ────────────────────────────────────────────────────────────

const TITLE = { syntax: 'Compilation error', runtime: 'Something went wrong', logic: 'Something looks off' } as const;

/** Turns a diagnosed error into the lesson shown and spoken to the learner. `frame` is the error frame, used to show real cell values. */
export function teachError(info: ErrorInfo, frame?: TraceFrame): ErrorLesson {
  let draft: Draft;
  switch (info.type) {
    case 'INDEX_ERROR':
      draft = teachIndex(info);
      break;
    case 'EMPTY_STRUCTURE':
      draft = teachEmpty(info);
      break;
    case 'NULL_ACCESS':
      draft = teachNull(info);
      break;
    case 'UNDEFINED_NAME':
      draft = teachUndefined(info);
      break;
    case 'DIVISION_BY_ZERO':
      draft = teachDivision(info);
      break;
    case 'INFINITE_LOOP':
      draft = teachLoop(info);
      break;
    case 'RECURSION_LIMIT':
      draft = teachRecursion(info);
      break;
    case 'SELF_COMPARISON':
    case 'UNSORTED_RESULT':
      draft = teachLogic(info);
      break;
    case 'SYNTAX_ERROR':
    case 'MISSING_DELIMITER':
    case 'INCOMPLETE_STATEMENT':
    case 'UNKNOWN_KEYWORD':
    case 'SEMANTIC_ERROR':
      draft = teachSyntax(info);
      break;
    default:
      draft = teachGeneric(info);
  }
  const facts: LessonFacts = { line: info.line, expression: info.expression, ...draft.facts };
  const summary = [draft.what, draft.why, draft.fix].map(sentence).join(' ');
  return {
    type: info.type,
    phase: info.phase,
    severity: info.severity,
    name: info.name,
    title: TITLE[info.phase],
    line: info.line,
    where: info.line === null ? 'While running' : `Line ${info.line}`,
    expression: info.expression,
    pointer: info.lineText !== null && info.line !== null ? { text: info.lineText, column: info.column ?? 1 + (info.lineText.length - info.lineText.trimStart().length), length: info.length ?? Math.max(1, info.lineText.trim().length) } : null,
    what: sentence(draft.what),
    why: sentence(draft.why),
    fix: sentence(draft.fix),
    concept: sentence(draft.concept),
    correct: draft.correct,
    strip: indexStrip(info, frame),
    facts,
    summary,
    canContinue: info.phase === 'logic',
  };
}

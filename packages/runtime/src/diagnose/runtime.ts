import type { TraceFrame } from '../trace/types';
import type { ErrorGhost, ErrorInfo, ErrorKind, FrameError, RawRuntimeError, Scalar } from './types';
import {
  assignsIn,
  enclosingLoops,
  enclosingWhile,
  evaluate,
  evaluateExpression,
  findAccesses,
  lineAt,
  maskLine,
  variablesIn,
  type EvalEnv,
} from './source';

/** The familiar name for each kind of mistake. */
export const KIND_NAME: Record<ErrorKind, string> = {
  INDEX_ERROR: 'IndexError',
  EMPTY_STRUCTURE: 'UnderflowError',
  NULL_ACCESS: 'NullPointerError',
  UNDEFINED_NAME: 'NameError',
  DIVISION_BY_ZERO: 'ZeroDivisionError',
  KEY_ERROR: 'KeyError',
  TYPE_ERROR: 'TypeError',
  INFINITE_LOOP: 'InfiniteLoop',
  RECURSION_LIMIT: 'RecursionError',
  RUNTIME_ERROR: 'RuntimeError',
  SYNTAX_ERROR: 'SyntaxError',
  MISSING_DELIMITER: 'SyntaxError',
  INCOMPLETE_STATEMENT: 'SyntaxError',
  UNKNOWN_KEYWORD: 'SyntaxError',
  SEMANTIC_ERROR: 'SemanticError',
  SELF_COMPARISON: 'LogicWarning',
  UNSORTED_RESULT: 'LogicWarning',
};

export interface RuntimeDiagnosisInput {
  raw: RawRuntimeError;
  source?: string;
  /** The scene at the moment of failure. */
  frame: TraceFrame;
  /** Every frame recorded before it. */
  history: TraceFrame[];
  frameIndex: number;
}

/** Number of elements per structure name in a frame, for `LENGTH(x)` and size facts. */
export function structureSizes(frame: TraceFrame): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of frame.structures) out[s.name] = s.nodeIds.length;
  return out;
}

export function envOf(frame: TraceFrame, vars: Record<string, Scalar>): EvalEnv {
  return { vars, lengths: structureSizes(frame) };
}

const num = (s: string | undefined): number | undefined => (s !== undefined && s !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);

/** Reads what a runtime error message states, for engines that throw plain messages. */
function readMessage(message: string) {
  const clean = message.replace(/\s+/g, ' ');
  const quoted = /'([A-Za-z_]\w*)'|"([A-Za-z_]\w*)"/.exec(clean);
  return {
    clean,
    index: num(/\bindex (-?\d+)/i.exec(clean)?.[1]) ?? num(/\[(-?\d+)\]/.exec(clean)?.[1]) ?? num(/position (-?\d+)/i.exec(clean)?.[1]),
    highest: num(/(?:indices|positions|indexes)(?: are)? 0 to (-?\d+)/i.exec(clean)?.[1]),
    count: num(/\((?:length|size) (\d+)\)/i.exec(clean)?.[1]) ?? num(/has (\d+) (?:vertices|edges|elements|items)/i.exec(clean)?.[1]),
    name: quoted?.[1] ?? quoted?.[2],
    operation: /^([A-Z_]+)\(([A-Za-z_]\w*)\)/.exec(clean),
    pointer: /cannot read ([A-Za-z_]\w*)\.([A-Za-z_]\w*) because/i.exec(clean),
    nullName: /([A-Za-z_]\w*) is NULL/i.exec(clean)?.[1],
  };
}

function classify(raw: RawRuntimeError): ErrorKind {
  const { name, message } = raw;
  const m = message.replace(/\s+/g, ' ');
  if (name === 'ArrayIndexOutOfRangeError' || name === 'OutOfBoundsError') return 'INDEX_ERROR';
  if (name === 'DivisionByZeroError') return 'DIVISION_BY_ZERO';
  if (name === 'UndefinedVariableError' || name === 'FunctionNotFoundError') return 'UNDEFINED_NAME';
  if (name === 'StackOverflowError') return 'RECURSION_LIMIT';
  if (name === 'MaxIterationsExceededError' || name === 'ExecutionLimitExceededError') return 'INFINITE_LOOP';
  if (/NULL pointer dereference/i.test(m)) return 'NULL_ACCESS';
  if (/underflow|nothing to (pop|remove|dequeue)/i.test(m) || /\b(POP|DEQUEUE|PEEK|FRONT|REAR|DELETE|EXTRACT)\b.*\bis empty\b/i.test(m)) return 'EMPTY_STRUCTURE';
  if (/out of (range|bounds)|valid (indices|positions|indexes)|does not exist: .* is empty|no such (index|position)/i.test(m)) return 'INDEX_ERROR';
  if (/\bkey\b.*\b(not|no)\b|no such key|not in (the )?hash ?map|has no key/i.test(m)) return 'KEY_ERROR';
  if (/needs (text|a number)|must be (a )?(number|text|string)|not a (number|text)|cannot (add|compare|multiply)/i.test(m)) return 'TYPE_ERROR';
  if (/is empty/i.test(m)) return 'EMPTY_STRUCTURE';
  return 'RUNTIME_ERROR';
}

/** Which structure an error is about: the named one, else the only one that fits. */
function structureFor(frame: TraceFrame, name: string | undefined, kinds?: string[]) {
  const all = frame.structures;
  const byName = name ? all.find((s) => s.name === name) : undefined;
  if (byName) return byName;
  const pool = kinds ? all.filter((s) => kinds.includes(s.kind)) : all;
  return pool.length === 1 ? pool[0] : undefined;
}

/** Net items a structure received / lost across the run, from node-count changes between frames. */
function flow(history: TraceFrame[], frame: TraceFrame, name: string) {
  let added = 0;
  let removed = 0;
  let prev = 0;
  for (const f of [...history, frame]) {
    const n = f.structures.find((s) => s.name === name)?.nodeIds.length ?? 0;
    if (n > prev) added += n - prev;
    else if (n < prev) removed += prev - n;
    prev = n;
  }
  return { added, removed };
}

/** Where on the line a name's access / expression is, as a 1-based column and a length. */
function span(line: string | null, text: string | null): Pick<ErrorInfo, 'column' | 'length'> {
  if (!line || !text) return {};
  const at = line.indexOf(text);
  return at >= 0 ? { column: at + 1, length: text.length } : {};
}

function lastAssignment(source: string | undefined, history: TraceFrame[], name: string): number | undefined {
  if (!source) return undefined;
  const re = new RegExp(`^\\s*${name}\\s*=(?!=)`);
  for (let i = history.length - 1; i >= 0; i--) {
    const ln = history[i].line;
    const text = lineAt(source, ln);
    if (ln !== null && text && re.test(maskLine(text))) return ln;
  }
  return undefined;
}

/**
 * Builds the structured description of the error that stopped a run. The
 * thrown error supplies the type and the numbers it knows; the source line and
 * the live variables say which part of the line produced them.
 */
export function diagnoseRuntimeError({ raw, source, frame, history, frameIndex }: RuntimeDiagnosisInput): FrameError {
  const type = classify(raw);
  const read = readMessage(raw.message);
  const text = lineAt(source, raw.line);
  const env = envOf(frame, raw.vars);

  const info: ErrorInfo = {
    type,
    phase: 'runtime',
    severity: 'error',
    confidence: 'certain',
    name: KIND_NAME[type],
    line: raw.line,
    lineText: text,
    expression: null,
    message: raw.message,
    frameIndex,
    variables: raw.vars,
  };
  let ghost: ErrorGhost | null = null;

  switch (type) {
    case 'INDEX_ERROR': {
      const fields = raw.fields;
      const structName = (typeof fields.arrayName === 'string' ? fields.arrayName : undefined) ?? read.name;
      const index = typeof fields.index === 'number' ? fields.index : read.index;
      const st = structureFor(frame, structName);
      const size = typeof fields.length === 'number' ? fields.length : st ? st.nodeIds.length : read.highest !== undefined ? read.highest + 1 : read.count ?? 0;
      if (structName) info.structure = { name: structName, kind: st?.kind ?? 'ARRAY', size };
      info.subject = structName;
      if (index !== undefined) info.actualIndex = index;
      info.validRange = size > 0 ? [0, size - 1] : null;

      if (text) {
        // The access whose index came out as the offending value; failing that, any access of the structure.
        const accesses = findAccesses(text, structName).concat(structName ? [] : findAccesses(text));
        let culprit = accesses.find((a) => {
          const v = evaluate(a.index, env);
          return typeof v === 'number' && v === index;
        });
        culprit ??= accesses[0];
        if (culprit) {
          info.expression = culprit.text;
          info.column = culprit.start + 1;
          info.length = culprit.length;
          const ev = evaluateExpression(culprit.index, env);
          if (ev) info.indexExpression = ev;
          else if (index !== undefined) info.indexExpression = { text: culprit.index, value: index, parts: variablesIn(culprit.index, raw.vars) };
          const loops = enclosingLoops(source, raw.line, env);
          const parts = Object.keys(ev?.parts ?? variablesIn(culprit.index, raw.vars));
          const loop = loops.find((l) => parts.includes(l.variable)) ?? undefined;
          if (loop) info.loop = loop;
        }
      }
      if (index !== undefined && structName) {
        ghost = { caption: `${structName}[${index}]`, text: String(index), structure: structName, slot: index, fallback: 'anchor' };
      }
      break;
    }

    case 'EMPTY_STRUCTURE': {
      const op = read.operation;
      const name = op?.[2] ?? read.name;
      const st = structureFor(frame, name, ['STACK', 'QUEUE', 'HEAP']);
      info.operation = op?.[1] ?? /\b(POP|DEQUEUE|PEEK|FRONT|REAR|DELETE|EXTRACT)\b/i.exec(raw.message)?.[1]?.toUpperCase();
      info.subject = st?.name ?? name;
      if (st) {
        info.structure = { name: st.name, kind: st.kind, size: st.nodeIds.length };
        const f = flow(history, frame, st.name);
        info.added = f.added;
        info.removed = f.removed;
      }
      if (text && info.subject) {
        const m = new RegExp(`\\b${info.operation ?? '[A-Z_]+'}\\b[^\\n]*\\b${info.subject}\\b`, 'i').exec(maskLine(text));
        if (m) {
          info.expression = text.slice(m.index, m.index + m[0].length).trim();
          Object.assign(info, span(text, info.expression));
        }
      }
      if (info.subject) ghost = { caption: `${info.subject} is empty`, text: 'empty', structure: info.subject, slot: null, fallback: 'anchor' };
      break;
    }

    case 'NULL_ACCESS': {
      const pointer = read.pointer?.[1] ?? read.nullName;
      info.subject = pointer;
      info.member = read.pointer?.[2];
      if (pointer) info.assignedAtLine = lastAssignment(source, history, pointer);
      if (text && pointer) {
        const m = new RegExp(`\\b${pointer}\\s*\\.\\s*[A-Za-z_]\\w*`).exec(maskLine(text));
        if (m) {
          info.expression = text.slice(m.index, m.index + m[0].length);
          Object.assign(info, span(text, info.expression));
        }
      }
      const st = frame.structures.find((s) => s.kind === 'LINKED_LIST' || s.kind === 'TREE') ?? frame.structures[0];
      if (st) {
        info.structure = { name: st.name, kind: st.kind, size: st.nodeIds.length };
        if (st.kind === 'LINKED_LIST') ghost = { caption: `${pointer ?? 'pointer'} is NULL`, text: 'NULL', structure: st.name, slot: st.nodeIds.length, fallback: 'after-last' };
      }
      break;
    }

    case 'DIVISION_BY_ZERO': {
      if (text) {
        const masked = maskLine(text);
        const re = /([A-Za-z_][\w.]*(?:\[[^\]]*\])?|\d+(?:\.\d+)?|\))\s*([/%])\s*(\w+(?:\([^)]*\))?|\([^)]*\))/g;
        let m: RegExpExecArray | null;
        let pick: RegExpExecArray | null = null;
        while ((m = re.exec(masked))) {
          const d = evaluate(m[3], env);
          if (d === 0) {
            pick = m;
            break;
          }
          pick ??= m;
        }
        if (pick) {
          info.expression = text.slice(pick.index, pick.index + pick[0].length);
          Object.assign(info, span(text, info.expression));
          info.subject = pick[3];
          const d = evaluateExpression(pick[3], env);
          if (d) info.indexExpression = d;
          info.operation = pick[2] === '%' ? 'MOD' : 'DIVIDE';
        }
      }
      break;
    }

    case 'UNDEFINED_NAME': {
      info.subject = read.name;
      if (text && read.name) {
        const m = new RegExp(`\\b${read.name}\\b`).exec(maskLine(text));
        if (m) {
          info.expression = read.name;
          info.column = m.index + 1;
          info.length = read.name.length;
        }
      }
      if (raw.name === 'FunctionNotFoundError') info.operation = 'CALL';
      break;
    }

    case 'RECURSION_LIMIT': {
      info.callStack = raw.callStack;
      const top = raw.callStack[raw.callStack.length - 1] ?? '';
      info.subject = /^([A-Za-z_]\w*)\(/.exec(top)?.[1];
      break;
    }

    case 'INFINITE_LOOP': {
      const w = enclosingWhile(source, raw.line);
      if (w && source) {
        info.condition = w.condition;
        const names = Object.keys(variablesIn(w.condition, raw.vars));
        info.frozen = names.filter((n) => !assignsIn(source, n, w.bodyStart, w.bodyEnd));
        info.loop = { line: w.line, header: `WHILE ${w.condition}`, variable: '', from: '', to: w.condition };
        // The loop that never ends is the thing to look at: its header, not whichever body line happened to run last.
        info.line = w.line;
        info.lineText = lineAt(source, w.line);
        info.expression = `WHILE ${w.condition}`;
        Object.assign(info, span(info.lineText, w.condition));
        info.expression = w.condition;
      }
      break;
    }

    case 'KEY_ERROR': {
      info.subject = read.name;
      break;
    }

    default:
      break;
  }

  if (info.expression === null && text) {
    info.expression = text.trim() || null;
    Object.assign(info, span(text, info.expression));
  }
  return { info, ghost };
}

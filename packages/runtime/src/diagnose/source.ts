import type { EnclosingLoop, EvaluatedExpression, Scalar } from './types';

/**
 * Reading a program's source and evaluating its small expressions against the
 * values a run had. Used to say *which part* of a line was the problem and
 * what its parts were worth, not just that the line failed.
 */

export function sourceLines(source: string | undefined): string[] {
  return source ? source.split(/\r?\n/) : [];
}

export function lineAt(source: string | undefined, line: number | null): string | null {
  if (!source || line === null || line < 1) return null;
  const text = sourceLines(source)[line - 1];
  return text === undefined ? null : text;
}

/** Text with comments and string contents blanked out (same length), so scans never trip on them. */
export function maskLine(text: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      out += c === quote ? c : ' ';
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      out += c;
    } else if (c === '#' || (c === '/' && text[i + 1] === '/')) {
      out += ' '.repeat(text.length - i);
      break;
    } else {
      out += c;
    }
  }
  return out;
}

export interface Access {
  /** `arr[i + 1]` */
  text: string;
  /** 0-based offset of `arr` in the line, and the length of the whole access. */
  start: number;
  length: number;
  /** `i + 1` */
  index: string;
}

/** Every `name[...]` in a line, with its bracketed expression (brackets matched, strings and comments ignored). */
export function findAccesses(line: string, name?: string): Access[] {
  const masked = maskLine(line);
  const out: Access[] = [];
  const re = /([A-Za-z_]\w*)\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    if (name && m[1] !== name) continue;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < masked.length; i++) {
      if (masked[i] === '[') depth++;
      else if (masked[i] === ']' && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close < 0) continue;
    out.push({ text: line.slice(m.index, close + 1), start: m.index, length: close + 1 - m.index, index: line.slice(open + 1, close).trim() });
  }
  return out;
}

// ── Expression evaluation ──────────────────────────────────────────────────

export interface EvalEnv {
  vars: Record<string, Scalar>;
  /** Number of elements per structure name, for `LENGTH(arr)`. */
  lengths: Record<string, number>;
}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(text: string): Tok[] | null {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(<=|>=|==|!=|[-+*/%()<>=,]))/y;
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) return /^\s*$/.test(text.slice(pos)) ? out : null;
    pos = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
  }
  return out;
}

class Unresolved extends Error {}

/**
 * Evaluates an AQVL arithmetic / comparison expression (numbers, variables,
 * `LENGTH(x)`, `MAX/MIN/ABS`, `+ - * / %`, comparisons, `AND OR NOT`) against
 * `env`. Returns undefined when any part cannot be resolved: this reads
 * values, it never guesses them.
 */
export function evaluate(text: string, env: EvalEnv): number | boolean | undefined {
  const toks = tokenize(text);
  if (!toks || toks.length === 0) return undefined;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const isWord = (v: string) => peek()?.t === 'id' && (peek() as { v: string }).v.toUpperCase() === v;

  const num = (x: unknown): number => {
    if (typeof x === 'number') return x;
    if (typeof x === 'boolean') return x ? 1 : 0;
    throw new Unresolved();
  };

  const parseOr = (): number | boolean => {
    let l = parseAnd();
    while (isWord('OR')) {
      p++;
      const r = parseAnd();
      l = Boolean(l) || Boolean(r);
    }
    return l;
  };
  const parseAnd = (): number | boolean => {
    let l = parseNot();
    while (isWord('AND')) {
      p++;
      const r = parseNot();
      l = Boolean(l) && Boolean(r);
    }
    return l;
  };
  const parseNot = (): number | boolean => {
    if (isWord('NOT')) {
      p++;
      return !parseNot();
    }
    return parseCmp();
  };
  const parseCmp = (): number | boolean => {
    const l = parseSum();
    const t = peek();
    if (t?.t === 'op' && ['<', '>', '<=', '>=', '==', '!=', '='].includes(t.v)) {
      p++;
      const r = parseSum();
      const a = num(l);
      const b = num(r);
      switch (t.v) {
        case '<': return a < b;
        case '>': return a > b;
        case '<=': return a <= b;
        case '>=': return a >= b;
        case '!=': return a !== b;
        default: return a === b;
      }
    }
    return l;
  };
  const parseSum = (): number | boolean => {
    let l = parseProd();
    while (isOp('+') || isOp('-')) {
      const op = (peek() as { v: string }).v;
      p++;
      const r = parseProd();
      l = op === '+' ? num(l) + num(r) : num(l) - num(r);
    }
    return l;
  };
  const parseProd = (): number | boolean => {
    let l = parseUnary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = (peek() as { v: string }).v;
      p++;
      const r = parseUnary();
      if ((op === '/' || op === '%') && num(r) === 0) throw new Unresolved();
      l = op === '*' ? num(l) * num(r) : op === '/' ? num(l) / num(r) : num(l) % num(r);
    }
    return l;
  };
  const parseUnary = (): number | boolean => {
    if (isOp('-')) {
      p++;
      return -num(parseUnary());
    }
    return parseAtom();
  };
  const parseAtom = (): number | boolean => {
    const t = toks[p++];
    if (!t) throw new Unresolved();
    if (t.t === 'num') return t.v;
    if (t.t === 'op') {
      if (t.v !== '(') throw new Unresolved();
      const v = parseOr();
      if (!isOp(')')) throw new Unresolved();
      p++;
      return v;
    }
    const upper = t.v.toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    if (isOp('(')) {
      p++;
      const args: (number | boolean)[] = [];
      if (!isOp(')')) {
        if (upper === 'LENGTH') {
          const id = toks[p++];
          if (!id || id.t !== 'id') throw new Unresolved();
          if (!isOp(')')) throw new Unresolved();
          p++;
          const n = env.lengths[id.v];
          if (typeof n !== 'number') throw new Unresolved();
          return n;
        }
        args.push(parseOr());
        while (isOp(',')) {
          p++;
          args.push(parseOr());
        }
      }
      if (!isOp(')')) throw new Unresolved();
      p++;
      if (upper === 'MAX' && args.length === 2) return Math.max(num(args[0]), num(args[1]));
      if (upper === 'MIN' && args.length === 2) return Math.min(num(args[0]), num(args[1]));
      if (upper === 'ABS' && args.length === 1) return Math.abs(num(args[0]));
      throw new Unresolved();
    }
    const v = env.vars[t.v];
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    throw new Unresolved();
  };

  try {
    const v = parseOr();
    return p === toks.length ? v : undefined;
  } catch (e) {
    if (e instanceof Unresolved) return undefined;
    throw e;
  }
}

/** Identifiers an expression names that `vars` knows (excluding keywords / function names). */
export function variablesIn(text: string, vars: Record<string, Scalar>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maskLine(text).matchAll(/[A-Za-z_]\w*/g)) {
    const v = vars[m[0]];
    if (typeof v === 'number') out[m[0]] = v;
  }
  return out;
}

export function evaluateExpression(text: string, env: EvalEnv): EvaluatedExpression | undefined {
  const value = evaluate(text, env);
  if (typeof value !== 'number') return undefined;
  return { text: text.trim(), value, parts: variablesIn(text, env.vars) };
}

// ── Block structure ────────────────────────────────────────────────────────

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** Lines (1-based) of the blocks enclosing `line`, nearest first, found by indentation. */
export function enclosingHeaders(lines: string[], line: number): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let indent = indentOf(lines[line - 1] ?? '');
  for (let i = line - 2; i >= 0 && indent > 0; i--) {
    const text = lines[i];
    if (!text.trim() || /^\s*(#|\/\/)/.test(text)) continue;
    const ind = indentOf(text);
    if (ind < indent) {
      out.push({ line: i + 1, text: text.trim() });
      indent = ind;
    }
  }
  return out;
}

/** `LOOP i FROM a TO b` headers around `line`, nearest first. */
export function enclosingLoops(source: string | undefined, line: number | null, env: EvalEnv): EnclosingLoop[] {
  if (!source || line === null) return [];
  const lines = sourceLines(source);
  const out: EnclosingLoop[] = [];
  for (const h of enclosingHeaders(lines, line)) {
    const m = /^LOOP\s+([A-Za-z_]\w*)\s+FROM\s+(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+.+)?\s*$/i.exec(h.text);
    if (!m) continue;
    const to = evaluate(m[3], env);
    out.push({ line: h.line, header: h.text, variable: m[1], from: m[2], to: m[3], toValue: typeof to === 'number' ? to : undefined });
  }
  return out;
}

/** `WHILE cond` header around `line`, nearest first. */
export function enclosingWhile(source: string | undefined, line: number | null): { line: number; condition: string; bodyStart: number; bodyEnd: number } | null {
  if (!source || line === null) return null;
  const lines = sourceLines(source);
  for (const h of enclosingHeaders(lines, line)) {
    const m = /^WHILE\s+(.+?)\s*$/i.exec(h.text);
    if (!m) continue;
    const ind = indentOf(lines[h.line - 1]);
    let end = h.line;
    for (let i = h.line; i < lines.length; i++) {
      if (lines[i].trim() && indentOf(lines[i]) <= ind) break;
      end = i + 1;
    }
    return { line: h.line, condition: m[1], bodyStart: h.line + 1, bodyEnd: end };
  }
  return null;
}

/** Does any of lines [from, to] assign `name` (`name = ...`)? */
export function assignsIn(source: string, name: string, from: number, to: number): boolean {
  const lines = sourceLines(source);
  const re = new RegExp(`^\\s*${name}\\s*=(?!=)`);
  for (let i = from - 1; i < to && i < lines.length; i++) if (re.test(maskLine(lines[i]))) return true;
  return false;
}

// ── Small text helpers ─────────────────────────────────────────────────────

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** The closest of `candidates` to `word` when it is plausibly a typo of it (distance 1-2 for longer words). */
export function closestWord(word: string, candidates: Iterable<string>): string | null {
  const w = word.toUpperCase();
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(w, c.toUpperCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const limit = w.length <= 3 ? 1 : 2;
  return best !== null && bestD > 0 && bestD <= limit ? best : null;
}

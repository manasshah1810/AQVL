import type { ErrorInfo, ErrorKind, RawCompileError } from './types';
import { KIND_NAME } from './runtime';
import { closestWord, lineAt, maskLine, sourceLines } from './source';

/** Words that can start a statement or a declaration, for "did you mean" on a misspelt keyword. */
const STATEMENT_WORDS = [
  'SCENE', 'DECLARE', 'SEQUENCE', 'END', 'ELSE', 'IF', 'WHILE', 'LOOP', 'FUNCTION', 'RETURN',
  'HIGHLIGHT', 'COMPARE', 'SWAP', 'INSERT', 'DELETE', 'UPDATE', 'PRINT', 'WAIT',
  'PUSH', 'POP', 'PEEK', 'ENQUEUE', 'DEQUEUE', 'CLEAR', 'SET', 'LAYOUT', 'CAMERA', 'POSITION',
  'ARRAY', 'STACK', 'QUEUE', 'HEAP', 'GRAPH', 'LINKEDLIST', 'TREE', 'BST', 'HASH_MAP', 'TRIE',
  'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 'ADD_VERTEX', 'ADD_EDGE', 'HEAPIFY',
  'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT',
  'DFS', 'BFS', 'DIJKSTRA', 'TRAVERSE', 'SEARCH', 'MARK', 'VISIT', 'FREE', 'CONNECT', 'DISCONNECT',
];
const KNOWN = new Set(STATEMENT_WORDS);

const CLOSERS: Record<string, string> = { ']': '[', ')': '(', '}': '{' };
const OPENERS: Record<string, string> = { '[': ']', '(': ')', '{': '}' };

interface Opener {
  char: string;
  line: number;
  column: number;
}

/** Brackets that were opened and never closed, innermost last. */
export function unmatchedOpeners(source: string): Opener[] {
  const stack: Opener[] = [];
  sourceLines(source).forEach((raw, i) => {
    const text = maskLine(raw);
    for (let c = 0; c < text.length; c++) {
      const ch = text[c];
      if (OPENERS[ch]) stack.push({ char: ch, line: i + 1, column: c + 1 });
      else if (CLOSERS[ch] && stack.length && stack[stack.length - 1].char === CLOSERS[ch]) stack.pop();
    }
  });
  return stack;
}

/** Declared structure / variable-ish names: the word after a DECLARE type, e.g. `arr` in `ARRAY arr = [...]`. */
function declaredNames(source: string): string[] {
  const names: string[] = [];
  for (const line of sourceLines(source)) {
    const m = /^\s*(?:ARRAY|STACK|QUEUE|HEAP|GRAPH|LINKEDLIST|TREE|BST|HASH_MAP|HASHMAP|TRIE|BINARY_TREE)\s+([A-Za-z_]\w*)/i.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

const OPEN_ENDED = /(?:[-+*/%,(=<>]|\b(?:TO|FROM|AND|OR|NOT|STEP|AS|AT|INTO)|\bIF|\bWHILE)\s*$/i;

function previousCodeLine(source: string, line: number): number | null {
  const lines = sourceLines(source);
  for (let i = line - 2; i >= 0; i--) {
    const t = maskLine(lines[i]).trim();
    if (t) return i + 1;
  }
  return null;
}

function firstWordOf(text: string): string | null {
  return /^\s*([A-Za-z_]\w*)/.exec(text)?.[1] ?? null;
}

/**
 * Describes a compile-time error (lexer, parser, or the semantic checks) as
 * the same `ErrorInfo` a runtime error gets. The compiler reports where it
 * *noticed* the problem; this works out where it *is*: an unclosed bracket is
 * blamed on the line that opened it, a statement that stops mid-way on the
 * line it stopped on, and a misspelt keyword on the word itself.
 */
export function diagnoseCompileError(raw: RawCompileError, source: string): ErrorInfo {
  const message = raw.message.replace(/^Semantic Validation Failed:\s*/i, '').trim();
  const got = /^(.*?)[\s,]*[Gg]ot "(.*)"\.?\s*$/s.exec(message);
  const expectedWhat = got ? got[1].replace(/^Expected\s+/i, '').replace(/\.$/, '') : /^Expected (.*?)[.,]/.exec(message)?.[1];
  const found = got?.[2] ?? /Unexpected token "([^"]*)"/.exec(message)?.[1];

  let type: ErrorKind = 'SYNTAX_ERROR';
  let line = raw.line;
  let column = raw.column;
  let expression: string | null = null;
  let noticedAtLine: number | undefined;
  let subject: string | undefined;
  let suggestion = raw.suggestion;

  const reportedText = lineAt(source, raw.line);
  const expectedChar = /^"([\]\)\}])"/.exec(expectedWhat ?? '')?.[1];

  // Semantic checks (undeclared names, wrong argument counts, ...).
  const undeclared = /Undeclared (?:identifier|variable) ['"]([^'"]+)['"](?:\.\s*Did you mean ['"]?([^'"?]+)['"]?\?)?/i.exec(message);
  const undeclaredFn = /(?:undeclared|undefined) function ['"]([^'"]+)['"]/i.exec(message);
  const outOfBounds = raw.name === 'OutOfBoundsError' ? /of "([^"]+)" \(length (\d+)\)/.exec(message) : null;

  if (undeclared || undeclaredFn || (outOfBounds && !declaredNames(source).includes(outOfBounds[1]))) {
    type = 'UNDEFINED_NAME';
    subject = undeclared?.[1] ?? undeclaredFn?.[1] ?? outOfBounds?.[1];
    suggestion ??= undeclared?.[2]?.trim() ?? (subject ? closestWord(subject, declaredNames(source)) ?? undefined : undefined);
    if (undeclaredFn) suggestion = undefined;
    expression = subject ?? null;
    // A word that starts a statement and is one letter off a keyword is a typo of that keyword, not a missing variable.
    const nearKeyword = subject && firstWordOf(reportedText ?? '') === subject ? closestWord(subject, KNOWN) : null;
    if (nearKeyword && !KNOWN.has(subject!.toUpperCase())) {
      type = 'UNKNOWN_KEYWORD';
      suggestion = nearKeyword;
    }
  } else if (raw.stage === 'Semantic' || /^(Duplicate|Function ".*" expects|RETURN used outside|Type mismatch)/i.test(message) || ['DuplicateDeclarationError', 'WrongArgumentCountError', 'ReturnOutsideFunctionError', 'TypeMismatchError'].includes(raw.name)) {
    type = 'SEMANTIC_ERROR';
  } else if (expectedChar) {
    // A closing bracket the parser waited for and never saw: the mistake is where the bracket was opened.
    type = 'MISSING_DELIMITER';
    const open = [...unmatchedOpeners(source)].reverse().find((o) => OPENERS[o.char] === expectedChar) ?? unmatchedOpeners(source).pop();
    if (open) {
      noticedAtLine = raw.line ?? undefined;
      line = open.line;
      column = open.column;
      subject = open.char;
      expression = (lineAt(source, open.line) ?? '').slice(open.column - 1).trim() || null;
    }
    suggestion ??= `Add a closing "${expectedChar}".`;
  } else if (raw.name === 'ParseError' || raw.name === 'AQVLSyntaxError') {
    const prev = raw.line !== null && raw.line > 1 ? previousCodeLine(source, raw.line) : null;
    const prevText = prev !== null ? lineAt(source, prev) : null;
    const startsLine = reportedText !== null && /^\s*\S/.test(reportedText) && (raw.column ?? 1) <= (reportedText.length - reportedText.trimStart().length) + 1;
    const wantsExpression = /expression|operand|value/i.test(expectedWhat ?? '');
    if (startsLine && prev !== null && prevText !== null && (OPEN_ENDED.test(maskLine(prevText)) || wantsExpression)) {
      // The statement above stopped halfway: the next line is only where the parser gave up.
      type = 'INCOMPLETE_STATEMENT';
      line = prev;
      column = prevText.trimEnd().length;
      expression = prevText.trim();
      noticedAtLine = raw.line ?? undefined;
    } else if (found && /^[A-Za-z_]\w*$/.test(found)) {
      const near = closestWord(found, KNOWN);
      if (near && !KNOWN.has(found.toUpperCase())) {
        type = 'UNKNOWN_KEYWORD';
        suggestion ??= near;
        subject = found;
        expression = found;
      }
    }
  } else if (raw.name === 'TokenError') {
    type = 'SYNTAX_ERROR';
  }

  // A misspelt statement word is reported by the parser as something else entirely; spot it by the word itself.
  if (type === 'SYNTAX_ERROR' && reportedText) {
    const w = firstWordOf(reportedText);
    if (w && !KNOWN.has(w.toUpperCase()) && !/^\s*[A-Za-z_]\w*\s*(=|\[|\.)/.test(reportedText) && !/^\s*[A-Za-z_]\w*\s*$/.test(reportedText)) {
      const near = closestWord(w, KNOWN);
      if (near) {
        type = 'UNKNOWN_KEYWORD';
        suggestion ??= near;
        subject = w;
        expression = w;
      }
    }
  }

  const text = lineAt(source, line);
  if (expression === null && text) {
    // The offending token on the line, or the line itself.
    const tokenCol = found && text.indexOf(found) >= 0 ? text.indexOf(found) + 1 : undefined;
    if (tokenCol && found) {
      expression = found;
      column = column ?? tokenCol;
    } else {
      expression = text.trim() || null;
    }
  }
  let length: number | undefined;
  if (text && expression && type !== 'MISSING_DELIMITER') {
    const at = text.indexOf(expression);
    if (at >= 0) {
      column = at + 1;
      length = expression.length;
    }
  } else if (type === 'MISSING_DELIMITER') {
    length = 1;
  }

  const info: ErrorInfo = {
    type,
    phase: 'syntax',
    severity: 'error',
    confidence: 'certain',
    name: KIND_NAME[type],
    line,
    column,
    length,
    lineText: text,
    expression,
    message,
    frameIndex: null,
    variables: {},
  };
  if (subject) info.subject = subject;
  if (suggestion) info.suggestion = suggestion;
  if (expectedWhat) info.expected = expectedWhat;
  if (found) info.found = found;
  if (noticedAtLine !== undefined) info.noticedAtLine = noticedAtLine;
  if (type === 'UNDEFINED_NAME' && outOfBounds) info.structure = { name: outOfBounds[1], kind: 'ARRAY', size: Number(outOfBounds[2]) };
  return info;
}

import type { Input, InputValue, Kernel } from './types';

/**
 * Turning a kernel into the program text a mode shows, and into the program
 * that is run for one test. Everything here is plain text work on the
 * kernel's solution, so a mode can never drift from the algorithm it teaches.
 */

const SLOT = /\{\{(\w+)\}\}/g;
const BLANK = /\[\[([\s\S]*?)\]\]/g;
/** What a gap looks like in the code the learner reads. */
export const GAP = '___';

/** An input value written as an AQVL literal: `[5, 2, 9]`, `"A"`, `NULL`, `{a: 1}`. */
export function literal(v: InputValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return `"${v}"`;
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  const entries = Object.entries(v).map(([k, val]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : `"${k}"`}: ${literal(val)}`);
  return `{${entries.join(', ')}}`;
}

/** Puts a test's input into every `{{slot}}`. */
export function fillSlots(template: string, input: Input): string {
  return template.replace(SLOT, (_, name: string) => {
    if (!(name in input)) throw new Error(`No input value for {{${name}}}`);
    return literal(input[name]);
  });
}

/** The right answer of each `[[...]]`, in order. */
export function blankAnswers(kernel: Kernel): string[] {
  return [...kernel.source.matchAll(BLANK)].map((m) => m[1]);
}

/** The solution with its blanks filled by `answers` (by default, the right ones). Slots are left in place. */
export function withBlanks(kernel: Kernel, answers?: string[]): string {
  let i = 0;
  return kernel.source.replace(BLANK, (_, right: string) => {
    const pick = answers?.[i];
    i++;
    return pick ?? right;
  });
}

/** The solution template (slots in place, no blank markers). */
export function solutionTemplate(kernel: Kernel): string {
  return withBlanks(kernel);
}

/** The solution template with each blank shown as `___` (for display). */
export function gappedTemplate(kernel: Kernel): string {
  return kernel.source.replace(BLANK, GAP);
}

/** The program with the kernel's bug in it (slots in place). */
export function buggyTemplate(kernel: Kernel): string {
  const sol = solutionTemplate(kernel);
  const at = sol.indexOf(kernel.bug.find);
  if (at < 0 || sol.indexOf(kernel.bug.find, at + 1) >= 0) throw new Error(`${kernel.id}: the bug's text must appear exactly once`);
  return sol.slice(0, at) + kernel.bug.replace + sol.slice(at + kernel.bug.find.length);
}

/** 0-based line of the buggy text in the buggy program. */
export function bugLine(kernel: Kernel): number {
  const sol = solutionTemplate(kernel);
  return sol.slice(0, sol.indexOf(kernel.bug.find)).split('\n').length - 1;
}

/** The buggy program with the bug's text replaced by `fix`. */
export function fixedTemplate(kernel: Kernel, fix: string): string {
  const buggy = buggyTemplate(kernel);
  const at = solutionTemplate(kernel).indexOf(kernel.bug.find);
  return buggy.slice(0, at) + fix + buggy.slice(at + kernel.bug.replace.length);
}

export interface CoreSplit {
  /** Lines before the core (with slots). */
  before: string[];
  /** The core's lines, as written in the solution (indented). */
  core: string[];
  after: string[];
  /** Indentation of the core's first line. */
  indent: string;
}

/** The solution cut around its core region. */
export function splitCore(kernel: Kernel): CoreSplit {
  const lines = solutionTemplate(kernel).split('\n');
  const start = lines.findIndex((l) => l.trim() === kernel.core.first);
  const indent = start >= 0 ? (lines[start].match(/^\s*/)?.[0] ?? '') : '';
  // The region ends at the first line after its start that reads `last` at the start's own depth
  // (so a region that ends with a block's END closes that block, not the scene).
  let end = -1;
  let seen = 0;
  for (let i = start; i < lines.length && start >= 0; i++) {
    if (lines[i].trim() === kernel.core.last && (lines[i].match(/^\s*/)?.[0] ?? '') === indent && ++seen === (kernel.core.nth ?? 1)) {
      end = i;
      break;
    }
  }
  if (start < 0 || end < start) throw new Error(`${kernel.id}: core region not found`);
  return {
    before: lines.slice(0, start),
    core: lines.slice(start, end + 1),
    after: lines.slice(end + 1),
    indent,
  };
}

/** The program with `coreText` in place of the core region. */
export function withCore(kernel: Kernel, coreText: string): string {
  const { before, after } = splitCore(kernel);
  return [...before, ...coreText.replace(/\s+$/, '').split('\n'), ...after].join('\n');
}

const OPENS = /^(IF|WHILE|LOOP|FUNCTION)\b/i;
const CLOSES = /^END\b/i;
const MIDDLE = /^ELSE\b/i;

/**
 * Indentation for a list of statements, from the blocks they open and close:
 * `LOOP` / `WHILE` / `IF` / `FUNCTION` indent what follows, `ELSE` sits level
 * with its `IF`, `END` closes. AQVL ignores whitespace, so this is only for
 * reading, but it shows at once whether a body landed inside its block.
 */
export function indentLines(lines: string[], base = ''): string[] {
  let depth = 0;
  return lines.map((raw) => {
    const line = raw.trim();
    if (CLOSES.test(line) || MIDDLE.test(line)) depth = Math.max(0, depth - 1);
    const out = `${base}${'  '.repeat(depth)}${line}`;
    // A brace block on one line (`IF x { RETURN 1 }`) opens and closes itself.
    const selfClosed = line.includes('{') && line.trim().endsWith('}');
    if ((OPENS.test(line) && !selfClosed) || MIDDLE.test(line)) depth++;
    return out;
  });
}

/** A seeded shuffle that never returns the original order (when there is more than one distinct line). */
export function shuffleLines(lines: string[], seed: string): string[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const out = [...lines];
  const distinct = new Set(lines.map((l) => l.trim())).size > 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (!distinct || out.some((l, i) => l.trim() !== lines[i].trim())) break;
  }
  return out;
}

/** The same shuffle, for any list (options of a blank). */
export function shuffled<T>(items: T[], seed: string): T[] {
  const keyed = items.map((item, i) => ({ item, key: String(i) }));
  const order = shuffleLines(keyed.map((k) => k.key), seed);
  return order.map((k) => keyed[Number(k)].item);
}

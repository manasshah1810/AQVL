/**
 * Error diagnosis: what went wrong in a program, described as data.
 *
 * An `ErrorInfo` is built from the run itself (the thrown error, the source
 * line it came from, the variables and structures at that moment). It holds
 * facts, not sentences; `teach.ts` turns the facts into a lesson, and the
 * app's presentation layer turns the lesson into a panel, a 3D marker and a
 * voice. Nothing here knows about any theme.
 */

export type ErrorPhase = 'syntax' | 'runtime' | 'logic';

export type ErrorKind =
  // Runtime
  | 'INDEX_ERROR'
  | 'EMPTY_STRUCTURE'
  | 'NULL_ACCESS'
  | 'UNDEFINED_NAME'
  | 'DIVISION_BY_ZERO'
  | 'KEY_ERROR'
  | 'TYPE_ERROR'
  | 'INFINITE_LOOP'
  | 'RECURSION_LIMIT'
  | 'RUNTIME_ERROR'
  // Before the program runs
  | 'SYNTAX_ERROR'
  | 'MISSING_DELIMITER'
  | 'INCOMPLETE_STATEMENT'
  | 'UNKNOWN_KEYWORD'
  | 'SEMANTIC_ERROR'
  // Logic: the program runs, but something it does cannot be right
  | 'SELF_COMPARISON'
  | 'UNSORTED_RESULT';

export type Scalar = number | string | boolean;

/** How sure AQVL is that this is a mistake (`certain`: the run could not continue; `high`: no valid program does this). */
export type Confidence = 'certain' | 'high';

/** A cell of the structure involved, for the little "valid vs attempted" strip. */
export interface StripCell {
  /** Position in the structure (can lie outside it: the attempted one). */
  index: number;
  /** The value drawn there, when the cell exists. */
  value?: string;
  kind: 'valid' | 'attempted';
}

/** An arithmetic/index expression, with the values its parts had when it ran. */
export interface EvaluatedExpression {
  /** Source text, e.g. `i + 1`. */
  text: string;
  value: number;
  /** Variables the text names, with their values: `{ i: 2 }`. */
  parts: Record<string, number>;
}

/** The loop the failing line sits in, when it matters. */
export interface EnclosingLoop {
  line: number;
  header: string;
  variable: string;
  /** `LENGTH(arr) - 1` */
  to: string;
  /** What `to` was worth when the loop ran (undefined when it could not be worked out). */
  toValue?: number;
  /** `0` */
  from: string;
}

export interface ErrorInfo {
  /** What kind of mistake: the key everything else switches on. */
  type: ErrorKind;
  phase: ErrorPhase;
  severity: 'error' | 'warning';
  confidence: Confidence;
  /** The familiar name: `IndexError`. */
  name: string;
  /** 1-based source line the mistake is on; the editor highlights exactly this line. */
  line: number | null;
  /** 1-based column of the culprit expression within that line, and its length, when known. */
  column?: number;
  length?: number;
  /** The text of the line itself. */
  lineText: string | null;
  /** The culprit within the line: `arr[i + 1]`. */
  expression: string | null;
  /** What the runtime or compiler said, untouched. */
  message: string;
  /** The trace frame that shows the moment (the error frame, or the step a logic issue sits on). */
  frameIndex: number | null;

  // ── Facts (set only when the kind has them) ─────────────────────────────────
  structure?: { name: string; kind: string; size: number };
  /** Index that was asked for. */
  actualIndex?: number;
  /** Lowest and highest valid index, or null when the structure is empty. */
  validRange?: [number, number] | null;
  /** The index expression and what its parts were worth. */
  indexExpression?: EvaluatedExpression;
  loop?: EnclosingLoop;
  /** The operation that failed (`POP`, `DEQUEUE`, `GET`), upper-case. */
  operation?: string;
  /** The pointer / variable / key / function involved. */
  subject?: string;
  /** A member read off a pointer (`value`, `next`). */
  member?: string;
  /** The last source line that gave `subject` its current value. */
  assignedAtLine?: number;
  /** For an empty structure: how many items it received and how many left. */
  added?: number;
  removed?: number;
  /** A suggestion the compiler already computed ("Did you mean ...?"). */
  suggestion?: string;
  /** What the parser expected and what it found instead. */
  expected?: string;
  found?: string;
  /** Where the compiler only *noticed* the problem, when that differs from `line` (which is where it is: an unclosed bracket's opener, an unfinished statement). */
  noticedAtLine?: number;
  /** Variables that change in the condition / that never change inside a loop that does not end. */
  condition?: string;
  frozen?: string[];
  /** Recursion: the call stack at the moment, outermost first, and the function. */
  callStack?: string[];
  /** Logic issues: free-form evidence, already worded as data (counts, values). */
  evidence?: Record<string, Scalar | Scalar[]>;

  /** The variables at that moment (numbers, text, booleans). */
  variables: Record<string, Scalar>;
}

/** What the stage should draw to show the failed access: a cell where the structure has no element. */
export interface ErrorGhost {
  /** `arr[3]` */
  caption: string;
  /** Text on the ghost cell: `3`, `NULL`, `empty`. */
  text: string;
  structure: string;
  /** Offset in slots from the structure's first cell (index 3 → 3, index -1 → -1); null for a spot with no index. */
  slot: number | null;
  /** Where the ghost goes when there is no neighbour to measure from. */
  fallback: 'anchor' | 'after-last';
}

/** The error expressed for the trace: the error frame's extra payload. */
export interface FrameError {
  info: ErrorInfo;
  ghost: ErrorGhost | null;
}

/** An error thrown while the program ran, as captured at the moment it was thrown. */
export interface RawRuntimeError {
  name: string;
  message: string;
  /** Own fields of the error object (`arrayName`, `index`, `length`, ...). */
  fields: Record<string, unknown>;
  line: number | null;
  pc: number | null;
  vars: Record<string, Scalar>;
  callStack: string[];
}

/** A compile-time error as the compiler reports it. */
export interface RawCompileError {
  name: string;
  message: string;
  line: number | null;
  column?: number;
  suggestion?: string;
  /** `Lexer` / `Parser` / `Semantic` / `Function analysis`, if the caller knows. */
  stage?: string;
}

/**
 * Complete the Algorithm: the shapes a challenge is authored in and graded by.
 *
 * One algorithm is authored once, as a Kernel: its solution, the inputs it is
 * tested on, a reference implementation that says what the program must leave
 * behind for any input, and the material each mode needs (blanks, a bug, a core
 * region, hints). Every mode (fill the blank, assemble, spot the bug, write the
 * core, boss round) is derived from that one description, so every algorithm is
 * playable in every mode and the tests are never hand-copied answers.
 */

export type Topic =
  | 'Arrays'
  | 'Sorting'
  | 'Searching'
  | 'Recursion'
  | 'Stacks'
  | 'Queues'
  | 'Linked Lists'
  | 'Trees'
  | 'Graphs'
  | 'Heaps'
  | 'Hash Maps'
  | 'Tries';

export const TOPICS: Topic[] = ['Arrays', 'Sorting', 'Searching', 'Recursion', 'Stacks', 'Queues', 'Linked Lists', 'Trees', 'Graphs', 'Heaps', 'Hash Maps', 'Tries'];

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type Mode = 'blank' | 'order' | 'bug' | 'write' | 'boss';

export const MODES: { id: Mode; letter: string; label: string; blurb: string }[] = [
  { id: 'blank', letter: 'A', label: 'Fill the Blank', blurb: 'A real program with one to three gaps. Pick the right piece for each.' },
  { id: 'order', letter: 'B', label: 'Assemble the Steps', blurb: 'The core lines are shuffled. Put them back in order.' },
  { id: 'bug', letter: 'C', label: 'Spot the Bug', blurb: 'One line is wrong. Watch it misbehave, find the line, pick the fix.' },
  { id: 'write', letter: 'D', label: 'Write the Core', blurb: 'The core is blank. Write it in AQVL; it is graded by running it.' },
  { id: 'boss', letter: 'E', label: 'Boss Round', blurb: 'Fill a blank, fix a bug, then write the core: one algorithm, three stages.' },
];

/** A value an input slot can hold. Arrays may hold NULL (a missing tree child). */
export type InputValue = number | string | boolean | null | InputValue[] | { [key: string]: number | string };

/** One test's input: a value for every `{{slot}}` in the kernel's source. */
export type Input = Record<string, InputValue>;

/** Something the finished program must have left behind. */
export type Expectation =
  /** An ARRAY's cells, or a HEAP's array view, in index order. */
  | { kind: 'array'; name: string; value: (number | string)[] }
  /** A STACK, bottom to top. */
  | { kind: 'stack'; name: string; value: (number | string)[] }
  /** A QUEUE, front to rear. */
  | { kind: 'queue'; name: string; value: (number | string)[] }
  /** A linked list followed from its head along `next` (a circular list stops when it comes back round). */
  | { kind: 'list'; name: string; value: (number | string)[] }
  /** A doubly linked list: the same values forwards along `next` and backwards along `prev`. */
  | { kind: 'dlist'; name: string; value: (number | string)[] }
  /** A binary tree in level order, NULL for a missing child (trailing NULLs dropped). */
  | { kind: 'tree'; name: string; value: (number | null)[] }
  /** A HASH_MAP's entries (key → value, any order). */
  | { kind: 'map'; name: string; value: Record<string, number | string> }
  /** A TRIE's node prefixes (any order; the root is ""). */
  | { kind: 'trie'; name: string; value: string[] }
  /** A variable of the outermost scope. */
  | { kind: 'var'; name: string; value: number | string | boolean };

/** A hidden test: what kind of input it is (shown) and the input (never shown). */
export interface HiddenCase {
  category: string;
  input: Input;
}

/** A gap in Fill the Blank: the wrong options offered beside the right one (`[[...]]` in the source). */
export type BlankOptions = string[];

export interface BugSpec {
  /** Exact text in the solution (once) that the bug replaces. */
  find: string;
  /** What the buggy program has there. */
  replace: string;
  /** Wrong fixes offered beside the right one (each replaces the buggy text). */
  fixes: string[];
  /** What the bug does, shown after it is found. */
  why: string;
}

export interface Kernel {
  id: string;
  title: string;
  topic: Topic;
  difficulty: Difficulty;
  /** The task, in one sentence: "Make this sort the array from smallest to largest." */
  goal: string;
  /**
   * The full solution. `{{slot}}` is replaced by a test's input value (as an
   * AQVL literal), `[[text]]` marks a blank whose right answer is `text`.
   */
  source: string;
  /** Wrong options for each `[[...]]`, in order. */
  blanks: BlankOptions[];
  bug: BugSpec;
  /**
   * The core region, as the exact (trimmed) text of its first and last lines.
   * Assemble shuffles these lines; Write the Core blanks them. The region
   * ends at the `nth` (default first) line reading `last` at the depth of `first`.
   */
  core: { first: string; last: string; nth?: number };
  /** Hint 1 (a conceptual nudge) and hint 2 (a revealed line). Hint 3 is always the full solution. */
  hints: [string, string];
  /** Shown to the learner beside the visible tests: what each input is. */
  inputNote?: string;
  /** About three inputs whose data and results are shown. */
  visible: Input[];
  /** About two edge cases, named by category only. */
  hidden: HiddenCase[];
  /** A tiny input for Preview. */
  preview: Input;
  /** The reference: what the program must leave behind for `input`. */
  expect: (input: Input) => Expectation[];
}

export interface TestCase {
  /** Stable index within the challenge (visible first). */
  index: number;
  input: Input;
  hidden: boolean;
  category?: string;
}

export interface Challenge {
  /** `<kernel id>.<mode>`. */
  id: string;
  kernel: Kernel;
  mode: Mode;
  difficulty: Difficulty;
}

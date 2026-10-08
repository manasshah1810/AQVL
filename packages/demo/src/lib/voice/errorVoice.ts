import type { ErrorKind, ErrorLesson, LessonFacts } from '@aqvl/runtime';
import type { VoiceTheme } from './types';

/**
 * How each narrator tells the same lesson. The lesson (what happened, why,
 * how to fix it) comes from the error engine and is identical in every
 * theme; a narrator only chooses its opening, its transitions, and how it
 * phrases the first sentence. The numbers and names in those sentences are
 * always the lesson's own facts, so every voice stays technically correct.
 */

export type ScriptPart = 'what' | 'why' | 'fix' | 'correct' | 'again';

export interface ScriptSection {
  id: ScriptPart;
  /** What is spoken for this part. */
  text: string;
}

interface Kit {
  /** Opens a runtime error / a logic warning / a syntax error. */
  oops: string;
  hmm: string;
  syntax: string;
  /** Introduces the reason and the fix. */
  why: string;
  fix: string;
  /** Points at the corrected logic on screen. */
  shown: string;
  /** Hands the keyboard back to the learner. */
  again: string;
}

const KITS: Record<VoiceTheme, Kit> = {
  default: {
    oops: '',
    hmm: 'A possible logic problem was found.',
    syntax: 'The program could not be compiled.',
    why: '',
    fix: 'To fix it:',
    shown: 'The corrected logic is shown on screen.',
    again: 'Edit the code, then run it again.',
  },
  panda: {
    oops: 'Oops!',
    hmm: 'Hmm, something looks a little off.',
    syntax: 'Oops! I could not read this part.',
    why: "Here's why.",
    fix: "Let's see how we can fix it.",
    shown: "I've put the corrected logic on screen for you.",
    again: 'Take your time, change the code, and run it again.',
  },
  penguin: {
    oops: 'Whoa!',
    hmm: 'Hold on, something looks fishy.',
    syntax: 'Whoa! I tripped over this line.',
    why: "Here's the scoop.",
    fix: "Let's fix it!",
    shown: 'The right logic is up on screen.',
    again: 'Make your change, then hit run again!',
  },
  rabbit: {
    oops: 'Oops!',
    hmm: 'Hmm, that looks like a wobbly hop.',
    syntax: 'Oops! I got tangled up reading this.',
    why: "Let's see why.",
    fix: "Here's how to hop back on track.",
    shown: 'The corrected logic is shown for you to see.',
    again: 'Fix it up and run it again whenever you are ready.',
  },
};

type Phrase = (f: LessonFacts) => string;
type Voices = Record<VoiceTheme, Phrase>;

const lower = (s: string | undefined) => (s ?? 'it').toLowerCase();

/** Opening sentences by kind. Anything not listed opens with the lesson's own first sentence. */
const OPENING: Partial<Record<ErrorKind, Voices>> = {
  INDEX_ERROR: {
    default: (f) =>
      f.direction === 'empty'
        ? `An index error occurred because the code attempted to read from ${f.structure}, which is empty.`
        : f.direction === 'before-start'
          ? `An index error occurred because the code attempted to access index ${f.index}, but the smallest valid index is 0.`
          : `An index error occurred because the code attempted to access index ${f.index}, while the largest valid index is ${f.last}.`,
    panda: (f) =>
      f.direction === 'empty'
        ? `Oops! ${f.structure} is empty, so there is nothing to read yet.`
        : f.direction === 'before-start'
          ? `Oops! We tried to go back to index ${f.index}, but ${f.structure} starts at index 0.`
          : `Oops! We tried to access index ${f.index}, but ${f.structure} only goes up to index ${f.last}.`,
    penguin: (f) =>
      f.direction === 'empty'
        ? `Whoa! ${f.structure} is empty, so there is nothing to slide to!`
        : f.direction === 'before-start'
          ? `Whoa! Index ${f.index} is off the edge! ${f.structure} starts at index 0.`
          : `Whoa! Index ${f.index} doesn't exist here! ${f.structure} stops at index ${f.last}.`,
    rabbit: (f) => {
      if (f.direction === 'empty') return `Oops! ${f.structure} is an empty burrow, so there is nowhere to hop yet.`;
      if (f.direction === 'before-start') return `Oops! We hopped back before the very first spot. The first valid index is 0, and we asked for ${f.index}.`;
      const over = (f.index ?? 0) - (f.last ?? 0);
      return `Oops! We hopped ${over === 1 ? 'one position' : `${over} positions`} too far. The last valid index is ${f.last}, so we need to stop before going to ${f.index}.`;
    },
  },
  EMPTY_STRUCTURE: {
    default: (f) => `An underflow occurred because the code attempted ${f.operation ?? 'to take an item'} on ${f.structure}, which is empty.`,
    panda: (f) => `Oops! We tried to ${lower(f.operation)} from ${f.structure}, but there is nothing in it.`,
    penguin: (f) => `Whoa! ${f.structure} is empty, so there is nothing to ${lower(f.operation)}!`,
    rabbit: (f) => `Oops! ${f.structure} is an empty basket, so there is nothing to ${lower(f.operation)}.`,
  },
  NULL_ACCESS: {
    default: (f) => `A null pointer error occurred because ${f.subject} is NULL when the code reads from it.`,
    panda: (f) => `Oops! ${f.subject} is pointing at nothing, so we can't look inside it.`,
    penguin: (f) => `Whoa! ${f.subject} points at nothing, and we just tried to follow it!`,
    rabbit: (f) => `Oops! ${f.subject} hopped past the last node, so there is nothing there to read.`,
  },
  DIVISION_BY_ZERO: {
    default: (f) => `A division error occurred because the code divides by ${f.subject}, which is zero.`,
    panda: (f) => `Oops! We tried to divide by ${f.subject}, but ${f.subject} is zero.`,
    penguin: (f) => `Whoa! Dividing by zero? ${f.subject} is zero here!`,
    rabbit: (f) => `Oops! We tried to share things out among zero friends, because ${f.subject} is zero.`,
  },
  UNDEFINED_NAME: {
    default: (f) => `A name error occurred because ${f.problem}.`,
    panda: (f) => `Oops! I don't know what ${f.subject} is yet.`,
    penguin: (f) => `Whoa! Who is ${f.subject}? I haven't met it before!`,
    rabbit: (f) => `Oops! I can't find ${f.subject} anywhere.`,
  },
  INFINITE_LOOP: {
    default: () => 'The program was stopped because a loop never reaches its stopping condition.',
    panda: () => "Oops! We're going round and round, and this loop never stops.",
    penguin: () => "Whoa! We're sliding in circles, and this loop never stops!",
    rabbit: () => "Oops! We keep hopping round the same loop and never reach the end.",
  },
};

const withLine = (text: string, line: number | null, lesson: ErrorLesson) =>
  line !== null && lesson.phase !== 'syntax' && !/\bline \d+/i.test(text) ? `${text} This is on line ${line}.` : text;

function opening(lesson: ErrorLesson, theme: VoiceTheme): string {
  const kit = KITS[theme];
  const custom = OPENING[lesson.type]?.[theme];
  if (custom) return withLine(custom(lesson.facts), lesson.line, lesson);
  const lead = lesson.phase === 'logic' ? kit.hmm : lesson.phase === 'syntax' ? kit.syntax : kit.oops;
  return [lead, lesson.what].filter(Boolean).join(' ');
}

/**
 * The narration of a lesson as ordered parts: what happened, why, how to
 * fix it, the corrected logic (when there is one), and the hand-back. The
 * panel highlights the part being spoken, so reading and listening stay in step.
 */
export function errorScript(lesson: ErrorLesson, theme: VoiceTheme): ScriptSection[] {
  const kit = KITS[theme];
  const sections: ScriptSection[] = [
    { id: 'what', text: opening(lesson, theme) },
    { id: 'why', text: [kit.why, lesson.why].filter(Boolean).join(' ') },
    { id: 'fix', text: [kit.fix, lesson.fix].filter(Boolean).join(' ') },
  ];
  if (lesson.correct) sections.push({ id: 'correct', text: kit.shown });
  sections.push({ id: 'again', text: kit.again });
  return sections;
}

/** The whole script as one string (for tests and for a single utterance). */
export function errorScriptText(lesson: ErrorLesson, theme: VoiceTheme): string {
  return errorScript(lesson, theme)
    .map((s) => s.text)
    .join(' ');
}

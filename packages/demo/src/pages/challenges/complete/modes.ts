import { CATALOGUE } from './catalogue';
import { splitCore } from './program';
import { MODES, TOPICS, type Challenge, type Difficulty, type Kernel, type Mode, type Topic } from './types';

/**
 * Every kernel is playable in every mode. A challenge's difficulty is the
 * algorithm's, raised by how much the mode asks the learner to produce.
 */
const LEVEL: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
const MODE_WEIGHT: Record<Mode, number> = { blank: 0, order: 0, bug: 1, write: 1, boss: 2 };
const BY_LEVEL: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export function difficultyOf(kernel: Kernel, mode: Mode): Difficulty {
  return BY_LEVEL[Math.min(2, LEVEL[kernel.difficulty] + MODE_WEIGHT[mode])];
}

export function challengeOf(kernel: Kernel, mode: Mode): Challenge {
  return { id: `${kernel.id}.${mode}`, kernel, mode, difficulty: difficultyOf(kernel, mode) };
}

export const CHALLENGES: Challenge[] = CATALOGUE.flatMap((k) => MODES.map((m) => challengeOf(k, m.id)));

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function kernelsByTopic(): { topic: Topic; kernels: Kernel[] }[] {
  return TOPICS.map((topic) => ({ topic, kernels: CATALOGUE.filter((k) => k.topic === topic) })).filter((g) => g.kernels.length > 0);
}

/** The editor's starting text in Write the Core: the goal and a nudge, as comments, at the core's indentation. */
export function writeScaffold(kernel: Kernel): string {
  const { indent } = splitCore(kernel);
  const comment = (text: string) => wrap(text, 58).map((l) => `${indent}// ${l}`);
  return [...comment(`Write the core here. ${kernel.goal}`), ...comment(kernel.hints[0]), indent].join('\n');
}

/** Words of `text` in lines of at most `width` characters. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** The stages of a Boss Round, in order. */
export const BOSS_STAGES: { mode: Exclude<Mode, 'boss' | 'order'>; title: string }[] = [
  { mode: 'blank', title: 'Fill the blanks' },
  { mode: 'bug', title: 'Fix the bug' },
  { mode: 'write', title: 'Write the core' },
];

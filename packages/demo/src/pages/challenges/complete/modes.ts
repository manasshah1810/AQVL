import { CATALOGUE } from './catalogue';
import { pointsFor, type ChallengeProgress } from './progress';
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

/** The same algorithm in its other modes, in mode order. */
export function siblingsOf(challenge: Challenge): Challenge[] {
  return MODES.map((m) => getChallenge(`${challenge.kernel.id}.${m.id}`)!);
}

/** The challenge before and after this one in the hub's order (algorithm by algorithm, mode by mode). */
export function neighboursOf(challenge: Challenge): { prev: Challenge | null; next: Challenge | null } {
  const i = CHALLENGES.findIndex((c) => c.id === challenge.id);
  return { prev: CHALLENGES[i - 1] ?? null, next: CHALLENGES[i + 1] ?? null };
}

/** The next challenge after this one (wrapping round) that has not been solved yet, if any is left. */
export function nextUnsolved(after: Challenge | null, progress: Record<string, ChallengeProgress>): Challenge | null {
  const start = after ? CHALLENGES.findIndex((c) => c.id === after.id) + 1 : 0;
  for (let k = 0; k < CHALLENGES.length; k++) {
    const c = CHALLENGES[(start + k) % CHALLENGES.length];
    if (c.id !== after?.id && !(progress[c.id]?.stars > 0)) return c;
  }
  return null;
}

/** Points for a challenge's best result (older saves kept only stars, so those are worked out). */
export function bestPoints(challenge: Challenge, p: ChallengeProgress | undefined): number {
  if (!p) return 0;
  return Math.max(p.points, pointsFor(challenge.difficulty, p.stars));
}

export interface ScoreSummary {
  points: number;
  stars: number;
  solved: number;
  total: number;
  /** Most points the catalogue can give. */
  maxPoints: number;
}

export function scoreOf(progress: Record<string, ChallengeProgress>): ScoreSummary {
  let points = 0;
  let stars = 0;
  let solved = 0;
  let maxPoints = 0;
  for (const c of CHALLENGES) {
    const p = progress[c.id];
    maxPoints += pointsFor(c.difficulty, 3);
    if (!p) continue;
    points += bestPoints(c, p);
    stars += p.stars;
    if (p.stars > 0) solved++;
  }
  return { points, stars, solved, total: CHALLENGES.length, maxPoints };
}

/** Lower-cased words a challenge can be found by: its title, topic, mode, difficulty, goal and id. */
const SEARCH_TEXT = new Map(CHALLENGES.map((c) => [c.id, [c.kernel.title, c.kernel.topic, MODES.find((m) => m.id === c.mode)!.label, c.difficulty, c.kernel.goal, c.kernel.id].join(' ').toLowerCase()]));

/** True when every word of `query` appears in the challenge's searchable text. */
export function matchesQuery(challenge: Challenge, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = SEARCH_TEXT.get(challenge.id) ?? '';
  return words.every((w) => text.includes(w));
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

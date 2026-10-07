import type { Persona } from '../idle';
import type { PandaOptions, PandaPersonality } from './rigs';

/**
 * Who lives in the grove besides the crew: three students and nine characters, each with a look
 * and a routine of its own (see `Persona` in idle.ts for what a routine is made of).
 */

export interface Member {
  name: string;
  role: 'student' | 'resident';
  scale: number;
  personality: PandaPersonality;
  prop?: 'bamboo' | 'leaf';
  bag?: string;
  book?: string;
  glasses?: boolean | 'big';
  lamp?: boolean;
  /** What sets it apart (see PandaOptions), and what it is like (see Persona). */
  look?: Partial<PandaOptions>;
  persona: Persona;
}

const P = (size: number, sway: number, tempo: number, bounce: number, blink: number, plump: number, headSize: number, ear: number): PandaPersonality => ({ size, sway, tempo, bounce, blink, plump, headSize, ear });

export const MEMBERS: Member[] = [
  // The students: young, quick, a little bouncy, each with its own backpack and book.
  { name: 'Lin', role: 'student', scale: 1.14, bag: '#d4553f', book: '#2f6db5', personality: P(1.0, 1.15, 1.12, 1.2, 3.6, 0.96, 1.1, 1.2), persona: { bag: true, social: 0.9 } },
  { name: 'Tao', role: 'student', scale: 1.08, bag: '#3d7cc0', book: '#e0a43a', glasses: true, personality: P(1.0, 0.9, 1.0, 0.95, 4.8, 1.02, 1.08, 0.9), persona: { bag: true, social: 0.9, likes: { adjust: 1.2 } } },
  { name: 'Yuki', role: 'student', scale: 1.02, bag: '#e3b43a', book: '#8a4fb0', personality: P(1.0, 1.3, 1.22, 1.35, 3.1, 0.94, 1.12, 1.4), persona: { bag: true, social: 0.9 } },
  // Yash: muscular. The gym is his life (the yard, the bar, the log, the barbell), and a nap after.
  {
    name: 'Yash',
    role: 'resident',
    scale: 1.32,
    look: { bulk: 1, headband: '#d9402f', barbell: true },
    personality: P(1.04, 0.8, 0.95, 0.9, 4.8, 1.04, 0.96, 0.9),
    persona: { social: 0.5, likes: { workout: 18, play: 0.3, nook: 0.4, camp: 0.4, explore: 0.4, sit: 0.6, wander: 0.5, look: 0.8, roll: 0.3, dance: 0.6, lounge: 0.5, slide: 0.6, swing: 0.5, snack: 0.8, stroll: 0.6 } },
  },
  // Manas: a tech panda, a little lazy and a little chubby, who lives at his laptop with his headset on.
  {
    name: 'Manas',
    role: 'resident',
    scale: 1.22,
    look: { headset: true },
    personality: P(1.0, 0.85, 0.8, 0.7, 4.4, 1.42, 1.02, 0.9),
    persona: { sleepy: 0.45, social: 0.35, likes: { compute: 120, play: 0.2, nook: 0.4, camp: 0.5, wander: 0.4, roll: 0.2, slide: 0.3, swing: 0.3, gym: 0.2, workout: 0.1, dance: 0.3, explore: 0.2, stroll: 0.4, snack: 1.0, sit: 0.8 } },
  },
  // Manan: the musician. Sings and plays the guitar by the fire, always at noon, and likes to be near the teacher.
  {
    name: 'Manan',
    role: 'resident',
    scale: 1.15,
    look: { guitar: true, scarf: '#d4503a' },
    personality: P(1.0, 1.1, 1.05, 1.1, 3.7, 1.0, 1.04, 1.1),
    persona: { musician: true, social: 1, sleepy: 0.6, near: { name: 'Bansaree', chance: 0.3 }, likes: { guitar: 6, camp: 1.6, dance: 1.5 } },
  },
  // Tirrth: bald under a green brimmed hat, and a little too interested in Dishi.
  {
    name: 'Tirrth',
    role: 'resident',
    scale: 1.2,
    look: { hat: '#2f9a52', bald: true },
    personality: P(1.0, 1.0, 1.0, 1.0, 4.2, 1.02, 1.0, 1.0),
    persona: { follows: 'Dishi', social: 0.8, likes: { tail: 2.5 } },
  },
  // Aastha: small, with a bow, wandering about with nothing in particular to do.
  {
    name: 'Aastha',
    role: 'resident',
    scale: 0.8,
    look: { bow: '#f26c9a', lashes: true },
    personality: P(1.0, 1.2, 1.1, 1.15, 3.4, 0.95, 1.16, 1.3),
    persona: { social: 0.9, likes: { wander: 3, explore: 3, stroll: 2.2, look: 1.8, sit: 1.2, play: 0.5, camp: 0.5, nook: 0.6, snack: 0.6, gym: 0.3, slide: 0.7, swing: 0.8, workout: 0.1, dance: 0.7 } },
  },
  // Siddhant: gold chain, shades, bracelets; strolls about, often in the same part of the grove as Aastha.
  {
    name: 'Siddhant',
    role: 'resident',
    scale: 1.28,
    look: { chain: true, shades: true },
    personality: P(1.0, 1.25, 1.0, 1.05, 4.6, 0.98, 0.98, 0.95),
    persona: { social: 0.85, near: { name: 'Aastha', chance: 0.6 }, likes: { wander: 1.4, stroll: 1.6, nook: 1.3, dance: 1.3, roll: 0.5, snack: 0.6 } },
  },
  // Bansaree: the teacher, in a sari with a bun and glasses, who calls a few pandas to the board for a lesson.
  {
    name: 'Bansaree',
    role: 'resident',
    scale: 1.3,
    glasses: true,
    look: { bun: true, sash: '#d65a31', pointer: true },
    personality: P(1.0, 0.95, 0.95, 0.9, 4.9, 1.0, 1.0, 0.9),
    persona: { teacher: true, social: 0.85, likes: { teach: 5, adjust: 1.5, stroll: 1.2, nook: 1.2, roll: 0.2, slide: 0.4, swing: 0.5, dance: 0.5 } },
  },
  // Dishi: flower in her ear and a purple scarf, always on the move, and not as unaware of Tirrth as she looks.
  {
    name: 'Dishi',
    role: 'resident',
    scale: 1.12,
    look: { flower: '#ff5f9e', scarf: '#7c5cc4', lashes: true },
    personality: P(1.0, 1.15, 1.18, 1.2, 3.3, 0.97, 1.06, 1.25),
    persona: { avoids: 'Tirrth', social: 0.8, likes: { wander: 2.3, explore: 1.6, stroll: 1.6, slide: 0.9, roll: 1.2 } },
  },
  // Deep: a very round pear of a panda with enormous glasses, forever pushing them up his nose.
  {
    name: 'Deep',
    role: 'resident',
    scale: 1.34,
    glasses: 'big',
    look: { pear: 1 },
    personality: P(1.0, 1.3, 0.85, 0.9, 5.0, 1.12, 1.14, 0.9),
    persona: { sleepy: 1.2, social: 0.85, likes: { adjust: 4, snack: 1.6, nook: 1.6, roll: 0.3, wander: 1.2, look: 1.4, workout: 0.1, slide: 0.7, swing: 0.5, sit: 1.3 } },
  },
];

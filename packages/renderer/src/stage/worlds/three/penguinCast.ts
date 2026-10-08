import type { Persona } from '../idle';
import type { Personality } from './rigs';
import type { ColonyPenguinOptions } from './penguinRig';

/**
 * Who lives on the ice besides the crew: three students and nine characters, each with a look and a routine of its
 * own (see `Persona` in idle.ts for what a routine is made of). The same colony as the pandas' grove, as penguins.
 */

export interface PenguinMember {
  name: string;
  role: 'student' | 'resident';
  scale: number;
  personality: Personality;
  /** What sets it apart (see ColonyPenguinOptions), and what it is like (see Persona). */
  look: ColonyPenguinOptions;
  persona: Persona;
}

const P = (waddle: number, tempo: number, bounce: number, blink: number, plump: number, headSize: number): Personality => ({ waddle, tempo, bounce, blink, plump, headSize });

export const PENGUIN_MEMBERS: PenguinMember[] = [
  // The students: young, quick, a little bouncy, each with its own backpack and book.
  { name: 'Lin', role: 'student', scale: 1.5, look: { bag: '#d4553f', book: '#2f6db5', scarf: ['#f2c14e', '#fbf6e8'] }, personality: P(1.2, 1.12, 1.25, 3.6, 0.98, 1.1), persona: { bag: true, social: 0.9, likes: { swim: 1.3, belly: 1.4 } } },
  { name: 'Tao', role: 'student', scale: 1.45, look: { bag: '#3d7cc0', book: '#e0a43a', glasses: true }, personality: P(0.9, 1.0, 0.95, 4.8, 1.03, 1.08), persona: { bag: true, social: 0.9, likes: { adjust: 1.2, fish: 1.3 } } },
  { name: 'Yuki', role: 'student', scale: 1.4, look: { bag: '#e3b43a', book: '#8a4fb0', scarf: ['#5fb4a8', '#fbf6e8'] }, personality: P(1.3, 1.22, 1.35, 3.1, 0.95, 1.12), persona: { bag: true, social: 0.9, likes: { belly: 1.6, play: 1.3 } } },
  // Yash: muscular. The gym is his life (the barbell, the bar, the bag, a run round the loop), and a rest after.
  {
    name: 'Yash',
    role: 'resident',
    scale: 1.95,
    look: { bulk: 1, headband: '#d9402f', barbell: true },
    personality: P(0.8, 0.95, 0.85, 4.8, 1.04, 0.94),
    persona: { social: 0.5, likes: { workout: 18, play: 0.3, nook: 0.5, camp: 0.4, explore: 0.4, sit: 0.6, wander: 0.5, look: 0.8, roll: 0.2, dance: 0.6, lounge: 0.7, slide: 0.3, belly: 0.4, swim: 0.6, fish: 0.8, stroll: 0.7 } },
  },
  // Manas: a tech penguin, a little lazy and rather round, who lives at his laptop with his headset on (and nods off there).
  {
    name: 'Manas',
    role: 'resident',
    scale: 1.75,
    look: { headset: true, plump: 1.32, scarf: ['#59627a', '#9aa3b5'] },
    personality: P(0.85, 0.8, 0.7, 4.4, 1.0, 1.02),
    persona: { sleepy: 0.45, social: 0.35, likes: { compute: 120, play: 0.2, nook: 0.5, camp: 0.5, wander: 0.4, roll: 0.15, slide: 0.2, belly: 0.2, swim: 0.2, workout: 0.05, dance: 0.3, explore: 0.2, stroll: 0.4, fish: 1.2, sit: 0.9 } },
  },
  // Manan: the musician. Plays and sings, carries his guitar everywhere, at the fire every noon, and drifts near the teacher.
  {
    name: 'Manan',
    role: 'resident',
    scale: 1.7,
    look: { guitar: true, scarf: ['#d4503a', '#f2c14e'] },
    personality: P(1.1, 1.05, 1.1, 3.7, 1.0, 1.04),
    persona: { musician: true, social: 1, sleepy: 0.6, near: { name: 'Bansaree', chance: 0.3 }, likes: { guitar: 6, camp: 1.6, dance: 1.5, swim: 0.5, belly: 0.5 } },
  },
  // Tirrth: bald under a human's green brimmed hat, and a little too interested in Dishi.
  {
    name: 'Tirrth',
    role: 'resident',
    scale: 1.75,
    look: { hat: '#2f9a52', bald: true },
    personality: P(1.0, 1.05, 1.1, 4.2, 1.0, 1.0),
    persona: { follows: 'Dishi', social: 0.8, likes: { tail: 2.6, explore: 1.3, belly: 1.2, look: 1.3, sit: 0.9 } },
  },
  // Aastha: small, with a bow, wandering about with nothing in particular to do.
  {
    name: 'Aastha',
    role: 'resident',
    scale: 1.22,
    look: { bow: '#f26c9a', lashes: true },
    personality: P(1.2, 1.15, 1.2, 3.4, 0.96, 1.16),
    persona: { social: 0.9, likes: { wander: 3, explore: 3, stroll: 2.2, look: 1.8, sit: 1.3, play: 0.5, camp: 0.5, nook: 0.7, fish: 0.5, slide: 0.6, belly: 0.5, swim: 0.5, workout: 0.05, dance: 0.6 } },
  },
  // Siddhant: gold chain, shades, bracelets; strolls about, often in the same part of the ice as Aastha.
  {
    name: 'Siddhant',
    role: 'resident',
    scale: 1.85,
    look: { chain: true, shades: true },
    personality: P(1.25, 1.0, 1.05, 4.6, 0.98, 0.98),
    persona: { social: 0.85, near: { name: 'Aastha', chance: 0.9 }, likes: { wander: 1.1, stroll: 1.3, nook: 1.1, dance: 1.2, roll: 0.3, fish: 0.6, swim: 0.6, explore: 0.8 } },
  },
  // Bansaree: the teacher, with glasses, a top-knot and a shawl, who calls a few penguins to the board for a lesson.
  {
    name: 'Bansaree',
    role: 'resident',
    scale: 1.85,
    look: { glasses: true, bun: true, shawl: '#d65a31', pointer: true },
    personality: P(0.95, 0.95, 0.9, 4.9, 1.0, 1.0),
    persona: { teacher: true, social: 0.85, likes: { teach: 5, adjust: 1.5, stroll: 1.2, nook: 1.2, roll: 0.15, slide: 0.3, belly: 0.3, swim: 0.4, dance: 0.5 } },
  },
  // Dishi: a crest of yellow plumes, a flower and a purple scarf, always on the move, and not as unaware of Tirrth as she looks.
  {
    name: 'Dishi',
    role: 'resident',
    scale: 1.65,
    look: { crest: '#f5c518', flower: '#ff5f9e', scarf: ['#7c5cc4', '#e8dcff'], lashes: true },
    personality: P(1.15, 1.18, 1.2, 3.3, 0.97, 1.06),
    persona: { avoids: 'Tirrth', social: 0.8, likes: { wander: 2.3, explore: 1.6, stroll: 1.6, slide: 0.8, belly: 1.4, swim: 1.3, roll: 0.6 } },
  },
  // Deep: a very round pear of a penguin with enormous glasses, forever pushing them up his beak, and not steady on ice.
  {
    name: 'Deep',
    role: 'resident',
    scale: 1.9,
    look: { glasses: 'big', pear: 1, tuft: true },
    personality: P(1.35, 0.85, 0.9, 5.0, 1.1, 1.12),
    persona: { sleepy: 1.2, social: 0.85, clumsy: 0.55, likes: { adjust: 4, fish: 1.6, nook: 1.5, roll: 0.3, wander: 1.2, look: 1.6, explore: 1.3, workout: 0.05, slide: 0.6, belly: 0.6, swim: 0.5, sit: 1.3 } },
  },
];

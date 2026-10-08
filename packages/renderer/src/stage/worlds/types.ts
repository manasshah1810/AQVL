/**
 * Worlds: where the algorithm stands. `studio` is the plain v2 stage. The
 * others put the structures in a place with a crew of two animals who walk
 * (or slide, or roll) to the cells each step is about and act out what
 * happens to them: inspect on a compare, push on a swap, cheer on a settle.
 * The ocean is the exception: its crew swims (a whale and her calf, see
 * worlds/ocean), so it has its own water physics and its own pod.
 * The state colours of the bodies never change between worlds.
 */
export type StageWorld = 'studio' | 'penguin' | 'panda' | 'ocean' | 'rabbit';

export interface WorldInfo {
  id: StageWorld;
  label: string;
  /** One line for the picker's tooltip. */
  blurb: string;
  /** Names of the two crew members (left, right). */
  crew: [string, string];
}

export const WORLDS: Record<StageWorld, WorldInfo> = {
  studio: { id: 'studio', label: 'Studio', blurb: 'The plain stage: porcelain bodies on a quiet floor.', crew: ['', ''] },
  penguin: {
    id: 'penguin',
    label: 'Penguins + Ice',
    blurb: 'An ice shelf under the aurora. Two penguins waddle to every step, shove the blocks across the ice, climb to the floating nodes, and an eagle carries new ones up.',
    crew: ['Pip', 'Nori'],
  },
  panda: {
    id: 'panda',
    label: 'Pandas + Bamboo',
    blurb: 'A bamboo grove with its own day and night. Two pandas walk to every step, push and roll the blocks along the ground and climb bamboo to reach floating nodes; student pandas sit and take notes, and the rest of the colony eats, slides, swings, plays and, under the moon, sleeps.',
    crew: ['Bao', 'Mochi'],
  },
  ocean: {
    id: 'ocean',
    label: 'Whales + Ocean',
    blurb: 'A sunlit reef under the sea. A whale and her calf swim to every step, lift blocks off the seabed with a nudge and steer them through the water, and drift about the reef among fish, jellies and turtles when nothing is running.',
    crew: ['Kai', 'Nami'],
  },
  rabbit: {
    id: 'rabbit',
    label: 'Rabbits + Cloud Kingdom',
    blurb: 'A floating kingdom of cloud islands joined by rainbow bridges. Bansaree the teacher and Deep (big glasses) act out every step while three students take notes; Yash trains at the gym, Manas codes (and naps) in his cloud office, Manan plays the noon campfire, and the rest roam, garden, bounce and slide until bedtime under a big moon.',
    crew: ['Bansaree', 'Deep'],
  },
};

export const WORLD_IDS = Object.keys(WORLDS) as StageWorld[];

export function isStageWorld(v: unknown): v is StageWorld {
  return typeof v === 'string' && v in WORLDS;
}

/** True when the world has a crew standing in front of the structures (the camera makes room for them). */
export function hasCast(world: StageWorld): boolean {
  return world !== 'studio';
}

/** True when blocks standing on the ground are physically shoved, rolled and carried by a walking crew (penguins, pandas). */
export function hasPhysics(world: StageWorld): boolean {
  return world === 'penguin' || world === 'panda';
}

/** True for the underwater world: nodes move through water (buoyancy, drag) and the crew swims. */
export function isOcean(world: StageWorld): boolean {
  return world === 'ocean';
}

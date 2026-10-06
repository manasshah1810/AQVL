/**
 * Worlds: where the algorithm stands. `studio` is the plain v2 stage. The
 * others put the structures in a place with a crew of two animals who walk
 * (or slide, or roll) to the cells each step is about and act out what
 * happens to them: inspect on a compare, push on a swap, cheer on a settle.
 * The state colours of the bodies never change between worlds.
 */
export type StageWorld = 'studio' | 'penguin' | 'panda';

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
    blurb: 'A bamboo grove at dawn. Two pandas walk to every step, push and roll the blocks along the ground, climb bamboo to reach floating nodes, and potter about the grove when nothing is running.',
    crew: ['Bao', 'Mochi'],
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

/** True when blocks standing on the ground are physically shoved, rolled and carried by the crew (both animal worlds). */
export function hasPhysics(world: StageWorld): boolean {
  return world === 'penguin' || world === 'panda';
}

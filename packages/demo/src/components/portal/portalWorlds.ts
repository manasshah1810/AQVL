import type { World } from '../../lib/world';

/** The four worlds the dome travels between, in journey order. */
export type DomeWorld = 'panda' | 'penguin' | 'rabbit' | 'studio';
export const DOME_WORLDS: DomeWorld[] = ['panda', 'penguin', 'rabbit', 'studio'];

export interface PortalWorld {
  id: DomeWorld;
  name: string;
  place: string;
  tagline: string;
  story: string;
  crew: string;
  /** Two colours that tint the page around the dome. */
  a: string;
  b: string;
  accent: string;
}

export const PORTAL: Record<DomeWorld, PortalWorld> = {
  panda: {
    id: 'panda',
    name: 'Bamboo Grove',
    place: 'Pandas',
    tagline: 'Slow mornings and sleepy pandas.',
    story: 'Pandas push, roll and carry every block while bamboo sways and leaves drift down. A calm place to learn.',
    crew: 'Bao & Mochi',
    a: '#8fc268',
    b: '#2c4f22',
    accent: '#8cc152',
  },
  penguin: {
    id: 'penguin',
    name: 'Aurora Ice Shelf',
    place: 'Penguins',
    tagline: 'Waddle under the northern lights.',
    story: 'Two penguins shove blocks across the ice beneath a dancing aurora, and the snow never stops falling.',
    crew: 'Pip & Nori',
    a: '#2a6aa8',
    b: '#0a1426',
    accent: '#8fd3ff',
  },
  rabbit: {
    id: 'rabbit',
    name: 'Cloud Kingdom',
    place: 'Rabbits',
    tagline: 'A rainbow-bridged school in the sky.',
    story: 'A teacher rabbit acts out each step on floating islands while students take notes. Bouncy, bright and cuddly.',
    crew: 'Bansaree & Deep',
    a: '#b9a4ff',
    b: '#6a4fb8',
    accent: '#ff8fa3',
  },
  studio: {
    id: 'studio',
    name: 'The Studio',
    place: 'Classic',
    tagline: 'Quiet, clean, all about the idea.',
    story: 'No characters, no weather: just the algorithm on a calm stage. When you want to focus.',
    crew: 'Just you',
    a: '#5a5473',
    b: '#1e1c27',
    accent: '#e9a03b',
  },
};

export function worldToIndex(w: World): number {
  const i = DOME_WORLDS.indexOf(w as DomeWorld);
  return i < 0 ? 3 : i;
}

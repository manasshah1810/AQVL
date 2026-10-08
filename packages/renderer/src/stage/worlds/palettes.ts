import { STAGE_PALETTES, type StagePalette, type StageTheme } from '../look/palette';
import type { StageWorld } from './types';

/**
 * Each world brings its own surroundings (ground, inks, light) and keeps
 * the stage's state colours exactly, so a compared cell is the same amber
 * on the ice shelf as in the studio. A world's look does not follow the
 * site's light / dark mode: the ice shelf is always at night, the grove
 * always at dawn.
 */
const STATES = STAGE_PALETTES.dark.states;
const STATE_EDGES = {
  visit: STATES.TRAVERSING.body,
  compare: STATES.EVALUATING.body,
  mutate: STATES.MODIFYING.body,
  settled: STATES.SUCCESS.body,
  marked: STATES.AUXILIARY.body,
};

/** Ice shelf under the aurora: dark polished ice, light inks. */
const POLAR: StagePalette = {
  background: '#0a1426',
  floor: '#163252',
  floorLine: '#8fc0e6',
  plinth: '#1d4268',
  plinthLine: '#4a7eaa',
  shadow: '#010409',
  shadowOpacity: 0.62,
  states: STATES,
  edges: { idle: '#9ab9d4', discarded: '#2b4763', ...STATE_EDGES },
  plate: '#eef6ff',
  caption: '#b4cde6',
  tag: '#eef6ff',
  frame: '#173150',
  frameText: '#e8f2fc',
  frameTop: '#a6d6ff',
  lights: {
    key: '#e2ecff',
    keyIntensity: 2.5,
    fill: '#b4c8f2',
    fillIntensity: 0.4,
    sky: '#a9c4ee',
    ground: '#0e1d33',
    ambient: 1.0,
    envIntensity: 0.7,
  },
};

/** Bamboo grove at dawn: a swept earth clearing, dark inks. */
const GROVE: StagePalette = {
  background: '#dce7d3',
  floor: '#d9cca5',
  floorLine: '#8a7a55',
  plinth: '#c9b483',
  plinthLine: '#a48b58',
  shadow: '#34301c',
  shadowOpacity: 0.4,
  states: STATES,
  edges: { idle: '#77704f', discarded: '#c3b78c', ...STATE_EDGES },
  plate: '#25261a',
  caption: '#4d4a30',
  tag: '#25261a',
  frame: '#f1e9cf',
  frameText: '#25261a',
  frameTop: '#3b6a26',
  lights: {
    key: '#fff1d8',
    keyIntensity: 2.45,
    fill: '#e2f6d8',
    fillIntensity: 0.6,
    sky: '#f6fbff',
    ground: '#9aa06a',
    ambient: 1.0,
    envIntensity: 0.55,
  },
};

/** A sunlit reef: pale sand in blue water, light inks; the state colours read as they do everywhere. */
const REEF: StagePalette = {
  background: '#0b3a52',
  floor: '#1a4856',
  floorLine: '#8cd3d8',
  plinth: '#245766',
  plinthLine: '#5fa3ad',
  shadow: '#021820',
  shadowOpacity: 0.5,
  states: STATES,
  edges: { idle: '#9fe3dc', discarded: '#2e5a66', ...STATE_EDGES },
  plate: '#effcff',
  caption: '#bfe7ec',
  tag: '#effcff',
  frame: '#0f4157',
  frameText: '#eafbff',
  frameTop: '#7fe6e0',
  lights: {
    key: '#e8fbff',
    keyIntensity: 2.3,
    fill: '#7fd0ff',
    fillIntensity: 0.55,
    sky: '#b8f0ff',
    ground: '#0d3a45',
    ambient: 1.05,
    envIntensity: 0.65,
  },
};

/** The cloud kingdom: a soft lavender plaza in a blue sky, dark inks; its own sky and light follow the day. */
const CLOUD: StagePalette = {
  background: '#cfeaff',
  floor: '#f3ecfb',
  floorLine: '#8f86b8',
  plinth: '#ddd0f2',
  plinthLine: '#a99bd0',
  shadow: '#3b3560',
  shadowOpacity: 0.34,
  states: STATES,
  edges: { idle: '#7a72a8', discarded: '#cfc8e6', ...STATE_EDGES },
  plate: '#2b2546',
  caption: '#4a4370',
  tag: '#2b2546',
  frame: '#fbf7ff',
  frameText: '#2b2546',
  frameTop: '#ff8fb1',
  lights: {
    key: '#fff3df',
    keyIntensity: 2.4,
    fill: '#d8e6ff',
    fillIntensity: 0.55,
    sky: '#eef6ff',
    ground: '#d5c8ef',
    ambient: 1.0,
    envIntensity: 0.55,
  },
};

export const WORLD_PALETTES: Record<Exclude<StageWorld, 'studio'>, StagePalette> = {
  penguin: POLAR,
  panda: GROVE,
  ocean: REEF,
  rabbit: CLOUD,
};

/** The palette a scene is drawn in. */
export function paletteFor(theme: StageTheme, world: StageWorld): StagePalette {
  return world === 'studio' ? STAGE_PALETTES[theme] : WORLD_PALETTES[world];
}

import type { SemanticState } from '@aqvl/shared';

/**
 * The stage's colours. Only the surroundings follow the site's light / dark
 * mode: the background, the floor, and the inks that are printed on them
 * (names, captions, call frames). The things being visualised keep one
 * calm palette in both modes: porcelain at rest, and four soft, mid-light
 * hues for what is happening to them. All bodies carry the same dark ink,
 * so a value reads the same whatever its state. Every value, with its
 * reason and contrast, is in docs/design/visualizer-v2/README.md.
 */

export type StageTheme = 'dark' | 'light';

export interface StateColor {
  /** Node body colour. */
  body: string;
  /** Value text drawn on that body (WCAG AA against it). */
  text: string;
}

export interface StagePalette {
  /** The void; fog fades to the same colour so the floor dissolves into it. */
  background: string;
  floor: string;
  /** Faint guide grid on the floor. */
  floorLine: string;
  /** Footprint under each structure that stands on the floor. */
  plinth: string;
  /** Hairline round that footprint. */
  plinthLine: string;
  /** Contact shadows under bodies. */
  shadow: string;
  shadowOpacity: number;
  states: Record<SemanticState, StateColor>;
  edges: Record<'idle' | 'visit' | 'compare' | 'mutate' | 'settled' | 'discarded' | 'marked', string>;
  /** Structure names. */
  plate: string;
  /** Index captions and secondary labels. */
  caption: string;
  /** Pointer-variable tags (curr, HEAD, TOP). */
  tag: string;
  /** Call-stack frames. */
  frame: string;
  frameText: string;
  /** The running call's text on its slab. */
  frameTop: string;
  lights: {
    key: string;
    keyIntensity: number;
    fill: string;
    fillIntensity: number;
    sky: string;
    ground: string;
    ambient: number;
    envIntensity: number;
  };
}

/** Ink printed on every node body. */
const BODY_INK = '#262833';

/** The visualised things: identical in both modes. */
const STATES: Record<SemanticState, StateColor> = {
  // At rest: porcelain. Quiet, so anything coloured is news.
  NEUTRAL: { body: '#e2e2ea', text: BODY_INK },
  // Being compared / read: amber, "looking at this".
  EVALUATING: { body: '#edbb55', text: BODY_INK },
  // Being written / swapped / linked: coral, the change itself.
  MODIFYING: { body: '#e9805f', text: BODY_INK },
  // Being visited / pointed at: blue, the walk through the structure.
  TRAVERSING: { body: '#6e9fe0', text: BODY_INK },
  // Settled / sorted / found: sage green, done.
  SUCCESS: { body: '#5fb389', text: BODY_INK },
  // Ruled out: a greyed, smaller, matte body (the universal "disabled").
  DISCARDED: { body: '#9c9aa8', text: BODY_INK },
  // Marked (probe, boundary): lilac, with a dashed ring.
  AUXILIARY: { body: '#b79be6', text: BODY_INK },
  // A role (root, leaf, view): teal, with a double ring.
  STRUCTURAL: { body: '#7fc2c8', text: BODY_INK },
};

const STATE_EDGES = {
  visit: STATES.TRAVERSING.body,
  compare: STATES.EVALUATING.body,
  mutate: STATES.MODIFYING.body,
  settled: STATES.SUCCESS.body,
  marked: STATES.AUXILIARY.body,
};

export const STAGE_PALETTES: Record<StageTheme, StagePalette> = {
  dark: {
    background: '#17151f',
    floor: '#17151f',
    floorLine: '#8a87a0',
    plinth: '#211e2b',
    plinthLine: '#3a3748',
    shadow: '#000000',
    shadowOpacity: 0.7,
    states: STATES,
    edges: { idle: '#7b788f', discarded: '#3a3747', ...STATE_EDGES },
    plate: '#ece8f2',
    caption: '#aeabbf',
    tag: '#ece8f2',
    frame: '#2a2735',
    frameText: '#e6e2ee',
    frameTop: '#8fb6ec',
    lights: {
      key: '#fffaf4',
      keyIntensity: 2.5,
      fill: '#e4e8ff',
      fillIntensity: 0.7,
      sky: '#f1f0fa',
      ground: '#3a3646',
      ambient: 1.05,
      envIntensity: 0.55,
    },
  },
  light: {
    background: '#efe4db',
    floor: '#efe4db',
    floorLine: '#6f6878',
    plinth: '#e7dbd1',
    plinthLine: '#d6c8bd',
    shadow: '#4a3a33',
    shadowOpacity: 0.42,
    states: STATES,
    edges: { idle: '#8f8796', discarded: '#d3c6bc', ...STATE_EDGES },
    plate: '#2a2833',
    caption: '#6e6879',
    tag: '#2a2833',
    frame: '#e3d8ce',
    frameText: '#2a2833',
    frameTop: '#2f5fae',
    lights: {
      key: '#fffaf4',
      keyIntensity: 2.3,
      fill: '#f4ecff',
      fillIntensity: 0.6,
      sky: '#ffffff',
      ground: '#d9cabd',
      ambient: 1.05,
      envIntensity: 0.55,
    },
  },
};

/** Edge colour for an edge (or the bridge between two nodes) in a given state. */
export function edgeColorFor(palette: StagePalette, state: SemanticState): string {
  switch (state) {
    case 'TRAVERSING':
      return palette.edges.visit;
    case 'EVALUATING':
      return palette.edges.compare;
    case 'MODIFYING':
      return palette.edges.mutate;
    case 'SUCCESS':
      return palette.edges.settled;
    case 'DISCARDED':
      return palette.edges.discarded;
    case 'AUXILIARY':
    case 'STRUCTURAL':
      return palette.edges.marked;
    default:
      return palette.edges.idle;
  }
}

/** Relative luminance (WCAG 2.x) of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

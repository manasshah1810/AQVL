import type { SemanticState } from '@aqvl/shared';

/**
 * The stage's colours, derived from the website's palette (ink / peach /
 * dusk / cream, see packages/demo/src/index.css) and extended only where a
 * state needs a hue of its own. Every value here is documented, with its
 * reason and contrast, in docs/design/visualizer-v2/README.md.
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
  /** Faint hairline grid on the floor (peach, like the site's hairlines). */
  floorLine: string;
  /** Raised footprint under each structure. */
  plinth: string;
  /** Footprint of the heap-memory area (detached nodes). */
  plinthDetached: string;
  states: Record<SemanticState, StateColor>;
  edges: Record<'idle' | 'visit' | 'compare' | 'mutate' | 'settled' | 'discarded' | 'marked', string>;
  /** Structure name plates. */
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
    rim: string;
    rimIntensity: number;
    sky: string;
    ground: string;
    ambient: number;
    envIntensity: number;
  };
  /** Bloom is only worth it on the dark ground. */
  bloom: number;
}

export const STAGE_PALETTES: Record<StageTheme, StagePalette> = {
  dark: {
    background: '#17151f',
    floor: '#1d1a27',
    floorLine: '#ebc0a3',
    plinth: '#25212f',
    plinthDetached: '#211d2a',
    states: {
      NEUTRAL: { body: '#5e5878', text: '#f5d8c6' },
      EVALUATING: { body: '#eba96e', text: '#1e1c27' },
      MODIFYING: { body: '#3ff6dc', text: '#17151f' },
      TRAVERSING: { body: '#b3abf2', text: '#1e1c27' },
      SUCCESS: { body: '#6c9c83', text: '#1e1c27' },
      DISCARDED: { body: '#2b2737', text: '#9a96ae' },
      AUXILIARY: { body: '#ec9fc4', text: '#1e1c27' },
      STRUCTURAL: { body: '#7186bf', text: '#1e1c27' },
    },
    edges: {
      idle: '#6d6886',
      visit: '#b3abf2',
      compare: '#eba96e',
      mutate: '#3ff6dc',
      settled: '#6c9c83',
      discarded: '#34303f',
      marked: '#ec9fc4',
    },
    plate: '#c4a290',
    caption: '#8e8ba3',
    tag: '#ebc0a3',
    frame: '#2c2839',
    frameText: '#f5d8c6',
    frameTop: '#b3abf2',
    lights: {
      key: '#fff1e4',
      keyIntensity: 2.4,
      rim: '#b6b0dd',
      rimIntensity: 1.6,
      sky: '#6f6a8c',
      ground: '#17151f',
      ambient: 0.55,
      envIntensity: 0.55,
    },
    bloom: 1,
  },
  light: {
    background: '#efe4db',
    floor: '#ebdfd5',
    floorLine: '#3a3649',
    plinth: '#e2d4c9',
    plinthDetached: '#e6d9cf',
    states: {
      NEUTRAL: { body: '#5d5874', text: '#f7efe9' },
      EVALUATING: { body: '#d9853f', text: '#1e1c27' },
      MODIFYING: { body: '#0f9fa6', text: '#17151f' },
      TRAVERSING: { body: '#9d95e6', text: '#1e1c27' },
      SUCCESS: { body: '#6a9a82', text: '#1e1c27' },
      DISCARDED: { body: '#d9ccc2', text: '#565166' },
      AUXILIARY: { body: '#e590b8', text: '#1e1c27' },
      STRUCTURAL: { body: '#7a8fc4', text: '#1e1c27' },
    },
    edges: {
      idle: '#9c94ad',
      visit: '#9d95e6',
      compare: '#d9853f',
      mutate: '#0f9fa6',
      settled: '#6a9a82',
      discarded: '#d6c9bf',
      marked: '#e590b8',
    },
    plate: '#57546a',
    caption: '#615d75',
    tag: '#3a3649',
    frame: '#e4d7cc',
    frameText: '#1e1c27',
    frameTop: '#4a4396',
    lights: {
      key: '#fff6ee',
      keyIntensity: 2.1,
      rim: '#c9c3ea',
      rimIntensity: 1.1,
      sky: '#fbf4ee',
      ground: '#d9cabd',
      ambient: 0.9,
      envIntensity: 0.65,
    },
    bloom: 0,
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

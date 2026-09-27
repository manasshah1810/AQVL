/**
 * Cross-topic element visual-state tokens.
 *
 * Generalizes the shape pioneered by the array topic's
 * `packages/renderer/src/components/array/elementStates.ts` (itself specified in
 * docs/design/array-visual-language-spec.md §1) so every topic maps its own states
 * onto the same {color, emissive, motion} contract instead of re-inventing it.
 *
 * A topic's state table is `Record<ItsOwnStateUnion, VisualTreatment>`; states that
 * mean the same thing across topics (something is currently being looked at, two
 * things are being compared, something is now correct, something is invalid, something
 * is out of scope) should start from `BASE_SEMANTIC_TREATMENTS` via `createTreatment`
 * and override only what's topic-specific, so the baseline "what does 'active' look
 * like" stays consistent everywhere a viewer might compare topics side by side.
 */

/** The base semantic states every topic's own state union should be able to map onto. */
export type BaseSemanticState =
  | 'default'
  | 'active'
  | 'comparing'
  | 'confirmed'
  | 'error'
  | 'dimmed';

export interface VisualTreatment {
  /** Base (non-emissive) surface color. */
  color: string;
  /** Emissive glow color. */
  emissiveColor: string;
  /** Peak/steady emissive intensity for this state. */
  emissiveIntensity: number;
  /** Uniform scale multiplier (before any magnitude-scaling height adjustment). */
  scale: number;
  /** Vertical offset (world units) applied while this state is active. */
  liftY: number;
  /** Base opacity. */
  opacity: number;
  /** Sync pulse frequency in Hz, or null if this state never pulses. */
  pulseHz: number | null;
  /** Whether this state uses a fast flicker cue instead of a steady pulse. */
  flicker: boolean;
  /** Whether this state involves net lateral (X/Z) displacement. */
  lateralMotion: boolean;
  /** Whether this state persists until an explicit reset, rather than being transient. */
  persistent: boolean;
  /** Whether the lift is held statically rather than animated. */
  staticHold: boolean;
  /** Whether a glowing floor strip should render beneath the element. */
  floorStrip: boolean;
  /** Whether a one-shot double-ring burst should fire for this state. */
  ringBurst: boolean;
  /** Whether this element should participate in interactions (comparisons, beams, etc). */
  interactive: boolean;
}

/** Every field a treatment can omit, defaulted to the quietest possible state. */
const TREATMENT_DEFAULTS: Omit<VisualTreatment, 'color' | 'emissiveColor'> = {
  emissiveIntensity: 0.1,
  scale: 1.0,
  liftY: 0,
  opacity: 1.0,
  pulseHz: null,
  flicker: false,
  lateralMotion: false,
  persistent: false,
  staticHold: false,
  floorStrip: false,
  ringBurst: false,
  interactive: true,
};

export type TreatmentOverrides = Partial<Omit<VisualTreatment, 'color' | 'emissiveColor'>> & {
  color: string;
  emissiveColor: string;
};

/** Fills in every unspecified field with the quiet baseline, so a topic's table only states what's distinctive about each state. */
export function createTreatment(overrides: TreatmentOverrides): VisualTreatment {
  return {
    ...TREATMENT_DEFAULTS,
    ...overrides,
  };
}

/**
 * Reference treatments for the six base semantic states. A topic-specific state
 * table is not required to use these directly (array's own states are more
 * specific, e.g. 'swapping' vs plain 'active') but every topic-specific state
 * should be recognizably a variant of one of these six.
 */
export const BASE_SEMANTIC_TREATMENTS: Record<BaseSemanticState, VisualTreatment> = {
  default: createTreatment({
    color: '#38bdf8',
    emissiveColor: '#0284c7',
    emissiveIntensity: 0.1,
  }),
  active: createTreatment({
    color: '#a78bfa',
    emissiveColor: '#8b5cf6',
    emissiveIntensity: 0.5,
    scale: 1.1,
    liftY: 0.5,
    staticHold: true,
    persistent: true,
  }),
  comparing: createTreatment({
    color: '#f59e0b',
    emissiveColor: '#fbbf24',
    emissiveIntensity: 0.7,
    scale: 1.15,
    liftY: 0.3,
    pulseHz: 5.0,
  }),
  confirmed: createTreatment({
    color: '#10b981',
    emissiveColor: '#34d399',
    emissiveIntensity: 0.5,
    persistent: true,
    ringBurst: true,
  }),
  error: createTreatment({
    color: '#ef4444',
    emissiveColor: '#f87171',
    emissiveIntensity: 0.8,
    flicker: true,
  }),
  dimmed: createTreatment({
    color: '#6b7280',
    emissiveColor: '#1f2937',
    emissiveIntensity: 0.05,
    scale: 0.92,
    opacity: 0.4,
    interactive: false,
  }),
};

/** Safe lookup with fallback to 'default', for topics that key their own table by a superset/different-named union. */
export function getBaseSemanticTreatment(state?: BaseSemanticState | string): VisualTreatment {
  if (state && Object.prototype.hasOwnProperty.call(BASE_SEMANTIC_TREATMENTS, state)) {
    return BASE_SEMANTIC_TREATMENTS[state as BaseSemanticState];
  }
  return BASE_SEMANTIC_TREATMENTS.default;
}

/**
 * Loop-nesting depth tokens: depth 0 is the outermost loop. Used to tell nested
 * iteration cursors apart (loops topic, the sweep inside a binary-search step, ...)
 * by colour AND by elevation, so an inner loop's cursor never reads as the outer
 * one's even in greyscale. Beyond the last entry, the last token repeats.
 */
export interface NestingDepthToken {
  color: string;
  emissiveColor: string;
  /** How far above the element the cursor floats (world units). Deeper loops sit closer to the element. */
  cursorHeight: number;
}

export const NESTING_DEPTH_TOKENS: readonly NestingDepthToken[] = [
  { color: '#a78bfa', emissiveColor: '#8b5cf6', cursorHeight: 1.75 },
  { color: '#22d3ee', emissiveColor: '#06b6d4', cursorHeight: 1.25 },
  { color: '#f472b6', emissiveColor: '#ec4899', cursorHeight: 0.95 },
];

export function getNestingDepthToken(depth: number): NestingDepthToken {
  const i = Math.max(0, Math.min(NESTING_DEPTH_TOKENS.length - 1, Math.floor(depth)));
  return NESTING_DEPTH_TOKENS[i];
}

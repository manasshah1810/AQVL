/**
 * Element state -> visual treatment mapping for array elements.
 * Values are taken directly from docs/design/array-visual-language-spec.md §1
 * (colors/emissive from the existing repo-wide semantic palette) and its
 * §1.9 redundant-cue table (scale, lift, pulse, lateral motion, persistence).
 */

export type ArrayElementState =
  | 'default'
  | 'comparing'
  | 'swapping'
  | 'confirmed-sorted'
  | 'selected'
  | 'search-candidate'
  | 'confirmed-match'
  | 'out-of-range';

export interface ArrayElementVisualTreatment {
  state: ArrayElementState;
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
  /** Whether this state uses the fast scan-flicker cue (§1.6) instead of a pulse. */
  flicker: boolean;
  /** Whether this state involves net lateral (X/Z) displacement (§1.3). */
  lateralMotion: boolean;
  /** Whether this state persists until an explicit reset, rather than being transient. */
  persistent: boolean;
  /** Whether the lift is held statically rather than animated (§1.5). */
  staticHold: boolean;
  /** Whether a glowing floor strip should render beneath the element (§1.4). */
  floorStrip: boolean;
  /** Whether a one-shot double-ring burst should fire for this state (§1.7). */
  ringBurst: boolean;
  /** Whether this element should participate in interactions (comparisons, beams, etc). */
  interactive: boolean;
}

type TreatmentOverrides = Partial<Omit<ArrayElementVisualTreatment, 'state' | 'color' | 'emissiveColor'>> & {
  state: ArrayElementState;
  color: string;
  emissiveColor: string;
};

function treatment(overrides: TreatmentOverrides): ArrayElementVisualTreatment {
  return {
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
    ...overrides,
  };
}

export const ARRAY_ELEMENT_STATES: Record<ArrayElementState, ArrayElementVisualTreatment> = {
  // §1.1 Default / untouched
  default: treatment({
    state: 'default',
    color: '#38bdf8',
    emissiveColor: '#0284c7',
    emissiveIntensity: 0.1,
  }),

  // §1.2 Being compared (linked pair)
  comparing: treatment({
    state: 'comparing',
    color: '#f59e0b',
    emissiveColor: '#fbbf24',
    emissiveIntensity: 0.7,
    scale: 1.15,
    liftY: 0.3,
    pulseHz: 5.0,
  }),

  // §1.3 Being swapped (in motion)
  swapping: treatment({
    state: 'swapping',
    color: '#ec4899',
    emissiveColor: '#f472b6',
    emissiveIntensity: 0.7,
    scale: 1.2,
    liftY: 1.8,
    lateralMotion: true,
  }),

  // §1.4 Confirmed in final sorted position
  'confirmed-sorted': treatment({
    state: 'confirmed-sorted',
    color: '#10b981',
    emissiveColor: '#34d399',
    emissiveIntensity: 0.2,
    scale: 1.0,
    persistent: true,
    floorStrip: true,
  }),

  // §1.5 Currently selected/focused (e.g. pivot)
  selected: treatment({
    state: 'selected',
    color: '#a78bfa',
    emissiveColor: '#8b5cf6',
    emissiveIntensity: 0.5,
    scale: 1.1,
    liftY: 0.5,
    staticHold: true,
    persistent: true,
  }),

  // §1.6 Being searched / candidate match
  'search-candidate': treatment({
    state: 'search-candidate',
    color: '#06b6d4',
    emissiveColor: '#22d3ee',
    emissiveIntensity: 0.6,
    flicker: true,
  }),

  // §1.7 Confirmed match (search found)
  'confirmed-match': treatment({
    state: 'confirmed-match',
    color: '#10b981',
    emissiveColor: '#34d399',
    emissiveIntensity: 0.5,
    persistent: true,
    ringBurst: true,
  }),

  // §1.8 Out of range / excluded
  'out-of-range': treatment({
    state: 'out-of-range',
    color: '#6b7280',
    emissiveColor: '#1f2937',
    emissiveIntensity: 0.05,
    scale: 0.92,
    opacity: 0.4,
    interactive: false,
  }),
};

export function getArrayElementVisualTreatment(
  state?: ArrayElementState | string
): ArrayElementVisualTreatment {
  if (state && Object.prototype.hasOwnProperty.call(ARRAY_ELEMENT_STATES, state)) {
    return ARRAY_ELEMENT_STATES[state as ArrayElementState];
  }
  return ARRAY_ELEMENT_STATES.default;
}

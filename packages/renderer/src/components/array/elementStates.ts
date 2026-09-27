import { createTreatment, type VisualTreatment } from '@aqvl/shared';

/**
 * Element state -> visual treatment mapping for array elements.
 * Values are taken directly from docs/design/array-visual-language-spec.md §1
 * (colors/emissive from the existing repo-wide semantic palette) and its
 * §1.9 redundant-cue table (scale, lift, pulse, lateral motion, persistence).
 *
 * This is the first consumer of `@aqvl/shared`'s cross-topic `VisualTreatment`
 * shape (packages/shared/src/theme/visualTokens.ts) — array's states are more
 * specific than the shared base-semantic set (e.g. 'swapping' vs plain
 * 'active'), but every field still comes from the same shared contract so
 * other topics can build their own tables against it.
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

export interface ArrayElementVisualTreatment extends VisualTreatment {
  state: ArrayElementState;
}

type ArrayTreatmentOverrides = Partial<Omit<ArrayElementVisualTreatment, 'state' | 'color' | 'emissiveColor'>> & {
  state: ArrayElementState;
  color: string;
  emissiveColor: string;
};

function treatment(overrides: ArrayTreatmentOverrides): ArrayElementVisualTreatment {
  const { state, ...rest } = overrides;
  return { state, ...createTreatment(rest) };
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

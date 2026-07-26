import { getSemanticColorToken, normalizeSemanticState, SemanticState } from './semanticColors';

export type HighlightType = 
  | 'EVALUATING' 
  | 'MODIFYING' 
  | 'TRAVERSING' 
  | 'SUCCESS' 
  | 'FOCUS'
  | 'DEFAULT';

export interface HighlightStyleConfig {
  /** Target scale multiplier when fully highlighted (default 1.20 = +20%) */
  scaleMultiplier: number;
  /** Additive emissive intensity boost when highlighted */
  emissiveBoost: number;
  /** Peak opacity for the outer 3D highlight ring */
  ringOpacity: number;
  /** Radius offset for 3D highlight ring relative to node size */
  ringRadiusOffset: number;
  /** Pulse oscillation frequency (Hz) */
  pulseFrequency: number;
  /** Pulse oscillation amplitude (0..1) */
  pulseAmplitude: number;
  /** Primary accent color for the highlight overlay and 3D ring */
  accentColor: string;
  /** Emissive glow color for the highlight overlay and 3D ring */
  emissiveColor: string;
}

export const HIGHLIGHT_PALETTE: Record<HighlightType, { color: string; emissiveColor: string }> = {
  EVALUATING: {
    color: '#fbbf24', // Radiant Amber Gold - evaluation / comparison
    emissiveColor: '#f59e0b',
  },
  MODIFYING: {
    color: '#f472b6', // Electric Pink - swap / modify / write
    emissiveColor: '#ec4899',
  },
  TRAVERSING: {
    color: '#22d3ee', // Vivid Cyan - pointer / traversal / scan
    emissiveColor: '#06b6d4',
  },
  SUCCESS: {
    color: '#34d399', // Emerald Green - target match / sorted / found
    emissiveColor: '#10b981',
  },
  FOCUS: {
    color: '#a78bfa', // Luminous Purple - focus / mid element / boundary
    emissiveColor: '#8b5cf6',
  },
  DEFAULT: {
    color: '#38bdf8', // Crisp Sky Blue - default highlight
    emissiveColor: '#0284c7',
  },
};

/**
  Normalizes an action, state, or explicit highlight type string to a canonical HighlightType.
 */
export function normalizeHighlightType(typeOrState?: string): HighlightType {
  if (!typeOrState) return 'DEFAULT';
  const s = typeOrState.trim().toUpperCase();

  switch (s) {
    case 'EVALUATING':
    case 'EVALUATE':
    case 'COMPARE':
    case 'COMPARING':
    case 'CHECKING':
    case 'ACTIVE':
    case 'SELECTING':
    case 'SELECT':
    case 'KEY':
      return 'EVALUATING';

    case 'MODIFYING':
    case 'MODIFY':
    case 'SWAP':
    case 'SWAPPING':
    case 'INSERT':
    case 'INSERTING':
    case 'UPDATE':
    case 'REPLACE':
    case 'PUSH':
    case 'POP':
      return 'MODIFYING';

    case 'TRAVERSING':
    case 'TRAVERSE':
    case 'VISITED':
    case 'VISITING':
    case 'POINTER':
    case 'CURRENT':
    case 'SCANNING':
    case 'PEEK':
    case 'SEARCHING':
    case 'HEAD':
    case 'TAIL':
      return 'TRAVERSING';

    case 'SUCCESS':
    case 'SORTED':
    case 'FOUND':
    case 'CONFIRMED':
    case 'MATCH':
    case 'MATCHED':
    case 'COMPLETED':
      return 'SUCCESS';

    case 'FOCUS':
    case 'MID':
    case 'MIDDLE':
    case 'LOW':
    case 'HIGH':
    case 'PIVOT':
    case 'ROOT':
    case 'TARGET':
      return 'FOCUS';

    default:
      return 'DEFAULT';
  }
}

export interface VisualHierarchyConfig {
  /** Opacity for Active state (full visual emphasis) */
  activeOpacity: number;
  /** Opacity for Inactive state (visually de-emphasized while remaining readable) */
  inactiveOpacity: number;
  /** Scale multiplier boost for Active state (+15% to +20%) */
  activeScaleBoost: number;
  /** Additive emissive intensity boost for Active state */
  activeEmissiveBoost: number;
  /** Base emissive intensity for Inactive state */
  inactiveEmissiveIntensity: number;
}

export const VISUAL_HIERARCHY_CONFIG: VisualHierarchyConfig = {
  activeOpacity: 1.0,
  inactiveOpacity: 0.45,
  activeScaleBoost: 1.18,
  activeEmissiveBoost: 0.65,
  inactiveEmissiveIntensity: 0.05,
};

/**
 * Checks whether an element is currently in an Active visual state.
 * Returns true if element.isHighlighted is true, or if element.state is a transient active state.
 */
export function isElementActive(element: {
  isHighlighted?: boolean;
  state?: string;
  highlightType?: string;
}): boolean {
  if (!element) return false;
  if (element.isHighlighted === true) return true;

  if (element.state) {
    const canonicalState = normalizeSemanticState(element.state);
    if (
      canonicalState === 'EVALUATING' ||
      canonicalState === 'MODIFYING' ||
      canonicalState === 'TRAVERSING'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Legacy compatibility alias for isElementActive.
 */
export const isElementHighlighted = isElementActive;


/**
 * Resolves the highlight accent color and emissive glow for a given element.
 */
export function getHighlightAccentColor(element: {
  state?: string;
  highlightType?: string;
  color?: string;
  emissiveColor?: string;
}): { color: string; emissiveColor: string } {
  if (!element) return HIGHLIGHT_PALETTE.DEFAULT;

  if (element.highlightType) {
    const type = normalizeHighlightType(element.highlightType);
    return HIGHLIGHT_PALETTE[type];
  }

  if (element.state) {
    const canonicalState = normalizeSemanticState(element.state);
    if (canonicalState === 'EVALUATING') return HIGHLIGHT_PALETTE.EVALUATING;
    if (canonicalState === 'MODIFYING') return HIGHLIGHT_PALETTE.MODIFYING;
    if (canonicalState === 'TRAVERSING') return HIGHLIGHT_PALETTE.TRAVERSING;
    if (canonicalState === 'SUCCESS') return HIGHLIGHT_PALETTE.SUCCESS;
  }

  return HIGHLIGHT_PALETTE.DEFAULT;
}

/**
 * Computes full highlight configuration for rendering.
 */
export function getHighlightConfig(element: {
  state?: string;
  highlightType?: string;
  color?: string;
  emissiveColor?: string;
  isHighlighted?: boolean;
}): HighlightStyleConfig {
  const accent = getHighlightAccentColor(element);

  return {
    scaleMultiplier: 1.20,
    emissiveBoost: 0.65,
    ringOpacity: 0.85,
    ringRadiusOffset: 0.12,
    pulseFrequency: 5.0,
    pulseAmplitude: 0.12,
    accentColor: accent.color,
    emissiveColor: accent.emissiveColor,
  };
}

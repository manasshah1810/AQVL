export type SemanticState = 
  | 'NEUTRAL' 
  | 'EVALUATING' 
  | 'TRAVERSING' 
  | 'MODIFYING' 
  | 'SUCCESS' 
  | 'DISCARDED' 
  | 'AUXILIARY' 
  | 'STRUCTURAL';

export interface SemanticColorToken {
  name: SemanticState;
  color: string;
  emissiveColor: string;
  emissiveIntensity: number;
  opacity?: number;
}

export const SEMANTIC_PALETTE: Record<SemanticState, SemanticColorToken> = {
  NEUTRAL: {
    name: 'NEUTRAL',
    color: '#38bdf8', // Sky Blue - crisp dark mode 3D idle state
    emissiveColor: '#0284c7',
    emissiveIntensity: 0.1,
    opacity: 1.0,
  },
  EVALUATING: {
    name: 'EVALUATING',
    color: '#f59e0b', // Amber Gold - high contrast evaluation/comparison state
    emissiveColor: '#fbbf24',
    emissiveIntensity: 0.7,
    opacity: 1.0,
  },
  TRAVERSING: {
    name: 'TRAVERSING',
    color: '#06b6d4', // Vivid Cyan - pointer navigation / traversal / active scan
    emissiveColor: '#22d3ee',
    emissiveIntensity: 0.6,
    opacity: 1.0,
  },
  MODIFYING: {
    name: 'MODIFYING',
    color: '#ec4899', // Electric Pink - swap / insert / update / structural modification
    emissiveColor: '#f472b6',
    emissiveIntensity: 0.7,
    opacity: 1.0,
  },
  SUCCESS: {
    name: 'SUCCESS',
    color: '#10b981', // Emerald Green - vivid confirmation / sorted / found state
    emissiveColor: '#34d399',
    emissiveIntensity: 0.5,
    opacity: 1.0,
  },
  DISCARDED: {
    name: 'DISCARDED',
    color: '#6b7280', // Muted Dark Slate Gray - out of scope / eliminated / pruned
    emissiveColor: '#1f2937',
    emissiveIntensity: 0.05,
    opacity: 0.4,
  },
  AUXILIARY: {
    name: 'AUXILIARY',
    color: '#a855f7', // Royal Purple / Violet - helper / temporary structure / boundary
    emissiveColor: '#c084fc',
    emissiveIntensity: 0.4,
    opacity: 1.0,
  },
  STRUCTURAL: {
    name: 'STRUCTURAL',
    color: '#6366f1', // Indigo Blue - hierarchy roles (Root / Leaf / Parent / Child / View)
    emissiveColor: '#818cf8',
    emissiveIntensity: 0.5,
    opacity: 1.0,
  },
};

/**
 * Normalizes any operation name, state string, or alias to a canonical SemanticState enum.
 */
export function normalizeSemanticState(stateName?: string): SemanticState {
  if (!stateName) return 'NEUTRAL';
  const s = stateName.trim().toUpperCase();

  switch (s) {
    case 'EVALUATING':
    case 'EVALUATE':
    case 'COMPARE':
    case 'COMPARING':
    case 'CHECKING':
    case 'ACTIVE':
    case 'FOCUSING':
    case 'FOCUS':
    case 'SELECTING':
    case 'SELECT':
    case 'HIGHLIGHT':
    case 'HIGHLIGHTED':
      return 'EVALUATING';

    case 'TRAVERSING':
    case 'TRAVERSE':
    case 'VISITED':
    case 'VISITING':
    case 'POINTER':
    case 'CURRENT':
    case 'SCANNING':
    case 'PEEK':
    case 'SEARCHING':
    case 'SEARCH':
    case 'NEXT':
    case 'PREV':
    case 'STEP':
      return 'TRAVERSING';

    case 'MODIFYING':
    case 'MODIFY':
    case 'SWAP':
    case 'SWAPPING':
    case 'INSERT':
    case 'INSERTING':
    case 'INSERT_HEAD':
    case 'INSERT_TAIL':
    case 'UPDATE':
    case 'UPDATING':
    case 'REPLACE':
    case 'REPLACING':
    case 'PUSH':
    case 'POP':
    case 'REORDER':
      return 'MODIFYING';

    case 'SUCCESS':
    case 'SORTED':
    case 'FOUND':
    case 'CONFIRMED':
    case 'FINALIZED':
    case 'MATCH':
    case 'MATCHED':
    case 'COMPLETED':
    case 'INSERTED':
    case 'PROCESSED':
      return 'SUCCESS';

    case 'DISCARDED':
    case 'ELIMINATED':
    case 'PRUNED':
    case 'PRUNE':
    case 'OUT_OF_SCOPE':
    case 'DELETED':
    case 'DELETE':
    case 'DELETE_HEAD':
    case 'DELETE_TAIL':
    case 'REMOVED':
    case 'REMOVE':
    case 'MISMATCH':
    case 'NOT_FOUND':
    case 'NOT FOUND':
    case 'FAILURE':
    case 'INACTIVE':
      return 'DISCARDED';

    case 'AUXILIARY':
    case 'TEMP':
    case 'TEMPORARY':
    case 'HELPER':
    case 'INTERMEDIATE':
    case 'BUFFER':
    case 'SWAP_TEMP':
    case 'HEAD':
    case 'NULL':
    case 'BOUNDARY_NODE':
      return 'AUXILIARY';

    case 'STRUCTURAL':
    case 'ROOT':
    case 'LEAF':
    case 'PARENT':
    case 'CHILD':
    case 'SIBLING':
    case 'ANCESTORS':
    case 'DESCENDANTS':
    case 'VIEW':
    case 'LEFT_VIEW':
    case 'RIGHT_VIEW':
    case 'TOP_VIEW':
    case 'BOTTOM_VIEW':
    case 'BOUNDARY':
    case 'DIAGONAL':
      return 'STRUCTURAL';

    case 'NEUTRAL':
    case 'DEFAULT':
    case 'IDLE':
    case 'UNVISITED':
    case 'DISCOVERED':
    case 'RESET':
    case 'START':
    case 'END':
    default:
      // If it matches a hex color of a known palette token, resolve that token
      if (stateName.startsWith('#')) {
        const keys = Object.keys(SEMANTIC_PALETTE) as SemanticState[];
        for (const key of keys) {
          const token = SEMANTIC_PALETTE[key];
          if (token.color.toLowerCase() === stateName.toLowerCase()) {
            return token.name;
          }
        }
      }
      return 'NEUTRAL';
  }
}

/**
 * Retrieves the full SemanticColorToken corresponding to a state name, alias, or token key.
 */
export function getSemanticColorToken(stateOrToken?: string | SemanticState): SemanticColorToken {
  const canonicalState = normalizeSemanticState(stateOrToken);
  return SEMANTIC_PALETTE[canonicalState];
}

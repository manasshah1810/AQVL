import { SemanticState, getSemanticColorToken, normalizeSemanticState } from './semanticColors';

export type AnticipationType =
  | 'SELECTION'
  | 'COMPARISON'
  | 'SWAP'
  | 'INSERTION'
  | 'DELETION'
  | 'UPDATE'
  | 'TRAVERSAL'
  | 'POINTER'
  | 'TREE_OP'
  | 'LINK';

export interface AnticipationConfig {
  /** Anticipation phase duration in milliseconds (100–200 ms, default 150 ms) */
  duration: number;
  /** Accelerating easing curve for anticipation preparation */
  easing: string;
  /** Scale factor multiplier during anticipation phase */
  scaleMultiplier: number;
  /** Position nudge offset during anticipation phase */
  positionNudge: { x: number; y: number; z: number };
  /** Additive emissive intensity boost during anticipation */
  emissiveBoost: number;
  /** Target opacity preparation if fading/deleting */
  opacityPrep?: number;
  /** Preview semantic state color token to introduce intention */
  previewSemanticState: SemanticState;
}

export const ANTICIPATION_DEFAULT_DURATION = 150;
export const ANTICIPATION_DEFAULT_EASING = 'easeInQuad';

export const ANTICIPATION_PALETTE: Record<AnticipationType, AnticipationConfig> = {
  SELECTION: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.94,
    positionNudge: { x: 0, y: 0, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'EVALUATING',
  },
  COMPARISON: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.94,
    positionNudge: { x: 0, y: -0.15, z: 0 },
    emissiveBoost: 0.25,
    previewSemanticState: 'EVALUATING',
  },
  SWAP: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.93,
    positionNudge: { x: 0, y: -0.20, z: 0 },
    emissiveBoost: 0.25,
    previewSemanticState: 'MODIFYING',
  },
  INSERTION: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 1.06,
    positionNudge: { x: 0, y: 0.15, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'MODIFYING',
  },
  DELETION: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.88,
    positionNudge: { x: 0, y: 0, z: 0 },
    emissiveBoost: 0.20,
    opacityPrep: 0.70,
    previewSemanticState: 'DISCARDED',
  },
  UPDATE: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.92,
    positionNudge: { x: 0, y: 0, z: 0 },
    emissiveBoost: 0.25,
    previewSemanticState: 'MODIFYING',
  },
  TRAVERSAL: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 1.05,
    positionNudge: { x: 0, y: 0.05, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'TRAVERSING',
  },
  POINTER: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.94,
    positionNudge: { x: -0.10, y: 0, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'TRAVERSING',
  },
  TREE_OP: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.94,
    positionNudge: { x: 0, y: -0.10, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'STRUCTURAL',
  },
  LINK: {
    duration: 150,
    easing: 'easeInQuad',
    scaleMultiplier: 0.94,
    positionNudge: { x: 0, y: 0, z: 0 },
    emissiveBoost: 0.20,
    previewSemanticState: 'AUXILIARY',
  },
};

/**
 * Normalizes an operation name or string alias to a canonical AnticipationType.
 */
export function normalizeAnticipationType(typeStr?: string): AnticipationType {
  if (!typeStr) return 'SELECTION';
  const s = typeStr.trim().toUpperCase();

  switch (s) {
    case 'HIGHLIGHT':
    case 'HIGHLIGHT_OBJECT':
    case 'SELECT':
    case 'SELECTION':
    case 'FOCUS':
      return 'SELECTION';

    case 'COMPARE':
    case 'COMPARE_OBJECTS':
    case 'COMPARISON':
    case 'EVALUATE':
    case 'CHECK':
      return 'COMPARISON';

    case 'SWAP':
    case 'SWAP_OBJECTS':
    case 'REORDER':
      return 'SWAP';

    case 'INSERT':
    case 'INSERT_HEAD':
    case 'INSERT_TAIL':
    case 'INSERTION':
    case 'PUSH':
      return 'INSERTION';

    case 'DELETE':
    case 'DELETE_HEAD':
    case 'DELETE_TAIL':
    case 'DELETION':
    case 'REMOVE':
    case 'PRUNE':
    case 'REMOVE_LEAVES':
    case 'POP':
      return 'DELETION';

    case 'UPDATE':
    case 'REPLACE':
    case 'SET_VALUE':
      return 'UPDATE';

    case 'TRAVERSE':
    case 'TRAVERSAL':
    case 'SEARCH':
    case 'PREORDER':
    case 'INORDER':
    case 'POSTORDER':
    case 'LEVELORDER':
    case 'REVERSELEVELORDER':
    case 'ZIGZAG':
    case 'DFS':
    case 'BFS':
      return 'TRAVERSAL';

    case 'POINTER':
    case 'ROOT':
    case 'CHILD':
    case 'PARENT':
    case 'LEFT_CHILD':
    case 'RIGHT_CHILD':
    case 'SIBLING':
    case 'ANCESTORS':
    case 'DESCENDANTS':
      return 'POINTER';

    case 'MIRROR':
    case 'INVERT':
    case 'CLONE':
    case 'COPY':
    case 'TREE_OP':
    case 'TREE':
      return 'TREE_OP';

    case 'LINK':
    case 'LINK_OBJECTS':
    case 'DISCONNECT':
    case 'UNLINK':
      return 'LINK';

    default:
      return 'SELECTION';
  }
}

/**
 * Resolves the complete AnticipationConfig for a given operation type or alias.
 */
export function getAnticipationConfig(typeOrAlias?: string | AnticipationType): AnticipationConfig {
  const canonicalType = normalizeAnticipationType(typeOrAlias);
  return ANTICIPATION_PALETTE[canonicalType];
}

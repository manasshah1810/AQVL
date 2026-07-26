export type {
  AQIRProgram,
  AQIRObject,
  AQIRInstruction,
  CompareObjectsInstruction,
  SwapObjectsInstruction,
  HighlightObjectInstruction,
  LoopInstruction,
  WaitInstruction,
  LinkObjectsInstruction,
  GenericActionInstruction,
  SetStateInstruction,
} from './aqir/types';

export {
  SEMANTIC_PALETTE,
  normalizeSemanticState,
  getSemanticColorToken,
} from './theme/semanticColors';

export type {
  SemanticState,
  SemanticColorToken,
} from './theme/semanticColors';

export {
  HIGHLIGHT_PALETTE,
  normalizeHighlightType,
  isElementActive,
  isElementHighlighted,
  getHighlightAccentColor,
  getHighlightConfig,
  VISUAL_HIERARCHY_CONFIG,
} from './theme/highlightStyle';

export type {
  HighlightType,
  HighlightStyleConfig,
  VisualHierarchyConfig,
} from './theme/highlightStyle';

export {
  MATERIAL_PRESETS,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
} from './theme/materialSystem';

export type {
  MaterialCategory,
  MaterialPresetConfig,
  UnifiedMaterialProperties,
  MaterialEvaluationOptions,
} from './theme/materialSystem';

export {
  ANTICIPATION_DEFAULT_DURATION,
  ANTICIPATION_DEFAULT_EASING,
  ANTICIPATION_PALETTE,
  normalizeAnticipationType,
  getAnticipationConfig,
} from './theme/anticipationSystem';

export type {
  AnticipationType,
  AnticipationConfig,
} from './theme/anticipationSystem';


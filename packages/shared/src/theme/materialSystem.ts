import * as THREE from 'three';
import {
  getSemanticColorToken,
  normalizeSemanticState,
  SemanticColorToken,
  SemanticState,
} from './semanticColors';
import {
  getHighlightAccentColor,
  getHighlightConfig,
  isElementActive,
  VISUAL_HIERARCHY_CONFIG,
} from './highlightStyle';

export type MaterialCategory = 'NODE' | 'EDGE' | 'RING' | 'CONTAINER' | 'POINTER';

export interface MaterialPresetConfig {
  category: MaterialCategory;
  roughness: number;
  metalness: number;
  baseEmissiveIntensityMultiplier: number;
  defaultOpacity: number;
  transparentByDefault: boolean;
  bevelRadius?: number;
  lineWidth?: number;
}

/**
 * Standardized surface finish & material presets for visual categories in AQVL.
 * Acts as the single source of truth for all visual material characteristics.
 */
export const MATERIAL_PRESETS: Record<MaterialCategory, MaterialPresetConfig> = {
  NODE: {
    category: 'NODE',
    roughness: 0.2,
    metalness: 0.1,
    baseEmissiveIntensityMultiplier: 1.0,
    defaultOpacity: 1.0,
    transparentByDefault: false,
    bevelRadius: 0.1,
  },
  EDGE: {
    category: 'EDGE',
    roughness: 0.3,
    metalness: 0.2,
    baseEmissiveIntensityMultiplier: 1.0,
    defaultOpacity: 0.45,
    transparentByDefault: true,
    lineWidth: 2.5,
  },
  RING: {
    category: 'RING',
    roughness: 0.1,
    metalness: 0.3,
    baseEmissiveIntensityMultiplier: 1.2,
    defaultOpacity: 0.85,
    transparentByDefault: true,
  },
  CONTAINER: {
    category: 'CONTAINER',
    roughness: 0.4,
    metalness: 0.05,
    baseEmissiveIntensityMultiplier: 0.5,
    defaultOpacity: 0.35,
    transparentByDefault: true,
  },
  POINTER: {
    category: 'POINTER',
    roughness: 0.2,
    metalness: 0.1,
    baseEmissiveIntensityMultiplier: 1.1,
    defaultOpacity: 1.0,
    transparentByDefault: false,
  },
};

export interface UnifiedMaterialProperties {
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  wireframe?: boolean;
}

export interface MaterialEvaluationOptions {
  category?: MaterialCategory;
  state?: string | SemanticState;
  color?: string;
  emissiveColor?: string;
  emissiveIntensity?: number;
  opacity?: number;
  isHighlighted?: boolean;
  highlightProgress?: number; // 0.0 to 1.0
  time?: number; // Current elapsedTime for pulse glows
}

/**
 * Resolves standard Unified Material properties for any rendered element or object in AQVL.
 */
export function getUnifiedMaterialConfig(
  options: MaterialEvaluationOptions
): UnifiedMaterialProperties {
  const category = options.category ?? 'NODE';
  const preset = MATERIAL_PRESETS[category];

  const canonicalState = normalizeSemanticState(options.state);
  const token: SemanticColorToken = getSemanticColorToken(canonicalState || options.color);
  
  const currentProgress = options.highlightProgress ?? 0;
  const time = options.time ?? 0;

  // Resolve base color and target accent color
  const targetBaseColor = options.color || token.color;
  const targetBaseEmissive = options.emissiveColor || token.emissiveColor;
  const baseEmissiveIntensity =
    (options.emissiveIntensity !== undefined
      ? options.emissiveIntensity
      : token.emissiveIntensity) * preset.baseEmissiveIntensityMultiplier;

  const highlightAccent = getHighlightAccentColor({
    state: options.state,
    color: options.color,
    emissiveColor: options.emissiveColor,
  });
  const highlightConfig = getHighlightConfig({
    state: options.state,
  });

  // Color lerping towards active accent color
  const colorObj = new THREE.Color(targetBaseColor);
  if (currentProgress > 0.01) {
    const accentObj = new THREE.Color(highlightAccent.color);
    colorObj.lerp(accentObj, currentProgress * 0.7);
  }

  // Emissive color lerping towards highlight accent
  const emissiveObj = new THREE.Color(targetBaseEmissive);
  if (currentProgress > 0.01) {
    const accentEmissive = new THREE.Color(highlightAccent.emissiveColor);
    emissiveObj.lerp(accentEmissive, currentProgress);
  }

  // Calculate dynamic emissive intensity with subtle pulse frequency
  const pulse =
    currentProgress > 0.05
      ? Math.sin(time * highlightConfig.pulseFrequency) * highlightConfig.pulseAmplitude
      : 0;
  const activeEmissive = baseEmissiveIntensity + highlightConfig.emissiveBoost + pulse;
  const inactiveEmissive = Math.min(
    baseEmissiveIntensity,
    VISUAL_HIERARCHY_CONFIG.inactiveEmissiveIntensity
  );
  const emissiveIntensity = THREE.MathUtils.lerp(
    inactiveEmissive,
    activeEmissive,
    currentProgress
  );

  // Compute final opacity based on category defaults and state rules
  let targetOpacity = preset.defaultOpacity;
  if (options.opacity !== undefined) {
    targetOpacity = options.opacity;
  } else if (category === 'CONTAINER') {
    targetOpacity = preset.defaultOpacity;
  } else if (canonicalState === 'SUCCESS') {
    targetOpacity = token.opacity ?? 1.0;
  } else if (canonicalState === 'DISCARDED') {
    targetOpacity = token.opacity ?? 0.35;
  } else if (category === 'EDGE') {
    targetOpacity = THREE.MathUtils.lerp(0.35, 1.0, currentProgress);
  } else {
    targetOpacity = THREE.MathUtils.lerp(
      VISUAL_HIERARCHY_CONFIG.inactiveOpacity,
      VISUAL_HIERARCHY_CONFIG.activeOpacity,
      currentProgress
    );
  }

  return {
    color: colorObj,
    emissive: emissiveObj,
    emissiveIntensity,
    roughness: preset.roughness,
    metalness: preset.metalness,
    opacity: targetOpacity,
    transparent: preset.transparentByDefault || targetOpacity < 0.99,
  };
}

/**
 * High-performance helper to apply unified material configuration in-place onto a THREE.MeshStandardMaterial.
 * Prevents unnecessary material allocations and memory thrashing during animation frames.
 */
export function applyUnifiedMaterial(
  material: THREE.MeshStandardMaterial | null | undefined,
  config: UnifiedMaterialProperties
): void {
  if (!material) return;

  material.color.copy(config.color);
  material.emissive.copy(config.emissive);
  material.emissiveIntensity = config.emissiveIntensity;
  material.roughness = config.roughness;
  material.metalness = config.metalness;
  material.opacity = config.opacity;
  material.transparent = config.transparent;
}

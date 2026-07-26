import {
  MATERIAL_PRESETS,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
} from '../packages/shared/src/theme/materialSystem';
import * as THREE from 'three';

console.log('Running Unified Material System verification tests...');

// Test 1: Material Presets
console.assert(MATERIAL_PRESETS.NODE.roughness === 0.2, 'NODE roughness should be 0.2');
console.assert(MATERIAL_PRESETS.NODE.metalness === 0.1, 'NODE metalness should be 0.1');
console.assert(MATERIAL_PRESETS.EDGE.roughness === 0.3, 'EDGE roughness should be 0.3');
console.assert(MATERIAL_PRESETS.EDGE.metalness === 0.2, 'EDGE metalness should be 0.2');
console.assert(MATERIAL_PRESETS.RING.roughness === 0.1, 'RING roughness should be 0.1');
console.assert(MATERIAL_PRESETS.RING.metalness === 0.3, 'RING metalness should be 0.3');
console.assert(MATERIAL_PRESETS.CONTAINER.roughness === 0.4, 'CONTAINER roughness should be 0.4');
console.assert(MATERIAL_PRESETS.CONTAINER.metalness === 0.05, 'CONTAINER metalness should be 0.05');
console.assert(MATERIAL_PRESETS.POINTER.roughness === 0.2, 'POINTER roughness should be 0.2');

// Test 2: Neutral Node Config
const neutralConfig = getUnifiedMaterialConfig({
  category: 'NODE',
  state: 'NEUTRAL',
  highlightProgress: 0,
});
console.assert(neutralConfig.roughness === 0.2, 'Neutral node roughness must match preset');
console.assert(neutralConfig.metalness === 0.1, 'Neutral node metalness must match preset');
console.assert(neutralConfig.color.getHexString() === '38bdf8', 'Neutral node color should match Sky Blue palette');

// Test 3: Evaluating Node Config (Highlight active)
const activeConfig = getUnifiedMaterialConfig({
  category: 'NODE',
  state: 'EVALUATING',
  highlightProgress: 1.0,
  time: 1.0,
});
console.assert(activeConfig.roughness === 0.2, 'Active node roughness must match preset');
console.assert(activeConfig.opacity === 1.0, 'Active node opacity must be 1.0');
console.assert(activeConfig.emissiveIntensity > 0.5, 'Active node emissive boost applied');

// Test 4: Discarded State Config
const discardedConfig = getUnifiedMaterialConfig({
  category: 'NODE',
  state: 'DISCARDED',
  highlightProgress: 0,
});
console.assert(discardedConfig.opacity === 0.4, 'Discarded opacity must be 0.4');
console.assert(discardedConfig.transparent === true, 'Discarded state must be transparent');

// Test 5: Container Config
const containerConfig = getUnifiedMaterialConfig({
  category: 'CONTAINER',
  state: 'AUXILIARY',
  highlightProgress: 0,
});
console.assert(containerConfig.roughness === 0.4, 'Container roughness must match preset');
console.assert(containerConfig.opacity === 0.35, 'Container default opacity must be 0.35');
console.assert(containerConfig.transparent === true, 'Container must be transparent');

// Test 6: applyUnifiedMaterial in-place
const testMaterial = new THREE.MeshStandardMaterial();
applyUnifiedMaterial(testMaterial, activeConfig);
console.assert(testMaterial.roughness === 0.2, 'Applied roughness matches');
console.assert(testMaterial.metalness === 0.1, 'Applied metalness matches');
console.assert(testMaterial.color.getHexString() === activeConfig.color.getHexString(), 'Applied color matches');
console.assert(testMaterial.emissive.getHexString() === activeConfig.emissive.getHexString(), 'Applied emissive matches');

console.log('✅ ALL UNIFIED MATERIAL SYSTEM TESTS PASSED SUCCESSFULLY!');

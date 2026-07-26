import { 
  normalizeAnticipationType, 
  getAnticipationConfig, 
  ANTICIPATION_DEFAULT_DURATION, 
  ANTICIPATION_DEFAULT_EASING,
  ANTICIPATION_PALETTE
} from './anticipationSystem';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- Running Anticipation Motion System Unit Tests ---');

// Test 1: Normalizes operation aliases correctly
assert(normalizeAnticipationType('HIGHLIGHT_OBJECT') === 'SELECTION', 'HIGHLIGHT_OBJECT alias');
assert(normalizeAnticipationType('COMPARE_OBJECTS') === 'COMPARISON', 'COMPARE_OBJECTS alias');
assert(normalizeAnticipationType('SWAP_OBJECTS') === 'SWAP', 'SWAP_OBJECTS alias');
assert(normalizeAnticipationType('INSERT_HEAD') === 'INSERTION', 'INSERT_HEAD alias');
assert(normalizeAnticipationType('DELETE_TAIL') === 'DELETION', 'DELETE_TAIL alias');
assert(normalizeAnticipationType('UPDATE') === 'UPDATE', 'UPDATE alias');
assert(normalizeAnticipationType('PREORDER') === 'TRAVERSAL', 'PREORDER alias');
assert(normalizeAnticipationType('RIGHT_CHILD') === 'POINTER', 'RIGHT_CHILD alias');
assert(normalizeAnticipationType('MIRROR') === 'TREE_OP', 'MIRROR alias');
assert(normalizeAnticipationType('LINK_OBJECTS') === 'LINK', 'LINK_OBJECTS alias');
console.log('✓ Normalization tests passed');

// Test 2: Duration in 100-200ms range
const keys = Object.keys(ANTICIPATION_PALETTE) as (keyof typeof ANTICIPATION_PALETTE)[];
keys.forEach(key => {
  const config = ANTICIPATION_PALETTE[key];
  assert(config.duration >= 100 && config.duration <= 200, `${key} duration range`);
  assert(config.easing === ANTICIPATION_DEFAULT_EASING, `${key} default easing`);
});
console.log('✓ Duration (100-200ms) and Easing tests passed');

// Test 3: Specific operation parameters
const swapConfig = getAnticipationConfig('SWAP');
assert(swapConfig.scaleMultiplier === 0.93, 'Swap scale multiplier');
assert(swapConfig.positionNudge.y === -0.20, 'Swap position nudge Y');
assert(swapConfig.previewSemanticState === 'MODIFYING', 'Swap preview state');

const compareConfig = getAnticipationConfig('COMPARE_OBJECTS');
assert(compareConfig.scaleMultiplier === 0.94, 'Compare scale multiplier');
assert(compareConfig.positionNudge.y === -0.15, 'Compare position nudge Y');
assert(compareConfig.previewSemanticState === 'EVALUATING', 'Compare preview state');

const deletionConfig = getAnticipationConfig('DELETE');
assert(deletionConfig.scaleMultiplier === 0.88, 'Deletion scale multiplier');
assert(deletionConfig.opacityPrep === 0.70, 'Deletion opacity prep');
assert(deletionConfig.previewSemanticState === 'DISCARDED', 'Deletion preview state');

console.log('✓ Operation parameter tests passed');
console.log('ALL ANTICIPATION MOTION SYSTEM UNIT TESTS PASSED!');

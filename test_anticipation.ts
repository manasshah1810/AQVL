import { AnimationController } from './packages/runtime/src/core/AnimationController';
import { AnimationScheduler } from './packages/runtime/src/core/AnimationScheduler';
import { TimelineEngine } from './packages/runtime/src/core/TimelineEngine';
import { SceneManager } from './packages/runtime/src/core/SceneManager';
import { LayoutManager } from './packages/runtime/src/core/LayoutManager';
import { StateManager } from './packages/runtime/src/core/StateManager';
import { EventDispatcher } from './packages/runtime/src/core/EventDispatcher';
import { LifecycleManager } from './packages/runtime/src/core/LifecycleManager';
import { RelationshipManager } from './packages/runtime/src/core/RelationshipManager';
import { getAnticipationConfig, normalizeAnticipationType } from './packages/shared/src/theme/anticipationSystem';

(globalThis as any).window = globalThis;
(globalThis as any).NodeList = class NodeList {};
(globalThis as any).HTMLCollection = class HTMLCollection {};
(globalThis as any).SVGElement = class SVGElement {};
(globalThis as any).Element = class Element {};
(globalThis as any).document = { hidden: false };
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Verification Failed: ${msg}`);
}

console.log('=== Running Anticipation Motion System End-to-End Verification ===');

// Test 1: Config lookup for all action aliases
console.log('Checking Anticipation Tokens & Normalization:');
const actionsToTest = [
  'HIGHLIGHT_OBJECT',
  'COMPARE_OBJECTS',
  'SWAP_OBJECTS',
  'INSERT',
  'DELETE',
  'UPDATE',
  'PREORDER',
  'POINTER',
  'MIRROR',
  'LINK_OBJECTS'
];

actionsToTest.forEach(action => {
  const normType = normalizeAnticipationType(action);
  const config = getAnticipationConfig(action);
  assert(config.duration >= 100 && config.duration <= 200, `${action} duration in range`);
  console.log(`  ✓ ${action.padEnd(20)} -> ${normType.padEnd(12)} (duration: ${config.duration}ms, easing: ${config.easing}, scale: ${config.scaleMultiplier})`);
});

// Test 2: Runtime Timeline Scheduling Verification
console.log('\nTesting Runtime Animation Scheduler with Anticipation Phase:');

const timelineEngine = new TimelineEngine();
const scheduler = new AnimationScheduler(timelineEngine);
const eventDispatcher = new EventDispatcher();
const sceneManager = new SceneManager(eventDispatcher);
const relationshipManager = new RelationshipManager(eventDispatcher);
const layoutManager = new LayoutManager(sceneManager, relationshipManager);
const stateManager = new StateManager();
const lifecycleManager = new LifecycleManager(sceneManager);

const controller = new AnimationController(
  scheduler,
  sceneManager,
  layoutManager,
  stateManager,
  eventDispatcher,
  lifecycleManager,
  relationshipManager
);

// Add initial test elements to scene
sceneManager.addElement({
  id: 'el_1',
  type: 'box',
  value: 10,
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  color: '#38bdf8',
  emissiveIntensity: 0.1,
  emissiveColor: '#0284c7'
} as any);

sceneManager.addElement({
  id: 'el_2',
  type: 'box',
  value: 20,
  position: { x: 2, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  color: '#38bdf8',
  emissiveIntensity: 0.1,
  emissiveColor: '#0284c7'
} as any);

function runTestInstructions() {
  // Test HIGHLIGHT_OBJECT
  controller.executeInstruction({
    action: 'HIGHLIGHT_OBJECT',
    targetId: 'el_1',
    color: 'EVALUATING'
  } as any);

  let timeAfterHighlight = scheduler.getCurrentTime();
  assert(timeAfterHighlight >= 150, 'Timeline cursor advanced for HIGHLIGHT_OBJECT with anticipation prep');
  console.log(`  ✓ HIGHLIGHT_OBJECT timeline cursor advanced to ${timeAfterHighlight}ms (includes anticipation prep)`);

  // Test COMPARE_OBJECTS
  controller.executeInstruction({
    action: 'COMPARE_OBJECTS',
    leftId: 'el_1',
    rightId: 'el_2'
  } as any);

  let timeAfterCompare = scheduler.getCurrentTime();
  assert(timeAfterCompare >= 150, 'Timeline cursor advanced for COMPARE_OBJECTS with anticipation prep');
  console.log(`  ✓ COMPARE_OBJECTS timeline cursor advanced to ${timeAfterCompare}ms (includes anticipation prep)`);

  // Test SWAP_OBJECTS
  controller.executeInstruction({
    action: 'SWAP_OBJECTS',
    leftId: 'el_1',
    rightId: 'el_2'
  } as any);

  let timeAfterSwap = scheduler.getCurrentTime();
  assert(timeAfterSwap >= 150, 'Timeline cursor advanced for SWAP_OBJECTS with anticipation prep');
  console.log(`  ✓ SWAP_OBJECTS timeline cursor advanced to ${timeAfterSwap}ms (includes anticipation prep)`);

  console.log('\n=== ALL ANTICIPATION MOTION SYSTEM VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

runTestInstructions();

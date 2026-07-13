import type { AQIRInstruction, SwapObjectsInstruction, CompareObjectsInstruction, HighlightObjectInstruction } from '@aqvl/shared';
import { TimelineEngine } from './TimelineEngine';
import { SceneManager } from './SceneManager';
import { LayoutManager } from './LayoutManager';
import { StateManager } from './StateManager';
import { EventDispatcher } from './EventDispatcher';

export class AnimationController {
  private defaultColor = '#4facfe';

  constructor(
    private timelineEngine: TimelineEngine,
    private sceneManager: SceneManager,
    private layoutManager: LayoutManager,
    private stateManager: StateManager,
    private eventDispatcher: EventDispatcher
  ) {}

  public buildAnimations(instructions: AQIRInstruction[]): void {
    this.timelineEngine.init();

    instructions.forEach((instruction) => {
      switch (instruction.action) {
        case 'SWAP_OBJECTS': {
          const swp = instruction as SwapObjectsInstruction;
          const leftEl = this.sceneManager.getElement(swp.leftId) as any;
          const rightEl = this.sceneManager.getElement(swp.rightId) as any;
          
          if (leftEl && rightEl) {
            const leftTarget = this.layoutManager.getPositionForLogicalIndex(rightEl.logicalIndex);
            const rightTarget = this.layoutManager.getPositionForLogicalIndex(leftEl.logicalIndex);
            
            const originalLeftPos = { ...leftEl.position };
            const originalRightPos = { ...rightEl.position };

            // 1. Highlight and lift
            this.timelineEngine.addKeyframe({
              targets: [leftEl, rightEl],
              color: '#4caf50',
              emissiveColor: '#4caf50',
              emissiveIntensity: 0.8,
              duration: 300,
              easing: 'easeOutExpo'
            });

            this.timelineEngine.addKeyframe({
              targets: [leftEl.scale, rightEl.scale],
              x: 1.1, y: 1.1, z: 1.1,
              duration: 300,
              easing: 'easeOutExpo'
            }, '-=300');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.position, rightEl.position],
              y: 1.2,
              duration: 300,
              easing: 'easeOutExpo'
            }, '-=300');

            // 2. Pause briefly
            this.timelineEngine.addKeyframe({
              targets: {},
              duration: 200
            });

            // 3. Move horizontally with slight Z-arc
            this.timelineEngine.addKeyframe({
              targets: leftEl.position,
              x: leftTarget.x,
              z: 0.5,
              duration: 600,
              easing: 'easeInOutCubic'
            });

            this.timelineEngine.addKeyframe({
              targets: rightEl.position,
              x: rightTarget.x,
              z: -0.5,
              duration: 600,
              easing: 'easeInOutCubic'
            }, '-=600');

            // 4. Lower to new position
            this.timelineEngine.addKeyframe({
              targets: leftEl.position,
              y: leftTarget.y,
              z: leftTarget.z,
              duration: 350,
              easing: 'easeOutBounce'
            });

            this.timelineEngine.addKeyframe({
              targets: rightEl.position,
              y: rightTarget.y,
              z: rightTarget.z,
              duration: 350,
              easing: 'easeOutBounce'
            }, '-=350');

            // 5. Swap values, snap positions back, and save state
            this.timelineEngine.addKeyframe({
              duration: 1,
              complete: () => {
                const tempVal = leftEl.value;
                leftEl.value = rightEl.value;
                rightEl.value = tempVal;

                leftEl.position.x = originalLeftPos.x;
                leftEl.position.y = originalLeftPos.y;
                leftEl.position.z = originalLeftPos.z;

                rightEl.position.x = originalRightPos.x;
                rightEl.position.y = originalRightPos.y;
                rightEl.position.z = originalRightPos.z;

                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Swapped ${leftEl.id} and ${rightEl.id}`);
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                
                console.log(`[Runtime] State after SWAP ${leftEl.id} and ${rightEl.id}:`);
                this.sceneManager.getSceneGraph().forEach((el: any) => {
                  console.log(`  ${el.id} (Index ${el.logicalIndex}): ${el.value}`);
                });
              }
            }, '+=0');

            // 6. Remove highlight
            this.timelineEngine.addKeyframe({
              targets: [leftEl, rightEl],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            }, '+=0');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.scale, rightEl.scale],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            }, '-=300');
          }
          break;
        }
        case 'COMPARE_OBJECTS': {
          const cmp = instruction as CompareObjectsInstruction;
          const leftEl = this.sceneManager.getElement(cmp.leftId) as any;
          const rightEl = this.sceneManager.getElement(cmp.rightId) as any;
          
          if (leftEl && rightEl) {
            const originalLeftPos = { ...leftEl.position };
            const originalRightPos = { ...rightEl.position };

            // Highlight, scale up, lift, emissive glow
            this.timelineEngine.addKeyframe({
              targets: [leftEl, rightEl],
              color: '#ffeb3b',
              emissiveColor: '#ffeb3b',
              emissiveIntensity: 0.5,
              duration: 400,
              easing: 'easeOutExpo',
              complete: () => {
                console.log(`[Runtime] COMPARE ${leftEl.id} (${leftEl.value}) and ${rightEl.id} (${rightEl.value})`);
              }
            }, '+=0');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.scale, rightEl.scale],
              x: 1.15, y: 1.15, z: 1.15,
              duration: 400,
              easing: 'easeOutExpo'
            }, '-=400');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.position, rightEl.position],
              y: 0.3,
              duration: 400,
              easing: 'easeOutExpo'
            }, '-=400');

            // Pause briefly
            this.timelineEngine.addKeyframe({
              targets: {},
              duration: 300
            });

            // Return to normal
            this.timelineEngine.addKeyframe({
              targets: [leftEl, rightEl],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            }, '+=0');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.scale, rightEl.scale],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            }, '-=300');

            this.timelineEngine.addKeyframe({
              targets: [leftEl.position, rightEl.position],
              y: originalLeftPos.y, // both should go to original y
              duration: 300,
              easing: 'easeInOutQuad'
            }, '-=300');
          }
          break;
        }
        case 'HIGHLIGHT_OBJECT': {
          const hl = instruction as HighlightObjectInstruction;
          const targetEl = this.sceneManager.getElement(hl.targetId);
          if (targetEl) {
            this.timelineEngine.addKeyframe({
              targets: targetEl,
              color: hl.color,
              emissiveColor: hl.color,
              emissiveIntensity: 0.3,
              duration: 400
            }, '+=0');
          }
          break;
        }
        case 'WAIT': {
          this.timelineEngine.addKeyframe({
            targets: {},
            duration: 800
          }, '+=0');
          break;
        }
      }
    });
  }
}

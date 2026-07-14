import type { AQIRInstruction, SwapObjectsInstruction, CompareObjectsInstruction, HighlightObjectInstruction, LinkObjectsInstruction, GenericActionInstruction, SetStateInstruction } from '@aqvl/shared';
import { AnimationScheduler } from './AnimationScheduler';
import { SceneManager } from './SceneManager';
import { LayoutManager } from './LayoutManager';
import { StateManager } from './StateManager';
import { EventDispatcher } from './EventDispatcher';

import { LifecycleManager } from './LifecycleManager';
import { RelationshipManager } from './RelationshipManager';
import { AnimationContext, MoveAnimation } from './animations';

export class AnimationController {
  private defaultColor = '#4facfe';

  constructor(
    private animationScheduler: AnimationScheduler,
    private sceneManager: SceneManager,
    private layoutManager: LayoutManager,
    private stateManager: StateManager,
    private eventDispatcher: EventDispatcher,
    private lifecycleManager: LifecycleManager,
    private relationshipManager: RelationshipManager
  ) {}

  public async executeInstruction(instruction: AQIRInstruction): Promise<void> {
    return new Promise((resolve) => {
      this.animationScheduler.init(resolve);
      
      const animCtx: AnimationContext = {
        scheduler: this.animationScheduler,
        sceneManager: this.sceneManager,
        layoutManager: this.layoutManager
      };

      console.log(`[AnimationController] Executing instruction:`, JSON.stringify(instruction));

      switch (instruction.action) {
        case 'HIGHLIGHT_OBJECT': {
          const hl = instruction as HighlightObjectInstruction;
          const targetEl = this.sceneManager.getElement(hl.targetId);
          if (targetEl) {
            this.animationScheduler.enqueue({
              targets: targetEl,
              color: hl.color,
              emissiveColor: hl.color,
              emissiveIntensity: 0.5,
              duration: 400,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.enqueue({
              targets: targetEl.scale,
              x: 1.1, y: 1.1, z: 1.1,
              duration: 400,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.advanceCursor(200);

            this.animationScheduler.enqueue({
              targets: targetEl,
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 400,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.enqueue({
              targets: targetEl.scale,
              x: 1, y: 1, z: 1,
              duration: 400,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.commitGroup(true);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Highlighted ${hl.targetId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitSequential();
          }
          break;
        }

        case 'SWAP_OBJECTS': {
          const swp = instruction as SwapObjectsInstruction;
          const leftEl = this.sceneManager.getElement(swp.leftId) as any;
          const rightEl = this.sceneManager.getElement(swp.rightId) as any;
          
          if (leftEl && rightEl) {
            const leftIndex = leftEl.logicalIndex;
            const rightIndex = rightEl.logicalIndex;

            // Synchronously swap and compute layout
            leftEl.logicalIndex = rightIndex;
            rightEl.logicalIndex = leftIndex;
            this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: '#4caf50',
              emissiveColor: '#4caf50',
              emissiveIntensity: 0.8,
              duration: 300,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1.1, y: 1.1, z: 1.1,
              duration: 300,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.enqueue({
              targets: [leftEl.position, rightEl.position],
              y: (el: any) => el.y + 1.8,
              duration: 300,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.advanceCursor(200);

            if (leftEl.worldTarget) {
              this.animationScheduler.enqueue({
                targets: leftEl.position,
                x: leftEl.worldTarget.x,
                z: leftEl.worldTarget.z + 1.5,
                duration: 600,
                easing: 'easeInOutSine'
              });
            }
            if (rightEl.worldTarget) {
              this.animationScheduler.enqueue({
                targets: rightEl.position,
                x: rightEl.worldTarget.x,
                z: rightEl.worldTarget.z - 1.5,
                duration: 600,
                easing: 'easeInOutSine'
              });
            }
            this.animationScheduler.commitGroup(true);

            if (leftEl.worldTarget) {
              this.animationScheduler.enqueue({
                targets: leftEl.position,
                y: leftEl.worldTarget.y,
                z: leftEl.worldTarget.z,
                duration: 350,
                easing: 'easeOutBounce'
              });
            }
            if (rightEl.worldTarget) {
              this.animationScheduler.enqueue({
                targets: rightEl.position,
                y: rightEl.worldTarget.y,
                z: rightEl.worldTarget.z,
                duration: 350,
                easing: 'easeOutBounce'
              });
            }
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.commitGroup(true);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                leftEl.label = `${leftEl.logicalParent}[${leftEl.logicalIndex}]`;
                rightEl.label = `${rightEl.logicalParent}[${rightEl.logicalIndex}]`;
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Swapped ${swp.leftId} and ${swp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitSequential();
          }
          break;
        }

        case 'COMPARE_OBJECTS': {
          const cmp = instruction as CompareObjectsInstruction;
          const leftEl = this.sceneManager.getElement(cmp.leftId) as any;
          const rightEl = this.sceneManager.getElement(cmp.rightId) as any;
          
          if (leftEl && rightEl) {
            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: '#ffeb3b',
              emissiveColor: '#ffeb3b',
              emissiveIntensity: 0.5,
              duration: 400,
              easing: 'easeOutExpo'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1.15, y: 1.15, z: 1.15,
              duration: 400,
              easing: 'easeOutExpo'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.position, rightEl.position],
              y: '+=0.3',
              duration: 400,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.advanceCursor(300);

            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.position, rightEl.position],
              y: '-=0.3',
              duration: 300,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.commitGroup(true);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                leftEl.label = `${leftEl.logicalParent}[${leftEl.logicalIndex}]`;
                rightEl.label = `${rightEl.logicalParent}[${rightEl.logicalIndex}]`;
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Compared ${cmp.leftId} and ${cmp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitSequential();
          }
          break;
        }

        case 'GENERIC_ACTION': {
          const gen = instruction as GenericActionInstruction;
          const actionName = gen.actionName.toUpperCase();
          console.log(`[AnimationController] Executing GENERIC_ACTION ${actionName} with targetId ${gen.targetId}`, gen);
          
          if (actionName === 'INSERT') {
            const logicalParent = (gen as any).payload?.logicalParent;
            const insertIndex = (gen as any).payload?.logicalIndex;
            const valueToInsert = gen.args?.[gen.args.length - 1];

            if (logicalParent !== undefined && insertIndex !== undefined) {
              const allContainerEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const nodeEls = allContainerEls.filter((el: any) => el.originalType !== 'EDGE');
              const elsToShift = nodeEls.filter((el: any) => el.logicalIndex >= insertIndex);
              
              const isLinkedList = nodeEls.some((el: any) => el.originalType === 'LINKEDLIST_NODE');

              // Synchronous update
              elsToShift.forEach((el: any) => el.logicalIndex += 1);
              
              const newElId = `obj_dyn_${Date.now()}_${insertIndex}`;
              const newEl: any = {
                id: newElId,
                type: isLinkedList ? 'sphere' : 'box',
                value: valueToInsert,
                logicalIndex: insertIndex,
                index: insertIndex,
                logicalParent: logicalParent,
                originalType: isLinkedList ? 'LINKEDLIST_NODE' : 'ARRAY_ELEMENT',
                label: `${logicalParent}[${insertIndex}]`,
                position: { x: 0, y: -5, z: 0 },
                scale: { x: 0, y: 0, z: 0 },
                color: '#4facfe',
                emissiveIntensity: 0,
                emissiveColor: '#000000',
                lifecycleState: 'ACTIVE',
                visible: true,
                opacity: 1
              };
              this.sceneManager.addElement(newEl);

              let edgeToRemove: string | null = null;
              if (isLinkedList) {
                const prevNode = nodeEls.find((el: any) => el.logicalIndex === insertIndex - 1);
                const nextNode = elsToShift.find((el: any) => el.logicalIndex === insertIndex + 1);
                
                if (prevNode && nextNode) {
                  const oldEdge = allContainerEls.find((el: any) => el.originalType === 'EDGE' && el.sourceId === prevNode.id && el.targetId === nextNode.id);
                  if (oldEdge) {
                     edgeToRemove = oldEdge.id;
                     this.sceneManager.removeElement(edgeToRemove);
                  }
                }
                
                if (prevNode) {
                  const edge1 = `edge_dyn_${prevNode.id}_${newElId}`;
                  this.sceneManager.addElement({
                    id: edge1,
                    type: 'edge',
                    position: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: '#888888',
                    sourceId: prevNode.id,
                    targetId: newElId,
                    directed: true,
                    logicalParent: logicalParent,
                    originalType: 'EDGE'
                  } as any);
                  this.relationshipManager.addRelationship({
                    id: edge1, sourceId: prevNode.id, targetId: newElId, type: 'edge', directed: true
                  });
                }
                if (nextNode) {
                  const edge2 = `edge_dyn_${newElId}_${nextNode.id}`;
                  this.sceneManager.addElement({
                    id: edge2,
                    type: 'edge',
                    position: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: '#888888',
                    sourceId: newElId,
                    targetId: nextNode.id,
                    directed: true,
                    logicalParent: logicalParent,
                    originalType: 'EDGE'
                  } as any);
                  this.relationshipManager.addRelationship({
                    id: edge2, sourceId: newElId, targetId: nextNode.id, type: 'edge', directed: true
                  });
                }
              }

              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

              if (newEl.worldTarget) {
                 newEl.position.x = newEl.worldTarget.x;
                 newEl.position.z = newEl.worldTarget.z;
              }
              
              // Animate ALL elements to their new centered world target
              const updatedContainerEls = nodeEls.filter((el: any) => el.id !== newEl.id);
              updatedContainerEls.forEach((el: any) => {
                if (el.worldTarget) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: el.worldTarget.x,
                    y: el.worldTarget.y,
                    z: el.worldTarget.z,
                    duration: 500,
                    easing: 'easeOutCubic'
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              
              if (newEl.worldTarget) {
                this.animationScheduler.enqueue({
                  targets: newEl.position,
                  y: newEl.worldTarget.y,
                  duration: 600,
                  easing: 'easeOutBounce'
                });
                this.animationScheduler.enqueue({
                  targets: newEl.scale,
                  x: 1, y: 1, z: 1,
                  duration: 600,
                  easing: 'easeOutBack'
                });
                this.animationScheduler.commitGroup(true);
              }
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  updatedContainerEls.forEach((el: any) => {
                    el.label = `${el.logicalParent}[${el.logicalIndex}]`;
                  });
                  newEl.label = `${newEl.logicalParent}[${newEl.logicalIndex}]`;
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Inserted ${valueToInsert} at index ${insertIndex}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              });
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'DELETE') {
            const logicalParent = (gen as any).payload?.logicalParent;
            const deleteIndex = (gen as any).payload?.logicalIndex;
            const targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            
            if (logicalParent !== undefined && deleteIndex !== undefined && targetEl) {
              const allContainerEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const nodeEls = allContainerEls.filter((el: any) => el.originalType !== 'EDGE');
              const elsToShift = nodeEls.filter((el: any) => el.logicalIndex > deleteIndex);
              
              const isLinkedList = nodeEls.some((el: any) => el.originalType === 'LINKEDLIST_NODE');

              // Synchronous layout update
              elsToShift.forEach((el: any) => el.logicalIndex -= 1);
              
              if (isLinkedList) {
                const prevNode = nodeEls.find((el: any) => el.logicalIndex === deleteIndex - 1);
                const nextNode = elsToShift.find((el: any) => el.logicalIndex === deleteIndex);
                
                // Remove edges connected to targetEl
                const oldEdges = allContainerEls.filter((el: any) => el.originalType === 'EDGE' && (el.sourceId === targetEl.id || el.targetId === targetEl.id));
                oldEdges.forEach((e: any) => this.sceneManager.removeElement(e.id));
                
                if (prevNode && nextNode) {
                  const newEdgeId = `edge_dyn_${prevNode.id}_${nextNode.id}`;
                  this.sceneManager.addElement({
                    id: newEdgeId,
                    type: 'edge',
                    position: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: '#888888',
                    sourceId: prevNode.id,
                    targetId: nextNode.id,
                    directed: true,
                    logicalParent: logicalParent,
                    originalType: 'EDGE'
                  } as any);
                  this.relationshipManager.addRelationship({
                    id: newEdgeId, sourceId: prevNode.id, targetId: nextNode.id, type: 'edge', directed: true
                  });
                }
              }
              
              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
              
              // Animate removal
              this.animationScheduler.enqueue({
                targets: targetEl.scale,
                x: 0, y: 0, z: 0,
                duration: 500,
                easing: 'easeInBack'
              });
              this.animationScheduler.enqueue({
                targets: targetEl.position,
                y: '+=2',
                duration: 500,
                easing: 'easeInBack'
              });
              this.animationScheduler.commitGroup(true);
              
              // Animate ALL remaining elements to re-center
              const remainingEls = nodeEls.filter((el: any) => el.id !== targetEl.id);
              remainingEls.forEach((el: any) => {
                if (el.worldTarget) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: el.worldTarget.x,
                    y: el.worldTarget.y,
                    z: el.worldTarget.z,
                    duration: 500,
                    easing: 'easeOutCubic'
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.sceneManager.removeElement(targetEl.id);
                  remainingEls.forEach((el: any) => {
                    el.label = `${el.logicalParent}[${el.logicalIndex}]`;
                  });
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Deleted item at index ${deleteIndex}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              });
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'UPDATE') {
            const targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            if (targetEl) {
              const newValue = gen.args?.[gen.args.length - 1];
              this.animationScheduler.enqueue({
                targets: targetEl,
                color: '#ff9800',
                emissiveColor: '#ff9800',
                emissiveIntensity: 0.8,
                duration: 300,
                easing: 'easeOutExpo'
              });
              this.animationScheduler.enqueue({
                targets: targetEl.scale,
                x: 1.2, y: 1.2, z: 1.2,
                duration: 300,
                easing: 'easeOutExpo'
              });
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  targetEl.value = newValue;
                }
              });
              this.animationScheduler.commitSequential();
              
              this.animationScheduler.enqueue({
                targets: targetEl,
                color: this.defaultColor,
                emissiveIntensity: 0,
                duration: 400,
                easing: 'easeOutQuad'
              });
              this.animationScheduler.enqueue({
                targets: targetEl.scale,
                x: 1, y: 1, z: 1,
                duration: 400,
                easing: 'easeOutQuad',
                complete: () => {
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Updated value to ${newValue}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (actionName === 'DISCONNECT') {
            const sourceId = gen.args[0];
            const targetId = gen.args[1];
            if (typeof sourceId === 'string' && typeof targetId === 'string') {
              const allEls = this.sceneManager.getSceneGraph();
              const edgeToRemove = allEls.find((el: any) => el.type === 'edge' && el.sourceId === sourceId && el.targetId === targetId);
              if (edgeToRemove) {
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => {
                    this.sceneManager.removeElement(edgeToRemove.id);
                    this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Disconnected ${sourceId} from ${targetId}`, this.animationScheduler.getCurrentTime());
                    this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  }
                });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(300);
              }
            }
          }
          break;
        }

        case 'LINK_OBJECTS':
        case 'SET_STATE':
          console.warn(`[AnimationController] ${instruction.action} is not fully ported to sequential testing yet.`);
          break;
          
        case 'UPDATE_LAYOUT': {
          this.layoutManager.updateLayout();
          break;
        }

        case 'WAIT': {
          this.animationScheduler.advanceCursor(500);
          break;
        }
      }

      this.animationScheduler.play();
    });
  }

  public buildAnimations(instructions: AQIRInstruction[]): void {
    this.animationScheduler.init();
    
    const animCtx: AnimationContext = {
      scheduler: this.animationScheduler,
      sceneManager: this.sceneManager,
      layoutManager: this.layoutManager
    };

    // Create a virtual graph to simulate structural changes during timeline building
    const virtualGraph = JSON.parse(JSON.stringify(this.sceneManager.getSceneGraph()));

    instructions.forEach((instruction, idx) => {
      console.log(`[AnimationController] Executing instruction [${idx}]:`, JSON.stringify(instruction));

      switch (instruction.action) {
        case 'SWAP_OBJECTS': {
          const swp = instruction as SwapObjectsInstruction;
          const vLeftEl = virtualGraph.find((el: any) => el.id === swp.leftId);
          const vRightEl = virtualGraph.find((el: any) => el.id === swp.rightId);
          
          if (vLeftEl && vRightEl) {
            const logicalParent = vLeftEl.logicalParent;
            const leftIndex = vLeftEl.logicalIndex;
            const rightIndex = vRightEl.logicalIndex;
            
            // Find all instances in virtual graph
            const vAllLeftEls = virtualGraph.filter((el: any) => el.logicalParent === logicalParent && el.logicalIndex === leftIndex);
            const vAllRightEls = virtualGraph.filter((el: any) => el.logicalParent === logicalParent && el.logicalIndex === rightIndex);
            
            // Map to actual elements
            const allLeftEls = vAllLeftEls.map((el: any) => this.sceneManager.getElement(el.id)).filter(Boolean) as any[];
            const allRightEls = vAllRightEls.map((el: any) => this.sceneManager.getElement(el.id)).filter(Boolean) as any[];

            // Synchronously update virtualGraph for subsequent instructions
            vAllLeftEls.forEach((el: any) => el.logicalIndex = rightIndex);
            vAllRightEls.forEach((el: any) => el.logicalIndex = leftIndex);

            // 1. Highlight, lift, and detach to animation layer
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                [...allLeftEls, ...allRightEls].forEach(el => {
                  el.animationLayer = true;
                });
              }
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({
              targets: [...allLeftEls, ...allRightEls],
              color: '#4caf50',
              emissiveColor: '#4caf50',
              emissiveIntensity: 0.8,
              duration: 300,
              easing: 'easeOutExpo'
            });

            this.animationScheduler.enqueue({
              targets: [...allLeftEls.map(el => el.scale), ...allRightEls.map(el => el.scale)],
              x: 1.1, y: 1.1, z: 1.1,
              duration: 300,
              easing: 'easeOutExpo'
            });

            this.animationScheduler.enqueue({
              targets: [...allLeftEls.map(el => el.position), ...allRightEls.map(el => el.position)],
              y: (el: any, i: number, l: number) => el.y + 1.8,
              duration: 300,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.commitGroup(true);

            // 2. Pause briefly
            this.animationScheduler.advanceCursor(200);

            // 3. Swap logical indices and compute new layout targets
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                allLeftEls.forEach(el => { el.logicalIndex = rightIndex; el.animationLayer = false; });
                allRightEls.forEach(el => { el.logicalIndex = leftIndex; el.animationLayer = false; });
                
                // Get the new layout targets
                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

                // Restore animation layer state so they don't snap
                allLeftEls.forEach(el => el.animationLayer = true);
                allRightEls.forEach(el => el.animationLayer = true);
              }
            });
            this.animationScheduler.commitGroup(true);

            // 4. Move horizontally to new world targets
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                allLeftEls.forEach(el => {
                  if (el.worldTarget) {
                    this.animationScheduler.enqueue({
                      targets: el.position,
                      x: el.worldTarget.x,
                      z: el.worldTarget.z + 1.5,
                      duration: 600,
                      easing: 'easeInOutSine'
                    });
                  }
                });

                allRightEls.forEach(el => {
                  if (el.worldTarget) {
                    this.animationScheduler.enqueue({
                      targets: el.position,
                      x: el.worldTarget.x,
                      z: el.worldTarget.z - 1.5,
                      duration: 600,
                      easing: 'easeInOutSine'
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            });
            this.animationScheduler.commitSequential();

            // 5. Lower to new world positions
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                [...allLeftEls, ...allRightEls].forEach(el => {
                  if (el.worldTarget) {
                    this.animationScheduler.enqueue({
                      targets: el.position,
                      y: el.worldTarget.y,
                      z: el.worldTarget.z,
                      duration: 350,
                      easing: 'easeOutBounce'
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            });
            this.animationScheduler.commitSequential();

            // 6. Snap, save state, remove highlight
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                [...allLeftEls, ...allRightEls].forEach(el => {
                  el.animationLayer = false;
                });
                
                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Swapped ${swp.leftId} and ${swp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({
              targets: [...allLeftEls, ...allRightEls],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            });

            this.animationScheduler.enqueue({
              targets: [...allLeftEls.map(el => el.scale), ...allRightEls.map(el => el.scale)],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.commitGroup(true);
          }
          break;
        }

        case 'COMPARE_OBJECTS': {
          const cmp = instruction as CompareObjectsInstruction;
          const leftEl = this.sceneManager.getElement(cmp.leftId) as any;
          const rightEl = this.sceneManager.getElement(cmp.rightId) as any;
          
          if (leftEl && rightEl) {
            // Highlight, scale up, lift, emissive glow
            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: '#ffeb3b',
              emissiveColor: '#ffeb3b',
              emissiveIntensity: 0.5,
              duration: 400,
              easing: 'easeOutExpo',
              complete: () => {
                console.log(`[Runtime] COMPARE ${leftEl.id} (${leftEl.value}) and ${rightEl.id} (${rightEl.value})`);
              }
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1.15, y: 1.15, z: 1.15,
              duration: 400,
              easing: 'easeOutExpo'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.position, rightEl.position],
              y: '+=0.3',
              duration: 400,
              easing: 'easeOutExpo'
            });
            this.animationScheduler.commitGroup(true);

            // Pause briefly
            this.animationScheduler.advanceCursor(300);

            // Return to normal
            this.animationScheduler.enqueue({
              targets: [leftEl, rightEl],
              color: this.defaultColor,
              emissiveIntensity: 0,
              duration: 300,
              easing: 'easeInOutQuad'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.scale, rightEl.scale],
              x: 1, y: 1, z: 1,
              duration: 300,
              easing: 'easeInOutQuad'
            });

            this.animationScheduler.enqueue({
              targets: [leftEl.position, rightEl.position],
              y: '-=0.3',
              duration: 300,
              easing: 'easeInOutQuad'
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Compared ${cmp.leftId} and ${cmp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitSequential();
          }
          break;
        }
        case 'HIGHLIGHT_OBJECT': {
          const hl = instruction as HighlightObjectInstruction;
          const targetEl = this.sceneManager.getElement(hl.targetId);
          if (targetEl) {
            this.animationScheduler.enqueue({
              targets: targetEl,
              color: hl.color,
              emissiveColor: hl.color,
              emissiveIntensity: 0.3,
              duration: 400
            });
            this.animationScheduler.commitGroup(true);
          }
          break;
        }
        case 'WAIT': {
          this.animationScheduler.advanceCursor(800);
          break;
        }
        case 'LINK_OBJECTS': {
          const link = instruction as LinkObjectsInstruction;
          const sourceEl = this.sceneManager.getElement(link.sourceId) as any;
          const targetEl = this.sceneManager.getElement(link.targetId) as any;
          if (sourceEl && targetEl) {
            const edgeId = `edge_${link.sourceId}_${link.targetId}`;
            // If it doesn't exist, we add it to the scene graph dynamically.
            // This happens on animation completion so it is recorded in the state.
            // Update virtual graph immediately for future layout calculations
            if (!virtualGraph.find((el: any) => el.id === edgeId)) {
              virtualGraph.push({
                id: edgeId,
                type: 'edge',
                position: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                sourceId: link.sourceId,
                targetId: link.targetId,
                directed: link.directed,
                relationType: link.relationType,
              });
            }

            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                if (!this.sceneManager.getElement(edgeId)) {
                  const newEdge: any = {
                    id: edgeId,
                    type: 'edge',
                    position: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: '#888888',
                    emissiveIntensity: 0,
                    emissiveColor: '#888888',
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    directed: link.directed,
                    relationType: link.relationType,
                  };
                  this.lifecycleManager.spawn(newEdge, true);
                  
                  this.relationshipManager.addRelationship({
                    id: edgeId,
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    type: 'edge',
                    directed: link.directed,
                    relationType: link.relationType
                  });
                  
                  // Instantly activate for now to mimic previous behavior, but properly managed
                  this.lifecycleManager.activate(edgeId);

                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Linked ${link.sourceId} and ${link.targetId}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              }
            });
            this.animationScheduler.commitGroup(true);
            
            // Brief pause to show connection
            this.animationScheduler.advanceCursor(300);
          }
          break;
        }
        case 'GENERIC_ACTION': {
          const gen = instruction as GenericActionInstruction;
          console.log(`[Runtime] Executing generic action: ${gen.actionName}`, gen.args);
          
          if (gen.actionName === 'VISIT' || gen.actionName === 'MARK') {
            const targetId = gen.args[0];
            const targetEl = this.sceneManager.getElement(targetId) as any;
            if (targetEl) {
              const color = gen.actionName === 'MARK' ? '#ff9800' : '#4caf50';
              this.animationScheduler.enqueue({
                targets: targetEl,
                color: color,
                emissiveColor: color,
                emissiveIntensity: 0.6,
                duration: 400
              });
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.enqueue({
                targets: targetEl.scale,
                x: 1.15, y: 1.15, z: 1.15,
                duration: 200,
              });
              this.animationScheduler.commitSequential(); // scale up
              
              this.animationScheduler.enqueue({
                targets: targetEl.scale,
                x: 1, y: 1, z: 1,
                duration: 200,
              });
              this.animationScheduler.commitSequential(); // scale down
            }
          } else if (gen.actionName === 'INSERT') {
            const arrName = gen.args[0];
            const index = gen.args[1];
            const val = gen.args[2];
            
            const isLinkedList = virtualGraph.some((el: any) => el.logicalParent === arrName && el.originalType === 'LINKEDLIST_NODE');
            
            const newId = `obj_${arrName}_new_${Date.now()}`;
            const newEl: any = {
              id: newId,
              type: 'box',
              value: val,
              logicalIndex: index,
              logicalParent: arrName,
              originalType: isLinkedList ? 'LINKEDLIST_NODE' : 'ARRAY_ELEMENT',
              position: { x: index * 1.5, y: 3, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              color: '#4caf50',
              emissiveIntensity: 0.5,
              emissiveColor: '#4caf50',
              lifecycleState: 'ACTIVE',
              visible: true,
              opacity: 0,
              animationLayer: true
            };
            
            // Shift logical indices in virtual graph
            virtualGraph.forEach((el: any) => {
              if (el.logicalParent === arrName && el.logicalIndex >= index) {
                el.logicalIndex++;
              }
            });
            virtualGraph.push(newEl);
            
            // Find previous and next node if linked list
            let prevNode: any = null;
            let nextNode: any = null;
            let edgeToRemove: any = null;
            
            if (isLinkedList) {
              prevNode = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index - 1);
              nextNode = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index + 1); // it was already shifted
              
              if (prevNode && nextNode) {
                edgeToRemove = virtualGraph.find((el: any) => el.type === 'edge' && el.logicalParent === arrName && el.sourceId === prevNode.id && el.targetId === nextNode.id);
                if (edgeToRemove) {
                  const idx = virtualGraph.indexOf(edgeToRemove);
                  if (idx >= 0) virtualGraph.splice(idx, 1);
                }
              }
              
              if (prevNode) {
                virtualGraph.push({
                  id: `edge_${prevNode.id}_${newId}`,
                  type: 'edge',
                  sourceId: prevNode.id,
                  targetId: newId,
                  directed: true,
                  logicalParent: arrName,
                  originalType: 'EDGE',
                  color: '#888888', visible: true, opacity: 1,
                  position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
                });
              }
              if (nextNode) {
                virtualGraph.push({
                  id: `edge_${newId}_${nextNode.id}`,
                  type: 'edge',
                  sourceId: newId,
                  targetId: nextNode.id,
                  directed: true,
                  logicalParent: arrName,
                  originalType: 'EDGE',
                  color: '#888888', visible: true, opacity: 1,
                  position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
                });
              }
            }

            // Reserve the slot for the incoming element
            this.layoutManager.reserveSlot(arrName, index);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                // Also shift logical indices in real graph before spawning
                this.sceneManager.getSceneGraph().forEach((el: any) => {
                  if (el.logicalParent === arrName && el.logicalIndex >= index && el.type !== 'edge') {
                    el.logicalIndex++;
                  }
                });
                
                if (edgeToRemove) {
                   this.lifecycleManager.remove(edgeToRemove.id);
                   this.lifecycleManager.destroy(edgeToRemove.id);
                }
                
                this.lifecycleManager.spawn(newEl, true);
                this.lifecycleManager.activate(newId);
                
                if (isLinkedList) {
                  if (prevNode) {
                    const e: any = {
                      id: `edge_${prevNode.id}_${newId}`, type: 'edge', sourceId: prevNode.id, targetId: newId,
                      directed: true, logicalParent: arrName, originalType: 'EDGE',
                      color: '#888888', visible: true, opacity: 1,
                      emissiveIntensity: 0, emissiveColor: '#000000', lifecycleState: 'ACTIVE',
                      position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
                    };
                    this.lifecycleManager.spawn(e, true);
                  }
                  if (nextNode) {
                    const e: any = {
                      id: `edge_${newId}_${nextNode.id}`, type: 'edge', sourceId: newId, targetId: nextNode.id,
                      directed: true, logicalParent: arrName, originalType: 'EDGE',
                      color: '#888888', visible: true, opacity: 1,
                      emissiveIntensity: 0, emissiveColor: '#000000', lifecycleState: 'ACTIVE',
                      position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
                    };
                    this.lifecycleManager.spawn(e, true);
                  }
                }
              }
            });
            this.animationScheduler.commitGroup(true);
            
            // Re-layout immediately so they slide open
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                const layoutMap = this.layoutManager.updateLayout(virtualGraph);
                layoutMap.forEach((pos, id) => {
                  const targetEl = this.sceneManager.getElement(id) as any;
                  const vEl = virtualGraph.find((e: any) => e.id === id);
                  if (vEl) {
                    vEl.position.x = pos.x;
                    vEl.position.y = pos.y;
                    vEl.position.z = pos.z;
                    if (targetEl && id !== newId) {
                      this.animationScheduler.enqueue({
                        targets: targetEl.position,
                        x: pos.x, y: pos.y, z: pos.z,
                        duration: 400,
                        easing: 'easeInOutQuad'
                      });
                    }
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            });
            this.animationScheduler.commitSequential();
            
            // Fade in new element
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                const targetEl = this.sceneManager.getElement(newId) as any;
                if (targetEl) {
                  const layoutMap = this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                  const finalPos = layoutMap.get(newId) || { x: 0, y: 0, z: 0 };
                  
                  targetEl.position.x = finalPos.x;
                  targetEl.position.y = finalPos.y + 1.8; // start above
                  targetEl.position.z = finalPos.z;
                  
                  this.animationScheduler.enqueue({
                    targets: targetEl.position,
                    y: finalPos.y,
                    duration: 400,
                    easing: 'easeOutBack'
                  });
                  this.animationScheduler.enqueue({
                    targets: targetEl,
                    opacity: 1,
                    duration: 400,
                  });
                  this.animationScheduler.commitGroup(true);
                }
              }
            });
            this.animationScheduler.commitSequential();

            // Finish up
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                const targetEl = this.sceneManager.getElement(newId) as any;
                if (targetEl) targetEl.animationLayer = false;
                this.layoutManager.freeSlot(arrName, index);
                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
              }
            });
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(600);

          } else if (gen.actionName === 'DELETE') {
            const arrName = gen.args[0];
            const index = gen.args[1];
            
            // Find the element at that index
            const vElIdx = virtualGraph.findIndex((el: any) => el.logicalParent === arrName && el.logicalIndex === index);
            if (vElIdx >= 0) {
              const targetId = virtualGraph[vElIdx].id;
              const isLinkedList = virtualGraph[vElIdx].originalType === 'LINKEDLIST_NODE';
              
              const targetEl = this.sceneManager.getElement(targetId) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: '#f44336',
                  emissiveColor: '#f44336',
                  emissiveIntensity: 0.8,
                  opacity: 0,
                  duration: 400
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 0, y: 0, z: 0,
                  duration: 400,
                  easing: 'easeInBack'
                });
                this.animationScheduler.commitGroup(true);
              }
              
              let edgesToRemove: any[] = [];
              let newEdge: any = null;
              
              if (isLinkedList) {
                const prevNode = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index - 1);
                const nextNode = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index + 1);
                
                // Find edges connected to the target
                edgesToRemove = virtualGraph.filter((el: any) => el.type === 'edge' && el.logicalParent === arrName && (el.sourceId === targetId || el.targetId === targetId));
                
                // Remove them from virtual graph
                edgesToRemove.forEach(edge => {
                  const idx = virtualGraph.indexOf(edge);
                  if (idx >= 0) virtualGraph.splice(idx, 1);
                });
                
                // If there's a prev and next, connect them directly
                if (prevNode && nextNode) {
                  newEdge = {
                    id: `edge_${prevNode.id}_${nextNode.id}`,
                    type: 'edge',
                    sourceId: prevNode.id,
                    targetId: nextNode.id,
                    directed: true,
                    logicalParent: arrName,
                    originalType: 'EDGE',
                    color: '#888888', visible: true, opacity: 1,
                    emissiveIntensity: 0, emissiveColor: '#000000', lifecycleState: 'ACTIVE',
                    position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
                  };
                  virtualGraph.push(newEdge);
                }
              }
              
              // Shift indices down
              const elToDel = virtualGraph[vElIdx];
              virtualGraph.splice(vElIdx, 1);
              virtualGraph.forEach((el: any) => {
                if (el.logicalParent === arrName && el.logicalIndex > index && el.type !== 'edge') {
                  el.logicalIndex--;
                }
              });
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.sceneManager.getSceneGraph().forEach((el: any) => {
                    if (el.logicalParent === arrName && el.logicalIndex > index && el.type !== 'edge') {
                      el.logicalIndex--;
                    }
                  });
                  this.lifecycleManager.remove(targetId);
                  this.lifecycleManager.destroy(targetId);
                  
                  if (isLinkedList) {
                    edgesToRemove.forEach(edge => {
                      this.lifecycleManager.remove(edge.id);
                      this.lifecycleManager.destroy(edge.id);
                    });
                    if (newEdge) {
                      this.lifecycleManager.spawn(newEdge, true);
                    }
                  }
                }
              });
              this.animationScheduler.commitGroup(true);

              // Relayout remaining
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  const layoutMap = this.layoutManager.updateLayout(virtualGraph);
                  layoutMap.forEach((pos, id) => {
                    const tel = this.sceneManager.getElement(id) as any;
                    const vEl = virtualGraph.find((e: any) => e.id === id);
                    if (vEl) {
                      vEl.position.x = pos.x; vEl.position.y = pos.y; vEl.position.z = pos.z;
                      if (tel) {
                        this.animationScheduler.enqueue({
                          targets: tel.position,
                          x: pos.x, y: pos.y, z: pos.z,
                          duration: 400, easing: 'easeInOutQuad'
                        });
                      }
                    }
                  });
                  this.animationScheduler.commitGroup(true);
                }
              });
              this.animationScheduler.commitSequential();
              this.animationScheduler.advanceCursor(400);
            }
          } else if (gen.actionName === 'PUSH') {
            const stackName = gen.args[0];
            const val = gen.args[1];
            
            // Find current top index
            const stackEls = virtualGraph.filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
            const newIndex = stackEls.length;
            
            const newId = `obj_${stackName}_new_${Date.now()}`;
            const newEl: any = {
              id: newId,
              type: 'box',
              value: val,
              logicalIndex: newIndex,
              logicalParent: stackName,
              originalType: 'STACK_ELEMENT',
              position: { x: 0, y: 10, z: 0 }, // Will be laid out but starts high
              scale: { x: 1, y: 1, z: 1 },
              color: '#4caf50',
              emissiveIntensity: 0.5,
              emissiveColor: '#4caf50',
              lifecycleState: 'ACTIVE',
              visible: true,
              opacity: 0,
            };
            
            virtualGraph.push(newEl);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                this.lifecycleManager.spawn(newEl, true);
                this.lifecycleManager.activate(newId);
              }
            });
            this.animationScheduler.commitGroup(true);
            
            const layoutMap = this.layoutManager.updateLayout(virtualGraph);
            const targetPos = layoutMap.get(newId);
            
            if (targetPos) {
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  const targetEl = this.sceneManager.getElement(newId) as any;
                  if (targetEl) {
                    targetEl.position.x = targetPos.x;
                    targetEl.position.y = targetPos.y + 5; // Drop from above
                    targetEl.position.z = targetPos.z;
                    
                    this.animationScheduler.enqueue({
                      targets: targetEl.position,
                      y: targetPos.y,
                      duration: 500,
                      easing: 'easeOutBounce'
                    });
                    this.animationScheduler.enqueue({
                      targets: targetEl,
                      opacity: 1,
                      duration: 300,
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(600);
            }
          } else if (gen.actionName === 'POP') {
            const stackName = gen.args[0];
            
            const stackEls = virtualGraph.filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
            if (stackEls.length > 0) {
              const topEl = stackEls.sort((a: any, b: any) => b.logicalIndex - a.logicalIndex)[0];
              const targetId = topEl.id;
              
              const targetEl = this.sceneManager.getElement(targetId) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl.position,
                  y: targetEl.position.y + 3,
                  duration: 400,
                  easing: 'easeInQuad'
                });
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  opacity: 0,
                  color: '#f44336',
                  emissiveColor: '#f44336',
                  emissiveIntensity: 0.8,
                  duration: 400
                });
                this.animationScheduler.commitGroup(true);
              }
              
              const vElIdx = virtualGraph.findIndex((el: any) => el.id === targetId);
              if (vElIdx >= 0) virtualGraph.splice(vElIdx, 1);
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.lifecycleManager.remove(targetId);
                  this.lifecycleManager.destroy(targetId);
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(450);
            }
          } else if (gen.actionName === 'PEEK') {
            const stackName = gen.args[0];
            const stackEls = virtualGraph.filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
            if (stackEls.length > 0) {
              const topEl = stackEls.sort((a: any, b: any) => b.logicalIndex - a.logicalIndex)[0];
              const targetEl = this.sceneManager.getElement(topEl.id) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  emissiveColor: '#ff9800',
                  emissiveIntensity: 0.8,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1.1, y: 1.1, z: 1.1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  emissiveIntensity: 0,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1, y: 1, z: 1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                this.animationScheduler.advanceCursor(100);
              }
            }
          } else if (gen.actionName === 'ENQUEUE') {
            const queueName = gen.args[0];
            const val = gen.args[1];
            
            const queueEls = virtualGraph.filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT');
            const newIndex = queueEls.length;
            
            const newId = `obj_${queueName}_new_${Date.now()}`;
            const newEl: any = {
              id: newId,
              type: 'box',
              value: val,
              logicalIndex: newIndex,
              logicalParent: queueName,
              originalType: 'QUEUE_ELEMENT',
              position: { x: 10, y: 5, z: 0 }, // Start high and to the right
              scale: { x: 1, y: 1, z: 1 },
              color: '#5c6bc0',
              emissiveIntensity: 0.5,
              emissiveColor: '#5c6bc0',
              lifecycleState: 'ACTIVE',
              visible: true,
              opacity: 0,
            };
            
            virtualGraph.push(newEl);
            
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                this.lifecycleManager.spawn(newEl, true);
                this.lifecycleManager.activate(newId);
              }
            });
            this.animationScheduler.commitGroup(true);
            
            const layoutMap = this.layoutManager.updateLayout(virtualGraph);
            const targetPos = layoutMap.get(newId);
            
            if (targetPos) {
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  const targetEl = this.sceneManager.getElement(newId) as any;
                  if (targetEl) {
                    targetEl.position.x = targetPos.x;
                    targetEl.position.y = targetPos.y + 5; // Drop into the pipeline
                    targetEl.position.z = targetPos.z;
                    
                    this.animationScheduler.enqueue({
                      targets: targetEl.position,
                      y: targetPos.y,
                      duration: 500,
                      easing: 'easeOutBounce'
                    });
                    this.animationScheduler.enqueue({
                      targets: targetEl,
                      opacity: 1,
                      duration: 300,
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                }
              });
              this.animationScheduler.commitGroup(true);
              
              // Shift existing elements slightly if the pipeline grew from the center
              layoutMap.forEach((pos, id) => {
                if (id !== newId) {
                  const tel = this.sceneManager.getElement(id) as any;
                  if (tel) {
                    this.animationScheduler.enqueue({
                      targets: tel.position,
                      x: pos.x, y: pos.y, z: pos.z,
                      duration: 400, easing: 'easeInOutQuad'
                    });
                  }
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(600);
            }
          } else if (gen.actionName === 'DEQUEUE') {
            const queueName = gen.args[0];
            
            const queueEls = virtualGraph.filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            
            if (queueEls.length > 0) {
              const frontEl = queueEls[0];
              const targetId = frontEl.id;
              
              const targetEl = this.sceneManager.getElement(targetId) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl.position,
                  x: targetEl.position.x - 3, // Slide out left
                  duration: 400,
                  easing: 'easeInQuad'
                });
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  opacity: 0,
                  color: '#f44336',
                  emissiveColor: '#f44336',
                  emissiveIntensity: 0.8,
                  duration: 400
                });
                this.animationScheduler.commitGroup(true);
              }
              
              const vElIdx = virtualGraph.findIndex((el: any) => el.id === targetId);
              if (vElIdx >= 0) virtualGraph.splice(vElIdx, 1);
              
              // Shift remaining elements down in index
              virtualGraph.forEach((el: any) => {
                if (el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT' && el.logicalIndex > 0) {
                  el.logicalIndex--;
                }
              });
              
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.lifecycleManager.remove(targetId);
                  this.lifecycleManager.destroy(targetId);
                }
              });
              this.animationScheduler.commitGroup(true);
              
              // Update layout for remaining elements to slide them forward
              const layoutMap = this.layoutManager.updateLayout(virtualGraph);
              layoutMap.forEach((pos, id) => {
                const tel = this.sceneManager.getElement(id) as any;
                const vEl = virtualGraph.find((e: any) => e.id === id);
                if (vEl) {
                  vEl.position.x = pos.x; vEl.position.y = pos.y; vEl.position.z = pos.z;
                  if (tel) {
                    this.animationScheduler.enqueue({
                      targets: tel.position,
                      x: pos.x, y: pos.y, z: pos.z,
                      duration: 400, easing: 'easeInOutQuad'
                    });
                  }
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(450);
            }
          } else if (gen.actionName === 'FRONT' || gen.actionName === 'REAR') {
            const queueName = gen.args[0];
            const queueEls = virtualGraph.filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            
            if (queueEls.length > 0) {
              const targetNode = gen.actionName === 'FRONT' ? queueEls[0] : queueEls[queueEls.length - 1];
              const targetEl = this.sceneManager.getElement(targetNode.id) as any;
              
              if (targetEl) {
                const highlightColor = gen.actionName === 'FRONT' ? '#ef5350' : '#66bb6a';
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  emissiveColor: highlightColor,
                  emissiveIntensity: 0.8,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1.1, y: 1.1, z: 1.1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  emissiveIntensity: 0,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1, y: 1, z: 1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                this.animationScheduler.advanceCursor(100);
              }
            }
          } else if (gen.actionName === 'TRAVERSE' || gen.actionName === 'VISIT') {
            const treeName = gen.args[0];
            const arg1 = gen.args[1];
            // E.g. TRAVERSE myTree[1] or TRAVERSE myTree 1
            const targetEl = virtualGraph.find((el: any) => 
               el.logicalParent === treeName && 
               (el.logicalIndex === arg1 || el.label === `${treeName}[${arg1}]` || el.label === arg1)
            ) || virtualGraph.find((el: any) => el.logicalParent === treeName && el.logicalIndex === parseInt(arg1));
            
            if (targetEl) {
              const tel = this.sceneManager.getElement(targetEl.id) as any;
              if (tel) {
                this.animationScheduler.enqueue({
                  targets: tel,
                  emissiveColor: '#ffeb3b',
                  emissiveIntensity: 0.8,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: tel.scale,
                  x: 1.1, y: 1.1, z: 1.1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                
                this.animationScheduler.enqueue({
                  targets: tel,
                  emissiveIntensity: 0,
                  duration: 200
                });
                this.animationScheduler.enqueue({
                  targets: tel.scale,
                  x: 1, y: 1, z: 1,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                this.animationScheduler.advanceCursor(100);
              }
            }
          } else if (gen.actionName === 'ROTATE') {
            // Placeholder for tree rotation layout update
            // A real rotation would adjust logical indices and let the layout engine sort it out.
            // For now, we will just wiggle the node to acknowledge the action
            const treeName = gen.args[0];
            const nodeIndex = parseInt(gen.args[1]);
            const targetEl = virtualGraph.find((el: any) => el.logicalParent === treeName && el.logicalIndex === nodeIndex);
            
            if (targetEl) {
              const tel = this.sceneManager.getElement(targetEl.id) as any;
              if (tel) {
                this.animationScheduler.enqueue({
                  targets: tel.position,
                  x: tel.position.x + 1,
                  duration: 150, easing: 'easeInOutSine'
                });
                this.animationScheduler.enqueue({
                  targets: tel.position,
                  x: tel.position.x - 1,
                  duration: 150, easing: 'easeInOutSine'
                });
                this.animationScheduler.enqueue({
                  targets: tel.position,
                  x: tel.position.x,
                  duration: 150, easing: 'easeInOutSine'
                });
                this.animationScheduler.commitSequential();
                this.animationScheduler.advanceCursor(450);
              }
            }
          } else if (gen.actionName === 'HEAPIFY') {
            const heapName = gen.args[0];
            const arg1 = gen.args[1];
            // E.g. HEAPIFY myHeap 0
            
            const targetEls = virtualGraph.filter((el: any) => 
               el.logicalParent === heapName && 
               (el.logicalIndex === arg1 || el.label === `${heapName}[${arg1}]` || el.label === arg1 || el.logicalIndex === parseInt(arg1))
            ).map((el: any) => this.sceneManager.getElement(el.id)).filter(Boolean) as any[];
            
            if (targetEls.length > 0) {
              this.animationScheduler.enqueue({
                targets: targetEls,
                emissiveColor: '#e91e63', // distinct color for heapify
                emissiveIntensity: 0.8,
                duration: 200
              });
              this.animationScheduler.enqueue({
                targets: targetEls.map((el: any) => el.scale),
                x: 1.15, y: 1.15, z: 1.15,
                duration: 200
              });
              this.animationScheduler.commitSequential();
              
              this.animationScheduler.enqueue({
                targets: targetEls,
                emissiveIntensity: 0,
                duration: 200
              });
              this.animationScheduler.enqueue({
                targets: targetEls.map((el: any) => el.scale),
                x: 1, y: 1, z: 1,
                duration: 200
              });
              this.animationScheduler.commitSequential();
              this.animationScheduler.advanceCursor(100);
            }
          } else if (gen.actionName === 'UPDATE') {
            const arrName = gen.args[0];
            const index = gen.args[1];
            const val = gen.args[2];
            
            const vEl = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index);
            if (vEl) {
              const targetEl = this.sceneManager.getElement(vEl.id) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: '#9c27b0',
                  emissiveColor: '#9c27b0',
                  emissiveIntensity: 0.6,
                  duration: 300
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1.2, y: 1.2, z: 1.2,
                  duration: 300
                });
                this.animationScheduler.commitGroup(true);
                
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => { targetEl.value = val; vEl.value = val; }
                });
                this.animationScheduler.commitGroup(true);
                
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: this.defaultColor,
                  emissiveIntensity: 0,
                  duration: 300
                });
                this.animationScheduler.enqueue({
                  targets: targetEl.scale,
                  x: 1, y: 1, z: 1,
                  duration: 300
                });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(300);
              }
            }
          } else if (gen.actionName === 'SEARCH') {
            const arrName = gen.args[0];
            const val = gen.args[1];
            // Just scan through
            const elements = virtualGraph.filter((el: any) => el.logicalParent === arrName).sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            elements.forEach((vEl: any) => {
              const targetEl = this.sceneManager.getElement(vEl.id) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: '#00bcd4',
                  emissiveColor: '#00bcd4',
                  emissiveIntensity: 0.5,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: this.defaultColor,
                  emissiveIntensity: 0,
                  duration: 200
                });
                this.animationScheduler.commitSequential();
              }
            });
            this.animationScheduler.advanceCursor(200);
          } else {
            // Default pause for other actions
            this.animationScheduler.advanceCursor(300);
          }
          break;
        }
        case 'SET_STATE': {
          const setStateIns = instruction as SetStateInstruction;
          console.log(`[Runtime] Setting state for ${setStateIns.targetId} to ${setStateIns.stateName}`);
          
          const targetEl = this.sceneManager.getElement(setStateIns.targetId) as any;
          if (targetEl) {
            // Update semantic state
            targetEl.state = setStateIns.stateName;

            const vEl = virtualGraph.find((e: any) => e.id === setStateIns.targetId);
            if (vEl) {
              vEl.state = setStateIns.stateName;
            }

            // Decouple appearance updates based on states
            const s = setStateIns.stateName;
            const updates: any = { targets: targetEl, duration: 400 };

            if (s === 'active' || s === 'selected' || s === 'visited') {
              updates.color = '#ff9800';
              updates.emissiveColor = '#ff9800';
              updates.emissiveIntensity = 0.5;
            } else if (s === 'sorted' || s === 'processed') {
              updates.color = '#4caf50'; // Green success
              updates.emissiveColor = '#4caf50';
              updates.emissiveIntensity = 0.3;
            } else if (s === 'inactive' || s === 'discovered') {
              updates.color = '#888888';
              updates.emissiveColor = '#000000';
              updates.emissiveIntensity = 0;
            } else if (s === 'deleted') {
              this.lifecycleManager.remove(setStateIns.targetId);
              updates.scaleX = 0;
              updates.scaleY = 0;
              updates.scaleZ = 0;
              updates.opacity = 0;
              updates.complete = () => {
                this.lifecycleManager.destroy(setStateIns.targetId);
              };
            } else {
              // Default reset
              updates.color = '#4facfe';
              updates.emissiveColor = '#000000';
              updates.emissiveIntensity = 0;
            }

            this.animationScheduler.enqueue(updates);
            this.animationScheduler.commitGroup(true);
          }
          break;
        }
        case 'UPDATE_LAYOUT': {
          const layoutMap = this.layoutManager.updateLayout(virtualGraph);
          let animatedAny = false;
          
          layoutMap.forEach((pos, id) => {
            const targetEl = this.sceneManager.getElement(id) as any;
            const vEl = virtualGraph.find((e: any) => e.id === id);
            
            if (vEl) {
              // Only animate if the position actually changed in the virtual graph
              if (Math.abs(vEl.position.x - pos.x) > 0.01 || Math.abs(vEl.position.y - pos.y) > 0.01) {
                if (targetEl) {
                  this.animationScheduler.enqueue({
                    targets: targetEl.position,
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    duration: 600,
                    easing: 'easeInOutQuad'
                  });
                  animatedAny = true;
                }
                vEl.position.x = pos.x;
                vEl.position.y = pos.y;
                vEl.position.z = pos.z;
              }
            }
          });

          if (!animatedAny) {
            this.animationScheduler.advanceCursor(100);
          } else {
            this.animationScheduler.commitGroup(true); // run all layout moves concurrently
            // Save state after layout update
            this.animationScheduler.enqueue({
              targets: {},
              duration: 1,
              complete: () => {
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Dynamic Relayout`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }
            });
            this.animationScheduler.commitGroup(true);
          }
          break;
        }
      }
    });
  }
}

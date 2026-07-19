import type { AQIRInstruction, SwapObjectsInstruction, CompareObjectsInstruction, HighlightObjectInstruction, LinkObjectsInstruction, GenericActionInstruction, SetStateInstruction } from '@aqvl/shared';
import { AnimationScheduler } from './AnimationScheduler';
import { SceneManager } from './SceneManager';
import { LayoutManager } from './LayoutManager';
import { StateManager } from './StateManager';
import { EventDispatcher } from './EventDispatcher';

import { LifecycleManager } from './LifecycleManager';
import { RelationshipManager } from './RelationshipManager';
import { AlgorithmRegistry, AlgorithmContext, BinaryTreeAlgorithms } from './algorithms';

// Register plugins
AlgorithmRegistry.register([
  'MIRROR', 'INVERT', 'CLONE', 'COPY', 'REMOVE_LEAVES', 'PRUNE',
  'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL',
  'MAX_VALUE', 'MIN_VALUE', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM'
], new BinaryTreeAlgorithms());
import { AnimationContext, MoveAnimation } from './animations';

export class AnimationController {
  private defaultColor = '#4facfe';
  private activeTreeName: string | null = null;

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
                const idx = (targetEl as any).logicalIndex !== undefined ? `[${(targetEl as any).logicalIndex}]` : '';
                const val = (targetEl as any).value !== undefined ? (targetEl as any).value : targetEl.id;
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'HIGHLIGHT',
                  message: `Highlighted ${(targetEl as any).logicalParent || ''}${idx} — value: ${val}`,
                  kind: 'step',
                  timestamp: Date.now(),
                });
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
                const lVal = leftEl.value ?? leftEl.id;
                const rVal = rightEl.value ?? rightEl.id;
                const lIdx = leftEl.logicalIndex;
                const rIdx = rightEl.logicalIndex;
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Swapped ${swp.leftId} and ${swp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'SWAP',
                  message: `Swapped [${rIdx}] (${lVal}) ↔ [${lIdx}] (${rVal})`,
                  kind: 'swap',
                  timestamp: Date.now(),
                });
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
                const lVal = leftEl.value ?? leftEl.id;
                const rVal = rightEl.value ?? rightEl.id;
                const lIdx = leftEl.logicalIndex !== undefined ? leftEl.logicalIndex : leftEl.id;
                const rIdx = rightEl.logicalIndex !== undefined ? rightEl.logicalIndex : rightEl.id;
                const cmpSymbol = lVal < rVal ? '<' : lVal > rVal ? '>' : '=';
                const cmpWord = lVal < rVal ? 'less than' : lVal > rVal ? 'greater than' : 'equal to';
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Compared ${cmp.leftId} and ${cmp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'COMPARE',
                  message: `Comparing [${lIdx}]=${lVal} vs [${rIdx}]=${rVal}\n${lVal} ${cmpSymbol} ${rVal}  (${lVal} is ${cmpWord} ${rVal})`,
                  kind: 'compare',
                  timestamp: Date.now(),
                });
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
          
          const handler = AlgorithmRegistry.getHandler(actionName);
          if (handler) {
            const context: AlgorithmContext = {
              scheduler: this.animationScheduler,
              sceneManager: this.sceneManager,
              layoutManager: this.layoutManager,
              eventDispatcher: this.eventDispatcher,
              activeTreeName: this.activeTreeName,
              defaultColor: this.defaultColor
            };
            handler.execute(context, gen);
            this.activeTreeName = context.activeTreeName; // Sync back in case it changed
            break;
          }
          
          if (actionName === 'INSERT') {
            const logicalParent = (gen as any).payload?.logicalParent;
            const insertIndex = (gen as any).payload?.logicalIndex;
            const valueToInsert = gen.args?.[gen.args.length - 1];

            if (logicalParent !== undefined && insertIndex !== undefined) {
              const allArrayEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const elsToShift = allArrayEls.filter((el: any) => el.logicalIndex >= insertIndex);
              
              // Synchronous update
              elsToShift.forEach((el: any) => el.logicalIndex += 1);
              
              const newEl: any = {
                id: `obj_dyn_${Date.now()}_${insertIndex}`,
                type: 'box',
                value: valueToInsert,
                logicalIndex: insertIndex,
                index: insertIndex,
                logicalParent: logicalParent,
                originalType: 'ARRAY_ELEMENT',
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
              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

              if (newEl.worldTarget) {
                 newEl.position.x = newEl.worldTarget.x;
                 newEl.position.z = newEl.worldTarget.z;
              }
              
              // Animate ALL array elements to their new centered world target
              const updatedArrayEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.id !== newEl.id);
              updatedArrayEls.forEach((el: any) => {
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
                  updatedArrayEls.forEach((el: any) => {
                    el.label = `${el.logicalParent}[${el.logicalIndex}]`;
                  });
                  newEl.label = `${newEl.logicalParent}[${newEl.logicalIndex}]`;
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Inserted ${valueToInsert} at index ${insertIndex}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'INSERT',
                    message: `Inserted value ${valueToInsert} at index ${insertIndex} in "${logicalParent}".\nElements to the right shifted one position forward.\nInsertion complete.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'DELETE') {
            const logicalParent = (gen as any).payload?.logicalParent;
            const deleteIndex = (gen as any).payload?.logicalIndex;
            let targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            if (!targetEl && gen.args && gen.args.length > 0) {
              targetEl = this.sceneManager.getElement(String(gen.args[0])) as any;
            }
            
            if (logicalParent !== undefined && deleteIndex !== undefined && targetEl) {
              const allArrayEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const elsToShift = allArrayEls.filter((el: any) => el.logicalIndex > deleteIndex);
              
              // Synchronous layout update
              elsToShift.forEach((el: any) => el.logicalIndex -= 1);
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
              const remainingEls = allArrayEls.filter((el: any) => el.id !== targetEl.id);
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
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DELETE',
                    message: `Deleted element at index ${deleteIndex} from "${logicalParent}".\nElements to the right shifted one position back.\nDeletion complete.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitSequential();
            } else if (targetEl && targetEl.originalType === 'TREE_NODE') {
              const edges = this.sceneManager.getSceneGraph().filter((el: any) => el.type === 'edge' && (el.sourceId === targetEl.id || el.targetId === targetEl.id));
              
              this.animationScheduler.enqueue({
                targets: targetEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.8, duration: 300
              });
              this.animationScheduler.enqueue({ targets: targetEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(400);
              
              this.animationScheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
              this.animationScheduler.enqueue({ targets: targetEl.position, y: '-=2', duration: 400, easing: 'easeInBack' });
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                edges.forEach(e => this.sceneManager.removeElement(e.id));
                this.sceneManager.removeElement(targetEl.id);
                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Deleted node ${targetEl.id}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'DELETE', message: `Deleted node ${targetEl.id} and its edges.`, kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'INSERT_HEAD' || actionName === 'INSERT_TAIL') {
            const logicalParent = (gen as any).payload?.logicalParent;
            const valueToInsert = gen.args?.[gen.args.length - 1];
            if (logicalParent !== undefined && valueToInsert !== undefined) {
              const allEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const edges = allEls.filter((el: any) => el.type === 'edge');
              const headNode = allEls.find((el: any) => el.originalType === 'HEAD');
              const nullNode = allEls.find((el: any) => el.originalType === 'NULL');
              
              const circularEdge = edges.find((e: any) => e.properties?.circular);
              const isCircular = !!circularEdge;

              if (headNode && (nullNode || isCircular)) {
                const newId = `obj_dyn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const newEl: any = {
                  id: newId,
                  type: 'sphere',
                  originalType: 'LINKEDLIST_NODE',
                  logicalParent: logicalParent,
                  value: valueToInsert,
                  label: String(valueToInsert),
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
                this.animationScheduler.enqueue({
                  targets: {}, duration: 1, complete: () => {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'INFO',
                      message: `Creating new node with value ${valueToInsert}...`,
                      kind: 'info',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitSequential();

                const isDoubly = edges.some((e: any) => e.backward === true || e.properties?.backward === true);

                let edgeToRemove: any = null;
                let prevNodeId: string = '';
                let nextNodeId: string = '';

                if (actionName === 'INSERT_HEAD') {
                  const edgeFromHead = edges.find((e: any) => e.sourceId === headNode.id && !(e.backward || e.properties?.backward));
                  if (edgeFromHead) {
                    edgeToRemove = edgeFromHead;
                    prevNodeId = headNode.id;
                    nextNodeId = (edgeFromHead as any).targetId;
                  }
                } else { // INSERT_TAIL
                  if (isCircular) {
                    edgeToRemove = circularEdge;
                    prevNodeId = (circularEdge as any).sourceId;
                    nextNodeId = (circularEdge as any).targetId;
                  } else {
                    const edgeToNull = edges.find((e: any) => e.targetId === nullNode?.id && !(e.backward || e.properties?.backward));
                    if (edgeToNull && nullNode) {
                      edgeToRemove = edgeToNull;
                      prevNodeId = (edgeToNull as any).sourceId;
                      nextNodeId = nullNode.id;
                    }
                  }
                }

                if (edgeToRemove) {
                  this.sceneManager.removeElement(edgeToRemove.id);
                  
                  const edge1Id = `edge_dyn_${prevNodeId}_${newId}`;
                  const edge2Id = `edge_dyn_${newId}_${nextNodeId}`;
                  
                  const isEdge2Circular = actionName === 'INSERT_TAIL' && isCircular;

                  this.sceneManager.addElement({
                    id: edge1Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                    sourceId: prevNodeId, targetId: newId, directed: true, logicalParent, originalType: 'EDGE'
                  } as any);
                  
                  this.sceneManager.addElement({
                    id: edge2Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                    sourceId: newId, targetId: nextNodeId, directed: true, logicalParent, originalType: 'EDGE',
                    properties: isEdge2Circular ? { circular: true } : undefined
                  } as any);
                  
                  this.relationshipManager.addRelationship({ id: edge1Id, sourceId: prevNodeId, targetId: newId, type: 'edge', directed: true });
                  this.relationshipManager.addRelationship({ id: edge2Id, sourceId: newId, targetId: nextNodeId, type: 'edge', directed: true });

                  if (actionName === 'INSERT_HEAD' && isCircular && circularEdge) {
                    (circularEdge as any).targetId = newId;
                  }

                  if (isDoubly) {
                    const bEdgeToRemove = edges.find((e: any) => (e.backward === true || e.properties?.backward === true) && e.sourceId === nextNodeId && e.targetId === prevNodeId);
                    if (bEdgeToRemove) {
                      this.sceneManager.removeElement(bEdgeToRemove.id);
                    }
                    const bEdge1Id = `edge_dyn_b_${nextNodeId}_${newId}`;
                    const bEdge2Id = `edge_dyn_b_${newId}_${prevNodeId}`;
                    this.sceneManager.addElement({
                      id: bEdge1Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                      sourceId: nextNodeId, targetId: newId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
                    } as any);
                    this.sceneManager.addElement({
                      id: bEdge2Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                      sourceId: newId, targetId: prevNodeId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
                    } as any);
                    this.relationshipManager.addRelationship({ id: bEdge1Id, sourceId: nextNodeId, targetId: newId, type: 'edge', directed: true });
                    this.relationshipManager.addRelationship({ id: bEdge2Id, sourceId: newId, targetId: prevNodeId, type: 'edge', directed: true });
                  }
                }

                this.animationScheduler.enqueue({
                  targets: {}, duration: 1, complete: () => {
                    if (isDoubly) {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'RELATION',
                        message: 'Updating Previous Pointer...\nUpdating Next Pointer...',
                        kind: 'relationship',
                        timestamp: Date.now(),
                      });
                    } else if (isCircular && actionName === 'INSERT_TAIL') {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'RELATION',
                        message: 'Tail now points back to Head.\nCircular Link Restored.',
                        kind: 'relationship',
                        timestamp: Date.now(),
                      });
                    } else {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'RELATION',
                        message: actionName === 'INSERT_HEAD' ? 'New node points to current head.\nUpdating Head pointer...' : 'Tail node points to new node.',
                        kind: 'relationship',
                        timestamp: Date.now(),
                      });
                    }
                  }
                });
                this.animationScheduler.commitSequential();

                this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

                if (newEl.worldTarget) {
                  newEl.position.x = newEl.worldTarget.x;
                  newEl.position.z = newEl.worldTarget.z;
                }

                const updatedArrayEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.id !== newEl.id && el.originalType !== 'EDGE');
                updatedArrayEls.forEach((el: any) => {
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
                    this.stateManager.saveState(this.sceneManager.getSceneGraph(), `${actionName} ${valueToInsert}`, this.animationScheduler.getCurrentTime());
                    this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'RESULT',
                      message: 'Insertion Complete.',
                      kind: 'result',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitSequential();
              }
            }
          } else if (actionName === 'DELETE_HEAD' || actionName === 'DELETE_TAIL') {
            const logicalParent = (gen as any).payload?.logicalParent;
            if (logicalParent) {
              const allEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
              const edges = allEls.filter((el: any) => el.type === 'edge');
              const headNode = allEls.find((el: any) => el.originalType === 'HEAD');
              const nullNode = allEls.find((el: any) => el.originalType === 'NULL');
              
              const circularEdge = edges.find((e: any) => e.properties?.circular);
              const isCircular = !!circularEdge;

              if (headNode && (nullNode || isCircular)) {
                let nodeToDeleteId: string | null = null;
                let prevNodeId: string = headNode.id;
                let nextNodeId: string = nullNode ? nullNode.id : '';
                
                if (actionName === 'DELETE_HEAD') {
                  const edgeFromHead = edges.find((e: any) => e.sourceId === headNode.id && !(e.backward || e.properties?.backward));
                  if (edgeFromHead) {
                    nodeToDeleteId = (edgeFromHead as any).targetId;
                    if (nullNode && nodeToDeleteId === nullNode.id) nodeToDeleteId = null; // empty list
                  }
                } else { // DELETE_TAIL
                  if (isCircular) {
                    nodeToDeleteId = (circularEdge as any).sourceId;
                  } else {
                    const edgeToNull = edges.find((e: any) => e.targetId === nullNode?.id && !(e.backward || e.properties?.backward));
                    if (edgeToNull && nullNode) {
                      nodeToDeleteId = (edgeToNull as any).sourceId;
                      if (nodeToDeleteId === headNode.id) nodeToDeleteId = null; // empty list
                    }
                  }
                }
                
                if (nodeToDeleteId) {
                  this.animationScheduler.enqueue({
                    targets: {}, duration: 1, complete: () => {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'OPERATION',
                        message: actionName === 'DELETE_HEAD' ? 'Deleting Head Node...' : 'Removing Tail...',
                        kind: 'operation',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.commitSequential();

                  const edgeToDel = edges.find((e: any) => e.targetId === nodeToDeleteId && !(e.backward || e.properties?.backward) && !e.properties?.circular);
                  let edgeFromDel = edges.find((e: any) => e.sourceId === nodeToDeleteId && !(e.backward || e.properties?.backward) && !e.properties?.circular);
                  
                  if (isCircular && actionName === 'DELETE_TAIL') {
                    edgeFromDel = circularEdge;
                  }

                  if (edgeToDel) {
                    prevNodeId = (edgeToDel as any).sourceId;
                    this.sceneManager.removeElement(edgeToDel.id);
                  }
                  if (edgeFromDel) {
                    nextNodeId = (edgeFromDel as any).targetId;
                    this.sceneManager.removeElement(edgeFromDel.id);
                  }
                  
                  if (isCircular && actionName === 'DELETE_HEAD' && circularEdge) {
                    (circularEdge as any).targetId = nextNodeId;
                  }
                  
                  const newEdgeId = `edge_dyn_${prevNodeId}_${nextNodeId}`;
                  const isNewEdgeCircular = isCircular && actionName === 'DELETE_TAIL';
                  
                  this.sceneManager.addElement({
                    id: newEdgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                    sourceId: prevNodeId, targetId: nextNodeId, directed: true, logicalParent, originalType: 'EDGE',
                    properties: isNewEdgeCircular ? { circular: true } : undefined
                  } as any);
                  this.relationshipManager.addRelationship({ id: newEdgeId, sourceId: prevNodeId, targetId: nextNodeId, type: 'edge', directed: true });
                  
                  const isDoubly = edges.some((e: any) => e.backward === true || e.properties?.backward === true);
                  if (isDoubly) {
                    const bEdgeToDel = edges.find((e: any) => (e.backward || e.properties?.backward) && e.targetId === nodeToDeleteId);
                    const bEdgeFromDel = edges.find((e: any) => (e.backward || e.properties?.backward) && e.sourceId === nodeToDeleteId);
                    if (bEdgeToDel) this.sceneManager.removeElement(bEdgeToDel.id);
                    if (bEdgeFromDel) this.sceneManager.removeElement(bEdgeFromDel.id);

                    const bNewEdgeId = `edge_dyn_b_${nextNodeId}_${prevNodeId}`;
                    this.sceneManager.addElement({
                      id: bNewEdgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
                      sourceId: nextNodeId, targetId: prevNodeId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
                    } as any);
                    this.relationshipManager.addRelationship({ id: bNewEdgeId, sourceId: nextNodeId, targetId: prevNodeId, type: 'edge', directed: true });
                  }
                  
                  this.animationScheduler.enqueue({
                    targets: {}, duration: 1, complete: () => {
                      if (isDoubly) {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'RELATION',
                          message: 'Updating Previous/Next Pointers...',
                          kind: 'relationship',
                          timestamp: Date.now(),
                        });
                      } else if (isCircular && actionName === 'DELETE_TAIL') {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'RELATION',
                          message: 'Tail updated to point to new Head.\nCircular Link Restored.',
                          kind: 'relationship',
                          timestamp: Date.now(),
                        });
                      } else {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'RELATION',
                          message: actionName === 'DELETE_HEAD' ? 'Head updated to next node.' : 'Updating Tail pointer.',
                          kind: 'relationship',
                          timestamp: Date.now(),
                        });
                      }
                    }
                  });
                  this.animationScheduler.commitSequential();

                  const targetEl = this.sceneManager.getElement(nodeToDeleteId) as any;
                  this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                  
                  if (targetEl) {
                    this.animationScheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 500, easing: 'easeInBack' });
                    this.animationScheduler.enqueue({ targets: targetEl.position, y: '+=2', duration: 500, easing: 'easeInBack' });
                    this.animationScheduler.commitGroup(true);
                  }
                  
                  const remainingEls = allEls.filter((el: any) => el.id !== nodeToDeleteId && el.originalType !== 'EDGE');
                  remainingEls.forEach((el: any) => {
                    if (el.worldTarget) {
                      this.animationScheduler.enqueue({ targets: el.position, x: el.worldTarget.x, y: el.worldTarget.y, z: el.worldTarget.z, duration: 500, easing: 'easeOutCubic' });
                    }
                  });
                  this.animationScheduler.commitGroup(true);
                  
                  this.animationScheduler.enqueue({
                    targets: {}, duration: 1, complete: () => {
                      this.sceneManager.removeElement(nodeToDeleteId!);
                      this.stateManager.saveState(this.sceneManager.getSceneGraph(), `${actionName}`, this.animationScheduler.getCurrentTime());
                      this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'RESULT',
                        message: 'Deletion Complete.',
                        kind: 'result',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.commitSequential();
                }
              }
            }
          } else if (actionName === 'UPDATE') {
            let targetEl = gen.targetId ? this.sceneManager.getElement(gen.targetId) as any : null;
            if (!targetEl && gen.args && gen.args.length > 0) {
              targetEl = this.sceneManager.getElement(String(gen.args[0])) as any;
            }
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
          } else if (actionName === 'TREE' || actionName === 'BINARY_TREE') {
            this.activeTreeName = gen.args[0];
            // Initialize an empty tree if it doesn't exist
            if (!this.sceneManager.getElement(this.activeTreeName!)) {
              this.sceneManager.addElement({
                id: this.activeTreeName!, type: 'TREE', label: this.activeTreeName!
              } as any);
            }
            this.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: 'TREE',
              message: `Tree "${this.activeTreeName}" initialized.`,
              kind: 'operation',
              timestamp: Date.now(),
            });
          } else if (actionName === 'ROOT' || actionName === 'CHILD' || actionName === 'PARENT' || actionName === 'LEFT_CHILD' || actionName === 'RIGHT_CHILD') {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            let parentId = null;
            let childId = null;
            let edgeLabel = undefined;

            if (actionName === 'ROOT') {
              childId = String(gen.args[0]);
            } else if (actionName === 'CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
            } else if (actionName === 'PARENT') {
              childId = String(gen.args[0]);
              parentId = String(gen.args[1]);
            } else if (actionName === 'LEFT_CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
              edgeLabel = 'L';
            } else if (actionName === 'RIGHT_CHILD') {
              parentId = String(gen.args[0]);
              childId = String(gen.args[1]);
              edgeLabel = 'R';
            }

            if (childId && activeTree) {
              // Ensure child node exists
              let childEl = this.sceneManager.getElement(childId);
              if (!childEl) {
                childEl = {
                  id: childId, type: 'sphere', value: childId, label: childId,
                  logicalParent: activeTree, originalType: 'TREE_NODE',
                  position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
                  color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
                  lifecycleState: 'ACTIVE', visible: true, opacity: 1
                } as any;
                this.sceneManager.addElement(childEl as any);
              }

              // Ensure parent node exists if it's a CHILD or PARENT action
              if (parentId) {
                let parentEl = this.sceneManager.getElement(parentId);
                if (!parentEl) {
                  parentEl = {
                    id: parentId, type: 'sphere', value: parentId, label: parentId,
                    logicalParent: activeTree, originalType: 'TREE_NODE',
                    position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
                    color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
                    lifecycleState: 'ACTIVE', visible: true, opacity: 1
                  } as any;
                  this.sceneManager.addElement(parentEl as any);
                }

                // Create edge
                const edgeId = `edge_${parentId}_${childId}`;
                if (!this.sceneManager.getElement(edgeId)) {
                  const edge: any = {
                    id: edgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
                    color: '#888888', sourceId: parentId, targetId: childId, directed: true,
                    logicalParent: activeTree, originalType: 'EDGE',
                    properties: edgeLabel ? { label: edgeLabel } : undefined
                  };
                  this.sceneManager.addElement(edge);
                  this.relationshipManager.addRelationship({
                    id: edgeId, sourceId: parentId, targetId: childId, type: 'edge', directed: true
                  });
                }
              }

              // Update Layout and animate
              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

              const allEls = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType !== 'EDGE');
              allEls.forEach(el => {
                if ((el as any).worldTarget) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: (el as any).worldTarget.x,
                    y: (el as any).worldTarget.y,
                    z: (el as any).worldTarget.z,
                    duration: 500,
                    easing: 'easeOutCubic'
                  });
                  if (el.id === childId || el.id === parentId) {
                    this.animationScheduler.enqueue({
                      targets: el.scale,
                      x: 1, y: 1, z: 1,
                      duration: 600,
                      easing: 'easeOutBack'
                    });
                  }
                }
              });
              this.animationScheduler.commitGroup(true);

              this.animationScheduler.enqueue({
                targets: {}, duration: 1, complete: () => {
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `${actionName} operation`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  // Emit textual log for structural tree operations
                  if (actionName === 'ROOT') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'ROOT',
                      message: `Node "${childId}" set as root of tree "${activeTree}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'CHILD',
                      message: `Node "${childId}" added as child of "${parentId}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'PARENT') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'PARENT',
                      message: `Node "${childId}" set as child of "${parentId}".`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'LEFT_CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'LEFT_CHILD',
                      message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Left Child of ${parentId}.\nInsertion Complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else if (actionName === 'RIGHT_CHILD') {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'RIGHT_CHILD',
                      message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Right Child of ${parentId}.\nInsertion Complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  }
                }
              });
              this.animationScheduler.commitSequential();
            }
          } else if (['SIBLING', 'ANCESTORS', 'DESCENDANTS'].includes(actionName)) {
            const targetId = String(gen.args[0]);
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'EDGE');
            
            const children: Map<string, string[]> = new Map();
            const parentMap: Map<string, string> = new Map();
            treeEdges.forEach((e: any) => {
              if (!children.has(e.sourceId)) children.set(e.sourceId, []);
              children.get(e.sourceId)!.push(e.targetId);
              parentMap.set(e.targetId, e.sourceId);
            });
            
            const toHighlight: string[] = [];
            
            if (actionName === 'SIBLING') {
              const p = parentMap.get(targetId);
              if (p) {
                const sibs = (children.get(p) || []).filter(c => c !== targetId);
                toHighlight.push(...sibs);
              }
            } else if (actionName === 'ANCESTORS') {
              let curr = parentMap.get(targetId);
              while (curr) {
                toHighlight.push(curr);
                curr = parentMap.get(curr);
              }
            } else if (actionName === 'DESCENDANTS') {
              const q = [targetId];
              while (q.length > 0) {
                const curr = q.shift()!;
                const ch = children.get(curr) || [];
                toHighlight.push(...ch);
                q.push(...ch);
              }
            }
            
            toHighlight.forEach(id => {
              const realEl = this.sceneManager.getElement(id) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.8, duration: 400 });
              }
            });
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(600);
            
            toHighlight.forEach(id => {
              const realEl = this.sceneManager.getElement(id) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveIntensity: 0, duration: 400 });
              }
            });
            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName, message: `Highlighted ${toHighlight.length} ${actionName.toLowerCase()} of ${targetId}.`, kind: 'operation', timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
          } else if (actionName === 'CLEAR') {
            let activeTree = this.activeTreeName;
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree);
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'CLEAR', message: 'Clearing tree...', kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
              treeNodes.forEach(node => {
                const realEl = this.sceneManager.getElement(node.id) as any;
                if (realEl) {
                  this.animationScheduler.enqueue({ targets: realEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                treeNodes.forEach(node => this.sceneManager.removeElement(node.id));
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), 'Tree Cleared', this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'IS_EMPTY') {
            let activeTree = this.activeTreeName;
            if (activeTree) {
              const count = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE').length;
              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'IS_EMPTY', message: count === 0 ? 'Tree is Empty.' : `Tree is not empty (size: ${count}).`, kind: 'operation', timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitSequential();
            }
          } else if (actionName === 'SEARCH') {
            const searchVal = gen.args[0];
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');
            
            const children: Map<string, string[]> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            const hasParent = new Set<string>();
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                hasParent.add(e.targetId);
              }
            });
            const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || (treeNodes[0]?.id);
            
            const order: string[] = [];
            let found = false;
            
            const dfsSearch = (id: string): void => {
              if (found) return;
              order.push(id);
              const node = treeNodes.find((n: any) => n.id === id) as any;
              if (node && (node.value == searchVal || node.label == searchVal || node.id == searchVal)) {
                found = true;
                return;
              }
              (children.get(id) || []).forEach((c: string) => dfsSearch(c));
            };
            
            if (root) dfsSearch(root);
            
            const visitedSoFar: string[] = [];
            order.forEach((nodeId, idx) => {
               const realEl = this.sceneManager.getElement(nodeId) as any;
               const isTarget = idx === order.length - 1 && found;
               if (realEl) {
                  this.animationScheduler.enqueue({
                    targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.8, duration: 300, easing: 'easeOutExpo',
                    complete: () => {
                      visitedSoFar.push(realEl.label || realEl.id);
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'SEARCH', message: `Visited: ${visitedSoFar.join(' -> ')}`, kind: 'operation', timestamp: Date.now()
                      });
                      if (isTarget) {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'SEARCH_SUCCESS', message: `Value ${searchVal} found at node ${realEl.label || realEl.id}.`, kind: 'result', timestamp: Date.now()
                        });
                      } else if (idx === order.length - 1 && !found) {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: 'SEARCH_FAIL', message: `Value ${searchVal} not found in the tree.`, kind: 'result', timestamp: Date.now()
                        });
                      }
                    }
                  });
                  this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(400);
                  
                  if (!isTarget) {
                     this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveIntensity: 0, duration: 300 });
                     this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 300 });
                     this.animationScheduler.commitGroup(true);
                  }
               }
            });
          } else if (['PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'ZIGZAG', 'DFS', 'BFS'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              // Build parent->children adjacency map from edges
              const children: Map<string, string[]> = new Map();
              const leftChild: Map<string, string> = new Map();
              const rightChild: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                  if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                  if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
                }
              });
              // Find roots (nodes with no parent)
              const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
              const root = roots[0] || (treeNodes[0]?.id);

              // Traversal algorithms - return ordered array of node IDs
              const order: string[] = [];

              const preorder = (id: string): void => {
                order.push(id);
                (children.get(id) || []).forEach((c: string) => preorder(c));
              };
              const inorder = (id: string): void => {
                const ch = children.get(id) || [];
                const lc = leftChild.has(id) ? leftChild.get(id) : ch[0];
                const rc = rightChild.has(id) ? rightChild.get(id) : ch[1];
                if (lc) inorder(lc);
                order.push(id);
                if (rc) inorder(rc);
              };
              const postorder = (id: string): void => {
                (children.get(id) || []).forEach((c: string) => postorder(c));
                order.push(id);
              };
              const levelorder = (id: string): void => {
                const queue = [id];
                while (queue.length > 0) {
                  const cur = queue.shift()!;
                  order.push(cur);
                  (children.get(cur) || []).forEach((c: string) => queue.push(c));
                }
              };
              const reverselevelorder = (id: string): void => {
                const queue = [id];
                while (queue.length > 0) {
                  const cur = queue.shift()!;
                  order.push(cur);
                  const ch = children.get(cur) || [];
                  const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
                  const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
                  if (rc) queue.push(rc); // right first so reverse works out to left first
                  if (lc) queue.push(lc);
                }
                order.reverse();
              };
              const zigzag = (id: string): void => {
                let currentLevel = [id];
                let leftToRight = true;
                while (currentLevel.length > 0) {
                  const nextLevel: string[] = [];
                  const vals = leftToRight ? currentLevel : [...currentLevel].reverse();
                  order.push(...vals);
                  
                  for (const cur of currentLevel) {
                    const ch = children.get(cur) || [];
                    const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
                    const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
                    if (lc) nextLevel.push(lc);
                    if (rc) nextLevel.push(rc);
                  }
                  currentLevel = nextLevel;
                  leftToRight = !leftToRight;
                }
              };
              const dfs = (id: string): void => {
                const stack = [id];
                const visited = new Set<string>();
                while (stack.length > 0) {
                  const cur = stack.pop()!;
                  if (visited.has(cur)) continue;
                  visited.add(cur);
                  order.push(cur);
                  const ch = (children.get(cur) || []).slice().reverse();
                  ch.forEach((c: string) => stack.push(c));
                }
              };
              const bfs = (id: string): void => { levelorder(id); };

              if (root) {
                if (actionName === 'PREORDER')   preorder(root);
                else if (actionName === 'INORDER') inorder(root);
                else if (actionName === 'POSTORDER')  postorder(root);
                else if (actionName === 'LEVELORDER') levelorder(root);
                else if (actionName === 'REVERSELEVELORDER') reverselevelorder(root);
                else if (actionName === 'ZIGZAG') zigzag(root);
                else if (actionName === 'DFS')        dfs(root);
                else if (actionName === 'BFS')        bfs(root);
              }

              // Map node IDs to labels for display
              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
              const traversalLabels = order.map((id: string) => labelMap.get(id) || id);
              const traversalText = traversalLabels.join(' → ');

              // Emit header log event BEFORE animations start
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  let traversalName = actionName.charAt(0) + actionName.slice(1).toLowerCase();
                  if (actionName === 'LEVELORDER') traversalName = 'Level-Order';
                  else if (actionName === 'REVERSELEVELORDER') traversalName = 'Reverse Level-Order';
                  else if (actionName === 'ZIGZAG') traversalName = 'Zig-Zag';
                  else if (actionName === 'DFS') traversalName = 'DFS';
                  else if (actionName === 'BFS') traversalName = 'BFS';
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: `${traversalName} Traversal — Starting from root "${labelMap.get(root!) || root}"\nVisit Order:\n${traversalText}`,
                    kind: 'traversal',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // Animate each node glowing in traversal order, sequentially
              // Also emit per-node step logs synchronized with each highlight
              const GLOW_DURATION = 700;
              const GLOW_COLOR = '#63b3ed';
              const visitedSoFar: string[] = [];
              order.forEach((nodeId: string, nodeIdx: number) => {
                const realEl = this.sceneManager.getElement(nodeId) as any;
                const nodeLabel = labelMap.get(nodeId) || nodeId;
                if (realEl) {
                  const origColor = realEl.color || '#4facfe';
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: GLOW_COLOR,
                    emissiveColor: GLOW_COLOR,
                    emissiveIntensity: 0.9,
                    duration: 200,
                    easing: 'easeOutExpo',
                    complete: () => {
                      // Per-node step log — fires as each node is highlighted
                      visitedSoFar.push(nodeLabel);
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'VISITING',
                        message: visitedSoFar.join(' → '),
                        kind: 'step',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.25, y: 1.25, z: 1.25,
                    duration: 200, easing: 'easeOutExpo',
                  });
                  this.animationScheduler.commitGroup(true);

                  this.animationScheduler.advanceCursor(GLOW_DURATION - 400);

                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: origColor,
                    emissiveColor: '#000000',
                    emissiveIntensity: 0,
                    duration: 200, easing: 'easeInExpo',
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1, y: 1, z: 1,
                    duration: 200, easing: 'easeInExpo',
                  });
                  this.animationScheduler.commitGroup(true);
                }
              });
              this.animationScheduler.advanceCursor(200);
            }
          } else if (['HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              const children: Map<string, string[]> = new Map();
              const leftChild: Map<string, string> = new Map();
              const rightChild: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                  if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                  if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
                }
              });
              const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
              const root = roots[0] || treeNodes[0]?.id;

              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

              // We'll execute an animated sequence for counting or path finding.
              const nodesToHighlight: string[] = [];
              let finalMessage = '';
              let stepKeyword = '';
              let stepMessageFormat = '';

              if (['COUNT_NODES', 'SIZE'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.map((n: any) => n.id));
                finalMessage = `Total Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_NODES';
                stepMessageFormat = 'Node Found: {label}';
              } else if (['COUNT_LEAVES', 'LEAVES'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0)).map((n: any) => n.id));
                finalMessage = `Total Leaf Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_LEAVES';
                stepMessageFormat = 'Leaf Found: {label}';
              } else if (['COUNT_INTERNAL', 'INTERNAL'].includes(actionName)) {
                nodesToHighlight.push(...treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0).map((n: any) => n.id));
                finalMessage = `Total Internal Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_INTERNAL';
                stepMessageFormat = 'Internal Node Found: {label}';
              } else if (actionName === 'COUNT_LEFT_LEAVES') {
                const leftLeaves = Array.from(leftChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
                nodesToHighlight.push(...leftLeaves);
                finalMessage = `Total Left Leaves = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_LEFT_LEAVES';
                stepMessageFormat = 'Left Leaf Found: {label}';
              } else if (actionName === 'COUNT_RIGHT_LEAVES') {
                const rightLeaves = Array.from(rightChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
                nodesToHighlight.push(...rightLeaves);
                finalMessage = `Total Right Leaves = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_RIGHT_LEAVES';
                stepMessageFormat = 'Right Leaf Found: {label}';
              } else if (actionName === 'COUNT_FULL') {
                nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 2).map((n: any) => n.id));
                finalMessage = `Total Full Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_FULL';
                stepMessageFormat = 'Full Node Found: {label}';
              } else if (actionName === 'COUNT_HALF') {
                nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 1).map((n: any) => n.id));
                finalMessage = `Total Half Nodes = ${nodesToHighlight.length}`;
                stepKeyword = 'COUNT_HALF';
                stepMessageFormat = 'Half Node Found: {label}';
              } else if (['HEIGHT', 'MAX_DEPTH'].includes(actionName)) {
                let maxPath: string[] = [];
                const dfsPath = (id: string, currentPath: string[]) => {
                  currentPath.push(id);
                  const ch = children.get(id) || [];
                  if (ch.length === 0) {
                    if (currentPath.length > maxPath.length) maxPath = [...currentPath];
                  } else {
                    ch.forEach(c => dfsPath(c, [...currentPath]));
                  }
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...maxPath);
                finalMessage = `Max Depth / Height = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
                stepKeyword = actionName;
                stepMessageFormat = 'Traversing longest path: {label}';
              } else if (actionName === 'MIN_DEPTH') {
                let minPath: string[] = [];
                let minLen = Infinity;
                const dfsPath = (id: string, currentPath: string[]) => {
                  currentPath.push(id);
                  const ch = children.get(id) || [];
                  if (ch.length === 0) {
                    if (currentPath.length < minLen) {
                      minLen = currentPath.length;
                      minPath = [...currentPath];
                    }
                  } else {
                    ch.forEach(c => dfsPath(c, [...currentPath]));
                  }
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...minPath);
                finalMessage = `Minimum Depth = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
                stepKeyword = 'MIN_DEPTH';
                stepMessageFormat = 'Traversing shortest path: {label}';
              } else if (['DEPTH', 'LEVEL'].includes(actionName)) {
                const targetNode = gen.args[0];
                let path: string[] = [];
                const dfsPath = (id: string, currentPath: string[]): boolean => {
                  currentPath.push(id);
                  if (id === targetNode || labelMap.get(id) === targetNode) {
                    path = [...currentPath];
                    return true;
                  }
                  for (const c of (children.get(id) || [])) {
                    if (dfsPath(c, [...currentPath])) return true;
                  }
                  return false;
                };
                if (root) dfsPath(root, []);
                nodesToHighlight.push(...path);
                const d = path.length > 0 ? path.length - 1 : -1;
                finalMessage = `${actionName === 'LEVEL' ? 'Level' : 'Depth'} of "${targetNode || 'root'}" = ${d >= 0 ? d : '(not found)'}`;
                stepKeyword = actionName;
                stepMessageFormat = 'Traversing path to target: {label}';
              } else if (actionName === 'DEGREE') {
                 const degreeMap = treeNodes.map((n: any) => `${n.label || n.id}:${(children.get(n.id) || []).length}`);
                 finalMessage = `Degree per node: ${degreeMap.join(', ')}`;
                 stepKeyword = 'DEGREE';
              } else if (actionName === 'STATS') {
                 const totalNodes = treeNodes.length;
                 const leafNodes = treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0));
                 const internalNodes = treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0);
                 const treeHeight = (id: string): number => {
                   const ch = children.get(id) || [];
                   if (ch.length === 0) return 0;
                   return 1 + Math.max(...ch.map((c: string) => treeHeight(c)));
                 };
                 const height = root ? treeHeight(root) : 0;
                 finalMessage = `Size: ${totalNodes} | Height: ${height} | Leaves: ${leafNodes.length} | Internal: ${internalNodes.length} | Root: ${root ? (labelMap.get(root) || root) : 'none'}`;
                 stepKeyword = 'STATS';
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: `Executing ${actionName}...`,
                    kind: 'info',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              if (nodesToHighlight.length > 0 && stepMessageFormat) {
                // Animate sequentially
                const GLOW_DURATION = 500;
                nodesToHighlight.forEach((nodeId: string) => {
                  const realEl = this.sceneManager.getElement(nodeId) as any;
                  const nodeLabel = labelMap.get(nodeId) || nodeId;
                  if (realEl) {
                    const origColor = realEl.color || '#4facfe';
                    this.animationScheduler.enqueue({
                      targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 200, easing: 'easeOutExpo',
                      complete: () => {
                        this.eventDispatcher.dispatch('RUNTIME_LOG', {
                          keyword: stepKeyword,
                          message: stepMessageFormat.replace('{label}', nodeLabel),
                          kind: 'step',
                          timestamp: Date.now(),
                        });
                      }
                    });
                    this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.25, y: 1.25, z: 1.25, duration: 200, easing: 'easeOutExpo' });
                    this.animationScheduler.commitGroup(true);
                    this.animationScheduler.advanceCursor(GLOW_DURATION - 400);
                    this.animationScheduler.enqueue({ targets: realEl, color: origColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200, easing: 'easeInExpo' });
                    this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 200, easing: 'easeInExpo' });
                    this.animationScheduler.commitGroup(true);
                  }
                });
              } else if (nodesToHighlight.length === 0 && !['DEGREE', 'STATS'].includes(actionName)) {
                  // Pulse all tree nodes briefly in purple to acknowledge the query if no specific nodes to highlight
                  const treeEls = treeNodes.map((n: any) => this.sceneManager.getElement(n.id)).filter(Boolean) as any[];
                  if (treeEls.length > 0) {
                    this.animationScheduler.enqueue({ targets: treeEls, emissiveColor: '#c486eb', emissiveIntensity: 0.6, duration: 300 });
                    this.animationScheduler.commitGroup(true);
                    this.animationScheduler.advanceCursor(400);
                    this.animationScheduler.enqueue({ targets: treeEls, emissiveIntensity: 0, duration: 300 });
                    this.animationScheduler.commitGroup(true);
                  }
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message: finalMessage,
                    kind: 'result',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(200);
            } else {
              this.animationScheduler.advanceCursor(300);
            }
          } else if (['IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const leftChild: Map<string, string> = new Map();
            const rightChild: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            const hasParent = new Set<string>();
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                hasParent.add(e.targetId);
                if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
                if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
              }
            });
            const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || treeNodes[0]?.id;

            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

            let propertyPassed = true;
            let failReason = '';
            let failNodeId = '';
            const traversalOrder: string[] = [];

            const treeHeight = (id: string | undefined): number => {
              if (!id) return 0;
              const lc = leftChild.get(id);
              const rc = rightChild.get(id);
              return 1 + Math.max(treeHeight(lc), treeHeight(rc));
            };

            if (actionName === 'IS_FULL') {
              const queue = [root].filter(Boolean);
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                const rc = rightChild.get(cur);
                if ((lc && !rc) || (!lc && rc)) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has exactly one child.`;
                }
                if (lc) queue.push(lc);
                if (rc) queue.push(rc);
              }
              if (propertyPassed) failReason = 'Every node has either 0 or 2 children.';
            } else if (actionName === 'IS_COMPLETE') {
              const queue = [root].filter(Boolean);
              let seenEmpty = false;
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                if (cur === null) {
                  seenEmpty = true;
                } else {
                  traversalOrder.push(cur);
                  if (seenEmpty) {
                    propertyPassed = false;
                    failNodeId = cur;
                    failReason = `Tree contains missing nodes before occupied nodes (Found node ${labelMap.get(cur) || cur} after an empty spot).`;
                  } else {
                    queue.push(leftChild.get(cur) || (null as any));
                    queue.push(rightChild.get(cur) || (null as any));
                  }
                }
              }
              if (propertyPassed) failReason = 'All levels are filled left-to-right without gaps.';
            } else if (actionName === 'IS_PERFECT') {
              const h = treeHeight(root);
              const queue = [{id: root, level: 1}].filter(n => n.id);
              while (queue.length > 0 && propertyPassed) {
                const {id, level} = queue.shift()!;
                traversalOrder.push(id!);
                const lc = leftChild.get(id!);
                const rc = rightChild.get(id!);
                if (lc || rc) {
                  if (!lc || !rc) {
                    propertyPassed = false;
                    failNodeId = id!;
                    failReason = `Node ${labelMap.get(id!) || id!} is an internal node but doesn't have 2 children.`;
                  }
                } else if (level !== h) {
                  propertyPassed = false;
                  failNodeId = id!;
                  failReason = `Leaf node ${labelMap.get(id!) || id!} is at level ${level}, but expected level ${h}.`;
                }
                if (lc) queue.push({id: lc, level: level + 1});
                if (rc) queue.push({id: rc, level: level + 1});
              }
              if (propertyPassed) failReason = `All leaves are at level ${h} and internal nodes have 2 children.`;
            } else if (actionName === 'IS_BALANCED') {
              const checkBalance = (id: string | undefined): boolean => {
                if (!id) return true;
                traversalOrder.push(id);
                const lc = leftChild.get(id);
                const rc = rightChild.get(id);
                const lh = treeHeight(lc);
                const rh = treeHeight(rc);
                if (Math.abs(lh - rh) > 1) {
                  propertyPassed = false;
                  failNodeId = id;
                  failReason = `Node ${labelMap.get(id) || id} is unbalanced (left height: ${lh}, right height: ${rh}).`;
                  return false;
                }
                return checkBalance(lc) && checkBalance(rc);
              };
              if (root) checkBalance(root);
              if (propertyPassed) failReason = 'All nodes have height differences of at most 1 between subtrees.';
            } else if (actionName === 'IS_DEGENERATE') {
              const queue = [root].filter(Boolean);
              while (queue.length > 0 && propertyPassed) {
                const cur = queue.shift()!;
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                const rc = rightChild.get(cur);
                if (lc && rc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has two children. Degenerate trees have at most one child per node.`;
                }
                if (lc) queue.push(lc);
                if (rc) queue.push(rc);
              }
              if (propertyPassed) failReason = 'Every node has at most one child (resembles a linked list).';
            } else if (actionName === 'IS_LEFT_SKEWED') {
              let cur = root;
              while (cur && propertyPassed) {
                traversalOrder.push(cur);
                const rc = rightChild.get(cur);
                if (rc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has a right child. Left skewed trees only have left children.`;
                }
                cur = leftChild.get(cur);
              }
              if (propertyPassed) failReason = 'All nodes only have left children.';
            } else if (actionName === 'IS_RIGHT_SKEWED') {
              let cur = root;
              while (cur && propertyPassed) {
                traversalOrder.push(cur);
                const lc = leftChild.get(cur);
                if (lc) {
                  propertyPassed = false;
                  failNodeId = cur;
                  failReason = `Node ${labelMap.get(cur) || cur} has a left child. Right skewed trees only have right children.`;
                }
                cur = rightChild.get(cur);
              }
              if (propertyPassed) failReason = 'All nodes only have right children.';
            } else if (actionName === 'IS_SYMMETRIC') {
              const isMirror = (node1: string | undefined, node2: string | undefined): boolean => {
                if (!node1 && !node2) return true;
                if (node1 && !node2) {
                  propertyPassed = false; failNodeId = node1; failReason = `Node ${labelMap.get(node1) || node1} has no mirror counterpart.`; return false;
                }
                if (!node1 && node2) {
                  propertyPassed = false; failNodeId = node2; failReason = `Node ${labelMap.get(node2) || node2} has no mirror counterpart.`; return false;
                }
                traversalOrder.push(node1!);
                traversalOrder.push(node2!);
                const el1 = this.sceneManager.getElement(node1!) as any;
                const el2 = this.sceneManager.getElement(node2!) as any;
                if (el1?.value !== el2?.value) {
                  propertyPassed = false; failNodeId = node1!; failReason = `Values do not match: ${el1?.value} vs ${el2?.value}`; return false;
                }
                return isMirror(leftChild.get(node1!), rightChild.get(node2!)) && isMirror(rightChild.get(node1!), leftChild.get(node2!));
              };
              if (root) isMirror(leftChild.get(root), rightChild.get(root));
              if (propertyPassed) failReason = 'The left and right subtrees are mirror images of each other.';
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              const readableName = actionName.replace('IS_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Checking ${readableName}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            traversalOrder.forEach((nodeId) => {
              const realEl = this.sceneManager.getElement(nodeId) as any;
              if (realEl) {
                this.animationScheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 250 });
                this.animationScheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(100);
                this.animationScheduler.enqueue({ targets: realEl, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 250 });
                this.animationScheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 250 });
                this.animationScheduler.commitGroup(true);
              }
            });

            this.animationScheduler.advanceCursor(200);

            if (!propertyPassed && failNodeId) {
              const failEl = this.sceneManager.getElement(failNodeId) as any;
              if (failEl) {
                this.animationScheduler.enqueue({ targets: failEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 400 });
                this.animationScheduler.enqueue({ targets: failEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
                this.animationScheduler.commitGroup(true);
                this.animationScheduler.advanceCursor(600);
                this.animationScheduler.enqueue({ targets: failEl, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
                this.animationScheduler.enqueue({ targets: failEl.scale, x: 1, y: 1, z: 1, duration: 300 });
                this.animationScheduler.commitGroup(true);
              }
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              const resString = propertyPassed ? 'PASS' : 'FAIL';
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: `${actionName}_RESULT`,
                message: `Result: ${resString}\n${failReason}\nTree is ${propertyPassed ? '' : 'NOT '}the required property.`,
                kind: propertyPassed ? 'result' : 'warning',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(200);

          } else if (['LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const parent: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                parent.set(e.targetId, e.sourceId);
              }
            });

            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
            
            const resolveTarget = (arg: any): string => {
              const val = String(arg);
              const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
              return byLabel ? byLabel.id : val;
            };

            const getPathToRoot = (id: string): string[] => {
              const p: string[] = [];
              let cur: string | undefined = id;
              while (cur) {
                p.push(cur);
                cur = parent.get(cur);
              }
              return p;
            };

            let nodesToHighlight: string[] = [];
            let path1Highlight: string[] = [];
            let path2Highlight: string[] = [];
            let finalMessage = '';

            if (actionName === 'LCA' || actionName === 'DISTANCE') {
              const nodeA = resolveTarget(gen.args[0]);
              const nodeB = resolveTarget(gen.args[1]);
              
              if (allNodeIds.has(nodeA) && allNodeIds.has(nodeB)) {
                const pathA = getPathToRoot(nodeA).reverse();
                const pathB = getPathToRoot(nodeB).reverse();
                
                let lca = '';
                for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
                  if (pathA[i] === pathB[i]) lca = pathA[i];
                  else break;
                }
                
                if (actionName === 'LCA') {
                  path1Highlight = getPathToRoot(nodeA);
                  path2Highlight = getPathToRoot(nodeB);
                  nodesToHighlight = [lca];
                  finalMessage = `Lowest Common Ancestor of ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${labelMap.get(lca) || lca}.`;
                } else {
                  const distA = pathA.length - 1 - pathA.indexOf(lca);
                  const distB = pathB.length - 1 - pathB.indexOf(lca);
                  const totalDist = distA + distB;
                  nodesToHighlight = [nodeA, nodeB, lca];
                  finalMessage = `Distance between ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${totalDist} edges. (LCA: ${labelMap.get(lca) || lca})`;
                }
              } else {
                finalMessage = `Nodes not found for ${actionName}.`;
              }
            } else if (actionName === 'GRANDPARENT') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              if (gp) {
                path1Highlight = [node, p!, gp];
                nodesToHighlight = [gp];
                finalMessage = `Grandparent of ${labelMap.get(node) || node} is ${labelMap.get(gp) || gp}.`;
              } else {
                finalMessage = `${labelMap.get(node) || node} does not have a grandparent.`;
              }
            } else if (actionName === 'UNCLE') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              if (gp) {
                const uncle = (children.get(gp) || []).find(c => c !== p);
                if (uncle) {
                  path1Highlight = [node, p!, gp, uncle];
                  nodesToHighlight = [uncle];
                  finalMessage = `Uncle of ${labelMap.get(node) || node} is ${labelMap.get(uncle) || uncle}.`;
                } else {
                  finalMessage = `${labelMap.get(node) || node} does not have an uncle.`;
                }
              } else {
                finalMessage = `${labelMap.get(node) || node} does not have an uncle (no grandparent).`;
              }
            } else if (actionName === 'COUSINS') {
              const node = resolveTarget(gen.args[0]);
              const p = parent.get(node);
              const gp = p ? parent.get(p) : undefined;
              const cousins: string[] = [];
              if (gp) {
                const uncles = (children.get(gp) || []).filter(c => c !== p);
                uncles.forEach(u => cousins.push(...(children.get(u) || [])));
              }
              nodesToHighlight = cousins;
              if (cousins.length > 0) {
                finalMessage = `Cousins of ${labelMap.get(node) || node}: ${cousins.map(c => labelMap.get(c) || c).join(', ')}`;
              } else {
                finalMessage = `${labelMap.get(node) || node} has no cousins.`;
              }
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Executing ${actionName}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            const highlightSequence = (path: string[], color: string) => {
              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: color, emissiveColor: color, emissiveIntensity: 0.8, duration: 250 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.1, y: 1.1, z: 1.1, duration: 250 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(100);
                }
              });
            };

            if (path1Highlight.length > 0) highlightSequence(path1Highlight.reverse(), '#9f7aea'); // Animate from node to target
            if (path2Highlight.length > 0) highlightSequence(path2Highlight.reverse(), '#ed64a6');

            if (nodesToHighlight.length > 0) {
              this.animationScheduler.advanceCursor(200);
              nodesToHighlight.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 1.0, duration: 300 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 300 });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(600);
            }

            const allHighlighted = new Set([...path1Highlight, ...path2Highlight, ...nodesToHighlight]);
            allHighlighted.forEach(id => {
              const el = this.sceneManager.getElement(id) as any;
              if (el) {
                this.animationScheduler.enqueue({ targets: el, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
                this.animationScheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
              }
            });
            this.animationScheduler.commitGroup(true);

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: `${actionName}_RESULT`,
                message: finalMessage,
                kind: 'result',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);
            this.animationScheduler.advanceCursor(200);

          } else if (['ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH'].includes(actionName)) {
            let activeTree = this.activeTreeName || 'defaultTree';
            const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
            const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

            const children: Map<string, string[]> = new Map();
            const parent: Map<string, string> = new Map();
            const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
            treeEdges.forEach((e: any) => {
              if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                children.get(e.sourceId)!.push(e.targetId);
                parent.set(e.targetId, e.sourceId);
              }
            });

            const roots = treeNodes.filter((n: any) => !parent.has(n.id)).map((n: any) => n.id);
            const root = roots[0] || treeNodes[0]?.id;
            const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
            
            const resolveTarget = (arg: any): string => {
              const val = String(arg);
              const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
              return byLabel ? byLabel.id : val;
            };

            const findAllPaths = (node: string, currentPath: string[], allPaths: string[][]) => {
              currentPath.push(node);
              const ch = children.get(node) || [];
              if (ch.length === 0) {
                allPaths.push([...currentPath]);
              } else {
                ch.forEach(c => findAllPaths(c, [...currentPath], allPaths));
              }
            };

            let pathsToHighlight: string[][] = [];
            let logHeader = '';

            if (actionName === 'ROOT_TO_NODE') {
              const targetNode = resolveTarget(gen.args[0]);
              if (allNodeIds.has(targetNode)) {
                let cur: string | undefined = targetNode;
                const path: string[] = [];
                while (cur) {
                  path.push(cur);
                  cur = parent.get(cur);
                }
                pathsToHighlight = [path.reverse()];
                logHeader = `Root to Node Path for ${labelMap.get(targetNode) || targetNode}`;
              }
            } else if (actionName === 'ROOT_TO_LEAVES') {
              if (root) findAllPaths(root, [], pathsToHighlight);
              logHeader = 'Root to Leaf Path';
            } else if (actionName === 'LONGEST_PATH') {
              const allPaths: string[][] = [];
              if (root) findAllPaths(root, [], allPaths);
              let maxLen = 0;
              allPaths.forEach(p => { if (p.length > maxLen) maxLen = p.length; });
              pathsToHighlight = allPaths.filter(p => p.length === maxLen);
              logHeader = 'Longest Path(s)';
            } else if (actionName === 'SHORTEST_PATH') {
              const allPaths: string[][] = [];
              if (root) findAllPaths(root, [], allPaths);
              let minLen = Infinity;
              allPaths.forEach(p => { if (p.length < minLen) minLen = p.length; });
              pathsToHighlight = allPaths.filter(p => p.length === minLen);
              logHeader = 'Shortest Path(s)';
            }

            this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: actionName,
                message: `Executing ${logHeader}...`,
                kind: 'operation',
                timestamp: Date.now()
              });
            }});
            this.animationScheduler.commitGroup(true);

            pathsToHighlight.forEach((path, idx) => {
              const readablePath = path.map(id => labelMap.get(id) || id).join(' → ');
              
              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: '#48bb78', emissiveColor: '#48bb78', emissiveIntensity: 0.9, duration: 200 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 200 });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(100);
                }
              });

              this.animationScheduler.enqueue({ targets: {}, duration: 1, complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'PATH',
                  message: `${logHeader}\n\n${readablePath}`,
                  kind: 'result',
                  timestamp: Date.now()
                });
              }});
              this.animationScheduler.commitGroup(true);
              
              this.animationScheduler.advanceCursor(400);

              path.forEach(id => {
                const el = this.sceneManager.getElement(id) as any;
                if (el) {
                  this.animationScheduler.enqueue({ targets: el, color: this.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200 });
                  this.animationScheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
                }
              });
              this.animationScheduler.commitGroup(true);
            });
            this.animationScheduler.advanceCursor(200);

          } else if (['PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH'].indexOf(actionName) >= 0) {
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
              else activeTree = 'defaultTree';
              this.activeTreeName = activeTree;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              const children: Map<string, string[]> = new Map();
              const parent: Map<string, string> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!children.has(e.sourceId)) children.set(e.sourceId, []);
                  children.get(e.sourceId)!.push(e.targetId);
                  parent.set(e.targetId, e.sourceId);
                }
              });
              const roots = treeNodes.filter((n: any) => !parent.has(n.id));
              const root = roots[0]?.id;
              const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

              const targetArg = gen.args[0];
              const targetArg2 = gen.args[1];

              let resultIds: string[] = [];
              let message = '';

              if (actionName === 'PARENTOF') {
                const p = parent.get(targetArg);
                resultIds = p ? [p] : [];
                message = p ? `Parent of "${targetArg}": ${labelMap.get(p) || p}` : `"${targetArg}" is the root (no parent)`;
              } else if (actionName === 'CHILDRENOF') {
                resultIds = children.get(targetArg) || [];
                const labels = resultIds.map((id: string) => labelMap.get(id) || id);
                message = labels.length > 0
                  ? `Children of "${targetArg}": ${labels.join(', ')}`
                  : `"${targetArg}" has no children (leaf node)`;
              } else if (actionName === 'ANCESTORS') {
                let cur = parent.get(targetArg);
                while (cur) { resultIds.push(cur); cur = parent.get(cur); }
                message = resultIds.length > 0
                  ? `Ancestors of "${targetArg}": ${resultIds.map((id: string) => labelMap.get(id) || id).join(' ← ')}`
                  : `"${targetArg}" has no ancestors (is root)`;
              } else if (actionName === 'DESCENDANTS') {
                const collectDesc = (id: string): void => {
                  (children.get(id) || []).forEach((c: string) => { resultIds.push(c); collectDesc(c); });
                };
                collectDesc(targetArg);
                message = resultIds.length > 0
                  ? `Descendants of "${targetArg}" (${resultIds.length}): ${resultIds.map((id: string) => labelMap.get(id) || id).join(', ')}`
                  : `"${targetArg}" has no descendants (leaf node)`;
              } else if (actionName === 'SIBLINGS') {
                const p = parent.get(targetArg);
                const sibs = p ? (children.get(p) || []).filter((c: string) => c !== targetArg) : [];
                resultIds = sibs;
                message = sibs.length > 0
                  ? `Siblings of "${targetArg}": ${sibs.map((id: string) => labelMap.get(id) || id).join(', ')}`
                  : `"${targetArg}" has no siblings`;
              } else if (actionName === 'PATH') {
                // PATH from arg0 to arg1
                const findPath = (from: string, to: string): string[] | null => {
                  if (from === to) return [from];
                  for (const c of (children.get(from) || [])) {
                    const sub = findPath(c, to);
                    if (sub) return [from, ...sub];
                  }
                  return null;
                };
                const path = root ? (findPath(targetArg, targetArg2) || findPath(root, targetArg2) || []) : [];
                resultIds = path;
                message = path.length > 0
                  ? `Path ${targetArg} → ${targetArg2}: ${path.map((id: string) => labelMap.get(id) || id).join(' → ')}`
                  : `No path found from "${targetArg}" to "${targetArg2}"`;
              }

              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: actionName,
                    message,
                    kind: 'relationship',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // Highlight result nodes in orange, sequentially
              const HIGHLIGHT_COLOR = '#f5a623';
              const targetsToAnimate = resultIds.length > 0 ? resultIds : [targetArg];
              targetsToAnimate.forEach((nodeId: string) => {
                const realEl = this.sceneManager.getElement(nodeId) as any;
                if (realEl) {
                  const origColor = realEl.color || '#4facfe';
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: HIGHLIGHT_COLOR,
                    emissiveColor: HIGHLIGHT_COLOR,
                    emissiveIntensity: 0.8,
                    duration: 250,
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.2, y: 1.2, z: 1.2,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(600);
                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color: origColor,
                    emissiveColor: '#000000',
                    emissiveIntensity: 0,
                    duration: 250,
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1, y: 1, z: 1,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                }
              });
              this.animationScheduler.advanceCursor(200);
            }
          } else if (actionName === 'INSERT' && gen.args?.length >= 2) {
            // Tree node insertion: INSERT <node> INTO <parent> or INSERT <node> CHILD <parent>
            // args[0] = nodeId, args[1] = parentId (from AQVL compiler)
            const newNodeId = gen.args[0];
            const targetParentId = gen.args[1];
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            const treeNodesList = activeTree
              ? this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE')
              : [];
            const labelMapInsert = new Map(treeNodesList.map((n: any) => [n.id, n.label || n.value || n.id]));
            const newNodeLabel = labelMapInsert.get(newNodeId) || newNodeId;
            const parentLabel = labelMapInsert.get(targetParentId) || targetParentId;

            this.animationScheduler.enqueue({
              targets: {}, duration: 1,
              complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'INSERT',
                  message: targetParentId
                    ? `Node "${newNodeLabel}" inserted as child of "${parentLabel}".\nTree restructured successfully.`
                    : `Node "${newNodeLabel}" inserted into tree as root.\nTree restructured successfully.`,
                  kind: 'operation',
                  timestamp: Date.now(),
                });
              }
            });
            this.animationScheduler.commitGroup(true);
          } else if (actionName === 'DELETE') {
            // Tree node deletion: DELETE <node>
            const targetNodeId = gen.args[0] || gen.targetId;
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            const treeNodesForDel = activeTree
              ? this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE')
              : [];
            const labelMapDel = new Map(treeNodesForDel.map((n: any) => [n.id, n.label || n.value || n.id]));
            const deletedLabel = labelMapDel.get(targetNodeId) || targetNodeId;

            // Animate: shrink and remove the node
            const delEl = targetNodeId ? this.sceneManager.getElement(targetNodeId) as any : null;
            if (delEl) {
              this.animationScheduler.enqueue({
                targets: delEl,
                color: '#f44336',
                emissiveColor: '#f44336',
                emissiveIntensity: 0.8,
                duration: 300,
                easing: 'easeOutExpo',
              });
              this.animationScheduler.enqueue({
                targets: delEl.scale,
                x: 0, y: 0, z: 0,
                duration: 400,
                easing: 'easeInBack',
              });
              this.animationScheduler.commitGroup(true);

              // Remove edges connected to deleted node
              const connectedEdges = this.sceneManager.getSceneGraph().filter((el: any) =>
                el.type === 'edge' && (el.sourceId === targetNodeId || el.targetId === targetNodeId)
              );
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  connectedEdges.forEach((e: any) => this.sceneManager.removeElement(e.id));
                  this.sceneManager.removeElement(targetNodeId);
                  if (activeTree) {
                    this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());
                    const remainingNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
                    remainingNodes.forEach((el: any) => {
                      if ((el as any).worldTarget) {
                        this.animationScheduler.enqueue({
                          targets: el.position,
                          x: (el as any).worldTarget.x,
                          y: (el as any).worldTarget.y,
                          z: (el as any).worldTarget.z,
                          duration: 500,
                          easing: 'easeOutCubic',
                        });
                      }
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Deleted node ${deletedLabel}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DELETE',
                    message: `Node "${deletedLabel}" removed from tree.\nTree restructured.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitSequential();
            } else {
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DELETE',
                    message: `Node "${deletedLabel}" not found in tree.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (actionName === 'SEARCH') {
            // Tree search: SEARCH <nodeId>
            const searchTarget = gen.args[0];
            let activeTree = this.activeTreeName;
            if (!activeTree) {
              const trees = this.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
              if (trees.length > 0) activeTree = trees[0].id;
            }
            if (activeTree) {
              const treeNodes = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
              const treeEdges = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

              // Build adjacency map for BFS search
              const searchChildren: Map<string, string[]> = new Map();
              const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
              const hasParent = new Set<string>();
              treeEdges.forEach((e: any) => {
                if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
                  if (!searchChildren.has(e.sourceId)) searchChildren.set(e.sourceId, []);
                  searchChildren.get(e.sourceId)!.push(e.targetId);
                  hasParent.add(e.targetId);
                }
              });
              const searchRoot = treeNodes.find((n: any) => !hasParent.has(n.id))?.id || treeNodes[0]?.id;
              const labelMapSearch = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
              const targetLabel = labelMapSearch.get(searchTarget) || searchTarget;

              // Emit search start log
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'SEARCH',
                    message: `Searching for node "${targetLabel}"...`,
                    kind: 'search',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);

              // BFS traversal to find the node, animating + logging each visited node
              const searchVisited: string[] = [];
              let found = false;
              const bfsQueue = searchRoot ? [searchRoot] : [];
              const visited = new Set<string>();
              const SEARCH_GLOW = '#4ade80';
              const SEARCH_NOT_FOUND = '#f87171';

              while (bfsQueue.length > 0) {
                const curId = bfsQueue.shift()!;
                if (visited.has(curId)) continue;
                visited.add(curId);
                const curLabel = labelMapSearch.get(curId) || curId;
                searchVisited.push(curLabel);
                const isTarget = curId === searchTarget || curLabel === targetLabel;
                found = found || isTarget;

                const realEl = this.sceneManager.getElement(curId) as any;
                if (realEl) {
                  const color = isTarget ? '#22c55e' : SEARCH_GLOW;
                  const origColor = realEl.color || '#4facfe';
                  const visitedSnapshot = [...searchVisited];

                  this.animationScheduler.enqueue({
                    targets: realEl,
                    color,
                    emissiveColor: color,
                    emissiveIntensity: isTarget ? 1.0 : 0.6,
                    duration: 250,
                    easing: 'easeOutExpo',
                    complete: () => {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'VISITING',
                        message: `Visited:\n${visitedSnapshot.join(' → ')}`,
                        kind: 'search',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.enqueue({
                    targets: realEl.scale,
                    x: 1.2, y: 1.2, z: 1.2,
                    duration: 250,
                  });
                  this.animationScheduler.commitGroup(true);
                  this.animationScheduler.advanceCursor(400);

                  if (!isTarget) {
                    this.animationScheduler.enqueue({
                      targets: realEl,
                      color: origColor,
                      emissiveIntensity: 0,
                      duration: 200,
                    });
                    this.animationScheduler.enqueue({
                      targets: realEl.scale,
                      x: 1, y: 1, z: 1,
                      duration: 200,
                    });
                    this.animationScheduler.commitGroup(true);
                  }
                }

                if (isTarget) break;
                (searchChildren.get(curId) || []).forEach(c => bfsQueue.push(c));
              }

              // Final result log
              const visitedPath = searchVisited.join(' → ');
              this.animationScheduler.enqueue({
                targets: {}, duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'RESULT',
                    message: found
                      ? `Visited:\n${visitedPath}\n\nResult:\nNode "${targetLabel}" found.`
                      : `Visited:\n${visitedPath}\n\nResult:\nNode "${targetLabel}" not found.`,
                    kind: 'search',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(300);
            }
          }
          break;
        }

        case 'LINK_OBJECTS': {
          const link = instruction as LinkObjectsInstruction;
          const sourceEl = this.sceneManager.getElement(link.sourceId) as any;
          const targetEl = this.sceneManager.getElement(link.targetId) as any;
          
          if (sourceEl && targetEl) {
            const edgeId = `edge_${link.sourceId}_${link.targetId}`;
            const parent = sourceEl.logicalParent || targetEl.logicalParent;
            
            if (!this.sceneManager.getElement(edgeId)) {
              const newEdge: any = {
                id: edgeId,
                type: 'edge',
                position: { x: sourceEl.position.x, y: sourceEl.position.y, z: sourceEl.position.z },
                scale: { x: 1, y: 1, z: 1 },
                color: '#888888',
                emissiveIntensity: 0,
                emissiveColor: '#888888',
                sourceId: link.sourceId,
                targetId: link.targetId,
                directed: link.directed,
                relationType: link.relationType,
                logicalParent: parent,
                originalType: 'EDGE'
              };
              this.sceneManager.addElement(newEdge);
              
              this.relationshipManager.addRelationship({
                id: edgeId,
                sourceId: link.sourceId,
                targetId: link.targetId,
                type: 'edge',
                directed: link.directed,
                relationType: link.relationType
              });

              // Synchronous layout update
              this.layoutManager.updateLayout(this.sceneManager.getSceneGraph());

              // Animate all elements in the parent structure to their new positions
              const allEls = this.sceneManager.getSceneGraph().filter(el => el.logicalParent === parent && el.originalType !== 'EDGE');
              allEls.forEach(el => {
                if ((el as any).worldTarget) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: (el as any).worldTarget.x,
                    y: (el as any).worldTarget.y,
                    z: (el as any).worldTarget.z,
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
                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Linked ${link.sourceId} to ${link.targetId}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              });
              this.animationScheduler.commitSequential();
            }
          }
          break;
        }

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
            const vAllLeftEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.logicalIndex === leftIndex);
            const vAllRightEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.logicalIndex === rightIndex);
            
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

                const lVal = allLeftEls[0]?.value ?? swp.leftId;
                const rVal = allRightEls[0]?.value ?? swp.rightId;
                const lIdx = vRightEl.logicalIndex; // after swap, left is now at right's old index
                const rIdx = vLeftEl.logicalIndex;  // and right is at left's old index
                this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Swapped ${swp.leftId} and ${swp.rightId}`, this.animationScheduler.getCurrentTime());
                this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'SWAP',
                  message: `Swapped [${lIdx}] (${lVal}) ↔ [${rIdx}] (${rVal})`,
                  kind: 'swap',
                  timestamp: Date.now(),
                });
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
                const lVal = leftEl.value ?? leftEl.id;
                const rVal = rightEl.value ?? rightEl.id;
                const lIdx = leftEl.logicalIndex !== undefined ? leftEl.logicalIndex : leftEl.id;
                const rIdx = rightEl.logicalIndex !== undefined ? rightEl.logicalIndex : rightEl.id;
                const cmpSymbol = lVal < rVal ? '<' : lVal > rVal ? '>' : '=';
                const cmpWord = lVal < rVal ? 'less than' : lVal > rVal ? 'greater than' : 'equal to';
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'COMPARE',
                  message: `Comparing [${lIdx}]=${lVal} vs [${rIdx}]=${rVal}\n${lVal} ${cmpSymbol} ${rVal}  (${lVal} is ${cmpWord} ${rVal})`,
                  kind: 'compare',
                  timestamp: Date.now(),
                });
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
          const targetEl = this.sceneManager.getElement(hl.targetId) as any;
          if (targetEl) {
            this.animationScheduler.enqueue({
              targets: targetEl,
              color: hl.color,
              emissiveColor: hl.color,
              emissiveIntensity: 0.3,
              duration: 400,
              complete: () => {
                const idx = targetEl.logicalIndex !== undefined ? `[${targetEl.logicalIndex}]` : '';
                const val = targetEl.value !== undefined ? targetEl.value : targetEl.id;
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'HIGHLIGHT',
                  message: `Highlighted ${targetEl.logicalParent || ''}${idx} — value: ${val}`,
                  kind: 'step',
                  timestamp: Date.now(),
                });
              }
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
            const parent = sourceEl.logicalParent || targetEl.logicalParent;
            
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
                logicalParent: parent,
                originalType: 'EDGE'
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
                    logicalParent: parent,
                    originalType: 'EDGE'
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
                  
                  this.lifecycleManager.activate(edgeId);

                  this.stateManager.saveState(this.sceneManager.getSceneGraph(), `Linked ${link.sourceId} and ${link.targetId}`, this.animationScheduler.getCurrentTime());
                  this.eventDispatcher.dispatch('STATE_UPDATED', this.stateManager.getCurrentState());
                }
              }
            });
            this.animationScheduler.commitGroup(true);

            // Trigger relayout automatically upon linking using virtualGraph
            const layoutMap = this.layoutManager.updateLayout(virtualGraph);
            layoutMap.forEach((pos, id) => {
              const el = this.sceneManager.getElement(id) as any;
              const vEl = virtualGraph.find((e: any) => e.id === id);
              if (vEl) {
                // Update virtual graph position
                vEl.position.x = pos.x;
                vEl.position.y = pos.y;
                vEl.position.z = pos.z;
                
                // Enqueue animation for the real element
                if (el) {
                  this.animationScheduler.enqueue({
                    targets: el.position,
                    x: pos.x, y: pos.y, z: pos.z,
                    duration: 500, easing: 'easeInOutQuad'
                  });
                }
              }
            });
            this.animationScheduler.commitGroup(true);
            
            // Brief pause to show connection
            this.animationScheduler.advanceCursor(400);
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
            
            if (isLinkedList) {
              this.animationScheduler.enqueue({
                targets: {}, duration: 1, complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'TRAVERSAL',
                    message: `Traversing to position ${index}...`,
                    kind: 'traversal',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitSequential();
            }

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
                if (isLinkedList) {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'INSERT',
                    message: `Inserted value ${val} at position ${index} in "${arrName}".\nUpdating links to include new node.\nInsertion complete.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                } else {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'INSERT',
                    message: `Inserted value ${val} at index ${index} in "${arrName}".\nElements to the right shifted one position forward.\nInsertion complete.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
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
                if (isLinkedList) {
                  this.animationScheduler.enqueue({
                    targets: {}, duration: 1, complete: () => {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'TRAVERSAL',
                        message: `Traversing to find node at position ${index}...`,
                        kind: 'traversal',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.commitSequential();
                }

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
                edgesToRemove = this.sceneManager.getSceneGraph().filter((el: any) => el.type === 'edge' && el.logicalParent === arrName && (el.sourceId === targetId || el.targetId === targetId));
                
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
                  if (isLinkedList) {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'DELETE',
                      message: `Deleted node at position ${index} from "${arrName}".\nUpdating adjacent links.\nDeletion complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  } else {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'DELETE',
                      message: `Deleted element at index ${index} from "${arrName}".\nElements to the right shifted one position back.\nDeletion complete.`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  }
                }
              });
              this.animationScheduler.commitSequential();
              this.animationScheduler.advanceCursor(400);
            }
          } else if (gen.actionName === 'PUSH') {
            const stackName = gen.args[0];
            const val = gen.args[1];
            
            // Find current top index
            const stackEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
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
              // Log after drop animation
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'PUSH',
                    message: `Pushed ${val} onto stack "${stackName}".\nStack size: ${newIndex + 1}`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (gen.actionName === 'POP') {
            const stackName = gen.args[0];
            
            const stackEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
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
                  const poppedVal = (topEl as any).value;
                  const remainingSize = stackEls.length - 1;
                  this.lifecycleManager.remove(targetId);
                  this.lifecycleManager.destroy(targetId);
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'POP',
                    message: `Popped "${poppedVal}" from stack "${stackName}".\nStack size: ${remainingSize}`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
              this.animationScheduler.advanceCursor(450);
            }
          } else if (gen.actionName === 'PEEK') {
            const stackName = gen.args[0];
            const stackEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === stackName && el.originalType === 'STACK_ELEMENT');
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
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'PEEK',
                      message: `Top of stack "${stackName}": ${(topEl as any).value}`,
                      kind: 'info',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            }
          } else if (gen.actionName === 'ENQUEUE') {
            const queueName = gen.args[0];
            const val = gen.args[1];
            
            const queueEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT');
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
              // Log after drop animation
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'ENQUEUE',
                    message: `Enqueued ${val} into queue "${queueName}".\nQueue size: ${newIndex + 1}`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (gen.actionName === 'DEQUEUE') {
            const queueName = gen.args[0];
            
            const queueEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            
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
                  const dequeuedVal = (frontEl as any).value;
                  const remainingSize = queueEls.length - 1;
                  this.lifecycleManager.remove(targetId);
                  this.lifecycleManager.destroy(targetId);
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'DEQUEUE',
                    message: `Dequeued "${dequeuedVal}" from front of queue "${queueName}".\nQueue size: ${remainingSize}`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
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
            const queueEls = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === queueName && el.originalType === 'QUEUE_ELEMENT').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            
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
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => {
                    const action = gen.actionName;
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: action,
                      message: `${action} of queue "${queueName}": ${(targetNode as any).value}`,
                      kind: 'info',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
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
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => {
                    const visitVal = targetEl.value !== undefined ? targetEl.value : (targetEl.label || targetEl.id);
                    const visitIdx = targetEl.logicalIndex !== undefined ? `[${targetEl.logicalIndex}]` : '';
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'VISIT',
                      message: `Visiting ${treeName}${visitIdx} — value: ${visitVal}`,
                      kind: 'traversal',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
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
                this.animationScheduler.enqueue({
                  targets: {},
                  duration: 1,
                  complete: () => {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'ROTATE',
                      message: `Rotate applied at index ${nodeIndex} in "${treeName}"`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            }
          } else if (gen.actionName === 'HEAPIFY') {
            const heapName = gen.args[0];
            const arg1 = gen.args[1];
            // E.g. HEAPIFY myHeap 0
            
            const targetEls = this.sceneManager.getSceneGraph().filter((el: any) => 
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
              this.animationScheduler.enqueue({
                targets: {},
                duration: 1,
                complete: () => {
                  this.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'HEAPIFY',
                    message: `Heapify called at index ${arg1} in "${heapName}"\nRestoring heap property from this node downward.`,
                    kind: 'operation',
                    timestamp: Date.now(),
                  });
                }
              });
              this.animationScheduler.commitGroup(true);
            }
          } else if (gen.actionName === 'UPDATE') {
            const arrName = gen.args[0];
            const index = gen.args[1];
            const val = gen.args[2];
            
            const vEl = virtualGraph.find((el: any) => el.logicalParent === arrName && el.logicalIndex === index);
            if (vEl) {
              const isLinkedList = vEl.originalType === 'LINKEDLIST_NODE';
              const targetEl = this.sceneManager.getElement(vEl.id) as any;
              if (targetEl) {
                if (isLinkedList) {
                  this.animationScheduler.enqueue({
                    targets: {}, duration: 1, complete: () => {
                      this.eventDispatcher.dispatch('RUNTIME_LOG', {
                        keyword: 'TRAVERSAL',
                        message: `Traversing to position ${index}...`,
                        kind: 'traversal',
                        timestamp: Date.now(),
                      });
                    }
                  });
                  this.animationScheduler.commitSequential();
                }
                const oldVal = targetEl.value;
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
                this.animationScheduler.enqueue({
                  targets: {}, duration: 1,
                  complete: () => {
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'UPDATE',
                      message: isLinkedList ? `Updated node value at position ${index} from ${oldVal} to ${val}` : `Updated "${arrName}[${index}]": ${oldVal} -> ${val}`,
                      kind: 'operation',
                      timestamp: Date.now(),
                    });
                  }
                });
                this.animationScheduler.commitGroup(true);
              }
            }
          } else if (gen.actionName === 'SEARCH') {
            const arrName = gen.args[0];
            const val = gen.args[1];
            // Emit start log
            this.animationScheduler.enqueue({
              targets: {}, duration: 1,
              complete: () => {
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'SEARCH',
                  message: `Linear search for "${val}" in "${arrName}"...`,
                  kind: 'search',
                  timestamp: Date.now(),
                });
              }
            });
            this.animationScheduler.commitGroup(true);
            // Scan through with per-element step logs
            const elements = this.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === arrName && el.originalType !== 'EDGE').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
            let foundIndex = -1;
            elements.forEach((vEl: any, idx: number) => {
              if (String(vEl.value) === String(val)) foundIndex = idx;
              const isMatch = String(vEl.value) === String(val);
              const targetEl = this.sceneManager.getElement(vEl.id) as any;
              if (targetEl) {
                this.animationScheduler.enqueue({
                  targets: targetEl,
                  color: isMatch ? '#4ade80' : '#00bcd4',
                  emissiveColor: isMatch ? '#4ade80' : '#00bcd4',
                  emissiveIntensity: 0.5,
                  duration: 200,
                  complete: () => {
                    const checkMsg = isMatch
                      ? `  ✓ Index ${idx}: value = ${vEl.value}  ← FOUND!`
                      : `  Index ${idx}: value = ${vEl.value}  ← not a match`;
                    this.eventDispatcher.dispatch('RUNTIME_LOG', {
                      keyword: 'SCAN',
                      message: checkMsg,
                      kind: 'step',
                      timestamp: Date.now(),
                    });
                  }
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
            this.animationScheduler.enqueue({
              targets: {}, duration: 1,
              complete: () => {
                const msg = val !== undefined
                  ? (foundIndex >= 0 ? `Found "${val}" at index ${foundIndex} in "${arrName}"` : `"${val}" not found in "${arrName}"`)
                  : `Searched "${arrName}" (${elements.length} elements scanned)`;
                this.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'RESULT',
                  message: msg,
                  kind: 'result',
                  timestamp: Date.now(),
                });
              }
            });
            this.animationScheduler.commitGroup(true);
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

            updates.complete = () => {
              if (s === 'deleted') {
                this.lifecycleManager.destroy(setStateIns.targetId);
              }
              const val = targetEl.value !== undefined ? targetEl.value : (targetEl.label || targetEl.id);
              this.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'STATE',
                message: `Element "${val}" state changed to "${s}"`,
                kind: 'info',
                timestamp: Date.now(),
              });
            };

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


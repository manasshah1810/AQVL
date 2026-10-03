/**
 * PrimitiveAnimator — how each element-level AQIR primitive
 * (docs/design/aqir-primitives-spec.md §3) is animated on the scene.
 *
 * This is the interface between engines and the scheduler / scene manager:
 * a primitive applied to resolved scene elements always looks the same,
 * whoever applies it. AnimationController routes the element-level
 * instructions here (HIGHLIGHT_OBJECT = ANNOTATE focus, COMPARE_OBJECTS =
 * ANNOTATE contrast, SWAP_OBJECTS = MUTATE exchange, UPDATE = MUTATE set,
 * LINK_OBJECTS / DISCONNECT = RELATE link / unlink), and structure engines
 * replay their recorded steps through the same methods (ArrayEngine's SET
 * step is a MUTATE set). Structure-specific variants — a tree or linked-list
 * SWAP that trades values rather than slots — belong to that structure's
 * engine, not here.
 *
 * Stateless: one shared instance, everything per call arrives as arguments.
 */
import type { LinkObjectsInstruction } from '@aqvl/shared';
import { getSemanticColorToken } from '@aqvl/shared';
import { AlgorithmContext } from './AlgorithmContext';
import { AnticipationAnimation } from '../animations';
import { TreeEngine } from './TreeEngine';

export class PrimitiveAnimator {
  /** ANNOTATE focus — HIGHLIGHT `hl.targetId` (already resolved to `targetEl`) in `hl.color`. */
  focus(ctx: AlgorithmContext, targetEl: any, hl: { targetId: string; color?: string }): void {
    AnticipationAnimation.applyAnticipation(ctx.scheduler, [targetEl], 'SELECTION');

    const activeToken = getSemanticColorToken(hl.color || 'SUCCESS');
    targetEl.isHighlighted = true;
    targetEl.highlightType = hl.color || 'SUCCESS';
    targetEl.state = activeToken.name;
    targetEl.color = activeToken.color;
    targetEl.emissiveColor = activeToken.emissiveColor;
    targetEl.emissiveIntensity = activeToken.emissiveIntensity;

    ctx.scheduler.enqueue({
      targets: targetEl,
      color: activeToken.color,
      emissiveColor: activeToken.emissiveColor,
      emissiveIntensity: activeToken.emissiveIntensity,
      duration: 400,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.enqueue({
      targets: targetEl.scale,
      x: 1.15, y: 1.15, z: 1.15,
      duration: 400,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.advanceCursor(200);

    ctx.scheduler.enqueue({
      targets: targetEl.scale,
      x: 1, y: 1, z: 1,
      duration: 300,
      easing: 'easeInOutQuad'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Highlighted ${hl.targetId}`, ctx.scheduler.getCurrentTime());
        ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        const idx = (targetEl as any).logicalIndex !== undefined ? `[${(targetEl as any).logicalIndex}]` : '';
        const val = (targetEl as any).value !== undefined ? (targetEl as any).value : targetEl.id;
        const isListNode = targetEl.originalType === 'LINKEDLIST_NODE' || TreeEngine.isNodeRef(targetEl.id);
        const name = isListNode ? `node ${val} of ${(targetEl as any).logicalParent}` : `${(targetEl as any).logicalParent || ''}${idx}`;
        const colorName = String(hl.color || 'SUCCESS').toUpperCase();
        let message = isListNode ? `Visiting ${name}` : `Highlighted ${name} — value: ${val}`;
        if (activeToken.name === 'NEUTRAL') message = `Cleared mark on ${name} (value: ${val})`;
        else if (activeToken.name !== 'EVALUATING') message = `Marked ${name} = ${val} as ${colorName}`;
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'HIGHLIGHT',
          message,
          kind: 'step',
          timestamp: Date.now(),
        });
      }
    });
    ctx.scheduler.commitSequential();
  }

  /** ANNOTATE contrast — COMPARE two elements (`cmp` carries the ids as written, for the log). */
  contrast(ctx: AlgorithmContext, leftEl: any, rightEl: any, cmp: { leftId: string; rightId: string }): void {
    AnticipationAnimation.applyAnticipation(ctx.scheduler, [leftEl, rightEl], 'COMPARISON');

    const activeToken = getSemanticColorToken('EVALUATING');
    leftEl.isHighlighted = true;
    leftEl.highlightType = 'EVALUATING';
    rightEl.isHighlighted = true;
    rightEl.highlightType = 'EVALUATING';
    leftEl.state = 'EVALUATING';
    rightEl.state = 'EVALUATING';
    leftEl.color = activeToken.color;
    leftEl.emissiveColor = activeToken.emissiveColor;
    leftEl.emissiveIntensity = activeToken.emissiveIntensity;
    rightEl.color = activeToken.color;
    rightEl.emissiveColor = activeToken.emissiveColor;
    rightEl.emissiveIntensity = activeToken.emissiveIntensity;

    ctx.scheduler.enqueue({
      targets: [leftEl, rightEl],
      color: activeToken.color,
      emissiveColor: activeToken.emissiveColor,
      emissiveIntensity: activeToken.emissiveIntensity,
      duration: 400,
      easing: 'easeOutExpo'
    });

    ctx.scheduler.enqueue({
      targets: [leftEl.scale, rightEl.scale],
      x: 1.15, y: 1.15, z: 1.15,
      duration: 400,
      easing: 'easeOutExpo'
    });

    ctx.scheduler.enqueue({
      targets: [leftEl.position, rightEl.position],
      y: '+=0.3',
      duration: 400,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.advanceCursor(300);

    ctx.scheduler.enqueue({
      targets: [leftEl.scale, rightEl.scale],
      x: 1, y: 1, z: 1,
      duration: 300,
      easing: 'easeInOutQuad'
    });

    ctx.scheduler.enqueue({
      targets: [leftEl.position, rightEl.position],
      y: '-=0.3',
      duration: 300,
      easing: 'easeInOutQuad'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        // Only indexed elements carry an `arr[i]` label (a linked-list
        // node has no index — relabelling it produced "list[undefined]").
        if (leftEl.logicalIndex !== undefined) leftEl.label = `${leftEl.logicalParent}[${leftEl.logicalIndex}]`;
        if (rightEl.logicalIndex !== undefined) rightEl.label = `${rightEl.logicalParent}[${rightEl.logicalIndex}]`;
        const lVal = leftEl.value ?? leftEl.id;
        const rVal = rightEl.value ?? rightEl.id;
        const lIdx = leftEl.logicalIndex !== undefined ? leftEl.logicalIndex : `node ${lVal}`;
        const rIdx = rightEl.logicalIndex !== undefined ? rightEl.logicalIndex : `node ${rVal}`;
        const cmpSymbol = lVal < rVal ? '<' : lVal > rVal ? '>' : '=';
        const cmpWord = lVal < rVal ? 'less than' : lVal > rVal ? 'greater than' : 'equal to';
        ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Compared ${cmp.leftId} and ${cmp.rightId}`, ctx.scheduler.getCurrentTime());
        ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'COMPARE',
          message: leftEl.logicalIndex === undefined || rightEl.logicalIndex === undefined
            ? `Comparing ${lIdx} vs ${rIdx}\n${lVal} ${cmpSymbol} ${rVal}  (${lVal} is ${cmpWord} ${rVal})`
            : `Comparing [${lIdx}]=${lVal} vs [${rIdx}]=${rVal}\n${lVal} ${cmpSymbol} ${rVal}  (${lVal} is ${cmpWord} ${rVal})`,
          kind: 'compare',
          timestamp: Date.now(),
        });
      }
    });
    ctx.scheduler.commitSequential();
  }

  /** MUTATE exchange — SWAP two indexed elements by trading their slots (`logicalIndex`) and moving them. */
  exchange(ctx: AlgorithmContext, leftEl: any, rightEl: any, swp: { leftId: string; rightId: string }): void {
    AnticipationAnimation.applyAnticipation(ctx.scheduler, [leftEl, rightEl], 'SWAP');

    const activeToken = getSemanticColorToken('MODIFYING');
    leftEl.isHighlighted = true;
    leftEl.highlightType = 'MODIFYING';
    rightEl.isHighlighted = true;
    rightEl.highlightType = 'MODIFYING';
    leftEl.state = 'MODIFYING';
    rightEl.state = 'MODIFYING';
    leftEl.color = activeToken.color;
    leftEl.emissiveColor = activeToken.emissiveColor;
    leftEl.emissiveIntensity = activeToken.emissiveIntensity;
    rightEl.color = activeToken.color;
    rightEl.emissiveColor = activeToken.emissiveColor;
    rightEl.emissiveIntensity = activeToken.emissiveIntensity;

    const leftIndex = leftEl.logicalIndex;
    const rightIndex = rightEl.logicalIndex;

    // Synchronously swap and compute layout
    leftEl.logicalIndex = rightIndex;
    rightEl.logicalIndex = leftIndex;
    ctx.layoutManager.updateLayout(ctx.sceneManager.getSceneGraph());

    ctx.scheduler.enqueue({
      targets: [leftEl, rightEl],
      color: activeToken.color,
      emissiveColor: activeToken.emissiveColor,
      emissiveIntensity: activeToken.emissiveIntensity,
      duration: 300,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.enqueue({
      targets: [leftEl.scale, rightEl.scale],
      x: 1.1, y: 1.1, z: 1.1,
      duration: 300,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.enqueue({
      targets: [leftEl.position, rightEl.position],
      y: (el: any) => el.y + 1.8,
      duration: 300,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.advanceCursor(200);

    if (leftEl.worldTarget) {
      ctx.scheduler.enqueue({
        targets: leftEl.position,
        x: leftEl.worldTarget.x,
        z: leftEl.worldTarget.z + 1.5,
        duration: 600,
        easing: 'easeInOutSine'
      });
    }
    if (rightEl.worldTarget) {
      ctx.scheduler.enqueue({
        targets: rightEl.position,
        x: rightEl.worldTarget.x,
        z: rightEl.worldTarget.z - 1.5,
        duration: 600,
        easing: 'easeInOutSine'
      });
    }
    ctx.scheduler.commitGroup(true);

    if (leftEl.worldTarget) {
      ctx.scheduler.enqueue({
        targets: leftEl.position,
        y: leftEl.worldTarget.y,
        z: leftEl.worldTarget.z,
        duration: 350,
        easing: 'easeOutBounce'
      });
    }
    if (rightEl.worldTarget) {
      ctx.scheduler.enqueue({
        targets: rightEl.position,
        y: rightEl.worldTarget.y,
        z: rightEl.worldTarget.z,
        duration: 350,
        easing: 'easeOutBounce'
      });
    }
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({
      targets: [leftEl.scale, rightEl.scale],
      x: 1, y: 1, z: 1,
      duration: 300,
      easing: 'easeInOutQuad'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        leftEl.label = `${leftEl.logicalParent}[${leftEl.logicalIndex}]`;
        rightEl.label = `${rightEl.logicalParent}[${rightEl.logicalIndex}]`;
        const lVal = leftEl.value ?? leftEl.id;
        const rVal = rightEl.value ?? rightEl.id;
        const lIdx = leftEl.logicalIndex;
        const rIdx = rightEl.logicalIndex;
        ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Swapped ${swp.leftId} and ${swp.rightId}`, ctx.scheduler.getCurrentTime());
        ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'SWAP',
          message: `Swapped [${rIdx}] (${lVal}) ↔ [${lIdx}] (${rVal})`,
          kind: 'swap',
          timestamp: Date.now(),
        });
      }
    });
    ctx.scheduler.commitSequential();
  }

  /** MUTATE set — give `targetEl` the value `newValue` (UPDATE). */
  set(ctx: AlgorithmContext, targetEl: any, newValue: unknown): void {
    AnticipationAnimation.applyAnticipation(ctx.scheduler, [targetEl], 'UPDATE');
    const modifyingToken = getSemanticColorToken('MODIFYING');
    targetEl.state = 'MODIFYING';
    targetEl.color = modifyingToken.color;
    targetEl.emissiveColor = modifyingToken.emissiveColor;
    targetEl.emissiveIntensity = modifyingToken.emissiveIntensity;

    ctx.scheduler.enqueue({
      targets: targetEl,
      color: modifyingToken.color,
      emissiveColor: modifyingToken.emissiveColor,
      emissiveIntensity: modifyingToken.emissiveIntensity,
      duration: 300,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.enqueue({
      targets: targetEl.scale,
      x: 1.2, y: 1.2, z: 1.2,
      duration: 300,
      easing: 'easeOutExpo'
    });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({
      targets: targetEl.scale,
      x: 1, y: 1, z: 1,
      duration: 300,
      easing: 'easeInOutQuad',
      complete: () => {
        targetEl.value = newValue;
        ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Updated value to ${newValue}`, ctx.scheduler.getCurrentTime());
        ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'UPDATE',
          message: `Updated value of element to ${newValue}.`,
          kind: 'operation',
          timestamp: Date.now(),
        });
      }
    });
    ctx.scheduler.commitSequential();
  }

  /** RELATE link — draw an edge from `link.sourceId` to `link.targetId` and re-lay out their structure. */
  link(ctx: AlgorithmContext, link: LinkObjectsInstruction): void {
    const sourceEl = ctx.sceneManager.getElement(link.sourceId) as any;
    const targetEl = ctx.sceneManager.getElement(link.targetId) as any;

    if (sourceEl && targetEl) {
      const edgeId = `edge_${link.sourceId}_${link.targetId}`;
      const parent = sourceEl.logicalParent || targetEl.logicalParent;

      if (!ctx.sceneManager.getElement(edgeId)) {
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
        ctx.sceneManager.addElement(newEdge);

        ctx.relationshipManager!.addRelationship({
          id: edgeId,
          sourceId: link.sourceId,
          targetId: link.targetId,
          type: 'edge',
          directed: link.directed,
          relationType: link.relationType
        });

        // Synchronous layout update
        ctx.layoutManager.updateLayout(ctx.sceneManager.getSceneGraph());

        // Animate all elements in the parent structure to their new positions
        const allEls = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === parent && el.originalType !== 'EDGE');
        allEls.forEach(el => {
          if ((el as any).worldTarget) {
            ctx.scheduler.enqueue({
              targets: el.position,
              x: (el as any).worldTarget.x,
              y: (el as any).worldTarget.y,
              z: (el as any).worldTarget.z,
              duration: 500,
              easing: 'easeOutCubic'
            });
          }
        });
        ctx.scheduler.commitGroup(true);

        ctx.scheduler.enqueue({
          targets: {},
          duration: 1,
          complete: () => {
            ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Linked ${link.sourceId} to ${link.targetId}`, ctx.scheduler.getCurrentTime());
            ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
          }
        });
        ctx.scheduler.commitSequential();
      }
    }
  }

  /** RELATE unlink — remove the edge from `sourceId` to `targetId` (DISCONNECT). */
  unlink(ctx: AlgorithmContext, sourceId: string, targetId: string): void {
    const allEls = ctx.sceneManager.getSceneGraph();
    const edgeToRemove = allEls.find((el: any) => el.type === 'edge' && el.sourceId === sourceId && el.targetId === targetId);
    if (edgeToRemove) {
      ctx.scheduler.enqueue({
        targets: {},
        duration: 1,
        complete: () => {
          ctx.sceneManager.removeElement(edgeToRemove.id);
          ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Disconnected ${sourceId} from ${targetId}`, ctx.scheduler.getCurrentTime());
          ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        }
      });
      ctx.scheduler.commitGroup(true);
      ctx.scheduler.advanceCursor(300);
    }
  }
}

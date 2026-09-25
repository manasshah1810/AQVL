/**
 * LinkedListEngine — animation logic for INSERT_HEAD / INSERT_TAIL /
 * DELETE_HEAD / DELETE_TAIL / REVERSE, extracted from
 * AnimationController.executeInstruction so it's unit-testable without the
 * full AnimationController (see tests/unit/linkedListEngine.test.ts).
 *
 * Unlike StackEngine/QueueEngine (which animate against a `virtualGraph`
 * snapshot inside buildAnimations), these handlers mutate the live scene
 * graph directly via `context.sceneManager`, matching how
 * executeInstruction's other branches (INSERT/DELETE/REVERSE) work.
 */
import { AlgorithmContext } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';

export class LinkedListEngine {
  /** Handles INSERT_HEAD / INSERT_TAIL. No-ops if the list's HEAD/NULL (or circular) anchors aren't present. */
  insert(context: AlgorithmContext, gen: GenericActionInstruction, actionName: 'INSERT_HEAD' | 'INSERT_TAIL'): void {
    const logicalParent = (gen as any).payload?.logicalParent;
    const valueToInsert = gen.args?.[gen.args.length - 1];
    if (logicalParent === undefined || valueToInsert === undefined) return;

    const allEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
    AnticipationAnimation.applyAnticipation(context.scheduler, allEls.filter((el: any) => el.type !== 'edge'), 'INSERTION');

    const edges = allEls.filter((el: any) => el.type === 'edge');
    const headNode = allEls.find((el: any) => el.originalType === 'HEAD');
    const nullNode = allEls.find((el: any) => el.originalType === 'NULL');

    const circularEdge = edges.find((e: any) => e.properties?.circular || e.circular);
    const isCircular = !!circularEdge;

    if (!headNode || !(nullNode || isCircular)) return;

    const newId = `obj_dyn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const modifyingToken = getSemanticColorToken('MODIFYING');
    const newEl: any = {
      id: newId,
      type: 'sphere',
      originalType: 'LINKEDLIST_NODE',
      logicalParent: logicalParent,
      value: valueToInsert,
      label: String(valueToInsert),
      position: { x: 0, y: -5, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: modifyingToken.color,
      emissiveIntensity: modifyingToken.emissiveIntensity,
      emissiveColor: modifyingToken.emissiveColor,
      state: 'MODIFYING',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1
    };
    context.sceneManager.addElement(newEl);
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'INFO',
          message: `Creating new node with value ${valueToInsert}...`,
          kind: 'info',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();

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
      context.sceneManager.removeElement(edgeToRemove.id);

      const edge1Id = `edge_dyn_${prevNodeId}_${newId}`;
      const edge2Id = `edge_dyn_${newId}_${nextNodeId}`;

      const isEdge2Circular = actionName === 'INSERT_TAIL' && isCircular;

      context.sceneManager.addElement({
        id: edge1Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
        sourceId: prevNodeId, targetId: newId, directed: true, logicalParent, originalType: 'EDGE'
      } as any);

      context.sceneManager.addElement({
        id: edge2Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
        sourceId: newId, targetId: nextNodeId, directed: true, logicalParent, originalType: 'EDGE',
        properties: isEdge2Circular ? { circular: true } : undefined,
        circular: isEdge2Circular ? true : undefined
      } as any);

      context.relationshipManager!.addRelationship({ id: edge1Id, sourceId: prevNodeId, targetId: newId, type: 'edge', directed: true });
      context.relationshipManager!.addRelationship({ id: edge2Id, sourceId: newId, targetId: nextNodeId, type: 'edge', directed: true });

      if (actionName === 'INSERT_HEAD' && isCircular && circularEdge) {
        (circularEdge as any).targetId = newId;
      }

      if (isDoubly) {
        const bEdgeToRemove = edges.find((e: any) => (e.backward === true || e.properties?.backward === true) && e.sourceId === nextNodeId && e.targetId === prevNodeId);
        if (bEdgeToRemove) {
          context.sceneManager.removeElement(bEdgeToRemove.id);
        }
        const bEdge1Id = `edge_dyn_b_${nextNodeId}_${newId}`;
        const bEdge2Id = `edge_dyn_b_${newId}_${prevNodeId}`;
        context.sceneManager.addElement({
          id: bEdge1Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
          sourceId: nextNodeId, targetId: newId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
        } as any);
        context.sceneManager.addElement({
          id: bEdge2Id, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
          sourceId: newId, targetId: prevNodeId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
        } as any);
        context.relationshipManager!.addRelationship({ id: bEdge1Id, sourceId: nextNodeId, targetId: newId, type: 'edge', directed: true });
        context.relationshipManager!.addRelationship({ id: bEdge2Id, sourceId: newId, targetId: prevNodeId, type: 'edge', directed: true });
      }
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        if (isDoubly) {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: 'Updating Previous Pointer...\nUpdating Next Pointer...',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        } else if (isCircular && actionName === 'INSERT_TAIL') {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: 'Tail now points back to Head.\nCircular Link Restored.',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        } else {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: actionName === 'INSERT_HEAD' ? 'New node points to current head.\nUpdating Head pointer...' : 'Tail node points to new node.',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        }
      }
    });
    context.scheduler.commitSequential();

    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    if (newEl.worldTarget) {
      newEl.position.x = newEl.worldTarget.x;
      newEl.position.z = newEl.worldTarget.z;
    }

    const updatedArrayEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent && el.id !== newEl.id && el.originalType !== 'EDGE');
    updatedArrayEls.forEach((el: any) => {
      if (el.worldTarget) {
        context.scheduler.enqueue({
          targets: el.position,
          x: el.worldTarget.x,
          y: el.worldTarget.y,
          z: el.worldTarget.z,
          duration: 500,
          easing: 'easeOutCubic'
        });
      }
    });
    context.scheduler.commitGroup(true);

    if (newEl.worldTarget) {
      context.scheduler.enqueue({
        targets: newEl.position,
        y: newEl.worldTarget.y,
        duration: 600,
        easing: 'easeOutBounce'
      });
      context.scheduler.enqueue({
        targets: newEl.scale,
        x: 1, y: 1, z: 1,
        duration: 600,
        easing: 'easeOutBack'
      });
      context.scheduler.commitGroup(true);
    }

    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        context.stateManager!.saveState(context.sceneManager.getSceneGraph(), `${actionName} ${valueToInsert}`, context.scheduler.getCurrentTime());
        context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager!.getCurrentState());
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'RESULT',
          message: 'Insertion Complete.',
          kind: 'result',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();
  }

  /** Handles DELETE_HEAD / DELETE_TAIL. No-ops if the list's HEAD/NULL (or circular) anchors aren't present, or the list is empty. */
  remove(context: AlgorithmContext, gen: GenericActionInstruction, actionName: 'DELETE_HEAD' | 'DELETE_TAIL'): void {
    const logicalParent = (gen as any).payload?.logicalParent;
    if (!logicalParent) return;

    const allEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
    const edges = allEls.filter((el: any) => el.type === 'edge');
    const headNode = allEls.find((el: any) => el.originalType === 'HEAD');
    const nullNode = allEls.find((el: any) => el.originalType === 'NULL');

    const circularEdge = edges.find((e: any) => e.properties?.circular || e.circular);
    const isCircular = !!circularEdge;

    if (!headNode || !(nullNode || isCircular)) return;

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

    if (!nodeToDeleteId) return;

    const targetDelEl = context.sceneManager.getElement(nodeToDeleteId);
    if (targetDelEl) {
      AnticipationAnimation.applyAnticipation(context.scheduler, [targetDelEl], 'DELETION');
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'OPERATION',
          message: actionName === 'DELETE_HEAD' ? 'Deleting Head Node...' : 'Removing Tail...',
          kind: 'operation',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();

    const edgeToDel = edges.find((e: any) => e.targetId === nodeToDeleteId && !(e.backward || e.properties?.backward) && !(e.circular || e.properties?.circular));
    let edgeFromDel = edges.find((e: any) => e.sourceId === nodeToDeleteId && !(e.backward || e.properties?.backward) && !(e.circular || e.properties?.circular));

    if (isCircular && actionName === 'DELETE_TAIL') {
      edgeFromDel = circularEdge;
    }

    if (edgeToDel) {
      prevNodeId = (edgeToDel as any).sourceId;
      context.sceneManager.removeElement(edgeToDel.id);
    }
    if (edgeFromDel) {
      nextNodeId = (edgeFromDel as any).targetId;
      context.sceneManager.removeElement(edgeFromDel.id);
    }

    if (isCircular && actionName === 'DELETE_HEAD' && circularEdge) {
      (circularEdge as any).targetId = nextNodeId;
    }

    const newEdgeId = `edge_dyn_${prevNodeId}_${nextNodeId}`;
    const isNewEdgeCircular = isCircular && actionName === 'DELETE_TAIL';

    context.sceneManager.addElement({
      id: newEdgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
      sourceId: prevNodeId, targetId: nextNodeId, directed: true, logicalParent, originalType: 'EDGE',
      properties: isNewEdgeCircular ? { circular: true } : undefined,
      circular: isNewEdgeCircular ? true : undefined
    } as any);
    context.relationshipManager!.addRelationship({ id: newEdgeId, sourceId: prevNodeId, targetId: nextNodeId, type: 'edge', directed: true });

    const isDoubly = edges.some((e: any) => e.backward === true || e.properties?.backward === true);
    if (isDoubly) {
      const bEdgeToDel = edges.find((e: any) => (e.backward || e.properties?.backward) && e.targetId === nodeToDeleteId);
      const bEdgeFromDel = edges.find((e: any) => (e.backward || e.properties?.backward) && e.sourceId === nodeToDeleteId);
      if (bEdgeToDel) context.sceneManager.removeElement(bEdgeToDel.id);
      if (bEdgeFromDel) context.sceneManager.removeElement(bEdgeFromDel.id);

      const bNewEdgeId = `edge_dyn_b_${nextNodeId}_${prevNodeId}`;
      context.sceneManager.addElement({
        id: bNewEdgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
        sourceId: nextNodeId, targetId: prevNodeId, directed: true, backward: true, logicalParent, originalType: 'EDGE'
      } as any);
      context.relationshipManager!.addRelationship({ id: bNewEdgeId, sourceId: nextNodeId, targetId: prevNodeId, type: 'edge', directed: true });
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        if (isDoubly) {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: 'Updating Previous/Next Pointers...',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        } else if (isCircular && actionName === 'DELETE_TAIL') {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: 'Tail updated to point to new Head.\nCircular Link Restored.',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        } else {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'RELATION',
            message: actionName === 'DELETE_HEAD' ? 'Head updated to next node.' : 'Updating Tail pointer.',
            kind: 'relationship',
            timestamp: Date.now(),
          });
        }
      }
    });
    context.scheduler.commitSequential();

    const targetEl = context.sceneManager.getElement(nodeToDeleteId) as any;
    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    if (targetEl) {
      context.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 500, easing: 'easeInBack' });
      context.scheduler.enqueue({ targets: targetEl.position, y: '+=2', duration: 500, easing: 'easeInBack' });
      context.scheduler.commitGroup(true);
    }

    const remainingEls = allEls.filter((el: any) => el.id !== nodeToDeleteId && el.originalType !== 'EDGE');
    remainingEls.forEach((el: any) => {
      if (el.worldTarget) {
        context.scheduler.enqueue({ targets: el.position, x: el.worldTarget.x, y: el.worldTarget.y, z: el.worldTarget.z, duration: 500, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.sceneManager.removeElement(nodeToDeleteId!);
        context.stateManager!.saveState(context.sceneManager.getSceneGraph(), `${actionName}`, context.scheduler.getCurrentTime());
        context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager!.getCurrentState());
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'RESULT',
          message: 'Deletion Complete.',
          kind: 'result',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();
    context.scheduler.commitSequential();
  }

  /** Handles REVERSE. No-ops if the list has fewer than 2 data nodes. */
  reverse(context: AlgorithmContext, gen: GenericActionInstruction): void {
    const logicalParent = (gen as any).payload?.logicalParent;
    if (!logicalParent) return;

    const allEls = context.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === logicalParent);
    const edges = allEls.filter((el: any) => el.type === 'edge');
    const headNode = allEls.find((el: any) => el.originalType === 'HEAD');
    const nullNode = allEls.find((el: any) => el.originalType === 'NULL');

    const circularEdge = edges.find((e: any) => e.properties?.circular || e.circular);
    const isCircular = !!circularEdge;
    const isDoubly = edges.some((e: any) => e.backward === true || e.properties?.backward === true);

    if (!headNode) return;

    const orderedDataNodes: any[] = [];
    const forwardEdges = edges.filter((e: any) =>
      !(e.backward || e.properties?.backward) &&
      !(e.circular || e.properties?.circular) &&
      e.sourceId !== headNode.id &&
      e.targetId !== nullNode?.id
    );

    const headEdge = edges.find((e: any) => e.sourceId === headNode.id && !(e.backward || e.properties?.backward));
    let currentNodeId = headEdge ? (headEdge as any).targetId : null;

    while (currentNodeId && currentNodeId !== nullNode?.id) {
      const node = allEls.find((el: any) => el.id === currentNodeId);
      if (node && node.originalType !== 'HEAD' && node.originalType !== 'NULL') {
        orderedDataNodes.push(node);
      } else {
        break;
      }
      const nextEdge = forwardEdges.find((e: any) => e.sourceId === currentNodeId);
      currentNodeId = nextEdge ? (nextEdge as any).targetId : null;
    }

    if (orderedDataNodes.length < 2) return;

    AnticipationAnimation.applyAnticipation(context.scheduler, allEls.filter((el: any) => el.type !== 'edge'), 'UPDATE');

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'OPERATION',
          message: 'Reversing Linked List connections...',
          kind: 'operation',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();

    forwardEdges.forEach((e: any) => {
      const temp = e.sourceId;
      e.sourceId = e.targetId;
      e.targetId = temp;
    });

    if (isDoubly) {
      const backwardEdges = edges.filter((e: any) => (e.backward || e.properties?.backward) && e.sourceId !== nullNode?.id && e.targetId !== headNode.id);
      backwardEdges.forEach((e: any) => {
        const temp = e.sourceId;
        e.sourceId = e.targetId;
        e.targetId = temp;
      });
    }

    if (headEdge) {
      (headEdge as any).targetId = orderedDataNodes[orderedDataNodes.length - 1].id;
    }

    if (!isCircular) {
      const nullEdge = edges.find((e: any) => e.targetId === nullNode?.id && !(e.backward || e.properties?.backward));
      if (nullEdge) {
        (nullEdge as any).sourceId = orderedDataNodes[0].id;
      }
      if (isDoubly) {
        const nullBackEdge = edges.find((e: any) => (e.backward || e.properties?.backward) && e.sourceId === nullNode?.id);
        if (nullBackEdge) (nullBackEdge as any).targetId = orderedDataNodes[0].id;
      }
    } else if (circularEdge) {
      (circularEdge as any).sourceId = orderedDataNodes[0].id;
      (circularEdge as any).targetId = orderedDataNodes[orderedDataNodes.length - 1].id;
    }

    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    allEls.forEach((el: any) => {
      if (el.type !== 'edge' && el.worldTarget) {
        context.scheduler.enqueue({
          targets: el.position,
          x: el.worldTarget.x,
          y: el.worldTarget.y,
          z: el.worldTarget.z,
          duration: 800,
          easing: 'easeInOutCubic'
        });
      }
    });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.stateManager!.saveState(context.sceneManager.getSceneGraph(), 'REVERSE', context.scheduler.getCurrentTime());
        context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager!.getCurrentState());
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'RESULT',
          message: 'Linked List Reversed Successfully.',
          kind: 'result',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitSequential();
  }
}

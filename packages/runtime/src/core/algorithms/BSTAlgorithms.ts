/**
 * BSTAlgorithms — Animation handler for BST operations.
 *
 * Registered with AlgorithmRegistry for:
 *   BST_INSERT, BST_DELETE, BST_SEARCH, BST_CLEAR
 *
 * Also consumed directly from AnimationController when generic
 * INSERT / DELETE / SEARCH / CLEAR are dispatched inside a BST context
 * (i.e. when the active data structure is a BST rather than an array).
 *
 * Visual color semantics:
 *   Visiting node     → TRAVERSING (blue glow)
 *   Comparison active → EVALUATING (yellow)
 *   Insert point      → SUCCESS / MODIFYING (green)
 *   Delete target     → red pulse
 *   Found             → SUCCESS (green pulse)
 *   Successor         → ACTIVE (orange/amber)
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { BSTEngine } from './BSTEngine';

export class BSTAlgorithms implements AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'BST_INSERT' || action === 'INSERT') {
      this.bstInsert(context, instruction);
    } else if (action === 'BST_DELETE' || action === 'DELETE') {
      this.bstDelete(context, instruction);
    } else if (action === 'BST_SEARCH' || action === 'SEARCH') {
      this.bstSearch(context, instruction);
    } else if (action === 'BST_CLEAR' || action === 'CLEAR') {
      this.bstClear(context, instruction);
    } else if (action === 'ROTATE') {
      this.bstRotate(context, instruction);
    } else if (action === 'INORDER' || action === 'PREORDER' || action === 'POSTORDER') {
      this.animateTraversal(context, action);
    } else if (action === 'LEVELORDER') {
      this.animateLevelOrder(context);
    } else if (action === 'MIN' || action === 'MIN_VALUE') {
      this.animateMinMax(context, 'MIN');
    } else if (action === 'MAX' || action === 'MAX_VALUE') {
      this.animateMinMax(context, 'MAX');
    } else if (action === 'HEIGHT') {
      this.animateHeight(context);
    } else if (action === 'SIZE') {
      this.animateSize(context);
    } else if (action === 'ROOT') {
      this.animateRoot(context);
    } else if (action === 'IS_EMPTY') {
      this.animateIsEmpty(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSERT
  // ─────────────────────────────────────────────────────────────────────────

  private bstInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const rawValue = (instruction as any).args?.[0];
    const value = Number(rawValue);

    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". INSERT requires a numeric argument.`, 'warning');
      return;
    }

    const insertResult = BSTEngine.computeInsertPath(context.sceneManager, treeName, value);

    // ── Error: duplicate ──────────────────────────────────────────────────
    if (!insertResult.success) {
      // Animate the duplicate hit
      if (insertResult.traversalPath.length > 0) {
        const last = insertResult.traversalPath[insertResult.traversalPath.length - 1];
        const lastEl = context.sceneManager.getElement(last.id) as any;
        if (lastEl) {
          const errorToken = getSemanticColorToken('DISCARDED');
          context.scheduler.enqueue({ targets: lastEl, color: errorToken.color, emissiveColor: errorToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
          context.scheduler.enqueue({ targets: lastEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(400);
          context.scheduler.enqueue({ targets: lastEl, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 300 });
          context.scheduler.enqueue({ targets: lastEl.scale, x: 1, y: 1, z: 1, duration: 300 });
          context.scheduler.commitGroup(true);
        }
      }
      this.log(context, 'INSERT_ERROR', insertResult.error!, 'warning');
      return;
    }

    // ── Traversal animation ───────────────────────────────────────────────
    this.log(context, 'INSERT', `Inserting ${value}...`, 'operation');

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const neutralColor = BSTEngine.NODE_COLOR;

    insertResult.traversalPath.forEach((nodeRef, idx) => {
      const el = context.sceneManager.getElement(nodeRef.id) as any;
      if (!el) return;

      const direction = insertResult.directions[idx];
      const comparison = direction === 'L'
        ? `${value} < ${nodeRef.value} → Go Left`
        : `${value} > ${nodeRef.value} → Go Right`;

      AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');

      // Highlight visiting
      el.state = 'TRAVERSING';
      context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300, easing: 'easeOutExpo' });
      context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300, easing: 'easeOutExpo' });
      context.scheduler.commitGroup(true);

      // Log comparison
      context.scheduler.enqueue({
        targets: {}, duration: 1, complete: () => {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'INSERT',
            message: `Compare with ${nodeRef.value}\n${comparison}`,
            kind: 'step',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(350);

      // Fade back
      el.state = 'NEUTRAL';
      context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250, easing: 'easeInOutQuad' });
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
      context.scheduler.commitGroup(true);
    });

    // ── Create the new node ───────────────────────────────────────────────
    const newEl = BSTEngine.insertNode(
      context.sceneManager,
      context.relationshipManager!,
      treeName,
      value,
      insertResult.parentNode || null,
      insertResult.edgeLabel || null
    );

    // Recompute layout
    const layoutMap = BSTEngine.computeLayout(context.sceneManager, treeName);
    layoutMap.forEach((pos, id) => {
      const el = context.sceneManager.getElement(id) as any;
      if (el) el.worldTarget = pos;
    });

    // Place new node at its target x/z, start below the scene
    if (newEl.worldTarget) {
      newEl.position.x = newEl.worldTarget.x;
      newEl.position.z = newEl.worldTarget.z;
    }

    // Animate ALL existing nodes to their new positions
    const successToken = getSemanticColorToken('SUCCESS');
    const allNodes = BSTEngine.getNodes(context.sceneManager, treeName);
    allNodes.forEach(n => {
      if (n.id === newEl.id) return;
      const pos = layoutMap.get(n.id);
      if (pos) {
        context.scheduler.enqueue({ targets: n.position, x: pos.x, y: pos.y, z: pos.z, duration: 500, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);

    // Pop in the new node
    context.scheduler.enqueue({ targets: newEl.position, y: newEl.worldTarget?.y ?? 0, duration: 600, easing: 'easeOutBounce' });
    context.scheduler.enqueue({ targets: newEl.scale, x: 1, y: 1, z: 1, duration: 600, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: newEl, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    // Fade new node to normal color
    context.scheduler.enqueue({ targets: newEl, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 500 });
    context.scheduler.enqueue({ targets: newEl.scale, x: 1, y: 1, z: 1, duration: 300 });
    context.scheduler.commitGroup(true);

    // Finalize state
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        const loc = insertResult.parentNode
          ? `as ${insertResult.edgeLabel === 'L' ? 'Left' : 'Right'} child of ${insertResult.parentNode.value}`
          : 'as Root';
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'INSERT',
          message: `Inserted ${value} successfully ${loc}.`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Inserted ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────────────────

  private bstSearch(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const rawValue = (instruction as any).args?.[0];
    const value = Number(rawValue);

    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". SEARCH requires a numeric argument.`, 'warning');
      return;
    }

    const root = BSTEngine.getRoot(context.sceneManager, treeName);
    if (!root) {
      this.log(context, 'SEARCH', 'Tree is empty. Nothing to search.', 'warning');
      return;
    }

    const searchResult = BSTEngine.computeSearchPath(context.sceneManager, treeName, value);

    this.log(context, 'SEARCH', `Searching for ${value}...`, 'operation');

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const successToken = getSemanticColorToken('SUCCESS');
    const discardToken = getSemanticColorToken('DISCARDED');
    const neutralColor = BSTEngine.NODE_COLOR;

    searchResult.traversalPath.forEach((nodeRef, idx) => {
      const el = context.sceneManager.getElement(nodeRef.id) as any;
      if (!el) return;

      const isFound = searchResult.found && idx === searchResult.traversalPath.length - 1;
      const token = isFound ? successToken : traversingToken;
      const comparison = searchResult.comparisons[idx] || '';

      AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');

      el.state = token.name;
      context.scheduler.enqueue({ targets: el, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.9, duration: 350, easing: 'easeOutExpo' });
      context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350, easing: 'easeOutExpo' });
      context.scheduler.commitGroup(true);

      context.scheduler.enqueue({
        targets: {}, duration: 1, complete: () => {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'SEARCH',
            message: comparison,
            kind: 'step',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(isFound ? 600 : 400);

      if (!isFound) {
        el.state = 'NEUTRAL';
        context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 250 });
        context.scheduler.commitGroup(true);
      } else {
        // Pulse effect for found node
        context.scheduler.enqueue({ targets: el.scale, x: 1.4, y: 1.4, z: 1.4, duration: 200, easing: 'easeOutQuad' });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(150);
        context.scheduler.enqueue({ targets: el.scale, x: 1.1, y: 1.1, z: 1.1, duration: 200, easing: 'easeInOutQuad' });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
        // Fade back
        context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 600 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
        context.scheduler.commitGroup(true);
      }
    });

    // Final log
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        if (searchResult.found) {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'SEARCH_SUCCESS',
            message: `Value ${value} found!`,
            kind: 'result',
            timestamp: Date.now(),
          });
        } else {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'SEARCH_FAIL',
            message: `Value ${value} does not exist in the BST.`,
            kind: 'warning',
            timestamp: Date.now(),
          });
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  private bstDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const rawValue = (instruction as any).args?.[0];
    const value = Number(rawValue);

    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". DELETE requires a numeric argument.`, 'warning');
      return;
    }

    const root = BSTEngine.getRoot(context.sceneManager, treeName);
    if (!root) {
      this.log(context, 'DELETE', 'Tree is empty. Nothing to delete.', 'warning');
      return;
    }

    const plan = BSTEngine.computeDeletePlan(context.sceneManager, treeName, value);

    if (!plan.success) {
      // Animate not-found traversal
      this.animateFailedSearch(context, plan.traversalPath);
      this.log(context, 'DELETE_ERROR', plan.error!, 'warning');
      return;
    }

    this.log(context, 'DELETE', `Deleting ${value}...`, 'operation');

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const neutralColor = BSTEngine.NODE_COLOR;

    // ── Animate traversal to find the node ────────────────────────────────
    plan.traversalPath.slice(0, -1).forEach((nodeRef) => {
      const el = context.sceneManager.getElement(nodeRef.id) as any;
      if (!el) return;
      AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
      context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 280 });
      context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 280 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);
      context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 200 });
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
      context.scheduler.commitGroup(true);
    });

    // Highlight target node in red
    const targetEl = context.sceneManager.getElement(plan.targetNode!.id) as any;
    if (targetEl) {
      AnticipationAnimation.applyAnticipation(context.scheduler, [targetEl], 'DELETION');
      context.scheduler.enqueue({ targets: targetEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 400 });
      context.scheduler.enqueue({ targets: targetEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
      context.scheduler.commitGroup(true);
    }

    // Log which case we're in
    const caseMsg =
      plan.deleteCase === 'LEAF'
        ? `Node ${value} is a leaf node.\nSimply removing it.`
        : plan.deleteCase === 'ONE_CHILD'
        ? `Node ${value} has one child.\nBypassing node, connecting parent to child.`
        : `Node ${value} has two children.\nFinding inorder successor...`;

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'DELETE',
          message: caseMsg,
          kind: 'step',
          timestamp: Date.now(),
        });
      }
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(500);

    // ── Case-specific animations ──────────────────────────────────────────

    if (plan.deleteCase === 'LEAF') {
      this.animateLeafDelete(context, treeName, plan);
    } else if (plan.deleteCase === 'ONE_CHILD') {
      this.animateOneChildDelete(context, treeName, plan);
    } else if (plan.deleteCase === 'TWO_CHILDREN') {
      this.animateTwoChildrenDelete(context, treeName, plan);
    }

    // Final log
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'DELETE',
          message: `Deleted ${value} successfully. BST property maintained.`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Deleted ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private animateLeafDelete(context: AlgorithmContext, treeName: string, plan: any): void {
    const targetEl = context.sceneManager.getElement(plan.targetNode.id) as any;
    if (!targetEl) return;

    // Fade out and remove
    context.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 500, easing: 'easeInBack' });
    context.scheduler.enqueue({ targets: targetEl.position, y: '-=2', duration: 500, easing: 'easeInBack' });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performLeafDelete(context.sceneManager, context.relationshipManager!, treeName, plan.targetNode.id);
        this.reLayoutAndAnimate(context, treeName);
      }
    });
    context.scheduler.commitSequential();
  }

  private animateOneChildDelete(context: AlgorithmContext, treeName: string, plan: any): void {
    const targetEl = context.sceneManager.getElement(plan.targetNode.id) as any;
    const childEl = plan.replacementNode ? context.sceneManager.getElement(plan.replacementNode.id) as any : null;

    if (!targetEl) return;

    if (childEl) {
      const activeToken = getSemanticColorToken('ACTIVE');
      context.scheduler.enqueue({ targets: childEl, color: activeToken.color, emissiveColor: activeToken.emissiveColor, emissiveIntensity: 0.8, duration: 350 });
      context.scheduler.enqueue({ targets: childEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 350 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(300);

      context.scheduler.enqueue({
        targets: {}, duration: 1, complete: () => {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'DELETE',
            message: `Child ${plan.replacementNode.value} moves up to replace ${plan.targetNode.value}.`,
            kind: 'step',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
    }

    // Shrink and remove target
    context.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
    context.scheduler.enqueue({ targets: targetEl.position, y: '+=2', duration: 400, easing: 'easeInBack' });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performOneChildDelete(
          context.sceneManager,
          context.relationshipManager!,
          treeName,
          plan.targetNode.id,
          plan.replacementNode.id,
          plan.parentNode?.id || null,
          plan.edgeLabel
        );
        this.reLayoutAndAnimate(context, treeName);
        if (childEl) {
          childEl.color = BSTEngine.NODE_COLOR;
          childEl.emissiveIntensity = 0;
          childEl.scale = { x: 1, y: 1, z: 1 };
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private animateTwoChildrenDelete(context: AlgorithmContext, treeName: string, plan: any): void {
    const successorToken = getSemanticColorToken('ACTIVE');
    const neutralColor = BSTEngine.NODE_COLOR;

    // Animate successor discovery path
    plan.successorPath.forEach((nodeRef: any, idx: number) => {
      const el = context.sceneManager.getElement(nodeRef.id) as any;
      if (!el || idx === 0) return; // Skip the deleted node itself (already red)

      const isSuccessor = idx === plan.successorPath.length - 1;
      const token = isSuccessor ? successorToken : getSemanticColorToken('TRAVERSING');

      context.scheduler.enqueue({ targets: el, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
      context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(isSuccessor ? 0 : 300);

      if (!isSuccessor) {
        context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 200 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      }
    });

    // Log successor
    if (plan.successor) {
      context.scheduler.enqueue({
        targets: {}, duration: 1, complete: () => {
          context.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'DELETE',
            message: `Inorder Successor = ${plan.successor.value}\nReplacing ${plan.targetNode.value} with ${plan.successor.value}.\nDeleting successor node.`,
            kind: 'step',
            timestamp: Date.now(),
          });
        }
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(500);

      // Animate target node changing its value (successor takes over)
      const targetEl = context.sceneManager.getElement(plan.targetNode.id) as any;
      const successorEl = context.sceneManager.getElement(plan.successor.id) as any;

      if (targetEl) {
        const modifyingToken = getSemanticColorToken('MODIFYING');
        context.scheduler.enqueue({ targets: targetEl, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
        context.scheduler.enqueue({ targets: targetEl.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);
        context.scheduler.enqueue({ targets: targetEl, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 400 });
        context.scheduler.enqueue({ targets: targetEl.scale, x: 1, y: 1, z: 1, duration: 400 });
        context.scheduler.commitGroup(true);
      }

      // Shrink out the successor
      if (successorEl) {
        context.scheduler.enqueue({ targets: successorEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
        context.scheduler.enqueue({ targets: successorEl.position, y: '-=2', duration: 400, easing: 'easeInBack' });
        context.scheduler.commitGroup(true);
      }
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performTwoChildrenDelete(
          context.sceneManager,
          context.relationshipManager!,
          treeName,
          plan.targetNode.id,
          plan.successor.id
        );
        this.reLayoutAndAnimate(context, treeName);
      }
    });
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR
  // ─────────────────────────────────────────────────────────────────────────

  private bstClear(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const nodes = BSTEngine.getClearOrder(context.sceneManager, treeName);

    if (nodes.length === 0) {
      this.log(context, 'CLEAR', 'BST is already empty.', 'info');
      return;
    }

    this.log(context, 'CLEAR', 'Clearing BST...', 'operation');

    // Animate nodes shrinking out level by level (root-outward)
    nodes.forEach((node, idx) => {
      const el = context.sceneManager.getElement(node.id) as any;
      if (!el) return;
      const delay = idx * 60; // stagger per node
      context.scheduler.enqueue({ targets: el.scale, x: 0, y: 0, z: 0, duration: 350, easing: 'easeInBack', delay });
      context.scheduler.enqueue({ targets: el, emissiveColor: '#f56565', emissiveIntensity: 0.6, duration: 200, delay });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(200);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        BSTEngine.performClear(context.sceneManager, treeName);
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'CLEAR',
          message: 'BST cleared.',
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), 'Cleared BST', context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROTATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * `ROTATE <value> <LEFT|RIGHT>` — rotates the subtree rooted at the node
   * holding `value`. Actually rewires parent/child edges (see
   * `BSTEngine.performRotation`) and re-lays out every node so the visible
   * result is the real post-rotation shape, not an acknowledgment tween.
   */
  private bstRotate(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const rawValue = (instruction as any).args?.[0];
    const rawDirection = (instruction as any).args?.[1];
    const value = Number(rawValue);
    const direction = String(rawDirection ?? '').toUpperCase();

    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value: "${rawValue}". ROTATE requires a numeric node value.`, 'warning');
      return;
    }
    if (direction !== 'LEFT' && direction !== 'RIGHT') {
      this.log(context, 'ERROR', `ROTATE requires a direction: "ROTATE ${rawValue} LEFT" or "ROTATE ${rawValue} RIGHT".`, 'warning');
      return;
    }

    const pivot = BSTEngine.findNodeByValue(context.sceneManager, treeName, value);
    if (!pivot) {
      this.log(context, 'ERROR', `Value ${value} not found in "${treeName}".`, 'warning');
      return;
    }

    const dirCode: 'L' | 'R' = direction === 'LEFT' ? 'L' : 'R';
    const plan = BSTEngine.computeRotationPlan(context.sceneManager, treeName, pivot.id, dirCode);
    if (!plan.success) {
      this.log(context, 'ERROR', plan.error!, 'warning');
      return;
    }

    this.log(context, 'ROTATE', `Rotating ${direction} at ${value}...`, 'operation');

    const pivotEl = context.sceneManager.getElement(pivot.id) as any;
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    if (pivotEl) {
      context.scheduler.enqueue({ targets: pivotEl, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
      context.scheduler.commitGroup(true);
    }

    // Perform the actual rewire synchronously — like BST_INSERT's node/edge
    // creation, this must not be gated behind an animation `complete`
    // callback, since the tree's logical shape (what re-layout, subsequent
    // operations, and tests observe) should be correct immediately, not
    // only once a decorative tween finishes.
    const result = BSTEngine.performRotation(context.sceneManager, context.relationshipManager!, treeName, pivot.id, dirCode);
    if (!result.success) {
      this.log(context, 'ERROR', result.error!, 'warning');
      return;
    }

    this.reLayoutAndAnimate(context, treeName);

    const newRootEl = context.sceneManager.getElement(result.newSubtreeRootId!) as any;
    [newRootEl, pivotEl].forEach((el) => {
      if (!el) return;
      context.scheduler.enqueue({ targets: el, color: BSTEngine.NODE_COLOR, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 400 });
    });
    context.scheduler.commitGroup(true);

    this.log(context, 'ROTATE', `Rotated ${direction} at ${value} in "${treeName}".`, 'result');
    if (context.stateManager) {
      context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Rotated ${direction} at ${value}`, context.scheduler.getCurrentTime());
      context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 2: TRAVERSALS
  // ─────────────────────────────────────────────────────────────────────────

  private animateTraversal(context: AlgorithmContext, action: 'INORDER' | 'PREORDER' | 'POSTORDER'): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);
    
    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    let steps: any[] = [];
    if (action === 'INORDER') steps = BSTEngine.computeInorderTraversal(context.sceneManager, treeName);
    else if (action === 'PREORDER') steps = BSTEngine.computePreorderTraversal(context.sceneManager, treeName);
    else if (action === 'POSTORDER') steps = BSTEngine.computePostorderTraversal(context.sceneManager, treeName);

    this.log(context, action, `Starting ${action} Traversal...`, 'operation');

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    const resultOrder: number[] = [];

    steps.forEach((step, index) => {
      const el = context.sceneManager.getElement(step.node.id) as any;
      if (!el) return;

      if (step.action === 'VISIT') {
        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 250 });
        this.log(context, action, `Visit ${step.node.value}`, 'step');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);

        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.4, duration: 200 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      } else if (step.action === 'PROCESS') {
        resultOrder.push(step.node.value);
        context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 300 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(350);

        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);

        this.log(context, action, `Order: ${resultOrder.join(' → ')}`, 'result');
      } else if (step.action === 'MOVE_LEFT' || step.action === 'MOVE_RIGHT') {
        const edge = BSTEngine.getEdgeBetween(context.sceneManager, treeName, step.node.id, step.targetNode.id);
        if (edge) {
          context.scheduler.enqueue({ targets: edge, color: traversingToken.color, scale: { x: 1.5, y: 1.5, z: 1.5 }, duration: 200 });
        }
        this.log(context, action, `Move ${step.action === 'MOVE_LEFT' ? 'Left' : 'Right'}`, 'step');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      } else if (step.action === 'BACKTRACK') {
        const edge = BSTEngine.getEdgeBetween(context.sceneManager, treeName, step.node.id, step.targetNode.id);
        if (edge) {
          context.scheduler.enqueue({ targets: edge, color: '#888888', scale: { x: 1, y: 1, z: 1 }, duration: 200 });
        }
        this.log(context, action, 'Backtrack', 'step');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      }
    });

    // Cleanup colors
    context.scheduler.enqueue({
      targets: {}, duration: 500, complete: () => {
        steps.forEach(s => {
          const el = context.sceneManager.getElement(s.node.id) as any;
          if (el) {
            context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
          }
        });
        context.scheduler.commitGroup(true);
      }
    });

    this.log(context, action, 'Traversal Complete', 'operation');
    context.scheduler.commitSequential();
  }

  private animateLevelOrder(context: AlgorithmContext): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    const steps = BSTEngine.computeLevelorderTraversal(context.sceneManager, treeName);
    this.log(context, 'LEVELORDER', 'Starting Level-Order Traversal...', 'operation');

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    const resultOrder: number[] = [];

    steps.forEach(step => {
      const el = context.sceneManager.getElement(step.node.id) as any;
      if (!el) return;

      const queueVals = step.queueState.map(n => n.value).join(', ');

      if (step.action === 'ENQUEUE') {
        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.5, duration: 200 });
        this.log(context, 'LEVELORDER', `Push ${step.node.value}\nQueue: [${queueVals}]`, 'step');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      } else if (step.action === 'DEQUEUE') {
        this.log(context, 'LEVELORDER', `Dequeue ${step.node.value}\nQueue: [${queueVals}]`, 'step');
        context.scheduler.advanceCursor(100);
      } else if (step.action === 'PROCESS') {
        resultOrder.push(step.node.value);
        context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 300 });
        this.log(context, 'LEVELORDER', `Visit ${step.node.value}\nOrder: ${resultOrder.join(' → ')}`, 'result');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(350);
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      }
    });

    context.scheduler.enqueue({
      targets: {}, duration: 500, complete: () => {
        steps.forEach(s => {
          const el = context.sceneManager.getElement(s.node.id) as any;
          if (el) context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
        });
        context.scheduler.commitGroup(true);
      }
    });
    this.log(context, 'LEVELORDER', 'Traversal Complete', 'operation');
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 3: INFORMATION QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  private animateMinMax(context: AlgorithmContext, type: 'MIN' | 'MAX'): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    const result = type === 'MIN' ? BSTEngine.computeMin(context.sceneManager, treeName) : BSTEngine.computeMax(context.sceneManager, treeName);
    
    this.log(context, type, `Finding ${type}imum value...`, 'operation');

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    result.path.forEach((node, idx) => {
      const el = context.sceneManager.getElement(node.id) as any;
      if (!el) return;

      context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
      context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 250 });
      this.log(context, type, `Visit ${node.value}`, 'step');
      
      if (idx > 0) {
        const parentId = result.path[idx - 1].id;
        const edge = BSTEngine.getEdgeBetween(context.sceneManager, treeName, parentId, node.id);
        if (edge) context.scheduler.enqueue({ targets: edge, color: evaluatingToken.color, scale: { x: 1.5, y: 1.5, z: 1.5 }, duration: 200 });
      }

      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);

      if (idx < result.path.length - 1) {
        this.log(context, type, `Move ${type === 'MIN' ? 'Left' : 'Right'}`, 'step');
        context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 200 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      }
    });

    if (result.resultNode) {
      const leaf = context.sceneManager.getElement(result.resultNode.id) as any;
      this.log(context, type, 'Stop', 'step');
      context.scheduler.advanceCursor(150);
      context.scheduler.enqueue({ targets: leaf, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
      context.scheduler.enqueue({ targets: leaf.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
      context.scheduler.commitGroup(true);
      this.log(context, type, `${type}imum Found\n${type}imum Value = ${result.resultNode.value}`, 'result');
      context.scheduler.advanceCursor(600);
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        result.path.forEach(n => {
          const el = context.sceneManager.getElement(n.id) as any;
          if (el) {
            context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
            context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
          }
        });
        const edges = BSTEngine.getEdges(context.sceneManager, treeName);
        edges.forEach(e => context.scheduler.enqueue({ targets: e, color: '#888888', scale: { x: 1, y: 1, z: 1 }, duration: 400 }));
        context.scheduler.commitGroup(true);
      }
    });

    context.scheduler.commitSequential();
  }

  private animateHeight(context: AlgorithmContext): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    const { steps, totalHeight } = BSTEngine.computeHeight(context.sceneManager, treeName);
    this.log(context, 'HEIGHT', 'Computing tree height recursively...', 'operation');

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    steps.forEach(step => {
      const el = context.sceneManager.getElement(step.node.id) as any;
      if (!el) return;

      if (step.action === 'VISIT') {
        context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.6, duration: 200 });
        this.log(context, 'HEIGHT', `Compute Height for ${step.node.value}`, 'step');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      } else if (step.action === 'RETURN') {
        context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        this.log(context, 'HEIGHT', `Return\nHeight for ${step.node.value} = ${step.height}`, 'result');
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);
        
        context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveIntensity: 0.3, duration: 200 });
        context.scheduler.commitGroup(true);
      }
    });

    this.log(context, 'HEIGHT', `Height = ${totalHeight}`, 'result');

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        steps.forEach(s => {
          const el = context.sceneManager.getElement(s.node.id) as any;
          if (el) context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
        });
        context.scheduler.commitGroup(true);
      }
    });
    context.scheduler.commitSequential();
  }

  private animateSize(context: AlgorithmContext): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    const { path, totalSize } = BSTEngine.computeSize(context.sceneManager, treeName);
    this.log(context, 'SIZE', 'Computing tree size...', 'operation');

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    let counter = 0;
    path.forEach(node => {
      const el = context.sceneManager.getElement(node.id) as any;
      if (!el) return;

      counter++;
      context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 200 });
      this.log(context, 'SIZE', `Visit Node ${node.value}\nCounter = ${counter}`, 'step');
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);

      context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveIntensity: 0.5, duration: 200 });
      context.scheduler.commitGroup(true);
    });

    this.log(context, 'SIZE', `Total Nodes = ${totalSize}`, 'result');

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        path.forEach(n => {
          const el = context.sceneManager.getElement(n.id) as any;
          if (el) context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
        });
        context.scheduler.commitGroup(true);
      }
    });
    context.scheduler.commitSequential();
  }

  private animateRoot(context: AlgorithmContext): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'ERROR', 'Tree is empty.\nOperation cannot be performed.', 'warning');
      return;
    }

    const el = context.sceneManager.getElement(root.id) as any;
    const successToken = getSemanticColorToken('SUCCESS');
    const neutralColor = BSTEngine.NODE_COLOR;

    this.log(context, 'ROOT', 'Root Highlight', 'step');
    context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 400 });
    context.scheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    this.log(context, 'ROOT', `Root = ${root.value}`, 'result');
    context.scheduler.advanceCursor(500);

    context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
    context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.commitSequential();
  }

  private animateIsEmpty(context: AlgorithmContext): void {
    const treeName = context.activeTreeName || 'defaultBST';
    const root = BSTEngine.getRoot(context.sceneManager, treeName);

    if (!root) {
      this.log(context, 'IS_EMPTY', 'BST is Empty', 'result');
      return;
    }

    this.log(context, 'IS_EMPTY', 'BST is Not Empty', 'result');

    const el = context.sceneManager.getElement(root.id) as any;
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const neutralColor = BSTEngine.NODE_COLOR;

    context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.7, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(400);

    context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveIntensity: 0, duration: 400 });
    context.scheduler.commitGroup(true);
    context.scheduler.commitSequential();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /** Recompute and animate all nodes to their new layout positions */
  private reLayoutAndAnimate(context: AlgorithmContext, treeName: string): void {
    const layoutMap = BSTEngine.computeLayout(context.sceneManager, treeName);
    const allNodes = BSTEngine.getNodes(context.sceneManager, treeName);
    allNodes.forEach(n => {
      (n as any).worldTarget = layoutMap.get(n.id);
      const pos = layoutMap.get(n.id);
      if (pos) {
        context.scheduler.enqueue({ targets: n.position, x: pos.x, y: pos.y, z: pos.z, duration: 600, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Animate a failed search path without modifying the tree */
  private animateFailedSearch(context: AlgorithmContext, path: any[]): void {
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const neutralColor = BSTEngine.NODE_COLOR;

    path.forEach(nodeRef => {
      const el = context.sceneManager.getElement(nodeRef.id) as any;
      if (!el) return;
      context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 280 });
      context.scheduler.enqueue({ targets: el.scale, x: 1.15, y: 1.15, z: 1.15, duration: 280 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);
      context.scheduler.enqueue({ targets: el, color: neutralColor, emissiveColor: BSTEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 200 });
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
      context.scheduler.commitGroup(true);
    });
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }
}

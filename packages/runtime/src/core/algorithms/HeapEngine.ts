/**
 * HeapEngine — Animation handler for binary min-heap operations.
 *
 * Registered with AlgorithmRegistry for:
 *   HEAP_INSERT, HEAP_EXTRACT, HEAP_DECREASE, BUILD_HEAP, HEAPIFY
 *
 * Every operation is computed by the pure MinHeap (../data-structures/Heap)
 * against the current values of the heap's HEAP_ARRAY_ELEMENT scene objects,
 * then replayed step by step (COMPARE/SWAP) against both the tree-shaped
 * HEAP_NODE view and the flat HEAP_ARRAY_ELEMENT view so the two stay in
 * sync. Nodes keep a fixed identity per index (edges are structural, wired
 * up once at declaration time from index -> 2*index+1 / 2*index+2), so a
 * "swap" exchanges the *value* held at two indices rather than moving nodes
 * around — this is what replaces the old HEAPIFY stub, which only played a
 * highlight/scale pulse and never touched any real data.
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { MinHeap, HeapStep } from '../../data-structures/Heap';

export class HeapEngine implements AlgorithmHandler {
  static readonly NODE_COLOR = '#7c4dff';
  static readonly NODE_EMISSIVE = '#000000';

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'HEAP_INSERT') {
      this.heapInsert(context, instruction);
    } else if (action === 'HEAP_EXTRACT') {
      this.heapExtract(context, instruction);
    } else if (action === 'HEAP_DECREASE') {
      this.heapDecrease(context, instruction);
    } else if (action === 'BUILD_HEAP') {
      this.buildHeap(context, instruction);
    } else if (action === 'HEAPIFY') {
      this.heapify(context, instruction);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getNodes(context: AlgorithmContext, heapName: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === heapName && el.originalType === 'HEAP_NODE');
  }

  private getArrayElements(context: AlgorithmContext, heapName: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === heapName && el.originalType === 'HEAP_ARRAY_ELEMENT');
  }

  private getValues(context: AlgorithmContext, heapName: string): number[] {
    return this.getArrayElements(context, heapName)
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex)
      .map((el: any) => Number(el.value));
  }

  private getPairAt(context: AlgorithmContext, heapName: string, index: number): { node?: any; arr?: any } {
    const node = context.sceneManager
      .getSceneGraph()
      .find((el: any) => el.logicalParent === heapName && el.originalType === 'HEAP_NODE' && el.logicalIndex === index);
    const arr = context.sceneManager
      .getSceneGraph()
      .find((el: any) => el.logicalParent === heapName && el.originalType === 'HEAP_ARRAY_ELEMENT' && el.logicalIndex === index);
    return { node, arr };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEAP_INSERT
  // ─────────────────────────────────────────────────────────────────────────

  private heapInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const heapName = instruction.args?.[0];
    const rawValue = instruction.args?.[1];
    const value = Number(rawValue);

    if (!heapName) {
      this.log(context, 'ERROR', 'HEAP_INSERT requires a heap name.', 'warning');
      return;
    }
    if (isNaN(value)) {
      this.log(context, 'ERROR', `Invalid value "${rawValue}". HEAP_INSERT requires a numeric argument.`, 'warning');
      return;
    }

    const heap = new MinHeap();
    heap.elements = this.getValues(context, heapName);
    const newIndex = heap.elements.length;
    heap.insert(value);

    this.log(context, 'HEAP_INSERT', `Inserting ${value} into "${heapName}"...`, 'operation');

    this.spawnNode(context, heapName, newIndex, value);
    this.replaySteps(context, heapName, heap.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HEAP_INSERT', `Inserted ${value}. Heap: [${heap.elements.join(', ')}]`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Heap insert ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Creates a new HEAP_NODE + HEAP_ARRAY_ELEMENT pair at `index`, wired to its parent by the standard 2i+1/2i+2 relationship, and pops it into view. */
  private spawnNode(context: AlgorithmContext, heapName: string, index: number, value: number): void {
    const nodeId = `heap_node_${heapName}_${index}_${Date.now()}`;
    const arrId = `heap_arr_${heapName}_${index}_${Date.now()}`;

    const nodeEl: any = {
      id: nodeId,
      type: 'sphere',
      originalType: 'HEAP_NODE',
      logicalParent: heapName,
      logicalIndex: index,
      value,
      label: `${heapName}[${index}]`,
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: HeapEngine.NODE_COLOR,
      emissiveColor: HeapEngine.NODE_EMISSIVE,
      emissiveIntensity: 0,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };
    const arrEl: any = {
      id: arrId,
      type: 'box',
      originalType: 'HEAP_ARRAY_ELEMENT',
      logicalParent: heapName,
      logicalIndex: index,
      value,
      label: `${heapName}[${index}]`,
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: HeapEngine.NODE_COLOR,
      emissiveColor: HeapEngine.NODE_EMISSIVE,
      emissiveIntensity: 0,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };

    context.sceneManager.addElement(nodeEl);
    context.sceneManager.addElement(arrEl);

    const parentIndex = Math.floor((index - 1) / 2);
    if (index > 0) {
      const { node: parentNode } = this.getPairAt(context, heapName, parentIndex);
      if (parentNode) {
        const edgeId = `heap_edge_${parentNode.id}_${nodeId}`;
        context.sceneManager.addElement({
          id: edgeId,
          type: 'edge',
          originalType: 'EDGE',
          logicalParent: heapName,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          color: '#888888',
          sourceId: parentNode.id,
          targetId: nodeId,
          directed: true,
          properties: { directed: true, label: index % 2 === 1 ? 'L' : 'R' },
        } as any);
        if (context.relationshipManager) {
          context.relationshipManager.addRelationship({
            id: edgeId,
            sourceId: parentNode.id,
            targetId: nodeId,
            type: 'edge',
            directed: true,
          });
        }
      }
    }

    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());

    if (nodeEl.worldTarget) {
      nodeEl.position.x = nodeEl.worldTarget.x;
      nodeEl.position.z = nodeEl.worldTarget.z;
    }
    if (arrEl.worldTarget) {
      arrEl.position.x = arrEl.worldTarget.x;
      arrEl.position.z = arrEl.worldTarget.z;
    }

    const allOthers = [...this.getNodes(context, heapName), ...this.getArrayElements(context, heapName)]
      .filter((el: any) => el.id !== nodeId && el.id !== arrId);
    allOthers.forEach((el: any) => {
      if (el.worldTarget) {
        context.scheduler.enqueue({ targets: el.position, x: el.worldTarget.x, y: el.worldTarget.y, z: el.worldTarget.z, duration: 400, easing: 'easeOutCubic' });
      }
    });
    context.scheduler.commitGroup(true);

    const successToken = getSemanticColorToken('SUCCESS');
    [nodeEl, arrEl].forEach((el) => {
      context.scheduler.enqueue({ targets: el.position, y: el.worldTarget?.y ?? 0, duration: 500, easing: 'easeOutBack' });
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 500, easing: 'easeOutBack' });
      context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(350);

    [nodeEl, arrEl].forEach((el) => {
      context.scheduler.enqueue({ targets: el, color: HeapEngine.NODE_COLOR, emissiveColor: HeapEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 300 });
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEAP_EXTRACT
  // ─────────────────────────────────────────────────────────────────────────

  private heapExtract(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const heapName = instruction.args?.[0];
    if (!heapName) {
      this.log(context, 'ERROR', 'HEAP_EXTRACT requires a heap name.', 'warning');
      return;
    }

    const values = this.getValues(context, heapName);
    if (values.length === 0) {
      this.log(context, 'HEAP_EXTRACT', `Heap "${heapName}" is empty. Nothing to extract.`, 'warning');
      return;
    }

    const min = values[0];
    const lastIndex = values.length - 1;
    this.log(context, 'HEAP_EXTRACT', `Extracting min (${min}) from "${heapName}"...`, 'operation');

    const { node: rootNode, arr: rootArr } = this.getPairAt(context, heapName, 0);
    const errorToken = getSemanticColorToken('DISCARDED');
    if (rootNode && rootArr) {
      context.scheduler.enqueue({ targets: [rootNode, rootArr], color: errorToken.color, emissiveColor: errorToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
      context.scheduler.enqueue({ targets: [rootNode.scale, rootArr.scale], x: 1.25, y: 1.25, z: 1.25, duration: 350 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(350);
    }

    if (lastIndex > 0) {
      // Move the last element's value into the root, then drop the (now duplicate) last node.
      const { node: lastNode, arr: lastArr } = this.getPairAt(context, heapName, lastIndex);
      const lastValue = lastNode ? Number(lastNode.value) : values[lastIndex];

      if (rootNode && rootArr) {
        rootNode.value = lastValue;
        rootArr.value = lastValue;
        context.scheduler.enqueue({ targets: [rootNode, rootArr], color: HeapEngine.NODE_COLOR, emissiveColor: HeapEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250 });
        context.scheduler.enqueue({ targets: [rootNode.scale, rootArr.scale], x: 1, y: 1, z: 1, duration: 250 });
        context.scheduler.commitGroup(true);
      }

      this.removeNode(context, heapName, lastIndex, lastNode, lastArr);

      const heap = new MinHeap();
      heap.elements = this.getValues(context, heapName);
      heap.heapifyDown(0);
      this.replaySteps(context, heapName, heap.steps);
    } else {
      this.removeNode(context, heapName, 0, rootNode, rootArr);
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HEAP_EXTRACT', `Extracted ${min} from "${heapName}".`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Heap extract -> ${min}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  private removeNode(context: AlgorithmContext, heapName: string, index: number, node?: any, arr?: any): void {
    const edges = context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === heapName && el.originalType === 'EDGE' && (el.targetId === node?.id || el.sourceId === node?.id));
    edges.forEach((e: any) => context.sceneManager.removeElement(e.id));
    if (node) context.sceneManager.removeElement(node.id);
    if (arr) context.sceneManager.removeElement(arr.id);
    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEAP_DECREASE
  // ─────────────────────────────────────────────────────────────────────────

  private heapDecrease(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const heapName = instruction.args?.[0];
    const index = Number(instruction.args?.[1]);
    const newValue = Number(instruction.args?.[2]);

    if (!heapName) {
      this.log(context, 'ERROR', 'HEAP_DECREASE requires a heap name.', 'warning');
      return;
    }
    if (isNaN(index) || isNaN(newValue)) {
      this.log(context, 'ERROR', 'HEAP_DECREASE requires a numeric index and value.', 'warning');
      return;
    }

    const heap = new MinHeap();
    heap.elements = this.getValues(context, heapName);

    try {
      heap.decreaseKey(index, newValue);
    } catch (e: any) {
      this.log(context, 'ERROR', e.message, 'warning');
      return;
    }

    this.log(context, 'HEAP_DECREASE', `Decreasing key at index ${index} to ${newValue} in "${heapName}"...`, 'operation');

    const { node, arr } = this.getPairAt(context, heapName, index);
    const activeToken = getSemanticColorToken('ACTIVE');
    if (node && arr) {
      context.scheduler.enqueue({ targets: [node, arr], color: activeToken.color, emissiveColor: activeToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
      context.scheduler.commitGroup(true);
      node.value = newValue;
      arr.value = newValue;
      context.scheduler.enqueue({ targets: [node, arr], color: HeapEngine.NODE_COLOR, emissiveColor: HeapEngine.NODE_EMISSIVE, emissiveIntensity: 0, duration: 250 });
      context.scheduler.commitGroup(true);
    }

    this.replaySteps(context, heapName, heap.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HEAP_DECREASE', `Heap: [${heap.elements.join(', ')}]`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Heap decreaseKey(${index}, ${newValue})`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD_HEAP
  // ─────────────────────────────────────────────────────────────────────────

  private buildHeap(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const heapName = instruction.args?.[0];
    if (!heapName) {
      this.log(context, 'ERROR', 'BUILD_HEAP requires a heap name.', 'warning');
      return;
    }

    const values = this.getValues(context, heapName);
    if (values.length === 0) {
      this.log(context, 'BUILD_HEAP', `Heap "${heapName}" is empty. Nothing to build.`, 'warning');
      return;
    }

    this.log(context, 'BUILD_HEAP', `Building heap from "${heapName}"...`, 'operation');

    const heap = MinHeap.buildHeap(values);
    this.replaySteps(context, heapName, heap.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'BUILD_HEAP', `Heap built: [${heap.elements.join(', ')}]`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Build heap ${heapName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEAPIFY (sift-down from an arbitrary index — used mid-algorithm, e.g. by BUILD_HEAP's steps or manual calls)
  // ─────────────────────────────────────────────────────────────────────────

  private heapify(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const heapName = instruction.args?.[0];
    const index = Number(instruction.args?.[1]);

    if (!heapName || isNaN(index)) {
      this.log(context, 'ERROR', 'HEAPIFY requires a heap name and a numeric index.', 'warning');
      return;
    }

    const heap = new MinHeap();
    heap.elements = this.getValues(context, heapName);
    if (index < 0 || index >= heap.elements.length) {
      this.log(context, 'ERROR', `HEAPIFY: index ${index} is out of bounds for heap "${heapName}".`, 'warning');
      return;
    }

    this.log(context, 'HEAPIFY', `Heapify called at index ${index} in "${heapName}"\nRestoring heap property from this node downward.`, 'operation');
    heap.heapifyDown(index);
    this.replaySteps(context, heapName, heap.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HEAPIFY', `Heap: [${heap.elements.join(', ')}]`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step replay (shared by every operation)
  // ─────────────────────────────────────────────────────────────────────────

  private replaySteps(context: AlgorithmContext, heapName: string, steps: HeapStep[]): void {
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const modifyingToken = getSemanticColorToken('MODIFYING');

    steps.forEach((step) => {
      const { node: nodeA, arr: arrA } = this.getPairAt(context, heapName, step.i);
      const { node: nodeB, arr: arrB } = this.getPairAt(context, heapName, step.j);
      if (!nodeA || !arrA || !nodeB || !arrB) return;

      if (step.type === 'COMPARE') {
        AnticipationAnimation.applyAnticipation(context.scheduler, [nodeA, nodeB], 'COMPARISON');
        context.scheduler.enqueue({ targets: [nodeA, nodeB, arrA, arrB], color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 220 });
        context.scheduler.enqueue({ targets: [nodeA.scale, nodeB.scale], x: 1.15, y: 1.15, z: 1.15, duration: 220 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(220);

        this.log(context, 'HEAP', `Compare ${nodeA.value} (index ${step.i}) and ${nodeB.value} (index ${step.j})`, 'step');

        context.scheduler.enqueue({ targets: [nodeA, nodeB, arrA, arrB], color: HeapEngine.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
        context.scheduler.enqueue({ targets: [nodeA.scale, nodeB.scale], x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      } else {
        AnticipationAnimation.applyAnticipation(context.scheduler, [nodeA, nodeB], 'SWAP');
        context.scheduler.enqueue({ targets: [nodeA, nodeB, arrA, arrB], color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.9, duration: 280 });
        context.scheduler.enqueue({ targets: [nodeA.scale, nodeB.scale], x: 1.2, y: 1.2, z: 1.2, duration: 280 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(280);

        const valueA = nodeA.value;
        const valueB = nodeB.value;
        nodeA.value = valueB; arrA.value = valueB;
        nodeB.value = valueA; arrB.value = valueA;

        this.log(context, 'HEAP', `Swapped index ${step.i} and index ${step.j}`, 'step');

        context.scheduler.enqueue({ targets: [nodeA.scale, nodeB.scale], x: 1, y: 1, z: 1, duration: 250 });
        context.scheduler.enqueue({ targets: [nodeA, nodeB, arrA, arrB], color: HeapEngine.NODE_COLOR, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);
      }
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

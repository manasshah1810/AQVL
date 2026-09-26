/**
 * HeapProgramEngine — a HEAP driven by real code instead of the one-line
 * built-ins (HEAP_INSERT, HEAP_EXTRACT, ... stay with HeapEngine).
 *
 * A heap is an array read as a complete binary tree: the children of index
 * p are 2p + 1 and 2p + 2, its parent is (p - 1) / 2. Every index has a
 * fixed pair of scene objects — a HEAP_NODE in the tree view and a
 * HEAP_ARRAY_ELEMENT in the array view — so, as in HeapEngine, a SWAP or an
 * assignment changes the *values* held at indices and never moves nodes.
 *
 * Supported statements on a heap `h`:
 *   h[i] / LENGTH(h)            read inside any expression
 *   SWAP h[i] h[j]              exchange two values
 *   COMPARE h[i] h[j]           highlight a comparison
 *   h[i] = value / UPDATE ...   overwrite a value
 *   HIGHLIGHT h[i] 'SUCCESS'    mark a cell
 *   INSERT h value              append a new last cell (the next tree position)
 *   DELETE h[LENGTH(h) - 1]     remove the last cell (only the last one: a
 *                               heap is always a complete tree)
 *   PRINT h                     print the array
 */

import { getSemanticColorToken } from '@aqvl/shared';
import { AlgorithmContext } from './AlgorithmContext';
import { AnticipationAnimation } from '../animations';

export class HeapIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeapIndexError';
  }
}

export class HeapProgramEngine {
  static readonly NODE_COLOR = '#7c4dff';

  /** Created nodes need unique ids even when a cell is removed and re-added within one millisecond. */
  private created = 0;

  /** Whether `name` is a declared HEAP (it has an anchor, even while empty). */
  isHeap(context: AlgorithmContext, name: unknown): boolean {
    if (typeof name !== 'string') return false;
    return context.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'HEAP' && el.logicalParent === name);
  }

  hasAnyHeap(context: AlgorithmContext): boolean {
    return context.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'HEAP');
  }

  /** Array-view cells of heap `name`, in index order. */
  private cells(context: AlgorithmContext, name: string): any[] {
    return (context.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.logicalParent === name && el.originalType === 'HEAP_ARRAY_ELEMENT' && !el.animationLayer)
      .sort((a, b) => a.logicalIndex - b.logicalIndex);
  }

  private nodeAt(context: AlgorithmContext, name: string, index: number): any {
    return (context.sceneManager.getSceneGraph() as any[]).find(
      (el) => el.logicalParent === name && el.originalType === 'HEAP_NODE' && el.logicalIndex === index && !el.animationLayer
    );
  }

  /** The tree node and array cell at `index`, or a clear error when the index is outside the heap. */
  private pairAt(context: AlgorithmContext, name: string, index: number): { node: any; cell: any } {
    const cells = this.cells(context, name);
    const cell = cells.find((el) => el.logicalIndex === index);
    if (!Number.isInteger(index) || !cell) {
      throw new HeapIndexError(
        cells.length === 0
          ? `Index ${index} is out of bounds for heap '${name}': the heap is empty.`
          : `Index ${index} is out of bounds for heap '${name}' (valid indices are 0 to ${cells.length - 1}).`
      );
    }
    return { node: this.nodeAt(context, name, index), cell };
  }

  length(context: AlgorithmContext, name: string): number {
    return this.cells(context, name).length;
  }

  valueAt(context: AlgorithmContext, name: string, index: number): unknown {
    return this.pairAt(context, name, index).cell.value;
  }

  format(context: AlgorithmContext, name: string): string {
    return `[${this.cells(context, name).map((el) => HeapProgramEngine.show(el.value)).join(', ')}]`;
  }

  private static show(value: unknown): string {
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
    return String(value);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statements
  // ─────────────────────────────────────────────────────────────────────────

  compare(context: AlgorithmContext, a: { heap: string; index: number }, b: { heap: string; index: number }): void {
    const left = this.pairAt(context, a.heap, a.index);
    const right = this.pairAt(context, b.heap, b.index);
    const all = [left.node, left.cell, right.node, right.cell].filter(Boolean);
    const token = getSemanticColorToken('EVALUATING');

    AnticipationAnimation.applyAnticipation(context.scheduler, [left.node ?? left.cell, right.node ?? right.cell], 'COMPARISON');
    this.paint(all, 'EVALUATING');
    context.scheduler.enqueue({ targets: all, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: token.emissiveIntensity, duration: 300, easing: 'easeOutExpo' });
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1.15, y: 1.15, z: 1.15, duration: 300, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(250);
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
    context.scheduler.commitGroup(true);

    const lv: any = left.cell.value;
    const rv: any = right.cell.value;
    const symbol = lv < rv ? '<' : lv > rv ? '>' : '=';
    const word = lv < rv ? 'less than' : lv > rv ? 'greater than' : 'equal to';
    const lName = a.heap === b.heap ? `[${a.index}]` : `${a.heap}[${a.index}]`;
    const rName = a.heap === b.heap ? `[${b.index}]` : `${b.heap}[${b.index}]`;
    this.finish(context, 'COMPARE', `Comparing ${lName}=${HeapProgramEngine.show(lv)} vs ${rName}=${HeapProgramEngine.show(rv)}\n${HeapProgramEngine.show(lv)} ${symbol} ${HeapProgramEngine.show(rv)}  (${HeapProgramEngine.show(lv)} is ${word} ${HeapProgramEngine.show(rv)})`, 'compare');
  }

  swap(context: AlgorithmContext, a: { heap: string; index: number }, b: { heap: string; index: number }): void {
    const left = this.pairAt(context, a.heap, a.index);
    const right = this.pairAt(context, b.heap, b.index);
    const all = [left.node, left.cell, right.node, right.cell].filter(Boolean);
    const token = getSemanticColorToken('MODIFYING');

    AnticipationAnimation.applyAnticipation(context.scheduler, [left.node ?? left.cell, right.node ?? right.cell], 'SWAP');
    this.paint(all, 'MODIFYING');
    context.scheduler.enqueue({ targets: all, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: token.emissiveIntensity, duration: 280 });
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1.2, y: 1.2, z: 1.2, duration: 280 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(280);

    const leftValue = left.cell.value;
    const rightValue = right.cell.value;
    this.setValue(left, rightValue);
    this.setValue(right, leftValue);

    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1, y: 1, z: 1, duration: 250 });
    context.scheduler.commitGroup(true);
    const lName = a.heap === b.heap ? `[${a.index}]` : `${a.heap}[${a.index}]`;
    const rName = a.heap === b.heap ? `[${b.index}]` : `${b.heap}[${b.index}]`;
    this.finish(context, 'SWAP', `Swapped ${lName} (${HeapProgramEngine.show(leftValue)}) ↔ ${rName} (${HeapProgramEngine.show(rightValue)})`, 'swap');
  }

  update(context: AlgorithmContext, name: string, index: number, value: unknown): void {
    const pair = this.pairAt(context, name, index);
    const all = [pair.node, pair.cell].filter(Boolean);
    const token = getSemanticColorToken('MODIFYING');
    const old = pair.cell.value;

    AnticipationAnimation.applyAnticipation(context.scheduler, [pair.node ?? pair.cell], 'UPDATE');
    this.paint(all, 'MODIFYING');
    context.scheduler.enqueue({ targets: all, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: token.emissiveIntensity, duration: 280, easing: 'easeOutExpo' });
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1.2, y: 1.2, z: 1.2, duration: 280, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    this.setValue(pair, value);
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
    context.scheduler.commitGroup(true);
    this.finish(context, 'UPDATE', `${name}[${index}] = ${HeapProgramEngine.show(value)} (was ${HeapProgramEngine.show(old)})`, 'operation');
  }

  highlight(context: AlgorithmContext, name: string, index: number, color: string): void {
    const pair = this.pairAt(context, name, index);
    const all = [pair.node, pair.cell].filter(Boolean);
    const token = getSemanticColorToken(color || 'SUCCESS');

    AnticipationAnimation.applyAnticipation(context.scheduler, [pair.node ?? pair.cell], 'SELECTION');
    for (const el of all) {
      el.isHighlighted = token.name !== 'NEUTRAL';
      el.highlightType = color;
      el.state = token.name;
      el.color = token.name === 'NEUTRAL' ? HeapProgramEngine.NODE_COLOR : token.color;
      el.emissiveColor = token.emissiveColor;
      el.emissiveIntensity = token.emissiveIntensity;
    }
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1.15, y: 1.15, z: 1.15, duration: 300, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
    context.scheduler.commitGroup(true);
    const value = HeapProgramEngine.show(pair.cell.value);
    const message = token.name === 'NEUTRAL'
      ? `Cleared mark on ${name}[${index}] (value: ${value})`
      : `Marked ${name}[${index}] = ${value} as ${String(color || 'SUCCESS').toUpperCase()}`;
    this.finish(context, 'HIGHLIGHT', message, 'step');
  }

  /** `INSERT h value`: a new last cell, which is the next free position of the complete tree. */
  append(context: AlgorithmContext, name: string, value: unknown): void {
    const index = this.length(context, name);
    const stamp = `${name}_${index}_${++this.created}`;
    const base = {
      logicalParent: name,
      logicalIndex: index,
      value,
      label: `${name}[${index}]`,
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: HeapProgramEngine.NODE_COLOR,
      emissiveColor: '#000000',
      emissiveIntensity: 0,
      state: 'NEUTRAL',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };
    const node: any = { ...base, id: `heapcode_node_${stamp}`, type: 'sphere', originalType: 'HEAP_NODE' };
    const cell: any = { ...base, id: `heapcode_cell_${stamp}`, type: 'box', originalType: 'HEAP_ARRAY_ELEMENT', position: { x: 0, y: -10, z: 0 }, scale: { x: 0, y: 0, z: 0 } };
    context.sceneManager.addElement(node);
    context.sceneManager.addElement(cell);

    if (index > 0) {
      const parent = this.nodeAt(context, name, (index - (index % 2 === 1 ? 1 : 2)) / 2);
      if (parent) {
        const edgeId = `heapcode_edge_${stamp}`;
        context.sceneManager.addElement({
          id: edgeId,
          type: 'edge',
          originalType: 'EDGE',
          logicalParent: name,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          color: '#888888',
          sourceId: parent.id,
          targetId: node.id,
          directed: true,
          properties: { directed: true, label: index % 2 === 1 ? 'L' : 'R' },
        } as any);
        context.relationshipManager?.addRelationship({ id: edgeId, sourceId: parent.id, targetId: node.id, type: 'edge', directed: true });
      }
    }

    this.relayout(context, name, [node, cell]);
    const token = getSemanticColorToken('SUCCESS');
    for (const el of [node, cell]) {
      if (el.worldTarget) {
        el.position.x = el.worldTarget.x;
        el.position.z = el.worldTarget.z;
        context.scheduler.enqueue({ targets: el.position, y: el.worldTarget.y, duration: 450, easing: 'easeOutBack' });
      }
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 450, easing: 'easeOutBack' });
      context.scheduler.enqueue({ targets: el, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
    }
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);
    context.scheduler.enqueue({ targets: [node, cell], color: HeapProgramEngine.NODE_COLOR, emissiveColor: '#000000', emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
    this.finish(context, 'INSERT', `Added ${HeapProgramEngine.show(value)} as ${name}[${index}], the next free spot of the tree`, 'operation', name);
  }

  /** `DELETE h[i]`: only the last cell can go, so the tree stays complete. */
  removeLast(context: AlgorithmContext, name: string, index: number): void {
    const size = this.length(context, name);
    if (size === 0) throw new HeapIndexError(`Cannot DELETE from heap '${name}': the heap is empty.`);
    if (index !== size - 1) {
      this.pairAt(context, name, index); // out-of-bounds indices get the usual message
      throw new HeapIndexError(
        `Only the last cell of heap '${name}' (index ${size - 1}) can be deleted, not index ${index}: a heap must stay a complete tree. Move the value to the end first (SWAP or ${name}[${index}] = ${name}[${size - 1}]), then DELETE ${name}[LENGTH(${name}) - 1].`
      );
    }
    const pair = this.pairAt(context, name, index);
    const all = [pair.node, pair.cell].filter(Boolean);
    const token = getSemanticColorToken('DISCARDED');
    for (const el of all) {
      el.color = token.color;
      el.emissiveColor = token.emissiveColor;
    }
    context.scheduler.enqueue({ targets: all, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.9, duration: 250 });
    context.scheduler.enqueue({ targets: all.map((el) => el.scale), x: 0, y: 0, z: 0, duration: 350, easing: 'easeInBack' });
    context.scheduler.commitGroup(true);

    const value = pair.cell.value;
    const graph = context.sceneManager.getSceneGraph() as any[];
    for (const edge of graph.filter((el) => el.logicalParent === name && el.originalType === 'EDGE' && pair.node && (el.targetId === pair.node.id || el.sourceId === pair.node.id))) {
      context.sceneManager.removeElement(edge.id);
    }
    for (const el of all) context.sceneManager.removeElement(el.id);
    this.relayout(context, name, []);
    this.finish(context, 'DELETE', `Removed the last cell ${name}[${index}] (value ${HeapProgramEngine.show(value)}); the heap now has ${size - 1} value${size - 1 === 1 ? '' : 's'}`, 'operation', name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Clears last step's comparison / swap colours; marks set by HIGHLIGHT stay. */
  restoreBaseColors(context: AlgorithmContext): void {
    for (const el of context.sceneManager.getSceneGraph() as any[]) {
      if ((el.originalType !== 'HEAP_NODE' && el.originalType !== 'HEAP_ARRAY_ELEMENT') || !this.isHeap(context, el.logicalParent)) continue;
      if (el.state === 'EVALUATING' || el.state === 'MODIFYING') {
        el.state = 'NEUTRAL';
        el.isHighlighted = false;
        el.color = HeapProgramEngine.NODE_COLOR;
        el.emissiveColor = '#000000';
        el.emissiveIntensity = 0;
      }
    }
  }

  private paint(elements: any[], state: string): void {
    const token = getSemanticColorToken(state);
    for (const el of elements) {
      el.state = state;
      el.isHighlighted = true;
      el.highlightType = state;
      el.color = token.color;
      el.emissiveColor = token.emissiveColor;
      el.emissiveIntensity = token.emissiveIntensity;
    }
  }

  private setValue(pair: { node: any; cell: any }, value: unknown): void {
    pair.cell.value = value;
    if (pair.node) pair.node.value = value;
  }

  /** Recomputes the layout and slides every other element of the heap to its new place. */
  private relayout(context: AlgorithmContext, name: string, skip: any[]): void {
    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());
    const others = (context.sceneManager.getSceneGraph() as any[]).filter(
      (el) => el.logicalParent === name && (el.originalType === 'HEAP_NODE' || el.originalType === 'HEAP_ARRAY_ELEMENT') && !skip.includes(el)
    );
    for (const el of others) {
      if (el.worldTarget) {
        context.scheduler.enqueue({ targets: el.position, x: el.worldTarget.x, y: el.worldTarget.y, z: el.worldTarget.z, duration: 350, easing: 'easeOutCubic' });
      }
    }
    context.scheduler.commitGroup(true);
  }

  /** The step's console line and saved state, once its animation has played. */
  private finish(context: AlgorithmContext, keyword: string, message: string, kind: string, settleHeap?: string): void {
    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        if (settleHeap) {
          // The heap changed shape: every node ends exactly on its new place.
          for (const el of context.sceneManager.getSceneGraph() as any[]) {
            if (el.logicalParent !== settleHeap || !el.worldTarget) continue;
            if (el.originalType !== 'HEAP_NODE' && el.originalType !== 'HEAP_ARRAY_ELEMENT') continue;
            el.position.x = el.worldTarget.x;
            el.position.y = el.worldTarget.y;
            el.position.z = el.worldTarget.z;
            el.scale.x = el.scale.y = el.scale.z = 1;
          }
        }
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), message.split('\n')[0], context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      },
    });
    context.scheduler.commitSequential();
  }
}

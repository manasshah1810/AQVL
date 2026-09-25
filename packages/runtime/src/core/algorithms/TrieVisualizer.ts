/**
 * TrieVisualizer — Animation handler for prefix-tree operations.
 *
 * Registered with AlgorithmRegistry for:
 *   TRIE_INIT, TRIE_INSERT, TRIE_SEARCH, TRIE_DELETE, TRIE_AUTOCOMPLETE, TRIE_STARTSWITH
 *
 * Like HeapEngine/HashMapVisualizer, the scene graph is the source of truth:
 * each TRIE_NODE scene element IS a trie node (its `label` is the full path
 * from the root, its `isEndOfWord` flag marks a real inserted word), linked
 * by EDGE elements the same way BST/tree nodes are. On every call the
 * relevant path is looked up directly in the scene, and (for correctness on
 * insert/delete/autocomplete) a pure Trie (../../data-structures/Trie) is
 * reconstructed from every isEndOfWord node's label to run the real
 * algorithm before the scene is mutated to match.
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { Trie } from '../../data-structures/Trie';

export class TrieVisualizer implements AlgorithmHandler {
  static readonly NODE_COLOR = '#8d6e63';
  static readonly WORD_END_COLOR = '#5d4037';
  static readonly NEUTRAL_EMISSIVE = '#000000';

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'TRIE_INIT') {
      this.trieInit(context, instruction);
    } else if (action === 'TRIE_INSERT') {
      this.trieInsert(context, instruction);
    } else if (action === 'TRIE_SEARCH') {
      this.trieSearch(context, instruction);
    } else if (action === 'TRIE_STARTSWITH') {
      this.trieStartsWith(context, instruction);
    } else if (action === 'TRIE_DELETE') {
      this.trieDelete(context, instruction);
    } else if (action === 'TRIE_AUTOCOMPLETE') {
      this.trieAutocomplete(context, instruction);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getNodes(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'TRIE_NODE');
  }

  private getEdges(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'EDGE');
  }

  private getRoot(context: AlgorithmContext, name: string): any {
    return this.getNodes(context, name).find((el: any) => el.label === '');
  }

  private findByLabel(context: AlgorithmContext, name: string, label: string): any {
    return this.getNodes(context, name).find((el: any) => el.label === label);
  }

  private childEdges(context: AlgorithmContext, name: string, nodeId: string): any[] {
    return this.getEdges(context, name).filter((e: any) => e.sourceId === nodeId);
  }

  /** Rebuilds a pure Trie from every isEndOfWord node's label (a label IS the word it ends). */
  private reconstruct(context: AlgorithmContext, name: string): Trie {
    const trie = new Trie();
    this.getNodes(context, name)
      .filter((el: any) => el.isEndOfWord)
      .forEach((el: any) => trie.insert(el.label));
    return trie;
  }

  /** Walks the scene from the root along `str`'s characters, returning every node visited (index 0 = root). Stops early if the path breaks. */
  private walkPath(context: AlgorithmContext, name: string, str: string): any[] {
    const path: any[] = [];
    let current = this.getRoot(context, name);
    if (!current) return path;
    path.push(current);

    let soFar = '';
    for (const char of str) {
      soFar += char;
      const next = this.findByLabel(context, name, soFar);
      if (!next) break;
      path.push(next);
      current = next;
    }
    return path;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_INIT
  // ─────────────────────────────────────────────────────────────────────────

  private trieInit(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    if (!name) {
      this.log(context, 'ERROR', 'TRIE_INIT requires a trie name.', 'warning');
      return;
    }
    if (this.getRoot(context, name)) return; // already initialized

    const rootEl: any = {
      id: `trie_node_${name}_root_${Date.now()}`,
      type: 'sphere',
      originalType: 'TRIE_NODE',
      logicalParent: name,
      value: '',
      label: '',
      isEndOfWord: false,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: TrieVisualizer.NODE_COLOR,
      emissiveColor: TrieVisualizer.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(rootEl);
    this.log(context, 'TRIE_INIT', `Created trie "${name}".`, 'operation');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_INSERT
  // ─────────────────────────────────────────────────────────────────────────

  private trieInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : undefined;

    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_INSERT requires a trie name and a non-empty word.', 'warning');
      return;
    }
    if (!this.getRoot(context, name)) {
      this.trieInit(context, { ...instruction, args: [name] } as any);
    }

    this.log(context, 'TRIE_INSERT', `Inserting "${word}"...`, 'operation');
    this.visualizeInsert(context, name, word);
  }

  /** Walks/creates the char-by-char path for `word`, highlighting each existing node it passes through and popping in any missing ones, then marks the final node as a word end. */
  visualizeInsert(context: AlgorithmContext, name: string, word: string): void {
    let parent = this.getRoot(context, name);
    if (!parent) return;

    const traversingToken = getSemanticColorToken('TRAVERSING');
    let soFar = '';

    for (const char of word) {
      soFar += char;
      let node = this.findByLabel(context, name, soFar);
      const isNew = !node;

      if (isNew) {
        node = this.spawnChild(context, name, parent, char, soFar);
      } else {
        context.scheduler.enqueue({ targets: node, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
        context.scheduler.enqueue({ targets: node.scale, x: 1.15, y: 1.15, z: 1.15, duration: 200 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
        context.scheduler.enqueue({ targets: node, color: node.isEndOfWord ? TrieVisualizer.WORD_END_COLOR : TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 180 });
        context.scheduler.enqueue({ targets: node.scale, x: 1, y: 1, z: 1, duration: 180 });
        context.scheduler.commitGroup(true);
      }

      parent = node;
    }

    const alreadyEndOfWord = parent.isEndOfWord;
    parent.isEndOfWord = true;
    parent.color = TrieVisualizer.WORD_END_COLOR;

    const successToken = getSemanticColorToken('SUCCESS');
    context.scheduler.enqueue({ targets: parent, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
    context.scheduler.enqueue({ targets: parent.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(350);
    context.scheduler.enqueue({ targets: parent, color: TrieVisualizer.WORD_END_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.enqueue({ targets: parent.scale, x: 1, y: 1, z: 1, duration: 250 });
    context.scheduler.commitGroup(true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_INSERT', alreadyEndOfWord ? `"${word}" was already present.` : `Inserted "${word}".`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Trie insert ${word}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  private spawnChild(context: AlgorithmContext, name: string, parent: any, char: string, label: string): any {
    const nodeEl: any = {
      id: `trie_node_${name}_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'sphere',
      originalType: 'TRIE_NODE',
      logicalParent: name,
      value: char,
      label,
      isEndOfWord: false,
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: TrieVisualizer.NODE_COLOR,
      emissiveColor: TrieVisualizer.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(nodeEl);

    const edgeEl: any = {
      id: `trie_edge_${parent.id}_${nodeEl.id}`,
      type: 'edge',
      originalType: 'EDGE',
      logicalParent: name,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#888888',
      sourceId: parent.id,
      targetId: nodeEl.id,
      directed: true,
      properties: { label: char },
    };
    context.sceneManager.addElement(edgeEl);
    if (context.relationshipManager) {
      context.relationshipManager.addRelationship({ id: edgeEl.id, sourceId: parent.id, targetId: nodeEl.id, type: 'edge', directed: true });
    }

    context.layoutManager.updateLayout(context.sceneManager.getSceneGraph());
    if (nodeEl.worldTarget) {
      nodeEl.position.x = nodeEl.worldTarget.x;
      nodeEl.position.z = nodeEl.worldTarget.z;
    }

    const successToken = getSemanticColorToken('SUCCESS');
    context.scheduler.enqueue({ targets: nodeEl.position, y: nodeEl.worldTarget?.y ?? 0, duration: 400, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: nodeEl.scale, x: 1, y: 1, z: 1, duration: 400, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: nodeEl, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);
    context.scheduler.enqueue({ targets: nodeEl, color: TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);

    return nodeEl;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_SEARCH / TRIE_STARTSWITH
  // ─────────────────────────────────────────────────────────────────────────

  private trieSearch(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : undefined;
    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_SEARCH requires a trie name and a word.', 'warning');
      return;
    }

    const path = this.walkPath(context, name, word);
    const found = path.length === word.length + 1 && path[path.length - 1].isEndOfWord;
    this.visualizeSearch(context, name, word, found);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_SEARCH', found ? `"${word}" found.` : `"${word}" not found.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  private trieStartsWith(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const prefix = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : undefined;
    if (!name || prefix === undefined) {
      this.log(context, 'ERROR', 'TRIE_STARTSWITH requires a trie name and a prefix.', 'warning');
      return;
    }

    const path = this.walkPath(context, name, prefix);
    const exists = path.length === prefix.length + 1;
    this.visualizeSearch(context, name, prefix, exists, true);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_STARTSWITH', exists ? `Prefix "${prefix}" exists.` : `Prefix "${prefix}" does not exist.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Walks the scene path char by char, highlighting each hop; ends green on success or red at the point the path breaks / word-end check fails. */
  visualizeSearch(context: AlgorithmContext, name: string, word: string, found: boolean, prefixOnly: boolean = false): void {
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const successToken = getSemanticColorToken('SUCCESS');
    const missToken = getSemanticColorToken('DISCARDED');

    let node = this.getRoot(context, name);
    if (!node) return;

    let soFar = '';
    for (const char of word) {
      soFar += char;
      const next = this.findByLabel(context, name, soFar);
      if (!next) {
        context.scheduler.enqueue({ targets: node, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);
        context.scheduler.enqueue({ targets: node, color: node.isEndOfWord ? TrieVisualizer.WORD_END_COLOR : TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);
        return;
      }

      AnticipationAnimation.applyAnticipation(context.scheduler, [next], 'TRAVERSAL');
      context.scheduler.enqueue({ targets: next, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 220 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(220);
      context.scheduler.enqueue({ targets: next, color: next.isEndOfWord ? TrieVisualizer.WORD_END_COLOR : TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 180 });
      context.scheduler.commitGroup(true);

      node = next;
    }

    const finalToken = found ? successToken : missToken;
    context.scheduler.enqueue({ targets: node, color: finalToken.color, emissiveColor: finalToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(350);
    context.scheduler.enqueue({ targets: node, color: node.isEndOfWord ? TrieVisualizer.WORD_END_COLOR : TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_DELETE
  // ─────────────────────────────────────────────────────────────────────────

  private trieDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : undefined;
    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_DELETE requires a trie name and a word.', 'warning');
      return;
    }

    const path = this.walkPath(context, name, word);
    const existed = path.length === word.length + 1 && path[path.length - 1].isEndOfWord;

    this.visualizeDelete(context, name, word);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_DELETE', existed ? `Deleted "${word}".` : `"${word}" not found; nothing deleted.`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `Trie delete ${word}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Unmarks the word's end node, then prunes bottom-up: a node with no remaining children and no isEndOfWord flag is removed, and pruning continues into its parent. */
  visualizeDelete(context: AlgorithmContext, name: string, word: string): void {
    const path = this.walkPath(context, name, word);
    if (path.length !== word.length + 1) {
      const root = this.getRoot(context, name);
      if (root) {
        const missToken = getSemanticColorToken('DISCARDED');
        context.scheduler.enqueue({ targets: root, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.7, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);
        context.scheduler.enqueue({ targets: root, color: TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
        context.scheduler.commitGroup(true);
      }
      return;
    }

    const endNode = path[path.length - 1];
    if (!endNode.isEndOfWord) return; // word was never actually inserted (only a shared prefix)

    const discardedToken = getSemanticColorToken('DISCARDED');
    context.scheduler.enqueue({ targets: endNode, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);

    endNode.isEndOfWord = false;
    endNode.color = TrieVisualizer.NODE_COLOR;

    // Prune from the leaf back up while a node has no children and isn't a word end.
    let child = endNode;
    for (let i = path.length - 1; i > 0; i--) {
      const hasChildren = this.childEdges(context, name, child.id).length > 0;
      if (hasChildren || child.isEndOfWord) break;

      const parentEl = path[i - 1];
      const incomingEdge = this.getEdges(context, name).find((e: any) => e.targetId === child.id);

      context.scheduler.enqueue({ targets: child.scale, x: 0, y: 0, z: 0, duration: 250 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);

      context.sceneManager.removeElement(child.id);
      if (incomingEdge) context.sceneManager.removeElement(incomingEdge.id);

      child = parentEl;
    }

    context.scheduler.enqueue({ targets: {}, duration: 1 });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_AUTOCOMPLETE
  // ─────────────────────────────────────────────────────────────────────────

  private trieAutocomplete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const prefix = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : '';
    if (!name) {
      this.log(context, 'ERROR', 'TRIE_AUTOCOMPLETE requires a trie name.', 'warning');
      return;
    }

    const trie = this.reconstruct(context, name);
    const matches = trie.autocomplete(prefix);

    this.log(context, 'TRIE_AUTOCOMPLETE', `Autocomplete "${prefix}"...`, 'operation');
    this.visualizeAutocomplete(context, name, prefix, matches);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_AUTOCOMPLETE', matches.length > 0 ? `Matches: ${matches.join(', ')}` : `No words start with "${prefix}".`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Highlights the prefix node (the shared root of every match), then pulses each matched word's terminal node in turn. */
  visualizeAutocomplete(context: AlgorithmContext, name: string, prefix: string, words: string[]): void {
    const path = this.walkPath(context, name, prefix);
    const prefixNode = path[path.length - 1];

    if (!prefixNode || path.length !== prefix.length + 1) {
      const root = this.getRoot(context, name);
      if (root) {
        const missToken = getSemanticColorToken('DISCARDED');
        context.scheduler.enqueue({ targets: root, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.7, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);
        context.scheduler.enqueue({ targets: root, color: TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
        context.scheduler.commitGroup(true);
      }
      return;
    }

    const traversingToken = getSemanticColorToken('TRAVERSING');
    context.scheduler.enqueue({ targets: prefixNode, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
    context.scheduler.enqueue({ targets: prefixNode.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);

    const successToken = getSemanticColorToken('SUCCESS');
    words.forEach((word) => {
      const endNode = this.findByLabel(context, name, word);
      if (!endNode) return;
      context.scheduler.enqueue({ targets: endNode, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 220 });
      context.scheduler.enqueue({ targets: endNode.scale, x: 1.2, y: 1.2, z: 1.2, duration: 220 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(220);
      context.scheduler.enqueue({ targets: endNode, color: TrieVisualizer.WORD_END_COLOR, emissiveIntensity: 0, duration: 180 });
      context.scheduler.enqueue({ targets: endNode.scale, x: 1, y: 1, z: 1, duration: 180 });
      context.scheduler.commitGroup(true);
    });

    context.scheduler.enqueue({ targets: prefixNode.scale, x: 1, y: 1, z: 1, duration: 200 });
    context.scheduler.enqueue({ targets: prefixNode, color: prefixNode.isEndOfWord ? TrieVisualizer.WORD_END_COLOR : TrieVisualizer.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
    context.scheduler.commitGroup(true);
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

/**
 * TrieEngine — Animation handler for prefix-tree operations.
 *
 * Registered with AlgorithmRegistry for:
 *   TRIE_INIT, TRIE_INSERT, TRIE_SEARCH, TRIE_DELETE, TRIE_AUTOCOMPLETE, TRIE_STARTSWITH
 *
 * Like HeapEngine/HashMapEngine, the scene graph is the source of truth:
 * each TRIE_NODE scene element IS a trie node (its `label` is the full path
 * from the root, its `isEndOfWord` flag marks a real inserted word), linked
 * by EDGE elements the same way BST/tree nodes are. On every call a pure
 * Trie (../../data-structures/Trie) is rehydrated from those nodes, the
 * operation runs there, and the steps it recorded are replayed onto the
 * scene by `replaySteps` (a step names its node by prefix).
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { Trie, TrieNode, TrieStep } from '../../data-structures/Trie';
import { TrieProgramEngine } from './TrieProgramEngine';

export class TrieEngine implements AlgorithmHandler {
  /** The statements registered with AlgorithmRegistry. */
  static readonly ALGORITHMS = ['TRIE_INIT', 'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_STARTSWITH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE'];

  // The same resting colours as TrieProgramEngine: a word end is green.
  static readonly NODE_COLOR = getSemanticColorToken('NEUTRAL').color;
  static readonly WORD_END_COLOR = getSemanticColorToken('SUCCESS').color;
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
    return this.findByLabel(context, name, '');
  }

  private findByLabel(context: AlgorithmContext, name: string, label: string): any {
    return this.getNodes(context, name).find((el: any) => TrieProgramEngine.prefixOf(el) === label);
  }

  /** Rebuilds a pure Trie with a node for every TRIE_NODE in the scene (a node's label IS its path), word ends marked. */
  private rehydrate(context: AlgorithmContext, name: string): Trie {
    const trie = new Trie();
    for (const el of this.getNodes(context, name)) {
      let node = trie.root;
      for (const char of TrieProgramEngine.prefixOf(el)) {
        if (!node.children.has(char)) node.children.set(char, new TrieNode());
        node = node.children.get(char)!;
      }
      if (el.isEndOfWord) node.isEndOfWord = true;
    }
    return trie;
  }

  /** The `index`-th argument as a word, or undefined when absent / empty. */
  private wordArg(instruction: GenericActionInstruction, index: number): string | undefined {
    return instruction.args?.[index] !== undefined ? String(instruction.args[index]) : undefined;
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
      // Same ids as TrieProgramEngine, so code (node = t.root, GET_CHILD, ...) works on a declared trie.
      id: TrieProgramEngine.nodeId(name, ''),
      type: 'sphere',
      originalType: 'TRIE_NODE',
      logicalParent: name,
      value: '',
      prefix: '',
      label: '',
      tags: [],
      fields: {},
      state: 'NEUTRAL',
      isEndOfWord: false,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: TrieEngine.NODE_COLOR,
      emissiveColor: TrieEngine.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(rootEl);
    this.log(context, 'TRIE_INIT', `Created trie "${name}".`, 'operation');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIE_INSERT / TRIE_SEARCH / TRIE_STARTSWITH / TRIE_DELETE / TRIE_AUTOCOMPLETE
  // ─────────────────────────────────────────────────────────────────────────

  private trieInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = this.wordArg(instruction, 1);

    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_INSERT requires a trie name and a non-empty word.', 'warning');
      return;
    }
    if (!this.getRoot(context, name)) {
      this.trieInit(context, { ...instruction, args: [name] } as any);
    }

    this.log(context, 'TRIE_INSERT', `Inserting "${word}"...`, 'operation');
    const trie = this.rehydrate(context, name);
    trie.insert(word);
    const alreadyEndOfWord = trie.steps.some((step) => step.type === 'MARK_END' && step.already);
    this.replaySteps(context, name, trie.steps);

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

  private trieSearch(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = this.wordArg(instruction, 1);
    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_SEARCH requires a trie name and a word.', 'warning');
      return;
    }

    const trie = this.rehydrate(context, name);
    const found = trie.search(word);
    this.replaySteps(context, name, trie.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_SEARCH', found ? `"${word}" found.` : `"${word}" not found.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  private trieStartsWith(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const prefix = this.wordArg(instruction, 1);
    if (!name || prefix === undefined) {
      this.log(context, 'ERROR', 'TRIE_STARTSWITH requires a trie name and a prefix.', 'warning');
      return;
    }

    const trie = this.rehydrate(context, name);
    trie.startsWith(prefix);
    // The prefix exists when its whole path does (the empty prefix is the root itself).
    const exists = trie.steps.some((step) => step.type === 'RESULT');
    this.replaySteps(context, name, trie.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_STARTSWITH', exists ? `Prefix "${prefix}" exists.` : `Prefix "${prefix}" does not exist.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  private trieDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const word = this.wordArg(instruction, 1);
    if (!name || !word) {
      this.log(context, 'ERROR', 'TRIE_DELETE requires a trie name and a word.', 'warning');
      return;
    }

    const trie = this.rehydrate(context, name);
    const existed = trie.delete(word);
    this.replaySteps(context, name, trie.steps);
    if (existed) {
      context.scheduler.enqueue({ targets: {}, duration: 1 });
      context.scheduler.commitGroup(true);
    }

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

  private trieAutocomplete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const prefix = instruction.args?.[1] !== undefined ? String(instruction.args[1]) : '';
    if (!name) {
      this.log(context, 'ERROR', 'TRIE_AUTOCOMPLETE requires a trie name.', 'warning');
      return;
    }

    const trie = this.rehydrate(context, name);
    const matches = trie.autocomplete(prefix);

    this.log(context, 'TRIE_AUTOCOMPLETE', `Autocomplete "${prefix}"...`, 'operation');
    this.replaySteps(context, name, trie.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'TRIE_AUTOCOMPLETE', matches.length > 0 ? `Matches: ${matches.join(', ')}` : `No words start with "${prefix}".`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Replay
  // ─────────────────────────────────────────────────────────────────────────

  /** Turns the steps a pure Trie recorded into scheduler animation and scene changes on the trie `name`. */
  replaySteps(context: AlgorithmContext, name: string, steps: TrieStep[]): void {
    // Nothing to show on a trie that has no root in the scene.
    if (!this.getRoot(context, name)) return;
    const restColor = (node: any) => (node.isEndOfWord ? TrieEngine.WORD_END_COLOR : TrieEngine.NODE_COLOR);

    for (const step of steps) {
      switch (step.type) {
        case 'PASS': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const traversingToken = getSemanticColorToken('TRAVERSING');
          context.scheduler.enqueue({ targets: node, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
          context.scheduler.enqueue({ targets: node.scale, x: 1.15, y: 1.15, z: 1.15, duration: 200 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(200);
          context.scheduler.enqueue({ targets: node, color: restColor(node), emissiveIntensity: 0, duration: 180 });
          context.scheduler.enqueue({ targets: node.scale, x: 1, y: 1, z: 1, duration: 180 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'CREATE': {
          const parent = this.findByLabel(context, name, step.parent);
          if (parent) this.spawnChild(context, name, parent, step.char, step.prefix);
          break;
        }
        case 'MARK_END': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          node.isEndOfWord = true;
          node.color = TrieEngine.WORD_END_COLOR;
          const successToken = getSemanticColorToken('SUCCESS');
          context.scheduler.enqueue({ targets: node, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
          context.scheduler.enqueue({ targets: node.scale, x: 1.25, y: 1.25, z: 1.25, duration: 350 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(350);
          context.scheduler.enqueue({ targets: node, color: TrieEngine.WORD_END_COLOR, emissiveIntensity: 0, duration: 250 });
          context.scheduler.enqueue({ targets: node.scale, x: 1, y: 1, z: 1, duration: 250 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'HOP': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const traversingToken = getSemanticColorToken('TRAVERSING');
          AnticipationAnimation.applyAnticipation(context.scheduler, [node], 'TRAVERSAL');
          context.scheduler.enqueue({ targets: node, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 220 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(220);
          context.scheduler.enqueue({ targets: node, color: restColor(node), emissiveIntensity: 0, duration: 180 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'BREAK': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const missToken = getSemanticColorToken('DISCARDED');
          context.scheduler.enqueue({ targets: node, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(300);
          context.scheduler.enqueue({ targets: node, color: restColor(node), emissiveIntensity: 0, duration: 250 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'RESULT': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const finalToken = getSemanticColorToken(step.found ? 'SUCCESS' : 'DISCARDED');
          context.scheduler.enqueue({ targets: node, color: finalToken.color, emissiveColor: finalToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(350);
          context.scheduler.enqueue({ targets: node, color: restColor(node), emissiveIntensity: 0, duration: 250 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'REJECT': {
          const root = this.getRoot(context, name);
          const missToken = getSemanticColorToken('DISCARDED');
          context.scheduler.enqueue({ targets: root, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.7, duration: 250 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(250);
          context.scheduler.enqueue({ targets: root, color: TrieEngine.NODE_COLOR, emissiveIntensity: 0, duration: 200 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'UNMARK': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const discardedToken = getSemanticColorToken('DISCARDED');
          context.scheduler.enqueue({ targets: node, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(300);
          node.isEndOfWord = false;
          node.color = TrieEngine.NODE_COLOR;
          break;
        }
        case 'PRUNE': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const incomingEdge = this.getEdges(context, name).find((e: any) => e.targetId === node.id);
          context.scheduler.enqueue({ targets: node.scale, x: 0, y: 0, z: 0, duration: 250 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(250);
          context.sceneManager.removeElement(node.id);
          if (incomingEdge) {
            context.sceneManager.removeElement(incomingEdge.id);
            context.relationshipManager?.removeRelationship(incomingEdge.id);
          }
          break;
        }
        case 'PREFIX': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          const traversingToken = getSemanticColorToken('TRAVERSING');
          context.scheduler.enqueue({ targets: node, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
          context.scheduler.enqueue({ targets: node.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(300);
          break;
        }
        case 'MATCH': {
          const node = this.findByLabel(context, name, step.word);
          if (!node) break;
          const successToken = getSemanticColorToken('SUCCESS');
          context.scheduler.enqueue({ targets: node, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 220 });
          context.scheduler.enqueue({ targets: node.scale, x: 1.2, y: 1.2, z: 1.2, duration: 220 });
          context.scheduler.commitGroup(true);
          context.scheduler.advanceCursor(220);
          context.scheduler.enqueue({ targets: node, color: TrieEngine.WORD_END_COLOR, emissiveIntensity: 0, duration: 180 });
          context.scheduler.enqueue({ targets: node.scale, x: 1, y: 1, z: 1, duration: 180 });
          context.scheduler.commitGroup(true);
          break;
        }
        case 'RELEASE': {
          const node = this.findByLabel(context, name, step.prefix);
          if (!node) break;
          context.scheduler.enqueue({ targets: node.scale, x: 1, y: 1, z: 1, duration: 200 });
          context.scheduler.enqueue({ targets: node, color: restColor(node), emissiveIntensity: 0, duration: 200 });
          context.scheduler.commitGroup(true);
          break;
        }
      }
    }
  }

  /** CREATE: the new node and the edge from its parent appear, and the node drops into its laid-out place. */
  private spawnChild(context: AlgorithmContext, name: string, parent: any, char: string, label: string): any {
    const nodeEl: any = {
      id: TrieProgramEngine.nodeId(name, label),
      type: 'sphere',
      originalType: 'TRIE_NODE',
      logicalParent: name,
      value: char,
      prefix: label,
      label,
      tags: [],
      fields: {},
      state: 'NEUTRAL',
      isEndOfWord: false,
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: TrieEngine.NODE_COLOR,
      emissiveColor: TrieEngine.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(nodeEl);

    const edgeEl: any = {
      id: TrieProgramEngine.edgeId(name, label),
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
    context.scheduler.enqueue({ targets: nodeEl, color: TrieEngine.NODE_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
    // Ends full size at its place even when the tweens are skipped (headless runs, jumping ahead).
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        nodeEl.scale = { x: 1, y: 1, z: 1 };
        if (nodeEl.worldTarget) nodeEl.position = { ...nodeEl.worldTarget };
      }
    });
    context.scheduler.commitGroup(true);

    return nodeEl;
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

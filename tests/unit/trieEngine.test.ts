/**
 * Unit tests for the trie's recorded steps and their replay:
 * - Trie (packages/runtime/src/data-structures/Trie.ts) records what
 *   insert / search / startsWith / delete / autocomplete did, naming nodes
 *   by prefix;
 * - TrieEngine (packages/runtime/src/core/algorithms/TrieEngine.ts)
 *   rehydrates a Trie from the scene's TRIE_NODE elements and replays those
 *   steps. Exercised directly against real SceneManager/LayoutManager/
 *   EventDispatcher/RelationshipManager instances plus a synchronous fake
 *   AnimationScheduler.
 */
import { describe, expect, it } from 'vitest';
import { Trie, TRIE_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/Trie';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { TrieEngine } from '../../packages/runtime/src/core/algorithms/TrieEngine';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

function trieOf(words: string[]): Trie {
  const trie = new Trie();
  words.forEach((w) => trie.insert(w));
  return trie;
}

describe('Trie steps', () => {
  it('insert records PASS for existing nodes, CREATE for new ones, then MARK_END', () => {
    const trie = trieOf(['ca']);
    trie.insert('cat');
    expect(trie.steps).toEqual([
      { type: 'PASS', prefix: 'c' },
      { type: 'PASS', prefix: 'ca' },
      { type: 'CREATE', prefix: 'cat', parent: 'ca', char: 't' },
      { type: 'MARK_END', prefix: 'cat', already: false },
    ]);
    trie.insert('ca');
    expect(trie.steps.at(-1)).toEqual({ type: 'MARK_END', prefix: 'ca', already: true });
  });

  it('search hops down and ends with RESULT, or BREAK where the path stops', () => {
    const trie = trieOf(['cat']);
    expect(trie.search('ca')).toBe(false);
    expect(trie.steps).toEqual([
      { type: 'HOP', prefix: 'c' },
      { type: 'HOP', prefix: 'ca' },
      { type: 'RESULT', prefix: 'ca', found: false },
    ]);
    expect(trie.search('cow')).toBe(false);
    expect(trie.steps).toEqual([{ type: 'HOP', prefix: 'c' }, { type: 'BREAK', prefix: 'c' }]);
    expect(trie.startsWith('ca')).toBe(true);
    expect(trie.steps.at(-1)).toEqual({ type: 'RESULT', prefix: 'ca', found: true });
  });

  it('delete unmarks the word and prunes the nodes left with no use', () => {
    const trie = trieOf(['car', 'cart']);
    expect(trie.delete('cart')).toBe(true);
    expect(trie.steps).toEqual([{ type: 'UNMARK', prefix: 'cart' }, { type: 'PRUNE', prefix: 'cart' }]);
    expect(trie.delete('ca')).toBe(false);
    expect(trie.steps).toEqual([]);
    expect(trie.delete('dog')).toBe(false);
    expect(trie.steps).toEqual([{ type: 'REJECT' }]);
  });

  it('autocomplete records the prefix, each match in order, and the release', () => {
    const trie = trieOf(['cat', 'car', 'dog']);
    expect(trie.autocomplete('ca')).toEqual(['car', 'cat']);
    expect(trie.steps).toEqual([
      { type: 'PREFIX', prefix: 'ca' },
      { type: 'MATCH', word: 'car' },
      { type: 'MATCH', word: 'cat' },
      { type: 'RELEASE', prefix: 'ca' },
    ]);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(TRIE_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(TRIE_STEP_PRIMITIVES.CREATE).toEqual({ kind: 'MUTATE', verb: 'create' });
    expect(TRIE_STEP_PRIMITIVES.PRUNE).toEqual({ kind: 'MUTATE', verb: 'destroy' });
  });
});

/** Runs every queued task's `complete` callback synchronously. */
function makeFakeScheduler() {
  let tasks: any[] = [];
  let time = 0;
  return {
    enqueue(task: any) { tasks.push(task); },
    commitGroup() {
      const current = tasks;
      tasks = [];
      current.forEach((t) => t.complete?.());
    },
    commitSequential() {
      const current = tasks;
      tasks = [];
      current.forEach((t) => t.complete?.());
    },
    advanceCursor(ms: number) { time += ms; },
    getCurrentTime() { return time; },
  } as any;
}

function makeContext() {
  const eventDispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(eventDispatcher);
  const relationshipManager = new RelationshipManager(eventDispatcher);
  const layoutManager = new LayoutManager(sceneManager, relationshipManager);
  const context: AlgorithmContext = {
    scheduler: makeFakeScheduler(),
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager: new StateManager(),
    relationshipManager,
    defaultColor: '#ffffff',
  };
  const logs: any[] = [];
  eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));
  return { context, sceneManager, logs };
}

const gen = (actionName: string, args: any[]): any => ({ action: 'GENERIC_ACTION', actionName, args });
const prefixes = (sceneManager: SceneManager) =>
  sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 't' && el.originalType === 'TRIE_NODE').map((el: any) => el.prefix).sort();

describe('TrieEngine', () => {
  it('replays inserts as one node per prefix, word ends marked', () => {
    const { context, sceneManager } = makeContext();
    const engine = new TrieEngine();
    ['car', 'cat'].forEach((w) => engine.execute(context, gen('TRIE_INSERT', ['t', w])));
    expect(prefixes(sceneManager)).toEqual(['', 'c', 'ca', 'car', 'cat']);
    const ends = sceneManager.getSceneGraph().filter((el: any) => el.originalType === 'TRIE_NODE' && el.isEndOfWord).map((el: any) => el.prefix);
    expect(ends.sort()).toEqual(['car', 'cat']);
  });

  it('replays a delete by pruning the scene nodes', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new TrieEngine();
    ['car', 'cart'].forEach((w) => engine.execute(context, gen('TRIE_INSERT', ['t', w])));
    engine.execute(context, gen('TRIE_DELETE', ['t', 'cart']));
    expect(prefixes(sceneManager)).toEqual(['', 'c', 'ca', 'car']);
    expect(logs.at(-1).message).toBe('Deleted "cart".');
  });

  it('search and autocomplete report what the pure trie found', () => {
    const { context, logs } = makeContext();
    const engine = new TrieEngine();
    ['car', 'cat', 'dog'].forEach((w) => engine.execute(context, gen('TRIE_INSERT', ['t', w])));
    engine.execute(context, gen('TRIE_SEARCH', ['t', 'ca']));
    expect(logs.at(-1).message).toBe('"ca" not found.');
    engine.execute(context, gen('TRIE_AUTOCOMPLETE', ['t', 'ca']));
    expect(logs.at(-1).message).toBe('Matches: car, cat');
  });
});

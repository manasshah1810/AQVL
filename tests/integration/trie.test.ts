/**
 * Integration tests for TRIE / TRIE_INSERT / TRIE_SEARCH / TRIE_DELETE /
 * TRIE_AUTOCOMPLETE: source -> lex -> parse -> validate -> optimize -> AQIR,
 * and (separately) TrieVisualizer executing those GENERIC_ACTION
 * instructions against a real SceneManager/LayoutManager, animating real
 * path/insert/search/delete/autocomplete behavior.
 *
 * Like heap.test.ts and hashmap.test.ts, full AnimationController execution
 * (a real anime.js timeline) is out of scope; TrieVisualizer mutates scene
 * state synchronously and only defers logging into `complete` callbacks, so
 * a lightweight scheduler stub that runs those callbacks immediately is
 * enough to observe every frame it schedules.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { TrieVisualizer } from '../../packages/runtime/src/core/algorithms/TrieVisualizer';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function genericActions(instructions: unknown[]): any[] {
  return (instructions as any[]).filter((i) => i.action === 'GENERIC_ACTION');
}

function trieSource(name: string, words: string[], ops: string[]): string {
  const literal = words.map((w) => `"${w}"`).join(', ');
  return `SCENE TrieDemo
DECLARE
  TRIE ${name} = [${literal}]

SEQUENCE
  ${ops.join('\n  ')}
END
`;
}

// Same stub-scheduler pattern as heap.test.ts/hashmap.test.ts: TrieVisualizer
// mutates scene state synchronously; `complete` callbacks (logging) run immediately.
function makeStubScheduler() {
  const frames: any[] = [];
  let pending: any[] = [];

  function flush() {
    const batch = pending;
    pending = [];
    frames.push(...batch);
    batch.forEach((t) => t.complete && t.complete());
  }

  return {
    frames,
    scheduler: {
      enqueue(task: any) {
        pending.push(task);
      },
      commitGroup(_advance = true) {
        flush();
      },
      commitSequential() {
        flush();
      },
      advanceCursor(_ms: number) {},
      getCurrentTime() {
        return 0;
      },
    } as any,
  };
}

function makeContext(sceneManager: SceneManager, layoutManager: LayoutManager, relationshipManager: RelationshipManager, eventDispatcher: EventDispatcher, scheduler: any): AlgorithmContext {
  return {
    scheduler,
    sceneManager,
    layoutManager,
    eventDispatcher,
    relationshipManager,
    defaultColor: '#ffffff',
  };
}

function setup() {
  const eventDispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(eventDispatcher);
  const relationshipManager = new RelationshipManager(eventDispatcher);
  const layoutManager = new LayoutManager(sceneManager, relationshipManager);
  const { scheduler, frames } = makeStubScheduler();
  const context = makeContext(sceneManager, layoutManager, relationshipManager, eventDispatcher, scheduler);
  return { sceneManager, context, frames };
}

function wordEndLabels(sceneManager: SceneManager, name: string): string[] {
  return sceneManager
    .getSceneGraph()
    .filter((el: any) => el.logicalParent === name && el.originalType === 'TRIE_NODE' && el.isEndOfWord)
    .map((el: any) => el.label)
    .sort();
}

describe('Trie built-ins: parsing to GENERIC_ACTION', () => {
  it('parses TRIE name = ["cat", "car"] into TRIE_INIT + one TRIE_INSERT per word', () => {
    const instructions = compile(trieSource('t', ['cat', 'car'], []));
    const actions = genericActions(instructions);
    expect(actions.map((a) => a.actionName)).toEqual(['TRIE_INIT', 'TRIE_INSERT', 'TRIE_INSERT']);
    expect(actions[0]).toMatchObject({ actionName: 'TRIE_INIT', args: ['t'] });
    expect(actions[1]).toMatchObject({ actionName: 'TRIE_INSERT', args: ['t', 'cat'] });
    expect(actions[2]).toMatchObject({ actionName: 'TRIE_INSERT', args: ['t', 'car'] });
  });

  it('parses TRIE_SEARCH as a GENERIC_ACTION targeting the trie and word', () => {
    const instructions = compile(trieSource('t', ['cat'], ['TRIE_SEARCH t cat']));
    const actions = genericActions(instructions);
    expect(actions[actions.length - 1]).toMatchObject({ actionName: 'TRIE_SEARCH', args: ['t', 'cat'] });
  });

  it('parses TRIE_AUTOCOMPLETE as a GENERIC_ACTION targeting the trie and prefix', () => {
    const instructions = compile(trieSource('t', ['cat', 'car'], ['TRIE_AUTOCOMPLETE t ca']));
    const actions = genericActions(instructions);
    expect(actions[actions.length - 1]).toMatchObject({ actionName: 'TRIE_AUTOCOMPLETE', args: ['t', 'ca'] });
  });

  it('parses TRIE_DELETE and TRIE_STARTSWITH runtime ops in sequence', () => {
    const instructions = compile(trieSource('t', ['cat'], ['TRIE_DELETE t cat', 'TRIE_STARTSWITH t ca']));
    const actionNames = genericActions(instructions).map((a) => a.actionName);
    expect(actionNames).toEqual(['TRIE_INIT', 'TRIE_INSERT', 'TRIE_DELETE', 'TRIE_STARTSWITH']);
  });

  it('parses a TRIE declared with no initial words', () => {
    const instructions = compile(trieSource('empty', [], ['TRIE_INSERT empty hello']));
    const actionNames = genericActions(instructions).map((a) => a.actionName);
    expect(actionNames).toEqual(['TRIE_INIT', 'TRIE_INSERT']);
  });
});

describe('TrieVisualizer: executing trie operations against a live scene', () => {
  it('TRIE_INSERT builds a real char-by-char path and marks the final node as a word end', () => {
    const { sceneManager, context, frames } = setup();
    const engine = new TrieVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', 'cat'] } as any);

    const nodes = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 't' && el.originalType === 'TRIE_NODE');
    // root + c + ca + cat = 4 nodes
    expect(nodes).toHaveLength(4);
    expect(wordEndLabels(sceneManager, 't')).toEqual(['cat']);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('inserting words that share a prefix reuses the shared path nodes', () => {
    const { sceneManager, context } = setup();
    const engine = new TrieVisualizer();
    ['cat', 'car', 'card'].forEach((w) => {
      engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', w] } as any);
    });

    // root, c, ca, cat, car, card = 6 nodes total (ca is shared between cat/car/card, car shared between car/card)
    const nodes = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 't' && el.originalType === 'TRIE_NODE');
    expect(nodes).toHaveLength(6);
    expect(wordEndLabels(sceneManager, 't')).toEqual(['car', 'card', 'cat']);
  });

  it('TRIE_SEARCH finds an inserted word and correctly rejects a non-word prefix', () => {
    const { context } = setup();
    const engine = new TrieVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', 'car'] } as any);

    const logs: string[] = [];
    context.eventDispatcher.on('RUNTIME_LOG', (payload: any) => logs.push(payload.message));

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_SEARCH', args: ['t', 'car'] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_SEARCH', args: ['t', 'ca'] } as any);

    expect(logs.some((m) => m === '"car" found.')).toBe(true);
    expect(logs.some((m) => m === '"ca" not found.')).toBe(true);
  });

  it('TRIE_AUTOCOMPLETE returns every matching word for a shared prefix', () => {
    const { context } = setup();
    const engine = new TrieVisualizer();
    ['cat', 'car', 'card', 'care'].forEach((w) => {
      engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', w] } as any);
    });

    const logs: string[] = [];
    context.eventDispatcher.on('RUNTIME_LOG', (payload: any) => logs.push(payload.message));
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_AUTOCOMPLETE', args: ['t', 'ca'] } as any);

    expect(logs.some((m) => m === 'Matches: car, card, care, cat')).toBe(true);
  });

  it('TRIE_DELETE removes a word and prunes now-unused nodes, leaving sibling words intact', () => {
    const { sceneManager, context } = setup();
    const engine = new TrieVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', 'cat'] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', 'car'] } as any);

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_DELETE', args: ['t', 'cat'] } as any);

    expect(wordEndLabels(sceneManager, 't')).toEqual(['car']);
    const nodes = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 't' && el.originalType === 'TRIE_NODE');
    // root, c, ca, car survive; "cat" node is pruned since it has no children and is no longer a word end.
    expect(nodes.map((n: any) => n.label).sort()).toEqual(['', 'c', 'ca', 'car']);
  });

  it('a realistic end-to-end sequence (insert x4, delete, autocomplete, search) stays consistent', () => {
    const { sceneManager, context } = setup();
    const engine = new TrieVisualizer();
    ['apple', 'app', 'apply', 'banana'].forEach((w) => {
      engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_INSERT', args: ['t', w] } as any);
    });

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_DELETE', args: ['t', 'app'] } as any);

    const logs: string[] = [];
    context.eventDispatcher.on('RUNTIME_LOG', (payload: any) => logs.push(payload.message));
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_AUTOCOMPLETE', args: ['t', 'app'] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'TRIE_SEARCH', args: ['t', 'app'] } as any);

    expect(logs.some((m) => m === 'Matches: apple, apply')).toBe(true);
    expect(logs.some((m) => m === '"app" not found.')).toBe(true);
    expect(wordEndLabels(sceneManager, 't')).toEqual(['apple', 'apply', 'banana']);
  });
});

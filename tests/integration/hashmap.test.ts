/**
 * Integration tests for HASH_MAP / HASHMAP_INSERT / HASHMAP_LOOKUP /
 * HASHMAP_DELETE: source -> lex -> parse -> validate -> optimize -> AQIR,
 * and (separately) HashMapVisualizer executing those GENERIC_ACTION
 * instructions against a real SceneManager/LayoutManager, replaying real
 * hash/collision/resize behavior as animation frames.
 *
 * Like sorting.test.ts and heap.test.ts, full AnimationController execution
 * (a real anime.js timeline) is out of scope; HashMapVisualizer mutates
 * scene state synchronously and only defers logging into `complete`
 * callbacks, so a lightweight scheduler stub that runs those callbacks
 * immediately is enough to observe every frame it schedules.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { HashMap } from '../../packages/runtime/src/data-structures/HashMap';
import { HashMapVisualizer } from '../../packages/runtime/src/core/algorithms/HashMapVisualizer';
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

function hashMapSource(name: string, entries: [string, string | number][], ops: string[]): string {
  const literal = entries.map(([k, v]) => `${k}:${v}`).join(', ');
  return `SCENE HashMapDemo
DECLARE
  HASH_MAP ${name} = {${literal}}

SEQUENCE
  ${ops.join('\n  ')}
END
`;
}

// Same stub-scheduler pattern as heap.test.ts: HashMapVisualizer mutates
// scene state synchronously; `complete` callbacks (logging) run immediately.
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

function entriesOf(sceneManager: SceneManager, name: string): { key: string; value: any }[] {
  return sceneManager
    .getSceneGraph()
    .filter((el: any) => el.logicalParent === name && el.originalType === 'HASHMAP_ENTRY')
    .map((el: any) => ({ key: el.key, value: el.value }));
}

function bucketCount(sceneManager: SceneManager, name: string): number {
  return sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === name && el.originalType === 'HASHMAP_BUCKET').length;
}

describe('HashMap built-ins: parsing to GENERIC_ACTION', () => {
  it('parses HASH_MAP name = {k1:v1, k2:v2} into HASHMAP_INIT + one HASHMAP_INSERT per entry', () => {
    const instructions = compile(hashMapSource('h', [['k1', 'v1'], ['k2', 'v2']], []));
    const actions = genericActions(instructions);
    expect(actions.map((a) => a.actionName)).toEqual(['HASHMAP_INIT', 'HASHMAP_INSERT', 'HASHMAP_INSERT']);
    expect(actions[0]).toMatchObject({ actionName: 'HASHMAP_INIT', args: ['h'] });
    expect(actions[1]).toMatchObject({ actionName: 'HASHMAP_INSERT', args: ['h', 'k1', 'v1'] });
    expect(actions[2]).toMatchObject({ actionName: 'HASHMAP_INSERT', args: ['h', 'k2', 'v2'] });
  });

  it('parses a HASH_MAP with numeric values', () => {
    const instructions = compile(hashMapSource('scores', [['alice', 90], ['bob', 85]], []));
    const actions = genericActions(instructions);
    expect(actions[1]).toMatchObject({ args: ['scores', 'alice', 90] });
    expect(actions[2]).toMatchObject({ args: ['scores', 'bob', 85] });
  });

  it('parses HASHMAP_LOOKUP and HASHMAP_DELETE runtime ops in SEQUENCE', () => {
    const instructions = compile(hashMapSource('h', [['k1', 'v1']], ['HASHMAP_LOOKUP h k1', 'HASHMAP_DELETE h k1']));
    const actions = genericActions(instructions).map((a) => a.actionName);
    expect(actions).toEqual(['HASHMAP_INIT', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE']);
  });

  it('parses a HASH_MAP declared with no initial entries', () => {
    const instructions = compile(hashMapSource('empty', [], ['HASHMAP_INSERT empty a 1']));
    const actions = genericActions(instructions).map((a) => a.actionName);
    expect(actions).toEqual(['HASHMAP_INIT', 'HASHMAP_INSERT']);
  });

  it('parses HASHMAP_INSERT with a quoted string key and numeric value', () => {
    const instructions = compile(hashMapSource('h', [], ['HASHMAP_INSERT h "first name" 42']));
    const actions = genericActions(instructions);
    expect(actions[1]).toMatchObject({ actionName: 'HASHMAP_INSERT', args: ['h', 'first name', 42] });
  });
});

describe('HashMapVisualizer: executing hash map operations against a live scene', () => {
  it('HASHMAP_INIT creates the default bucket row', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INIT', args: ['h'] } as any);
    expect(bucketCount(sceneManager, 'h')).toBe(HashMap.DEFAULT_CAPACITY);
  });

  it('HASHMAP_INSERT stores a new key/value and auto-initializes buckets if needed', () => {
    const { sceneManager, context, frames } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 1] } as any);

    expect(bucketCount(sceneManager, 'h')).toBe(HashMap.DEFAULT_CAPACITY);
    expect(entriesOf(sceneManager, 'h')).toEqual([{ key: 'a', value: 1 }]);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('HASHMAP_INSERT on an existing key updates the value instead of duplicating the entry', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 1] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 99] } as any);

    const entries = entriesOf(sceneManager, 'h');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ key: 'a', value: 99 });
  });

  it('collisions: two keys hashing to the same bucket both end up stored', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INIT', args: ['h'] } as any);

    // Find two keys that collide under HashMap's string-sum hash at the default capacity.
    const probe = new HashMap<string, number>(HashMap.DEFAULT_CAPACITY);
    const k1 = 'a';
    let k2: string | undefined;
    for (let i = 0; i < 200; i++) {
      const candidate = String.fromCharCode(98 + i);
      if (probe.hash(candidate) === probe.hash(k1)) { k2 = candidate; break; }
    }
    expect(k2).toBeDefined();

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', k1, 1] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', k2!, 2] } as any);

    const entries = entriesOf(sceneManager, 'h');
    expect(entries.map((e) => e.key).sort()).toEqual([k1, k2].sort());
    expect(entries.find((e) => e.key === k1)?.value).toBe(1);
    expect(entries.find((e) => e.key === k2)?.value).toBe(2);
  });

  it('resize: inserting past a load factor of 0.75 doubles the bucket count and preserves every entry', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INIT', args: ['h'] } as any); // capacity 8

    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // 7th insert -> 7/8 > 0.75 -> resize to 16
    keys.forEach((k, i) => {
      engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', k, i] } as any);
    });

    expect(bucketCount(sceneManager, 'h')).toBe(HashMap.DEFAULT_CAPACITY * 2);
    const entries = entriesOf(sceneManager, 'h');
    expect(entries).toHaveLength(keys.length);
    keys.forEach((k, i) => {
      expect(entries.find((e) => e.key === k)?.value).toBe(i);
    });
  });

  it('HASHMAP_LOOKUP finds an existing key and reports a miss for a nonexistent one', () => {
    const { context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 1] } as any);

    const logs: string[] = [];
    context.eventDispatcher.on('RUNTIME_LOG', (payload: any) => logs.push(payload.message));

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_LOOKUP', args: ['h', 'a'] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_LOOKUP', args: ['h', 'missing'] } as any);

    expect(logs.some((m) => m.includes('Found "a" -> 1'))).toBe(true);
    expect(logs.some((m) => m.includes('"missing" not found'))).toBe(true);
  });

  it('HASHMAP_DELETE removes an existing key and leaves a nonexistent key a no-op', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 1] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'b', 2] } as any);

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_DELETE', args: ['h', 'a'] } as any);
    let entries = entriesOf(sceneManager, 'h');
    expect(entries).toEqual([{ key: 'b', value: 2 }]);

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_DELETE', args: ['h', 'nonexistent'] } as any);
    entries = entriesOf(sceneManager, 'h');
    expect(entries).toEqual([{ key: 'b', value: 2 }]);
  });

  it('a realistic sequence (insert x3, delete, insert past resize, lookup) leaves a fully consistent scene', () => {
    const { sceneManager, context } = setup();
    const engine = new HashMapVisualizer();

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'a', 1] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'b', 2] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', 'c', 3] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_DELETE', args: ['h', 'b'] } as any);
    ['d', 'e', 'f', 'g'].forEach((k, i) => {
      engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INSERT', args: ['h', k, i + 10] } as any);
    });

    const expected: Record<string, number> = { a: 1, c: 3, d: 10, e: 11, f: 12, g: 13 };
    const entries = entriesOf(sceneManager, 'h');
    expect(entries).toHaveLength(Object.keys(expected).length);
    entries.forEach(({ key, value }) => expect(value).toBe(expected[key]));
  });
});

describe('HashMap performance shape: average-case operations stay well under O(n)', () => {
  it('get/set on a large map never has to scan a bucket anywhere close to full size', () => {
    const map = new HashMap<string, number>();
    const n = 5000;
    for (let i = 0; i < n; i++) map.set(`k${i}`, i);

    const maxChain = Math.max(...map.table.map((b) => b.length));
    expect(maxChain).toBeLessThan(n / 10);
    expect(map.get('k4999')).toBe(4999);
  });
});

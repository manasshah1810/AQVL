/**
 * The Playground's Linked List examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly).
 *
 * Every example must do its work with real pointer code — loops and IFs
 * over `curr.next`-style pointers, not a scripted sequence of highlights —
 * so these tests assert each one's final lists and console output, that no
 * node is left behind in heap memory, and that the source really loops.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { LinkedListScripts } from '../../packages/demo/src/examples/LinkedListLibrary';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface RunResult {
  engine: ExecutionEngine;
  logs: string[];
  lists: Record<string, unknown[]>;
}

function readLists(engine: ExecutionEngine): Record<string, unknown[]> {
  const scene = engine.sceneManager.getSceneGraph() as any[];
  const get = (id: string) => engine.sceneManager.getElement(id) as any;
  const out: Record<string, unknown[]> = {};
  for (const anchor of scene.filter((e) => e.originalType === 'LINKEDLIST')) {
    const values: unknown[] = [];
    const seen = new Set<string>();
    let id: string | null = anchor.headId;
    while (id && !seen.has(id)) {
      seen.add(id);
      values.push(get(id).value);
      id = get(`${id}>next`)?.targetId ?? null;
    }
    out[anchor.logicalParent] = values;
  }
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { engine, logs, lists: readLists(engine) };
}

const printed = (logs: string[]) =>
  logs.filter((l) => !l.includes('⟹') && !/^(FREE |Memory of|Comparing|Visiting|Marked)/.test(l));

describe('Linked List examples produce correct results', () => {
  it('Singly Linked List: traverse, insert at head/tail, delete a middle node and the head', async () => {
    const { lists, logs } = await run(LinkedListScripts.SinglyLinkedList);
    expect(lists.list).toEqual([20, 40, 50, 60]);
    expect(printed(logs)).toEqual(
      expect.arrayContaining(['Visit 10', 'Visit 20', 'Visit 30', 'Visit 40', 'List: 10 -> 20 -> 40 -> 50 -> NULL', 'List: 20 -> 40 -> 50 -> 60 -> NULL'])
    );
    // 4 moves while traversing + 4 while walking to the tail (the built-in INSERT_TAIL logs its own walk).
    expect(logs.filter((l) => /^curr = curr\.next\s+⟹\s+curr /.test(l))).toHaveLength(8);
  });

  it('Doubly Linked List: forward and backward traversal by following pointers, insert and delete in the middle', async () => {
    const { lists, logs } = await run(LinkedListScripts.DoublyLinkedList);
    expect(lists.list).toEqual([10, 20, 25, 40]);
    expect(logs.filter((l) => l.startsWith('Forward:'))).toEqual(['Forward: 10', 'Forward: 20', 'Forward: 30', 'Forward: 40']);
    expect(logs.filter((l) => l.startsWith('Backward:'))).toEqual(['Backward: 40', 'Backward: 30', 'Backward: 20', 'Backward: 10']);
    expect(logs).toContain('List: 10 -> 20 -> 25 -> 40 -> NULL');
  });

  it('Circular Linked List: one lap, append, delete head — the tail still wraps to the head', async () => {
    const { lists, logs } = await run(LinkedListScripts.CircularLinkedList);
    expect(lists.list).toEqual([20, 30, 40, 50]);
    expect(logs.filter((l) => l.startsWith('Visit'))).toEqual(['Visit 10', 'Visit 20', 'Visit 30', 'Visit 40']);
    expect(logs).toContain('List: 20 -> 30 -> 40 -> 50 -> back to 20');
  });

  it('Reverse a Singly Linked List', async () => {
    const { lists, logs } = await run(LinkedListScripts.ReverseSinglyLinkedList);
    expect(lists.list).toEqual([5, 4, 3, 2, 1]);
    expect(logs).toContain('Reversed: 5 -> 4 -> 3 -> 2 -> 1 -> NULL');
  });

  it('Reverse a Doubly Linked List: both directions are reversed', async () => {
    const { lists, logs } = await run(LinkedListScripts.ReverseDoublyLinkedList);
    expect(lists.list).toEqual([5, 4, 3, 2, 1]);
    expect(logs.filter((l) => l.startsWith('Forward:'))).toEqual(['Forward: 5', 'Forward: 4', 'Forward: 3', 'Forward: 2', 'Forward: 1']);
    expect(logs.filter((l) => l.startsWith('Backward:'))).toEqual(['Backward: 1', 'Backward: 2', 'Backward: 3', 'Backward: 4', 'Backward: 5']);
  });

  it('Reverse a Circular Linked List: still circular (no NULL) afterwards', async () => {
    const { lists, logs } = await run(LinkedListScripts.ReverseCircularLinkedList);
    expect(lists.list).toEqual([5, 4, 3, 2, 1]);
    expect(logs).toContain('Reversed: 5 -> 4 -> 3 -> 2 -> 1 -> back to 5');
  });

  it('Find the Middle Node', async () => {
    const { logs } = await run(LinkedListScripts.FindMiddleNode);
    expect(logs).toContain('Middle node: 40');
  });

  it("Detect & Remove a Cycle (Floyd): meeting point, cycle start, then the cycle is broken", async () => {
    const { lists, logs } = await run(LinkedListScripts.DetectCycleFloyd);
    expect(logs).toContain('Cycle detected: slow and fast meet at 5');
    expect(logs).toContain('The cycle starts at 3');
    expect(logs).toContain('Cycle removed: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> NULL');
    expect(lists.list).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Merge Two Sorted Lists', async () => {
    const { lists, logs } = await run(LinkedListScripts.MergeTwoSortedLists);
    expect(lists.merged).toEqual([1, 2, 3, 4, 7, 8, 9]);
    expect(lists.listA).toEqual([1, 4, 7, 9]);
    expect(lists.listB).toEqual([2, 3, 8]);
    expect(logs).toContain('Merged: 1 -> 2 -> 3 -> 4 -> 7 -> 8 -> 9 -> NULL');
  });

  it('Remove Nth Node From End actually removes (and frees) the node', async () => {
    const { lists, logs, engine } = await run(LinkedListScripts.RemoveNthFromEnd);
    expect(logs).toContain('Removing node 50');
    expect(lists.list).toEqual([10, 20, 30, 40, 60]);
    const values = (engine.sceneManager.getSceneGraph() as any[]).filter((e) => e.originalType === 'LINKEDLIST_NODE').map((e) => e.value);
    expect(values).not.toContain(50);
    expect(values).not.toContain(0); // the dummy node was freed too
  });

  it('Palindrome Linked List: compares node values (no list[undefined]) and restores the list', async () => {
    const { lists, logs, engine } = await run(LinkedListScripts.PalindromeLinkedList);
    expect(logs).toContain('The list is a palindrome');
    expect(logs.filter((l) => l.startsWith('Comparing'))).toHaveLength(3);
    expect(lists.list).toEqual([1, 2, 3, 2, 1]);
    const labels = (engine.sceneManager.getSceneGraph() as any[]).map((e) => String(e.label ?? ''));
    expect(labels.some((l) => l.includes('undefined'))).toBe(false);
  });

  it('Palindrome Linked List: detects a non-palindrome too', async () => {
    const source = LinkedListScripts.PalindromeLinkedList.replace('[1, 2, 3, 2, 1]', '[1, 2, 3, 4, 1]');
    const { lists, logs } = await run(source);
    expect(logs).toContain('The list is NOT a palindrome');
    expect(lists.list).toEqual([1, 2, 3, 4, 1]);
  });

  it('Remove Duplicates from a Sorted List', async () => {
    const { lists, logs } = await run(LinkedListScripts.RemoveDuplicates);
    expect(lists.list).toEqual([1, 2, 3, 4]);
    expect(logs).toContain('Without duplicates: 1 -> 2 -> 3 -> 4 -> NULL');
  });
});

describe('Every Linked List example', () => {
  const linkedListExamples = EXAMPLES.filter((e) => e.category === 'Linked Lists');

  it('there are exactly 12, all backed by the library', () => {
    expect(linkedListExamples).toHaveLength(12);
    const sources = new Set(Object.values(LinkedListScripts));
    linkedListExamples.forEach((e) => expect(sources.has(e.source)).toBe(true));
  });

  for (const example of linkedListExamples) {
    it(`${example.title}: loops over pointers, leaves nothing in heap memory, and every step is visible`, async () => {
      expect(example.source).toMatch(/\bWHILE\b|\bLOOP\b/);
      const { engine } = await run(example.source);
      const nodes = (engine.sceneManager.getSceneGraph() as any[]).filter((e) => e.originalType === 'LINKEDLIST_NODE');
      expect(nodes.filter((n) => n.inHeap)).toEqual([]);
      expect(nodes.some((n) => n.originalType === 'HEAD' || n.originalType === 'NULL')).toBe(false);
      expect(engine.getCurrentStep()).toBeGreaterThan(5);
    });
  }
});

/**
 * The Playground's Queue examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly).
 *
 * Every example must do its work with real queue code — loops and IFs over
 * `x = DEQUEUE(q)`, `FRONT(q)`, `REAR(q)`, `IS_EMPTY(q)`, `LENGTH(q)`, not a
 * scripted sequence of enqueues and dequeues — so these tests assert each
 * one's answer, the queues it leaves behind, and that the source really
 * loops. The rest covers the queue behaviour those examples rely on.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { QueueScripts } from '../../packages/demo/src/examples/QueueLibrary';
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
  /** Every queue's / stack's values: front → rear for a queue, bottom → top for a stack. */
  containers: Record<string, unknown[]>;
  arrays: Record<string, unknown[]>;
}

function readScene(engine: ExecutionEngine) {
  const scene = engine.sceneManager.getSceneGraph() as any[];
  const containers: Record<string, unknown[]> = {};
  for (const anchor of scene.filter((e) => e.originalType === 'CONTAINER')) {
    containers[anchor.logicalParent] = scene
      .filter((e) => e.originalType === 'CONTAINER_ITEM' && e.logicalParent === anchor.logicalParent)
      .sort((a, b) => a.order - b.order)
      .map((e) => e.value);
  }
  const arrays: Record<string, unknown[]> = {};
  for (const el of scene.filter((e) => e.originalType === 'ARRAY_ELEMENT').sort((a, b) => a.logicalIndex - b.logicalIndex)) {
    (arrays[el.logicalParent] ??= []).push(el.value);
  }
  return { containers, arrays };
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { engine, logs, ...readScene(engine) };
}

/** What the program PRINTed (no step-by-step operation lines). */
const printed = (logs: string[]) =>
  logs.filter((l) => !l.includes('⟹') && !/^(Highlighted|Marked|Updated value|Cleared mark|Appended value)/.test(l));

describe('Queue examples produce correct results', () => {
  it('Queue Foundation: FIFO order, FRONT / REAR, and a guarded dequeue on the empty queue', async () => {
    const { logs, containers } = await run(QueueScripts.QueueFoundation);
    expect(containers.ticketLine).toEqual([]);
    expect(printed(logs)).toEqual([
      'Enqueued 10 - size is now 1',
      'Enqueued 20 - size is now 2',
      'Enqueued 30 - size is now 3',
      'Enqueued 40 - size is now 4',
      'Front: 10 - Rear: 40 - size is still 4',
      'Dequeued 10 - size is now 3',
      'Dequeued 20 - size is now 2',
      'Dequeued 30 - size is now 1',
      'Dequeued 40 - size is now 0',
      'The queue is empty: dequeuing now would be a QUEUE UNDERFLOW, so we stop.',
    ]);
  });

  it('Queue Using an Array: overflow on the sixth enqueue, and freed front slots are wasted', async () => {
    const { logs, arrays } = await run(QueueScripts.QueueUsingArray);
    const out = printed(logs);
    expect(out).toContain('QUEUE OVERFLOW: cannot enqueue 60 - rear is already at the last index 4');
    expect(out.filter((l) => l.startsWith('dequeue ->'))).toEqual(['dequeue -> 10 - front is now 1', 'dequeue -> 20 - front is now 2']);
    expect(out[out.length - 1]).toBe('QUEUE OVERFLOW: cannot enqueue 70 even though 2 slots are free - the linear queue wastes them');
    expect(arrays.slots).toEqual([0, 0, 30, 40, 50]);
  });

  it('Circular Queue: rear wraps around, values still leave in FIFO order, then underflow', async () => {
    const { logs, arrays } = await run(QueueScripts.CircularQueue);
    const out = printed(logs);
    expect(out).toContain('enqueue 60 -> index 0 (wrapped around) - count 4');
    expect(out).toContain('enqueue 70 -> index 1 (wrapped around) - count 5');
    expect(out).toContain('QUEUE OVERFLOW: cannot enqueue 80 - all 5 slots are full');
    expect(out.filter((l) => /^dequeue -> \d+$/.test(l))).toEqual([
      'dequeue -> 30', 'dequeue -> 40', 'dequeue -> 50', 'dequeue -> 60', 'dequeue -> 70',
    ]);
    expect(out[out.length - 1]).toBe('QUEUE UNDERFLOW: nothing to dequeue (count = 0)');
    expect(arrays.slots).toEqual([0, 0, 0, 0, 0]);
  });

  it('Bank Teller Simulation: waiting times and the average', async () => {
    const { logs, arrays, containers } = await run(QueueScripts.BankTellerSimulation);
    expect(arrays.waited).toEqual([0, 2, 3, 3, 3]);
    expect(logs).toContain('Minute 3 : serving Ben - waited 2 min - done at minute 5');
    expect(logs).toContain('Average wait: 2.2 minutes');
    expect(containers.waitingLine).toEqual([]);
  });

  it('Round Robin Scheduling: completion times and average waiting time', async () => {
    const { logs, arrays, containers } = await run(QueueScripts.RoundRobinScheduling);
    expect(arrays.completion).toEqual([13, 10, 5, 12]);
    expect(arrays.remaining).toEqual([0, 0, 0, 0]);
    expect(logs).toContain('P1 ran 2 units - needs 3 more - back to the rear - time is now 2');
    expect(logs).toContain('Average waiting time: 6.75');
    expect(containers.readyQueue).toEqual([]);
  });

  it('Generate Binary Numbers: 1 to 10 in order', async () => {
    const { logs } = await run(QueueScripts.GenerateBinaryNumbers);
    expect(printed(logs).filter((l) => l.includes('in binary is'))).toEqual(
      ['1', '10', '11', '100', '101', '110', '111', '1000', '1001', '1010'].map((b, i) => `${i + 1} in binary is ${b}`)
    );
  });

  it('Reverse a Queue', async () => {
    const { logs, containers } = await run(QueueScripts.ReverseQueueWithStack);
    expect(containers).toEqual({ q: [5, 4, 3, 2, 1], helper: [] });
    expect(logs).toContain('After:  [5, 4, 3, 2, 1]');
  });

  it('Reverse the First K Elements, and an invalid k is rejected', async () => {
    const { containers } = await run(QueueScripts.ReverseFirstK);
    expect(containers.q).toEqual([30, 20, 10, 40, 50]);
    const all = await run(QueueScripts.ReverseFirstK.replace('  k = 3\n', '  k = 5\n'));
    expect(all.containers.q).toEqual([50, 40, 30, 20, 10]);
    const none = await run(QueueScripts.ReverseFirstK.replace('  k = 3\n', '  k = 0\n'));
    expect(none.containers.q).toEqual([10, 20, 30, 40, 50]);
    const invalid = await run(QueueScripts.ReverseFirstK.replace('  k = 3\n', '  k = 9\n'));
    expect(invalid.logs).toContain('Invalid k: it must be between 0 and 5');
    expect(invalid.containers.q).toEqual([10, 20, 30, 40, 50]);
  });

  it('Interleave Two Halves, and an odd-sized queue is rejected', async () => {
    const { containers } = await run(QueueScripts.InterleaveHalves);
    expect(containers).toEqual({ deck: [1, 5, 2, 6, 3, 7, 4, 8], firstHalf: [] });
    const odd = await run(QueueScripts.InterleaveHalves.replace('deck = [1, 2, 3, 4, 5, 6, 7, 8]', 'deck = [1, 2, 3]'));
    expect(odd.logs).toContain('The queue needs an even number of elements, it has 3');
    const empty = await run(QueueScripts.InterleaveHalves.replace('deck = [1, 2, 3, 4, 5, 6, 7, 8]', 'deck = []'));
    expect(empty.containers.deck).toEqual([]);
  });

  it('Queue Using Two Stacks: FIFO order out of two LIFO stacks, then underflow', async () => {
    const { logs, containers } = await run(QueueScripts.QueueUsingTwoStacks);
    expect(printed(logs).filter((l) => l.startsWith('dequeue'))).toEqual([
      'dequeue -> 1', 'dequeue -> 2', 'dequeue -> 3', 'dequeue -> 4', 'dequeue -> QUEUE UNDERFLOW: both stacks are empty',
    ]);
    expect(containers).toEqual({ inbox: [], outbox: [] });
  });

  it('Hot Potato: elimination order and winner', async () => {
    const { logs, arrays, containers } = await run(QueueScripts.HotPotato);
    expect(arrays.eliminated).toEqual(['Dev', 'Bo', 'Ana', 'Cy', 'Fay']);
    expect(logs).toContain('Winner: Eva');
    expect(containers.circle).toEqual(['Eva']);
  });

  it('Moving Average: a window of the last 3 readings', async () => {
    const { arrays, containers } = await run(QueueScripts.MovingAverage);
    expect(arrays.averages).toEqual([10, 15, 20, 30, 40, 50]);
    expect(containers.window).toEqual([40, 50, 60]);
  });

  it('First Non-Repeating Character in a stream', async () => {
    const { arrays } = await run(QueueScripts.FirstNonRepeating);
    expect(arrays.answers).toEqual(['a', 'none', 'b', 'b', 'c', 'c', 'd']);
  });

  it('every example is real queue code (loops, IFs, value-returning reads) and is in the Playground', () => {
    const registered = new Set(EXAMPLES.filter((e) => e.category === 'Queues').map((e) => e.source));
    for (const [name, source] of Object.entries(QueueScripts)) {
      expect(registered.has(source), `${name} is registered`).toBe(true);
      expect(/\b(LOOP|WHILE)\b/.test(source), `${name} loops`).toBe(true);
      expect(/\bIF\b/.test(source) || /=\s*(DEQUEUE|FRONT|REAR)\(/.test(source), `${name} decides or reads values`).toBe(true);
      expect(/^\s*WAIT\s*$/m.test(source), `${name} has no scripted WAITs`).toBe(false);
    }
  });
});

describe('Queue behaviour the examples rely on', () => {
  it('ENQUEUE / DEQUEUE / FRONT / REAR really change and read the queue, with a console line each', async () => {
    const { containers, logs } = await run(`SCENE Q
DECLARE
  QUEUE q = [1, 2, 3]
SEQUENCE
  ENQUEUE q 4
  FRONT q
  REAR q
  DEQUEUE q
END`);
    expect(containers.q).toEqual([2, 3, 4]);
    expect(logs).toEqual([
      'ENQUEUE q 4   ⟹   4 joins the rear of q   q (front → rear): [1, 2, 3, 4]',
      'FRONT(q)   ⟹   read 1 from the front of q',
      'REAR(q)   ⟹   read 4 from the rear of q',
      'DEQUEUE(q)   ⟹   removed 1 from the front of q; q is now [2, 3, 4]',
    ]);
  });

  it('x = FRONT(q) / x = REAR(q) return values without removing them', async () => {
    const { logs, containers } = await run(`SCENE Q
DECLARE
  QUEUE q = [7, 8, 9]
SEQUENCE
  f = FRONT(q)
  r = REAR(q)
  PRINT "front" f "rear" r "size" LENGTH(q)
END`);
    expect(logs).toContain('front 7 rear 9 size 3');
    expect(containers.q).toEqual([7, 8, 9]);
  });

  it('dequeuing or reading an empty queue is a queue-underflow error', async () => {
    for (const read of ['DEQUEUE', 'FRONT', 'REAR']) {
      await expect(run(`SCENE Q
DECLARE
  QUEUE q = []
SEQUENCE
  x = ${read}(q)
END`)).rejects.toThrow(/queue underflow/);
    }
  });

  it('stack operations on a queue (and queue operations on a stack) are errors that name the right one', async () => {
    await expect(run(`SCENE Q
DECLARE
  QUEUE q = [1]
SEQUENCE
  x = POP(q)
END`)).rejects.toThrow(/q is a QUEUE — use DEQUEUE\(q\)/);
    await expect(run(`SCENE Q
DECLARE
  STACK s = [1]
SEQUENCE
  x = DEQUEUE(s)
END`)).rejects.toThrow(/s is a STACK/);
  });

  it('a queue can be declared with text values', async () => {
    const { containers } = await run(`SCENE Q
DECLARE
  QUEUE q = ["a", 1]
SEQUENCE
  ENQUEUE q "b"
END`);
    expect(containers.q).toEqual(['a', 1, 'b']);
  });

  it('SIZE / IS_EMPTY / CLEAR statements work on a queue', async () => {
    const { logs, containers } = await run(`SCENE Q
DECLARE
  QUEUE q = [1, 2]
SEQUENCE
  SIZE q
  IS_EMPTY q
  CLEAR q
  IS_EMPTY q
END`);
    expect(containers.q).toEqual([]);
    expect(logs).toEqual([
      'SIZE q   ⟹   2 elements   q (front → rear): [1, 2]',
      'IS_EMPTY q   ⟹   FALSE (it holds 2)',
      'CLEAR q   ⟹   removed 2 elements; q is now []',
      'IS_EMPTY q   ⟹   TRUE (it holds nothing)',
    ]);
  });

  it('without a tree, a queue is a horizontal row (front on the left) tagged FRONT / REAR, below other structures', async () => {
    const { engine } = await run(`SCENE Q
DECLARE
  ARRAY arr = [1, 2, 3]
  QUEUE q = [10, 20, 30]
SEQUENCE
  ENQUEUE q 40
END`);
    const scene = engine.sceneManager.getSceneGraph() as any[];
    const items = scene.filter((e) => e.originalType === 'CONTAINER_ITEM').sort((a, b) => a.order - b.order);
    const targets = items.map((e) => e.worldTarget);
    expect(new Set(targets.map((t: any) => t.y)).size).toBe(1);
    for (let i = 1; i < targets.length; i++) expect(targets[i].x).toBeGreaterThan(targets[i - 1].x);
    expect(items.map((e) => e.tags)).toEqual([['FRONT'], [], [], ['REAR']]);
    const arrayMinY = Math.min(...scene.filter((e) => e.originalType === 'ARRAY_ELEMENT').map((e) => e.worldTarget?.y ?? e.position.y));
    expect(targets[0].y).toBeLessThan(arrayMinY);
  });

  it('a queue and a stack together: the queue is a row, the stack a column to its right', async () => {
    const { engine } = await run(`SCENE Q
DECLARE
  QUEUE q = [1, 2, 3, 4, 5]
  STACK s = [1, 2]
SEQUENCE
  ENQUEUE q 6
END`);
    const scene = engine.sceneManager.getSceneGraph() as any[];
    const items = (name: string) => scene.filter((e) => e.originalType === 'CONTAINER_ITEM' && e.logicalParent === name).map((e) => e.worldTarget);
    const queueMaxX = Math.max(...items('q').map((t: any) => t.x));
    const stack = items('s');
    expect(new Set(stack.map((t: any) => t.x)).size).toBe(1);
    expect(stack[0].x).toBeGreaterThan(queueMaxX);
  });
});

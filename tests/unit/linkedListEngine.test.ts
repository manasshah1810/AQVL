/**
 * Unit tests for LinkedListEngine (packages/runtime/src/core/algorithms/LinkedListEngine.ts),
 * run through the real compiler + ExecutionEngine (headless, animations
 * complete instantly) since the engine's operations are driven by the
 * running program's variables.
 *
 * Covers the pointer model (anchor + nodes + next/prev edges, no HEAD/NULL
 * spheres), heap memory (unlinked nodes, FREE, LEAKED), node tags, the
 * built-in operations on every variant against a plain-array model, and the
 * run-time errors (NULL dereference, use after free, double free, ...).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface Run {
  engine: ExecutionEngine;
  logs: string[];
  error?: Error;
}

async function run(source: string): Promise<Run> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  try {
    await engine.execute();
    return { engine, logs };
  } catch (error) {
    return { engine, logs, error: error as Error };
  }
}

const scene = (engine: ExecutionEngine) => engine.sceneManager.getSceneGraph() as any[];
const el = (engine: ExecutionEngine, id: string) => engine.sceneManager.getElement(id) as any;

/** Values in list order, following next pointers from the head (stops at NULL or a repeat). */
function values(engine: ExecutionEngine, list: string): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();
  let id: string | null = el(engine, `ll:${list}`).headId;
  while (id && !seen.has(id)) {
    seen.add(id);
    out.push(el(engine, id).value);
    id = el(engine, `${id}>next`)?.targetId ?? null;
  }
  return out;
}

/** Values following prev pointers from the last node. */
function valuesBackward(engine: ExecutionEngine, list: string): unknown[] {
  const ids: string[] = [];
  let id: string | null = el(engine, `ll:${list}`).headId;
  while (id && !ids.includes(id)) {
    ids.push(id);
    id = el(engine, `${id}>next`)?.targetId ?? null;
  }
  const out: unknown[] = [];
  let cur: string | null = ids[ids.length - 1] ?? null;
  while (cur) {
    out.push(el(engine, cur).value);
    cur = el(engine, `${cur}>prev`)?.targetId ?? null;
  }
  return out;
}

const nodes = (engine: ExecutionEngine, list?: string) =>
  scene(engine).filter((e) => e.originalType === 'LINKEDLIST_NODE' && (!list || e.logicalParent === list));

describe('Linked list scene model', () => {
  it('has no HEAD / NULL spheres: the first node is tagged HEAD and the last TAIL', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 20, 30]
SEQUENCE
END`);
    const all = scene(engine);
    expect(all.some((e) => e.originalType === 'HEAD' || e.originalType === 'NULL')).toBe(false);
    expect(nodes(engine).map((n) => n.value)).toEqual([10, 20, 30]);
    const byValue = (v: number) => nodes(engine).find((n) => n.value === v);
    expect(byValue(10).tags).toEqual(['HEAD']);
    expect(byValue(20).tags).toEqual([]);
    expect(byValue(30).tags).toEqual(['TAIL']);
    expect(nodes(engine).every((n) => n.label === '')).toBe(true);
  });

  it('pointer variables become tags on the node they point to, and move with the pointer', async () => {
    const { engine, logs } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 20, 30]
SEQUENCE
  curr = list.head
  curr = curr.next
END`);
    const byValue = (v: number) => nodes(engine).find((n) => n.value === v);
    expect(byValue(10).tags).toEqual(['HEAD']);
    expect(byValue(20).tags).toEqual(['curr']);
    expect(logs).toContain('curr = curr.next   ⟹   curr → node 20');
  });

  it('counts every pointer move as a visible step, and highlights the arrow that was followed', async () => {
    const source = `SCENE S
DECLARE
  LINKEDLIST list = [1, 2, 3, 4]
SEQUENCE
  curr = list.head
  WHILE curr != NULL
    curr = curr.next
  END
END`;
    const engine = new ExecutionEngine({ headless: true });
    const edgeStates: string[] = [];
    engine.eventDispatcher.on('STATE_UPDATED', (state: any) => {
      state.elements.forEach((e: any) => {
        if (e.type === 'edge' && e.state === 'TRAVERSING') edgeStates.push(e.id);
      });
    });
    engine.loadProgram(compile(source) as any);
    await engine.execute();
    // curr = head, then 4 moves (the last one to NULL).
    expect(engine.getCurrentStep()).toBe(5);
    expect(edgeStates).toEqual(['ll:list:0>next', 'll:list:1>next', 'll:list:2>next']);
  });

  it('places two lists side by side on the same depth plane', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST a = [1, 2, 3]
  LINKEDLIST b = [4, 5, 6]
SEQUENCE
END`);
    const aNodes = nodes(engine, 'a');
    const bNodes = nodes(engine, 'b');
    expect(new Set([...aNodes, ...bNodes].map((n) => n.position.z))).toEqual(new Set([0]));
    expect(Math.max(...aNodes.map((n) => n.position.x))).toBeLessThan(Math.min(...bNodes.map((n) => n.position.x)));
  });
});

describe('Heap memory: unlinking, FREE and leaks', () => {
  it('a node bypassed by a pointer write moves to heap memory and stays there until FREE', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 20, 30]
SEQUENCE
  prev = list.head
  temp = prev.next
  prev.next = temp.next
END`);
    const n20 = nodes(engine).find((n) => n.value === 20);
    expect(values(engine, 'list')).toEqual([10, 30]);
    expect(n20.inHeap).toBe(true);
    expect(n20.tags).toEqual(['temp']);
    // (Headless runs don't tween, so check where the layout sends it.)
    const rowY = nodes(engine).find((n) => n.value === 10).worldTarget.y;
    expect(n20.worldTarget.y).toBeLessThan(rowY - 2);
  });

  it('FREE removes the node and every pointer to or from it', async () => {
    const { engine, logs } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 20, 30]
SEQUENCE
  prev = list.head
  temp = prev.next
  prev.next = temp.next
  FREE temp
END`);
    expect(nodes(engine).map((n) => n.value)).toEqual([10, 30]);
    expect(scene(engine).some((e) => e.type === 'edge' && (e.sourceId === 'll:list:1' || e.targetId === 'll:list:1'))).toBe(false);
    expect(logs.some((l) => l.startsWith('FREE temp: releasing the memory of node 20'))).toBe(true);
  });

  it('flags a node nothing points to any more as LEAKED', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 20, 30]
SEQUENCE
  list.head = list.head.next
END`);
    const n10 = nodes(engine).find((n) => n.value === 10);
    expect(n10.inHeap).toBe(true);
    expect(n10.tags).toEqual(['LEAKED']);
  });

  it('NEW_NODE allocates in heap memory; linking it in moves it into the list', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [10, 30]
SEQUENCE
  newNode = NEW_NODE(list, 20)
  newNode.next = list.head.next
  list.head.next = newNode
END`);
    expect(values(engine, 'list')).toEqual([10, 20, 30]);
    const n20 = nodes(engine).find((n) => n.value === 20);
    expect(n20.inHeap).toBe(false);
    expect(n20.tags).toEqual(['newNode']);
    // Laid out in pointer order.
    const xs = [10, 20, 30].map((v) => nodes(engine).find((n) => n.value === v).worldTarget.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('an in-place reversal keeps not-yet-reversed nodes in the list row (they are still referenced)', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [1, 2, 3, 4]
SEQUENCE
  prev = NULL
  curr = list.head
  next = curr.next
  curr.next = prev
  prev = curr
  curr = next
END`);
    expect(nodes(engine).every((n) => !n.inHeap)).toBe(true);
    expect(nodes(engine).find((n) => n.value === 2).tags).toEqual(['curr', 'next']);
  });
});

describe('Pointer expressions', () => {
  it('reads val / next / prev / head / tail and supports list[i] and LENGTH(list)', async () => {
    const { logs } = await run(`SCENE S
DECLARE
  DOUBLY LINKEDLIST list = [10, 20, 30]
SEQUENCE
  PRINT list.head.val list.head.next.val list.tail.val list.tail.prev.val
  PRINT list[1] LENGTH(list)
  LOOP i FROM 0 TO LENGTH(list) - 1
    HIGHLIGHT list[i]
  END
  PRINT list.head list.head.prev
END`);
    expect(logs).toContain('10 20 30 20');
    expect(logs).toContain('20 3');
    expect(logs.filter((l) => l.startsWith('Visiting node'))).toEqual([
      'Visiting node 10 of list',
      'Visiting node 20 of list',
      'Visiting node 30 of list',
    ]);
    expect(logs).toContain('Node(10) NULL');
  });

  it('AND / OR short-circuit, so `p != NULL AND p.next != NULL` never dereferences NULL', async () => {
    const { logs, error } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [1]
SEQUENCE
  p = NULL
  IF p != NULL AND p.next != NULL
    PRINT "yes"
  ELSE
    PRINT "no"
  END
END`);
    expect(error).toBeUndefined();
    expect(logs).toContain('no');
  });

  it('HIGHLIGHT and COMPARE accept pointer variables and pointer expressions without relabelling nodes', async () => {
    const { engine, logs } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [1, 2, 1]
SEQUENCE
  a = list.head
  HIGHLIGHT a.next
  COMPARE a list.tail
END`);
    expect(logs).toContain('Visiting node 2 of list');
    expect(logs.some((l) => l.startsWith('Comparing node 1 vs node 1'))).toBe(true);
    expect(nodes(engine).every((n) => !String(n.label).includes('undefined'))).toBe(true);
  });

  it('SWAP on two list nodes exchanges their values', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [1, 2, 3]
SEQUENCE
  SWAP list[0] list[2]
END`);
    expect(values(engine, 'list')).toEqual([3, 2, 1]);
  });
});

describe('Naming', () => {
  it('`head` works as a variable name', async () => {
    const { logs, error } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [7, 8]
SEQUENCE
  head = list.head
  PRINT head.val
END`);
    expect(error).toBeUndefined();
    expect(logs).toContain('7');
  });

  it('command words such as `node` work as variable names; truly reserved words get a clear compile error', async () => {
    const { logs, error } = await run(`SCENE S
DECLARE
  LINKEDLIST list = [7]
SEQUENCE
  node = list.head
  PRINT node.val
END`);
    expect(error).toBeUndefined();
    expect(logs).toContain('7');
    expect(() => compile(`SCENE S
DECLARE
  LINKEDLIST list = [7]
SEQUENCE
  x = 1
  y = while.val
END`)).toThrow(/"while" is a reserved word/);
  });
});

describe('Run-time errors', () => {
  const expectError = async (body: string, pattern: RegExp, decl = 'LINKEDLIST list = [1, 2]') => {
    const { error } = await run(`SCENE S
DECLARE
  ${decl}
SEQUENCE
${body}
END`);
    expect(error?.message).toMatch(pattern);
  };

  it('NULL pointer dereference', () => expectError('  p = NULL\n  PRINT p.val', /NULL pointer dereference.*p is NULL/));
  it('use after free', () => expectError('  p = list.head\n  list.head = p.next\n  FREE p\n  PRINT p.val', /Use after free/));
  it('double free', () => expectError('  p = list.head\n  list.head = p.next\n  FREE p\n  FREE p', /Double free/));
  it('prev on a singly list', () => expectError('  PRINT list.head.prev', /only DOUBLY linked list nodes have a prev pointer/));
  it('index out of range', () => expectError('  HIGHLIGHT list[5]', /Index 5 is out of range.*0 to 1/));
  it('pointing at a non-node', () => expectError('  list.head.next = 5', /is not a linked-list node/));
  it('an unsupported action names the supported ones', () => expectError('  PUSH list 5', /not a linked-list operation/));
});

describe('Built-in operations match a plain-array model on every variant', () => {
  const variants = ['LINKEDLIST', 'DOUBLY LINKEDLIST', 'CIRCULAR LINKEDLIST'];

  for (const variant of variants) {
    it(`${variant}: INSERT_HEAD / INSERT_TAIL / INSERT / UPDATE / DELETE / DELETE_HEAD / DELETE_TAIL / REVERSE`, async () => {
      const { engine, logs, error } = await run(`SCENE S
DECLARE
  ${variant} list = [10, 20, 30]
SEQUENCE
  INSERT_HEAD list 5
  INSERT_TAIL list 40
  INSERT list[2] 15
  UPDATE list[3] 25
  DELETE list[1]
  PRINT list
  DELETE_HEAD list
  DELETE_TAIL list
  REVERSE list
  SEARCH list 15
  PRINT list
END`);
      expect(error).toBeUndefined();
      // [5,10,20,30] -> [5,10,20,30,40] -> [5,10,15,20,30,40] -> [5,10,15,25,30,40] -> [5,15,25,30,40]
      // -> [15,25,30,40] -> [15,25,30] -> reversed [30,25,15]
      expect(values(engine, 'list')).toEqual([30, 25, 15]);
      const circular = variant.startsWith('CIRCULAR');
      const endText = circular ? 'back to' : 'NULL';
      expect(logs).toContain(`5 -> 15 -> 25 -> 30 -> 40 -> ${circular ? 'back to 5' : 'NULL'}`);
      expect(logs.some((l) => l.startsWith('30 -> 25 -> 15 -> ') && l.includes(endText))).toBe(true);
      expect(logs).toContain('Found 15 at position 2 of list.');
      if (variant.startsWith('DOUBLY')) expect(valuesBackward(engine, 'list')).toEqual([15, 25, 30]);
      if (circular) {
        // The tail (15) wraps around to the head.
        const tail = nodes(engine).find((n) => n.value === 15);
        expect(el(engine, `${tail.id}>next`).targetId).toBe(el(engine, 'll:list').headId);
      }
      // Nothing left in heap memory: every removed node was freed.
      expect(nodes(engine).every((n) => !n.inHeap)).toBe(true);
    });

    it(`${variant}: built-ins on an empty list (previously crashed the layout)`, async () => {
      const { engine, error } = await run(`SCENE S
DECLARE
  ${variant} list = []
SEQUENCE
  DELETE_HEAD list
  DELETE_TAIL list
  INSERT_TAIL list 1
  INSERT_HEAD list 0
  REVERSE list
  DELETE_HEAD list
  DELETE_TAIL list
END`);
      expect(error).toBeUndefined();
      expect(values(engine, 'list')).toEqual([]);
      expect(el(engine, 'll:list').headId).toBeNull();
    });
  }
});

describe('Step back', () => {
  it('replaying from the start after the run reproduces the same list', async () => {
    const source = `SCENE S
DECLARE
  LINKEDLIST list = [1, 2, 3]
SEQUENCE
  prev = NULL
  curr = list.head
  WHILE curr != NULL
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END
  list.head = prev
  temp = list.head
  list.head = temp.next
  FREE temp
END`;
    const { engine } = await run(source);
    expect(values(engine, 'list')).toEqual([2, 1]);
    engine.restart();
    expect(values(engine, 'list')).toEqual([1, 2, 3]);
    expect(nodes(engine).every((n) => n.scale.x === 1)).toBe(true);
    await engine.execute();
    expect(values(engine, 'list')).toEqual([2, 1]);
  });
});

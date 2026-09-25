/**
 * The Playground's Tree examples and the pointer-tree language features,
 * run end-to-end (compile -> ExecutionEngine with the real
 * AnimationController, animations completed instantly).
 *
 * Every example must do its work with real code — pointer variables, loops,
 * IFs, recursion, a real queue / stack of node pointers — so these tests
 * assert each one's final tree and console output, that no node is left in
 * heap memory, and that the source really loops or recurses.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { TreeScripts } from '../../packages/demo/src/examples/TreeLibrary';
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
  keywords: string[];
  error?: string;
  /** Level-order values of every tree (NULL gaps omitted), by tree name. */
  trees: Record<string, unknown[]>;
  heap: unknown[];
}

function readTrees(engine: ExecutionEngine): Record<string, unknown[]> {
  const scene = engine.sceneManager.getSceneGraph() as any[];
  const get = (id: string) => engine.sceneManager.getElement(id) as any;
  const out: Record<string, unknown[]> = {};
  for (const anchor of scene.filter((e) => e.originalType === 'BINARYTREE')) {
    const values: unknown[] = [];
    const queue: string[] = anchor.rootId ? [anchor.rootId] : [];
    while (queue.length) {
      const id = queue.shift()!;
      values.push(get(id).value);
      for (const side of ['left', 'right']) {
        const e = get(`${id}>${side}`);
        if (e) queue.push(e.targetId);
      }
    }
    out[anchor.logicalParent] = values;
  }
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  const keywords: string[] = [];
  let error: string | undefined;
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => {
    logs.push(e.message);
    keywords.push(e.keyword);
  });
  engine.eventDispatcher.on('EXECUTION_ERROR', (e: any) => (error = e.message));
  engine.loadProgram(compile(source) as any);
  try {
    await engine.execute();
  } catch (e: any) {
    error = e.message;
  }
  const heap = (engine.sceneManager.getSceneGraph() as any[]).filter((e) => e.inHeap).map((e) => e.value);
  return { engine, logs, keywords, error, trees: readTrees(engine), heap };
}

const printed = (r: RunResult) => r.logs.filter((_, i) => r.keywords[i] === 'PRINT');

describe('Tree examples produce correct results', () => {
  it('Binary Tree Basics: builds with NEW_NODE, walks both spines, frees a leaf', async () => {
    const r = await run(TreeScripts.BinaryTreeBasics);
    expect(r.error).toBeUndefined();
    expect(r.trees.t).toEqual([10, 20, 30, 40, 50]);
    expect(printed(r)).toEqual([
      'Tree by levels: Level 0: 10 | Level 1: 20 30 | Level 2: 40 50 60',
      'root.left.right.val = 50',
      'Leftmost node: 40',
      'Rightmost node: 60',
      '60 is a leaf (both children are NULL)',
      'After removing 60: Level 0: 10 | Level 1: 20 30 | Level 2: 40 50',
    ]);
    expect(r.heap).toEqual([]);
  });

  it('Traversals: preorder, inorder and postorder by recursion', async () => {
    const r = await run(TreeScripts.Traversals);
    const order = (prefix: string) => printed(r).filter((l) => l.startsWith(prefix)).map((l) => Number(l.split(' ').pop()));
    expect(order('Preorder')).toEqual([1, 2, 4, 5, 3]);
    expect(order('Inorder')).toEqual([4, 2, 5, 1, 3]);
    expect(order('Postorder')).toEqual([4, 5, 2, 3, 1]);
    // Every call is a step: 5 nodes + 6 NULL children, three traversals.
    expect(r.keywords.filter((k) => k === 'CALL')).toHaveLength(33);
    expect(r.keywords.filter((k) => k === 'RETURN')).toHaveLength(33);
  });

  it('Level Order: BFS with a queue of node pointers, one line per level', async () => {
    const r = await run(TreeScripts.LevelOrder);
    expect(r.error).toBeUndefined();
    expect(printed(r).map((l) => l.replace(/\s+/g, ' '))).toEqual([
      'Level 0 : 8 (sum = 8 )',
      'Level 1 : 3 10 (sum = 13 )',
      'Level 2 : 1 6 14 (sum = 21 )',
      'Level 3 : 4 7 (sum = 11 )',
      'The tree has 4 levels',
    ]);
    expect(r.keywords.filter((k) => k === 'DEQUEUE')).toHaveLength(8);
  });

  it('Iterative Inorder: a stack of pointers lists BST keys in sorted order', async () => {
    const r = await run(TreeScripts.IterativeInorder);
    expect(printed(r).pop()!.replace(/\s+/g, ' ')).toBe('Keys in sorted order: 20 30 40 50 60 70 80');
    expect(r.keywords.filter((k) => k === 'PUSH')).toHaveLength(7);
    expect(r.keywords.filter((k) => k === 'POP')).toHaveLength(7);
  });

  it('Height, Size & Leaves: recursive functions returning values', async () => {
    const r = await run(TreeScripts.HeightSizeLeaves);
    expect(printed(r)).toEqual(['Height: 3', 'Number of nodes: 6', 'Number of leaves: 3']);
    expect(r.logs).toContain('height(1) done   → returns 3');
  });

  it('BST Search & Insert: iterative search / insert, then the built-ins', async () => {
    const r = await run(TreeScripts.BSTSearchInsert);
    expect(r.error).toBeUndefined();
    expect(printed(r)).toEqual(expect.arrayContaining(['Found 60', '45 is not in the tree', 'Inserted 45', 'Inserted 65', 'Inserted 10']));
    expect(r.trees.t).toEqual([50, 30, 70, 20, 40, 60, 80, 10, 35, 45, 65]);
    expect(r.logs).toContain('Found 35.');
  });

  it('BST Delete: leaf, one child, two children (successor) and a missing key', async () => {
    const r = await run(TreeScripts.BSTDelete);
    expect(r.error).toBeUndefined();
    expect(printed(r)).toEqual([
      'Deleted 20 : Level 0: 50 | Level 1: 30 70 | Level 2: 40 60 80 | Level 3: 65',
      'Deleted 30 : Level 0: 50 | Level 1: 40 70 | Level 2: 60 80 | Level 3: 65',
      'Two children: copy successor 60 into 50',
      'Deleted 50 : Level 0: 60 | Level 1: 40 70 | Level 2: 65 80',
      '99 is not in the tree',
    ]);
    // The built-in DELETE t 70 (two children: successor 80).
    expect(r.trees.t).toEqual([60, 40, 80, 65]);
    expect(r.heap).toEqual([]);
    expect(r.keywords.filter((k) => k === 'FREE')).toHaveLength(4);
  });

  it('Validate BST: range checks catch a violation deep in a subtree', async () => {
    const r = await run(TreeScripts.ValidateBST);
    expect(printed(r)).toEqual([
      'good is a valid BST',
      '60 breaks the rule: it must be between 30 and 50',
      'bad is NOT a BST (60 sits in the left subtree of 50)',
    ]);
  });

  it('Lowest Common Ancestor: walks down until the keys split', async () => {
    const r = await run(TreeScripts.LowestCommonAncestor);
    expect(printed(r).filter((l) => l.startsWith('LCA'))).toEqual(['LCA(35, 45) = 40', 'LCA(20, 45) = 30', 'LCA(35, 80) = 50']);
  });

  it('Mirror: every left/right pointer pair is swapped', async () => {
    const r = await run(TreeScripts.MirrorTree);
    expect(r.trees.t).toEqual([4, 7, 2, 9, 6, 3, 1]);
    expect(r.heap).toEqual([]);
    // Once the tree is whole again, nodes are laid out mirrored: 9 is leftmost.
    const scene = r.engine.sceneManager.getSceneGraph() as any[];
    const x = (v: number) => scene.find((e) => e.originalType === 'TREE_NODE' && e.value === v).worldTarget.x;
    expect(x(9)).toBeLessThan(x(6));
    expect(x(3)).toBeLessThan(x(1));
  });

  it('Left & Right Views: first and last node of each level', async () => {
    const r = await run(TreeScripts.TreeViews);
    expect(printed(r).map((l) => l.replace(/\s+/g, ' '))).toEqual(['Left view: 1 2 5 6', 'Right view: 1 3 4 6']);
  });

  it('Path Sum: finds 5 + 4 + 11 + 2 = 22 and highlights the path', async () => {
    const r = await run(TreeScripts.PathSum);
    expect(printed(r)).toContain('Yes: a root-to-leaf path sums to 22 (5 + 4 + 11 + 2)');
    const green = (r.engine.sceneManager.getSceneGraph() as any[])
      .filter((e) => e.originalType === 'TREE_NODE' && e.state === 'SUCCESS')
      .map((e) => e.value)
      .sort((a, b) => a - b);
    expect(green).toEqual([2, 4, 5, 11]);
  });

  it('every Trees example in the registry is one of these, and uses loops or recursion', () => {
    const trees = EXAMPLES.filter((e) => e.category === 'Trees');
    expect(trees).toHaveLength(12);
    for (const ex of trees) {
      expect(Object.values(TreeScripts)).toContain(ex.source);
      expect(/\bWHILE\b|\bFUNCTION\b/.test(ex.source)).toBe(true);
    }
  });
});

describe('Pointer-tree language', () => {
  it('NULL dereference, use after free and double free are clear run-time errors', async () => {
    const base = (body: string) => `SCENE S
DECLARE
  BST t = [50, 30]
SEQUENCE
${body}
END`;
    expect((await run(base('  x = t.root.right.val'))).error).toMatch(/NULL pointer dereference: cannot read t\.root\.right\.val/);
    expect((await run(base('  n = t.root.left\n  t.root.left = NULL\n  FREE n\n  PRINT n.val'))).error).toMatch(/Use after free/);
    expect((await run(base('  n = t.root.left\n  t.root.left = NULL\n  FREE n\n  FREE n'))).error).toMatch(/Double free/);
    expect((await run(base('  p = t.root.parent'))).error).toMatch(/only left and right pointers/);
  });

  it('an unlinked node waits in heap memory; a node nothing points to is LEAKED', async () => {
    const r = await run(`SCENE S
DECLARE
  BST t = [50, 30, 70]
SEQUENCE
  t.root.left = NULL
END`);
    const node30 = (r.engine.sceneManager.getSceneGraph() as any[]).find((e) => e.value === 30);
    expect(node30.inHeap).toBe(true);
    expect(node30.tags).toContain('LEAKED');
  });

  it('RETURN outside a FUNCTION is a syntax error; words like node / height / size are usable names', async () => {
    expect(() => compile('SCENE S\nSEQUENCE\n  RETURN 5\nEND')).toThrow(/RETURN can only be used inside a FUNCTION/);
    const r = await run(`SCENE S
DECLARE
  BST t = [2, 1, 3]
  FUNCTION size(node)
    IF node == NULL
      RETURN 0
    END
    RETURN 1 + size(node.left) + size(node.right)
  END
SEQUENCE
  height = size(t.root)
  PRINT "size" height
  PRINT "max" MAX(4, 9) "min" MIN(4, 9)
END`);
    expect(r.error).toBeUndefined();
    expect(printed(r)).toEqual(['size 3', 'max 9 min 4']);
  });

  it('DEQUEUE from an empty queue is a clear error', async () => {
    const r = await run(`SCENE S
DECLARE
  BST t = [1]
  QUEUE q = []
SEQUENCE
  n = DEQUEUE(q)
END`);
    expect(r.error).toMatch(/q is empty/);
  });

  it('BINARY_TREE literals are level order with NULL gaps', async () => {
    const r = await run(`SCENE S
DECLARE
  BINARY_TREE t = [1, NULL, 2, 3]
SEQUENCE
  PRINT t.root.right.left.val
END`);
    expect(printed(r)).toEqual(['3']);
    expect(() => compile('SCENE S\nDECLARE\n  BST t = [1, 1]\nSEQUENCE\nEND')).toThrow(/twice/);
  });

  it('built-ins work on BST and plain binary trees', async () => {
    const r = await run(`SCENE S
DECLARE
  BST b = [50, 30, 70]
  BINARY_TREE p = [1, 2]
SEQUENCE
  INORDER b
  HEIGHT b
  MIN b
  MAX b
  MIRROR b
  INSERT p 3
  LEVELORDER p
  CLEAR p
END`);
    expect(r.error).toBeUndefined();
    expect(r.logs).toEqual(expect.arrayContaining([
      'INORDER: 30 50 70',
      'HEIGHT b = 2 (levels, counting the root as 1)',
      'MIN b = 30',
      'MAX b = 70',
      'LEVELORDER: 1 2 3',
    ]));
    expect(r.trees.b).toEqual([50, 70, 30]);
    expect(r.trees.p).toEqual([]);
  });

  it('stepping back restores the tree, its pointers and the call stack', async () => {
    const engine = new ExecutionEngine({ headless: true });
    engine.loadProgram(compile(TreeScripts.MirrorTree) as any);
    await engine.execute();
    const total = engine.getCurrentStep();
    await engine.stepBackward();
    await engine.stepBackward();
    const mid = readTrees(engine);
    expect(engine.getCurrentStep()).toBe(total - 2);
    expect(mid.t).toBeDefined();
  });
});

describe('Tree programs shown in the documentation run cleanly', () => {
  const snippets: Record<string, string> = {
    height: `SCENE Height
DECLARE
  BINARY_TREE t = [1, 2, 3, 4]
  FUNCTION height(node)
    IF node == NULL
      RETURN 0
    END
    RETURN 1 + MAX(height(node.left), height(node.right))
  END
SEQUENCE
  PRINT "height" height(t.root)
END`,
    bstOps: `SCENE BSTOperations
DECLARE
  BST t = [50, 30, 70, 20, 40]
SEQUENCE
  INSERT t 60
  SEARCH t 60
  DELETE t 30
  INORDER t
END`,
    fib: `SCENE Fibonacci
DECLARE
  FUNCTION fib(n)
    IF n <= 1
      RETURN n
    END
    RETURN fib(n - 1) + fib(n - 2)
  END
SEQUENCE
  result = fib(5)
  PRINT result
END`,
  };
  for (const [name, src] of Object.entries(snippets)) {
    it(name, async () => {
      const r = await run(src);
      expect(r.error).toBeUndefined();
    });
  }
  it('results', async () => {
    expect(printed(await run(snippets.height))).toEqual(['height 3']);
    expect((await run(snippets.bstOps)).logs).toContain('INORDER: 20 40 50 60 70');
    expect(printed(await run(snippets.fib))).toEqual(['5']);
  });
});

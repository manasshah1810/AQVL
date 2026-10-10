import type { Kernel } from '../types';
import { bfsOrder, dfsOrder, graphOf, str, strs } from './ref';

function components(edges: string[]): number {
  const g = graphOf(edges);
  const seen = new Set<string>();
  let count = 0;
  for (const v of g.vertices) {
    if (seen.has(v)) continue;
    count++;
    dfsOrder(g, v, seen);
  }
  return count;
}

/** Kahn's algorithm: ready vertices in vertex order, then in the order they become ready. */
function kahn(edges: string[]): string[] {
  const g = graphOf(edges);
  const need = new Map(g.inDegree);
  const ready = g.vertices.filter((v) => need.get(v) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    const v = ready.shift()!;
    order.push(v);
    for (const w of g.adj.get(v)!) {
      need.set(w, need.get(w)! - 1);
      if (need.get(w) === 0) ready.push(w);
    }
  }
  return order;
}

const GRAPH_NOTE = 'edges: "A-B" joins A and B; a lone "D" is a vertex with no edges. Neighbours are visited in the order the edges are listed.';

export const GRAPH_KERNELS: Kernel[] = [
  {
    id: 'graph-bfs',
    title: 'Breadth-first search',
    topic: 'Graphs',
    difficulty: 'Medium',
    goal: 'Collect in order the names of the vertices reachable from start, in breadth-first order.',
    source: `SCENE BreadthFirst

DECLARE
  GRAPH g = {{edges}}
  QUEUE q = []
  ARRAY order = []

SEQUENCE
  start = VERTEX(g, {{start}})
  start.visited = TRUE
  ENQUEUE q start
  WHILE LENGTH(q) > 0
    v = [[DEQUEUE(q)]]
    INSERT order[LENGTH(order)] v.name
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == [[FALSE]]
        w.visited = TRUE
        ENQUEUE q w
      END
      i = i + 1
    END
  END
END`,
    blanks: [
      ['FRONT(q)', 'REAR(q)'],
      ['TRUE', 'w.visited'],
    ],
    bug: {
      find: 'w.visited = TRUE',
      replace: 'w.seen = TRUE',
      fixes: ['v.visited = TRUE', 'start.visited = TRUE'],
      why: 'Neighbours were never marked visited when they were queued, so they were queued again and again.',
    },
    core: { first: 'WHILE LENGTH(q) > 0', last: 'END' },
    hints: [
      'A queue explores the graph in rings: first start, then its neighbours, then theirs. Mark a vertex visited the moment you queue it, so nothing is queued twice.',
      'v = DEQUEUE(q); for each neighbour w not yet visited: w.visited = TRUE and ENQUEUE q w.',
    ],
    inputNote: GRAPH_NOTE,
    visible: [
      { edges: ['A-B', 'A-C', 'B-D', 'C-D', 'D-E'], start: 'A' },
      { edges: ['A-B', 'B-C', 'C-D', 'D-A'], start: 'C' },
      { edges: ['S-A', 'S-B', 'A-C', 'B-C', 'C-T'], start: 'S' },
    ],
    hidden: [
      { category: 'edge case: unreachable vertices', input: { edges: ['A-B', 'C-D'], start: 'A' } },
      { category: 'edge case: a single vertex', input: { edges: ['A'], start: 'A' } },
    ],
    preview: { edges: ['A-B', 'A-C'], start: 'A' },
    expect: (input) => [{ kind: 'array', name: 'order', value: bfsOrder(graphOf(strs(input, 'edges')), str(input, 'start')).order }],
  },
  {
    id: 'graph-dfs',
    title: 'Depth-first search',
    topic: 'Graphs',
    difficulty: 'Medium',
    goal: 'Collect in order the names of the vertices reachable from start, in recursive depth-first order.',
    source: `SCENE DepthFirst

DECLARE
  GRAPH g = {{edges}}
  ARRAY order = []

  FUNCTION dfs(v)
    v.visited = TRUE
    INSERT order[LENGTH(order)] v.name
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF [[w.visited]] == FALSE
        [[dfs(w)]]
      END
      i = i + 1
    END
  END

SEQUENCE
  dfs(VERTEX(g, {{start}}))
END`,
    blanks: [
      ['v.visited', 'w.name'],
      ['dfs(v)', 'w.visited = TRUE'],
    ],
    bug: {
      find: 'v.visited = TRUE',
      replace: 'v.visited = FALSE',
      fixes: ['v.visited = v.visited', 'v.name = TRUE'],
      why: 'No vertex was ever marked visited, so the search kept walking back and forth along the same edges until the call stack overflowed.',
    },
    core: { first: 'v.visited = TRUE', last: 'END' },
    hints: [
      'Visit a vertex, then for each neighbour you have not visited yet, go as deep as you can from it before trying the next neighbour.',
      'IF w.visited == FALSE, dfs(w).',
    ],
    inputNote: GRAPH_NOTE,
    visible: [
      { edges: ['A-B', 'A-C', 'B-D', 'C-D', 'D-E'], start: 'A' },
      { edges: ['1-2', '1-3', '2-4', '3-4', '4-5'], start: '1' },
      { edges: ['A-B', 'B-C', 'C-A', 'C-D'], start: 'D' },
    ],
    hidden: [
      { category: 'edge case: unreachable vertices', input: { edges: ['A-B', 'C-D'], start: 'C' } },
      { category: 'edge case: a single vertex', input: { edges: ['X'], start: 'X' } },
    ],
    preview: { edges: ['A-B', 'B-C'], start: 'A' },
    expect: (input) => [{ kind: 'array', name: 'order', value: dfsOrder(graphOf(strs(input, 'edges')), str(input, 'start')) }],
  },
  {
    id: 'graph-shortest-hops',
    title: 'Fewest hops',
    topic: 'Graphs',
    difficulty: 'Medium',
    goal: 'Leave in hops the fewest edges on a path from start to goal (-1 when goal cannot be reached).',
    source: `SCENE FewestHops

DECLARE
  GRAPH g = {{edges}}
  QUEUE q = []

SEQUENCE
  s = VERTEX(g, {{start}})
  goal = VERTEX(g, {{goal}})
  s.visited = TRUE
  s.dist = 0
  ENQUEUE q s
  WHILE LENGTH(q) > 0
    v = DEQUEUE(q)
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        w.visited = TRUE
        w.dist = [[v.dist + 1]]
        ENQUEUE q [[w]]
      END
      i = i + 1
    END
  END
  hops = -1
  IF goal.visited == TRUE
    hops = goal.dist
  END
END`,
    blanks: [
      ['v.dist', '1', 'w.dist + 1'],
      ['v', 's'],
    ],
    bug: {
      find: 'w.visited = TRUE',
      replace: 'w.visited = FALSE',
      fixes: ['v.visited = TRUE', 's.visited = TRUE'],
      why: 'A reached vertex was never marked, so it was reached again by longer paths that overwrote its distance (and the search did not stop).',
    },
    core: { first: 'WHILE LENGTH(q) > 0', last: 'END' },
    hints: ['Breadth-first search reaches vertices in order of distance. A vertex found from v is one hop further than v.', 'w.dist = v.dist + 1, then ENQUEUE q w.'],
    inputNote: GRAPH_NOTE,
    visible: [
      { edges: ['A-B', 'B-C', 'C-D', 'A-E', 'E-D'], start: 'A', goal: 'D' },
      { edges: ['A-B', 'B-C', 'C-D', 'D-E'], start: 'A', goal: 'E' },
      { edges: ['A-B', 'A-C', 'C-D', 'B-D'], start: 'D', goal: 'A' },
    ],
    hidden: [
      { category: 'edge case: goal unreachable', input: { edges: ['A-B', 'C-D'], start: 'A', goal: 'D' } },
      { category: 'edge case: start is the goal', input: { edges: ['A-B'], start: 'B', goal: 'B' } },
    ],
    preview: { edges: ['A-B', 'B-C'], start: 'A', goal: 'C' },
    expect: (input) => {
      const { dist } = bfsOrder(graphOf(strs(input, 'edges')), str(input, 'start'));
      return [{ kind: 'var', name: 'hops', value: dist.get(str(input, 'goal')) ?? -1 }];
    },
  },
  {
    id: 'graph-components',
    title: 'Connected components',
    topic: 'Graphs',
    difficulty: 'Medium',
    goal: 'Leave in components the number of separate pieces of the graph.',
    source: `SCENE ConnectedComponents

DECLARE
  GRAPH g = {{edges}}

  FUNCTION explore(u)
    u.visited = TRUE
    i = 0
    WHILE i < DEGREE(u)
      w = NEIGHBOR(u, i)
      IF w.visited == FALSE
        explore(w)
      END
      i = i + 1
    END
  END

SEQUENCE
  components = 0
  k = 0
  WHILE k < VERTEX_COUNT(g)
    v = VERTEX_AT(g, k)
    IF v.visited == [[FALSE]]
      components = components + [[1]]
      explore(v)
    END
    k = k + 1
  END
END`,
    blanks: [
      ['TRUE', 'v.dist'],
      ['0', 'k'],
    ],
    bug: {
      find: 'explore(v)',
      replace: 'v.visited = TRUE',
      fixes: ['explore(VERTEX_AT(g, 0))', 'components = components + 1'],
      why: 'Only the vertex itself was marked, not the rest of its piece, so every vertex was counted as a component of its own.',
    },
    core: { first: 'WHILE k < VERTEX_COUNT(g)', last: 'END' },
    hints: ['Go through the vertices in order. An unvisited one starts a new component: count it, then visit everything connected to it so it is not counted again.', 'IF v.visited == FALSE: components = components + 1, then explore(v).'],
    inputNote: GRAPH_NOTE,
    visible: [{ edges: ['A-B', 'B-C', 'D-E', 'F'] }, { edges: ['A-B', 'C-D', 'E-F', 'B-C'] }, { edges: ['1-2', '2-3', '3-1'] }],
    hidden: [
      { category: 'edge case: no edges', input: { edges: ['A', 'B', 'C'] } },
      { category: 'edge case: a single vertex', input: { edges: ['A'] } },
    ],
    preview: { edges: ['A-B', 'C'] },
    expect: (input) => [{ kind: 'var', name: 'components', value: components(strs(input, 'edges')) }],
  },
  {
    id: 'graph-topo-kahn',
    title: "Topological sort (Kahn's)",
    topic: 'Graphs',
    difficulty: 'Hard',
    goal: 'List in order every vertex of the directed graph so that each edge points forward, taking vertices once nothing is left pointing into them.',
    source: `SCENE TopologicalSort

DECLARE
  GRAPH g = {{edges}}
  QUEUE ready = []
  ARRAY order = []

SEQUENCE
  k = 0
  WHILE k < VERTEX_COUNT(g)
    v = VERTEX_AT(g, k)
    v.need = IN_DEGREE(v)
    IF v.need == 0
      ENQUEUE ready v
    END
    k = k + 1
  END
  WHILE LENGTH(ready) > 0
    v = DEQUEUE(ready)
    INSERT order[LENGTH(order)] v.name
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      w.need = [[w.need - 1]]
      IF w.need == [[0]]
        ENQUEUE ready w
      END
      i = i + 1
    END
  END
END`,
    blanks: [
      ['w.need + 1', 'IN_DEGREE(w) - 1'],
      ['1', '-1'],
    ],
    bug: {
      find: 'v.need = IN_DEGREE(v)',
      replace: 'v.need = DEGREE(v)',
      fixes: ['v.need = 0', 'v.need = IN_DEGREE(v) - 1'],
      why: 'DEGREE counts the edges leaving a vertex; a vertex is ready when no edges come into it, which is IN_DEGREE.',
    },
    core: { first: 'WHILE LENGTH(ready) > 0', last: 'END' },
    hints: [
      'Count the edges coming into each vertex. Vertices with none can go first; taking one removes its outgoing edges, which may free up its neighbours.',
      'For each neighbour w of the taken vertex: w.need = w.need - 1, and IF w.need == 0, ENQUEUE ready w.',
    ],
    inputNote: 'edges: "A->B" means A must come before B. Vertices start in order of first appearance.',
    visible: [
      { edges: ['A->C', 'B->C', 'C->D', 'D->E'] },
      { edges: ['Shirt->Tie', 'Tie->Jacket', 'Trousers->Shoes', 'Trousers->Belt', 'Belt->Jacket'] },
      { edges: ['1->2', '1->3', '2->4', '3->4'] },
    ],
    hidden: [
      { category: 'edge case: a chain', input: { edges: ['A->B', 'B->C', 'C->D'] } },
      { category: 'edge case: a vertex with no edges', input: { edges: ['A->B', 'C'] } },
    ],
    preview: { edges: ['A->B', 'A->C'] },
    expect: (input) => [{ kind: 'array', name: 'order', value: kahn(strs(input, 'edges')) }],
  },
];

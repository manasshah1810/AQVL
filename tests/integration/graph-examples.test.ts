/**
 * The Playground's Graph examples and the graph language features they use
 * (vertex references, fields, NEIGHBOR / DEGREE / WEIGHT / ..., ADD_EDGE,
 * queues and stacks of vertices, recursion over vertices), run end-to-end
 * (compile -> ExecutionEngine with the real AnimationController).
 *
 * Every example must do its work with real code — loops, IFs, a queue /
 * stack or recursion — rather than a one-line DFS / BFS / DIJKSTRA command,
 * so these tests pin each example's console output (checked by hand against
 * the textbook answers) and the final state of its graph.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { GraphScripts } from '../../packages/demo/src/examples/GraphLibrary';
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
  return { engine, logs, keywords, error };
}

const printed = (r: RunResult) => r.logs.filter((_, i) => r.keywords[i] === 'PRINT');
const el = (r: RunResult, id: string) => r.engine.sceneManager.getElement(id) as any;
const vertex = (r: RunResult, graph: string, name: string) => el(r, `gv:${graph}:${name}`);
const edgesOf = (r: RunResult, graph: string) =>
  (r.engine.sceneManager.getSceneGraph() as any[]).filter((e) => e.originalType === 'GRAPH_EDGE' && e.logicalParent === graph);
const edgeName = (r: RunResult, e: any) => `${el(r, e.sourceId).value}-${el(r, e.targetId).value}`;
/** SUCCESS in the semantic palette: visited vertices and tree edges. */
const GREEN = '#10b981';

const EXPECTED_OUTPUT: Record<string, string[]> = {
  GraphBasics: [
    "Adjacency list: Asha: Ben Chen | Ben: Asha Dev | Chen: Asha Dev | Dev: Ben Chen Esha | Esha: Dev | Ravi: -",
    "People: 6   Friendships: 5",
    "Asha has 2 friend(s):  Ben Chen",
    "Ben has 2 friend(s):  Asha Dev",
    "Chen has 2 friend(s):  Asha Dev",
    "Dev has 3 friend(s):  Ben Chen Esha",
    "Esha has 1 friend(s):  Dev",
    "Ravi has no friends in this network yet",
    "Most connected: Dev with 3 friends",
    "Asha and Dev are NOT direct friends (they share friends Ben and Chen)",
    "After the changes: Asha: Ben Chen Gita | Ben: Asha Dev | Chen: Asha | Dev: Ben Esha | Esha: Dev Ravi | Ravi: Esha | Gita: Asha",
    "Sum of all degrees = 12 = 2 x 6 edges",
  ],
  DirectedWeighted: [
    "Routes: DEL: BOM(2) CCU(2) | BOM: GOI(1) BLR(2) | CCU: BLR(2) MAA(3) | GOI: BLR(1) | BLR: MAA(1) | MAA: DEL(3)",
    "DEL : out 2  in 1  ->  BOM(2h) CCU(2h)",
    "BOM : out 2  in 1  ->  GOI(1h) BLR(2h)",
    "CCU : out 2  in 1  ->  BLR(2h) MAA(3h)",
    "GOI : out 1  in 1  ->  BLR(1h)",
    "BLR : out 1  in 3  ->  MAA(1h)",
    "MAA : out 1  in 2  ->  DEL(3h)",
    "Busiest airport: BLR",
    "Direct flight DEL -> BOM takes 2 hours",
    "No direct flight BOM -> DEL (edges are one-way)",
    "Longest flight: CCU->MAA(3)   Total hours on the timetable: 17",
    "GOI now has 2 departures",
  ],
  AdjacencyMatrix: [
    "Adjacency list: A: B C | B: A C | C: A B D | D: C E | E: D",
    "    A B C D E",
    "A | 0 1 1 0 0",
    "B | 1 0 1 0 0",
    "C | 1 1 0 1 0",
    "D | 0 0 1 0 1",
    "E | 0 0 0 1 0",
    "Cells with 1: 10   edges = 5",
    "Matrix size: 25 cells.  List size: 10 entries",
    "A sparse graph (few edges) is cheaper as a list; a dense one fits a matrix.",
  ],
  BreadthFirstSearch: [
    "BFS visiting order:  Asha Ben Chen Dev Esha Ravi Gita",
    "1 step(s) from Asha:  Ben Chen",
    "2 step(s) from Asha:  Dev Esha",
    "3 step(s) from Asha:  Ravi",
    "4 step(s) from Asha:  Gita",
    "Mia cannot be reached from Asha",
    "Noor cannot be reached from Asha",
  ],
  ShortestPathBFS: [
    "Route:  Park Mall Zoo Dock",
    "Stops travelled: 3",
  ],
  DepthFirstSearch: [
    "DFS exploring order:  Gate Hall Lib Tower Cave Pool Well Vault",
    "Rooms explored: 8 of 8",
  ],
  RecursiveDFS: [
    "Crawling Home",
    "Crawling About",
    "Crawling Team",
    "Crawling Blog",
    "Crawling Post1",
    "Crawling Post2",
    "   Post2 -> Home already crawled, skip",
    "   Home -> Blog already crawled, skip",
    "Pages reachable from Home: 6",
    "Orphan page (no links to it from Home's pages): Old",
  ],
  ConnectedComponents: [
    "Network 1 :  PC1 PC3 PC2",
    "Network 2 :  PC4 PC5",
    "Network 3 :  PC6",
    "Network 4 :  PC7 PC8 PC9",
    "Separate networks: 4",
    "PC3 and PC5 cannot talk: networks 1 and 2",
  ],
  UndirectedCycle: [
    "Vertices: 6  Edges: 5",
    "No loop: the network is a tree — 5 edges = V - 1",
    "Loop closed by the pipe P3 - P1",
    "After adding P2-P4 the network has a loop",
  ],
  DirectedCycle: [
    "Cycle found: Stats -> ML -> AI -> Ethics -> Stats",
    "These prerequisites can never all be satisfied.",
  ],
  BipartiteCheck: [
    "Two teams are possible:",
    "Team 0 :  Ana Dan Fay",
    "Team 1 :  Bo Cy Eve",
    "Conflict: Eve and Fay are rivals but both in team 1",
    "After Dan-Fay: impossible — Dan, Eve and Fay are all rivals of each other",
  ],
  TopologicalSortKahn: [
    "Take the courses in this order:  Intro Maths Web DSA Algo Proj",
  ],
  TopologicalSortDFS: [
    "Step 1 : put on Watch",
    "Step 2 : put on Shirt",
    "Step 3 : put on Tie",
    "Step 4 : put on Pants",
    "Step 5 : put on Belt",
    "Step 6 : put on Coat",
    "Step 7 : put on Socks",
    "Step 8 : put on Shoes",
    "Dressing order:  Watch Shirt Tie Pants Belt Coat Socks Shoes",
  ],
  DijkstraShortestPath: [
    "Finalised Shop at 0 km",
    "Finalised Park at 1 km",
    "Finalised Mkt at 3 km",
    "Finalised Bank at 8 km",
    "Finalised Gym at 9 km",
    "Finalised Home at 11 km",
    "Shortest route Shop -> Home:  Shop Park Gym Home",
    "Distance: 11 km",
  ],
  BellmanFordAlgorithm: [
    "After round 1 : Ridge 4  Mill 5  Port INFINITY  Dock INFINITY",
    "After round 2 : Ridge 4  Mill 1  Port 9  Dock 8",
    "After round 3 : Ridge 4  Mill 1  Port 5  Dock 8",
    "After round 4 : Ridge 4  Mill 1  Port 5  Dock 7",
    "No negative cycle. Cheapest battery use to Dock: 7",
  ],
  PrimsMST: [
    "Lay cable HQ - Shop : 3 km",
    "Lay cable Shop - Lab : 1 km",
    "Lay cable Lab - Depot : 2 km",
    "Lay cable Depot - Cafe : 3 km",
    "Total cable: 9 km for 4 links",
  ],
  KruskalsMST: [
    "Keep Ash-Cove(5)",
    "Keep Dale-Elm(5)",
    "Keep Dale-Fen(6)",
    "Keep Ash-Bay(7)",
    "Keep Bay-Elm(7)",
    "Skip Bay-Cove(8) — both already connected (would make a cycle)",
    "Skip Elm-Fen(8) — both already connected (would make a cycle)",
    "Skip Bay-Dale(9) — both already connected (would make a cycle)",
    "Keep Elm-Glen(9)",
    "Skip Fen-Glen(11) — both already connected (would make a cycle)",
    "Skip Cove-Dale(15) — both already connected (would make a cycle)",
    "Roads kept: 6  Total length: 39",
  ],
  CountAllPaths: [
    "Route: Home -> Park -> Mall -> Lib -> School",
    "Route: Home -> Park -> School",
    "Route: Home -> Park -> Lib -> School",
    "Route: Home -> Mall -> Park -> School",
    "Route: Home -> Mall -> Park -> Lib -> School",
    "Route: Home -> Mall -> Lib -> School",
    "Route: Home -> Mall -> Lib -> Park -> School",
    "Number of different routes: 7",
  ],
  GreedyColoring: [
    "Slot 1 :  Maths Bio Art",
    "Slot 2 :  Phys Eng Hist",
    "Slot 3 :  Chem",
    "Time slots needed: 3",
  ],
};


describe('Graph examples produce correct results', () => {
  for (const [name, lines] of Object.entries(EXPECTED_OUTPUT)) {
    it(`${name}: runs without errors and prints the expected results`, async () => {
      const r = await run((GraphScripts as Record<string, string>)[name]);
      expect(r.error).toBeUndefined();
      expect(printed(r)).toEqual(lines);
    });
  }

  it('BFS: every reached vertex keeps dist / parent, drawn in green with its tree edges', async () => {
    const r = await run(GraphScripts.BreadthFirstSearch);
    expect(vertex(r, 'people', 'Ravi').fields).toMatchObject({ visited: true, dist: 3, parent: 'gv:people:Dev' });
    expect(vertex(r, 'people', 'Ravi').label).toBe('dist=3  parent=Dev');
    expect(vertex(r, 'people', 'Ravi').color).toBe(GREEN);
    expect(vertex(r, 'people', 'Mia').color).not.toBe(GREEN);
    // The BFS tree: one parent edge per reached vertex except the start.
    const tree = edgesOf(r, 'people').filter((e) => e.marked).map((e) => edgeName(r, e));
    expect(tree.sort()).toEqual(['Asha-Ben', 'Asha-Chen', 'Ben-Dev', 'Chen-Esha', 'Dev-Ravi', 'Ravi-Gita'].sort());
    // A real queue: each of the 7 reachable people is dequeued exactly once.
    expect(r.keywords.filter((k) => k === 'DEQUEUE')).toHaveLength(7);
  });

  it("Dijkstra: final distances, and the shortest-path tree is exactly the parent edges", async () => {
    const r = await run(GraphScripts.DijkstraShortestPath);
    const dist = Object.fromEntries(['Shop', 'Park', 'Mkt', 'Bank', 'Gym', 'Home'].map((n) => [n, vertex(r, 'town', n).fields.dist]));
    expect(dist).toEqual({ Shop: 0, Park: 1, Mkt: 3, Bank: 8, Gym: 9, Home: 11 });
    const tree = edgesOf(r, 'town').filter((e) => e.marked).map((e) => edgeName(r, e));
    expect(tree.sort()).toEqual(['Shop-Park', 'Park-Mkt', 'Mkt-Bank', 'Park-Gym', 'Gym-Home'].sort());
  });

  it("Kruskal: the edges marked inTree form the minimum spanning tree (weight 39)", async () => {
    const r = await run(GraphScripts.KruskalsMST);
    // Field names are case-insensitive (stored lower-case, like tree fields): `e.inTree` is `intree`.
    const chosen = edgesOf(r, 'roads').filter((e) => e.fields.intree === true);
    expect(chosen).toHaveLength(6);
    expect(chosen.reduce((sum, e) => sum + e.weight, 0)).toBe(39);
    expect(chosen.every((e) => e.color === GREEN)).toBe(true);
  });

  it("Prim: the parent edges form a spanning tree of total weight 9", async () => {
    const r = await run(GraphScripts.PrimsMST);
    const tree = edgesOf(r, 'offices').filter((e) => e.marked);
    expect(tree).toHaveLength(4);
    expect(tree.reduce((sum, e) => sum + e.weight, 0)).toBe(9);
  });

  it('Connected components and greedy colouring paint vertices by their number', async () => {
    const cc = await run(GraphScripts.ConnectedComponents);
    expect(vertex(cc, 'lan', 'PC1').color).toBe(vertex(cc, 'lan', 'PC3').color);
    expect(vertex(cc, 'lan', 'PC1').color).not.toBe(vertex(cc, 'lan', 'PC4').color);
    const gc = await run(GraphScripts.GreedyColoring);
    // Neighbours never share a slot.
    for (const e of edgesOf(gc, 'exams')) {
      expect(el(gc, e.sourceId).fields.slot).not.toBe(el(gc, e.targetId).fields.slot);
    }
  });

  it('Recursive examples animate every call and return', async () => {
    const r = await run(GraphScripts.RecursiveDFS);
    expect(r.keywords.filter((k) => k === 'CALL')).toHaveLength(6);
    expect(r.keywords.filter((k) => k === 'RETURN')).toHaveLength(6);
    expect(r.logs).toContain('│  crawl(About)');
  });

  it('are all registered, and every one uses real loops / recursion, not one-line graph commands', () => {
    const graphs = EXAMPLES.filter((e) => e.category === 'Graphs');
    expect(graphs).toHaveLength(Object.keys(GraphScripts).length);
    for (const ex of graphs) {
      expect(Object.values(GraphScripts)).toContain(ex.source);
      expect(/\bWHILE\b|\bFUNCTION\b|\bLOOP\b/.test(ex.source)).toBe(true);
      expect(/^\s*(DFS|BFS|DIJKSTRA|BELLMAN_FORD|ASTAR|PRIM|KRUSKAL|TOPO_SORT)\b/m.test(ex.source)).toBe(false);
    }
    expect(new Set(graphs.map((e) => e.id)).size).toBe(graphs.length);
  });
});

describe('Graph language', () => {
  const program = (decl: string, body: string) => `SCENE S
DECLARE
  ${decl}
SEQUENCE
${body}
END
`;

  it('TRUE / FALSE / INFINITY literals', async () => {
    const r = await run(program('ARRAY a = [1]', '  x = TRUE\n  y = INFINITY\n  IF x == TRUE AND y > 1000000\n    PRINT "ok" FALSE y\n  END'));
    expect(printed(r)).toEqual(['ok FALSE INFINITY']);
  });

  it('PRINT g lists adjacency; directed "A->B" and the older "A>B" both work', async () => {
    const a = await run(program('GRAPH g = ["A->B:3", "A->C:1", "D"]', '  PRINT g'));
    expect(printed(a)).toEqual(['A: B(3) C(1) | B: - | C: - | D: -']);
    const b = await run(program('GRAPH g = ["A>B", "B>C"]', '  PRINT g'));
    expect(printed(b)).toEqual(['A: B | B: C | C: -']);
  });

  it('NEIGHBOR / DEGREE / IN_DEGREE / WEIGHT / HAS_EDGE follow edge order and direction', async () => {
    const r = await run(program('GRAPH g = ["A->B:3", "C->A:2", "A->C:7"]', [
      '  a = VERTEX(g, "A")',
      '  c = VERTEX(g, "C")',
      '  PRINT DEGREE(a) IN_DEGREE(a) NEIGHBOR(a, 0) NEIGHBOR(a, 1)',
      '  PRINT WEIGHT(a, c) WEIGHT(c, a) HAS_EDGE(a, c) HAS_EDGE(VERTEX(g, "B"), a)',
      '  PRINT VERTEX_COUNT(g) EDGE_COUNT(g) LENGTH(g) VERTEX_AT(g, 2) EDGE_AT(g, 1)',
    ].join('\n')));
    expect(r.error).toBeUndefined();
    expect(printed(r)).toEqual(['2 1 B C', '7 2 TRUE FALSE', '3 3 3 C C->A(2)']);
  });

  it('ADD_VERTEX / ADD_EDGE / REMOVE_EDGE / REMOVE_VERTEX change the graph', async () => {
    const r = await run(program('GRAPH g = ["A-B"]', [
      '  ADD_VERTEX g "C"',
      '  ADD_EDGE g "B" "C" 5',
      '  ADD_EDGE g "A" "C"',
      '  PRINT g',
      '  REMOVE_EDGE g "A" "B"',
      '  REMOVE_VERTEX g "C"',
      '  PRINT g EDGE_COUNT(g)',
    ].join('\n')));
    expect(r.error).toBeUndefined();
    // Adding a weight makes the graph weighted: every edge shows its weight.
    expect(printed(r)).toEqual(['A: B(1) C(1) | B: A(1) C(5) | C: B(5) A(1)', 'A: - | B: - 0']);
    expect(edgesOf(r, 'g')).toHaveLength(0);
  });

  it('ADD_EDGE to a name not in the graph yet adds that vertex, like the declaration does', async () => {
    const r = await run(program('GRAPH g = ["A-B"]', '  ADD_EDGE g "B" "C"\n  PRINT g'));
    expect(r.error).toBeUndefined();
    expect(r.logs).toContain('ADD_EDGE g "B" "C"   ⟹   edge B-C added (new vertex C)');
    expect(printed(r)).toEqual(['A: B | B: A C | C: B']);
  });

  it('queues and stacks hold vertices, shown by name; pointer variables become vertex tags', async () => {
    const r = await run(program('GRAPH g = ["A-B"]\n  QUEUE q = []', [
      '  ENQUEUE q VERTEX(g, "B")',
      '  v = DEQUEUE(q)',
      '  PRINT v v.name',
    ].join('\n')));
    expect(r.error).toBeUndefined();
    expect(r.logs).toContain('ENQUEUE q VERTEX(g, "B")   ⟹   vertex B joins the rear of q   q (front → rear): [B]');
    expect(printed(r)).toEqual(['B B']);
    expect(vertex(r, 'g', 'B').tags).toEqual(['v']);
  });

  it('a vertex name is never mistaken for a variable of the same name', async () => {
    const r = await run(program('GRAPH g = ["A-B"]', '  A = 5\n  v = VERTEX(g, "A")\n  PRINT v A'));
    expect(printed(r)).toEqual(['A 5']);
  });

  it('run-time mistakes are clear errors', async () => {
    const cases: [string, string, RegExp][] = [
      ['GRAPH g = ["A-B"]', '  v = VERTEX(g, "Z")', /no vertex named "Z".*A, B/],
      ['GRAPH g = ["A-B"]', '  w = NEIGHBOR(VERTEX(g, "A"), 1)', /A has 1 neighbour — valid indexes are 0 to 0, not 1/],
      ['GRAPH g = ["A-B", "C"]', '  w = NEIGHBOR(VERTEX(g, "C"), 0)', /has no neighbours.*WHILE i < DEGREE\(v\)/],
      ['GRAPH g = ["A-B"]', '  PRINT VERTEX(g, "A").dist', /\.dist has not been set yet \(vertex A\)/],
      ['GRAPH g = ["A-B"]', '  v = VERTEX(g, "A")\n  v.name = "Q"', /cannot be assigned/],
      ['GRAPH g = ["A-B", "C"]', '  PRINT WEIGHT(VERTEX(g, "A"), VERTEX(g, "C"))', /no edge from A to C/],
      ['GRAPH g = ["A-B"]', '  v = NULL\n  PRINT v.visited', /NULL pointer dereference/],
      ['GRAPH g = ["A-B"]', '  ADD_EDGE g "A" "B"', /already an edge A-B/],
      ['GRAPH g = ["A-B"]', '  x = 3\n  PRINT DEGREE(x)', /x is not a vertex/],
    ];
    for (const [decl, body, message] of cases) {
      const r = await run(program(decl, body));
      expect(r.error, body).toMatch(message);
    }
  });

  it('an unset visited field reads FALSE; declaration mistakes are compile errors', async () => {
    const r = await run(program('GRAPH g = ["A-B"]', '  PRINT VERTEX(g, "B").visited'));
    expect(printed(r)).toEqual(['FALSE']);
    expect(() => compile(program('GRAPH g = ["A-B", "B->C"]', '  PRINT g'))).toThrow(/mixes directed/);
    expect(() => compile(program('GRAPH g = ["A-B", "B-A"]', '  PRINT g'))).toThrow(/twice/);
    expect(() => compile(program('GRAPH g = ["A-B:x"]', '  PRINT g'))).toThrow(/must be a number/);
  });

  it('the one-line graph commands still work on graphs with the new vertex ids', async () => {
    const r = await run(program('GRAPH g = ["A-B", "A-C", "B-D"]', '  BFS g FROM A'));
    expect(r.error).toBeUndefined();
    expect(r.logs.some((l) => l.includes('A → B → C → D'))).toBe(true);
  });
});

describe('Graph documentation snippets run', () => {
  const repo = resolve(__dirname, '../..');
  const docsPage = readFileSync(resolve(repo, 'packages/demo/src/pages/Docs.tsx'), 'utf8');
  const graphsPage = docsPage.slice(docsPage.indexOf('id="gp-introduction"'), docsPage.indexOf('id="gp-errors"'));
  const apiRef = readFileSync(resolve(repo, 'docs/API_REFERENCE.md'), 'utf8');
  const apiGraphs = apiRef.slice(apiRef.indexOf('## 7. Graphs'), apiRef.indexOf('## 8. Sorting'));
  const snippets = [
    ...[...graphsPage.matchAll(/code=\{`(SCENE[\s\S]*?)`\}/g)].map((m) => m[1]),
    ...[...apiGraphs.matchAll(/```aqvl\r?\n([\s\S]*?)```/g)].map((m) => m[1]),
  ];

  it('finds the snippets', () => {
    expect(snippets.length).toBeGreaterThanOrEqual(6);
  });

  it('every snippet compiles and runs without errors', async () => {
    for (const code of snippets) {
      const r = await run(code);
      expect(r.error, code.split('\n')[0]).toBeUndefined();
    }
  });

  it('the BFS and Dijkstra snippets print the right answers', async () => {
    const outputs = await Promise.all(snippets.map(async (code) => printed(await run(code))));
    const all = outputs.flat();
    expect(all).toContain('E is 3 steps from A');
    expect(all).toContain('D is 2 steps from A');
    expect(all).toContain('A to D: 4');
  });
});

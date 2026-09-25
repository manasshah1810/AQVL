export const GraphScripts = {
  DepthFirstSearch: `SCENE DepthFirstSearch

DECLARE
  GRAPH g = ["A-B", "A-C", "B-D", "B-E", "C-F"]

SEQUENCE
  // Explore as far as possible along each branch before backtracking
  DFS g FROM A
END
`,

  BreadthFirstSearch: `SCENE BreadthFirstSearch

DECLARE
  GRAPH g = ["A-B", "A-C", "B-D", "B-E", "C-F"]

SEQUENCE
  // Explore level by level, all neighbors before going deeper
  BFS g FROM A
END
`,

  DijkstraShortestPath: `SCENE DijkstraShortestPath

DECLARE
  GRAPH g = ["A-B:4", "A-C:1", "C-B:2", "B-D:1", "C-D:5"]

SEQUENCE
  // Finds the shortest distance from A to every other vertex
  // (works only for non-negative edge weights)
  DIJKSTRA g FROM A
END
`,

  BellmanFordAlgorithm: `SCENE BellmanFordAlgorithm

DECLARE
  GRAPH g = ["A-B:4", "A-C:5", "B-C:-3", "C-D:4"]

SEQUENCE
  // Relaxes every edge V-1 times; also detects negative-weight cycles
  BELLMAN_FORD g FROM A
END
`,

  AStarSearch: `SCENE AStarSearch

DECLARE
  GRAPH g = ["A-B:1", "B-C:1", "A-D:2", "D-C:1"]

SEQUENCE
  // Heuristic-guided search for the shortest path from A to C
  ASTAR g FROM A TO C
END
`,

  PrimsMST: `SCENE PrimsMinimumSpanningTree

DECLARE
  GRAPH g = ["A-B:2", "A-C:3", "B-C:1", "B-D:4", "C-D:5"]

SEQUENCE
  // Grow the minimum spanning tree outward one cheapest edge at a time
  PRIM g FROM A
END
`,

  KruskalsMST: `SCENE KruskalsMinimumSpanningTree

DECLARE
  GRAPH g = ["A-B:2", "A-C:3", "B-C:1", "B-D:4", "C-D:5"]

SEQUENCE
  // Sort all edges by weight, then add each one unless it forms a cycle
  KRUSKAL g
END
`,

  TopologicalSort: `SCENE TopologicalSort

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D", "C->D", "D->E"]

SEQUENCE
  // Linear ordering of vertices that respects every directed edge
  TOPO_SORT g
END
`
};

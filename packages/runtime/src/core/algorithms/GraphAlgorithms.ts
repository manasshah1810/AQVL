/**
 * GraphAlgorithms — Animation handler for graph traversal operations.
 *
 * Registered with AlgorithmRegistry for: DFS, BFS
 *
 * Builds a pure `Graph` (see ../../data-structures/Graph) from the VERTEX /
 * GRAPH_EDGE scene elements belonging to the named graph, delegates the
 * actual traversal to GraphEngine (GraphAlgorithm), then replays its step
 * list against the scene:
 *  - VISIT highlights the vertex (TRAVERSING, matching BSTAlgorithms'
 *    traversal color language), pulsing on visit then settling.
 *  - EDGE highlights the edge used to reach a newly-visited vertex.
 *
 * Vertices are declared with a scene value/label equal to their AQVL name
 * (e.g. `DFS graph FROM A` resolves "A" against VERTEX elements' `value`/
 * `label`, not a generated object id), so `resolveStartVertex` matches on
 * id, value, or label to accept either form.
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { Graph } from '../../data-structures/Graph';
import { GraphAlgorithm, GraphTraversalStep, ShortestPathStep, MSTStep, TopoSortStep } from './GraphEngine';

type TraversalKind = 'DFS' | 'BFS';
type ShortestPathKind = 'DIJKSTRA' | 'BELLMAN_FORD' | 'ASTAR';
type MSTKind = 'PRIM' | 'KRUSKAL';

const TRAVERSAL_LABELS: Record<TraversalKind, string> = {
  DFS: 'Depth-First Search',
  BFS: 'Breadth-First Search',
};

const SHORTEST_PATH_LABELS: Record<ShortestPathKind, string> = {
  DIJKSTRA: "Dijkstra's Algorithm",
  BELLMAN_FORD: 'Bellman-Ford Algorithm',
  ASTAR: 'A* Search',
};

const MST_LABELS: Record<MSTKind, string> = {
  PRIM: "Prim's Algorithm",
  KRUSKAL: "Kruskal's Algorithm",
};

export class GraphAlgorithms implements AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'DFS' || action === 'BFS') {
      this.runTraversal(context, instruction, action);
    } else if (action === 'DIJKSTRA' || action === 'BELLMAN_FORD' || action === 'ASTAR') {
      this.runShortestPath(context, instruction, action);
    } else if (action === 'PRIM' || action === 'KRUSKAL') {
      this.runMST(context, instruction, action);
    } else if (action === 'TOPO_SORT') {
      this.runTopoSort(context, instruction);
    }
  }

  private runTraversal(context: AlgorithmContext, instruction: GenericActionInstruction, kind: TraversalKind): void {
    const label = TRAVERSAL_LABELS[kind];
    const graphName = (instruction as any).payload?.logicalParent || (instruction.args?.[0] as string | undefined);

    if (!graphName) {
      this.log(context, 'ERROR', `${label} requires a graph argument.`, 'warning');
      return;
    }

    const sceneElements = context.sceneManager.getSceneGraph() as any[];
    const vertexElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && el.originalType === 'VERTEX'
    );
    const edgeElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && (el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE')
    );

    if (vertexElements.length === 0) {
      this.log(context, kind, `Graph "${graphName}" has no vertices. Nothing to traverse.`, 'warning');
      return;
    }

    const directed = edgeElements.some((el) => el.directed === true);
    const graph = new Graph<any>([], [], directed, false);
    for (const el of vertexElements) graph.addVertex(el.id, el);
    for (const el of edgeElements) graph.addEdge(el.sourceId, el.targetId);

    const startArg = instruction.args && instruction.args.length > 1 ? String(instruction.args[instruction.args.length - 1]) : undefined;
    const startEl = startArg
      ? vertexElements.find((el) => el.id === startArg || String(el.value) === startArg || el.label === startArg)
      : vertexElements[0];

    if (!startEl) {
      this.log(context, 'ERROR', `${label}: start vertex "${startArg}" not found in "${graphName}".`, 'warning');
      return;
    }

    this.log(context, kind, `Starting ${label} on ${graphName} from ${startEl.value ?? startEl.label}...`, 'operation');

    const algorithm = new GraphAlgorithm<any>(graph);
    const result = kind === 'DFS' ? algorithm.depthFirstSearch(startEl.id) : algorithm.breadthFirstSearch(startEl.id);

    const traversingToken = getSemanticColorToken('TRAVERSING');
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const neutralColor = context.defaultColor;

    const getVertexEl = (id: string): any => vertexElements.find((el) => el.id === id);
    const getEdgeEl = (fromId: string, toId: string): any =>
      edgeElements.find(
        (el) =>
          (el.sourceId === fromId && el.targetId === toId) ||
          (!directed && el.sourceId === toId && el.targetId === fromId)
      );

    const visitOrder: any[] = [];

    result.animationFrames.forEach((step: GraphTraversalStep) => {
      if (step.type === 'EDGE') {
        const edgeEl = getEdgeEl(step.fromId, step.toId);
        if (!edgeEl) return;

        context.scheduler.enqueue({ targets: edgeEl, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.7, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      } else if (step.type === 'VISIT') {
        const el = getVertexEl(step.vertexId);
        if (!el) return;

        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(250);

        visitOrder.push(el.value ?? el.label);
        this.log(context, kind, `Visit ${el.value ?? el.label}${step.level !== undefined ? ` (level ${step.level})` : ''}`, 'step');

        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.4, duration: 200 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
        context.scheduler.commitGroup(true);
      }
    });

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        vertexElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        edgeElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: kind,
          message: `${label} complete. Order: ${visitOrder.join(' → ')}`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `${label} on ${graphName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private runShortestPath(context: AlgorithmContext, instruction: GenericActionInstruction, kind: ShortestPathKind): void {
    const label = SHORTEST_PATH_LABELS[kind];
    const graphName = (instruction as any).payload?.logicalParent || (instruction.args?.[0] as string | undefined);

    if (!graphName) {
      this.log(context, kind, `${label} requires a graph argument.`, 'warning');
      return;
    }

    const sceneElements = context.sceneManager.getSceneGraph() as any[];
    const vertexElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && el.originalType === 'VERTEX'
    );
    const edgeElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && (el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE')
    );

    if (vertexElements.length === 0) {
      this.log(context, kind, `Graph "${graphName}" has no vertices. Nothing to traverse.`, 'warning');
      return;
    }

    const directed = edgeElements.some((el) => el.directed === true);
    const graph = new Graph<any>([], [], directed, true);
    for (const el of vertexElements) graph.addVertex(el.id, el);
    for (const el of edgeElements) {
      const rawWeight = el.properties?.label ?? el.label;
      const weight = rawWeight !== undefined && rawWeight !== null && rawWeight !== '' && !isNaN(Number(rawWeight))
        ? Number(rawWeight)
        : undefined;
      graph.addEdge(el.sourceId, el.targetId, weight);
    }

    const argRest = (instruction.args || []).slice(1).map((a) => String(a));
    const sourceArg = argRest[0];
    const goalArg = kind === 'ASTAR' ? argRest[1] : undefined;

    const findVertexEl = (arg: string | undefined): any =>
      arg ? vertexElements.find((el) => el.id === arg || String(el.value) === arg || el.label === arg) : undefined;

    const startEl = sourceArg ? findVertexEl(sourceArg) : vertexElements[0];
    if (!startEl) {
      this.log(context, 'ERROR', `${label}: source vertex "${sourceArg}" not found in "${graphName}".`, 'warning');
      return;
    }

    let goalEl: any | undefined;
    if (kind === 'ASTAR') {
      goalEl = findVertexEl(goalArg);
      if (!goalEl) {
        this.log(context, 'ERROR', `${label}: goal vertex "${goalArg}" not found in "${graphName}".`, 'warning');
        return;
      }
    }

    this.log(context, kind, `Starting ${label} on ${graphName} from ${startEl.value ?? startEl.label}${goalEl ? ` to ${goalEl.value ?? goalEl.label}` : ''}...`, 'operation');

    const algorithm = new GraphAlgorithm<any>(graph);
    let frames: ShortestPathStep[];
    let distances: Map<string, number> | undefined;
    let predecessor: Map<string, string | null> | undefined;
    let hasNegativeCycle = false;
    let path: string[] = [];
    let pathDistance: number | undefined;

    if (kind === 'DIJKSTRA') {
      const result = algorithm.dijkstra(startEl.id);
      frames = result.animationFrames;
      distances = result.distances;
      predecessor = result.predecessor;
    } else if (kind === 'BELLMAN_FORD') {
      const result = algorithm.bellmanFord(startEl.id);
      frames = result.animationFrames;
      distances = result.distances;
      predecessor = result.predecessor;
      hasNegativeCycle = result.hasNegativeCycle;
    } else {
      const result = algorithm.aStar(startEl.id, goalEl.id);
      frames = result.animationFrames;
      path = result.path;
      pathDistance = result.distance;
    }

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const pathToken = getSemanticColorToken('SUCCESS');
    const neutralColor = context.defaultColor;

    const getVertexEl = (id: string): any => vertexElements.find((el) => el.id === id);
    const getEdgeEl = (fromId: string, toId: string): any =>
      edgeElements.find(
        (el) =>
          (el.sourceId === fromId && el.targetId === toId) ||
          (!directed && el.sourceId === toId && el.targetId === fromId)
      );

    frames.forEach((step) => {
      if (step.type === 'RELAX') {
        const edgeEl = getEdgeEl(step.fromId, step.toId);
        if (edgeEl) {
          context.scheduler.enqueue({ targets: edgeEl, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
          context.scheduler.commitGroup(true);
        }
        this.log(context, kind, `Relax ${step.fromId} → ${step.toId}: distance = ${step.distance}`, 'step');
        context.scheduler.advanceCursor(150);
      } else if (step.type === 'VISIT') {
        const el = getVertexEl(step.vertexId);
        if (!el) return;

        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 150 });
        context.scheduler.commitGroup(true);
      }
    });

    if (kind === 'ASTAR' && path.length > 0) {
      for (let i = 0; i < path.length; i++) {
        const el = getVertexEl(path[i]);
        if (el) {
          context.scheduler.enqueue({ targets: el, color: pathToken.color, emissiveColor: pathToken.emissiveColor, emissiveIntensity: 0.8, duration: 200 });
          context.scheduler.commitGroup(true);
        }
        if (i > 0) {
          const edgeEl = getEdgeEl(path[i - 1], path[i]);
          if (edgeEl) {
            context.scheduler.enqueue({ targets: edgeEl, color: pathToken.color, emissiveColor: pathToken.emissiveColor, emissiveIntensity: 0.8, duration: 200 });
            context.scheduler.commitGroup(true);
          }
        }
      }
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        vertexElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        edgeElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });

        let resultMessage: string;
        if (kind === 'ASTAR') {
          resultMessage = path.length > 0
            ? `${label} complete. Path: ${path.join(' → ')} (distance ${pathDistance})`
            : `${label} complete. No path found from ${startEl.value ?? startEl.label} to ${goalEl.value ?? goalEl.label}.`;
        } else if (hasNegativeCycle) {
          resultMessage = `${label} complete. Negative-weight cycle detected — distances are unreliable.`;
        } else {
          const distSummary = distances
            ? Array.from(distances.entries()).map(([id, d]) => `${(getVertexEl(id)?.value ?? id)}=${d === Infinity ? '∞' : d}`).join(', ')
            : '';
          resultMessage = `${label} complete. Distances: ${distSummary}`;
        }

        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: kind,
          message: resultMessage,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `${label} on ${graphName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private runMST(context: AlgorithmContext, instruction: GenericActionInstruction, kind: MSTKind): void {
    const label = MST_LABELS[kind];
    const graphName = (instruction as any).payload?.logicalParent || (instruction.args?.[0] as string | undefined);

    if (!graphName) {
      this.log(context, kind, `${label} requires a graph argument.`, 'warning');
      return;
    }

    const sceneElements = context.sceneManager.getSceneGraph() as any[];
    const vertexElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && el.originalType === 'VERTEX'
    );
    const edgeElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && (el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE')
    );

    if (vertexElements.length === 0) {
      this.log(context, kind, `Graph "${graphName}" has no vertices. Nothing to process.`, 'warning');
      return;
    }

    const graph = new Graph<any>([], [], false, true);
    for (const el of vertexElements) graph.addVertex(el.id, el);
    for (const el of edgeElements) {
      const rawWeight = el.properties?.label ?? el.label;
      const weight = rawWeight !== undefined && rawWeight !== null && rawWeight !== '' && !isNaN(Number(rawWeight))
        ? Number(rawWeight)
        : undefined;
      graph.addEdge(el.sourceId, el.targetId, weight);
    }

    const startArg = kind === 'PRIM' && instruction.args && instruction.args.length > 1
      ? String(instruction.args[instruction.args.length - 1])
      : undefined;
    const startEl = startArg
      ? vertexElements.find((el) => el.id === startArg || String(el.value) === startArg || el.label === startArg)
      : vertexElements[0];

    if (kind === 'PRIM' && startArg && !startEl) {
      this.log(context, 'ERROR', `${label}: start vertex "${startArg}" not found in "${graphName}".`, 'warning');
      return;
    }

    this.log(context, kind, `Starting ${label} on ${graphName}${startEl ? ` from ${startEl.value ?? startEl.label}` : ''}...`, 'operation');

    const algorithm = new GraphAlgorithm<any>(graph);
    const result = kind === 'PRIM' ? algorithm.prim(startEl?.id) : algorithm.kruskal();

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const successToken = getSemanticColorToken('SUCCESS');
    const discardedToken = getSemanticColorToken('DISCARDED');
    const neutralColor = context.defaultColor;

    const getVertexEl = (id: string): any => vertexElements.find((el) => el.id === id);
    const getEdgeEl = (fromId: string, toId: string): any =>
      edgeElements.find(
        (el) =>
          (el.sourceId === fromId && el.targetId === toId) ||
          (el.sourceId === toId && el.targetId === fromId)
      );

    result.animationFrames.forEach((step: MSTStep) => {
      if (step.type === 'SORTED') {
        this.log(context, kind, `Sorted ${step.order.length} edge(s) by weight.`, 'step');
      } else if (step.type === 'CONSIDER') {
        const edgeEl = getEdgeEl(step.fromId, step.toId);
        if (edgeEl) {
          context.scheduler.enqueue({ targets: edgeEl, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
          context.scheduler.commitGroup(true);
        }
        context.scheduler.advanceCursor(150);
      } else if (step.type === 'REJECT') {
        const edgeEl = getEdgeEl(step.fromId, step.toId);
        if (edgeEl) {
          context.scheduler.enqueue({ targets: edgeEl, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: 0.5, duration: 150 });
          context.scheduler.commitGroup(true);
        }
        this.log(context, kind, `Reject ${step.fromId} - ${step.toId} (would form a cycle).`, 'step');
      } else if (step.type === 'ADD_EDGE') {
        const edgeEl = getEdgeEl(step.fromId, step.toId);
        if (edgeEl) {
          context.scheduler.enqueue({ targets: edgeEl, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
          context.scheduler.commitGroup(true);
        }
        this.log(context, kind, `Add edge ${step.fromId} - ${step.toId} (weight ${step.weight}) to MST.`, 'step');
      } else if (step.type === 'ADD_VERTEX') {
        const el = getVertexEl(step.vertexId);
        if (!el) return;
        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.commitGroup(true);
      }
    });

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        vertexElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        edgeElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: kind,
          message: `${label} complete. MST weight: ${result.totalWeight}, edges: ${result.mstEdges.map((e) => `${e.source}-${e.target}`).join(', ')}`,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `${label} on ${graphName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private runTopoSort(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const label = 'Topological Sort';
    const graphName = (instruction as any).payload?.logicalParent || (instruction.args?.[0] as string | undefined);

    if (!graphName) {
      this.log(context, 'TOPO_SORT', `${label} requires a graph argument.`, 'warning');
      return;
    }

    const sceneElements = context.sceneManager.getSceneGraph() as any[];
    const vertexElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && el.originalType === 'VERTEX'
    );
    const edgeElements = sceneElements.filter(
      (el) => el.logicalParent === graphName && (el.originalType === 'GRAPH_EDGE' || el.originalType === 'EDGE')
    );

    if (vertexElements.length === 0) {
      this.log(context, 'TOPO_SORT', `Graph "${graphName}" has no vertices. Nothing to sort.`, 'warning');
      return;
    }

    const graph = new Graph<any>([], [], true, false);
    for (const el of vertexElements) graph.addVertex(el.id, el);
    for (const el of edgeElements) graph.addEdge(el.sourceId, el.targetId);

    this.log(context, 'TOPO_SORT', `Starting ${label} on ${graphName}...`, 'operation');

    const algorithm = new GraphAlgorithm<any>(graph);
    const result = algorithm.topologicalSort();

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const discardedToken = getSemanticColorToken('DISCARDED');
    const neutralColor = context.defaultColor;

    const getVertexEl = (id: string): any => vertexElements.find((el) => el.id === id);

    result.animationFrames.forEach((step: TopoSortStep) => {
      const el = getVertexEl(step.vertexId);
      if (!el) return;

      if (step.type === 'VISIT') {
        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'TRAVERSAL');
        context.scheduler.enqueue({ targets: el, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(200);
      } else if (step.type === 'FINISH') {
        context.scheduler.enqueue({ targets: el, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.4, duration: 200 });
        context.scheduler.commitGroup(true);
        this.log(context, 'TOPO_SORT', `Finish ${el.value ?? el.label}`, 'step');
      } else if (step.type === 'CYCLE') {
        context.scheduler.enqueue({ targets: el, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: 0.9, duration: 250 });
        context.scheduler.commitGroup(true);
        this.log(context, 'TOPO_SORT', `Cycle detected at ${el.value ?? el.label}.`, 'step');
      }
    });

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        vertexElements.forEach((el) => {
          el.color = neutralColor;
          el.emissiveIntensity = 0;
        });
        const resultMessage = result.hasCycle
          ? `${label} complete. Graph "${graphName}" has a cycle — no valid ordering exists.`
          : `${label} complete. Order: ${result.ordering.map((id) => getVertexEl(id)?.value ?? id).join(' → ')}`;
        context.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'TOPO_SORT',
          message: resultMessage,
          kind: 'result',
          timestamp: Date.now(),
        });
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `${label} on ${graphName}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitSequential();
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }
}

import { AlgorithmContext } from './AlgorithmContext';

export interface TreeData {
  treeNodes: any[];
  treeEdges: any[];
  children: Map<string, string[]>;
  leftChild: Map<string, string>;
  rightChild: Map<string, string>;
  parent: Map<string, string>;
  labelMap: Map<string, string>;
  root: string | undefined;
  activeTree: string;
}

export function parseTreeData(context: AlgorithmContext): TreeData {
  let activeTree = context.activeTreeName;
  const sceneGraph = context.sceneManager.getSceneGraph();
  if (!activeTree) {
    const trees = sceneGraph.filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
    if (trees.length > 0) activeTree = trees[0].id;
    else activeTree = 'defaultTree';
    context.activeTreeName = activeTree;
  }
  
  const treeNodes = sceneGraph.filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
  const treeEdges = sceneGraph.filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

  const children: Map<string, string[]> = new Map();
  const leftChild: Map<string, string> = new Map();
  const rightChild: Map<string, string> = new Map();
  const parent: Map<string, string> = new Map();
  const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
  const hasParent = new Set<string>();

  treeEdges.forEach((e: any) => {
    if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
      if (!children.has(e.sourceId)) children.set(e.sourceId, []);
      children.get(e.sourceId)!.push(e.targetId);
      hasParent.add(e.targetId);
      parent.set(e.targetId, e.sourceId);
      if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
      if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
    }
  });

  const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
  const root = roots[0] || treeNodes[0]?.id;
  const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

  return {
    treeNodes,
    treeEdges,
    children,
    leftChild,
    rightChild,
    parent,
    labelMap,
    root,
    activeTree
  };
}

export function logStep(context: AlgorithmContext, actionName: string, message: string, kind: string = 'operation') {
  context.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
    context.eventDispatcher.dispatch('RUNTIME_LOG', {
      keyword: actionName,
      message,
      kind,
      timestamp: Date.now()
    });
  }});
  context.scheduler.commitGroup(true);
}

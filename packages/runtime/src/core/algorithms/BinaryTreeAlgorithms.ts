import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { parseTreeData, logStep, TreeData } from './TreeUtils';
import { GenericActionInstruction } from '@aqvl/shared';

export class BinaryTreeAlgorithms implements AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName;
    const treeData = parseTreeData(context);
    
    // Part 1: Advanced Operations (Structural Modifications)
    if (['MIRROR', 'INVERT'].includes(action)) {
      this.mirrorTree(context, treeData, action);
    } else if (['CLONE', 'COPY'].includes(action)) {
      this.cloneTree(context, treeData, action);
    } else if (['REMOVE_LEAVES', 'PRUNE'].includes(action)) {
      this.pruneTree(context, treeData, action);
    }
    // Part 2: Tree Views
    else if (['LEFT_VIEW', 'RIGHT_VIEW'].includes(action)) {
      this.sideView(context, treeData, action);
    } else if (['TOP_VIEW', 'BOTTOM_VIEW'].includes(action)) {
      this.verticalView(context, treeData, action);
    } else if (action === 'BOUNDARY') {
      this.boundaryTraversal(context, treeData);
    } else if (action === 'VERTICAL_ORDER') {
      this.verticalOrderTraversal(context, treeData);
    } else if (action === 'DIAGONAL') {
      this.diagonalTraversal(context, treeData);
    }
    // Part 3: Aggregate Algorithms
    else if (['MAX_VALUE', 'MIN_VALUE'].includes(action)) {
      this.findExtremes(context, treeData, action);
    } else if (['SUM', 'AVERAGE'].includes(action)) {
      this.calculateSumAverage(context, treeData, action);
    } else if (action === 'MAX_LEVEL_SUM') {
      this.maxLevelSum(context, treeData);
    }
  }

  // --- PART 1: ADVANCED OPERATIONS ---
  private mirrorTree(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) {
      logStep(context, actionName, `${actionName} Failed: Tree is empty.`, 'warning');
      return;
    }
    logStep(context, actionName, `${actionName} Tree...`, 'operation');

    const invertNode = (nodeId: string) => {
      const lc = data.leftChild.get(nodeId);
      const rc = data.rightChild.get(nodeId);
      if (!lc && !rc) return; // Leaf

      // Animate Swapping
      const nodeLabel = data.labelMap.get(nodeId) || nodeId;
      logStep(context, actionName, `Swapping Left and Right Child of ${nodeLabel}`, 'step');
      
      const realNode = context.sceneManager.getElement(nodeId) as any;
      if (realNode) {
        context.scheduler.enqueue({ targets: realNode, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.8, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(100);
      }

      // Update logical labels of edges
      const edgesToUpdate = data.treeEdges.filter((e: any) => e.sourceId === nodeId);
      edgesToUpdate.forEach((e: any) => {
        if (e.properties?.label === 'L') {
          e.properties.label = 'R';
        } else if (e.properties?.label === 'R') {
          e.properties.label = 'L';
        }
      });
      
      // We also trigger a layout update because the structure changed
      context.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('FORCE_LAYOUT_UPDATE', data.activeTree);
      }});
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(400);

      if (realNode) {
        context.scheduler.enqueue({ targets: realNode, color: context.defaultColor, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);
      }

      if (lc) invertNode(lc);
      if (rc) invertNode(rc);
    };

    invertNode(data.root);
    logStep(context, actionName, `${actionName} Complete.`, 'result');
  }

  private cloneTree(context: AlgorithmContext, data: TreeData, actionName: string) {
    logStep(context, actionName, `Cloning Tree not fully implemented yet.`, 'warning');
    // To do: spawn new nodes with new IDs, and offset them visually.
  }

  private pruneTree(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) return;
    logStep(context, actionName, `Removing leaves from tree...`, 'operation');

    const leaves: string[] = [];
    const findLeaves = (nodeId: string) => {
      const ch = data.children.get(nodeId) || [];
      if (ch.length === 0) {
        leaves.push(nodeId);
      } else {
        ch.forEach(findLeaves);
      }
    };
    findLeaves(data.root);

    leaves.forEach(leafId => {
      const nodeLabel = data.labelMap.get(leafId) || leafId;
      logStep(context, actionName, `Removing leaf node ${nodeLabel}`, 'step');
      
      const realNode = context.sceneManager.getElement(leafId) as any;
      if (realNode) {
        context.scheduler.enqueue({ targets: realNode, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 200 });
        context.scheduler.enqueue({ targets: realNode.scale, x: 0.1, y: 0.1, z: 0.1, duration: 300 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);
      }
      
      // Physically remove from scene
      context.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        const edges = data.treeEdges.filter((e: any) => e.targetId === leafId || e.sourceId === leafId);
        edges.forEach((e: any) => context.sceneManager.removeElement(e.id));
        context.sceneManager.removeElement(leafId);
        context.eventDispatcher.dispatch('FORCE_LAYOUT_UPDATE', data.activeTree);
      }});
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(200);
    });

    logStep(context, actionName, `Pruning complete. Removed ${leaves.length} leaves.`, 'result');
  }

  // --- PART 2: TREE VIEWS ---
  private sideView(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) return;
    logStep(context, actionName, `Calculating ${actionName.replace('_', ' ')}...`, 'operation');
    
    const isLeft = actionName === 'LEFT_VIEW';
    const viewNodes: string[] = [];
    const maxLevelReached = { val: -1 };

    const dfs = (nodeId: string, level: number) => {
      if (level > maxLevelReached.val) {
        viewNodes.push(nodeId);
        maxLevelReached.val = level;
      }
      const lc = data.leftChild.get(nodeId);
      const rc = data.rightChild.get(nodeId);
      
      if (isLeft) {
        if (lc) dfs(lc, level + 1);
        if (rc) dfs(rc, level + 1);
      } else {
        if (rc) dfs(rc, level + 1);
        if (lc) dfs(lc, level + 1);
      }
    };
    dfs(data.root, 0);

    this.highlightView(context, data, actionName, viewNodes);
  }

  private verticalView(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) return;
    logStep(context, actionName, `Calculating ${actionName.replace('_', ' ')}...`, 'operation');
    const isTop = actionName === 'TOP_VIEW';

    const colMap = new Map<number, {id: string, level: number}>();
    const queue: {id: string, col: number, level: number}[] = [{id: data.root, col: 0, level: 0}];
    
    while(queue.length > 0) {
      const {id, col, level} = queue.shift()!;
      if (!colMap.has(col)) {
        colMap.set(col, {id, level});
      } else if (!isTop) {
        const existing = colMap.get(col)!;
        if (level >= existing.level) {
          colMap.set(col, {id, level}); // Bottom view updates to lower nodes
        }
      }

      const lc = data.leftChild.get(id);
      const rc = data.rightChild.get(id);
      if (lc) queue.push({id: lc, col: col - 1, level: level + 1});
      if (rc) queue.push({id: rc, col: col + 1, level: level + 1});
    }

    const sortedCols = Array.from(colMap.keys()).sort((a, b) => a - b);
    const viewNodes = sortedCols.map(col => colMap.get(col)!.id);

    this.highlightView(context, data, actionName, viewNodes);
  }

  private boundaryTraversal(context: AlgorithmContext, data: TreeData) {
    if (!data.root) return;
    logStep(context, 'BOUNDARY', `Boundary Traversal`, 'operation');
    
    const boundary: string[] = [data.root];
    
    // Left boundary
    logStep(context, 'BOUNDARY', `Traversing Left Boundary...`, 'step');
    let cur = data.leftChild.get(data.root);
    while (cur) {
      const lc = data.leftChild.get(cur);
      const rc = data.rightChild.get(cur);
      if (lc || rc) boundary.push(cur);
      cur = lc || rc;
    }

    // Leaves
    logStep(context, 'BOUNDARY', `Traversing Leaves...`, 'step');
    const addLeaves = (nodeId: string) => {
      const lc = data.leftChild.get(nodeId);
      const rc = data.rightChild.get(nodeId);
      if (!lc && !rc && nodeId !== data.root) boundary.push(nodeId);
      if (lc) addLeaves(lc);
      if (rc) addLeaves(rc);
    };
    addLeaves(data.root);

    // Right boundary (bottom up)
    logStep(context, 'BOUNDARY', `Traversing Right Boundary...`, 'step');
    let rightBound: string[] = [];
    cur = data.rightChild.get(data.root);
    while (cur) {
      const lc = data.leftChild.get(cur);
      const rc = data.rightChild.get(cur);
      if (lc || rc) rightBound.push(cur);
      cur = rc || lc;
    }
    boundary.push(...rightBound.reverse());

    this.highlightView(context, data, 'BOUNDARY', boundary);
  }

  private verticalOrderTraversal(context: AlgorithmContext, data: TreeData) {
    if (!data.root) return;
    logStep(context, 'VERTICAL_ORDER', `Vertical Order Traversal...`, 'operation');
    const colMap = new Map<number, string[]>();
    const queue: {id: string, col: number}[] = [{id: data.root, col: 0}];
    
    while(queue.length > 0) {
      const {id, col} = queue.shift()!;
      if (!colMap.has(col)) colMap.set(col, []);
      colMap.get(col)!.push(id);

      const lc = data.leftChild.get(id);
      const rc = data.rightChild.get(id);
      if (lc) queue.push({id: lc, col: col - 1});
      if (rc) queue.push({id: rc, col: col + 1});
    }

    const sortedCols = Array.from(colMap.keys()).sort((a, b) => a - b);
    const viewNodes = sortedCols.reduce((acc: string[], col: number) => acc.concat(colMap.get(col)!), []);
    this.highlightView(context, data, 'VERTICAL_ORDER', viewNodes);
  }

  private diagonalTraversal(context: AlgorithmContext, data: TreeData) {
    if (!data.root) return;
    logStep(context, 'DIAGONAL', `Diagonal Traversal...`, 'operation');
    const queue: string[] = [data.root];
    const viewNodes: string[] = [];
    
    while(queue.length > 0) {
      let cur: string | undefined = queue.shift()!;
      while (cur) {
        viewNodes.push(cur);
        const lc = data.leftChild.get(cur);
        const rc = data.rightChild.get(cur);
        if (lc) queue.push(lc);
        cur = rc;
      }
    }
    this.highlightView(context, data, 'DIAGONAL', viewNodes);
  }

  // --- PART 3: AGGREGATE ALGORITHMS ---
  private findExtremes(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) return;
    const isMax = actionName === 'MAX_VALUE';
    logStep(context, actionName, `Finding ${isMax ? 'Maximum' : 'Minimum'} Value...`, 'operation');
    
    let extremeVal = isMax ? -Infinity : Infinity;
    let extremeNode = '';

    const queue = [data.root];
    while(queue.length > 0) {
      const cur = queue.shift()!;
      const realNode = context.sceneManager.getElement(cur) as any;
      const numVal = parseFloat(realNode?.value || data.labelMap.get(cur));
      if (!isNaN(numVal)) {
        if (isMax ? numVal > extremeVal : numVal < extremeVal) {
          extremeVal = numVal;
          extremeNode = cur;
        }
      }
      const ch = data.children.get(cur) || [];
      queue.push(...ch);
    }

    if (extremeNode) {
      logStep(context, actionName, `${isMax ? 'Max' : 'Min'} Value is ${extremeVal} at node ${data.labelMap.get(extremeNode)}`, 'result');
      this.highlightView(context, data, actionName, [extremeNode]);
    }
  }

  private calculateSumAverage(context: AlgorithmContext, data: TreeData, actionName: string) {
    if (!data.root) return;
    logStep(context, actionName, `Calculating ${actionName}...`, 'operation');
    
    let sum = 0;
    let count = 0;
    let allNodes: string[] = [];

    const queue = [data.root];
    while(queue.length > 0) {
      const cur = queue.shift()!;
      allNodes.push(cur);
      const realNode = context.sceneManager.getElement(cur) as any;
      const numVal = parseFloat(realNode?.value || data.labelMap.get(cur));
      if (!isNaN(numVal)) {
        sum += numVal;
        count++;
      }
      const ch = data.children.get(cur) || [];
      queue.push(...ch);
    }

    const res = actionName === 'SUM' ? sum : (sum / count).toFixed(2);
    logStep(context, actionName, `${actionName} is ${res}`, 'result');
    this.highlightView(context, data, actionName, allNodes);
  }

  private maxLevelSum(context: AlgorithmContext, data: TreeData) {
    if (!data.root) return;
    logStep(context, 'MAX_LEVEL_SUM', `Calculating Maximum Level Sum...`, 'operation');
    
    let maxSum = -Infinity;
    let maxLevelNodes: string[] = [];
    let queue: string[] = [data.root];
    let level = 1;
    let maxLevel = 1;

    while(queue.length > 0) {
      const nextQueue: string[] = [];
      let levelSum = 0;
      queue.forEach(cur => {
        const realNode = context.sceneManager.getElement(cur) as any;
        const numVal = parseFloat(realNode?.value || data.labelMap.get(cur));
        if (!isNaN(numVal)) levelSum += numVal;
        
        const lc = data.leftChild.get(cur);
        const rc = data.rightChild.get(cur);
        if (lc) nextQueue.push(lc);
        if (rc) nextQueue.push(rc);
      });

      if (levelSum > maxSum) {
        maxSum = levelSum;
        maxLevelNodes = [...queue];
        maxLevel = level;
      }
      queue = nextQueue;
      level++;
    }

    logStep(context, 'MAX_LEVEL_SUM', `Max Level Sum is ${maxSum} at level ${maxLevel}`, 'result');
    this.highlightView(context, data, 'MAX_LEVEL_SUM', maxLevelNodes);
  }

  // --- UTILS ---
  private highlightView(context: AlgorithmContext, data: TreeData, actionName: string, nodes: string[]) {
    const readableNodes = nodes.map(id => data.labelMap.get(id) || id).join(', ');
    logStep(context, actionName, `Nodes in view: ${readableNodes}`, 'result');

    nodes.forEach((nodeId, i) => {
      const el = context.sceneManager.getElement(nodeId) as any;
      if (el) {
        context.scheduler.enqueue({ targets: el, color: '#f5a623', emissiveColor: '#f5a623', emissiveIntensity: 0.9, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(150); // Stagger animation
      }
    });

    context.scheduler.advanceCursor(800);

    nodes.forEach((nodeId) => {
      const el = context.sceneManager.getElement(nodeId) as any;
      if (el) {
        context.scheduler.enqueue({ targets: el, color: context.defaultColor, emissiveIntensity: 0, duration: 300 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
      }
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(200);
  }
}

/**
 * BinaryTreeEngine — animation handler for trees built from TREE_NODE scene
 * objects and parent -> child EDGEs (a TREE / BINARY_TREE scene, or one
 * assembled with ROOT / CHILD / LEFT_CHILD / RIGHT_CHILD).
 *
 * Two entry points into one engine:
 * - AlgorithmRegistry routes the tree algorithms whose names belong to
 *   trees alone: MIRROR, CLONE, REMOVE_LEAVES, the views (LEFT_VIEW, TOP_VIEW,
 *   BOUNDARY, ...) and the aggregates (MAX_VALUE, SUM, MAX_LEVEL_SUM, ...).
 * - AnimationController routes the tree statements whose names other
 *   structures share (SEARCH, SIZE, HEIGHT, INORDER, CLEAR, DELETE, ...) here
 *   once it has ruled out BSTs, arrays and lists — see `handles`. Those
 *   also read and set the active tree (`ctx.activeTreeName`), which the
 *   controller keeps between statements.
 *
 * The scene is the tree's only state: every statement re-reads the nodes
 * and edges it needs (parseTreeData, or the statement's own walk).
 * Pointer trees (BINARY_TREE / BST declared in a program and used as code)
 * are TreeEngine's; BST_INSERT and friends are BSTEngine's.
 */
import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { parseTreeData, logStep, TreeData } from './TreeUtils';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';

/** Tree statements AnimationController routes here (names other structures share; see the header). */
const TREE_STATEMENTS = new Set([
  'DELETE', 'TREE', 'BINARY_TREE', 'BST', 'ROOT', 'CHILD', 'PARENT', 'LEFT_CHILD', 'RIGHT_CHILD',
  'SIBLING', 'ANCESTORS', 'DESCENDANTS', 'CLEAR', 'IS_EMPTY', 'SEARCH',
  'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'ZIGZAG', 'DFS', 'BFS',
  'HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS',
  'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF',
  'IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC',
  'LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS',
  'ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH',
  'PARENTOF', 'CHILDRENOF', 'SIBLINGS', 'PATH',
]);

export class BinaryTreeEngine implements AlgorithmHandler {
  /** The registered tree algorithms (see the header). */
  static readonly ALGORITHMS = [
    'MIRROR', 'INVERT', 'CLONE', 'COPY', 'REMOVE_LEAVES', 'PRUNE',
    'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL',
    'MAX_VALUE', 'MIN_VALUE', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM',
  ];

  /** Whether AnimationController should route the (upper-case) tree statement `actionName` here. */
  handles(actionName: string): boolean {
    return TREE_STATEMENTS.has(actionName);
  }

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.actionName.toUpperCase();
    if (name === 'DELETE') {
      this.deleteNode(context, instruction);
      return;
    }
    if (TREE_STATEMENTS.has(name)) {
      this.statement(context, instruction);
      return;
    }
    this.algorithm(context, instruction);
  }

  // --- TREE STATEMENTS (construction, traversals, measures, predicates, relations, paths) ---

  /** DELETE of a TREE_NODE: it pulses red, shrinks away, and leaves with its edges. Does nothing for any other target. */
  private deleteNode(ctx: AlgorithmContext, gen: GenericActionInstruction): void {
    let targetEl = gen.targetId ? ctx.sceneManager.getElement(gen.targetId) as any : null;
    if (!targetEl && gen.args && gen.args.length > 0) {
      targetEl = ctx.sceneManager.getElement(String(gen.args[0])) as any;
    }
    if (!targetEl || targetEl.originalType !== 'TREE_NODE') return;
    const edges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.type === 'edge' && (el.sourceId === targetEl.id || el.targetId === targetEl.id));

    ctx.scheduler.enqueue({
      targets: targetEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.8, duration: 300
    });
    ctx.scheduler.enqueue({ targets: targetEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
    ctx.scheduler.commitGroup(true);
    ctx.scheduler.advanceCursor(400);

    ctx.scheduler.enqueue({ targets: targetEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
    ctx.scheduler.enqueue({ targets: targetEl.position, y: '-=2', duration: 400, easing: 'easeInBack' });
    ctx.scheduler.commitGroup(true);

    ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
      edges.forEach(e => ctx.sceneManager.removeElement(e.id));
      ctx.sceneManager.removeElement(targetEl.id);
      ctx.layoutManager.updateLayout(ctx.sceneManager.getSceneGraph());
      ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Deleted node ${targetEl.id}`, ctx.scheduler.getCurrentTime());
      ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
      ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
        keyword: 'DELETE', message: `Deleted node ${targetEl.id} and its edges.`, kind: 'operation', timestamp: Date.now()
      });
    }});
    ctx.scheduler.commitSequential();
  }

  private statement(ctx: AlgorithmContext, gen: GenericActionInstruction): void {
    const actionName = gen.actionName.toUpperCase();
    if (actionName === 'TREE' || actionName === 'BINARY_TREE' || actionName === 'BST') {
      ctx.activeTreeName = gen.args[0];
      ctx.activeTreeIsBST = (actionName === 'BST');
      // Initialize an empty tree if it doesn't exist
      if (!ctx.sceneManager.getElement(ctx.activeTreeName!)) {
        ctx.sceneManager.addElement({
          id: ctx.activeTreeName!, type: actionName === 'BST' ? 'BST' : 'TREE', label: ctx.activeTreeName!
        } as any);
      }
      ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
        keyword: actionName,
        message: `${actionName === 'BST' ? 'BST' : 'Tree'} "${ctx.activeTreeName}" initialized.`,
        kind: 'operation',
        timestamp: Date.now(),
      });
    } else if (actionName === 'ROOT' || actionName === 'CHILD' || actionName === 'PARENT' || actionName === 'LEFT_CHILD' || actionName === 'RIGHT_CHILD') {
      let activeTree = ctx.activeTreeName;
      if (!activeTree) {
        const trees = ctx.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
        if (trees.length > 0) activeTree = trees[0].id;
        else activeTree = 'defaultTree';
        ctx.activeTreeName = activeTree;
      }
      let parentId = null;
      let childId = null;
      let edgeLabel = undefined;

      if (actionName === 'ROOT') {
        childId = String(gen.args[0]);
      } else if (actionName === 'CHILD') {
        parentId = String(gen.args[0]);
        childId = String(gen.args[1]);
      } else if (actionName === 'PARENT') {
        childId = String(gen.args[0]);
        parentId = String(gen.args[1]);
      } else if (actionName === 'LEFT_CHILD') {
        parentId = String(gen.args[0]);
        childId = String(gen.args[1]);
        edgeLabel = 'L';
      } else if (actionName === 'RIGHT_CHILD') {
        parentId = String(gen.args[0]);
        childId = String(gen.args[1]);
        edgeLabel = 'R';
      }

      if (childId && activeTree) {
        const ptrChild = ctx.sceneManager.getElement(childId);
        const ptrParent = parentId ? ctx.sceneManager.getElement(parentId) : null;
        AnticipationAnimation.applyAnticipation(ctx.scheduler, [ptrChild, ptrParent].filter(Boolean), 'POINTER');

        // Ensure child node exists
        let childEl = ctx.sceneManager.getElement(childId);
        if (!childEl) {
          childEl = {
            id: childId, type: 'sphere', value: childId, label: childId,
            logicalParent: activeTree, originalType: 'TREE_NODE',
            position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
            color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
            lifecycleState: 'ACTIVE', visible: true, opacity: 1
          } as any;
          ctx.sceneManager.addElement(childEl as any);
        }

        // Ensure parent node exists if it's a CHILD or PARENT action
        if (parentId) {
          let parentEl = ctx.sceneManager.getElement(parentId);
          if (!parentEl) {
            parentEl = {
              id: parentId, type: 'sphere', value: parentId, label: parentId,
              logicalParent: activeTree, originalType: 'TREE_NODE',
              position: { x: 0, y: -5, z: 0 }, scale: { x: 0, y: 0, z: 0 },
              color: '#4facfe', emissiveIntensity: 0, emissiveColor: '#000000',
              lifecycleState: 'ACTIVE', visible: true, opacity: 1
            } as any;
            ctx.sceneManager.addElement(parentEl as any);
          }

          // Create edge
          const edgeId = `edge_${parentId}_${childId}`;
          if (!ctx.sceneManager.getElement(edgeId)) {
            const edge: any = {
              id: edgeId, type: 'edge', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
              color: '#888888', sourceId: parentId, targetId: childId, directed: true,
              logicalParent: activeTree, originalType: 'EDGE',
              properties: edgeLabel ? { label: edgeLabel } : undefined
            };
            ctx.sceneManager.addElement(edge);
            ctx.relationshipManager!.addRelationship({
              id: edgeId, sourceId: parentId, targetId: childId, type: 'edge', directed: true
            });
          }
        }

        // Update Layout and animate
        ctx.layoutManager.updateLayout(ctx.sceneManager.getSceneGraph());

        const allEls = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType !== 'EDGE');
        allEls.forEach(el => {
          if ((el as any).worldTarget) {
            ctx.scheduler.enqueue({
              targets: el.position,
              x: (el as any).worldTarget.x,
              y: (el as any).worldTarget.y,
              z: (el as any).worldTarget.z,
              duration: 500,
              easing: 'easeOutCubic'
            });
            if (el.id === childId || el.id === parentId) {
              ctx.scheduler.enqueue({
                targets: el.scale,
                x: 1, y: 1, z: 1,
                duration: 600,
                easing: 'easeOutBack'
              });
            }
          }
        });
        ctx.scheduler.commitGroup(true);

        ctx.scheduler.enqueue({
          targets: {}, duration: 1, complete: () => {
            ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `${actionName} operation`, ctx.scheduler.getCurrentTime());
            ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
            // Emit textual log for structural tree operations
            if (actionName === 'ROOT') {
              ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'ROOT',
                message: `Node "${childId}" set as root of tree "${activeTree}".`,
                kind: 'operation',
                timestamp: Date.now(),
              });
            } else if (actionName === 'CHILD') {
              ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'CHILD',
                message: `Node "${childId}" added as child of "${parentId}".`,
                kind: 'operation',
                timestamp: Date.now(),
              });
            } else if (actionName === 'PARENT') {
              ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'PARENT',
                message: `Node "${childId}" set as child of "${parentId}".`,
                kind: 'operation',
                timestamp: Date.now(),
              });
            } else if (actionName === 'LEFT_CHILD') {
              ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'LEFT_CHILD',
                message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Left Child of ${parentId}.\nInsertion Complete.`,
                kind: 'operation',
                timestamp: Date.now(),
              });
            } else if (actionName === 'RIGHT_CHILD') {
              ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                keyword: 'RIGHT_CHILD',
                message: `Creating node ${childId}...\nFinding insertion position...\nInserted as Right Child of ${parentId}.\nInsertion Complete.`,
                kind: 'operation',
                timestamp: Date.now(),
              });
            }
          }
        });
        ctx.scheduler.commitSequential();
      }
    } else if (['SIBLING', 'ANCESTORS', 'DESCENDANTS'].includes(actionName)) {
      const targetId = String(gen.args[0]);
      let activeTree = ctx.activeTreeName || 'defaultTree';
      const treeNodes = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
      const treeEdges = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'EDGE');

      const children: Map<string, string[]> = new Map();
      const parentMap: Map<string, string> = new Map();
      treeEdges.forEach((e: any) => {
        if (!children.has(e.sourceId)) children.set(e.sourceId, []);
        children.get(e.sourceId)!.push(e.targetId);
        parentMap.set(e.targetId, e.sourceId);
      });

      const toHighlight: string[] = [];

      if (actionName === 'SIBLING') {
        const p = parentMap.get(targetId);
        if (p) {
          const sibs = (children.get(p) || []).filter(c => c !== targetId);
          toHighlight.push(...sibs);
        }
      } else if (actionName === 'ANCESTORS') {
        let curr = parentMap.get(targetId);
        while (curr) {
          toHighlight.push(curr);
          curr = parentMap.get(curr);
        }
      } else if (actionName === 'DESCENDANTS') {
        const q = [targetId];
        while (q.length > 0) {
          const curr = q.shift()!;
          const ch = children.get(curr) || [];
          toHighlight.push(...ch);
          q.push(...ch);
        }
      }

      toHighlight.forEach(id => {
        const realEl = ctx.sceneManager.getElement(id) as any;
        if (realEl) {
          ctx.scheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.8, duration: 400 });
        }
      });
      ctx.scheduler.commitGroup(true);
      ctx.scheduler.advanceCursor(600);

      toHighlight.forEach(id => {
        const realEl = ctx.sceneManager.getElement(id) as any;
        if (realEl) {
          ctx.scheduler.enqueue({ targets: realEl, color: ctx.defaultColor, emissiveIntensity: 0, duration: 400 });
        }
      });
      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: actionName, message: `Highlighted ${toHighlight.length} ${actionName.toLowerCase()} of ${targetId}.`, kind: 'operation', timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);
    } else if (actionName === 'CLEAR') {
      let activeTree = ctx.activeTreeName;
      if (activeTree) {
        const treeNodes = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree);
        ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
          ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'CLEAR', message: 'Clearing tree...', kind: 'operation', timestamp: Date.now()
          });
        }});
        ctx.scheduler.commitSequential();
        treeNodes.forEach(node => {
          const realEl = ctx.sceneManager.getElement(node.id) as any;
          if (realEl) {
            ctx.scheduler.enqueue({ targets: realEl.scale, x: 0, y: 0, z: 0, duration: 400, easing: 'easeInBack' });
          }
        });
        ctx.scheduler.commitGroup(true);
        ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
          treeNodes.forEach(node => ctx.sceneManager.removeElement(node.id));
          ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), 'Tree Cleared', ctx.scheduler.getCurrentTime());
          ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        }});
        ctx.scheduler.commitSequential();
      }
    } else if (actionName === 'IS_EMPTY') {
      let activeTree = ctx.activeTreeName;
      if (activeTree) {
        const count = ctx.sceneManager.getSceneGraph().filter(el => el.logicalParent === activeTree && el.originalType === 'TREE_NODE').length;
        ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
          ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'IS_EMPTY', message: count === 0 ? 'Tree is Empty.' : `Tree is not empty (size: ${count}).`, kind: 'operation', timestamp: Date.now()
          });
        }});
        ctx.scheduler.commitSequential();
      }
    } else if (actionName === 'SEARCH') {
      const searchVal = gen.args[0];
      let activeTree = ctx.activeTreeName || 'defaultTree';
      const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
      const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

      const children: Map<string, string[]> = new Map();
      const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
      const hasParent = new Set<string>();
      treeEdges.forEach((e: any) => {
        if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
          if (!children.has(e.sourceId)) children.set(e.sourceId, []);
          children.get(e.sourceId)!.push(e.targetId);
          hasParent.add(e.targetId);
        }
      });
      const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
      const root = roots[0] || (treeNodes[0]?.id);

      const order: string[] = [];
      let found = false;

      const dfsSearch = (id: string): void => {
        if (found) return;
        order.push(id);
        const node = treeNodes.find((n: any) => n.id === id) as any;
        if (node && (node.value == searchVal || node.label == searchVal || node.id == searchVal)) {
          found = true;
          return;
        }
        (children.get(id) || []).forEach((c: string) => dfsSearch(c));
      };

      if (root) dfsSearch(root);

      const visitedSoFar: string[] = [];
      const traversingToken = getSemanticColorToken('TRAVERSING');
      const successToken = getSemanticColorToken('SUCCESS');

      order.forEach((nodeId, idx) => {
         const realEl = ctx.sceneManager.getElement(nodeId) as any;
         const isTarget = idx === order.length - 1 && found;
         if (realEl) {
            AnticipationAnimation.applyAnticipation(ctx.scheduler, [realEl], 'TRAVERSAL');

            const targetToken = isTarget ? successToken : traversingToken;
            realEl.state = targetToken.name;
            ctx.scheduler.enqueue({
              targets: realEl, 
              color: targetToken.color, 
              emissiveColor: targetToken.emissiveColor, 
              emissiveIntensity: targetToken.emissiveIntensity, 
              duration: 300, 
              easing: 'easeOutExpo',
              complete: () => {
                visitedSoFar.push(realEl.label || realEl.id);
                ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'SEARCH', message: `Visited: ${visitedSoFar.join(' -> ')}`, kind: 'operation', timestamp: Date.now()
                });
                if (isTarget) {
                  ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'SEARCH_SUCCESS', message: `Value ${searchVal} found at node ${realEl.label || realEl.id}.`, kind: 'result', timestamp: Date.now()
                  });
                } else if (idx === order.length - 1 && !found) {
                  ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: 'SEARCH_FAIL', message: `Value ${searchVal} not found in the tree.`, kind: 'result', timestamp: Date.now()
                  });
                }
              }
            });
            ctx.scheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
            ctx.scheduler.commitGroup(true);
            ctx.scheduler.advanceCursor(400);

            if (!isTarget) {
               ctx.scheduler.enqueue({ targets: realEl, color: ctx.defaultColor, emissiveIntensity: 0.1, duration: 300 });
               ctx.scheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 300 });
               ctx.scheduler.commitGroup(true);
            }
         }
      });
    } else if (['PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'ZIGZAG', 'DFS', 'BFS'].indexOf(actionName) >= 0) {
      let activeTree = ctx.activeTreeName;
      if (!activeTree) {
        const trees = ctx.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
        if (trees.length > 0) activeTree = trees[0].id;
        else activeTree = 'defaultTree';
        ctx.activeTreeName = activeTree;
      }
      if (activeTree) {
        const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
        const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

        // Build parent->children adjacency map from edges
        const children: Map<string, string[]> = new Map();
        const leftChild: Map<string, string> = new Map();
        const rightChild: Map<string, string> = new Map();
        const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
        const hasParent = new Set<string>();
        treeEdges.forEach((e: any) => {
          if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
            if (!children.has(e.sourceId)) children.set(e.sourceId, []);
            children.get(e.sourceId)!.push(e.targetId);
            hasParent.add(e.targetId);
            if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
            if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
          }
        });
        // Find roots (nodes with no parent)
        const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
        const root = roots[0] || (treeNodes[0]?.id);

        // Traversal algorithms - return ordered array of node IDs
        const order: string[] = [];

        const preorder = (id: string): void => {
          order.push(id);
          (children.get(id) || []).forEach((c: string) => preorder(c));
        };
        const inorder = (id: string): void => {
          const ch = children.get(id) || [];
          const lc = leftChild.has(id) ? leftChild.get(id) : ch[0];
          const rc = rightChild.has(id) ? rightChild.get(id) : ch[1];
          if (lc) inorder(lc);
          order.push(id);
          if (rc) inorder(rc);
        };
        const postorder = (id: string): void => {
          (children.get(id) || []).forEach((c: string) => postorder(c));
          order.push(id);
        };
        const levelorder = (id: string): void => {
          const queue = [id];
          while (queue.length > 0) {
            const cur = queue.shift()!;
            order.push(cur);
            (children.get(cur) || []).forEach((c: string) => queue.push(c));
          }
        };
        const reverselevelorder = (id: string): void => {
          const queue = [id];
          while (queue.length > 0) {
            const cur = queue.shift()!;
            order.push(cur);
            const ch = children.get(cur) || [];
            const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
            const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
            if (rc) queue.push(rc); // right first so reverse works out to left first
            if (lc) queue.push(lc);
          }
          order.reverse();
        };
        const zigzag = (id: string): void => {
          let currentLevel = [id];
          let leftToRight = true;
          while (currentLevel.length > 0) {
            const nextLevel: string[] = [];
            const vals = leftToRight ? currentLevel : [...currentLevel].reverse();
            order.push(...vals);

            for (const cur of currentLevel) {
              const ch = children.get(cur) || [];
              const lc = leftChild.has(cur) ? leftChild.get(cur) : ch[0];
              const rc = rightChild.has(cur) ? rightChild.get(cur) : ch[1];
              if (lc) nextLevel.push(lc);
              if (rc) nextLevel.push(rc);
            }
            currentLevel = nextLevel;
            leftToRight = !leftToRight;
          }
        };
        const dfs = (id: string): void => {
          const stack = [id];
          const visited = new Set<string>();
          while (stack.length > 0) {
            const cur = stack.pop()!;
            if (visited.has(cur)) continue;
            visited.add(cur);
            order.push(cur);
            const ch = (children.get(cur) || []).slice().reverse();
            ch.forEach((c: string) => stack.push(c));
          }
        };
        const bfs = (id: string): void => { levelorder(id); };

        if (root) {
          if (actionName === 'PREORDER')   preorder(root);
          else if (actionName === 'INORDER') inorder(root);
          else if (actionName === 'POSTORDER')  postorder(root);
          else if (actionName === 'LEVELORDER') levelorder(root);
          else if (actionName === 'REVERSELEVELORDER') reverselevelorder(root);
          else if (actionName === 'ZIGZAG') zigzag(root);
          else if (actionName === 'DFS')        dfs(root);
          else if (actionName === 'BFS')        bfs(root);
        }

        // Map node IDs to labels for display
        const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));
        const traversalLabels = order.map((id: string) => labelMap.get(id) || id);
        const traversalText = traversalLabels.join(' → ');

        // Emit header log event BEFORE animations start
        ctx.scheduler.enqueue({
          targets: {}, duration: 1,
          complete: () => {
            let traversalName = actionName.charAt(0) + actionName.slice(1).toLowerCase();
            if (actionName === 'LEVELORDER') traversalName = 'Level-Order';
            else if (actionName === 'REVERSELEVELORDER') traversalName = 'Reverse Level-Order';
            else if (actionName === 'ZIGZAG') traversalName = 'Zig-Zag';
            else if (actionName === 'DFS') traversalName = 'DFS';
            else if (actionName === 'BFS') traversalName = 'BFS';
            ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: actionName,
              message: `${traversalName} Traversal — Starting from root "${labelMap.get(root!) || root}"\nVisit Order:\n${traversalText}`,
              kind: 'traversal',
              timestamp: Date.now(),
            });
          }
        });
        ctx.scheduler.commitGroup(true);

        // Animate each node glowing in traversal order, sequentially
        // Also emit per-node step logs synchronized with each highlight
        const GLOW_DURATION = 700;
        const traversingToken = getSemanticColorToken('TRAVERSING');
        const GLOW_COLOR = traversingToken.color;
        const visitedSoFar: string[] = [];
        order.forEach((nodeId: string, nodeIdx: number) => {
          const realEl = ctx.sceneManager.getElement(nodeId) as any;
          const nodeLabel = labelMap.get(nodeId) || nodeId;
          if (realEl) {
            AnticipationAnimation.applyAnticipation(ctx.scheduler, [realEl], 'TRAVERSAL');
            const origColor = realEl.color || ctx.defaultColor;
            realEl.state = 'TRAVERSING';
            ctx.scheduler.enqueue({
              targets: realEl,
              color: GLOW_COLOR,
              emissiveColor: traversingToken.emissiveColor,
              emissiveIntensity: 0.9,
              duration: 200,
              easing: 'easeOutExpo',
              complete: () => {
                // Per-node step log — fires as each node is highlighted
                visitedSoFar.push(nodeLabel);
                ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                  keyword: 'VISITING',
                  message: visitedSoFar.join(' → '),
                  kind: 'step',
                  timestamp: Date.now(),
                });
              }
            });
            ctx.scheduler.enqueue({
              targets: realEl.scale,
              x: 1.25, y: 1.25, z: 1.25,
              duration: 200, easing: 'easeOutExpo',
            });
            ctx.scheduler.commitGroup(true);

            ctx.scheduler.advanceCursor(GLOW_DURATION - 400);

            ctx.scheduler.enqueue({
              targets: realEl,
              color: origColor,
              emissiveColor: '#000000',
              emissiveIntensity: 0,
              duration: 200, easing: 'easeInExpo',
            });
            ctx.scheduler.enqueue({
              targets: realEl.scale,
              x: 1, y: 1, z: 1,
              duration: 200, easing: 'easeInExpo',
            });
            ctx.scheduler.commitGroup(true);
          }
        });
        ctx.scheduler.advanceCursor(200);
      }
    } else if (['HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF'].indexOf(actionName) >= 0) {
      let activeTree = ctx.activeTreeName;
      if (!activeTree) {
        const trees = ctx.sceneManager.getSceneGraph().filter(el => el.type === 'TREE' || el.type === 'BINARY_TREE');
        if (trees.length > 0) activeTree = trees[0].id;
        else activeTree = 'defaultTree';
        ctx.activeTreeName = activeTree;
      }
      if (activeTree) {
        const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
        const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

        const children: Map<string, string[]> = new Map();
        const leftChild: Map<string, string> = new Map();
        const rightChild: Map<string, string> = new Map();
        const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
        const hasParent = new Set<string>();
        treeEdges.forEach((e: any) => {
          if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
            if (!children.has(e.sourceId)) children.set(e.sourceId, []);
            children.get(e.sourceId)!.push(e.targetId);
            hasParent.add(e.targetId);
            if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
            if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
          }
        });
        const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
        const root = roots[0] || treeNodes[0]?.id;

        const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

        // We'll execute an animated sequence for counting or path finding.
        const nodesToHighlight: string[] = [];
        let finalMessage = '';
        let stepKeyword = '';
        let stepMessageFormat = '';

        if (['COUNT_NODES', 'SIZE'].includes(actionName)) {
          nodesToHighlight.push(...treeNodes.map((n: any) => n.id));
          finalMessage = `Total Nodes = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_NODES';
          stepMessageFormat = 'Node Found: {label}';
        } else if (['COUNT_LEAVES', 'LEAVES'].includes(actionName)) {
          nodesToHighlight.push(...treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0)).map((n: any) => n.id));
          finalMessage = `Total Leaf Nodes = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_LEAVES';
          stepMessageFormat = 'Leaf Found: {label}';
        } else if (['COUNT_INTERNAL', 'INTERNAL'].includes(actionName)) {
          nodesToHighlight.push(...treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0).map((n: any) => n.id));
          finalMessage = `Total Internal Nodes = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_INTERNAL';
          stepMessageFormat = 'Internal Node Found: {label}';
        } else if (actionName === 'COUNT_LEFT_LEAVES') {
          const leftLeaves = Array.from(leftChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
          nodesToHighlight.push(...leftLeaves);
          finalMessage = `Total Left Leaves = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_LEFT_LEAVES';
          stepMessageFormat = 'Left Leaf Found: {label}';
        } else if (actionName === 'COUNT_RIGHT_LEAVES') {
          const rightLeaves = Array.from(rightChild.values()).filter(id => !(children.get(id) && children.get(id)!.length > 0));
          nodesToHighlight.push(...rightLeaves);
          finalMessage = `Total Right Leaves = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_RIGHT_LEAVES';
          stepMessageFormat = 'Right Leaf Found: {label}';
        } else if (actionName === 'COUNT_FULL') {
          nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 2).map((n: any) => n.id));
          finalMessage = `Total Full Nodes = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_FULL';
          stepMessageFormat = 'Full Node Found: {label}';
        } else if (actionName === 'COUNT_HALF') {
          nodesToHighlight.push(...treeNodes.filter((n: any) => (children.get(n.id) || []).length === 1).map((n: any) => n.id));
          finalMessage = `Total Half Nodes = ${nodesToHighlight.length}`;
          stepKeyword = 'COUNT_HALF';
          stepMessageFormat = 'Half Node Found: {label}';
        } else if (['HEIGHT', 'MAX_DEPTH'].includes(actionName)) {
          let maxPath: string[] = [];
          const dfsPath = (id: string, currentPath: string[]) => {
            currentPath.push(id);
            const ch = children.get(id) || [];
            if (ch.length === 0) {
              if (currentPath.length > maxPath.length) maxPath = [...currentPath];
            } else {
              ch.forEach(c => dfsPath(c, [...currentPath]));
            }
          };
          if (root) dfsPath(root, []);
          nodesToHighlight.push(...maxPath);
          finalMessage = `Max Depth / Height = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
          stepKeyword = actionName;
          stepMessageFormat = 'Traversing longest path: {label}';
        } else if (actionName === 'MIN_DEPTH') {
          let minPath: string[] = [];
          let minLen = Infinity;
          const dfsPath = (id: string, currentPath: string[]) => {
            currentPath.push(id);
            const ch = children.get(id) || [];
            if (ch.length === 0) {
              if (currentPath.length < minLen) {
                minLen = currentPath.length;
                minPath = [...currentPath];
              }
            } else {
              ch.forEach(c => dfsPath(c, [...currentPath]));
            }
          };
          if (root) dfsPath(root, []);
          nodesToHighlight.push(...minPath);
          finalMessage = `Minimum Depth = ${nodesToHighlight.length > 0 ? nodesToHighlight.length - 1 : 0}`;
          stepKeyword = 'MIN_DEPTH';
          stepMessageFormat = 'Traversing shortest path: {label}';
        } else if (['DEPTH', 'LEVEL'].includes(actionName)) {
          const targetNode = gen.args[0];
          let path: string[] = [];
          const dfsPath = (id: string, currentPath: string[]): boolean => {
            currentPath.push(id);
            if (id === targetNode || labelMap.get(id) === targetNode) {
              path = [...currentPath];
              return true;
            }
            for (const c of (children.get(id) || [])) {
              if (dfsPath(c, [...currentPath])) return true;
            }
            return false;
          };
          if (root) dfsPath(root, []);
          nodesToHighlight.push(...path);
          const d = path.length > 0 ? path.length - 1 : -1;
          finalMessage = `${actionName === 'LEVEL' ? 'Level' : 'Depth'} of "${targetNode || 'root'}" = ${d >= 0 ? d : '(not found)'}`;
          stepKeyword = actionName;
          stepMessageFormat = 'Traversing path to target: {label}';
        } else if (actionName === 'DEGREE') {
           const degreeMap = treeNodes.map((n: any) => `${n.label || n.id}:${(children.get(n.id) || []).length}`);
           finalMessage = `Degree per node: ${degreeMap.join(', ')}`;
           stepKeyword = 'DEGREE';
        } else if (actionName === 'STATS') {
           const totalNodes = treeNodes.length;
           const leafNodes = treeNodes.filter((n: any) => !(children.get(n.id) && children.get(n.id)!.length > 0));
           const internalNodes = treeNodes.filter((n: any) => children.get(n.id) && children.get(n.id)!.length > 0);
           const treeHeight = (id: string): number => {
             const ch = children.get(id) || [];
             if (ch.length === 0) return 0;
             return 1 + Math.max(...ch.map((c: string) => treeHeight(c)));
           };
           const height = root ? treeHeight(root) : 0;
           finalMessage = `Size: ${totalNodes} | Height: ${height} | Leaves: ${leafNodes.length} | Internal: ${internalNodes.length} | Root: ${root ? (labelMap.get(root) || root) : 'none'}`;
           stepKeyword = 'STATS';
        }

        ctx.scheduler.enqueue({
          targets: {}, duration: 1,
          complete: () => {
            ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: actionName,
              message: `Executing ${actionName}...`,
              kind: 'info',
              timestamp: Date.now(),
            });
          }
        });
        ctx.scheduler.commitGroup(true);

        if (nodesToHighlight.length > 0 && stepMessageFormat) {
          // Animate sequentially
          const GLOW_DURATION = 500;
          nodesToHighlight.forEach((nodeId: string) => {
            const realEl = ctx.sceneManager.getElement(nodeId) as any;
            const nodeLabel = labelMap.get(nodeId) || nodeId;
            if (realEl) {
              const origColor = realEl.color || '#4facfe';
              ctx.scheduler.enqueue({
                targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 200, easing: 'easeOutExpo',
                complete: () => {
                  ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
                    keyword: stepKeyword,
                    message: stepMessageFormat.replace('{label}', nodeLabel),
                    kind: 'step',
                    timestamp: Date.now(),
                  });
                }
              });
              ctx.scheduler.enqueue({ targets: realEl.scale, x: 1.25, y: 1.25, z: 1.25, duration: 200, easing: 'easeOutExpo' });
              ctx.scheduler.commitGroup(true);
              ctx.scheduler.advanceCursor(GLOW_DURATION - 400);
              ctx.scheduler.enqueue({ targets: realEl, color: origColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200, easing: 'easeInExpo' });
              ctx.scheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 200, easing: 'easeInExpo' });
              ctx.scheduler.commitGroup(true);
            }
          });
        } else if (nodesToHighlight.length === 0 && !['DEGREE', 'STATS'].includes(actionName)) {
            // Pulse all tree nodes briefly in purple to acknowledge the query if no specific nodes to highlight
            const treeEls = treeNodes.map((n: any) => ctx.sceneManager.getElement(n.id)).filter(Boolean) as any[];
            if (treeEls.length > 0) {
              ctx.scheduler.enqueue({ targets: treeEls, emissiveColor: '#c486eb', emissiveIntensity: 0.6, duration: 300 });
              ctx.scheduler.commitGroup(true);
              ctx.scheduler.advanceCursor(400);
              ctx.scheduler.enqueue({ targets: treeEls, emissiveIntensity: 0, duration: 300 });
              ctx.scheduler.commitGroup(true);
            }
        }

        ctx.scheduler.enqueue({
          targets: {}, duration: 1,
          complete: () => {
            ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: actionName,
              message: finalMessage,
              kind: 'result',
              timestamp: Date.now(),
            });
          }
        });
        ctx.scheduler.commitGroup(true);
        ctx.scheduler.advanceCursor(200);
      } else {
        ctx.scheduler.advanceCursor(300);
      }
    } else if (['IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC'].includes(actionName)) {
      let activeTree = ctx.activeTreeName || 'defaultTree';
      const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
      const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

      const children: Map<string, string[]> = new Map();
      const leftChild: Map<string, string> = new Map();
      const rightChild: Map<string, string> = new Map();
      const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
      const hasParent = new Set<string>();
      treeEdges.forEach((e: any) => {
        if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
          if (!children.has(e.sourceId)) children.set(e.sourceId, []);
          children.get(e.sourceId)!.push(e.targetId);
          hasParent.add(e.targetId);
          if (e.properties?.label === 'L') leftChild.set(e.sourceId, e.targetId);
          if (e.properties?.label === 'R') rightChild.set(e.sourceId, e.targetId);
        }
      });
      const roots = treeNodes.filter((n: any) => !hasParent.has(n.id)).map((n: any) => n.id);
      const root = roots[0] || treeNodes[0]?.id;

      const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

      let propertyPassed = true;
      let failReason = '';
      let failNodeId = '';
      const traversalOrder: string[] = [];

      const treeHeight = (id: string | undefined): number => {
        if (!id) return 0;
        const lc = leftChild.get(id);
        const rc = rightChild.get(id);
        return 1 + Math.max(treeHeight(lc), treeHeight(rc));
      };

      if (actionName === 'IS_FULL') {
        const queue = [root].filter(Boolean);
        while (queue.length > 0 && propertyPassed) {
          const cur = queue.shift()!;
          traversalOrder.push(cur);
          const lc = leftChild.get(cur);
          const rc = rightChild.get(cur);
          if ((lc && !rc) || (!lc && rc)) {
            propertyPassed = false;
            failNodeId = cur;
            failReason = `Node ${labelMap.get(cur) || cur} has exactly one child.`;
          }
          if (lc) queue.push(lc);
          if (rc) queue.push(rc);
        }
        if (propertyPassed) failReason = 'Every node has either 0 or 2 children.';
      } else if (actionName === 'IS_COMPLETE') {
        const queue = [root].filter(Boolean);
        let seenEmpty = false;
        while (queue.length > 0 && propertyPassed) {
          const cur = queue.shift()!;
          if (cur === null) {
            seenEmpty = true;
          } else {
            traversalOrder.push(cur);
            if (seenEmpty) {
              propertyPassed = false;
              failNodeId = cur;
              failReason = `Tree contains missing nodes before occupied nodes (Found node ${labelMap.get(cur) || cur} after an empty spot).`;
            } else {
              queue.push(leftChild.get(cur) || (null as any));
              queue.push(rightChild.get(cur) || (null as any));
            }
          }
        }
        if (propertyPassed) failReason = 'All levels are filled left-to-right without gaps.';
      } else if (actionName === 'IS_PERFECT') {
        const h = treeHeight(root);
        const queue = [{id: root, level: 1}].filter(n => n.id);
        while (queue.length > 0 && propertyPassed) {
          const {id, level} = queue.shift()!;
          traversalOrder.push(id!);
          const lc = leftChild.get(id!);
          const rc = rightChild.get(id!);
          if (lc || rc) {
            if (!lc || !rc) {
              propertyPassed = false;
              failNodeId = id!;
              failReason = `Node ${labelMap.get(id!) || id!} is an internal node but doesn't have 2 children.`;
            }
          } else if (level !== h) {
            propertyPassed = false;
            failNodeId = id!;
            failReason = `Leaf node ${labelMap.get(id!) || id!} is at level ${level}, but expected level ${h}.`;
          }
          if (lc) queue.push({id: lc, level: level + 1});
          if (rc) queue.push({id: rc, level: level + 1});
        }
        if (propertyPassed) failReason = `All leaves are at level ${h} and internal nodes have 2 children.`;
      } else if (actionName === 'IS_BALANCED') {
        const checkBalance = (id: string | undefined): boolean => {
          if (!id) return true;
          traversalOrder.push(id);
          const lc = leftChild.get(id);
          const rc = rightChild.get(id);
          const lh = treeHeight(lc);
          const rh = treeHeight(rc);
          if (Math.abs(lh - rh) > 1) {
            propertyPassed = false;
            failNodeId = id;
            failReason = `Node ${labelMap.get(id) || id} is unbalanced (left height: ${lh}, right height: ${rh}).`;
            return false;
          }
          return checkBalance(lc) && checkBalance(rc);
        };
        if (root) checkBalance(root);
        if (propertyPassed) failReason = 'All nodes have height differences of at most 1 between subtrees.';
      } else if (actionName === 'IS_DEGENERATE') {
        const queue = [root].filter(Boolean);
        while (queue.length > 0 && propertyPassed) {
          const cur = queue.shift()!;
          traversalOrder.push(cur);
          const lc = leftChild.get(cur);
          const rc = rightChild.get(cur);
          if (lc && rc) {
            propertyPassed = false;
            failNodeId = cur;
            failReason = `Node ${labelMap.get(cur) || cur} has two children. Degenerate trees have at most one child per node.`;
          }
          if (lc) queue.push(lc);
          if (rc) queue.push(rc);
        }
        if (propertyPassed) failReason = 'Every node has at most one child (resembles a linked list).';
      } else if (actionName === 'IS_LEFT_SKEWED') {
        let cur = root;
        while (cur && propertyPassed) {
          traversalOrder.push(cur);
          const rc = rightChild.get(cur);
          if (rc) {
            propertyPassed = false;
            failNodeId = cur;
            failReason = `Node ${labelMap.get(cur) || cur} has a right child. Left skewed trees only have left children.`;
          }
          cur = leftChild.get(cur);
        }
        if (propertyPassed) failReason = 'All nodes only have left children.';
      } else if (actionName === 'IS_RIGHT_SKEWED') {
        let cur = root;
        while (cur && propertyPassed) {
          traversalOrder.push(cur);
          const lc = leftChild.get(cur);
          if (lc) {
            propertyPassed = false;
            failNodeId = cur;
            failReason = `Node ${labelMap.get(cur) || cur} has a left child. Right skewed trees only have right children.`;
          }
          cur = rightChild.get(cur);
        }
        if (propertyPassed) failReason = 'All nodes only have right children.';
      } else if (actionName === 'IS_SYMMETRIC') {
        const isMirror = (node1: string | undefined, node2: string | undefined): boolean => {
          if (!node1 && !node2) return true;
          if (node1 && !node2) {
            propertyPassed = false; failNodeId = node1; failReason = `Node ${labelMap.get(node1) || node1} has no mirror counterpart.`; return false;
          }
          if (!node1 && node2) {
            propertyPassed = false; failNodeId = node2; failReason = `Node ${labelMap.get(node2) || node2} has no mirror counterpart.`; return false;
          }
          traversalOrder.push(node1!);
          traversalOrder.push(node2!);
          const el1 = ctx.sceneManager.getElement(node1!) as any;
          const el2 = ctx.sceneManager.getElement(node2!) as any;
          if (el1?.value !== el2?.value) {
            propertyPassed = false; failNodeId = node1!; failReason = `Values do not match: ${el1?.value} vs ${el2?.value}`; return false;
          }
          return isMirror(leftChild.get(node1!), rightChild.get(node2!)) && isMirror(rightChild.get(node1!), leftChild.get(node2!));
        };
        if (root) isMirror(leftChild.get(root), rightChild.get(root));
        if (propertyPassed) failReason = 'The left and right subtrees are mirror images of each other.';
      }

      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        const readableName = actionName.replace('IS_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: actionName,
          message: `Checking ${readableName}...`,
          kind: 'operation',
          timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);

      traversalOrder.forEach((nodeId) => {
        const realEl = ctx.sceneManager.getElement(nodeId) as any;
        if (realEl) {
          ctx.scheduler.enqueue({ targets: realEl, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 0.9, duration: 250 });
          ctx.scheduler.enqueue({ targets: realEl.scale, x: 1.2, y: 1.2, z: 1.2, duration: 250 });
          ctx.scheduler.commitGroup(true);
          ctx.scheduler.advanceCursor(100);
          ctx.scheduler.enqueue({ targets: realEl, color: ctx.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 250 });
          ctx.scheduler.enqueue({ targets: realEl.scale, x: 1, y: 1, z: 1, duration: 250 });
          ctx.scheduler.commitGroup(true);
        }
      });

      ctx.scheduler.advanceCursor(200);

      if (!propertyPassed && failNodeId) {
        const failEl = ctx.sceneManager.getElement(failNodeId) as any;
        if (failEl) {
          ctx.scheduler.enqueue({ targets: failEl, color: '#f56565', emissiveColor: '#f56565', emissiveIntensity: 0.9, duration: 400 });
          ctx.scheduler.enqueue({ targets: failEl.scale, x: 1.3, y: 1.3, z: 1.3, duration: 400 });
          ctx.scheduler.commitGroup(true);
          ctx.scheduler.advanceCursor(600);
          ctx.scheduler.enqueue({ targets: failEl, color: ctx.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
          ctx.scheduler.enqueue({ targets: failEl.scale, x: 1, y: 1, z: 1, duration: 300 });
          ctx.scheduler.commitGroup(true);
        }
      }

      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        const resString = propertyPassed ? 'PASS' : 'FAIL';
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: `${actionName}_RESULT`,
          message: `Result: ${resString}\n${failReason}\nTree is ${propertyPassed ? '' : 'NOT '}the required property.`,
          kind: propertyPassed ? 'result' : 'warning',
          timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);
      ctx.scheduler.advanceCursor(200);

    } else if (['LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS'].includes(actionName)) {
      let activeTree = ctx.activeTreeName || 'defaultTree';
      const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
      const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

      const children: Map<string, string[]> = new Map();
      const parent: Map<string, string> = new Map();
      const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
      treeEdges.forEach((e: any) => {
        if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
          if (!children.has(e.sourceId)) children.set(e.sourceId, []);
          children.get(e.sourceId)!.push(e.targetId);
          parent.set(e.targetId, e.sourceId);
        }
      });

      const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

      const resolveTarget = (arg: any): string => {
        const val = String(arg);
        const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
        return byLabel ? byLabel.id : val;
      };

      const getPathToRoot = (id: string): string[] => {
        const p: string[] = [];
        let cur: string | undefined = id;
        while (cur) {
          p.push(cur);
          cur = parent.get(cur);
        }
        return p;
      };

      let nodesToHighlight: string[] = [];
      let path1Highlight: string[] = [];
      let path2Highlight: string[] = [];
      let finalMessage = '';

      if (actionName === 'LCA' || actionName === 'DISTANCE') {
        const nodeA = resolveTarget(gen.args[0]);
        const nodeB = resolveTarget(gen.args[1]);

        if (allNodeIds.has(nodeA) && allNodeIds.has(nodeB)) {
          const pathA = getPathToRoot(nodeA).reverse();
          const pathB = getPathToRoot(nodeB).reverse();

          let lca = '';
          for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
            if (pathA[i] === pathB[i]) lca = pathA[i];
            else break;
          }

          if (actionName === 'LCA') {
            path1Highlight = getPathToRoot(nodeA);
            path2Highlight = getPathToRoot(nodeB);
            nodesToHighlight = [lca];
            finalMessage = `Lowest Common Ancestor of ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${labelMap.get(lca) || lca}.`;
          } else {
            const distA = pathA.length - 1 - pathA.indexOf(lca);
            const distB = pathB.length - 1 - pathB.indexOf(lca);
            const totalDist = distA + distB;
            nodesToHighlight = [nodeA, nodeB, lca];
            finalMessage = `Distance between ${labelMap.get(nodeA) || nodeA} and ${labelMap.get(nodeB) || nodeB} is ${totalDist} edges. (LCA: ${labelMap.get(lca) || lca})`;
          }
        } else {
          finalMessage = `Nodes not found for ${actionName}.`;
        }
      } else if (actionName === 'GRANDPARENT') {
        const node = resolveTarget(gen.args[0]);
        const p = parent.get(node);
        const gp = p ? parent.get(p) : undefined;
        if (gp) {
          path1Highlight = [node, p!, gp];
          nodesToHighlight = [gp];
          finalMessage = `Grandparent of ${labelMap.get(node) || node} is ${labelMap.get(gp) || gp}.`;
        } else {
          finalMessage = `${labelMap.get(node) || node} does not have a grandparent.`;
        }
      } else if (actionName === 'UNCLE') {
        const node = resolveTarget(gen.args[0]);
        const p = parent.get(node);
        const gp = p ? parent.get(p) : undefined;
        if (gp) {
          const uncle = (children.get(gp) || []).find(c => c !== p);
          if (uncle) {
            path1Highlight = [node, p!, gp, uncle];
            nodesToHighlight = [uncle];
            finalMessage = `Uncle of ${labelMap.get(node) || node} is ${labelMap.get(uncle) || uncle}.`;
          } else {
            finalMessage = `${labelMap.get(node) || node} does not have an uncle.`;
          }
        } else {
          finalMessage = `${labelMap.get(node) || node} does not have an uncle (no grandparent).`;
        }
      } else if (actionName === 'COUSINS') {
        const node = resolveTarget(gen.args[0]);
        const p = parent.get(node);
        const gp = p ? parent.get(p) : undefined;
        const cousins: string[] = [];
        if (gp) {
          const uncles = (children.get(gp) || []).filter(c => c !== p);
          uncles.forEach(u => cousins.push(...(children.get(u) || [])));
        }
        nodesToHighlight = cousins;
        if (cousins.length > 0) {
          finalMessage = `Cousins of ${labelMap.get(node) || node}: ${cousins.map(c => labelMap.get(c) || c).join(', ')}`;
        } else {
          finalMessage = `${labelMap.get(node) || node} has no cousins.`;
        }
      }

      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: actionName,
          message: `Executing ${actionName}...`,
          kind: 'operation',
          timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);

      const highlightSequence = (path: string[], color: string) => {
        path.forEach(id => {
          const el = ctx.sceneManager.getElement(id) as any;
          if (el) {
            ctx.scheduler.enqueue({ targets: el, color: color, emissiveColor: color, emissiveIntensity: 0.8, duration: 250 });
            ctx.scheduler.enqueue({ targets: el.scale, x: 1.1, y: 1.1, z: 1.1, duration: 250 });
            ctx.scheduler.commitGroup(true);
            ctx.scheduler.advanceCursor(100);
          }
        });
      };

      if (path1Highlight.length > 0) highlightSequence(path1Highlight.reverse(), '#9f7aea'); // Animate from node to target
      if (path2Highlight.length > 0) highlightSequence(path2Highlight.reverse(), '#ed64a6');

      if (nodesToHighlight.length > 0) {
        ctx.scheduler.advanceCursor(200);
        nodesToHighlight.forEach(id => {
          const el = ctx.sceneManager.getElement(id) as any;
          if (el) {
            ctx.scheduler.enqueue({ targets: el, color: '#f6e05e', emissiveColor: '#f6e05e', emissiveIntensity: 1.0, duration: 300 });
            ctx.scheduler.enqueue({ targets: el.scale, x: 1.3, y: 1.3, z: 1.3, duration: 300 });
          }
        });
        ctx.scheduler.commitGroup(true);
        ctx.scheduler.advanceCursor(600);
      }

      const allHighlighted = new Set([...path1Highlight, ...path2Highlight, ...nodesToHighlight]);
      allHighlighted.forEach(id => {
        const el = ctx.sceneManager.getElement(id) as any;
        if (el) {
          ctx.scheduler.enqueue({ targets: el, color: ctx.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 300 });
          ctx.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
        }
      });
      ctx.scheduler.commitGroup(true);

      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: `${actionName}_RESULT`,
          message: finalMessage,
          kind: 'result',
          timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);
      ctx.scheduler.advanceCursor(200);

    } else if (['ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH'].includes(actionName)) {
      let activeTree = ctx.activeTreeName || 'defaultTree';
      const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
      const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

      const children: Map<string, string[]> = new Map();
      const parent: Map<string, string> = new Map();
      const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
      treeEdges.forEach((e: any) => {
        if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
          if (!children.has(e.sourceId)) children.set(e.sourceId, []);
          children.get(e.sourceId)!.push(e.targetId);
          parent.set(e.targetId, e.sourceId);
        }
      });

      const roots = treeNodes.filter((n: any) => !parent.has(n.id)).map((n: any) => n.id);
      const root = roots[0] || treeNodes[0]?.id;
      const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

      const resolveTarget = (arg: any): string => {
        const val = String(arg);
        const byLabel = treeNodes.find((n: any) => n.label === val || n.value == val || n.id === val);
        return byLabel ? byLabel.id : val;
      };

      const findAllPaths = (node: string, currentPath: string[], allPaths: string[][]) => {
        currentPath.push(node);
        const ch = children.get(node) || [];
        if (ch.length === 0) {
          allPaths.push([...currentPath]);
        } else {
          ch.forEach(c => findAllPaths(c, [...currentPath], allPaths));
        }
      };

      let pathsToHighlight: string[][] = [];
      let logHeader = '';

      if (actionName === 'ROOT_TO_NODE') {
        const targetNode = resolveTarget(gen.args[0]);
        if (allNodeIds.has(targetNode)) {
          let cur: string | undefined = targetNode;
          const path: string[] = [];
          while (cur) {
            path.push(cur);
            cur = parent.get(cur);
          }
          pathsToHighlight = [path.reverse()];
          logHeader = `Root to Node Path for ${labelMap.get(targetNode) || targetNode}`;
        }
      } else if (actionName === 'ROOT_TO_LEAVES') {
        if (root) findAllPaths(root, [], pathsToHighlight);
        logHeader = 'Root to Leaf Path';
      } else if (actionName === 'LONGEST_PATH') {
        const allPaths: string[][] = [];
        if (root) findAllPaths(root, [], allPaths);
        let maxLen = 0;
        allPaths.forEach(p => { if (p.length > maxLen) maxLen = p.length; });
        pathsToHighlight = allPaths.filter(p => p.length === maxLen);
        logHeader = 'Longest Path(s)';
      } else if (actionName === 'SHORTEST_PATH') {
        const allPaths: string[][] = [];
        if (root) findAllPaths(root, [], allPaths);
        let minLen = Infinity;
        allPaths.forEach(p => { if (p.length < minLen) minLen = p.length; });
        pathsToHighlight = allPaths.filter(p => p.length === minLen);
        logHeader = 'Shortest Path(s)';
      }

      ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: actionName,
          message: `Executing ${logHeader}...`,
          kind: 'operation',
          timestamp: Date.now()
        });
      }});
      ctx.scheduler.commitGroup(true);

      pathsToHighlight.forEach((path, idx) => {
        const readablePath = path.map(id => labelMap.get(id) || id).join(' → ');

        path.forEach(id => {
          const el = ctx.sceneManager.getElement(id) as any;
          if (el) {
            ctx.scheduler.enqueue({ targets: el, color: '#48bb78', emissiveColor: '#48bb78', emissiveIntensity: 0.9, duration: 200 });
            ctx.scheduler.enqueue({ targets: el.scale, x: 1.2, y: 1.2, z: 1.2, duration: 200 });
            ctx.scheduler.commitGroup(true);
            ctx.scheduler.advanceCursor(100);
          }
        });

        ctx.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
          ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
            keyword: 'PATH',
            message: `${logHeader}\n\n${readablePath}`,
            kind: 'result',
            timestamp: Date.now()
          });
        }});
        ctx.scheduler.commitGroup(true);

        ctx.scheduler.advanceCursor(400);

        path.forEach(id => {
          const el = ctx.sceneManager.getElement(id) as any;
          if (el) {
            ctx.scheduler.enqueue({ targets: el, color: ctx.defaultColor, emissiveColor: '#000000', emissiveIntensity: 0, duration: 200 });
            ctx.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 200 });
          }
        });
        ctx.scheduler.commitGroup(true);
      });
      ctx.scheduler.advanceCursor(200);

    } else if (['PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH'].indexOf(actionName) >= 0) {
      let activeTree = ctx.activeTreeName;
      if (!activeTree) {
        const trees = ctx.sceneManager.getSceneGraph().filter(el => el.type === 'TREE');
        if (trees.length > 0) activeTree = trees[0].id;
        else activeTree = 'defaultTree';
        ctx.activeTreeName = activeTree;
      }
      if (activeTree) {
        const treeNodes = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'TREE_NODE');
        const treeEdges = ctx.sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === activeTree && el.originalType === 'EDGE');

        const children: Map<string, string[]> = new Map();
        const parent: Map<string, string> = new Map();
        const allNodeIds = new Set(treeNodes.map((n: any) => n.id));
        treeEdges.forEach((e: any) => {
          if (allNodeIds.has(e.sourceId) && allNodeIds.has(e.targetId)) {
            if (!children.has(e.sourceId)) children.set(e.sourceId, []);
            children.get(e.sourceId)!.push(e.targetId);
            parent.set(e.targetId, e.sourceId);
          }
        });
        const roots = treeNodes.filter((n: any) => !parent.has(n.id));
        const root = roots[0]?.id;
        const labelMap = new Map(treeNodes.map((n: any) => [n.id, n.label || n.value || n.id]));

        const targetArg = gen.args[0];
        const targetArg2 = gen.args[1];

        let resultIds: string[] = [];
        let message = '';

        if (actionName === 'PARENTOF') {
          const p = parent.get(targetArg);
          resultIds = p ? [p] : [];
          message = p ? `Parent of "${targetArg}": ${labelMap.get(p) || p}` : `"${targetArg}" is the root (no parent)`;
        } else if (actionName === 'CHILDRENOF') {
          resultIds = children.get(targetArg) || [];
          const labels = resultIds.map((id: string) => labelMap.get(id) || id);
          message = labels.length > 0
            ? `Children of "${targetArg}": ${labels.join(', ')}`
            : `"${targetArg}" has no children (leaf node)`;
        } else if (actionName === 'ANCESTORS') {
          let cur = parent.get(targetArg);
          while (cur) { resultIds.push(cur); cur = parent.get(cur); }
          message = resultIds.length > 0
            ? `Ancestors of "${targetArg}": ${resultIds.map((id: string) => labelMap.get(id) || id).join(' ← ')}`
            : `"${targetArg}" has no ancestors (is root)`;
        } else if (actionName === 'DESCENDANTS') {
          const collectDesc = (id: string): void => {
            (children.get(id) || []).forEach((c: string) => { resultIds.push(c); collectDesc(c); });
          };
          collectDesc(targetArg);
          message = resultIds.length > 0
            ? `Descendants of "${targetArg}" (${resultIds.length}): ${resultIds.map((id: string) => labelMap.get(id) || id).join(', ')}`
            : `"${targetArg}" has no descendants (leaf node)`;
        } else if (actionName === 'SIBLINGS') {
          const p = parent.get(targetArg);
          const sibs = p ? (children.get(p) || []).filter((c: string) => c !== targetArg) : [];
          resultIds = sibs;
          message = sibs.length > 0
            ? `Siblings of "${targetArg}": ${sibs.map((id: string) => labelMap.get(id) || id).join(', ')}`
            : `"${targetArg}" has no siblings`;
        } else if (actionName === 'PATH') {
          // PATH from arg0 to arg1
          const findPath = (from: string, to: string): string[] | null => {
            if (from === to) return [from];
            for (const c of (children.get(from) || [])) {
              const sub = findPath(c, to);
              if (sub) return [from, ...sub];
            }
            return null;
          };
          const path = root ? (findPath(targetArg, targetArg2) || findPath(root, targetArg2) || []) : [];
          resultIds = path;
          message = path.length > 0
            ? `Path ${targetArg} → ${targetArg2}: ${path.map((id: string) => labelMap.get(id) || id).join(' → ')}`
            : `No path found from "${targetArg}" to "${targetArg2}"`;
        }

        ctx.scheduler.enqueue({
          targets: {}, duration: 1,
          complete: () => {
            ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
              keyword: actionName,
              message,
              kind: 'relationship',
              timestamp: Date.now(),
            });
          }
        });
        ctx.scheduler.commitGroup(true);

        // Highlight result nodes in orange, sequentially
        const HIGHLIGHT_COLOR = '#f5a623';
        const targetsToAnimate = resultIds.length > 0 ? resultIds : [targetArg];
        targetsToAnimate.forEach((nodeId: string) => {
          const realEl = ctx.sceneManager.getElement(nodeId) as any;
          if (realEl) {
            const origColor = realEl.color || '#4facfe';
            ctx.scheduler.enqueue({
              targets: realEl,
              color: HIGHLIGHT_COLOR,
              emissiveColor: HIGHLIGHT_COLOR,
              emissiveIntensity: 0.8,
              duration: 250,
            });
            ctx.scheduler.enqueue({
              targets: realEl.scale,
              x: 1.2, y: 1.2, z: 1.2,
              duration: 250,
            });
            ctx.scheduler.commitGroup(true);
            ctx.scheduler.advanceCursor(600);
            ctx.scheduler.enqueue({
              targets: realEl,
              color: origColor,
              emissiveColor: '#000000',
              emissiveIntensity: 0,
              duration: 250,
            });
            ctx.scheduler.enqueue({
              targets: realEl.scale,
              x: 1, y: 1, z: 1,
              duration: 250,
            });
            ctx.scheduler.commitGroup(true);
          }
        });
        ctx.scheduler.advanceCursor(200);
      }
    }
  }

  // --- TREE ALGORITHMS (registered) ---

  private algorithm(context: AlgorithmContext, instruction: GenericActionInstruction): void {
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

    const activeToken = getSemanticColorToken('ACTIVE');
    const neutralToken = getSemanticColorToken('NEUTRAL');

    const invertNode = (nodeId: string) => {
      const lc = data.leftChild.get(nodeId);
      const rc = data.rightChild.get(nodeId);
      if (!lc && !rc) return; // Leaf

      // Animate Swapping
      const nodeLabel = data.labelMap.get(nodeId) || nodeId;
      logStep(context, actionName, `Swapping Left and Right Child of ${nodeLabel}`, 'step');
      
      const realNode = context.sceneManager.getElement(nodeId) as any;
      if (realNode) {
        AnticipationAnimation.applyAnticipation(context.scheduler, [realNode], 'TREE_OP');
        realNode.state = 'ACTIVE';
        context.scheduler.enqueue({ targets: realNode, color: activeToken.color, emissiveColor: activeToken.emissiveColor, emissiveIntensity: activeToken.emissiveIntensity, duration: 250 });
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
      context.sceneManager.markChanged();
      
      // We also trigger a layout update because the structure changed
      context.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('FORCE_LAYOUT_UPDATE', data.activeTree);
      }});
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(400);

      if (realNode) {
        realNode.state = 'NEUTRAL';
        context.scheduler.enqueue({ targets: realNode, color: neutralToken.color, emissiveColor: neutralToken.emissiveColor, emissiveIntensity: neutralToken.emissiveIntensity, duration: 250 });
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

    const discardedToken = getSemanticColorToken('DISCARDED');

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
        AnticipationAnimation.applyAnticipation(context.scheduler, [realNode], 'DELETION');
        realNode.state = 'DISCARDED';
        context.scheduler.enqueue({ targets: realNode, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: discardedToken.emissiveIntensity, duration: 200 });
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

    const successToken = getSemanticColorToken('SUCCESS');
    const neutralToken = getSemanticColorToken('NEUTRAL');

    nodes.forEach((nodeId, i) => {
      const el = context.sceneManager.getElement(nodeId) as any;
      if (el) {
        AnticipationAnimation.applyAnticipation(context.scheduler, [el], 'SELECTION');
        el.state = 'SUCCESS';
        context.scheduler.enqueue({ targets: el, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: successToken.emissiveIntensity, duration: 250 });
        context.scheduler.enqueue({ targets: el.scale, x: 1.25, y: 1.25, z: 1.25, duration: 250 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(150); // Stagger animation
      }
    });

    context.scheduler.advanceCursor(800);

    nodes.forEach((nodeId) => {
      const el = context.sceneManager.getElement(nodeId) as any;
      if (el) {
        el.state = 'NEUTRAL';
        context.scheduler.enqueue({ targets: el, color: neutralToken.color, emissiveColor: neutralToken.emissiveColor, emissiveIntensity: neutralToken.emissiveIntensity, duration: 300 });
        context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 300 });
      }
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(200);
  }
}


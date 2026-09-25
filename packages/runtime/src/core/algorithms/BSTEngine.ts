/**
 * BSTEngine — Pure Binary Search Tree data structure engine.
 *
 * This module is intentionally free of animation or renderer
 * dependencies.  It manages the logical BST structure stored
 * inside the AQVL SceneManager and provides helpers that the
 * BSTAlgorithms animation layer can call.
 *
 * Design goals:
 *  - Maintain strict BST ordering at all times
 *  - Maintain parent / left / right pointers
 *  - Expose step-by-step traversal paths for animation
 *  - Support all three delete cases
 *  - Produce Reingold-Tilford-style layout coordinates
 */

import { SceneManager } from '../SceneManager';
import { RelationshipManager } from '../RelationshipManager';
import { getSemanticColorToken } from '@aqvl/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BSTNodeRef {
  /** Scene-graph element ID */
  id: string;
  /** Numeric BST key */
  value: number;
}

export interface BSTInsertResult {
  /** Whether the insert succeeded */
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Nodes visited during the traversal (for animation) */
  traversalPath: BSTNodeRef[];
  /** Direction taken at each node: 'L' = left, 'R' = right */
  directions: string[];
  /** The newly created node (when success = true) */
  newNode?: BSTNodeRef;
  /** Parent of the new node (null for root) */
  parentNode?: BSTNodeRef | null;
  /** Edge label: 'L' or 'R' (null for root) */
  edgeLabel?: 'L' | 'R' | null;
}

export interface BSTSearchResult {
  /** Whether the value was found */
  found: boolean;
  /** Node where the search ended (found node or last visited null position) */
  targetNode?: BSTNodeRef;
  /** Nodes visited during traversal */
  traversalPath: BSTNodeRef[];
  /** Comparison results at each step */
  comparisons: string[];
}

export type DeleteCase = 'LEAF' | 'ONE_CHILD' | 'TWO_CHILDREN';

export interface BSTDeleteResult {
  /** Whether the deletion succeeded */
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** The node being deleted */
  targetNode?: BSTNodeRef;
  /** Delete case */
  deleteCase?: DeleteCase;
  /** Traversal path to find the node */
  traversalPath: BSTNodeRef[];
  /** Inorder successor (only for TWO_CHILDREN case) */
  successor?: BSTNodeRef;
  /** Successor traversal path (only for TWO_CHILDREN case) */
  successorPath: BSTNodeRef[];
  /** Parent of the deleted node */
  parentNode?: BSTNodeRef | null;
  /** The child that replaces the deleted node (ONE_CHILD case) */
  replacementNode?: BSTNodeRef | null;
  /** Edge label to parent: 'L' or 'R' */
  edgeLabel?: 'L' | 'R' | null;
}

export interface BSTLayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface BSTTraversalStep {
  action: 'VISIT' | 'PROCESS' | 'MOVE_LEFT' | 'MOVE_RIGHT' | 'BACKTRACK';
  node: BSTNodeRef;
  targetNode?: BSTNodeRef; // For MOVE/BACKTRACK
}

export interface BSTLevelOrderStep {
  action: 'ENQUEUE' | 'DEQUEUE' | 'PROCESS';
  node: BSTNodeRef;
  queueState: BSTNodeRef[];
}

export interface BSTMinMaxResult {
  path: BSTNodeRef[];
  resultNode: BSTNodeRef | null;
}

/** O(1)-lookup child/parent index built once per operation via BSTEngine.buildIndex */
export interface BSTIndex {
  left: Map<string, any>;
  right: Map<string, any>;
  parent: Map<string, any>;
  edgeLabel: Map<string, 'L' | 'R'>;
}

export interface BSTHeightStep {
  action: 'VISIT' | 'RETURN';
  node: BSTNodeRef;
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine class
// ─────────────────────────────────────────────────────────────────────────────

export class BSTEngine {
  /** Node color used for all BST sphere nodes */
  static readonly NODE_COLOR = '#4facfe';
  static readonly NODE_EMISSIVE = '#000000';
  static readonly NODE_EMISSIVE_INTENSITY = 0;

  // ── Layout parameters ──────────────────────────────────────────────────────
  private static readonly LEVEL_SPACING = 2.0;
  private static readonly MIN_SIBLING_SPACING = 1.8;

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** All TREE_NODE elements belonging to the given BST group */
  static getNodes(sceneManager: SceneManager, treeName: string): any[] {
    return sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === treeName && el.originalType === 'TREE_NODE');
  }

  /** All EDGE elements belonging to the given BST group */
  static getEdges(sceneManager: SceneManager, treeName: string): any[] {
    return sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === treeName && el.originalType === 'EDGE');
  }

  /** Resolve node by numeric value from the scene */
  static findNodeByValue(sceneManager: SceneManager, treeName: string, value: number): any | null {
    const nodes = this.getNodes(sceneManager, treeName);
    return nodes.find((n: any) => Number(n.value) === value) || null;
  }

  /** Find the root (node with no parent edge pointing to it) */
  static getRoot(sceneManager: SceneManager, treeName: string): any | null {
    const nodes = this.getNodes(sceneManager, treeName);
    const edges = this.getEdges(sceneManager, treeName);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const hasParent = new Set<string>();
    edges.forEach((e: any) => {
      if (nodeIds.has(e.targetId)) hasParent.add(e.targetId);
    });
    return nodes.find((n: any) => !hasParent.has(n.id)) || null;
  }

  /** Get left child element of a node */
  static getLeftChild(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const lEdge = edges.find((e: any) => e.sourceId === nodeId && e.properties?.label === 'L');
    if (!lEdge) return null;
    return sceneManager.getElement(lEdge.targetId) || null;
  }

  /** Get right child element of a node */
  static getRightChild(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const rEdge = edges.find((e: any) => e.sourceId === nodeId && e.properties?.label === 'R');
    if (!rEdge) return null;
    return sceneManager.getElement(rEdge.targetId) || null;
  }

  /** Get parent element of a node */
  static getParent(sceneManager: SceneManager, treeName: string, nodeId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    const pEdge = edges.find((e: any) => e.targetId === nodeId);
    if (!pEdge) return null;
    return sceneManager.getElement(pEdge.sourceId) || null;
  }

  /** Get which edge label ('L' or 'R') this node is relative to its parent */
  static getEdgeLabel(sceneManager: SceneManager, treeName: string, nodeId: string): 'L' | 'R' | null {
    const edges = this.getEdges(sceneManager, treeName);
    const pEdge = edges.find((e: any) => e.targetId === nodeId);
    if (!pEdge) return null;
    return (pEdge.properties?.label as 'L' | 'R') || null;
  }

  /** Get the edge between two specific nodes */
  static getEdgeBetween(sceneManager: SceneManager, treeName: string, sourceId: string, targetId: string): any | null {
    const edges = this.getEdges(sceneManager, treeName);
    return edges.find((e: any) => e.sourceId === sourceId && e.targetId === targetId) || null;
  }

  /**
   * Build an O(n) node-id → left/right/parent/edgeLabel index for the tree.
   * Traversal/search/insert/delete/height/size all walk O(depth) nodes per
   * call; without this index each step re-scans the full scene graph
   * (getEdges) to find a single child/parent, turning O(depth) work into
   * O(n·depth). Build the index once per operation and look up in O(1).
   */
  static buildIndex(sceneManager: SceneManager, treeName: string): BSTIndex {
    const edges = this.getEdges(sceneManager, treeName);
    const left = new Map<string, any>();
    const right = new Map<string, any>();
    const parent = new Map<string, any>();
    const edgeLabel = new Map<string, 'L' | 'R'>();

    edges.forEach((e: any) => {
      const label = e.properties?.label;
      const targetEl = sceneManager.getElement(e.targetId);
      const sourceEl = sceneManager.getElement(e.sourceId);
      if (!targetEl || !sourceEl) return;
      if (label === 'L') left.set(e.sourceId, targetEl);
      if (label === 'R') right.set(e.sourceId, targetEl);
      parent.set(e.targetId, sourceEl);
      if (label === 'L' || label === 'R') edgeLabel.set(e.targetId, label);
    });

    return { left, right, parent, edgeLabel };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROTATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate a rotation at `pivotId` without mutating anything.
   * `direction: 'L'` rotates left (the pivot's RIGHT child rises to take its
   * place); `direction: 'R'` rotates right (the pivot's LEFT child rises).
   */
  static computeRotationPlan(
    sceneManager: SceneManager,
    treeName: string,
    pivotId: string,
    direction: 'L' | 'R'
  ): { success: boolean; error?: string; childId?: string } {
    const pivot = sceneManager.getElement(pivotId) as any;
    if (!pivot) {
      return { success: false, error: 'Node not found.' };
    }
    const child =
      direction === 'L'
        ? this.getRightChild(sceneManager, treeName, pivotId)
        : this.getLeftChild(sceneManager, treeName, pivotId);
    if (!child) {
      const side = direction === 'L' ? 'right' : 'left';
      return { success: false, error: `Cannot rotate ${direction === 'L' ? 'left' : 'right'}: node ${pivot.value} has no ${side} child.` };
    }
    return { success: true, childId: child.id };
  }

  /**
   * Perform a standard BST rotation at `pivotId`, rewiring parent/child
   * edges so the tree's logical structure actually changes (not just an
   * acknowledgment animation). Mirrors the classic single-rotation case
   * used by AVL/red-black rebalancing:
   *
   *  LEFT rotation at X (Y = X.right rises):
   *    B = Y.left; X.right = B; Y.left = X; Y takes X's former slot.
   *  RIGHT rotation at X (Y = X.left rises):
   *    C = Y.right; X.left = C; Y.right = X; Y takes X's former slot.
   *
   * Does NOT recompute layout/positions — callers should follow with a
   * layout pass (e.g. `computeLayout` + animate) to reflect the new shape.
   */
  static performRotation(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    pivotId: string,
    direction: 'L' | 'R'
  ): { success: boolean; error?: string; newSubtreeRootId?: string } {
    const plan = this.computeRotationPlan(sceneManager, treeName, pivotId, direction);
    if (!plan.success) return plan;
    const childId = plan.childId!;

    const removeEdgeBetween = (sourceId: string, targetId: string) => {
      const edge = this.getEdgeBetween(sceneManager, treeName, sourceId, targetId);
      if (edge) sceneManager.removeElement(edge.id);
    };
    const addEdge = (sourceId: string, targetId: string, label: 'L' | 'R') => {
      const edgeId = `bst_edge_${sourceId}_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sceneManager.addElement({
        id: edgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId,
        targetId,
        directed: true,
        properties: { label },
      } as any);
      relationshipManager.addRelationship({ id: edgeId, sourceId, targetId, type: 'edge', directed: true });
    };

    const parent = this.getParent(sceneManager, treeName, pivotId);
    const parentEdgeLabel = this.getEdgeLabel(sceneManager, treeName, pivotId);

    if (direction === 'L') {
      // Y = pivot's right child, rising. B = Y's left subtree, becomes X's right subtree.
      const grandchild = this.getLeftChild(sceneManager, treeName, childId);
      removeEdgeBetween(pivotId, childId);
      if (grandchild) {
        removeEdgeBetween(childId, grandchild.id);
        addEdge(pivotId, grandchild.id, 'R');
      }
      addEdge(childId, pivotId, 'L');
    } else {
      // Y = pivot's left child, rising. C = Y's right subtree, becomes X's left subtree.
      const grandchild = this.getRightChild(sceneManager, treeName, childId);
      removeEdgeBetween(pivotId, childId);
      if (grandchild) {
        removeEdgeBetween(childId, grandchild.id);
        addEdge(pivotId, grandchild.id, 'L');
      }
      addEdge(childId, pivotId, 'R');
    }

    if (parent) {
      removeEdgeBetween(parent.id, pivotId);
      addEdge(parent.id, childId, parentEdgeLabel ?? (direction === 'L' ? 'R' : 'L'));
    }
    // else: pivot was the root — childId is now the root, inferred automatically
    // (computeLayout/getRoot find it by "no incoming edge").

    return { success: true, newSubtreeRootId: childId };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSERT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the insertion path for `value` into the BST.
   * Returns the traversal path, direction at each node, and metadata
   * needed by the animation layer.  Does NOT mutate state.
   */
  static computeInsertPath(
    sceneManager: SceneManager,
    treeName: string,
    value: number
  ): BSTInsertResult {
    const root = this.getRoot(sceneManager, treeName);
    const traversalPath: BSTNodeRef[] = [];
    const directions: string[] = [];

    // Empty tree — insert as root
    if (!root) {
      return { success: true, traversalPath, directions, newNode: undefined, parentNode: null, edgeLabel: null };
    }

    const index = this.buildIndex(sceneManager, treeName);

    let current: any = root;
    while (current) {
      const currentVal = Number(current.value);

      // Duplicate check
      if (value === currentVal) {
        traversalPath.push({ id: current.id, value: currentVal });
        return {
          success: false,
          error: `Value ${value} already exists.`,
          traversalPath,
          directions,
        };
      }

      traversalPath.push({ id: current.id, value: currentVal });

      if (value < currentVal) {
        directions.push('L');
        const lc = index.left.get(current.id) || null;
        if (!lc) {
          return { success: true, traversalPath, directions, parentNode: { id: current.id, value: currentVal }, edgeLabel: 'L' };
        }
        current = lc;
      } else {
        directions.push('R');
        const rc = index.right.get(current.id) || null;
        if (!rc) {
          return { success: true, traversalPath, directions, parentNode: { id: current.id, value: currentVal }, edgeLabel: 'R' };
        }
        current = rc;
      }
    }

    // Should not reach here
    return { success: false, error: 'Unexpected traversal error.', traversalPath, directions };
  }

  /**
   * Actually inserts a new node into the scene. Called after animations show
   * the traversal path.  Returns the new element object.
   */
  static insertNode(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    value: number,
    parentNode: BSTNodeRef | null,
    edgeLabel: 'L' | 'R' | null
  ): any {
    const newId = `bst_node_${treeName}_${value}_${Date.now()}`;
    const neutralToken = getSemanticColorToken('NEUTRAL');

    const newEl: any = {
      id: newId,
      type: 'sphere',
      originalType: 'TREE_NODE',
      logicalParent: treeName,
      value,
      label: String(value),
      position: { x: 0, y: -10, z: 0 },
      scale: { x: 0, y: 0, z: 0 },
      color: this.NODE_COLOR,
      emissiveColor: this.NODE_EMISSIVE,
      emissiveIntensity: this.NODE_EMISSIVE_INTENSITY,
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };

    sceneManager.addElement(newEl);

    if (parentNode) {
      const edgeId = `bst_edge_${parentNode.id}_${newId}`;
      const edgeEl: any = {
        id: edgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId: parentNode.id,
        targetId: newId,
        directed: true,
        properties: { label: edgeLabel },
      };
      sceneManager.addElement(edgeEl);
      relationshipManager.addRelationship({
        id: edgeId,
        sourceId: parentNode.id,
        targetId: newId,
        type: 'edge',
        directed: true,
      });
    }

    return newEl;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the BST search path for `value`.
   * Returns traversal metadata for animation; does NOT mutate state.
   */
  static computeSearchPath(
    sceneManager: SceneManager,
    treeName: string,
    value: number
  ): BSTSearchResult {
    const root = this.getRoot(sceneManager, treeName);
    const traversalPath: BSTNodeRef[] = [];
    const comparisons: string[] = [];

    if (!root) {
      return { found: false, traversalPath, comparisons };
    }

    const index = this.buildIndex(sceneManager, treeName);

    let current: any = root;
    while (current) {
      const currentVal = Number(current.value);
      traversalPath.push({ id: current.id, value: currentVal });

      if (value === currentVal) {
        comparisons.push(`${value} = ${currentVal} → Found!`);
        return { found: true, targetNode: { id: current.id, value: currentVal }, traversalPath, comparisons };
      } else if (value < currentVal) {
        comparisons.push(`${value} < ${currentVal} → Go Left`);
        current = index.left.get(current.id) || null;
      } else {
        comparisons.push(`${value} > ${currentVal} → Go Right`);
        current = index.right.get(current.id) || null;
      }
    }

    return { found: false, traversalPath, comparisons };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the delete plan for `value`.
   * Determines the case (leaf / one child / two children),
   * inorder successor path, etc. Does NOT mutate state.
   */
  static computeDeletePlan(
    sceneManager: SceneManager,
    treeName: string,
    value: number
  ): BSTDeleteResult {
    const traversalPath: BSTNodeRef[] = [];
    const successorPath: BSTNodeRef[] = [];

    // Find the node
    const searchResult = this.computeSearchPath(sceneManager, treeName, value);
    if (!searchResult.found || !searchResult.targetNode) {
      return {
        success: false,
        error: `Value ${value} not found.`,
        traversalPath: searchResult.traversalPath,
        successorPath,
      };
    }

    const targetNode = searchResult.targetNode;
    const index = this.buildIndex(sceneManager, treeName);
    const parentEl = index.parent.get(targetNode.id) || null;
    const parentRef = parentEl ? { id: parentEl.id, value: Number(parentEl.value) } : null;
    const edgeLabel = index.edgeLabel.get(targetNode.id) || null;

    const leftChild = index.left.get(targetNode.id) || null;
    const rightChild = index.right.get(targetNode.id) || null;

    // CASE 1: Leaf node
    if (!leftChild && !rightChild) {
      return {
        success: true,
        targetNode,
        deleteCase: 'LEAF',
        traversalPath: searchResult.traversalPath,
        successorPath,
        parentNode: parentRef,
        replacementNode: null,
        edgeLabel,
      };
    }

    // CASE 2: One child
    if (!leftChild || !rightChild) {
      const child = (leftChild || rightChild) as any;
      return {
        success: true,
        targetNode,
        deleteCase: 'ONE_CHILD',
        traversalPath: searchResult.traversalPath,
        successorPath,
        parentNode: parentRef,
        replacementNode: { id: child.id, value: Number(child.value) },
        edgeLabel,
      };
    }

    // CASE 3: Two children — find inorder successor (leftmost in right subtree)
    successorPath.push(targetNode); // Start from deleted node itself in animation
    let successor: any = rightChild;
    successorPath.push({ id: successor.id, value: Number(successor.value) });

    let successorLeft = index.left.get(successor.id) || null;
    while (successorLeft) {
      successor = successorLeft;
      successorPath.push({ id: successor.id, value: Number(successor.value) });
      successorLeft = index.left.get(successor.id) || null;
    }

    return {
      success: true,
      targetNode,
      deleteCase: 'TWO_CHILDREN',
      traversalPath: searchResult.traversalPath,
      successorPath,
      successor: { id: successor.id, value: Number(successor.value) },
      parentNode: parentRef,
      edgeLabel,
    };
  }

  /**
   * Execute a LEAF deletion: remove node and its parent edge.
   */
  static performLeafDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string
  ): void {
    const edges = this.getEdges(sceneManager, treeName);
    const parentEdge = edges.find((e: any) => e.targetId === targetId);
    if (parentEdge) sceneManager.removeElement(parentEdge.id);
    sceneManager.removeElement(targetId);
  }

  /**
   * Execute a ONE_CHILD deletion: bypass the node, reconnect parent to child.
   */
  static performOneChildDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string,
    childId: string,
    parentId: string | null,
    edgeLabel: 'L' | 'R' | null
  ): void {
    const edges = this.getEdges(sceneManager, treeName);
    // Remove all edges connected to targetId
    const connectedEdges = edges.filter((e: any) => e.sourceId === targetId || e.targetId === targetId);
    connectedEdges.forEach((e: any) => sceneManager.removeElement(e.id));

    if (parentId) {
      // Reconnect parent → child
      const newEdgeId = `bst_edge_${parentId}_${childId}_${Date.now()}`;
      sceneManager.addElement({
        id: newEdgeId,
        type: 'edge',
        originalType: 'EDGE',
        logicalParent: treeName,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#888888',
        sourceId: parentId,
        targetId: childId,
        directed: true,
        properties: { label: edgeLabel },
      } as any);
      relationshipManager.addRelationship({
        id: newEdgeId,
        sourceId: parentId,
        targetId: childId,
        type: 'edge',
        directed: true,
      });
    }
    // If no parent, child becomes new root — nothing to reconnect

    sceneManager.removeElement(targetId);
  }

  /**
   * Execute a TWO_CHILDREN deletion by copying successor value into target,
   * then deleting the successor (which is at most a one-child node).
   */
  static performTwoChildrenDelete(
    sceneManager: SceneManager,
    relationshipManager: RelationshipManager,
    treeName: string,
    targetId: string,
    successorId: string
  ): void {
    const targetEl = sceneManager.getElement(targetId) as any;
    const successorEl = sceneManager.getElement(successorId) as any;
    if (!targetEl || !successorEl) return;

    // Copy successor value into target node (value replacement)
    targetEl.value = successorEl.value;
    targetEl.label = successorEl.label;

    // Now delete the successor node (it has at most one child — a right child)
    const successorRightChild = this.getRightChild(sceneManager, treeName, successorId);
    const successorParent = this.getParent(sceneManager, treeName, successorId);
    const successorEdgeLabel = this.getEdgeLabel(sceneManager, treeName, successorId);

    if (successorRightChild) {
      this.performOneChildDelete(
        sceneManager,
        relationshipManager,
        treeName,
        successorId,
        successorRightChild.id,
        successorParent?.id || null,
        successorEdgeLabel
      );
    } else {
      this.performLeafDelete(sceneManager, relationshipManager, treeName, successorId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all nodes ordered for a level-order clear animation.
   */
  static getClearOrder(sceneManager: SceneManager, treeName: string): any[] {
    const nodes = this.getNodes(sceneManager, treeName);
    const edges = this.getEdges(sceneManager, treeName);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const hasParent = new Set<string>();
    const children = new Map<string, string[]>();
    edges.forEach((e: any) => {
      if (nodeIds.has(e.targetId)) hasParent.add(e.targetId);
      if (nodeIds.has(e.sourceId)) {
        if (!children.has(e.sourceId)) children.set(e.sourceId, []);
        children.get(e.sourceId)!.push(e.targetId);
      }
    });
    const root = nodes.find((n: any) => !hasParent.has(n.id));
    if (!root) return nodes;

    // Level-order
    const order: any[] = [];
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      order.push(cur);
      const ch = children.get(cur.id) || [];
      ch.forEach(cid => {
        const cEl = sceneManager.getElement(cid);
        if (cEl) queue.push(cEl);
      });
    }
    return order;
  }

  /**
   * Remove all nodes and edges from the scene.
   */
  static performClear(sceneManager: SceneManager, treeName: string): void {
    const nodes = this.getNodes(sceneManager, treeName);
    const edges = this.getEdges(sceneManager, treeName);
    edges.forEach((e: any) => sceneManager.removeElement(e.id));
    nodes.forEach((n: any) => sceneManager.removeElement(n.id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute Reingold-Tilford-style layout coordinates for all BST nodes.
   * Returns a map of nodeId → { x, y, z }.
   *
   * The root is placed at y=0, children descend in y.
   * Horizontal spacing is adaptive to the depth of the tree.
   */
  static computeLayout(sceneManager: SceneManager, treeName: string): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = this.getNodes(sceneManager, treeName);
    if (nodes.length === 0) return map;

    // Build adjacency from scene edges
    const edges = this.getEdges(sceneManager, treeName);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const leftChildMap = new Map<string, string>();
    const rightChildMap = new Map<string, string>();
    const hasParent = new Set<string>();

    edges.forEach((e: any) => {
      if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) return;
      hasParent.add(e.targetId);
      if (e.properties?.label === 'L') leftChildMap.set(e.sourceId, e.targetId);
      if (e.properties?.label === 'R') rightChildMap.set(e.sourceId, e.targetId);
    });

    const root = nodes.find((n: any) => !hasParent.has(n.id));
    if (!root) return map;

    // Measure tree depth to adapt horizontal spacing
    const treeDepth = (id: string): number => {
      const l = leftChildMap.get(id);
      const r = rightChildMap.get(id);
      if (!l && !r) return 1;
      return 1 + Math.max(l ? treeDepth(l) : 0, r ? treeDepth(r) : 0);
    };

    const depth = treeDepth(root.id);
    // Compact spacing: Knuth's in-order algorithm guarantees distinct X coordinates for all nodes
    const baseGap = this.MIN_SIBLING_SPACING;

    // Knuth's algorithm: in-order traversal assigns x positions
    let counter = 0;
    const xPos = new Map<string, number>();

    const inorder = (id: string) => {
      const l = leftChildMap.get(id);
      if (l) inorder(l);
      xPos.set(id, counter++ * baseGap);
      const r = rightChildMap.get(id);
      if (r) inorder(r);
    };
    inorder(root.id);

    // Center the tree
    const xs = Array.from(xPos.values());
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;

    // Calculate startY so the lowest leaf nodes rest at y = 0.5 above ground
    const startY = 0.5 + (depth - 1) * this.LEVEL_SPACING;

    // Assign y based on depth
    const assignY = (id: string, level: number) => {
      const x = (xPos.get(id) || 0) - midX;
      const y = startY - level * this.LEVEL_SPACING;
      map.set(id, { x, y, z: 0 });

      const l = leftChildMap.get(id);
      const r = rightChildMap.get(id);
      if (l) assignY(l, level + 1);
      if (r) assignY(r, level + 1);
    };
    assignY(root.id, 0);

    return map;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 2: TRAVERSALS
  // ─────────────────────────────────────────────────────────────────────────

  static computeInorderTraversal(sceneManager: SceneManager, treeName: string): BSTTraversalStep[] {
    const root = this.getRoot(sceneManager, treeName);
    const steps: BSTTraversalStep[] = [];
    if (!root) return steps;
    const index = this.buildIndex(sceneManager, treeName);

    const traverse = (nodeId: string, value: number) => {
      const nodeRef = { id: nodeId, value };
      steps.push({ action: 'VISIT', node: nodeRef });

      const lc = index.left.get(nodeId);
      if (lc) {
        const lcRef = { id: lc.id, value: Number(lc.value) };
        steps.push({ action: 'MOVE_LEFT', node: nodeRef, targetNode: lcRef });
        traverse(lc.id, Number(lc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: lcRef });
      }

      steps.push({ action: 'PROCESS', node: nodeRef });

      const rc = index.right.get(nodeId);
      if (rc) {
        const rcRef = { id: rc.id, value: Number(rc.value) };
        steps.push({ action: 'MOVE_RIGHT', node: nodeRef, targetNode: rcRef });
        traverse(rc.id, Number(rc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: rcRef });
      }
    };

    traverse(root.id, Number(root.value));
    return steps;
  }

  static computePreorderTraversal(sceneManager: SceneManager, treeName: string): BSTTraversalStep[] {
    const root = this.getRoot(sceneManager, treeName);
    const steps: BSTTraversalStep[] = [];
    if (!root) return steps;
    const index = this.buildIndex(sceneManager, treeName);

    const traverse = (nodeId: string, value: number) => {
      const nodeRef = { id: nodeId, value };
      steps.push({ action: 'VISIT', node: nodeRef });
      steps.push({ action: 'PROCESS', node: nodeRef });

      const lc = index.left.get(nodeId);
      if (lc) {
        const lcRef = { id: lc.id, value: Number(lc.value) };
        steps.push({ action: 'MOVE_LEFT', node: nodeRef, targetNode: lcRef });
        traverse(lc.id, Number(lc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: lcRef });
      }

      const rc = index.right.get(nodeId);
      if (rc) {
        const rcRef = { id: rc.id, value: Number(rc.value) };
        steps.push({ action: 'MOVE_RIGHT', node: nodeRef, targetNode: rcRef });
        traverse(rc.id, Number(rc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: rcRef });
      }
    };

    traverse(root.id, Number(root.value));
    return steps;
  }

  static computePostorderTraversal(sceneManager: SceneManager, treeName: string): BSTTraversalStep[] {
    const root = this.getRoot(sceneManager, treeName);
    const steps: BSTTraversalStep[] = [];
    if (!root) return steps;
    const index = this.buildIndex(sceneManager, treeName);

    const traverse = (nodeId: string, value: number) => {
      const nodeRef = { id: nodeId, value };
      steps.push({ action: 'VISIT', node: nodeRef });

      const lc = index.left.get(nodeId);
      if (lc) {
        const lcRef = { id: lc.id, value: Number(lc.value) };
        steps.push({ action: 'MOVE_LEFT', node: nodeRef, targetNode: lcRef });
        traverse(lc.id, Number(lc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: lcRef });
      }

      const rc = index.right.get(nodeId);
      if (rc) {
        const rcRef = { id: rc.id, value: Number(rc.value) };
        steps.push({ action: 'MOVE_RIGHT', node: nodeRef, targetNode: rcRef });
        traverse(rc.id, Number(rc.value));
        steps.push({ action: 'BACKTRACK', node: nodeRef, targetNode: rcRef });
      }

      steps.push({ action: 'PROCESS', node: nodeRef });
    };

    traverse(root.id, Number(root.value));
    return steps;
  }

  static computeLevelorderTraversal(sceneManager: SceneManager, treeName: string): BSTLevelOrderStep[] {
    const root = this.getRoot(sceneManager, treeName);
    const steps: BSTLevelOrderStep[] = [];
    if (!root) return steps;
    const index = this.buildIndex(sceneManager, treeName);

    const queue: BSTNodeRef[] = [{ id: root.id, value: Number(root.value) }];
    steps.push({ action: 'ENQUEUE', node: queue[0], queueState: [...queue] });

    while (queue.length > 0) {
      const current = queue.shift()!;
      steps.push({ action: 'DEQUEUE', node: current, queueState: [...queue] });
      steps.push({ action: 'PROCESS', node: current, queueState: [...queue] });

      const lc = index.left.get(current.id);
      if (lc) {
        const lcRef = { id: lc.id, value: Number(lc.value) };
        queue.push(lcRef);
        steps.push({ action: 'ENQUEUE', node: lcRef, queueState: [...queue] });
      }

      const rc = index.right.get(current.id);
      if (rc) {
        const rcRef = { id: rc.id, value: Number(rc.value) };
        queue.push(rcRef);
        steps.push({ action: 'ENQUEUE', node: rcRef, queueState: [...queue] });
      }
    }

    return steps;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 3: INFORMATION QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  static computeMin(sceneManager: SceneManager, treeName: string): BSTMinMaxResult {
    const root = this.getRoot(sceneManager, treeName);
    const path: BSTNodeRef[] = [];
    if (!root) return { path, resultNode: null };
    const index = this.buildIndex(sceneManager, treeName);

    let current = root;
    while (current) {
      path.push({ id: current.id, value: Number(current.value) });
      const lc = index.left.get(current.id);
      if (!lc) break;
      current = lc;
    }
    return { path, resultNode: path[path.length - 1] };
  }

  static computeMax(sceneManager: SceneManager, treeName: string): BSTMinMaxResult {
    const root = this.getRoot(sceneManager, treeName);
    const path: BSTNodeRef[] = [];
    if (!root) return { path, resultNode: null };
    const index = this.buildIndex(sceneManager, treeName);

    let current = root;
    while (current) {
      path.push({ id: current.id, value: Number(current.value) });
      const rc = index.right.get(current.id);
      if (!rc) break;
      current = rc;
    }
    return { path, resultNode: path[path.length - 1] };
  }

  static computeHeight(sceneManager: SceneManager, treeName: string): { steps: BSTHeightStep[], totalHeight: number } {
    const root = this.getRoot(sceneManager, treeName);
    const steps: BSTHeightStep[] = [];
    if (!root) return { steps, totalHeight: 0 };
    const index = this.buildIndex(sceneManager, treeName);

    const traverse = (nodeId: string, value: number): number => {
      const nodeRef = { id: nodeId, value };
      steps.push({ action: 'VISIT', node: nodeRef });

      const lc = index.left.get(nodeId);
      const rc = index.right.get(nodeId);

      const leftHeight = lc ? traverse(lc.id, Number(lc.value)) : 0;
      const rightHeight = rc ? traverse(rc.id, Number(rc.value)) : 0;

      const h = Math.max(leftHeight, rightHeight) + 1;
      steps.push({ action: 'RETURN', node: nodeRef, height: h });
      return h;
    };

    const totalHeight = traverse(root.id, Number(root.value));
    return { steps, totalHeight };
  }

  static computeSize(sceneManager: SceneManager, treeName: string): { path: BSTNodeRef[], totalSize: number } {
    const root = this.getRoot(sceneManager, treeName);
    const path: BSTNodeRef[] = [];
    if (!root) return { path, totalSize: 0 };
    const index = this.buildIndex(sceneManager, treeName);

    const traverse = (nodeId: string, value: number) => {
      path.push({ id: nodeId, value });
      const lc = index.left.get(nodeId);
      if (lc) traverse(lc.id, Number(lc.value));
      const rc = index.right.get(nodeId);
      if (rc) traverse(rc.id, Number(rc.value));
    };

    traverse(root.id, Number(root.value));
    return { path, totalSize: path.length };
  }
}

import { SceneElement, BoxElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface TreeLayoutOptions {
  levelSpacing?: number;
  siblingSpacing?: number;
  startX?: number;
  startY?: number;
}

interface TreeNode {
  element: SceneElement;
  children: TreeNode[];
  width: number;
  depth: number;
  x: number;
  y: number;
}

export class TreeLayoutStrategy implements LayoutStrategy {
  private levelSpacing: number;
  private siblingSpacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: TreeLayoutOptions) {
    this.levelSpacing = options?.levelSpacing || 2.0;
    this.siblingSpacing = options?.siblingSpacing || 1.5;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = elements.filter(el => el.type === 'box' || el.originalType === 'TREE_NODE');
    const edges = elements.filter(el => el.type === 'edge' || el.originalType === 'EDGE') as any[];
    console.log(`[TreeLayoutStrategy] nodes: ${nodes.length}, edges: ${edges.length}`, elements);

    if (nodes.length === 0) return map;

    // Build graph
    const nodeMap = new Map<string, TreeNode>();
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        element: node,
        children: [],
        width: 0,
        depth: 1,
        x: 0,
        y: 0
      });
    });

    const inDegree = new Map<string, number>();
    nodes.forEach(node => inDegree.set(node.id, 0));

    edges.forEach(edge => {
      if (nodeMap.has(edge.sourceId) && nodeMap.has(edge.targetId)) {
        nodeMap.get(edge.sourceId)!.children.push(nodeMap.get(edge.targetId)!);
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      }
    });

    // Find roots
    const roots: TreeNode[] = [];
    nodes.forEach(node => {
      if (inDegree.get(node.id) === 0) {
        roots.push(nodeMap.get(node.id)!);
      }
    });

    // If there is a cycle or disconnected graphs without clear root, just take the first node
    if (roots.length === 0) {
      const firstNode = nodeMap.values().next().value;
      if (firstNode) roots.push(firstNode);
    }

    // Pass 1: Compute subtree widths and max depth
    const { width: totalWidth, depth: maxDepth } = this.computeWidthAndDepth(roots);

    // Pass 2: Assign coordinates (Center everything around startX, raise above ground)
    const dynamicStartY = Math.max(this.startY, 0.5 + (maxDepth - 1) * this.levelSpacing);
    
    let currentX = this.startX - (totalWidth / 2) + (this.siblingSpacing / 2);
    roots.forEach(root => {
      this.assignCoordinates(root, currentX, dynamicStartY);
      currentX += root.width;
    });

    // Populate coordinate map
    nodeMap.forEach(node => {
      map.set(node.element.id, { x: node.x, y: node.y, z: 0 });
    });

    return map;
  }

  private computeWidthAndDepth(nodes: TreeNode[]): { width: number, depth: number } {
    let totalWidth = 0;
    let maxDepth = 1;
    nodes.forEach(node => {
      if (node.children.length === 0) {
        node.width = this.siblingSpacing;
        node.depth = 1;
      } else {
        const { width, depth } = this.computeWidthAndDepth(node.children);
        node.width = width;
        node.depth = depth + 1;
        if (node.depth > maxDepth) maxDepth = node.depth;
      }
      totalWidth += node.width;
    });
    return { width: totalWidth, depth: maxDepth };
  }

  private assignCoordinates(node: TreeNode, x: number, y: number): void {
    // node is placed at the center of its assigned block
    node.x = x + node.width / 2 - this.siblingSpacing / 2;
    node.y = y;

    let childX = x;
    node.children.forEach(child => {
      this.assignCoordinates(child, childX, y - this.levelSpacing);
      childX += child.width;
    });
  }
}

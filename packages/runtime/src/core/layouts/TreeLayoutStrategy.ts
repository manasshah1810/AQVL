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
  element: BoxElement;
  children: TreeNode[];
  width: number;
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
    const nodes = elements.filter((el): el is BoxElement => el.type === 'box');
    const edges = relationshipManager.getEdges();

    if (nodes.length === 0) return map;

    // Build graph
    const nodeMap = new Map<string, TreeNode>();
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        element: node,
        children: [],
        width: 0,
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

    // Pass 1: Compute subtree widths
    this.computeWidths(roots);

    // Pass 2: Assign coordinates
    let currentX = this.startX;
    roots.forEach(root => {
      this.assignCoordinates(root, currentX, this.startY);
      currentX += root.width + this.siblingSpacing;
    });

    // Populate coordinate map
    nodeMap.forEach(node => {
      map.set(node.element.id, { x: node.x, y: node.y, z: 0 });
    });

    return map;
  }

  private computeWidths(nodes: TreeNode[]): number {
    let totalWidth = 0;
    nodes.forEach(node => {
      if (node.children.length === 0) {
        node.width = this.siblingSpacing;
      } else {
        node.width = this.computeWidths(node.children);
      }
      totalWidth += node.width;
    });
    return totalWidth;
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

import type { LayoutCalculator, LayoutElementInput, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

/**
 * HIERARCHY layout strategy (docs/design/aqir-geometry-spec.md §1.1): a
 * classic subtree-width tree layout — post-order pass computes each
 * subtree's horizontal footprint, then a pre-order pass assigns
 * coordinates, so siblings and whole subtrees never overlap regardless of
 * how unbalanced the tree is (the algorithm mirrors the production
 * `TreeLayoutStrategy` at packages/runtime/src/core/layouts/TreeLayoutStrategy.ts,
 * generalized to the LayoutEngine's element-input shape).
 *
 * Params: levelGap (number, default 2), siblingGap (number, default 1.5),
 * origin ([x,y,z], default [0,0,0]).
 *
 * Parent/child relationships come from `LayoutElementInput.parentId`
 * (undefined/null, or pointing outside the given element set, means "root" —
 * multiple roots/disconnected forests are laid out side by side). Children of
 * a node are ordered by `logicalIndex` for deterministic left-to-right
 * placement.
 */
interface HNode {
  id: string;
  logicalIndex: number;
  children: HNode[];
  width: number;
  x: number;
}

export class HierarchyLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>): PositionMap {
    const positions: PositionMap = new Map();
    if (elements.length === 0) return positions;

    const levelGap = typeof params.levelGap === 'number' ? params.levelGap : 2;
    const siblingGap = typeof params.siblingGap === 'number' ? params.siblingGap : 1.5;
    const origin = parseOrigin(params.origin);

    const nodeMap = new Map<string, HNode>();
    elements.forEach((el) => {
      nodeMap.set(el.id, { id: el.id, logicalIndex: el.logicalIndex, children: [], width: 0, x: 0 });
    });

    const roots: HNode[] = [];
    elements.forEach((el) => {
      const node = nodeMap.get(el.id)!;
      const parentId = el.parentId ?? undefined;
      const parent = parentId ? nodeMap.get(parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Malformed input (every element's parentId forms a cycle, so nothing
    // resolved to a root) — fall back to treating the first element as root
    // rather than producing no layout at all.
    if (roots.length === 0) {
      const first = nodeMap.values().next().value;
      if (first) roots.push(first);
    }

    nodeMap.forEach((node) => node.children.sort((a, b) => a.logicalIndex - b.logicalIndex));
    roots.sort((a, b) => a.logicalIndex - b.logicalIndex);

    // Iterative (explicit-stack) traversals — a naive recursive post-order
    // (computeWidth) + pre-order (assign) walk blows the JS call stack on a
    // deep/degenerate tree (e.g. a 10k-node chain), since depth == node
    // count in that case.

    // Pass 1: preorder visit order, so that node.width can be computed
    // bottom-up by processing that order in reverse — every descendant of a
    // node appears after it in preorder, hence before it once reversed.
    const preorder: HNode[] = [];
    {
      const stack: HNode[] = [...roots].reverse();
      while (stack.length > 0) {
        const node = stack.pop()!;
        preorder.push(node);
        for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
      }
    }
    for (let i = preorder.length - 1; i >= 0; i--) {
      const node = preorder[i];
      node.width =
        node.children.length === 0
          ? siblingGap
          : node.children.reduce((sum, child) => sum + child.width, 0);
    }
    const totalWidth = roots.reduce((sum, root) => sum + root.width, 0);

    // Pass 2: preorder assignment — each node's x depends only on its
    // parent's cumulative left offset, so a normal (parent-before-children)
    // preorder walk suffices.
    let cursor = -totalWidth / 2 + siblingGap / 2;
    const assignStack: Array<{ node: HNode; left: number; y: number }> = [];
    roots.forEach((root) => {
      assignStack.push({ node: root, left: cursor, y: origin.y });
      cursor += root.width;
    });
    // Process in root order first (stack is LIFO — push roots in reverse so
    // they pop in original order), then depth-first from there.
    assignStack.reverse();
    while (assignStack.length > 0) {
      const { node, left, y } = assignStack.pop()!;
      // Centered within its subtree's block; cancels out to the block's
      // left edge for a leaf (width === siblingGap) and to the true
      // centroid of its children for an internal node.
      node.x = left + node.width / 2 - siblingGap / 2;
      positions.set(node.id, { x: origin.x + node.x, y, z: origin.z });

      let childLeft = left;
      const childFrames: Array<{ node: HNode; left: number; y: number }> = [];
      node.children.forEach((child) => {
        childFrames.push({ node: child, left: childLeft, y: y - levelGap });
        childLeft += child.width;
      });
      for (let i = childFrames.length - 1; i >= 0; i--) assignStack.push(childFrames[i]);
    }

    return positions;
  }
}

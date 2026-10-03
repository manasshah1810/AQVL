import React from 'react';
import { Line, Text } from '@react-three/drei';
import type { SceneElement } from '@aqvl/runtime';
import { restingPosition } from '../generic/scenePositions';

/**
 * Pointer-tree extras (BINARY_TREE / BST, see the runtime's TreeEngine): each
 * tree's name, its call-stack panel while a recursive function runs, the
 * heap-memory box around its unlinked nodes; and the name of each queue /
 * stack row of a tree program.
 */
export const TreeDecorations: React.FC<{ elements: SceneElement[] }> = ({ elements }) => {
  const trees = elements.filter((el) => el.originalType === 'BINARYTREE');
  const containers = elements.filter((el) => el.originalType === 'CONTAINER');
  if (trees.length === 0 && containers.length === 0) return null;
  return (
    <>
      {trees.map((anchor, treeIndex) => {
        const tree = (anchor as any).logicalParent as string;
        const at = restingPosition(anchor);
        const isEmpty = !(anchor as any).rootId;
        const heapNodes = elements.filter(
          (el) => el.originalType === 'TREE_NODE' && (el as any).logicalParent === tree && (el as any).inHeap
        );
        let box: { minX: number; maxX: number; y: number; z: number } | null = null;
        if (heapNodes.length > 0) {
          const xs = heapNodes.map((n) => restingPosition(n).x);
          const p = restingPosition(heapNodes[0]);
          const minX = Math.min(...xs);
          // Wide enough for its caption even around a single node.
          box = { minX, maxX: Math.max(Math.max(...xs), minX + 5.6), y: p.y, z: p.z };
        }
        // One call-stack panel (the program's), under the first tree's name.
        const stack: string[] = treeIndex === 0 ? ((anchor as any).callStack ?? []) : [];
        const shown = [...stack].reverse().slice(0, 9);
        return (
          <group key={`tree-deco-${anchor.id}`}>
            <Text
              position={[at.x, at.y, at.z]}
              fontSize={0.4}
              color={isEmpty ? '#94a3b8' : '#e2e8f0'}
              outlineWidth={0.02}
              outlineColor="#0b1120"
              anchorX="right"
              anchorY="middle"
            >
              {isEmpty ? `${tree}: root = NULL` : tree}
            </Text>
            {stack.length > 0 && (
              <group>
                <Text position={[at.x, at.y - 0.75, at.z]} fontSize={0.24} color="#a5b4fc" anchorX="right" anchorY="middle">
                  Call stack (top = running)
                </Text>
                {shown.map((call, i) => (
                  <Text
                    key={`${call}-${i}`}
                    position={[at.x, at.y - 1.15 - i * 0.34, at.z]}
                    fontSize={0.26}
                    color={i === 0 ? '#67e8f9' : '#818cf8'}
                    outlineWidth={0.015}
                    outlineColor="#0b1120"
                    anchorX="right"
                    anchorY="middle"
                  >
                    {i === 0 ? `> ${call}` : call}
                  </Text>
                ))}
                {stack.length > shown.length && (
                  <Text position={[at.x, at.y - 1.15 - shown.length * 0.34, at.z]} fontSize={0.22} color="#818cf8" anchorX="right" anchorY="middle">
                    {`... ${stack.length - shown.length} more`}
                  </Text>
                )}
              </group>
            )}
            {box && (
              <>
                <Line
                  points={[
                    [box.minX - 1.0, box.y + 1.25, box.z],
                    [box.maxX + 1.0, box.y + 1.25, box.z],
                    [box.maxX + 1.0, box.y - 1.3, box.z],
                    [box.minX - 1.0, box.y - 1.3, box.z],
                    [box.minX - 1.0, box.y + 1.25, box.z],
                  ]}
                  color="#a78bfa"
                  lineWidth={1.5}
                  dashed
                  dashSize={0.25}
                  gapSize={0.15}
                  transparent
                  opacity={0.8}
                />
                <Text position={[box.minX - 0.9, box.y + 1.05, box.z]} fontSize={0.22} color="#c4b5fd" anchorX="left" anchorY="middle">
                  {`Heap memory (${tree}): not in the tree — FREE releases them`}
                </Text>
              </>
            )}
          </group>
        );
      })}
      {containers.map((anchor) => {
        const name = (anchor as any).logicalParent as string;
        const kind = (anchor as any).kind === 'STACK' ? 'stack' : 'queue';
        const at = restingPosition(anchor);
        const empty = !((anchor as any).itemCount > 0);
        return (
          <Text
            key={`ctr-deco-${anchor.id}`}
            position={[at.x, at.y, at.z]}
            fontSize={0.3}
            color="#fcd34d"
            outlineWidth={0.02}
            outlineColor="#0b1120"
            anchorX="right"
            anchorY="middle"
          >
            {`${name} (${kind})${empty ? ': empty' : ''}`}
          </Text>
        );
      })}
    </>
  );
};

import React from 'react';
import { Line, Text } from '@react-three/drei';
import type { SceneElement } from '@aqvl/runtime';
import { restingPosition } from '../generic/scenePositions';

/** Linked-list extras: each list's name, and the heap-memory box around its unlinked nodes. */
export const LinkedListDecorations: React.FC<{ elements: SceneElement[] }> = ({ elements }) => {
  const anchors = elements.filter((el) => el.originalType === 'LINKEDLIST');
  if (anchors.length === 0) return null;
  return (
    <>
      {anchors.map((anchor) => {
        const list = (anchor as any).logicalParent as string;
        const at = restingPosition(anchor);
        const isEmpty = !(anchor as any).headId;
        const heapNodes = elements.filter(
          (el) => el.originalType === 'LINKEDLIST_NODE' && (el as any).logicalParent === list && (el as any).inHeap
        );
        let box: { minX: number; maxX: number; y: number; z: number } | null = null;
        if (heapNodes.length > 0) {
          const xs = heapNodes.map((n) => restingPosition(n).x);
          const p = restingPosition(heapNodes[0]);
          box = { minX: Math.min(...xs), maxX: Math.max(...xs), y: p.y, z: p.z };
        }
        return (
          <group key={`ll-deco-${anchor.id}`}>
            <Text
              position={[at.x + 0.9, at.y, at.z]}
              fontSize={0.36}
              color={isEmpty ? '#94a3b8' : '#e2e8f0'}
              outlineWidth={0.02}
              outlineColor="#0b1120"
              anchorX="right"
              anchorY="middle"
            >
              {isEmpty ? `${list}: head = NULL` : list}
            </Text>
            {box && (
              <>
                <Line
                  points={[
                    [box.minX - 1.1, box.y + 1.35, box.z],
                    [box.maxX + 1.1, box.y + 1.35, box.z],
                    [box.maxX + 1.1, box.y - 0.95, box.z],
                    [box.minX - 1.1, box.y - 0.95, box.z],
                    [box.minX - 1.1, box.y + 1.35, box.z],
                  ]}
                  color="#a78bfa"
                  lineWidth={1.5}
                  dashed
                  dashSize={0.25}
                  gapSize={0.15}
                  transparent
                  opacity={0.8}
                />
                <Text
                  position={[box.minX - 1.0, box.y - 1.2, box.z]}
                  fontSize={0.24}
                  color="#c4b5fd"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`Heap memory (${list}): nodes not in the list — FREE releases them`}
                </Text>
              </>
            )}
          </group>
        );
      })}
    </>
  );
};

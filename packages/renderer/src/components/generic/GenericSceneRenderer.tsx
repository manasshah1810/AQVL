import React from 'react';
import { Line, Text } from '@react-three/drei';
import type { SceneState, SceneElement, EdgeElement, PartitionBoundaryRegion, SortedRegion } from '@aqvl/runtime';
import { PrimitiveNode } from './PrimitiveNode';
import { PrimitiveEdge } from './PrimitiveEdge';
import { EdgeRoute, PrimitiveShape, RenderableConnection, RenderableElement, Vec3 } from './types';
import { CameraController, CameraControllerHandle } from '../camera/CameraController';
import { PartitionBoundary } from '../array/PartitionBoundary';
import { SortedRegionIndicator } from '../array/SortedRegionIndicator';
import type { ArrayCameraChoreographer } from '../array/ArrayCameraChoreographer';

export interface GenericSceneRendererProps {
  sceneState: SceneState | null;
  /** Forwarded to the mounted CameraController so callers (e.g. a reset-camera button) can drive it imperatively. */
  cameraControllerRef?: React.Ref<CameraControllerHandle>;
  onAutoFollowChange?: (autoFollow: boolean) => void;
  /** Forwarded to CameraController's AUTO_FIT branch — see ArrayCameraChoreographer.ts. */
  arrayCameraChoreographer?: ArrayCameraChoreographer;
}

const NODE_SHAPES: PrimitiveShape[] = ['box', 'sphere', 'cylinder'];

function toRenderableElement(el: SceneElement): RenderableElement | null {
  if (!NODE_SHAPES.includes(el.type as PrimitiveShape)) return null;

  return {
    id: el.id,
    position: el.position,
    rotation: el.rotation,
    scale: el.scale,
    shape: el.type as PrimitiveShape,
    color: el.color,
    emissiveColor: el.emissiveColor,
    emissiveIntensity: el.emissiveIntensity,
    opacity: el.opacity,
    label: (el as any).label,
    value: (el as any).value,
    tags: (el as any).tags,
    tagPlacement: (el as any).tagPlacement,
    highlightState: {
      isHighlighted: el.isHighlighted,
      state: el.state,
      highlightType: el.highlightType,
    },
  };
}

function toRenderableConnection(
  el: SceneElement,
  elements: Map<string, SceneElement>
): RenderableConnection | null {
  if (el.type !== 'edge') return null;

  const edge = el as EdgeElement;
  const source = elements.get(edge.sourceId);
  const target = elements.get(edge.targetId);
  if (!source || !target) return null;

  return {
    id: el.id,
    fromId: edge.sourceId,
    toId: edge.targetId,
    from: source.position,
    to: target.position,
    style: edge.directed ? 'arrow' : 'solid',
    color: el.color,
    emissiveColor: el.emissiveColor,
    pointer: (el as any).pointer,
    // A weighted graph edge shows its weight (tree / list edges keep their labels internal).
    label:
      el.originalType === 'GRAPH_EDGE' && (el as any).properties?.label !== undefined && (el as any).properties?.label !== null
        ? String((el as any).properties.label)
        : undefined,
    highlightState: {
      isHighlighted: el.isHighlighted,
      state: el.state,
      highlightType: el.highlightType,
    },
  };
}

/** Where a node will settle (its layout target), falling back to where it is now. */
function restingPosition(el: SceneElement): Vec3 {
  return (el as any).worldTarget ?? el.position;
}

/**
 * Chooses a path for every linked-list pointer (`next` / `prev` edge):
 * - two opposite arrows between the same nodes (a doubly-linked pair, or a
 *   half-reversed list) are drawn apart: rightward one above, leftward one below;
 * - a pointer that skips over nodes on the same row (a circular list's
 *   wrap-around, a cycle back into the list) bends around the row — leftward
 *   ones below it, rightward ones above — instead of running through the nodes;
 * - a node pointing at itself (one-node circular list) gets a small loop.
 */
function routePointerEdges(connections: RenderableConnection[], elements: Map<string, SceneElement>): void {
  const pairs = new Set(connections.map((c) => `${c.fromId}|${c.toId}`));
  for (const c of connections) {
    if (!c.pointer) {
      // Directed graph edges both ways (A -> B and B -> A): drawn side by side, not on top of each other.
      if (c.style === 'arrow' && c.fromId !== c.toId && pairs.has(`${c.toId}|${c.fromId}`)) {
        c.route = { kind: 'straight', offset: c.fromId < c.toId ? 0.18 : -0.18 };
      }
      continue;
    }
    if (c.fromId === c.toId) {
      c.route = { kind: 'loop' };
      continue;
    }
    const from = elements.get(c.fromId);
    const to = elements.get(c.toId);
    if (!from || !to) continue;
    const a = restingPosition(from);
    const b = restingPosition(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let route: EdgeRoute | undefined;
    if (Math.abs(dy) < 0.5 && Math.abs(dx) > 3.4) {
      const bend = Math.min(2.1, 1.0 + 0.07 * Math.abs(dx));
      route = { kind: 'arc', height: dx < 0 ? -bend : bend };
    } else if (pairs.has(`${c.toId}|${c.fromId}`)) {
      route = { kind: 'straight', offset: dx > 0 || (dx === 0 && dy > 0) ? 0.2 : -0.2 };
    }
    c.route = route;
  }
}

/** Linked-list extras: each list's name, and the heap-memory box around its unlinked nodes. */
const LinkedListDecorations: React.FC<{ elements: SceneElement[] }> = ({ elements }) => {
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

/**
 * Pointer-tree extras (BINARY_TREE / BST, see the runtime's TreeEngine): each
 * tree's name, its call-stack panel while a recursive function runs, the
 * heap-memory box around its unlinked nodes; and the name of each queue /
 * stack row of a tree program.
 */
const TreeDecorations: React.FC<{ elements: SceneElement[] }> = ({ elements }) => {
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

/** Resolves the live position of a structure's element at `index` — never a cached/fixed value, since layout can reposition elements between frames. */
function findElementPosition(elements: SceneElement[], structureId: string, index: number): Vec3 | null {
  const el = elements.find(
    (e) => (e as any).logicalParent === structureId && (e as any).logicalIndex === index
  );
  return el ? el.position : null;
}

export const GenericSceneRenderer: React.FC<GenericSceneRendererProps> = ({
  sceneState,
  cameraControllerRef,
  onAutoFollowChange,
  arrayCameraChoreographer,
}) => {
  if (!sceneState || !sceneState.elements) {
    return (
      <CameraController
        ref={cameraControllerRef}
        sceneState={sceneState}
        onAutoFollowChange={onAutoFollowChange}
        arrayCameraChoreographer={arrayCameraChoreographer}
      />
    );
  }

  const elements = Array.from(sceneState.elements.values());
  const nodes = elements
    .map(toRenderableElement)
    .filter((n): n is RenderableElement => n !== null);
  const connections = elements
    .map((el) => toRenderableConnection(el, sceneState.elements))
    .filter((c): c is RenderableConnection => c !== null);
  routePointerEdges(connections, sceneState.elements);

  const partitionBoundaries = (sceneState.partitionBoundaries ?? [])
    .map((b: PartitionBoundaryRegion) => ({
      boundary: b,
      startPosition: findElementPosition(elements, b.structureId, b.startIndex),
      endPosition: findElementPosition(elements, b.structureId, b.endIndex),
    }))
    .filter(
      (b): b is { boundary: PartitionBoundaryRegion; startPosition: Vec3; endPosition: Vec3 } =>
        b.startPosition !== null && b.endPosition !== null
    );

  const sortedRegions = (sceneState.sortedRegions ?? [])
    .map((r: SortedRegion) => ({
      region: r,
      startPosition: findElementPosition(elements, r.structureId, r.startIndex),
      endPosition: findElementPosition(elements, r.structureId, r.endIndex),
    }))
    .filter(
      (r): r is { region: SortedRegion; startPosition: Vec3; endPosition: Vec3 } =>
        r.startPosition !== null && r.endPosition !== null
    );

  return (
    <>
      <CameraController
        ref={cameraControllerRef}
        sceneState={sceneState}
        onAutoFollowChange={onAutoFollowChange}
        arrayCameraChoreographer={arrayCameraChoreographer}
      />
      {partitionBoundaries.map(({ boundary, startPosition, endPosition }) => (
        <PartitionBoundary
          key={`partition-${boundary.structureId}-${boundary.depth}`}
          startPosition={startPosition}
          endPosition={endPosition}
          depth={boundary.depth}
          label={boundary.label}
        />
      ))}
      {sortedRegions.map(({ region, startPosition, endPosition }) => (
        <SortedRegionIndicator
          key={`sorted-region-${region.structureId}`}
          startPosition={startPosition}
          endPosition={endPosition}
        />
      ))}
      {connections.map((c) => (
        <PrimitiveEdge
          key={c.id}
          from={c.from}
          to={c.to}
          color={c.color}
          emissiveColor={c.emissiveColor}
          style={c.style}
          highlightState={c.highlightState}
          route={c.route}
          arrowScale={c.pointer ? 1.6 : 1}
          minOpacity={c.pointer ? 0.85 : undefined}
          label={c.label}
        />
      ))}
      <LinkedListDecorations elements={elements} />
      <TreeDecorations elements={elements} />
      {nodes.map((n) => (
        <PrimitiveNode
          key={n.id}
          position={n.position}
          rotation={n.rotation}
          scale={n.scale}
          shape={n.shape}
          color={n.color}
          emissiveColor={n.emissiveColor}
          emissiveIntensity={n.emissiveIntensity}
          opacity={n.opacity}
          label={n.label}
          value={n.value}
          highlightState={n.highlightState}
          tags={n.tags}
          tagPlacement={n.tagPlacement}
        />
      ))}
    </>
  );
};

export { toRenderableElement, toRenderableConnection };

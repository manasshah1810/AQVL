import React from 'react';
import type { SceneState, SceneElement, EdgeElement, PartitionBoundaryRegion, SortedRegion } from '@aqvl/runtime';
import { PrimitiveNode } from './PrimitiveNode';
import { PrimitiveEdge } from './PrimitiveEdge';
import { PrimitiveShape, RenderableConnection, RenderableElement, Vec3 } from './types';
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
    highlightState: {
      isHighlighted: el.isHighlighted,
      state: el.state,
      highlightType: el.highlightType,
    },
  };
}

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
        />
      ))}
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
        />
      ))}
    </>
  );
};

export { toRenderableElement, toRenderableConnection };

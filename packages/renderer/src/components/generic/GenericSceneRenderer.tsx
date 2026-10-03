import React from 'react';
import type { SceneState, SceneElement, EdgeElement } from '@aqvl/runtime';
import { PrimitiveNode } from './PrimitiveNode';
import { PrimitiveEdge } from './PrimitiveEdge';
import { EdgeRoute, PrimitiveShape, RenderableConnection, RenderableElement } from './types';
import { CameraController, CameraControllerHandle } from '../camera/CameraController';
import type { CameraChoreographer } from '../camera/BaseCameraChoreographer';
import { LiftGroup } from './LiftGroup';
import { resolveDecorations, type SceneMetadata, type TreatedNode } from './decorationProviders';
import { restingPosition } from './scenePositions';
// The default decoration set registers itself through the provider seam; nothing below names it.
import '../decorations/builtinProviders';

export interface GenericSceneRendererProps {
  sceneState: SceneState | null;
  /** Forwarded to the mounted CameraController so callers (e.g. a reset-camera button) can drive it imperatively. */
  cameraControllerRef?: React.Ref<CameraControllerHandle>;
  onAutoFollowChange?: (autoFollow: boolean) => void;
  /** Camera emphasis for CameraController's AUTO_FIT branch — any BaseCameraChoreographer subclass. */
  cameraChoreographer?: CameraChoreographer;
  /** Per-frame data for registered decoration providers, keyed by provider key (see decorationProviders.ts). Absent = only scene-driven decorations. */
  sceneMetadata?: SceneMetadata | null;
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

export const GenericSceneRenderer: React.FC<GenericSceneRendererProps> = ({
  sceneState,
  cameraControllerRef,
  onAutoFollowChange,
  cameraChoreographer,
  sceneMetadata,
}) => {
  if (!sceneState || !sceneState.elements) {
    return (
      <CameraController
        ref={cameraControllerRef}
        sceneState={sceneState}
        onAutoFollowChange={onAutoFollowChange}
        arrayCameraChoreographer={cameraChoreographer}
      />
    );
  }

  const decorations = resolveDecorations(sceneState, sceneMetadata);
  const treating = decorations.find((d) => d.provider.treatNode);

  const elements = Array.from(sceneState.elements.values());
  const nodes = elements
    .map((el): TreatedNode | null => {
      const node = toRenderableElement(el);
      if (!node) return null;
      return treating ? treating.provider.treatNode!(node, el, treating.data) : { node, liftY: 0 };
    })
    .filter((n): n is TreatedNode => n !== null);
  const connections = elements
    .map((el) => toRenderableConnection(el, sceneState.elements))
    .filter((c): c is RenderableConnection => c !== null);
  routePointerEdges(connections, sceneState.elements);

  // A provider may claim connections to draw itself; the rest are plain edges.
  const claimed = new Map<number, RenderableConnection[]>(decorations.map((_, i) => [i, []]));
  const plainConnections = connections.filter((c) => {
    const owner = decorations.findIndex((d) => d.provider.claimsConnection?.(c, d.data));
    if (owner < 0) return true;
    claimed.get(owner)!.push(c);
    return false;
  });
  const layer = (which: 'renderUnderlay' | 'renderOverlay') =>
    decorations.map((d, i) => {
      const render = d.provider[which];
      if (!render) return null;
      return (
        <React.Fragment key={`${which}-${d.provider.key}`}>
          {render({ sceneState, elements, data: d.data, connections: claimed.get(i)! })}
        </React.Fragment>
      );
    });

  return (
    <>
      <CameraController
        ref={cameraControllerRef}
        sceneState={sceneState}
        onAutoFollowChange={onAutoFollowChange}
        arrayCameraChoreographer={cameraChoreographer}
      />
      {layer('renderUnderlay')}
      {plainConnections.map((c) => (
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
      {layer('renderOverlay')}
      {nodes.map(({ node: n, liftY }) => {
        const primitive = (
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
        );
        // Only scenes with a node-treating provider get the lift wrapper, so every other scene's tree is unchanged.
        return treating ? <LiftGroup key={n.id} liftY={liftY}>{primitive}</LiftGroup> : primitive;
      })}
    </>
  );
};

export { toRenderableElement, toRenderableConnection };

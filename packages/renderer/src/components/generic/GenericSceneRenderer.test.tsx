import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { SceneState, SceneElement } from '@aqvl/runtime';
import { GenericSceneRenderer, toRenderableElement, toRenderableConnection } from './GenericSceneRenderer';

function makeEl(partial: Partial<SceneElement> & { id: string; type: string }): SceneElement {
  return {
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#4488ff',
    emissiveIntensity: 0.2,
    emissiveColor: '#112233',
    ...partial,
  } as SceneElement;
}

function sceneStateOf(elements: SceneElement[]): SceneState {
  const map = new Map<string, SceneElement>();
  elements.forEach((el) => map.set(el.id, el));
  return { elements: map };
}

describe('GenericSceneRenderer', () => {
  it('renders one mesh per node element at their given positions', async () => {
    const positions = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 1, z: 0 },
      { x: 3, y: 0, z: 1 },
      { x: 4, y: -1, z: 0 },
      { x: 5, y: 0, z: -1 },
    ];
    const elements = positions.map((position, i) =>
      makeEl({ id: `n${i}`, type: 'box', position })
    );

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(5);

    const renderedPositions = meshes
      .map((m) => m.parent?.instance.position)
      .filter(Boolean)
      .map((p: any) => ({ x: p.x, y: p.y, z: p.z }));

    positions.forEach((p) => {
      expect(renderedPositions).toContainEqual(p);
    });
  });

  it('renders box, sphere and cylinder shapes with the correct geometry', async () => {
    const elements = [
      makeEl({ id: 'b', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({ id: 's', type: 'sphere', position: { x: 1, y: 0, z: 0 } }),
      makeEl({ id: 'c', type: 'cylinder', position: { x: 2, y: 0, z: 0 } }),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('ExtrudeGeometry').length).toBe(1); // RoundedBox
    expect(renderer.scene.findAllByType('SphereGeometry').length).toBe(1);
    expect(renderer.scene.findAllByType('CylinderGeometry').length).toBe(1);
  });

  it('renders a connection between two elements as a PrimitiveEdge line', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 3, y: 0, z: 0 } }),
      makeEl({
        id: 'e1',
        type: 'edge',
        sourceId: 'a',
        targetId: 'b',
        directed: false,
      } as any),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Line2').length).toBe(1);
    // undirected: no arrowhead cone
    expect(renderer.scene.findAllByType('ConeGeometry').length).toBe(0);
  });

  it('renders an arrowhead for directed connections only', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 3, y: 0, z: 0 } }),
      makeEl({
        id: 'e1',
        type: 'edge',
        sourceId: 'a',
        targetId: 'b',
        directed: true,
      } as any),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Line2').length).toBe(1);
    expect(renderer.scene.findAllByType('ConeGeometry').length).toBe(1);
  });

  it('renders nothing and does not crash for a null scene state', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericSceneRenderer sceneState={null} />);
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
    expect(renderer.scene.findAllByType('Line2').length).toBe(0);
  });

  it('renders nothing and does not crash for an empty elements map', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf([])} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('skips elements whose type is not a known primitive shape or edge', async () => {
    const elements = [
      makeEl({ id: 'n', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({ id: 'unknown', type: 'CONTAINER_LABEL', position: { x: 1, y: 0, z: 0 } }),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
  });

  it('renders a partition boundary resolved against the live positions of its start/end elements', async () => {
    const elements = [
      makeEl({ id: 'a0', type: 'box', position: { x: 0, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 0 } as any),
      makeEl({ id: 'a1', type: 'box', position: { x: 1, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 1 } as any),
      makeEl({ id: 'a2', type: 'box', position: { x: 2, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 2 } as any),
    ];
    const sceneState: SceneState = {
      ...sceneStateOf(elements),
      partitionBoundaries: [{ structureId: 'arr', startIndex: 0, endIndex: 2, depth: 0 }],
    };

    const renderer = await ReactThreeTestRenderer.create(<GenericSceneRenderer sceneState={sceneState} />);
    await renderer.advanceFrames(1, 0.016);

    const planeMeshes = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => (m.instance as any).geometry?.type === 'PlaneGeometry');
    expect(planeMeshes.length).toBe(2);
  });

  it('does not render a partition boundary when its structure has no elements at the given indices', async () => {
    const elements = [makeEl({ id: 'a0', type: 'box', position: { x: 0, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 0 } as any)];
    const sceneState: SceneState = {
      ...sceneStateOf(elements),
      partitionBoundaries: [{ structureId: 'arr', startIndex: 0, endIndex: 5, depth: 0 }],
    };

    const renderer = await ReactThreeTestRenderer.create(<GenericSceneRenderer sceneState={sceneState} />);
    await renderer.advanceFrames(1, 0.016);

    const planeMeshes = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => (m.instance as any).geometry?.type === 'PlaneGeometry');
    expect(planeMeshes.length).toBe(0);
  });

  it('renders a sorted-region floor strip resolved against the live positions of its start/end elements', async () => {
    const elements = [
      makeEl({ id: 'a0', type: 'box', position: { x: 0, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 0 } as any),
      makeEl({ id: 'a1', type: 'box', position: { x: 1, y: 0, z: 0 }, logicalParent: 'arr', logicalIndex: 1 } as any),
    ];
    const sceneState: SceneState = {
      ...sceneStateOf(elements),
      sortedRegions: [{ structureId: 'arr', startIndex: 0, endIndex: 1 }],
    };

    const renderer = await ReactThreeTestRenderer.create(<GenericSceneRenderer sceneState={sceneState} />);
    await renderer.advanceFrames(1, 0.016);

    const boxMeshes = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => (m.instance as any).geometry?.type === 'BoxGeometry');
    expect(boxMeshes.length).toBe(1);
  });

  it('skips a connection whose source or target element is missing', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({
        id: 'e1',
        type: 'edge',
        sourceId: 'a',
        targetId: 'does-not-exist',
        directed: false,
      } as any),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf(elements)} />
    );
    await renderer.advanceFrames(1, 0.016);

    expect(renderer.scene.findAllByType('Line2').length).toBe(0);
  });

  it('animates node color toward the highlight accent when isHighlighted is set', async () => {
    const highlighted = makeEl({
      id: 'h',
      type: 'box',
      position: { x: 0, y: 0, z: 0 },
      color: '#4488ff',
      isHighlighted: true,
    });
    const idle = makeEl({
      id: 'i',
      type: 'box',
      position: { x: 1, y: 0, z: 0 },
      color: '#4488ff',
      isHighlighted: false,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <GenericSceneRenderer sceneState={sceneStateOf([highlighted, idle])} />
    );
    // Advance several frames so the highlight lerp progresses noticeably.
    await renderer.advanceFrames(30, 0.05);

    const meshes = renderer.scene.findAllByType('Mesh');
    const colors = meshes.map((m: any) => (m.instance.material as any).color.getHexString());

    // The highlighted node's material should have lerped away from the base
    // color toward the accent color, while the idle one stays at/near base.
    expect(new Set(colors).size).toBe(2);
  });
});

describe('generic scene mapping (structure-agnostic)', () => {
  it('maps a box element to a RenderableElement with matching shape and position', () => {
    const el = makeEl({ id: 'x', type: 'box', position: { x: 5, y: 6, z: 7 }, label: 'foo' } as any);
    const renderable = toRenderableElement(el);

    expect(renderable).not.toBeNull();
    expect(renderable?.shape).toBe('box');
    expect(renderable?.position).toEqual({ x: 5, y: 6, z: 7 });
    expect(renderable?.label).toBe('foo');
  });

  it('returns null for non-node, non-edge element types', () => {
    const el = makeEl({ id: 'x', type: 'ARRAY_LABEL' });
    expect(toRenderableElement(el)).toBeNull();
  });

  it('resolves a connection to the live positions of its source and target', () => {
    const elements = sceneStateOf([
      makeEl({ id: 'a', type: 'box', position: { x: 0, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 9, y: 9, z: 9 } }),
    ]).elements;
    const edge = makeEl({ id: 'e', type: 'edge', sourceId: 'a', targetId: 'b', directed: true } as any);

    const connection = toRenderableConnection(edge, elements);

    expect(connection).not.toBeNull();
    expect(connection?.from).toEqual({ x: 0, y: 0, z: 0 });
    expect(connection?.to).toEqual({ x: 9, y: 9, z: 9 });
    expect(connection?.style).toBe('arrow');
  });
});

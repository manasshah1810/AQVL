import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ARRAY_ELEMENT_STATES, ArrayElementState } from './elementStates';
import { formatArrayValue, getValueLabelDensityConfig } from './valueFormatting';

// troika-three-text (used by drei's <Text>) reaches for browser globals (`self`)
// that don't exist under this package's node test environment. Stand in with a
// lightweight mesh so ArrayElementNode's own logic (color/scale/opacity/material,
// which is what these tests care about) can be exercised headlessly, the same way
// GenericSceneRenderer.test.tsx avoids it by never passing a `value` prop.
vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<typeof import('@react-three/drei')>('@react-three/drei');
  return {
    ...actual,
    Text: ({ children }: { children?: React.ReactNode }) => (
      <mesh userData={{ isMockText: true, text: String(children) }}>
        <sphereGeometry args={[0.001, 4, 4]} />
        <meshBasicMaterial />
      </mesh>
    ),
  };
});

const { ArrayElementNode } = await import('./ArrayElementNode');

const ALL_STATES: ArrayElementState[] = [
  'default',
  'comparing',
  'swapping',
  'confirmed-sorted',
  'selected',
  'search-candidate',
  'confirmed-match',
  'out-of-range',
];

async function renderElement(props: Partial<React.ComponentProps<typeof ArrayElementNode>> = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <ArrayElementNode
      position={{ x: 0, y: 0, z: 0 }}
      index={0}
      value={5}
      arrayLength={5}
      {...props}
    />
  );
  await renderer.advanceFrames(5, 0.016);
  return renderer;
}

/** The element's body mesh (RoundedBox, which renders as an ExtrudeGeometry mesh). */
function findBodyMesh(renderer: Awaited<ReturnType<typeof renderElement>>) {
  const mesh = renderer.scene
    .findAllByType('Mesh')
    .find((m) => m.instance.geometry?.type === 'ExtrudeGeometry');
  if (!mesh) throw new Error('body mesh not found');
  return mesh;
}

describe('ArrayElementNode states', () => {
  it.each(ALL_STATES)('renders the %s state with its exact spec color', async (state) => {
    const renderer = await renderElement({ state });
    const material = findBodyMesh(renderer).instance.material as any;

    expect(`#${material.color.getHexString()}`).toBe(ARRAY_ELEMENT_STATES[state].color);
  });

  it('applies the comparing state lift and elevated scale', async () => {
    const renderer = await renderElement({ state: 'comparing' });
    const scaledGroup = renderer.scene
      .findAllByType('Group')
      .find((g) => Math.abs(g.instance.scale.x - 1.15) < 0.01);

    expect(scaledGroup).toBeDefined();
  });

  it('drops opacity and scale for the out-of-range state', async () => {
    const renderer = await renderElement({ state: 'out-of-range' });
    const material = findBodyMesh(renderer).instance.material as any;

    expect(material.opacity).toBeCloseTo(0.4, 1);
  });

  it('holds a persistent low glow for confirmed-sorted without a scale boost', async () => {
    const renderer = await renderElement({ state: 'confirmed-sorted' });
    const material = findBodyMesh(renderer).instance.material as any;

    expect(material.emissiveIntensity).toBeCloseTo(0.2, 1);
  });

  it('renders a floor strip only for confirmed-sorted, not confirmed-match', async () => {
    const sorted = await renderElement({ state: 'confirmed-sorted' });
    const match = await renderElement({ state: 'confirmed-match' });

    // Floor strip + box body -> at least 2 meshes for sorted; ring burst may add extras for match
    // but neither state's mesh count assertion depends on the other, so check box geometry directly.
    const sortedBoxGeoms = sorted.scene.findAllByType('BoxGeometry');
    const matchBoxGeoms = match.scene.findAllByType('BoxGeometry');

    expect(sortedBoxGeoms.length).toBeGreaterThan(matchBoxGeoms.length);
  });
});

describe('ArrayElementNode value display', () => {
  it('formats a numeric value onto the value label', async () => {
    const renderer = await renderElement({ value: 42 });
    const labels = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => m.instance.userData?.isMockText);

    expect(labels.some((m) => m.instance.userData.text === '42')).toBe(true);
    expect(formatArrayValue(42)).toBe('42');
  });

  it('formats a string value onto the value label', async () => {
    const renderer = await renderElement({ value: 'hello' as any });
    const labels = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => m.instance.userData?.isMockText);

    expect(labels.some((m) => m.instance.userData.text === 'hello')).toBe(true);
    expect(formatArrayValue('hello')).toBe('hello');
  });

  it('formats very large and very small/negative numeric values without overflowing', () => {
    expect(formatArrayValue(1_500_000)).toBe((1_500_000).toExponential(2));
    expect(formatArrayValue(-0.000012)).toBe((-0.000012).toExponential(2));
    expect(formatArrayValue(-42)).toBe('-42');
    expect(formatArrayValue(Number.NaN)).toBe('NaN');
    expect(formatArrayValue(Number.POSITIVE_INFINITY)).toBe('∞');
  });

  it('hides labels past the density hide-threshold unless force-shown', () => {
    const dense = getValueLabelDensityConfig(500, false);
    const denseForced = getValueLabelDensityConfig(500, true);
    const small = getValueLabelDensityConfig(5, false);

    expect(dense.visible).toBe(false);
    expect(denseForced.visible).toBe(true);
    expect(small.visible).toBe(true);
    expect(small.fontSize).toBeGreaterThan(denseForced.fontSize);
  });
});

describe('ArrayElementNode magnitude scaling', () => {
  it('scales height proportionally to value when magnitude scaling is enabled', async () => {
    const big = await ReactThreeTestRenderer.create(
      <ArrayElementNode
        position={{ x: 0, y: 0, z: 0 }}
        index={0}
        value={100}
        arrayLength={2}
        maxAbsValue={100}
        magnitudeScaling
      />
    );
    await big.advanceFrames(60, 0.05);

    const small = await ReactThreeTestRenderer.create(
      <ArrayElementNode
        position={{ x: 0, y: 0, z: 0 }}
        index={1}
        value={10}
        arrayLength={2}
        maxAbsValue={100}
        magnitudeScaling
      />
    );
    await small.advanceFrames(60, 0.05);

    const bigGroup = big.scene.findAllByType('Group')[1].instance;
    const smallGroup = small.scene.findAllByType('Group')[1].instance;

    expect(bigGroup.scale.y).toBeGreaterThan(smallGroup.scale.y);
  });

  it('clamps magnitude-scaled height to a visible minimum for zero/near-zero values', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ArrayElementNode
        position={{ x: 0, y: 0, z: 0 }}
        index={0}
        value={0}
        arrayLength={2}
        maxAbsValue={100}
        magnitudeScaling
      />
    );
    await renderer.advanceFrames(60, 0.05);

    const group = renderer.scene.findAllByType('Group')[1].instance;
    expect(group.scale.y).toBeGreaterThan(0.25);
  });

  it('does not break layout for negative and very large values under magnitude scaling', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ArrayElementNode
        position={{ x: 0, y: 0, z: 0 }}
        index={0}
        value={-999999}
        arrayLength={2}
        magnitudeScaling
      />
    );
    await renderer.advanceFrames(10, 0.05);

    const group = renderer.scene.findAllByType('Group')[1].instance;
    expect(Number.isFinite(group.scale.y)).toBe(true);
    expect(group.scale.y).toBeGreaterThan(0);
  });
});

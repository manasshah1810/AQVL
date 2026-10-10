import { describe, expect, it } from 'vitest';
import { Group, PointLight, Vector3 } from 'three';
import { LightPool } from './lightPool';

function sources(positions: [number, number, number][], intensity: number[]): PointLight[] {
  const root = new Group();
  const list = positions.map((p, i) => {
    const l = new PointLight('#ffaa00', intensity[i], 6, 1.6);
    l.position.set(...p);
    l.visible = false;
    root.add(l);
    return l;
  });
  root.updateMatrixWorld(true);
  return list;
}

const run = (pool: LightPool, list: PointLight[], focus: Vector3, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) pool.update(1 / 60, list, focus);
};

describe('LightPool', () => {
  it('keeps a fixed number of real lights', () => {
    expect(new LightPool(3).lights).toHaveLength(3);
  });

  it('lends its lights to the brightest sources nearest the focus', () => {
    const list = sources([[0, 0, 0], [50, 0, 0], [1, 0, 0], [60, 0, 0], [2, 0, 0], [-50, 0, 0]], [3, 3, 3, 3, 3, 3]);
    const pool = new LightPool(3);
    run(pool, list, new Vector3(0, 0, 0), 1.5);
    const lit = pool.lights.filter((l) => l.intensity > 0).map((l) => Math.round(l.position.x));
    expect(lit.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('is dark when every source is dark, and follows the focus when it moves', () => {
    const list = sources([[0, 0, 0], [80, 0, 0]], [0, 0]);
    const pool = new LightPool(1);
    run(pool, list, new Vector3(0, 0, 0), 1);
    expect(pool.lights[0].intensity).toBe(0);
    list[0].intensity = 3;
    list[1].intensity = 3;
    run(pool, list, new Vector3(80, 0, 0), 1.5);
    expect(pool.lights[0].position.x).toBe(80);
    expect(pool.lights[0].intensity).toBeCloseTo(3, 1);
    run(pool, list, new Vector3(0, 0, 0), 1.5);
    expect(pool.lights[0].position.x).toBe(0);
  });

  it('fades a light out before it moves to another source (no pop)', () => {
    const list = sources([[0, 0, 0], [80, 0, 0]], [3, 3]);
    const pool = new LightPool(1);
    run(pool, list, new Vector3(0, 0, 0), 1.5);
    expect(pool.lights[0].intensity).toBeCloseTo(3, 1);
    const seen: number[] = [];
    for (let t = 0; t < 1; t += 1 / 60) {
      pool.update(1 / 60, list, new Vector3(80, 0, 0));
      seen.push(pool.lights[0].intensity);
    }
    expect(Math.min(...seen)).toBeLessThan(0.5);
    for (let i = 1; i < seen.length; i++) expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThan(1.2);
  });
});

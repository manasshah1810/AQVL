import { describe, expect, it } from 'vitest';
import { Color, Mesh, Vector3, type Object3D } from 'three';
import { PANDA_PERSONALITIES, buildPanda, buildPandaRaw, buildPenguin, buildPenguinRaw, mergeRigParts, rigProbeInputs, type Rig, type RigInput } from './rigs';
import { buildColonyPenguin, buildColonyPenguinRaw } from './penguinRig';

/** Where every visible vertex of every material ends up in the world: the picture, independent of how many meshes draw it. */
function picture(rig: Rig): Map<string, { n: number; sum: Vector3; sq: number }> {
  rig.root.updateMatrixWorld(true);
  const out = new Map<string, { n: number; sum: Vector3; sq: number }>();
  const v = new Vector3();
  rig.root.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    const mat = m.material as { color?: Color; emissive?: Color; opacity?: number; emissiveIntensity?: number };
    const key = `${mat.color?.getHexString()}|${mat.emissive?.getHexString()}|${mat.emissiveIntensity}|${mat.opacity}`;
    const pos = m.geometry.attributes.position;
    const e = out.get(key) ?? { n: 0, sum: new Vector3(), sq: 0 };
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      e.n++;
      e.sum.add(v);
      e.sq += v.lengthSq();
    }
    out.set(key, e);
  });
  return out;
}

function draws(rig: Rig): number {
  let n = 0;
  rig.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    n++;
  });
  return n;
}

function same(a: Rig, b: Rig, input: RigInput) {
  a.update(input);
  b.update(input);
  const pa = picture(a);
  const pb = picture(b);
  expect([...pb.keys()].sort()).toEqual([...pa.keys()].sort());
  for (const [k, ea] of pa) {
    const eb = pb.get(k)!;
    expect(eb.n).toBe(ea.n);
    expect(eb.sum.distanceTo(ea.sum)).toBeLessThan(1e-3 * Math.max(1, ea.n));
    expect(Math.abs(eb.sq - ea.sq)).toBeLessThan(1e-3 * Math.max(1, ea.n));
  }
}

const cases: [string, () => Rig, () => Rig][] = [
  ['penguin', () => buildPenguinRaw({ scarf: ['#c8406a', '#f6e7d2'], personality: undefined }), () => buildPenguin({ scarf: ['#c8406a', '#f6e7d2'], personality: undefined })],
  ['panda', () => buildPandaRaw({ prop: 'bamboo', personality: PANDA_PERSONALITIES[0] }), () => buildPanda({ prop: 'bamboo', personality: PANDA_PERSONALITIES[0] })],
  ['panda with lamp and bag', () => buildPandaRaw({ prop: 'leaf', lamp: true, bag: '#3f7fb5', hat: '#e0b33a' } as never), () => buildPanda({ prop: 'leaf', lamp: true, bag: '#3f7fb5', hat: '#e0b33a' } as never)],
  ['colony penguin', () => buildColonyPenguinRaw({} as never), () => buildColonyPenguin({} as never)],
];

describe('merging an animal into fewer meshes does not change the picture', () => {
  for (const [name, raw, merged] of cases) {
    it(name, () => {
      const a = raw();
      const b = merged();
      // Later inputs than the ones the merge was probed with, and in a different order.
      const inputs = rigProbeInputs();
      const order = [...inputs].reverse();
      for (let i = 0; i < order.length; i += 3) same(a, b, order[i]);
      for (const input of inputs) same(a, b, input);
      // Inputs the probe never saw: random time, seed, poses, gaits and fidgets.
      let seedN = 7;
      const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
      const base = inputs[0];
      const acts = inputs.filter((i) => i.idle).map((i) => i.idle!.act);
      const poses = inputs.map((i) => i.pose);
      const gaits = inputs.map((i) => i.gait);
      const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
      for (let k = 0; k < 150; k++) {
        same(a, b, {
          ...base,
          time: rnd() * 40,
          seed: rnd() * 5,
          gait: pick(gaits),
          gaitPhase: rnd() * 12,
          gaitWeight: rnd(),
          pose: pick(poses),
          poseWeight: rnd(),
          poseTime: rnd() * 3,
          prevPose: pick(poses),
          prevWeight: rnd() * 0.5,
          lookLocal: [(rnd() - 0.5) * 6, rnd() * 2, (rnd() - 0.3) * 6],
          idle: rnd() < 0.7 ? { act: pick(acts), t: rnd() * 5, weight: rnd() } : undefined,
          fish: rnd() < 0.2 ? rnd() : undefined,
          react: rnd() < 0.2 ? rnd() * 2 : -1,
        });
      }
      expect(draws(b)).toBeLessThan(draws(a));
    });
  }
  it('mergeRigParts leaves nothing to dispose twice', () => {
    const r = mergeRigParts(buildPandaRaw({ prop: 'leaf' }));
    expect(() => r.dispose()).not.toThrow();
  });
});

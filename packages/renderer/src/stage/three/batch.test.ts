import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { batchStatic, dedupeMaterials, probeDynamic, splitByCell } from './batch';

const triangles = (root: Group): number => {
  let n = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return n;
};
const meshes = (root: Group): number => {
  let n = 0;
  root.traverse((o) => {
    if ((o as Mesh).isMesh) n++;
  });
  return n;
};
/** Sum of every vertex in the world: the picture, however many meshes it is drawn with. */
const centroid = (root: Group): Vector3 => {
  root.updateMatrixWorld(true);
  const sum = new Vector3();
  const v = new Vector3();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) sum.add(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  });
  return sum;
};

describe('batchStatic', () => {
  const build = () => {
    const root = new Group();
    const wood = new MeshStandardMaterial({ color: '#aa8855' });
    const stone = new MeshStandardMaterial({ color: '#888888' });
    const geo = new BoxGeometry(1, 1, 1);
    const arm = new Group();
    arm.position.set(0, 2, 0);
    root.add(arm);
    for (let i = 0; i < 20; i++) {
      const m = new Mesh(geo, i % 2 ? wood : stone);
      m.position.set(i * 0.5, 0, i * 0.2);
      m.rotation.set(0.1 * i, 0.2 * i, 0);
      m.scale.set(1, 1 + i * 0.05, 1);
      (i < 10 ? root : arm).add(m);
    }
    return { root, arm };
  };

  it('turns many parts into one mesh per material and frame, without moving anything', () => {
    const { root } = build();
    const before = centroid(root);
    const trisBefore = triangles(root);
    const r = batchStatic(root);
    expect(r.before).toBe(20);
    expect(meshes(root)).toBe(2);
    expect(triangles(root)).toBe(trisBefore);
    expect(centroid(root).distanceTo(before)).toBeLessThan(1e-3);
  });

  it('leaves a part that moves on its own alone, and it keeps moving the parts below it', () => {
    const { root, arm } = build();
    const before = centroid(root);
    batchStatic(root, { dynamic: new Set([arm]) });
    // The root's two materials, the arm's two materials.
    expect(meshes(root)).toBe(4);
    expect(centroid(root).distanceTo(before)).toBeLessThan(1e-3);
    arm.rotation.z = 1;
    arm.position.y = 5;
    expect(centroid(root).distanceTo(before)).toBeGreaterThan(1);
  });

  it('keeps mirrored parts facing outward', () => {
    const root = new Group();
    const mat = new MeshStandardMaterial();
    const a = new Mesh(new BoxGeometry(1, 1, 1), mat);
    const b = new Mesh(new BoxGeometry(1, 1, 1), mat);
    b.scale.x = -1;
    b.position.x = 3;
    root.add(a, b);
    batchStatic(root);
    const merged = root.children.find((c) => (c as Mesh).isMesh) as Mesh;
    const p = merged.geometry.attributes.position;
    const n = merged.geometry.attributes.normal;
    const idx = merged.geometry.index!;
    let inward = 0;
    const v0 = new Vector3();
    const v1 = new Vector3();
    const v2 = new Vector3();
    const e1 = new Vector3();
    const e2 = new Vector3();
    const face = new Vector3();
    const stored = new Vector3();
    for (let t = 0; t < idx.count; t += 3) {
      v0.fromBufferAttribute(p, idx.getX(t));
      v1.fromBufferAttribute(p, idx.getX(t + 1));
      v2.fromBufferAttribute(p, idx.getX(t + 2));
      face.crossVectors(e1.subVectors(v1, v0), e2.subVectors(v2, v0));
      stored.fromBufferAttribute(n, idx.getX(t));
      if (face.dot(stored) < 0) inward++;
    }
    expect(inward).toBe(0);
  });

  it('does not touch meshes it was told to keep', () => {
    const { root } = build();
    const pick = root.children.find((c) => (c as Mesh).isMesh)!;
    batchStatic(root, { keep: new Set([pick]) });
    expect(root.children).toContain(pick);
  });
});

describe('probeDynamic', () => {
  it('finds exactly what moves or shows and hides', () => {
    const root = new Group();
    const still = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const mover = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const blinker = new Group();
    root.add(still, mover, blinker);
    const dyn = probeDynamic(
      root,
      (i) => {
        mover.position.x = Math.sin(i);
        blinker.visible = i % 3 !== 0;
      },
      8,
    );
    expect(dyn.has(mover)).toBe(true);
    expect(dyn.has(blinker)).toBe(true);
    expect(dyn.has(still)).toBe(false);
  });
});

describe('dedupeMaterials', () => {
  it('points identical looks at one material, but never at or away from a protected one', () => {
    const root = new Group();
    const geo = new SphereGeometry(1, 6, 4);
    const a = new MeshStandardMaterial({ color: new Color('#ff0000'), roughness: 0.5 });
    const b = new MeshStandardMaterial({ color: new Color('#ff0000'), roughness: 0.5 });
    const c = new MeshStandardMaterial({ color: new Color('#ff0000'), roughness: 0.9 });
    const glow = new MeshStandardMaterial({ color: new Color('#ff0000'), roughness: 0.5 });
    const ms = [a, b, c, glow].map((m) => new Mesh(geo, m));
    root.add(...ms);
    expect(dedupeMaterials(root, [glow])).toBe(1);
    expect(ms[1].material).toBe(a);
    expect(ms[2].material).toBe(c);
    expect(ms[3].material).toBe(glow);
  });
});

describe('splitByCell', () => {
  it('keeps every triangle exactly once, in patches with their own bounds', () => {
    const spheres = [
      new SphereGeometry(1, 8, 6).translate(13, 13, 13).toNonIndexed(),
      new SphereGeometry(1, 8, 6).translate(113, 13, 13).toNonIndexed(),
      new SphereGeometry(1, 8, 6).translate(13, 13, 113).toNonIndexed(),
    ];
    const total = spheres.reduce((a, g) => a + g.attributes.position.count / 3, 0);
    const all: number[] = [];
    for (const g of spheres) all.push(...Array.from(g.attributes.position.array));
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(all), 3));
    const out = splitByCell(geo, 26);
    expect(out.length).toBe(3);
    expect(out.reduce((a, g) => a + g.attributes.position.count / 3, 0)).toBe(total);
    out.forEach((g) => expect(g.boundingSphere!.radius).toBeLessThan(3));
  });
});

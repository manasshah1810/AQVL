import { BufferAttribute, BufferGeometry, Color, Material, Matrix4, Mesh, Object3D, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Draw-call batching for scenery and rigs.
 *
 * A WebGL draw call costs the CPU roughly the same whether it draws a bamboo
 * rail or a whole fence, so hundreds of small primitives sharing a handful
 * of materials are far cheaper as a few merged meshes. This works in "frames":
 * a frame is the root, or any object that moves on its own (a joint, a door,
 * a pivot the world swings). Everything below a frame that never moves
 * relative to it is baked into the frame's space and merged per material.
 * Materials are kept as they are, so a glow or a tint that is animated through
 * its material keeps working.
 */

const _m = new Matrix4();

interface Keyed {
  mats: Material;
  geos: BufferGeometry[];
  proto: Mesh;
}

/** Which objects under `root` move relative to their parent (or show/hide) while `drive(i)` is called for i = 0..samples. */
export function probeDynamic(root: Object3D, drive: (i: number) => void, samples: number, eps = 1e-5): Set<Object3D> {
  const objs: Object3D[] = [];
  root.traverse((o) => objs.push(o));
  const first = new Map<Object3D, number[]>();
  const dynamic = new Set<Object3D>();
  const read = (o: Object3D): number[] => [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z, o.visible ? 1 : 0];
  for (let i = 0; i < samples; i++) {
    drive(i);
    for (const o of objs) {
      const now = read(o);
      const was = first.get(o);
      if (!was) {
        first.set(o, now);
        continue;
      }
      if (dynamic.has(o)) continue;
      for (let k = 0; k < now.length; k++) {
        if (Math.abs(now[k] - was[k]) > eps) {
          dynamic.add(o);
          break;
        }
      }
    }
  }
  return dynamic;
}

export interface BatchOptions {
  /** Objects that move on their own: each is left in place and is the frame of whatever is below it. */
  dynamic?: ReadonlySet<Object3D>;
  /** Objects (and everything below) that must stay as they are (pointer targets, things other code looks up). */
  keep?: ReadonlySet<Object3D>;
  /** Geometries created for the merge are handed here, for disposal with the rest of the scene. */
  onGeometry?: (g: BufferGeometry) => void;
}

export interface BatchResult {
  before: number;
  after: number;
}

function usable(m: Mesh): boolean {
  const mm = m as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean };
  return !mm.isInstancedMesh && !mm.isSkinnedMesh && !Array.isArray(m.material) && !(m.material as Material).transparent && !!m.geometry && !!m.geometry.attributes.position;
}

/** Merges the static parts of `root` per frame and per material. Returns how many meshes were drawn before and after. */
export function batchStatic(root: Object3D, options: BatchOptions = {}): BatchResult {
  const dynamic = options.dynamic ?? new Set<Object3D>();
  const keep = options.keep ?? new Set<Object3D>();
  let before = 0;
  let after = 0;

  const frames: Object3D[] = [];
  root.traverse((o) => {
    if (o === root || dynamic.has(o)) frames.push(o);
  });

  for (const frame of frames) {
    if (keep.has(frame)) continue;
    const groups = new Map<string, Keyed>();
    const emptied = new Set<Object3D>();
    const collect = (parent: Object3D, to: Matrix4, visible: boolean) => {
      for (const child of [...parent.children]) {
        if (keep.has(child)) continue;
        if (dynamic.has(child)) continue; // its own frame
        child.updateMatrix();
        const local = new Matrix4().multiplyMatrices(to, child.matrix);
        const vis = visible && child.visible;
        const mesh = child as Mesh;
        if (mesh.isMesh) {
          before++;
          if (vis && usable(mesh) && child.children.length === 0) {
            const mat = mesh.material as Material;
            const attrs = Object.keys(mesh.geometry.attributes).sort().join(',');
            const key = `${mat.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.layers.mask}|${mesh.renderOrder}|${attrs}|${mesh.geometry.index ? 'i' : 'n'}|${mesh.frustumCulled ? 1 : 0}`;
            let g = groups.get(key);
            if (!g) groups.set(key, (g = { mats: mat, geos: [], proto: mesh }));
            _m.copy(local);
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(_m);
            // A mirrored part would draw inside out once baked: turn its triangles round.
            if (_m.determinant() < 0) flipWinding(geo);
            g.geos.push(geo);
            parent.remove(child);
            emptied.add(parent);
            continue;
          }
          after++;
        }
        if (child.children.length) collect(child, local, vis);
      }
    };
    collect(frame, new Matrix4(), frame.visible || frame === root);

    for (const g of groups.values()) {
      const merged = g.geos.length === 1 ? g.geos[0] : mergeGeometries(g.geos, false);
      // A set that will not merge (it should not happen: the key matches attributes) stays as separate meshes.
      const parts = merged ? [merged] : g.geos;
      if (merged && g.geos.length > 1) g.geos.forEach((x) => x.dispose());
      for (const part of parts) {
        part.computeBoundingSphere();
        const mesh = new Mesh(part, g.mats);
        mesh.castShadow = g.proto.castShadow;
        mesh.receiveShadow = g.proto.receiveShadow;
        mesh.layers.mask = g.proto.layers.mask;
        mesh.renderOrder = g.proto.renderOrder;
        mesh.frustumCulled = g.proto.frustumCulled;
        mesh.matrixAutoUpdate = false;
        frame.add(mesh);
        options.onGeometry?.(part);
        after++;
      }
    }
    // Groups left with nothing in them are only work for the matrix pass.
    for (const e of emptied) pruneEmpty(e, frame, dynamic, keep);
  }
  return { before, after };
}

function pruneEmpty(node: Object3D, frame: Object3D, dynamic: ReadonlySet<Object3D>, keep: ReadonlySet<Object3D>): void {
  let cur: Object3D | null = node;
  while (cur && cur !== frame && cur.parent && cur.children.length === 0 && !dynamic.has(cur) && !keep.has(cur) && !(cur as Mesh).isMesh && !(cur as unknown as { isLight?: boolean }).isLight) {
    const up: Object3D = cur.parent;
    up.remove(cur);
    cur = up;
  }
}

function flipWinding(geo: BufferGeometry): void {
  const index = geo.index;
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
    index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(geo.attributes)) {
    const at = geo.attributes[name];
    const n = at.itemSize;
    for (let i = 0; i + 2 < at.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = at.getComponent(i + 1, k);
        at.setComponent(i + 1, k, at.getComponent(i + 2, k));
        at.setComponent(i + 2, k, t);
      }
    }
  }
}

/**
 * Scenery is usually built with a fresh material per piece, so a village of
 * a hundred pale boxes has a hundred materials, and each one is a program
 * change and a uniform upload when drawn (and a separate mesh once merged).
 * This points every mesh under `root` at one canonical material per distinct
 * look. `protect` lists the materials some code animates by name (a lamp's
 * glow, a screen): those are never replaced and never stand in for another.
 * Only plain standard materials, and the rabbit kingdom's soft-toy variant
 * (whose extra shader code depends on nothing but its cache key), are touched.
 */
export function dedupeMaterials(root: Object3D, protect: Iterable<Material> = []): number {
  const guarded = new Set<Material>(protect);
  const canon = new Map<string, Material>();
  const swapped = new Map<Material, Material>();
  let replaced = 0;
  const hex = (c: Color | undefined) => (c ? c.getHexString() : '-');
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as Material | Material[];
    if (Array.isArray(m)) return;
    const prior = swapped.get(m);
    if (prior) {
      mesh.material = prior;
      return;
    }
    if (guarded.has(m)) return;
    const std = m as MeshStandardMaterial & { sheen?: number; sheenColor?: Color; sheenRoughness?: number };
    if (!std.isMeshStandardMaterial) return;
    const key = std.customProgramCacheKey ? std.customProgramCacheKey() : '';
    const plainShader = std.onBeforeCompile === Material.prototype.onBeforeCompile || key.startsWith('rabbit-soft-');
    if (!plainShader || std.map || std.normalMap || std.alphaMap || std.emissiveMap || std.roughnessMap || Object.keys(std.userData).length) return;
    const sig = [
      std.type,
      key,
      hex(std.color),
      hex(std.emissive),
      std.emissiveIntensity,
      std.roughness,
      std.metalness,
      std.opacity,
      std.transparent ? 1 : 0,
      std.side,
      std.flatShading ? 1 : 0,
      std.depthWrite ? 1 : 0,
      std.vertexColors ? 1 : 0,
      std.fog ? 1 : 0,
      std.sheen ?? 0,
      hex(std.sheenColor),
      std.sheenRoughness ?? 0,
    ].join('|');
    const found = canon.get(sig);
    if (!found) {
      canon.set(sig, m);
      return;
    }
    swapped.set(m, found);
    mesh.material = found;
    replaced++;
  });
  return replaced;
}

/**
 * Cuts one big geometry into patches by where its triangles are, each patch
 * its own geometry with its own bounds. A mesh that spans a whole world is
 * never out of view, so the GPU would take in all of it on every frame; as
 * patches, the ones that are off to the side are skipped before they cost
 * anything. Vertex data is copied as it is, so the picture does not change
 * (no seams: a triangle goes whole to one patch).
 */
export function splitByCell(geo: BufferGeometry, cell: number): BufferGeometry[] {
  const pos = geo.attributes.position;
  const index = geo.index;
  const triCount = (index ? index.count : pos.count) / 3;
  const buckets = new Map<string, number[]>();
  const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < triCount; t++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) {
      const v = vert(t, k);
      x += pos.getX(v);
      y += pos.getY(v);
      z += pos.getZ(v);
    }
    const key = `${Math.floor(x / 3 / cell)},${Math.floor(y / 3 / cell)},${Math.floor(z / 3 / cell)}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(t);
  }
  if (buckets.size <= 1) return [geo];
  const names = Object.keys(geo.attributes);
  const out: BufferGeometry[] = [];
  for (const tris of buckets.values()) {
    const g = new BufferGeometry();
    for (const name of names) {
      const at = geo.attributes[name] as BufferAttribute;
      const n = at.itemSize;
      const arr = new (at.array.constructor as new (len: number) => ArrayLike<number> & { [i: number]: number })(tris.length * 3 * n);
      let w = 0;
      for (const t of tris)
        for (let k = 0; k < 3; k++) {
          const v = vert(t, k);
          for (let c = 0; c < n; c++) arr[w++] = at.getComponent(v, c);
        }
      g.setAttribute(name, new BufferAttribute(arr as unknown as ArrayLike<number> as never, n, at.normalized));
    }
    g.computeBoundingSphere();
    out.push(g);
  }
  return out;
}

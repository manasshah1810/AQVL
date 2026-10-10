import React, { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StageModel } from '../../../model/StageModel';
import type { StageDriver } from '../../../three/driver';
import type { SceneBounds } from '../../../three/StageEnvironment';
import { NO_SHADOW_LAYER } from '../../../three/StageEnvironment';
import { dotTexture, rng } from '../../three/glsl';
import { ParticlePool, hash } from '../../three/particles';
import type { WorldClock } from '../../three/WorldLayer';
import { kingdomOf, liftAt, type Island, type Kingdom, type V3 } from '../kingdom';
import { buildProps } from './kingdomProps';
import { roundCylinder, softToy } from './soft';
import { splitByCell } from '../../../three/batch';
import { cloudMaterial, dayUniforms, horizonColor, puffGeometry, ribbonMaterial, skyMaterial, sweep, turfMaterial, type Puff } from './clouds';
import { useGovernedInvalidate } from '../../../three/perf';

/**
 * The floating cloud kingdom: nine islands at different heights round the
 * plaza where the structures stand, the bridges and stepping clouds between
 * them, little islets and far-off islands drifting in a layered sky, birds
 * by day and fireflies by night. One 18-minute day (the grove's clock) turns
 * the sky from blue through a pink sunset to a deep starry night with a big
 * moon, and the lanterns, windows and rainbows glow after dark.
 */

const _c = new Color();
const _c2 = new Color();
const _v = new Vector3();
const _lift: V3 = [0, 0, 0];

const TONE = {
  keyDay: new Color('#fff3df'),
  keyDusk: new Color('#ffad7a'),
  keyNight: new Color('#b7c8ff'),
  skyDay: new Color('#eef6ff'),
  skyNight: new Color('#6576c4'),
  groundDay: new Color('#d5c8ef'),
  groundNight: new Color('#272a5a'),
  fillDay: new Color('#d8e6ff'),
  fillNight: new Color('#8a8fe8'),
  backDay: new Color('#ffd9ef'),
  backNight: new Color('#8fa2ff'),
  mistDay: new Color('#ffffff'),
  mistDusk: new Color('#ffd2d6'),
  mistNight: new Color('#4c5aa0'),
};

function islandPuffs(i: Island, k: Kingdom, seed: number): Puff[] {
  const R = rng(seed * 97 + 13);
  const out: Puff[] = [];
  const ports: V3[] = [];
  for (const l of k.links) {
    if (l.a === i.id) ports.push(l.pts[0]);
    if (l.b === i.id) ports.push(l.pts[l.pts.length - 1]);
  }
  const lilac = new Color('#d9d2f5');
  const tintAt = (f: number) => '#' + _c.set(i.tint).lerp(lilac, f).getHexString();
  // The rim: soft puffs round the edge of the turf, low where a bridge or a hop leaves.
  const per = Math.PI * (i.rx + i.rz);
  const n = Math.max(14, Math.round(per / 1.25));
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + R() * 0.1;
    const x = i.x + Math.cos(a) * (i.rx + 0.25), z = i.z + Math.sin(a) * (i.rz + 0.25);
    const near = ports.some((p) => Math.hypot(p[0] - x, p[2] - z) < 2.0);
    const r = 0.75 + R() * 0.6;
    const sy = 0.7;
    out.push({ x, y: i.y + (near ? -0.45 : 0.12) - r * sy, z, r, sy, tint: i.tint });
  }
  // The body hanging under it, narrowing to a point, bluer further down.
  const layers = 4;
  for (let L = 1; L <= layers; L++) {
    const f = 1 - L * 0.19;
    const y = i.y - 0.7 - (L / layers) * i.depth * 0.82;
    const m = Math.max(6, Math.round((per * f) / 2.2));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2 + L * 0.4 + R() * 0.2;
      const r = 1.2 + R() * 0.9 + (1 - f) * 0.6;
      out.push({ x: i.x + Math.cos(a) * i.rx * f * 0.82, y: y + (R() - 0.5) * 0.5, z: i.z + Math.sin(a) * i.rz * f * 0.82, r, sy: 0.85, tint: tintAt(L / (layers + 1)) });
    }
  }
  // Filling under the turf and the tip at the bottom.
  for (let j = 0; j < 5; j++) {
    const a = j * 1.3;
    out.push({ x: i.x + Math.cos(a) * i.rx * 0.35, y: i.y - 1.4, z: i.z + Math.sin(a) * i.rz * 0.35, r: Math.min(i.rx, i.rz) * 0.55, sy: 0.55, tint: i.tint });
  }
  const tip = Math.min(i.rx, i.rz) * 0.32;
  out.push({ x: i.x, y: i.y - i.depth - 0.4, z: i.z, r: tip, sy: 1.1, tint: tintAt(0.9) });
  // Nothing under the turf may bulge up through it (only the rim puffs billow over the edge).
  for (const p of out.slice(n)) {
    const inside = Math.hypot((p.x - i.x) / (i.rx + 0.3), (p.z - i.z) / (i.rz + 0.3));
    if (inside < 1) p.y = Math.min(p.y, i.y - 0.4 - p.r * (p.sy ?? 1) * 1.32);
  }
  return out;
}

function boxPart(w: number, h: number, d: number, x: number, y: number, z: number, color: string, yaw = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute('uv');
  g.rotateY(yaw);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

function discPart(r: number, h: number, x: number, y: number, z: number, color: string): BufferGeometry {
  const g = new CylinderGeometry(r, r * 0.9, h, 24).toNonIndexed();
  g.deleteAttribute('uv');
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

const RAINBOW = ['#ff8fa3', '#ffb877', '#ffe27a', '#9fe3a2', '#8cc8ff', '#b79cff'];
const PADS = ['#ffd6e6', '#d8ecff', '#e6dcfb', '#d4f3e4', '#fff1c9'];

function buildWorld(k: Kingdom) {
  const u = dayUniforms();
  const materials: Material[] = [];
  const geometries: BufferGeometry[] = [];
  const group = new Group();
  const cloud = cloudMaterial(u, 0.3);
  materials.push(cloud);

  // Islands: turf on top, a cloud body below.
  const puffs: Puff[] = [];
  Object.values(k.islands).forEach((i, n) => {
    puffs.push(...islandPuffs(i, k, n + 1));
    const turf = turfMaterial(i.turf, u);
    materials.push(turf);
    // A pillowy top: the turf's edge rounds over softly into the cloud.
    const geo = roundCylinder(0.07, 72, 5);
    geometries.push(geo);
    const m = new Mesh(geo, turf);
    m.scale.set(i.rx, 0.6, i.rz);
    m.position.set(i.x, i.y - 0.302, i.z);
    m.layers.set(NO_SHADOW_LAYER);
    group.add(m);
  });

  // Links.
  const rainbowGlow = { value: 0.05 };
  const walkGlow = { value: 0 };
  const ribbonParts: BufferGeometry[] = [];
  const rainbowParts: BufferGeometry[] = [];
  for (const l of k.links) {
    const R = rng(l.length * 1000);
    if (l.kind === 'rainbow') {
      const w = 0.95;
      rainbowParts.push(sweep(l.pts, RAINBOW.map((color, j) => ({ from: -w + (j / 6) * w * 2, to: -w + ((j + 1) / 6) * w * 2, color })), 0.16));
      // Cloud feet where it lands.
      for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) for (let j = 0; j < 3; j++) puffs.push({ x: p[0] + (R() - 0.5) * 1.6, y: p[1] - 0.5, z: p[2] + (R() - 0.5) * 1.6, r: 0.7 + R() * 0.3, sy: 0.6, tint: '#ffffff' });
    } else if (l.kind === 'cloud') {
      ribbonParts.push(sweep(l.pts, [{ from: -0.75, to: -0.58, color: '#ffc4d8' }, { from: -0.58, to: 0.58, color: '#fffafc' }, { from: 0.58, to: 0.75, color: '#ffc4d8' }], 0.18));
      // Rope rails on posts.
      const rail = l.pts.map((p) => [p[0], p[1] + 0.55, p[2]] as V3);
      ribbonParts.push(sweep(rail, [{ from: -0.74, to: -0.68, color: '#ff9fbe' }], 0.05), sweep(rail, [{ from: 0.68, to: 0.74, color: '#ff9fbe' }], 0.05));
      for (let j = 0; j < l.pts.length; j += 4) {
        const p = l.pts[j];
        const a = l.pts[Math.max(0, j - 1)], b = l.pts[Math.min(l.pts.length - 1, j + 1)];
        const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
        for (const s of [-0.71, 0.71]) ribbonParts.push(boxPart(0.08, 0.6, 0.08, p[0] + Math.cos(yaw) * s, p[1] + 0.28, p[2] - Math.sin(yaw) * s, '#ffffff', yaw));
      }
      for (let j = 0; j < l.pts.length; j += 2) {
        const p = l.pts[j];
        puffs.push({ x: p[0] + (R() - 0.5) * 0.5, y: p[1] - 0.42, z: p[2] + (R() - 0.5) * 0.5, r: 0.6 + R() * 0.25, sy: 0.65, tint: '#ffffff' });
      }
    } else if (l.kind === 'steps') {
      for (let j = 1; j < l.pts.length - 1; j++) {
        const p = l.pts[j];
        puffs.push({ x: p[0], y: p[1] - 0.36, z: p[2], r: 0.78, sy: 0.48, tint: '#ffffff' });
        puffs.push({ x: p[0] + 0.5, y: p[1] - 0.45, z: p[2] + 0.2, r: 0.45, sy: 0.6, tint: '#fff4fa' });
        puffs.push({ x: p[0] - 0.45, y: p[1] - 0.5, z: p[2] - 0.25, r: 0.4, sy: 0.6, tint: '#f4f0ff' });
      }
    } else if (l.kind === 'platforms') {
      for (let j = 1; j < l.pts.length - 1; j++) {
        const p = l.pts[j];
        ribbonParts.push(discPart(0.8, 0.22, p[0], p[1] - 0.11, p[2], PADS[j % PADS.length]));
        puffs.push({ x: p[0], y: p[1] - 0.5, z: p[2], r: 0.6, sy: 0.6, tint: '#ffffff' });
      }
    } else if (l.kind === 'slide') {
      const bed = l.pts.map((p) => [p[0], p[1] + 0.05, p[2]] as V3);
      ribbonParts.push(sweep(bed, [{ from: -0.55, to: 0.55, color: '#ff9ec4' }], 0.12));
      const rail = l.pts.map((p) => [p[0], p[1] + 0.32, p[2]] as V3);
      ribbonParts.push(sweep(rail, [{ from: -0.62, to: -0.5, color: '#ffd166' }], 0.28), sweep(rail, [{ from: 0.5, to: 0.62, color: '#ffd166' }], 0.28));
      for (let j = 6; j < l.pts.length - 2; j += 7) {
        const p = l.pts[j];
        puffs.push({ x: p[0], y: p[1] - 0.7, z: p[2], r: 0.8, sy: 0.7, tint: '#ffffff' });
      }
    }
  }
  const ribbonMat = ribbonMaterial(walkGlow, 0.7);
  const rainbowMat = ribbonMaterial(rainbowGlow, 0.4);
  materials.push(ribbonMat, rainbowMat);
  for (const [parts, mat] of [[ribbonParts, ribbonMat], [rainbowParts, rainbowMat]] as const) {
    if (!parts.length) continue;
    const g = mergeGeometries(parts.map((p) => (p.attributes.normal ? p : (p.computeVertexNormals(), p))), false);
    parts.forEach((p) => p.dispose());
    if (!g) continue;
    // In patches, so the ones off to the side of the view are not sent to the GPU at all.
    for (const part of splitByCell(g, CULL_CELL)) {
      geometries.push(part);
      const m = new Mesh(part, mat);
      group.add(m);
    }
    if (g.attributes.position) geometries.push(g);
  }

  const cloudGeo = puffGeometry(puffs);
  geometries.push(cloudGeo);
  for (const part of splitByCell(cloudGeo, CULL_CELL)) {
    geometries.push(part);
    const clouds = new Mesh(part, cloud);
    clouds.layers.set(NO_SHADOW_LAYER);
    group.add(clouds);
  }

  // Islets: little clouds that bob, some with a tree.
  const islets: { obj: Group; y: number; seed: number }[] = [];
  const leafMat = softToy(new MeshStandardMaterial({ color: '#8ad99a', roughness: 0.85 }));
  const blossomMat = softToy(new MeshStandardMaterial({ color: '#ffc4d8', roughness: 0.85 }));
  const trunkMat = softToy(new MeshStandardMaterial({ color: '#c99a6b', roughness: 0.8 }));
  const isletTurf = new MeshStandardMaterial({ color: '#c8eebd', roughness: 0.95 });
  const dotMat = softToy(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), 0.1);
  materials.push(dotMat);
  materials.push(leafMat, blossomMat, trunkMat, isletTurf);
  const sphere = new SphereGeometry(1, 22, 16);
  const cyl = roundCylinder(0.2, 24);
  const cone = new ConeGeometry(1, 1, 12);
  geometries.push(sphere, cyl, cone);
  for (const it of k.islets) {
    const g = new Group();
    g.position.set(it.x, it.y, it.z);
    const R = rng(it.seed + 300);
    const ps: Puff[] = [{ x: 0, y: -0.5, z: 0, r: it.r, sy: 0.6, tint: '#ffffff' }];
    for (let j = 0; j < 5; j++) {
      const a = j * 1.26 + R();
      ps.push({ x: Math.cos(a) * it.r * 0.75, y: -0.45 - R() * 0.6, z: Math.sin(a) * it.r * 0.75, r: it.r * (0.45 + R() * 0.2), sy: 0.75, tint: j % 2 ? '#fff4fa' : '#f2f0ff' });
    }
    ps.push({ x: 0, y: -it.r * 0.9, z: 0, r: it.r * 0.5, sy: 1, tint: '#e6e2fb' });
    const geo = puffGeometry(ps);
    geometries.push(geo);
    const m = new Mesh(geo, cloud);
    m.layers.set(NO_SHADOW_LAYER);
    g.add(m);
    const t = new Mesh(cyl, isletTurf);
    t.scale.set(it.r * 0.85, 0.2, it.r * 0.85);
    t.position.y = -0.08;
    g.add(t);
    if (it.tree) {
      const tr = new Mesh(cyl, trunkMat);
      tr.scale.set(0.12, 1.2, 0.12);
      tr.position.y = 0.6;
      g.add(tr);
      // A fluffy crown: a cluster of round puffs, dotted with blossoms.
      const cm = it.seed % 2 ? blossomMat : leafMat;
      for (const [cx, cy, cz, cr] of [[0, 1.5, 0, 0.62], [0.42, 1.32, 0.1, 0.42], [-0.4, 1.35, -0.08, 0.45], [0.05, 1.3, 0.42, 0.4], [-0.05, 1.86, -0.05, 0.4]] as const) {
        const crown = new Mesh(sphere, cm);
        crown.scale.set(cr, cr * 0.9, cr);
        crown.position.set(cx, cy, cz);
        g.add(crown);
      }
      for (let j = 0; j < 9; j++) {
        const a = j * 2.4, e = 0.2 + R() * 0.9;
        const d = new Mesh(sphere, dotMat);
        d.scale.setScalar(0.06);
        d.position.set(Math.cos(a) * Math.cos(e) * 0.66, 1.5 + Math.sin(e) * 0.56, Math.sin(a) * Math.cos(e) * 0.66);
        g.add(d);
      }
    } else {
      for (let j = 0; j < 3; j++) {
        const f = new Mesh(sphere, j % 2 ? blossomMat : leafMat);
        f.scale.setScalar(0.25 + R() * 0.15);
        f.position.set((R() - 0.5) * it.r, 0.15, (R() - 0.5) * it.r);
        g.add(f);
      }
    }
    group.add(g);
    islets.push({ obj: g, y: it.y, seed: it.seed });
  }

  // Far away: big fluffy clouds drifting round the kingdom, and floating islands of other kingdoms.
  const far = new Group();
  far.position.set(k.cx, 0, k.cz);
  {
    const R = rng(4242);
    const ps: Puff[] = [];
    for (let c = 0; c < 22; c++) {
      const a = (c / 22) * Math.PI * 2 + R() * 0.2;
      const d = 190 + R() * 90;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      const cy = k.floorY - 35 + R() * 75;
      const size = 9 + R() * 10;
      for (let j = 0; j < 9; j++) {
        ps.push({ x: cx + (R() - 0.5) * size * 2.4, y: cy + (R() - 0.3) * size * 0.6, z: cz + (R() - 0.5) * size * 1.2, r: size * (0.45 + R() * 0.5), sy: 0.7, tint: j % 3 ? '#ffffff' : '#f1edff' });
      }
    }
    const geo = puffGeometry(ps);
    geometries.push(geo);
    const m = new Mesh(geo, cloud);
    m.frustumCulled = false;
    m.layers.set(NO_SHADOW_LAYER);
    far.add(m);
  }
  group.add(far);
  const distant = new Group();
  {
    const R = rng(777);
    const ps: Puff[] = [];
    const castleMat = new MeshStandardMaterial({ color: '#e7dcff', roughness: 0.8 });
    const roofMat = new MeshStandardMaterial({ color: '#c4a6ff', roughness: 0.7 });
    materials.push(castleMat, roofMat);
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + 0.4 + R() * 0.3;
      const d = k.reach + 55 + R() * 60;
      const x = k.cx + Math.cos(a) * d, z = k.cz + Math.sin(a) * d;
      const y = k.floorY - 6 + R() * 30;
      const s = 4 + R() * 6;
      ps.push({ x, y: y - s * 0.4, z, r: s, sy: 0.45, tint: '#ffffff' });
      for (let q = 0; q < 4; q++) ps.push({ x: x + (R() - 0.5) * s, y: y - s * (0.7 + q * 0.35), z: z + (R() - 0.5) * s, r: s * (0.6 - q * 0.1), sy: 0.8, tint: '#ece8ff' });
      const t = new Mesh(cyl, isletTurf);
      t.scale.set(s * 0.92, 0.3, s * 0.92);
      t.position.set(x, y - 0.1, z);
      distant.add(t);
      if (j % 2 === 0) {
        // A far-off castle.
        for (let q = 0; q < 3; q++) {
          const tw = new Mesh(cyl, castleMat);
          const h = s * (0.5 + q * 0.25);
          tw.scale.set(s * 0.12, h, s * 0.12);
          tw.position.set(x + (q - 1) * s * 0.3, y + h / 2, z);
          const rf = new Mesh(cone, roofMat);
          rf.scale.set(s * 0.17, s * 0.3, s * 0.17);
          rf.position.set(x + (q - 1) * s * 0.3, y + h + s * 0.15, z);
          distant.add(tw, rf);
        }
      } else {
        for (let q = 0; q < 3; q++) {
          const tr = new Mesh(sphere, q % 2 ? blossomMat : leafMat);
          tr.scale.setScalar(s * 0.22);
          tr.position.set(x + (q - 1) * s * 0.35, y + s * 0.25, z + (R() - 0.5) * s * 0.4);
          distant.add(tr);
        }
      }
    }
    const geo = puffGeometry(ps);
    geometries.push(geo);
    const m = new Mesh(geo, cloud);
    m.layers.set(NO_SHADOW_LAYER);
    distant.add(m);
  }
  group.add(distant);

  // Birds (a few small flocks wheeling far out) and butterflies (round the garden, the farm and the play cloud).
  const birdMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: DoubleSide });
  const wingGeo = new PlaneGeometry(0.9, 0.32).translate(0.45, 0, 0).rotateX(-Math.PI / 2);
  geometries.push(wingGeo);
  materials.push(birdMat);
  const birds: { obj: Group; l: Mesh; r: Mesh }[] = [];
  for (let j = 0; j < 12; j++) {
    const g = new Group();
    const body = new Mesh(sphere, birdMat);
    body.scale.set(0.16, 0.14, 0.42);
    const l = new Mesh(wingGeo, birdMat);
    const r = new Mesh(wingGeo, birdMat);
    r.scale.x = -1;
    g.add(body, l, r);
    g.scale.setScalar(1.3);
    group.add(g);
    birds.push({ obj: g, l, r });
  }
  const flyMats = ['#ff9fd0', '#ffd34d', '#9fd7ff', '#c4a6ff', '#ffb38a'].map((c) => {
    const m = new MeshStandardMaterial({ color: c, roughness: 0.5, side: DoubleSide, emissive: c, emissiveIntensity: 0.15 });
    materials.push(m);
    return m;
  });
  const flyWing = new PlaneGeometry(0.22, 0.2).translate(0.11, 0, 0).rotateX(-Math.PI / 2);
  geometries.push(flyWing);
  const flies: { obj: Group; l: Mesh; r: Mesh; home: V3; seed: number }[] = [];
  const homes = [k.islands.garden, k.islands.garden, k.islands.garden, k.islands.garden, k.islands.garden, k.islands.farm, k.islands.farm, k.islands.play, k.islands.play, k.islands.plaza, k.islands.plaza, k.islands.village, k.islands.castle, k.islands.sleep];
  homes.forEach((i, j) => {
    const g = new Group();
    const l = new Mesh(flyWing, flyMats[j % flyMats.length]);
    const r = new Mesh(flyWing, flyMats[j % flyMats.length]);
    r.scale.x = -1;
    g.add(l, r);
    group.add(g);
    const a = j * 2.4;
    const home: V3 = i.id === 'plaza' ? [i.x + Math.cos(a) * (k.clearX + 3), i.y, i.z + Math.sin(a) * (k.clearZ + 3)] : [i.x + Math.cos(a) * i.rx * 0.4, i.y, i.z + Math.sin(a) * i.rz * 0.4];
    flies.push({ obj: g, l, r, home, seed: j });
  });

  return { u, group, materials, geometries, rainbowGlow, walkGlow, islets, far, birds, flies };
}

/** The kingdom's meshes are cut into patches of this size, so the ones outside the view are skipped. */
const CULL_CELL = 26;

export function CloudKingdom({ model, driver, calm, clock }: { model: StageModel; bounds: SceneBounds; driver: StageDriver; calm: boolean; clock: WorldClock }) {
  const k = useMemo(() => kingdomOf(model), [model]);
  const world = useMemo(() => buildWorld(k), [k]);
  const props = useMemo(() => buildProps(k), [k]);
  const sky = useMemo(() => skyMaterial(world.u), [world]);
  const three = useThree();
  const invalidate = useGovernedInvalidate();
  const hemi = useRef<HemisphereLight>(null);
  const keyLight = useRef<DirectionalLight>(null);
  const fillLight = useRef<DirectionalLight>(null);
  const backLight = useRef<DirectionalLight>(null);
  const palette = model.palette;

  const halos = useMemo(() => {
    const tex = typeof document === 'undefined' ? null : dotTexture();
    const list = props.lamps.map((p) => {
      const m = new SpriteMaterial({ map: tex, color: new Color('#ffb85c'), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, fog: false });
      const sp = new Sprite(m);
      sp.position.set(p[0], p[1], p[2]);
      sp.scale.setScalar(2.2);
      sp.renderOrder = 6;
      sp.visible = false;
      return sp;
    });
    return { tex, list };
  }, [props]);
  // Mist: soft banks of haze drifting between the islands and below them (depth between near and far).
  const mist = useMemo(() => {
    const tex = typeof document === 'undefined' ? null : dotTexture();
    const R = rng(515);
    // Always well below every island's underside (they never cover the kingdom), or far out beyond it.
    const isl = Object.values(k.islands);
    const bottom = Math.min(...isl.map((i) => i.y - i.depth)) - 4;
    const list = Array.from({ length: 30 }, (_, j) => {
      const m = new SpriteMaterial({ map: tex, color: new Color('#ffffff'), transparent: true, depthWrite: false, opacity: 0.2, fog: true });
      const sp = new Sprite(m);
      const a = (j / 30) * Math.PI * 2 + R() * 0.4;
      const far = j % 2 === 0;
      const d = far ? k.reach * (1.25 + R() * 0.8) : k.reach * (0.2 + R() * 1.0);
      const sz = (far ? 30 : 34) + R() * 16;
      const h = sz * 0.3;
      sp.position.set(k.cx + Math.cos(a) * d, far ? k.floorY - 4 - R() * 18 : bottom - h / 2 - R() * 14, k.cz + Math.sin(a) * d);
      sp.scale.set(sz * 1.9, h, 1);
      sp.renderOrder = 3;
      sp.layers.set(NO_SHADOW_LAYER);
      return { sp, base: sp.position.clone(), seed: R() * 10, alpha: (far ? 0.2 : 0.3) + R() * 0.1 };
    });
    return { tex, list };
  }, [k]);
  const fireflies = useMemo(() => new ParticlePool(160, true), []);
  const motes = useMemo(() => new ParticlePool(440, false), []);

  useEffect(
    () => () => {
      world.materials.forEach((m) => m.dispose());
      world.geometries.forEach((g) => g.dispose());
      props.materials.forEach((m) => m.dispose());
      props.geometries.forEach((g) => g.dispose());
      halos.tex?.dispose();
      halos.list.forEach((h) => h.material.dispose());
      mist.tex?.dispose();
      mist.list.forEach((m) => m.sp.material.dispose());
      fireflies.dispose();
      motes.dispose();
      sky.dispose();
    },
    [world, props, halos, mist, fireflies, motes, sky],
  );

  const F = k.floorY;
  const fogNear = 70 + k.reach * 0.6;
  const fogFar = 380;

  useEffect(
    () =>
      driver.register(() => {
        const now = clock.now;
        const day = clock.day;
        const u = world.u;
        u.uTime.value = now;
        u.uSun.value.set(day.sun[0], day.sun[1], day.sun[2]);
        u.uMoon.value.set(day.moon[0], day.moon[1], day.moon[2]);
        u.uDay.value = day.day;
        u.uNight.value = day.night;
        u.uDusk.value = day.dusk;
        horizonColor(day.day, day.dusk, _c);
        u.uFogColor.value.copy(_c);
        u.uFogNear.value = fogNear;
        u.uFogFar.value = fogFar;
        const scene = three.scene;
        if (scene.background instanceof Color) scene.background.copy(_c);
        if (scene.fog instanceof Fog) scene.fog.color.copy(_c);
        scene.environmentIntensity = palette.lights.envIntensity * (1 - 0.55 * day.night);

        // Light: the sun by day, the moon by night (strong enough to see by), warm at sunset.
        const night = day.night, dusk = day.dusk;
        if (keyLight.current) {
          // From the sun while it is up, from the moon once it has set, gliding across in between.
          const w = Math.min(1, Math.max(0, (day.sun[1] + 0.15) / 0.2));
          const s = w * w * (3 - 2 * w);
          const lx = day.moon[0] + (day.sun[0] - day.moon[0]) * s, lz = day.moon[2] + (day.sun[2] - day.moon[2]) * s;
          const ly = Math.max(0.3, day.moon[1] + (day.sun[1] - day.moon[1]) * s);
          _v.set(lx, ly, lz).normalize().multiplyScalar(80);
          keyLight.current.position.set(k.cx + _v.x, F + _v.y, k.cz + _v.z);
          keyLight.current.target.position.set(k.cx, F, k.cz);
          keyLight.current.target.updateMatrixWorld();
          keyLight.current.color.copy(TONE.keyDay).lerp(TONE.keyDusk, dusk * 0.8).lerp(TONE.keyNight, night);
          keyLight.current.intensity = 1.15 * palette.lights.keyIntensity * (1 - 0.3 * dusk) * (1 - 0.48 * night) * (0.55 + 0.45 * Math.abs(1 - 2 * s));
          // A soft back light from the other side: a rim round everything, lifting it off the sky.
          if (backLight.current) {
            backLight.current.position.set(k.cx - _v.x, F + 35, k.cz - _v.z);
            backLight.current.target.position.set(k.cx, F, k.cz);
            backLight.current.target.updateMatrixWorld();
            backLight.current.color.copy(TONE.backDay).lerp(TONE.keyDusk, dusk * 0.6).lerp(TONE.backNight, night);
            backLight.current.intensity = 0.75 + 0.15 * dusk;
          }
        }
        if (hemi.current) {
          hemi.current.color.copy(TONE.skyDay).lerp(TONE.skyNight, night);
          hemi.current.groundColor.copy(TONE.groundDay).lerp(TONE.groundNight, night);
          hemi.current.intensity = 0.82 * palette.lights.ambient * (1 - 0.38 * night);
        }
        if (fillLight.current) {
          fillLight.current.color.copy(TONE.fillDay).lerp(TONE.fillNight, night);
          fillLight.current.intensity = palette.lights.fillIntensity * (1 + 0.6 * night);
        }

        // Glows: lamps, windows, the rainbows, the walkways.
        const glow = Math.min(1, night * 1.2 + dusk * 0.35);
        props.lampMat.emissiveIntensity = 0.25 + 2.6 * glow;
        props.windowMat.emissiveIntensity = 0.05 + 1.7 * glow;
        world.rainbowGlow.value = 0.04 + 0.4 * night;
        world.walkGlow.value = 0.12 * night;
        mist.list.forEach((m, i) => {
          m.sp.position.set(m.base.x + Math.sin(now * 0.02 + m.seed) * 6, m.base.y + Math.sin(now * 0.05 + i) * 0.6, m.base.z + Math.cos(now * 0.017 + m.seed) * 6);
          m.sp.material.color.copy(TONE.mistDay).lerp(TONE.mistDusk, dusk * 0.8).lerp(TONE.mistNight, night);
          m.sp.material.opacity = m.alpha * (1 - 0.45 * night);
        });
        halos.list.forEach((h, i) => {
          const flick = calm ? 1 : 0.9 + 0.1 * Math.sin(now * 7 + i * 1.7) * Math.sin(now * 3.1 + i);
          h.material.opacity = glow * 0.85 * flick;
          h.visible = glow > 0.02;
        });

        // Things that move in the wind and with time.
        for (const t of props.timed) t.uniforms.uTime.value = now;
        const hours = (day.phase * 24 + 6) % 24;
        for (const c of props.clock) {
          c.hour.rotation.z = -(hours / 12) * Math.PI * 2;
          c.minute.rotation.z = -(hours % 1) * Math.PI * 2;
        }
        for (const b of props.balloons) {
          if (b.seed < 0) {
            b.obj.rotation.z = calm ? 0.18 : Math.sin(now * 1.1) * 0.22;
          } else {
            b.obj.position.y = Math.sin(now * 0.9 + b.seed * 1.7) * 0.12;
            b.obj.rotation.z = Math.sin(now * 0.6 + b.seed) * 0.08;
            b.obj.rotation.x = Math.sin(now * 0.5 + b.seed * 2) * 0.06;
          }
        }
        liftAt(k, now, _lift);
        props.basket.position.set(_lift[0], _lift[1], _lift[2]);
        props.basket.rotation.z = Math.sin(now * 0.8) * 0.04;
        for (const it of world.islets) it.obj.position.y = it.y + Math.sin(now * 0.25 + it.seed * 1.3) * 0.45;
        world.far.rotation.y = now * 0.0025;
        // The campfire: flames that lick and flicker (brighter for the noon gathering and after dark).
        props.fire.flames.forEach((f, i) => {
          const base = (f.userData.base ??= f.scale.clone()) as Vector3;
          const fl = calm ? 1 : 0.82 + 0.22 * Math.sin(now * 9.1 + i * 1.7) * Math.sin(now * 5.3 + i * 2.9) + 0.08 * Math.sin(now * 17 + i);
          f.scale.set(base.x * (1.05 - 0.1 * fl), base.y * fl, base.z * (1.05 - 0.1 * fl));
          f.rotation.z = calm ? 0 : Math.sin(now * 3.1 + i) * 0.08;
        });

        const dayVis = Math.min(1, Math.max(0, day.day * 1.5 - 0.2));
        world.birds.forEach((b, i) => {
          const flock = i % 3;
          const a = now * (0.035 + flock * 0.01) + flock * 2.1 + (i / 3) * 0.06;
          const rad = k.reach * (0.85 + flock * 0.25) + Math.sin(i * 1.7) * 3;
          const x = k.cx + Math.cos(a) * rad + Math.sin(i * 2.3) * 1.5;
          const z = k.cz + Math.sin(a) * rad * 0.8 + Math.cos(i * 1.9) * 1.5;
          const y = F + 14 + flock * 6 + Math.sin(now * 0.4 + i) * 1.2;
          b.obj.position.set(x, y, z);
          b.obj.rotation.y = Math.atan2(-Math.sin(a) * rad, Math.cos(a) * rad * 0.8);
          const flap = calm ? 0.2 : Math.sin(now * 9 + i * 1.3) * 0.6;
          b.l.rotation.z = flap;
          b.r.rotation.z = -flap;
          b.obj.scale.setScalar(1.3 * dayVis);
          b.obj.visible = dayVis > 0.01;
        });
        world.flies.forEach((f, i) => {
          const t = now * 0.35 + f.seed * 3.3;
          const x = f.home[0] + Math.sin(t) * 2.2 + Math.sin(t * 2.3) * 0.6;
          const z = f.home[2] + Math.sin(t * 0.7) * Math.cos(t) * 2.2;
          const y = f.home[1] + 0.8 + Math.sin(t * 1.7) * 0.4 + Math.sin(now * 6 + i) * 0.05;
          f.obj.position.set(x, y, z);
          f.obj.rotation.y = Math.atan2(Math.cos(t) * 2.2, Math.cos(t * 0.7) * Math.cos(t) * 2.2 - Math.sin(t * 0.7) * Math.sin(t) * 2.2);
          const flap = calm ? 0.6 : Math.sin(now * 22 + i) * 1.0;
          f.l.rotation.z = flap;
          f.r.rotation.z = -flap;
          f.obj.scale.setScalar(dayVis);
          f.obj.visible = dayVis > 0.01;
        });

        // Fireflies at night, drifting over the islands; by day, wind motes and the fountain's spray.
        fireflies.begin();
        if (night > 0.05 && !calm) {
          const isl = [k.islands.garden, k.islands.sleep, k.islands.plaza, k.islands.village, k.islands.farm, k.islands.castle, k.islands.lookout];
          for (let i = 0; i < 150; i++) {
            const home = isl[i % isl.length];
            const a = hash(i, 1) * Math.PI * 2;
            const r = 0.3 + hash(i, 2) * 0.95;
            let x = home.x + Math.cos(a) * home.rx * r, z = home.z + Math.sin(a) * home.rz * r;
            if (home.id === 'plaza' && Math.hypot((x - home.x) / (k.clearX + 1), (z - home.z) / (k.clearZ + 1)) < 1) {
              x = home.x + Math.cos(a) * (k.clearX + 2 + hash(i, 6) * 3);
              z = home.z + Math.sin(a) * (k.clearZ + 2 + hash(i, 6) * 3);
            }
            x += Math.sin(now * 0.4 + i) * 0.9 + Math.sin(now * 0.13 + i * 2) * 0.6;
            z += Math.cos(now * 0.35 + i * 1.3) * 0.9;
            const y = home.y + 0.4 + hash(i, 3) * 2.2 + Math.sin(now * 0.6 + i * 0.7) * 0.35;
            const pulse = Math.max(0, Math.sin(now * (1.2 + hash(i, 4)) + i * 2.1));
            fireflies.add(x, y, z, 0.95, 0.95, 0.45, night * (0.25 + 0.75 * pulse * pulse), 0.07 + hash(i, 5) * 0.04);
          }
          // Rainbows sparkle after dark.
          for (const l of k.links) {
            if (l.kind !== 'rainbow') continue;
            for (let i = 0; i < 18; i++) {
              const j = Math.floor(hash(i, l.length) * l.pts.length);
              const p = l.pts[j];
              const tw = Math.max(0, Math.sin(now * 2 + i * 3.1 + l.length));
              fireflies.add(p[0] + (hash(i, 9) - 0.5) * 1.6, p[1] + 0.15 + hash(i, 8) * 0.4, p[2] + (hash(i, 7) - 0.5) * 1.6, 1, 0.9, 1, night * tw * 0.8, 0.05);
            }
          }
        }
        fireflies.end();
        motes.begin();
        if (!calm) {
          // Embers rising from the campfire.
          const [ex, ey, ez] = props.fire.pos;
          for (let i = 0; i < 22; i++) {
            const f = (now * (0.35 + hash(i, 51) * 0.3) + hash(i, 52)) % 1;
            const x = ex + Math.sin(now * 1.3 + i * 2.1) * 0.25 * f + (hash(i, 53) - 0.5) * 0.4;
            const z = ez + Math.cos(now * 1.1 + i * 1.7) * 0.25 * f + (hash(i, 54) - 0.5) * 0.4;
            motes.add(x, ey + 0.5 + f * 2.4, z, 1, 0.62 + 0.3 * (1 - f), 0.25, (1 - f) * 0.95, 0.05 + (1 - f) * 0.03);
          }
          // Wind: faint streaks drifting across the kingdom.
          const span = k.reach * 2.4;
          for (let i = 0; i < 70; i++) {
            const f = (now * (0.012 + hash(i, 11) * 0.01) + hash(i, 12)) % 1;
            const x = k.cx - span / 2 + f * span;
            const z = k.cz + (hash(i, 13) - 0.5) * span * 0.8;
            const y = F - 6 + hash(i, 14) * 22 + Math.sin(now * 0.7 + i) * 0.6;
            const fade = Math.min(1, f * 8, (1 - f) * 8);
            for (let q = 0; q < 3; q++) motes.add(x - q * 0.35, y - q * 0.02, z, 1, 1, 1, (0.18 - q * 0.05) * fade * (0.35 + 0.65 * day.day), 0.09 - q * 0.02);
          }
          // Fountains spray.
          for (const p of props.fountains) {
            for (let i = 0; i < 26; i++) {
              const f = (now * 0.9 + hash(i, 21)) % 1;
              const a = hash(i, 22) * Math.PI * 2;
              const v = 0.5 + hash(i, 23) * 0.4;
              const y = p[1] + 1.4 * f - 2.1 * f * f;
              motes.add(p[0] + Math.cos(a) * v * f, y, p[2] + Math.sin(a) * v * f, 0.75, 0.9, 1, 0.75 * (1 - f), 0.05);
            }
          }
          // Sparkles round the balloon lift's path, and a few petals blowing off the garden.
          for (let i = 0; i < 24; i++) {
            const f = hash(i, 31);
            const x = k.lift.bottom[0] + (k.lift.top[0] - k.lift.bottom[0]) * f + Math.sin(now + i) * 0.4;
            const y = k.lift.bottom[1] + (k.lift.top[1] - k.lift.bottom[1]) * f + Math.sin(f * Math.PI) * 1.2;
            const z = k.lift.bottom[2] + (k.lift.top[2] - k.lift.bottom[2]) * f + Math.cos(now * 0.8 + i) * 0.4;
            const tw = Math.max(0, Math.sin(now * 1.6 + i * 2.7));
            motes.add(x, y, z, 1, 0.92, 0.6, tw * (0.25 + 0.5 * night), 0.06);
          }
          const G = k.islands.garden;
          for (let i = 0; i < 20; i++) {
            const f = (now * 0.05 + hash(i, 41)) % 1;
            const x = G.x + (hash(i, 42) - 0.5) * G.rx + f * 14;
            const z = G.z + (hash(i, 43) - 0.5) * G.rz + Math.sin(now * 0.5 + i) * 1.2;
            const y = G.y + 1.5 + Math.sin(f * Math.PI * 3 + i) * 0.6 - f * 3;
            motes.add(x, y, z, 1, 0.7, 0.82, Math.min(1, f * 6, (1 - f) * 6) * 0.7 * day.day, 0.07);
          }
        }
        motes.end();
        if (!calm) invalidate();
      }),
    [driver, world, props, halos, mist, fireflies, motes, clock, calm, three, palette, k, F, fogNear, fogFar, invalidate],
  );

  return (
    <>
      <color attach="background" args={['#cfeaff']} />
      <fog attach="fog" args={['#cfeaff', fogNear, fogFar]} />
      <mesh material={sky} renderOrder={1} frustumCulled={false} layers={NO_SHADOW_LAYER} position={[k.cx, F, k.cz]}>
        <sphereGeometry args={[520, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight ref={keyLight} color={palette.lights.key} intensity={palette.lights.keyIntensity} position={[k.cx - 30, F + 60, k.cz + 40]} />
      <directionalLight ref={fillLight} color={palette.lights.fill} intensity={palette.lights.fillIntensity} position={[k.cx + 40, F + 20, k.cz + 30]} />
      <directionalLight ref={backLight} color="#ffd9ef" intensity={0.75} position={[k.cx + 30, F + 35, k.cz - 40]} />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color="#fff6e8" intensity={2} position={[-3, 7, 8]} scale={[14, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#d8e8ff" intensity={1.2} position={[8, 4, 2]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#ffd9ec" intensity={0.9} position={[-8, 4, -4]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#cbbcf0" intensity={0.5} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>
      <primitive object={world.group} />
      <primitive object={props.group} />
      <primitive object={fireflies.points} />
      <primitive object={motes.points} />
      {mist.list.map((m, i) => (
        <primitive key={`m${i}`} object={m.sp} />
      ))}
      {halos.list.map((h, i) => (
        <primitive key={`h${i}`} object={h} />
      ))}
    </>
  );
}


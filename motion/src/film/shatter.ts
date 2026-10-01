import * as THREE from 'three';
import {Delaunay} from 'd3-delaunay';
import {rng} from '../lib/motion';
import {Classroom} from './classroom';
import {T} from './timeline';

// The tangled notebook page fractures along Voronoi cells (denser near the
// impact) and falls away into the twilight world. Ballistic physics per
// shard: outward impulse, gravity, tumble; delay grows with distance from
// the impact so the break propagates like a crack.
export class Shatter {
  shards: {m: THREE.Mesh; c: THREE.Vector3; v: THREE.Vector3; w: THREE.Vector3; delay: number}[] = [];
  group = new THREE.Group();
  rim!: THREE.DirectionalLight;
  cls!: Classroom;
  gravity = new THREE.Vector3();

  build(cls: Classroom) {
    this.cls = cls;
    const sheet = cls.nbB;
    const W = sheet.W;
    const H = sheet.H;
    const r = rng(2024);
    const impact = sheet.local(1150, 1350);
    const pts: [number, number][] = [];
    for (let i = 0; i < 70; i++) {
      // bias toward the impact point
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.8) * 1.5;
      pts.push([impact.x + Math.cos(a) * d, impact.y + Math.sin(a) * d * 1.2]);
    }
    for (let i = 0; i < 26; i++) pts.push([(r() - 0.5) * W, (r() - 0.5) * H]);
    const vor = Delaunay.from(pts).voronoi([-W / 2, -H / 2, W / 2, H / 2]);
    const mat = sheet.mesh.material.clone();
    mat.side = THREE.DoubleSide;
    mat.map = sheet.tex;
    for (let i = 0; i < pts.length; i++) {
      const poly = vor.cellPolygon(i);
      if (!poly || poly.length < 4) continue;
      let cx = 0;
      let cy = 0;
      const n = poly.length - 1;
      for (let k = 0; k < n; k++) {
        cx += poly[k][0];
        cy += poly[k][1];
      }
      cx /= n;
      cy /= n;
      const shape = new THREE.Shape(poly.slice(0, n).map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
      const geo = new THREE.ShapeGeometry(shape);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + cx) / W + 0.5, (pos.getY(k) + cy) / H + 0.5);
      const m = new THREE.Mesh(geo, mat);
      m.layers.enable(2);
      const c = new THREE.Vector3(cx, cy, 0);
      const out = c.clone().sub(impact);
      const dist = out.length();
      out.normalize();
      const v = out.multiplyScalar(0.5 + r() * 0.9 + (1.5 - Math.min(1.5, dist)) * 0.6);
      v.z = 0.25 + r() * 0.9 - dist * 0.15;
      const w = new THREE.Vector3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 5);
      this.shards.push({m, c, v, w, delay: dist * 0.07 + r() * 0.03});
      this.group.add(m);
    }
    cls.sets.nbB.add(this.group);
    this.rim = new THREE.DirectionalLight('#ebc0a3', 0);
    this.rim.position.set(0.5, -1.5, -2);
    cls.sets.nbB.add(this.rim, this.rim.target);
    // world gravity, expressed in the page's local frame
    const q = cls.sets.nbB.quaternion.clone().invert();
    this.gravity.set(0, -5.5, 0).applyQuaternion(q);
  }

  // returns true while shards are on screen
  update(t: number) {
    const d = t - T.shatter;
    const on = d >= 0 && d < 1.6;
    this.group.visible = on;
    if (!on) {
      this.rim.intensity = 0;
      return false;
    }
    const cls = this.cls;
    cls.sets.nbB.visible = true;
    cls.deskB.visible = false;
    cls.nbB.mesh.visible = false;
    Object.values(cls.pens).forEach((p) => (p.visible = false));
    cls.drawNotebookB(T.shatter, 1);
    this.rim.intensity = 2.5;
    for (const s of this.shards) {
      const a = Math.max(0, d - s.delay);
      s.m.position.copy(s.c).addScaledVector(s.v, a).addScaledVector(this.gravity, 0.5 * a * a);
      s.m.rotation.set(s.w.x * a * a * 0.8 + s.w.x * a * 0.2, s.w.y * a * a * 0.8 + s.w.y * a * 0.2, s.w.z * a * 0.4);
      s.m.visible = a < 1.5;
    }
    return true;
  }
}

import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {GlassUniforms, makeBurst, makeFloor, makeGlass, makeLine, makeRing, shared} from './materials';
import {Post, PostParams} from './post';

// The single shared AQVL-world rig: one renderer, one light set, one fog,
// one glossy floor, one camera, one material library, one post chain.

export type Glass = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> & {u: GlassUniforms};

const sphereGeo = new THREE.SphereGeometry(0.5, 48, 32);
const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const boxGeos = new Map<string, THREE.BufferGeometry>();
export const boxGeo = (w: number, h: number, d: number, r = 0.08) => {
  const k = `${w}|${h}|${d}|${r}`;
  if (!boxGeos.has(k)) boxGeos.set(k, new RoundedBoxGeometry(w, h, d, 4, r));
  return boxGeos.get(k)!;
};

export class Rig {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  world = new THREE.Group(); // everything that reflects in the floor
  overlay = new THREE.Group(); // bursts, never reflected twice
  camera: THREE.PerspectiveCamera;
  floor: THREE.Mesh;
  post: Post;
  w: number;
  h: number;

  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.w = w;
    this.h = h;
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.autoClear = false;
    this.camera = new THREE.PerspectiveCamera(26, w / h, 0.1, 400);
    this.camera.layers.enable(2);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), makeFloor());
    this.floor.renderOrder = -10;
    this.floor.layers.enable(2);
    this.scene.add(this.floor, this.world, this.overlay);
    this.post = new Post(this.renderer, w, h);
  }

  glassBox(w: number, h: number, d: number, r = 0.08): Glass {
    const m = new THREE.Mesh(boxGeo(w, h, d, r), makeGlass([w / 2, h / 2, d / 2])) as unknown as Glass;
    m.u = m.material.uniforms as unknown as GlassUniforms;
    m.layers.enable(2);
    return m;
  }

  glassSphere(): Glass {
    const m = new THREE.Mesh(sphereGeo, makeGlass(null)) as unknown as Glass;
    m.u = m.material.uniforms as unknown as GlassUniforms;
    m.layers.enable(2);
    return m;
  }

  line() {
    const m = new THREE.Mesh(tubeGeo, makeLine());
    return m as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  }

  burst() {
    const m = new THREE.Mesh(quadGeo, makeBurst());
    m.frustumCulled = false;
    m.renderOrder = 50;
    return m as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  }

  ring() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), makeRing());
    m.renderOrder = -5;
    return m as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  }

  setBursts(list: {pos: THREE.Vector3; i: number}[]) {
    const b = shared.uBursts.value;
    for (let k = 0; k < 4; k++) {
      const s = list[k];
      if (s) b[k].set(s.pos.x, s.pos.y, s.pos.z, s.i);
      else b[k].set(0, 0, 0, 0);
    }
  }

  render(p: PostParams, reflect = true) {
    this.post.render(this.scene, this.camera, reflect ? this.world : null, reflect ? this.floor : null, p);
  }
}

// Place a tube between two points, drawn on by `progress` (0..1).
const _a = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
export const placeLine = (m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, progress = 1) => {
  _a.subVectors(b, a);
  const len = _a.length();
  if (len < 1e-5 || progress <= 0.0005) {
    m.visible = false;
    return;
  }
  m.visible = true;
  _q.setFromUnitVectors(_up, _a.normalize());
  m.position.copy(a);
  m.quaternion.copy(_q);
  m.scale.set(radius, len * Math.min(1, progress), radius);
};

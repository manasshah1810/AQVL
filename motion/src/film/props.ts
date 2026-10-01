import * as THREE from 'three';
import {mkCanvas} from './draw2d';

// A flat drawable surface: static base canvas + per-frame dynamic canvas.
export class Sheet {
  base: HTMLCanvasElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  W: number;
  H: number;
  key = '';

  constructor(base: HTMLCanvasElement, W: number, H: number, opts: {rough?: number; metal?: number; bump?: THREE.Texture; bumpScale?: number; segs?: number} = {}) {
    this.base = base;
    this.canvas = mkCanvas(base.width, base.height);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.drawImage(base, 0, 0);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.W = W;
    this.H = H;
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex,
      roughness: opts.rough ?? 0.9,
      metalness: opts.metal ?? 0,
      bumpMap: opts.bump ?? null,
      bumpScale: opts.bumpScale ?? 1,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H, opts.segs ?? 1, opts.segs ?? 1), mat);
    this.mesh.layers.enable(2);
  }

  local(px: number, py: number, z = 0) {
    return new THREE.Vector3((px / this.canvas.width - 0.5) * this.W, (0.5 - py / this.canvas.height) * this.H, z);
  }

  // Redraw only when the content key changes.
  draw(key: string, fn: (ctx: CanvasRenderingContext2D) => void) {
    if (key === this.key) return;
    this.key = key;
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.base, 0, 0);
    fn(this.ctx);
    this.tex.needsUpdate = true;
  }
}

// Pen with its tip at the origin, body tilted back toward the camera.
export const makePen = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 1.5, 32).translate(0, 0.75 + 0.36, 0),
    new THREE.MeshStandardMaterial({color: '#221b29', roughness: 0.28, metalness: 0.35}),
  );
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.039, 0.036, 0.26, 32).translate(0, 0.13 + 0.1, 0),
    new THREE.MeshStandardMaterial({color: '#141017', roughness: 0.8}),
  );
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.006, 0.1, 32).translate(0, 0.05, 0),
    new THREE.MeshStandardMaterial({color: '#c9c0b8', roughness: 0.25, metalness: 0.9}),
  );
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0375, 0.0375, 0.03, 32).translate(0, 0.37, 0),
    new THREE.MeshStandardMaterial({color: '#b49a86', roughness: 0.3, metalness: 0.9}),
  );
  [body, grip, cone, ring].forEach((m) => {
    m.layers.enable(2);
    g.add(m);
  });
  return g;
};

// Chalk stick, tip at origin.
export const makeChalk = (len: number) => {
  const geo = new THREE.CylinderGeometry(0.024, 0.026, len, 20, 6).translate(0, len / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const s = 1 + Math.sin(y * 140 + i) * 0.03;
    pos.setX(i, pos.getX(i) * s);
    pos.setZ(i, pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: '#efe5da', roughness: 1}));
  m.layers.enable(2);
  return m;
};

// Soft dust motes (CPU-positioned).
export class Dust {
  points: THREE.Points;
  geo = new THREE.BufferGeometry();
  n: number;
  constructor(n: number, color = '#f4ebe1', size = 9) {
    this.n = n;
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('sz', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {uColor: {value: new THREE.Color(color)}, uSize: {value: size}},
      vertexShader: /* glsl */ `attribute float alpha; attribute float sz; varying float vA; uniform float uSize;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = uSize * sz / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `varying float vA; uniform vec3 uColor;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a;
        gl_FragColor = vec4(uColor * 1.4, a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }
  set(i: number, x: number, y: number, z: number, a: number, s = 1) {
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    p.setXYZ(i, x, y, z);
    (this.geo.attributes.alpha as THREE.BufferAttribute).setX(i, a);
    (this.geo.attributes.sz as THREE.BufferAttribute).setX(i, s);
  }
  commit() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.sz.needsUpdate = true;
  }
}

// Orient an object so its +Y axis points along dir.
const _up = new THREE.Vector3(0, 1, 0);
export const pointAlong = (o: THREE.Object3D, dir: THREE.Vector3) => {
  o.quaternion.setFromUnitVectors(_up, dir.clone().normalize());
};

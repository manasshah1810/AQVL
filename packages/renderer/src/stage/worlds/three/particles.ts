import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial } from 'three';

/**
 * A pool of soft round particles refilled every frame (sparkles, snow spray,
 * leaf confetti, click puffs). Positions are computed from time by whoever
 * fills it, so effects are deterministic and nothing is simulated.
 */
export class ParticlePool {
  readonly points: Points;
  private readonly position: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  private count = 0;

  constructor(readonly capacity: number, additive = false) {
    const geometry = new BufferGeometry();
    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    geometry.setAttribute('aColor', new BufferAttribute(this.color, 4));
    geometry.setAttribute('aSize', new BufferAttribute(this.size, 1));
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      vertexShader: /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (520.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`,
      fragmentShader: /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}
`,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      toneMapped: false,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  begin(): void {
    this.count = 0;
  }

  add(x: number, y: number, z: number, r: number, g: number, b: number, a: number, size: number): void {
    if (this.count >= this.capacity || a <= 0.003) return;
    const i = this.count++;
    this.position[i * 3] = x;
    this.position[i * 3 + 1] = y;
    this.position[i * 3 + 2] = z;
    this.color[i * 4] = r;
    this.color[i * 4 + 1] = g;
    this.color[i * 4 + 2] = b;
    this.color[i * 4 + 3] = a;
    this.size[i] = size;
  }

  end(): void {
    const g = this.points.geometry;
    g.setDrawRange(0, this.count);
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as ShaderMaterial).dispose();
  }
}

/** A fixed pseudo-random number per (seed, index), in 0..1. */
export function hash(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

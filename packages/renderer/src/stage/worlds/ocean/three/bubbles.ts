import { BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial } from 'three';

/**
 * Bubbles and silt, refilled every frame by whoever owns the pool (the pod's
 * breath and wake, a node dissolving, sand kicked up by a block touching
 * down). A particle is either a bubble (a clear sphere: a bright rim, a
 * glint, an almost empty middle) or a soft puff (silt, sparkle). Positions
 * are computed from time by the caller, so nothing is simulated.
 */
export class BubblePool {
  readonly points: Points;
  private readonly position: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  private readonly kind: Float32Array;
  private count = 0;

  constructor(readonly capacity: number) {
    const geometry = new BufferGeometry();
    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.kind = new Float32Array(capacity);
    geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    geometry.setAttribute('aColor', new BufferAttribute(this.color, 4));
    geometry.setAttribute('aSize', new BufferAttribute(this.size, 1));
    geometry.setAttribute('aKind', new BufferAttribute(this.kind, 1));
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      vertexShader: /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aKind;
varying vec4 vColor;
varying float vKind;
void main() {
  vColor = aColor;
  vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (520.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`,
      fragmentShader: /* glsl */ `
varying vec4 vColor;
varying float vKind;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float a;
  vec3 c = vColor.rgb;
  if (vKind > 0.5) {
    // A bubble: a thin bright rim, a faint body, and a glint up and to the left.
    float rim = smoothstep(0.62, 0.86, d) * (1.0 - smoothstep(0.88, 1.0, d));
    float body = (1.0 - smoothstep(0.0, 0.9, d)) * 0.12;
    float glint = 1.0 - smoothstep(0.0, 0.16, length(q - vec2(-0.16, -0.16)));
    a = (rim * 0.85 + body + glint * 0.9) * vColor.a;
    c = mix(c, vec3(1.0), glint * 0.7);
  } else {
    a = (1.0 - smoothstep(0.25, 1.0, d)) * vColor.a;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      toneMapped: false,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  begin(): void {
    this.count = 0;
  }

  /** A bubble of diameter `size` (world units, roughly). */
  bubble(x: number, y: number, z: number, a: number, size: number): void {
    this.add(x, y, z, 0.86, 0.97, 1, a, size, 1);
  }

  /** A soft puff (silt, sparkle). */
  puff(x: number, y: number, z: number, r: number, g: number, b: number, a: number, size: number): void {
    this.add(x, y, z, r, g, b, a, size, 0);
  }

  private add(x: number, y: number, z: number, r: number, g: number, b: number, a: number, size: number, kind: number): void {
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
    this.kind[i] = kind;
  }

  end(): void {
    const g = this.points.geometry;
    g.setDrawRange(0, this.count);
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aKind.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as ShaderMaterial).dispose();
  }
}

import * as THREE from 'three';
import {depthMat, shared} from './materials';

// One fixed post chain for the whole film:
// reflection (blurred) -> scene (MSAA, HDR) -> depth -> DOF -> bloom -> grade.

const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const blurFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
  c += texture2D(tSrc, vUv + uDir * 1.3846).rgb * 0.316216;
  c += texture2D(tSrc, vUv - uDir * 1.3846).rgb * 0.316216;
  c += texture2D(tSrc, vUv + uDir * 3.2308).rgb * 0.070270;
  c += texture2D(tSrc, vUv - uDir * 3.2308).rgb * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const dofFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uPx;
uniform float uFocus; uniform float uAperture; uniform float uMaxR;
float coc(float d){ return clamp(abs(d - uFocus) / max(d, 0.001) * uAperture, 0.0, uMaxR); }
void main(){
  float d0 = texture2D(tDepth, vUv).r;
  if (d0 <= 0.0) d0 = 200.0;
  float c0 = coc(d0);
  vec3 acc = texture2D(tSrc, vUv).rgb; float wsum = 1.0;
  if (c0 > 0.35) {
    const float GA = 2.39996323;
    for (int i = 1; i < 40; i++) {
      float fi = float(i);
      float r = sqrt(fi / 40.0) * c0;
      vec2 o = vec2(cos(fi * GA), sin(fi * GA)) * r * uPx;
      float ds = texture2D(tDepth, vUv + o).r; if (ds <= 0.0) ds = 200.0;
      float cs = coc(ds);
      // sharp foreground must not receive background bleed
      float w = ds < d0 ? smoothstep(r - 1.0, r + 1.0, cs) : 1.0;
      acc += texture2D(tSrc, vUv + o).rgb * w; wsum += w;
    }
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const brightFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform float uThresh;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = 0.5;
  float soft = clamp(l - uThresh + k, 0.0, 2.0 * k); soft = soft * soft / (4.0 * k + 1e-4);
  float contrib = max(soft, l - uThresh) / max(l, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}`;
const downFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.5;
  c += texture2D(tSrc, vUv + uPx * vec2(-1.0,-1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uPx * vec2( 1.0,-1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uPx * vec2( 1.0, 1.0)).rgb * 0.125;
  gl_FragColor = vec4(c, 1.0);
}`;
const upFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uPx;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + uPx * vec2(-1.0,-1.0)).rgb;
  c += texture2D(tSrc, vUv + uPx * vec2( 0.0,-1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uPx * vec2( 1.0,-1.0)).rgb;
  c += texture2D(tSrc, vUv + uPx * vec2(-1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + uPx * vec2( 1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uPx * vec2( 0.0, 1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uPx * vec2( 1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tPrev, vUv).rgb * 0.62, 1.0);
}`;

const finalFrag = /* glsl */ `
varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tBloom;
uniform float uBloom; uniform float uExposure; uniform float uCA; uniform float uVig;
uniform float uTime; uniform vec2 uRes; uniform vec3 uTint; uniform float uFade; uniform float uWarm; uniform vec2 uMotion;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * r2 * uCA;
  vec3 c = vec3(0.0);
  float ml = length(uMotion);
  int taps = ml > 0.0005 ? 12 : 1;
  for (int i = 0; i < 12; i++) {
    if (i >= taps) break;
    vec2 mo = taps > 1 ? uMotion * (float(i) / 11.0 - 0.5) : vec2(0.0);
    c.r += texture2D(tSrc, vUv + mo - off).r;
    c.g += texture2D(tSrc, vUv + mo).g;
    c.b += texture2D(tSrc, vUv + mo + off).b;
    c += texture2D(tBloom, vUv + mo).rgb * uBloom;
  }
  c /= float(taps);
  c *= uExposure * uTint;
  // warm analog grade for the classroom world
  c = mix(c, c * vec3(1.08, 0.98, 0.84), uWarm);
  c = aces(c);
  float vig = smoothstep(0.95, 0.18, r2 * 2.2);
  c *= mix(1.0, vig, uVig);
  // twilight shadow tint: keep blacks violet, never slate-blue
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += vec3(0.010, 0.004, 0.016) * (1.0 - smoothstep(0.0, 0.25, lum));
  c = pow(c, vec3(1.0 / 2.2));
  c *= uFade;
  // grain + dither against banding
  float n = h(vUv * uRes + fract(uTime * 13.37) * 97.0) + h(vUv * uRes * 1.37 - fract(uTime * 7.1) * 51.0) - 1.0;
  c += n * 0.022;
  gl_FragColor = vec4(c, 1.0);
}`;

export type PostParams = {
  focus: number;
  aperture: number;
  bloom: number;
  exposure: number;
  ca: number;
  vignette: number;
  time: number;
  fade: number;
  warm: number;
  threshold: number;
  motion?: number[];
};

export class Post {
  renderer: THREE.WebGLRenderer;
  w: number;
  h: number;
  rtRefl: THREE.WebGLRenderTarget;
  rtReflB: THREE.WebGLRenderTarget;
  rtScene: THREE.WebGLRenderTarget;
  rtDepth: THREE.WebGLRenderTarget;
  rtDof: THREE.WebGLRenderTarget;
  mips: THREE.WebGLRenderTarget[] = [];
  ups: THREE.WebGLRenderTarget[] = [];
  quad: THREE.Mesh;
  qScene = new THREE.Scene();
  qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mats: Record<string, THREE.ShaderMaterial> = {};
  black: THREE.DataTexture;

  constructor(renderer: THREE.WebGLRenderer, w: number, h: number) {
    this.renderer = renderer;
    this.w = w;
    this.h = h;
    const hf = {type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true};
    this.rtRefl = new THREE.WebGLRenderTarget(w / 2, h / 2, hf);
    this.rtReflB = new THREE.WebGLRenderTarget(w / 2, h / 2, hf);
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {...hf, samples: 4});
    this.rtDepth = new THREE.WebGLRenderTarget(w / 2, h / 2, {...hf, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter});
    this.rtDof = new THREE.WebGLRenderTarget(w, h, hf);
    let mw = w / 2;
    let mh = h / 2;
    for (let i = 0; i < 6; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(Math.max(1, Math.round(mw)), Math.max(1, Math.round(mh)), hf));
      this.ups.push(new THREE.WebGLRenderTarget(Math.max(1, Math.round(mw)), Math.max(1, Math.round(mh)), hf));
      mw /= 2;
      mh /= 2;
    }
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({vertexShader: quadVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false});
    this.mats.blur = mk(blurFrag, {tSrc: {value: null}, uDir: {value: new THREE.Vector2()}});
    this.mats.dof = mk(dofFrag, {
      tSrc: {value: null},
      tDepth: {value: null},
      uPx: {value: new THREE.Vector2(1 / w, 1 / h)},
      uFocus: {value: 10},
      uAperture: {value: 0},
      uMaxR: {value: 14 * (w / 1920)},
    });
    this.mats.bright = mk(brightFrag, {tSrc: {value: null}, uThresh: {value: 1.0}});
    this.mats.down = mk(downFrag, {tSrc: {value: null}, uPx: {value: new THREE.Vector2()}});
    this.mats.up = mk(upFrag, {tSrc: {value: null}, tPrev: {value: null}, uPx: {value: new THREE.Vector2()}});
    this.mats.final = mk(finalFrag, {
      tSrc: {value: null},
      tBloom: {value: null},
      uBloom: {value: 0.6},
      uExposure: {value: 1},
      uCA: {value: 0.012},
      uVig: {value: 0.6},
      uTime: {value: 0},
      uRes: {value: new THREE.Vector2(w, h)},
      uTint: {value: new THREE.Vector3(1, 1, 1)},
      uFade: {value: 1},
      uWarm: {value: 0},
      uMotion: {value: new THREE.Vector2()},
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mats.blur);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  blur(src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, radius: number) {
    const m = this.mats.blur;
    const px = 1 / src.width;
    const py = 1 / src.height;
    for (const s of [radius, radius * 0.5]) {
      m.uniforms.tSrc.value = src.texture;
      m.uniforms.uDir.value.set(px * s, 0);
      this.pass(m, tmp);
      m.uniforms.tSrc.value = tmp.texture;
      m.uniforms.uDir.value.set(0, py * s);
      this.pass(m, src);
    }
  }

  // world: the group holding every reflectable object; floor: the floor mesh.
  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    world: THREE.Object3D | null,
    floor: THREE.Mesh | null,
    p: PostParams,
  ) {
    const r = this.renderer;
    const fog = new THREE.Color(...(shared.uFogColor.value.toArray() as [number, number, number]));
    r.setClearColor(fog, 1);

    // 1. planar reflection: mirror the world group through y = 0
    if (world && floor && floor.visible) {
      floor.visible = false;
      world.scale.y = -1;
      world.updateMatrixWorld(true);
      shared.uReflect.value = 1;
      r.setClearColor(0x000000, 1);
      r.setRenderTarget(this.rtRefl);
      r.clear();
      r.render(scene, camera);
      r.setClearColor(fog, 1);
      shared.uReflect.value = 0;
      world.scale.y = 1;
      world.updateMatrixWorld(true);
      floor.visible = true;
      this.blur(this.rtRefl, this.rtReflB, 1.6);
      const fm = floor.material as THREE.ShaderMaterial;
      fm.uniforms.uRefl.value = this.rtRefl.texture;
      fm.uniforms.uRes.value.set(this.w, this.h);
    }

    // 2. scene
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    // 3. depth (for DOF)
    let src = this.rtScene;
    if (p.aperture > 0.01) {
      const prevMask = camera.layers.mask;
      camera.layers.set(2);
      scene.overrideMaterial = depthMat;
      r.setClearColor(0x000000, 1);
      r.setRenderTarget(this.rtDepth);
      r.clear();
      r.render(scene, camera);
      scene.overrideMaterial = null;
      camera.layers.mask = prevMask;
      r.setClearColor(fog, 1);
      const m = this.mats.dof;
      m.uniforms.tSrc.value = this.rtScene.texture;
      m.uniforms.tDepth.value = this.rtDepth.texture;
      m.uniforms.uFocus.value = p.focus;
      m.uniforms.uAperture.value = p.aperture * (this.w / 1920);
      this.pass(m, this.rtDof);
      src = this.rtDof;
    }

    // 4. bloom (mip chain)
    this.mats.bright.uniforms.tSrc.value = src.texture;
    this.mats.bright.uniforms.uThresh.value = p.threshold;
    this.pass(this.mats.bright, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const m = this.mats.down;
      m.uniforms.tSrc.value = this.mips[i - 1].texture;
      m.uniforms.uPx.value.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height);
      this.pass(m, this.mips[i]);
    }
    let prev: THREE.Texture = this.black;
    for (let i = this.mips.length - 1; i >= 0; i--) {
      const m = this.mats.up;
      m.uniforms.tSrc.value = this.mips[i].texture;
      m.uniforms.tPrev.value = prev;
      m.uniforms.uPx.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
      // prev must match size; upsample into ups[i] reading the coarser level
      this.pass(m, this.ups[i]);
      prev = this.ups[i].texture;
    }

    // 5. grade
    const f = this.mats.final;
    f.uniforms.tSrc.value = src.texture;
    f.uniforms.tBloom.value = this.ups[0].texture;
    f.uniforms.uBloom.value = p.bloom;
    f.uniforms.uExposure.value = p.exposure;
    f.uniforms.uCA.value = p.ca;
    f.uniforms.uVig.value = p.vignette;
    f.uniforms.uTime.value = p.time;
    f.uniforms.uFade.value = p.fade;
    f.uniforms.uWarm.value = p.warm;
    f.uniforms.uMotion.value.set(p.motion?.[0] ?? 0, p.motion?.[1] ?? 0);
    this.pass(f, null);
  }
}

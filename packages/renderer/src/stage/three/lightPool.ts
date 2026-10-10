import { Color, PointLight, Vector3 } from 'three';

/**
 * A few real point lights standing in for many.
 *
 * Every point light is run for every lit pixel of every standard-material
 * object, whether it is bright or dark: a scene with six lanterns and a
 * fire pays for seven lights everywhere, though only the two or three nearest
 * the action are visible in the picture. The pool keeps a fixed number of
 * real lights (a constant count, so no shader is ever rebuilt) and lends them
 * to whichever sources matter most right now: the brightest, weighted by how
 * near they are to where the camera looks. A light moving to a different
 * source fades out, moves, and fades back in, so nothing pops.
 *
 * The sources stay in the scene as hidden `PointLight`s: the world keeps
 * animating them (flicker, lit or doused) exactly as before, and the pool reads
 * them. Hidden lights cost the renderer nothing.
 */
export class LightPool {
  readonly lights: PointLight[];
  private readonly assigned: number[];
  private readonly desired: number[];
  private readonly fade: number[];
  private since = 1;
  private readonly p = new Vector3();
  private readonly scores: { i: number; s: number }[] = [];

  constructor(size: number, private readonly decay = 1.6) {
    this.lights = Array.from({ length: size }, () => {
      const l = new PointLight('#ffffff', 0, 8, decay);
      l.castShadow = false;
      return l;
    });
    this.assigned = this.lights.map(() => -1);
    this.desired = this.lights.map(() => -1);
    this.fade = this.lights.map(() => 0);
  }

  /** Call every frame after the sources have been animated. `focus` is the point the camera looks at. */
  update(dt: number, sources: readonly PointLight[], focus: Vector3): void {
    this.since += dt;
    if (this.since >= 0.2) {
      this.since = 0;
      this.choose(sources, focus);
    }
    const step = Math.min(0.1, dt) / 0.18;
    for (let k = 0; k < this.lights.length; k++) {
      const light = this.lights[k];
      if (this.assigned[k] !== this.desired[k]) {
        this.fade[k] = Math.max(0, this.fade[k] - step);
        if (this.fade[k] <= 0) this.assigned[k] = this.desired[k];
      } else this.fade[k] = Math.min(1, this.fade[k] + step);
      const src = this.assigned[k] >= 0 ? sources[this.assigned[k]] : undefined;
      if (!src) {
        light.intensity = 0;
        continue;
      }
      src.getWorldPosition(light.position);
      light.color.copy(src.color as Color);
      light.distance = src.distance;
      light.intensity = src.intensity * this.fade[k];
    }
  }

  private choose(sources: readonly PointLight[], focus: Vector3): void {
    this.scores.length = 0;
    sources.forEach((s, i) => {
      if (s.intensity < 0.05) return;
      s.getWorldPosition(this.p);
      const d2 = this.p.distanceToSquared(focus);
      // Bright and close to where the camera looks wins.
      this.scores.push({ i, s: s.intensity / (1 + d2 / 36) });
    });
    this.scores.sort((a, b) => b.s - a.s);
    const top = this.scores.slice(0, this.lights.length).map((e) => e.i);
    // A source that already has a light keeps it; the free lights take the newcomers.
    const keep = new Set<number>();
    for (let k = 0; k < this.lights.length; k++) {
      const now = this.desired[k];
      if (now >= 0 && top.includes(now)) keep.add(now);
      else this.desired[k] = -1;
    }
    const fresh = top.filter((i) => !keep.has(i));
    for (let k = 0; k < this.lights.length && fresh.length; k++) if (this.desired[k] < 0) this.desired[k] = fresh.shift()!;
  }
}

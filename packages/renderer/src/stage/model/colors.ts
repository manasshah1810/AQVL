import { Color } from 'three';

/** #rrggbb → linear-space RGB, cached (three's colour management converts sRGB hex to the linear working space). */
const cache = new Map<string, [number, number, number]>();
const scratch = new Color();

export function linearRgb(hex: string): [number, number, number] {
  let rgb = cache.get(hex);
  if (!rgb) {
    scratch.set(hex);
    rgb = [scratch.r, scratch.g, scratch.b];
    cache.set(hex, rgb);
  }
  return rgb;
}

export function writeRgb(out: Float32Array, i: number, hex: string): void {
  const [r, g, b] = linearRgb(hex);
  out[i * 3] = r;
  out[i * 3 + 1] = g;
  out[i * 3 + 2] = b;
}

/** Relative luminance of a linear RGB triple (used to pick dark or light text on a blended body colour). */
export function luminanceLinear(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

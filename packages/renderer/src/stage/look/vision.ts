/**
 * Colour-vision checks for the stage palette: simulated dichromacy
 * (Machado, Oliveira & Fernandes 2009, severity 1.0) and CIE76 ΔE in Lab.
 * Used by the palette tests and the README's colour-blind table.
 */

export type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

const MACHADO: Record<Exclude<Vision, 'normal'>, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToLinear(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [toLinear(((v >> 16) & 255) / 255), toLinear(((v >> 8) & 255) / 255), toLinear((v & 255) / 255)];
}

/** Linear RGB as seen with the given colour vision. */
export function simulate(hex: string, vision: Vision): [number, number, number] {
  const rgb = hexToLinear(hex);
  if (vision === 'normal') return rgb;
  const m = MACHADO[vision];
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(m[0] * rgb[0] + m[1] * rgb[1] + m[2] * rgb[2]),
    clamp(m[3] * rgb[0] + m[4] * rgb[1] + m[5] * rgb[2]),
    clamp(m[6] * rgb[0] + m[7] * rgb[1] + m[8] * rgb[2]),
  ];
}

function linearToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference between two colours as seen with `vision`. */
export function deltaE(a: string, b: string, vision: Vision = 'normal'): number {
  const la = linearToLab(simulate(a, vision));
  const lb = linearToLab(simulate(b, vision));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Lightness difference alone (L*), the part of a difference that survives any dichromacy. */
export function deltaL(a: string, b: string, vision: Vision = 'normal'): number {
  return Math.abs(linearToLab(simulate(a, vision))[0] - linearToLab(simulate(b, vision))[0]);
}

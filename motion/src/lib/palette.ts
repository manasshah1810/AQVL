// "Twilight & Peach" color architecture.
export const TWILIGHT = '#100d19'; // 70%: the void, floor, negative space
export const TWILIGHT_LIFT = '#191426'; // subtle lift behind the hero only
export const PEACH = '#ebc0a3'; // code, type, 1px borders, rim light, logo
export const PURPLE = '#666379'; // panels, inactive structure, glass body
// The single neon accent: active 3D algorithm nodes only.
export const NEON = '#3ff6dc';

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// sRGB -> linear, for shader uniforms.
export const lin = (hex: string): [number, number, number] =>
  hexToRgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))) as [
    number,
    number,
    number,
  ];

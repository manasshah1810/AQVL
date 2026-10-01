// Mirrors scripts/brand.mjs — the AQVL symbol geometry, for animation.
export const SPEC = { H: 100, W: 18, GAP: 3.2, ANGLE: 45 };
const d2r = Math.PI / 180;
export const symbol = (cx: number, cy: number, size: number) => {
  const k = size / SPEC.H;
  const W = SPEC.W * k;
  const rc = (SPEC.H / 2 - SPEC.W / 2) * k;
  const dotR = W / 2;
  const half = (2 * Math.asin((SPEC.W / 2 + SPEC.GAP + SPEC.W / 2) / (2 * (SPEC.H / 2 - SPEC.W / 2)))) / d2r;
  const a0 = SPEC.ANGLE + half, a1 = SPEC.ANGLE - half + 360;
  const at = (a: number, r = rc): [number, number] => [cx + r * Math.cos(a * d2r), cy + r * Math.sin(a * d2r)];
  const arcD = (from = a0, to = a1) => {
    const p0 = at(from), p1 = at(to);
    const large = to - from > 180 ? 1 : 0;
    return `M${p0[0]} ${p0[1]} A${rc} ${rc} 0 ${large} 1 ${p1[0]} ${p1[1]}`;
  };
  return { k, W, rc, dotR, a0, a1, half, at, arcD, dot: at(SPEC.ANGLE) };
};

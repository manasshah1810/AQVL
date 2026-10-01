// AQVL identity geometry. Everything is built from monoline strokes so the
// mark can be drawn on, sampled as points, and resolved from a scribble.

export const STROKE = 11; // mark stroke on a 100-unit grid

// ---- Chosen mark: "Launch loop" ------------------------------------------
// One continuous stroke: a loop (the tangle, recursion, the thing you can't
// track) that closes on itself and launches out along a straight baseline
// (the floor, the timeline, clarity). Reads as a Q, as an aperture, as a
// signal resolving from noise.
export const MARK = {
  cx: 42,
  cy: 44,
  r: 30,
  gapDeg: 40, // gap on the lower-left before the stroke meets the baseline
  tailEnd: 94, // baseline runs to here
};

const rad = (d: number) => (d * Math.PI) / 180;

// Path data for the mark (stroke only).
export const markPath = (m = MARK) => {
  const {cx, cy, r} = m;
  const by = cy + r; // baseline (tangent at the bottom)
  // start on the lower-right, travel counterclockwise on screen (up the
  // right, over the top, down the left) to the bottom, then straight out
  // along the baseline, under its own starting end.
  const a0 = 90 - m.gapDeg; // screen degrees, y down
  const sx = cx + r * Math.cos(rad(a0));
  const sy = cy + r * Math.sin(rad(a0));
  return `M ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 0 ${f(cx)} ${f(by)} L ${m.tailEnd} ${f(by)}`;
};

// Points along the mark, in drawing order (for scribble resolve + glow).
export const markPoints = (n: number, m = MARK) => {
  const {cx, cy, r} = m;
  const by = cy + r;
  const a0 = 90 - m.gapDeg;
  const arcLen = rad(360 - m.gapDeg) * r;
  const lineLen = m.tailEnd - cx;
  const total = arcLen + lineLen;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * total;
    if (s <= arcLen) {
      const a = a0 - (s / arcLen) * (360 - m.gapDeg);
      pts.push([cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))]);
    } else {
      pts.push([cx + (s - arcLen), by]);
    }
  }
  return {pts, arcLen, total};
};

const f = (x: number) => x.toFixed(3);

// ---- Wordmark "AQVL" ------------------------------------------------------
// Monoline geometric capitals on a cap height of 60, stroke 9, square caps.
// The Q is the mark itself, scaled to cap height, so symbol and word rhyme.
export const WM = {cap: 60, stroke: 9, track: 16};

export type Glyph = {d: string; w: number};
export const glyphs = (): Glyph[] => {
  const c = WM.cap;
  const s = WM.stroke;
  const h = s / 2;
  // A: flat-topped chevron with a low crossbar
  const aw = 50;
  const A: Glyph = {
    w: aw,
    d: `M ${h} ${c} L ${aw / 2 - 4} ${h} L ${aw / 2 + 4} ${h} L ${aw - h} ${c} M ${12} ${c * 0.68} L ${aw - 12} ${c * 0.68}`,
  };
  // Q: loop + baseline launch, same construction as the mark
  const r = (c - s) / 2;
  const qcx = r + h;
  const qcy = h + r;
  const gap = 40;
  const a0 = 90 - gap;
  const sx = qcx + r * Math.cos(rad(a0));
  const sy = qcy + r * Math.sin(rad(a0));
  const qw = 2 * r + s + 12;
  const Q: Glyph = {w: qw, d: `M ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 0 ${f(qcx)} ${f(qcy + r)} L ${f(qw)} ${f(qcy + r)}`};
  const vw = 50;
  const V: Glyph = {w: vw, d: `M ${h} 0 L ${vw / 2 - 4} ${c - h} L ${vw / 2 + 4} ${c - h} L ${vw - h} 0`};
  const lw = 36;
  const L: Glyph = {w: lw, d: `M ${h} 0 L ${h} ${c - h} L ${lw} ${c - h}`};
  return [A, Q, V, L];
};

// Optical kerning pairs (added to tracking): A-Q, Q-V, V-L
export const KERN = [2, -6, 0];

export const wordmark = () => {
  const g = glyphs();
  let x = 0;
  const parts: {d: string; x: number}[] = [];
  g.forEach((gl, i) => {
    parts.push({d: gl.d, x});
    x += gl.w + WM.track + (KERN[i] ?? 0);
  });
  return {parts, width: x - WM.track};
};

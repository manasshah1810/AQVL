// AQVL identity geometry, ported from the launch-film logo sheet
// (brand/aqvl-logosheet.png at the repo root, mark "B · launch loop").
//
// One continuous stroke: a loop (the tangle, recursion, the thing you can't
// track) that closes on itself and launches out along a straight baseline
// (the floor, the timeline, clarity). Built from monoline strokes so it can
// be drawn on.

export const STROKE = 11; // mark stroke on a 100-unit grid

export const MARK = {
  cx: 42,
  cy: 44,
  r: 30,
  gapDeg: 40, // gap on the lower-right before the stroke meets the baseline
  tailEnd: 94, // baseline runs to here
};

const rad = (d: number) => (d * Math.PI) / 180;
const f = (x: number) => x.toFixed(3);

/** Path data for the mark (stroke only), on a 100×100 grid. */
export function markPath(m = MARK) {
  const { cx, cy, r } = m;
  const by = cy + r;
  const a0 = 90 - m.gapDeg;
  const sx = cx + r * Math.cos(rad(a0));
  const sy = cy + r * Math.sin(rad(a0));
  return `M ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 0 ${f(cx)} ${f(by)} L ${m.tailEnd} ${f(by)}`;
}

// ---- Wordmark "AQVL" -------------------------------------------------------
// Monoline geometric capitals on a cap height of 60, stroke 9, square caps.
// The Q is the mark itself, scaled to cap height, so symbol and word rhyme.
export const WM = { cap: 60, stroke: 9, track: 16 };

interface Glyph {
  d: string;
  w: number;
}

function glyphs(): Glyph[] {
  const c = WM.cap;
  const s = WM.stroke;
  const h = s / 2;
  const aw = 50;
  const A: Glyph = {
    w: aw,
    d: `M ${h} ${c} L ${aw / 2 - 4} ${h} L ${aw / 2 + 4} ${h} L ${aw - h} ${c} M ${12} ${c * 0.68} L ${aw - 12} ${c * 0.68}`,
  };
  const r = (c - s) / 2;
  const qcx = r + h;
  const qcy = h + r;
  const a0 = 90 - 40;
  const sx = qcx + r * Math.cos(rad(a0));
  const sy = qcy + r * Math.sin(rad(a0));
  const qw = 2 * r + s + 12;
  const Q: Glyph = { w: qw, d: `M ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 0 ${f(qcx)} ${f(qcy + r)} L ${f(qw)} ${f(qcy + r)}` };
  const vw = 50;
  const V: Glyph = { w: vw, d: `M ${h} 0 L ${vw / 2 - 4} ${c - h} L ${vw / 2 + 4} ${c - h} L ${vw - h} 0` };
  const lw = 36;
  const L: Glyph = { w: lw, d: `M ${h} 0 L ${h} ${c - h} L ${lw} ${c - h}` };
  return [A, Q, V, L];
}

// Optical kerning pairs (added to tracking): A-Q, Q-V, V-L
const KERN = [2, -6, 0];

export function wordmark() {
  const g = glyphs();
  let x = 0;
  const parts: { d: string; x: number }[] = [];
  g.forEach((gl, i) => {
    parts.push({ d: gl.d, x });
    x += gl.w + WM.track + (KERN[i] ?? 0);
  });
  return { parts, width: x - WM.track };
}

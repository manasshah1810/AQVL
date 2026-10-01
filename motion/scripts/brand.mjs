// AQVL identity generator. One stroke weight (W) drives everything.
// Symbol: a ring broken at 4:30, closed by a single point — a question, resolved.
import fs from 'node:fs';
const d2r = Math.PI / 180;
export const SPEC = {
  H: 100,      // cap height / symbol diameter
  W: 18,       // stroke weight
  GAP: 3.2,    // clearance between point and ring ends
  ANGLE: 45,   // position of the point (deg, y-down, 45 = lower right)
};
const f = (n) => +n.toFixed(3);
export function symbolGeom({ H, W, GAP, ANGLE } = SPEC, cx = H / 2, cy = H / 2) {
  const rc = H / 2 - W / 2;                  // centerline radius
  const dotR = W / 2;
  // half angular gap so that round cap (W/2) + clearance + dot radius fit on centerline chord
  const half = (2 * Math.asin((W / 2 + GAP + dotR) / (2 * rc))) / d2r;
  const a0 = ANGLE + half, a1 = ANGLE - half + 360;
  const p = (a) => [cx + rc * Math.cos(a * d2r), cy + rc * Math.sin(a * d2r)];
  return { rc, cx, cy, dotR, a0, a1, half, start: p(a0), end: p(a1), dot: p(ANGLE) };
}
// filled outline for the ring arc (round caps) so files have no strokes
export function arcOutline(g, W) {
  const { cx, cy, rc, a0, a1 } = g;
  const ro = rc + W / 2, ri = rc - W / 2;
  const P = (r, a) => `${f(cx + r * Math.cos(a * d2r))} ${f(cy + r * Math.sin(a * d2r))}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${P(ro, a0)} A${f(ro)} ${f(ro)} 0 ${large} 1 ${P(ro, a1)} A${W / 2} ${W / 2} 0 0 1 ${P(ri, a1)} A${f(ri)} ${f(ri)} 0 ${large} 0 ${P(ri, a0)} A${W / 2} ${W / 2} 0 0 1 ${P(ro, a0)} Z`;
}
export function symbolPaths(ox = 0, oy = 0, s = SPEC) {
  const g = symbolGeom(s, ox + s.H / 2, oy + s.H / 2);
  return { ring: arcOutline(g, s.W), dot: { cx: f(g.dot[0]), cy: f(g.dot[1]), r: f(g.dotR) }, g };
}
// Letters, cap height H, weight W. Λ and V are mirror images; flat terminals.
export function letters(s = SPEC) {
  const { H, W } = s;
  const wA = 88; // A / V width
  const legSlope = H / (wA / 2);
  const t = W * Math.sqrt(1 + 1 / (legSlope * legSlope)); // horizontal thickness of the diagonal
  const flat = W * 0.62; // width of flat apex
  const A = (x) => {
    const L = x, R = x + wA, c = x + wA / 2;
    // outer edges from baseline to flat top; inner edges meet at a point
    const yi = H - (wA / 2 - t) * legSlope + 0; // inner apex height
    const topL = c - flat / 2, topR = c + flat / 2;
    // outer leg passes (L,H) and (topL,0)
    return `M${f(L)} ${H} L${f(topL)} 0 L${f(topR)} 0 L${f(R)} ${H} L${f(R - t * ((R - topR) / (wA / 2)))} ${H} L${f(c)} ${f(yi + (flat / 2) * legSlope * 0.0)} L${f(L + t * ((topL - L) / (wA / 2)))} ${H} Z`;
  };
  const V = (x) => {
    const L = x, R = x + wA, c = x + wA / 2;
    const yi = (wA / 2 - t) * legSlope;
    const botL = c - flat / 2, botR = c + flat / 2;
    return `M${f(L)} 0 L${f(L + t * ((botL - L) / (wA / 2)))} 0 L${f(c)} ${f(yi)} L${f(R - t * ((R - botR) / (wA / 2)))} 0 L${f(R)} 0 L${f(botR)} ${H} L${f(botL)} ${H} Z`;
  };
  const Lw = 62;
  const L = (x) => `M${f(x)} 0 H${f(x + W)} V${f(H - W)} H${f(x + Lw)} V${H} H${f(x)} Z`;
  return { A, V, L, wA, Lw };
}
export function wordmark(s = SPEC) {
  const { H } = s;
  const { A, V, L, wA, Lw } = letters(s);
  // optical spacing (sidebearings tuned by eye: diagonals tuck closer to round forms)
  const xA = 0, xQ = xA + wA + 1, xV = xQ + H + 1, xL = xV + wA + 13;
  const width = xL + Lw;
  const q = symbolPaths(xQ, 0, s);
  return { width, height: H, A: A(xA), V: V(xV), L: L(xL), q };
}
const svg = (w, h, body, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}" width="${w + 2 * pad}" height="${h + 2 * pad}">${body}</svg>\n`;
export function files(fg = '#F3F1EC', accent = '#FF5B2E') {
  const s = SPEC;
  const sym = symbolPaths(0, 0, s);
  const symbol = (c1, c2) => svg(s.H, s.H, `<path fill="${c1}" d="${sym.ring}"/><circle fill="${c2}" cx="${sym.dot.cx}" cy="${sym.dot.cy}" r="${sym.dot.r}"/>`, 6);
  const wm = wordmark(s);
  const wmBody = (c1, c2) => `<g fill="${c1}"><path d="${wm.A}"/><path d="${wm.q.ring}"/><path d="${wm.V}"/><path d="${wm.L}"/></g><circle fill="${c2}" cx="${wm.q.dot.cx}" cy="${wm.q.dot.cy}" r="${wm.q.dot.r}"/>`;
  return {
    'aqvl-symbol.svg': symbol(fg, accent),
    'aqvl-symbol-mono.svg': symbol('#000', '#000'),
    'aqvl-wordmark.svg': svg(wm.width, wm.height, wmBody(fg, accent), 6),
    'aqvl-wordmark-mono.svg': svg(wm.width, wm.height, wmBody('#000', '#000'), 6),
    'aqvl-lockup.svg': (() => {
      const k = 0.62, gap = 30; // tagline under wordmark
      return svg(wm.width, wm.height + gap + 22, wmBody(fg, accent) + `<text x="0" y="${wm.height + gap + 18}" font-family="Inter Tight, sans-serif" font-weight="500" font-size="20" letter-spacing="1.5" fill="${fg}" opacity="0.7">WRITE THE ALGORITHM. WATCH IT THINK.</text>`, 6);
    })(),
  };
}
if (process.argv[2] === 'write') {
  const out = new URL('../public/brand/', import.meta.url);
  fs.mkdirSync(out, { recursive: true });
  for (const [k, v] of Object.entries(files())) fs.writeFileSync(new URL(k, out), v);
  fs.writeFileSync(new URL('geometry.json', out), JSON.stringify({ spec: SPEC, symbol: symbolPaths(), wordmark: wordmark() }, null, 1));
  console.log('wrote', Object.keys(files()));
}

// AQVL brand geometry: single source of truth for SVG assets and animation.
// Symbol: Lambda over V on a 100 grid. The lens (lit kite) is where the two letters overlap.
export const ICE = '#9fd0ff';
export const AMBER = '#ffb02e';
export const SYM_STROKE = 8;
// chevrons are extended past the clip so tails end flat (horizontal terminals)
export const SYM = {
  lambda: [[10, 76], [50, 16], [90, 76]], // clipped at y<=70
  vee: [[10, 24], [50, 84], [90, 24]],    // clipped at y>=30
  lens: [[27.3, 50], [50, 16], [72.7, 50], [50, 84]],
  clipLambda: {y: 70}, clipVee: {y: 30},
};
// Wordmark: monoline geometric letters, height 48, stroke 6
export const WM_STROKE = 7;
export const WM = {
  A: {x: 0, w: 40, paths: [[[0, 48], [20, 0], [40, 48]], [[9.5, 33], [30.5, 33]]]},
  Q: {x: 50, w: 48, circle: [24, 24, 21], paths: [[[34, 34], [47, 47]]]},
  V: {x: 108, w: 40, paths: [[[0, 0], [20, 48], [40, 0]]]},
  L: {x: 163, w: 34, paths: [[[0, 0], [0, 48], [30, 48]]]},
};
export const WM_W = 196;
const pts = (p) => p.map((q) => q.join(',')).join(' ');
export const symbolInner = (ice = ICE, amber = AMBER) => `
  <clipPath id="cl"><rect x="0" y="0" width="100" height="70"/></clipPath>
  <clipPath id="cv"><rect x="0" y="30" width="100" height="70"/></clipPath>
  <polygon points="${pts(SYM.lens)}" fill="${amber}"/>
  <g fill="none" stroke="${ice}" stroke-width="${SYM_STROKE}" stroke-linejoin="miter" stroke-miterlimit="10">
    <polyline clip-path="url(#cl)" points="${pts(SYM.lambda)}"/>
    <polyline clip-path="url(#cv)" points="${pts(SYM.vee)}"/>
  </g>`;
export const wordmarkInner = (col = ICE) => {
  let s = `<g fill="none" stroke="${col}" stroke-width="${WM_STROKE}" stroke-linejoin="miter" stroke-miterlimit="10">`;
  for (const k of Object.keys(WM)) {
    const L = WM[k];
    s += `<g transform="translate(${L.x},0)">`;
    if (L.circle) s += `<circle cx="${L.circle[0]}" cy="${L.circle[1]}" r="${L.circle[2]}"/>`;
    for (const p of L.paths) s += `<polyline points="${pts(p)}"/>`;
    s += '</g>';
  }
  return s + '</g>';
};
export const svgSymbol = (ice, amber) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">${symbolInner(ice, amber)}</svg>\n`;
export const svgWordmark = (col) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 200 58" height="112">${wordmarkInner(col)}</svg>\n`;
export const svgLockup = (ice, amber) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 100" height="200"><g>${symbolInner(ice, amber)}</g><g transform="translate(124,23) scale(1.12)">${wordmarkInner(ice)}</g></svg>
`;

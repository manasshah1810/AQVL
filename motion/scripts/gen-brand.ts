// Writes the AQVL identity SVGs to public/brand from the shared geometry.
// Run: node scripts/gen-brand.ts   (Node >= 22.18 strips types natively)
import {writeFileSync} from 'node:fs';
import {markPath, STROKE, wordmark, WM} from '../src/brand/geometry.ts';

const PEACH = '#ebc0a3';
const PURPLE = '#666379';
const out = new URL('../public/brand/', import.meta.url);

const svg = (vb: string, w: number, h: number, body: string, bg?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${bg ? `<rect x="-1000" y="-1000" width="4000" height="4000" fill="${bg}"/>` : ''}${body}</svg>\n`;

const mark = (c: string) => `<path d="${markPath()}" fill="none" stroke="${c}" stroke-width="${STROKE}" stroke-linecap="butt"/>`;
const wm = wordmark();
const word = (c: string, dx = 0, dy = 0, s = 1) =>
  `<g transform="translate(${dx} ${dy}) scale(${s})" fill="none" stroke="${c}" stroke-width="${WM.stroke}" stroke-linecap="butt" stroke-linejoin="miter">${wm.parts
    .map((p) => `<path transform="translate(${p.x} 0)" d="${p.d}"/>`)
    .join('')}</g>`;

const files: Record<string, string> = {
  'aqvl-symbol.svg': svg('0 0 100 100', 512, 512, mark(PEACH)),
  'aqvl-symbol-onecolor.svg': svg('0 0 100 100', 512, 512, mark('currentColor')),
  'aqvl-symbol-light.svg': svg('0 0 100 100', 512, 512, mark('#1a1522')),
  'aqvl-wordmark.svg': svg(`-5 -5 ${wm.width + 10} ${WM.cap + 10}`, Math.round((wm.width + 10) * 3), (WM.cap + 10) * 3, word(PEACH)),
  'aqvl-wordmark-onecolor.svg': svg(`-5 -5 ${wm.width + 10} ${WM.cap + 10}`, Math.round((wm.width + 10) * 3), (WM.cap + 10) * 3, word('currentColor')),
  // lockup: symbol at 100 units, wordmark at cap 44 aligned to the baseline
  'aqvl-lockup.svg': svg(`-6 0 ${130 + wm.width * 0.62 + 12} 100`, 1200, 480, mark(PEACH) + word(PEACH, 130, 74 - 60 * 0.62 - 0, 0.62)),
  'aqvl-lockup-onecolor.svg': svg(`-6 0 ${130 + wm.width * 0.62 + 12} 100`, 1200, 480, mark('currentColor') + word('currentColor', 130, 74 - 60 * 0.62, 0.62)),
  'aqvl-lockup-on-twilight.svg': svg(`-6 0 ${130 + wm.width * 0.62 + 12} 100`, 1200, 480, mark(PEACH) + word(PEACH, 130, 74 - 60 * 0.62, 0.62), '#100d19'),
};
for (const [name, body] of Object.entries(files)) writeFileSync(new URL(name, out), body);
console.log('wrote', Object.keys(files).join(', '), 'secondary', PURPLE);

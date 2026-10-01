import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const SANS = 'AQ Sans';
export const MONO = 'AQ Mono';
export const HAND = 'AQ Hand';
export const SERIF = 'AQ Serif';

const faces: [string, string, string, string?][] = [
  [SANS, 'inter-tight-latin-300-normal.woff2', '300'],
  [SANS, 'inter-tight-latin-500-normal.woff2', '500'],
  [SANS, 'inter-tight-latin-600-normal.woff2', '600'],
  [SANS, 'inter-tight-latin-700-normal.woff2', '700'],
  [MONO, 'jetbrains-mono-latin-400-normal.woff2', '400'],
  [MONO, 'jetbrains-mono-latin-600-normal.woff2', '600'],
  [HAND, 'caveat-latin-500-normal.woff2', '500'],
  [HAND, 'caveat-latin-700-normal.woff2', '700'],
  [SERIF, 'instrument-serif-latin-400-normal.woff2', '400'],
  [SERIF, 'instrument-serif-latin-400-italic.woff2', '400', 'italic'],
];

let started = false;
export const ensureFonts = () => {
  if (started) return;
  started = true;
  for (const [family, file, weight, style] of faces) {
    loadFont({ family, url: staticFile(`fonts/${file}`), weight, style: style ?? 'normal' });
  }
};

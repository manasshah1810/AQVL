// Render review stills at given times (seconds) with one bundle.
// usage: node scripts/stills.mjs <Comp> <outDir> t1 t2 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const [comp = 'Draft', outDir = 'out/review', ...times] = process.argv.slice(2);
mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: comp, chromiumOptions: {gl: 'angle'}});
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(s) * composition.fps));
  const output = path.join(outDir, `t${String(s).padStart(5, '0')}.png`);
  const t0 = Date.now();
  await renderStill({composition, serveUrl, output, frame, chromiumOptions: {gl: 'angle'}, overwrite: true, logLevel: 'error'});
  console.log(output, `${Date.now() - t0}ms`);
}

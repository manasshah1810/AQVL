// usage: node scripts/sheet.mjs out.jpg cols img1 img2 ...   (tiles at 480x270 with labels)
import { execFileSync } from 'node:child_process';
const [out, colsS, ...imgs] = process.argv.slice(2);
const cols = +colsS, w = 480, h = 270;
const args = ['-v', 'error', '-y'];
imgs.forEach((i) => args.push('-i', i));
let fc = imgs.map((p, i) => `[${i}:v]scale=${w}:${h},drawtext=text='${p.split('/').pop().replace(/\..*$/, '')}':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.5[v${i}]`).join(';');
const n = imgs.length;
const layout = imgs.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|');
fc += ';' + imgs.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${n}:layout=${layout}:fill=black[o]`;
args.push('-filter_complex', fc, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });

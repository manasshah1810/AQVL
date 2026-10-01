import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, clamp, ip, lerp, lookAt, orbit, rng } from '../lib/core';
import { Canvas2D, Grain, Vignette, bloom } from '../lib/fx';
import { Words } from '../lib/type';
import { MONO } from '../fonts';
import { BEV, README_ARR, drawBubble } from './viz/algos';
import { HOT, WHITE, bg, floor, rgba } from './viz/kit';

// The README's own program. The visualization is the program.
const SRC = `SCENE BubbleSort
DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]
SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
  END
END`.split('\n');
const KW = new Set(['SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE', 'LOOP', 'FROM', 'TO', 'COMPARE', 'IF', 'SWAP', 'END', 'LENGTH']);
type G = { ch: string; line: number; col: number; kw: boolean; num: number; seed: number };
const GLYPHS: G[] = (() => {
  const out: G[] = [];
  const r = rng(5);
  SRC.forEach((ln, li) => {
    const re = /[A-Za-z_]+|\d+|./g;
    let m: RegExpExecArray | null;
    let numIdx = 0;
    while ((m = re.exec(ln))) {
      const tok = m[0];
      const isNum = li === 2 && /^\d+$/.test(tok);
      for (let k = 0; k < tok.length; k++) {
        if (tok[k] === ' ') continue;
        out.push({ ch: tok[k], line: li, col: m.index + k, kw: KW.has(tok), num: isNum ? numIdx : -1, seed: r() });
      }
      if (isNum) numIdx++;
    }
  });
  return out;
})();
const CW = 0.42, LH = 0.95; // world units per char / line
export const C2S_DUR = 132;

export const CodeToStructure: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / C2S_DUR;
  const lift = ip(f, 40, 66, 0, 1, E.inOut);
  const yaw = lerp(-0.15, 0.55, E.inOut(t));
  const pitch = lerp(1.05, 0.38, ip(f, 30, 80, 0, 1, E.inOut));
  const target: [number, number, number] = [0, lerp(0, 2.4, lift), lerp(1.5, -3, lift)];
  const cam = lookAt(orbit(target, lerp(13, 15.5, lift), yaw, pitch), target, 50);
  const step = Math.max(0, (f - 70) * 0.42);
  const ev = BEV[Math.min(Math.floor(step), BEV.length - 1)];
  const execLine = f < 70 ? -1 : step >= BEV.length ? -1 : (ev as any).cmp ? 6 : 8;
  return (
    <AbsoluteFill>
      <Canvas2D
        draw={(ctx) => {
          bg(ctx, 0.3);
          floor(ctx, cam, -0.02, 20, 1, 0.07);
          // code lying on the floor plane; each glyph drawn with the plane's local affine
          ctx.textBaseline = 'alphabetic';
          for (let i = 0; i < GLYPHS.length; i++) {
            const g = GLYPHS[i];
            const arrive = E.out(clamp((f - g.seed * 14 - (g.line / SRC.length) * 8) / 14));
            const wx = (g.col - 22) * CW + 3.2, wz = (g.line - 6) * LH + 1.5;
            // flying in from the tear
            const fx = lerp((g.seed - 0.5) * 30, wx, arrive), fz = lerp(10 + g.seed * 8, wz, arrive), fy = lerp(4 + g.seed * 6, 0, arrive);
            if (g.num >= 0 && lift > 0) continue; // numbers become bars
            const o = cam([fx, fy, fz]), ox = cam([fx + 1, fy, fz]), oz = cam([fx, fy, fz - 1]);
            if (o.z < 1) continue;
            const isExec = g.line === execLine;
            const dim = lerp(1, 0.32, lift) * (isExec ? 3 : 1);
            const col = g.num >= 0 ? HOT : g.kw ? [236, 240, 248] : [150, 168, 200];
            const k = CW * 2.2 * 0.02;
            ctx.setTransform((ox.x - o.x) * k, (ox.y - o.y) * k, (o.x - oz.x) * k, (o.y - oz.y) * k, o.x, o.y);
            ctx.font = `${g.kw ? 600 : 400} 40px "AQ Mono"`;
            ctx.fillStyle = rgba(isExec ? HOT : col, clamp(arrive * dim));
            ctx.fillText(g.ch, 0, 0);
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          // the numbers lift out of the code and become the array
          if (lift > 0) {
            for (let k = 0; k < README_ARR.length; k++) {
              const g = GLYPHS.filter((x) => x.num === k);
              const sx = ((g[0].col + g.length / 2 - 22) * CW + 3.2), sz = (2 - 6) * LH + 1.5;
              const bx = (k - 3) * 1.6, bz = 0;
              const e = E.inOut(clamp(lift * 1.4 - k * 0.06));
              const p = cam([lerp(sx, bx, e), lerp(0, (README_ARR[k] / 90) * 6 + 0.6, e), lerp(sz, bz, e)]);
              if (e < 0.98) {
                ctx.font = `600 ${Math.max(10, p.s * 0.42)}px "AQ Mono"`;
                ctx.textAlign = 'center';
                ctx.fillStyle = rgba(HOT, 1 - e * 0.4);
                ctx.fillText(String(README_ARR[k]), p.x, p.y);
              }
            }
            drawBubble(ctx, step, cam, ip(f, 52, 72, 0, 1), 1);
          }
          bloom(ctx, 0.75, 5);
        }}
      />
      <Words text="Write the algorithm." f={f} at={16} out={58} x={120} y={110} size={92} />
      <Words text="Watch it think." f={f} at={74} out={C2S_DUR - 6} x={120} y={110} size={92} />
      <Vignette strength={0.5} />
      <Grain opacity={0.1} blend="screen" />
    </AbsoluteFill>
  );
};
export { WHITE, MONO };

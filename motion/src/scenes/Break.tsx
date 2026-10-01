import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, E, clamp, ip, lerp, noise1, rng } from '../lib/core';
import { Canvas2D, Grain, bloom } from '../lib/fx';
import { useImage } from '../lib/assets';
import { symbol } from '../lib/brand';
import { bg, floor } from './viz/kit';
import { lookAt } from '../lib/core';

export const BREAK_DUR = 36;
type Shard = { pts: [number, number][]; cx: number; cy: number; d: number; vx: number; vy: number; rot: number; seed: number };

/** find the orange dot in the frozen wall frame (it's the only orange thing) */
const findDot = (img: HTMLImageElement) => {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 270;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, 480, 270);
  const d = x.getImageData(0, 0, 480, 270).data;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 200 && d[i + 1] < 140 && d[i + 2] < 110) {
      const p = i / 4;
      sx += p % 480;
      sy += Math.floor(p / 480);
      n++;
    }
  }
  return n ? [(sx / n) * 4, (sy / n) * 4] : [960, 540];
};

export const Break: React.FC = () => {
  const f = useCurrentFrame();
  const img = useImage('tex/wall.png');
  const geo = useMemo(() => {
    if (!img) return null;
    const [dx, dy] = findDot(img);
    const R = rng(77);
    const rings = 13, secs = 15;
    const V: [number, number][][] = [];
    for (let k = 0; k <= rings; k++) {
      const row: [number, number][] = [];
      for (let s = 0; s < secs; s++) {
        const r = 26 * Math.pow(1.5, k) * (k ? 0.85 + R() * 0.3 : 1);
        const a = ((s + (k ? (R() - 0.5) * 0.6 : 0)) / secs) * Math.PI * 2;
        row.push([dx + Math.cos(a) * r, dy + Math.sin(a) * r]);
      }
      V.push(row);
    }
    const shards: Shard[] = [];
    for (let k = 0; k < rings; k++)
      for (let s = 0; s < secs; s++) {
        const s2 = (s + 1) % secs;
        const pts = [V[k][s], V[k][s2], V[k + 1][s2], V[k + 1][s]];
        const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cy = pts.reduce((a, p) => a + p[1], 0) / 4;
        const d = Math.hypot(cx - dx, cy - dy);
        shards.push({ pts, cx, cy, d, vx: (cx - dx) / (d || 1), vy: (cy - dy) / (d || 1), rot: (R() - 0.5) * 2, seed: R() });
      }
    return { dx, dy, shards };
  }, [img]);
  // aperture radius: the dot opens into a ring that tears the page
  const R = f < 6 ? 0 : 30 * Math.exp((f - 6) * 0.25);
  const shake = f < 7 ? noise1(f * 3, 1) * f * 1.4 : 0;
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <Canvas2D
        draw={(ctx) => {
          if (!img || !geo) return;
          const { dx, dy, shards } = geo;
          // 1. the void behind, already the AQVL world
          bg(ctx);
          const cam = lookAt([0, 3, 12 - f * 0.08], [0, 0, -10], 60);
          floor(ctx, cam, -2, 30, 1.2, 0.16 * clamp(f / 20));
          // 2. paper, minus released shards
          const zoom = 1 + ip(f, 0, 6, 0, 0.04, E.in);
          ctx.save();
          ctx.translate(dx + shake, dy);
          ctx.scale(zoom, zoom);
          ctx.translate(-dx, -dy);
          ctx.beginPath();
          ctx.rect(-50, -50, 2020, 1180);
          for (const s of shards) {
            if (s.d < R * 0.95) {
              ctx.moveTo(s.pts[0][0], s.pts[0][1]);
              for (let i = 3; i >= 1; i--) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
              ctx.closePath();
            }
          }
          if (R > 28) {
            ctx.moveTo(dx + 27, dy);
            ctx.arc(dx, dy, 27, 0, Math.PI * 2);
          }
          ctx.clip('evenodd');
          ctx.drawImage(img, 0, 0, 1920, 1080);
          ctx.restore();
          // 3. flying shards (towards camera, outward, spinning)
          for (const s of shards) {
            if (s.d >= R * 0.95) continue;
            const relT = Math.log(Math.max(R * 0.95, 1) / Math.max(s.d, 18)) / 0.23; // frames since release
            if (relT > 12) continue;
            const k = relT / 12;
            const sc = 1 + k * k * 4;
            const mx = s.cx + s.vx * (relT * 30 + relT * relT * 6), my = s.cy + s.vy * (relT * 30 + relT * relT * 6) + relT * relT * 1.5;
            ctx.save();
            ctx.globalAlpha = clamp(1 - k * 0.9);
            ctx.translate(mx, my);
            ctx.rotate(s.rot * relT * 0.08);
            ctx.scale(sc, sc * (1 - 0.5 * Math.abs(Math.sin(relT * 0.2 + s.seed * 6))));
            ctx.translate(-s.cx, -s.cy);
            ctx.beginPath();
            ctx.moveTo(s.pts[0][0], s.pts[0][1]);
            for (let i = 1; i < 4; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
            ctx.closePath();
            ctx.save();
            ctx.clip();
            ctx.drawImage(img, 0, 0, 1920, 1080);
            ctx.restore();
            ctx.strokeStyle = `rgba(255,236,220,${0.8 * (1 - k)})`;
            ctx.lineWidth = 2 / sc;
            ctx.stroke();
            ctx.restore();
          }
          // 4. the aperture: the AQVL ring of light at the tear's edge, its point still burning
          if (R > 0) {
            // the symbol itself is the aperture: its outer edge rides the tear
            const S = symbol(dx, dy, R * 2.05);
            const a = clamp(1 - (R - 900) / 2200);
            ctx.save();
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(255,190,150,0.9)';
            ctx.shadowBlur = 60;
            ctx.strokeStyle = `rgba(246,243,238,${a})`;
            ctx.lineWidth = S.W;
            ctx.beginPath();
            ctx.arc(dx, dy, S.rc, (S.a0 * Math.PI) / 180, (S.a1 * Math.PI) / 180);
            ctx.stroke();
            ctx.fillStyle = `rgba(255,91,46,${a})`;
            ctx.beginPath();
            ctx.arc(S.dot[0], S.dot[1], S.dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            // pre-break heartbeat on the dot
            const p = 1 + 0.35 * Math.max(0, Math.sin((f / 6) * Math.PI));
            ctx.fillStyle = C.hot;
            ctx.beginPath();
            ctx.arc(dx, dy, 15 * p, 0, Math.PI * 2);
            ctx.fill();
          }
                    // flash at the rupture
          const fl = ip(f, 6, 7, 0, 1) * ip(f, 7, 12, 1, 0);
          if (fl > 0) {
            ctx.fillStyle = `rgba(255,236,225,${0.18 * fl})`;
            ctx.fillRect(0, 0, 1920, 1080);
          }
        }}
      />
      <Grain opacity={0.12} blend="screen" />
    </AbsoluteFill>
  );
};
export { lerp };

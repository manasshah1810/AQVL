import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {MARK, markPath, markPoints, STROKE, wordmark, WM} from '../brand/geometry';
import {chalk, pointAt, Pt} from '../film/draw2d';
import {hookScribble} from '../film/content';
import {T} from '../film/timeline';
import {clamp, easeIn, lerp, SETTLE, SNAP, spring} from '../lib/motion';
import {PEACH} from '../lib/palette';
import {SnapText} from './Tagline';

// Full circle: the opening chalk scribble resolves, point by point on
// staggered springs, into the AQVL mark; the wordmark snaps in beside it.
const N = 700;
export const R = {
  draw0: T.resolve + 0.55,
  draw1: T.resolve + 1.05,
  morph: T.resolve + 1.35,
  slide: T.resolve + 2.55,
  word: T.resolve + 2.7,
  tag: T.resolve + 3.45,
};

export const Resolve: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const ref = useRef<HTMLCanvasElement>(null);
  const off = useMemo(() => {
    const a = document.createElement('canvas');
    a.width = width;
    a.height = height;
    const b = document.createElement('canvas');
    b.width = width;
    b.height = height;
    return {a, b};
  }, [width, height]);
  const geo = useMemo(() => {
    const scr = hookScribble();
    // even arclength samples of the scribble
    const L: number[] = [0];
    for (let i = 1; i < scr.length; i++) L.push(L[i - 1] + Math.hypot(scr[i][0] - scr[i - 1][0], scr[i][1] - scr[i - 1][1]));
    const src: Pt[] = [];
    for (let i = 0; i < N; i++) src.push(pointAt(scr, i / (N - 1)));
    const {pts: dst} = markPoints(N);
    void L;
    return {src, dst};
  }, []);

  const s = width / 1920;
  const S = 2.4 * s; // px per mark unit
  const wm = useMemo(() => wordmark(), []);
  const lockW = (130 + wm.width * 0.62) * S;
  const oy = 486 * s - 44 * S;
  const xLock = (width - lockW) / 2;
  const xAlone = width / 2 - 52 * S;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    if (t < T.resolve) return;
    const lc = off.a.getContext('2d')!;
    lc.clearRect(0, 0, width, height);
    const slide = clamp(spring(t - R.slide, SETTLE), 0, 1.2);
    const ox = lerp(xAlone, xLock, slide);
    const toPx = ([x, y]: Pt): Pt => [ox + x * S, oy + y * S];
    // scribble in "board" space mapped around the mark circle
    const k = 0.125;
    const scrPx = (p: Pt): Pt => toPx([MARK.cx + (p[0] - 560) * k, MARK.cy + (p[1] - 900) * k * 1.1]);

    const drawP = easeIn(clamp((t - R.draw0) / (R.draw1 - R.draw0))) * 0.85 + clamp((t - R.draw0) / (R.draw1 - R.draw0)) * 0.15;
    const m = clamp((t - R.morph) / 0.9);
    const pts: Pt[] = geo.src.map((p, i) => {
      const f = i / (N - 1);
      const u = spring(t - R.morph - f * 0.42, SETTLE);
      const a = scrPx(p);
      const b = toPx(geo.dst[i]);
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    });
    const markGrad = () => {
      const g = lc.createLinearGradient(0, oy + 10 * S, 0, oy + 80 * S);
      g.addColorStop(0, '#f7dccb');
      g.addColorStop(0.45, PEACH);
      g.addColorStop(1, '#d8a689');
      return g;
    };
    // chalk phase
    if (m < 1 && t >= R.draw0) {
      chalk(lc, pts, t < R.morph ? drawP : 1, lerp(15 * s, STROKE * S, m), '#f3e3d6', 4242, 1 - m);
    }
    // crisp phase
    if (m > 0) {
      lc.save();
      lc.globalAlpha = clamp(m * 1.6);
      lc.lineWidth = lerp(15 * s, STROKE * S, clamp(m * 1.3));
      lc.lineCap = 'butt';
      lc.lineJoin = 'round';
      lc.strokeStyle = markGrad();
      lc.shadowColor = `${PEACH}66`;
      lc.shadowBlur = 34 * s;
      if (m >= 1 && t > R.morph + 1.4) {
        lc.translate(ox, oy);
        lc.scale(S, S);
        lc.lineWidth = STROKE;
        lc.shadowBlur = 34 * s;
        lc.stroke(new Path2D(markPath()));
      } else {
        lc.beginPath();
        pts.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y)));
        lc.stroke();
      }
      lc.restore();
    }
    // wordmark
    wm.parts.forEach((p, i) => {
      const a = spring(t - R.word - i * 0.075, SNAP);
      if (a <= 0) return;
      lc.save();
      const gx = ox + (130 + p.x * 0.62) * S;
      const gy = oy + (74 - WM.cap * 0.62) * S;
      const cxL = gx + 25 * 0.62 * S;
      const cyL = gy + 30 * 0.62 * S;
      lc.globalAlpha = clamp(a * 1.5);
      lc.translate(cxL, cyL + (1 - a) * 26 * s);
      lc.scale(0.62 * S * (0.75 + 0.25 * a), 0.62 * S * (0.75 + 0.25 * a));
      lc.translate(-25, -30);
      lc.lineWidth = WM.stroke;
      lc.lineCap = 'butt';
      lc.lineJoin = 'miter';
      lc.strokeStyle = PEACH;
      lc.shadowColor = `${PEACH}55`;
      lc.shadowBlur = 22 * s;
      lc.stroke(new Path2D(p.d));
      lc.restore();
    });
    // floor reflection: the lockup mirrored about its baseline, fading out
    const base = oy + (MARK.cy + MARK.r) * S + (STROKE / 2) * S;
    const rc = off.b.getContext('2d')!;
    rc.clearRect(0, 0, width, height);
    rc.save();
    rc.globalCompositeOperation = 'source-over';
    rc.translate(0, base * 2);
    rc.scale(1, -1);
    rc.drawImage(off.a, 0, 0);
    rc.restore();
    rc.save();
    rc.globalCompositeOperation = 'destination-in';
    const fg = rc.createLinearGradient(0, base, 0, base + 120 * s);
    fg.addColorStop(0, 'rgba(0,0,0,1)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    rc.fillStyle = fg;
    rc.fillRect(0, base, width, height - base);
    rc.fillStyle = 'rgba(0,0,0,0)';
    rc.clearRect(0, 0, width, base);
    rc.restore();
    ctx.save();
    ctx.globalAlpha = 0.16 * clamp(m);
    ctx.filter = `blur(${2.5 * s}px)`;
    ctx.drawImage(off.b, 0, 0);
    ctx.restore();
    ctx.drawImage(off.a, 0, 0);
  }, [t, width, height, geo, off, wm, S, oy, xAlone, xLock, s]);

  if (t < T.resolve) return null;
  return (
    <>
      <canvas ref={ref} width={width} height={height} style={{position: 'absolute', inset: 0, width, height}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 700 * s, display: 'flex', justifyContent: 'center'}}>
        <SnapText text="Algorithms you can watch." t0={R.tag} size={30} step={0.025} opacity={0.85} tracking="0.02em" weight={400} />
      </div>
    </>
  );
};

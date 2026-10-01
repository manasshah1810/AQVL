import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { H, W, hash } from './core';

export const Canvas2D: React.FC<{ draw: (ctx: CanvasRenderingContext2D) => void; style?: React.CSSProperties }> = ({ draw, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    draw(ctx);
  });
  return <canvas data-f={frame} ref={ref} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, ...style }} />;
};

let bloomCanvas: HTMLCanvasElement | null = null;
/** cheap bloom: downsample, blur, add back */
export const bloom = (ctx: CanvasRenderingContext2D, strength = 0.8, radius = 6, scale = 4) => {
  if (!bloomCanvas) bloomCanvas = document.createElement('canvas');
  const bw = W / scale, bh = H / scale;
  bloomCanvas.width = bw;
  bloomCanvas.height = bh;
  const b = bloomCanvas.getContext('2d')!;
  b.clearRect(0, 0, bw, bh);
  b.filter = `blur(${radius}px)`;
  b.drawImage(ctx.canvas, 0, 0, bw, bh);
  b.filter = 'none';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.drawImage(bloomCanvas, 0, 0, W, H);
  ctx.restore();
};

export const Grain: React.FC<{ opacity?: number; blend?: React.CSSProperties['mixBlendMode'] }> = ({ opacity = 0.18, blend = 'overlay' }) => {
  const f = useCurrentFrame();
  const v = f % 2;
  const ox = Math.floor(hash(f * 1.3) * 300), oy = Math.floor(hash(f * 7.7 + 3) * 260);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', mixBlendMode: blend, opacity }}>
      <Img src={staticFile(`tex/grain${v}.png`)} style={{ position: 'absolute', left: -ox, top: -oy, width: 2240, height: 1360 }} />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number; color?: string }> = ({ strength = 0.55, color = '0,0,0' }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(${color},0) 55%, rgba(${color},${strength}) 100%)`,
    }}
  />
);

/** horizontal/vertical motion blur via SVG filter; returns css filter value */
export const MotionBlurDefs: React.FC<{ id: string; x: number; y?: number }> = ({ id, x, y = 0 }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <defs>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${Math.max(0.01, x)} ${Math.max(0.01, y)}`} edgeMode="duplicate" />
      </filter>
    </defs>
  </svg>
);

/** whole-frame camera transform wrapper */
export const Cam2D: React.FC<{ x?: number; y?: number; s?: number; r?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x = 0,
  y = 0,
  s = 1,
  r = 0,
  children,
  style,
}) => (
  <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`, transformOrigin: '50% 50%', ...style }}>{children}</AbsoluteFill>
);

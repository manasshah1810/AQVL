import React, { useMemo } from 'react';
import { Penguin, type PenguinPose } from './Penguin';

/** A small deterministic generator, so the snow is the same every render (no hydration-style flicker). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Snow drifting down behind the page (penguin world only; hidden by CSS in
 * every other world, under reduced motion and when switched off in
 * Settings). A few dozen dots, each on its own slow fall.
 */
export function WorldSnow({ count = 34 }: { count?: number }) {
  const flakes = useMemo(() => {
    const r = rng(2024);
    return Array.from({ length: count }, () => ({
      x: `${(r() * 100).toFixed(1)}%`,
      s: `${(2 + r() * 3.2).toFixed(1)}px`,
      o: (0.35 + r() * 0.5).toFixed(2),
      d: `${(14 + r() * 18).toFixed(1)}s`,
      delay: `${(-r() * 30).toFixed(1)}s`,
      drift: `${((r() - 0.5) * 140).toFixed(0)}px`,
    }));
  }, [count]);
  return (
    <div className="world-snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <i key={i} style={{ '--x': f.x, '--s': f.s, '--o': f.o, '--d': f.d, '--delay': f.delay, '--drift': f.drift } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** A penguin that belongs to the penguin world only: it is simply absent in the others (and when mascots are off). */
export function Mascot({ pose = 'stand', size = 64, className = '', scarf }: { pose?: PenguinPose | 'walk'; size?: number; className?: string; scarf?: [string, string] | null }) {
  return (
    <span className={`mascot mascot--penguin-only inline-block ${className}`} aria-hidden="true">
      <Penguin size={size} pose={pose as PenguinPose} scarf={scarf} className={pose === 'walk' ? 'pen--walk' : undefined} />
    </span>
  );
}

/** Two penguins that wander the length of the footer's baseline, one each way, now and then. */
export function FooterIce() {
  return (
    <div className="footer-ice mascot mascot--penguin-only" aria-hidden="true">
      <div className="footer-ice__walker">
        <Penguin size={34} pose="stand" className="pen--walk" />
      </div>
      <div className="footer-ice__walker footer-ice__walker--back">
        <Penguin size={26} pose="stand" scarf={['#2f5d9e', '#f2c14e']} className="pen--walk" />
      </div>
    </div>
  );
}

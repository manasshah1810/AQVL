import React, { useMemo } from 'react';
import { Penguin, type PenguinPose } from './Penguin';
import { BambooStalk, Panda, type PandaPose } from './Panda';
import { useWorld } from '../../lib/world';

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

/**
 * Bamboo leaves drifting down behind the page (panda world only; hidden by
 * CSS in every other world, under reduced motion and when switched off in
 * Settings). A couple of dozen leaves, each on its own slow, swaying fall.
 */
export function WorldLeaves({ count = 22 }: { count?: number }) {
  const leaves = useMemo(() => {
    const r = rng(1618);
    return Array.from({ length: count }, () => ({
      x: `${(r() * 100).toFixed(1)}%`,
      s: `${(11 + r() * 9).toFixed(0)}px`,
      o: (0.35 + r() * 0.4).toFixed(2),
      d: `${(18 + r() * 20).toFixed(1)}s`,
      delay: `${(-r() * 38).toFixed(1)}s`,
      drift: `${((r() - 0.5) * 220).toFixed(0)}px`,
      spin: `${(r() < 0.5 ? -1 : 1) * (200 + r() * 260) | 0}deg`,
      tint: Math.floor(r() * 3),
    }));
  }, [count]);
  return (
    <div className="world-leaves" aria-hidden="true">
      {leaves.map((l, i) => (
        <i key={i} data-tint={l.tint} style={{ '--x': l.x, '--s': l.s, '--o': l.o, '--d': l.d, '--delay': l.delay, '--drift': l.drift, '--spin': l.spin } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** The site's falling decoration for the current world: snow on the ice, leaves in the grove, nothing in the studio. */
export function WorldFall() {
  const world = useWorld();
  if (world === 'penguin') return <WorldSnow />;
  if (world === 'panda') return <WorldLeaves />;
  if (world === 'rabbit') return <WorldClouds />;
  return null;
}

/**
 * The world's mascot: a penguin on the ice, a panda in the grove, and
 * nobody in the studio (it is simply absent there, and when mascots are off).
 */
export function Mascot({ pose = 'stand', size = 64, className = '', scarf }: { pose?: PenguinPose | PandaPose | 'walk'; size?: number; className?: string; scarf?: [string, string] | null }) {
  const world = useWorld();
  if (world === 'panda') {
    const p: PandaPose = pose === 'slide' ? 'roll' : (pose as PandaPose);
    return (
      <span className={`mascot mascot--panda inline-block ${className}`} aria-hidden="true">
        <Panda size={size} pose={p} />
      </span>
    );
  }
  if (world === 'penguin') {
    return (
      <span className={`mascot mascot--penguin inline-block ${className}`} aria-hidden="true">
        <Penguin size={size} pose={(pose === 'eat' || pose === 'roll' ? 'stand' : pose) as PenguinPose} scarf={scarf} className={pose === 'walk' ? 'pen--walk' : undefined} />
      </span>
    );
  }
  if (world === 'rabbit') {
    return (
      <span className="mascot mascot--rabbit inline-block" aria-hidden="true">
        <Bunny size={size} />
      </span>
    );
  }
  return null;
}

/** The footer's baseline: frozen ice with two penguins wandering along it, or a grassy bank with bamboo shoots and two pandas. */
export function FooterIce() {
  const world = useWorld();
  if (world === 'panda') {
    return (
      <div className="footer-grove mascot" aria-hidden="true">
        <div className="footer-grove__shoots">
          {[3, 11, 24, 38, 57, 71, 83, 94].map((x, i) => (
            <span key={x} style={{ left: `${x}%`, '--h': `${20 + ((i * 7) % 5) * 5}px`, '--d': `${4 + (i % 3)}s` } as React.CSSProperties}>
              <BambooStalk height={20 + ((i * 7) % 5) * 5} />
            </span>
          ))}
        </div>
        <div className="footer-grove__walker">
          <Panda size={34} pose="walk" />
        </div>
        <div className="footer-grove__walker footer-grove__walker--back">
          <Panda size={26} pose="eat" />
        </div>
      </div>
    );
  }
  if (world !== 'penguin') return null;
  return (
    <div className="footer-ice mascot" aria-hidden="true">
      <div className="footer-ice__walker">
        <Penguin size={34} pose="stand" className="pen--walk" />
      </div>
      <div className="footer-ice__walker footer-ice__walker--back">
        <Penguin size={26} pose="stand" scarf={['#2f5d9e', '#f2c14e']} className="pen--walk" />
      </div>
    </div>
  );
}

/** Clouds drifting across, and a few blossom sparkles, behind the page (rabbit world only; hidden by CSS elsewhere). */
export function WorldClouds({ count = 7 }: { count?: number }) {
  const items = useMemo(() => {
    const r = rng(777);
    return {
      clouds: Array.from({ length: count }, () => ({
        y: `${(4 + r() * 78).toFixed(0)}%`,
        s: `${(110 + r() * 150).toFixed(0)}px`,
        o: (0.14 + r() * 0.22).toFixed(2),
        d: `${(70 + r() * 70).toFixed(0)}s`,
        delay: `${(-r() * 120).toFixed(0)}s`,
      })),
      sparks: Array.from({ length: 12 }, () => ({
        x: `${(r() * 100).toFixed(0)}%`,
        y: `${(r() * 100).toFixed(0)}%`,
        delay: `${(-r() * 5).toFixed(1)}s`,
      })),
    };
  }, [count]);
  return (
    <div className="world-clouds" aria-hidden="true">
      {items.clouds.map((c, i) => (
        <i key={i} style={{ '--y': c.y, '--s': c.s, '--o': c.o, '--d': c.d, '--delay': c.delay } as React.CSSProperties} />
      ))}
      {items.sparks.map((s, i) => (
        <b key={i} style={{ '--x': s.x, '--y': s.y, '--delay': s.delay } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** The cloud kingdom's mascot: a small bunny. */
export function Bunny({ size = 64 }: { size?: number }) {
  return (
    <svg className="bny" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g className="bny__body">
        <ellipse className="bny__ear" cx="23" cy="14" rx="5" ry="13" fill="#f7efe2" />
        <ellipse className="bny__ear bny__ear--r" cx="41" cy="14" rx="5" ry="13" fill="#f7efe2" />
        <ellipse cx="23" cy="15" rx="2.4" ry="8" fill="#ffb3c8" />
        <ellipse cx="41" cy="15" rx="2.4" ry="8" fill="#ffb3c8" />
        <ellipse cx="32" cy="50" rx="17" ry="12" fill="#f7efe2" />
        <circle cx="32" cy="34" r="14" fill="#f7efe2" />
        <circle cx="26.5" cy="32" r="1.8" fill="#2b2546" />
        <circle cx="37.5" cy="32" r="1.8" fill="#2b2546" />
        <ellipse cx="32" cy="37" rx="2.2" ry="1.6" fill="#ff8fb1" />
        <circle cx="22" cy="37" r="2.6" fill="#ffb3c8" opacity="0.6" />
        <circle cx="42" cy="37" r="2.6" fill="#ffb3c8" opacity="0.6" />
      </g>
    </svg>
  );
}

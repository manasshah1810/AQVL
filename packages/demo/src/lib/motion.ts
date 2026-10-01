import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'motion/react';

/**
 * Spring presets. Every UI movement on the site uses one of these; nothing
 * animates on a linear or default ease. Values are stiffness/damping/mass
 * tuned by eye at 60fps.
 */
export const spring = {
  /** Hover states, small nudges. Quick, no visible overshoot. */
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  /** Layout morphs: nav indicator, tab underline, panels resizing. */
  layout: { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 },
  /** Larger surfaces entering: modals, page content. Calm settle. */
  gentle: { type: 'spring', stiffness: 140, damping: 22, mass: 1 },
  /** Playful, used once per screen at most (logo, loader marks). */
  lively: { type: 'spring', stiffness: 260, damping: 16, mass: 0.8 },
} satisfies Record<string, Transition>;

/** Delay for item `i` of `n` in a wave that rises and falls, rather than a flat ripple. */
export function waveDelay(i: number, n: number, span = 0.36, base = 0) {
  if (n <= 1) return base;
  const t = i / (n - 1);
  // ease-in-out so the middle of the wave moves fastest
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return base + eased * span;
}

/** Linear stagger, capped so long lists never feel slow. */
export function stagger(i: number, step = 0.045, cap = 0.6) {
  return Math.min(i * step, cap);
}

/** Variants for a parent whose children wave in. */
export const waveParent: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const riseChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: spring.gentle },
};

const QUERY = '(prefers-reduced-motion: reduce)';

function readReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/** True when the visitor asked for reduced motion. Live-updates. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReduced);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export function prefersReducedMotion() {
  return readReduced();
}

function readMedia(query: string) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** Live boolean for any media query. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => readMedia(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/** Wide screen with motion allowed: where pinned, scrubbed sequences run. */
export const SCROLL_STAGE = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';

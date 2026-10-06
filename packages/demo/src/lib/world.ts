import { useSyncExternalStore } from 'react';
import { isStageWorld, type StageWorld } from '@aqvl/renderer';
import { prefersReducedMotion } from './motion';

/**
 * The site's world: which of the three 3D themes (the plain studio, the
 * penguins' ice shelf, the pandas' grove) the visitor chose. It names the
 * 3D stage, and, through `data-world` on <html>, themes the whole site
 * (the penguin world adds ice, snow and mascots to every page; see
 * styles/world-penguin.css). index.html sets the attribute before first
 * paint from the stored choice.
 */
export type World = StageWorld;

/** The key the visualizer has always stored its world under, so earlier choices carry over. */
const KEY = 'aqvl-stage-world';
const META_COLOR: Record<World, { dark: string; light: string }> = {
  studio: { dark: '#1E1C27', light: '#F7EFE9' },
  penguin: { dark: '#0C1A2B', light: '#F1F7FC' },
  panda: { dark: '#1E1C27', light: '#F7EFE9' },
};
const listeners = new Set<() => void>();

export function getWorld(): World {
  if (typeof document === 'undefined') return 'studio';
  const v = document.documentElement.getAttribute('data-world');
  return isStageWorld(v) ? v : 'studio';
}

function apply(world: World) {
  const root = document.documentElement;
  root.setAttribute('data-world', world);
  const dark = root.getAttribute('data-theme') !== 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[world][dark ? 'dark' : 'light']);
  try {
    localStorage.setItem(KEY, world);
  } catch {
    /* the choice just won't persist */
  }
  listeners.forEach((l) => l());
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Changes the world. With an origin point and motion allowed, the new
 * world is revealed as a growing circle from that point (like the light /
 * dark switch).
 */
export function setWorld(world: World, origin?: { x: number; y: number }) {
  if (world === getWorld()) return;
  const doc = document as ViewTransitionDoc;
  if (!origin || !doc.startViewTransition || prefersReducedMotion()) {
    apply(world);
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const vt = doc.startViewTransition(() => apply(world));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
}

/** Re-applies the theme-colour meta after the light / dark mode changes. */
export function syncWorldMeta() {
  const world = getWorld();
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[world][dark ? 'dark' : 'light']);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useWorld(): World {
  return useSyncExternalStore(subscribe, getWorld, () => 'studio');
}

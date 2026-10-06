import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './motion';
import { syncWorldMeta } from './world';

/**
 * Site theme. index.html sets data-theme on <html> before first paint (stored
 * choice, else the OS preference, else dark); this module reads and changes it.
 */
export type Theme = 'dark' | 'light';

const KEY = 'aqvl-theme';
const META_COLOR: Record<Theme, string> = { dark: '#1E1C27', light: '#F7EFE9' };
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
  syncWorldMeta();
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* the choice just won't persist */
  }
  listeners.forEach((l) => l());
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Switches theme. With an origin point (the toggle's centre) and motion
 * allowed, the new theme is revealed as a growing circle from that point.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDoc;
  if (!origin || !doc.startViewTransition || prefersReducedMotion()) {
    apply(theme);
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const vt = doc.startViewTransition(() => apply(theme));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark');
}

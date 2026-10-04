import { useSyncExternalStore } from 'react';

/**
 * Hash routing. The site is served from GitHub Pages under /AQVL/, so every
 * route lives in the hash: #/docs, #/playground?example=<id>, #/docs/graphs.
 * A bare hash without a leading slash (#top) is an in-page anchor on the
 * landing page, not a route.
 */
export type RouteName =
  | 'landing'
  | 'engine'
  | 'docs'
  | 'examples'
  | 'playground'
  | 'ide'
  | 'privacy'
  | 'tasks'
  | 'developer'
  | 'rs'
  | 'notfound';

export interface Route {
  name: RouteName;
  /** Path segments after the route name, e.g. ['graphs'] for #/docs/graphs. */
  rest: string[];
  params: URLSearchParams;
}

const NAMES: Record<string, RouteName> = {
  engine: 'engine',
  docs: 'docs',
  examples: 'examples',
  playground: 'playground',
  ide: 'ide',
  privacy: 'privacy',
  tasks: 'tasks',
  developer: 'developer',
  rs: 'rs',
};

export function parseHash(hash: string): Route {
  if (!hash.startsWith('#/')) return { name: 'landing', rest: [], params: new URLSearchParams() };
  const body = hash.slice(2);
  const [path, query = ''] = body.split('?');
  const segments = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (segments.length === 0) return { name: 'landing', rest: [], params };
  const name = NAMES[segments[0]] ?? 'notfound';
  return { name, rest: segments.slice(1), params };
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;

/** The raw current hash; re-renders on every hashchange. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash, () => '');
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

export function navigate(path: string) {
  window.location.hash = href(path).slice(1);
}

/** Updates the hash without emitting hashchange (no route transition). */
export function replaceHash(path: string) {
  const url = `${window.location.pathname}${window.location.search}${href(path)}`;
  window.history.replaceState(window.history.state, '', url);
}

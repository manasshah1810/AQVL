import * as animeModule from 'animejs';
import type { AnimeInstance, AnimeParams, AnimeTimelineInstance } from 'animejs';

/** anime.js v3 (the version the runtime and renderer already use), ESM/CJS-interop safe. */
type AnimeStatic = {
  (params: AnimeParams): AnimeInstance;
  timeline: (params?: AnimeParams) => AnimeTimelineInstance;
  stagger: (value: number | string | [number, number], options?: Record<string, unknown>) => (el: unknown, i: number, total: number) => number;
  setDashoffset: (el: SVGElement) => number;
  remove: (targets: unknown) => void;
};

export const anime = ((animeModule as unknown as { default?: AnimeStatic }).default ?? (animeModule as unknown as AnimeStatic)) as AnimeStatic;

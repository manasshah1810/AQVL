/** Palette as constants, for SVG/canvas attributes where CSS variables do not resolve. */
export const C = {
  ink: '#1E1C27',
  inkDeep: '#17151F',
  peach: '#EBC0A3',
  peachMuted: '#C4A290',
  panel: '#3A3649',
  panelRaised: '#433F54',
  dusk: '#666379',
  duskDeep: '#57546A',
  cream: '#F5D8C6',
  line: 'rgba(235,192,163,0.18)',
  lineStrong: 'rgba(235,192,163,0.34)',
} as const;

/**
 * The one neon, reserved for the 3D viewport frame (the "active node" colour
 * from the launch film). Never used in text, chrome or loaders.
 */
export const VIEWPORT_NEON = '#3FF6DC';

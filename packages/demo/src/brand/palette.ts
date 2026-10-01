/**
 * Palette as CSS variable references, for SVG attributes and inline styles.
 * They resolve per theme (index.css defines dark and light values).
 */
export const C = {
  ink: 'var(--ink)',
  inkDeep: 'var(--ink-deep)',
  peach: 'var(--peach)',
  peachMuted: 'var(--peach-muted)',
  panel: 'var(--panel)',
  panelRaised: 'var(--panel-raised)',
  dusk: 'var(--dusk)',
  duskDeep: 'var(--dusk-deep)',
  cream: 'var(--cream)',
  /** Text drawn on a dusk fill; light in both themes. */
  onDusk: 'var(--on-dusk)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',
} as const;

/**
 * The one neon, reserved for the 3D viewport frame (the "active node" colour
 * from the launch film). Never used in text, chrome or loaders.
 */
export const VIEWPORT_NEON = '#3FF6DC';

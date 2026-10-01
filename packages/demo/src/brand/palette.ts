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

/*
 * The one neon (#3FF6DC, the "active node" colour from the launch film) now
 * lives only inside the 3D scene, where it is reserved for the single most
 * important event: a value changing. See packages/renderer/src/stage/look/palette.ts.
 */

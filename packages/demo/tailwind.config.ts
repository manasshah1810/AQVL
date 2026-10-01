import type { Config } from 'tailwindcss';

/**
 * AQVL design tokens. The palette is fixed (70/30): nothing outside these
 * hues is used in the website chrome. The same values live as CSS variables
 * in src/styles/tokens.css so hand-written CSS and utilities agree.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1E1C27', // base background, ~70%
          deep: '#17151F', // shade: recessed wells (code, editor)
        },
        peach: {
          DEFAULT: '#ebc0a3', // primary text + hairlines
          muted: '#C4A290', // shade: secondary text (AA on ink and panel)
        },
        panel: {
          DEFAULT: '#3A3649', // flat secondary panels
          raised: '#433F54', // tint: hovered panel
        },
        dusk: {
          DEFAULT: '#666379', // accent 1: fills, active indicators
          deep: '#57546A', // shade: text-bearing fills (AA with cream)
        },
        cream: '#F5D8C6', // accent 2: hover, highlight, key moments
      },
      fontFamily: {
        serif: ['"Newsreader Variable"', 'Newsreader', 'serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        ctl: '2px',
        panel: '10px',
      },
      maxWidth: {
        page: '1320px',
      },
    },
  },
} satisfies Config;

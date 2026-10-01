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
      // Values live in src/index.css as CSS variables, one set per theme.
      // Dark: ink #1E1C27, peach #ebc0a3, panel #3A3649, dusk #666379, cream #F5D8C6.
      colors: {
        ink: {
          DEFAULT: 'var(--ink)', // base background, ~70%
          deep: 'var(--ink-deep)', // recessed wells (code, editor)
        },
        peach: {
          DEFAULT: 'var(--peach)', // primary text + hairlines
          muted: 'var(--peach-muted)', // secondary text (AA on ink and panel)
        },
        panel: {
          DEFAULT: 'var(--panel)', // flat secondary panels
          raised: 'var(--panel-raised)',
        },
        dusk: {
          DEFAULT: 'var(--dusk)', // accent 1: fills, active indicators
          deep: 'var(--dusk-deep)', // text-bearing fills
        },
        cream: 'var(--cream)', // accent 2: hover, highlight, key moments
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

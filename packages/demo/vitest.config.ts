import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Mirrors the resolve aliases in vite.config.ts. Kept as a separate file
// (rather than merging into vite.config.ts, whose `command`-based factory
// function isn't a plain object vitest's mergeConfig can combine with) so
// `pnpm test` here doesn't depend on which vite build mode is active.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aqvl/compiler': path.resolve(__dirname, '../compiler/src/index.ts'),
      '@aqvl/runtime': path.resolve(__dirname, '../runtime/src/index.ts'),
      '@aqvl/renderer': path.resolve(__dirname, '../renderer/src/index.ts'),
      '@aqvl/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});

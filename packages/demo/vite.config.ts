import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aqvl/compiler': path.resolve(__dirname, '../compiler/src/index.ts'),
      '@aqvl/runtime': path.resolve(__dirname, '../runtime/src/index.ts'),
      '@aqvl/renderer': path.resolve(__dirname, '../renderer/src/index.ts'),
      '@aqvl/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    }
  }
})

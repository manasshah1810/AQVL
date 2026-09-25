import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Coverage glob patterns are matched against absolute, forward-slash paths,
// so build them from an absolute root rather than relying on "../" segments
// resolving correctly against the coverage provider's own cwd.
const repoRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');

export default defineConfig({
  test: {
    include: ['integration/**/*.test.ts', 'unit/**/*.test.ts', 'benchmarks/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Source lives one level above this package's root (../packages), so
      // v8's default root-relative collection needs to be opted out of.
      allowExternal: true,
      // Scoped to the lexer/parser/codegen/VM pipeline this test suite
      // targets, not the renderer/animation subsystems under runtime/src
      // (AnimationController, SceneManager, layouts, ...), which have no
      // tests yet and would otherwise swamp the baseline number below.
      include: [
        `${repoRoot}/packages/compiler/src/**/*.ts`,
        `${repoRoot}/packages/runtime/src/VirtualMachine.ts`,
        `${repoRoot}/packages/runtime/src/types.ts`,
        `${repoRoot}/packages/runtime/src/index.ts`,
      ],
      exclude: [
        '**/*.d.ts',
        `${repoRoot}/packages/**/node_modules/**`,
        // Pure interface/type re-export files with no executable statements
        // — always report as 0%, which isn't a meaningful signal here.
        `${repoRoot}/packages/compiler/src/ast/types.ts`,
      ],
      // Target for the test suite to grow into; current coverage is a
      // baseline (see tests/README.md) so `test:coverage` is not yet
      // expected to pass this gate.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});

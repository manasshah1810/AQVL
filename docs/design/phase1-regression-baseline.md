# Phase 1 Regression Baseline

Recorded 2026-09-29, on a clean `main` working tree (no uncommitted changes), before any Phase 2 refactor work. All commands below were run twice where indicated to check for flakiness; no source, test, or config files were modified while producing this baseline.

## Root test suite (`pnpm test` → `pnpm --filter @aqvl/tests test`, vitest)

The centralized suite lives in `tests/` (package `@aqvl/tests`), not inside the individual `packages/*` directories.

Run 1:
- Test Files: 74 passed (74)
- Tests: 1293 passed, 2 todo (1295 total)
- Duration: 49.81s (vitest-reported), 53.18s (wall clock)

Run 2 (repeated to check flakiness):
- Test Files: 74 passed (74)
- Tests: 1293 passed, 2 todo (1295 total)
- Duration: 32.55s (vitest-reported), 36.95s (wall clock)

Result: identical pass/fail/todo counts across both runs. No flaky tests observed. Two stderr log lines appear during the run but do not cause failures:
- `[ExecutionEngine] execute() failed: DivisionByZeroError: Division by zero.` (VirtualMachine.ts:477) — appears to be an intentional negative-path test assertion.
- `CUSTOM layout: element "b" has no explicit position — rendering at origin (1, 2, 3).` in `unit/customLayout.test.ts` — appears to be an intentional fallback-behavior test assertion.

Coverage output directory: `tests/coverage/` exists on disk with `tests/coverage/compiler/` and `tests/coverage/runtime/` subdirectories (from prior `test:coverage` runs); `test:coverage` was not re-run for this baseline since `test` alone satisfies "run pnpm test."

## Per-package test scripts

Each package also declares its own `test` script, separate from the root `@aqvl/tests` package. These were run individually:

| Package | Script | Result |
|---|---|---|
| `@aqvl/compiler` | `jest` | **BROKEN** — `'jest' is not recognized as an internal or external command`. Jest is not installed for this package (no local `jest` devDependency/binary), so this script cannot run at all. |
| `@aqvl/runtime` | `jest` | **BROKEN** — same failure: `'jest' is not recognized as an internal or external command`. |
| `@aqvl/renderer` | `vitest run` | 13 test files passed (13), 152 tests passed. Duration 16.87s. Numerous non-fatal stderr warnings: `The current testing environment is not configured to support act(...)` and `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` — logged repeatedly across `GenericSceneRenderer.test.tsx` but did not fail any test. |
| `demo` | `vitest run` | 5 test files passed (5), 35 tests passed. Duration 41.81s. |
| `@aqvl/shared` | *(no `test` script defined)* | Not applicable — package.json has no `scripts` block at all. |

Note: the `compiler` and `runtime` packages' `jest` scripts appear to be dead/unused configuration — real coverage for their code is exercised through the root `tests/` suite instead (which is vitest-based), and each package also has a handful of local `*.test.ts` files (compiler: 1, runtime: 0) that are not actually run by any currently-working command.

## Typecheck status per package (`tsc --noEmit`)

| Package | Result |
|---|---|
| `@aqvl/compiler` | **FAIL** (exit code 2) — `src/index.test.ts(52,35): error TS2339: Property 'not' does not exist on type '{ toContain: (expected: string) => void; }'.` |
| `@aqvl/runtime` | PASS (exit code 0, no errors) |
| `@aqvl/renderer` | PASS (exit code 0, no errors) |
| `demo` | PASS (exit code 0, no errors, via `tsc -b --noEmit`) |
| `@aqvl/shared` | Not configured — no `tsconfig.json`, no local `tsc` binary, and no `build`/`test` script defined in `packages/shared/package.json`. Typecheck status cannot be determined as-is. |

## Summary counts

- Root suite (source of truth for "does DSA functionality work"): **1293/1295 tests passing, 2 todo, 0 failing, across 74 files.** Stable across 2 runs.
- Per-package `vitest` suites (renderer + demo): **187/187 passing** (152 + 35), 0 failing.
- Per-package `jest` suites (compiler + runtime): **non-functional**, jest not installed — 0 tests could be collected.
- Typecheck: **3/5 packages clean** (runtime, renderer, demo); **1/5 failing** (compiler, pre-existing `TS2339` in a test file); **1/5 unconfigured** (shared).

No causes are diagnosed and no fixes were attempted, per scope.

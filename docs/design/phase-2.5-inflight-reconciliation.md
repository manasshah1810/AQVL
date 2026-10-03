# Phase 2.5: in-flight work reconciliation

The renderer work first snapshotted in `74a0e79` (BaseCameraChoreographer, `character/`, `code/`, `iteration/`, `linear/`, `shared/src/theme/visualTokens.ts`, `tests/integration/linear-director.test.ts`) was reviewed against the 2.3 decoration-provider seam and the 2.4 generic scene model.

## Findings

- **No second decoration mechanism.** Iteration and linear overlays are registered through `registerDecorationProvider` in `components/decorations/builtinProviders.tsx` (keys `iteration`, `linear`), read from `sceneMetadata`. `GenericSceneRenderer` imports none of them.
- **Linear pointers** use the seam's `claimsConnection` + `renderUnderlay`; node restyling uses `treatNode`. Nothing bypasses `resolveDecorations`.
- **Camera:** `ArrayCameraChoreographer` and `LinearCameraChoreographer` both build on `BaseCameraChoreographer`; no duplicated framing logic.
- **Generic layer:** `pnpm audit:generic` is green; the in-flight work puts no DSA identifiers in `shared/` or `runtime/models`.
- **Nothing orphaned:** every file in the trees above is referenced by a consumer.

## Reusable pattern (for AI/ML, Blockchain)

`tests/integration/linear-director.test.ts` is the template: compile real example source, run it headless through `ExecutionEngine`, attach a director with a fake character, and assert the narration and the element it points at. A new domain adds a director that emits an overlay under its own `sceneMetadata` key, registers a provider, and gets a test of this shape. `GenericSceneRenderer` does not change.

## Verification

Full suite: 83 files, 1701 passed, 2 todo. `linear-director.test.ts`: 3/3.

No code changes were needed; this document is the change.

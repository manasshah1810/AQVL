import type { ModelName } from './types';

/**
 * The 12-phase AQVL roadmap and its Claude Code prompt sequence, carried over
 * verbatim from the "AQVL 12-Phase Roadmap" and "Executable Claude Code Prompt
 * Sequence" documents (2026-09-27). Edit here, not in the UI: this is the seed.
 */

export interface RoadmapStep {
  id: string;
  title: string;
  model: ModelName;
  outcome: string;
  prompt: string;
}

export interface RoadmapPhase {
  number: number;
  title: string;
  summary: string;
  load: string;
  ipd: 'critical' | 'partial' | 'post';
  /** Planned window from the roadmap synthesis timeline; null = post-IPD, unscheduled. */
  window: { start: string; end: string } | null;
  prereq: Omit<RoadmapStep, 'id' | 'title'>;
  steps: RoadmapStep[];
}

export const IPD_DEADLINE = '2027-05-27';

export const ROADMAP: RoadmapPhase[] = [
  {
    number: 1,
    title: 'Verify current DSA functionality actually works',
    summary: 'Diagnostic baseline: suite results, a 220-example corpus audit, and a structure-by-structure claims-vs-implementation ledger that becomes Phase 2\'s scope.',
    load: 'Low-Medium',
    ipd: 'critical',
    window: { start: '2026-09-27', end: '2026-10-11' },
    prereq: {
      model: 'Claude Sonnet 5 Low',
      outcome: 'An accurate picture of test infrastructure and example inventory, with zero code changes.',
      prompt: `You are about to start Phase 1 of the AQVL roadmap: verifying that current DSA functionality actually works, before any centralization refactor begins. Before making any changes, do the following inspection-only pass:
1. Confirm the current git working tree state (git status, git diff --stat) and note any uncommitted changes already present — do not touch, revert, or commit them.
2. Read packages/compiler/src/aqir/generator.ts, packages/runtime/src/core/AnimationController.ts, packages/runtime/src/core/algorithms/AlgorithmRegistry.ts, and docs/design/algorithm-engine-pattern.md to understand the current DSA engine pattern and its documented inconsistencies.
3. Confirm the test suite runs (pnpm test from repo root) and note how it's invoked, how long it takes, and where results are written (e.g. tests/coverage/).
4. Confirm where the example registry lives (packages/demo/src/examples/registry.ts) and how examples are structured (id, category, source).
5. Do NOT modify any source file, test, or config in this step. Do NOT fix anything you find broken — only report it.
Produce a short written summary (in your final message, not a new file) covering: current git state, how to run the test suite, how many examples exist and how they're categorized, and a one-paragraph restatement of the AlgorithmHandler pattern's documented inconsistencies. This summary is the starting context for the sub-phase prompts that follow.`,
    },
    steps: [
      {
        id: '1.1',
        title: 'Regression baseline',
        model: 'Claude Sonnet 5 Low',
        outcome: 'A committed baseline report file with real pass/fail numbers Phase 2 can diff against.',
        prompt: `Objective: Establish a trusted pass/fail baseline for the entire AQVL test suite and type-checking, before Phase 2's refactor begins.
Scope: Run pnpm test from the repo root and the typecheck command for each package (check each package.json's scripts first) across packages/compiler, packages/runtime, packages/renderer, packages/shared, and packages/demo. Capture exact pass/fail/skip counts per package, total test count, and any flaky or intermittently failing tests (run the suite twice if timing allows, to catch flakiness).
Do NOT modify any source code, test file, or configuration. Do NOT attempt to fix any failing or flaky test you find — only record it.
What to test/verify: The full existing suite and typecheck, exactly as configured today, with no changes.
Deliverable: Create a new file docs/design/phase1-regression-baseline.md recording: total tests run, pass/fail/skip counts per package, typecheck status per package, and a list of any flaky/failing tests with a one-line description of the failure. Do not editorialize about causes — just record facts.
Definition of done: The baseline file exists, is accurate against a real run you just performed, and no code changes exist elsewhere.`,
      },
      {
        id: '1.2',
        title: 'Example corpus audit',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A reusable audit script plus a ground-truth ledger of which examples genuinely work end to end.',
        prompt: `Objective: Determine, for every one of the ~220 examples in packages/demo/src/examples/registry.ts, whether it actually compiles and plays a complete scene end to end through the real pipeline — not just whether it compiles.
Scope: Write a new, standalone script (e.g. scripts/audit-examples.ts, following the pattern of the existing scripts/inspect-aqir.ts) that: imports the compiler's compile() function and the runtime's ExecutionEngine in headless mode; iterates every example in the registry; for each one, compiles it, loads it into a headless ExecutionEngine, and runs it to completion (respecting DEFAULT_MAX_EXECUTION_ITERATIONS). Record success, compile error, runtime error, or MaxIterationsExceededError for each example by id.
Do NOT modify any example source, the registry itself, the compiler, or the runtime to make failing examples pass. Do NOT skip examples to make the numbers look better.
What to test/verify: Run the script against all 220 examples. Cross-check a handful of known-good examples (e.g. bubble sort, BST insert) manually to confirm the script's pass/fail logic is correct before trusting the full run.
Deliverable: Commit the script under scripts/, and commit its output as docs/design/phase1-example-corpus-audit.md, listing every example by id with its result (pass / compile-error / runtime-error / iteration-limit) and, for failures, the actual error message.
Definition of done: The script runs deterministically and the audit file reflects a real, complete run over all 220 examples with zero silently skipped entries.`,
      },
      {
        id: '1.3',
        title: 'Claims-vs-implementation ledger',
        model: 'Claude Opus 5.5 Low',
        outcome: 'A source-verified ledger that gives Phase 2 its real scope, rather than relying on the possibly-stale design doc.',
        prompt: `Objective: Produce a structure-by-structure ledger of how each AQVL data structure's algorithm is actually implemented, resolving the gap docs/design/acid-test-report.md already flagged: several structures (BST, Heap, Graph, HashMap, Trie) are opaque TypeScript built-ins invoked by a single keyword, not real user-authored AQVL, which contradicts parts of the README's framing for other categories.
Scope: For every data structure implemented under packages/runtime/src/core/algorithms/ and packages/runtime/src/data-structures/ (Array, Stack, Queue, LinkedList, BST, AVL/RedBlack tree, Graph, Heap, HashMap, Trie, UnionFind), inspect its engine file(s) and record: (a) whether its algorithm is expressible/authored in user-space AQVL or is an opaque built-in reached via one keyword; (b) whether its engine follows the canonical two-layer AlgorithmHandler pattern described in docs/design/algorithm-engine-pattern.md, or one of the three documented drift variants (step-array naming, pure/handler file split, no step-recording at all).
Do NOT modify any engine, data structure, or documentation to fix inconsistencies you find. Do NOT re-implement or refactor anything — this is analysis only.
What to test/verify: Cross-check every claim against the actual source file and line numbers, not against the design doc's prior claims alone (the design doc may itself be stale).
Deliverable: docs/design/phase1-structure-ledger.md, one row per structure, with columns: structure name, real-AQVL vs. opaque-built-in, pattern variant, file(s) involved, and a one-line note on anything surprising.
Definition of done: Every structure listed in the README's feature list has a corresponding, source-verified row in the ledger. This ledger becomes Phase 2's actual scope list — do not attempt to act on it yet.`,
      },
    ],
  },
  {
    number: 2,
    title: 'Genuinely centralize the pipeline',
    summary: 'Redesign AQIR as domain-neutral primitives, finish the AlgorithmHandler migration out of the 4,408-line AnimationController, and decouple the renderer from DSA-named overlay props.',
    load: 'Very High',
    ipd: 'critical',
    window: { start: '2026-10-11', end: '2026-11-15' },
    prereq: {
      model: 'Claude Opus 5.5 Medium',
      outcome: 'A precise, source-grounded map of every DSA-specific coupling point in AQIR, AnimationController, and the renderer, with zero code changes.',
      prompt: `You are about to start Phase 2 of the AQVL roadmap: genuinely centralizing the backend/execution/visualization pipeline so it is no longer fundamentally DSA-shaped. This is the highest-risk phase in the whole roadmap. Before making any changes:
1. Read docs/design/phase1-structure-ledger.md, docs/design/phase1-regression-baseline.md, and docs/design/phase1-example-corpus-audit.md from Phase 1 — these are your scope and your regression floor.
2. Read packages/compiler/src/aqir/generator.ts, packages/compiler/src/aqir/InstructionSet.ts, packages/compiler/src/aqir/types.ts, packages/runtime/src/core/AnimationController.ts (all 4,408 lines — skim structurally first, e.g. via grep -n "case '" to map out every action-name branch, then read the sections most relevant to the structures in the Phase 1 ledger), packages/runtime/src/core/algorithms/AlgorithmContext.ts, packages/renderer/src/components/generic/GenericSceneRenderer.tsx, and packages/runtime/src/models/SceneElement.ts / SceneState.ts.
3. Note every currently-uncommitted file in the working tree (the character/, code/, iteration/, linear/ directories, BaseCameraChoreographer.ts, visualTokens.ts, linear-director.test.ts) — these are in-flight work that sub-phase 2.5 will formally absorb; do not touch or discard them in this prerequisite step.
4. Do NOT make any code changes yet. Produce a short written map (in your final message) of: every distinct AQIR opcode currently emitted by the generator, every action-name branch currently handled inline vs. via a registered AlgorithmHandler in AnimationController.ts, and the exact prop signature of GenericSceneRenderer.
This map is the shared context every Phase 2 sub-phase prompt will build on.`,
    },
    steps: [
      {
        id: '2.1',
        title: 'AQIR primitive redesign',
        model: 'Claude Opus 5.5 High',
        outcome: 'A working, documented, domain-neutral AQIR primitive layer that every later phase depends on, verified against the Phase 1 baseline with zero regressions.',
        prompt: `Objective: Design and implement a small, closed set of domain-neutral AQIR primitives (state mutation, spatial transform, relationship/link, region/state annotation, narrative/log emission) and express every existing DSA-specific opcode (SWAP, COMPARE, HEAP_INSERT, LINK, SET_PARTITION_BOUNDARY, MARK_SORTED_REGION, and all others found in packages/compiler/src/aqir/generator.ts and InstructionSet.ts) as a composition of these primitives, not as a parallel instruction set.
Scope: packages/compiler/src/aqir/generator.ts, InstructionSet.ts, types.ts, validation.ts, and the corresponding VM-side interpreter in packages/runtime/src/VirtualMachine.ts and packages/runtime/src/aqir/types.ts. Design the primitive schema first (write it down as a short spec before touching code), then implement compiler-side macro-expansion so every existing .aqvl program compiles to the new primitive-based AQIR unchanged in observable behavior, and implement the VM-side primitive interpreter.
Do NOT change any .aqvl example source file. Do NOT change AnimationController.ts or the renderer in this sub-phase — that is 2.2 and 2.3. Do NOT invent AI/ML- or Blockchain-specific primitives yet.
What to test/verify: Run the full test suite and the Phase 1.2 example-corpus-audit script against the new primitive-based AQIR; every example that passed in the Phase 1 baseline must still pass, and output must be identical or the difference must be explicitly documented and justified.
Definition of done: All existing .aqvl examples compile to the new primitive set with the Phase 1 regression baseline holding; a short spec document for the primitive set is committed alongside the implementation.`,
      },
      {
        id: '2.2',
        title: 'AnimationController decomposition',
        model: 'Claude Opus 5.5 High',
        outcome: 'A dramatically smaller, consistent AnimationController.ts with every DSA structure on one engine pattern, with zero behavioral regressions.',
        prompt: `Objective: Finish the two-layer AlgorithmHandler migration documented in docs/design/algorithm-engine-pattern.md: give Array, Stack, Queue, and LinkedList a pure data-structure class plus an engine on the same canonical shape as HeapEngine/Heap.ts, and reconcile the three documented drift patterns in the five already-migrated structures (step-array field naming, pure/handler file splitting for BST and Graph, and the missing step-recording layer for HashMap and Trie).
Scope: packages/runtime/src/core/AnimationController.ts, packages/runtime/src/core/algorithms/*, packages/runtime/src/data-structures/*. Use the new AQIR primitives from sub-phase 2.1 as the interface between engines and the scheduler/scene manager. Remove the remaining inline else if branches for Array/Stack/Queue/LinkedList/PUSH/POP/ENQUEUE/DEQUEUE from AnimationController.ts once each is migrated.
Do NOT change any structure's visible animation behavior while migrating — this is a refactor, verified by identical output, not a feature change. Do NOT touch the renderer or AQIR generator further in this sub-phase.
What to test/verify: Extend the existing per-structure unit test pattern (e.g. unit/heap.test.ts) to the newly migrated structures; run the full suite and the Phase 1.2 example-corpus audit; confirm zero behavior change versus the Phase 1 baseline for every structure touched.
Definition of done: AnimationController.ts contains only dispatch and lifecycle glue — no structure-specific logic; every structure follows one consistent engine shape; the Phase 1 regression baseline holds unchanged.`,
      },
      {
        id: '2.3',
        title: 'Renderer decoupling',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A renderer whose generic layer is provably decoupled from DSA vocabulary, demonstrated by a fake non-DSA provider rendering correctly.',
        prompt: `Objective: Replace GenericSceneRenderer's hardcoded iterationOverlay/linearOverlay props with a generic decoration-provider registration mechanism keyed by scene metadata (from the new AQIR primitives), not by DSA-specific prop names, and move the array/- and linear/-specific decoration components behind that seam instead of being imported directly.
Scope: packages/renderer/src/components/generic/GenericSceneRenderer.tsx, packages/renderer/src/components/iteration/*, packages/renderer/src/components/linear/*, and the currently-uncommitted BaseCameraChoreographer.ts/character/code/ work — reconcile with it rather than duplicating it (full formal reconciliation is sub-phase 2.5, but avoid creating a second, conflicting decoration mechanism here).
Do NOT redesign the visual appearance of any existing decoration (arrows, boundaries, pointer layers) — only the seam they attach through. Do NOT remove the array/ or linear/ component directories.
What to test/verify: Extend GenericSceneRenderer.test.tsx with a test that registers a fake, non-DSA decoration provider and confirms it renders correctly with no change to GenericSceneRenderer.tsx itself — this is the direct rehearsal for Phase 3's adversarial test. Run the full renderer test suite.
Definition of done: GenericSceneRenderer's prop signature contains zero DSA-specific names; the fake-provider test passes; all existing renderer tests pass unchanged.`,
      },
      {
        id: '2.4',
        title: 'Scene/state model audit',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A generic scene/state layer with a permanent, automated guard against future DSA-specific leakage.',
        prompt: `Objective: Confirm SceneElement, SceneState, and StateManager carry no load-bearing DSA-specific fields outside the domain-owned decoration layer, and relocate anything DSA-specific (e.g. sorted-region or partition-boundary types currently in shared scene types) into a domain-owned metadata bag instead of the generic core.
Scope: packages/shared/src/index.ts, packages/shared/src/aqir/types.ts, packages/runtime/src/models/SceneElement.ts, SceneState.ts, packages/runtime/src/core/StateManager.ts. Add one extensible metadata field to the generic shapes if none exists, and move DSA-specific fields there.
Do NOT remove any DSA-specific renderer component or engine — only relocate the type definitions that leaked into the shared/generic layer. Do NOT touch AnimationController or the AQIR generator in this sub-phase.
What to test/verify: Full type-check across all packages after the move. Write a small checked-in grep-audit script (e.g. scripts/audit-generic-layer.ts or a tests/ check) that scans packages/shared/src and packages/runtime/src/models for DSA-specific identifiers (sortedRegion, partitionBoundary, heap-, trie-, etc.) and fails if any are found outside an explicit allowlist — this becomes a permanent CI regression guard.
Definition of done: The shared/generic layer contains only domain-neutral shapes plus the metadata field; the new audit script is green and committed to run in CI going forward.`,
      },
      {
        id: '2.5',
        title: 'In-flight work reconciliation',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'The in-flight refactor work is committed, coherent, and consistent with the rest of Phase 2 — no orphaned partial work remains.',
        prompt: `Objective: Formally absorb the currently-uncommitted work (BaseCameraChoreographer.ts, character/, code/, iteration/, linear/ component trees, shared/src/theme/visualTokens.ts, tests/integration/linear-director.test.ts) into the Phase 2 design, reconciling it against sub-phases 2.1-2.4's seams rather than treating it as separate, undiscovered scope.
Scope: Review every file in the current git diff/untracked list against the decoration-provider seam from 2.3 and the generic scene model from 2.4. Adjust the in-flight work only where it conflicts with those seams (e.g. if it duplicates a mechanism 2.3 already built); otherwise commit it as-is.
Do NOT introduce new features beyond reconciling what already exists in the working tree. Do NOT discard any of this in-flight work without first understanding what it does — it represents real, intentional prior work.
What to test/verify: Run tests/integration/linear-director.test.ts and confirm it passes and is representative of the pattern other domains (AI/ML, Blockchain) will reuse later. Run the full suite to confirm no regressions from committing this work.
Definition of done: All previously-uncommitted Phase 2-related files are committed as one coherent, documented change; nothing is left half-migrated or duplicated against 2.3/2.4's mechanisms.`,
      },
    ],
  },
  {
    number: 3,
    title: 'Prove the centralization is real',
    summary: 'Adversarial validation: a DSA-assumption audit, a throwaway non-DSA spike through the real pipeline, and an honest go/no-go gate before any AI/ML work.',
    load: 'Medium',
    ipd: 'critical',
    window: { start: '2026-11-15', end: '2026-11-29' },
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'Confirmation that Phase 2 is genuinely complete, plus a concrete hypothesis list for the adversarial audit that follows.',
      prompt: `You are about to start Phase 3 of the AQVL roadmap: proving, adversarially, that Phase 2's centralization is real and not cosmetic. Before doing anything else:
1. Confirm Phase 2 is fully complete: read the sub-phase 2.1-2.5 outputs/commits, run the full test suite and the Phase 1.2 example-corpus audit script, and confirm both are green against the Phase 1 baseline.
2. Read the final state of packages/compiler/src/aqir/generator.ts, AnimationController.ts, GenericSceneRenderer.tsx, and the 2.4 audit script to understand exactly what "centralized" now means in this codebase.
3. Do NOT make any code changes in this step, and do NOT assume centralization succeeded just because tests pass — your job in this phase is to actively look for evidence it did not.
Produce a short written list (in your final message) of every place in the codebase you'd want to check for DSA leakage, based on what you just read, as a starting hypothesis list for sub-phase 3.1.`,
    },
    steps: [
      {
        id: '3.1',
        title: 'DSA-assumption audit',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A categorized, evidence-based findings list — not a rubber-stamped clean bill of health.',
        prompt: `Objective: Systematically find any remaining hardcoded DSA vocabulary reachable from code Phase 2 labeled as generic — structure names, action-name string literals, originalType enum values, DSA-specific prop names — and classify each finding.
Scope: Static/grep-based review across packages/compiler/src/, packages/runtime/src/, packages/renderer/src/, packages/shared/src/. Search specifically for DSA-specific string literals and type names inside files that are supposed to be domain-neutral (the AQIR primitive layer, AnimationController's dispatch code, GenericSceneRenderer, SceneElement/SceneState).
Do NOT fix anything found in this sub-phase — classification only, feeding sub-phase 3.3's decision. Do NOT modify any source file.
What to test/verify: Run the 2.4 audit script and manually review AlgorithmRegistry, the AQIR primitive-to-DSA-opcode compatibility layer from 2.1, and the 2.3 decoration-provider seam specifically.
Deliverable: docs/design/phase3-dsa-assumption-audit.md listing every finding, classified as (a) acceptable domain-owned code, (b) leakage to fix before Phase 4, (c) deferred with a stated reason.
Definition of done: The audit file exists and is not empty by default — a report with zero findings must be justified, not assumed.`,
      },
      {
        id: '3.2',
        title: 'Adversarial non-DSA spike',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A concrete, evidence-based report on whether the "centralized" core survives a genuinely non-DSA domain.',
        prompt: `Objective: Build one deliberately throwaway, non-spatial, non-DSA toy domain — a small finite-state machine or a counter whose output is a value-over-time series, your choice, optimized for breaking things cheaply — end to end through the real AQVL pipeline (compiler → AQIR → runtime → renderer), in the same spirit as docs/design/acid-test-report.md's Skip List test, but targeting the engine/AQIR layer specifically rather than layout (which is already proven generic).
Scope: Add one new .aqvl example implementing the toy domain using only the existing language surface (no new syntax). Run it through the real compiler and a real ExecutionEngine/VM, not a mock. If it does not compile or run correctly with the current primitive set, that is the finding — do not add new AQIR primitives or renderer code to force it to work; instead document exactly what's missing.
Do NOT polish this toy domain's visuals. Do NOT treat this as a real feature — it is disposable and may be deleted after the report is written.
What to test/verify: Compile and run the toy domain through the real pipeline; verify it uses zero new AQIR primitives beyond what 2.1 defined; run the full existing suite to confirm no regressions from adding this one example.
Deliverable: docs/design/phase3-adversarial-spike-report.md, written in the same format as acid-test-report.md, stating plainly what worked, what broke, and what needed a workaround.
Definition of done: The report exists with concrete, specific findings (not vague impressions), and the example either compiles cleanly or the report explains exactly why not.`,
      },
      {
        id: '3.3',
        title: 'Go/no-go gate',
        model: 'Claude Opus 5.5 Low',
        outcome: 'An honest, evidence-backed go/no-go decision that actually gates Phase 4, not a rubber stamp.',
        prompt: `Objective: Make and record an explicit go/no-go decision on whether Phase 2's centralization is genuine enough to proceed to Phase 4 (AI/ML), based on the findings in docs/design/phase3-dsa-assumption-audit.md and docs/design/phase3-adversarial-spike-report.md.
Scope: Read both reports in full. Define, in writing, what "centralized enough" means for this project (e.g. no category-(b) leakage findings remain unresolved; the adversarial spike required zero or only clearly-justified new primitives). Apply that bar honestly to the actual findings.
Do NOT make any code changes in this sub-phase. Do NOT treat this as a formality — if the findings suggest centralization is cosmetic, the correct output is a "no-go, return to Phase 2" decision, not a rationalized yes.
What to test/verify: Cross-check that every category-(b) finding from 3.1 has actually been resolved (not just noted) before considering a go decision; if any remain open, the decision must address why they're acceptable to defer or must be a no-go.
Deliverable: docs/design/phase3-go-no-go-decision.md, stating the decision, the reasoning, and (if go) any conditions attached; (if no-go) exactly which Phase 2 sub-phase(s) need a second pass.
Definition of done: A recorded, reasoned decision exists. If it is a no-go, do not proceed to Phase 4 prompts until a follow-up Phase 2 pass is completed and this gate is re-run.`,
      },
    ],
  },
  {
    number: 4,
    title: '3 AI/ML concepts, first non-DSA domain',
    summary: 'Linear regression, KNN and a perceptron, each chosen to break a different assumption (charts, spatial reuse, matrix state), ending in an architecture-fit verdict.',
    load: 'High',
    ipd: 'critical',
    window: { start: '2026-11-29', end: '2026-12-27' },
    prereq: {
      model: 'Claude Opus 5.5 Medium',
      outcome: 'A concrete, source-grounded plan for extending the language surface, gated on a confirmed Phase 3 go decision.',
      prompt: `You are about to start Phase 4 of the AQVL roadmap: building the first non-DSA domain, AI/ML, as a real architectural test of the centralized core. Before writing any code:
1. Confirm Phase 3's go/no-go gate (docs/design/phase3-go-no-go-decision.md) recorded a GO decision. If it did not, stop and report that Phase 2 needs a second pass instead of proceeding.
2. Read the current AQVL language grammar (docs/grammar.md, docs/ast_specification.md, docs/LANGUAGE_SPEC.md) and the compiler's lexer/parser/AST (packages/compiler/src/lexer/index.ts, packages/compiler/src/parser/index.ts, packages/compiler/src/ast/types.ts) to understand how a new declaration kind (e.g. for numeric/matrix state) would be added.
3. Read the final state of the AQIR primitive layer from Phase 2.1 and the renderer decoration seam from Phase 2.3, since sub-phase 4.2 will need to extend both.
4. Do NOT make any code changes yet. Report, in your final message, a concrete plan for how a new MATRIX/WEIGHTS-like declaration would flow through lexer → parser → AST → semantic validation → AQIR generation, based on what you just read, as the starting point for sub-phase 4.1.`,
    },
    steps: [
      {
        id: '4.1',
        title: 'Language surface for numeric/continuous state',
        model: 'Claude Opus 5.5 High',
        outcome: 'A working, tested language extension for numeric/continuous state that generalizes across all of Phase 4 and 6\'s AI/ML concepts.',
        prompt: `Objective: Extend the AQVL DSL to support numeric/continuous state needed for AI/ML concepts — a matrix/weights-shaped declaration and a way to express "plot this value over iterations" — reusing ARRAY/NODE semantics where reasonable rather than inventing unnecessary new syntax.
Scope: packages/compiler/src/lexer/index.ts, packages/compiler/src/parser/index.ts, packages/compiler/src/ast/types.ts, packages/compiler/src/semantic/validator.ts, packages/compiler/src/aqir/generator.ts (extending it to emit the Phase 2.1 primitives for the new declaration kind, not new DSA-style opcodes). Update docs/grammar.md and docs/ast_specification.md to reflect the addition.
Do NOT design this surface around only one of the three Phase 4 AI/ML concepts — it must serve linear regression, KNN, and the perceptron (sub-phases 4.3-4.5), and scale to Phase 6's additional concepts. Do NOT touch the renderer in this sub-phase.
What to test/verify: New compiler unit tests for the added syntax (lexing, parsing, semantic validation, AQIR generation); confirm the new declaration compiles to Phase 2.1 primitives with no new DSA-style opcodes; run the full existing suite to confirm no regressions to existing AQVL programs.
Definition of done: A committed, documented DSL extension with passing unit tests, that the three Phase 4 concepts can all build on without further language changes.`,
      },
      {
        id: '4.2',
        title: 'Time-series/chart rendering capability',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working chart rendering capability proving the Phase 2.3 decoupling holds for a genuinely new visualization kind.',
        prompt: `Objective: Add a chart/time-series decoration kind to the renderer — an axis, a line, a running value — through the same generic decoration-provider seam built in Phase 2.3, since spatial layout (already proven generic) cannot represent "value over iterations."
Scope: packages/renderer/src/components/ (new component(s) for chart rendering, registered through the 2.3 decoration-provider mechanism, not hardcoded into GenericSceneRenderer.tsx), and whatever AQIR primitive(s) from 2.1 are needed to drive it (extend only if 2.1's set genuinely can't express it — document why if so).
Do NOT build a general-purpose charting library — scope strictly to what linear regression's loss curve (4.3) needs, expandable if 4.5/6.x need more later. Do NOT hardcode any AI/ML-specific naming into GenericSceneRenderer.tsx itself — the chart must register through the generic seam exactly like the fake provider did in 2.3's test.
What to test/verify: New renderer component tests for the chart decoration; confirm it registers through the 2.3 seam with zero changes to GenericSceneRenderer.tsx's own code; run the full renderer suite.
Definition of done: A chart/time-series visualization capability exists, is driven by AQIR primitives, and attaches through the generic decoration seam with no DSA- or AI/ML-specific code inside GenericSceneRenderer.tsx.`,
      },
      {
        id: '4.3',
        title: 'Linear regression + gradient descent',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working, verified linear regression example proving the numeric-state and chart plumbing end to end.',
        prompt: `Objective: Implement linear regression via gradient descent as a real AQVL example, end to end, producing a correct loss-over-iterations chart using the Phase 4.1 language surface and Phase 4.2 chart capability.
Scope: One new .aqvl example (or a small set) under examples/ plus registry entry in packages/demo/src/examples/registry.ts; any runtime engine code needed to execute the algorithm (following the two-layer pure-structure/engine pattern established in Phase 2.2).
Do NOT modify the language surface (4.1) or chart capability (4.2) themselves unless you find a genuine, blocking gap — if you do, stop and report it rather than working around it silently. Do NOT aim for machine-learning-library-grade correctness (regularization, convergence tuning) — a correct, illustrative gradient descent is sufficient.
What to test/verify: Compile and run the example through the real pipeline; verify the loss curve is numerically correct against a hand-computed or independently-scripted expected trajectory for a small, fixed dataset; run the full suite to confirm no regressions.
Definition of done: The example runs end to end, produces a correct loss chart, and is added to the example registry with a category consistent with the existing AI/ML domain naming you establish here (used by 4.4-4.5 and Phase 6).`,
      },
      {
        id: '4.4',
        title: 'K-nearest-neighbors classification',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working KNN example plus concrete evidence of how well existing spatial layout generalizes to a non-DSA domain.',
        prompt: `Objective: Implement k-nearest-neighbors classification as a real AQVL example, end to end, deliberately reusing existing spatial layout primitives (as a controlled comparison against DSA content) rather than the new chart capability.
Scope: One new .aqvl example plus registry entry; runtime engine code following the Phase 2.2 two-layer pattern, using existing LAYOUT/POSITION spatial primitives for points and neighbors rather than inventing new visualization.
Do NOT use the Phase 4.2 chart capability for this concept — the point of this sub-phase is to test how much existing spatial layout code carries over unmodified. Do NOT modify the language surface from 4.1 unless a genuine, blocking gap is found (report it, don't work around it).
What to test/verify: Compile and run the example end to end; verify classification correctness against a small, hand-computed labeled dataset; run the full suite to confirm no regressions.
Deliverable: alongside the example, a short note in docs/design/phase4-knn-layout-reuse.md documenting exactly how much of the existing spatial layout system (LayoutStrategy, LayoutManager) was reused without modification — this is direct evidence for the Phase 4.6 verdict.
Definition of done: The example runs end to end with correct classification output, and the reuse note is committed.`,
      },
      {
        id: '4.5',
        title: 'Perceptron forward pass',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working perceptron example plus a clear, honest account of how well (or poorly) the scene graph handles matrix-shaped state.',
        prompt: `Objective: Implement a single-layer perceptron forward pass as a real AQVL example, end to end, specifically testing how weight-matrix state fits (or doesn't) the existing SceneElement/scene-graph model.
Scope: One new .aqvl example plus registry entry; runtime engine code following the Phase 2.2 pattern; reuse the Phase 4.1 numeric/matrix language surface and, if useful, the Phase 4.3 gradient-descent plumbing for shared numeric utilities.
Do NOT change the core SceneElement/SceneState model to accommodate this (that would be a Phase 2.4-level change, out of scope here) — if the current model genuinely cannot represent weight-matrix state adequately, document that as a finding for 4.6 rather than redesigning the scene model yourself.
What to test/verify: Compile and run the example end to end; verify forward-pass output (weighted sum + activation) is numerically correct against a hand-computed example; run the full suite to confirm no regressions.
Definition of done: The example runs end to end with correct output, and any friction encountered representing weight-matrix state in the scene graph is explicitly written down (in the example's own commit message or a short note) for the 4.6 verdict to consume.`,
      },
      {
        id: '4.6',
        title: 'Architecture-fit verdict',
        model: 'Claude Opus 5.5 Low',
        outcome: 'A clear, actionable verdict gating how Phase 6 scales the AI/ML domain.',
        prompt: `Objective: Synthesize sub-phases 4.1-4.5 into a written verdict on what the "centralized" core did or didn't handle well when a genuinely different domain (AI/ML) arrived — this is the actual point of Phase 4, not the three demos themselves.
Scope: Read the outputs, commits, and any friction notes from 4.1-4.5 (including the 4.4 layout-reuse note and 4.5's scene-model friction notes). Do not re-implement or re-test anything already covered.
Do NOT let AI/ML "correctness" (is the gradient descent good machine learning) become the bar in this verdict — the bar is whether the pipeline visualized these concepts correctly and generically. Do NOT make any code changes in this sub-phase — flag needed changes for Phase 6 to act on, don't fix them here.
What to test/verify: Confirm the full suite and example-corpus audit are green with all Phase 4 examples included, as a factual check before writing the verdict.
Deliverable: docs/design/phase4-architecture-verdict.md, stating clearly what broke, what strained, what proved genuinely generic, and a prioritized list of anything Phase 6 must address before scaling AI/ML volume.
Definition of done: A written, evidence-based verdict exists and is specific enough that Phase 6's prerequisite step can act on it directly.`,
      },
    ],
  },
  {
    number: 5,
    title: '3 Blockchain concepts, a structurally different domain',
    summary: 'Append-only state in StateManager, then a hash chain, a Merkle tree and a proof-of-work loop, ending in an architecture-fit verdict.',
    load: 'High',
    ipd: 'critical',
    window: { start: '2026-12-27', end: '2027-01-24' },
    prereq: {
      model: 'Claude Opus 5.5 Medium',
      outcome: 'A concrete, source-grounded starting hypothesis for the immutability design work in 5.1.',
      prompt: `You are about to start Phase 5 of the AQVL roadmap: building Blockchain as a third, structurally different domain, testing state-transition and immutability assumptions AI/ML didn't touch. Before writing any code:
1. Read docs/design/phase4-architecture-verdict.md in full — any core-level findings it raised should inform how you approach Phase 5, even though Phase 5 doesn't strictly depend on Phase 6 having acted on them yet.
2. Read packages/runtime/src/core/StateManager.ts in full and understand exactly how undo/redo/scrubbing currently work against mutable, in-place scene state.
3. Read packages/runtime/src/core/layouts/TreeLayoutStrategy.ts and packages/runtime/src/core/algorithms/TreeEngine.ts/BSTEngine.ts to understand the existing tree-layout mechanism sub-phase 5.3 will reuse.
4. Read docs/design/phase3-go-no-go-decision.md to confirm Phase 3's go decision is still the operative one (it should be, since Phase 4 already relied on it).
5. Do NOT make any code changes yet. Report, in your final message, a concrete hypothesis for how StateManager would need to change to represent append-only, immutable-once-written state, as the starting point for sub-phase 5.1.`,
    },
    steps: [
      {
        id: '5.1',
        title: 'Immutability/append-only state semantics',
        model: 'Claude Opus 5.5 High',
        outcome: 'A working, domain-neutral immutability model in StateManager that Blockchain (and only Blockchain, cleanly) depends on.',
        prompt: `Objective: Design and implement support for append-only, immutable-once-written scene state in StateManager, since every DSA and AI/ML structure so far assumes elements can change value/position freely, and blockchain content cannot.
Scope: packages/runtime/src/core/StateManager.ts and any scene-model changes needed in packages/runtime/src/models/SceneElement.ts/SceneState.ts (routing any new fields through the Phase 2.4 metadata bag, not as new generic-layer fields). Decide explicitly what undo/redo/scrubbing mean for append-only state and implement that decision.
Do NOT special-case "blockchain" by name anywhere in StateManager — this must be a state-model concept (e.g. an immutability flag or mode on state entries) usable by any future domain, or it will leak exactly like the DSA-specific fields Phase 2.4 just cleaned up. Do NOT touch AnimationController, AQIR, or the renderer in this sub-phase.
What to test/verify: New StateManager unit tests specifically for append-only mode (attempting to mutate committed state should behave in the deliberately-decided way, not silently succeed); run the full suite to confirm no regressions to existing mutable-state behavior.
Definition of done: StateManager supports append-only state as a first-class, domain-neutral concept, with passing unit tests and zero regressions to existing mutable-state usage.`,
      },
      {
        id: '5.2',
        title: 'Hash-chain implementation',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working hash-chain example that concretely exercises the new immutability model.',
        prompt: `Objective: Implement a hash-linked block chain as a real AQVL example, end to end, as the core test case for the Phase 5.1 immutability model.
Scope: One new .aqvl example plus registry entry; runtime engine code following the Phase 2.2 two-layer pattern, using the Phase 5.1 append-only state support. Use a simple, non-cryptographic toy hash function that is visually/structurally representative — do not implement real SHA-256 or similar.
Do NOT modify StateManager's core append-only design (5.1) unless you find a genuine, blocking gap — report it rather than working around it. Do NOT implement real cryptographic hashing.
What to test/verify: Compile and run the example end to end; verify that once a block is added, its prior state cannot be mutated (exercising the 5.1 immutability guarantees directly); run the full suite to confirm no regressions.
Definition of done: The example runs end to end, demonstrably exercises append-only immutability (not just visually resembling a chain), and is added to the registry under a Blockchain category.`,
      },
      {
        id: '5.3',
        title: 'Merkle tree implementation',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working Merkle tree example plus evidence of how well existing tree layout generalizes beyond BST/Heap.',
        prompt: `Objective: Implement a Merkle tree as a real AQVL example, end to end, reusing TreeLayoutStrategy as a control comparison against BST/Heap tree rendering.
Scope: One new .aqvl example plus registry entry; runtime engine code following the Phase 2.2 pattern, reusing existing tree layout/rendering as much as possible rather than building new visualization.
Do NOT modify TreeLayoutStrategy or existing tree-rendering components unless a genuine, blocking gap is found — report it rather than working around it. Do NOT implement real cryptographic hashing (a toy hash is fine, as in 5.2).
What to test/verify: Compile and run the example end to end; verify the tree structure and hash-propagation-up-the-tree logic is correct for a small, hand-computed example; run the full suite to confirm no regressions.
Deliverable: alongside the example, a short note documenting how much of the existing tree-layout code was reused unmodified — direct evidence for the 5.5 verdict.
Definition of done: The example runs end to end with correct structure/hash behavior, and the reuse note is committed.`,
      },
      {
        id: '5.4',
        title: 'Proof-of-work/mining loop',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working PoW example plus a direct, honest answer on whether AQIR\'s primitives are truly generic under the hardest test case yet.',
        prompt: `Objective: Implement a minimal proof-of-work/mining loop as a real AQVL example, end to end — a search-until-condition loop with no data-structure mutation in the DSA sense, the sharpest available test of whether the Phase 2.1 AQIR primitives are genuinely generic or still secretly SWAP/COMPARE-biased.
Scope: One new .aqvl example plus registry entry; runtime engine code following the Phase 2.2 pattern. This will likely need a "search loop with no structure mutation" shape in the iteration overlay from Phase 2.3/2.5 — extend that overlay mechanism if needed, rather than bypassing it with one-off code.
Do NOT implement real difficulty adjustment or real consensus correctness — a toy nonce-search loop that terminates and is visually representative is sufficient. Do NOT add new AQIR primitives to make this work without first checking whether Phase 2.1's existing set genuinely can't express a bare iterate-until-condition loop — if it can't, that is the headline finding for 5.5, not something to quietly patch around.
What to test/verify: Compile and run the example end to end; verify it terminates correctly once the toy condition is met; run the full suite to confirm no regressions.
Definition of done: The example runs end to end, and you have an explicit, written answer to whether this required any new or extended primitive/overlay mechanism, and why.`,
      },
      {
        id: '5.5',
        title: 'Architecture-fit verdict',
        model: 'Claude Opus 5.5 Low',
        outcome: 'A clear, actionable verdict gating how Phase 7 scales the Blockchain domain.',
        prompt: `Objective: Synthesize sub-phases 5.1-5.4 into a written verdict on state-transition/immutability findings specifically, in the same format as the Phase 4.6 verdict.
Scope: Read the outputs, commits, and friction notes from 5.1-5.4 (including 5.3's layout-reuse note and 5.4's primitive-genericity finding). Do not re-implement or re-test anything already covered.
Do NOT make any code changes in this sub-phase — flag needed changes for Phase 7 to act on, don't fix them here.
What to test/verify: Confirm the full suite and example-corpus audit are green with all Phase 5 examples included, as a factual check before writing the verdict.
Deliverable: docs/design/phase5-architecture-verdict.md, stating what broke, what strained, what proved genuinely generic, and a prioritized list of anything Phase 7 must address before scaling Blockchain volume.
Definition of done: A written, evidence-based verdict exists and is specific enough that Phase 7's prerequisite step can act on it directly.`,
      },
    ],
  },
  {
    number: 6,
    title: 'Remaining AI/ML concepts + stress test',
    summary: 'Bring AI/ML to DSA-category breadth on existing plumbing, then profile it at realistic dataset and epoch scale.',
    load: 'High',
    ipd: 'critical',
    window: { start: '2027-01-24', end: '2027-02-21' },
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'Confirmation Phase 4\'s findings are resolved, plus a sequenced concept list for 6.1.',
      prompt: `You are about to start Phase 6 of the AQVL roadmap: filling out the AI/ML category to a comparable depth as existing DSA categories, and stress-testing it. Before writing any code:
1. Read docs/design/phase4-architecture-verdict.md in full and confirm every item it flagged as needing resolution before scaling volume has actually been addressed (either fixed, or explicitly and reasonably deferred with a written reason). If unresolved blocking items remain, stop and report them rather than proceeding.
2. Read the current AI/ML examples (from sub-phases 4.3-4.5) and their registry entries to understand the established pattern for this category.
3. Do NOT make any code changes yet. Report, in your final message, a prioritized list of candidate concepts for sub-phase 6.1 (e.g. decision tree, k-means clustering, a small feed-forward network with backprop, gradient descent variants, PCA), ordered by how much they reuse existing 4.1/4.2 plumbing versus how much new plumbing they'd need.`,
    },
    steps: [
      {
        id: '6.1',
        title: 'Fill out the AI/ML category',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A materially larger AI/ML example category, built entirely on existing, validated plumbing.',
        prompt: `Objective: Bring the AI/ML category to a breadth comparable with existing DSA categories (17-24 examples each), implementing additional concepts (from the prerequisite step's prioritized list — candidates include decision tree, k-means clustering, a small feed-forward network with backprop, gradient descent variants, PCA) end to end.
Scope: New .aqvl examples plus registry entries; runtime engine code following the Phase 2.2 pattern, reusing the Phase 4.1 language surface and Phase 4.2 chart capability wherever a concept fits them. Sequence cheap-reuse concepts first.
Do NOT modify the Phase 4.1 language surface or Phase 4.2 chart capability to force-fit a concept — if a concept genuinely needs a language or rendering change beyond what exists, stop and report it rather than expanding scope silently. Do NOT chase feature parity with real ML libraries (regularization, real optimizers).
What to test/verify: Each new concept follows the same acid-test discipline as Phase 4 (compile + run end to end, verify numeric correctness against a small hand-computed case); run the full suite after each concept to catch regressions early rather than in one large batch at the end.
Definition of done: The AI/ML category reaches breadth comparable to existing DSA categories, every new example passes its own correctness check, and the full regression suite stays green throughout.`,
      },
      {
        id: '6.2',
        title: 'AI/ML-specific stress test',
        model: 'Claude Opus 5.5 Low',
        outcome: 'A concrete, comparable performance profile for AI/ML at real scale, feeding directly into Phase 8.',
        prompt: `Objective: Test performance and renderer behavior at AI/ML-realistic scale (larger datasets, multi-epoch training loops) — a scale DSA examples never produced — and produce a documented performance profile.
Scope: Extend one or more Phase 6.1 (or Phase 4) examples to run at larger scale (e.g. n≈100+ dataset for KNN/k-means, a genuinely multi-epoch training loop for the perceptron/gradient descent examples). Use the methodology already established in docs/design/spatial-performance-report.md.
Do NOT treat this as optional or skip it for time — it is the only place before Phase 8 that AI/ML gets tested beyond toy sizes. Do NOT modify core pipeline code to "fix" performance issues found here — report them; fixing is Phase 8 territory if they're cross-domain, or a follow-up if AI/ML-specific.
What to test/verify: Measure end-to-end run time and, where possible, per-stage timing (compile, VM execution, layout, render) at the larger scale; compare against the Phase 1.4 numeric floor established in Phase 1.
Deliverable: docs/design/phase6-aiml-stress-test.md with concrete numbers and any performance concerns clearly flagged.
Definition of done: A documented performance profile exists at realistic AI/ML scale, with findings compared against the Phase 1 floor, not just described in isolation.`,
      },
    ],
  },
  {
    number: 7,
    title: 'Remaining Blockchain concepts + stress test',
    summary: 'Bring Blockchain to comparable breadth on the append-only model, then load-test long chains against StateManager.',
    load: 'High',
    ipd: 'critical',
    window: { start: '2027-02-21', end: '2027-03-21' },
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'Confirmation Phase 5\'s findings are resolved, plus a sequenced concept list for 7.1.',
      prompt: `You are about to start Phase 7 of the AQVL roadmap: filling out the Blockchain category to a comparable depth as existing DSA categories, and stress-testing it. Before writing any code:
1. Read docs/design/phase5-architecture-verdict.md in full and confirm every item it flagged as needing resolution before scaling volume has actually been addressed. If unresolved blocking items remain, stop and report them rather than proceeding.
2. Read the current Blockchain examples (from sub-phases 5.2-5.4) and their registry entries to understand the established pattern for this category, and re-read packages/runtime/src/core/StateManager.ts's append-only mode from Phase 5.1 since it's newer and less battle-tested than the AI/ML plumbing.
3. Do NOT make any code changes yet. Report, in your final message, a prioritized list of candidate concepts for sub-phase 7.1 (e.g. Merkle proof verification, a simple smart-contract-style state machine, a wallet/transaction graph, a basic consensus variant), ordered by how much they reuse existing 5.1 plumbing versus how much new plumbing they'd need.`,
    },
    steps: [
      {
        id: '7.1',
        title: 'Fill out the Blockchain category',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A materially larger Blockchain example category, built entirely on the validated immutability plumbing.',
        prompt: `Objective: Bring the Blockchain category to a breadth comparable with existing DSA/AI-ML categories, implementing additional concepts (from the prerequisite step's list — candidates include Merkle proof verification, a simple smart-contract-style state machine, a wallet/transaction graph, a basic consensus variant like proof-of-stake selection) end to end.
Scope: New .aqvl examples plus registry entries; runtime engine code following the Phase 2.2 pattern, reusing the Phase 5.1 append-only state model wherever a concept needs immutability semantics. Sequence cheap-reuse concepts first.
Do NOT modify StateManager's core append-only design (5.1) to force-fit a concept — if a concept genuinely needs a change there, stop and report it. Do NOT build anything resembling a real wallet, real keys, or anything touching real value.
What to test/verify: Each new concept follows the same acid-test discipline as Phase 5 (compile + run end to end, verify correctness against a small hand-computed case, confirm immutability guarantees hold where relevant); run the full suite after each concept.
Definition of done: The Blockchain category reaches breadth comparable to existing categories, every new example passes its own correctness check, and the full regression suite stays green throughout.`,
      },
      {
        id: '7.2',
        title: 'Blockchain-specific stress test',
        model: 'Claude Opus 5.5 Low',
        outcome: 'A concrete performance profile for Blockchain at real scale, specifically exercising append-only growth.',
        prompt: `Objective: Load-test the append-only growth scenario Phase 5.1 was designed for but couldn't fully exercise with only 3 concepts — a much longer chain (hundreds of blocks) and a bigger transaction graph, specifically against StateManager's undo/redo path.
Scope: Extend one or more Phase 7.1 (or Phase 5) examples to generate a genuinely long chain/large graph. Use the methodology established in docs/design/spatial-performance-report.md and docs/design/phase6-aiml-stress-test.md.
Do NOT skip this because "it's just more of the same data" — append-only growth is exactly the shape StateManager was never built for before Phase 5.1, and this is the first real load test of that new code path. Do NOT modify StateManager to "fix" performance issues found here — report them; fixing is Phase 8 territory if cross-domain.
What to test/verify: Measure end-to-end and per-stage timing at long-chain scale; compare against the Phase 1.4 floor and the Phase 6.2 AI/ML profile for a cross-domain comparison point.
Deliverable: docs/design/phase7-blockchain-stress-test.md with concrete numbers and any performance concerns clearly flagged.
Definition of done: A documented performance profile exists at realistic Blockchain scale, directly comparable to the Phase 6.2 profile, feeding into Phase 8.`,
      },
    ],
  },
  {
    number: 8,
    title: 'Full system stress test across all domains',
    summary: 'One combined regression sweep, a second hidden-coupling audit, a stage-by-stage performance ceiling, and the final architecture verdict that gates Phase 9.',
    load: 'Medium-High',
    ipd: 'critical',
    window: { start: '2027-03-21', end: '2027-04-11' },
    prereq: {
      model: 'Claude Opus 5.5 Medium',
      outcome: 'Confirmation all domain-level work is complete, plus a concrete map of every cross-domain seam to inspect next.',
      prompt: `You are about to start Phase 8 of the AQVL roadmap: the full cross-domain system stress test and architecture verdict across DSA, AI/ML, and Blockchain together. Before doing anything else:
1. Read docs/design/phase6-aiml-stress-test.md and docs/design/phase7-blockchain-stress-test.md in full, plus the Phase 4.6 and 5.5 architecture verdicts, to understand every known open item across both non-DSA domains.
2. Confirm the full example registry now includes all DSA, AI/ML, and Blockchain examples from Phases 1-7, and that each domain's own regression suite passes independently.
3. Do NOT make any code changes yet. Report, in your final message, a list of every seam that is shared by two or more domains (e.g. the decoration-provider seam from 2.3, used by both the chart capability in 4.2 and the array/linear overlays; the StateManager append-only mode from 5.1, potentially touched by any domain going forward) — this is the map sub-phase 8.2's coupling audit will use.`,
    },
    steps: [
      {
        id: '8.1',
        title: 'Cross-domain regression sweep',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A single, unified regression result across all three domains, with any cross-domain regressions surfaced explicitly.',
        prompt: `Objective: Run the entire example corpus — DSA, AI/ML, and Blockchain together — through the full pipeline in one CI pass, for the first time, and diff the results against every prior phase's baseline.
Scope: Extend the Phase 1.2 example-corpus-audit script to run against the full, current registry (all examples across all three domains) in a single pass. Compare results against the Phase 1 baseline (for DSA examples) and confirm AI/ML and Blockchain examples pass at the same rate they did in their own domain phases.
Do NOT modify any example or engine code to fix failures found here — record them for sub-phase 8.2/8.4 to triage. Do NOT change the audit script's pass/fail logic to make numbers look better.
What to test/verify: The full, combined run; any regression versus a domain's own prior baseline is flagged explicitly, not silently absorbed into an aggregate pass rate.
Deliverable: docs/design/phase8-cross-domain-sweep.md with per-domain and combined results.
Definition of done: One green, unified CI pass exists across all three domains, or every failure is explicitly recorded with its domain and prior baseline comparison.`,
      },
      {
        id: '8.2',
        title: 'Hidden-coupling audit, round two',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A specific, evidence-based account of whether the shared architecture holds up when domains combine, not just when they run separately.',
        prompt: `Objective: Repeat the Phase 3.1 static audit, now with three real domains' worth of code, looking specifically for coupling that only appears when two non-DSA domains coexist — e.g. whether the AI/ML chart decoration provider and the Blockchain immutable-state handling conflict over the same Phase 2.3 seam.
Scope: Static/grep review plus targeted manual review of every shared seam identified in the Phase 8 prerequisite step's map — especially the decoration-provider registration (2.3), the AQIR primitive set (2.1), and StateManager's append-only mode (5.1) — checking each for assumptions that hold for one domain but not two simultaneously.
Do NOT fix anything found in this sub-phase — classification only, feeding sub-phase 8.4's verdict. Do NOT modify any source file.
What to test/verify: For each shared seam, construct or point to a concrete scenario where two domains would both need it at once (e.g. a hypothetical example using both a chart decoration and an immutable-state region) and reason through whether it would actually work — build a small combined test example if that's the fastest way to get a real answer rather than a guess.
Deliverable: docs/design/phase8-coupling-audit.md, findings categorized like Phase 3.1's (acceptable, must-fix, deferred-with-reason).
Definition of done: The audit file exists with concrete, tested-or-reasoned findings for every shared seam identified, not a generic pass/fail statement.`,
      },
      {
        id: '8.3',
        title: 'Performance/scale ceiling test',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A precise understanding of where performance bottlenecks originate under full combined load.',
        prompt: `Objective: Push the largest example from each domain simultaneously or in quick succession against the Phase 1.4 numeric floor, and identify exactly where performance characteristics come from (compiler, VM, layout, or render stage), not just measure end-to-end time.
Scope: Build an instrumented test harness (extending the profiling approach from docs/design/spatial-performance-report.md, phase6-aiml-stress-test.md, and phase7-blockchain-stress-test.md) that times each pipeline stage separately, then run it against combined worst-case load (largest DSA + largest AI/ML + largest Blockchain example, run together or back-to-back).
Do NOT modify pipeline code to "fix" performance issues found here — this is measurement only; fixes are Phase 8.4's punch list, actioned later if correctness-blocking, or scheduled explicitly otherwise. Do NOT skip per-stage breakdown in favor of a single aggregate number — the whole point is finding where time goes.
What to test/verify: Stage-by-stage timing (compile, VM execution, layout computation, render) under combined load, compared against each domain's individual Phase 1/6/7 numbers to isolate cross-domain-specific slowdowns from per-domain ones.
Deliverable: docs/design/phase8-performance-ceiling.md with a stage-by-stage breakdown and explicit comparison to prior individual-domain numbers.
Definition of done: A documented performance ceiling exists with a clear stage-by-stage attribution, not just a pass/fail against a single threshold.`,
      },
      {
        id: '8.4',
        title: 'Final architecture verdict',
        model: 'Claude Opus 5.5 High',
        outcome: 'The single most important artifact in the roadmap — a real, actionable verdict on architectural domain-neutrality, gating all language-integration work that follows.',
        prompt: `Objective: Synthesize sub-phases 8.1-8.3 into the roadmap's central deliverable: a specific, evidence-backed verdict on whether AQVL's core is genuinely domain-neutral across DSA, AI/ML, and Blockchain, plus a prioritized punch list, gating whether Phase 9+ proceeds against the current core or a patched one.
Scope: Read every artifact produced in Phases 1-8 (baselines, verdicts, audits, stress-test reports). Do not re-run tests already covered by 8.1-8.3 unless you find a specific reason to doubt a result.
Do NOT scope-creep this into "fix everything found" — only fix correctness-blocking items discovered in 8.1-8.3 directly in this sub-phase; everything else must be explicitly scheduled (into remaining IPD time per the roadmap's synthesis, or post-IPD) rather than fixed silently or left unaddressed. Do NOT soften the verdict to make the project look further along than the evidence supports.
What to test/verify: If any correctness-blocking fix is made here, re-run the full combined regression sweep (8.1) afterward to confirm it actually resolved the issue without introducing a new one.
Deliverable: docs/design/phase8-final-architecture-verdict.md, stating the verdict plainly, the prioritized punch list with owners/timing (IPD-remaining vs. post-IPD), and explicit sign-off on whether Phase 9 should proceed.
Definition of done: A recorded verdict exists that Phase 9's prerequisite step can act on directly, with all correctness-blocking issues resolved and everything else explicitly scheduled, not silently dropped.`,
      },
    ],
  },
  {
    number: 9,
    title: 'C integration',
    summary: 'Execution-capture + semantic-normalization adapter onto AQIR primitives, never a reimplementation. IPD scope is a proof-of-concept.',
    load: 'High',
    ipd: 'partial',
    window: { start: '2027-04-11', end: '2027-05-27' },
    prereq: {
      model: 'Claude Opus 5.5 Medium',
      outcome: 'A grounded, environment-aware set of options for the execution-capture decision that follows.',
      prompt: `You are about to start Phase 9 of the AQVL roadmap: C integration via an execution-capture adapter, the first of four external-language phases. Before doing anything else:
1. Read docs/design/phase8-final-architecture-verdict.md and confirm it signed off on proceeding to Phase 9. If it did not, stop and report that Phase 8's punch list needs further action first.
2. Read the final state of the Phase 2.1 AQIR primitive layer and its spec document, since every language adapter in Phases 9-12 will target it directly, never a DSA-specific opcode.
3. Research (read documentation/man pages, do not install anything yet) the realistic options for C execution capture available in this environment: GDB/lldb machine-interface scripting, a custom instrumented interpreter for a small C subset, and compiler-inserted tracing via Clang instrumentation. Note what's actually available in the current development environment (check for installed toolchains) versus what would need to be added.
4. Do NOT make any code changes yet, and do NOT install new toolchains without flagging it first. Report, in your final message, the realistic options found and a recommendation, as the starting point for sub-phase 9.1's decision.`,
    },
    steps: [
      {
        id: '9.1',
        title: 'Execution capture strategy selection',
        model: 'Claude Opus 5.5 High',
        outcome: 'A proven, justified execution-capture foundation for all of Phase 9 (and a template for Phase 10).',
        prompt: `Objective: Choose and prototype the execution-capture strategy for C — the highest-consequence decision in Phases 9-12, since it becomes the template for C++ and partly informs Python and Solidity.
Scope: Based on the Phase 9 prerequisite step's findings, build a minimal working prototype of the chosen approach (GDB/lldb MI scripting, a custom instrumented interpreter for a small C subset, or Clang-instrumented tracing) that can capture a step-by-step execution trace (variable writes, control flow, function calls) for one trivial C program (e.g. a simple loop incrementing a variable).
Do NOT build out the full adapter or any AQVL integration yet — this sub-phase proves the capture mechanism works in isolation, nothing more. Do NOT choose an approach requiring tooling unavailable in this environment without first flagging that as a blocker.
What to test/verify: The prototype must produce a real, correct execution trace for the trivial test program, verified by hand against what the program actually does.
Deliverable: A working capture prototype (in a new, clearly-labeled experimental location, e.g. packages/lang-c/experiments/) plus docs/design/phase9-capture-strategy.md documenting the choice and why.
Definition of done: A working, justified capture strategy exists with a verified prototype trace, ready for sub-phase 9.3 to build the normalization layer on top of.`,
      },
      {
        id: '9.2',
        title: 'Compatibility scope definition',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A precise, checkable compatibility boundary that prevents scope creep through the rest of Phase 9.',
        prompt: `Objective: Name the exact, deliberately small subset of C that AQVL will support, in writing, before any normalization or adapter work begins — full-language C support is a multi-year effort and explicitly out of scope.
Scope: Based on the Phase 9.1 capture prototype's actual capabilities and the kinds of programs AQVL's example corpus already favors (simple loops, arrays, structs, basic recursion), write a scope document naming what's included (structs, arrays, pointers, simple control flow, functions) and explicitly excluded (preprocessor macro complexity, multi-file linking, most of the standard library).
Do NOT write code in this sub-phase. Do NOT leave the scope vague or open-ended — every inclusion/exclusion must be a specific, checkable statement.
What to test/verify: Sanity-check the scope against 3-4 example C programs you sketch out (don't need to run them yet) to confirm they'd plausibly fit within it.
Deliverable: docs/design/phase9-compatibility-scope.md.
Definition of done: A specific, written scope exists that sub-phases 9.3-9.5 can be held to exactly — treat any request to expand it mid-implementation as a signal to stop and re-scope explicitly, not to quietly proceed.`,
      },
      {
        id: '9.3',
        title: 'Semantic normalization layer',
        model: 'Claude Opus 5.5 High',
        outcome: 'A working, tested semantic-normalization layer proving (or honestly disproving) that AQIR\'s primitives generalize to an imperative language outside AQVL\'s own DSL.',
        prompt: `Objective: Map captured C execution events (from the Phase 9.1 prototype) onto the Phase 2.1 AQIR primitives — the second real test of that primitive set's genericity, after AI/ML and Blockchain.
Scope: New code (e.g. packages/lang-c/src/normalize.ts or similar, following this monorepo's existing package conventions) that consumes the 9.1 capture format and emits Phase 2.1 AQIR primitives, scoped strictly to the Phase 9.2 compatibility boundary (variable writes → state mutation primitives, array/pointer operations → the appropriate existing primitives, function calls → whatever call/scope primitives exist).
Do NOT add new AQIR primitives or new DSA-style opcodes to make C fit — if the existing primitive set genuinely cannot express something within the 9.2 scope, stop and report it as a finding rather than quietly extending AQIR. Do NOT expand the 9.2 compatibility scope to make normalization easier.
What to test/verify: For each construct within the 9.2 scope, write a unit test verifying its captured trace normalizes to the expected AQIR primitives; run against 3-5 small test programs covering the full 9.2 scope.
Definition of done: Every construct in the Phase 9.2 scope normalizes correctly to existing AQIR primitives, verified by unit tests, with zero new AQIR opcodes introduced (or, if truly unavoidable, an explicit, justified exception documented and flagged for Phase 8.4-style review).`,
      },
      {
        id: '9.4',
        title: 'Adapter implementation + Playground integration',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working, integrated C-to-AQVL Playground path that reuses the entire existing pipeline unmodified downstream of normalization.',
        prompt: `Objective: Wire the Phase 9.1 capture and Phase 9.3 normalization into a working end-to-end adapter, integrated into the Playground alongside native AQVL programs.
Scope: packages/demo/src/ (Playground UI changes to accept/select a C source input alongside AQVL), plus the adapter package from 9.1/9.3, wired so a C program (within the 9.2 scope) can be loaded, captured, normalized, and rendered through the existing ExecutionEngine/renderer exactly like a compiled AQVL program.
Do NOT modify ExecutionEngine, AnimationController, or the renderer to special-case C — the entire point of the adapter architecture is that once normalization produces AQIR primitives, nothing downstream needs to know the source was C. Do NOT expand the 9.2 compatibility scope to make integration easier.
What to test/verify: Load a small C program (within 9.2 scope) end to end through the Playground UI and confirm it visualizes correctly, exactly as an equivalent AQVL program would.
Definition of done: A working C-to-AQVL-visualization path exists in the Playground, demonstrably using the same downstream pipeline as native AQVL with zero special-casing.`,
      },
      {
        id: '9.5',
        title: 'C test corpus + acid-test report',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A verified, representative C test corpus and an honest acid-test report closing out Phase 9.',
        prompt: `Objective: Verify the Phase 9.2-scoped C subset works correctly end to end across a representative corpus, with the same acid-test rigor used in Phases 3-5.
Scope: Build a small corpus of C programs (5-10) spanning the full Phase 9.2 compatibility scope (structs, arrays, pointers, control flow, functions); run each through the Phase 9.4 integrated adapter; verify correctness of the resulting visualization against expected program behavior.
Do NOT add any program outside the Phase 9.2 scope to the corpus — the corpus's job is to validate the scoped subset thoroughly, not to discover new scope. Do NOT modify the adapter to fix issues found here without first documenting the issue in the report.
What to test/verify: Every corpus program's full pipeline run (capture → normalize → execute → render), each checked for correctness by hand or against the program's known expected behavior.
Deliverable: The committed corpus (e.g. under packages/lang-c/corpus/) plus docs/design/phase9-c-acid-test-report.md in the same format as acid-test-report.md.
Definition of done: The full corpus passes end to end, with the report honestly documenting any remaining rough edges within the declared C scope.`,
      },
    ],
  },
  {
    number: 10,
    title: 'C++ integration',
    summary: 'Extend the C adapter to a scoped C++ delta (classes, references, simple templates, STL containers). Post-IPD.',
    load: 'Medium-High',
    ipd: 'post',
    window: null,
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'Confirmation Phase 9 is solid, plus a grounded starting list for the C++ delta-scope decision.',
      prompt: `You are about to start Phase 10 of the AQVL roadmap: extending the Phase 9 C adapter to C++. Before writing any code:
1. Confirm Phase 9 is fully complete: read docs/design/phase9-c-acid-test-report.md and confirm the corpus passes end to end.
2. Read the Phase 9.1 capture prototype, Phase 9.3 normalization layer, and Phase 9.4 adapter/integration code in full, since Phase 10 must reuse this infrastructure directly rather than building a parallel one.
3. Do NOT make any code changes yet. Report, in your final message, a concrete list of what C++ adds over the Phase 9.2 C scope that's plausibly worth supporting for teaching purposes (classes/objects, references, simple templates, STL containers like std::vector/std::map), as the starting point for sub-phase 10.1's scope decision.`,
    },
    steps: [
      {
        id: '10.1',
        title: 'Delta-scope definition',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A precise C++ scope boundary that keeps Phase 10 from re-litigating Phase 9\'s decisions.',
        prompt: `Objective: Decide and write down exactly what C++ adds over the Phase 9.2 C scope that's worth supporting for teaching purposes, explicitly reusing the Phase 9 adapter rather than building a parallel one.
Scope: A scope document naming the delta: likely classes/objects, references, simple templates, and STL containers (std::vector mapped onto the same AQIR primitives as an AQVL ARRAY, std::map onto HASHMAP-equivalent primitives) — and explicitly excluding multiple inheritance, move semantics, and generic template metaprogramming.
Do NOT write adapter code in this sub-phase. Do NOT scope in anything that would require a fundamentally different capture mechanism than Phase 9.1's chosen approach — if something requires that, flag it as out of scope rather than reopening the capture-strategy decision.
What to test/verify: Sanity-check the scope against 2-3 example C++ programs you sketch out, confirming they fit.
Deliverable: docs/design/phase10-delta-scope.md.
Definition of done: A specific, written C++ delta-scope exists, explicitly building on (not replacing) the Phase 9.2 C scope.`,
      },
      {
        id: '10.2',
        title: 'Semantic normalization extensions',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working normalization extension for C++\'s object model and STL containers, without regressing C support.',
        prompt: `Objective: Extend the Phase 9.3 normalization layer to cover the Phase 10.1 delta — object lifetime/RAII, exceptions, and STL container recognition (mapping std::vector/std::map usage onto the same AQIR primitives as AQVL's own ARRAY/hashmap-equivalent primitives).
Scope: Extend the existing normalization code from 9.3 (do not fork it into a parallel C++-specific module unless a genuine, justified reason emerges); add STL-container-usage detection and object-lifetime event handling.
Do NOT add new AQIR primitives for C++-specific concepts — object lifetime and RAII should map onto existing state-mutation/lifecycle primitives from Phase 2.1, extended only if a specific, documented gap is found. Do NOT scope in template metaprogramming or multiple inheritance per the 10.1 exclusions.
What to test/verify: Unit tests for each new construct in the 10.1 delta, verifying correct normalization to AQIR primitives; run the full Phase 9 corpus to confirm the extension didn't regress C support.
Definition of done: Every construct in the Phase 10.1 delta normalizes correctly, verified by unit tests, with the Phase 9 C corpus still passing unchanged.`,
      },
      {
        id: '10.3',
        title: 'Adapter extension + integration + test corpus',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working, verified C++ integration built directly on Phase 9\'s foundation with no regressions.',
        prompt: `Objective: Extend the Phase 9.4 adapter and Playground integration to accept C++ input within the Phase 10.1 scope, and build a representative C++ test corpus, mirroring Phase 9.5's rigor.
Scope: Extend the existing adapter/integration code (don't duplicate it); build a 5-10 program C++ corpus spanning the 10.1 delta scope specifically (classes, references, simple templates, STL container usage).
Do NOT add any program outside the 10.1 delta scope to the corpus. Do NOT modify the underlying ExecutionEngine/renderer/AQIR layer — same rule as Phase 9.4, this is adapter-side work only.
What to test/verify: Every corpus program's full pipeline run through the Playground, checked for correctness; re-run the Phase 9 C corpus to confirm no regression.
Deliverable: The committed C++ corpus plus docs/design/phase10-cpp-acid-test-report.md.
Definition of done: The C++ corpus passes end to end in the Playground, and the Phase 9 C corpus still passes unchanged.`,
      },
    ],
  },
  {
    number: 11,
    title: 'Python integration',
    summary: 'Trace capture via sys.settrace; the hard part is inferring structure from dynamic usage. Post-IPD.',
    load: 'Medium-High',
    ipd: 'post',
    window: null,
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'A grounded, environment-aware plan for Python execution capture.',
      prompt: `You are about to start Phase 11 of the AQVL roadmap: Python integration via execution tracing. Before writing any code:
1. Read docs/design/phase9-capture-strategy.md and docs/design/phase9-c-acid-test-report.md to understand the adapter architecture template, even though Python's capture mechanism will differ from C's.
2. Research (documentation only, no installation yet) Python's built-in tracing options (sys.settrace, bytecode-level hooks) and confirm what's available in the current development environment.
3. Do NOT make any code changes yet. Report, in your final message, a concrete plan for capturing a step-by-step trace of a simple Python program (e.g. a loop over a list) using sys.settrace or an equivalent mechanism, as the starting point for sub-phase 11.1.`,
    },
    steps: [
      {
        id: '11.1',
        title: 'Execution capture',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working Python execution-capture layer, the foundation for the harder normalization problem that follows.',
        prompt: `Objective: Implement execution capture for Python programs, producing a step-by-step trace (variable writes, control flow, function calls) — technically the easiest capture layer of the four languages, given Python's built-in introspection.
Scope: New code (e.g. packages/lang-python/src/capture.ts or a small companion Python script invoked by it, following this monorepo's conventions) implementing capture via sys.settrace/bytecode-level hooks or an existing tracing library, for one trivial test program first (a simple loop).
Do NOT build the normalization layer or any AQVL integration yet — capture only, verified in isolation. Do NOT scope this to a comprehensive Python feature set — the capture layer just needs to produce a correct trace; the compatibility subset comes later in 11.3.
What to test/verify: The capture mechanism produces a correct, verified-by-hand trace for the trivial test program.
Deliverable: A working capture implementation plus a short note on the chosen mechanism and why.
Definition of done: A working, verified capture layer exists, ready for sub-phase 11.2's normalization work.`,
      },
      {
        id: '11.2',
        title: 'Semantic normalization for dynamic typing',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working normalization layer that solves Python\'s core integration challenge — inferring structure from dynamic usage — with a defined, tested fallback for ambiguity.',
        prompt: `Objective: Map captured Python execution events onto Phase 2.1 AQIR primitives, solving the genuinely hard problem this language introduces: a variable's "kind" (is this list acting as an ARRAY? a dict as a HASHMAP-equivalent?) must be inferred at runtime from usage, not declared.
Scope: New normalization code consuming the 11.1 capture format, implementing runtime-usage-based type inference (e.g. a list indexed/appended like an array maps to array-mutation primitives; a dict accessed by key maps to hashmap-equivalent primitives) with an explicit, documented fallback behavior for ambiguous or unrecognized usage patterns.
Do NOT add new AQIR primitives for Python-specific dynamic-typing concepts — the goal is mapping onto the existing Phase 2.1 set; if something genuinely doesn't fit, document it as a finding rather than extending AQIR quietly. Do NOT attempt to support arbitrary Python semantics — scope to what sub-phase 11.3 will define as the supported subset.
What to test/verify: Unit tests for common container-usage patterns (list-as-array, dict-as-map, simple class instances, basic recursion), verifying correct normalization; explicitly test at least one ambiguous case to confirm the fallback behavior is well-defined, not a crash.
Definition of done: Common Python container usage patterns normalize correctly to AQIR primitives, with a documented, tested fallback for ambiguous cases.`,
      },
      {
        id: '11.3',
        title: 'Adapter implementation + integration + test corpus',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working, scoped Python integration verified against a representative corpus.',
        prompt: `Objective: Build the full Python adapter (capture + normalization) into a working Playground integration, scoped to a small, explicit Python subset, and verify it with a representative test corpus.
Scope: Wire 11.1/11.2 into the Playground alongside AQVL and the Phase 9/10 language adapters; explicitly scope to lists, dicts, basic classes, and simple recursion; explicitly exclude decorators, generators/coroutines, metaclasses, and most of the standard library — write this scope down before building the corpus. Build a 5-10 program corpus within that scope, ideally including programs mirroring the Phase 4/6 AI/ML concepts for a natural narrative tie-in.
Do NOT attempt to support arbitrary third-party-library-heavy Python (numpy/pandas-style code) — stick to plain-Python teaching programs within the declared scope. Do NOT modify ExecutionEngine, AnimationController, or the renderer — same rule as every other language adapter.
What to test/verify: Every corpus program's full pipeline run through the Playground, checked for correctness against expected program behavior.
Deliverable: The committed scope document, corpus, and docs/design/phase11-python-acid-test-report.md.
Definition of done: The corpus passes end to end in the Playground within the declared, deliberately small Python subset.`,
      },
    ],
  },
  {
    number: 12,
    title: 'Solidity integration',
    summary: 'Consume existing EVM trace tooling and map storage/calls/events onto the Phase 5.1 append-only model. Post-IPD.',
    load: 'Medium-High',
    ipd: 'post',
    window: null,
    prereq: {
      model: 'Claude Sonnet 5 Medium',
      outcome: 'A grounded plan for EVM trace capture and its connection to the existing Blockchain domain vocabulary.',
      prompt: `You are about to start Phase 12 of the AQVL roadmap: Solidity integration, the final language phase, leaning directly on the Blockchain domain work from Phases 5 and 7. Before writing any code:
1. Read docs/design/phase5-architecture-verdict.md and the Phase 5.1 StateManager append-only implementation in full — this is the state-transition vocabulary Solidity integration should reuse, not reinvent.
2. Research (documentation only, no installation yet) existing EVM trace tooling available in this environment or installable within it (Hardhat/Foundry trace output, debug_traceTransaction-style tooling) rather than planning to build trace capture from scratch.
3. Read the Phase 9 adapter architecture (capture → normalize → adapter → integration → corpus) as the template to follow.
4. Do NOT make any code changes yet. Report, in your final message, which EVM trace tooling is realistically usable in this environment, and a concrete plan for how contract storage state would map onto the existing Phase 5.1 immutability model, as the starting point for sub-phase 12.1.`,
    },
    steps: [
      {
        id: '12.1',
        title: 'Execution capture via existing EVM tooling',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working EVM capture layer built on existing, proven tooling rather than a risky from-scratch trace mechanism.',
        prompt: `Objective: Implement execution capture for Solidity contract execution by consuming existing EVM trace tooling output (Hardhat/Foundry trace output or debug_traceTransaction-style output), rather than building an EVM trace mechanism from scratch.
Scope: New code (e.g. packages/lang-solidity/src/capture.ts) that invokes or consumes the chosen existing tool's trace output for one trivial test contract (e.g. a simple counter or token-transfer contract), producing a step-by-step trace of storage writes, function calls, and events.
Do NOT build a custom EVM trace mechanism from scratch — the whole point of this sub-phase is to consume an already-existing tool's output. Do NOT build normalization or AQVL integration yet.
What to test/verify: The chosen tool's trace output is correctly parsed and produces a usable, verified-by-hand trace for the trivial test contract.
Deliverable: A working capture implementation plus a short note on the chosen tool and why.
Definition of done: A working, verified capture layer exists, ready for sub-phase 12.2's normalization work.`,
      },
      {
        id: '12.2',
        title: 'Semantic normalization for EVM/contract-storage state',
        model: 'Claude Opus 5.5 Medium',
        outcome: 'A working normalization layer that connects EVM semantics directly to the Blockchain domain\'s existing state model, avoiding a parallel implementation.',
        prompt: `Objective: Map captured EVM execution events — contract storage slot writes, function calls (external/internal), and events — onto Phase 2.1 AQIR primitives, reusing the Phase 5.1 immutability/append-only state model directly rather than building a parallel state concept.
Scope: New normalization code consuming the 12.1 capture format; storage-slot writes map onto state-mutation primitives with the Phase 5.1 immutability semantics applied where the contract's actual state-transition model calls for it (e.g. committed transaction state should not be silently mutable after the fact).
Do NOT add new AQIR primitives for EVM-specific concepts — map onto the existing Phase 2.1 set and the Phase 5.1 immutability model; if something genuinely doesn't fit, document it as a finding. Do NOT attempt to model gas costs or gas optimization in this normalization layer.
What to test/verify: Unit tests for storage writes, function calls, and events from the trivial test contract, verifying correct normalization; confirm the Phase 5.1 immutability guarantees are correctly exercised for committed transaction state.
Definition of done: Contract storage/function-call/event events normalize correctly to AQIR primitives, directly reusing the Phase 5.1 state model, verified by unit tests.`,
      },
      {
        id: '12.3',
        title: 'Adapter implementation + integration + test corpus',
        model: 'Claude Sonnet 5 Medium',
        outcome: 'A working, scoped Solidity integration completing the roadmap\'s four-language adapter architecture.',
        prompt: `Objective: Build the full Solidity adapter (capture + normalization) into a working Playground integration, scoped to a small set of canonical contract patterns, and verify it with a representative test corpus — the final sub-phase of the entire roadmap.
Scope: Wire 12.1/12.2 into the Playground alongside AQVL and the other language adapters; scope explicitly to a small set of canonical patterns (a simple token transfer, a basic voting/state-machine contract); explicitly exclude complex DeFi patterns, assembly/Yul, and gas-optimization-sensitive code. Build a corpus covering just those canonical patterns.
Do NOT attempt to visualize gas costs/optimization or multi-contract call chains in this pass — single-contract state transitions are the teachable core and the explicit scope boundary. Do NOT modify ExecutionEngine, AnimationController, or the renderer.
What to test/verify: Every corpus program's full pipeline run through the Playground, checked for correctness against expected contract behavior, including that committed state is correctly immutable per Phase 5.1/12.2's model.
Deliverable: The committed scope document, corpus, and docs/design/phase12-solidity-acid-test-report.md.
Definition of done: The corpus passes end to end in the Playground within the declared canonical-pattern scope, completing the language-integration portion of the roadmap.`,
      },
    ],
  },
];

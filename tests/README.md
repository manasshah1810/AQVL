# @aqvl/tests

Vitest test suite for the AQVL compiler pipeline (lexer → parser → semantic
validation → optimizer → AQIR generator) and the runtime VM.

## How to run

From the repo root or from this directory:

```bash
pnpm test            # run the full suite once
pnpm test:watch      # watch mode
pnpm test:coverage   # run once with a v8 coverage report
```

(`pnpm test` at the repo root delegates to `pnpm --filter @aqvl/tests test`.)

### Coverage

`pnpm test:coverage` reports coverage for the compiler (`packages/compiler/src`)
and the VM core (`packages/runtime/src/VirtualMachine.ts`, `types.ts`,
`index.ts`) — it deliberately excludes the renderer/animation subsystem
(`AnimationController`, `SceneManager`, layouts, ...), which is a separate
surface with no tests yet and isn't part of this suite's scope.

`vitest.config.ts` sets an **80% target threshold** (lines/statements/functions/
branches) for that scope. The current baseline is **~62%** statement/line
coverage (81%+ on functions), so `test:coverage` currently exits non-zero on
the unmet threshold even though every test passes — that's expected until
more unit tests are added. `pnpm test` (no coverage) is unaffected and always
reflects pass/fail correctly. Lower the thresholds in `vitest.config.ts` if
you want the coverage command to pass locally as you build coverage up
incrementally.

## Directory structure

```
tests/
  integration/   end-to-end tests: real source -> compile() -> AQIR -> VM
  unit/          focused tests for one pipeline stage at a time
  utils/         shared test helpers (see below)
  vitest.config.ts
```

## File naming

- One file per pipeline stage/concern: `unit/lexer.test.ts`, `unit/parser.test.ts`,
  `unit/codegen.test.ts`, etc.
- Test files must end in `.test.ts` and live under `integration/` or `unit/`
  (see `include` in `vitest.config.ts`).
- Group related assertions with `describe`; name `it` blocks as a sentence
  describing the observable behavior, not the implementation ("throws
  TokenError on an unexpected character", not "test error case 3").

## Adding a test

1. Pick `unit/` for a single stage (lexer, parser, codegen) in isolation, or
   `integration/` for a full source → VM run.
2. Import what you need from `../utils/testHelpers` rather than constructing
   `Lexer`/`Parser`/`AQVLVirtualMachine` by hand — it keeps tests short and
   consistent, and is the one place that would need updating if a pipeline
   stage's constructor signature changes.
3. If your test calls `compile()` (the full pipeline) directly or through
   `executeAQVL`, silence `console.log` in a `beforeAll`/`afterAll` — `compile()`
   logs a full token/AST/AQIR dump on every call, which floods `vitest run`
   output otherwise:

   ```ts
   beforeAll(() => {
     vi.spyOn(console, 'log').mockImplementation(() => {});
   });
   afterAll(() => {
     vi.restoreAllMocks();
   });
   ```

## Helpers (`utils/testHelpers.ts`)

| Helper | Signature | Purpose |
| --- | --- | --- |
| `lex` | `(source: string) => Token[]` | Runs only the lexer. |
| `parse` | `(tokens: Token[], source?: string) => ProgramNode` | Runs only the parser over a token stream. |
| `parseSource` | `(source: string) => ProgramNode` | Convenience: `parse(lex(source))`. |
| `compile` | `(source: string) => VMInstruction[]` | Full pipeline; returns the generated AQIR instructions. |
| `executeAQVL` | `(source: string) => Promise<ExecutionResult>` | Compiles and runs `source` on a real VM. |
| `expectError` | `(fn: () => unknown, ErrorType) => void` | Asserts `fn` throws an instance of `ErrorType`. |
| `getASTPaths` | `(ast: unknown) => string[]` | Flattens an AST into dotted `path:NodeType` strings, e.g. `"scenes[0].sequence.statements[0]:WaitNode"`, for asserting shape without a full fixture. |

None of these mock anything — they exercise the real lexer/parser/generator/VM,
matching the existing `integration/` tests.

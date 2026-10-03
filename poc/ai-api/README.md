# AI API Proof of Concept

## AQVL Validator (`validate.ts`)

`validate.ts` is a standalone CLI harness designed to validate AQVL (AlgoQuest Visualization Language) code against the existing compiler pipeline. It runs the exact same compilation sequence (Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator) used in the web application and reports whether the code is valid. If invalid, it pinpoints the exact compilation stage and returns a readable error message, which can be fed back to an AI agent for correction.

### CLI Usage

```bash
npx tsx poc/ai-api/validate.ts <file.aqvl>
```

### Return Shape

The validator returns a JSON payload and exits with `0` for success and `1` for failure.

```json
{
  "valid": boolean,
  "stage": string,
  "errors": string[]
}
```

### Example Valid Invocation

```bash
npx tsx poc/ai-api/validate.ts valid.aqvl
```
Output:
```json
{
  "valid": true,
  "stage": "AQIRGenerator",
  "errors": []
}
```

### Example Invalid Invocation

```bash
npx tsx poc/ai-api/validate.ts invalid.aqvl
```
Output:
```json
{
  "valid": false,
  "stage": "SemanticValidator",
  "errors": [
    "[error] Line 3, Col 9: Undeclared variable 'x'."
  ]
}
```

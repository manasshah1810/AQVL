# AQVL PoC AI Endpoint Evaluation Report

**Evaluation Date:** October 4, 2026

## Evaluation Conditions
- **Branch/Commit:** `yash/ai-api-poc` (current HEAD)
- **Implementation Tested:** Y5 (Validate-and-Retry loop inside `server.ts`)
- **Prompt Configuration:** Y3 `SYSTEM_PROMPT` and `FEW_SHOT_EXAMPLES` in `poc/ai-api/prompt.ts`
- **Provider/Model:** OpenAI-compatible API (Groq) using the model `openai/gpt-oss-20b`.
- **Endpoint:** `POST /generate` with automatic Y2 compilation checking and up to 2 retries on failure.
- **Protocol:** Exactly 20 topics, one endpoint run per topic. No prompt tuning, no implementation changes, no syntax fabrication. 45-second delays were added between requests to avoid rate limits as much as possible, though the retry logic naturally exceeded TPM limits on complex corrections.

---

## Final 20-Topic List and Results

| # | Topic | Valid (Compiled) | Attempts | Visual Match | Errors / Notes |
|---|---|---|---:|---|---|
| 1 | Bubble sort | **Yes** | 1 | **Yes** | Visualizes swapping correctly |
| 2 | Linear search | **Yes** | 1 | **Yes** | Visualizes comparisons and highlights target |
| 3 | Binary search | **Yes** | 1 | **No** | Passed compile but crashed in Runtime: `Index 4.5 is out of bounds` (Float division) |
| 4 | Array reverse | **Yes** | 1 | **Yes** | Visualizes correct swaps |
| 5 | Stack push and pop | No | 0 | N/A | Provider returned empty content |
| 6 | Queue enqueue and dequeue | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 7 | Singly linked-list insertion | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 8 | Singly linked-list traversal | **Yes** | 1 | **Yes** | Correctly traverses pointers visually |
| 9 | Binary tree insertion | No | 0 | N/A | Provider returned empty content |
| 10 | BST insertion | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 11 | BST search | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 12 | Binary tree traversal | **Yes** | 2 | **Yes** | Correctly animates tree traversal (took 2 attempts to compile) |
| 13 | BFS | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 14 | DFS | No | 0 | N/A | Provider API error: 429 (Rate Limit Exceeded) |
| 15 | Graph traversal | No | 0 | N/A | Provider returned empty content |
| 16 | Factorial recursion | **Yes** | 1 | **No** | Prints correctly but lacks 3D animation (No HIGHLIGHT/SWAP) |
| 17 | Fibonacci recursion | **Yes** | 1 | **No** | Prints correctly but lacks 3D animation (No HIGHLIGHT/SWAP) |
| 18 | For-loop accumulation | **Yes** | 1 | **Yes** | Highlights elements and prints sum |
| 19 | Find maximum in an array | **Yes** | 1 | **Yes** | Highlights elements and finds max |
| 20 | Array traversal | **Yes** | 1 | **Yes** | Highlights elements correctly |

---

## Pass Rates
- **Compile-Pass Rate:** 11 / 20 (55%)
- **Visual-Correctness Rate:** 8 / 11 visually checked (72.7%)

## Compile Failures
The 9 topics that failed compilation (Topics 5-7, 9-11, 13-15) were entirely due to the API provider returning `429 Rate Limit Exceeded` (specifically exceeding the Tokens Per Minute limit during generation or retry) or returning empty content (often a symptom of content filtering or rate limit). The Y5 server retry loop accurately marked these as invalid since no code could be compiled.

## Visual-Correctness Failures
- **Topic 3 (Binary search):** Passed the compiler validation, but the generated code used a float value for the array index (`mid = 4.5`), causing a runtime crash in the Playground.
- **Topic 16 (Factorial recursion) & Topic 17 (Fibonacci recursion):** The generated code passed the compiler and computed the correct mathematical results via `PRINT`, but completely failed to generate any 3D animation (e.g., no `HIGHLIGHT` or `POINTER` usage). Since this is an animation language, a purely text-based output is a visual failure.

---

## Manas Spot-Check Set
Manas, please review these 3 representative rows. You can copy the generated code for these from `scratch/verify_tasks.json` or try generating them again via the `POST /generate` endpoint:

1. **Row 1: Bubble sort** (Successful compilation and perfect visual match)
2. **Row 3: Binary search** (Demonstrates a compiler false-positive where a float index passes compilation but crashes the runtime)
3. **Row 12: Binary tree traversal** (Demonstrates the Y5 retry loop successfully repairing a compilation error on attempt 2 to produce a working visualization)

---

## Post-Evaluation Reassessment

Later manual Playground inspection of the AQVL runtime behavior established:
- **Factorial recursion:** visual PASS (The runtime natively visualizes the call stack)
- **Fibonacci recursion:** visual PASS (The runtime natively visualizes the call stack)
- **Binary Search:** runtime failure is intrinsic to the original `/2` formulation due to AQVL's JavaScript-style floating-point division semantics. A corrected, integer-safe midpoint formulation (`size = high - low; mid = low + (size - size % 2) / 2`) works perfectly.

*Note: This is a later reassessment and does not alter the original recorded Y6 measurements (11/20 baseline).*

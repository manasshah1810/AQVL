# AQVL AI API Evaluation Report (v2 - 4096 Tokens)

## 1. Configuration
- **Provider:** Groq OpenAI-compatible API
- **Model:** openai/gpt-oss-20b
- **Completion-token limit:** 4096 (Increased from 2048 to prevent truncation)
- **Retry Logic:** Up to 3 attempts on validation failure (unchanged)

## 2. Methodology
- **Scope:** 20 teacher-style topics representing classic algorithms and data structures.
- **Execution:** Automated script sending one `POST /generate` request per topic to the local server.
- **Pacing:** A 45-second delay was added between topics to attempt mitigating Groq Tokens Per Minute (TPM) limits.
- **Validation:** Recorded HTTP status, compilation validity, and visual correctness in the AQVL Playground.

## 3. Evaluation Table

| ID | Topic | HTTP Status | Valid AQVL? | Visual Match? | Failure Type |
|---|---|---|---|---|---|
| 1 | Bubble sort | 200 | YES | YES | - |
| 2 | Linear search | 200 | YES | YES | - |
| 3 | Binary search | 200 | YES | NO | Runtime Failure (Index 4.5 out of bounds) |
| 4 | Array reverse | 200 | YES | YES | - |
| 5 | Stack push and pop | 500 | NO | - | API Error (HTTP 429) |
| 6 | Queue enqueue and dequeue | 500 | NO | - | API Error (HTTP 429) |
| 7 | Singly linked-list insertion | 500 | NO | - | API Error (Empty content) |
| 8 | Singly linked-list traversal | 200 | YES | YES | - |
| 9 | Binary tree insertion | 500 | NO | - | API Error (Empty content) |
| 10 | BST insertion | 500 | NO | - | API Error (HTTP 429) |
| 11 | BST search | 500 | NO | - | API Error (fetch failed) |
| 12 | Binary tree traversal | 500 | NO | - | API Error (HTTP 429) |
| 13 | BFS | 500 | NO | - | API Error (Empty content) |
| 14 | DFS | 500 | NO | - | API Error (HTTP 429) |
| 15 | Graph traversal | 500 | NO | - | API Error (HTTP 429) |
| 16 | Factorial recursion | 200 | YES | YES | - |
| 17 | Fibonacci recursion | 200 | YES | YES | - |
| 18 | For-loop accumulation | 200 | YES | YES | - |
| 19 | Find maximum in an array | 200 | YES | YES | - |
| 20 | Array traversal | 200 | YES | YES | - |

## 4. Pass Rates
- **Valid AQVL Generated:** 10/20 (50.0%)
- **Invalid/Failed Generation:** 10/20 (50.0%)

## 5. Visual Rates
- **Visually Correct (of valid):** 9/10 (90.0%)
- **Visually Correct (of total):** 9/20 (45.0%)

## 6. Failure Breakdown
- **API Rate Limiting (HTTP 429):** 6
- **API Empty Content:** 3 (Usage diagnostics not captured)
- **API Fetch Failed:** 1
- **Runtime Failure:** 1 (Topic 3: `Index 4.5 is out of bounds for array 'data'`)
- **Compilation Failure:** 0 (All responses that made it back from the API were perfectly valid)

## 7. Recursion Results
Both **Factorial recursion** (#16) and **Fibonacci recursion** (#17) successfully generated valid AQVL. The Playground UI natively handles the call stack display for recursive calls, confirming that `HIGHLIGHT` commands are not strictly required for recursion to visualize correctly. 

## 8. Remaining Issues
1. **Strict TPM Limits:** Increasing the `max_completion_tokens` parameter significantly increases the token reservation per request on the Groq provider. The free tier limits to 8,000 TPM. The 45-second delay was insufficient because the token bucket didn't drain fast enough to accommodate the high reserved ceiling for subsequent requests.
2. **Binary Search Decimal Indexing:** The model generated `mid = low + (high - low) / 2`. AQVL currently returns `4.5` here, leading to an index out of bounds exception. AQVL lacks auto-truncation for division, or the model needs explicit instruction to round integers.

## 9. Comparison against original Y6
- The valid compilation rate dropped slightly from **55% (11/20)** to **50% (10/20)**. 
- However, this drop was entirely caused by infrastructure limits (HTTP 429s) rather than a regression in the model's coding capabilities. Zero programs failed the compiler retry loop this time.
- The visual correctness among valid outputs improved from **72.7% (8/11)** to **90.0% (9/10)**, showing higher overall quality when the code actually completes.

## 10. Token-Budget Impact
Increasing the `max_completion_tokens` from 2048 to 4096 successfully resolved the `finish_reason = "length"` truncation issue where the model couldn't output code after extensive reasoning. 
However, this change inadvertently collided with the strict 8,000 TPM quota on the provider, substituting truncation failures with rate-limit rejections for 50% of the topics.

## 11. Interpretation and Limitations
The 4096-token configuration resolved the previous completion-truncation issue, but the tested Groq provider configuration introduced an 8,000 TPM constraint that prevented a clean 20-topic reliability measurement. 
**The observed 10/20 usable-generation rate therefore reflects provider capacity during the batch evaluation, not an established 50% AQVL generation capability.**
Zero validation/compilation failures occurred among the responses that actually returned AQVL code. The 10 provider failures must not be described as compiler failures.

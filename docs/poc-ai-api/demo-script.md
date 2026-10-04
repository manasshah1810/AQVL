# AQVL AI API Demo Script

This document provides a repeatable 5-minute script and workflow for demonstrating the AQVL AI API proof of concept. Follow this guide carefully to ensure a reliable demonstration.

## 1. Setup

Before starting the demonstration, ensure the following local setup is running:

1. **Start the API Server**  
   Open a terminal in the workspace root and run:
   ```bash
   npx tsx poc\ai-api\server.ts
   ```
   *The server must be running on `http://localhost:3000`. The provider API key must be configured in the server's `.env` file and must never be exposed to the browser or committed to Git.*

2. **Start the Playground Server**  
   Open a second terminal and run:
   ```bash
   pnpm --filter demo dev
   ```
   *The Vite dev server should start on `http://localhost:5173`.*

3. **Open the Demo Page**  
   The demo file is located at `poc/ai-api/demo.html`. Because this file is outside the React Playground application, it can be opened through Vite's `/@fs/` filesystem route.
   
   The `/@fs/` URL must use the absolute path to your OWN AQVL repository. Do not copy another developer's absolute filesystem URL.
   
   For example, if your repository is located at `C:\Projects\AQVL`, your demo URL would be:
   ```
   http://localhost:5173/@fs/C:/Projects/AQVL/poc/ai-api/demo.html
   ```
   
   Spaces and special characters in the path may need URL encoding. For example, `C:\My Projects\AQVL` becomes:
   ```
   http://localhost:5173/@fs/C:/My%20Projects/AQVL/poc/ai-api/demo.html
   ```
   
   *(Note: `/@fs/` is the local serving mechanism used by this standalone PoC. The absolute filesystem path inside that URL is machine-specific, while the repository-relative file path is always `poc/ai-api/demo.html`).*

## 2. The 5-Minute Demo Flow

### 0:00–0:30: Introduction
- Have the demo page open and the API/Vite servers running in the background.
- **Explain the concept:** "The teacher enters an algorithm topic and the PoC asks the AI service to generate AQVL."

### 0:30–1:30: Flow 1 — Bubble Sort
1. Enter **Bubble sort** into the topic input.
2. Click **Generate**.
3. Wait until the page shows "Success! Generated valid AQVL...".
4. Show the generated AQVL source code.
5. Click **Copy code**.
6. Click **Open Playground** (this opens `http://localhost:5173/#/playground` in a new tab).
7. Paste the copied code into the editor.
8. Click **Compile & Run** and observe the 3D visualization.

### 1:30–2:30: Flow 2 — Linear Search
1. Return to the demo page.
2. Enter **Linear search** and click **Generate**.
3. Show the generated code and click **Copy code**.
4. Click **Open Playground**, paste the code, and click **Compile & Run**.
5. **Talking point:** Point out that the teacher does not need to manually write AQVL for this demonstration.

### 2:30–3:30: Flow 3 — For-loop Accumulation
1. Return to the demo page.
2. Enter **For-loop accumulation** and click **Generate**.
3. Copy the code, open the Playground, paste, and run.
4. Show the successful execution and visualization.

### 3:30–5:00: Summary and Limitations
- Summarize what the PoC demonstrates.
- Explicitly explain the known limitations outlined in Section 4 below.

## 3. Presenter Talking Points

- **This is a proof of concept**, not the final AI architecture.
- The AI generates AQVL rather than directly modifying the visualizer.
- The existing AQVL compiler, runtime, and Playground remain the true execution path.
- The teacher can inspect the generated AQVL before running it.
- The demo intentionally uses a small set of verified topics.
- Generated AQVL should still be treated as model output and verified before being trusted.

*(Do not claim universal algorithm coverage, guaranteed valid generation, guaranteed visual correctness, deterministic AI output, provider independence, or production readiness.)*

## 4. Known Limitations (Based on Y6 Evaluation)

Please communicate these limitations honestly during the demo:

1. **Provider / Token Limitations:** The v2 20-topic batch evaluation produced 10/20 usable generations. However, this 50% rate was strongly affected by the provider's token quota (an 8,000 TPM limit triggered HTTP 429 errors). Increasing the configuration to 4096 tokens resolved truncation issues, but heavily constrained the provider capacity. Do not present this 50% figure as the intrinsic capability of the AI.
2. **Validation / Compilation:** Among the responses that successfully returned AQVL from the API during the v2 evaluation, 0 compilation failures were observed. (Do not claim this means *all* possible generated programs will compile).
3. **Binary Search Numeric Semantics:** A known generated implementation for Binary Search (`mid = low + (high - low) / 2`) can produce floating-point results like `4.5`, causing a runtime array bounds failure. The compiler/runtime semantics were not changed for this demo; an integer-safe formulation exists but must be manually verified.
4. **Visual Correctness:** Out of the 10 successfully generated programs in the v2 batch, 9 (90%) were visually correct. Recursive implementations (like Factorial and Fibonacci) are handled natively by the runtime's call stack visualization.
5. **Provider Dependence:** The current PoC depends on the availability and quota of the configured OpenAI-compatible provider.
6. **Manual Playground Step:** The current flow requires the teacher to copy and paste the AQVL into the Playground manually. The demo does not automatically inject code into the editor.
7. **Temporary PoC:** This is intentionally a removable experiment and is not integrated into the main Playground navigation.

## 5. Troubleshooting

- **If the API does not respond:** 
  - Confirm the API server is running on port 3000.
  - Check the provider environment configuration in `.env`. 
  - *Never paste the provider key into browser code.*
- **If the demo page does not load:** 
  - Confirm the Playground/Vite server is running on port 5173.
  - Use the local standalone filesystem serving method (`/@fs/...`) with the absolute path to your OWN AQVL repository. Do not use another developer's path.
  - *Do not modify `packages/demo` just to make the PoC work.*
- **If generation returns a provider error or 429:** 
  - Explain that provider quota/rate limits can affect the PoC.
  - *Do not claim the AQVL compiler is broken.* Retry only according to the provider's availability.
- **If Playground execution fails:** 
  - Inspect the generated AQVL. Distinguish between generated-code/runtime behavior and an actual provider failure.
  - *Do not modify the compiler or runtime as part of this demo procedure.*

## 6. Verification Checklist

**Presenter Checklist:**
- [ ] API server started
- [ ] Playground started
- [ ] Demo page opened
- [ ] Bubble sort generated
- [ ] Bubble sort ran in Playground
- [ ] Linear search generated
- [ ] Linear search ran in Playground
- [ ] For-loop accumulation generated
- [ ] For-loop accumulation ran in Playground
- [ ] Generated AQVL was visible before execution
- [ ] Presenter explained known limitations

*Note: The Y7 verification process recorded these three flows end-to-end in `docs/poc-ai-api/y7-demo-verification.mp4`.*

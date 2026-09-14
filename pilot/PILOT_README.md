# Harness-Validation Pilot — README (v2, corrected harness)

**Read this before looking at anything under `pilot/` or the `PILOTGLM` runs:**
this pilot validates the benchmark *machinery*, not any research hypothesis. None of
the pilot data is research data and none of it appears in any results claim.

## Correction history (important)

An independent review found that the frozen ESLint config lacked runtime globals, so
the pilot's original "16 lint errors" were entirely `no-undef` hits on `require` /
`process` — a harness defect misclassified as model failure. The config was fixed
(Node + browser globals added), three further review-driven fixes were applied
(audit-failure no longer silently passes; SPA-aware debug probe; raw tool outputs
persisted), and all three pilot suites were re-executed on 2026-09-14 with the
corrected harness. The tables below are the corrected (v2) numbers. The original
(v1) numbers were 14/6 → 14/7 → 15/6 pass/fail; they are superseded.

## What was actually executed (2026-09-14)

| Phase | Executed? | Artifact |
|---|---|---|
| App generation (iteration 0) | YES — GLM (z-ai-web-dev-sdk) from the frozen APP-01 prompt + a pilot-only platform note | `pilot/app-r1-i000/` |
| Full oracle suite (iteration 0) | YES — 39 checks | `data/raw/runs/APP-01-PILOTGLM-r1-i000/` |
| Deterministic feedback generation | YES | `.../feedback.txt` |
| LLM repair (iteration 1) | YES — same LLM, full sources in/out | `pilot/app-r1-i001/` |
| Full oracle suite (iteration 1) | YES — whole-suite rule | `data/raw/runs/APP-01-PILOTGLM-r1-i001/` |
| Second repair + suite (iteration 2) | YES | `pilot/app-r1-i002/`, `.../i002/` |
| Metrics + ledger + trajectory plot | YES | `data/processed/`, `results/` |

## Measured pilot trajectory (v2, corrected harness; harness validation only)

| Iteration | pass | fail | na | Transition (primary estimand) |
|---|---|---|---|---|
| i0 | 19 | 16 | 4 | — |
| i1 | 18 | 17 | 4 | RSR 0/16, **RR 1/19 (SEC-005 pass→fail)**, NQC −1 |
| i2 | 19 | 16 | 4 | RSR 1/17 (SEC-005 repaired), RR 0/18, NQC +1 |

The single regression is diagnostic gold: after feedback about cookie/token storage,
the builder moved the session token into a cookie **without** the required
HttpOnly/SameSite flags (regression), then added the flags at iteration 2 (repair).
Persistent failures across all iterations: the app has **zero `data-testid`
attributes** (so every UI-driven check fails on selector timeout — the interface
contract is doing its job), no root route (BUILD-004), a stateless JWT that survives
logout (AUTHZ-006), a response-shape deviation (`patient_id`/`patient_email` vs the
contract's `patient`; DB-004), and 1 high + 1 critical dependency vulnerability
(SEC-003). These are the model's repair dynamics measured by a corrected harness.

## Harness defects found via the pilot + reviews, and fixed (all pre-data)

1. Prompt-body extraction bug in `pilot/generate.mjs` (frozen prompt truncated).
2. JSON/base64 output protocol replaced with a raw file-block protocol after
   truncation failures at the 4096-token cap.
3. `better-sqlite3@^8` has no Node 24 prebuild; harness installed v11 for the pilot
   app (dependency issues are the app's own BUILD-001 outcome in research runs).
4. Health check only accepted HTTP 200; redirects (/ → /login) misclassified as
   dead. Now accepts 200/3xx for reachability; BUILD-004 records the status.
5. Orphaned servers survived `proc.terminate()` on `shell=True`; now process-group
   kills and dynamic port allocation (both runner and engine).
6. Semgrep rules YAML had unquoted brace patterns (invalid config) → quoted; SEC-001
   exit-code semantics corrected (findings=fail, config errors=env-error).
7. Playwright `--pass-with-no-test` flag typo; helpers.mjs missing `test` re-export;
   missing FUNC-002 logout tests in all three specs.
8. Cross-iteration state pollution: file-DB reset between suite executions (logged).
9. **(Review-found)** ESLint config lacked Node/browser globals → all pilot lint
   failures were harness artifacts. Fixed; pilot re-run.
10. **(Review-found)** `npm audit` failure silently passed SEC-003 → now env-error.
11. **(Review-found)** raw scanner outputs were not persisted → now written under
    `data/raw/runs/<id>/raw/`.
12. **(Review-found)** SPA catch-all made any 200 on /debug look like a debug
    endpoint → probe now baselines against the root response.
13. **(Review-found)** serial-mode Playwright skips masked downstream checks →
    specs de-serialized; state-dependent tests made self-sufficient.
14. **(Review-found)** SEC-005 token-variant verdict was discarded by dedup →
    replace-in-place semantics.
15. **(Review-found)** cross-owner probe fabricated id "0" when setup failed →
    probe now skipped with a recorded skip.

## What this pilot does NOT show

- Nothing about Lovable, Bolt, Replit, or any commercial builder.
- Nothing about the three study applications beyond APP-01.
- Nothing about iteration 3, about category differences, or about any research RQ.
- Any result suitable for the manuscript's Results section.

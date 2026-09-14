# Revision Log

Disposition of every finding from the four review passes. Reviews are in `reviews/`.
Findings marked FIXED were changed pre-data; DEFERRED items are documented as
limitations or future work rather than silently ignored.

## From Reviewer #2 (reviews/reviewer2-report.md)

| ID | Finding | Disposition |
|---|---|---|
| M1 | Contract-compliance bias not measured | FIXED (protocol §9 scope wording in manuscript; failure categories already separate contract-facing checks; RQ1 scoped to "failures under the frozen contract" in sec-front.tex) |
| M2 | Operator integrity of delivered feedback | FIXED (protocol v1.0.2 amendment 11: automated byte-compare of delivered feedback vs fresh re-render) |
| M3 | Platform version drift unmodeled | FIXED (protocol v1.0.2 amendment 7: bounded sessions per cell, descriptive treatment) |
| M4 | Pseudo-replication at attempt level | FIXED (protocol v1.0.2 amendment 3; stated in manuscript Analysis Plan) |
| M5 | Thin categories for RQ3 inference | FIXED (protocol v1.0.2 amendment 5: estimable categories pre-committed) |
| M6 | Preregistration statement placement | FIXED (manuscript §Analysis Plan now repeats the pre-data freeze statement) |
| m1 | BUILD-004 redirect target | DEFERRED (status recorded; target verification listed in future work) |
| m2 | Retry cap | FIXED (protocol v1.0.2 amendment 6) |
| m3 | Cite matrix as artifact | FIXED (paper §2 references repository artifacts incl. the matrix) |
| m4 | A11Y interactive-state scope | DOCUMENTED (specs state the three audited pages; scope explicit) |
| m5 | Inter-check transition matrix in pilot audit | PARTIAL — pilot README shows full transition lists; suite-level matrices listed as analysis-script TODO |
| Q1–Q4 | Builder deletes feature / framework swap / model wording / why 3 iterations | Answered in manuscript §Threats and protocol §12 (feature deletion = check failure by construction; dependency-manifest diff recorded; RQ5 demoted; 3 iterations fixed a priori) |

## From the independent AI review (reviews/independent-ai-review.md)

| ID | Finding | Disposition |
|---|---|---|
| 1 | ESLint config missing globals; pilot LINT failures were harness artifacts | FIXED (globals added; pilot v2 re-run; LINT-001 now passes; PILOT_README v2 documents the correction) |
| 2 | metrics.py deviated from protocol §9 (denominator restriction, no exclusion accounting) | FIXED (metrics.py implements protocol-literal + amended primary estimands with exclusion ledger; protocol v1.0.2 amendment 1) |
| 3 | Scale narrative inconsistent (45–60 vs 39 checks) | FIXED (protocol v1.0.2 amendment 2; manuscript §4 corrected to the frozen catalog numbers) |
| 4 | Provenance defects (identical timestamps, null dep diffs, no schema validation, no retry policy, orphaned-process DB-pass risk, dead SEC-005 branch) | FIXED (t0/t1 timestamps; dep-manifest snapshots + diffs; jsonschema validation in finalize; retry cap amendment; process-group kills + dynamic ports in runner AND engine; SEC-005 replace-in-place) |
| 5 | Statistical plan unimplemented; pooled estimands undefined; model estimand mismatch | FIXED (metrics.py pools with explicit num/den; GLMM plan re-specified per transition type with numeric gate — protocol v1.0.2 amendment 4; bootstrap script to be exercised on study data — DEFERRED until data exists, as pre-registered) |
| 6 | describe.serial skip cascades mask regressions | FIXED (specs de-serialized; state-dependent tests self-sufficient) |

## From the AppSec review (reviews/security-review.md)

| ID | Finding | Disposition |
|---|---|---|
| S1 | npm audit failure silently passes | FIXED (env-error mapping) |
| S2 | Raw scanner outputs not persisted | FIXED (raw/ subdirectory per run) |
| S3 | SEC-005 token-variant verdict discarded | FIXED (replace-in-place) |
| S4 | Cross-owner probe fabricated id "0" | FIXED (skip-with-record semantics) |
| S5 | SEC-002 flags mandated seed credentials; misses fallback-secret idiom | FIXED (seed exemption + env-fallback pattern added to SECRET_PATTERNS) |
| S6 | SEC-004 SPA catch-all false positives | FIXED (root-body baseline) |
| S7 | AUTHZ coverage sparser than "role × route matrix" claim | DOCUMENTED (manuscript wording adjusted: probes cover the frozen contract's matrix; depth is a stated limitation) |
| S8 | Advisory-DB time dependence | DOCUMENTED (protocol v1.0.2 amendment 10) |
| S9 | Manual-verification scaffolding | DOCUMENTED (process defined in protocol §6.4; template directory data/raw/manual-verification/ created at study start) |

## From the statistics review (reviews/statistics-review.md)

| ID | Finding | Disposition |
|---|---|---|
| T1 | metrics.py:49–50 denominator restriction | FIXED (see independent-2 above; primary/secondary estimands + ledger) |
| T2 | Mixed model does not estimate transition-specific estimands | FIXED (two transition datasets; numeric fallback gate) |
| T3 | "Adequate cell support" gate undefined | FIXED (numeric gate: ≥10 contributing applications per transition type) |
| T4 | BH families need enumerated contrasts | FIXED (amendment 5) |
| T5 | Stale §2 arithmetic | FIXED (amendment 2) |
| T6 | Cascade sensitivity aim | FIXED (sensitivity re-aimed at BUILD-status-change transitions; documented in analysis plan wording) |
| T7 | na-reason taxonomy | FIXED (amendment 12) |
| T8 | Retry cap missing | FIXED (amendment 6) |
| T9 | Pre-data MDE/precision statement | PARTIAL — approximate precision discussed in manuscript; formal MDE simulation deferred to study-data stage (pre-registered as such) |

## Post-revision verification

After fixes 1–15 (pilot README list), all three pilot suites were re-executed and
the full pipeline (ledger → metrics → plot) re-run successfully on the corrected
data. LINT-001 passes in all three pilot iterations, confirming the reviewer's
diagnosis that the original lint failures were harness artifacts.

# FINAL VERIFICATION REPORT

**Audit date:** 2026-09-14
**Auditor:** Cipher (with automated tooling; every claim below was re-checked
against repository artifacts at audit time)

## The 15 quality-gate questions

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Is there a clear research gap? | YES, stated as a coverage gap (not a "first") | `docs/lit-review/novelty-assessment.md`; 24 verified references; adjacent-work synthesis |
| 2 | Did we actually collect the data? | **NO — and the manuscript says so.** The commercial-builder experiment was NOT executed. The only executed empirical activity is the harness-validation pilot (excluded from research data) | `paper/sec-body1.tex §Status of Results`; `pilot/PILOT_README.md`; raw run records |
| 3 | Can every number be reproduced? | YES for pilot numbers (scripts regenerate metrics from raw JSONL; no hand-copied statistics). N/A for research results (none exist) | `analysis/metrics.py`; `results/metrics-summary.json`; `data/raw/runs/*/checks.jsonl` |
| 4 | Can every citation be verified? | YES — 24 scholarly + 5 tool/standard references verified against Crossref/OpenAlex/arXiv/S2; 1 unverifiable candidate (EDIT-Bench) was dropped; 5 metadata corrections made and logged | `reviews/citation-verification.md`; `docs/lit-review/citation_verification.json` |
| 5 | Can every key result be traced to raw evidence? | YES for pilot claims: every check outcome links to checks.jsonl + raw tool output dirs; run records schema-validated | `data/raw/runs/*/raw/`; `benchmark/schemas/*.json` |
| 6 | Are repair and regression defined objectively? | YES, mathematically, pre-data, with primary/secondary estimands and exclusion ledgers (post-review amendment v1.0.2, made pre-data) | protocol §9 + CHANGELOG v1.0.2 |
| 7 | Were all previously passing tests rerun after repairs? | YES — whole-suite rule executed in every pilot iteration | run records i001, i002 contain all 39 checks |
| 8 | Are scanner findings interpreted cautiously? | YES — candidate-finding language, manual-verification procedure, FP sensitivity analysis, no CVSS; audit failures no longer silently pass | protocol §6.4; AppSec review + fixes |
| 9 | Are confounders disclosed? | YES — 11 confounders with mitigations, plus unmitigable ones named | protocol §11; manuscript §Threats |
| 10 | Are conclusions narrower than the evidence? | YES — no research conclusions are drawn anywhere; pilot is explicitly excluded from research claims | manuscript pass |
| 11 | Could an independent researcher reproduce the benchmark? | YES for the harness (README + runbook + pinned oracles + schemas + runner). Builder-side reproduction is inherently bounded by platform drift, documented | README; operator runbook |
| 12 | Could the author explain every methodological choice in an interview? | YES — choices are documented with rationale in protocol + changelog + revision log | repository |
| 13 | Does the repo demonstrate serious engineering independently of the paper? | YES — working oracles (Playwright/axe/Semgrep/ESLint/tsc/API probes), runner, feedback generator, ledger, metrics, schemas, provenance | `oracles/`, `runner/`, `analysis/` |
| 14 | Is the manuscript free of fabricated data? | YES — no research results exist in it; pilot numbers match raw artifacts | verified line-by-line during prose audit |
| 15 | Is anything being called "published" when it is not? | NO — the work is labeled "Research Protocol — Study in Progress" everywhere; career materials use only accurate labels | career/ artifacts |

## Executed vs not executed (the honest ledger)

**Executed (real, verifiable):**
- Literature search: 16 queries, 2026-09-14, raw JSON preserved; 24 references verified; 1 dropped.
- Benchmark implementation: 3 frozen specs, 5 frozen prompts/runbook, 39-check catalog, JSON schemas, Playwright suites, runtime probe engine, Semgrep ruleset, ESLint config, runner, feedback generator, ledger, metrics, plotting.
- Harness-validation pilot: 1 real LLM-generated app (GLM), 3 full suite executions (117 check observations), 2 real repair loops, 1 real regression measured (SEC-005), 1 real repair measured; metrics + trajectory plot generated from raw data.
- Four review passes; 30+ discrete fixes; pilot re-run on corrected harness.
- Manuscript: compiled 11-page protocol PDF; QA PASS.

**NOT executed:**
- Generation of the 18 study applications by Lovable/Bolt/Replit (requires commercial accounts + operator runbook; environment cannot access those platforms).
- The study's repair loops on commercial builders.
- Any statistical analysis of research data (no research data exists).
- OSF preregistration snapshot (git history stands as preregistration artifact; documented in protocol §13).

## Number audit (pilot claims vs raw data)

| Claim | Where | Raw source | Match |
|---|---|---|---|
| 39 checks per suite | paper, protocol | checks.jsonl line counts (39/39/39) | ✓ |
| 19/16, 18/17, 19/16 pass/fail | PILOT_README, paper §8 | checks.jsonl outcome counts | ✓ |
| RSR 0/16 (i0→i1), 1/17 (i1→i2) | paper §8, metrics output | metrics-summary.json transitions | ✓ |
| RR 1/19 (i0→i1), 0/18 (i1→i2) | paper §8, metrics output | metrics-summary.json transitions | ✓ |
| 117 check observations | — | ledger.py output (3 runs × 39) | ✓ |
| Persistent failures list | PILOT_README | checks.jsonl failure details | ✓ |

## AI-use disclosure

The manuscript text was drafted with AI assistance under the author's direction and
was revised by the author, who is responsible for its content. Repository code was
written with AI assistance and tested by execution. Reviewer passes used independent
AI reviewers; their reports are unedited third-party artifacts of this workflow and
are labeled as such. No AI detector was used, and no "human-written" claim is made.

## Sign-off

The project is complete **as a preregistered protocol with a validated harness**, and
is deliberately incomplete as an empirical study. Declaring it complete without the
commercial-builder experiment would violate the research-integrity rules this
project was built under; the path to completion is the operator runbook in
`benchmark/prompts/operator-runbook.md`.

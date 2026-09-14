# VibeGuardBench Research Protocol v1.0.0 (FROZEN)

**Study:** Safeguard Effectiveness in Vibe Coding: An Empirical Evaluation of
Test-Guided Repair and Regression in AI-Generated Full-Stack Web Applications
**Status at freeze:** No experimental data collected. This protocol, the benchmark
specifications, prompts, oracles, and analysis code are frozen before any data
collection, preregistration-style.
**Author:** Sayed Ali Haider Shah (public developer identity: Cipher), GitHub @iamcipherdev
**Freeze date:** 2026-09-14

Any change to this document after data collection begins must be recorded in
`protocol/CHANGELOG.md` as an amendment (v1.x.y) with date and rationale, and must
state whether it was made before or after observing any outcome data. Amendments made
after observing outcomes must be labeled as such and the original rule retained alongside.

---

## 1. Research questions

- **RQ1.** What proportion of objectively detected failures in AI-generated full-stack
  web applications become passing after the same AI builder receives deterministic,
  machine-generated feedback describing those failures?
- **RQ2.** How often do repair attempts introduce regressions, i.e., cause checks that
  passed before the repair to fail after it, measured per failure category?
- **RQ3.** Do repair success and regression rates differ across check categories
  (functionality, authentication/authorization, security, accessibility, build
  reliability, database persistence, type correctness, maintainability)?
- **RQ4.** How do repair success and regression behavior change over up to three
  repeated repair cycles? Does the trajectory show diminishing returns, reversal, or
  oscillation?
- **RQ5 (exploratory, descriptive only).** Do the two studied builders differ in
  repairability and regression profiles? With the planned sample this question supports
  only interval-estimated description, not a powered confirmatory comparison; it will be
  reported as such.

## 2. Study design

Factorial, longitudinal at check level:

- **3 application tasks** (APP-01 appointment booking, APP-02 multi-role SaaS
  dashboard, APP-03 ordering/inventory). Frozen specifications in
  `benchmark/specifications/`.
- **2 AI app builders**, selected under the reproducibility criteria of §4.
- **3 independent repetitions** per task × builder cell, giving **18 initial
  applications (iteration 0)**.
- **Up to 3 repair iterations** per application. An iteration stops early if zero
  checks are failing (nothing to repair; recorded as a terminal pass state) or if the
  builder is unable to produce an exportable result for that iteration (recorded as an
  iteration error, not silently skipped).

**Justification of scale.** The unit of statistical analysis is the *check observation*
(app × iteration × check). The frozen check catalog contains approximately 45–60
applicable checks per application, so the design yields roughly 3,000–4,000 check
observations across 72 iteration-level suite executions (18 apps × up to 4 measured
iterations). At the application level, 18 is small; all application-level claims will be
made with cluster-aware uncertainty and explicitly bounded scope. The design was chosen
over larger grids because (a) commercial builder subscriptions are metered, (b) repair
loops are operator-driven and slow, and (c) 3 repetitions at least permit within-cell
variance estimation under generation randomness.

**What the design does not support:** claims about all AI coding tools, about model
families (builder internals are mostly opaque), or about production software. Claims
will be restricted to the two studied builders, three task specifications, and the
frozen oracle suite.

## 3. Application tasks

Three bounded full-stack applications, chosen to be realistic but not failure-guaranteed
or trivially passable. Each specification (a) defines numbered functional requirements,
(b) freezes an **interface contract** — exact HTTP routes, request/response JSON shapes,
and DOM `data-testid` attributes — so oracles can be deterministic across independently
generated implementations, (c) lists security, accessibility, and persistence
expectations, and (d) enumerates which checks from the frozen catalog
(`benchmark/schemas/check-catalog.json`) apply.

Deliberate design decision: prescriptive interface contracts constrain the builders'
design freedom. This is a trade-off: it sacrifices ecological representativeness of
"idle prompting" in exchange for the measurement validity that deterministic oracles
require. If a builder's generated app violates the interface contract, the affected
checks simply fail — that is a measured outcome, not a setup error. This limitation is
recorded in §11 (Threats).

## 4. Builders

Two systems, selected by the following frozen criteria, in priority order:

1. Can produce a full-stack web application (frontend + backend + persistence) from a
   natural-language specification.
2. Allows export of complete source code (not only hosted artifacts).
3. The exported code can be installed and run locally under the pinned environment
   (§6.1) without a proprietary runtime.
4. Persistent account and session stability across the study window.
5. Documented API or reproducible generation mode preferred, but not required; if
   generation is only available through an interactive UI, the UI operation is
   performed by the human operator following `benchmark/prompts/operator-runbook.md`
   and logged per §7.

Candidate systems named at freeze: Lovable, Bolt (StackBlitz), Replit. The final two
will be chosen at data-collection start under the criteria above; the choice and its
full justification will be recorded in the run log before any generation occurs.

For every run the operator records: platform, subscription tier, exposed model
information (if the platform discloses it — **if the platform does not disclose the
model, the protocol records "not disclosed"; no model will be inferred or guessed**),
platform version, generation mode, date/time, all settings, and the exact prompt text
used.

## 5. Prompt control

- One **frozen initial-generation prompt per task** (`benchmark/prompts/`), identical
  across builders except where a platform imposes hard constraints (e.g., character
  limits). Any platform-forced deviation is logged verbatim with the reason.
- Repair feedback is **generated by software** (`runner/make_feedback.py`) from check
  results, using fixed templates (§8). The operator may not rephrase, expand, or
  "coach" feedback. The only permitted operator edits are logged, and none may alter
  the factual content of a failure message.
- No manual code edits of generated applications at any point. If the local environment
  has a problem (port conflict, missing system package), the operator fixes the
  **environment**, never the application, and logs the intervention; environment
  interventions are recorded in the run record under `env_interventions`.

## 6. Evaluation oracles

### 6.1 Environment pinning

Oracles execute in a pinned environment: recorded OS, Node.js version, npm version,
Python version, browser (Playwright Chromium) version, and exact oracle tool versions.
Dependency installation of generated apps uses `npm ci` where a lockfile exists, else
`npm install` with the recorded resolution. The environment is documented by
`runner/env_report.py` at every suite execution.

### 6.2 Check categories and tools

| Category | Tool / method | Determinism notes |
|---|---|---|
| BUILD | `npm ci/install`, declared build command, server start + HTTP reachability | Exit codes and HTTP status |
| TYPE | TypeScript compiler (`tsc --noEmit`) when the project is TypeScript | Compiler exit code |
| LINT | ESLint with the frozen config in `oracles/build/eslint.config.mjs` | Rule IDs recorded; zero-warnings threshold |
| FUNC | Playwright (Chromium) against the interface contract | Fixed selectors, fixed data, fixed timeouts; see flakiness policy |
| AUTHZ | Playwright-driven authorization probes (role × route matrix) | HTTP status + UI assertions |
| SEC | Semgrep with the frozen ruleset in `oracles/security/`; secret-pattern scan; dependency audit (`npm audit --omit=dev --json`) | Findings mapped to checks; **scanner findings are treated as candidate findings, not confirmed vulnerabilities** (§6.4) |
| A11Y | axe-core via `@axe-core/playwright` on each contract page, WCAG 2.1 A+AA ruleset subset | Violation IDs recorded per page |
| DB | Persistence probes: restart the app server and re-query created records; schema-shape validation of API responses | Pass/fail per probe |

The full machine-readable catalog — check IDs, category, description, applicability per
app, and the exact feedback template per check — is `benchmark/schemas/check-catalog.json`.
It is frozen; adding/removing checks after iteration 0 data exists requires an amendment.

### 6.3 Flakiness policy

A check that produces a different outcome across two identical re-executions is
*flaky*. During the pilot, every oracle is executed twice back-to-back on the same
artifact; checks whose outcome differs are flagged flaky and either made deterministic
or removed before freeze. During the study, each suite execution runs once; any
check that fails with an **environment-class** error (network timeout to localhost,
browser crash) is retried exactly once and the retry is logged. Test-content failures
are never retried.

### 6.4 Security findings: interpretation rules

Semgrep/npm-audit outputs are **not** equated with exploitable vulnerabilities. Rules:

1. Every SEC-category check that fails at an iteration is recorded as a *candidate
   finding*.
2. Before the analysis freeze, each distinct candidate finding is manually inspected;
   the inspection note (one or two sentences, written by the author against the code)
   is stored in `data/raw/manual-verification/`.
3. Findings judged false positives keep their check outcome for the primary metric
   (the oracle is the deterministic tool) but are reported separately in a sensitivity
   analysis where false-positive findings are counted as passing. This separates
   "tool says fail" from "verified weakness".
4. No CVSS scores are assigned. Severity language is avoided in results.

### 6.5 The whole-suite rule

After every repair, **the entire frozen suite re-executes** — every category, every
check, including those that passed before. Never only the failing checks. This rule is
the measurement basis of RQ2 and admits no exceptions.

## 7. Run provenance

Every suite execution produces a run record conforming to
`benchmark/schemas/run-record.schema.json`, stored at
`data/raw/runs/{RUN_ID}/`, containing: run ID (`{TASK}-{BUILDER}-r{REP}-i{ITER}`),
task, builder, repetition, iteration, UTC timestamps, environment report, dependency
manifest diff versus iteration 0, per-check results (machine + raw tool output),
operator interventions, exclusions/retries with reasons, and the exact prompt or
feedback text delivered. Generated app source is archived per iteration at
`generated-apps/{RUN_ID}/`. **Iteration 0 is archived once and never overwritten.**

## 8. Repair loop

Given the iteration-k suite result:

1. `runner/make_feedback.py` groups failing checks (excluding environment-error checks)
   and renders one fixed-template message per failing check plus a preamble:
   deterministic text only, e.g. *"AUTHZ-012 failed: request GET /admin/users as role
   'staff' returned 200; expected 403. Specification APP-02 §S2 requires 403."*
2. The feedback text (plus the interface contract excerpt and the instruction to
   modify the existing application without changing unrelated behavior) is delivered to
   the **same builder session/platform** that produced the app, per the operator
   runbook.
3. The builder's output is exported, archived as iteration k+1, and the full suite
   re-executes (§6.5).
4. Repeat until 3 repair iterations are completed or no checks are failing.

The maximum of 3 repair iterations was fixed a priori to bound cost and to match the
iteration horizon of adjacent work; trajectory claims beyond iteration 3 will not be
made.

## 9. Metrics (frozen before any outcome data)

Per app a and iteration transition k → k+1 (k ∈ {0,1,2}), with outcome function
X_{a,k+1}(c) ∈ {pass, fail, env-error, n/a} for check c:

- Target set: T(a,k) = {c : X_{a,k}(c) = fail}
- Passing set: P(a,k) = {c : X_{a,k}(c) = pass}
- **Repair success rate** RSR(a,k) = |{c ∈ T : X_{a,k+1}(c) = pass}| / |T|, undefined
  when |T| = 0 (recorded, not imputed).
- **Regression rate** RR(a,k) = |{c ∈ P : X_{a,k+1}(c) = fail}| / |P|, undefined when
  |P| = 0.
- **Net quality change** NQC(a,k) = |repaired| − |regressed| (raw counts; no ratio).
- Category-level variants restrict c to a category.
- Environment-error checks are excluded from all numerators and denominators and
  reported separately; n/a checks never enter.
- Raw counts are always retained alongside rates; rates with |T| < 5 or |P| < 5 are
  flagged as small-denominator in analysis output.
- **Dependency caveat (pre-registered):** checks are not statistically independent
  (a build failure cascades). Rates are therefore estimated with application-level
  clustering (§10), and a sensitivity analysis reports rates after excluding cascading
  categories (TYPE/LINT/DB probes) when BUILD fails at iteration k.

## 10. Statistical analysis plan (frozen)

1. **Descriptive:** per-app iteration trajectories; category-level RSR/RR with raw
   counts; no model-free averaging claims without uncertainty.
2. **Uncertainty:** cluster (nonparametric) bootstrap over applications (resample
   apps, not checks) for RSR/RR aggregates; 95% percentile intervals; 2,000 replicates.
3. **Modeling:** mixed-effects logistic regression on check outcomes with random
   intercepts for application and check identity, fixed effects for iteration index
   and category, only if pilot data show adequate cell support; otherwise fallback to
   bootstrap-only inference. Model choice is reported with the reason.
4. **Multiple comparisons:** pre-declared families are (a) category contrasts for RQ3
   and (b) iteration contrasts for RQ4; Benjamini–Hochberg within each family, α=.05.
   No other hypothesis tests are primary.
5. **Effect sizes:** risk differences with CIs; odds ratios from models where a model
   is used. Engineering significance is discussed separately from statistical
   significance; no claim of importance will rest on a p-value alone.
6. **Software:** Python (pandas, statsmodels) and/or R; analysis scripts in
   `analysis/` regenerate every number in the paper from `data/processed/`; no
   hand-copied statistics anywhere in the manuscript.

## 11. Confounding variables and mitigations

| Confounder | Mitigation |
|---|---|
| Hidden model differences between builders | Not mitigable; disclosed; no model-level claims |
| Platform version drift during study | Log versions per run; collect data in a bounded window; report drift |
| Generation randomness | 3 repetitions per cell; report within-cell spread |
| Platform-specific scaffolding/framework choices | Framework is not constrained; dependency manifest logged per iteration; analyses aggregate over framework |
| Different dependency versions across iterations | Dependency manifest diff per iteration recorded; anomalous wholesale upgrades reported qualitatively |
| Prompt interpretation differences | Same frozen prompts; contract section references inside prompts identical |
| Hidden builder-side repair logic | Unknown; disclosed as inherent to studying commercial systems |
| Test interdependencies / cascades | §9 dependency caveat + sensitivity analysis |
| Scanner false positives | §6.4 manual verification + sensitivity analysis |
| Operator variability | Fixed templates; interventions logged; operator = author (disclosed single-operator limitation) |
| App complexity differing by task | Complexity is a design property; per-task analyses reported alongside pooled |
| Repair order within feedback | Feedback order fixed by check ID |

## 12. Exclusion rules (frozen before data collection)

A run (generation or repair iteration) may be excluded and repeated only for:

1. Platform outage or inability to generate (platform-side error).
2. Corrupted or incomplete export (missing files that prevent install).
3. Infrastructure failure unrelated to the application (e.g., local hardware).
4. Generation terminated by a platform error mid-build.

A run **may not** be excluded for poor results, many failures, regressions, or because
the app is too broken to repair — those are measured outcomes. If an application cannot
even be installed, that is a valid iteration-0 result (BUILD checks fail; downstream
runtime checks recorded as n/a — cascade rules in §9 apply). Every exclusion is logged
in `data/raw/exclusions.json` with run ID, date, and reason. Replacements use the same
repetition slot and are marked as retries in the run record.

## 13. Preregistration

This document, the specifications, prompts, check catalog, schemas, and analysis plan
are committed to the public repository at freeze time, with git history serving as the
timestamp. If practical, a snapshot hash is additionally registered with OSF before
data collection; if not practical, the git history stands as the preregistration
artifact and this sentence documents that choice.

## 14. Ethics and safety

- No human subjects; no user data collected.
- Generated applications run only on the local pinned environment; no deployment to
  public hosts during the study.
- Security findings in generated code are reported as study measurements with code
  archived; responsible disclosure is not applicable because no third-party production
  system is tested, but any finding that implies a platform-level defect (in a builder
  product rather than the generated app) will be reported to the vendor before
  publication.
- Source archives may contain hard-coded credentials generated by the builders; these
  are redacted in public archives (replaced by a placeholder) while flagged in run
  records. Redactions are logged so raw→public mappings are auditable.

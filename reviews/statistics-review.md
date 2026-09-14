# Statistical Methodology Review — VibeGuardBench Protocol v1.0.0

**Task ID:** 16 · **Agent:** statistics-reviewer-subagent · **Date:** 2026-09-14T02:20:45Z
**Materials reviewed:** `protocol/protocol-v1.0.0.md` (§2, §9–§12), `paper/sec-front.tex`, `paper/sec-body1.tex`, `analysis/metrics.py`, `analysis/plots.py`, `results/metrics-summary.json`, `pilot/PILOT_README.md`; for cross-checks only: `data/processed/check-observations.csv`, `protocol/CHANGELOG.md`.
**Independence:** nothing under `reviews/` was read. No repository file other than this review and the worklog entry was modified.

---

## SUMMARY

The protocol is unusually honest for its scale: metrics and analysis rules were frozen before outcome data, the estimand chain (RSR/RR/NQC on transition-eligible check observations) is mostly coherent, the application-level cluster bootstrap is the right dependence structure, RQ5 is correctly demoted to interval-estimated description, and the pilot data reconcile exactly with the pipeline output (verified against the raw CSV). The main problems are: (1) a **silent mismatch between the §9 formal metric definitions and `metrics.py`** — the code restricts target/passing sets to checks whose outcome is also observed (pass/fail) at k+1, which the protocol text does not say, and the code logs no exclusion counts, so denominators can drift invisibly; (2) the **planned mixed model estimates marginal pass probability, not the fail→pass / pass→fail transition estimands of RQ1/RQ2**, its random-effects structure omits the repeated (app × check) cell, and its fallback gate ("adequate pilot cell support") is undefined and keyed to a non-study single-app pilot that contains zero regressions — under any support rule it deterministically kills the regression model; (3) **stale design-yield numbers in §2** (45–60 checks/app, 3,000–4,000 observations) contradict the frozen 39-check catalog and the pilot's observed 20/39 eligible rate; (4) the pre-registered cascade sensitivity analysis excludes the wrong categories (TYPE/LINT are static and unaffected by a server-start failure). All fixes are achievable pre-data via CHANGELOG v1.0.2. **Verdict: approve contingent on the required changes below; no fatal flaw.**

---

## FINDINGS

### A. Metric definitions (protocol §9 vs `analysis/metrics.py`)

**F1. STRENGTH — Core definitions are frozen, count-preserving, and implemented as written for the observed-data case.**
T/P sets, RSR/RR numerators, NQC = repaired − regressed, `undefined when |T|=0` (returned as `null`, `metrics.py:57-58`), raw counts alongside rates, and the <5 small-denominator flags (`metrics.py:60-61`) all match §9 (`protocol-v1.0.0.md:216-227`). Category-level restriction of `c` is stated at §9:223.

**F2. REQUIRED-FIX — Transition-eligibility filter in `metrics.py` is not in the protocol text, and the filter's effect is unlogged.**
Protocol §9 defines T(a,k) = {c : X_{a,k}(c) = fail} and RSR = …/|T| (`protocol-v1.0.0.md:216-219`); the only exclusion sentence is "Environment-error checks are excluded from all numerators and denominators … n/a checks never enter" (:224-225). `metrics.py:49-50` implements something stricter:

```python
targets = {c: o for c, o in cur.items() if o == "fail" and c in nxt and nxt[c] in ("pass", "fail")}
passing = {c: o for c, o in cur.items() if o == "pass" and c in nxt and nxt[c] in ("pass", "fail")}
```

i.e. the denominator is |{c ∈ T : X_{a,k+1}(c) ∈ {pass, fail}}| — a fail→env-error, fail→na, or check-missing-at-k+1 case is silently dropped from both numerator and denominator. Under the literal protocol reading such a check stays in |T| and counts as *not repaired*. Both readings are defensible (available-case vs. fixed-denominator), but text and code currently disagree, and neither env-error nor na ever occurred at k+1 in the pilot, so the discrepancy has never surfaced. **Corrected definition to adopt (pre-data amendment):**

> T*(a,k) = {c ∈ T(a,k) : X_{a,k+1}(c) ∈ {pass, fail}}; RSR(a,k) = |{c ∈ T*(a,k) : X_{a,k+1}(c) = pass}| / |T*(a,k)|; P*(a,k) analogously; checks with X_{a,k+1} ∈ {env-error, na} or missing at k+1 are excluded and **counted**. `env-error` at k removes c from T and P at k (as now). Keep the fixed-denominator version as a pre-declared sensitivity analysis to bound the effect.

**F3. REQUIRED-FIX — No exclusion accounting: dropped checks are invisible in the output.**
The transition record (`metrics.py:53-63`) contains no fields for n(env-error) at k, n(na) at k, n(excluded because next ∈ {env-error, na}), or n(missing at k+1). An auditor cannot reconstruct |T*| from raw fail counts. Add `n_enverror_at_k`, `n_na_at_k`, `n_next_enverror`, `n_next_na`, `n_missing_next` per transition, and per-iteration outcome tallies (n_pass/n_fail/n_na/n_env-error per app × category) to the summary JSON. Also assert uniqueness of the (task, builder, repetition, iteration, check_id) key when loading, so replacement-run bookkeeping errors cannot silently double-count.

**F4. CONCERN — NQC is not "net quality change" when applicability changes; the pilot itself demonstrates the gap.**
Pilot transition 0→1: SEC-005 goes na→fail (PILOT_README.md:24; CSV line 41→86), so fail count rises 6→7 while NQC = 0 (`metrics-summary.json:25`). Δ(pass−fail) = −1 but NQC = 0. NQC is frozen, so keep it, but (i) rename it in reporting ("net repair-minus-regression count among transition-eligible checks"), and (ii) add a per-transition **outcome-flow table** (pass→pass, pass→fail, fail→pass, fail→fail, na→pass, na→fail, X→na, env-error flows) so the na/env-error churn NQC ignores is on the record.

**F5. CONCERN — env-error creates a one-transition blind spot and can mask regressions.**
A check fail@k → env-error@k+1 → pass@k+2 is credited as repaired *never*: excluded from T*(k) (next not observable) and not in T(k+1) (it was env-error there). Conversely a pass→env-error at k+1 may hide a true regression (RR counts pass→fail only). The §6.3 retry-once rule mitigates but does not eliminate this. Require: report pass→env-error and fail→env-error counts per transition (covered by F3), plus the fixed-denominator sensitivity of F2 as the bound.

**F6. CONCERN — na semantics are unauditable in the pilot data, and app-caused missingness is classified as na.**
In `check-observations.csv`: FUNC-002…011 and A11Y-001…004 are na with **blank** `detail` (lines 20–29, 31–34) even though BUILD-003/005 passed (server up); BUILD-002 is na with detail "no build script declared" (line 9) — if the frozen contract expects a build script, that is a measurable app defect, not non-applicability, and as na it escapes both RSR and RR. At i0, 19/39 checks are na, so na classification effectively determines the denominators. Require a machine-readable `na_reason` taxonomy in the check-result schema and ledger: `contract-inapplicable | cascade | precondition-missing | harness`, and re-classify BUILD-002-type cases as `fail` (or justify per check in the catalog).

**F7. CONCERN — The pre-registered cascade sensitivity analysis excludes the wrong categories.**
§9:228-231 and sec-body1.tex:135-137 exclude "TYPE/LINT/DB probes" when BUILD fails at k. Per §6.2 and paper Table (tab:oracles), TYPE (`tsc --noEmit`) and LINT are **static** checks unaffected by a server-start failure; the categories actually cascaded to na when BUILD fails are the runtime ones (FUNC, AUTHZ, SEC probes, A11Y, DB). As written, the analysis would drop harmless checks and keep the affected ones. Re-specify (pre-data): (i) flag every **transition** in which BUILD status changes between k and k+1 and recompute all rates excluding those transitions; (ii) additionally recompute rates excluding any category whose checks are majority-na at k under the cascade rule; (iii) publish a per-iteration BUILD-status table per app so RSR/RR trajectories are interpretable (see also F16).

### B. Independence and clustering

**F8. STRENGTH — App-level cluster bootstrap is correctly motivated and is the right unit.**
The independent units of the data-generating process are the 18 generated applications; checks within an app share task, builder, generation draw, and cascade structure (§9:228-231, §10.2:237-238). Resampling checks would be classic pseudo-replication. Note also that the "3 repetitions per cell" **are** the apps: a (task × builder × rep) unit *is* an application, so resampling apps already resamples the rep units. Do not additionally resample attempts or transitions.

**F9. CONCERN — Bootstrap mechanics under-specified: trajectory-level resampling and stratification must be pre-declared.**
State explicitly that (i) an app's **entire trajectory** (all iterations/transitions) is resampled as one cluster — this is what handles the longitudinal dependence and the repair-attempt-level pseudo-replication (≤54 attempts are not independent units); (ii) resampling is **stratified within the 3×2 task×builder cells** (resample the 3 reps per cell with replacement), otherwise replicates are unbalanced and between-cell statistics (builder contrasts for RQ5; pooled category contrasts that differ by task composition) inherit avoidable noise; (iii) the pooled estimand is the ratio-of-sums Σrepaired/Σtargets over all transitions of resampled apps (this is what `metrics.py:66-70` computes) and mean-of-app-rates is reported alongside. With 18 clusters, percentile intervals are borderline; pre-declare BCa or a t-based interval as robustness, and print the cluster count (18) next to every CI.

**F10. CONCERN — Effective n is 18; the observation counts in §2/sec-body1 invite pseudo-replication-flavored reading.**
"~3,000–4,000 check observations" (protocol §2:53-55) and "2,800–3,000 eligible observations" (sec-body1.tex:28-30) are yield numbers, not evidence quantities. Add one sentence to §10: all uncertainty is driven by 18 independent applications (≤54 repair attempts); per-transition counts are dependent repeated measures and are never used as n. This is acknowledged ("cluster-aware uncertainty", §2:55-58) but the explicit effective-n statement belongs in the analysis plan, not only in design justification.

### C. Mixed-effects model plan

**F11. REQUIRED-FIX — The planned model does not estimate the RQ1/RQ2 estimands.**
§10.3 (:239-242) and sec-body1.tex:143-146 fit "check outcomes ~ iteration × category" with random intercepts for app and check — a marginal pass-probability model. RQ1 is about fail→pass and RQ2 about pass→fail; a single pass/fail outcome conflates the two (a category can repair well and regress often simultaneously). **Corrected specification (pre-declare two models):**

- *Repair dataset*: one row per (app, k, check) with X_k = fail and X_{k+1} ∈ {pass, fail}; Y = 1[X_{k+1} = pass]. Estimates RSR-type probabilities.
- *Regression dataset*: one row per (app, k, check) with X_k = pass and X_{k+1} ∈ {pass, fail}; Y = 1[X_{k+1} = fail]. Estimates RR-type probabilities.
- Fixed effects: iteration (**categorical**, 3 transition levels — see F14) × category; builder as an additive fixed effect with its coefficient interpreted descriptively only (RQ5).
- Random effects: intercepts for app, for app:check (the unit actually repeated across iterations), and optionally check identity (see F12).

**F12. CONCERN — Random-effects structure misses the (app × check) cell; category effects are nearly aliased with check intercepts in small categories.**
Intercepts for app and check identity alone leave the within-app, across-iteration correlation of the same check unmodeled — and the pilot shows checks are *sticky* (LINT-001, SEC-003, BUILD-004, FUNC-001, AUTHZ-006, DB-004 fail at all three iterations; PILOT_README.md:27-31). Also, each check belongs to exactly one category, so a category fixed effect is identified only through between-check variation within category; for TYPE (1 check) and LINT (2 checks) the category effect is nearly aliased with those checks' intercepts. Add an app:check random intercept; pre-declare a singular-fit fallback (drop app:check → app-only + app-clustered robust SEs). A random slope of iteration by app is the natural minimal specification for RQ4 trajectory heterogeneity; declare it as a pre-planned sensitivity, not primary (18 clusters makes it noisy).

**F13. REQUIRED-FIX — The fallback gate is not non-post-hoc and is keyed to the wrong data.**
§10.3:241: fit "only if pilot data show adequate cell support". Three defects: (i) "adequate cell support" has no numeric definition; (ii) the pilot is one app of a **non-study system** (PILOTGLM) and cannot predict study cell support; (iii) the pilot contains **zero regressions**, so any events-per-cell rule keyed to pilot data deterministically rejects the regression model for reasons that say nothing about the study. Replace with a frozen numeric rule evaluated on **study** data before any model fit, e.g.: *"Fit the repair (resp. regression) model iff every category × transition-level cell contains ≥10 eligible observations and ≥2 events, no cell is completely separated, and no category has <3 checks contributing eligible observations. The support table is written to `results/model-support.json` before fitting; fallback is decided independently per dataset and reported with the reason."* This is rule-based (computable from eligibility counts, blind to effect estimates), hence non-post-hoc.

**F14. CONCERN — "Iteration index" as a numeric term cannot express RQ4's hypotheses.**
RQ4 asks about diminishing returns, reversal, oscillation (§1:28-31); a linear iteration term can only express monotone trend. Pre-declare iteration as a categorical fixed effect (primary), with a linear-trend test as secondary if desired.

**F15. CONCERN — Software choice cannot fit the declared model as stated.**
statsmodels MixedLM supports a single grouping factor natively; crossed intercepts (app + app:check + check) require the variance-components workaround and convergence care. Either pre-declare R (lme4/glmmTMB) for the models, or document the statsmodels variance-components formulation, optimizer, convergence criterion, and the pre-declared consequence of non-convergence (fallback to bootstrap-only). The pilot datasets (39 checks × 3 iterations) should be used as an implementation smoke test only, never as a support gate (F13).

### D. Multiple comparisons

**F16. STRENGTH — Top-level structure is sound.**
Two pre-declared families, BH within family, α=.05, "No other hypothesis tests are primary" (§10.4:243-245); RQ5 explicitly test-free (§1:31-34, sec-front.tex:167-175); SEC false-positive and cascade analyses correctly positioned as sensitivity analyses (§6.4, §9).

**F17. CONCERN — Family membership and contrast lists are not enumerated, and BH has no target under model fallback.**
BH depends on family size, but the plan never says whether "category contrasts" means all 28 unordered pairs among 8 categories or 7 comparisons vs. a reference, nor whether RSR and RR contrasts form one family or two, nor the exact iteration contrast list. And in bootstrap-only fallback mode there are no model p-values at all — BH is then undefined. Pre-declare: the exact contrast list per family per dataset (recommend: RSR-category and RR-category each as 7 contrasts vs. a pre-named reference category, or all pairwise — either, but frozen); iteration contrasts as {2v1, 3v2, 3v1}; and in fallback mode, **no hypothesis tests are reported** — interval estimates labeled exploratory, or pre-specified bootstrap simultaneous intervals.

**F18. CONCERN — Near-degenerate categories inside family (a).**
TYPE has 1 check, applicable only to TypeScript projects (pilot: TYPE-001 na, "not a TypeScript project", CSV line 10); LINT has 2 checks. Their category-level rates will be per-app near-constant, frequently undefined, and always small-denominator-flagged. Pre-declare whether TYPE/LINT enter family (a); at minimum report their category estimates as descriptive-only with eligible-app counts per task × category (support varies by task: e.g., FUNC-005 is contract-inapplicable for APP-01, CSV line 23).

### E. Sample-size honesty

**F19. STRENGTH — Scoping honesty is above average for this design class.**
§2 "What the design does not support" (:61-64); RQ5 demotion with explicit reasoning (sec-front.tex:171-175); estimation-first plan (§10.1, sec-body1.tex:140-141); within-cell variance rationale for 3 reps (§2:58-59).

**F20. REQUIRED-FIX — Stale yield numbers contradict the frozen catalog and the pilot.**
§2:52-54 claims "approximately 45–60 applicable checks per application" and "roughly 3,000–4,000 check observations". The frozen catalog contains **39 checks** (5 BUILD + 1 TYPE + 2 LINT + 11 FUNC + 6 AUTHZ + 6 SEC + 4 A11Y + 4 DB — exactly what the pilot executed; sec-body1.tex:66, PILOT_README.md:12), so the maximum is 39 × 4 × 18 = 2,808 observations, and *eligible* (pass/fail) observations are far fewer: the pilot shows 20/39 eligible at i0 (14 pass + 6 fail, 19 na). Correct §2 (≤39 applicable; yield recomputed with pilot-informed na rates), align sec-body1's "39–45 applicable checks" (:28-29), and state the eligible-observation yield separately from the catalog-size yield.

**F21. CONCERN — No precision/MDE statement despite confirmatory-looking BH tests.**
With 18 clusters, CIs on pooled rates will be wide (roughly ±0.1–0.2 for mid-range rates), and category/iteration cells are far smaller. Add a pre-data, design-only simulation (no outcomes needed) reporting expected CI width and minimum detectable risk difference for the primary contrasts; operationalize §11's "report within-cell spread" (:259) as per-cell SD/range of app-level rates. This protects the BH families from over-interpretation.

### F. Missing data and exclusions

**F22. CONCERN — Outcome-dependent early stopping produces informative truncation of the panel.**
The loop stops when zero checks fail (§2:47-49), so iteration-2/3 estimates condition on apps with persistent failures (the pilot is exactly such a case). Require at-risk app counts (N contributing apps) in every trajectory table and conditional framing of late-iteration estimates; the mixed models handle unbalanced panels mechanically, but the selection process must be described in §10.

**F23. CONCERN — Build-repair "unlocking" distorts adjacent denominators.**
When BUILD fails at k and passes at k+1, previously-na runtime checks become defined at k+1: their k+1 outcomes enter neither RSR nor RR at k→k+1 (correct), but they inflate P(k+1), the RR denominator of the *next* transition, and NQC misses the whole block (F4). Partially addressed by the (re-specified) cascade analysis (F7); the per-iteration BUILD-status table should be a standard output.

**F24. CONCERN — §12 has no retry cap.**
Exclusion-and-repeat is permitted for four infrastructure reasons (:271-277) with unlimited repeats; even infrastructure-only exclusion, repeated without bound, admits selective re-rolling of unlucky draws. Pre-declare a cap (e.g., ≤2 retries per run slot, logged as now) and state that partially-observed excluded runs are never analyzed. Good: the rule explicitly forbids excluding poor results (:278-280).

### G. Outliers and heterogeneity

**F25. CONCERN — Per-task reporting is promised; per-builder panels and influence diagnostics are not.**
§11 promises per-task alongside pooled (:267) and §10.1 per-app trajectories; adequate as far as it goes. Add: (i) per-builder trajectory panels (RQ5 is descriptive — show it), (ii) leave-one-app-out influence for pooled RSR/RR (with 18 apps a single never-building app can dominate pooled rates; the diagnostic is cheap and avoids any deletion rule), (iii) eligible-count tables per task × category (see F18). No formal outlier deletion rules are needed or wanted — reporting, not removal.

### H. Pilot output consistency

**F26. STRENGTH — All pilot numbers reconcile end-to-end.**
CSV tallies: i0 = 14 pass / 6 fail / 19 na (=39); i1 = 14/7/18; i2 = 15/6/18 — match PILOT_README.md:21-25, `metrics-summary.json` transitions (0→1: 0/6 repaired, 0/14 regressed, NQC 0; 1→2: 1/7, 0/14, NQC +1, repaired_ids=[SEC-005]), pooled RSR 1/13 = 0.0769 and RR 0/28 = 0 (json:4-10), and paper sec-body1.tex:167-174. SEC-005's na→fail→pass path is handled per the definitions (enters T at transition 1→2 because it is *fail at k*). Small-denominator flags are correct (6, 7, 14 ≥ 5 → false).

**F27. CONCERN — The eligibility branch of `metrics.py` has zero pilot coverage; the promised pipeline is partially unimplemented.**
No env-error and no fail→na-at-k+1 occurs in the pilot, so the `nxt[c] in ("pass","fail")` branch (the subject of F2) is untested; add a synthetic unit test with env-error/na/missing transitions. Also, `analysis/` contains only `metrics.py` and `plots.py`: the §10 promises (cluster bootstrap, category-level variants, cascade and SEC sensitivity analyses, mixed models, BH) and §10.6's "scripts regenerate every number" commitment currently have no implementation. Acceptable pre-data, but enumerate the scripts-to-come in the plan so the gap is visible. (`plots.py` is fine: counts-only plotting sidesteps undefined rates; the hardcoded pilot title prevents accidental reuse as research output.)

---

## REQUIRED CHANGES

1. **(F2, F3)** Amend §9 via CHANGELOG (pre-data): define transition-eligible sets T*, P* exactly as implemented (or change the code to the fixed-denominator reading — but pick one), specify fail→env-error / fail→na / missing-at-k+1 handling, and add the fixed-denominator variant as a pre-declared sensitivity. Extend `metrics.py` to log n_enverror_at_k, n_na_at_k, n_next_enverror, n_next_na, n_missing_next per transition, per-iteration outcome tallies, and a uniqueness assertion on (task, builder, rep, iteration, check_id).
2. **(F11–F15)** Replace §10.3 with the two transition-dataset GLMMs (repair; regression), categorical iteration × category fixed effects (+ builder, descriptive), random intercepts app + app:check (+ check), pre-declared singular-fit and non-convergence fallbacks, software able to fit crossed random effects (or documented statsmodels variance-components route), and a **numeric** cell-support rule evaluated on study data with `results/model-support.json` written before fitting. Remove the pilot as the support gate.
3. **(F17, F18)** Enumerate the exact contrast lists and family membership for both BH families (per dataset), decide TYPE/LINT participation, and define the multiplicity procedure (intervals-only, exploratory) for bootstrap-only fallback mode.
4. **(F7, F22, F23)** Re-specify the cascade sensitivity analysis (exclude BUILD-status-change transitions; correct the category list), and require per-iteration BUILD status + at-risk app counts + conditional framing for late-iteration estimates.
5. **(F20)** Correct §2's check-count and observation-yield figures against the frozen 39-check catalog and the pilot's observed 20/39 eligible rate; align sec-body1.tex:28-29; add the effective-n = 18 statement (F10) to §10.
6. **(F4, F5, F6)** Add the outcome-flow table and NQC reporting gloss; require a machine-readable na_reason taxonomy and re-classify app-caused missingness (BUILD-002 type) as measured failure or justify per check in the catalog.
7. **(F9, F21, F24, F25)** Pre-declare: trajectory-level, cell-stratified bootstrap mechanics and the pooled ratio-of-sums estimand; a design-only precision/MDE simulation; operationalization of within-cell spread; a ≤2 retry cap in §12; per-builder panels and leave-one-app-out influence reporting; enumerate the analysis scripts owed under §10.6.

---

## VERDICT

**Approve contingent on required changes.** The study's statistical spine — frozen transition metrics, cluster bootstrap over the 18 applications, estimation-first reporting, demoted RQ5, pre-declared BH families — is sound and the pilot pipeline output is fully consistent with the raw data. The defects found are specification and hygiene failures, not design failures: the §9-vs-`metrics.py` denominator mismatch (with no exclusion accounting), a model plan that does not measure its own estimands and has an undefined, pilot-keyed fallback gate, stale yield arithmetic, a mis-aimed cascade sensitivity analysis, and missing multiplicity mechanics under fallback. Every fix is a pre-data amendment (protocol v1.0.2 + code) requiring no change to RQs, metrics semantics, or the frozen oracles. Priority order: items 1–2 (correctness of denominators and models), then 3–5 (inference validity and honest accounting), then 6–7.

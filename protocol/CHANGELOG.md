# Protocol Changelog

All changes to the frozen protocol. Data collection has not started; entries below
therefore carry `phase: pre-data` status and do not require a preregistration
amendment note beyond this log.

## v1.0.1 — 2026-09-14 (pre-data; harness-validation pilot findings)

- **BUILD-004 semantics clarified:** the root reachability check passes on HTTP 200
  or a redirect (3xx) to the application UI. Generated apps commonly route `/` to a
  login page via 302. The check-catalog feedback template wording was updated to
  match. Rationale: pilot run APP-01-PILOTGLM-r1-i000 misclassified a healthy app
  (cascade of 31 na) solely because of a redirect.
- **State reset between suite executions:** the runner deletes file-backed databases
  (*.sqlite, *.sqlite3, *.db, excluding node_modules) before a suite execution so
  the application re-seeds its data. This prevents cross-iteration data pollution
  (e.g., APP-03's deletable seed product). Logged in `env_interventions` of each run
  record. For server-backed databases that cannot be reset, flakiness risk is
  recorded as a limitation and per-run markers mitigate list-pollution.
- **Dynamic port allocation:** suite executions bind a free ephemeral port instead of
  a fixed port, eliminating stale-process conflicts.
- **SEC-001 outcome mapping fixed:** semgrep config errors now yield `env-error`
  (excluded from metrics), findings yield `fail`, no findings yield `pass`.
- **Check-catalog wording:** BUILD-004 template updated (200 or redirect).
- No changes to: RQs, metrics definitions, statistical plan, exclusion rules, repair
  protocol, whole-suite rule, or the frozen interface contracts.

## v1.0.2 — 2026-09-14 (pre-data; amendments from adversarial review passes)

All amendments were made before any research data collection, in response to three
independent review passes (independent AI review, AppSec review, statistics review)
plus the internal Reviewer-#2 pass. Original frozen text in `protocol-v1.0.0.md` is
retained; this section overrides where they conflict.

1. **Metric definitions (§9 amended).** Primary estimands use transition-eligible
   sets: T\*(a,k) = checks failing at k whose k+1 outcome is pass/fail; P\*(a,k) =
   checks passing at k whose k+1 outcome is pass/fail. RSR/RR use T\*/P\* as
   denominators. The protocol-literal fixed denominators (all failing / all passing
   at k) are reported as a secondary, conservative sensitivity. Every transition
   reports an exclusion ledger (na / env-error / missing at k+1). Rationale: checks
   that cannot be measured at k+1 are noise, not failures; diluting denominators
   with them conflates "did not regress" with "could not be measured".
2. **Scale arithmetic corrected (§2 amended).** The frozen catalog contains 39
   checks; per-application applicability and cascade rules yield roughly 20–25
   eligible checks per suite execution in the pilot, hence roughly 1,500–2,000
   eligible check observations across 72 suite executions and roughly 700–1,200
   transition-eligible observations. The §2 estimates ("45–60 checks",
   "3,000–4,000 observations") were stale and are superseded.
3. **Repair-attempt vs check-level unit clarified (§10 amended).** Each transition
   bundles all failing checks into ONE builder action. Per-check RSR/RR estimate
   check-level behavior under bundle feedback; they are not independent repair
   events. The manuscript must state this explicitly.
4. **Model plan sharpened (§10 amended).** GLMMs, if used, are fitted separately
   per transition type (fail→pass for RQ1; pass→fail for RQ2) with iteration ×
   category fixed effects and random intercepts for application and check. The
   fallback gate is numeric: proceed with GLMMs only if ≥10 applications contribute
   ≥1 event of that transition type; otherwise bootstrap-only inference.
5. **BH families enumerated (§10 amended).** RQ3 family: pairwise category contrasts
   on RSR and on RR within categories with ≥8 eligible checks per app-iteration
   (FUNC, AUTHZ, SEC, DB); smaller categories (TYPE, LINT, A11Y, BUILD) are reported
   descriptively only. RQ4 family: iteration-1 and iteration-2 contrasts on pooled
   RSR and RR.
6. **Retry cap (§12 amended).** Exclusion-and-retry per run: maximum 2 retries per
   repetition slot; all retries logged.
7. **Bounded sessions (§11 amended).** All runs of one (task × builder × repetition)
   cell must occur within one bounded platform session window, recorded in the run
   record; cross-session differences are reported descriptively.
8. **SEC-002 seed-credential exemption (§6.4 amended).** The frozen seed
   credentials mandated by the specifications are exempt from the secret-scan
   literal rule; a supplementary pattern catches `process.env.X || "<literal>"`
   fallback-secret idioms.
9. **SEC-004 SPA baseline (§6.2 amended).** A debug-path probe returning 200 with a
   body identical to the root catch-all response is not counted as an exposed
   debug endpoint.
10. **npm audit time-dependence (§6.2 note).** Audit results depend on the advisory
    database state at run time; each run record's timestamp defines the reference
    date, and audit output is archived per run.
11. **Feedback-integrity check (§5 amended).** Before analysis, the delivered
    feedback file for every repair iteration is compared byte-for-byte against a
    fresh `make_feedback.py` re-render from the run record; mismatches are
    protocol violations and are reported.
12. **na-reason taxonomy (§6.2 amended).** Not-applicable outcomes carry a reason
    class: `contract_na` (not applicable by contract), `cascade` (upstream failure),
    `env` (environment inability). BUILD-002 "no build script declared" is
    `contract_na`.

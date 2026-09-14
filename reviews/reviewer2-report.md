# Adversarial Peer Review — Reviewer #2

**Venue modeled:** strong empirical software-engineering conference (ICSE/FSE track)
**Material reviewed:** protocol v1.0.1 + repository state (lit-review, oracles,
runner, pilot artifacts, manuscript draft "Research Protocol — Study in Progress")
**Reviewer stance:** adversarial; goal is to reject if rejection is warranted.

## SUMMARY

The manuscript proposes an empirical study of whether commercial AI application
builders can repair deterministic QA failures in their own generated full-stack
applications without introducing regressions. It freezes a preregistration-style
protocol: 3 tasks × 2 builders × 3 repetitions, 39 deterministic checks in 8
categories, machine-generated feedback, whole-suite re-execution per iteration, and
an estimation-first analysis plan. No results are claimed. A harness-validation
pilot demonstrates the loop.

## STRENGTHS

1. The whole-suite rule is the paper's spine and is correct: repair quality cannot
   be measured by rerunning only the failing checks. The design makes this explicit
   and mechanical.
2. Oracles are deterministic and multi-category, including authorization behavior
   and restart-based persistence — rarer and more interesting than scanner output.
3. Scanner findings are treated as candidates with manual verification and a
   sensitivity analysis. This avoids the most common security-evaluation mistake.
4. Metrics are defined before outcomes, with explicit denominator rules, cascade
   handling, small-denominator flags, and dependency caveats. The honesty here is
   above the venue's average.
5. The pilot actually ran and its failure modes (repair fixed 0/6) are reported as
   pilot data, not buried.
6. The novelty section actively enumerates adjacent work that *could* kill the
   contribution and states a coverage gap instead of a "first".

## MAJOR CONCERNS

**M1. Interface contracts bias iteration 0 and possibly the repair dynamics.**
Requiring exact routes and `data-testid` attributes means iteration 0 failures
include "did not comply with a contract it may not have been able to see clearly".
Repair feedback then partially measures *contract compliance*, not general repair.
The protocol acknowledges the trade-off but does not measure it. *Required:* add a
per-failure classification (contract-violation vs functional defect) to the analysis
plan, or explicitly scope RQ1 to "failures under the frozen contract".

**M2. Single operator = author; no blinding possible.** The operator delivers
feedback and could, in principle, deviate. The protocol forbids rephrasing and logs
interventions, but there is no second operator or audit of what was actually sent.
*Required:* archive the exact delivered feedback text per iteration (already
specified as feedback.txt) and cross-check it in the audit trail against
make_feedback output byte-for-byte; state that the check will be automated.

**M3. Builder platforms are moving targets; version drift is recorded but unmodeled.**
If a platform ships a model change mid-study, builder effects and time effects are
confounded. The protocol records drift but the analysis plan has no drift handling.
*Required:* pre-specify that all runs for one (builder × task × rep) cell occur in
one bounded session, and report per-cell session windows; treat cross-session
differences descriptively.

**M4. RSR/RR treat checks as exchangeable targets, but the feedback bundles all
failures into one message.** A repair iteration is one builder action per
application; the effective sample for repair *attempts* is 18×3, not the number of
checks. The metrics section handles check-level clustering, but the manuscript should
state plainly that per-check rates estimate check-level behavior under bundle
feedback, not independent repair events. Otherwise reviewers will (correctly) accuse
the paper of pseudo-replication at the attempt level.

**M5. 39 checks may be too few per category for RQ3.** With categories of size 1
(TYPE) or 4 (A11Y), category-level rates will be unstable. The small-denominator
flag exists, but the analysis plan should pre-commit to which categories are
estimable at all, or merge TYPE/LINT/DB into a "static/persistence" family for
inference.

**M6. The pilot's harness fixes happened after the "frozen" label.** Freeze claims
are credibility-critical. The changelog handles this, but the manuscript should state
explicitly that v1.0.0→v1.0.1 changes occurred pre-data *and* pre-pilot-completion,
with the pilot excluded from data. It currently does this once, in §8; repeat it in
§13 (preregistration statement of the paper).

## MINOR CONCERNS

- m1. BUILD-004's redirect acceptance (v1.0.1) weakens the check slightly; consider
  recording the redirect target and verifying it resolves to a contract page.
- m2. The exclusion rules allow re-running a generation for platform errors; the
  retry policy (same repetition slot) should state a maximum retry count.
- m3. The related-work matrix is valuable; cite it in the paper's related-work
  section as an artifact.
- m4. A11Y checks run axe on three pages; state whether interactive states (post-
  validation error) are excluded — they currently are, which is reasonable but
  should be explicit.
- m5. Consider reporting inter-check transition matrices (pass→pass etc.) in the
  pilot audit to help readers understand the cascade rule's real effect size.

## QUESTIONS FOR AUTHORS

1. What happens if a builder "repairs" by deleting the feature under test (e.g.,
   removes the admin page)? (Answer expected: the check fails — is that stated?)
2. How will you handle a builder that changes frameworks between iterations (React→
   vanilla)? The dependency-manifest diff is recorded; is there a check?
3. If both selected builders expose no model information, how will RQ5 wording avoid
   implying model-level claims?
4. Why 3 repair iterations rather than a convergence criterion?

## REQUIRED REVISIONS (before submission to a venue)

R1. Address M1 (classification or scoped wording).
R2. Address M2 (automated feedback-integrity check).
R3. Address M3 (bounded sessions per cell, pre-specified).
R4. Address M4 (state the attempt-level vs check-level distinction explicitly).
R5. Address M5 (pre-commit estimable categories or merged families).
R6. Address M6 (preregistration statement in the paper).

## RECOMMENDATION

**Weak Accept** as a *protocol/study-in-progress* contribution (venues with
registered-report or tool/replication tracks would be appropriate). As a results
paper, it would currently be **Reject** for lack of results — and the authors
correctly do not claim any.

# Repair Feedback — Preamble Template (FROZEN v1.0.0)

`runner/make_feedback.py` renders the preamble below once, followed by one section per
failing check, generated from the frozen per-check templates in
`benchmark/schemas/check-catalog.json`. The operator may not alter the text.

---

You previously built this application from a specification. Automated quality checks
have now been executed against your application. The following checks failed. Repair
the application so all listed checks pass. Do not change unrelated behavior, do not
rewrite the application from scratch, and do not remove functionality that currently
works. The application's interface contract (routes, data-testid attributes, and API
shapes) must remain exactly as originally specified.

{FAILED_CHECKS}

---

Per-check section format (frozen):

```
### {check_id} [{category}]
{rendered feedback template with observed/expected/detail values}
Spec reference: {spec_ref}
```

Rules enforced by the generator (not the operator):

1. Checks with outcome `env-error` are omitted and listed under a separate line
   "Environment errors (not your fault, will be retried): ..." — the builder is told
   not to act on them.
2. Failing checks are ordered by check ID ascending.
3. The maximum feedback length is 8,000 characters; if exceeded, the generator
   truncates the check list at the last complete section and appends a line stating
   how many additional checks were truncated. Truncation is recorded in the run record.
4. The feedback contains only factual failure data produced by the oracle tools.

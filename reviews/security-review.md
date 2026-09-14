# Security Methodology Review — VibeGuardBench (Task 15)

**Reviewer:** appsec-reviewer-subagent (independent; nothing under `reviews/` was read)
**Date:** 2026-09-15
**Materials reviewed:** `protocol/protocol-v1.0.0.md` (§6.2, §6.4, §7, §9, §11, §14),
`benchmark/specifications/APP-01/02/03`, `oracles/security/vgb-rules.yaml`,
`oracles/runtime/engine.mjs` + `contracts/APP-01/02/03.json`,
`runner/run_oracles.py`, `runner/make_feedback.py`, `benchmark/schemas/check-catalog.json`,
`pilot/PILOT_README.md`, pilot run records (`data/raw/runs/APP-01-PILOTGLM-r1-i0*`),
pilot app source (`pilot/app-r1-i001/server.js`, `pilot/app-r1-i002/server.js`),
`protocol/CHANGELOG.md`, `data/raw/env-report.json`, paper security prose (grep only).

---

## SUMMARY

The security methodology is unusually well designed for a benchmark study: protocol §6.4
explicitly refuses to equate scanner output with vulnerabilities, the AUTHZ checks are
*genuine runtime probes* (not static greps) that demonstrably caught a real flaw in the
pilot (stateless JWT surviving logout), and the paper prose keeps the "candidate finding"
distinction. However, I found **five implementation defects that would corrupt or
understate SEC/AUTHZ outcomes if research data were collected as-is**, plus one
structural ambiguity in SEC-002 (the seed-credential tension) that makes the check
simultaneously false-positive-prone for compliant apps and false-negative-prone for
insecure ones. All are fixable pre-data under the existing CHANGELOG discipline. The
Semgrep ruleset is a defensible tripwire set (high-signal core: eval, jwt-none,
cors-wildcard, exec-interpolation; noisy periphery: `hardcoded-password-literal` on
message-like variables, `dangerouslySetInnerHTML` matching constant HTML), and the
SEC-004 debug-path list is minimal-but-sensible, with one systematic FP mode (SPA
history fallback) that must be neutralized with a baseline comparison.

---

## FINDINGS

### F1 — STRENGTH — Scanner-output interpretation rules are correctly scoped
`protocol/protocol-v1.0.0.md:141` ("scanner findings are treated as candidate findings,
not confirmed vulnerabilities"), §6.4 rules 1–4 (`:159–173`: candidate findings, manual
inspection against code, FP-only sensitivity analysis, no CVSS, severity language
avoided), threat row `:265`. The paper maintains the distinction
(`paper/sec-body1.tex:100–103`; `paper/sec-body2.tex:16`: "fired, not that an exploitable
vulnerability exists"). This is exactly the right epistemic stance and is rare in
benchmark papers.

### F2 — REQUIRED-FIX — SEC-003 silently passes when `npm audit` fails
`runner/run_oracles.py:284–295`: the audit JSON parse is wrapped in `try/except`, and the
except path sets `hi = 0` (`:291–292`), so the check outcome is `pass` whenever audit
errors out (no lockfile, offline registry, npm failure, output truncation). The exit
code (`rc`) is ignored entirely. Any infrastructure failure produces a **false pass** in
the primary metric and suppresses repair feedback. Parse failure / nonzero-unclear exit
must map to `env-error` (per the same semantics already fixed for SEC-001 in CHANGELOG
v1.0.1 and LINT `:234–235`).

### F3 — REQUIRED-FIX — Raw tool outputs are not persisted, violating §7 and making §6.4 verification unauditable
Protocol §7 requires run records to contain "per-check results (machine + raw tool
output)" (`protocol-v1.0.0.md:187–188`). `runner/run_oracles.py` records a `raw_key`
per check (`:91–97`) but `Checks.raws` is never written anywhere except
`env_interventions` (`:120`); `finalize` (`:481–509`) persists only truncated `detail`
strings (≤400–1000 chars). The Semgrep JSON, npm-audit JSON, ESLint JSON, and tsc
output are discarded after parsing (`pw-report.json` and `engine-report.json` are the
only raw artifacts saved). Consequence: the §6.4 manual-verification and FP-rate claims
cannot be audited post-hoc, and per-rule findings beyond the first 10 are lost
(`:256`).

### F4 — REQUIRED-FIX — SEC-002 is structurally ambiguous: spec-mandated seed credentials are flagged, while real fallback secrets are missed
Two independent problems, both demonstrated on pilot data:

* **False-positive by design tension.** Every spec mandates fixed seed accounts
  ("exactly these credentials", `APP-01-booking.md:13–18`; passwords 12–14 chars).
  A compliant app that embeds them as literals — `password: 'admin-pass-9'` in a seed
  object, or `const patientPassword = 'patient-pass-1'` — matches both
  `generic-secret-literal` (`run_oracles.py:51`, `password\s*[:=]\s*["'][^"']{8,}["']`)
  and the Semgrep `hardcoded-password-literal` rule (`vgb-rules.yaml:3–17`, `$V`
  name-regex + `$X` ≥8 chars). Meanwhile an app that hides the same credential behind
  `process.env.X || '<secret>'` bypasses *both* scanners.
* **Confirmed false negative.** `pilot/app-r1-i001/server.js:66,94` contains
  `process.env.JWT_SECRET || 'your-secret-key'` — a hardcoded JWT signing fallback
  secret. SEC-001 and SEC-002 both **passed** in that run
  (`data/raw/runs/APP-01-PILOTGLM-r1-i001/checks.jsonl` lines 6–7). The Semgrep rule
  only matches direct `$V = "$X"` assignments (a call-argument fallback does not
  match), and the regex requires `[:=]` immediately before the quote (`|| '...'` does
  not match). Also note the rule's `pattern-not: process.env.$X` (`vgb-rules.yaml:17`)
  is dead code — it can never exclude anything, because the positive pattern already
  requires a string literal on the RHS.

Required: an explicit seed-credential exemption (documented in the spec/oracles) plus
detection patterns for env-fallback secrets, so the check measures "secrets a real
deployment would need to rotate" rather than implementation style.

### F5 — REQUIRED-FIX — SEC-005 token-variant verdict is silently discarded by first-wins dedup
For token-based sessions the engine records SEC-005 as `na` ("client storage decided by
code grep", `engine.mjs:252–253`). `sec006_localstorage` then re-adds SEC-005 with the
localStorage grep verdict (`run_oracles.py:429–433`), but `finalize` keeps the **first**
occurrence of each check ID (`:482–488`) — the engine's `na`. Empirically confirmed:
i000's final record shows `SEC-005 ... outcome: na, tool: engine.mjs`
(`.../APP-01-PILOTGLM-r1-i000/checks.jsonl:34`) even though the code-grep ran. Any app
that stores its bearer token in `localStorage` — the exact condition APP-01 §4.S4
prohibits (`APP-01-booking.md:80–82`) — will be recorded as `na` and **excluded from
metrics** instead of failing. This is a false negative in the primary metric.

### F6 — REQUIRED-FIX — Cross-owner probe: no nested-ID fallback and a bogus `"0"` id fallback
`engine.mjs:148–161`: the cross-owner resource ID is read as `cRes.json[id_field]` with
**no** nested-entity fallback, unlike the persistence-create path which handles
`payload[entity][id_field]` (`engine.mjs:290–293`). APP-01's own contract writes
"201 `{appointment}`" (`APP-01-booking.md:42`), so a spec-literal nested response
yields `crossOwnerId = null`, and `sub()` then substitutes the literal string `"0"`
(`engine.mjs:161`). The deny probe becomes `DELETE /api/appointments/0`, for which a
**fully compliant** app may return 404 ("404 unknown id", `APP-01-booking.md:43`) —
AUTHZ-003 then fails spuriously. Cross-owner setup failure must be recorded as
`env-error`/`na` for the dependent probe, never silently converted into a probe against
a fabricated ID.

### F7 — CONCERN — Deny matrices hardcode resource IDs → 403-vs-404 conflation
`contracts/APP-02.json:14` (`POST /api/projects/1/tasks`) and `contracts/APP-03.json:13–14`
(`PATCH /api/products/1`, `DELETE /api/products/3`) assume sequential integer seed IDs.
A builder that uses UUIDs or string IDs (both permitted: task/product `id` is
`"string|int"`, `APP-02-dashboard.md:54`) gets 404 on those paths, and the probe demands
exactly 403 (`engine.mjs:196–204`) → spurious failure for a possibly-correct app. Use
runtime-resolved IDs as APP-03's delete pick already does (`contracts/APP-03.json:30`)
or the cross_owner_setup mechanism.

### F8 — CONCERN — AUTHZ-005 duplicates AUTHZ-003's non-GET subset exactly
`engine.mjs:206–217` filters the *same* `deny_matrix_api` to non-GET probes with the
same 403 expectation as AUTHZ-003 (`:196–204`). The two check outcomes are therefore
deterministically correlated (AUTHZ-005 ≡ AUTHZ-003 minus GET rows). This double-counts
one behavior in the AUTHZ category for RQ3/RQ4, and the §9 independence caveat
(`protocol-v1.0.0.md:228–231`) covers only cascading categories, not duplicated probes.
Either differentiate AUTHZ-005 (e.g., add anonymous or cross-owner writes unique to it)
or document the correlation and its effect on category-level rates.

### F9 — CONCERN — Authorization coverage is a sparse matrix, thinner than "role × route matrix" implies
* `allowed_paths` maps each role to **one** route, and the positive probe is GET-only
  (`engine.mjs:184–191`); e.g., APP-01 admin's read-all of `/api/appointments`
  (`APP-01-booking.md:41`) and patient's allowed create are never positively exercised.
* Anonymous probes are GET-only (`engine.mjs:163–169`); anonymous **writes** (spec says
  all `/api/*` except login are denied, `APP-01-booking.md:74–75`) are untested.
* APP-03's manager-only operations (PATCH/DELETE) are never positively tested — an
  over-restricting app (everything 403) passes AUTHZ except via FUNC/DB side effects.
* No tampered-token / missing-role-claim / wrong-signature probes exist; JWT-vs-cookie
  handling is otherwise good (see F15).
The contract-bounded scope is legitimate, but protocol §6.2's "role × route matrix"
(`protocol-v1.0.0.md:141`) overstates it; either amend the wording or add the missing
cells before freeze.

### F10 — CONCERN — SEC-004 exact-200 probe produces systematic FPs on SPA history fallback
`run_oracles.py:54–55, 309–317`: a debug path "exists" iff GET returns exactly 200.
A single-page app with a catch-all route (`app.get('*', sendFile index.html)` — a very
common builder output) returns 200 on **all nine** probe paths → SEC-004 fails for a
healthy app. Mitigate by comparing each 200 response body against the response for a
known-nonexistent control path (baseline diff), or by requiring a non-HTML/JSON debug
signature. The path list itself (`/debug`, `/_debug`, `/api/debug`, `/__debug`, `/test`,
`/api/test`, `/admin/debug`, `/debug/vars`, `/env`) is a sensible minimal tripwire for
Node apps; consider adding `/.env` (static-file misconfiguration) and note that probing
is GET-only and production-mode — both defensible, per the catalog's own feedback text
("Remove or disable them in production mode", `check-catalog.json:49`).

### F11 — CONCERN — SEC-006 pass logic can overstate ("hashing library detected" from a dependency list)
`run_oracles.py:451–457` sets `hashing = True` if `bcrypt|argon2|scrypt|pbkdf2` appears
in **any** `.js/.ts/.jsx/.tsx/.json` file — including `package.json`'s dependency list
(`:451`), so an app that declares bcrypt but never hashes passes when no plaintext is
found. The plaintext scan covers only `*.sqlite/*.sqlite3/*.db` (`:443–444`): JSON-file
stores (`db.json` lowdb-style) bypass plaintext detection (such apps are only
accidentally caught by SEC-002 scanning the JSON as "source"), and base64-encoded
(not hashed) passwords yield `na`. The failure direction (plaintext seed password in DB
→ fail, `:448–450`) is direct and sound; the pass direction needs tightening.

### F12 — CONCERN — Semgrep ruleset: signal/noise is uneven and per-rule verdicts are flattened
Rule-by-rule (`oracles/security/vgb-rules.yaml`):
* **High-signal / low-noise:** `eval-usage` (`:34–37`), `jwt-none-algorithm` (`:58–62`,
  narrow but FP-free), `cors-wildcard` (`:64–69`, exact-shape, misses variant
  constructions — FN risk only), `child-process-exec-interpolated` (`:49–56`).
* **High-signal / low-recall:** `sql-injection-string-concat` (`:19–32`) catches direct
  concat/template-literal into `query/exec/run/all/get`; misses variable-built queries.
  Fine as a tripwire.
* **Medium / noisy:** `hardcoded-password-literal` (`:3–17`) flags any ≥8-char string
  assigned to a password/secret/token/key-named variable — including validation-message
  constants (`passwordError = "Password must contain a digit!"` → FP); dead
  `pattern-not` (`:17`); misses object properties and call-argument secrets (see F4).
* **Noisy / message overstates pattern:** `dangerouslySetInnerHTML` (`:71–75`) matches
  *any* occurrence including constant HTML, while its message claims "with a variable";
  `md5-sha1-for-passwords` (`:40–47`) has no proximity-to-password constraint despite
  its message.
`run_oracles.py:248–253` collapses all findings (any severity, any rule) into one binary
SEC-001 outcome. Acceptable given §6.4, but the §6.4 sensitivity analysis must record
per-rule/per-finding verdicts (see F17), otherwise a single noisy-rule FP and a true
SQL-injection finding are indistinguishable in the record.

### F13 — CONCERN — SEC-002 scan hygiene gaps
`run_oracles.py:261–282`: skips **any** filename containing `"lock"` (`:267–268` — also
skips e.g. `blocklist.js`), skips files >400 KB (`:271` — large bundled/minified
frontends are skipped entirely), and excludes `dist/build/.next` (`:263`) — if a builder
exports only built client assets, client-side secrets are unscanned. Hits record file
paths only, no line numbers (`:279`), unlike SEC-001 (`:256`), which complicates manual
verification.

### F14 — CONCERN — `npm audit` is a mutable, network-dependent oracle (temporal validity)
SEC-003 results depend on the live npm advisory DB at execution time
(`run_oracles.py:285`): advisories published between iteration 0 and iteration 3 (or
between reps) change outcomes without any app change, and re-runs a year later are not
reproducible — in tension with §6.1's determinism claims and with cross-iteration
comparisons (RQ2/RQ4). The `--omit=dev` flag and high/critical threshold themselves are
correct and match the spec (`APP-01-booking.md:85`), and `npm audit` does cover the full
transitive production tree (transitive depth is handled). Mitigations needed: record
registry + audit timestamp per run, pin the npm/semgrep versions (env_report only
*records* versions, `:468–478`; nothing constrains them), and batch re-audit all
archived iterations in a single time window at analysis time, or snapshot the advisory
DB.

### F15 — STRENGTH — AUTHZ probes are real runtime tests and demonstrably work
`engine.mjs` creates fresh sessions per role from frozen contract credentials
(`:174–179`), carries both cookie and Bearer token (`:93–96`), and asserts raw statuses
with `redirect: "manual"` (`:99`) so login-redirect denials are correctly accepted
(AUTHZ-001, `:163–172`). Cross-owner write probes exist for both ownership-style specs
(`contracts/APP-01.json:12–22`, `contracts/APP-02.json:13–17`). AUTHZ-006 caught the
pilot app's real stateless-JWT-survives-logout flaw and held it failing across two
repair iterations (`.../APP-01-PILOTGLM-r1-i001/checks.jsonl:33`;
`pilot/PILOT_README.md:29–30`) — evidence the probes measure behavior, not vibes.
AUTHZ-004 UI checks verify admin/inventory content is absent for the disallowed role in
all three apps (`app01.spec.js:27–31`, `app02.spec.js:26–30`, `app03.spec.js:27–31`);
note they assert *data absence*, not literal redirect/denial — weaker than the spec
wording ("must not reach", `APP-01-booking.md:77`) but arguably the right security
property. SEC-005's cookie branch correctly failed an HttpOnly-but-no-SameSite cookie in
pilot i001 (`checks.jsonl:34`) and the repair was observed at i002 — a clean
measure→feedback→repair→re-measure loop.

### F16 — CONCERN — False-positive inspection process defined but not scaffolded, single-verifier, and one-directional
§6.4.2 requires manual inspection notes in `data/raw/manual-verification/`
(`protocol-v1.0.0.md:164–167`) — that directory does not exist and no template or
verdict format is defined. SEC-001 aggregates 8 rules into one outcome, but no
per-finding verdict granularity is specified, and the sensitivity flip (§6.4.3,
`:168–171`) is ambiguous when one check fails on a **mix** of FP and TP findings (does
the check flip only if *all* constituent findings are FPs?). The sensitivity direction
is correct (FPs counted as passing → removes tool noise from the "verified weakness"
estimate), but there is **no false-negative-side analysis anywhere** — F4 shows the
scanners miss real issues (`|| 'your-secret-key'`), so "0 findings" cannot be treated
as verified cleanliness. Verification is also single-author (operator = author,
disclosed at `:266` but not re-addressed for §6.4 specifically); security verdicts
would benefit from a second reviewer or at minimum published inspection notes. The
pilot exercised SEC failures (SEC-003 persistent fail, `PILOT_README.md:27–28`) without
a dry-run of the verification workflow — recommended before data collection.

### F17 — CONCERN — Environment report is incomplete vs §6.1
`run_oracles.py:468–478` / `data/raw/env-report.json` record node, npm, python,
semgrep, playwright — but no OS, and no Chromium/Playwright browser build. §6.1
explicitly requires "recorded OS … browser (Playwright Chromium) version"
(`protocol-v1.0.0.md:126–127`).

### F18 — STRENGTH — Deterministic harness infrastructure, with honest pilot accounting
Dynamic port allocation (`run_oracles.py:513–524`), process-group kill
(`:125–148`), logged state reset between suite executions (`:106–122`; CHANGELOG
v1.0.1), engine `env-error` separation from `fail` (`engine.mjs:10–12, 392–397`),
fixed probe order and timeouts, and the pilot README candidly documents eight harness
defects fixed pre-data (`PILOT_README.md:34–56`), including the SEC-001 exit-code fix.
`make_feedback.py` renders deterministic SEC feedback from frozen templates with
observed/expected and truncates deterministically (`make_feedback.py:35, 58–77`).

### F19 — CONCERN — Spurious security findings feed the repair loop before verification
The §6.4 manual verification happens "before the analysis freeze" (`:166`) — i.e.,
**after** all repair iterations. Meanwhile `make_feedback.py` immediately tells the
builder to "remediate the flagged patterns" for every failing SEC check
(`check-catalog.json:46–48`). A systematic FP (F4's seed credentials, F10's SPA
fallback) therefore instructs the builder to "fix" a non-issue, potentially inducing
functional regressions that then count in RQ2 — a measurement side-effect of oracle
noise that the threats table (`:253–268`) does not discuss. At minimum, document this
interaction; ideally, exempt the known-structural FPs at the oracle level (F4, F10) so
the loop never sees them.

### F20 — STRENGTH — No CVSS, no "vulnerable" overreach anywhere checked
No CVSS math exists in protocol, oracles, or runner; severity words appear only as
verbatim npm-audit categories (`check-catalog.json:48`; `run_oracles.py:289–294`), and
the pilot README describes SEC-003 as "1 high + 1 critical dependency"
(`PILOT_README.md:28`) — counting dependencies, not calling the app "vulnerable".
Paper language verified by grep (`sec-body1.tex:100–103`, `sec-body2.tex:16`).

---

## ANSWERS TO THE SEVEN QUESTIONS

**1. Are scanner findings being overinterpreted anywhere?**
At the interpretation-rules level, no — §6.4 (`protocol:159–173`) is explicit and the
paper keeps the distinction (F1, F20). At the implementation level, yes, in three
places: (a) SEC-003 treats "audit could not run" as "no high/critical findings" — a
false pass (F2); (b) SEC-006's pass reason "password hashing library detected" can be
triggered by a `package.json` dependency entry alone, overstating verified hashing
(F11); (c) the repair loop consumes unverified scanner output as repair instructions
before any FP inspection, so FPs have operational consequences beyond the record
(F19). AUTHZ "fail" outcomes are behavioral observations (HTTP statuses), not scanner
inferences — no overinterpretation there, though exact-403 expectations plus the `"0"`
id fallback (F6/F7) can misattribute compliant behavior as failure.

**2. Were authorization issues actually tested? Is the implementation sufficient?**
Yes — really tested at runtime, not grepped: anonymous GET denial across
`protected_paths` (AUTHZ-001), role-positive GET (AUTHZ-002), deny-matrix 403s
including cross-owner delete and direct API writes (AUTHZ-003/005), logout
invalidation (AUTHZ-006), and UI-level admin denial per app (AUTHZ-004 via Playwright).
The pilot proves these bite (AUTHZ-006 caught the JWT flaw; SEC-005 caught the missing
SameSite). Gaps (F6–F9, F19's neighbors): the matrix is sparse (one positive route per
role, GET-only positives), anonymous and manager-side writes are untested, deny probes
on hardcoded/fabricated IDs conflate 404 with 403, AUTHZ-005 duplicates AUTHZ-003's
write subset, cross-owner setup has the nested-ID/`"0"` defects, and there are no
tampered-token/missing-role probes. JWT-vs-cookie is handled well (engine carries both;
SEC-005 branches cookie-flags vs localStorage). Redirect handling is correct
(`redirect: "manual"` everywhere; 3xx accepted only where denial semantics allow it) —
one note: AUTHZ-002 requires exactly 200, so a trailing-slash 301 on an allowed API
route would fail spuriously; acceptable under the frozen contract but worth a line in
the threats table.

**3. Are secrets treated correctly?**
Partially. The specific patterns (AWS key, GitHub token, `sk-` keys, PEM blocks,
`run_oracles.py:47–50`) are high-signal and appropriate. `generic-secret-literal`
(`:51`) is the noisy one: it matches any `password/secret/apikey [: =] "<≥8 chars>"` —
validation-message objects, i18n strings, default configs — and, critically, it
**must** flag the spec-mandated seed credentials whenever a builder embeds them
naturally, while an env-fallback style (`process.env.JWT_SECRET || 'your-secret-key'`)
evades it entirely; the pilot app contains exactly such an evaded fallback secret that
SEC-001/SEC-002 both passed (F4). Seed passwords *in the DB* are handled by the right
check (SEC-006 plaintext scan, F11), and §14's redaction policy covers public archives.
Fix the seed-credential exemption, add fallback-secret patterns, and clean up the scan
hygiene (F13).

**4. Are dependencies treated correctly?**
The policy is right: `npm audit --omit=dev --json` (`run_oracles.py:285`) covers the
full transitive production tree, dev-only advisories are excluded, and the
high/critical threshold matches spec S7 (`APP-01-booking.md:85`). Two defects: the
parse-failure→pass bug (F2, required fix) and the temporal-validity problem — a live,
mutable advisory DB is not a deterministic oracle, which matters for a study comparing
iterations weeks apart (F14). Lockfile presence is effectively guaranteed by
BUILD-001 running `npm ci`/`npm install` first (`:190–192`).

**5. Are vulnerability classifications justified and non-overstated?**
Yes on classification language: no CVSS anywhere, severity language avoided in
results, scanner output explicitly demoted to "candidate findings" (F1, F20). The one
overreach risk is SEC-006's pass wording (F11) and the catalog's SEC-003 title quoting
npm's "vulnerabilities" terminology — acceptable since it names the tool's own
taxonomy, but the results section should continue to say "audit findings" as the paper
already does.

**6. Were false positives manually inspected (process defined)? Sensitivity analysis correct?**
The process is defined (§6.4.2–3: inspect each distinct candidate finding against code,
store notes in `data/raw/manual-verification/`, report FP-only sensitivity) but not yet
operationalized: the directory/template don't exist, per-finding verdicts within
SEC-001's 8-rule aggregation are unspecified, the flip rule for mixed FP+TP checks is
ambiguous, verification is single-author, and there is no FN-side check at all (F16,
F4). Direction of the sensitivity analysis is correct (FPs→pass); its granularity and
operationalization need defining before data collection. The pilot never dry-ran this
workflow — recommended.

**7. Are security outcomes reproducible?**
Largely yes for the runtime probes: frozen contracts (exact credentials, paths,
bodies), dynamic port allocation, process-group cleanup, state reset with logging,
`redirect: "manual"` status assertions, env-error/fail separation, and versioned
env reports (F18). Residual reproducibility risks: (a) npm audit's network + mutable
advisory DB (F14); (b) unpinned semgrep/npm versions (recorded, not constrained,
F17/F14); (c) missing OS/browser-build fields in the env report vs §6.1 (F17); (d)
deterministic-in-principle probes that depend on app response shapes (cross-owner `"0"`
fallback, F6) and on node_modules-exclusion defaults for semgrep — the semgrep
invocation (`run_oracles.py:240–241`) relies on Semgrep's default ignores rather than
passing an explicit `--exclude node_modules`; pin that flag explicitly. Session
handling in the engine is deterministic (fresh session per role; AUTHZ-006's logout
mutation does not leak into later probes since DB probes build new sessions).

---

## REQUIRED CHANGES (pre-data, via protocol/CHANGELOG amendment discipline)

1. **SEC-003:** map audit parse failure / unusable exit to `env-error`, not `pass`
   (`run_oracles.py:291–294`); record audit timestamp + registry per run; batch
   re-audit all archived iterations at analysis time (or pin/snapshot the advisory DB).
2. **Persist raw tool outputs** (semgrep, npm-audit, eslint, tsc JSON) per run dir —
   protocol §7 compliance and the evidentiary basis for §6.4 verification
   (`run_oracles.py:91–97, 481–509`).
3. **SEC-002:** add explicit seed-credential exemption (`*-pass-*` / `@vgb.local`
   seed literals, documented in spec + oracles); add fallback-secret detection
   (Semgrep `process.env.$X || "$Y"` with secret-named `$X`; regex
   `(?i)(secret|token|api_?key|password)[a-z0-9_]*\s*\|\|\s*["'][^"']{8,}["']`);
   remove the dead `pattern-not` (`vgb-rules.yaml:17`).
4. **SEC-005 token variant:** make `sec006_localstorage` replace the existing SEC-005
   item (or make finalize last-wins for SEC-005) so the localStorage verdict reaches
   the record (`run_oracles.py:429–433` vs `:482–488`); also match
   `localStorage["…"]=` assignment syntax.
5. **Cross-owner probes:** nested-ID fallback mirroring persistence-create
   (`engine.mjs:155–157`), and setup failure → `env-error`/`na` for dependent probes —
   never probe `{crossOwnerId} → "0"` (`engine.mjs:161`); resolve hardcoded IDs in
   `APP-02.json:14` / `APP-03.json:13–14` at runtime.
6. **Scaffold §6.4 verification:** create `data/raw/manual-verification/` with a
   template (finding id, rule, file:line, verdict FP/TP/unclear, 1–2 sentence note,
   verifier); define the mixed-FP flip rule per check; add a small FN spot-check
   (fallback-secret grep) or record FN-blindness as a limitation; second reviewer for
   security verdicts or publish notes.
7. **SEC-004:** baseline-diff each 200 against a known-nonexistent control path to
   neutralize SPA catch-alls (`run_oracles.py:309–317`); consider adding `/.env`.
8. **Pin tooling:** constrain semgrep + npm versions in the environment setup; add
   explicit `--exclude node_modules` to the semgrep invocation; add OS + Chromium build
   to `env_report()` (`run_oracles.py:468–478`).
9. **Wording/coverage:** align §6.2 "role × route matrix" with actual coverage or add
   the missing cells (anonymous write, manager-positive, admin read-all); document the
   AUTHZ-003/005 correlation in §9's non-independence caveat; note the FP→repair-loop
   interaction (F19) in §11.

---

## VERDICT

The security interpretation framework (§6.4) is genuinely rigorous — candidate-finding
language, manual verification, FP-only sensitivity, no CVSS — and the authorization
probes are the strongest part of the whole oracle suite: they are runtime behavioral
tests with real credentials from frozen contracts, and the pilot proves they detect and
track actual weaknesses (stateless-JWT logout, missing SameSite) rather than pattern
matches. The Semgrep ruleset is a reasonable frozen tripwire set whose noisy members
(`hardcoded-password-literal` on message-like variables, `dangerouslySetInnerHTML` on
constant HTML) are tolerable precisely because §6.4 exists — but only if the
verification workflow is actually scaffolded and per-finding, which it is not yet.
However, I cannot approve SEC measurement as-implemented: SEC-003 converts audit
failures into false passes, SEC-005's token-variant verdict is structurally discarded,
the cross-owner probe can punish compliant apps with a fabricated ID `"0"`, raw scanner
evidence is thrown away contrary to §7, and SEC-002 is simultaneously trigger-happy on
the spec's own mandated seed credentials and blind to the fallback-secret pattern the
pilot app actually exhibits. All five are pre-data fixes under the existing changelog
discipline; once applied, I consider the security methodology sound for the study's
claimed scope.

# README Introduction (for the repository front page)

## Can vibe-coded apps survive their own fixes?

AI app builders can generate a full-stack web application from one prompt. But
initial success is not the interesting question. When deterministic tooling finds
real defects — a broken authorization rule, a missing accessibility contract, a
dependency vulnerability — can the *same builder* repair them without breaking what
already worked?

VibeGuardBench answers that with measurement, not vibes: a frozen benchmark of 3
full-stack application specifications, a 39-check deterministic oracle suite
(Playwright, axe-core, Semgrep, ESLint, tsc, API-level authorization probes,
restart-based persistence), machine-generated repair feedback, and a whole-suite
re-run after every repair.

**Status: preregistered research protocol + validated harness. Data collection in
progress. No results are claimed anywhere in this repository** — every artifact
labeling follows that honestly, and the pilot that validated the machinery is
explicitly excluded from research claims.

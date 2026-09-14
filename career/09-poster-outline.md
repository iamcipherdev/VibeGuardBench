# Research Poster Outline

**Title:** Safeguard Effectiveness in Vibe Coding: Measuring Repair and Regression
in AI-Generated Full-Stack Applications
**Footer label:** Research Protocol & Validated Harness — Study in Progress

## Layout (A0 portrait, 4 columns)

**Column 1 — Motivation & Question**
- Vibe coding: apps from prompts; QA feedback loops are the next frontier
- Classical APR: patches overfit tests (Smith'15; Poracle'23; Lou'24)
- RQ: repair success vs regression introduction, per category, across cycles

**Column 2 — Benchmark design (diagram)**
- Pipeline figure: spec → builder → exported app → oracle suite → deterministic
  feedback → repair → FULL suite re-run (up to 3 cycles)
- 3 specs × 2 builders × 3 reps = 18 apps; 39 checks / 8 categories
- Whole-suite rule callout box

**Column 3 — Oracles & integrity**
- Oracle table: BUILD/TYPE/LINT/FUNC/AUTHZ/SEC/A11Y/DB with tools
- Security caution box: scanner findings = candidates; manual verification; FP
  sensitivity analysis; no CVSS
- Metrics box: RSR, RR, NQC with primary (eligible-set) and conservative
  (fixed-denominator) estimands; cluster bootstrap over apps

**Column 4 — Status & pilot**
- Preregistration statement; changelog discipline
- Pilot trajectory figure (i0 19/16 → i1 18/17 → i2 19/16) labeled
  "harness validation, excluded from research claims"
- What remains: 18 commercial-builder applications + repair loops (runbook ready)
- Repo QR code

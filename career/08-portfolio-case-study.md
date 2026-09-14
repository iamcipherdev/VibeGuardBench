# Portfolio Case Study — VibeGuardBench

**Label:** Independent Research Project — preregistered protocol + validated harness
(Study in Progress; no peer-reviewed publication claimed)

## The problem

AI app builders ship apps that look finished. Empirical evidence about what happens
when those apps fail deterministic quality checks — and the builder is asked to fix
them — does not exist. Classical program-repair research predicts trouble: patches
overfit their tests. Someone had to measure the modern version of that phenomenon.

## What I built (all running code, not a mock)

- **Benchmark design:** 3 frozen full-stack specs (APP-01 booking, APP-02 dashboard,
  APP-03 inventory) with binding interface contracts: exact routes, JSON shapes,
  seed accounts, data-testids. Written so deterministic cross-implementation
  oracles are possible.
- **Oracle suite (39 checks / 8 categories):** npm install/build/start probes;
  tsc; frozen ESLint config; Playwright UI flows; API-driven authorization matrix
  with cross-owner write probes and logout invalidation; Semgrep ruleset + secret
  scan + npm audit + SPA-aware debug-endpoint probes + cookie/token-storage checks
  + credential-storage inspection; axe-core (WCAG 2.1 A/AA) on three pages;
  restart-based persistence probes with schema-shape validation.
- **Experiment machinery:** Python runner (dynamic ports, process-group hygiene,
  state reset, schema-validated run records, raw-output persistence, dependency
  manifests), deterministic feedback generator (fixed templates, no prose), ledger
  to processed CSV, metrics implementing pre-registered definitions with primary and
  conservative estimands + exclusion ledgers, trajectory plotting.
- **Research integrity infrastructure:** preregistration-style freeze; changelog
  for every post-freeze change; exclusion rules frozen pre-data; four independent
  review passes with 30+ accepted fixes; final verification report distinguishing
  executed vs not-executed work.

## What the pilot showed (harness validation only — not research results)

A real LLM generated the booking app; the harness measured it (19 pass / 16 fail —
including a complete interface-contract violation, a stateless JWT that survives
logout, and a high+critical dependency vulnerability); a real repair loop
introduced a security regression (unflagged session cookie) before fixing it one
cycle later. The machinery catches the exact dynamics the study is designed to
quantify.

## Engineering lessons

1. Oracles are the hard 80%: making checks deterministic across independently
   generated implementations drives every design decision.
2. Self-review is not enough: independent adversarial review passes found 15 real
   harness defects — including one that had silently invalidated a pilot finding.
3. Honest status labels are a feature: the repo says exactly what ran and what
   didn't, with the receipts to check.

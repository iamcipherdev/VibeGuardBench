# LinkedIn Featured Section Description

VibeGuardBench — my independent empirical software-engineering project on AI app
builders ("vibe coding"). Question: when deterministic QA tools find defects in an
AI-generated full-stack app, can the builder repair them without breaking working
functionality? I built the entire measurement pipeline: 3 frozen app specifications,
39 deterministic checks (browser-level functional tests, authorization probes,
Semgrep, axe-core accessibility, dependency audit, restart-based persistence
testing), automated repair feedback, and full-suite re-runs after every repair to
catch regressions. The preregistered protocol and the working harness are open
source; the experiment itself is in progress and I report no results until they are
real. https://github.com/iamcipherdev/VibeGuardBench

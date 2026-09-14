# LinkedIn Launch Post

Can AI app builders survive their own fixes?

That question became my research project. "Vibe coding" tools generate full-stack
apps from a prompt — but what happens when deterministic engineering feedback says
the app is broken?

I built VibeGuardBench to measure exactly that:

- 3 frozen full-stack application specs (booking, SaaS dashboard, inventory)
- a 39-check deterministic oracle suite: functional tests, authorization probes,
  security scanning, accessibility (axe-core), type/lint checks, persistence
- machine-generated repair feedback, delivered back to the builder
- the ENTIRE suite re-runs after every repair — regressions can't hide
- every number regenerated from raw data by scripts, nothing hand-copied

The protocol is preregistered and frozen before data collection. A validation pilot
already produced a finding I find genuinely interesting: an AI repair moved session
tokens into cookies WITHOUT the required security flags — fixing one thing,
breaking another — then fixed it properly on the next cycle. That is the exact
repair-vs-regression dynamic the study is designed to quantify at scale.

The repository contains the protocol, the full harness, and an honest audit of what
has and has not been executed. No results are claimed until they exist.

https://github.com/iamcipherdev/VibeGuardBench

#softwareengineering #ai #qualityengineering #appsec #research

# 2-Minute Technical Interview Explanation

Setup: "Everyone is discussing what AI app builders can generate. I study the next
step: what happens when you feed deterministic engineering feedback back to the
builder. In classical automated program repair there's a well-documented problem —
patches that satisfy the failing test often break passing tests; it's called test
overfitting or patch overfitting. Nobody has measured whether that happens with
commercial AI app builders repairing their own full-stack apps, with oracles beyond
unit tests. That's the gap my study measures."

Design: "Three frozen full-stack specs — a booking system, a multi-role dashboard,
an inventory app — each generated three times by two commercial builders: eighteen
apps. Each app faces 39 deterministic checks in eight categories: clean install and
build, TypeScript and ESLint, browser-level functional flows with Playwright against
a binding interface contract, API-driven authorization probes including cross-owner
writes, Semgrep with a frozen ruleset plus secret and dependency scanning, axe-core
accessibility, and persistence checks that restart the server and verify data
survives. For every failure, a script renders a fixed-template feedback message —
no LLM judging, no operator improvisation — the same builder repairs, and the
ENTIRE suite re-runs. Up to three repair cycles per app."

Integrity: "Two things I care about most. First, the whole-suite rule — regressions
are only visible to checks that actually run. Second, honest status: the protocol
and harness are frozen and public, the pilot validated the pipeline end-to-end and
found real harness bugs — including a lint config that produced false failures —
and the pilot data is excluded from research claims. No results will be reported
until the commercial-builder runs are done."

Findings so far (pilot, not research data): "Even the pilot showed the phenomenon:
a repair attempt moved session tokens into cookies without HttpOnly/SameSite — a
security regression introduced by a security fix — and the next cycle repaired it.
That's one data point, not a result, but it shows the measurement works."

Trade-offs I'd defend: "The interface contracts constrain builders — that trades
ecological validity for measurement validity, and I say so in the threats section.
And with 18 apps, the builder comparison is explicitly exploratory, not powered."

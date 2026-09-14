# data/raw/

Raw evidence, per protocol sec 7:

- `runs/{RUN_ID}/run-record.json` — schema-validated run record
- `runs/{RUN_ID}/checks.jsonl` — one JSON object per check outcome
- `runs/{RUN_ID}/raw/` — raw tool outputs (semgrep, eslint, audit, tsc, …)
- `runs/{RUN_ID}/pw-report.json`, `engine-report.json` — oracle engine outputs
- `runs/{RUN_ID}/feedback.txt` — exact deterministic feedback delivered to the builder
- `runs/{RUN_ID}/operator-log.md` — operator actions (added during study runs)
- `env-report.json` — environment versions per execution
- `exclusions.json` — exclusion ledger (created when first exclusion occurs)

Pilot runs use builder id PILOTGLM and are excluded from research data.

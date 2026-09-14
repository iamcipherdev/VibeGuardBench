#!/usr/bin/env python3
"""Generate deterministic repair feedback from a run record (protocol sec 8).

Reads data/raw/runs/{RUN_ID}/run-record.json, renders the frozen preamble +
per-check templates from benchmark/schemas/check-catalog.json, and writes
data/raw/runs/{RUN_ID}/feedback.txt plus a printed NEXT_RUN_ID.

The operator may not edit the output.
"""
import argparse
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CATALOG = json.loads((REPO / "benchmark" / "schemas" / "check-catalog.json").read_text())
TEMPLATES = {c["check_id"]: c["feedback_template"] for c in CATALOG["checks"]}
CATS = {c["check_id"]: c["category"] for c in CATALOG["checks"]}

SPEC_REFS = {
    "APP-01": "APP-01 specification (benchmark/specifications/APP-01-booking.md)",
    "APP-02": "APP-02 specification (benchmark/specifications/APP-02-dashboard.md)",
    "APP-03": "APP-03 specification (benchmark/specifications/APP-03-inventory.md)",
}

PREAMBLE = """You previously built this application from a specification. Automated quality checks
have now been executed against your application. The following checks failed. Repair
the application so all listed checks pass. Do not change unrelated behavior, do not
rewrite the application from scratch, and do not remove functionality that currently
works. The application's interface contract (routes, data-testid attributes, and API
shapes) must remain exactly as originally specified.

"""

MAX_LEN = 8000


def next_run_id(run_id: str) -> str:
    m = re.match(r"^(.*)-i(\d{3})$", run_id)
    if not m:
        raise ValueError(f"bad run id {run_id}")
    return f"{m.group(1)}-i{int(m.group(2)) + 1:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    args = ap.parse_args()

    run_dir = REPO / "data" / "raw" / "runs" / args.run_id
    record = json.loads((run_dir / "run-record.json").read_text())

    failing = [c for c in record["checks"] if c["outcome"] == "fail"]
    failing.sort(key=lambda c: c["check_id"])
    env_err = [c for c in record["checks"] if c["outcome"] == "env-error"]

    parts = [PREAMBLE]
    for c in failing:
        tpl = TEMPLATES.get(c["check_id"], "Check {check_id} failed: {detail}.")
        text = tpl.format(
            check_id=c["check_id"], category=CATS.get(c["check_id"], ""),
            detail=c.get("detail") or c.get("observed") or "no detail recorded",
            observed=c.get("observed", ""), expected=c.get("expected", ""),
            spec_ref=SPEC_REFS.get(record["task"], record["task"]),
        )
        parts.append(f"### {c['check_id']} [{c['category']}]\n{text}\nSpec reference: "
                     f"{SPEC_REFS.get(record['task'], record['task'])}\n")

    body = "\n".join(parts)
    truncated = 0
    while len(body) > MAX_LEN and len(parts) > 2:
        parts.pop(-1)
        truncated += 1
        body = "\n".join(parts)

    if truncated:
        body += f"\n({truncated} additional failing checks were truncated from this message; they are recorded in the run record.)\n"
    if env_err:
        ids = ", ".join(c["check_id"] for c in env_err)
        body += f"\nEnvironment errors (not your fault, will be retried): {ids}. Do not act on these.\n"

    (run_dir / "feedback.txt").write_text(body)
    print(json.dumps({"feedback_path": str(run_dir / "feedback.txt"),
                      "n_failing": len(failing), "n_env_error": len(env_err),
                      "truncated": truncated,
                      "next_run_id": next_run_id(args.run_id)}, indent=2))


if __name__ == "__main__":
    main()

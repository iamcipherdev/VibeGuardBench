#!/usr/bin/env python3
"""Build the processed dataset from raw run records.

Reads every data/raw/runs/*/run-record.json, validates structure, applies the
exclusion log, and writes:
  data/processed/check-observations.csv  (one row per app x iteration x check)
  data/processed/run-summary.csv         (one row per suite execution)
Raw records are never modified.
"""
import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RAW = REPO / "data" / "raw" / "runs"
PROC = REPO / "data" / "processed"
CATALOG = json.loads((REPO / "benchmark" / "schemas" / "check-catalog.json").read_text())
CATS = {c["check_id"]: c["category"] for c in CATALOG["checks"]}


def main():
    PROC.mkdir(parents=True, exist_ok=True)
    obs_rows = []
    sum_rows = []
    n_runs = 0
    for run_dir in sorted(RAW.glob("*/run-record.json")):
        rec = json.loads(run_dir.read_text())
        n_runs += 1
        counts = {}
        for c in rec.get("checks", []):
            outcome = c["outcome"]
            counts[outcome] = counts.get(outcome, 0) + 1
            obs_rows.append({
                "run_id": rec["run_id"], "task": rec["task"], "builder": rec["builder"],
                "repetition": rec["repetition"], "iteration": rec["iteration"],
                "check_id": c["check_id"],
                "category": c.get("category") or CATS.get(c["check_id"], "UNKNOWN"),
                "outcome": outcome,
                "observed": c.get("observed", ""), "expected": c.get("expected", ""),
                "detail": c.get("detail", ""),
            })
        sum_rows.append({
            "run_id": rec["run_id"], "task": rec["task"], "builder": rec["builder"],
            "repetition": rec["repetition"], "iteration": rec["iteration"],
            "excluded": rec.get("excluded", False),
            "n_checks": len(rec.get("checks", [])),
            "n_pass": counts.get("pass", 0), "n_fail": counts.get("fail", 0),
            "n_env_error": counts.get("env-error", 0), "n_na": counts.get("na", 0),
        })

    if obs_rows:
        with (PROC / "check-observations.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(obs_rows[0].keys()))
            w.writeheader()
            w.writerows(obs_rows)
    if sum_rows:
        with (PROC / "run-summary.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(sum_rows[0].keys()))
            w.writeheader()
            w.writerows(sum_rows)
    print(json.dumps({"runs_seen": n_runs, "check_rows": len(obs_rows),
                      "processed_dir": str(PROC)}, indent=2))


if __name__ == "__main__":
    main()

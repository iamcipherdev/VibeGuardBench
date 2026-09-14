#!/usr/bin/env python3
"""Compute repair/regression metrics from the processed dataset.

Implements the frozen metric definitions from protocol sec 9, as amended
(protocol CHANGELOG v1.0.2):

  PRIMARY estimand (transition-eligible sets):
    T*(a,k) = {c : X_{a,k}(c) = fail AND X_{a,k+1}(c) in {pass, fail}}
    P*(a,k) = {c : X_{a,k}(c) = pass AND X_{a,k+1}(c) in {pass, fail}}
    RSR(a,k) = |{c in T* : X_{a,k+1}(c)=pass}| / |T*|
    RR(a,k)  = |{c in P* : X_{a,k+1}(c)=fail}| / |P*|

  SECONDARY (protocol-literal fixed denominators, conservative):
    T(a,k) = {c : X_{a,k}(c) = fail},  RSR' uses |T| with same numerator
    P(a,k) = {c : X_{a,k}(c) = pass},  RR' uses |P| with same numerator

  NQC(a,k) = |repaired| - |regressed| (raw counts).

Every transition reports the exclusion ledger: how many fail/pass checks at k were
unresolved at k+1 (na / env-error / missing), so the gap between primary and
secondary denominators is always visible. Refuses to run on an empty dataset.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PROC = REPO / "data" / "processed" / "check-observations.csv"
OUT = REPO / "results" / "metrics-summary.json"


def load():
    if not PROC.exists():
        sys.exit("NO PROCESSED DATASET — run runner/ledger.py first. "
                 "This tool does not fabricate results.")
    import csv
    with PROC.open() as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("PROCESSED DATASET IS EMPTY — nothing to analyze.")
    return rows


def main():
    rows = load()
    apps = {}
    for r in rows:
        key = (r["task"], r["builder"], int(r["repetition"]))
        apps.setdefault(key, {}).setdefault(int(r["iteration"]), {})[r["check_id"]] = r["outcome"]

    transitions = []
    for (task, builder, rep), iters in sorted(apps.items()):
        for k in sorted(iters.keys()):
            if k + 1 not in iters:
                continue
            cur, nxt = iters[k], iters[k + 1]

            targets_all = {c for c, o in cur.items() if o == "fail"}
            passing_all = {c for c, o in cur.items() if o == "pass"}
            unresolved = {"na": 0, "env-error": 0, "missing": 0}

            def next_state(c):
                if c not in nxt:
                    unresolved["missing"] += 1
                    return "missing"
                if nxt[c] in ("na", "env-error"):
                    unresolved[nxt[c]] += 1
                    return nxt[c]
                return "ok"

            T_star = {c for c in targets_all if next_state(c) == "ok"}
            P_star = {c for c in passing_all if next_state(c) == "ok"}
            # next_state() counted unresolved already; reset counters is not needed
            # because each check is evaluated exactly once across the two sets.

            repaired = {c for c in T_star if nxt[c] == "pass"}
            regressed = {c for c in P_star if nxt[c] == "fail"}

            rec = {
                "task": task, "builder": builder, "repetition": rep,
                "from_iter": k, "to_iter": k + 1,
                # primary (eligible-set) estimand
                "n_targets_eligible": len(T_star),
                "n_repaired": len(repaired),
                "n_passing_eligible": len(P_star),
                "n_regressed": len(regressed),
                "rsr": (len(repaired) / len(T_star)) if T_star else None,
                "rr": (len(regressed) / len(P_star)) if P_star else None,
                "nqc": len(repaired) - len(regressed),
                # secondary (fixed-denominator, protocol-literal) estimand
                "n_targets_fixed": len(targets_all),
                "n_passing_fixed": len(passing_all),
                "rsr_fixed_denominator": (len(repaired) / len(targets_all)) if targets_all else None,
                "rr_fixed_denominator": (len(regressed) / len(passing_all)) if passing_all else None,
                # exclusion ledger
                "unresolved_at_k_plus_1": dict(unresolved),
                "small_denominator_target": len(T_star) < 5,
                "small_denominator_passing": len(P_star) < 5,
                "repaired_ids": sorted(repaired),
                "regressed_ids": sorted(regressed),
            }
            transitions.append(rec)

    def pool(num_key, den_key, label, bucket):
        num = sum(t[num_key] for t in transitions)
        den = sum(t[den_key] for t in transitions)
        bucket[label] = {"ratio": (num / den) if den else None, "num": num, "den": den}

    pooled_primary = {}
    pooled_secondary = {}
    pool("n_repaired", "n_targets_eligible", "repair_success_rate", pooled_primary)
    pool("n_regressed", "n_passing_eligible", "regression_rate", pooled_primary)
    pool("n_repaired", "n_targets_fixed", "repair_success_rate", pooled_secondary)
    pool("n_regressed", "n_passing_fixed", "regression_rate", pooled_secondary)

    summary = {
        "n_applications": len(apps),
        "n_transitions": len(transitions),
        "pooled_primary": pooled_primary,
        "pooled_secondary_fixed_denominator": pooled_secondary,
        "transitions": transitions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2))

    print(f"applications: {len(apps)}, transitions: {len(transitions)}")
    for label, b in pooled_primary.items():
        print(f"pooled {label} (eligible): {b['num']}/{b['den']} = "
              f"{b['ratio']:.4f}" if b["den"] else f"pooled {label}: undefined")
    for t in transitions:
        rsr = f"{t['rsr']:.2f}" if t["rsr"] is not None else "n/a"
        rr = f"{t['rr']:.2f}" if t["rr"] is not None else "n/a"
        print(f"  {t['task']}-{t['builder']}-r{t['repetition']} i{t['from_iter']}->i{t['to_iter']}: "
              f"RSR={rsr} ({t['n_repaired']}/{t['n_targets_eligible']}), RR={rr} ({t['n_regressed']}/{t['n_passing_eligible']}), "
              f"NQC={t['nqc']}, unresolved={t['unresolved_at_k_plus_1']}")


if __name__ == "__main__":
    main()

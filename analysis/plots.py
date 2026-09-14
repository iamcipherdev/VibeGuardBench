#!/usr/bin/env python3
"""Trajectory plot: passed/failed checks per iteration per application.

Renders results/trajectory.png from the processed dataset. Refuses to run on an
empty dataset. Uses constrained_layout (no tight_layout, per plotting rules).
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt

REPO = Path(__file__).resolve().parent.parent
PROC = REPO / "data" / "processed" / "check-observations.csv"
OUT = REPO / "results" / "trajectory.png"

for fp in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",):
    if Path(fp).exists():
        fm.fontManager.addfont(fp)
plt.rcParams["font.sans-serif"] = ["DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


def main():
    if not PROC.exists():
        sys.exit("NO PROCESSED DATASET — run runner/ledger.py first.")
    with PROC.open() as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("EMPTY DATASET — no plot generated from no data.")

    series = defaultdict(lambda: defaultdict(lambda: {"pass": 0, "fail": 0}))
    for r in rows:
        key = f"{r['task']}-{r['builder']}-r{r['repetition']}"
        if r["outcome"] in ("pass", "fail"):
            series[key][int(r["iteration"])][r["outcome"]] += 1

    fig, ax = plt.subplots(figsize=(8, 5), constrained_layout=True)
    colors = {"pass": "#2563eb", "fail": "#dc2626"}
    for key, iters in sorted(series.items()):
        xs = sorted(iters.keys())
        for outcome in ("pass", "fail"):
            ys = [iters[x][outcome] for x in xs]
            ax.plot(xs, ys, marker="o", color=colors[outcome], alpha=0.85,
                    label=outcome if key == sorted(series.keys())[0] else None)
    ax.set_xlabel("Repair iteration")
    ax.set_ylabel("Check count (eligible: pass/fail only)")
    ax.set_xticks(sorted({x for iters in series.values() for x in iters.keys()}))
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.25)
    ax.legend(frameon=False, bbox_to_anchor=(1.02, 0.5), loc="center left")
    ax.set_title("Checks passing vs failing per repair iteration\n(harness-validation pilot, APP-01, PILOTGLM — not research data)",
                 fontsize=10)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=200)
    print(f"saved -> {OUT}")


if __name__ == "__main__":
    main()

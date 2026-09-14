# generated-apps/

Per-iteration source archives of generated applications live here during data
collection, one directory per RUN_ID (`{TASK}-{BUILDER}-r{REP}-i{ITER}`), per
protocol sec 7. Iteration-0 archives are frozen and never overwritten.

This directory is gitignored (source archives are study data, archived per the
data-provenance rules, with generated secrets redacted before any public release).
The harness-validation pilot's app sources are under `pilot/` and also gitignored.

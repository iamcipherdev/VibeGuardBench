# Operator Runbook (FROZEN v1.0.0)

The human operator executes the builder-facing steps. Everything else (oracles,
feedback generation, ledgering) is software. The operator may not edit generated code
and may not rephrase prompts or feedback. Environment problems are fixed on the
environment side only, and logged.

## A. Initial generation (per task × builder × repetition)

1. Create a fresh project session in the builder platform. Do not reuse sessions.
2. Copy the initial-generation prompt (`benchmark/prompts/initial-{APP}.md`) body
   verbatim into the platform. If the platform imposes constraints (length, format),
   record the deviation text and reason in the run log before submitting.
3. Record in the run log: platform, tier, exposed model info (or "not disclosed"),
   version, mode, settings, UTC start/end time.
4. When generation completes, export the full source archive. If export is not
   possible from the platform UI, stop, mark the run excluded (protocol §12), and
   retry in a new session.
5. Unpack the archive to `generated-apps/{RUN_ID}/` (RUN_ID =
   `{TASK}-{BUILDER}-r{REP}-i000`). Do not modify any file.
6. Execute `python runner/run_oracles.py --run-id {RUN_ID}` — this runs the entire
   frozen suite and writes the run record + check results.
7. The iteration-0 result is now frozen. Never regenerate over it; a rerun needs a new
   repetition slot.

## B. Repair iteration (per failing check set)

1. Execute `python runner/make_feedback.py --run-id {RUN_ID}`. It writes
   `data/raw/runs/{RUN_ID}/feedback.txt` and the next RUN_ID
   (`{TASK}-{BUILDER}-r{REP}-i{k+1}`).
2. Open the SAME builder session/project that produced the current iteration (per
   platform capability). Paste `feedback.txt` verbatim. Record UTC start/end time and
   any platform-side anomalies (rate limits, model change notices).
3. Export the result archive, unpack to `generated-apps/{RUN_ID}/`, and execute the
   full suite (`runner/run_oracles.py`). Whole-suite rule (protocol §6.5).
4. Repeat up to 3 repair iterations, or stop early when the suite has zero failing
   checks.

## C. Prohibited actions

- Editing any file under `generated-apps/`.
- Rephrasing prompts or feedback.
- Retrying a repair because the result was poor (retry is only for protocol §12 causes).
- Skipping oracle categories to save time.
- Upgrading the environment mid-study (environment changes = amendment + rerun of
  affected checks).

## D. Logging

Every operator action with a timestamp goes into `data/raw/runs/{RUN_ID}/operator-log.md`
using the template in this directory. Environment interventions go into the run record's
`env_interventions` field.

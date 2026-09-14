# Literature Search Log — VibeGuardBench

**Search conducted:** 2026-09-14 (UTC+8 session)
**Searcher:** Cipher (Sayed Ali Haider Shah), with automated search assistance
**Purpose:** Novelty challenge for the proposed study. The goal was to *disprove*
novelty, not to confirm it. Search preceded any experimental design decisions.

## Sources targeted

- arXiv (API + abs pages)
- Crossref REST API (title metadata, DOIs)
- OpenAlex REST API (title metadata, arXiv IDs)
- Semantic Scholar Graph API (partial; unauthenticated rate limits blocked some queries)
- DBLP (blocked by anti-bot protection during this session; not usable)
- ACM Digital Library, IEEE Xplore, Springer, ScienceDirect (via the above indexers)
- General web search (ZAI web search function) for vendor/blog literature and preprints

## Query log (abridged)

| # | Query | Date | Raw file |
|---|-------|------|----------|
| s01 | vibe coding empirical study arXiv 2025 AI-generated applications | 2026-09-14 | raw/s01_vibe_coding.json |
| s02 | Lovable AI app builder generated applications security vulnerabilities empirical study | 2026-09-14 | raw/s02_lovable_security.json |
| s03 | SWE-bench pass_to_pass regression introduced LLM patch evaluation | 2026-09-14 | raw/s03_swebench_regression.json |
| s04 | CanItEdit iterative code editing LLM benchmark evaluation | 2026-09-14 | raw/s04_canitedit.json |
| s05 | automated program repair overfitting test suite regression introduction APR | 2026-09-14 | raw/s05_apr_overfitting.json |
| s06 | LLM self-repair iterative refinement code diminishing returns multiple iterations | 2026-09-14 | raw/s06_llm_selfrepair.json |
| s07 | security vulnerabilities LLM-generated code empirical study static analysis | 2026-09-14 | raw/s07_llm_code_security.json |
| s08 | full-stack web application generation benchmark LLM functional evaluation tests | 2026-09-14 | raw/s08_fullstack_bench.json |
| s09 | WebGen-Bench benchmark generating web applications LLM automated testing | 2026-09-14 | raw/s09_webgenbench.json |
| s10 | AppWorld benchmark interactive coding agents apps test-based evaluation | 2026-09-14 | raw/s10_appworld.json |
| s11 | Perry "Do Users Write More Insecure Code with AI Assistants" study | 2026-09-14 | raw/s11_perry_insecure.json |
| s12 | Pearce zero-shot vulnerability repair large language models IEEE S&P | 2026-09-14 | raw/s12_pearce_repair.json |
| s13 | DevBench benchmark software development lifecycle LLM evaluation | 2026-09-14 | raw/s13_devbench.json |
| s14 | accessibility evaluation AI generated web user interfaces axe-core automated testing LLM | 2026-09-14 | raw/s14_a11y.json |
| s15 | "AI app builder" OR "app generator" Lovable Bolt v0 academic evaluation benchmark paper | 2026-09-14 | raw/s15_appbuilder_eval.json |
| s16 | iterative LLM code editing performance degradation subsequent edits correctness | 2026-09-14 | raw/s16_iterative_degradation.json |

## Verification tooling

Verification scripts live in the project's analysis history:

- `verify_dblp.py` — DBLP API (blocked by Anubis anti-bot during session; abandoned)
- `verify_s2.py` — Semantic Scholar Graph API (partial success)
- `verify_crossref_oa.py` — Crossref + OpenAlex with fuzzy title matching (primary)
- `verify_arxiv*.py` — arXiv API and abs-page checks (rate-limited; used for residual lookups)

Machine-readable verification output: `arxiv_verification.json`, `citation_verification.json`.

## Known verification limitations

1. Semantic Scholar's unauthenticated search endpoint returned persistent HTTP 429 for
   some queries during the session. Items resolvable through Crossref or OpenAlex were
   verified there; items not resolvable anywhere were **dropped from the reference list**
   (e.g., a candidate citation "EDIT-Bench" could not be verified and is excluded).
2. All result-level claims in the related-work matrix are derived from abstracts and
   metadata, not full-text re-analysis. Where full text was not read, that is noted.
3. Search coverage of non-English venues and of industry technical reports is partial.

## Excluded candidates (failed verification)

- "EDIT-Bench: Evaluating LLM Abilities to Perform Real-World Code Edits" — a search hit
  suggested an ICLR-proceedings paper with this name, but metadata could not be verified
  through any indexer during the session. Excluded from the reference list rather than
  cited from a search snippet.

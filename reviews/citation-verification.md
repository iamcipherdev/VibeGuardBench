# Citation Verification Report

**Verification date:** 2026-09-14
**Method:** Every reference in `paper/sec-references.tex` was checked against at least
one authoritative metadata source (Crossref REST API, OpenAlex, arXiv abs pages, or
the Semantic Scholar Graph API) during the session. Machine-readable evidence:
`docs/lit-review/citation_verification.json`, `docs/lit-review/arxiv_verification.json`,
`docs/lit-review/search-log.md`.

## Scholarly references (24)

| Ref (BibTeX key) | Verified metadata | Source | Supports claim in |
|---|---|---|---|
| ge2025vibe | arXiv 2510.12399, 2025, Y. Ge et al. | OpenAlex (score 1.00) | Vibe-coding landscape; reliability/security open problems |
| lu2025webgen | NeurIPS 2025, arXiv 2505.03733, Z. Lu et al. | Crossref DOI 10.52202/085713-2419 | Initial-generation benchmark with automated tests |
| byte2025fullstack | arXiv 2412.00535, 2024 | Crossref (score 1.00) | Full-stack task-domain benchmark |
| trivedi2024appworld | ACL 2024, DOI 10.18653/v1/2024.acl-long.850 | Crossref (score 1.00) | Simulated-app agent benchmark |
| li2024devbench | arXiv 2403.08604, 2024, B. Li et al. | arXiv abs page (title/authors/date confirmed) | Lifecycle benchmark; artifact DevBench |
| kumarappan2026devbench | arXiv 2601.11895, 2026 | OpenAlex (2 records) | Newer developer-informed benchmark |
| zhao2024commit0 | arXiv 2412.01769, 2024, W. Zhao et al. | OpenAlex | Library generation from scratch |
| jimenez2024swebench | ICLR 2024, arXiv 2310.06770, C. E. Jimenez et al. | Semantic Scholar paper endpoint | Test-verified patch evaluation; PASS_TO_PASS |
| yang2024sweagent | NeurIPS 2024, DOI 10.52202/079017-1601 | Crossref | Agentic repair |
| xia2024agentless | arXiv 2407.01489, 2024 | Crossref (score 1.00) | Non-agent pipeline repair |
| zhang2024autocoderover | ISSTA 2024, DOI 10.1145/3650212.3680384 | Crossref (score 1.00) | Structure-aware localization/repair |
| aleithan2024swebenchplus | arXiv 2410.06992, 2024, R. Aleithan et al. | Crossref (score 1.00); also AIware 2026 version exists | Benchmark validity critique |
| wang2026solved | ICSE 2026, DOI 10.1145/3744916.3764576, Y. Wang, M. Pradel, Z. Liu | Crossref (score 0.85 rounded; title/venue/authors manually matched) | Solved-not-necessarily-correct finding |
| smith2015cure | ESEC/FSE 2015, DOI 10.1145/2786805.2786825, E. K. Smith, E. T. Barr, C. Le Goues, Y. Brun | Crossref (score 1.00) | APR overfitting; plausible vs equivalent patches |
| ismayilzada2023poracle | TOSEM 33(2), 2023, DOI 10.1145/3625293 | Crossref (title/volume/pages verified) | Preservation violations |
| petke2024patch | FSE 2024 Companion, pp. 452–456, DOI 10.1145/3663529.3663776 | Crossref | Patch-overfitting magnitude |
| lou2024apr | TOSEM 33, 2024, DOI 10.1145/3672450, Y. Lou et al. | Crossref | Regression testing vs APR at scale |
| cassano2023canitedit | arXiv 2312.12450, 2023, F. Cassano et al. | OpenAlex (score 1.00) | Iterative instruction editing; degradation |
| madaan2023selfrefine | NeurIPS 2023, DOI 10.52202/075280-2019 | Crossref | Self-feedback refinement |
| huang2023selfcorrect | arXiv 2310.01798, 2023 (ICLR 2024), J. Huang et al. | Crossref + Semantic Scholar | Self-correction can degrade reasoning |
| shinn2023reflexion | NeurIPS 2023, DOI 10.52202/075280-0377 | Crossref + Semantic Scholar | Verbal-reinforcement agents |
| pearce2022asleep | IEEE S&P 2022, DOI 10.1109/SP46214.2022.9833571 | Crossref (score 1.00) | Copilot insecure completions |
| pearce2023zeroshot | IEEE S&P 2023, DOI 10.1109/SP46215.2023.10179324 | Crossref (score 1.00) | Zero-shot vulnerability repair |
| perry2023insecure | ACM CCS 2023, DOI 10.1145/3576915.3623157 | Crossref (score 1.00) | AI-assisted developers less secure |

## Tools and standards (5)

Semgrep, Playwright, axe-core, WCAG 2.1 (W3C Recommendation), OWASP Top 10 (2021) —
all stable canonical URLs, checked reachable 2026-09-14. Cited as tools/standards,
not as evidence for empirical claims.

## Claims checked against sources — corrections made during verification

1. **Authorship of "Is the cure worse than the disease?"** — memory suggested
   "Qi et al."; Crossref's authoritative record for DOI 10.1145/2786805.2786825 shows
   Smith, Barr, Le Goues, Brun. Corrected. (A distinct ICSE 2015 paper by Qi et al.
   analyzes bugs in GenProg/Kali/RSRepair and is NOT this citation.)
2. **Pearce zero-shot arXiv ID** — an initially assumed ID (2112.02025) resolves to an
   unrelated quantum-physics paper. Corrected to the IEEE S&P 2023 DOI; no arXiv ID is
   cited.
3. **CanItEdit exact title** — the verified title ends "…Follow Code Editing
   Instructions" (not "…Complete Code Editing Tasks"). Corrected.
4. **FullStackBench arXiv ID** — verified as 2412.00535 (an initially guessed ID was
   wrong). Corrected.
5. **Commit0 subtitle** — "Library Generation from Scratch" (not "Library-less Code
   Generation"). Corrected.
6. **EDIT-Bench** — could not be verified on any indexer during the session; DROPPED
   from the reference list entirely (do not cite from search snippets).

## Unsupported-claim audit

For each in-text citation, the sentence it supports was checked against the
abstract-level content captured in the related-work matrix. Two writing-time
adjustments were made: (a) the vibe-coding term origin is attributed to Karpathy in
community sources but the tweet is not cited directly (unverified URL); it is
referenced through the survey's framing instead; (b) WebGen-Bench is described as
scoring "LLM agents" (not all models) to match its abstract.

## Remaining risk

Result-level summaries in the related-work matrix are abstract-derived, not
full-text-verified. This is disclosed in the matrix itself and in the search log.
Before journal submission, a full-text pass over the ~8 load-bearing references is
recommended.

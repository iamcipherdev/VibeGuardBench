# Publication Venue Assessment

**Assessed:** 2026-09-14, against the project's honest status: a preregistered
protocol + validated harness with no experimental results yet. Venues are listed in
three tiers: (A) where the *completed* study could go, (B) where the *protocol* is
publishable now, (C) venues to avoid. Deadlines and fees change; each entry links
the official page and states what was verified during this session.

## Tier A — for the completed study (results paper)

| Venue | Publisher / type | Fit | Watch-outs | Official page |
|---|---|---|---|---|
| **EMSE** (Empirical Software Engineering) | Springer, journal | Strong fit: empirical SE measurement, replication culture, industry artifacts | Length is fine; needs solid results + threats discipline; APC for OA optional (subscription path free) | https://link.springer.com/journal/10664 |
| **IST** (Information and Software Technology) | Elsevier, journal | Good fit for benchmark + empirical study | Elsevier OA fees if open access chosen | https://www.sciencedirect.com/journal/information-and-software-technology |
| **MSR** (Mining and Software Repositories), data/replication track | ACM, conference | Good fit for benchmark + dataset paper | Short papers; dataset must be curated | https://www.msrconf.org |
| **ESEM** (Empirical Software Engineering and Measurement) | ACM/Springer, conference | Good fit for the study design + initial results | Empiricism scope matches precisely | https://conf.researchr.org/track/esem |
| **SANER / SCAM** tool tracks | IEEE, conference | Possible for the harness as a tool paper | Tool papers need polish + demo | https://ieeexplore.ieee.org |

Deadline note: MSR/ESEM/SANER roll annually (typical submission windows Oct–Mar).
Not verified session-by-session here; check the official pages before planning.

## Tier B — publishable in current status

| Venue | Type | Why it fits now | Watch-outs |
|---|---|---|---|
| **arXiv (cs.SE)** | Preprint server | Protocol + benchmark as a working paper; timestamped, citable, no review gate | Not peer review; label as protocol; arXiv moderation applies. Free. https://arxiv.org |
| **Registered Reports at EMSE / RIO-style outlets** | Journal preregistration | The protocol is literally a registered report stage-1 artifact | Stage-1 review happens BEFORE data collection — timing is ideal; acceptance of stage 1 is a real peer review |
| **Workshop papers** (e.g., FSE/ICSE workshops on LLM-based software engineering, AI code, testing) | Non-archival or archival workshop | Position/protocol papers with working artifacts are common there | Verify each workshop's archival status per year |

## Tier C — avoid

- Pay-to-publish journals with days-fast acceptance and no real review (check
  Beall's-list successors and https://thinkchecksubmit.org).
- Any venue that markets "AI papers accepted in 48 hours".
- MDPI-style rush venues are contested in SE; not recommended here without a
  specific special-issue reason.

## Predatory-risk assessment method used

Publisher membership in COPE/ODE; indexing claims cross-checked against
Scopus/Web of Science master lists where possible; "think check submit" checklist;
and refusal to recommend venues whose primary filter is payment.

## Recommendation for this project

1. **Now:** arXiv preprint of the protocol (label: Research Protocol — Study in
   Progress) + GitHub release tag. Free, timestamped, citable.
2. **During data collection:** submit the protocol to a Registered-Report track if
   timing allows (stage-1 acceptance then guarantees publication of results
   regardless of outcome — the strongest integrity signal available).
3. **After the study:** EMSE or ESEM with the full results paper; MSR data track
   for the dataset/release if the artifact is substantial.

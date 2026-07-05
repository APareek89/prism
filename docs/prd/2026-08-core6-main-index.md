# Core-6 Main Index — model v3.0 in code (M1 · Aug 2026)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §2 §5 §7 §10 §12, [roadmap](README.md), [handoff.md](../../handoff.md)

## Context / Problem

- The app computes the **v1 model** (13 weighted KPIs, weights 10/25/40/25, one index); the owner-approved spec is **v3.0** (MAIN index = Usage 15 · Efficiency 35 · Outcomes 50 over the Core-6). The gap table is at the top of [scoring-model.md](../scoring-model.md).
- Three lived measurement artifacts distort today's numbers: the coauthor fallback cartesian-links sessions to PRs (22 of 50 links), retention scores a premature 0, and USD estimates erode trust. A number that can't survive skeptical drill-in coaches nobody.
- Every later roadmap month builds on a trusted main number — this is the foundation ship.

## Goals

- The MAIN index publishes end-to-end per v3.0 on real dogfood data, at ≥0.40 confidence.
- Every headline number survives drill-in: link method + confidence visible, evidence tiers shown, corrections published.
- The removed/demoted ledger (scoring-model §7) is honored in code so nothing silently returns.
- USD disappears from the product — tokens only.

## Non-goals

- Harness index (M3), linkage engine (M4), KPI 9 tiering (M10).
- No new connectors, GitHub permissions, or telemetry.
- No coaching or nudges — this month is measurement only.
- No re-litigation of v3.0 decisions; the spec is the contract.

## Users / Personas

- **IC developer** (My View): sees their own MAIN index and Core-6 KPIs with honest confidence.
- **Function lead**: sees the function-level index and drill-downs.
- **Product owner**: runs the calibration review on the 8 flagged anchors before scores are socialized.

## User stories

- As an IC, I want my index built only from exact, defensible links, so that a wrong number never coaches me.
- As an IC, I want nulls shown as "awaiting signal" instead of 0, so missing data doesn't read as failure.
- As a function lead, I want each revert and rework match listed with its evidence tier, so I can audit any score in one click.
- As the product owner, I want a before/after correction summary when the model migrates, so the corrected number becomes the first insight.
- As a skeptical engineer, I want to see why a PR counted as AI-assisted (method + confidence), so I trust the denominator.

## Scope

**In scope**
- Engine reweight to v3.0: three dimensions, Core-6 KPI set, gates, bands, per-index confidence.
- Link integrity hardening (the H0 prerequisite for trusting Core-6).
- `index_config` v3 seed + migration; stored config honored end-to-end.
- UI, email digest, and agent narration updated to the three-dimension structure.

**Out of scope**
- KPIs 12–15 and the Harness index surface (M2).
- Any KPI 9 change beyond leaving it diagnostic (M4).
- Historical re-narration of v1 insights (v1 rows preserved, not rewritten).

## Functional requirements

- FR-1: MAIN index = Usage 15% · Efficiency 35% · Outcomes 50%, computed over exactly the Core-6 (KPIs 1, 3, 4, 6, 7, 10).
- FR-2: KPI 2 (agentic depth) and KPI 5 (edit survival) are no longer weighted; where data exists they render as 📎 diagnostic signals only, visibly excluded from the score.
- FR-3: KPI 8 (retention @30d) is removed from scoring, UI, and email. It may only return with a human-baseline control (ledger rule).
- FR-4: The multiplier signal carries no weight; the L5 band gate (multiplier ≥ 1) is retained.
- FR-5: KPI 4 (iterations to merge) computes over **exact `pr_link` matches only**, and its drill-down states this restriction.
- FR-6: KPI 6 (tokens to shipped) scores in-scope (connected-repo) tokens only; the exploration split is displayed but never scored; every USD figure is removed product-wide.
- FR-7: KPI 7 counts **all** post-merge reverts ≤14d including self-caught; the self/other split is stored and shown as an action-routing diagnostic; GitHub-native revert linkage is preferred, and fallback matches carry a visible evidence tier.
- FR-8: KPI 10 uses the evidence ladder (bug-issue link > `fix:` type > fix-pattern message, each ANDed with same-hunk overlap ≤14d); wip-increment-tagged PRs are excluded; the tier is stored and shown per match.
- FR-9: Link hardening: the coauthor fallback is suppressed for any PR already covered by a `pr_link` match; cwd-split duplicate sessions are de-duped; the per-PR drill-down lists contributing sessions with method + confidence.
- FR-10: Gates and bands per spec: AI-share <15% forces L0 Dormant; bands L0–L5; publish floor 0.40 renders "Insufficient"; cohorts N<8 drop one band.
- FR-11: A KPI with no denominator renders `null` as "awaiting signal" — never 0-by-default, anywhere.
- FR-12: `index_config` v3 is seeded by migration; the engine reads the stored config; v1 config and historical rows are preserved for continuity.
- FR-13: Re-running the pipeline regenerates the trailing 28-day window deterministically, and the migration run publishes a before/after correction summary for the dogfood org.
- FR-14: The email digest and insight agents narrate the new structure; agents remain structurally unable to compute or alter any number.

## Non-functional requirements

- **Determinism**: identical inputs → identical outputs; the scoring test suite (143 tests today) is extended to cover v3.0 paths and the removed-KPI ledger.
- **Performance**: full daily batch for one function / ≤50 employees completes in <5 minutes locally.
- **Simplicity**: no new services; the ship is a migration + engine change + UI pass on existing rails.
- **Reliability**: pipeline stays idempotent and re-runnable; a failed run never leaves partial index rows.

## Open questions

- The 8 flagged anchors (scoring-model §12-9): owner review scheduled in W4 — which, if any, move before socializing?
- Display of v1 history: shown alongside v3 with a marked series break, or archived? (owner)
- KPI 10 tier-3-only matches: publish with low-confidence flag or hold until an org has commit conventions? (CPO proposal: publish flagged.)

## Milestones

- W1: Engine reweight + Core-6 set + `index_config` v3 migration + test extension.
- W2: Link hardening (coauthor suppression, cwd de-dupe) + drill-downs with method/confidence.
- W3: UI three-dimension pass + email + agent narration.
- W4: Full dogfood re-run, correction report, flagged-anchor calibration review with owner, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Anchor miscalibration skews all scores | med | high | Flagged chips stay visible; owner sign-off gate in W4 before socializing |
| Link suppression over-corrects (drops true links) | med | med | Audit sample of every suppressed link published; restore rule if precision audit fails |
| Series break confuses trend reading | high | low | Explicit break marker in charts; v1 rows retained |
| Hidden USD strings survive in edge surfaces | med | low | Repo-wide sweep + test asserting no currency formatting in DTOs |

## Success metrics

- 100% of headline KPI drill-downs show link method/confidence or evidence tier.
- Weak cartesian coauthor links: 22 → ~0 (audited).
- KPI 4 denominator contains exact links only (audit query).
- Zero USD strings render anywhere in the product.
- Dogfood MAIN index publishes at ≥0.40 confidence with the L0 gate evaluated correctly.

## References

- Spec: [scoring-model.md](../scoring-model.md) — §2 structure, §5 Core-6, §7 removed ledger, §10 estimations, §12 open decisions
- Code: `lib/scoring/` (engine + constants), `lib/connectors/link/ai-to-pr.ts` (link ladder), `supabase/migrations/` (config seed)
- Follow-ups being closed: over-linking + retention premature-0 ([handoff.md](../../handoff.md) "Still open")

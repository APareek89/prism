# Linkage Engine — harness→outcome proof (M4 · Nov 2026)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §3, [M1 PRD](2026-08-core6-main-index.md), [M3 PRD](2026-10-harness-index.md), [roadmap](README.md)

## Context / Problem

- With MAIN (M1) and HARNESS (M3) live, Prism can show *that* practices and outcomes coexist — but not that one drives the other. Cross-person contrasts are selection-biased: skill users may simply be better engineers.
- v3.0 converted ex-KPI 11 into the **linkage engine**: within-person, before/after tests of whether adopting a practice moves the outcome it protects. **Never scored — insights only.**
- This is the product's differentiation: "no verification harness caused your reverts" as a measured, personal claim instead of a plausible assertion.

## Goals

- The four standing hypotheses of the linkage map run continuously as within-person tests, on real data.
- Confirmed links become the top insight AND the coaching priority feed (consumed by M9).
- Empty comparison groups report **insufficient** honestly, with visible progress toward measurability — never 0, never a guess.

## Non-goals

- No score contribution to either index — structural, not configurable.
- No cross-person or cross-team comparisons (the selection-bias guard is the design).
- No new data capture; the engine consumes what M1/M2 already store.
- No realtime evaluation — daily batch only; it powers the C3 nudge later (M11).

## Users / Personas

- **IC developer**: sees which of their own outcome problems a harness gap measurably explains — and which it doesn't.
- **Function lead**: sees which practice adoptions actually paid off for the team, as evidence for process choices.
- **Insight agents**: consume confirmed links as grounded facts to narrate (never compute).

## User stories

- As an IC with reverts, I want Prism to compare my reverted-vs-surviving PRs by in-session verification, so the "add a verification harness" advice is backed by my own history.
- As an IC, I want "insufficient data" shown with what's missing (e.g. "need ≥N PRs after adoption"), so I know when the answer will exist.
- As a function lead, I want to see the measured edge of the review-loop practice (review burden with vs without), so I can justify making it a team default.
- As the product owner, I want every published link to state its evidence base (group sizes, window), so a skeptic can audit the claim.

## Scope

**In scope**
- The four linkage-map hypotheses (scoring-model §3): verification→reverts/rework · review-loop→reverts+review burden · continuity→iterations/tokens · skills→repeat sessions.
- Within-person before/after framing (adoption date = first sustained practice evidence) and with/without framing (per-PR practice presence) — both, per hypothesis, as the spec's evidence column defines.
- The leverage ruler: revert+rework rate after adoption − before.
- Linkage cards in drill-downs + agent narration; confirmed links ranked as coaching priorities.

**Out of scope**
- Statistical machinery beyond transparent group comparisons (no regression models — explainability first).
- Org-level linkage aggregation (Phase-2 surface; arrives with M8).
- Skill-specific per-skill edges beyond the four standing hypotheses (H1/H2 of the linkage tree stay diagnostic follow-ups).

## Functional requirements

- FR-1: For each person, each of the four hypotheses computes its comparison groups (with-practice vs without-practice, and before-adoption vs after-adoption where an adoption point exists) over the trailing window.
- FR-2: A hypothesis publishes a link verdict only when both groups meet a minimum size; otherwise it renders "insufficient" with the exact shortfall stated.
- FR-3: Published links show effect direction and magnitude in the outcome's own units (e.g. revert rate 22% → 6%), with group sizes and window visible.
- FR-4: The linkage engine writes insights only — no field it produces is readable by the index computation (enforced at the schema/read-layer boundary).
- FR-5: Confirmed links are ranked into a per-person coaching priority list (the strongest measured gap first), stored for consumption by recommendations today and the plugin (M11) later.
- FR-6: The verification hypothesis uses KPI 13 evidence per PR-session; the review-loop hypothesis uses KPI 14 passes; continuity uses KPI 15 warm/cold starts; skills uses KPI 12 skill-backed vs ad-hoc sessions — all as already stored by M2.
- FR-7: Where a link is tested and NOT confirmed, the result is shown as honestly as a confirmation ("verification gap does not explain your iterations — look at context continuity"), preventing wrong coaching.
- FR-8: All linkage output carries the 📐 estimated badge with a "how this was computed" drill-in (groups, dates, exclusions).
- FR-9: Agents narrate linkage results using only engine-provided numbers; the grounding layer drops any fabricated figure (existing rule, extended to linkage fields).
- FR-10: The dogfood org's own linkage results publish (or report honest insufficiency with progress) at ship gate.

## Non-functional requirements

- **Determinism**: pure computation in `lib/scoring`-adjacent module; versioned rules; same inputs → same verdicts; unit tests over synthetic *fixtures* (test-only, never seeded to the DB — the no-dummy-data rule applies to data, not test code).
- **Explainability**: every verdict reconstructible by hand from its drill-in; no black-box statistics.
- **Performance**: linkage pass adds <1 minute to the daily batch at dogfood scale.
- **Simplicity**: one new module + additive tables; no services, no new dependencies.

## Open questions

- Minimum group sizes per hypothesis (proposal: ≥5 PRs or ≥10 sessions per group) — set provisional values, calibrate in W4. (owner)
- Ruler anchor: the illustrative 0 → +20-pt edge needs recalibration with real data before any "strong link" labeling. (owner, W4)
- Should unconfirmed (null-effect) links be socialized beyond the individual, or IC-only until confidence matures? (CPO proposal: IC-only first month.)

## Milestones

- W1: Group construction (with/without, before/after) + adoption-point detection + minimum-size gates.
- W2: The four hypotheses + ruler + insufficiency reporting with progress meters.
- W3: Linkage cards + agent narration + coaching priority feed + 📐 drill-ins.
- W4: Dogfood run, hand-audit of every published verdict, thresholds calibration, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Small dogfood N → mostly "insufficient" at launch | high | low | By design: honest insufficiency with progress meters IS the correct output; fleet data (M7) grows groups |
| Confounders within-person (task mix changed, not practice) | med | med | Size-bucket normalization reused from KPI 4; window stated; verdict language stays "measured link", never "proven cause" |
| Users read null-effect as "practices don't matter" | med | med | Narration pairs null links with the hypothesis still untested (insufficient) vs tested-and-absent distinction |
| Linkage leaks into scoring via reuse | low | high | Read-layer boundary + test asserting no index path reads linkage output |

## Success metrics

- All 4 hypotheses run daily for every scored person; 100% of outputs are either a verdict with visible evidence base or an explicit insufficiency with shortfall.
- ≥1 verdict (confirmed or tested-null) published on dogfood data by ship gate.
- Zero linkage-derived values in any index computation (audit).
- W4 hand-audit: 100% of published verdicts reconstructible from their drill-ins.

## References

- Spec: [scoring-model.md](../scoring-model.md) §3 (linkage map, selection-bias guard, ruler), §9 linkage tree
- Consumers: recommendations (`lib/recommendations/`), agents (`lib/agents/`), future plugin rule C3 (M11)
- Evidence producers: [M1](2026-08-core6-main-index.md) outcome KPIs, [M3](2026-10-harness-index.md) practice evidence

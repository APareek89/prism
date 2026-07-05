# Manager Enablement Index (M11 · Jun 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §7 §10, [M7 PRD](2027-02-onboarding-roster.md), [M8 PRD](2027-03-org-rollup-dashboard.md), [M9 PRD](2027-04-coaching-plugin.md), [roadmap](README.md)

## Context / Problem

- Since M7, leads/managers are excluded from IC scoring by default — correctly, because a manager graded on IC KPIs is measured on the wrong job. But they've been parked on a "measured as manager — index coming" state ever since. This month the index arrives.
- Phase-2 §7's premise: a manager's output is the team's *system*. So measure **enablement** — never inherited team level (crediting inheritance), and never per-IC coaching data (the privacy line holds at every level).
- All five evidence families now exist in the product: index history (M1+), the adoption loop routed to leads, H3-family friction fixes, AI Leaders events (M8), and anonymized coaching aggregates (M9).

## Goals

- Managers get their own honest 0–100: scored on trajectory and removal of friction, with the same anchor/confidence discipline as every other index.
- The positioning line is literal product truth: *"you're scored on what you removed from your team's way."*
- Small teams are honestly suppressed (< N reports → insufficient), never noisily scored.

## Non-goals

- No inherited-level credit: a manager who inherits an AI-native team scores nothing for the inheritance — trend, not level, by construction.
- No per-IC coaching data in any manager-facing or manager-scoring surface (only anonymized aggregates above the M8 minimum-N floor).
- No manager league table (the no-ranking discipline applies here too).
- No compensation/performance-review framing; Prism positions this as enablement feedback, and the docs say so explicitly.

## Users / Personas

- **Manager / team lead**: sees their enablement index, its five families, and the specific actions that would move it.
- **Function lead / exec**: sees manager indexes within their scope as enablement signals, not rankings.
- **IC**: unaffected — gains confidence that their coaching data still reaches no one.

## User stories

- As a manager, I want my score built from my team's trajectory during my tenure, so inheriting a strong team doesn't flatter me and inheriting a struggling one doesn't sink me.
- As a manager, I want the enablement actions I completed (seats assigned, repos unblocked, telemetry enrolled) to be verified from data and counted, so unglamorous unblocking work finally shows up somewhere.
- As a manager, I want to see which recommendations were routed to me and their verified adoption state, so my score is actionable this week, not a verdict.
- As an exec, I want a manager of 3 reports shown as "insufficient" rather than scored, so I never act on noise.
- As an IC, I want my manager's "coaching health" family computed only from anonymized aggregates, so the coaching channel stays safe.

## Scope

**In scope**
- The five KPI families per spec: **Team trajectory** (Δ team MAIN over tenure — trend, not level) · **Enablement actions adopted** (lead-routed recommendations done AND data-verified) · **Friction removal** (H3-family administrative fixes: seats, blocked repos, enrollment) · **Multiplier cultivation** (AI Leaders emerging on the team, cross-team skill reuse) · **Coaching health** (anonymized aggregates only: nudge act-rate, review-burden trend).
- Same mechanics as every index: anchors (provisional, flagged), publish-floor confidence, < N reports → insufficient, H0-first diagnostic tree ("were recs ever routed to this lead?" before "routed and ignored").
- Manager routing completed: people flagged `role = lead` since M7 land on this index; the placeholder state retires.
- Manager view surface: own index + families + the routed-action queue; scoped visibility per the M8 role matrix.

**Out of scope**
- Manager-to-manager comparison surfaces of any kind.
- New data capture — every family reads evidence the product already stores.
- Tenure ingestion from HRIS (tenure = roster history since M7; earlier tenure entered manually if an org wants it).

## Functional requirements

- FR-1: Team trajectory scores the change in team MAIN over the manager's tenure window, never the level; tenure derives from roster history (manager_email assignments).
- FR-2: Enablement-actions family counts only recommendations routed to the lead that were completed AND re-verified from scored data (the existing adoption loop; self-report counts nothing).
- FR-3: Friction-removal family counts resolved org-channel diagnostics attributable to the manager's scope (seats assigned, repo policy fixed, telemetry enrolled), each verifiable in the underlying data.
- FR-4: Multiplier-cultivation family counts AI Leaders emerging on the team during tenure and cross-team adoption of team-authored skills (M8 recognition events).
- FR-5: Coaching-health family computes exclusively from anonymized team aggregates above the minimum-N floor; below the floor the family renders insufficient, and the index computes from the remaining families with that stated.
- FR-6: A manager with fewer than N reports renders "insufficient — team too small to score honestly" (N per open decision; provisional value shipped flagged).
- FR-7: The index carries anchors, confidence, and flagged-anchor chips exactly like MAIN/HARNESS; no bands unless the owner decides otherwise at calibration.
- FR-8: The H0-first tree ships with the index: low enablement-adoption diagnoses routing/data gaps ("no recs ever routed") before behavior ("routed and ignored").
- FR-9: Manager surfaces show the routed-action queue (open recommendations, verification state) so the index is improvable by doing, not by arguing.
- FR-10: No surface — manager-facing, exec-facing, or scoring-internal — reads per-IC coaching events for this index (denial-tested).
- FR-11: The `role = lead` placeholder state is replaced product-wide by the live index or its honest insufficient state.

## Non-functional requirements

- **Privacy**: the per-IC coaching denial guarantee extended with tests specific to manager scoring paths.
- **Fairness by construction**: trend-not-level and verified-adoption rules are engine constraints, not narrative promises.
- **Determinism**: families computed in `lib/scoring` with fixtures covering inheritance, tenure-window, and floor cases.
- **Simplicity**: reads existing evidence; one new index computation + one manager surface; additive migrations only.

## Open questions

- Anchors for the five families + minimum reports N — Phase-2 open decision #3; provisional proposal in W1 (CPO suggests N=4), owner calibration in W4.
- Family weights: equal across the five, or trajectory-weighted? (CPO proposal: equal until real data argues otherwise.)
- Does the manager index appear in org rollup surfaces this year, or stay a scoped view? (CPO proposal: scoped view only; org-level manager aggregates are a next-year question.)

## Milestones

- W1: Family computations (trajectory, adoption, friction) + tenure derivation + fixtures.
- W2: Multiplier-cultivation + coaching-health aggregates + minimum-N suppression.
- W3: Index assembly + anchors/confidence + manager surface + routed-action queue + H0 tree.
- W4: Dogfood/pilot manager runs, privacy denial audit, anchor calibration with owner, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Perceived as manager surveillance / review ammunition | med | high | Enablement framing in-product; no rankings; positioning line rendered on the surface itself |
| Thin evidence at dogfood scale (few managers, short tenure) | high | med | Honest insufficiency is the correct output; pilot org provides the real validation |
| Trajectory confounded by team composition changes | med | med | Mix-shift decomposition (M8 math) applied to team trajectory; composition changes annotated in the drill-down |
| Coaching-health floor makes the family mostly insufficient | med | low | Index computes from remaining families with the gap stated — partial labeled partial |

## Success metrics

- Every `role = lead` person shows either a live enablement index or an explicit insufficient state — zero placeholders remain.
- 100% of counted enablement actions trace to data-verified adoption records (audit).
- Privacy audit: zero per-IC coaching reads on any manager-scoring path.
- ≥1 manager scored end-to-end (dogfood or pilot) with all five families evaluated or honestly suppressed.

## References

- Spec: [phase-2.md](../phase-2.md) §7 (families, mechanics, positioning), §10-3 (anchors + N open)
- Evidence producers: index history ([M1](2026-08-core6-main-index.md)), adoption loop (`lib/adoption/`), AI Leaders ([M8](2027-03-org-rollup-dashboard.md)), coaching aggregates ([M9](2027-04-coaching-plugin.md))
- Routing origin: eligibility flags ([M7](2027-02-onboarding-roster.md) FR-7)

# Org rollup & management dashboard (M9 · Apr 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §2–§4, [M8 PRD](2027-03-onboarding-roster.md), [roadmap](README.md)

## Context / Problem

- Scores exist per person and per function, but leadership has no surface: no org number, no cross-function view, no scope chain. The function-scope improvement panel is empty today because KPIs persist at employee scope only (open follow-up #3 in [handoff.md](../../handoff.md)).
- Phase-2 §2–§4 defines the org story: headcount-weighted rollup with three honesty guards, a management dashboard that is deliberately **not a league table**, and a scope chain (Org → Function → Team → Individual) with role-based visibility.
- AI Leaders recognition (v3.0 §7 multiplier ledger) belongs on this surface — the org header counts them, and cross-person skill-usage data has been accruing since M7.

## Goals

- One org number that leadership can defend: headcount-weighted, confidence-gated, coverage-labeled, mix-decomposed.
- The full drill path works: org header → function row → function dashboard → team → individual, with role-appropriate visibility at every hop.
- Recognition without ranking: AI Leaders surfaced as a distinction; no league table anywhere.

## Non-goals

- No cross-pack score comparison, anywhere, ever (Phase-2 hard rule) — only Engineering is live yet, but the UI rules are built now so a future pack month can't violate them (the DevOps pack now sits on the backlog).
- No Manager Enablement Index (backlog) — manager rows show team aggregates, not manager scores.
- No org-rollup weighting overrides (open decision Phase-2 §10-2; default headcount weighting only this month).
- No new data capture — this month aggregates and presents what exists.

## Users / Personas

- **Exec**: reads the org header and function table; drills into any function.
- **Function lead**: owns their function dashboard; sees teams and members.
- **Manager**: sees team + members.
- **IC**: sees self + team aggregates (My View unchanged as the personal home).

## User stories

- As an exec, I want the org number labeled with the workforce coverage it actually represents, so a partial number is never passed off as whole.
- As an exec, I want every org delta split into function-improvement vs headcount-mix-shift, so hiring 20 juniors into a young function doesn't read as "we got worse at AI".
- As an exec, I want the function table sorted by headcount, not score, so the biggest populations surface first and no league table forms.
- As a function lead, I want clicking my row to land me in the full function dashboard I already know, so the org layer adds a lens without changing the product underneath.
- As an IC, I want certainty that no manager sees my coaching data at any level of the chain, so scaling the org chart doesn't scale away my privacy.

## Scope

**In scope**
- Function-scope KPI persistence (closing follow-up #3): the engine persists function-level KPI rows so function panels (improvement, trends) have real data.
- Org rollup: Org MAIN + Org HARNESS = headcount-weighted averages of function scores, each with its own confidence; functions below the publish floor excluded and counted in the coverage line.
- Movement decomposition: every org delta labeled improvement vs mix-shift.
- Org header: Org MAIN · Org HARNESS · coverage % · AI Leaders count · token-spend trend · one "what moved the org" line.
- Function summary table with the spec's columns (people covered, MAIN, U/E/O, HARNESS, 30-day trend, confidence, top insight); default sort headcount; confidence chip on every cell.
- Scope chain & RBAC: Org → Function → Team → Individual with the Phase-2 role matrix (exec / function lead / manager / IC), generalizing the existing `function_id` scoping.
- AI Leaders: the recognition list (multiplier signal ≥1 — someone else uses your skill) + profile badge + the L5 gate wiring, driven by cross-person skill-usage events from telemetry.

**Out of scope**
- Weighting overrides, function exclusions from rollup (open decision — default only).
- Manager scoring of any kind (M11).
- Benchmarking across orgs (single-org deployments this year).

## Functional requirements

- FR-1: Function-level KPI and index rows persist per pipeline run; function panels consume them (no on-the-fly aggregation of employee rows in views).
- FR-2: Org MAIN and Org HARNESS compute as headcount-weighted averages over functions whose confidence clears the publish floor; the two org numbers never blend.
- FR-3: The org header always states coverage: "covers N% of workforce; X people pending data" — computed from roster eligibility (M8) and published-score coverage.
- FR-4: Every org-level delta renders its decomposition (points from function improvement vs points from headcount-mix shift) as the "what moved the org" line.
- FR-5: The function summary table shows one row per active function with the spec's columns; default sort is headcount; score-based sorting is not offered.
- FR-6: Every displayed number at every level carries its confidence chip — no naked numbers at org scale.
- FR-7: Clicking a function row opens the existing function dashboard scoped to that function; team → individual drill-downs continue through the existing views.
- FR-8: Role visibility enforced by RLS, not UI: exec sees all functions; function lead their function; manager their team + members; IC self + team aggregates. My View remains everyone's personal home.
- FR-9: Per-person coaching data is invisible to every other role at every level; managers see anonymized themes only (the Addendum-B guarantee restated as an access rule and covered by denial tests).
- FR-10: AI Leaders: a person with multiplier signal ≥1 appears on the recognition list with the evidence (which skill, adopted by how many others); the L5 band gate consumes the same signal; no score anywhere derives from it.
- FR-11: Token-spend trend on the org header is tokens only (no USD — the bucket-1 rule).
- FR-12: With only one function active (Engineering), all org surfaces render correctly as the degenerate case — coverage, rollup, and decomposition stay truthful rather than hidden.

## Non-functional requirements

- **Correctness**: rollup math unit-tested against hand-computed fixtures, including exclusion, coverage, and mix-shift cases.
- **Privacy**: coaching-data denial tests per role; anonymized themes have a minimum-N floor before rendering.
- **Performance**: org dashboard renders from persisted rollup rows (<500ms server time), not recomputed per request.
- **Simplicity**: aggregation in the existing pipeline; new read modules + one dashboard surface; additive migrations only.

## Open questions

- Anonymized-theme minimum N (proposal: ≥5 contributing ICs before a theme renders) — confirm with owner.
- AI Leaders placement: org header count + dedicated panel, or also on function dashboards? (CPO proposal: both, same component.)
- 30-day trend definition for the function table (Δ of MAIN over trailing 30d vs prior 30d) — confirm windowing with owner before build.

## Milestones

- W1: Function-scope KPI persistence + rollup computation + decomposition math + tests.
- W2: Org header + function summary table + confidence chips.
- W3: Scope chain RBAC generalization + denial tests + AI Leaders recognition surface.
- W4: Dogfood + pilot verification, privacy audit, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| One-function degenerate case makes org surfaces look redundant | high | low | Honest rendering + explicit "1 function active" framing; a second function arrives when the DevOps pack leaves the backlog |
| Mix-shift decomposition confuses first-time readers | med | med | One-line prose rendering ("+4 from improvement, −1 from mix"), tooltip explainer |
| RBAC generalization breaks existing view queries | med | high | Denial-test suite from M5 extended per role×level before UI work lands |
| Recognition reads as ranking | med | med | AI Leaders is an unordered distinction list with evidence, never a scored leaderboard position |

## Success metrics

- Org MAIN + HARNESS publish with correct coverage line on dogfood (and pilot if live).
- Function improvement panel populated (follow-up #3 closed).
- 100% role×level denial tests pass; zero per-IC coaching data reachable by any other role.
- Decomposition sums exactly to each org delta (property test).

## References

- Spec: [phase-2.md](../phase-2.md) §2 (rollup guards), §3 (dashboard flow), §4 (scope chain + privacy), §8 defaults
- v3.0: [scoring-model.md](../scoring-model.md) §7 (multiplier → AI Leaders), L5 gate in §2
- Code: `lib/pipeline/`, `lib/db/` read modules, `app/(views)/`, RLS policies in `supabase/migrations/`
- Closes: function-scope KPI follow-up ([handoff.md](../../handoff.md) "Still open" #3)

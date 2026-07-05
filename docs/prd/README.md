# Prism product roadmap — Aug 2026 → Jul 2027

> Status: Draft (for owner ratification)
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) (v3.0 spec), [phase-2.md](../phase-2.md) (org scaling), [handoff.md](../../handoff.md)

One feature ships per month. Each feature has its own PRD in this directory. Nothing here
invents new strategy — the year executes decisions the owner already ratified in the model lab
(v3.0, 2026-07-02) and the Phase-2 alignment, in dependency order.

## Where we start (July 2026)

- App is built M0–M5 and runs the **v1 model**; the **v3.0 spec is ahead of the code** (gap table in [scoring-model.md](../scoring-model.md)).
- Single user, DEMO_MODE, local-first. Dogfooding live: 287 sessions, PRs #1–#16, AI→PR link firing.
- Three known data-trust follow-ups: over-linking, retention premature-0 (moot under v3.0), function-scope KPI rows.

## The year in one line

**Make the number true → make it multi-user → make it an org product → make it bigger than engineering.**

## Quarter themes

| Quarter | Theme | Months |
|---|---|---|
| **Q1 · Aug–Oct 2026** | **Ship the model we believe.** v3.0 in code: Core-6 main index, Harness index, linkage engine. All on real dogfood data. | M1–M3 |
| **Q2 · Nov 2026–Jan 2027** | **Production evidence & real users.** Deploy-event reliability, production multi-user, fleet telemetry. | M4–M6 |
| **Q3 · Feb–Apr 2027** | **The org product.** Onboarding wizard, org rollup + management dashboard, in-flow coaching. | M7–M9 |
| **Q4 · May–Jul 2027** | **Beyond engineering.** DevOps function pack, Manager Enablement Index, AI run-cost visibility (Bucket 2a). | M10–M12 |

## The 12 features

| # | Month | Feature | PRD | Spec basis | What it unlocks |
|---|---|---|---|---|---|
| M1 | Aug 2026 | Core-6 Main Index (v3.0 in code) | [2026-08-core6-main-index.md](2026-08-core6-main-index.md) | scoring-model §2, §5, §7; build order P1 | A main number that survives skeptical drill-in. Everything builds on this. |
| M2 | Sep 2026 | Harness Index (KPIs 12–15) | [2026-09-harness-index.md](2026-09-harness-index.md) | scoring-model §5; build order P2 | The practices index — parser extensions only, data already on disk. |
| M3 | Oct 2026 | Linkage Engine | [2026-10-linkage-engine.md](2026-10-linkage-engine.md) | scoring-model §3 | "No harness caused your reverts" becomes proven, not asserted. |
| M4 | Nov 2026 | Change Reliability Tier-1 | [2026-11-change-reliability-t1.md](2026-11-change-reliability-t1.md) | scoring-model §6; build order P3 | KPI 9 scores on deploy events — no Sentry required. |
| M5 | Dec 2026 | Production multi-user | [2026-12-production-multi-user.md](2026-12-production-multi-user.md) | handoff decisions 3, 5 | Real auth + RLS + Render. Prism stops being a single-laptop tool. |
| M6 | Jan 2027 | Fleet telemetry ingestion | [2027-01-fleet-telemetry.md](2027-01-fleet-telemetry.md) | scoring-model §4; build order P4 | Teammates' AI usage becomes visible — the org data plane. |
| M7 | Feb 2027 | Onboarding wizard & roster | [2027-02-onboarding-roster.md](2027-02-onboarding-roster.md) | phase-2 §6 | A company reaches first honest numbers without a services engagement. |
| M8 | Mar 2027 | Org rollup & management dashboard | [2027-03-org-rollup-dashboard.md](2027-03-org-rollup-dashboard.md) | phase-2 §2–§4 | The exec surface: org MAIN + HARNESS, coverage-honest, no league tables. |
| M9 | Apr 2027 | In-flow coaching plugin (Addendum B) | [2027-04-coaching-plugin.md](2027-04-coaching-plugin.md) | scoring-model §8 | Prevention at the moment of work — private, need-gated, ≤3 nudges/day. |
| M10 | May 2027 | Function-pack framework + DevOps pack | [2027-05-devops-function-pack.md](2027-05-devops-function-pack.md) | phase-2 §1, §5 | First function beyond engineering, on the same rails. |
| M11 | Jun 2027 | Manager Enablement Index | [2027-06-manager-enablement-index.md](2027-06-manager-enablement-index.md) | phase-2 §7 | Managers scored on what they removed from the team's way. |
| M12 | Jul 2027 | AI Run-Cost visibility (Bucket 2a) | [2027-07-run-cost-visibility.md](2027-07-run-cost-visibility.md) | phase-2 §9 | Prism's first step from "people building with AI" to the full AI P&L. |

## Dependency spine

- **M1 → M2 → M3**: the two-index model plus the engine that connects them. M3 needs both indexes live to test harness→outcome links.
- **M4** is independent of M2/M3 (GitHub-side) but must follow M1 (it extends Outcomes).
- **M5 → M6 → M7 → M8**: production auth before telemetry, telemetry + identity before roster onboarding at scale, roster before org rollup.
- **M9** needs M1–M3 (need-gated rules read the person's own KPI profile) and benefits from M6 (fleet reach); it does not need M8.
- **M10** needs M7–M8 (function activation + repo→function mapping + org surfaces).
- **M11** needs M8 (team trajectory history, adoption loop routed to leads) and M9 (anonymized coaching aggregates).
- **M12** is a new ingest lane (provider billing/usage APIs) — deliberately independent, so it cannot destabilize the workforce indexes.

## Architecture guardrails (the "keep it simple" contract)

1. **One app, one DB, one job runner.** Next.js on Render + Supabase + Inngest. No new services this year.
2. **New capability = parser extension or API route first**, new infra never. The only genuinely new runtime surfaces all year: the telemetry ingest endpoint (M6, an API route) and the coaching plugin (M9, which runs on the developer's machine — not our infra).
3. **Determinism boundary is non-negotiable**: `lib/scoring` computes every number; LangGraph agents only narrate.
4. **Migrations append-only** (automation owns 0030+); column truth = `supabase/migrations/*.sql`.
5. **No dummy data, ever.** Every monthly ship gate is verified on real ingested data (dogfood first, pilot org from Q3).
6. **Honest numbers over complete numbers**: nulls, confidence chips, tier badges, and coverage lines everywhere — a partial number is labeled partial.

## Operating cadence (every month)

1. PRD ratified by the product owner before the month starts (open questions answered or explicitly deferred).
2. Work ships as dogfood PRs with the `Co-authored-by: Claude` trailer — Prism measures its own build, per [dogfooding.md](../dogfooding.md).
3. Last week = calibration review (anchors vs real data; flagged anchors never socialize without owner sign-off) + `handoff.md` update.

## Year-end success criteria

- Dogfood org publishes **both indexes** at ≥0.40 confidence with zero measurement-artifact corrections outstanding.
- **≥1 external pilot org** onboarded via the wizard (M7) and reading its own org dashboard (M8) by end of Q3.
- KPI 9 **promoted into the Outcomes core** after one clean Tier-1 month.
- Coaching plugin live with measured act-rate and **zero prompt text ever leaving a developer machine** (audited).
- First **real invoice** flowing through Run-Cost visibility with build-vs-serve split published.

## Standing risks

| Risk | Mitigation |
|---|---|
| Anchor miscalibration makes everyone look better/worse than reality | Flagged-anchor chips; owner review gate before any score is socialized (scoring-model §12-9) |
| Single-founder bandwidth vs 12 ships | Each PRD scoped to one month with explicit out-of-scope; dogfooding keeps velocity measured |
| Pilot org slips → org features unvalidated | Dogfood org doubles as pilot until then; M7–M8 ship gates runnable on dogfood data |
| Privacy erosion as surfaces multiply | The three-mechanism design (scoring-model §8) restated as an NFR in every PRD that touches developer data |

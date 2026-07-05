# Prism product roadmap — Aug 2026 → Jul 2027 (v1.1)

> Status: Draft (for owner ratification)
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) (v3.0 spec), [phase-2.md](../phase-2.md) (org scaling), [handoff.md](../../handoff.md)

One feature ships per month. Each feature has its own PRD in this directory. Nothing here
invents new strategy — the year executes decisions the owner already ratified in the model lab
(v3.0, 2026-07-02) and the Phase-2 alignment, in dependency order.

**v1.1 re-cut (2026-07-06, owner-approved):** an investor-perspective review flagged run-cost as
the market wedge ("start with the CFO's pain, not behavior scoring"). The hybrid re-cut keeps
truth-first (M1) and the workforce+spend join (our differentiation vs pure FinOps dashboards),
pulls run-cost forward (stage ① to Sep, gateway attribution to Jan), ends the year on **AI P&L
v1**, and moves the Manager Enablement Index + DevOps function pack to the [backlog](backlog/).

## Where we start (July 2026)

- App is built M0–M5 and runs the **v1 model**; the **v3.0 spec is ahead of the code** (gap table in [scoring-model.md](../scoring-model.md)).
- Single user, DEMO_MODE, local-first. Dogfooding live: 287 sessions, PRs #1–#16, AI→PR link firing.
- Three known data-trust follow-ups: over-linking, retention premature-0 (moot under v3.0), function-scope KPI rows.

## The year in one line

**Make the number true and the bill visible → make it multi-user → make it an org product → assemble the AI P&L.**

## Quarter themes

| Quarter | Theme | Months |
|---|---|---|
| **Q1 · Aug–Oct 2026** | **Truth + the CFO wedge.** v3.0 Core-6 in code, run-cost stage ① (the bill, split build-vs-serve), Harness index. | M1–M3 |
| **Q2 · Nov 2026–Jan 2027** | **Proof, production, and the attribution moat.** Linkage engine, production multi-user, gateway-tag attribution. | M4–M6 |
| **Q3 · Feb–Apr 2027** | **The org product.** Fleet telemetry, onboarding wizard, org rollup + management dashboard. | M7–M9 |
| **Q4 · May–Jul 2027** | **Close the loops.** Deploy-event reliability, in-flow coaching, AI P&L v1. | M10–M12 |

## The 12 features

| # | Month | Feature | PRD | Spec basis | What it unlocks |
|---|---|---|---|---|---|
| M1 | Aug 2026 | Core-6 Main Index (v3.0 in code) | [2026-08-core6-main-index.md](2026-08-core6-main-index.md) | scoring-model §2, §5, §7; build order P1 | A main number that survives skeptical drill-in. Everything builds on this. |
| M2 | Sep 2026 | Run-Cost visibility (2a stage ①) | [2026-09-run-cost-visibility.md](2026-09-run-cost-visibility.md) | phase-2 §9 | The CFO wedge: billed spend per key/day, build-vs-serve, coverage gate. |
| M3 | Oct 2026 | Harness Index (KPIs 12–15) | [2026-10-harness-index.md](2026-10-harness-index.md) | scoring-model §5; build order P2 | The practices index — parser extensions only, data already on disk. |
| M4 | Nov 2026 | Linkage Engine | [2026-11-linkage-engine.md](2026-11-linkage-engine.md) | scoring-model §3 | "No harness caused your reverts" becomes proven, not asserted. |
| M5 | Dec 2026 | Production multi-user | [2026-12-production-multi-user.md](2026-12-production-multi-user.md) | handoff decisions 3, 5 | Real auth + RLS + Render. Prism stops being a single-laptop tool. |
| M6 | Jan 2027 | Run-Cost attribution (2a stage ②) | [2027-01-run-cost-attribution.md](2027-01-run-cost-attribution.md) | phase-2 §9 | The moat: feature × model × env ledger with tag-level coverage honesty. |
| M7 | Feb 2027 | Fleet telemetry ingestion | [2027-02-fleet-telemetry.md](2027-02-fleet-telemetry.md) | scoring-model §4; build order P4 | Teammates' AI usage becomes visible — the org data plane. |
| M8 | Mar 2027 | Onboarding wizard & roster | [2027-03-onboarding-roster.md](2027-03-onboarding-roster.md) | phase-2 §6 | A company reaches first honest numbers without a services engagement. |
| M9 | Apr 2027 | Org rollup & management dashboard | [2027-04-org-rollup-dashboard.md](2027-04-org-rollup-dashboard.md) | phase-2 §2–§4 | The exec surface: org MAIN + HARNESS, coverage-honest, no league tables. |
| M10 | May 2027 | Change Reliability Tier-1 | [2027-05-change-reliability-t1.md](2027-05-change-reliability-t1.md) | scoring-model §6; build order P3 | KPI 9 scores on deploy events — no Sentry required. |
| M11 | Jun 2027 | In-flow coaching plugin (Addendum B) | [2027-06-coaching-plugin.md](2027-06-coaching-plugin.md) | scoring-model §8 | Prevention at the moment of work — private, need-gated, ≤3 nudges/day. |
| M12 | Jul 2027 | AI P&L v1 (2a stage ③ + 2b seats) | [2027-07-ai-pnl-v1.md](2027-07-ai-pnl-v1.md) | phase-2 §9 | Build + Run + Work on one honest page; the training-vs-procurement join. |

## Backlog (deferred by owner decision, 2026-07-06)

| Feature | PRD | Reconsider when |
|---|---|---|
| Function-pack framework + DevOps pack | [backlog/devops-function-pack.md](backlog/devops-function-pack.md) | Engineering pack has pilot PMF and a real DevOps team asks |
| Manager Enablement Index | [backlog/manager-enablement-index.md](backlog/manager-enablement-index.md) | Pilot leads ask to be measured; the M8 placeholder becomes a felt gap |

Both PRDs are complete and build-ready; only their priority changed. The lead-eligibility
routing they depend on still ships in M8.

## Dependency spine

- **M1 → M3 → M4**: the two-index model plus the engine that connects them. M4 needs both indexes live to test harness→outcome links.
- **M2 → M6 → M12**: the run-cost lane — bill visibility → tag attribution → unit economics + seats. Deliberately isolated from workforce scoring; M2's only output the rest depends on is the tag schema decision (feeds M6).
- **M5 → M7 → M8 → M9**: production auth before telemetry, telemetry + identity before roster onboarding at scale, roster before org rollup.
- **M10** is GitHub-side and independent of the org chain; it must follow M1 (it extends Outcomes) and starts KPI 9's promotion clock (clean month → promoted ~Jun).
- **M11** needs M1/M3/M4 (need-gated rules read the person's own KPI profile + linkage priorities) and M9 (access rules for the private tab / anonymized themes).
- **M12** consumes M6 (tags) and M7 (seat-activity signals) and joins them to the workforce indexes.

## Architecture guardrails (the "keep it simple" contract)

1. **One app, one DB, one job runner.** Next.js on Render + Supabase + Inngest. No new services this year.
2. **New capability = parser extension or API route first**, new infra never. The only genuinely new runtime surfaces all year: the telemetry ingest endpoint (M7, an API route) and the coaching plugin (M11, which runs on the developer's machine — not our infra). The run-cost lane is scheduled pulls on the existing job runner; the gateway is recommended, never hosted by us.
3. **Determinism boundary is non-negotiable**: `lib/scoring` computes every number; LangGraph agents only narrate.
4. **Isolated lanes**: run-cost tables and ingest can fail without touching workforce scoring — and vice versa.
5. **Migrations append-only** (automation owns 0030+); column truth = `supabase/migrations/*.sql`.
6. **No dummy data, ever.** Every monthly ship gate is verified on real ingested data (dogfood first, pilot org from Q3).
7. **Honest numbers over complete numbers**: nulls, confidence chips, tier badges, coverage lines everywhere — a partial number is labeled partial, and no dollar is ever derived (billed dollars only, in the run-cost buckets where they are fetched facts).

## Operating cadence (every month)

1. PRD ratified by the product owner before the month starts (open questions answered or explicitly deferred).
2. Work ships as dogfood PRs with the `Co-authored-by: Claude` trailer — Prism measures its own build, per [dogfooding.md](../dogfooding.md).
3. Last week = calibration review (anchors vs real data; flagged anchors never socialize without owner sign-off) + `handoff.md` update.

## Positioning note (from the v1.1 re-cut)

The company story leads with the money, not the scoring: **"we show where AI money goes,
whether it creates value, and how to improve ROI safely."** The workforce indexes are how we
explain the *why* behind the numbers — the join no pure cost dashboard can make. A standalone
positioning one-pager (30-second story, three layers: cost visibility → operational
intelligence → workforce optimization) is owed alongside M2.

## Year-end success criteria

- Dogfood org publishes **both workforce indexes** at ≥0.40 confidence with zero measurement-artifact corrections outstanding.
- **CFO-grade run-cost surface live from September**; feature-level attribution with coverage honesty from January; **AI P&L v1 by July** with ≥1 savings action verified against a real bill.
- **≥1 external pilot org** onboarded via the wizard (M8) and reading its own org dashboard (M9) by end of Q3.
- KPI 9 **promoted into the Outcomes core** after one clean Tier-1 month (clock starts May).
- Coaching plugin live with measured act-rate and **zero prompt text ever leaving a developer machine** (audited).

## Standing risks

| Risk | Mitigation |
|---|---|
| Anchor miscalibration makes everyone look better/worse than reality | Flagged-anchor chips; owner review gate before any score is socialized (scoring-model §12-9) |
| Single-founder bandwidth vs 12 ships | Each PRD scoped to one month with explicit out-of-scope; two lanes (workforce, run-cost) never block each other |
| Pilot org slips → org features unvalidated | Dogfood org doubles as pilot until then; M8–M9 ship gates runnable on dogfood data |
| Run-cost wedge pulls focus entirely off the workforce moat | The join is the differentiation; M12's training-vs-procurement verdict only exists because both lanes ship |
| Privacy erosion as surfaces multiply | The three-mechanism design (scoring-model §8) restated as an NFR in every PRD that touches developer data |

## Changelog

| Version | Date | What changed |
|---|---|---|
| v1 | 2026-07-06 | Initial 12-month roadmap: v3.0 → org scaling → run-cost capstone. |
| v1.1 | 2026-07-06 | Hybrid re-cut after investor-perspective review, owner-approved: run-cost pulled forward (stage ① → M2/Sep, new stage-② attribution month → M6/Jan), year ends on AI P&L v1 (M12); reliability → M10, coaching → M11; Manager Enablement Index + DevOps pack → backlog; positioning note added (lead with cost, explain with the workforce join). |

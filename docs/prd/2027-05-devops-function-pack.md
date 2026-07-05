# Function-pack framework + DevOps pack (M10 · May 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §1 §5 §8, [M7 PRD](2027-02-onboarding-roster.md), [M8 PRD](2027-03-org-rollup-dashboard.md), [roadmap](README.md)

## Context / Problem

- Prism measures one function: engineering. Phase-2's horizontal axis is the **Function Pack** — re-instantiating the same machine for another function by answering four declarative questions (unit of delivery · AI-work→artifact link · outcome evidence · harness practices) while the invariants stay fixed.
- The ratified rollout order is **DevOps first** — nearly free, because it reuses the engineering rails: same git, same PRs, same revert detection, same link ladder.
- One interface is a hard prerequisite (Phase-2 §5): the **repo/system → function mapping** that routes delivery data into the right pack. Without it, multi-function ingest can't attribute artifacts.

## Goals

- A pack is configuration, not code: activating DevOps instantiates KPIs, anchors, and connector requirements from a declarative pack definition through the same engine.
- The DevOps function publishes both indexes (MAIN + HARNESS) for a real DevOps team or the dogfood infra work, on the engineering rails.
- The no-cross-pack-comparison rule is enforced in the product, not just documented.

## Non-goals

- No DataOps, ML, or QA packs (framework makes them cheap later; each still needs its own PRD and anchor calibration).
- No Product function — **removed by owner decision** (Phase-2 decision ledger: outcome truth too distant); the pack table will not quietly grow it back.
- No new engine mechanics: invariants (two indexes, H0-first, honest nulls, confidence, cadence, trust ladder) are frozen by construction.
- No pack-specific coaching rules this month (C-rules stay engineering-tuned; DevOps rules are a later calibration).

## Users / Personas

- **DevOps engineer**: sees their AI-assisted infra work measured on the same honest terms as engineering.
- **DevOps lead**: activates the pack, maps repos/systems, reads the function dashboard.
- **Exec**: sees a second function row appear in the org table — with no cross-function ranking possible.

## User stories

- As a DevOps lead, I want to declare which repos are IaC/pipeline territory, so DevOps delivery data routes to my pack instead of engineering's.
- As a DevOps engineer, I want my Terraform PRs, pipeline changes, and runbooks to count as delivery, so my AI usage is measured against my actual output.
- As a DevOps lead, I want outcome evidence that means something in my world (change-failure, MTTR, drift incidents), so the Outcomes dimension isn't borrowed nonsense.
- As an exec, I want DevOps 60 and Engineering 65 to be explicitly non-comparable in the UI, so nobody builds a league table out of different rulers.
- As the product owner, I want DevOps anchors flagged until calibrated on real data, so no non-engineering score socializes uncalibrated.

## Scope

**In scope**
- Pack framework: a declarative pack definition (the four answers + KPI set + anchors + connector requirements) consumed by activation (M7 wizard), scoring scope, and views; Engineering itself becomes pack #1 expressed in the same format (proving the format, changing zero behavior).
- Repo/system → function mapping: admin surface routing repos (and later non-git systems) to a function's pack; unmapped repos default to engineering with the default visible.
- DevOps pack instance: unit of delivery = IaC/pipeline PRs + runbooks; link = the existing AI→PR rails; outcome evidence = change-failure (KPI 9 rails from M4), MTTR, drift incidents; harness = KPIs 12–15 with a DevOps applicability map.
- Within-pack comparability only: pack identity carried on every score; UI blocks cross-pack sorting/comparison (extends M8's no-league-table rules).
- Dogfood/pilot: Prism's own infra work (Render config, migrations tooling, CI) mapped to DevOps as the first real data.

**Out of scope**
- MTTR/drift ingestion beyond what GitHub deploy events + incidents tables already carry — new incident sources are P5-class enrichment per adopting org.
- Pack authoring UI (packs are shipped definitions this year; orgs tune anchors in Configure, never build packs from scratch).
- Cross-pack org-weighting changes (rollup already handles multiple functions from M8).

## Functional requirements

- FR-1: A pack is fully described declaratively (unit of delivery, link method, outcome evidence, harness applicability, KPI set, anchors, connector checklist); activation instantiates it without engine code changes.
- FR-2: Engineering runs as a pack definition with byte-identical scores before/after the refactor (golden-run regression gate).
- FR-3: The repo→function mapping routes each connected repo's PRs, commits, and deploy events to exactly one function's pack; changes re-route new data without corrupting history.
- FR-4: The DevOps function activates via the M7 wizard with pre-loaded KPIs, anchors (flagged), and connector requirements — never a blank slate.
- FR-5: DevOps delivery counts IaC/pipeline PRs and runbook changes in mapped repos as units of delivery, using the existing AI→PR link ladder unchanged.
- FR-6: DevOps Outcomes evidence: revert/rework on mapped repos plus change-reliability (M4 rails) scoped to DevOps-mapped deploys; drift incidents render as diagnostic until an org connects a drift source (honest null otherwise).
- FR-7: DevOps harness applicability: verification categories map to the DevOps toolchain (plan/validate/policy checks count as V-evidence per the pack definition); inapplicable categories flag the repo, not the person.
- FR-8: Every stored and displayed score carries its pack identity; no UI surface offers cross-pack sorting, ranking, or delta comparison; org surfaces show packs side by side with the "within-pack journey" framing.
- FR-9: DevOps anchors ship flagged-for-calibration and cannot be unflagged without the owner's calibration sign-off (same gate discipline as M1/M2).
- FR-10: The org rollup (M8) absorbs the second function with correct coverage, weighting, and mix-decomposition, verified on real data.

## Non-functional requirements

- **Regression safety**: the engineering golden-run (identical scores pre/post pack refactor) is the month's first gate; nothing ships without it.
- **Simplicity**: pack = data, not forked code; one mapping surface; no new services; additive migrations.
- **Determinism**: pack definitions versioned; a score is reproducible from (inputs, pack version, config version).
- **Comparability honesty**: the no-cross-pack rule enforced at the read layer so no future view can accidentally rank.

## Open questions

- DevOps pack anchors (per-KPI floors/targets) — Phase-2 open decision #1; provisional values proposed in W1, calibrated on first real month, socialized only after owner sign-off.
- Runbook delivery detection: which artifacts count (docs-repo PRs? ops-labeled PRs?) — define per adopting org in the mapping surface; dogfood definition decided W1.
- Drift-incident source for the first real DevOps team (none at dogfood scale — likely stays honest-null until a pilot brings one).

## Milestones

- W1: Pack definition format + Engineering expressed as pack #1 + golden-run regression gate.
- W2: Repo→function mapping surface + routing in ingest/scoring scope.
- W3: DevOps pack definition + applicability map + activation via wizard + UI pack-identity guards.
- W4: Dogfood infra mapped, first DevOps scores computed, anchor calibration review, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pack refactor silently changes engineering scores | med | high | Golden-run byte-identical gate in W1; no other work lands before it passes |
| DevOps at dogfood scale is thin data | high | med | Honest confidence gating is the designed behavior; pilot DevOps team is the Q4 target |
| Cross-pack comparison sneaks in via a generic table component | med | med | Read-layer enforcement + UI test asserting no cross-pack sort control renders |
| Mapping ambiguity (mixed repos: app + IaC in one repo) | med | med | Repo-level mapping first; path-level mapping recorded as a known limitation, revisited with pilot evidence |

## Success metrics

- Engineering golden-run: 100% identical scores pre/post pack framework.
- DevOps function active with both indexes computed (published or honestly gated) on real mapped data.
- Zero cross-pack comparison surfaces (UI audit + tests).
- Second function visible in org rollup with correct coverage and mix-decomposition.

## References

- Spec: [phase-2.md](../phase-2.md) §1 (invariants, four answers, pack table, decision ledger), §5 (mapping prerequisite), §8 (rollout order)
- Rails reused: AI→PR link ([scoring-model.md](../scoring-model.md) §4), KPI 9 T1 ([M4](2026-11-change-reliability-t1.md)), harness KPIs ([M2](2026-09-harness-index.md))
- Code: `lib/scoring/` (config-driven engine), `functions.repo_ids` (mapping predecessor), M7 wizard activation

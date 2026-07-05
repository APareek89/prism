# Change Reliability Tier-1 — KPI 9 on deploy events (M10 · May 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §6 §11 P3, [roadmap](README.md), [M1 PRD](2026-08-core6-main-index.md)

## Context / Problem

- Outcomes currently rests on reverts (KPI 7) and rework (KPI 10) — both pre-deploy-boundary signals. Whether an AI change **failed in front of users** is unmeasured.
- The old change-failure design chained estimates on a Sentry-hygiene prerequisite most orgs fail. v3.0 rebuilt KPI 9 as tiered **Change reliability**: Tier-1 (rollback/hotfix ≤48h — the DORA definition) scores on platform-native deploy events, **no Sentry required**.
- Decision already made (scoring-model §12-3): adopt the Tier-1 rule; promote KPI 9 into the Outcomes core after one clean Tier-1 month.

## Goals

- Tier-1 change reliability computes on GitHub deploy events for connected repos, with zero estimation in the failure signal.
- Every reliability number carries its tier badge and the AI-vs-human fairness control.
- The promotion path to the Outcomes core is measurable: one clean Tier-1 month starts the clock.

## Non-goals

- No Tier-2 (Sentry new-error regression), Tier-3 (PagerDuty/helpdesk), or Tier-4 (flags/value) — P5 enrichment, out of this year's critical path.
- No non-GitHub deploy systems (Argo/Spinnaker webhooks) this month; the detector rule is written to accept them later.
- No change to KPI 7/10 — KPI 9 complements, not replaces.

## Users / Personas

- **Function lead**: sees whether AI-assisted changes hold up post-deploy, with the human baseline beside it.
- **IC developer**: sees their own deploy-linked failures with the full attribution chain and per-hop confidence.
- **Platform admin**: grants the GitHub "Deployments" permission and validates that deploy events actually flow.

## User stories

- As a function lead, I want change failure defined exactly as DORA does (rollback or hotfix ≤48h), so the number is one my org already accepts.
- As an IC, I want to see the evidence chain (deploy → SHA → PR → AI link) with confidence per hop, so a "failure" attributed to me is auditable.
- As a function lead, I want AI-majority vs human-majority failure rates side by side, so AI is never blamed by framing.
- As the product owner, I want KPI 9 to stay diagnostic until a clean Tier-1 month proves the data, so we never promote an unverified signal into the core.

## Scope

**In scope**
- GitHub "Deployments" permission + deploy/deployment-status webhook ingestion for connected repos.
- Rollback/hotfix detector: revert-deploy, or fix-tagged deploy ≤48h on the same service/environment — the rule text is published in-product.
- Attribution chain deploy → merge SHA → PR → AI link with per-hop confidence; multi-PR deploys flagged low-confidence (batch blur).
- Tier badge on every number; AI-vs-human control always displayed; diagnostic placement until promotion.
- Dogfood coverage: emit GitHub deploy events for Prism's own Render deploys so the ship gate runs on real data.

**Out of scope**
- Sentry hygiene checker and Tier-2 activation (P5).
- Severity weighting by affected users (Tier-3, P5).
- Promotion itself into the Outcomes core — a config flip executed only after the clean month completes (likely Jun).

## Functional requirements

- FR-1: Deploy events and statuses for connected repos are ingested and stored as raw evidence, keyless-safe like every connector (an unconfigured repo writes nothing, never throws).
- FR-2: A deployment counts as **failed** when a revert-deploy or a fix-tagged deploy ships to the same service/environment within 48h; the exact rule is published on the KPI's info panel.
- FR-3: Change reliability = failed AI deploys ÷ AI deploys, direction ↓, anchors 100 pts at ≤5% and 0 pts at ≥30%.
- FR-4: A deploy is AI-attributed via the chain deploy SHA → merge SHA → PR → AI link; each hop stores confidence; the drill-down displays the full chain.
- FR-5: Multi-PR deploys carry a visible low-confidence flag; they never silently blame every included PR.
- FR-6: Every displayed reliability number shows its tier badge (T1 this year) — no naked numbers.
- FR-7: The AI-majority vs human-majority deploy failure-rate control renders wherever the KPI renders.
- FR-8: KPI 9 is placed as a diagnostic (outside the weighted Outcomes core) until one calendar month of clean Tier-1 data completes; the UI shows progress toward promotion.
- FR-9: With no deploy events observed for a repo, the KPI renders "unmeasurable — deploy events not connected" (the H0 case), never 0.
- FR-10: The dogfood repo emits deploy events for its Render deploys, so the ship gate is validated on real Prism deploys.
- FR-11: Failure events, once counted, appear in a drill-down list with evidence (deploy ids, timestamps, rule leg that fired) for audit.

## Non-functional requirements

- **Determinism**: detector is pure and versioned; re-running over the same events yields identical failures.
- **Reliability**: webhook ingestion is idempotent (event redelivery safe); backfill covers gaps on reconnect.
- **Simplicity**: one new permission, one webhook route extension, one detector module, additive migrations — no new services.
- **Performance**: attribution chain resolution adds <30s to the daily batch at dogfood scale.

## Open questions

- Hotfix tag convention: `fix:`-typed deploy commit vs deploy label — pick the published rule leg per org, default proposal: conventional-commit `fix:` on the deployed head. (owner, W1)
- Environment scoping: production-only by default, or include staging with a separate toggle? (CPO proposal: production-only.)
- Does Render's GitHub integration emit Deployments natively, or do we add a deploy-status step to the dogfood pipeline? (resolve in W1 spike — determines dogfood evidence path.)

## Milestones

- W1: Permission rollout + webhook ingestion + dogfood deploy-event spike (Render → GitHub Deployments).
- W2: Rollback/hotfix detector + published rule text + failure drill-down.
- W3: Attribution chain with per-hop confidence + batch-blur flag + tier badge + fairness control UI.
- W4: Dogfood month-zero run, event audit, ship gate; clean-month promotion clock starts.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dogfood deploy events sparse (few deploys/month) | high | med | Small-sample banner + confidence gate already standard; pilot-org data grows N |
| Deploy system records no rollbacks (H0) | med | high | Explicit "unmeasurable until connected" state; setup guide for deploy-status emission |
| Batch deploys blur attribution | med | med | Low-confidence flag on multi-PR deploys; recommend smaller batches via diagnostic H3 |
| Rule mismatch with org's actual hotfix habits | med | med | Rule text published in-product; per-org rule-leg configuration kept minimal |

## Success metrics

- 100% of counted failures show a complete evidence chain with per-hop confidence.
- Deploy-event coverage: every dogfood production deploy in the window appears in the ledger.
- Zero estimated values inside the Tier-1 failure signal (audit).
- Promotion clock running: one clean Tier-1 month completes without a data correction.

## References

- Spec: [scoring-model.md](../scoring-model.md) §6 (tier ladder, rules, setup), §9 KPI 9 tree, §12-3
- Code: `lib/connectors/github/` (webhook + backfill extension point), `lib/scoring/`
- DORA change-failure definition (external, industry-accepted)

# AI Run-Cost visibility — Bucket 2a, stage ① (M2 · Sep 2026)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §9 §10, [roadmap](README.md), run-cost interactive spec (`prism-model-lab/public/run-cost.html`)

## Context / Problem

- Prism's whole idea is reducing the cost of AI / improving its ROI. Bucket 2a — **AI inside the product serving customers** — is COGS that scales with customers, and most companies see it as one blurry invoice total. This is a CFO-grade pain with an obvious buyer.
- **Re-sequenced 2026-07-06 (owner decision):** run-cost was originally the July 2027 capstone; investor review flagged it as the market wedge, and it was deliberately designed as an isolated ingest lane — which is exactly what makes it movable to month two with no dependency on the workforce roadmap.
- The dollars rule flips here by design: bucket 1 is tokens-only, but 2a shows **dollars because they are billed** — provider usage/billing figures are fetched facts. "No invented dollars" was always the real rule.
- The journey's stage ① is achievable confidently today: per-key/project daily spend from provider usage APIs, and the build-vs-prod breakup once keys are split per environment.

## Goals

- A company sees its product-AI spend as a real number with a real breakup: by key/project, by model, by day, and split build-vs-serve.
- The attribution-coverage gate exists from day one — computed at the granularity available (key/env level this stage), with the granularity labeled — so every future 2a KPI inherits honesty.
- The gateway decision (tag schema + recommended gateway) is made this month, so stage ② ([M6](2027-01-run-cost-attribution.md)) can build ingestion against a settled contract.
- The run-cost lane stays architecturally separate from the workforce indexes — it cannot destabilize them.

## Non-goals

- No Run-Cost Health Index (L1) headline — the composite waits for tag-level attribution coverage (stage ③+).
- No gateway-tag ingestion — that is stage ② ([M6](2027-01-run-cost-attribution.md)); this month decides the schema and recommendation only.
- No Bucket 2b (work cost / seats) and no Bucket 3 (value attribution — deliberately deferred; Prism never fabricates "revenue from AI").
- No cost optimization actions/automation (savings verification is a later journey stage).

## Users / Personas

- **Founder / finance owner**: finally sees what product AI actually costs, split build vs serve, next to the raw bill.
- **Platform admin**: connects provider accounts, labels keys by environment, runs the key-split checklist.
- **Product engineer**: sees per-key/model spend trends; spots anomalies early.

## User stories

- As a finance owner, I want daily billed spend per provider key/project, so the invoice stops being one opaque monthly number.
- As a platform admin, I want Prism to tell me exactly which keys mix build and prod traffic, so the key-split (the stage-① unlock, hours of work) is a guided task instead of archaeology.
- As a finance owner, I want build-vs-serve split so margin math uses serve-spend only — building features is R&D, not COGS.
- As a finance owner, I want the raw billed monthly total always shown beside any derived view, so I never wonder whether Prism replaced the fact with an estimate.
- As the owner, I want the journey indicator to state our stage and the single next unlock, so the path from "one number" to unit economics is legible.

## Scope

**In scope**
- Provider usage/billing ingestion (Anthropic first; the ingest model provider-agnostic): per-key/project daily spend, tokens, model — fetched facts, stored as raw evidence like every connector, idempotently.
- Environment mapping: keys/projects labeled build / prod / mixed-unknown (admin-configured); the mixed-key detector + guided key-split checklist.
- Build-vs-serve split over labeled spend; unlabeled spend shown as its own explicit slice.
- Attribution coverage (the GATE) at this stage's granularity: env-labeled spend ÷ total billed spend, with the granularity stated ("key-level; feature-level arrives with gateway tags").
- The Run-Cost surface: a separate tab with journey stage indicator, daily/monthly spend trends, per-key/model views, raw bill always beside derived views.
- Gateway spike: evaluate LiteLLM/Portkey/Helicone-class vs thin proxy; produce the recommendation + the tag schema (`feature · model · env · customer-tier`) for owner sign-off (resolves Phase-2 open decision #5).
- Dogfood: Prism's own Anthropic usage (agents, pipeline) ingested as the first real account.

**Out of scope**
- Tag-level ledgers, feature×model views, calls-per-use (stage ②, [M6](2027-01-run-cost-attribution.md)).
- Monetization-alignment KPIs (paid-serving share, CAC lens, waste share — need customer-tier tags + product analytics; stages ③–④).
- Building or hosting a gateway ourselves.
- Second provider (OpenAI etc.) — the ingest model proves provider-agnosticism on paper; a second provider lands when a pilot needs it.

## Functional requirements

- FR-1: A connected provider account yields daily spend/tokens/model per key/project, ingested idempotently and shown as fetched fact (billed dollars allowed — never derived dollars).
- FR-2: Admins label keys/projects with environment (build / prod / mixed-unknown); the surface lists mixed-unknown keys as the stage-① unlock with a guided key-split checklist.
- FR-3: Build-vs-serve split renders over labeled spend; unlabeled spend is shown as its own explicit slice, never silently bucketed.
- FR-4: Attribution coverage renders as the gate on the Run-Cost surface, computed at key/env granularity with the granularity labeled; every derived view carries a low-confidence marker while coverage is below the (flagged) threshold.
- FR-5: The raw billed monthly total is always displayed alongside any derived breakdown (the "next to, never instead of" rule).
- FR-6: The journey stage indicator states the org's current stage and the single next unlock, per the Phase-2 journey definition.
- FR-7: A monthly invoice reconciliation view compares usage-API totals to the actual invoice; discrepancies are displayed, never smoothed.
- FR-8: Run-cost data lives in its own ingest lane and tables; no workforce-index computation reads it, and a run-cost ingest failure cannot fail the workforce pipeline.
- FR-9: The gateway recommendation + tag schema are documented and owner-approved by month end, published in-product as the stage-② prerequisite ("route product AI calls through a gateway that stamps feature · model · env · customer-tier").
- FR-10: Dogfood: Prism's own provider account renders stage-① views on real spend at ship gate.

## Non-functional requirements

- **Honesty**: billed facts vs derived views visually distinct; anchors flagged until calibrated on the first real customer bill (Phase-2 §10-6).
- **Isolation**: separate ingest lane, separate tables, separate failure domain from workforce scoring.
- **Security**: provider tokens server-side only; read-only billing/usage scopes; key rotation documented.
- **Simplicity**: scheduled pulls via the existing job runner (Inngest); no gateway hosted by us; one new tab.

## Open questions

- Gateway recommendation (Phase-2 §10-5): decide in the W1 spike; owner sign-off by W3 — the tag schema is the stage-② contract.
- Attribution-coverage gate threshold at key granularity (spec's ≥95% is a tag-level target; key-level starts lower) — ship flagged provisional, calibrate on the first real bill.
- Usage-API completeness vs invoice (fees, credits, rounding) — tolerance band for the reconciliation view set after the first month's comparison.

## Milestones

- W1: Provider usage-API ingestion (Anthropic) + raw evidence tables + gateway/tag-schema spike.
- W2: Env labeling + mixed-key detector + key-split checklist + build-vs-serve split.
- W3: Run-Cost tab (trends, per-key/model, coverage gate, journey indicator) + reconciliation view + gateway recommendation to owner.
- W4: Dogfood stage-① live on real spend, invoice reconciliation, flagged-anchor review, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Provider usage APIs lag or under-report vs invoice | med | med | Reconciliation view; discrepancies displayed, never smoothed |
| Keys can't be split quickly (shared infra) | med | low | Mixed-unknown is a first-class state with its own slice; the checklist frames the unlock, nothing blocks |
| Second-month distraction from the model work (M1 just shipped) | med | med | Isolated lane by design; zero shared tables with `lib/scoring`; M3 (harness) is unaffected |
| Scope creep toward the full L1 index | med | med | L1 explicitly out of scope; views publish only where inputs exist |

## Success metrics

- Dogfood provider account: daily per-key spend visible, build-vs-serve split rendered, reconciles with the real invoice within stated tolerance.
- Attribution-coverage gate live and displayed on every derived view, granularity labeled.
- Zero derived dollars anywhere (billed facts only — audit).
- Zero coupling: workforce pipeline green with run-cost ingest disabled/failed (fault-injection test).
- Gateway recommendation + tag schema signed off — stage ② unblocked.

## References

- Spec: [phase-2.md](../phase-2.md) §9 (journey, KPI tables, dollars rule, gateway prerequisite), §10-5/6
- Interactive spec: `prism-model-lab/public/run-cost.html` (localhost:4600) + shared Vercel copy
- Successors: [M6 Run-Cost attribution](2027-01-run-cost-attribution.md) (stage ②), [M12 AI P&L v1](2027-07-ai-pnl-v1.md) (stage ③ + 2b)
- Precedent discipline: tokens-only rule and "published beside the fact" from [scoring-model.md](../scoring-model.md) §7

# AI Run-Cost visibility — Bucket 2a, journey stages ①–② (M12 · Jul 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §9 §10, [roadmap](README.md), run-cost interactive spec (`prism-model-lab/public/run-cost.html`)

## Context / Problem

- Prism's whole idea is reducing the cost of AI / improving its ROI. A year of roadmap covered Bucket 1 (people building with AI). Bucket 2a — **AI inside the product serving customers** — is COGS that scales with customers, and most companies see it as one blurry invoice total.
- The owner's two keys are ratified (Phase-2 §9): ① visibility (which feature/model costs what) and ② segmentation (build vs serve · calls vs uses · who it serves). The company journey starts with what's achievable **confidently today**: per-key/project daily spend from provider usage APIs, and the build-vs-prod breakup once keys are split per environment.
- The dollars rule flips here by design: bucket 1 is tokens-only, but 2a shows **dollars because they are billed** — invoices and usage-API figures are fetched facts. "No invented dollars" was always the real rule.
- This is the year's capstone: it opens the AI P&L story (2b work-cost, bucket 3 value) that defines year two.

## Goals

- A company sees its product-AI spend as a real number with a real breakup: by key/project, by model, by day, and split build-vs-serve.
- The attribution-coverage gate exists from day one, so every downstream 2a KPI inherits honesty ("tagged share of spend" before any unit economics).
- The Run-Cost surface is architecturally separate from the workforce indexes — a new ingest lane that cannot destabilize them.

## Non-goals

- No Run-Cost Health Index (L1) headline this month — L2 sub-scores publish only where their inputs exist; the composite waits for gateway-tag coverage (stage ③+).
- No Bucket 2b (work cost / seats) and no Bucket 3 (value attribution — deliberately deferred; Prism never fabricates "revenue from AI").
- No full gateway rollout across the org's features — this month ships ingestion + the tag schema + the coverage gate; routing every product call through the gateway is the customer's stage-② journey, supported but not required for stage-① value.
- No cost optimization actions/automation (savings verification via the adoption loop is stage ⑤).

## Users / Personas

- **Founder / finance owner**: finally sees what product AI actually costs, split build vs serve, next to the raw bill.
- **Product engineer**: sees per-feature/per-model spend once tags flow; spots retries and prompt bloat early.
- **Platform admin**: connects provider accounts, splits env keys, configures the gateway tags.

## User stories

- As a finance owner, I want daily billed spend per provider key/project, so the invoice stops being one opaque monthly number.
- As a platform admin, I want Prism to tell me exactly which keys mix build and prod traffic, so the key-split (the stage-① unlock, hours of work) is a guided task instead of archaeology.
- As a finance owner, I want build-vs-serve split so margin math uses serve-spend only — building features is R&D, not COGS.
- As a product engineer, I want the attribution-coverage gate visible ("62% of spend is tagged"), so I never trust unit economics built on untagged spend.
- As the owner, I want run-cost shown next to the raw billed $/month, never instead of it, so the index discipline ("published beside the fact") carries over.

## Scope

**In scope**
- Provider usage/billing ingestion (Anthropic first; the ingest model provider-agnostic): per-key/project daily spend, tokens, model — fetched facts, stored as raw evidence like every connector.
- Environment mapping: keys/projects labeled build vs prod (admin-configured), the mixed-key detector, and the build-vs-serve split computed from it; dev-on-prod-keys leak surfaced when fingerprints allow.
- The tag schema decided and shipped (`feature · model · env · customer-tier`), plus gateway-tag ingestion for calls that already flow through a tagging gateway — so stage ② lights up per-feature the moment a customer adopts tags.
- KPIs live this month: **attribution coverage (the GATE)** · cost by key/project/model · build-vs-serve split · untagged share; per-feature cost and calls-per-use render only where tags + usage counts exist (honest nulls otherwise).
- The Run-Cost surface: a separate tab with the journey stage indicator ("you are at stage ① — next unlock: key split / gateway tags"), spend trends, and the raw bill always beside derived views.
- Dogfood: Prism's own Anthropic usage (agents, pipeline) ingested as the first real account.

**Out of scope**
- The 2a L1 composite (Run-Cost Health Index) and monetization-alignment KPIs (paid-serving share, CAC lens, waste share — need customer-tier tags + product analytics; stages ③–④).
- Building or hosting a gateway (open decision Phase-2 §10-5: LiteLLM/Portkey-class vs thin proxy — resolved as a recommendation this month, adopted by customers on their side).
- Cache-hit/prompt-creep KPIs beyond what usage APIs expose per key.

## Functional requirements

- FR-1: A connected provider account yields daily spend/tokens/model per key/project, ingested idempotently and shown as fetched fact (billed dollars allowed — never derived dollars).
- FR-2: Admins label keys/projects with environment (build / prod / mixed-unknown); the surface lists mixed-unknown keys as the stage-① unlock with a guided key-split checklist.
- FR-3: Build-vs-serve split renders over labeled spend; unlabeled spend is shown as its own explicit slice, never silently bucketed.
- FR-4: **Attribution coverage** = tagged spend ÷ total billed spend, rendered as the gate on the Run-Cost surface; every derived view carries a low-confidence marker while coverage is below the (flagged) threshold.
- FR-5: Gateway-tagged calls ingest against the shipped tag schema; where tags exist, cost by feature × model renders; where they don't, the surface shows untagged share instead of pretending.
- FR-6: Calls-per-use renders only for features with both call counts and feature-use counts connected; otherwise the KPI states exactly which input is missing.
- FR-7: The raw billed monthly total is always displayed alongside any derived breakdown (the "next to, never instead of" rule).
- FR-8: The journey stage indicator states the org's current stage and the single next unlock, per the Phase-2 journey definition.
- FR-9: Run-cost data lives in its own ingest lane and tables; no workforce-index computation reads it, and a run-cost ingest failure cannot fail the workforce pipeline.
- FR-10: Diagnosis is H0-first: a spend spike routes through traffic-growth → retry-storm → prompt-bloat → model-drift → free-tier-abuse hypotheses with the evidence for each, before any action is suggested.
- FR-11: Dogfood: Prism's own provider account renders stage-① views on real spend at ship gate.

## Non-functional requirements

- **Honesty**: billed facts vs derived views visually distinct; anchors flagged until calibrated on the first real customer bill (Phase-2 §10-6).
- **Isolation**: separate ingest lane, separate tables, separate failure domain from workforce scoring (architecture guardrail: additive, decoupled).
- **Security**: provider tokens server-side only; read-only billing/usage scopes; per-connector key rotation documented.
- **Simplicity**: scheduled pulls via the existing job runner; no gateway hosted by us; one new tab.

## Open questions

- Gateway recommendation (Phase-2 §10-5): LiteLLM/Portkey/Helicone-class vs thin proxy — W1 spike produces the recommendation + tag schema mapping; owner decides before W3.
- Attribution-coverage threshold for the gate (spec target ≥95%, gate proposal starts lower while orgs ramp) — ship flagged provisional, calibrate on first real bill.
- Which second provider (OpenAI?) lands this month vs next — CPO proposal: Anthropic only for the ship gate; the ingest model proves provider-agnosticism on paper, second provider when a pilot needs it.

## Milestones

- W1: Provider usage-API ingestion (Anthropic) + env labeling + mixed-key detector; gateway spike → recommendation + tag schema.
- W2: Build-vs-serve split + attribution-coverage gate + untagged share.
- W3: Gateway-tag ingestion + feature×model views (where tags exist) + journey indicator + H0-first spike diagnosis.
- W4: Dogfood stage-① live on real spend, anchor flags reviewed, year-end ship gate + year-two (2b/③–⑤) proposal drafted.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Provider usage APIs lag or under-report vs invoice | med | med | Monthly invoice reconciliation view; discrepancies displayed, never smoothed |
| No tagged traffic exists yet → surface looks empty | high | low | Stage-① value (bill breakup + build-vs-serve) needs zero tags; journey indicator frames what's next |
| Scope creep toward the full L1 index | med | med | L1 explicitly out of scope; L2 views publish only where inputs exist |
| A second ingest lane distracts from workforce-product polish | low | med | Isolation by design; fixed one-month box; year-two proposal captures overflow |

## Success metrics

- Dogfood provider account: daily per-key spend visible, build-vs-serve split rendered, reconciles with the real invoice within stated tolerance.
- Attribution-coverage gate live and displayed on every derived view.
- Zero derived dollars anywhere (billed facts only — audit).
- Zero coupling: workforce pipeline green even with run-cost ingest disabled/failed (fault-injection test).
- Year-two proposal (2b + stages ③–⑤) drafted off real learnings.

## References

- Spec: [phase-2.md](../phase-2.md) §9 (L1/L2 structure, journey, KPI tables, dollars rule, gateway prerequisite), §10-5/6/7
- Interactive spec: `prism-model-lab/public/run-cost.html` (localhost:4600) + shared Vercel copy
- Precedent discipline: tokens-only rule and "published beside the fact" from [scoring-model.md](../scoring-model.md) §7

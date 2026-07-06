# Run-Cost attribution — gateway tags, stage ② (M6 · Jan 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §9, [M2 PRD](2026-09-run-cost-visibility.md), [roadmap](README.md)

## Context / Problem

- Stage ① (M2) made the bill visible: per-key daily spend, build-vs-serve. But "which **feature** burns the money, on which model, serving whom" needs call-level tags — the ledger the whole 2a journey stands on.
- The prerequisite is ratified (Phase-2 §9): route product AI calls through a gateway that stamps `feature · model · env · customer-tier` on every call. Without tags, 2a collapses to one blurry total — the same hygiene lesson as release-SHAs for KPI 9.
- Strategically, this is the moat month: if Prism owns the attribution layer for AI workloads — with coverage honesty no one else offers — everything downstream (unit economics, margin analysis, the AI P&L) builds on it.
- The tag schema and gateway recommendation were decided in September (M2 FR-9); this month builds against that settled contract.

## Goals

- Tagged call data flows into a **feature × model × env ledger**, and attribution coverage upgrades from key-level to **tag-level** — the spec's true GATE (target ≥95%, flagged until calibrated).
- The first per-feature economics render where inputs exist: cost by feature × model, calls-per-use, dev-on-prod-keys leak.
- Prism dogfoods its own prescription: our product LLM calls (agent narration) route through the chosen gateway with tags — real tagged traffic from day one.

## Non-goals

- No unit-economics headline (cost per 1k uses / per successful outcome — stage ③, [M12](2027-07-ai-pnl-v1.md)).
- No monetization-alignment KPIs (paid-serving share, CAC lens, waste share — need customer-tier adoption + product analytics; stages ③–④).
- No Run-Cost Health Index (L1) composite — still gated on coverage maturity.
- No hosting a gateway for customers; adoption happens on their side with our schema + guide.

## Users / Personas

- **Product engineer**: sees which feature burns tokens, on which model, and whether retries/fan-out are eating money invisibly.
- **Platform admin**: rolls the gateway out feature-by-feature, watches tag coverage climb.
- **Finance owner**: gets the first defensible feature-level cost statements.

## User stories

- As a product engineer, I want cost by feature × model, so "why is the AI bill up" has a specific answer instead of a shrug.
- As a product engineer, I want calls-per-use flagged when it drifts above ~1.3, so retry storms and hidden fan-out surface before the invoice does.
- As a platform admin, I want coverage per feature ("chat is 100% tagged, search is 0%"), so the rollout has a visible finish line.
- As a finance owner, I want dev-fingerprinted spend on prod keys flagged, so pure waste stops polluting unit economics.
- As the owner, I want every derived view to carry the coverage gate, so nobody quotes feature economics built on 40% tagged spend.

## Scope

**In scope**
- Gateway-tag ingestion against the M2 schema (`feature · model · env · customer-tier`): call-level records → daily feature × model × env ledger (aggregated storage, raw evidence discipline).
- Tag-level attribution coverage: tagged spend ÷ total billed spend, per provider and per feature; the GATE on every derived view; untagged share always visible.
- Cost by feature × model views; env cross-check (tag env vs key env — disagreements surfaced, not resolved silently).
- Calls-per-use where feature-use counts are connected (product analytics counter or customer-provided metric); the KPI states exactly which input is missing otherwise.
- Dev-on-prod-keys leak detection where fingerprints allow (env tag disagreeing with key label = the leak signal).
- H0-first spend-spike diagnosis (traffic grew → retry storm → prompt bloat → model drift → free-tier abuse), each hypothesis with its evidence, terminating in an action.
- Journey indicator advances to stage ② with stage ③ (unit economics) as the named next unlock.
- Dogfood: Prism's own narration/agent LLM calls routed through the chosen gateway with tags.

**Out of scope**
- Automated optimization actions (routing rules, caching changes) — recommendations only, verified against the next bill in later stages.
- Customer-tier analysis (tags accepted and stored; the serve-who views are stage ④).
- Backfilling pre-gateway history (the ledger starts when tags start; untagged history stays visible as untagged).

## Functional requirements

- FR-1: Tagged calls ingest idempotently against the published schema; malformed or partially-tagged calls are counted in untagged/partial share, never guessed into features.
- FR-2: The ledger renders cost by feature × model × env at daily granularity, with billed-fact totals always reconciled to the provider ingest (stage ① lane) — a tag ledger that disagrees with the bill shows the delta.
- FR-3: Tag-level attribution coverage renders per provider and per feature; every derived view carries the gate state; below-threshold views are marked low-confidence with the untagged share stated.
- FR-4: Calls-per-use computes only where a feature-use count source is connected; above the flagged threshold (~1.3) the ledger flags the feature with the retry/fan-out hypothesis attached.
- FR-5: Env disagreements (tag says dev, key labeled prod) surface as the dev-on-prod-keys leak list with spend attached.
- FR-6: A spend-spike diagnosis runs H0-first over the ledger; each fired hypothesis shows its evidence and a concrete action; no action is suggested on unverified data.
- FR-7: The gateway rollout guide (per-feature adoption, schema reference, verification step) ships in-product; a feature's first tagged call flips it from "untagged" to "partially tagged" with coverage tracked.
- FR-8: The isolation rule holds: tag-lane failures cannot fail the stage-① ingest or the workforce pipeline.
- FR-9: Dogfood: Prism's own product LLM calls flow tagged through the gateway; our own feature×model ledger renders at ship gate.

## Non-functional requirements

- **Honesty**: coverage gate on everything derived; untagged is a first-class rendered category; deltas vs billed facts displayed.
- **Scale/simplicity**: call-level ingest aggregates to daily ledger rows on write (no raw call warehouse); the existing job runner schedules pulls; no new services.
- **Security**: gateway export tokens server-side; no prompt/response content ever ingested from the gateway — spend/latency/tags metadata only (the privacy rule extends to product traffic).
- **Reliability**: idempotent ingest; gaps on reconnect backfill from gateway logs where the gateway retains them, else the gap is shown.

## Open questions

- Feature-use count source for calls-per-use at dogfood scale (Prism's own features are internal — likely pipeline-run counts as the use metric; confirm W1).
- Partial-tag policy: is `feature` alone (no customer-tier) "tagged" for coverage purposes? (CPO proposal: yes for stage ②; tier completeness tracked separately for stage ④.)
- Coverage threshold ramp: start the gate at 60 (the spec's low-confidence line) and raise toward 95 as rollout matures? (CPO proposal: yes — thresholds flagged and visible.)

## Milestones

- W1: Tag ingestion + ledger tables + coverage computation; dogfood gateway routing for Prism's own calls.
- W2: Feature × model views + billed-fact reconciliation + untagged share + env cross-check/leak list.
- W3: Calls-per-use + spend-spike H0 diagnosis + rollout guide + journey indicator.
- W4: Dogfood ledger live on real tagged traffic, coverage audit, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Customers slow to adopt gateway tagging | high | med | Stage-① value stands alone; per-feature coverage makes rollout progress visible; dogfood proves the path |
| Gateway vendor lock-in concerns | med | med | Schema is ours and gateway-portable; the recommendation (M2) documented alternatives including thin proxy |
| Tag quality drift (renamed features, typos) | med | med | Feature registry with unknown-tag quarantine — unknown tags count as untagged until claimed |
| Ledger-vs-bill mismatch erodes trust | med | high | Reconciliation delta always displayed; the bill remains the headline fact |

## Success metrics

- Dogfood: 100% of Prism's own product LLM calls tagged; our feature×model ledger reconciles with the provider bill.
- Tag-level coverage computed and displayed on every derived view; unknown tags quarantined, never guessed.
- Calls-per-use live for ≥1 real feature (dogfood pipeline metric).
- Zero content ingested from the gateway (metadata audit).

## References

- Spec: [phase-2.md](../phase-2.md) §9 (two keys, gateway prerequisite, KPI table, H0 diagnosis), §10-5
- Predecessor: [M2 Run-Cost visibility](2026-09-run-cost-visibility.md) (stage ①, tag schema decision)
- Successor: [M12 AI P&L v1](2027-07-ai-pnl-v1.md) (stage ③ unit economics + 2b)

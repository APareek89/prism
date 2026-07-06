# The operating principle — verified deltas per month

> Status: Adopted 2026-07-06 (strategy arc, owner-aligned)
> Consumer: every feature, connector, customer ask, partnership, and architecture decision
> Also summarized in [handoff.md](../../handoff.md); this is the canonical version with rationale

## The asset

Prism's irreversible asset is the **cross-organization intervention-outcome corpus**: the
accumulated record of *we recommended X, in context C, the customer acted, and outcome Y
verifiably followed — or didn't, and we recorded that too.*

One unit = a **verified delta**: recommendation → customer action → outcome verified from
data (never self-report), at an org that isn't us.

## Why this and not the alternatives (the elimination, condensed)

| Candidate | Verdict |
|---|---|
| Evidence graph | Substrate, not asset. Delivery side (PRs, reverts) is backfillable from GitHub years later; only the work side (sessions, in-flight verification) is contemporaneous-only. **Customer-owned → creates retention, not differentiation** |
| Provenance ledger | Truly irreversible (signatures can't be backdated) but customer-owned by design — it's why they can't uninstall, not why we win |
| Benchmark dataset | Compounds with N, not time; any incumbent with a customer base rebuilds it faster. Commodity-in-waiting |
| Cost ledger | Invoices persist; mostly re-fetchable |
| Protocol adoption | A consequence, not a daily accumulation (see [awp-protocol-sketch.md](awp-protocol-sketch.md)) |
| **Intervention corpus** | **Cannot be backfilled even in principle — you cannot retroactively intervene. Company-owned. The only candidate that compounds super-linearly** |

**The rung argument (why the corpus is not "just a query over the graph"):** observational
data and interventional data sit on different rungs of the causal ladder. No query over what
happened can tell you what would have happened if you'd acted differently. Rung-1 derivatives
(security/compliance/benchmark corpora) are what any incumbent derives once instrumented;
rung-2 knowledge only accumulates by acting and recording. The graph is the crawl; verified
deltas are the clicks.

**Three irreversibility mechanisms, and it sits on all three:**
1. *Contemporaneity* — evidence not captured live is gone forever.
2. *Calendar time* — verification windows can't be compressed with money; a 2028 competitor is structurally years of waiting behind.
3. *Willingness to be falsified* — every corpus row required making a recommendation that could visibly fail. Culturally unavailable to dashboard vendors whose model is "the number always flatters."

**The one-engineer test it passed:** delete everything but the corpus and one engineer, and an
actuary-for-AI-engineering still exists (base rates nobody else knows: what verification does
to revert rates in orgs like yours, what routing actually saves). No other candidate
regenerates a company.

## The north star

**Verified deltas per month**, decomposed into its four levers:

> partner orgs × recommendation-adoption rate × 1/verification-window-length × evidence quality

## The decision rule

For anything — feature, connector, customer request, partnership, hire:

> **Does it raise the accumulation rate of verified deltas?**
> If yes → probably do it. If no → it needs a strong, explicit justification.

Worked examples (settled during the arc):
- *Onboarding wizard?* Only when partner count is bottlenecked by onboarding friction. At 5 concierge partners it isn't. Stays cut.
- *Support another coding agent?* Yes when a design partner's stack demands it. **The partner tool mix is the integration roadmap** — no strategy doc decides connectors.
- *Dashboards?* Only surfaces that cause a customer to act count. The ROI statement is the installation vector; the recommendation card and verified-delta receipt outrank every chart.

## Sequencing corollary

Shortest verification windows build the corpus fastest: run-cost actions verify against the
next bill (~30 days); practice interventions (verification habits → revert rates) take a
quarter. **The cost lane is the fastest corpus-builder** — the v1.1 cost-forward re-cut is
corpus-optimal as well as wedge-optimal. Two independent arguments, same first moves.

## Day zero, and the uncomfortable truth

- The graph accrues a little dogfood history daily. The corpus accumulation rate is **~zero**: N=1, founder recommending things to himself.
- **Day zero of the corpus = the first verified delta at a non-dogfood org.**
- Five design partners are not distribution. They are the start of the only asset that cannot be bought, copied, or backfilled.
- Until day zero, every elegant artifact is decoration. The bottleneck is not model fidelity; it is installation.

*History records. Evidence explains. Learning compounds.*

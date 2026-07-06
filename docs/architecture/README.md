# Prism docs index

Start here to navigate the design + build docs.

| Doc | What it covers |
|---|---|
| [`../../handoff.md`](../../handoff.md) | **Session-continuity summary** — status, run steps, decisions, gotchas. Read first. |
| [`../../README.md`](../../README.md) | Quick start + milestones |
| [`../testing.md`](../testing.md) | End-to-end testing path (reset → connect → PRs → run pipeline) |
| [`../dogfooding.md`](../dogfooding.md) | How Prism measures its own development via PRs |
| [`../scoring-model.md`](../scoring-model.md) | **Canonical scoring model (spec v3.0)** — two-index structure (MAIN Core-6 15/35/50 + separate HARNESS index), linkage engine, KPI reference w/ trust + cadence, diagnostic trees, coaching (Addendum B), estimations, build order. App still implements v1 — gap table at top |
| [`../phase-2.md`](../phase-2.md) | **Phase-2 spec (org scaling)** — function packs (DevOps/DataOps/ML/QA; Product deferred), headcount-weighted org rollup, management dashboard, scope chain + RBAC, onboarding wizard (CSV→SCIM roster), Manager Enablement Index. Aligned 2026-07-02 — nothing implemented; Phase-1 = the v3.0 model |
| [`../prd/README.md`](../prd/README.md) | **1-year product roadmap (Aug 2026 → Jul 2027, v1.1)** — one feature/month, one PRD each (12 PRDs + 2 backlog in `docs/prd/`). v1.1 hybrid re-cut: run-cost pulled forward (Sep bill visibility · Jan attribution · Jul AI P&L v1); manager index + DevOps pack on backlog. Now the **build library** — sequencing governed by `docs/strategy/` |
| [`../strategy/README.md`](../strategy/README.md) | **Strategy record (2026-07-06 arc)** — operating principle (north star: verified deltas/month + decision rule) · next-6-months experiment plan (GOVERNS sequencing, kill criteria) · design-partner outreach (live action) · IC review · inevitability exercise · AWP protocol sketch + v0.1 event schema (5%-effort thread) |
| [`ownership-map.md`](ownership-map.md) | **Single-owner rules** — read before adding files (migrations, clients, types, auth) |
| [`../superpowers/specs/2026-06-30-prism-mvp-design.md`](../superpowers/specs/2026-06-30-prism-mvp-design.md) | The MVP design spec (divergences, milestones) |
| [`../superpowers/specs/2026-06-30-prism-architecture.md`](../superpowers/specs/2026-06-30-prism-architecture.md) | Full file-by-file architecture |
| [`../reference/prism_dashboard.html`](../reference/prism_dashboard.html) | The approved pixel design the UI ports |

## The one-line mental model
Deterministic scoring engine (`lib/scoring`, LLM-free) turns real connector data into
`index_daily`/`kpi_daily`; LangGraph agents (`lib/agents`) narrate those numbers (never
compute them); the Inngest pipeline runs the daily loop; the four views render it.

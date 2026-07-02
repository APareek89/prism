# Prism Phase-2 — from one engineering function to an org

> **PHASE-2 SPEC — aligned with the product owner 2026-07-02. Nothing here is implemented;
> Phase-1 = the v3.0 engineering model (`scoring-model.md`). This doc extends Prism from one
> engineering function to an org.**

---

## ⚠️ Read this first

Phase-1 (`docs/scoring-model.md`, v3.0) defines how Prism measures ONE function — engineering —
end to end: two indexes, Core-6 + Harness-4, linkage engine, diagnostics, coaching. Phase-2
answers the questions that turn that single-function product into an org product:

| Question | Answer |
|---|---|
| How does the model extend beyond engineering? | Function Packs (§1) |
| How do function scores become one org number — honestly? | Org rollup (§2) |
| What does leadership actually look at? | Management dashboard (§3) |
| Who sees what, and how do you drill down? | Scope chain & RBAC (§4) |
| How does a company get set up? | Onboarding wizard (§6) |
| How are managers measured without breaking privacy? | Manager Enablement Index (§7) |

Same status discipline as the v3.0 app-vs-spec gap table: **everything below is aligned but not
implemented** — treat it as the target, never the state. When the owner says "build Phase-2",
start from the defaults table (§8) and the open decisions (§9).

## Phase-2 in one paragraph

Phase-1 proved the measurement machine on engineering: two 0–100 indexes, deterministic
numbers, H0-first diagnostics, private in-flow coaching. Phase-2 scales that same machine along
two axes **without changing it**. Horizontally, a **Function Pack** re-instantiates the machine
for DevOps, DataOps, ML, and QA by answering four declarative questions (unit of delivery ·
AI-work→artifact link · outcome evidence · harness practices) — the invariants stay fixed, and
scores stay comparable within a pack only. Vertically, function scores roll up to an **org
index** (headcount-weighted, confidence-gated, mix-decomposed) and drill down a scope chain
(Org → Function → Team → Individual) with role-based visibility. Two new surfaces complete the
org story: an **onboarding wizard** (pick functions → CSV roster → eligibility flags) and a
**Manager Enablement Index** that scores leads on what they removed from their team's way —
never on inherited team level, never on per-IC coaching data.

## 1. Function Packs — extending beyond engineering

### The invariants — what never changes per function

The core machine is function-agnostic by design. Every pack inherits these unchanged:

| Invariant | What it fixes |
|---|---|
| **Two-index structure** | MAIN = Usage / Efficiency / Outcomes · HARNESS = practices, scored separately, never mixed |
| **Measurement-point sorting rule** | KPIs file by *where the number is observed*, never by what skill causes it |
| **H0-first diagnostics** | Every tree starts with "is the number even real?" — no coaching on bad data |
| **Anchors / gates / confidence** | Floor→0, target→100, no bonus beyond target; L0/L5 gates; publish floor; small-N band drop |
| **Honest nulls** | No denominator → `null`, never 0-by-default |
| **Linkage engine** | Within-person harness→outcome tests — insights only, never scored |
| **Cadence** | Scoring is always a daily batch; coaching triggers are realtime in-flow |
| **Trust ladder** | Platform-native evidence > derived > estimated — the badge is always displayed |

### What a Function Pack is

A pack is **4 declarative answers**, not a new engine. To stand up a function you answer:

| # | Question | Engineering's answer (the reference implementation) |
|---|---|---|
| (a) | What is the **unit of delivery**? | Merged PR |
| (b) | How does **AI work link to the artifact**? | AI→PR link (pr_link > sha > branch > coauthor) |
| (c) | What counts as **outcome evidence**? | Reverts, rework, change reliability |
| (d) | Which **harness practices** apply? | KPIs 12–15 (skills · verification · review-loop · continuity) |

### The packs

| Function | Unit of delivery | AI-work→artifact link | Outcome evidence | Difficulty |
|---|---|---|---|---|
| **DevOps** | IaC/pipeline PRs, runbooks | Same git/pr-link rails | Change-failure, MTTR, drift incidents | **Easy** — reuses engineering rails |
| **DataOps** | dbt/pipeline PRs | Same git rails | dbt test failures, data incidents, SLA breaches | Easy-medium |
| **ML** | Experiments, model promotions | git + MLflow/W&B registry | Model promoted, online metric holds, model rollbacks | Medium |
| **QA** | Test suites, bug reports | git / TestRail | Escaped defects (inverse), flaky rate of AI tests, reopened-bug rate | Medium |

**Rollout order: DevOps → DataOps → ML → QA** — ordered by how much of the engineering rails
each pack reuses. DevOps is nearly free (same git, same PRs, same revert detection); ML and QA
each add a non-git system (model registry, test management) whose link rails must be built and
trusted before scores are socialized.

**Decision ledger — so nothing silently returns:** *Product function deferred — outcome truth
too distant (spec-churn proxies only); revisit when a defensible outcome signal exists.*
Product is **REMOVED from the pack table by owner decision**. A product manager's outcome
(did the right thing get built?) is months away from the artifact and every near-term proxy is
spec churn — a number we could compute but could not defend. Recorded here so the pack does not
quietly reappear with weak evidence.

### The hard rule: no cross-pack comparison

Scores are comparable **WITHIN a pack only — never rank across packs.** A 60 means "60% along
this function's own adoption journey", calibrated against this function's own anchors. A DevOps
60 vs a QA 55 is not a ranking; the anchors, evidence quality, and journey shape differ by
construction. The UI enforces this everywhere (§3): no cross-function league table exists.

## 2. Org rollup

**Org score = headcount-weighted average of function MAIN scores.** People-weighted, because
the index is about the **workforce** — a 40-person function moves the org number more than a
4-person one, by design. Not weighted by revenue, budget, or seniority.

Three guards keep the org number honest:

| # | Guard | What it does |
|---|---|---|
| 1 | **Confidence gating** | Functions below the publish floor are **excluded** from the rollup. The org header always shows coverage: *"covers 68% of workforce; X pending data"* — a partial number is labeled partial, never passed off as whole. |
| 2 | **Framing** | The org number is **workforce AI-nativeness, NOT value produced.** It says how far the workforce is along the AI adoption journey — nothing about revenue, output volume, or ROI in currency (the same discipline that dropped Cost-USD from the engineering model). |
| 3 | **Movement decomposition** | Every org delta is split into **function-improvement** vs **headcount-mix-shift.** Hiring 20 people into a young, low-scoring function must not read as "the org got worse at AI" — the decomposition says which part of the move is behavior and which part is composition. |

Both indexes roll up the same way: **Org MAIN + Org HARNESS**, each carrying its own
confidence. The Harness rollup never mixes into the MAIN number — the Phase-1 separation
survives aggregation.

## 3. Management dashboard flow

**Org header:** Org MAIN · Org HARNESS · coverage % · AI Leaders count · token-spend trend ·
one mix-decomposed *"what moved the org"* line (guard 3 in prose, e.g. "MAIN +3: +4 from
function improvement, −1 from mix shift").

**Function summary table** — one row per active function:

| Column | Content |
|---|---|
| Function | Pack name |
| People covered | Headcount with published scores |
| MAIN | Function MAIN index |
| Usage / Eff / Outcomes | The three dimension scores |
| HARNESS | Function HARNESS index |
| 30-day trend | Direction + magnitude |
| Confidence | The gate state |
| Top insight | Narrated headline from the diagnostic layer — the "because", not just the number |

Rules that shape the experience:

- **Confidence chip on every cell** — no naked numbers, same as Phase-1.
- **Default sort is by headcount, NOT score** — deliberately not a league table. This is the
  no-cross-pack-ranking rule (§1) applied to the UI: the biggest populations surface first, not
  the "winners".
- **Click a row → the function dashboard** — the full Phase-1 experience (dimensions, KPIs,
  diagnostics, coaching themes) scoped to that function.

## 4. Scope chain & drill-down

The scope chain: **Org → Function → Team → Individual.** A global function selector switches
context; **My View** is always the logged-in person's own view, whatever their role.

| Role | Sees |
|---|---|
| Exec | All functions |
| Function lead | Own function |
| Manager | Team + members |
| IC | Self + team aggregates |

**Standing guarantee, restated for every level:** the coaching feed is **private to the
individual.** No manager, function lead, or exec ever sees per-person coaching data — managers
see anonymized themes only, exactly the Addendum-B promise from the scoring model. Scaling the
org chart does not scale away the privacy line.

Implementation note: the schema is already `function_id`-scoped — Phase-2 **generalizes the
existing scoping** rather than inventing a new hierarchy.

## 5. Admin / connectors

**Parked — owned separately.** Phase-2 does not spec the connector admin surface.

One interface must be defined later regardless of owner: the **repo/system → function mapping**
that routes delivery data into the right pack (which repos are DevOps IaC, which pipelines are
DataOps, which registries feed ML). Without it, multi-function ingest cannot attribute
artifacts to packs.

## 6. Company configuration (onboarding)

A three-step wizard — the goal is a company reaching first honest numbers without a services
engagement.

### Step 1 — Pick functions

Selecting a function **activates its pack**: KPIs, anchors, and connector requirements arrive
pre-loaded, tunable later in Configure. Never a blank-slate KPI builder.

### Step 2 — Roster via CSV

Columns: `name, email, function, team, manager_email, role (IC/lead)`, optional
`github_handle` + `ai_tool_account`.

| Rule | Behavior |
|---|---|
| Validation + dry-run | The upload is parsed and previewed before anything writes |
| Idempotent re-upload | Keyed on **email** — re-uploading a corrected CSV is safe, never duplicates |
| Unmatched accounts | `match_status = pending` + a resolution screen — no silent orphans, no guessed identity joins |
| SSO/SCIM sync (Okta/AD) | **v2, replacing CSV** — roster tables are designed from day one to accept both sources |

### Step 3 — Eligibility flags

The index is for the **WORKFORCE** — role drives eligibility:

- **Leads/managers are excluded from IC scoring by default** — they are routed to the Manager
  Enablement Index (§7) instead. A manager graded on IC KPIs is measured on the wrong job.
- **Contractors / interns:** configurable per org — included, excluded, or tracked separately.

## 7. Manager Enablement Index

**The premise:** a manager's output is the team's *system* — so measure **ENABLEMENT**, never
the team's inherited level, and never per-IC coaching data (the privacy guarantee holds at
every level). A manager who inherits an AI-native team scores nothing for the inheritance; a
manager who moves a struggling team scores for the movement.

| KPI family | What it measures | Evidence |
|---|---|---|
| **Team trajectory** | Δ of team MAIN over the manager's tenure — **trend, not level** | index history |
| **Enablement actions adopted** | Team-channel recommendations done AND verified | the adoption loop where owner = lead — adoption re-verified from data, never self-reported |
| **Friction removal** | Seats assigned, blocked repos fixed, telemetry enrolled | H3-family fixes — the administrative blockers the diagnostic trees route to `org` |
| **Multiplier cultivation** | AI Leaders emerging on the team, cross-team skill reuse | recognition + skill-usage events |
| **Coaching health** | Anonymized team aggregates ONLY: nudge act-rate, review-burden trend | aggregate coaching metadata — never per-IC data |

Same mechanics as every other index — nothing bespoke:

- **Anchors + confidence**, with the same publish floor discipline.
- **H0-first diagnostic trees** — low enablement-adoption starts at H0: *"were recs ever routed
  to this lead?"* (a routing/data gap) before H1: *"routed and ignored"* (a behavior gap).
- **< N reports → insufficient** — small teams are honestly suppressed, not noisily scored.

**Positioning line:** *"you're scored on what you removed from your team's way."*

## 8. Suggested defaults (decision table)

The aligned defaults — change only via the open-decisions process:

| Decision | Default |
|---|---|
| Org rollup | **Headcount-weighted** average of function MAIN scores, with confidence gating (§2) |
| Pack rollout order | **DevOps → DataOps → ML → QA** |
| Product function | **Deferred** (§1 decision ledger — revisit only with a defensible outcome signal) |
| Roster source | **CSV first, SCIM in v2** — tables accept both from day one |
| Manager index | **Enablement-only** — never inherited team level, never per-IC coaching data |
| Cross-pack ranking | **Never — anywhere in the UI** (default sort by headcount, no league tables) |

## 9. Open decisions

| # | Decision | Status |
|---|---|---|
| 1 | **Pack anchors per function** — each pack needs its own floor/target anchors (an engineering iteration anchor means nothing for QA suites); calibrate per pack with real data before socializing any non-engineering score | open |
| 2 | **Org-rollup weighting override option** — whether an org may override headcount weighting (e.g. exclude a function, cap a weight); default stays people-weighted | open |
| 3 | **Manager-index anchors** — floors/targets for the five KPI families in §7, plus the minimum-reports N | open |
| 4 | **SCIM timing** — when the SSO/SCIM (Okta/AD) roster sync replaces CSV as primary (v2 scope) | open |

---

*Changelog: v1 · 2026-07-02 — initial Phase-2 alignment with the product owner (function packs ·
org rollup · management dashboard · scope chain · onboarding · Manager Enablement Index).
Nothing implemented; Phase-1 = the v3.0 engineering model in `scoring-model.md`.*

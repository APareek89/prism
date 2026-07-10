# Onboarding a company and its users

> A runbook for taking a new org from zero to its **first honest numbers** — the AI-Native
> Index (Function / Team / My view) and the [ROI statement](prd/2026-08-roi-statement-v0.md)
> (`/statement`). Grounded in what ships today; roadmap gaps are called out inline.
>
> **Today (built):** single tenant, local-first, `DEMO_MODE=true`, one function, service-role
> reads. Setup is hands-on via `/admin` + a roster CSV — right for a **design-partner
> engagement**. **Coming:** real multi-user auth + RLS (M5), teammates' telemetry (M7), and a
> self-serve **onboarding wizard** (M8, teams/roles/eligibility). See [roadmap](prd/README.md).
>
> **Hard rule that shapes everything:** no dummy data. Every surface shows *awaiting signal*
> until real evidence is ingested — a number appears only when it's real.

## The shape of onboarding

```
Company  →  1. Function + config     2. Connect sources     3. Load the roster (users)
Users    →  4. Resolve identities    5. Do AI work → PRs     6. Run pipeline → first numbers
```

Steps 1–3 configure the org; 4–6 are what light the numbers up. The load-bearing step people
miss is **#5 — the AI→PR link** (below): without it, AI-denominated numbers stay `0/null`.

---

## Part A — Onboard the company

### 1. Function + config
- One **function** exists per tenant today (the Engineering pack; `functions` row). Config is
  seeded (`index_config` v1 — weights, anchors, sizing) and read-only in `/admin`. Nothing to
  build; a company is not a blank-slate KPI editor.

### 2. Connect sources (`/admin` → connector cards)
Each connector is keyless-safe: an unconfigured one writes nothing and never breaks the app.

| Connector | What it needs | What it powers |
|---|---|---|
| **GitHub** (App) | Click **Connect GitHub** → install the App on the org/repos. Env: `GITHUB_APP_ID/PRIVATE_KEY(base64 PEM)/WEBHOOK_SECRET/CLIENT_ID/CLIENT_SECRET` | Merged/open PRs, diffs, commits, revert detection, `Co-authored-by: Claude` trailers → the delivery + reliability numbers. On connect it sets `functions.repo_ids` and backfills. |
| **Claude Code** (local) | `CLAUDE_LOCAL_SESSIONS_DIR=~/.claude` — scans `**/*.jsonl` | Sessions, tokens, models, skills → Usage + the token numbers. Scans **all** repos; only connected-repo sessions get AI→PR-linked. |
| **Codex** (local) | `CODEX_LOCAL_SESSIONS_DIR=~/.codex` | Same `cc_sessions` store, `source='codex'`. No first-party link event → links ride branch/sha/coauthor only (lower confidence, shown honestly). |
| **Sentry** (optional) | `SENTRY_*` | Reliability enrichment; degrades to *insufficient signal* when absent. |

> Multi-user note: `~/.claude` / `~/.codex` are **local** paths — they cover the operator's
> machine. Fleet-wide telemetry ingestion for teammates is **M7**, not built.

### 3. Repos → the function
The GitHub install populates `functions.repo_ids`. Only sessions/PRs for **connected repos**
feed Efficiency/Effectiveness; other-repo sessions still count toward Usage/tokens.

---

## Part B — Onboard the users

### 4. Roster + identity resolution (`/admin` → Roster upload)
Upload a CSV. Idempotent (safe to re-upload); one shared function today.

**Columns** (case/space-insensitive; only `name` required; aliases in parens):
```
name, designation (title/role), github_handle (github/gh), email, claude_account_uuid (account_uuid)
```

Identity is resolved by `provisionEmployee`, precedence **`github_handle` → `email` →
`claude_account_uuid`**, which derives:

| `match_status` | When | Effect |
|---|---|---|
| `linked` | has a `github_handle` or `claude_account_uuid` | telemetry-linkable → scored |
| `byo` | personal/reimbursable subscription (the `is_demo` "self" is `byo`) | included in rates |
| `unmatched` | only name/email | shows up, but no identity join is guessed |

**Critical:** a person's `github_handle` must equal the handle that **authors their PRs**, or
their PRs land unattributed. This is the #1 cause of "my work isn't showing".

> Teams, `manager_email`, IC-vs-lead roles, eligibility flags, and an unmatched-account
> **resolution screen** are the **M8 wizard** — not in today's CSV. Managers-excluded-from-
> IC-scoring and the Manager Enablement route arrive then (see [M8 PRD](prd/2027-03-onboarding-roster.md)).

### 5. Generate linked AI work — the one thing that must be true
A Claude/Codex session links to a PR by, in order: **`pr-link` event** (`pr_link` @0.99, Claude
Code first-party) · **branch** (`session.branch == pr.head_ref`) · **sha** · **`Co-authored-by:
Claude` coauthor**. To produce linked data:

> **Do the work with Claude Code *inside the connected repo's directory*, on a feature branch,
> then open a PR from that branch — keep the `Co-authored-by: Claude` commit trailer.**

No link ⇒ `pr_ai_link` stays empty ⇒ every AI-denominated number is `0/null` (correct, not a bug).

### 6. Run the pipeline → first numbers
`/admin` → **Run pipeline now** (or the daily Inngest cron) runs: ingest → AI→PR link → blame →
score → insights → recommendations → courses → adoption. Then read:

- `/function`, `/team`, `/me` — the index + drill-ins.
- `/statement` — the CFO-facing ROI statement (share of AI-assisted work · held-up-after-merge
  AI vs human · tokens per AI PR), each number with an evidence badge and drill-down.

**Reading the honesty signals:** *awaiting signal* = no evidence yet (never a fabricated 0);
confidence **< 0.40 suppresses** the composite until enough signal exists; small cohorts
(N<5 on the statement) are labeled, not hidden.

---

## Quick checklist

- [ ] GitHub App installed; `functions.repo_ids` populated; backfill ran.
- [ ] `CLAUDE_LOCAL_SESSIONS_DIR` (and `CODEX_LOCAL_SESSIONS_DIR` if used) point at real logs.
- [ ] Roster uploaded; each active person `linked` or `byo`; `github_handle` == their PR author.
- [ ] At least one AI session done **in a connected repo, on a feature branch, merged as a PR**.
- [ ] **Run pipeline now** → `pr_ai_link` non-zero → `/statement` shows real numbers.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every AI number is 0 / *awaiting signal* | `pr_ai_link` empty — no linked session | Do Claude work in the connected repo on a feature branch → PR (step 5); re-run pipeline |
| A person's PRs unattributed | `github_handle` ≠ PR author handle | Correct the roster row; re-upload; re-run |
| Sessions ingest but don't link | Work happened outside a connected repo, or Codex (no `pr-link` event) | Use a connected repo; expect lower-confidence branch/sha/coauthor links for Codex |
| Composite index blank | Confidence < 0.40 (too little signal) | Ingest more real activity; partials still render |
| `npm run db:migrate` fails | It calls the absent Supabase CLI | Use `node --env-file=.env.local scripts/db-migrate.mjs` |

## References
- Connectors & the link model: [handoff.md](../handoff.md) ("How a Claude session links to a repo/PR").
- Provisioning/identity: `lib/onboarding/provision.ts`, `lib/onboarding/roster-csv.ts`, `employees.match_status`.
- The org-scale flow: [phase-2.md](phase-2.md) §5–§6 · the wizard: [M8 PRD](prd/2027-03-onboarding-roster.md).
- Dogfooding (Prism onboards itself): [dogfooding.md](dogfooding.md).

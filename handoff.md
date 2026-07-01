# Prism — Handoff / Session Continuity

> Compact status doc. Read this first if you're picking up the build in a new session.
> **What Prism is:** a local-first web app that measures & improves the ROI of Claude Code
> spend in software engineering. One "AI-Native Index (L1)" refracts into four L2 sub-indexes
> (Usage · Efficiency · Effectiveness · Proficiency). Numbers are deterministic; an LLM only
> narrates. Persona = engineering developers. Deploy target = **Render** (not Vercel).

**Repo:** `/Users/anandpareek/Documents/prism` · **GitHub:** `APareek89/prism` (private).
**Local URL:** `npm run dev` → http://localhost:3000 (the preview instance runs on :3070).

---

## Status at a glance
| Milestone | State |
|---|---|
| **M0 — Scaffold** (schema + RLS + deterministic scoring engine + keyless shell) | ✅ DONE |
| **M1 — Full faithful UI** (4 views + drill-in, empty states, read layer) | ✅ DONE |
| **M2 — Connectors + pipeline** (GitHub/Claude/Sentry, AI→PR link, onboarding, ingest→score, Admin wiring) | ✅ DONE |
| **M3 — Scoring fidelity** (per-PR blame/agentic/rework signals, config anchors reconcile) | ⏳ pending |
| **M4 — Insights + automation** (LangGraph agents, Inngest daily pipeline, Resend email, recommendations, courses, adoption) | ⏳ pending |
| **M5 — Demo polish + end-to-end** | ⏳ pending |

**Verified live:** Claude Code connector ingested **279 real `~/.claude` sessions**; the on-demand
pipeline runs clean (`ok:true`) and persists `kpi_daily`(13) + `index_daily`(2). Index is currently
`L0 / insufficient` — **correct**, because there are no GitHub PRs yet (Effectiveness/Efficiency need
delivery data; only Usage=10% has signal, below the 0.40 publish threshold). Connect GitHub + merge a
PR + Run pipeline → the index crosses the threshold and populates.

---

## Stack & layout
Next.js 15 (App Router) + React 19 + TS · Supabase (Postgres + RLS + Auth) · Inngest (M4) ·
**LangGraph + LangChain (TS, in-process)** for insight agents (M4) · Resend email (M4) ·
connectors: GitHub App, Claude Code local `~/.claude` `.jsonl`, Sentry.

```
app/            App Router — (views)/{function,team,team/[memberId],me} · admin · auth · api/*
components/     panels/* · admin/* · charts/* · ui/* · layout/*  (ports docs/reference/prism_dashboard.html)
lib/
  scoring/      DETERMINISTIC engine (pure, LLM-free, 143 unit tests). Entry: computeDaily()
  connectors/   github/* · claude-code/* · sentry/* · link/* · identity · blame · barrel index.ts
  pipeline/     assemble → computeDaily → persist; run.ts; app/api/pipeline/run
  onboarding/   provision.ts (provisionEmployee, ensureSelfEmployee)
  db/           read modules (DTOs) + onboarding.ts; _base.ts (db() client resolver)
  ui/           view-models.ts (DTO contract)
  auth/ config/ supabase/ types/    cross-cutting
supabase/migrations/   0001–0021 (schema+RLS+seed) · 0030 (attribution kind).  seed = config only
docs/
  superpowers/specs/   design + architecture specs
  architecture/ownership-map.md   single-owner rules (READ before adding files)
  reference/prism_dashboard.html   the approved pixel design
scripts/db-migrate.mjs   portable pg migration runner (no Supabase CLI needed)
```

## Run it
```bash
nvm use                      # Node 22
npm install                  # (.npmrc sets legacy-peer-deps)
npm run db:migrate           # apply supabase/migrations to SUPABASE_DB_URL
npm run dev                  # http://localhost:3000
npm run test:scoring         # 143 deterministic tests
npm run build                # must pass; used for Render
```
Migrations use `node --env-file=.env.local scripts/db-migrate.mjs` (the `db:migrate` script).
`--check` inspects the target without applying.

## Env (`.env.local`, gitignored — never commit)
Set: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
`ANTHROPIC_API_KEY`, `GITHUB_APP_ID/PRIVATE_KEY(base64 PEM)/WEBHOOK_SECRET/CLIENT_ID/CLIENT_SECRET`,
`CLAUDE_LOCAL_SESSIONS_DIR=~/.claude`, `DEMO_MODE=true`, `DEMO_USER_EMAIL`. Blank/optional: `SENTRY_*`,
`RESEND_API_KEY` (M4), `INNGEST_*` (M4 cloud), `LEARNING_STUDIO_BASE_URL` (M4).

## Live DB state (Supabase project fgdqzwlliriyjnwfsnjz)
- `functions`: 1 (bootstrap id `00000000-0000-0000-0000-0000000000f1`, name "My Engineering").
- `index_config`: 1 (v1, weights 10/25/40/25, cold-start anchors). **Only seed. No dummy data.**
- `employees`: 1 — the `is_demo` "You" (email = DEMO_USER_EMAIL). org = me = team.
- `cc_sessions`: 279 real sessions (from `~/.claude`). `gh_prs`: 0 (until GitHub installed).
- `kpi_daily`/`index_daily`: computed (L0/insufficient until PRs).

---

## Key decisions (divergences from the original PRD)
1. **Render, not Vercel** (`next.config` standalone + serverExternalPackages; `render.yaml` stub).
2. **No dummy data — ever.** Only seed is `index_config` v1. Empty/awaiting-signal states until real
   data. (A build agent once created a fake "avastone" employee — deleted; watch for this.)
3. **org = me = team today, multi-employee-ready** — nothing hardcoded to one user; scoring aggregates
   over N (median), RLS multi-user, GitHub org-sync onboards joiners.
4. **Agents = LangGraph + LangChain (TS, in-process)** — narrative only, never the numeric score.
5. **DEMO_MODE auth**: no real Supabase session, so `getAuthUser` binds to the real `is_demo` employee
   via service-role, and `lib/db/_base.ts db()` **reads via service-role in DEMO_MODE** (RLS would deny
   a session-less anon). Production (DEMO_MODE off) uses the RLS client — real enforcement.
6. **Portable pg migration runner** (Supabase CLI not installed). RLS helpers live in `public` schema
   (hosted Supabase denies `CREATE` in `auth`; `auth.uid()` is still used).

## Gotchas / lessons (avoid repeating)
- **Column drift**: subagents guess Supabase column names. ALWAYS read `supabase/migrations/*.sql` as
  the source of truth and validate queries with `select <cols> from public.<t> limit 0` against the
  live DB (the M1/M2 verifier technique). Real cols: employees `name/designation/claude_account_uuid/
  match_status`; connectors `last_sync_at/config_jsonb`; index_config `version/weights_jsonb`; insights
  `evidence_jsonb`; recommendations `ref/rationale` (no title/body); comms_log no `subject`.
- **`insights.kind`** ∈ {improvement, change, pr_level, **attribution**} (0030 added attribution).
- **Migration numbering**: data owns 0001–0021; 0030 = attribution; M4 pipeline tables → **0031+**.
- Real `~/.claude` = per-session `.jsonl`; usage on `message.usage`, model `message.model`, repo/branch
  from `cwd`/`gitBranch`, **no** top-level `account_uuid`; cost derived (pricing.ts).
- Don't write map-key separators as raw `\x00` bytes (makes files binary) — use `\x1f` text escape.

## Remaining work
- **M3**: `lib/pipeline/assemble.ts` currently zeroes per-PR signals (aiLinesMerged, aiLinesAliveAt30d,
  agenticMajority, defectReworkWithin14d, isSelfRevert) — wire them from `blame_snapshots` + `pr_ai_link`
  + `gh_commits` so Effectiveness/agentic KPIs compute once PRs exist. Reconcile stored
  `anchors_jsonb/sizing_jsonb` into `resolveScoringConfig` (currently uses canonical defaults). Deploy
  attribution by employee for N>1.
- **M4**: `lib/agents/*` (LangGraph state/graph/4 nodes/model/schemas/grounding/prompts/run) — narrative
  only, grounded in scoring numbers; `inngest/*` daily pipeline (cron + on-demand, the 12 steps);
  `supabase/functions/send-digest` (Resend) + email templates + outbox; `lib/recommendations/*` rules;
  `lib/adoption/*` monitoring; `lib/courses/*` (clone `APareek89/agentic-learning-studio@staging` — it's
  at `~/Documents/agentic-learning-studio`; completion is **Prism-owned** via a knowledge-check proxy).
- **M5**: end-to-end run polish, README refresh, Render deploy prep.

## Commits (main)
`5c6d1e7` spec → `816f330` architecture → `1eb3bf8` M0 → `a72694d` db fixes → `a452bb3` M1 →
`41e2050` M2 → `5ac1eff`/`02cd431` M2 convergence. (Later commits append below as M3–M5 land.)

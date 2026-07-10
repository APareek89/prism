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
| **M3 — Scoring fidelity** (per-PR revert/AI-lines/agentic/rework signals, stored config honored) | ✅ DONE |
| **M4 — Insights + automation** (LangGraph agents, Inngest daily pipeline + on-demand full loop, Resend email, deterministic recommendations + adoption, learning-studio courses) | ✅ DONE |
| **M5 — Demo polish + end-to-end** | ✅ DONE (verified on real data) |

**Verified live (2026-07-01):** both connectors are **connected** (the earlier "clean slate" note was
stale). Claude Code ingested **287 `~/.claude` sessions**; GitHub backfilled **8 merged dogfood PRs**
(#1–#8). On-demand pipeline runs clean (`ok:true`) → `kpi_daily`(13) + `index_daily`(3). Index is
`L0 / low` for the self employee — **correct**, because **`pr_ai_link`=0**: no Claude session links to
any PR yet (session `branch=HEAD`, no sha/trailer on the session side), so every AI-denominated KPI is
0/null. Fixing the AI→PR link is the key next piece.

**Session 2026-07-01 — 3 wiring fixes + AI→PR link (all merged to `main`):**
- **PR #9** — (1) persist per-KPI `signal_count` (was computed then dropped in `kpiRowsFor`/`toKpiDb`) →
  improvement + "what's going well" insights now generate; (2) read layer + email show the engine's **stored
  band** (`bandLabelForStored`) not an L1 bucket; (3) `prTitle` gates "AI-assisted" on `aiLinked`.
- **PR #10 — AI→PR link now FIRES.** Claude Code writes a first-party **`pr-link` event** ({sessionId,
  prRepository, prNumber}) to the session log; used as an exact `pr_link`@0.99 join key. Migration **`0033`**
  adds `cc_sessions.pr_refs` + extends the `pr_ai_link.method` CHECK. After re-run: `pr_ai_link` **0 → 50**,
  self employee **band L0 → L1**, `ai_assisted_pr_share` **0 → 100**, Effectiveness gets a real AI denominator,
  blame captured 724 AI lines.

**Model alignment (2026-07-02, PR #11):** the scoring model is now canonically documented in
**`docs/scoring-model.md`** — dimensions + MECE rule (file KPIs by measurement point, not cause),
all 13 KPIs w/ formulas + anchors + live status, the 8 flagged anchors needing review, per-KPI
diagnostic trees (H0 "is the number real?" first), control-group gap, telemetry unlock, privacy
line, and the open-decisions backlog. Read it before changing any KPI/weight/anchor.
**v1.1 (PR #12):** multiplier signal → OUT of the weighted index (now "AI Leaders" recognition +
L5 gate; code change queued); **agent-harness KPI family proposed** — 13 verification-harness ·
14 review-loop · 15 context-continuity (Goodhart guardrails documented).

## MODEL SPEC v3.0 (2026-07-02) — ⚠ SPEC IS AHEAD OF THE APP
The model was iterated through 3 feedback rounds in the **model lab** (`~/Documents/prism-model-lab`,
run `node server.mjs` → localhost:4600; per-row 💬 feedback in `feedback.json`; shareable read-only
copy: https://prism-model-lab-anand-pareeks-projects.vercel.app — feedback buttons only work on
localhost). `docs/scoring-model.md` mirrors the lab (v3.0 sync PR by background agent). Lab source
of truth: `prism-model-lab/public/content.js`.

**v3.0 decisions (owner-approved, NOT yet in code):**
1. **Two indexes.** MAIN index = Usage 15% · Efficiency 35% · Outcomes 50% (Core-6: KPIs 1 ai-share,
   3 cadence, 4 iterations, 6 tokens, 7 revert, 10 rework). **HARNESS index** = KPIs 12 skills-authored,
   13 verification, 14 review-loop, 15 continuity — equal weights, scored SEPARATELY (proficiency is a
   driver; inside the main index it double-counts).
2. **🔗 Linkage engine** (ex-KPI 11): never scored; within-person tests of harness-gap→outcome links
   (verification→reverts/rework · review-loop→reverts+review burden · continuity→iterations/tokens ·
   skills→repeat sessions). This is how "no harness caused your reverts" gets proven, not asserted.
3. **Removed/demoted:** KPI 2 agentic-depth → diagnostic signal · KPI 5 edit-survival → diagnostic
   signal · KPI 8 retention REMOVED (may only return with a human-baseline control) · **Cost/USD
   dropped everywhere — tokens only** · multiplier = AI Leaders recognition + L5 gate only.
4. **KPI 7:** ALL post-merge reverts count (self-caught included); who-caught routes the ACTION
   (self→verification coaching, other→review gate). Detection prefers GitHub-native revert linkage.
5. **KPI 9 rebuilt = "Change reliability"** on an evidence ladder: T1 rollback/hotfix ≤48h
   (GitHub deploy events — DORA, scores, no Sentry needed) · T2 new-error regression (Sentry,
   hygiene-gated ≥90%) · T3 user-impact corroboration · T4 value signal (flags+usage, parked).
   Tier badge on every number; promote to core after one clean T1 month. Sentry = optional enrichment.
6. **Cadence rule:** scoring = daily batch; coaching = realtime in-flow (Addendum B plugin, rules
   C1–C6, local eval ≤500ms, prompt text never leaves the machine).
7. **Backend build order** (Data & Integration tab): P1 Core-6 main index → P2 Harness index (parser
   extensions only — data already on disk) → P3 KPI 9 T1 (GitHub Deployments) → P4 telemetry/org
   rollout + coaching plugin → P5 optional enrichment (Sentry/PagerDuty/extra perms).

**APP vs SPEC gap (the next big implementation project):** the app still runs the v1 model — 13 KPIs,
weights 10/25/40/25, retention/CFR/acceptance in the engine, multiplier scored, single index. Nothing
in `lib/scoring` has been changed for v3.0. Do NOT partially implement; when the owner says
"implement v3.0", follow scoring-model.md's open-decisions table and ship via dogfood PRs.

**Phase-2 spec** (org scaling: function packs · org rollup · manager index · onboarding) → `docs/phase-2.md` — aligned 2026-07-02, not implemented.

**Product roadmap (2026-07-06, v1.1 DRAFT — awaiting owner ratification):** 1-year roadmap
(Aug 2026 → Jul 2027), one feature/month with a full PRD each, at **`docs/prd/`**
(`README.md` = the roadmap + index). **v1.1 = hybrid re-cut after an investor-perspective
review** (owner-approved in-session): run-cost pulled forward as the market wedge — M2 (Sep) =
2a stage ① bill visibility, M6 (Jan) = stage ② gateway-tag attribution, M12 (Jul) = **AI P&L
v1** (2a unit economics + 2b seats + the training-vs-procurement join). Workforce spine kept:
M1 Core-6 v3.0 (incl. over-linking fix) → M3 Harness → M4 linkage → M5 prod multi-user →
M7 telemetry → M8 onboarding → M9 org rollup → M10 reliability T1 → M11 coaching plugin.
**Manager Enablement Index + DevOps pack → `docs/prd/backlog/`** (deferred, reconsider
triggers documented). Positioning now leads with cost ("where AI money goes"), workforce
indexes explain the why. The roadmap still only sequences ratified decisions
(scoring-model v3.0 + phase-2) — nothing in it changes the model.

**Operating principle (2026-07-06, strategy-review arc — decided in-chat, no separate doc):**
- **Irreversible asset = the cross-org intervention-outcome corpus** ("verified deltas":
  recommendation → customer action → outcome verified from data). The evidence graph is the
  substrate (customer-owned → retention); the corpus is the company asset (interventional,
  cannot be backfilled or derived from observational data, compounds with trust × time).
- **North-star metric: verified deltas per month.** Decision rule for any feature, connector,
  customer ask, or partnership: does it raise the accumulation rate (more partner orgs ×
  higher rec-adoption × shorter verification windows × better evidence quality)? If no,
  it needs a strong justification.
- Sequencing corollary: shortest verification windows build the corpus fastest — run-cost
  actions verify against the next bill (~30d) vs practice interventions (~a quarter), so the
  v1.1 cost-forward re-cut is corpus-optimal as well as wedge-optimal.
- **Day zero of the corpus = first verified delta at a non-dogfood org.** Five design
  partners precede everything; the accumulation rate is currently ~zero and that is the
  company's real bottleneck (not model fidelity).
- **Owner override (2026-07-06): support Codex in Month 1** — ingest local Codex session
  logs as a parser variant on the claude-code rails (`source` tag on sessions; link falls
  back to branch/sha/coauthor since no `pr-link` event → lower confidence, shown honestly).
  Cursor/Copilot stay gated on the design partners' tool mix (Month 4). Not yet built.
- **Full strategy record → `docs/strategy/` (README = map + reading order).** Governance:
  `operating-principle.md` (every decision) > `next-6-months.md` (sequencing, kill criteria —
  GOVERNS; the prd/ roadmap is now the build library) > `design-partner-outreach.md` (live
  action: 20 CTOs → 5 partners, note included). Reference: `ic-review-2026-07.md` (pass-with-
  re-entry verdict), `inevitability-2026-07.md` (why-now + 10 answers), `awp-protocol-sketch.md`
  + `awp-events-v0.md` (protocol thread, hard-capped at ~5% effort until customer #5).

## Next session — paste-ready prompt (for the owner)
```
Continue the Prism project at /Users/anandpareek/Documents/prism.
FIRST read, in order: (1) handoff.md — status, v3.0 model decisions, app-vs-spec gap;
(2) docs/scoring-model.md — the v3.0 model spec (the TARGET); (3) CLAUDE.md — hard rules
(no dummy data · column truth from migrations · PR workflow with Co-authored-by trailer).
The model lab (planning artifact + my feedback loop) is at ~/Documents/prism-model-lab —
`node server.mjs` → localhost:4600; its public/content.js is the live spec the doc mirrors;
check feedback.json for my unprocessed comments and process them first if any are status "new".
KEY CONTEXT: the APP still implements the v1 model; the SPEC is v3.0 (main index 15/35/50
Core-6 + separate Harness index 12–15 + linkage engine + KPI 9 on deploy events). Do not
change scoring code until I explicitly say "implement v3.0". After reading, tell me the
current state in 5 lines and wait for my instruction.
```

**Session 2026-07-06 — Month-1 build, part 1 (link integrity + Codex connector):**
- **Over-linking FIXED** (was follow-up #1): new pure `lib/connectors/link/select.ts` —
  cwd-split sessions canonicalized to ONE candidate per `session_id` (pr_refs unioned, real
  branch wins), `coauthor` links suppressed on any PR covered by an exact `pr_link`/`sha`
  match. `linkAiToPr` is now RECONCILING: stale stored links (incl. the 22 cartesian
  coauthor rows) are deleted on re-run; `gh_prs.ai_assisted` + `cc_sessions.linked_pr` are
  un-marked when links disappear. Run "Run pipeline now" once to apply the correction.
- **Codex connector (owner decision — Month 1 scope):** `lib/connectors/codex/*` parses local
  `~/.codex` rollout .jsonl (env `CODEX_LOCAL_SESSIONS_DIR`, keyless-safe) into the SAME
  `cc_sessions` store with **`source='codex'`** (migration **0034**: enum value + column +
  check, applied to live DB; 288 existing rows backfilled `claude_code`). Codex emits NO
  `pr-link` event → links ride branch/sha/coauthor only (lower confidence, shown honestly).
  Parser format assumptions are flagged in its header — verify against real rollouts (H0).
- Admin grid + status route render the 4th connector card. Tests 254 pass (new: select +
  codex parser suites) · typecheck + build clean. NOTE: `npm run db:migrate` in package.json
  calls the absent Supabase CLI — use `node --env-file=.env.local scripts/db-migrate.mjs`.
  Pre-existing keyless-build gap found: `/admin` prerender fails with NO `.env.local`
  (violates ownership-map invariant; spawned as separate task).

**Session 2026-07-06 — Month-1 build, part 2 (ROI statement v0 + worktree env hook):**
- **ROI statement v0 shipped** (spec: `docs/prd/2026-08-roi-statement-v0.md`): new
  `/statement` route (`app/(views)/statement/page.tsx`) — one print-friendly page, the
  three load-bearing numbers over the trailing 28d, each with an evidence badge + a
  same-page drill-down (excluded from print). No bands/index/L-levels/USD. Pure derive
  layer `lib/db/statement-derive.ts` (+ 19 fixture tests) behind `lib/db/statement.ts`
  `getStatement(functionId, date)`; DTOs added to `lib/ui/view-models.ts`; barrel
  export in `lib/db/index.ts`; `.stmt-*` + `@media print` in `app/globals.css`.
  Verified on real dogfood data (fn "My Engineering"): share **100%** (10/10, badge "10
  first-party (0.99)"), held-up **AI 0% / human awaiting-signal** (0 reverts), **655.3k
  tokens/AI PR**, 58.5M unattributed. Live column probe + typecheck + 273 tests + build
  all green.
- **Gotcha (dates):** dogfood PRs actually merged **2026-07-01 UTC**; a `merged_at::date`
  read via node-pg *looked* like 06-30 — that's a node-pg local-TZ (IST +05:30) `Date`
  parsing artifact, not the stored value. Statement dates normalize to UTC
  (`new Date(iso).toISOString()`) so labels + window bounds are tz-independent (matches
  `lib/scoring/window.ts`); regression test locks it in.
- **Worktree env hook:** `scripts/copy-env.sh` + `.claude/settings.json` SessionStart
  hook copy the main repo's gitignored `.env.local` into a fresh worktree (idempotent,
  no-clobber, no-op in main). Fixes new worktrees starting without env (which blocks
  `npm run dev` + the column-truth check). Only helps FUTURE worktrees once it lands on
  the branch they're based on (`.claude/launch.json` is tracked, so a committed
  `.claude/settings.json` propagates).

**Session (hook-path spike) — AI→PR link over telemetry + the pr-link ingest loop:**
- **OTLP finding (measured against Claude Code 2.1.145):** the OTLP export carries identity
  (`user.account_uuid`/`user.email`/`organization.id`) + tokens/model, but **no repo /
  branch / PR-number** — `claude_code.pull_request.count` has "all standard attributes
  only" ("join on session.id"). So telemetry can drive Usage/tokens for a fleet but
  **cannot** do the AI→PR link; the 0.99 first-party signal must come from a first-party
  channel, not OTLP.
- **Hook path v0 built (capture→ingest→store):** a Claude Code plugin
  (`integrations/prism-marketplace/prism-pr-link`) with a `PostToolUse(Bash)` hook forwards
  `{sessionId, repo, prNumber}` to **`POST /api/ingest/pr-link`** (bearer `PRISM_INGEST_TOKEN`,
  metadata-only, idempotent on `session_id+repo+pr_number`), landing in **`pr_link_ingest`**
  (migration **0035**). Endpoint + token are config, never hardcoded (dev token now → org
  managed-settings force-enable later — same artifact). Verified end-to-end (forwarder script
  → route → row); 285 tests + build green.
- **NOT wired yet:** teach the AI→PR linker (`lib/connectors/link`) to read `pr_link_ingest`
  as a `pr_link`@0.99 source alongside `cc_sessions.pr_refs`. The OTLP receiver route is a
  separate, later piece (do not point telemetry at the pr-link endpoint).

**Session (Phase 1) — multiple logins + sign-in page fix (on the isolated dev DB):**
- **Multi-user auth activated** (`DEMO_MODE=false` on the isolated instance): middleware gates
  unauth → `/auth/sign-in`; email+password login (Supabase Auth, new `sb_publishable`/`sb_secret`
  keys); **first-login binding** (`lib/auth/link.ts` `linkOrProvisionUser` wired into
  `getEmployeeForUid`) provisions a distinct employee per auth user; per-user RLS verified (anon
  0 rows, each user sees only their own row). `employees.user_id` CRUD added. 285 tests + build green.
- **Sign-in page fixed:** app nav rail no longer leaks onto `/auth` (`Sidebar` returns null on
  `/auth/*`); defined the missing `--radius-sm/--radius/--radius-lg` tokens (a latent app-wide bug —
  square/unstyled inputs); rebuilt sign-in as a centered card with a hardened primary button
  (explicit `#5b8def`, FOUC-proof).
- **NEXT (approved): true multi-tenant onboarding** — updating the M8 PRD (org self-serve signup +
  invite-by-email + member self-register + an `organizations` tenant model), then implement. M8's
  hard dep (M5 auth+RLS) is met by this Phase 1; M7 is a soft (value) dep.

**Session (M8 v2) — TRUE MULTI-TENANT onboarding (W1+W2, on the isolated dev DB):**
- **Tenant model (migration 0036):** `organizations` = tenant root; `functions.org_id` (one
  function per org in v1, 1:many-ready); `current_org_id()` SECURITY DEFINER helper;
  organizations RLS = members read only their own org. Existing function backfilled into an org.
- **Org-scoped resolver:** `resolveBootstrapFunctionId` (11 admin routes) + `getCurrentFunctionId`
  (views) resolve the CALLER's org function — no first-row fallback (demo fallback kept).
- **Org signup + invite→join:** `lib/onboarding/org.ts createOrganization` (org+function+admin
  employee+admin role); `lib/auth/signup.ts signUpAction` (invited email → join that org via
  `findPendingInviteByEmail`; else org name → create a tenant; via service-role `admin.createUser`,
  v1 permissive — duplicate/fake orgs deferred per owner decision 2026-07-11); `linkOrProvisionUser`
  now multi-tenant (claim an invited seat by email; no bootstrap auto-provision); SignInForm has a
  create-account / org-name mode.
- **Verified with the REAL code** (node-env integration test `lib/auth/onboarding-mt.test.ts`,
  `describe.skipIf` without DB): org signup, invite→join, and **cross-tenant isolation** (org A
  can't see org B; anon sees none). 285 unit tests + build green. (Gotcha: integration tests that
  build the service-role client must set `// @vitest-environment node` — jsdom's `window` trips the
  server-only guard.)
- **NEXT (W3):** admin invite-by-email UI/route (reuse `provisionEmployee`) + an org-admin
  employees read policy — employees RLS is self-only today, so an admin can't yet list their roster.

**Still open (follow-ups, no code yet):**
1. ~~Over-linking~~ — **RESOLVED 2026-07-06** (see session block above).
2. **`ai_code_retention_30d` premature 0** — freshly-merged AI lines (<30d, not re-checked) score 0 instead
   of pending/null, dragging Effectiveness 100→66.7 and L1 ~46.5→33.2.
3. **Function-scope improvement panel empty** — engine emits `kpi_daily` only at employee scope, so function
   has no rows for its improvement agent (persist function KPIs, or aggregate employee KPIs).

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

## Automation loop (M4) — how it runs
`POST /api/pipeline/run` (Admin "Run pipeline now") and the Inngest daily function both call
`lib/pipeline/full-loop.ts runFullLoop({functionId,date})` = runPipeline (score) → runInsightsForScope +
runPrLevel (LangGraph agents → `insights`) → deriveAndStoreRecommendations (`recommendations`) →
assignCourses (`courses`) → monitorAdoption → queueDigests (`comms_log`/`comms_outbox`).
- **Agents** (`lib/agents/*`): LangGraph TS, narrative only. Numbers computed in `lib/agents/assemble.ts`;
  LLM schemas have NO numeric fields; `grounding.ts` drops any fabricated number. In DEMO_MODE (or no
  ANTHROPIC key) `mock-model.ts` produces schema-valid canned narration — **runs keyless**. Graph SKIPS a
  scope when confidence < 0.40, so with no GitHub PRs the index/insights stay empty (correct).
- **Recommendations/adoption** (`lib/recommendations/*`, `lib/adoption/*`): pure deterministic rules, no
  LLM. Fire on real session/KPI data; adoption re-verifies from the same data and advances status.
- **Email** (`lib/email/*` + `supabase/functions/send-digest`): digest is RENDERED + QUEUED in-app; the
  Deno Edge Function holds RESEND_API_KEY and sends. Blank RESEND key ⇒ queues, no-op send.
- **Courses** (`lib/courses/*`): maps weak dimension → ALS course; completion is Prism-owned via
  `app/api/courses/check`. ALS repo read at `~/Documents/agentic-learning-studio`.
- **Inngest** (`inngest/*`, `app/api/inngest`): daily cron `0 6 * * *` + on-demand event; run
  `npm run inngest:dev` for the local durable dev server.

## Connectors — how data flows in
Everything writes **raw evidence** tables via the service-role client; the scoring engine reads them.
Connectors are keyless-safe (a not-configured one writes nothing, never throws). Pipeline order:
`ingest.github → ingest.claude_code → ingest.sentry → link.ai_to_pr → blame.refresh → assemble →
computeDaily → persist` (then M4: insights → recs → courses → adoption → comms).

- **GitHub** (`lib/connectors/github/*`): App auth (base64 PEM → installation token). On connect it lists
  the installation's repos → `functions.repo_ids`, then `backfill()` paginates merged+open PRs, fetches
  per-file diffs + commits, computes RAW sizing (`files + hunks + 2·modules + 3·blast`), detects reverts
  (≤14d), and extracts `Co-authored-by: Claude` trailers → `gh_commits.ai_assisted`. Author handle →
  employee via `identity.ts`. Writes `gh_prs`, `gh_commits`, `blame_snapshots`. Webhooks
  (`/api/connectors/github/webhook`) keep it live; "Run pipeline now" backfills without webhooks.
- **Claude Code** (`lib/connectors/claude-code/*`): reads `~/.claude/**/*.jsonl` (the **local** demo path).
  `parser.ts` folds `message.usage` tokens, `message.model`, and derives repo/branch from top-level
  `cwd`/`gitBranch`; cost is DERIVED via `pricing.ts` (no top-level `account_uuid` in local files).
  `session-map.ts` upserts `cc_sessions` (unique on `session_id,repo`) bound to the is_demo self employee.
  Writes `cc_sessions`.
- **Sentry** (`lib/connectors/sentry/*`): releases→`deploys`, incidents→`incidents` (change-failure/MTTR).
  Optional — degrades to "insufficient signal" when unconfigured.
- **AI→PR link** (`lib/connectors/link/ai-to-pr.ts`): correlates a `cc_session` to a merged `gh_pr` and
  writes `pr_ai_link {method, confidence}`. This is what makes a PR "AI-assisted" for the KPIs.

## How a Claude session links to a repo/PR  ← key mental model
A `cc_session` carries `repo` (from the session's `cwd`) and `branch` (from `gitBranch`). The AI→PR link
matches it to a `gh_pr` by, in order: **branch** (`session.branch == pr.head_ref`) · **coauthor** (the
PR's commits have a `Co-authored-by: Claude` trailer) · **sha** overlap. So to generate linked data:
**do the work with Claude Code *inside the connected repo's directory*, on a feature branch, then open a
PR from that branch.** The session (cwd=repo, branch=feature-x) then links to the PR (head_ref=feature-x).
- `CLAUDE_LOCAL_SESSIONS_DIR=~/.claude` is GLOBAL — the scan ingests ALL your Claude sessions across every
  repo; each maps to its own repo via `cwd`. Only sessions/PRs for the **connected** repo(s)
  (`functions.repo_ids`) get AI→PR-linked and feed Effectiveness/Efficiency; other-repo sessions still
  count toward Usage/tokens.
- The self employee's `github_handle` must equal the repo's PR author (set to **`APareek89`**) or PRs land
  unmatched. Set via the roster, or already done for this demo.

## GitHub connect (current state)
- App = **`prismai1989`** (App ID 4181826). "Connect GitHub" now redirects to the **install** flow
  (`/apps/prismai1989/installations/new`), fixed in PR #6 (was wrongly using the OAuth authorize URL).
- Because "Request user authorization (OAuth) during installation" is ON, the Setup URL is disabled; GitHub
  post-install redirects to the **User authorization Callback URL** (set it to
  `http://localhost:3000/api/connectors/github/install`) WITH `installation_id` → our callback connects +
  backfills.
- Repo seeded with **6 real dogfood PRs** (#1–#6, all Claude-coauthored). `functions.repo_ids` =
  `{APareek89/prism}`, self employee `github_handle=APareek89`. DB is a **clean slate** (connectors
  not_configured, no ingested data) awaiting the live connect.

## Testing status / next
End-to-end loop is verified working: connect → sessions → PR → **AI-linked** → scored → narrated, on real data.
Next up are the three follow-ups above (over-linking, retention premature-0, function-scope KPIs). Agent
`ai_slop` verdict stays inert until per-PR agentic/rework signals land on `gh_prs` columns; revert/re-prompt
verdicts work today.

## Commits (main)
`5c6d1e7` spec → `816f330` architecture → `1eb3bf8` M0 → `a72694d` db fixes → `a452bb3` M1 →
`41e2050`/`5ac1eff`/`02cd431` M2 → `9d98a71` M3+M4 → `35da916` M5 docs. Then dogfood PRs #1–#11 (#1–#6 reset/docs/PR-template/install-flow · #7 handoff connectors · #8 CLAUDE.md ·
**#9 scoring+display wiring** · **#10 AI→PR link + migration 0033** · #11 scoring-model doc).
Repo: `APareek89/prism` (private). Workflow going forward = PRs (see `docs/dogfooding.md`).

-- 0035_pr_link_ingest.sql
-- Additive (per docs/architecture/ownership-map.md: automation appends at 0030+).
--
-- The HOOK PATH landing table. Claude Code's OTLP telemetry export carries identity +
-- tokens but NOT the repo / PR-number association (verified: pull_request.count has
-- "all standard attributes only"). So a first-party plugin hook forwards the pr-link
-- event {sessionId, repo, prNumber} to POST /api/ingest/pr-link, which lands it here as
-- raw evidence. The AI→PR linker can later consume these rows the same way it consumes
-- cc_sessions.pr_refs (migration 0033) — this keeps telemetry-forwarded links first-
-- class and auditable instead of overloading the local-scan session store.
--
-- METADATA ONLY: session id + repo + PR number (+ optional sha/branch/account). Never
-- prompt text or code — the ingest route drops anything outside this whitelist.
--
-- function_id is denormalized for RLS parity with the other raw tables. RLS is enabled
-- with no policy today: the ingest route writes via the service-role client (which
-- bypasses RLS), and DEMO_MODE reads go through service-role too — so anon is denied by
-- default. A function-scoped read policy joins the others when production RLS lands (M5).

create table if not exists public.pr_link_ingest (
  id            uuid primary key default gen_random_uuid(),
  function_id   uuid not null references public.functions (id) on delete cascade,
  session_id    text not null,                 -- Claude Code sessionId (hook payload)
  account_uuid  uuid,                           -- optional identity (telemetry account), nullable
  repo          text not null,                  -- "owner/repo"
  pr_number     integer not null,               -- the PR/MR number
  sha           text,                           -- optional merge/commit sha (link enrichment)
  branch        text,                           -- optional head branch (link enrichment)
  source        text not null default 'claude_code_hook',
  received_at   timestamptz not null default now(),
  -- Idempotency / dedup: a given session→(repo,PR) assertion is stored once. Redelivery
  -- (retry, at-least-once hook) upserts onto this key and is a no-op.
  constraint pr_link_ingest_session_repo_pr_unique unique (session_id, repo, pr_number)
);

create index if not exists pr_link_ingest_function_id_idx on public.pr_link_ingest (function_id);
create index if not exists pr_link_ingest_repo_pr_idx     on public.pr_link_ingest (repo, pr_number);

alter table public.pr_link_ingest enable row level security;

comment on table public.pr_link_ingest is
  'Raw evidence: pr-link events forwarded by the Claude Code plugin hook (session→repo#PR). Metadata only; consumed by the AI→PR linker. See app/api/ingest/pr-link + integrations/prism-marketplace.';

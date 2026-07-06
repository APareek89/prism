-- 0034_codex_connector.sql
-- Additive (per docs/architecture/ownership-map.md: automation appends at 0030+).
--
-- Multi-agent step 1: ingest OpenAI Codex CLI sessions alongside Claude Code
-- (owner decision 2026-07-06 — Codex pulled into Month 1; Cursor/Copilot stay
-- gated on design-partner tool mix).
--
--  1. connector_type gains 'codex' so the connector registry can track the new
--     source's health independently (one row per function, like claude_code).
--  2. cc_sessions.source says WHICH agent produced a session row. Every existing
--     row is Claude Code, so the default backfills history correctly. The AI→PR
--     linker and scoring read sessions source-agnostically; source powers the
--     per-tool split + coverage honesty in the read layer.
--
-- NOTE: Codex emits no first-party `pr-link` event, so its sessions can only link
-- via the weaker branch/sha/coauthor methods — lower confidence, shown honestly.

-- 1. New connector kind. (Safe inside a txn on PG >= 12; the value is not used
--    elsewhere in this migration.)
alter type connector_type add value if not exists 'codex';

-- 2. Session provenance.
alter table public.cc_sessions
  add column if not exists source text not null default 'claude_code';

alter table public.cc_sessions drop constraint if exists cc_sessions_source_chk;
alter table public.cc_sessions add constraint cc_sessions_source_chk
  check (source in ('claude_code', 'codex'));

comment on column public.cc_sessions.source is
  'Which AI coding agent produced this session: claude_code (local ~/.claude scan or telemetry) | codex (local ~/.codex rollout scan). Default backfills pre-0034 rows (all Claude Code).';

create index if not exists cc_sessions_source_idx
  on public.cc_sessions (function_id, source);

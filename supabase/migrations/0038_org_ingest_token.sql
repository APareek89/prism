-- 0038_org_ingest_token.sql
-- Additive (automation appends at 0030+). Per-org ingest token (M8 v2, FR-18).
--
-- The plugin / telemetry ingest endpoints authenticate by a bearer token AND resolve the
-- tenant FROM it — so a hook's pr-link event lands in the RIGHT org's pr_link_ingest
-- (not a global bootstrap function). Each org gets a unique, rotatable token. Backfilled
-- for existing orgs; new orgs get one at creation (lib/onboarding/org.ts).

alter table public.organizations add column if not exists ingest_token text;

create unique index if not exists organizations_ingest_token_key
  on public.organizations (ingest_token) where ingest_token is not null;

update public.organizations
  set ingest_token = 'pi_' || replace(gen_random_uuid()::text, '-', '')
  where ingest_token is null;

comment on column public.organizations.ingest_token is
  'Bearer token the Prism plugin/telemetry ingest presents; the ingest route resolves the tenant from it (FR-18). Rotatable.';

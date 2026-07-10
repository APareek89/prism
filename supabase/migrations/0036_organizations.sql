-- 0036_organizations.sql
-- Additive (automation appends at 0030+). The MULTI-TENANT root (M8 v2 PRD).
--
-- organizations = the tenant. Each org owns >= 1 functions row (functions.org_id;
-- one function per org in v1, 1:many-ready to preserve Org -> Function -> Team). An
-- employee belongs to an org via their function. RLS isolates: a user reads only their
-- own org. `status` + `created_by` are VERIFICATION-READY so the deferred anti-abuse
-- pass (owner decision 2026-07-11: v1 org signup is permissive; dedup/verification
-- deferred) bolts on additively, not as a rewrite.

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  created_by  uuid references auth.users (id) on delete set null,  -- founder (verification-ready)
  status      text not null default 'active',                      -- active|pending|suspended (verification-ready)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organizations_slug_unique unique (slug),
  constraint organizations_status_chk check (status in ('active', 'pending', 'suspended'))
);

-- functions.org_id -> the tenant this function belongs to. Nullable during transition;
-- the org-signup path always sets it, and the org-scoped resolver derives org from the
-- authenticated user (never a "first function" fallback).
alter table public.functions
  add column if not exists org_id uuid references public.organizations (id) on delete cascade;
create index if not exists functions_org_id_idx on public.functions (org_id);

-- Backfill: every existing function must belong to an org — this ADOPTS the real
-- existing function(s) into a tenant (structural integrity, not synthetic seed data).
-- Idempotent: only touches functions with a null org_id.
do $$
declare
  f record;
  new_org uuid;
  base_slug text;
begin
  for f in select id, name from public.functions where org_id is null loop
    base_slug := coalesce(nullif(regexp_replace(lower(f.name), '[^a-z0-9]+', '-', 'g'), ''), 'org')
                 || '-' || substr(f.id::text, 1, 6);
    insert into public.organizations (name, slug) values (f.name, base_slug)
      returning id into new_org;
    update public.functions set org_id = new_org, updated_at = now() where id = f.id;
  end loop;
end $$;

-- current_org_id() — SECURITY DEFINER helper (mirrors 0014_rls_helpers): the org of the
-- current JWT's employee's function, or NULL. Used by RLS + safe for the app resolver.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.org_id
  from public.employees e
  join public.functions f on f.id = e.function_id
  where e.user_id = auth.uid()
  limit 1;
$$;
revoke execute on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated, service_role;

-- RLS: a user reads only their own org (service-role, used by the signup server action,
-- bypasses this to create the org before the member exists).
alter table public.organizations enable row level security;
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

comment on table public.organizations is
  'Tenant root (M8 v2). Each org owns >=1 functions row (functions.org_id). RLS: members read only their own org. status/created_by are verification-ready for the deferred anti-abuse pass.';

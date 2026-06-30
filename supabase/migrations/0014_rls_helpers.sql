-- 0014_rls_helpers.sql
-- SECURITY DEFINER helper functions backing every RLS policy (PRD §12.5).
-- Living in the `auth` schema so policies read naturally (auth.is_admin(...)).
--
-- WHY SECURITY DEFINER: a policy on `employees` that itself needs to read
-- `employees` (to resolve auth.uid()→employee) would recurse and be blocked by
-- RLS. Running these helpers as the definer (owner) bypasses RLS *inside the
-- helper only*, returning a single trusted boolean/uuid to the policy. Each is
-- marked STABLE (same answer within a statement) and has a pinned search_path
-- to prevent search-path hijacking — required for SECURITY DEFINER safety.

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.employee_id() → the employees.id for the current JWT (auth.uid()), or NULL.
-- (architecture §3 calls this current_employee(); an alias is provided below.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auth.employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id from public.employees e where e.user_id = auth.uid() limit 1;
$$;

-- Alias matching the architecture-doc name. Same semantics.
create or replace function auth.current_employee()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.employee_id();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.is_admin(fn) → does the current employee hold the admin role?
-- Admin is org-wide for the single-function MVP; fn narrows it when given.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auth.is_admin(fn uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employee_roles r
    where r.employee_id = auth.employee_id()
      and r.role = 'admin'
      and (fn is null or r.function_id = fn)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.has_role(fn, role) → does the current employee hold `role` in function fn?
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auth.has_role(fn uuid, role app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employee_roles r
    where r.employee_id = auth.employee_id()
      and r.role = has_role.role
      and r.function_id = fn
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.manages_employee(emp) → may the current user COACH employee `emp`?
-- True when the caller is a manager/function_lead/admin of emp's function (or of
-- the team sub-scope, when scope_team_id is set). Self does NOT count as manager.
-- This is the gate for per-member COACHING surfaces — NOT raw-PR access.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auth.manages_employee(emp uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employees target
    join public.employee_roles r
      on r.function_id = target.function_id
    where target.id = emp
      and r.employee_id = auth.employee_id()
      and r.role in ('manager', 'function_lead', 'admin')
      -- scope_team_id null = whole function; else must match target's function.
      and (r.scope_team_id is null or r.scope_team_id = target.function_id)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.in_function(fn) → is the current employee a member of function fn?
-- Drives access to function/team AGGREGATE rows (not peers' raw data).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function auth.in_function(fn uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = auth.employee_id()
      and e.function_id = fn
  );
$$;

-- Lock these down: only the API roles execute them; never PUBLIC at large.
revoke execute on function auth.employee_id()            from public;
revoke execute on function auth.current_employee()       from public;
revoke execute on function auth.is_admin(uuid)           from public;
revoke execute on function auth.has_role(uuid, app_role) from public;
revoke execute on function auth.manages_employee(uuid)   from public;
revoke execute on function auth.in_function(uuid)        from public;

grant execute on function auth.employee_id()            to authenticated, service_role;
grant execute on function auth.current_employee()       to authenticated, service_role;
grant execute on function auth.is_admin(uuid)           to authenticated, service_role;
grant execute on function auth.has_role(uuid, app_role) to authenticated, service_role;
grant execute on function auth.manages_employee(uuid)   to authenticated, service_role;
grant execute on function auth.in_function(uuid)        to authenticated, service_role;

-- 0037_employees_admin_read.sql
-- Additive (automation appends at 0030+). Roster management for org admins (M8 v2 W3).
--
-- The 0016 self policy lets a person read only their OWN employees row. For an admin to
-- see/manage their org's roster (invited + active members), add an admin read policy:
-- an admin may read employees in a function they administer. Policies are OR'd, so a
-- plain developer still sees only their own row; an admin additionally sees the roster.
-- Writes still go through the service-role (which bypasses RLS) — this is SELECT only.

drop policy if exists employees_admin_select on public.employees;
create policy employees_admin_select on public.employees
  for select to authenticated
  using ( public.is_admin(function_id) );

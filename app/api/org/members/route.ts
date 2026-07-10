// app/api/org/members/route.ts
//
// Org roster management (M8 v2 W3). Admin-only.
//   GET  → the caller's org roster (invited + active members).
//   POST { emails: string[] } → add member emails as PENDING invited seats in the
//         caller's org (idempotent per email via provisionEmployee). The invitee
//         self-registers later with that email and joins this org (see lib/auth/signup).
//
// Scoped to the caller's org function (resolveBootstrapFunctionId is org-scoped), so an
// admin only ever touches their own org's roster. Writes go through the service-role.

import { withAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { provisionEmployee } from '@/lib/onboarding/provision';
import { ok, badRequest, readJson, resolveBootstrapFunctionId, errMessage } from '../../connectors/_lib/route-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RosterRow {
  id: string;
  name: string | null;
  email: string | null;
  user_id: string | null;
  match_status: string | null;
  active: boolean | null;
}

export const GET = withAdmin(async (): Promise<Response> => {
  const functionId = await resolveBootstrapFunctionId();
  if (!functionId) return ok({ ok: true, members: [] });
  try {
    const db = appTable(createAdminClient());
    const { data } = await db
      .from('employees')
      .select('id, name, email, user_id, match_status, active')
      .eq('function_id', functionId);
    const rows = (Array.isArray(data) ? data : []) as RosterRow[];
    const members = rows.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      status: e.user_id ? 'active' : 'invited',
      match: e.match_status ?? 'unmatched',
    }));
    return ok({ ok: true, members });
  } catch (e) {
    return ok({ ok: true, members: [], warning: errMessage(e) });
  }
});

export const POST = withAdmin(async (req: Request): Promise<Response> => {
  const functionId = await resolveBootstrapFunctionId();
  if (!functionId) return badRequest('no organization to add members to');

  const body = await readJson<{ emails?: string[]; email?: string }>(req);
  if (body === null) return badRequest('invalid JSON body');
  const raw = body.emails ?? (body.email ? [body.email] : []);
  const emails = [...new Set(raw.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (emails.length === 0) return badRequest('provide at least one valid email');

  let added = 0;
  const results: Array<{ email: string; ok: boolean; created: boolean }> = [];
  for (const email of emails) {
    const name = email.split('@')[0] ?? email;
    const r = await provisionEmployee({ functionId, name, email });
    results.push({ email, ok: r.ok, created: r.created });
    if (r.ok) added += 1;
  }
  return ok({ ok: true, added, results });
});

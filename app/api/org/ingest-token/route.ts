// app/api/org/ingest-token/route.ts
//
// The caller org's plugin/telemetry ingest token (M8 v2 W3). Admin-only, org-scoped.
//   GET  → { token, ingestUrl } — what the admin pastes into the prism-pr-link plugin.
//   POST { action: 'rotate' } → mint a new token (the old one stops working immediately).
//
// The token lives on organizations.ingest_token; the ingest route resolves the tenant
// from it (FR-18). Writes via the service-role, scoped to the caller's own org.

import { randomUUID } from 'node:crypto';
import { withAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { ok, badRequest, serverError, readJson, resolveBootstrapFunctionId, errMessage } from '../../connectors/_lib/route-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Resolve the caller's org id (via their function) + its current ingest token. */
async function callerOrg(): Promise<{ orgId: string; token: string | null } | null> {
  const functionId = await resolveBootstrapFunctionId();
  if (!functionId) return null;
  const db = appTable(createAdminClient());
  const fn = await db.from('functions').select('org_id').eq('id', functionId).maybeSingle();
  const orgId = (fn as { data?: { org_id?: string } | null }).data?.org_id;
  if (!orgId) return null;
  const org = await db.from('organizations').select('ingest_token').eq('id', orgId).maybeSingle();
  return { orgId, token: (org as { data?: { ingest_token?: string } | null }).data?.ingest_token ?? null };
}

function ingestUrl(req: Request): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return new URL('/api/ingest/pr-link', base).toString();
}

export const GET = withAdmin(async (req: Request): Promise<Response> => {
  const org = await callerOrg();
  return ok({ ok: true, token: org?.token ?? null, ingestUrl: ingestUrl(req) });
});

export const POST = withAdmin(async (req: Request): Promise<Response> => {
  const body = await readJson<{ action?: string }>(req);
  if (!body || body.action !== 'rotate') return badRequest('unsupported action (expected { action: "rotate" })');
  const org = await callerOrg();
  if (!org) return badRequest('no organization to rotate a token for');

  const token = `pi_${randomUUID().replace(/-/g, '')}`;
  try {
    const db = appTable(createAdminClient());
    const { error } = await db
      .from('organizations')
      .update({ ingest_token: token, updated_at: new Date().toISOString() })
      .eq('id', org.orgId);
    if (error) return serverError((error as { message?: string }).message ?? 'rotate failed');
    return ok({ ok: true, token, ingestUrl: ingestUrl(req) });
  } catch (e) {
    return serverError(errMessage(e));
  }
});

// app/api/ingest/pr-link/route.ts
//
// POST /api/ingest/pr-link — the HOOK PATH endpoint.
//
// Receives the prism-pr-link plugin's metadata-only forward
// ({ sessionId, repo, prNumber, ... }) and lands it in pr_link_ingest (migration 0035)
// for the AI->PR linker to consume. This is NOT an OTLP receiver — OTLP is a separate
// protocol with its own (later) route; do not point telemetry here.
//
// TENANT = SERVER-SIDE, TOKENLESS (the design decision): the PR's repo selects the org
// via functions.repo_ids — the GitHub App installation IS the org authorization, so the
// developer's plugin ships NO secret and writes NOTHING into their git. A bearer token is
// still honored if present (self-auth / single-tenant demo) but is no longer required.
// Unknown/ambiguous repo → accept-but-ignore (open beacon: never error the hook, never
// reveal which repos are connected). Writes via the service-role client (RLS-bypass);
// idempotent on (session_id, repo, pr_number) so hook redelivery is a no-op. Never stores
// prompt text or code — only the whitelisted keys parsePrLinkPayload returns.

import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { parsePrLinkPayload } from '@/lib/ingest/pr-link';
import {
  ok,
  badRequest,
  serverError,
  readJson,
  resolveIngestFunctionId,
  resolveIngestFunctionIdByRepo,
  errMessage,
} from '@/app/api/connectors/_lib/route-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Extract the `Bearer <token>` value from the Authorization header (or null). */
function bearer(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get('authorization') ?? '').trim());
  return m ? m[1]!.trim() : null;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Parse + validate FIRST (metadata-only; extra fields dropped by the parser). We need
  //    the repo to resolve the tenant, so validation precedes auth.
  const body = await readJson(req);
  if (body === null) return badRequest('invalid JSON body');
  const parsed = parsePrLinkPayload(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const ev = parsed.value;

  // 2. Tenant — TOKENLESS. The repo selects the org (functions.repo_ids, written by the
  //    GitHub App install). A bearer token is still honored if present, but not required.
  const token = bearer(req);
  const functionId =
    (await resolveIngestFunctionIdByRepo(ev.repo)) ??
    (token ? await resolveIngestFunctionId(token) : null);

  // 3. Repo not connected (and no valid token) → accept-but-ignore. 202, not 401: the hook
  //    is fire-and-forget and the endpoint must not leak which repos an org has connected.
  if (!functionId) return ok({ ok: true, stored: false, reason: 'repo not connected' }, 202);

  // 4. Idempotent upsert (service-role). Redelivery on the unique key is a no-op.
  try {
    const db = appTable(createAdminClient());
    const { error } = await db.from('pr_link_ingest').upsert(
      {
        function_id: functionId,
        session_id: ev.sessionId,
        account_uuid: ev.accountUuid,
        repo: ev.repo,
        pr_number: ev.prNumber,
        sha: ev.sha,
        branch: ev.branch,
        source: ev.source,
      },
      { onConflict: 'session_id,repo,pr_number', ignoreDuplicates: true },
    );
    if (error) return serverError((error as { message?: string }).message ?? 'upsert failed');
    return ok({ ok: true, stored: true, tenant: 'repo', pr: { repo: ev.repo, prNumber: ev.prNumber } });
  } catch (e) {
    return serverError(errMessage(e));
  }
}

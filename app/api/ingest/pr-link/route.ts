// app/api/ingest/pr-link/route.ts
//
// POST /api/ingest/pr-link — the HOOK PATH endpoint.
//
// Receives the prism-pr-link plugin's metadata-only forward
// ({ sessionId, repo, prNumber, ... }) and lands it in pr_link_ingest (migration 0035)
// for the AI->PR linker to consume. This is NOT an OTLP receiver — OTLP is a separate
// protocol with its own (later) route; do not point telemetry here.
//
// Auth: a bearer token (PRISM_INGEST_TOKEN — the config seam; per-dev token now, org
// token via managed settings later). Writes via the service-role client (RLS-bypass);
// idempotent on (session_id, repo, pr_number) so hook redelivery is a no-op. Never
// stores prompt text or code — only the whitelisted keys parsePrLinkPayload returns.

import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { parsePrLinkPayload } from '@/lib/ingest/pr-link';
import {
  ok,
  badRequest,
  serverError,
  readJson,
  resolveIngestFunctionId,
  errMessage,
} from '@/app/api/connectors/_lib/route-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

/** 401 for a missing/invalid bearer token. */
function unauthorized(error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status: 401, headers: JSON_HEADERS });
}

/** Extract the `Bearer <token>` value from the Authorization header (or null). */
function bearer(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get('authorization') ?? '').trim());
  return m ? m[1]!.trim() : null;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Auth + tenant: the bearer token both authenticates AND selects the org (FR-18) —
  //    a per-org ingest_token, or the global PRISM_INGEST_TOKEN (demo / single-tenant).
  const presented = bearer(req);
  if (!presented) return unauthorized('missing bearer token');
  const functionId = await resolveIngestFunctionId(presented);
  if (!functionId) return unauthorized('invalid ingest token');

  // 2. Parse + validate (metadata-only; any extra fields are dropped by the parser).
  const body = await readJson(req);
  if (body === null) return badRequest('invalid JSON body');
  const parsed = parsePrLinkPayload(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const ev = parsed.value;

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
    return ok({ ok: true, stored: { repo: ev.repo, prNumber: ev.prNumber, sessionId: ev.sessionId } });
  } catch (e) {
    return serverError(errMessage(e));
  }
}

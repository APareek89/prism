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
//
// The endpoint is OPEN, so it is hardened server-side, not by a client key:
//   • a best-effort per-IP rate limit caps floods (and floods of App PR-existence calls);
//   • the repo-resolved (tokenless) path CONFIRMS the PR is real via the org's GitHub App
//     before storing — a forged {connected-repo, made-up PR#} is rejected (fail-open on
//     transient errors so a GitHub blip never drops real data);
//   • unknown/ambiguous repo → 202 accept-but-ignore (never error the hook, never reveal
//     which repos are connected).
// Writes via the service-role client (RLS-bypass); idempotent on (session_id, repo,
// pr_number). Never stores prompt text or code — only parsePrLinkPayload's whitelist.

import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { parsePrLinkPayload } from '@/lib/ingest/pr-link';
import { verifyPrExists } from '@/lib/connectors/github/verify';
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

// Best-effort in-memory rate limit (per-IP sliding window). Single-instance only — the
// deploy target (Render) is effectively one instance; a shared store (Redis/Upstash) is
// the multi-instance upgrade. Caps abuse of the open endpoint + the App existence calls.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 60;
const rlHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rlHits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (recent.length >= RL_MAX) {
    rlHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  rlHits.set(ip, recent);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) if (v.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request): Promise<Response> {
  // 0. Rate-limit the open endpoint (best-effort; before any DB / GitHub work).
  if (rateLimited(clientIp(req))) {
    return new Response(JSON.stringify({ ok: false, error: 'rate limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 1. Parse + validate FIRST (metadata-only; extra fields dropped). We need the repo to
  //    resolve the tenant, so validation precedes auth.
  const body = await readJson(req);
  if (body === null) return badRequest('invalid JSON body');
  const parsed = parsePrLinkPayload(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const ev = parsed.value;

  // 2. Tenant — TOKENLESS. The repo selects the org (functions.repo_ids). A bearer token
  //    is still honored if present, but not required.
  const token = bearer(req);
  const byRepo = await resolveIngestFunctionIdByRepo(ev.repo);
  const functionId = byRepo ?? (token ? await resolveIngestFunctionId(token) : null);

  // 3. Repo not connected (and no valid token) → accept-but-ignore. 202, not 401: the hook
  //    is fire-and-forget and the endpoint must not leak which repos an org has connected.
  if (!functionId) return ok({ ok: true, stored: false, reason: 'repo not connected' }, 202);

  // 4. Anti-spoof — ONLY on the tokenless/open path (a valid token IS the auth). Confirm
  //    the PR is real via the org's GitHub App; a definitive 404 → reject. Fail-open
  //    otherwise so a transient GitHub error never drops a legitimate beacon.
  if (byRepo) {
    const exists = await verifyPrExists(functionId, ev.repo, ev.prNumber);
    if (exists === 'not_found') return ok({ ok: true, stored: false, reason: 'pr not found' }, 202);
  }

  // 5. Idempotent upsert (service-role). Redelivery on the unique key is a no-op.
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

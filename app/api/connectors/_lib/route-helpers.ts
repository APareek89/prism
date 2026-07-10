// app/api/connectors/_lib/route-helpers.ts
//
// Shared plumbing for the Admin connector route handlers (M2). One place for:
//   • JSON Response builders (ok / badRequest / serverError);
//   • bootstrap-function resolution — the REAL functions.id the connectors write to.
//
// Why a dedicated function resolver: getAuthUser() in DEMO_MODE returns a synthetic
// functionId ('demo-function') that is NOT a real row. Connectors WRITE (service-role),
// so they must target the actual bootstrap `functions` row. We resolve it from the live
// DB via the admin client (the single function today; org = me = team), falling back to
// the auth user's functionId only when it's a real uuid-bearing row.
//
// SERVER-ONLY: imports the service-role admin client. Never bundle into client code.

import { createAdminClient } from '@/lib/supabase/admin';
import { appTable } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/config/env';
import { isDemoMode } from '@/lib/config/flags';
import { getAuthUser } from '@/lib/auth/session';

/** The synthetic demo functionId that is NOT a real row (session.ts DEMO_USER). */
const DEMO_FUNCTION_PLACEHOLDER = 'demo-function';

// ─────────────────────────────────────────────────────────────────────────────
// JSON responses
// ─────────────────────────────────────────────────────────────────────────────

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

/** 200 JSON. */
export function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** 400 JSON with an `error` message. */
export function badRequest(error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status: 400, headers: JSON_HEADERS });
}

/** 500 JSON with an `error` message (never leaks a stack). */
export function serverError(error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status: 500, headers: JSON_HEADERS });
}

/** 503 JSON for a keyless / not-configured path that still answers cleanly. */
export function notConfigured(detail: string): Response {
  return new Response(
    JSON.stringify({ ok: true, status: 'not_configured', detail }),
    { status: 200, headers: JSON_HEADERS },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap function resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the function id an admin's connector/ingest/pipeline action should target.
 *
 * MULTI-TENANT: this is the CALLER's own org function — resolved from the authenticated
 * employee (getAuthUser().functionId), never "the first function" (which would misroute
 * one org's writes into another). These routes are admin-gated, so the caller is an admin
 * of their org. Only the single-tenant DEMO (placeholder / keyless) falls back to the one
 * function. Returns null when Supabase is unconfigured or no function can be resolved.
 */
export async function resolveBootstrapFunctionId(): Promise<string | null> {
  if (!isConfigured('supabase')) return null;
  const user = await getAuthUser();
  const fid = user?.functionId;
  if (fid && fid !== DEMO_FUNCTION_PLACEHOLDER) return fid;
  if (isDemoMode()) {
    try {
      const db = appTable(createAdminClient());
      const { data } = await db.from('functions').select('id').limit(1).maybeSingle();
      return (data?.id as string | undefined) ?? fid ?? null;
    } catch {
      return fid ?? null;
    }
  }
  return null;
}

/** Read a JSON body safely; returns null on empty/invalid bodies (callers 400). */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text.trim()) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Human message from an unknown thrown value. */
export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

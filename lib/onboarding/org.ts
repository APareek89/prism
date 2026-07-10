// lib/onboarding/org.ts
//
// Tenant creation (M8 v2). createOrganization stands up a new isolated tenant:
//   organizations row → its first functions row (org_id) → an admin employees row
//   bound to the founder's auth user → an `admin` role grant.
// Called by the signup server action when a visitor creates an org (vs joining an
// invite). Service-role writes (it runs before the member exists, so RLS can't see it).
//
// SERVER-ONLY: imports the service-role admin client. Never bundle into client code.

import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertEmployee, type EmployeeRecord } from '@/lib/db/onboarding';

/** A url-safe slug from an org name (empty → "org"), + a short unique suffix. */
function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'org'}-${randomUUID().slice(0, 6)}`;
}

export interface CreateOrgResult {
  ok: boolean;
  orgId?: string;
  functionId?: string;
  ingestToken?: string;
  employee?: EmployeeRecord;
  error?: string;
}

interface LooseAdmin {
  from: (t: string) => {
    insert: (rows: unknown) => {
      select: (cols: string) => { single: () => Promise<{ data: { id?: string; ingest_token?: string } | null; error: { message?: string } | null }> };
    };
  };
}

/**
 * Create a new tenant org owned by `adminUserId`. Idempotency is NOT attempted (v1 org
 * signup is permissive by owner decision 2026-07-11 — duplicate/fake orgs are accepted
 * and hardened later); the slug carries a random suffix so it never collides.
 */
export async function createOrganization(args: {
  name: string;
  adminUserId: string;
  adminEmail: string | null;
  adminName?: string;
}): Promise<CreateOrgResult> {
  const admin = createAdminClient() as unknown as LooseAdmin;
  const ingestToken = `pi_${randomUUID().replace(/-/g, '')}`;

  // 1. organizations (with a per-org ingest token for the plugin/telemetry endpoints)
  const org = await admin
    .from('organizations')
    .insert({ name: args.name, slug: slugify(args.name), created_by: args.adminUserId, status: 'active', ingest_token: ingestToken })
    .select('id, ingest_token')
    .single();
  if (org.error || !org.data?.id) return { ok: false, error: org.error?.message ?? 'org insert failed' };
  const orgId = org.data.id;

  // 2. the org's first function (Engineering pack)
  const fn = await admin
    .from('functions')
    .insert({ name: 'Engineering', org_id: orgId })
    .select('id')
    .single();
  if (fn.error || !fn.data?.id) return { ok: false, error: fn.error?.message ?? 'function insert failed' };
  const functionId = fn.data.id;

  // 3. the admin employee (bound to the founder's auth user)
  const employee = await insertEmployee({
    function_id: functionId,
    user_id: args.adminUserId,
    name: args.adminName ?? (args.adminEmail ? (args.adminEmail.split('@')[0] ?? 'Admin') : 'Admin'),
    email: args.adminEmail,
    attribution_mode: 'unmatched',
    match_status: 'unmatched',
    active: true,
    is_demo: false,
  });
  if (!employee) return { ok: false, error: 'admin employee insert failed' };

  // 4. the admin role grant
  const role = await admin
    .from('employee_roles')
    .insert({ employee_id: employee.id, function_id: functionId, role: 'admin' })
    .select('id')
    .single();
  if (role.error) return { ok: false, error: role.error.message ?? 'admin role grant failed' };

  return { ok: true, orgId, functionId, ingestToken: org.data.ingest_token ?? ingestToken, employee };
}

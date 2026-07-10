// lib/auth/link.ts
//
// First-login identity bridge: bind a Supabase auth user (auth.uid + email) to an
// `employees` row so RLS can scope their data and the pipeline can attribute their
// sessions. Runs via the SERVICE-ROLE client (the RLS-scoped session can't set its own
// user_id on a pre-existing roster row).
//
// Resolution, in order:
//   1. already linked (employees.user_id = uid) → return it.
//   2. a roster row matches the login email → set its user_id (claim the seat).
//   3. no match → provision a fresh employee in the bootstrap function, linked to uid.
//
// Idempotent: safe to call on every authenticated resolve. Never throws (auth must not
// 500 on a linking hiccup) — returns null and the caller falls back to unauthenticated.

import { createAdminClient } from '@/lib/supabase/admin';
import {
  findByUserId,
  findByEmail,
  updateEmployee,
  insertEmployee,
  type EmployeeRecord,
} from '@/lib/db/onboarding';

/** The single bootstrap function id (service-role read; org = me = team today). */
async function bootstrapFunctionId(): Promise<string | null> {
  try {
    const admin = createAdminClient() as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          limit: (n: number) => { maybeSingle: () => Promise<{ data: { id?: string } | null }> };
        };
      };
    };
    const { data } = await admin.from('functions').select('id').limit(1).maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** A display name derived from an email local-part (fallback when no roster name). */
function nameFromEmail(email: string | null): string {
  if (!email) return 'New member';
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'New member';
}

/**
 * Bind `uid`/`email` to an employee, provisioning one if needed. Returns the linked
 * EmployeeRecord (user_id === uid) or null when it can't (no function / write failure).
 */
export async function linkOrProvisionUser(
  uid: string,
  email: string | null,
): Promise<EmployeeRecord | null> {
  // 1. Already linked.
  const linked = await findByUserId(uid);
  if (linked) return linked;

  const functionId = await bootstrapFunctionId();
  if (!functionId) return null;

  // 2. Claim a roster seat by email (a person pre-added but not yet logged in).
  if (email) {
    const byEmail = await findByEmail(functionId, email);
    if (byEmail && !byEmail.user_id) {
      return updateEmployee(byEmail.id, { user_id: uid, active: true });
    }
    if (byEmail && byEmail.user_id === uid) return byEmail;
  }

  // 3. Provision a fresh employee bound to this user. Attribution stays 'unmatched'
  //    until a github_handle / claude_account_uuid links their delivery + sessions.
  return insertEmployee({
    function_id: functionId,
    user_id: uid,
    name: nameFromEmail(email),
    email,
    attribution_mode: 'unmatched',
    match_status: 'unmatched',
    active: true,
    is_demo: false,
  });
}

// lib/auth/link.ts
//
// First-login identity bridge (multi-tenant). Binds a Supabase auth user (auth.uid) to
// an `employees` row so RLS can scope their data. Runs via the service-role client (the
// RLS-scoped session can't set its own user_id on a pre-existing invited seat).
//
// Resolution, in order:
//   1. already linked (employees.user_id = uid) → return it.
//   2. a PENDING invited seat matches the login email (in ANY org) → claim it (set
//      user_id) → the member joins that org.
//   3. no match → null. There is NO "provision into a bootstrap function" fallback:
//      creating a brand-new org is the signup server action's job (lib/auth/signup),
//      not a silent side effect of resolving a session.
//
// Never throws (auth must not 500 on a linking hiccup) — returns null and the caller
// falls back to unauthenticated.

import {
  findByUserId,
  findPendingInviteByEmail,
  updateEmployee,
  type EmployeeRecord,
} from '@/lib/db/onboarding';

/**
 * Bind `uid`/`email` to an existing employee (already linked, or an invited seat claimed
 * by email). Returns the EmployeeRecord (user_id === uid) or null when there is nothing
 * to bind to (no prior link, no pending invite) — the caller then treats the session as
 * org-less until org signup / an invite exists.
 */
export async function linkOrProvisionUser(
  uid: string,
  email: string | null,
): Promise<EmployeeRecord | null> {
  // 1. Already linked.
  const linked = await findByUserId(uid);
  if (linked) return linked;

  // 2. Claim a pending invited seat by email (routes the member to the inviting org).
  if (email) {
    const invite = await findPendingInviteByEmail(email);
    if (invite) return updateEmployee(invite.id, { user_id: uid, active: true });
  }

  // 3. No link, no invite → org-less; org creation is the signup action's job.
  return null;
}

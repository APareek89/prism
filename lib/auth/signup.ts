// lib/auth/signup.ts
//
// The account-creation server action (M8 v2, multi-tenant). Two paths, auto-detected:
//   • invited email  → create the account and JOIN the org that invited them.
//   • org name given → create the account and CREATE a new tenant org (founder = admin).
//   • neither        → rejected with guidance.
//
// v1 mechanism (ratified 2026-07-11): the account is created server-side, confirmed, via
// the service-role admin API — so signup works without SMTP/email delivery. This trades
// email-ownership proof for self-containment; member signup is gated on a pending invite,
// and verified invite-emails are the immediate follow-up (see the M8 PRD open questions).
// v1 org signup is deliberately permissive (duplicate/fake orgs accepted, hardened later).
//
// SERVER-ONLY: 'use server' + the service-role admin client.

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { findPendingInviteByEmail, updateEmployee } from '@/lib/db/onboarding';
import { createOrganization } from '@/lib/onboarding/org';

export interface SignUpInput {
  email: string;
  password: string;
  /** Provided when creating a new org; ignored (and not required) for an invited join. */
  orgName?: string;
}

export interface SignUpResult {
  ok: boolean;
  mode?: 'joined' | 'created';
  orgName?: string;
  error?: string;
}

export async function signUpAction(input: SignUpInput): Promise<SignUpResult> {
  const email = (input.email ?? '').trim().toLowerCase();
  const password = input.password ?? '';
  const orgName = (input.orgName ?? '').trim();

  if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

  const invite = await findPendingInviteByEmail(email);
  if (!invite && !orgName) {
    return {
      ok: false,
      error: 'No invitation found for this email. Enter an organization name to create one, or ask your admin to invite you.',
    };
  }

  // Create the confirmed auth user (service-role; sidesteps email confirmation — v1).
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) {
    return { ok: false, error: error?.message ?? 'Could not create the account (the email may already be registered).' };
  }
  const uid = data.user.id;

  // Invited → claim the seat (join that org).
  if (invite) {
    const linked = await updateEmployee(invite.id, { user_id: uid, active: true });
    if (!linked) return { ok: false, error: 'Account created, but joining the org failed — contact your admin.' };
    return { ok: true, mode: 'joined' };
  }

  // No invite → create a new tenant org (founder becomes admin).
  const org = await createOrganization({ name: orgName, adminUserId: uid, adminEmail: email });
  if (!org.ok) return { ok: false, error: org.error ?? 'Could not create the organization.' };
  return { ok: true, mode: 'created', orgName };
}

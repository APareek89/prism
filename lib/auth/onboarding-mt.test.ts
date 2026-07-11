// @vitest-environment node
//
// lib/auth/onboarding-mt.test.ts
//
// (node env, not jsdom: createAdminClient's server-only guard throws when `window` is
// defined — jsdom defines it — so this integration test must run under node.)
//
// Integration test for multi-tenant onboarding (M8 v2). Exercises the REAL org-creation
// + invite→join code against a live Supabase, and proves cross-tenant isolation (FR-15,
// the ship gate). Guarded: skipped unless SUPABASE_DB_URL is present, so the normal
// `npm run test` (no DB) is unaffected. Run it explicitly with:
//   node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/auth/onboarding-mt.test.ts
// It cleans up after itself (deletes the org it creates + the auth users), so it's
// re-runnable and leaves no dummy data.

import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createOrganization } from '@/lib/onboarding/org';
import { provisionEmployee } from '@/lib/onboarding/provision';
import { findPendingInviteByEmail, updateEmployee } from '@/lib/db/onboarding';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ADMIN = 'acme-admin@acme.test', ADMIN_PW = 'acme-admin-1';
const MEMBER = 'acme-member@acme.test', MEMBER_PW = 'acme-member-1';

const svc = () => createClient(URL, SVC, { auth: { persistSession: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });
const pgc = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

const createdUserIds: string[] = [];
let acmeOrgId: string | undefined;
let acmeFn: string | undefined;

async function mkUser(email: string, password: string): Promise<string> {
  const { data } = await svc().auth.admin.createUser({ email, password, email_confirm: true });
  const id = data?.user?.id as string;
  if (id) createdUserIds.push(id);
  return id;
}
async function token(email: string, password: string): Promise<string | null> {
  const { data } = await anon().auth.signInWithPassword({ email, password });
  return data.session?.access_token ?? null;
}
async function sessionFor(email: string, password: string) {
  const { data } = await anon().auth.signInWithPassword({ email, password });
  return data.session;
}
function emailsSeenBy(tok: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${tok}` } }, auth: { persistSession: false } })
    .from('employees').select('email')
    .then(({ data }: { data: { email: string }[] | null }) => (data ?? []).map((r) => r.email).sort());
}
// Mint the @supabase/ssr session cookie so we can call authed API routes on the dev server.
const REF = (URL.match(/https:\/\/([a-z0-9]+)\./)?.[1]) ?? '';
function cookieHeader(session: unknown): string {
  const n = `sb-${REF}-auth-token`;
  const v = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  const parts: string[] = [];
  for (let i = 0, x = 0; i < v.length; i += C, x++) parts.push(`${n}.${x}=${v.slice(i, i + C)}`);
  return parts.join('; ');
}
async function orgsVisible(tok: string | null): Promise<string[]> {
  const c = createClient(URL, ANON, tok
    ? { global: { headers: { Authorization: `Bearer ${tok}` } }, auth: { persistSession: false } }
    : { auth: { persistSession: false } });
  const { data, error } = await c.from('organizations').select('name');
  return error ? [`ERR:${error.message}`] : (data ?? []).map((r: { name: string }) => r.name).sort();
}

describe.skipIf(!process.env.SUPABASE_DB_URL)('multi-tenant onboarding (M8 v2)', () => {
  it('org signup: createOrganization stands up org + function + admin employee + admin role', async () => {
    const uid = await mkUser(ADMIN, ADMIN_PW);
    const r = await createOrganization({ name: 'Acme Inc', adminUserId: uid, adminEmail: ADMIN });
    expect(r.ok).toBe(true);
    acmeOrgId = r.orgId;
    acmeFn = r.functionId;
    const c = pgc(); await c.connect();
    const role = await c.query(
      `select r.role from public.employee_roles r join public.employees e on e.id=r.employee_id where e.user_id=$1`,
      [uid],
    );
    await c.end();
    expect(role.rows.map((x: { role: string }) => x.role)).toContain('admin');
  });

  it('invite → member self-registers → joins Acme (not a new org)', async () => {
    const inv = await provisionEmployee({ functionId: acmeFn!, name: 'Acme Member', email: MEMBER });
    expect(inv.ok).toBe(true);
    const uid = await mkUser(MEMBER, MEMBER_PW);
    const invite = await findPendingInviteByEmail(MEMBER);
    expect(invite).not.toBeNull();
    const linked = await updateEmployee(invite!.id, { user_id: uid, active: true });
    expect(linked?.user_id).toBe(uid);
    expect(linked?.function_id).toBe(acmeFn); // joined Acme's function, no new org
  });

  it('cross-tenant isolation: each identity sees only its own org; anon sees none', async () => {
    const acme = await token(ADMIN, ADMIN_PW);
    const dev = await token('dev-a@prism.local', 'prism-dev-A1');
    expect(await orgsVisible(acme)).toEqual(['Acme Inc']);
    expect(await orgsVisible(dev)).toEqual(['My Engineering']);
    expect(await orgsVisible(null)).toEqual([]);
  });

  it('W3: admin reads the org roster (RLS) + invites via the API; devs stay self-only', async () => {
    // RLS admin-read policy: the Acme admin sees the whole Acme roster, never another org.
    const acmeTok = (await token(ADMIN, ADMIN_PW))!;
    const acmeEmails = await emailsSeenBy(acmeTok);
    expect(acmeEmails).toContain(ADMIN);
    expect(acmeEmails).toContain(MEMBER); // admin sees the invited member too
    expect(acmeEmails).not.toContain('dev-a@prism.local'); // cross-tenant: not My Engineering

    // a plain developer still sees only their own row (self policy).
    const devEmails = await emailsSeenBy((await token('dev-a@prism.local', 'prism-dev-A1'))!);
    expect(devEmails).toEqual(['dev-a@prism.local']);

    // the real /api/org/members route via the admin's session cookie (end-to-end).
    const cookie = cookieHeader(await sessionFor(ADMIN, ADMIN_PW));
    const g = await (await fetch('http://localhost:3000/api/org/members', { headers: { cookie } })).json();
    expect(g.ok).toBe(true);
    expect(g.members.map((m: { email: string }) => m.email)).toContain(MEMBER);
    const p = await (await fetch('http://localhost:3000/api/org/members', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ emails: ['newhire@acme.test'] }),
    })).json();
    expect(p).toMatchObject({ ok: true, added: 1 });
  });

  afterAll(async () => {
    if (!process.env.SUPABASE_DB_URL) return;
    const c = pgc(); await c.connect();
    // bottom-up cleanup so FK direction doesn't matter.
    await c.query(`delete from public.employee_roles where employee_id in (select id from public.employees where function_id=$1)`, [acmeFn ?? null]);
    await c.query(`delete from public.employees where function_id=$1`, [acmeFn ?? null]);
    await c.query(`delete from public.functions where id=$1`, [acmeFn ?? null]);
    await c.query(`delete from public.organizations where id=$1`, [acmeOrgId ?? null]);
    await c.end();
    for (const id of createdUserIds) { try { await svc().auth.admin.deleteUser(id); } catch { /* best effort */ } }
  });
});

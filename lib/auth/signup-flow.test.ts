// @vitest-environment node
//
// Full multi-tenant signup flow, headless (M8 v2). Drives the REAL signUpAction and the
// REAL running dev server (/me, /admin, /api/org/members) over HTTP — the whole browser
// journey minus the literal click: founder signs up → org created → lands authed →
// invites a member → member self-registers → joins the same org → lands authed.
//
// Needs BOTH a live DB (SUPABASE_DB_URL) and the dev server on :3000. Skipped otherwise.
// Run: node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/auth/signup-flow.test.ts
// Cleans up the org + auth users it creates.

import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { signUpAction } from './signup';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const REF = URL.match(/https:\/\/([a-z0-9]+)\./)?.[1] ?? '';
const BASE = 'http://localhost:3000';

const FOUNDER = 'zeta-admin@zeta.test', FPW = 'zeta-admin-1';
const DEV = 'zeta-dev@zeta.test', DPW = 'zeta-dev-1';

const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });
const pgc = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

function cookieHeader(session: unknown): string {
  const n = `sb-${REF}-auth-token`;
  const v = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  const p: string[] = [];
  for (let i = 0, x = 0; i < v.length; i += C, x++) p.push(`${n}.${x}=${v.slice(i, i + C)}`);
  return p.join('; ');
}
async function session(email: string, password: string) {
  const { data } = await anon().auth.signInWithPassword({ email, password });
  return data.session;
}

let zetaFn: string | undefined, zetaOrgId: string | undefined;

describe.skipIf(!process.env.SUPABASE_DB_URL)('full signup → invite → join (headless, real code + server)', () => {
  it('1. founder signs up with an org name → tenant created → lands authed on /me + /admin', async () => {
    const r = await signUpAction({ email: FOUNDER, password: FPW, orgName: 'Zeta Corp' });
    expect(r).toMatchObject({ ok: true, mode: 'created' });

    const cookie = cookieHeader(await session(FOUNDER, FPW));
    expect((await fetch(`${BASE}/me`, { headers: { cookie }, redirect: 'manual' })).status).toBe(200);
    expect((await fetch(`${BASE}/admin`, { headers: { cookie }, redirect: 'manual' })).status).toBe(200);

    const c = pgc(); await c.connect();
    const q = await c.query('select f.id fid, f.org_id oid from public.employees e join public.functions f on f.id=e.function_id where e.email=$1', [FOUNDER]);
    await c.end();
    zetaFn = q.rows[0].fid; zetaOrgId = q.rows[0].oid;
    expect(zetaFn).toBeTruthy();
  });

  it('2. founder invites a member by email via /api/org/members', async () => {
    const cookie = cookieHeader(await session(FOUNDER, FPW));
    const p = await (await fetch(`${BASE}/api/org/members`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ emails: [DEV] }),
    })).json();
    expect(p).toMatchObject({ ok: true, added: 1 });
  });

  it('3. member self-registers (no org name) → joins Zeta → lands authed on /me', async () => {
    const r = await signUpAction({ email: DEV, password: DPW });
    expect(r).toMatchObject({ ok: true, mode: 'joined' });

    const cookie = cookieHeader(await session(DEV, DPW));
    expect((await fetch(`${BASE}/me`, { headers: { cookie }, redirect: 'manual' })).status).toBe(200);

    const c = pgc(); await c.connect();
    const q = await c.query('select function_id from public.employees where email=$1', [DEV]);
    await c.end();
    expect(q.rows[0].function_id).toBe(zetaFn); // joined Zeta's function, no new org
  });

  it('4. isolation: the founder sees only Zeta; anon sees nothing', async () => {
    const tok = (await session(FOUNDER, FPW))!.access_token;
    const c = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${tok}` } }, auth: { persistSession: false } });
    const orgs = ((await c.from('organizations').select('name')).data ?? []).map((r: { name: string }) => r.name);
    expect(orgs).toEqual(['Zeta Corp']);
    const anonOrgs = ((await anon().from('organizations').select('name')).data ?? []).length;
    expect(anonOrgs).toBe(0);
  });

  afterAll(async () => {
    if (!process.env.SUPABASE_DB_URL) return;
    const c = pgc(); await c.connect();
    await c.query('delete from public.employee_roles where employee_id in (select id from public.employees where function_id=$1)', [zetaFn ?? null]);
    await c.query('delete from public.employees where function_id=$1', [zetaFn ?? null]);
    await c.query('delete from public.functions where id=$1', [zetaFn ?? null]);
    await c.query('delete from public.organizations where id=$1', [zetaOrgId ?? null]);
    await c.query("delete from auth.users where email like 'zeta-%'");
    await c.end();
  });
});

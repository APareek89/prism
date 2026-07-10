// @vitest-environment node
//
// Real plugin → ingest E2E (M8 v2). Creates an ACCOUNT (org via the real signUpAction),
// then runs the ACTUAL plugin hook (integrations/.../forward-pr-link.mjs) configured with
// that org's ingest token, feeding it a simulated PostToolUse(Bash) event — exactly what
// Claude Code does when a `gh pr create` runs. Verifies the pr-link lands in THAT org's
// pr_link_ingest (per-org token → tenant, FR-18).
//
// Needs a live DB + the dev server on :3000. Skipped otherwise. Cleans up.
// Run: node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/ingest/pr-link-plugin.test.ts

import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { signUpAction } from '@/lib/auth/signup';

const FOUNDER = 'gamma-admin@gamma.test', FPW = 'gamma-admin-1';
const HOOK = path.resolve('integrations/prism-marketplace/prism-pr-link/hooks/forward-pr-link.mjs');
const INGEST_URL = 'http://localhost:3000/api/ingest/pr-link';

const pgc = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let gammaFn: string | undefined, gammaOrgId: string | undefined;

/** Run the real plugin hook exactly as Claude Code would: event JSON on stdin, config in env. */
function runPluginHook(token: string, event: object): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn('node', [HOOK], {
      env: { ...process.env, PRISM_INGEST_URL: INGEST_URL, PRISM_INGEST_TOKEN: token, PRISM_INGEST_DEBUG: '1' },
    });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', () => resolve(err.trim()));
    p.stdin.write(JSON.stringify(event));
    p.stdin.end();
  });
}

describe.skipIf(!process.env.SUPABASE_DB_URL)('plugin → ingest E2E (real forward-pr-link.mjs)', () => {
  it('a created account\'s plugin forwards a pr-link into that org', async () => {
    // 1. create the account (org)
    const r = await signUpAction({ email: FOUNDER, password: FPW, orgName: 'Gamma Labs' });
    expect(r).toMatchObject({ ok: true, mode: 'created' });

    // 2. read the org's function + ingest token (what the admin would copy into the plugin)
    const c = pgc(); await c.connect();
    const q = await c.query(
      `select f.id fid, f.org_id oid, o.ingest_token tok
         from public.employees e
         join public.functions f on f.id = e.function_id
         join public.organizations o on o.id = f.org_id
        where e.email = $1`, [FOUNDER]);
    await c.end();
    gammaFn = q.rows[0].fid; gammaOrgId = q.rows[0].oid;
    const token = q.rows[0].tok as string;
    expect(token).toMatch(/^pi_/);

    // 3. run the REAL plugin hook with a simulated `gh pr create` tool result
    const debug = await runPluginHook(token, {
      session_id: 'gamma-sess-1',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --fill' },
      tool_response: 'https://github.com/gamma-labs/app/pull/7',
    });
    expect(debug).toMatch(/forwarded .* -> 200/); // the hook logged a 200 from the ingest route

    // 4. the pr-link landed in GAMMA's pr_link_ingest (per-org token → tenant)
    const c2 = pgc(); await c2.connect();
    const rows = await c2.query(
      'select session_id, repo, pr_number from public.pr_link_ingest where function_id = $1', [gammaFn]);
    await c2.end();
    expect(debug).toMatch(/forwarded .* -> 200/);
    expect(rows.rows).toEqual([{ session_id: 'gamma-sess-1', repo: 'gamma-labs/app', pr_number: 7 }]);
  });

  afterAll(async () => {
    if (!process.env.SUPABASE_DB_URL) return;
    const c = pgc(); await c.connect();
    await c.query('delete from public.pr_link_ingest where function_id = $1', [gammaFn ?? null]);
    await c.query('delete from public.employee_roles where employee_id in (select id from public.employees where function_id=$1)', [gammaFn ?? null]);
    await c.query('delete from public.employees where function_id = $1', [gammaFn ?? null]);
    await c.query('delete from public.functions where id = $1', [gammaFn ?? null]);
    await c.query('delete from public.organizations where id = $1', [gammaOrgId ?? null]);
    await c.query("delete from auth.users where email like 'gamma-%'");
    await c.end();
  });
});

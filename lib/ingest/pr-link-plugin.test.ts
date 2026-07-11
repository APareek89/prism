// @vitest-environment node
//
// Real plugin → ingest E2E. Creates an ACCOUNT (org via the real signUpAction) and
// CONNECTS a repo to it (what the GitHub App install writes into functions.repo_ids),
// then runs the ACTUAL plugin hook (integrations/.../forward-pr-link.mjs) against a
// simulated PostToolUse(Bash) `gh pr create` event — exactly what Claude Code does.
//
// Proves the TOKENLESS contract: with NO bearer token, the pr-link still lands in the
// right org because the route resolves the tenant SERVER-SIDE from the PR's repo. A second
// case proves a valid token still works as an optional fallback for an unconnected repo.
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
let gammaFn: string | undefined, gammaOrgId: string | undefined, gammaToken: string | undefined;

/** Run the real plugin hook exactly as Claude Code would: event JSON on stdin. Token is
 *  OPTIONAL — when omitted we scrub any ambient token so the tokenless path is exercised. */
function runPluginHook(event: object, opts: { token?: string } = {}): Promise<string> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, PRISM_INGEST_URL: INGEST_URL, PRISM_INGEST_DEBUG: '1' };
    delete env.PRISM_INGEST_TOKEN;
    delete env.CLAUDE_PLUGIN_OPTION_ORG_TOKEN;
    if (opts.token) env.PRISM_INGEST_TOKEN = opts.token;
    const p = spawn('node', [HOOK], { env });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', () => resolve(err.trim()));
    p.stdin.write(JSON.stringify(event));
    p.stdin.end();
  });
}

describe.skipIf(!process.env.SUPABASE_DB_URL)('plugin → ingest E2E (real forward-pr-link.mjs, tokenless)', () => {
  it('creates an account and connects a repo (functions.repo_ids)', async () => {
    const r = await signUpAction({ email: FOUNDER, password: FPW, orgName: 'Gamma Labs' });
    expect(r).toMatchObject({ ok: true, mode: 'created' });

    const c = pgc(); await c.connect();
    const q = await c.query(
      `select f.id fid, f.org_id oid, o.ingest_token tok
         from public.employees e
         join public.functions f on f.id = e.function_id
         join public.organizations o on o.id = f.org_id
        where e.email = $1`, [FOUNDER]);
    gammaFn = q.rows[0].fid; gammaOrgId = q.rows[0].oid; gammaToken = q.rows[0].tok;
    // what the GitHub App install callback does: attach the repo to this org's function.
    await c.query('update public.functions set repo_ids = array[$1] where id = $2', ['gamma-labs/app', gammaFn]);
    await c.end();
    expect(gammaToken).toMatch(/^pi_/);
  });

  it('TOKENLESS: hook forwards with NO token → tenant resolved from the PR repo', async () => {
    const debug = await runPluginHook({
      session_id: 'gamma-sess-repo',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --fill' },
      tool_response: 'https://github.com/gamma-labs/app/pull/7', // connected repo
    }); // ← no token
    expect(debug).toMatch(/forwarded .* -> 200/);

    const c = pgc(); await c.connect();
    const rows = await c.query(
      'select session_id, repo, pr_number from public.pr_link_ingest where function_id = $1 and session_id = $2',
      [gammaFn, 'gamma-sess-repo']);
    await c.end();
    expect(rows.rows).toEqual([{ session_id: 'gamma-sess-repo', repo: 'gamma-labs/app', pr_number: 7 }]);
  });

  it('TOKEN fallback: an UNconnected repo still lands when a valid token is presented', async () => {
    const debug = await runPluginHook({
      session_id: 'gamma-sess-tok',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --fill' },
      tool_response: 'https://github.com/gamma-labs/unconnected/pull/9', // NOT in repo_ids
    }, { token: gammaToken });
    expect(debug).toMatch(/forwarded .* -> 200/);

    const c = pgc(); await c.connect();
    const rows = await c.query(
      'select session_id, repo, pr_number from public.pr_link_ingest where function_id = $1 and session_id = $2',
      [gammaFn, 'gamma-sess-tok']);
    await c.end();
    expect(rows.rows).toEqual([{ session_id: 'gamma-sess-tok', repo: 'gamma-labs/unconnected', pr_number: 9 }]);
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

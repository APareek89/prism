// @vitest-environment node
//
// Proves linkAiToPr consumes pr_link_ingest (the tokenless plugin-hook beacons) as a
// pr_link@0.99 signal — folded into the session's pr_refs, so a beacon whose session_id
// is ingested links that session to its PR at high confidence.
//
// Needs a live DB (SUPABASE_DB_URL). Skipped otherwise. Seeds + cleans up its own rows.
// Run: node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/connectors/link/ai-to-pr.test.ts

import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';
import { linkAiToPr } from './ai-to-pr';

const pgc = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let fnId: string | undefined;

describe.skipIf(!process.env.SUPABASE_DB_URL)('linkAiToPr ← pr_link_ingest (tokenless beacons)', () => {
  it('a beacon whose session is ingested links that session to its PR as pr_link@0.99', async () => {
    const c = pgc(); await c.connect();
    // function scoped to a repo (org_id optional).
    const f = await c.query('insert into public.functions (name, repo_ids) values ($1, $2) returning id',
      ['Delta Link Test', ['delta-labs/app']]);
    fnId = f.rows[0].id;
    // a merged PR in the trailing window.
    const pr = await c.query(
      'insert into public.gh_prs (function_id, repo, number, is_merged, merged_at) values ($1,$2,$3,true, now()) returning id',
      [fnId, 'delta-labs/app', 42]);
    const prId = pr.rows[0].id;
    // an ingested Claude session (the join target).
    const s = await c.query(
      'insert into public.cc_sessions (function_id, session_id, repo, branch) values ($1,$2,$3,$4) returning id',
      [fnId, 'delta-sess-1', 'delta-labs/app', 'feature-x']);
    const sessRowId = s.rows[0].id;
    // the plugin-hook beacon our tokenless route stores — NO cc_sessions.pr_refs, NO branch
    // match needed; the beacon alone must carry the link.
    await c.query(
      'insert into public.pr_link_ingest (function_id, session_id, repo, pr_number, source) values ($1,$2,$3,$4,$5)',
      [fnId, 'delta-sess-1', 'delta-labs/app', 42, 'claude_code_hook']);
    await c.end();

    const stats = await linkAiToPr(fnId!);
    expect(stats.errors).toEqual([]);
    expect(stats.linksWritten).toBeGreaterThanOrEqual(1);

    const c2 = pgc(); await c2.connect();
    const link = await c2.query(
      'select pr_id, cc_session_id, method, confidence from public.pr_ai_link where function_id = $1', [fnId]);
    await c2.end();
    expect(link.rows).toHaveLength(1);
    expect(link.rows[0].pr_id).toBe(prId);
    expect(link.rows[0].cc_session_id).toBe(sessRowId);
    expect(link.rows[0].method).toBe('pr_link');
    expect(Number(link.rows[0].confidence)).toBeGreaterThanOrEqual(0.99);
  });

  afterAll(async () => {
    if (!process.env.SUPABASE_DB_URL || !fnId) return;
    const c = pgc(); await c.connect();
    await c.query('delete from public.pr_ai_link where function_id = $1', [fnId]);
    await c.query('delete from public.pr_link_ingest where function_id = $1', [fnId]);
    await c.query('delete from public.cc_sessions where function_id = $1', [fnId]);
    await c.query('delete from public.gh_prs where function_id = $1', [fnId]);
    await c.query('delete from public.functions where id = $1', [fnId]);
    await c.end();
  });
});

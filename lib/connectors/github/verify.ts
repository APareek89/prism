// lib/connectors/github/verify.ts
//
// Anti-spoof for the OPEN, tokenless pr-link ingest beacon. The ingest endpoint accepts
// {sessionId, repo, prNumber} with no client secret and resolves the tenant from the repo,
// so we independently confirm the claimed PR is REAL via the org's own GitHub App
// installation before storing it — a forged {connected-repo, made-up PR#} is rejected.
//
// FAIL-OPEN: returns 'unknown' on a missing install, an unconfigured App, or any non-404
// error (network/rate-limit), so a transient GitHub blip never drops a legitimate beacon.
// Only a definitive 404 (the PR does not exist) returns 'not_found'. SERVER-ONLY.

import { getInstallationOctokit, isGithubConfigured } from './client';
import { adminDb } from './db';
import { splitRepo } from './backfill';

export type PrExistence = 'exists' | 'not_found' | 'unknown';

/** Confirm repo#prNumber exists on GitHub via functionId's App installation. */
export async function verifyPrExists(
  functionId: string,
  repo: string,
  prNumber: number,
): Promise<PrExistence> {
  if (!isGithubConfigured()) return 'unknown';
  const parts = splitRepo(repo);
  if (!parts) return 'unknown';
  try {
    const { data } = await adminDb()
      .from('connectors')
      .select('config_jsonb')
      .eq('function_id', functionId)
      .eq('type', 'github')
      .limit(1)
      .maybeSingle();
    const cfg = (data?.config_jsonb as Record<string, unknown> | null) ?? {};
    const installationId =
      typeof cfg.installation_id === 'number'
        ? cfg.installation_id
        : Number.parseInt(String(cfg.installation_id ?? ''), 10) || null;
    if (!installationId) return 'unknown';

    const octokit = await getInstallationOctokit(installationId);
    await octokit.rest.pulls.get({ owner: parts.owner, repo: parts.repo, pull_number: prNumber });
    return 'exists';
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    return status === 404 ? 'not_found' : 'unknown';
  }
}

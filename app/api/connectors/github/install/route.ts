// app/api/connectors/github/install/route.ts
//
// GitHub App install entry + callback.
//
//   GET  (no installation_id) → 302 to GitHub's App-install page (the "Connect GitHub"
//                               button points here). Uses GITHUB_APP_CLIENT_ID.
//   GET  (?installation_id=…)  → install CALLBACK. GitHub redirects back here after the
//                               user installs the App. We discover the repos the
//                               installation can see, connect the connector (persist
//                               installation_id + repo_ids onto connectors.config_jsonb +
//                               functions.repo_ids, ensure the self employee, sync org
//                               members), kick a backfill, then 302 back to /admin.
//   POST (json { installationId, repoIds? }) → same connect+backfill, JSON response (for
//                               a programmatic / fetch-driven connect).
//
// Admin-gated for POST and for the callback write path. Keyless-safe: when the GitHub
// App env is absent we answer cleanly instead of throwing.

import { withAdmin } from '@/lib/auth/guards';
import { getAuthUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/roles';
import { serverEnv } from '@/lib/config/env';
import { GitHubConnector } from '@/lib/connectors/github';
import { getApp, getInstallationOctokit, isGithubConfigured } from '@/lib/connectors/github/client';
import { signState, verifyState } from '@/lib/connectors/github/state';
import {
  ok,
  badRequest,
  serverError,
  notConfigured,
  resolveBootstrapFunctionId,
  readJson,
  errMessage,
} from '../../_lib/route-helpers';

export const dynamic = 'force-dynamic';

// Multi-tenant: carry the initiating org's function through the GitHub install round-trip
// in a SIGNED `state` (lib/connectors/github/state) so the callback attributes the
// installation to the right tenant deterministically.
function stateSecret(): string {
  return serverEnv.GITHUB_APP_WEBHOOK_SECRET || serverEnv.GITHUB_APP_CLIENT_SECRET || 'prism-state';
}

/** Where to send the user back to after the install callback. */
function adminUrl(req: Request, params: Record<string, string>): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const url = new URL('/admin', base);
  url.hash = 'connectors';
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Discover the repo slugs ("owner/name") an installation can access. */
async function listInstallationRepos(installationId: number): Promise<string[]> {
  try {
    const octokit = await getInstallationOctokit(installationId);
    const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });
    return repos.map((r) => r.full_name).filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

/**
 * GET. Two modes:
 *   • install initiator (no installation_id): redirect to GitHub's App-install page.
 *   • install callback (installation_id present): connect + backfill, then back to /admin.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const installationIdRaw = url.searchParams.get('installation_id');

  // ── install initiator ──────────────────────────────────────────────────────
  if (!installationIdRaw) {
    if (!isGithubConfigured()) return notConfigured('GitHub App is not configured');
    // GitHub App INSTALL flow (not OAuth user-auth): send the user to the app's install
    // page (`/apps/<slug>/installations/new`). After they pick repos and install, GitHub
    // redirects to the App's **Setup URL** (this route) with installation_id +
    // setup_action=install. We resolve the app slug via the App API so no extra env var
    // is needed. (The OAuth authorize URL returns a ?code, not an installation_id — wrong
    // flow for connecting a repo.)
    let slug: string | null = null;
    try {
      const app = getApp();
      const res = await app.octokit.request('GET /app');
      slug = (res.data?.slug as string | undefined) ?? null;
    } catch (e) {
      return badRequest(
        'Could not resolve the GitHub App slug (check GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY): ' +
          errMessage(e).slice(0, 120),
      );
    }
    if (!slug) return badRequest('GitHub App slug not found for this App ID');
    const ghUrl = new URL(`https://github.com/apps/${slug}/installations/new`);
    // Sign the initiating admin's org function into `state` so the callback attributes
    // the install to the right tenant (falls back to a plain marker if no org resolves).
    const initFn = await resolveBootstrapFunctionId();
    ghUrl.searchParams.set('state', initFn ? signState(initFn, stateSecret()) : 'prism-connect');
    return Response.redirect(ghUrl.toString(), 302);
  }

  // ── install callback (write path) — admin-gated ────────────────────────────
  const user = await getAuthUser();
  if (!user || !isAdmin(user)) {
    return Response.redirect(adminUrl(req, { github: 'forbidden' }), 302);
  }

  const installationId = Number.parseInt(installationIdRaw, 10);
  if (!Number.isFinite(installationId)) {
    return Response.redirect(adminUrl(req, { github: 'bad_installation_id' }), 302);
  }

  // Prefer the signed `state` (deterministic tenant), else the admin's session.
  const functionId = verifyState(url.searchParams.get('state'), stateSecret()) ?? (await resolveBootstrapFunctionId());
  if (!functionId) {
    return Response.redirect(adminUrl(req, { github: 'no_function' }), 302);
  }

  try {
    const repoIds = await listInstallationRepos(installationId);
    const connector = new GitHubConnector(functionId);
    const status = await connector.connect(installationId, repoIds);
    if (status !== 'connected') {
      return Response.redirect(adminUrl(req, { github: status }), 302);
    }
    // Kick a backfill (PRs/commits/reverts). It marks 'syncing' then 'connected'.
    const summary = await connector.backfill();
    return Response.redirect(
      adminUrl(req, {
        github: 'connected',
        repos: String(repoIds.length),
        prs: String(summary.prsUpserted),
      }),
      302,
    );
  } catch (e) {
    return Response.redirect(adminUrl(req, { github: 'error', detail: errMessage(e).slice(0, 120) }), 302);
  }
}

/**
 * POST. Programmatic connect: body { installationId, repoIds? }. Connects the connector
 * and kicks a backfill, returning a JSON summary. Admin-gated.
 */
export const POST = withAdmin(async (req: Request): Promise<Response> => {
  if (!isGithubConfigured()) return notConfigured('GitHub App is not configured');

  const body = await readJson<{ installationId?: number | string; repoIds?: string[] }>(req);
  if (!body) return badRequest('invalid JSON body');

  const installationId = Number.parseInt(String(body.installationId ?? ''), 10);
  if (!Number.isFinite(installationId)) return badRequest('installationId is required');

  const functionId = await resolveBootstrapFunctionId();
  if (!functionId) return badRequest('no bootstrap function to attach the installation to');

  try {
    const repoIds = Array.isArray(body.repoIds) && body.repoIds.length
      ? body.repoIds
      : await listInstallationRepos(installationId);
    const connector = new GitHubConnector(functionId);
    const status = await connector.connect(installationId, repoIds);
    if (status !== 'connected') {
      return ok({ ok: false, status, error: 'connect did not reach connected' });
    }
    const summary = await connector.backfill();
    return ok({
      ok: true,
      status: 'connected',
      installationId,
      repos: repoIds,
      prsUpserted: summary.prsUpserted,
      commitsUpserted: summary.commitsUpserted,
      revertsMarked: summary.revertsMarked,
      errors: summary.errors,
    });
  } catch (e) {
    return serverError(errMessage(e));
  }
});

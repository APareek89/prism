// lib/ingest/pr-link.ts
//
// PURE validation + parsing for the hook path (POST /api/ingest/pr-link). No I/O, no
// clock — testable in isolation. The route owns auth + the DB upsert; this owns the
// "is this a well-formed, metadata-only pr-link event?" decision.
//
// METADATA ONLY by construction: only the whitelisted keys below are ever read off the
// body, so any prompt/code/free-text a caller includes is dropped, never stored.

export interface PrLinkEvent {
  sessionId: string;
  repo: string; // "owner/repo"
  prNumber: number;
  sha: string | null;
  branch: string | null;
  accountUuid: string | null;
  source: string; // e.g. 'claude_code_hook'
}

export type ParseResult = { ok: true; value: PrLinkEvent } | { ok: false; error: string };

/** owner/repo (GitHub-ish slug on each side). */
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** A GitHub PR URL → capture "owner/repo" and the number. */
const PR_URL_RE = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Validate a forwarded pr-link event. Accepts both camelCase (route/plugin) and
 * snake_case (defensive) key spellings. Returns a normalized PrLinkEvent or a readable
 * error. Extra keys are ignored (metadata-only guarantee).
 */
export function parsePrLinkPayload(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  const sessionId = str(b.sessionId ?? b.session_id);
  const repo = str(b.repo);
  const prRaw = b.prNumber ?? b.pr_number;
  const prNumber = typeof prRaw === 'number' ? prRaw : Number(str(prRaw) || NaN);

  if (!sessionId) return { ok: false, error: 'sessionId is required' };
  if (!repo || !REPO_RE.test(repo)) return { ok: false, error: 'repo must be "owner/repo"' };
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    return { ok: false, error: 'prNumber must be a positive integer' };
  }

  return {
    ok: true,
    value: {
      sessionId,
      repo,
      prNumber,
      sha: str(b.sha) || null,
      branch: str(b.branch) || null,
      accountUuid: str(b.accountUuid ?? b.account_uuid) || null,
      source: str(b.source) || 'claude_code_hook',
    },
  };
}

/**
 * Extract "owner/repo" + PR number from any text containing a GitHub PR URL (the shape
 * `gh pr create` prints). Used by the plugin hook forwarder to turn tool output into a
 * pr-link event. Returns null when no PR URL is present.
 */
export function parsePrUrl(text: string): { repo: string; prNumber: number } | null {
  const m = PR_URL_RE.exec(text);
  if (!m) return null;
  return { repo: m[1]!, prNumber: Number(m[2]) };
}

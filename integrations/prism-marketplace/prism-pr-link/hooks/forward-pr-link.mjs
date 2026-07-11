#!/usr/bin/env node
// prism-pr-link — PostToolUse(Bash) hook forwarder.  [TOKENLESS + traced]
//
// Claude Code runs this after every Bash tool call, piping the hook event JSON on
// stdin. When that call created a PR (its output contains a GitHub PR URL), we forward
// a metadata-only pr-link event to Prism's ingest endpoint — the one signal OTLP can't
// carry (repo + PR number for the 0.99 first-party AI->PR link).
//
// ZERO CLIENT SECRET: the forward carries NO bearer token. Prism resolves the tenant
// SERVER-SIDE from the PR's repo (the GitHub App installation is the org authorization),
// so this plugin ships nothing sensitive and writes NOTHING into the developer's git.
//   PRISM_INGEST_URL    where to POST (default localhost:3000; the SaaS URL in prod).
//   PRISM_INGEST_TOKEN  OPTIONAL bearer — honored if set (self-auth / demo), not required.
//   PRISM_INGEST_DEBUG  set to 1 to log to stderr while testing.
//
// CONTRACT: metadata only (session id, repo, PR number). Never prompt text or code, and
// never a git write. SAFETY: a hook must never break the session — this ALWAYS exits 0.

import fs from 'node:fs';

const TRACE = '/tmp/prism-hook.log'; // diagnostic sink (kept on).
const PR_URL_RE = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)/;

const debug = (...a) => {
  if (process.env.PRISM_INGEST_DEBUG === '1') process.stderr.write('[prism-pr-link] ' + a.join(' ') + '\n');
};
// Metadata-only trace (no token value, no prompt/code) — best-effort, never throws.
function trace(obj) {
  try { fs.appendFileSync(TRACE, JSON.stringify({ t: new Date().toISOString(), ...obj }) + '\n'); } catch { /* ignore */ }
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
    // If nothing is piped, don't hang.
    setTimeout(() => resolve(buf), 2000);
  });
}

async function main() {
  const raw = await readStdin();
  const url = process.env.PRISM_INGEST_URL || 'http://localhost:3000/api/ingest/pr-link';
  // Token is OPTIONAL now — the tenant is resolved server-side from the repo.
  const token = process.env.PRISM_INGEST_TOKEN || process.env.CLAUDE_PLUGIN_OPTION_ORG_TOKEN || '';

  let event = {};
  try { event = JSON.parse(raw); } catch { /* tolerate non-JSON */ }
  const m = PR_URL_RE.exec(typeof raw === 'string' ? raw : JSON.stringify(event));
  const sessionId = event.session_id || event.sessionId || '';

  trace({ fired: true, hasToken: !!token, url, rawLen: raw ? raw.length : 0, urlMatched: !!m, match: m ? m[1] + '#' + m[2] : null, hasSession: !!sessionId });

  // No token gate — only a PR URL + a session id are required to forward.
  if (!m) return debug('no PR URL in this tool call — skipping');
  if (!sessionId) return debug('no session id in event — skipping');

  const payload = { sessionId, repo: m[1], prNumber: Number(m[2]), source: 'claude_code_hook' };
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`; // optional self-auth

  try {
    const ctrl = new AbortController();
    const tmo = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctrl.signal });
    clearTimeout(tmo);
    trace({ posted: true, status: res.status, repo: payload.repo, pr: payload.prNumber });
    debug('forwarded', payload.repo + '#' + payload.prNumber, '->', res.status);
  } catch (e) {
    trace({ posted: false, error: e && e.message ? e.message : String(e) });
    debug('forward failed (non-fatal):', e && e.message ? e.message : String(e));
  }
}

main().finally(() => process.exit(0));

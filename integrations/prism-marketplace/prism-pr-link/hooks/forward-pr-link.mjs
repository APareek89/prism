#!/usr/bin/env node
// prism-pr-link — PostToolUse(Bash) hook forwarder.
//
// Claude Code runs this after every Bash tool call, piping the hook event JSON on
// stdin. When that call created a PR (its output contains a GitHub PR URL), we forward
// a metadata-only pr-link event to Prism's ingest endpoint — the one signal OTLP can't
// carry (repo + PR number for the 0.99 first-party AI->PR link).
//
// CONFIG SEAM (never hardcoded — this is what lets dev-test extend to org deployment):
//   PRISM_INGEST_URL    e.g. http://localhost:3000/api/ingest/pr-link   (org URL later)
//   PRISM_INGEST_TOKEN  the bearer token the endpoint checks            (org token later)
//   PRISM_INGEST_DEBUG  set to 1 to log to stderr while testing
//
// CONTRACT: metadata only (session id, repo, PR number). Never prompt text or code.
// SAFETY: a hook must never break the developer's session — this ALWAYS exits 0, even
// on bad input, missing config, or a network error.

const PR_URL_RE = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)/;

const debug = (...a) => {
  if (process.env.PRISM_INGEST_DEBUG === '1') process.stderr.write('[prism-pr-link] ' + a.join(' ') + '\n');
};

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
  const url = process.env.PRISM_INGEST_URL || 'http://localhost:3000/api/ingest/pr-link';
  const token = process.env.PRISM_INGEST_TOKEN;
  if (!token) return debug('no PRISM_INGEST_TOKEN — skipping');

  const raw = await readStdin();
  let event = {};
  try { event = JSON.parse(raw); } catch { /* tolerate non-JSON */ }

  // The whole event is scanned for a PR URL, so we don't depend on the exact
  // tool_response shape across Claude Code versions.
  const m = PR_URL_RE.exec(typeof raw === 'string' ? raw : JSON.stringify(event));
  if (!m) return debug('no PR URL in this tool call — skipping');

  const payload = {
    sessionId: event.session_id || event.sessionId || '',
    repo: m[1],
    prNumber: Number(m[2]),
    source: 'claude_code_hook',
  };
  if (!payload.sessionId) return debug('no session id in event — skipping');

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    debug('forwarded', payload.repo + '#' + payload.prNumber, '->', res.status);
  } catch (e) {
    debug('forward failed (non-fatal):', e && e.message ? e.message : String(e));
  }
}

main().finally(() => process.exit(0));

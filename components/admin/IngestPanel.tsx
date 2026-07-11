// components/admin/IngestPanel.tsx
//
// Plugin / ingest setup (M8 v2 W3). Shows the admin their org's ingest token + endpoint
// and the install snippet, so they can self-serve the prism-pr-link plugin (no DB peek).
// Admin-gated route: GET/POST /api/org/ingest-token. Rotating invalidates the old token.

'use client';

import { useCallback, useEffect, useState } from 'react';

export function IngestPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/org/ingest-token', { cache: 'no-store' });
      const j = await r.json();
      setToken(j.token ?? null);
      setUrl(j.ingestUrl ?? '');
    } catch {
      /* leave as-is */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function rotate() {
    if (!window.confirm('Rotate the ingest token? The old token stops working immediately — you must update the plugin config.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/org/ingest-token', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rotate' }),
      });
      const j = await r.json();
      if (j.ok) { setToken(j.token); setRevealed(true); }
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1400);
  }

  const masked = token ? `${token.slice(0, 6)}${'•'.repeat(12)}${token.slice(-4)}` : '—';
  const snippet = `# Claude Code, then set these where the plugin runs:
export PRISM_INGEST_URL="${url}"
export PRISM_INGEST_TOKEN="${revealed ? (token ?? '<your token>') : '<reveal your token above>'}"
/plugin marketplace add <prism-marketplace>
/plugin install prism-pr-link@prism`;

  const codeStyle = {
    fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)', background: 'var(--panel2)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '6px 10px',
  } as const;
  const btn = {
    cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 11px',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--line2)', background: 'var(--panel2)', color: 'var(--mut)',
  } as const;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="cardhead">
        <h3>Plugin / ingest</h3>
        <span className="sub">forward AI→PR links from Claude Code into this org</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--mut)' }}>Ingest URL</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ ...codeStyle, flex: 1, overflow: 'auto', whiteSpace: 'nowrap' }}>{url || '—'}</code>
          <button type="button" style={btn} onClick={() => copy(url, 'url')}>{copied === 'url' ? 'copied' : 'copy'}</button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--mut)' }}>Ingest token <span style={{ color: 'var(--mut2)' }}>— paste as PRISM_INGEST_TOKEN</span></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ ...codeStyle, flex: 1, overflow: 'auto', whiteSpace: 'nowrap', minWidth: 220 }}>
            {token ? (revealed ? token : masked) : '—'}
          </code>
          <button type="button" style={btn} onClick={() => setRevealed((v) => !v)} disabled={!token}>{revealed ? 'hide' : 'reveal'}</button>
          <button type="button" style={btn} onClick={() => token && copy(token, 'token')} disabled={!token}>{copied === 'token' ? 'copied' : 'copy'}</button>
          <button type="button" style={{ ...btn, color: 'var(--warn)', borderColor: '#f5a52455' }} onClick={rotate} disabled={busy}>{busy ? 'rotating…' : 'rotate'}</button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--mut)' }}>Setup</label>
        <pre style={{ ...codeStyle, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{snippet}</pre>
      </div>
    </div>
  );
}

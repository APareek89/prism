// components/admin/IngestPanel.tsx
//
// Plugin / ingest setup. The prism-pr-link plugin is now ZERO-CONFIG: install it and Prism
// links each PR to its Claude session by the PR's repo (server-side, via the GitHub App
// installation) — no token to copy, nothing written into the developer's git. The per-org
// token survives only as an optional fallback for repos not connected via the App, tucked
// under "Advanced". Admin-gated route: GET/POST /api/org/ingest-token.

'use client';

import { useCallback, useEffect, useState } from 'react';

export function IngestPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    if (!window.confirm('Rotate the fallback ingest token? The old token stops working immediately.')) return;
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
  const installSnippet = `# In Claude Code or Claude Desktop — install once:
/plugin marketplace add APareek89/prism
/plugin install prism-pr-link@prism`;

  const codeStyle = {
    fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)', background: 'var(--panel2)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '6px 10px',
  } as const;
  const btn = {
    cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 11px',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--line2)', background: 'var(--panel2)', color: 'var(--mut)',
  } as const;
  const linkBtn = {
    cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, padding: 0,
    border: 'none', background: 'none', color: 'var(--mut)', textDecoration: 'underline',
  } as const;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="cardhead">
        <h3>Plugin / ingest</h3>
        <span className="sub">AI→PR links from Claude Code — zero-config</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ fontSize: 12.5, color: 'var(--mut)', margin: 0, lineHeight: 1.55 }}>
          Install the plugin and you&rsquo;re done. Prism links each PR to its Claude session by the
          PR&rsquo;s repo — resolved <strong>server-side</strong> from your connected GitHub repos.
          No token to copy, nothing written into your git.
        </p>

        <label style={{ fontSize: 12, color: 'var(--mut)' }}>Install</label>
        <pre style={{ ...codeStyle, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{installSnippet}</pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btn} onClick={() => copy(installSnippet, 'install')}>{copied === 'install' ? 'copied' : 'copy'}</button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--mut)' }}>Ingest URL <span style={{ color: 'var(--mut2)' }}>— set PRISM_INGEST_URL only if your Prism isn&rsquo;t at localhost:3000</span></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ ...codeStyle, flex: 1, overflow: 'auto', whiteSpace: 'nowrap' }}>{url || '—'}</code>
          <button type="button" style={btn} onClick={() => copy(url, 'url')}>{copied === 'url' ? 'copied' : 'copy'}</button>
        </div>

        <button type="button" style={{ ...linkBtn, justifySelf: 'start' }} onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▾ hide advanced' : '▸ advanced — optional token fallback'}
        </button>

        {showAdvanced && (
          <div style={{ display: 'grid', gap: 10, borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--mut2)', margin: 0, lineHeight: 1.5 }}>
              Only for a repo <em>not</em> connected via the GitHub App. Set it as
              <code style={{ margin: '0 4px' }}>PRISM_INGEST_TOKEN</code> where the plugin runs. Otherwise unused.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ ...codeStyle, flex: 1, overflow: 'auto', whiteSpace: 'nowrap', minWidth: 220 }}>
                {token ? (revealed ? token : masked) : '—'}
              </code>
              <button type="button" style={btn} onClick={() => setRevealed((v) => !v)} disabled={!token}>{revealed ? 'hide' : 'reveal'}</button>
              <button type="button" style={btn} onClick={() => token && copy(token, 'token')} disabled={!token}>{copied === 'token' ? 'copied' : 'copy'}</button>
              <button type="button" style={{ ...btn, color: 'var(--warn)', borderColor: '#f5a52455' }} onClick={rotate} disabled={busy}>{busy ? 'rotating…' : 'rotate'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// components/admin/RunPipelineButton.tsx
//
// The per-connector action island on each connector card's `.sync` footer (M2-wired).
// Renders the right PRIMARY action for the connector type plus a shared "Run pipeline
// now" trigger:
//   • github       → "Connect GitHub" (redirect to the App install URL) · Run pipeline
//   • claude_code  → "Scan local sessions" (POST scan) · Run pipeline
//   • sentry       → "Connect Sentry" (POST connect) · Run pipeline
//
// Each action shows loading + error/result state inline, and calls router.refresh() on
// success so the server-rendered Admin cards pick up the new connector health / counts.
// Client component (real buttons + fetch); styled inline to match the design without new
// CSS classes.

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectorCardDTO } from '@/lib/ui/view-models';

export interface RunPipelineButtonProps {
  /** Which connector card this action row belongs to. */
  type: ConnectorCardDTO['type'];
  /** Whether the connector is currently connected (gates pipeline run + relabels). */
  connected: boolean;
}

type Tone = 'idle' | 'busy' | 'ok' | 'err';

const buttonStyle = (tone: Tone, primary: boolean): React.CSSProperties => ({
  cursor: tone === 'busy' ? 'progress' : 'pointer',
  padding: '6px 11px',
  borderRadius: 7,
  border: '1px solid var(--line2)',
  background: primary ? 'var(--accent, #605BFF)' : 'var(--panel2)',
  color: primary ? '#fff' : 'var(--mut2)',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  opacity: tone === 'busy' ? 0.7 : 1,
});

export function RunPipelineButton({ type, connected }: RunPipelineButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tone, setTone] = useState<Tone>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const busy = tone === 'busy';

  /** POST helper: run an action, show result, refresh server data on success. */
  async function post(url: string, label: string): Promise<void> {
    setTone('busy');
    setMsg(`${label}…`);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        setTone('err');
        setMsg(String(data.error ?? data.detail ?? `failed (${res.status})`));
        return;
      }
      setTone('ok');
      setMsg(summarize(url, data));
      startTransition(() => router.refresh());
    } catch (e) {
      setTone('err');
      setMsg(e instanceof Error ? e.message : 'request failed');
    }
  }

  /** Connect GitHub → full-page redirect to the App install entry (server 302s to GitHub). */
  function connectGitHub(): void {
    setTone('busy');
    setMsg('Redirecting to GitHub…');
    window.location.href = '/api/connectors/github/install';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {msg ? (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: tone === 'err' ? 'var(--warn, #d9534f)' : 'var(--mut2)',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={msg}
        >
          {msg}
        </span>
      ) : null}

      {/* primary, type-specific action */}
      {type === 'github' ? (
        <button type="button" disabled={busy} onClick={connectGitHub} style={buttonStyle(tone, !connected)}>
          {connected ? 'Reconnect GitHub' : 'Connect GitHub'}
        </button>
      ) : null}

      {type === 'claude_code' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => post('/api/connectors/claude-code/scan', 'Scanning local sessions')}
          style={buttonStyle(tone, !connected)}
        >
          Scan local sessions
        </button>
      ) : null}

      {type === 'sentry' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => post('/api/connectors/sentry/connect', 'Connecting Sentry')}
          style={buttonStyle(tone, !connected)}
        >
          {connected ? 'Re-sync Sentry' : 'Connect Sentry'}
        </button>
      ) : null}

      {/* shared pipeline trigger */}
      <button
        type="button"
        disabled={busy}
        onClick={() => post('/api/pipeline/run', 'Running pipeline')}
        title="Ingest configured connectors, score, and persist the index"
        aria-label="Run pipeline now"
        style={buttonStyle(tone, false)}
      >
        Run pipeline now
      </button>
    </div>
  );
}

/** Build a short human result line from a route's JSON response. */
function summarize(url: string, data: Record<string, unknown>): string {
  if (url.endsWith('/pipeline/run')) {
    const scored = data.membersScored ?? 0;
    const band = data.band ?? '—';
    return `scored ${scored} · ${String(band)}`;
  }
  if (url.endsWith('/claude-code/scan')) {
    return `ingested ${data.ingested ?? 0} · skipped ${data.skipped ?? 0}`;
  }
  if (url.endsWith('/sentry/connect')) {
    if (data.status === 'not_configured') return 'not configured';
    return `synced ${data.written ?? 0}`;
  }
  return 'done';
}

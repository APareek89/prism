// components/admin/AttributionSelector.tsx
//
// The attribution `.note` block (Admin) explaining BYO Claude Code subscriptions, with
// the `.radio` selector for how unmatched telemetry streams are handled:
//   Org workspace · BYO reimbursement · Hybrid (recommended)
// Faithful port of the design's `.note` / `.radio` markup. Client component because the
// selector is interactive. On mount it loads the persisted policy from
// /api/connectors/attribution; selecting an option POSTs the new value (persisted on the
// claude_code connector config). Defaults to "Hybrid".
//
// 'use client'

'use client';

import { useEffect, useState } from 'react';

type Mode = 'org' | 'byo' | 'hybrid';

const OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: 'org', label: 'Org workspace' },
  { value: 'byo', label: 'BYO reimbursement' },
  { value: 'hybrid', label: 'Hybrid (recommended)' },
];

export interface AttributionSelectorProps {
  /** Initial selection (defaults to the recommended Hybrid mode). */
  defaultMode?: Mode;
}

export function AttributionSelector({ defaultMode = 'hybrid' }: AttributionSelectorProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Load the persisted policy on mount (best-effort; falls back to the default).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/connectors/attribution')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.mode === 'string') setMode(d.mode as Mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist a newly-selected mode (optimistic; reverts the note on failure). */
  async function selectMode(next: Mode): Promise<void> {
    const prev = mode;
    setMode(next);
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch('/api/connectors/attribution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        setMode(prev);
        setNote(String(data.error ?? `save failed (${res.status})`));
      } else {
        setNote('saved');
      }
    } catch (e) {
      setMode(prev);
      setNote(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="note">
      <h4>⚑ Attribution — BYO Claude Code subscriptions</h4>
      <p>
        Telemetry is <b>client-side and subscription-agnostic</b>: a developer on a personal Max
        plan still emits OTEL the same as one on the org workspace. Prism enables export org-wide by
        pushing <b>managed-settings.json</b> via MDM, then maps each stream to an employee via{' '}
        <code>user.account_uuid</code> (or an injected resource attribute) → the roster row.
        Org-workspace users are reconciled against Console spend; BYO users are flagged for
        reimbursement using the emitted <code>cost.usage</code> metric. Pick how unmatched streams
        are handled:
      </p>
      <div className="radio" role="radiogroup" aria-label="Unmatched stream handling">
        {OPTIONS.map((opt) => {
          const selected = opt.value === mode;
          return (
            <label
              key={opt.value}
              className={selected ? 'sel' : undefined}
              role="radio"
              aria-checked={selected}
              aria-disabled={saving}
              tabIndex={0}
              onClick={() => {
                if (!saving) void selectMode(opt.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!saving) void selectMode(opt.value);
                }
              }}
            >
              <i />
              {opt.label}
            </label>
          );
        })}
        {note ? (
          <span
            className="mono"
            style={{ fontSize: 10.5, color: note === 'saved' ? 'var(--good, #2e9e5b)' : 'var(--warn)', alignSelf: 'center' }}
          >
            {saving ? 'saving…' : note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

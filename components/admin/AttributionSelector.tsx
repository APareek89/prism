// components/admin/AttributionSelector.tsx
//
// The attribution `.note` block (Admin) explaining BYO Claude Code subscriptions, with
// the `.radio` selector for how unmatched telemetry streams are handled:
//   Org workspace · BYO reimbursement · Hybrid (recommended)
// Faithful port of the design's `.note` / `.radio` markup. Client component because the
// selector is interactive; the selection is held in local state for now — persisting it
// (writing the org's AttributionMode) is wired in M2. Defaults to "Hybrid".
//
// 'use client'

'use client';

import { useState } from 'react';

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
              tabIndex={0}
              onClick={() => setMode(opt.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMode(opt.value);
                }
              }}
            >
              <i />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// components/admin/RunPipelineButton.tsx
//
// The "Run pipeline now" affordance on each connector card. Client component because
// it's a real button, but the pipeline trigger wiring lands in M2 — so for now it is
// disabled and no-ops, with a tooltip explaining when it goes live. Styled to sit on
// the connector card's `.sync` footer without introducing new CSS classes.

'use client';

export interface RunPipelineButtonProps {
  /** Disabled when the connector isn't connected (nothing to run). */
  connected: boolean;
}

export function RunPipelineButton({ connected }: RunPipelineButtonProps) {
  return (
    <button
      type="button"
      disabled
      title="Manual pipeline runs are wired in M2"
      aria-label="Run pipeline now"
      style={{
        cursor: 'not-allowed',
        padding: '6px 11px',
        borderRadius: 7,
        border: '1px solid var(--line2)',
        background: 'var(--panel2)',
        color: 'var(--mut2)',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        fontWeight: 500,
        opacity: connected ? 0.85 : 0.5,
        whiteSpace: 'nowrap',
      }}
    >
      Run pipeline now
    </button>
  );
}

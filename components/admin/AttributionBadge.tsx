// components/admin/AttributionBadge.tsx
//
// The match-status badge used inside the Admin roster table. Faithful to the design:
//   linked    → `.status` with a green `.led`
//   byo       → a warn-colored `.conf` with a warn `.led` (the "BYO?" treatment)
//   unmatched → a warn-colored `.conf` with a warn `.led` ("unmatched")
// The corresponding CSS lives in globals.css (`.status`, `.status .led`, `.conf`).
//
// Server Component (pure presentation).

import type { RosterMatchDTO } from '@/lib/ui/view-models';

export interface AttributionBadgeProps {
  match: RosterMatchDTO['match'];
}

export function AttributionBadge({ match }: AttributionBadgeProps) {
  if (match === 'linked') {
    return (
      <span className="status">
        <span className="led" />
        linked
      </span>
    );
  }

  // byo + unmatched both render the warn-toned treatment from the design.
  const label = match === 'byo' ? 'BYO?' : 'unmatched';
  return (
    <span className="conf" style={{ color: 'var(--warn)' }}>
      <span
        className="led"
        style={{ background: 'var(--warn)', boxShadow: '0 0 7px #f5a524' }}
      />
      {label}
    </span>
  );
}

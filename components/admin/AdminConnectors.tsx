// components/admin/AdminConnectors.tsx
//
// The Admin connector grid. Faithful port of the design's `.conn` row of three
// `.conncard` (GitHub · Claude Code · Sentry): each card has a `.ch` header with the
// connector `.nm` and a `.status` pill carrying a `.led`, a `<p>` describing what the
// source powers, a `.sync` footer line, and a "Run pipeline now" button (client; the
// run wiring lands in M2 so it is disabled with a tooltip). Connectors render from
// real ConnectorCardDTO[] — no fabricated values; an empty list renders the three
// expected slots as "Not configured" so Admin still reads structurally from day one.
//
// Server Component shell; only the per-card button is a client island.

import type { ConnectorCardDTO } from '@/lib/ui/view-models';
import { RunPipelineButton } from './RunPipelineButton';

/** The three connector types the design ships, in display order. */
const CONNECTOR_ORDER: Array<{ type: ConnectorCardDTO['type']; name: string; powers: string }> = [
  {
    type: 'github',
    name: 'GitHub',
    powers:
      'PRs, commits, diffs, reviews, reverts. Drives PR sizing (S/M/L), Efficiency & Effectiveness.',
  },
  {
    type: 'claude_code',
    name: 'Claude Code',
    powers:
      'OpenTelemetry export: tokens & cost by model, sessions, accept/reject, skill.name, prompt length. Drives Usage, Efficiency, Proficiency & tokens/PR.',
  },
  {
    type: 'sentry',
    name: 'Sentry',
    powers:
      'Incidents & releases linked to deploys. Drives change-failure rate and MTTR (Effectiveness).',
  },
];

export interface AdminConnectorsProps {
  connectors: ConnectorCardDTO[];
}

export function AdminConnectors({ connectors }: AdminConnectorsProps) {
  // Index real DTOs by type, then render the three expected slots in design order so
  // the grid is always structurally complete even before any connector is configured.
  const byType = new Map(connectors.map((c) => [c.type, c]));

  return (
    <div className="conn">
      {CONNECTOR_ORDER.map((slot) => {
        const dto = byType.get(slot.type);
        const connected = dto?.connected ?? false;
        const statusLabel = dto?.statusLabel ?? 'Not configured';
        const powers = dto?.powers ?? slot.powers;
        const name = dto?.name ?? slot.name;

        return (
          <div className="conncard" key={slot.type}>
            <div className="ch">
              <span className="nm">{name}</span>
              <span
                className="status"
                style={connected ? undefined : { color: 'var(--mut2)' }}
              >
                <span
                  className="led"
                  style={
                    connected
                      ? undefined
                      : { background: 'var(--mut2)', boxShadow: 'none' }
                  }
                />
                {statusLabel}
              </span>
            </div>
            <p>{powers}</p>
            <div
              className="sync"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span>{dto?.syncLabel ?? 'Awaiting first sync'}</span>
              <RunPipelineButton connected={connected} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

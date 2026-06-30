// app/admin/page.tsx
//
// Admin (M0 shell). Shows placeholder connector cards reflecting live `isConfigured`
// status (not yet wired to connect actions — that's M1/M2) + an EmptyState for the
// roster/config sections. Admin-only in the real access model; in the demo the user
// holds the admin role so it renders.

import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { AdminNav } from '@/components/layout/AdminNav';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { getAuthUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/roles';
import { isConfigured, type Connector } from '@/lib/config/env';

interface ConnectorCard {
  key: Connector;
  label: string;
  description: string;
}

const CONNECTOR_CARDS: ConnectorCard[] = [
  { key: 'github', label: 'GitHub', description: 'PRs, commits, diffs, reverts (raw evidence).' },
  { key: 'claudeCode', label: 'Claude Code', description: 'Local ~/.claude session telemetry.' },
  { key: 'sentry', label: 'Sentry', description: 'Releases → deploys, issues → incidents.' },
];

export default async function AdminPage() {
  const user = await getAuthUser();
  const admin = user ? isAdmin(user) : false;

  return (
    <>
      <MetaStrip
        title="Admin"
        who={user?.displayName ?? null}
        isDemo={user?.isDemo ?? false}
        showPeriodToggle={false}
      />
      <ViewBody>
        <AdminNav />

        {!admin ? (
          <Panel title="Restricted">
            <EmptyState
              title="Admin only"
              hint="you need the admin role to manage connectors, roster, and config"
            />
          </Panel>
        ) : (
          <>
            <section id="connectors" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="display" style={{ fontSize: 14, fontWeight: 600 }}>
                Connectors
              </h2>
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                }}
              >
                {CONNECTOR_CARDS.map((c) => {
                  const configured = isConfigured(c.key);
                  return (
                    <Panel
                      key={c.key}
                      title={c.label}
                      actions={
                        <StatusPill tone={configured ? 'good' : 'muted'}>
                          {configured ? 'configured' : 'not configured'}
                        </StatusPill>
                      }
                    >
                      <p style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 12 }}>
                        {c.description}
                      </p>
                      <button
                        disabled
                        title="Wiring lands in M1/M2"
                        style={{
                          cursor: 'not-allowed',
                          padding: '7px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line)',
                          background: 'var(--panel2)',
                          color: 'var(--mut2)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          fontFamily: 'var(--body)',
                        }}
                      >
                        Connect
                      </button>
                    </Panel>
                  );
                })}
              </div>
            </section>

            <section id="roster">
              <Panel eyebrow="people" title="Roster">
                <EmptyState
                  compact
                  hint="awaiting signal — import a roster CSV or sync your GitHub org (M2)"
                />
              </Panel>
            </section>

            <section id="config">
              <Panel eyebrow="weights · anchors" title="Index config">
                <EmptyState compact hint="the seeded index_config v1 surfaces here in M1" />
              </Panel>
            </section>

            <section id="sizing">
              <Panel eyebrow="S · M · L" title="Sizing rule">
                <EmptyState compact hint="frozen 90-day tertiles display here once PRs sync" />
              </Panel>
            </section>
          </>
        )}
      </ViewBody>
    </>
  );
}

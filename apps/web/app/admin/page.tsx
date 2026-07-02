// app/admin/page.tsx
//
// Admin & connectors — the setup view. Faithful port of the design's `#admin` section:
//   .top   — "Admin & connectors"
//   .conn  — the three connector cards (AdminConnectors)            [GitHub · Claude Code · Sentry]
//   .note  — attribution block + Org/BYO/Hybrid radio (AttributionSelector)
//   roster — the `.upload` dropzone + roster table (RosterUpload, with AttributionBadge)
//   .row.r2 — Index configuration table (IndexConfig) + PR sizing rule (SizingRule)
//   .foot  — the live-MVP footnote
//
// Admin is fully interactive-looking from day one even with empty data: the connector
// slots, attribution selector, upload dropzone, and config tables all render their real
// structure. Data is Supabase-backed via lib/db — empty/awaiting shapes render the
// expected scaffolding (header rows, "Not configured" connectors) without fabricating
// people or metrics. Admin-only: non-admins get the restricted EmptyState.

import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { AdminNav } from '@/components/layout/AdminNav';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminConnectors } from '@/components/admin/AdminConnectors';
import { AttributionSelector } from '@/components/admin/AttributionSelector';
import { RosterUpload } from '@/components/admin/RosterUpload';
import { IndexConfig } from '@/components/admin/IndexConfig';
import { SizingRule } from '@/components/admin/SizingRule';
import { getAuthUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/roles';
import {
  getConnectors,
  getRosterMatches,
  getIndexConfig,
  getSizingRule,
  getCurrentFunctionId,
} from '@/lib/db';

export default async function AdminPage() {
  const user = await getAuthUser();
  const admin = user ? isAdmin(user) : false;

  if (!admin) {
    return (
      <>
        <MetaStrip
          title="Admin & connectors"
          subtitle="Data sources, roster, and attribution settings"
          who={user?.displayName ?? null}
          isDemo={user?.isDemo ?? false}
          showPeriodToggle={false}
        />
        <ViewBody>
          <AdminNav />
          <Panel title="Restricted">
            <EmptyState
              title="Admin only"
              hint="you need the admin role to manage connectors, roster, and config"
            />
          </Panel>
        </ViewBody>
      </>
    );
  }

  const functionId = (await getCurrentFunctionId()) ?? user?.functionId ?? '';

  const [connectors, rosterMatches, indexConfig, sizingRule] = await Promise.all([
    getConnectors(functionId),
    getRosterMatches(functionId),
    getIndexConfig(functionId),
    getSizingRule(functionId),
  ]);

  return (
    <>
      <MetaStrip
        title="Admin & connectors"
        subtitle="Data sources, roster, and attribution settings"
        who={user?.displayName ?? null}
        isDemo={user?.isDemo ?? false}
        showPeriodToggle={false}
      />
      <ViewBody>
        <AdminNav />

        {/* ── .conn — connector cards ── */}
        <section id="connectors">
          <AdminConnectors connectors={connectors} />
        </section>

        {/* ── .note — attribution / BYO ── */}
        <section id="attribution">
          <AttributionSelector />
        </section>

        {/* ── roster — upload + match table ── */}
        <section id="roster">
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="cardhead">
              <h3>Engineer roster</h3>
              <span className="sub">CSV maps people to their data streams</span>
            </div>
            <RosterUpload rows={rosterMatches} />
          </div>
        </section>

        {/* ── .row.r2 — index config + sizing rule ── */}
        <div className="row r2">
          <div className="card" id="config">
            <div className="cardhead">
              <h3>Index configuration</h3>
              <span className="sub">read-only · versioned</span>
            </div>
            <IndexConfig rows={indexConfig} />
          </div>
          <div className="card" id="sizing">
            <div className="cardhead">
              <h3>PR sizing rule</h3>
              <span className="sub">deterministic · no LLM on core path</span>
            </div>
            <SizingRule rule={sizingRule} />
          </div>
        </div>

        <div className="foot">
          In the live MVP, GitHub uses an app install, Claude Code uses OTEL via managed settings,
          Sentry uses an org token. Connectors and roster reflect your real configured sources.
        </div>
      </ViewBody>
    </>
  );
}

// app/(views)/function/page.tsx
//
// Function view (M0 shell). Renders the view chrome + an awaiting-signal EmptyState.
// The faithful port of the dashboard (IndexHero, SpectrumPanel, TokenLens, …) lands
// in M1; for M0 the route just builds and renders empty so the whole app boots
// keyless with no fabricated numbers.

import Link from 'next/link';
import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfidenceChip } from '@/components/ui/ConfidenceChip';
import { getAuthUser } from '@/lib/auth/session';
import { ROUTES } from '@/lib/config/constants';

export default async function FunctionView() {
  const user = await getAuthUser();

  return (
    <>
      <MetaStrip
        title="Function"
        who={user?.displayName ?? null}
        isDemo={user?.isDemo ?? false}
        actions={<ConfidenceChip band="insufficient" />}
      />
      <ViewBody>
        <Panel eyebrow="L1 · white light" title="Function index">
          <EmptyState
            title="Awaiting signal"
            hint="awaiting signal — connect sources in Admin to populate the Function index"
            action={
              <Link
                href={ROUTES.admin}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line2)',
                  background: 'var(--panel2)',
                  color: 'var(--ink)',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Open Admin
              </Link>
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <Panel eyebrow="four signals" title="Spectrum">
            <EmptyState compact hint="usage · efficiency · effectiveness · proficiency" />
          </Panel>
          <Panel eyebrow="FinOps" title="Token lens">
            <EmptyState compact hint="tokens / PR appears once Claude Code sessions sync" />
          </Panel>
        </div>
      </ViewBody>
    </>
  );
}

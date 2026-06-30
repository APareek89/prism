// app/(views)/team/page.tsx
//
// Team view (M0 shell). The roster loops over N members in M1; today it renders the
// chrome + an EmptyState. org=me=team, but the roster is data-driven (no hardcoded
// single user).

import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAuthUser } from '@/lib/auth/session';

export default async function TeamView() {
  const user = await getAuthUser();

  return (
    <>
      <MetaStrip title="Team" who={user?.displayName ?? null} isDemo={user?.isDemo ?? false} />
      <ViewBody>
        <Panel eyebrow="roster" title="Squad">
          <EmptyState
            title="Awaiting signal"
            hint="awaiting signal — the roster populates from connected sources (org = me = team today, N-ready in code)"
          />
        </Panel>
      </ViewBody>
    </>
  );
}

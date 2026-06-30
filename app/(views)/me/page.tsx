// app/(views)/me/page.tsx
//
// My view (M0 shell). Resolves the current employee and renders the chrome + an
// EmptyState. In M1 this reuses MemberDetail bound to the current employee. Nothing
// is hardcoded to a single user — it resolves via lib/auth/session.

import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfidenceChip } from '@/components/ui/ConfidenceChip';
import { getAuthUser } from '@/lib/auth/session';

export default async function MyView() {
  const user = await getAuthUser();

  return (
    <>
      <MetaStrip
        title="My view"
        who={user?.displayName ?? null}
        isDemo={user?.isDemo ?? false}
        actions={<ConfidenceChip band="insufficient" />}
      />
      <ViewBody>
        <Panel eyebrow="your index" title="My index">
          <EmptyState
            title="Awaiting signal"
            hint="awaiting signal — do some work with Claude Code and connect GitHub to light this up"
          />
        </Panel>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <Panel eyebrow="recommendations" title="What to improve">
            <EmptyState compact hint="recommendations appear after your first scored window" />
          </Panel>
          <Panel eyebrow="learning" title="Courses">
            <EmptyState compact hint="micro-courses are assigned from your weakest dimension" />
          </Panel>
        </div>
      </ViewBody>
    </>
  );
}

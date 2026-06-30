// app/(views)/team/[memberId]/page.tsx
//
// Member detail (M0 shell). Resolves the current user, checks they may view this
// member (access model §12.5 — managers see coaching, not raw PRs), and renders a
// back link + EmptyState. The full MemberDetail port lands in M1.

import { notFound } from 'next/navigation';
import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackLink } from '@/components/ui/BackLink';
import { getAuthUser } from '@/lib/auth/session';
import { canViewMember, can } from '@/lib/auth/roles';
import { ROUTES } from '@/lib/config/constants';

export default async function MemberDetailView({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const user = await getAuthUser();

  // Access control is real even in the demo. No member visibility → 404 (don't reveal
  // existence to an unauthorized viewer).
  if (!user || !canViewMember(user, memberId)) {
    notFound();
  }

  const mayViewRawPrs = can(user, 'view_member_raw_prs');

  return (
    <>
      <MetaStrip
        title="Member"
        who={user.displayName}
        isDemo={user.isDemo}
        subtitle={mayViewRawPrs ? 'raw PRs visible' : 'coaching view'}
      />
      <ViewBody>
        <BackLink href={ROUTES.team}>Back to squad</BackLink>
        <Panel eyebrow="member detail" title="Member index">
          <EmptyState
            title="Awaiting signal"
            hint="awaiting signal — this member has no scored window yet"
          />
        </Panel>
      </ViewBody>
    </>
  );
}

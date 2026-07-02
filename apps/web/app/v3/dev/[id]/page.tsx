import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { activePin, developerByHandle, developerDetail } from '@/lib/v3/read';
import { IndexHero, InsightList, KpiGrid, RecList } from '@/components/v3/detail';
import { V3Nav } from '@/components/v3/Nav';

export const dynamic = 'force-dynamic';

export default async function V3DevPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dev = await developerByHandle(id);
  if (!dev) notFound();
  const pin = await activePin();
  const detail = await developerDetail(dev.id, pin);
  if (!detail) notFound();

  const mainKpis = detail.kpis.filter((k) => k.index_kind === 'main');
  const otherKpis = detail.kpis.filter((k) => k.index_kind !== 'main');

  return (
    <>
      <MetaStrip
        title={detail.dev.name}
        subtitle={`@${detail.dev.handle} · ${detail.dev.archetype.replaceAll('_', ' ')} · seat ${detail.dev.seat_tier} · config v${pin.version}`}
        who={detail.dev.team}
        isDemo
        showPeriodToggle={false}
        actions={<V3Nav />}
      />
      <ViewBody>
        <Link href="/v3" className="backbtn" style={{ alignSelf: 'flex-start', textDecoration: 'none', marginBottom: 0 }}>
          ← Team
        </Link>
        <IndexHero main={detail.main} harness={detail.harness} />
        <KpiGrid kpis={mainKpis} title="Core-6 — the MAIN index" sub="raw → anchors → 0–100" />
        <KpiGrid
          kpis={otherKpis}
          title="Harness-4 + diagnostics"
          sub="KPI 9 tier-badged · joins the Outcomes core after one clean T1 month"
        />
        <InsightList
          insights={detail.insights}
          title="Insights"
          sub="only CONFIRMED hypotheses · H0 (is the number real?) first"
        />
        <RecList recs={detail.recommendations} title="Recommendations" />
      </ViewBody>
    </>
  );
}

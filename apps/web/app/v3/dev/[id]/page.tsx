import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activePin, developerByHandle, developerDetail } from '@/lib/v3/read';
import { IndexHero, InsightList, KpiGrid, RecList } from '@/components/v3/detail';

export const dynamic = 'force-dynamic';

export default async function V3DevPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dev = await developerByHandle(id);
  if (!dev) notFound();
  const pin = await activePin();
  const detail = await developerDetail(dev.id, pin);
  if (!detail) notFound();

  const mainKpis = detail.kpis.filter((k) => k.index_kind === 'main');
  const harnessKpis = detail.kpis.filter((k) => k.index_kind === 'harness');
  const diagnosticKpis = detail.kpis.filter((k) => k.index_kind === 'diagnostic');

  return (
    <>
      <p className="v3-sub"><Link href="/v3" style={{ color: 'var(--mut)' }}>← Team</Link></p>
      <h1 className="v3-h1">{detail.dev.name} <span className="v3-mut">@{detail.dev.handle}</span></h1>
      <p className="v3-sub">
        {detail.dev.team} · archetype: {detail.dev.archetype.replaceAll('_', ' ')} · seat: {detail.dev.seat_tier}
        {' · '}config v{pin.version}, as-of {pin.date ?? '—'}
      </p>
      <IndexHero main={detail.main} harness={detail.harness} />
      <div style={{ height: 18 }} />
      <KpiGrid kpis={mainKpis} title="Core-6 — the MAIN index" />
      <KpiGrid kpis={[...harnessKpis, ...diagnosticKpis]} title="Harness-4 + diagnostics (KPI 9 tier-badged, promoted after one clean T1 month)" />
      <InsightList
        insights={detail.insights}
        title="Insights"
        hint="only CONFIRMED hypotheses become insights — H0 (is the number real?) runs first"
      />
      <RecList recs={detail.recommendations} title="Recommendations" />
    </>
  );
}

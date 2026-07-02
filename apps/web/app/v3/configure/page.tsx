import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { activeConfigVersion, activePin, dataPoints, kpiCatalog } from '@/lib/v3/read';
import { ConfigureTable } from '@/components/v3/ConfigureTable';
import { V3Nav } from '@/components/v3/Nav';

export const dynamic = 'force-dynamic';

export default async function V3ConfigurePage() {
  const [catalog, points, active, pin] = await Promise.all([
    kpiCatalog(), dataPoints(), activeConfigVersion(), activePin(),
  ]);
  return (
    <>
      <MetaStrip
        title="Configure — the model, from the database"
        subtitle={`active config v${active.version} · as-of ${pin.date ?? '—'}`}
        who="v3.kpi_catalog ⋈ v3.data_points"
        isDemo
        showPeriodToggle={false}
        actions={<V3Nav />}
      />
      <ViewBody>
        <ConfigureTable
          catalog={catalog}
          dataPoints={points}
          activeVersion={active.version}
          activeNote={active.note}
          initialConfig={active.config}
          asOf={pin.date}
        />
      </ViewBody>
    </>
  );
}

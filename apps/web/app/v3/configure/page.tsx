import { activeConfigVersion, activePin, dataPoints, kpiCatalog } from '@/lib/v3/read';
import { ConfigureTable } from '@/components/v3/ConfigureTable';

export const dynamic = 'force-dynamic';

export default async function V3ConfigurePage() {
  const [catalog, points, active, pin] = await Promise.all([
    kpiCatalog(), dataPoints(), activeConfigVersion(), activePin(),
  ]);
  return (
    <>
      <h1 className="v3-h1">Configure — the model, from the database</h1>
      <p className="v3-sub">
        Every KPI below is a row in v3.kpi_catalog; inputs come from v3.data_points. Edit weights or
        delete (disable) a KPI — deleting redistributes its weight proportionally across the remaining
        enabled KPIs of the SAME index, so main and harness each always sum to 100. Saving creates a
        NEW row in v3.config_versions and recomputes every dashboard from it.
      </p>
      <ConfigureTable
        catalog={catalog}
        dataPoints={points}
        activeVersion={active.version}
        activeNote={active.note}
        initialConfig={active.config}
        asOf={pin.date}
      />
    </>
  );
}

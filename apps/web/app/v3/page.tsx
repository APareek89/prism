import { MetaStrip } from '@/components/layout/MetaStrip';
import { ViewBody } from '@/components/layout/ViewBody';
import { activePin, teamRows } from '@/lib/v3/read';
import { TeamTable, type TeamTableRow } from '@/components/v3/TeamTable';
import { V3Nav } from '@/components/v3/Nav';

export const dynamic = 'force-dynamic';

export default async function V3TeamPage() {
  const pin = await activePin();
  const rows = await teamRows(pin);
  const vm: TeamTableRow[] = rows.map((r) => ({
    id: r.dev.id,
    handle: r.dev.handle,
    name: r.dev.name,
    archetype: r.dev.archetype,
    team: r.dev.team,
    mainScore: r.main?.score ?? null,
    band: r.main?.band ?? null,
    mainConfidence: r.main?.confidence ?? 0,
    l0Forced: r.main?.gates.l0_forced ?? false,
    l5Capped: r.main?.gates.l5_capped ?? false,
    multiplier: r.main?.gates.multiplier_signal ?? 0,
    dimensions: r.main?.dimensions ?? {},
    harnessScore: r.harness?.score ?? null,
    harnessConfidence: r.harness?.confidence ?? 0,
    aiSharePct: r.aiSharePct,
    insightCount: r.insightCount,
    recCount: r.recCount,
  }));
  return (
    <>
      <MetaStrip
        title="Function — v3 preview"
        subtitle={`config v${pin.version} · as-of ${pin.date ?? '—'}`}
        who={`${vm.length} developers`}
        isDemo
        showPeriodToggle={false}
        actions={<V3Nav />}
      />
      <ViewBody>
        <div className="card">
          <div className="cardhead">
            <h3>Both indexes, per developer</h3>
            <span className="sub">MAIN 15/35/50 over Core-6 · HARNESS separate (12–15) · click a row to drill in</span>
          </div>
          <TeamTable rows={vm} />
        </div>
      </ViewBody>
    </>
  );
}

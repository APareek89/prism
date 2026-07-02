import { activePin, teamRows } from '@/lib/v3/read';
import { TeamTable, type TeamTableRow } from '@/components/v3/TeamTable';

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
      <h1 className="v3-h1">Function dashboard — both indexes, {vm.length} developers</h1>
      <p className="v3-sub">
        MAIN index = Usage 15 · Efficiency 35 · Outcomes 50 over the Core-6. HARNESS index = KPIs
        12–15, scored separately, no bands — it never mixes into the main number. Click a developer
        to drill into KPIs, insights and recommendations. Config v{pin.version}, as-of {pin.date ?? '—'}.
      </p>
      <div className="v3-panel">
        <TeamTable rows={vm} />
      </div>
    </>
  );
}

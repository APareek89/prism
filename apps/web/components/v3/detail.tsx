// Server-safe rendering blocks shared by the drill-down and My View Tab 1.

import type { IndexDailyRow, InsightRow, KpiDailyRow, RecommendationRow } from '@prism/contract';
import { BandChip, ConfidenceChip, CHANNEL_LABEL } from './chips';

const DIM_HUES: Record<string, string> = { usage: '#5b8def', efficiency: '#2dd4bf', outcomes: '#f5a524' };

export function IndexHero({ main, harness }: { main: IndexDailyRow | null; harness: IndexDailyRow | null }) {
  return (
    <div className="v3-hero">
      <div className="v3-panel" style={{ marginBottom: 0 }}>
        <h2>MAIN index <span className="hint">Usage 15 · Efficiency 35 · Outcomes 50</span></h2>
        <div className="v3-hero-score">{main?.score === null || !main ? '—' : main.score.toFixed(1)}</div>
        <div style={{ margin: '10px 0 6px' }}>
          <BandChip band={main?.band ?? null} />{' '}
          {main ? <ConfidenceChip confidence={main.confidence} suppressed={main.score === null} /> : null}
          {main?.gates.l0_forced ? <span className="v3-chip bad">L0 gate: AI share &lt; 15%</span> : null}
          {main?.gates.l5_capped ? <span className="v3-chip warn">L5 capped: no multiplier signal</span> : null}
          {(main?.gates.multiplier_signal ?? 0) > 0 ? <span className="v3-chip good">multiplier ×{main!.gates.multiplier_signal}</span> : null}
        </div>
        {(['usage', 'efficiency', 'outcomes'] as const).map((d) => {
          const v = main?.dimensions?.[d] ?? null;
          return (
            <div className="v3-dimrow" key={d}>
              <span style={{ width: 82, color: 'var(--mut)', textTransform: 'capitalize' }}>{d}</span>
              <div className="v3-dimbar"><span style={{ width: `${Math.max(2, v ?? 0)}%`, background: DIM_HUES[d] }} /></div>
              <span className="v3-score" style={{ width: 44, textAlign: 'right' }}>{v === null ? '—' : v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="v3-panel" style={{ marginBottom: 0 }}>
        <h2>HARNESS index <span className="hint">KPIs 12–15 · separate · no bands · never mixes into main</span></h2>
        <div className="v3-hero-score" style={{ color: 'var(--harness)' }}>
          {harness?.score === null || !harness ? '—' : harness.score.toFixed(1)}
        </div>
        <div style={{ margin: '10px 0 6px' }}>
          {harness ? <ConfidenceChip confidence={harness.confidence} suppressed={harness.score === null} /> : null}
          {harness?.score === null ? <span className="v3-chip">insufficient signal — published honestly, never a fake 0</span> : null}
        </div>
        <p className="v3-mut v3-small" style={{ lineHeight: 1.55 }}>
          Are the compounding practices installed? Skills authored · verification harness ·
          review loop · context continuity. The 🔗 linkage engine ties gaps here to the
          main-index damage they cause — see insights below.
        </p>
      </div>
    </div>
  );
}

export function KpiGrid({ kpis, title }: { kpis: KpiDailyRow[]; title: string }) {
  return (
    <div className="v3-panel">
      <h2>{title}</h2>
      <div className="v3-kpigrid">
        {kpis.map((k) => (
          <div className="v3-kpicard" key={k.kpi_id}>
            <div className="num">
              KPI · {k.kpi_id.replaceAll('_', ' ')}
              {k.index_kind === 'diagnostic' ? <span className="v3-chip" style={{ marginLeft: 6 }}>diagnostic</span> : null}
              {k.tier ? <span className="v3-chip tier" style={{ marginLeft: 6 }}>{k.tier}</span> : null}
            </div>
            <div className="val">{k.score === null ? '—' : k.score.toFixed(0)}</div>
            <div className="raw">
              raw: {k.raw_value === null ? 'no signal' : k.raw_value}
              {' · '}n={k.signal_count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightList({ insights, title, hint }: { insights: InsightRow[]; title: string; hint?: string }) {
  return (
    <div className="v3-panel">
      <h2>{title}{hint ? <span className="hint">{hint}</span> : null}</h2>
      {insights.length === 0 ? <div className="v3-empty">No confirmed insights — nothing below target with a surviving hypothesis.</div> : null}
      {insights.map((i) => (
        <div className={`v3-insight ch-${i.channel}`} key={i.id}>
          <div className="t">
            {i.title}
            <span className="v3-chip" style={{ marginLeft: 8 }}>{i.kpi_id === 'linkage' ? '🔗 linkage' : i.kpi_id.replaceAll('_', ' ')} · {i.hypothesis}</span>
            <span className="v3-chip">{CHANNEL_LABEL[i.channel] ?? i.channel}</span>
          </div>
          <div className="b">{i.body}</div>
        </div>
      ))}
    </div>
  );
}

export function RecList({ recs, title }: { recs: RecommendationRow[]; title: string }) {
  return (
    <div className="v3-panel">
      <h2>{title}<span className="hint">impact = (100 − score) × index weight — auditable arithmetic</span></h2>
      {recs.length === 0 ? <div className="v3-empty">No open recommendations.</div> : null}
      {recs.map((r) => (
        <div className={`v3-insight ch-${r.channel}`} key={r.id}>
          <div className="t">
            #{r.rank} · {r.title}
            <span className="v3-chip" style={{ marginLeft: 8 }}>impact {r.impact.toFixed(1)}</span>
            <span className="v3-chip">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
            <span className="v3-chip">owner: {r.owner}</span>
          </div>
          <div className="b">{r.rationale} <span className="v3-mut">Targets: {r.targets.join(', ')}.</span></div>
        </div>
      ))}
    </div>
  );
}

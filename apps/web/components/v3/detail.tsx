// Server-safe rendering blocks shared by the drill-down and My View Tab 1 —
// built entirely from the approved design system: .hero/.idxcard/.bignum/.lvl,
// .subrow spectrum bars, .row .card grids, .insitem insight list, .pritem recs.

import type { IndexDailyRow, InsightRow, KpiDailyRow, RecommendationRow } from '@prism/contract';
import { DIMENSION_HUES } from '@/app/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHANNEL_LABEL, CHANNEL_TAG2, V3BandChip, V3ConfidenceChip } from './chips';

const DIM_LABELS: Record<string, string> = { usage: 'Usage', efficiency: 'Efficiency', outcomes: 'Outcomes' };
const DIM_HUES: Record<string, string> = {
  usage: DIMENSION_HUES.usage,
  efficiency: DIMENSION_HUES.efficiency,
  outcomes: DIMENSION_HUES.effectiveness,
};

export function IndexHero({ main, harness }: { main: IndexDailyRow | null; harness: IndexDailyRow | null }) {
  return (
    <div className="hero" style={{ gridTemplateColumns: '300px 1fr', marginBottom: 0 }}>
      {/* MAIN index — the v1 .idxcard treatment */}
      <div className="card idxcard">
        <div>
          <div className="eyebrow">Main index · usage 15 · efficiency 35 · outcomes 50</div>
          <div className="bignum">
            {main?.score === null || !main ? '—' : main.score.toFixed(1)}
            <span> /100</span>
          </div>
        </div>
        <div className="lvl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <V3BandChip band={main?.band ?? null} />
            {main ? <V3ConfidenceChip confidence={main.confidence} suppressed={main.score === null} /> : null}
          </span>
          {main?.gates.l0_forced ? (
            <span>gate: <b>AI share &lt; 15% forces L0 · Dormant</b></span>
          ) : null}
          {main?.gates.l5_capped ? (
            <span>gate: <b>L5 capped — no multiplier signal</b></span>
          ) : null}
          {(main?.gates.multiplier_signal ?? 0) > 0 ? (
            <span>multiplier signal <b>×{main!.gates.multiplier_signal}</b> — AI Leaders recognition</span>
          ) : null}
        </div>
      </div>

      {/* dimensions + the separate HARNESS index */}
      <div className="card spectrum">
        {(['usage', 'efficiency', 'outcomes'] as const).map((d) => {
          const v = main?.dimensions?.[d] ?? null;
          return (
            <div className="subrow" key={d}>
              <span className="lab">
                <i style={{ background: DIM_HUES[d] }} />
                {DIM_LABELS[d]}
              </span>
              <span className="track">
                <i style={{ width: `${Math.max(2, v ?? 0)}%`, background: DIM_HUES[d] }} />
              </span>
              <span className="subval"><b>{v === null ? '—' : v.toFixed(1)}</b></span>
            </div>
          );
        })}
        <div className="subrow" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
          <span className="lab">
            <i style={{ background: 'var(--prof)' }} />
            Harness
            <small>separate index · no bands</small>
          </span>
          <span className="track">
            <i style={{ width: `${Math.max(2, harness?.score ?? 0)}%`, background: 'var(--prof)' }} />
          </span>
          <span className="subval">
            <b>{harness?.score === null || !harness ? '—' : harness.score.toFixed(1)}</b>
          </span>
        </div>
        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
          The HARNESS index (skills · verification · review loop · continuity) never mixes into the
          main number — the 🔗 linkage engine ties gaps here to the main-index damage they cause.
          {harness?.score === null ? ' Currently suppressed: insufficient signal (honest null, never a fake 0).' : ''}
        </p>
      </div>
    </div>
  );
}

export function KpiGrid({ kpis, title, sub }: { kpis: KpiDailyRow[]; title: string; sub?: string }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h3>{title}</h3>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      <div className="row r3" style={{ marginBottom: 0 }}>
        {kpis.map((k) => (
          <div className="card tok" key={k.kpi_id} style={{ background: 'var(--panel2)' }}>
            <div className="cardhead" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13 }}>{k.kpi_id.replaceAll('_', ' ')}</h3>
              <span className="chiplist">
                {k.index_kind === 'diagnostic' ? <span className="chip">diagnostic</span> : null}
                {k.tier ? <span className="chip" style={{ color: 'var(--eff)' }}>{k.tier}</span> : null}
              </span>
            </div>
            <div className="bignum" style={{ fontSize: 34, margin: '2px 0 4px' }}>
              {k.score === null ? '—' : Math.round(k.score)}
            </div>
            <span className="unit">
              raw {k.raw_value === null ? 'no signal' : k.raw_value} · n={k.signal_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightList({ insights, title, sub }: { insights: InsightRow[]; title: string; sub?: string }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h3>{title}</h3>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      {insights.length === 0 ? (
        <EmptyState compact title="No confirmed insights" hint="nothing below target with a surviving hypothesis" />
      ) : (
        <div className="ins">
          {insights.map((i) => (
            <div className="insitem" key={i.id}>
              <span className="n">{i.hypothesis}</span>
              <span className="tx">
                <b>{i.title}</b>
                <small>{i.body}</small>
              </span>
              <span className={`tag2 ${CHANNEL_TAG2[i.channel] ?? 'usage'}`}>
                {i.kpi_id === 'linkage' ? '🔗 ' : ''}{CHANNEL_LABEL[i.channel] ?? i.channel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecList({ recs, title }: { recs: RecommendationRow[]; title: string }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h3>{title}</h3>
        <span className="sub">impact = (100 − score) × index weight</span>
      </div>
      {recs.length === 0 ? (
        <EmptyState compact title="No open recommendations" hint="every targeted KPI is at or near target" />
      ) : (
        <div className="prlist">
          {recs.map((r) => (
            <div className="pritem" key={r.id}>
              <span className={`prtag ${r.impact >= 40 ? 'bad' : r.impact >= 20 ? 'warn' : 'ok'}`}>
                #{r.rank} · {r.impact.toFixed(1)}
              </span>
              <span className="prbody">
                <b>{r.title}</b>
                <small>{r.rationale}</small>
                <span className="sug">
                  owner: {r.owner} · {CHANNEL_LABEL[r.channel] ?? r.channel} · targets {r.targets.join(', ')}
                </span>
              </span>
              <span className="szbadge">{r.channel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

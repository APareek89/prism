'use client';

// Team table — the v1 roster-table treatment (.mem/.av avatars, .idxmini scores,
// .chip list, standard table styles from globals.css). Sortable headers.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Band } from '@prism/contract';
import { ScoreCell, V3BandChip, V3ConfidenceChip } from './chips';
import { DIMENSION_HUES } from '@/app/tokens';

export interface TeamTableRow {
  id: string;
  handle: string;
  name: string;
  archetype: string;
  team: string;
  mainScore: number | null;
  band: Band | null;
  mainConfidence: number;
  l0Forced: boolean;
  l5Capped: boolean;
  multiplier: number;
  dimensions: Partial<Record<'usage' | 'efficiency' | 'outcomes', number | null>>;
  harnessScore: number | null;
  harnessConfidence: number;
  aiSharePct: number | null;
  insightCount: number;
  recCount: number;
}

type SortKey = 'name' | 'mainScore' | 'harnessScore' | 'aiSharePct' | 'insightCount';

const COLS: Array<{ key: SortKey | null; label: string }> = [
  { key: 'name', label: 'Developer' },
  { key: 'mainScore', label: 'Main index' },
  { key: null, label: 'Band' },
  { key: null, label: 'U / E / O' },
  { key: 'harnessScore', label: 'Harness index' },
  { key: 'aiSharePct', label: 'AI share' },
  { key: 'insightCount', label: 'Insights · Recs' },
];

const DIM_HUES: Record<string, string> = {
  usage: DIMENSION_HUES.usage,
  efficiency: DIMENSION_HUES.efficiency,
  outcomes: DIMENSION_HUES.effectiveness,
};

export function TeamTable({ rows }: { rows: TeamTableRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'mainScore', dir: -1 });

  const sorted = useMemo(() => {
    const val = (r: TeamTableRow) => r[sort.key];
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;                       // nulls sink regardless of direction
      if (bv === null) return -1;
      if (typeof av === 'string') return sort.dir * av.localeCompare(bv as string);
      return sort.dir * ((av as number) - (bv as number));
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  return (
    <table>
      <thead>
        <tr>
          {COLS.map((c) => (
            <th
              key={c.label}
              onClick={c.key ? () => toggle(c.key!) : undefined}
              style={c.key ? { cursor: 'pointer', userSelect: 'none' } : undefined}
              aria-sort={c.key === sort.key ? (sort.dir === -1 ? 'descending' : 'ascending') : undefined}
            >
              {c.label}
              {c.key === sort.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/v3/dev/${r.handle}`} className="mem" style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="av">{initials(r.name)}</span>
                <span>
                  <b>{r.name}</b>
                  <small>@{r.handle} · {r.archetype.replaceAll('_', ' ')}</small>
                </span>
              </Link>
            </td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ScoreCell score={r.mainScore} />
                <V3ConfidenceChip confidence={r.mainConfidence} suppressed={r.mainScore === null} />
              </span>
            </td>
            <td>
              <V3BandChip band={r.band} />
              {r.l0Forced ? <small className="muted2" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 3 }}>gate: AI share &lt;15%</small> : null}
              {r.l5Capped ? <small className="muted2" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 3 }}>capped: no multiplier</small> : null}
              {r.multiplier > 0 ? <small className="muted2" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 3 }}>multiplier ×{r.multiplier}</small> : null}
            </td>
            <td>
              <span style={{ display: 'flex', gap: 5 }}>
                {(['usage', 'efficiency', 'outcomes'] as const).map((d) => {
                  const v = r.dimensions[d];
                  return (
                    <span key={d} className="track" title={`${d}: ${v == null ? '—' : v.toFixed(1)}`} style={{ width: 34 }}>
                      {v != null ? <i style={{ width: `${Math.max(3, v)}%`, background: DIM_HUES[d] }} /> : null}
                    </span>
                  );
                })}
              </span>
            </td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ScoreCell score={r.harnessScore} />
                <V3ConfidenceChip confidence={r.harnessConfidence} suppressed={r.harnessScore === null} />
              </span>
            </td>
            <td className="trendcell">{r.aiSharePct === null ? '—' : `${r.aiSharePct.toFixed(0)}%`}</td>
            <td className="muted mono" style={{ fontSize: 12 }}>{r.insightCount} · {r.recCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

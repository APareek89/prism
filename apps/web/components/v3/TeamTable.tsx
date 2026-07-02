'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Band } from '@prism/contract';
import { BandChip, ConfidenceChip, ScoreCell } from './chips';

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
    <table className="v3-table">
      <thead>
        <tr>
          {COLS.map((c) => (
            <th key={c.label} className={c.key ? '' : 'nosort'} onClick={c.key ? () => toggle(c.key!) : undefined}>
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
              <Link href={`/v3/dev/${r.handle}`}>{r.name}</Link>
              <div className="v3-mut v3-small">@{r.handle} · {r.archetype.replaceAll('_', ' ')}</div>
            </td>
            <td>
              <ScoreCell score={r.mainScore} />{' '}
              <ConfidenceChip confidence={r.mainConfidence} suppressed={r.mainScore === null} />
            </td>
            <td>
              <BandChip band={r.band} />
              {r.l0Forced ? <div className="v3-mut v3-small">gate: AI share &lt; 15%</div> : null}
              {r.l5Capped ? <div className="v3-mut v3-small">capped: no multiplier</div> : null}
              {r.multiplier > 0 ? <div className="v3-mut v3-small">multiplier ×{r.multiplier}</div> : null}
            </td>
            <td>
              <DimBars dims={r.dimensions} />
            </td>
            <td>
              <ScoreCell score={r.harnessScore} />{' '}
              <ConfidenceChip confidence={r.harnessConfidence} suppressed={r.harnessScore === null} />
            </td>
            <td className="v3-score">{r.aiSharePct === null ? '—' : `${r.aiSharePct.toFixed(0)}%`}</td>
            <td className="v3-mut">{r.insightCount} · {r.recCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DIM_HUES = { usage: '#5b8def', efficiency: '#2dd4bf', outcomes: '#f5a524' } as const;

function DimBars({ dims }: { dims: TeamTableRow['dimensions'] }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {(['usage', 'efficiency', 'outcomes'] as const).map((d) => {
        const v = dims[d];
        return (
          <div key={d} title={`${d}: ${v === null || v === undefined ? '—' : v.toFixed(1)}`}
            style={{ width: 34, height: 7, borderRadius: 4, background: '#1a2136', overflow: 'hidden' }}>
            {v !== null && v !== undefined ? (
              <div style={{ width: `${Math.max(3, v)}%`, height: '100%', background: DIM_HUES[d] }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// components/admin/IndexConfig.tsx
//
// The read-only, versioned Index-configuration table (Admin). Faithful port of the
// design's table: each row is a sub-index (a small colored square + label rendered via
// `.mem`), its weight in a `.trendcell`, and its floor→target anchor in a `.szbadge`.
// Rows are real IndexConfigRowDTO[] (the seeded index_config version); colors come from
// the typed DIMENSION_HUES token source. EmptyState-free by design: an empty config
// renders just the header so the versioned shell still reads.
//
// Server Component (pure presentation of versioned config).

import type { IndexConfigRowDTO } from '@/lib/ui/view-models';
import { DIMENSION_HUES } from '@/app/tokens';

export interface IndexConfigProps {
  rows: IndexConfigRowDTO[];
}

export function IndexConfig({ rows }: IndexConfigProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Sub-index</th>
          <th>Weight</th>
          <th>Anchors (floor → target)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.dimension}>
            <td>
              <span className="mem">
                <i
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: DIMENSION_HUES[row.dimension],
                    display: 'inline-block',
                  }}
                />
                &nbsp; {row.label}
              </span>
            </td>
            <td className="trendcell">{row.weightPct}%</td>
            <td className="szbadge">{row.anchorLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

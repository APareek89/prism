'use client';

// Configure tab — the whole model rendered FROM the DB (v3.kpi_catalog +
// v3.data_points + the active v3.config_versions row).
//   · edit weights inline
//   · delete (disable) a KPI → proportional redistribution within its index
//     (engine's disableKpi — the same pure function the tests cover)
//   · Save → POST /api/v3/config → NEW config_versions row → engine recompute →
//     "recomputed with config vN" chip; dashboards read the new version.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DataPointRow, IndexConfig, KpiCatalogRow, KpiId } from '@prism/contract';
import { disableKpi, enableKpi } from '@prism/engine';

interface Props {
  catalog: KpiCatalogRow[];
  dataPoints: DataPointRow[];
  activeVersion: number;
  activeNote: string;
  initialConfig: IndexConfig;
  asOf: string | null;
}

const TAG_ICON: Record<string, string> = { now: '✅', setup: '🔧', est: '📐', no: '🚫' };

export function ConfigureTable({ catalog, dataPoints, activeVersion, activeNote, initialConfig, asOf }: Props) {
  const [config, setConfig] = useState<IndexConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const pointsById = useMemo(() => new Map(dataPoints.map((p) => [p.id, p])), [dataPoints]);
  const sums = useMemo(() => {
    const sum = (index: 'main' | 'harness') =>
      catalog
        .filter((k) => k.index_kind === index && !config.disabled.includes(k.kpi_id))
        .reduce((a, k) => a + (config.weights[k.kpi_id] ?? 0), 0);
    return { main: sum('main'), harness: sum('harness') };
  }, [catalog, config]);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(initialConfig), [config, initialConfig]);
  const sumsOk = Math.abs(sums.main - 100) < 0.51 && Math.abs(sums.harness - 100) < 0.51;

  const setWeight = (kpiId: KpiId, w: number) =>
    setConfig((c) => ({ ...c, weights: { ...c.weights, [kpiId]: w } }));

  const remove = (kpiId: KpiId) => setConfig((c) => disableKpi(catalog, c, kpiId));
  const restore = (kpiId: KpiId) => {
    const defaults: Record<string, number> = {
      ai_share: 7.5, cadence: 7.5, iterations: 17.5, tokens: 17.5, revert: 25, rework: 25,
      skills_authored: 25, verification: 25, review_loop: 25, continuity: 25,
    };
    setConfig((c) => enableKpi(catalog, c, kpiId, defaults[kpiId] ?? 10));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v3/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, note: 'Configure tab save' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const out = (await res.json()) as { version: number };
      setFlash(`✓ Saved & recomputed with config v${out.version}`);
      setTimeout(() => setFlash(null), 6000);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const renderRows = (index: 'main' | 'harness' | 'diagnostic') =>
    catalog.filter((k) => k.index_kind === index).map((k) => {
      const isDisabled = config.disabled.includes(k.kpi_id);
      const weight = config.weights[k.kpi_id];
      return (
        <tr key={k.kpi_id} className={isDisabled ? 'v3-row-disabled' : ''}>
          <td><b>{k.num}</b></td>
          <td>
            <b>{k.name}</b>
            <div className="v3-mut v3-small">{k.question}</div>
          </td>
          <td className="v3-mut v3-small">{k.index_kind}<br />{k.dimension}</td>
          <td>
            <div className="v3-inputs-list">
              {k.data_point_ids.map((id) => {
                const p = pointsById.get(id);
                return <div key={id}>{TAG_ICON[p?.fetch_tag ?? 'now']} {p?.name ?? id}</div>;
              })}
            </div>
          </td>
          <td className="v3-small" style={{ maxWidth: 330, lineHeight: 1.5 }}>{k.formula_text}</td>
          <td>
            {index === 'diagnostic' ? (
              <span className="v3-chip tier">tier-badged · unweighted</span>
            ) : isDisabled ? (
              <span className="v3-chip bad">deleted</span>
            ) : (
              <input
                className="v3-winput"
                type="number" min={0} max={100} step={0.5}
                value={weight ?? 0}
                onChange={(e) => setWeight(k.kpi_id, Number(e.target.value))}
                aria-label={`weight for ${k.name}`}
              />
            )}
          </td>
          <td>
            {index === 'diagnostic' ? null : isDisabled ? (
              <button className="v3-btn" onClick={() => restore(k.kpi_id)}>Restore</button>
            ) : (
              <button className="v3-btn" onClick={() => remove(k.kpi_id)}>Delete</button>
            )}
          </td>
        </tr>
      );
    });

  const head = (
    <tr>
      <th className="nosort">#</th><th className="nosort">KPI</th><th className="nosort">Index · dim</th>
      <th className="nosort">Input data points</th><th className="nosort">Calculation logic</th>
      <th className="nosort">Weight</th><th className="nosort" />
    </tr>
  );

  return (
    <>
      <div className="v3-panel">
        <h2>
          MAIN index — Core-6
          <span className="hint">active: config v{activeVersion} ({activeNote}) · as-of {asOf ?? '—'}</span>
        </h2>
        <table className="v3-table"><thead>{head}</thead><tbody>{renderRows('main')}</tbody></table>
        <div className="v3-sumline">
          Main weights sum: <b className={Math.abs(sums.main - 100) < 0.51 ? 'ok' : 'err'}>{sums.main.toFixed(1)}</b> / 100
        </div>
      </div>

      <div className="v3-panel">
        <h2>HARNESS index — separate, own confidence, no bands</h2>
        <table className="v3-table"><thead>{head}</thead><tbody>{renderRows('harness')}</tbody></table>
        <div className="v3-sumline">
          Harness weights sum: <b className={Math.abs(sums.harness - 100) < 0.51 ? 'ok' : 'err'}>{sums.harness.toFixed(1)}</b> / 100
        </div>
      </div>

      <div className="v3-panel">
        <h2>Diagnostics — scored, tier-badged, never weighted</h2>
        <table className="v3-table"><thead>{head}</thead><tbody>{renderRows('diagnostic')}</tbody></table>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="v3-btn primary" disabled={!dirty || !sumsOk || saving} onClick={save}>
          {saving ? 'Saving + recomputing…' : `Save as config v${activeVersion + 1} & recompute`}
        </button>
        {!sumsOk ? <span className="v3-chip bad">each index must sum to 100 before saving</span> : null}
        {!dirty ? <span className="v3-chip">no changes</span> : null}
        {error ? <span className="v3-chip bad">{error}</span> : null}
      </div>
      {flash ? <div className="v3-flash">{flash}</div> : null}
    </>
  );
}

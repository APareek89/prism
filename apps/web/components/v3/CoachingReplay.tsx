'use client';

// Simulated over-the-shoulder coaching stream: replays seeded v3.coaching_events
// on a timer so events "appear live". Clearly labeled SIMULATED. Rules C1–C6,
// intervention ladder Enrich → Coach → Flag → Block, outcome per event.

import { useEffect, useRef, useState } from 'react';
import type { CoachingEventRow } from '@prism/contract';

const INTERVENTION_STYLE: Record<string, { label: string; cls: string }> = {
  enrich: { label: 'Enrich', cls: 'good' },
  coach: { label: 'Coach', cls: 'warn' },
  flag: { label: 'Flag', cls: '' },
  block: { label: 'Block', cls: 'bad' },
};
const OUTCOME_STYLE: Record<string, string> = { acted: 'good', ignored: '', dismissed: 'bad' };
const TICK_MS = 2200;

export function CoachingReplay({ events }: { events: CoachingEventRow[] }) {
  const [visible, setVisible] = useState(1);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setVisible((v) => {
        if (v >= events.length) { setPlaying(false); return v; }
        return v + 1;
      });
    }, TICK_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, events.length]);

  const restart = () => { setVisible(1); setPlaying(true); };
  const shown = events.slice(0, visible);

  return (
    <div className="v3-panel">
      <h2>
        Over-the-shoulder coaching
        <span className="hint">SIMULATED REPLAY of the plugin&apos;s exported metadata — prompt text never leaves the machine</span>
      </h2>
      <p className="v3-mut v3-small" style={{ marginTop: 0 }}>
        Rules are need-gated (they fire only when YOUR KPI is below target), rate-capped ≤3/day,
        and private — managers only ever see anonymized themes.{' '}
        <button className="v3-btn" style={{ marginLeft: 8 }} onClick={restart}>
          {playing ? `Replaying… ${visible}/${events.length}` : '↻ Replay stream'}
        </button>
      </p>
      <div className="v3-coach-stream">
        {shown.length === 0 ? <div className="v3-empty">No coaching events seeded for this developer.</div> : null}
        {shown.map((e) => {
          const iv = INTERVENTION_STYLE[e.intervention] ?? { label: e.intervention, cls: '' };
          return (
            <div className="v3-coach-event" key={e.id}>
              <div className="v3-coach-rule">{e.rule_id}</div>
              <div className="v3-coach-msg">
                <span className={`v3-chip ${iv.cls}`}>{iv.label}</span>
                <span className={`v3-chip ${OUTCOME_STYLE[e.outcome] ?? ''}`}>{e.outcome}</span>
                <div style={{ marginTop: 5 }}>{e.message}</div>
                <div className="meta">
                  gate: {e.gate} · trigger: {e.trigger} · {new Date(e.ts).toUTCString().slice(0, 22)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

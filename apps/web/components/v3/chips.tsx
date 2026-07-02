// Shared v3 display chips (server-safe — no hooks).

import type { Band } from '@prism/contract';
import { BAND_LABELS } from '@prism/contract';

const BAND_BG: Record<Band, string> = {
  L0: '#39415a', L1: '#39415a', L2: '#22447e', L3: '#0f5a52', L4: '#6b4a10', L5: '#4a3a7e',
};
const BAND_FG: Record<Band, string> = {
  L0: '#aab3c9', L1: '#aab3c9', L2: '#8fb6ff', L3: '#4fe0cc', L4: '#ffca63', L5: '#c9b3ff',
};

export function BandChip({ band }: { band: Band | null }) {
  if (!band) return <span className="v3-chip">Insufficient</span>;
  return (
    <span className="v3-band" style={{ background: BAND_BG[band], color: BAND_FG[band] }}>
      {BAND_LABELS[band]}
    </span>
  );
}

export function ConfidenceChip({ confidence, suppressed }: { confidence: number; suppressed?: boolean }) {
  const cls = suppressed || confidence < 0.4 ? 'bad' : confidence < 0.7 ? 'warn' : 'good';
  const label = suppressed || confidence < 0.4 ? 'insufficient' : confidence < 0.7 ? 'low-confidence' : 'confident';
  return <span className={`v3-chip ${cls}`}>{label} · {confidence.toFixed(2)}</span>;
}

export function ScoreCell({ score }: { score: number | null }) {
  return <span className="v3-score">{score === null ? '—' : score.toFixed(1)}</span>;
}

export const CHANNEL_LABEL: Record<string, string> = {
  fix: 'Fix data first', nudge: 'In-flow nudge', rec: 'Recommendation', team: 'Team/process', org: 'Platform/admin',
};

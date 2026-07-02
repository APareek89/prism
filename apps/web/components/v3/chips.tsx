// v3 display chips — the v1 chip treatment (app/tokens.ts hues + the exact
// BandChip/ConfidenceChip styling) carrying the v3 model's band names.

import type { Band } from '@prism/contract';
import { BAND_COLORS } from '@/app/tokens';
import { ConfidenceChip } from '@/components/ui/ConfidenceChip';
import type { ConfidenceBand } from '@/lib/types';

/** v3.0 band names (spec §2) — same visual chip as v1's BandChip. */
const V3_BAND_LABELS: Record<Band, string> = {
  L0: 'L0 · Dormant',
  L1: 'L1 · Basic',
  L2: 'L2 · Productive',
  L3: 'L3 · Workflow',
  L4: 'L4 · Power',
  L5: 'L5 · Multiplier',
};

export function V3BandChip({ band }: { band: Band | null }) {
  if (!band) {
    return (
      <span style={chipStyle('var(--mut2)')} title="Suppressed — insufficient signal">
        —
      </span>
    );
  }
  const color = BAND_COLORS[band] ?? 'var(--mut2)';
  return (
    <span style={chipStyle(color)} title={V3_BAND_LABELS[band]}>
      {V3_BAND_LABELS[band]}
    </span>
  );
}

function chipStyle(color: string) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    color,
    border: `1px solid ${color}`,
    background: 'color-mix(in srgb, currentColor 12%, transparent)',
    fontFamily: 'var(--mono)',
    whiteSpace: 'nowrap' as const,
  };
}

/** Numeric engine confidence → the v1 ConfidenceChip bands (0.40 publish floor). */
export function confidenceBand(confidence: number, suppressed?: boolean): ConfidenceBand {
  if (suppressed || confidence < 0.4) return 'insufficient';
  if (confidence < 0.55) return 'low';
  if (confidence < 0.75) return 'medium';
  return 'high';
}

export function V3ConfidenceChip({ confidence, suppressed }: { confidence: number; suppressed?: boolean }) {
  return <ConfidenceChip band={confidenceBand(confidence, suppressed)} />;
}

export function ScoreCell({ score }: { score: number | null }) {
  return <span className="idxmini">{score === null ? '—' : score.toFixed(1)}</span>;
}

/** Channel → the .tag2 hue classes used by the v1 insight list. */
export const CHANNEL_TAG2: Record<string, string> = {
  fix: 'cost',       // fix-data-first — green (a corrected number is the win)
  nudge: 'eff',      // in-flow nudge — teal
  rec: 'usage',      // recommendation — blue
  team: 'effness',   // team/process — amber
  org: 'prof',       // platform/admin — violet
};

export const CHANNEL_LABEL: Record<string, string> = {
  fix: 'fix data first',
  nudge: 'in-flow nudge',
  rec: 'recommendation',
  team: 'team/process',
  org: 'platform/admin',
};

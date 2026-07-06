// lib/db/statement-derive.ts
//
// PURE derivations for the ROI statement v0 (docs/prd/2026-08-roi-statement-v0.md).
// No I/O, no clock, no LLM — takes already-fetched raw rows + a resolved window and
// returns the StatementDTO. This is the determinism boundary for the page: every
// number on the statement is computed here, from ingested evidence only. Nulls mean
// "awaiting signal" (denominator 0) — never a fabricated 0.
//
// Column truth (validated live against SUPABASE_DB_URL; migrations 0007/0008/0010/
// 0033/0034):
//   gh_prs(id, function_id, repo, number, title, is_merged, merged_at, reverted_at, ai_assisted)
//   pr_ai_link(pr_id, cc_session_id, method, confidence)   method ∈ pr_link|sha|branch|coauthor
//   cc_sessions(id, ts, source, tokens_in, tokens_out, linked_pr, repo)  source ∈ claude_code|codex

import type {
  StatementDTO,
  StatementShareDTO,
  StatementReliabilityDTO,
  StatementRevertCohortDTO,
  StatementTokensDTO,
  StatementDrilldownsDTO,
  StatementRevertRowDTO,
  StatementSessionRowDTO,
} from '@/lib/ui/view-models';

// ─────────────────────────────────────────────────────────────────────────────
// Raw row shapes (the exact subset of columns fetched by lib/db/statement.ts).
// Numeric columns may arrive as strings from PostgREST (numeric/bigint) → coerce.
// ─────────────────────────────────────────────────────────────────────────────

export interface RawPr {
  id: string;
  repo: string | null;
  number: number | string | null;
  title: string | null;
  is_merged: boolean;
  merged_at: string | null;
  reverted_at: string | null;
  ai_assisted: boolean;
}

export interface RawLink {
  pr_id: string;
  cc_session_id: string;
  method: string;
  confidence: number | string | null;
}

export interface RawSession {
  id: string;
  ts: string | null;
  source: string | null;
  tokens_in: number | string | null;
  tokens_out: number | string | null;
  linked_pr: string | null;
  repo: string | null;
}

/** An inclusive [since, end] calendar window (YYYY-MM-DD) with a day count. */
export interface StatementWindow {
  since: string;
  end: string;
  days: number;
}

export interface StatementInput {
  functionName: string;
  window: StatementWindow;
  /** Cosmetic stamp only (does not touch any number) — the page passes wall time. */
  generatedAtLabel: string;
  prs: RawPr[];
  links: RawLink[];
  sessions: RawSession[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Small vocab + coercion helpers
// ─────────────────────────────────────────────────────────────────────────────

const METHOD_META: Record<string, { label: string; rank: number }> = {
  pr_link: { label: 'first-party', rank: 4 },
  sha: { label: 'sha match', rank: 3 },
  branch: { label: 'branch', rank: 2 },
  coauthor: { label: 'co-author', rank: 1 },
};
function methodLabel(m: string): string {
  return METHOD_META[m]?.label ?? m;
}
function methodRank(m: string): number {
  return METHOD_META[m]?.rank ?? 0;
}

const SOURCE_META: Record<string, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
};
function sourceLabel(s: string): string {
  return SOURCE_META[s] ?? s;
}

/** The ≤14d revert-detector rule text (migration 0007: reverted_at set if reverted ≤14d). */
export const REVERT_RULE_TEXT =
  'A merge counts as “held up” if a revert landed within 14 days (≤14-day detector; GitHub-native revert linkage).';

/** The standing footer honesty line. */
export const HONESTY_LINE =
  'Every number is computed from ingested evidence; “awaiting signal” means we don’t know — Prism never fabricates.';

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
/**
 * The UTC calendar day (YYYY-MM-DD) of an ISO timestamp, or null. We normalize to UTC
 * (rather than slicing the raw string) because PostgREST returns timestamptz in the
 * connection's session zone — a +offset zone rolls an 18:30Z merge into the next day.
 * The scoring window is UTC (lib/scoring/window.ts), so both bounds AND labels must be
 * UTC for the numbers to be deterministic and the dates honest.
 */
function utcDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}
/** YYYY-MM-DD (UTC) for display, or "—" when null/invalid. */
function dateLabel(iso: string | null): string {
  return utcDate(iso) ?? '—';
}
/** UTC calendar day for window comparisons ('' when null/invalid). */
function dateOf(iso: string | null): string {
  return utcDate(iso) ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Window selection (bounded on BOTH ends by calendar day — reliable lexical compare
// on YYYY-MM-DD; correct for any as-of date, satisfies the spec's merged_at ≥ since).
// ─────────────────────────────────────────────────────────────────────────────

/** Merged PRs whose merge day falls within [since, end]. */
export function windowMergedPrs(prs: RawPr[], w: StatementWindow): RawPr[] {
  return prs.filter((p) => {
    if (!p.is_merged) return false;
    const d = dateOf(p.merged_at);
    return d !== '' && d >= w.since && d <= w.end;
  });
}

/** Sessions whose ts day falls within [since, end]. */
export function windowSessions(sessions: RawSession[], w: StatementWindow): RawSession[] {
  return sessions.filter((s) => {
    const d = dateOf(s.ts);
    return d !== '' && d >= w.since && d <= w.end;
  });
}

/** The strongest pr_ai_link per PR id (max method rank, then max confidence). */
function bestLinkByPr(links: RawLink[], prIds: Set<string>): Map<string, RawLink> {
  const best = new Map<string, RawLink>();
  for (const l of links) {
    if (!prIds.has(l.pr_id)) continue;
    const cur = best.get(l.pr_id);
    if (
      !cur ||
      methodRank(l.method) > methodRank(cur.method) ||
      (methodRank(l.method) === methodRank(cur.method) &&
        toNum(l.confidence) > toNum(cur.confidence))
    ) {
      best.set(l.pr_id, l);
    }
  }
  return best;
}

function sessionTokens(s: RawSession): number {
  return toNum(s.tokens_in) + toNum(s.tokens_out);
}
function sumTokens(ids: Set<string>, byId: Map<string, RawSession>): number {
  let t = 0;
  for (const id of ids) {
    const s = byId.get(id);
    if (s) t += sessionTokens(s);
  }
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Number 1 — AI-assisted share of shipped work
// ─────────────────────────────────────────────────────────────────────────────

export function deriveShare(
  prs: RawPr[],
  links: RawLink[],
  sessions: RawSession[],
  w: StatementWindow,
): StatementShareDTO {
  const win = windowMergedPrs(prs, w);
  const total = win.length;
  const aiPrs = win.filter((p) => p.ai_assisted);
  const aiPrCount = aiPrs.length;
  const sharePct = total === 0 ? null : Math.round((aiPrCount / total) * 100);

  // Evidence badge: attribute each linked window PR to its STRONGEST link method so
  // the per-method counts sum to the linked-PR total (e.g. "10 PRs linked: 9
  // first-party (0.99), 1 co-author (0.60)").
  const winPrIds = new Set(win.map((p) => p.id));
  const best = bestLinkByPr(links, winPrIds);
  const byMethod = new Map<string, { count: number; conf: number }>();
  for (const l of best.values()) {
    const e = byMethod.get(l.method) ?? { count: 0, conf: 0 };
    e.count += 1;
    e.conf = Math.max(e.conf, toNum(l.confidence));
    byMethod.set(l.method, e);
  }
  const methods = [...byMethod.entries()]
    .map(([method, v]) => ({
      method,
      label: methodLabel(method),
      confidence: round3(v.conf),
      prCount: v.count,
    }))
    .sort((a, b) => b.prCount - a.prCount || methodRank(b.method) - methodRank(a.method));

  // Per-tool session share over WINDOW sessions (source split, coverage honesty).
  const winSessions = windowSessions(sessions, w);
  const totalSessions = winSessions.length;
  const perToolMap = new Map<string, number>();
  for (const s of winSessions) {
    const src = s.source ?? 'claude_code';
    perToolMap.set(src, (perToolMap.get(src) ?? 0) + 1);
  }
  const perTool = [...perToolMap.entries()]
    .map(([source, sessionCount]) => ({
      source,
      label: sourceLabel(source),
      sessionCount,
      sharePct: totalSessions === 0 ? 0 : Math.round((sessionCount / totalSessions) * 100),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  // Gray slice: a tool that produced ZERO links but has window sessions in a repo that
  // shipped a window PR — "N codex sessions unattributed (no pr-link event)".
  const linkedSessionIds = new Set(links.map((l) => l.cc_session_id));
  const winPrRepos = new Set(win.map((p) => p.repo).filter((r): r is string => !!r));
  const unattributedTools = [];
  for (const source of perToolMap.keys()) {
    const srcWin = winSessions.filter((s) => (s.source ?? 'claude_code') === source);
    const producedLinks = srcWin.some((s) => linkedSessionIds.has(s.id));
    if (producedLinks) continue;
    const inPrRepos = srcWin.filter((s) => s.repo != null && winPrRepos.has(s.repo));
    if (inPrRepos.length > 0) {
      unattributedTools.push({ source, label: sourceLabel(source), sessionCount: inPrRepos.length });
    }
  }

  return {
    sharePct,
    aiPrCount,
    totalPrCount: total,
    linkedPrCount: best.size,
    methods,
    perTool,
    unattributedTools,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Number 2 — held up after merge: AI vs human baseline (always both)
// ─────────────────────────────────────────────────────────────────────────────

function cohort(rows: RawPr[]): StatementRevertCohortDTO {
  const total = rows.length;
  const reverted = rows.filter((p) => p.reverted_at != null).length;
  return {
    revertRatePct: total === 0 ? null : Math.round((reverted / total) * 100),
    reverted,
    total,
    smallSample: total > 0 && total < 5,
  };
}

export function deriveReliability(prs: RawPr[], w: StatementWindow): StatementReliabilityDTO {
  const win = windowMergedPrs(prs, w);
  return {
    ai: cohort(win.filter((p) => p.ai_assisted)),
    human: cohort(win.filter((p) => !p.ai_assisted)),
    ruleText: REVERT_RULE_TEXT,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Number 3 — tokens per shipped AI PR (tokens only)
// ─────────────────────────────────────────────────────────────────────────────

export function deriveTokens(
  prs: RawPr[],
  links: RawLink[],
  sessions: RawSession[],
  w: StatementWindow,
): StatementTokensDTO {
  const win = windowMergedPrs(prs, w);
  const aiPrs = win.filter((p) => p.ai_assisted);
  const aiPrIds = new Set(aiPrs.map((p) => p.id));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Headline: distinct sessions linked (ANY method) to window AI PRs ÷ window AI PRs.
  const headSessionIds = new Set<string>();
  for (const l of links) if (aiPrIds.has(l.pr_id)) headSessionIds.add(l.cc_session_id);
  const linkedTokens = sumTokens(headSessionIds, sessionById);
  const aiPrCount = aiPrs.length;
  const tokensPerAiPr = aiPrCount === 0 ? null : Math.round(linkedTokens / aiPrCount);

  // First-party only (method = 'pr_link') — the "shown for completeness" exact figure.
  const exactSessionIds = new Set<string>();
  const exactPrIds = new Set<string>();
  for (const l of links) {
    if (l.method === 'pr_link' && aiPrIds.has(l.pr_id)) {
      exactSessionIds.add(l.cc_session_id);
      exactPrIds.add(l.pr_id);
    }
  }
  const exactLinkedTokens = sumTokens(exactSessionIds, sessionById);
  const exactAiPrCount = exactPrIds.size;
  const tokensPerAiPrExact =
    exactAiPrCount === 0 ? null : Math.round(exactLinkedTokens / exactAiPrCount);

  // Unattributed context: window session tokens linked to NO PR at all (exploration).
  const linkedSessionIds = new Set(links.map((l) => l.cc_session_id));
  let unattributedTokens = 0;
  for (const s of windowSessions(sessions, w)) {
    if (!linkedSessionIds.has(s.id)) unattributedTokens += sessionTokens(s);
  }

  return {
    tokensPerAiPr,
    tokensPerAiPrExact,
    aiPrCount,
    exactAiPrCount,
    linkedTokens,
    exactLinkedTokens,
    unattributedTokens,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-downs (same page, below the fold, excluded from print)
// ─────────────────────────────────────────────────────────────────────────────

export function deriveDrilldowns(
  prs: RawPr[],
  links: RawLink[],
  sessions: RawSession[],
  w: StatementWindow,
): StatementDrilldownsDTO {
  const win = windowMergedPrs(prs, w);
  const winPrIds = new Set(win.map((p) => p.id));
  const best = bestLinkByPr(links, winPrIds);

  const windowPrs = [...win]
    .sort((a, b) => dateOf(b.merged_at).localeCompare(dateOf(a.merged_at)) || toNum(b.number) - toNum(a.number))
    .map((p) => {
      const link = best.get(p.id);
      return {
        number: toNum(p.number),
        repo: p.repo ?? '—',
        title: p.title ?? '(untitled)',
        mergedAtLabel: dateLabel(p.merged_at),
        aiAssisted: p.ai_assisted,
        methodLabel: link ? methodLabel(link.method) : '—',
        confidence: link ? round3(toNum(link.confidence)) : null,
      };
    });

  const reverts: StatementRevertRowDTO[] = [...win]
    .filter((p) => p.reverted_at != null)
    .sort((a, b) => dateOf(b.reverted_at).localeCompare(dateOf(a.reverted_at)))
    .map((p) => ({
      number: toNum(p.number),
      repo: p.repo ?? '—',
      title: p.title ?? '(untitled)',
      cohort: p.ai_assisted ? 'ai' : 'human',
      revertedAtLabel: dateLabel(p.reverted_at),
    }));

  // Sessions linked to window AI PRs, each labeled with its strongest linking method.
  const aiPrIds = new Set(win.filter((p) => p.ai_assisted).map((p) => p.id));
  const bestMethodBySession = new Map<string, string>();
  for (const l of links) {
    if (!aiPrIds.has(l.pr_id)) continue;
    const cur = bestMethodBySession.get(l.cc_session_id);
    if (cur === undefined || methodRank(l.method) > methodRank(cur)) {
      bestMethodBySession.set(l.cc_session_id, l.method);
    }
  }
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const linkedSessions: StatementSessionRowDTO[] = [...bestMethodBySession.keys()]
    .map((id) => ({ s: sessionById.get(id), method: bestMethodBySession.get(id)! }))
    .filter((x): x is { s: RawSession; method: string } => x.s !== undefined)
    .map(({ s, method }) => ({
      tsLabel: dateLabel(s.ts),
      source: s.source ?? 'claude_code',
      sourceLabel: sourceLabel(s.source ?? 'claude_code'),
      tokens: sessionTokens(s),
      methodLabel: methodLabel(method),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  return { windowPrs, reverts, linkedSessions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble — the single pure entry point lib/db/statement.ts calls.
// ─────────────────────────────────────────────────────────────────────────────

export function buildStatement(input: StatementInput): StatementDTO {
  const { window: w, prs, links, sessions } = input;
  return {
    header: {
      functionName: input.functionName,
      windowDays: w.days,
      windowLabel: `${w.days} days ending ${w.end}`,
      since: w.since,
      end: w.end,
      generatedAtLabel: input.generatedAtLabel,
    },
    share: deriveShare(prs, links, sessions, w),
    reliability: deriveReliability(prs, w),
    tokens: deriveTokens(prs, links, sessions, w),
    drilldowns: deriveDrilldowns(prs, links, sessions, w),
    honestyLine: HONESTY_LINE,
  };
}

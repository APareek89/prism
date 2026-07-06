// lib/connectors/link/select.ts
//
// PURE link-selection hardening for the AI→PR linker (handoff follow-up #1 and
// scoring-model §4/§10: "suppress coauthor when pr_link already covers a PR;
// de-dupe cwd-split sessions"). No I/O — ai-to-pr.ts assembles inputs and persists
// outputs; this module only decides.
//
// Two decisions live here:
//
//  1. canonicalizeSessions — a single Claude/Codex session ingested under multiple
//     cwd paths (worktrees, `cd` mid-session) produces multiple cc_sessions rows
//     sharing one session_id. Linking every duplicate row to the same PR inflates
//     per-PR session counts (the cartesian bug). We fold duplicates into ONE
//     canonical candidate per session_id: pr_refs are unioned, the best branch wins,
//     and only the canonical row emits links.
//
//  2. selectLinks — precision guard over scored (PR, session) pairs. A PR covered
//     by an EXACT identity link (pr_link: first-party assertion · sha: commit
//     identity) must not also accumulate weak `coauthor` links from every other
//     same-repo session — those are what cartesian-linked 22 of 50 dogfood links.
//     Weak links survive ONLY for PRs with no exact coverage (e.g. browser-opened
//     PRs), which is the honest fallback, clearly lower-confidence.

import { METHOD_CONFIDENCE, type LinkMethod, type PrRef } from './match-keys';

// ─────────────────────────────────────────────────────────────────────────────
// 1. cwd-split session de-duplication
// ─────────────────────────────────────────────────────────────────────────────

/** The slice of a cc_sessions row the canonicalizer needs. */
export interface SessionRowLite {
  rowId: string;
  sessionId: string | null;
  branch: string | null;
  prRefs: PrRef[];
}

/** One canonical link candidate (1 per session_id, however many rows exist). */
export interface CanonicalSession {
  /** the cc_sessions row that receives pr_ai_link rows + the linked_pr stamp. */
  rowId: string;
  sessionId: string | null;
  branch: string | null;
  /** union of pr-link refs across duplicate rows, deduped by repo#number. */
  prRefs: PrRef[];
  /** every folded row id (canonical first) — for audit + stale-stamp cleanup. */
  memberRowIds: string[];
}

/** A branch value that names a real feature branch (not null/''/HEAD/detached). */
function isRealBranch(b: string | null): boolean {
  if (b === null) return false;
  const v = b.trim().toLowerCase();
  return v !== '' && v !== 'head' && v !== 'detached';
}

/**
 * Fold cc_sessions rows into one canonical candidate per session_id. Rows with no
 * session_id cannot be proven duplicates, so each stays its own candidate. The
 * canonical row is the one contributing a REAL branch (else the first seen), so
 * branch matching keeps working after the fold.
 */
export function canonicalizeSessions(rows: readonly SessionRowLite[]): CanonicalSession[] {
  const byKey = new Map<string, CanonicalSession>();
  for (const row of rows) {
    const sid = row.sessionId?.trim() ?? '';
    const key = sid.length > 0 ? `sid:${sid}` : `row:${row.rowId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        rowId: row.rowId,
        sessionId: sid.length > 0 ? sid : null,
        branch: row.branch,
        prRefs: dedupeRefs(row.prRefs),
        memberRowIds: [row.rowId],
      });
      continue;
    }
    existing.memberRowIds.push(row.rowId);
    existing.prRefs = dedupeRefs([...existing.prRefs, ...row.prRefs]);
    // Prefer a real branch over HEAD/detached/null; on the first real branch found,
    // that row becomes the canonical receiver.
    if (isRealBranch(row.branch) && !isRealBranch(existing.branch)) {
      existing.branch = row.branch;
      existing.rowId = row.rowId;
      // keep canonical first in memberRowIds for readability.
      existing.memberRowIds = [
        row.rowId,
        ...existing.memberRowIds.filter((id) => id !== row.rowId),
      ];
    } else if (existing.branch === null && row.branch !== null) {
      existing.branch = row.branch;
    }
  }
  return Array.from(byKey.values());
}

function dedupeRefs(refs: readonly PrRef[]): PrRef[] {
  const out = new Map<string, PrRef>();
  for (const r of refs) {
    if (typeof r?.repo === 'string' && typeof r?.number === 'number' && Number.isFinite(r.number)) {
      out.set(`${r.repo.trim().toLowerCase()}#${r.number}`, r);
    }
  }
  return Array.from(out.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. weak-link suppression
// ─────────────────────────────────────────────────────────────────────────────

/** One scored (PR, session) pair, pre-selection. */
export interface ScoredLink {
  prId: string;
  sessionRowId: string;
  method: LinkMethod;
  confidence: number;
}

export interface SelectionResult {
  kept: ScoredLink[];
  /** dropped links, for the stats line + audit (never silently discarded). */
  suppressed: ScoredLink[];
}

/** Exact identity methods — coverage by one of these suppresses weak fallbacks. */
const EXACT_METHODS: ReadonlySet<LinkMethod> = new Set<LinkMethod>(['pr_link', 'sha']);

/**
 * Apply the precision rules to scored pairs:
 *   a. one link per (PR, session) pair — strongest method wins;
 *   b. a PR covered by an exact identity link keeps NO `coauthor` links
 *      (branch survives: it is an exact-key match, not a repo-wide guess).
 */
export function selectLinks(links: readonly ScoredLink[]): SelectionResult {
  const suppressed: ScoredLink[] = [];

  // a. strongest per (pr, session) pair.
  const byPair = new Map<string, ScoredLink>();
  for (const l of links) {
    const key = `${l.prId}${l.sessionRowId}`;
    const cur = byPair.get(key);
    if (!cur) {
      byPair.set(key, l);
    } else if (l.confidence > cur.confidence) {
      suppressed.push(cur);
      byPair.set(key, l);
    } else {
      suppressed.push(l);
    }
  }

  // b. coauthor suppression on exactly-covered PRs.
  const exactCovered = new Set<string>();
  for (const l of byPair.values()) {
    if (EXACT_METHODS.has(l.method)) exactCovered.add(l.prId);
  }
  const kept: ScoredLink[] = [];
  for (const l of byPair.values()) {
    if (l.method === 'coauthor' && exactCovered.has(l.prId)) suppressed.push(l);
    else kept.push(l);
  }

  // Stable, strongest-first ordering so downstream "first wins" choices are
  // deterministic (e.g. which PR a session's linked_pr points to).
  kept.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.prId.localeCompare(b.prId) ||
      a.sessionRowId.localeCompare(b.sessionRowId),
  );
  return { kept, suppressed };
}

/** Confidence for a method (re-exported convenience for callers building rows). */
export function methodConfidence(method: LinkMethod): number {
  return METHOD_CONFIDENCE[method];
}

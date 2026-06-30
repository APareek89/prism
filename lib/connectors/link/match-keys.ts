// lib/connectors/link/match-keys.ts
//
// PURE scoring for the AI→PR association (PRD §6, migration 0010 pr_ai_link).
// Given a merged PR and a candidate Claude Code session, decide whether they are the
// same unit of work and with what confidence + method. CORRELATIONAL only — this
// score is NEVER an input to the AI-Native Index; it powers the "this PR was
// AI-assisted" correlational badge.
//
// Three independent signals, strongest wins:
//   • sha       — a session SHA / linked merge_sha overlaps the PR's merge_sha.
//                 Strongest evidence (an exact commit identity). conf 0.95.
//   • branch    — the session's git branch equals the PR's head_ref. Strong, but a
//                 branch can be reused, so conf 0.80.
//   • coauthor  — a commit on the PR carries a Claude co-author trailer. Indicates AI
//                 authorship but not which session, so conf 0.60.
//
// No I/O, no DB — callers assemble candidates and feed them in.

import type { PrAiLinkRow } from '@/lib/types/db';

/** The link method, mirrors pr_ai_link.method ('branch'|'coauthor'|'sha'). */
export type LinkMethod = PrAiLinkRow['method'];

/** Confidence per method (PRD §6). sha > branch > coauthor. */
export const METHOD_CONFIDENCE: Record<LinkMethod, number> = {
  sha: 0.95,
  branch: 0.8,
  coauthor: 0.6,
};

/** A scored match between a PR and a session. null fields when no signal fired. */
export interface MatchScore {
  method: LinkMethod | null;
  confidence: number; // 0..1, 0 when no method matched
}

/** The minimal PR side of a match (the join keys only). */
export interface PrKeys {
  /** PR head branch (gh_prs.head_ref). */
  headRef: string | null | undefined;
  /** PR merge commit sha (gh_prs.merge_sha). */
  mergeSha: string | null | undefined;
  /** SHAs of commits on the PR that carry a Claude co-author trailer. */
  coauthorShas?: readonly string[];
}

/** The minimal session side of a match (the join keys only). */
export interface SessionKeys {
  /** session branch (cc_sessions.branch). */
  branch: string | null | undefined;
  /** SHAs seen/produced in the session (e.g. linked commits), if any. */
  shas?: readonly string[];
  /** whether this session emitted a Claude co-author trailer on a commit. */
  hasCoauthorTrailer?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/** Lower-case + trim a branch ref for comparison; null/empty → null. */
function normBranch(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const v = ref.trim().toLowerCase();
  return v.length ? v : null;
}

/** Normalize a sha: trim, lower-case. Empty → null. (Prefixes compared separately.) */
function normSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  const v = sha.trim().toLowerCase();
  return v.length ? v : null;
}

/** Two SHAs match if one is a prefix of the other (handles short vs full SHAs). */
function shaEq(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 7 && long.startsWith(short);
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual signals
// ─────────────────────────────────────────────────────────────────────────────

/** True when the session branch equals the PR head_ref (case-insensitive). */
export function branchMatch(headRef: PrKeys['headRef'], sessionBranch: SessionKeys['branch']): boolean {
  const a = normBranch(headRef);
  const b = normBranch(sessionBranch);
  return a !== null && b !== null && a === b;
}

/** True when any session SHA overlaps the PR's merge_sha (prefix-aware). */
export function shaOverlap(prMergeSha: PrKeys['mergeSha'], sessionShas: SessionKeys['shas']): boolean {
  const target = normSha(prMergeSha);
  if (!target || !sessionShas || sessionShas.length === 0) return false;
  for (const raw of sessionShas) {
    const s = normSha(raw);
    if (s && shaEq(s, target)) return true;
  }
  return false;
}

/**
 * True when a Claude co-author trailer ties the session to the PR. Either the session
 * is flagged as having emitted one AND the PR carries co-author commits, or one of the
 * session's SHAs is among the PR's co-author commit SHAs.
 */
export function coauthorMatch(pr: PrKeys, session: SessionKeys): boolean {
  const prCoauthorShas = pr.coauthorShas ?? [];
  if (session.shas && prCoauthorShas.length > 0) {
    for (const raw of session.shas) {
      const s = normSha(raw);
      if (!s) continue;
      for (const c of prCoauthorShas) {
        const cs = normSha(c);
        if (cs && shaEq(s, cs)) return true;
      }
    }
  }
  // Fallback: the session emitted a trailer and the PR has co-authored commits.
  return Boolean(session.hasCoauthorTrailer) && prCoauthorShas.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined scorer — strongest method wins
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a (PR, session) pair. Returns the strongest matching method with its fixed
 * confidence, or { method: null, confidence: 0 } when nothing fired. Precedence:
 * sha > branch > coauthor.
 */
export function scoreMatch(pr: PrKeys, session: SessionKeys): MatchScore {
  if (shaOverlap(pr.mergeSha, session.shas)) {
    return { method: 'sha', confidence: METHOD_CONFIDENCE.sha };
  }
  if (branchMatch(pr.headRef, session.branch)) {
    return { method: 'branch', confidence: METHOD_CONFIDENCE.branch };
  }
  if (coauthorMatch(pr, session)) {
    return { method: 'coauthor', confidence: METHOD_CONFIDENCE.coauthor };
  }
  return { method: null, confidence: 0 };
}

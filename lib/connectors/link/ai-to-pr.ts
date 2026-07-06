// lib/connectors/link/ai-to-pr.ts
//
// The AI→PR link step (PRD §6, migration 0010 pr_ai_link). For every merged PR in the
// trailing ingest window, find candidate AI sessions (Claude Code + Codex — one store,
// cc_sessions) by pr_link / sha / branch / coauthor, score the strongest signal
// (lib/connectors/link/match-keys), harden the selection (lib/connectors/link/select:
// cwd-split de-dupe + weak-link suppression), RECONCILE stored links against the fresh
// set (stale links from earlier over-linking runs are deleted), and persist:
//   • pr_ai_link(pr_id, cc_session_id, method, confidence, function_id)
//   • gh_prs.ai_assisted = true for linked PRs / false for window PRs no longer linked
//   • cc_sessions.linked_pr = <pr id> for linked sessions (cleared when stale)
//
// CORRELATIONAL ONLY — this association never feeds the AI-Native Index; it powers the
// "AI-assisted" badge + the correlational lens. Writes via the SERVICE-ROLE client.
// Never throws the pipeline out — collects errors into the returned stats.

import { createAdminClient } from '@/lib/supabase/admin';
import { ingestWindow } from '@/lib/connectors/window';
import { scoreMatch, type LinkMethod, type PrKeys, type PrRef, type SessionKeys } from './match-keys';
import {
  canonicalizeSessions,
  selectLinks,
  type ScoredLink,
  type SessionRowLite,
} from './select';

// ─────────────────────────────────────────────────────────────────────────────
// Loose query surface (the generated Database has empty Tables)
// ─────────────────────────────────────────────────────────────────────────────

interface LooseResult extends Promise<{ data: unknown; error: { message?: string } | null }> {
  eq: (col: string, val: unknown) => LooseResult;
  gte: (col: string, val: unknown) => LooseResult;
  not: (col: string, op: string, val: unknown) => LooseResult;
  in: (col: string, vals: unknown[]) => LooseResult;
  select: (cols?: string) => LooseResult;
}
interface LooseTable {
  select: (cols: string) => LooseResult;
  update: (patch: unknown) => LooseResult;
  upsert: (rows: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => LooseResult;
  delete: () => LooseResult;
}
interface LooseAdmin {
  from: (table: string) => LooseTable;
}
function admin(): LooseAdmin {
  return createAdminClient() as unknown as LooseAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row shapes (only the columns we read)
// ─────────────────────────────────────────────────────────────────────────────

interface PrRow {
  id: string;
  repo: string;
  number: number;
  head_ref: string | null;
  merge_sha: string | null;
  merged_at: string | null;
}
interface SessionRow {
  id: string;
  session_id: string | null;
  repo: string | null;
  branch: string | null;
  linked_pr: string | null;
  /** jsonb array of {repo, number} from Claude Code `pr-link` events (migration 0033). */
  pr_refs: Array<{ repo?: string; number?: number }> | null;
}
interface CommitRow {
  pr_id: string | null;
  pr_number: number | null;
  repo: string;
  sha: string;
  coauthor_trailer: string | null;
}
interface ExistingLinkRow {
  id: string;
  pr_id: string;
  cc_session_id: string;
  method: LinkMethod;
}

/** Accounting for one link run. */
export interface LinkStats {
  prsConsidered: number;
  linksWritten: number;
  prsMarked: number;
  sessionsMarked: number;
  /** weak links dropped by the precision guard (select.ts). */
  linksSuppressed: number;
  /** previously-stored links removed because the fresh run no longer produces them. */
  staleLinksRemoved: number;
  /** window PRs un-marked (ai_assisted true → false) by reconciliation. */
  prsUnmarked: number;
  errors: string[];
}

function emptyStats(): LinkStats {
  return {
    prsConsidered: 0,
    linksWritten: 0,
    prsMarked: 0,
    sessionsMarked: 0,
    linksSuppressed: 0,
    staleLinksRemoved: 0,
    prsUnmarked: 0,
    errors: [],
  };
}

/** A Claude co-author trailer marks AI authorship (case-insensitive contains). */
function isClaudeCoauthor(trailer: string | null): boolean {
  if (!trailer) return false;
  const t = trailer.toLowerCase();
  return t.includes('claude') || t.includes('anthropic');
}

/** Composite pair key. \x1f escape, never a raw control byte (repo gotcha). */
function pairKey(prId: string, sessionRowId: string): string {
  return `${prId}\x1f${sessionRowId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// linkAiToPr
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute + persist AI→PR links for one function over the trailing 28-day ingest
 * window. Idempotent AND self-healing: the fresh selection is authoritative for the
 * window's PRs — links a previous (over-linking) run wrote that this run no longer
 * produces are deleted, and gh_prs.ai_assisted / cc_sessions.linked_pr are
 * reconciled to match. Never throws — errors are collected into the returned stats.
 */
export async function linkAiToPr(functionId: string, now: Date = new Date()): Promise<LinkStats> {
  const stats = emptyStats();
  const db = admin();
  const win = ingestWindow(now);

  // 1. Merged PRs in the window.
  let prs: PrRow[] = [];
  try {
    const { data, error } = await db
      .from('gh_prs')
      .select('id, repo, number, head_ref, merge_sha, merged_at')
      .eq('function_id', functionId)
      .eq('is_merged', true)
      .gte('merged_at', win.since);
    if (error) {
      stats.errors.push(`gh_prs read: ${error.message ?? 'unknown'}`);
      return stats;
    }
    prs = Array.isArray(data) ? (data as PrRow[]) : [];
  } catch (e) {
    stats.errors.push(`gh_prs read: ${e instanceof Error ? e.message : 'unknown'}`);
    return stats;
  }
  stats.prsConsidered = prs.length;
  if (prs.length === 0) return stats;
  const prIds = prs.map((p) => p.id);

  // 2. Candidate sessions for this function (Claude Code + Codex rows alike).
  let sessions: SessionRow[] = [];
  try {
    const { data, error } = await db
      .from('cc_sessions')
      .select('id, session_id, repo, branch, linked_pr, pr_refs')
      .eq('function_id', functionId);
    if (error) {
      stats.errors.push(`cc_sessions read: ${error.message ?? 'unknown'}`);
      return stats;
    }
    sessions = Array.isArray(data) ? (data as SessionRow[]) : [];
  } catch (e) {
    stats.errors.push(`cc_sessions read: ${e instanceof Error ? e.message : 'unknown'}`);
    return stats;
  }
  if (sessions.length === 0) return stats;

  // 3. Co-author commits for these PRs (for the coauthor signal). Best-effort.
  const coauthorShasByPr = new Map<string, string[]>();
  try {
    const { data, error } = await db
      .from('gh_commits')
      .select('pr_id, pr_number, repo, sha, coauthor_trailer')
      .eq('function_id', functionId)
      .in('pr_id', prIds);
    if (!error && Array.isArray(data)) {
      for (const c of data as CommitRow[]) {
        if (!c.pr_id || !isClaudeCoauthor(c.coauthor_trailer)) continue;
        const list = coauthorShasByPr.get(c.pr_id) ?? [];
        list.push(c.sha);
        coauthorShasByPr.set(c.pr_id, list);
      }
    }
  } catch {
    // Co-author signal is optional; branch/sha still work without it.
  }

  // 4. Canonicalize cwd-split duplicates (select.ts): ONE candidate per session_id,
  //    pr_refs unioned, best branch wins. Only the canonical row emits links.
  const lite: SessionRowLite[] = sessions.map((s) => {
    const prRefs: PrRef[] = [];
    for (const r of s.pr_refs ?? []) {
      if (typeof r?.repo === 'string' && typeof r?.number === 'number' && Number.isFinite(r.number)) {
        prRefs.push({ repo: r.repo, number: r.number });
      }
    }
    return { rowId: s.id, sessionId: s.session_id, branch: s.branch, prRefs };
  });
  const canonicals = canonicalizeSessions(lite).map((c) => ({
    ...c,
    knownRepos: new Set(
      c.prRefs
        .map((r) => (typeof r.repo === 'string' ? r.repo.trim().toLowerCase() : ''))
        .filter((r) => r.length > 0),
    ),
  }));

  // 5. Score every (PR, canonical session) pair. Precision guard (HARD project rule):
  //    pr_link is self-scoped (it names its own repo+number). The WEAKER
  //    branch/coauthor signals are NOT repo-aware on their own, so we only expose
  //    them for a session KNOWN (via its pr-link refs) to belong to THIS PR's repo.
  //    Codex sessions carry no pr_refs yet, so they are eligible for weak links only
  //    once repo evidence exists — missing a link is acceptable; a wrong one is not.
  const scored: ScoredLink[] = [];
  for (const pr of prs) {
    const prRepoNorm = (pr.repo ?? '').trim().toLowerCase();
    const prKeys: PrKeys = {
      ref: { repo: pr.repo, number: pr.number },
      headRef: pr.head_ref,
      mergeSha: pr.merge_sha,
      coauthorShas: coauthorShasByPr.get(pr.id) ?? [],
    };
    const prHasCoauthor = (coauthorShasByPr.get(pr.id)?.length ?? 0) > 0;
    for (const c of canonicals) {
      const repoScoped = prRepoNorm.length > 0 && c.knownRepos.has(prRepoNorm);
      const sessionKeys: SessionKeys = {
        prRefs: c.prRefs,
        branch: repoScoped ? c.branch : null,
        // The local-file session path has no commit SHAs; coauthor falls back to the
        // PR-side trailer presence. A SHA-bearing session (OTEL) would populate shas.
        shas: undefined,
        hasCoauthorTrailer: repoScoped && prHasCoauthor,
      };
      const match = scoreMatch(prKeys, sessionKeys);
      if (!match.method) continue;
      scored.push({
        prId: pr.id,
        sessionRowId: c.rowId,
        method: match.method,
        confidence: match.confidence,
      });
    }
  }

  // 6. Weak-link suppression (select.ts): a PR covered by an exact identity link
  //    (pr_link/sha) keeps no coauthor fallbacks — the over-linking fix.
  const { kept, suppressed } = selectLinks(scored);
  stats.linksSuppressed = suppressed.length;

  const linkedPrIds = new Set(kept.map((l) => l.prId));
  // kept is strongest-first, so the first PR seen per session is its best link.
  const sessionLinkedPr = new Map<string, string>();
  for (const l of kept) {
    if (!sessionLinkedPr.has(l.sessionRowId)) sessionLinkedPr.set(l.sessionRowId, l.prId);
  }

  // 7. RECONCILE stored links for the window's PRs against the fresh selection.
  //    Stale rows (pair no longer produced, or method changed) are deleted — this is
  //    what retro-fixes the earlier cartesian coauthor links.
  try {
    const { data, error } = await db
      .from('pr_ai_link')
      .select('id, pr_id, cc_session_id, method')
      .eq('function_id', functionId)
      .in('pr_id', prIds);
    if (error) {
      stats.errors.push(`pr_ai_link read: ${error.message ?? 'unknown'}`);
    } else {
      const freshMethod = new Map(kept.map((l) => [pairKey(l.prId, l.sessionRowId), l.method]));
      const staleIds = (Array.isArray(data) ? (data as ExistingLinkRow[]) : [])
        .filter((row) => freshMethod.get(pairKey(row.pr_id, row.cc_session_id)) !== row.method)
        .map((row) => row.id);
      if (staleIds.length > 0) {
        const { error: delError } = await db.from('pr_ai_link').delete().in('id', staleIds);
        if (delError) stats.errors.push(`pr_ai_link delete: ${delError.message ?? 'unknown'}`);
        else stats.staleLinksRemoved = staleIds.length;
      }
    }
  } catch (e) {
    stats.errors.push(`pr_ai_link reconcile: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // 8. Upsert the fresh links (idempotent on pr_id+cc_session_id).
  if (kept.length > 0) {
    const linkRows = kept.map((l) => ({
      function_id: functionId,
      pr_id: l.prId,
      cc_session_id: l.sessionRowId,
      method: l.method,
      confidence: l.confidence,
    }));
    try {
      const { error } = await db
        .from('pr_ai_link')
        .upsert(linkRows, { onConflict: 'pr_id,cc_session_id' });
      if (error) {
        stats.errors.push(`pr_ai_link upsert: ${error.message ?? 'unknown'}`);
        return stats;
      }
      stats.linksWritten = linkRows.length;
    } catch (e) {
      stats.errors.push(`pr_ai_link upsert: ${e instanceof Error ? e.message : 'unknown'}`);
      return stats;
    }
  }

  // 9. Reconcile gh_prs.ai_assisted for the window: true where linked, false where
  //    a previous run marked a PR that no longer links (ai_assisted is written only
  //    by this step, so the unmark is safe).
  if (linkedPrIds.size > 0) {
    try {
      const { error } = await db
        .from('gh_prs')
        .update({ ai_assisted: true })
        .in('id', [...linkedPrIds]);
      if (error) stats.errors.push(`gh_prs ai_assisted: ${error.message ?? 'unknown'}`);
      else stats.prsMarked = linkedPrIds.size;
    } catch (e) {
      stats.errors.push(`gh_prs ai_assisted: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
  const unlinkedPrIds = prIds.filter((id) => !linkedPrIds.has(id));
  if (unlinkedPrIds.length > 0) {
    try {
      const { error } = await db
        .from('gh_prs')
        .update({ ai_assisted: false })
        .in('id', unlinkedPrIds)
        .eq('ai_assisted', true);
      if (error) stats.errors.push(`gh_prs unmark: ${error.message ?? 'unknown'}`);
      else stats.prsUnmarked = unlinkedPrIds.length;
    } catch (e) {
      stats.errors.push(`gh_prs unmark: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // 10. Stamp cc_sessions.linked_pr on linked canonical rows; clear stale stamps on
  //     window-PR-pointing rows (incl. cwd-split duplicates) that no longer link.
  let sessionsMarked = 0;
  for (const [sessionRowId, prId] of sessionLinkedPr) {
    try {
      const { error } = await db
        .from('cc_sessions')
        .update({ linked_pr: prId })
        .eq('id', sessionRowId);
      if (error) stats.errors.push(`cc_sessions linked_pr (${sessionRowId}): ${error.message ?? 'unknown'}`);
      else sessionsMarked += 1;
    } catch (e) {
      stats.errors.push(`cc_sessions linked_pr (${sessionRowId}): ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
  stats.sessionsMarked = sessionsMarked;

  const windowPrIdSet = new Set(prIds);
  const staleStamped = sessions.filter(
    (s) =>
      !sessionLinkedPr.has(s.id) && // rows just (re)stamped above are never cleared
      s.linked_pr !== null &&
      windowPrIdSet.has(s.linked_pr),
  );
  for (const s of staleStamped) {
    try {
      const { error } = await db.from('cc_sessions').update({ linked_pr: null }).eq('id', s.id);
      if (error) stats.errors.push(`cc_sessions unstamp (${s.id}): ${error.message ?? 'unknown'}`);
    } catch (e) {
      stats.errors.push(`cc_sessions unstamp (${s.id}): ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  return stats;
}

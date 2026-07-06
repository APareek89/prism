// lib/connectors/link/select.test.ts
//
// The link-selection hardening rules (handoff follow-up #1): cwd-split session
// de-duplication + weak-link suppression. Pure fixtures only (never seeded to DB).

import { describe, expect, it } from 'vitest';
import { canonicalizeSessions, selectLinks, type ScoredLink, type SessionRowLite } from './select';
import { METHOD_CONFIDENCE } from './match-keys';

function link(prId: string, sessionRowId: string, method: ScoredLink['method']): ScoredLink {
  return { prId, sessionRowId, method, confidence: METHOD_CONFIDENCE[method] };
}

describe('canonicalizeSessions', () => {
  it('folds cwd-split duplicates (same session_id, different repo rows) into one candidate', () => {
    const rows: SessionRowLite[] = [
      {
        rowId: 'row-a',
        sessionId: 'sess-1',
        branch: 'HEAD',
        prRefs: [{ repo: 'acme/app', number: 7 }],
      },
      {
        rowId: 'row-b',
        sessionId: 'sess-1',
        branch: 'feat/login',
        prRefs: [{ repo: 'acme/app', number: 7 }, { repo: 'acme/app', number: 9 }],
      },
    ];
    const out = canonicalizeSessions(rows);
    expect(out).toHaveLength(1);
    const c = out[0]!;
    // the row with a REAL branch becomes canonical; HEAD loses.
    expect(c.rowId).toBe('row-b');
    expect(c.branch).toBe('feat/login');
    // refs are unioned + deduped.
    expect(c.prRefs).toHaveLength(2);
    // both member rows are recorded (canonical first).
    expect(c.memberRowIds).toEqual(['row-b', 'row-a']);
  });

  it('keeps rows without a session_id as separate candidates (cannot prove duplication)', () => {
    const rows: SessionRowLite[] = [
      { rowId: 'r1', sessionId: null, branch: 'x', prRefs: [] },
      { rowId: 'r2', sessionId: '', branch: 'y', prRefs: [] },
      { rowId: 'r3', sessionId: 'sess-2', branch: null, prRefs: [] },
    ];
    expect(canonicalizeSessions(rows)).toHaveLength(3);
  });
});

describe('selectLinks', () => {
  it('suppresses coauthor links on a PR already covered by a pr_link (the cartesian fix)', () => {
    const scored = [
      link('pr-1', 'sess-a', 'pr_link'),
      link('pr-1', 'sess-b', 'coauthor'),
      link('pr-1', 'sess-c', 'coauthor'),
    ];
    const { kept, suppressed } = selectLinks(scored);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.method).toBe('pr_link');
    expect(suppressed).toHaveLength(2);
    expect(suppressed.every((l) => l.method === 'coauthor')).toBe(true);
  });

  it('suppresses coauthor on sha-covered PRs too (exact commit identity)', () => {
    const { kept } = selectLinks([link('pr-1', 's1', 'sha'), link('pr-1', 's2', 'coauthor')]);
    expect(kept.map((l) => l.method)).toEqual(['sha']);
  });

  it('keeps coauthor for PRs with no exact coverage (the honest fallback)', () => {
    const { kept, suppressed } = selectLinks([
      link('pr-1', 's1', 'pr_link'),
      link('pr-2', 's2', 'coauthor'),
    ]);
    expect(kept).toHaveLength(2);
    expect(suppressed).toHaveLength(0);
  });

  it('keeps branch links alongside exact coverage (branch is an exact-key match)', () => {
    const { kept } = selectLinks([link('pr-1', 's1', 'pr_link'), link('pr-1', 's2', 'branch')]);
    expect(kept.map((l) => l.method).sort()).toEqual(['branch', 'pr_link']);
  });

  it('dedupes a (pr, session) pair to the strongest method', () => {
    const { kept, suppressed } = selectLinks([
      link('pr-1', 's1', 'coauthor'),
      link('pr-1', 's1', 'pr_link'),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.method).toBe('pr_link');
    expect(suppressed).toHaveLength(1);
  });

  it('orders kept links strongest-first (deterministic downstream choices)', () => {
    const { kept } = selectLinks([
      link('pr-2', 's2', 'coauthor'),
      link('pr-1', 's1', 'pr_link'),
      link('pr-3', 's3', 'branch'),
    ]);
    expect(kept.map((l) => l.method)).toEqual(['pr_link', 'branch', 'coauthor']);
  });
});

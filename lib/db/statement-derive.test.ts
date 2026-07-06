import { describe, it, expect } from 'vitest';
import {
  buildStatement,
  deriveShare,
  deriveReliability,
  deriveTokens,
  deriveDrilldowns,
  windowMergedPrs,
  HONESTY_LINE,
  REVERT_RULE_TEXT,
  type RawPr,
  type RawLink,
  type RawSession,
  type StatementWindow,
} from './statement-derive';

// Fixtures live ONLY here (hard rule: no seeded/synthetic data in the DB). The window
// is [2026-06-01, 2026-06-28]; rows outside it must be excluded.
const W: StatementWindow = { since: '2026-06-01', end: '2026-06-28', days: 28 };

function pr(over: Partial<RawPr> & Pick<RawPr, 'id' | 'number'>): RawPr {
  return {
    repo: 'o/r',
    title: `PR ${over.number}`,
    is_merged: true,
    merged_at: '2026-06-10T00:00:00Z',
    reverted_at: null,
    ai_assisted: false,
    ...over,
  };
}

// p1,p2 = AI; p3,p4 = human; p2,p4 reverted. p5 pre-window, p6 post-window, p7 unmerged.
const PRS: RawPr[] = [
  pr({ id: 'p1', number: 1, ai_assisted: true, merged_at: '2026-06-10T00:00:00Z' }),
  pr({ id: 'p2', number: 2, ai_assisted: true, merged_at: '2026-06-12T00:00:00Z', reverted_at: '2026-06-20T00:00:00Z' }),
  pr({ id: 'p3', number: 3, ai_assisted: false, merged_at: '2026-06-15T00:00:00Z' }),
  pr({ id: 'p4', number: 4, ai_assisted: false, merged_at: '2026-06-18T00:00:00Z', reverted_at: '2026-06-25T00:00:00Z' }),
  pr({ id: 'p5', number: 5, ai_assisted: true, merged_at: '2026-05-30T00:00:00Z' }), // before
  pr({ id: 'p6', number: 6, ai_assisted: true, merged_at: '2026-07-01T00:00:00Z' }), // after
  pr({ id: 'p7', number: 7, ai_assisted: true, is_merged: false, merged_at: null }), // unmerged
];

const LINKS: RawLink[] = [
  { pr_id: 'p1', cc_session_id: 's1', method: 'pr_link', confidence: 0.99 },
  { pr_id: 'p1', cc_session_id: 's2', method: 'coauthor', confidence: 0.6 },
  { pr_id: 'p2', cc_session_id: 's3', method: 'coauthor', confidence: 0.6 },
];

function ses(over: Partial<RawSession> & Pick<RawSession, 'id'>): RawSession {
  return {
    ts: '2026-06-10T00:00:00Z',
    source: 'claude_code',
    tokens_in: 0,
    tokens_out: 0,
    linked_pr: null,
    repo: 'o/r',
    ...over,
  };
}

const SESSIONS: RawSession[] = [
  ses({ id: 's1', tokens_in: 1000, tokens_out: 500, linked_pr: 'p1' }), // 1500
  ses({ id: 's2', tokens_in: 2000, linked_pr: 'p1' }), // 2000
  ses({ id: 's3', tokens_in: 3000, linked_pr: 'p2' }), // 3000
  ses({ id: 's4', tokens_in: 500 }), // 500, unlinked exploration (in window)
  ses({ id: 's5', tokens_in: 9999, ts: '2026-05-20T00:00:00Z' }), // pre-window, unlinked
  ses({ id: 's6', tokens_in: 700, source: 'codex' }), // codex, unlinked, in a window-PR repo
];

describe('windowMergedPrs', () => {
  it('keeps only merged PRs whose merge day is within [since, end]', () => {
    const ids = windowMergedPrs(PRS, W).map((p) => p.id).sort();
    expect(ids).toEqual(['p1', 'p2', 'p3', 'p4']); // excludes p5 (before), p6 (after), p7 (unmerged)
  });
});

describe('deriveShare (number 1)', () => {
  const share = deriveShare(PRS, LINKS, SESSIONS, W);

  it('computes AI share over window merged PRs', () => {
    expect(share.totalPrCount).toBe(4);
    expect(share.aiPrCount).toBe(2);
    expect(share.sharePct).toBe(50);
  });

  it('attributes each linked PR to its strongest method; counts sum to linkedPrCount', () => {
    expect(share.linkedPrCount).toBe(2); // p1, p2
    const byMethod = Object.fromEntries(share.methods.map((m) => [m.method, m]));
    expect(byMethod.pr_link).toMatchObject({ prCount: 1, confidence: 0.99, label: 'first-party' });
    expect(byMethod.coauthor).toMatchObject({ prCount: 1, confidence: 0.6, label: 'co-author' });
    expect(share.methods.reduce((n, m) => n + m.prCount, 0)).toBe(share.linkedPrCount);
  });

  it('splits sessions per tool over the window', () => {
    const byTool = Object.fromEntries(share.perTool.map((t) => [t.source, t]));
    expect(byTool.claude_code!.sessionCount).toBe(4); // s1..s4
    expect(byTool.codex!.sessionCount).toBe(1); // s6
    expect(byTool.claude_code!.sharePct).toBe(80);
    expect(byTool.codex!.sharePct).toBe(20);
  });

  it('flags a tool that produced zero links but has window sessions in a window-PR repo', () => {
    expect(share.unattributedTools).toEqual([{ source: 'codex', label: 'Codex', sessionCount: 1 }]);
  });

  it('renders "awaiting signal" (null) when the denominator is 0', () => {
    const empty = deriveShare([], [], [], W);
    expect(empty.sharePct).toBeNull();
    expect(empty.methods).toEqual([]);
  });
});

describe('deriveReliability (number 2 — AI vs human, always both)', () => {
  const rel = deriveReliability(PRS, W);

  it('scores both cohorts side by side', () => {
    expect(rel.ai).toMatchObject({ reverted: 1, total: 2, revertRatePct: 50 });
    expect(rel.human).toMatchObject({ reverted: 1, total: 2, revertRatePct: 50 });
    expect(rel.ruleText).toBe(REVERT_RULE_TEXT);
  });

  it('fires the small-sample flag when a cohort denominator is < 5', () => {
    expect(rel.ai.smallSample).toBe(true);
    expect(rel.human.smallSample).toBe(true);
  });

  it('renders "awaiting signal" for an empty cohort but always keeps both sides present', () => {
    const aiOnly: RawPr[] = [pr({ id: 'a', number: 1, ai_assisted: true })];
    const rel2 = deriveReliability(aiOnly, W);
    expect(rel2.human.total).toBe(0);
    expect(rel2.human.revertRatePct).toBeNull(); // awaiting, never absent
    expect(rel2.human.smallSample).toBe(false); // 0 is not a small sample, it's no signal
    expect(rel2.ai.revertRatePct).toBe(0);
  });
});

describe('deriveTokens (number 3 — tokens only)', () => {
  const tok = deriveTokens(PRS, LINKS, SESSIONS, W);

  it('headline = distinct linked-session tokens ÷ window AI PRs', () => {
    expect(tok.linkedTokens).toBe(6500); // s1(1500)+s2(2000)+s3(3000)
    expect(tok.aiPrCount).toBe(2);
    expect(tok.tokensPerAiPr).toBe(3250);
  });

  it('first-party figure uses only pr_link method links', () => {
    expect(tok.exactLinkedTokens).toBe(1500); // s1 only
    expect(tok.exactAiPrCount).toBe(1); // p1 only
    expect(tok.tokensPerAiPrExact).toBe(1500);
  });

  it('unattributed = in-window session tokens linked to no PR', () => {
    expect(tok.unattributedTokens).toBe(1200); // s4(500)+s6(700); s5 is pre-window
  });

  it('renders "awaiting signal" (null) when there are no AI PRs', () => {
    const humanOnly = PRS.filter((p) => !p.ai_assisted);
    const t2 = deriveTokens(humanOnly, [], SESSIONS, W);
    expect(t2.tokensPerAiPr).toBeNull();
    expect(t2.tokensPerAiPrExact).toBeNull();
  });
});

describe('deriveDrilldowns', () => {
  const d = deriveDrilldowns(PRS, LINKS, SESSIONS, W);

  it('lists window PRs newest-first with their strongest link', () => {
    expect(d.windowPrs.map((p) => p.number)).toEqual([4, 3, 2, 1]);
    const p1 = d.windowPrs.find((p) => p.number === 1)!;
    expect(p1).toMatchObject({ methodLabel: 'first-party', confidence: 0.99, aiAssisted: true });
    const p3 = d.windowPrs.find((p) => p.number === 3)!;
    expect(p3).toMatchObject({ methodLabel: '—', confidence: null });
  });

  it('lists reverts from both cohorts with the cohort tag', () => {
    expect(d.reverts.map((r) => [r.number, r.cohort])).toEqual([
      [4, 'human'],
      [2, 'ai'],
    ]);
  });

  it('lists sessions linked to window AI PRs, tokens desc, metadata only', () => {
    expect(d.linkedSessions.map((s) => s.tokens)).toEqual([3000, 2000, 1500]);
    const s1 = d.linkedSessions.find((s) => s.tokens === 1500)!;
    expect(s1.methodLabel).toBe('first-party');
    expect(Object.keys(s1)).toEqual(['tsLabel', 'source', 'sourceLabel', 'tokens', 'methodLabel']);
  });
});

describe('date normalization (UTC, tz-independent)', () => {
  it('labels a merge by its UTC day even when the source carries a +offset', () => {
    // 04:00 at +05:30 is 22:30 the previous UTC day — must render as 2026-06-10.
    const rows: RawPr[] = [
      pr({ id: 'z', number: 42, ai_assisted: true, merged_at: '2026-06-11T04:00:00+05:30' }),
    ];
    const d = deriveDrilldowns(rows, [], [], W);
    expect(d.windowPrs[0]!.mergedAtLabel).toBe('2026-06-10');
    // and it still falls inside the window by its UTC day
    expect(windowMergedPrs(rows, W).map((p) => p.id)).toEqual(['z']);
  });
});

describe('buildStatement', () => {
  const dto = buildStatement({
    functionName: 'My Engineering',
    window: W,
    generatedAtLabel: '2026-06-28 09:00 UTC',
    prs: PRS,
    links: LINKS,
    sessions: SESSIONS,
  });

  it('assembles the header, honesty line, and all three numbers', () => {
    expect(dto.header).toMatchObject({
      functionName: 'My Engineering',
      windowDays: 28,
      windowLabel: '28 days ending 2026-06-28',
      since: '2026-06-01',
      end: '2026-06-28',
    });
    expect(dto.honestyLine).toBe(HONESTY_LINE);
    expect(dto.share.sharePct).toBe(50);
    expect(dto.reliability.ai.total).toBe(2);
    expect(dto.tokens.tokensPerAiPr).toBe(3250);
  });

  it('contains no USD / dollar strings anywhere in the payload', () => {
    expect(JSON.stringify(dto)).not.toMatch(/\$|USD|dollar/i);
  });
});

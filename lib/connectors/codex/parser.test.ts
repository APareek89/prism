// lib/connectors/codex/parser.test.ts
//
// Pure-fixture tests for the Codex rollout parser (never seeded to DB). Fixtures
// mirror the documented rollout line shapes; the parser's format assumptions are
// listed in its header and re-verified against real logs at ship gate.

import { describe, expect, it } from 'vitest';
import { parseCodexRollout } from './parser';

const OPTS = { fallbackSessionId: 'rollout-stem', fallbackRepo: '/tmp/fallback' };

function lines(...objs: unknown[]): string {
  return objs.map((o) => JSON.stringify(o)).join('\n');
}

const META = {
  timestamp: '2026-07-06T09:00:00.000Z',
  type: 'session_meta',
  payload: {
    id: 'sess-uuid-1',
    timestamp: '2026-07-06T09:00:00.000Z',
    cwd: '/Users/dev/acme',
    git: { branch: 'feat/login', repository_url: 'https://github.com/acme/app.git' },
  },
};
const TURN_CTX = {
  timestamp: '2026-07-06T09:00:01.000Z',
  type: 'turn_context',
  payload: { cwd: '/Users/dev/acme', model: 'gpt-5-codex' },
};
const USER_MSG = {
  timestamp: '2026-07-06T09:00:02.000Z',
  type: 'response_item',
  payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'fix the login bug' }] },
};
const ASSISTANT_MSG = {
  timestamp: '2026-07-06T09:00:10.000Z',
  type: 'response_item',
  payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
};
function tokenCount(last: { input_tokens: number; cached_input_tokens: number; output_tokens: number }) {
  return {
    timestamp: '2026-07-06T09:00:11.000Z',
    type: 'event_msg',
    payload: { type: 'token_count', info: { last_token_usage: last } },
  };
}

describe('parseCodexRollout', () => {
  it('parses one rollout into a RawSession with Claude-compatible semantics', () => {
    const text = lines(
      META,
      TURN_CTX,
      USER_MSG,
      ASSISTANT_MSG,
      tokenCount({ input_tokens: 1000, cached_input_tokens: 400, output_tokens: 200 }),
      ASSISTANT_MSG,
      tokenCount({ input_tokens: 500, cached_input_tokens: 100, output_tokens: 100 }),
    );
    const out = parseCodexRollout(text, OPTS);
    expect(out).toHaveLength(1);
    const s = out[0]!;
    expect(s.sessionId).toBe('sess-uuid-1');
    expect(s.repo).toBe('/Users/dev/acme');
    expect(s.branch).toBe('feat/login');
    expect(s.model).toBe('gpt-5-codex');
    expect(s.turns).toBe(2);
    // header assumption #2: tokens_in excludes cache reads (gross − cached).
    expect(s.tokensIn).toBe(1000 + 500 - (400 + 100));
    expect(s.cacheRead).toBe(500);
    expect(s.tokensOut).toBe(300);
    expect(s.cacheCreation).toBe(0);
    expect(s.costUsd).toBe(0); // no Codex rate card — never estimated.
    expect(s.promptLenAvg).toBe('fix the login bug'.length);
    expect(s.prRefs).toEqual([]); // no pr-link event in Codex.
    expect(s.skillsUsed).toEqual([]);
    expect(s.ts).toBe('2026-07-06T09:00:00.000Z'); // earliest event time.
  });

  it('falls back to max cumulative totals when no per-turn usage exists', () => {
    const totals = (input: number, cached: number, output: number) => ({
      timestamp: '2026-07-06T09:00:11.000Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } },
      },
    });
    const out = parseCodexRollout(
      lines(META, ASSISTANT_MSG, totals(800, 300, 90), totals(1500, 600, 250)),
      OPTS,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.tokensIn).toBe(1500 - 600); // max cumulative wins, cached split out.
    expect(out[0]!.cacheRead).toBe(600);
    expect(out[0]!.tokensOut).toBe(250);
  });

  it('splits a mid-file cwd change into per-(session, repo) groups', () => {
    const ctx2 = {
      timestamp: '2026-07-06T09:05:00.000Z',
      type: 'turn_context',
      payload: { cwd: '/Users/dev/other', model: 'gpt-5-codex' },
    };
    const out = parseCodexRollout(lines(META, ASSISTANT_MSG, ctx2, ASSISTANT_MSG), OPTS);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.repo).sort()).toEqual(['/Users/dev/acme', '/Users/dev/other']);
    expect(out.every((s) => s.sessionId === 'sess-uuid-1')).toBe(true);
  });

  it('skips malformed lines and emits nothing for evidence-free input', () => {
    expect(parseCodexRollout('', OPTS)).toEqual([]);
    expect(parseCodexRollout('not json\n{"type":"session_meta"}', OPTS)).toEqual([]);
    // meta-only file (no turns/tokens/prompts) → no fabricated session row.
    expect(parseCodexRollout(lines(META, TURN_CTX), OPTS)).toEqual([]);
  });

  it('uses the filename stem when no session_meta id exists', () => {
    const out = parseCodexRollout(lines(TURN_CTX, ASSISTANT_MSG), OPTS);
    expect(out).toHaveLength(1);
    expect(out[0]!.sessionId).toBe('rollout-stem');
  });
});

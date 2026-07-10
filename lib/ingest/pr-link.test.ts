import { describe, it, expect } from 'vitest';
import { parsePrLinkPayload, parsePrUrl } from './pr-link';

describe('parsePrLinkPayload', () => {
  it('accepts a well-formed camelCase event', () => {
    const r = parsePrLinkPayload({ sessionId: 's1', repo: 'APareek89/prism', prNumber: 21 });
    expect(r).toEqual({
      ok: true,
      value: { sessionId: 's1', repo: 'APareek89/prism', prNumber: 21, sha: null, branch: null, accountUuid: null, source: 'claude_code_hook' },
    });
  });

  it('accepts snake_case + optional enrichment and a custom source', () => {
    const r = parsePrLinkPayload({ session_id: 's2', repo: 'o/r', pr_number: '7', sha: 'abc123', branch: 'feat/x', account_uuid: 'u-1', source: 'codex_hook' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ sessionId: 's2', prNumber: 7, sha: 'abc123', branch: 'feat/x', accountUuid: 'u-1', source: 'codex_hook' });
  });

  it('drops non-whitelisted fields (metadata-only guarantee)', () => {
    const r = parsePrLinkPayload({ sessionId: 's3', repo: 'o/r', prNumber: 1, prompt: 'secret user text', code: 'rm -rf /' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.value)).not.toMatch(/secret|rm -rf/);
  });

  it.each([
    [{ repo: 'o/r', prNumber: 1 }, 'sessionId is required'],
    [{ sessionId: 's', repo: 'not-a-repo', prNumber: 1 }, 'repo must be "owner/repo"'],
    [{ sessionId: 's', repo: 'o/r', prNumber: 0 }, 'prNumber must be a positive integer'],
    [{ sessionId: 's', repo: 'o/r', prNumber: -4 }, 'prNumber must be a positive integer'],
    [{ sessionId: 's', repo: 'o/r', prNumber: 'x' }, 'prNumber must be a positive integer'],
  ])('rejects %o', (body, err) => {
    const r = parsePrLinkPayload(body);
    expect(r).toEqual({ ok: false, error: err });
  });

  it('rejects non-object bodies', () => {
    expect(parsePrLinkPayload(null).ok).toBe(false);
    expect(parsePrLinkPayload('nope').ok).toBe(false);
  });
});

describe('parsePrUrl', () => {
  it('extracts owner/repo + number from a gh pr create URL line', () => {
    expect(parsePrUrl('https://github.com/APareek89/prism/pull/21\n')).toEqual({ repo: 'APareek89/prism', prNumber: 21 });
  });
  it('finds the URL embedded in noisier output', () => {
    expect(parsePrUrl('Created PR: https://github.com/o/r/pull/3 (draft)')).toEqual({ repo: 'o/r', prNumber: 3 });
  });
  it('returns null when there is no PR URL (e.g. a non-PR bash command)', () => {
    expect(parsePrUrl('https://github.com/o/r/commit/deadbeef')).toBeNull();
    expect(parsePrUrl('ls -la')).toBeNull();
  });
});

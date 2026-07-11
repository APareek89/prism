import { describe, it, expect } from 'vitest';
import { signState, verifyState } from './state';

const SECRET = 'test-secret-123';

describe('github install state (signed tenant round-trip)', () => {
  it('round-trips a function id', () => {
    expect(verifyState(signState('fn-abc', SECRET), SECRET)).toBe('fn-abc');
  });

  it('rejects a tampered function id', () => {
    const st = signState('fn-abc', SECRET);
    const tampered = `fn-evil${st.slice(st.indexOf('.'))}`;
    expect(verifyState(tampered, SECRET)).toBeNull();
  });

  it('rejects the wrong secret (another tenant can\'t forge it)', () => {
    expect(verifyState(signState('fn-abc', SECRET), 'other-secret')).toBeNull();
  });

  it('rejects malformed / plain markers', () => {
    expect(verifyState('prism-connect', SECRET)).toBeNull();
    expect(verifyState(null, SECRET)).toBeNull();
    expect(verifyState('no-dot', SECRET)).toBeNull();
    expect(verifyState('.onlymac', SECRET)).toBeNull();
  });
});

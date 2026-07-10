// app/auth/sign-in/SignInForm.tsx
//
// Sign in / create account (multi-tenant, M8 v2). Two modes:
//   • Sign in  → email + password (Supabase browser client).
//   • Create   → email + password + optional Organization name; calls the signUpAction
//                server action (invited email → join that org; org name → create a new
//                tenant), then signs in. Leave org blank if you were invited.
// Plus "Continue as demo user" in DEMO_MODE. Keyless-safe: nothing constructs the
// Supabase client until submit.

'use client';

import { useState } from 'react';
import { demoSignIn } from '@/lib/auth/demo-signin';
import { signUpAction } from '@/lib/auth/signup';
import { ROUTES } from '@/lib/config/constants';

type Mode = 'signin' | 'signup';

export function SignInForm({ demoMode }: { demoMode: boolean }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInThenGo() {
    const { createClient } = await import('@/lib/supabase/browser');
    const { error: e } = await createClient().auth.signInWithPassword({ email, password });
    if (e) throw e;
    window.location.assign(ROUTES.me); // full nav so middleware sees the session cookie
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const res = await signUpAction({ email, password, orgName });
        if (!res.ok) {
          setError(res.error ?? 'Could not create the account.');
          setWorking(false);
          return;
        }
      }
      await signInThenGo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setWorking(false);
    }
  }

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--line2)',
    background: 'var(--panel2)',
    color: 'var(--ink)',
    fontSize: 13.5,
    fontFamily: 'var(--body)',
  } as const;
  const labelStyle = { fontSize: 12.5, color: 'var(--mut)' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360 }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label htmlFor="email" style={labelStyle}>Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} />

        <label htmlFor="password" style={labelStyle}>Password</label>
        <input id="password" type="password" required minLength={6}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />

        {mode === 'signup' && (
          <>
            <label htmlFor="org" style={labelStyle}>Organization <span style={{ color: 'var(--mut2)' }}>— leave blank if you were invited</span></label>
            <input id="org" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Inc." style={inputStyle} />
          </>
        )}

        <button type="submit" disabled={working} style={{
          cursor: working ? 'wait' : 'pointer', padding: '12px 14px', marginTop: 4, minHeight: 44,
          borderRadius: 'var(--radius-sm)', border: 'none', background: '#5b8def', color: '#06122b',
          fontSize: 14, fontWeight: 700, fontFamily: 'var(--body)', opacity: working ? 0.7 : 1,
        }}>
          {working ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {error ? <p role="status" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</p> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--mut2)' }}>
        <span>{mode === 'signin' ? 'New here?' : 'Have an account?'}</span>
        <button type="button" disabled={working}
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: '#5b8def',
            fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--body)', textDecoration: 'underline' }}>
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </button>
      </div>

      {demoMode ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--mut2)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 11 }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <form action={demoSignIn}>
            <button type="submit" style={{
              width: '100%', cursor: 'pointer', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line2)', background: 'var(--panel2)', color: 'var(--ink)',
              fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--body)',
            }}>
              Continue as demo user
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}

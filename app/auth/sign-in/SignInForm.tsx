// app/auth/sign-in/SignInForm.tsx
//
// Email + password sign-in (+ "Create account"), plus a "Continue as demo user" button
// shown only in DEMO_MODE. Client component: it uses the anon browser client so the
// session lands in cookies the SSR server client + middleware can read. Keyless-safe —
// nothing constructs the Supabase client until the user submits.

'use client';

import { useState } from 'react';
import { demoSignIn } from '@/lib/auth/demo-signin';
import { ROUTES } from '@/lib/config/constants';

type Status = 'idle' | 'working' | 'sent' | 'error';

export function SignInForm({ demoMode }: { demoMode: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'signin' | 'signup') {
    setStatus('working');
    setMessage(null);
    try {
      const { createClient } = await import('@/lib/supabase/browser');
      const supabase = createClient();

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Session present ⇒ confirmation is off, we're in. Else an email was sent.
        if (data.session) {
          window.location.assign(ROUTES.me);
          return;
        }
        setStatus('sent');
        setMessage('Account created — check your email to confirm, then sign in.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Full navigation so middleware sees the fresh session cookie.
      window.location.assign(ROUTES.me);
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error ? err.message : 'Sign-in failed. Is Supabase configured?',
      );
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

  const working = status === 'working';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run('signin');
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <label htmlFor="email" style={{ fontSize: 12.5, color: 'var(--mut)' }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          style={inputStyle}
        />
        <label htmlFor="password" style={{ fontSize: 12.5, color: 'var(--mut)' }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={working}
          style={{
            cursor: working ? 'wait' : 'pointer',
            padding: '12px 14px',
            marginTop: 4,
            minHeight: 44,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            // Explicit hex (not the CSS var) so the primary CTA is guaranteed visible
            // regardless of stylesheet load order — it must never render as a dark slab.
            background: '#5b8def',
            color: '#06122b',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--body)',
            opacity: working ? 0.7 : 1,
          }}
        >
          {working ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--mut2)' }}>
        <span>New here?</span>
        <button
          type="button"
          disabled={working}
          onClick={() => void run('signup')}
          style={{
            cursor: working ? 'wait' : 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#5b8def',
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: 'var(--body)',
            textDecoration: 'underline',
          }}
        >
          Create an account
        </button>
      </div>

      {message ? (
        <p role="status" style={{ fontSize: 12.5, color: status === 'error' ? 'var(--bad)' : 'var(--good)' }}>
          {message}
        </p>
      ) : null}

      {demoMode ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--mut2)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 11 }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <form action={demoSignIn}>
            <button
              type="submit"
              style={{
                width: '100%',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line2)',
                background: 'var(--panel2)',
                color: 'var(--ink)',
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: 'var(--body)',
              }}
            >
              Continue as demo user
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}

// app/auth/sign-in/page.tsx
//
// Sign-in. Standalone, full-screen centered card — the app nav rail is hidden on /auth
// (see components/layout/Sidebar), so this is a clean auth surface, not the app shell.
// Server component: reads DEMO_MODE and renders the client form; the "Continue as demo
// user" button only appears in DEMO_MODE.

import { PrismLogo } from '@/components/brand/PrismLogo';
import { isDemoMode } from '@/lib/config/flags';
import { SignInForm } from './SignInForm';

export default function SignInPage() {
  const demoMode = isDemoMode();

  return (
    <div
      style={{
        minHeight: '100dvh',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <PrismLogo size={40} />
          <h1 className="display" style={{ fontSize: 21, fontWeight: 700, letterSpacing: 0.2 }}>
            Sign in to Prism
          </h1>
          <p style={{ fontSize: 12, color: 'var(--mut2)', fontFamily: 'var(--mono)' }}>
            One light · four signals
          </p>
        </div>
        <SignInForm demoMode={demoMode} />
      </div>
    </div>
  );
}

// app/v3/layout.tsx
//
// v3 preview section. Renders inside the standard AppShell (root layout) using the
// app's existing design system — no bespoke styling. Adds only the mandatory
// DEMO DATA banner (the approved `.note` treatment) above every v3 page.

import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function V3Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '16px 24px 0' }}>
        <div className="note" style={{ marginBottom: 0 }}>
          <h4>◤ DEMO DATA — v3.0 model preview</h4>
          <p>
            Everything below runs on a <b>deterministic synthetic dataset</b> (Postgres schema{' '}
            <b>v3</b>, 10 archetypal developers). No real employee data; the v1 app and public
            schema are untouched. Rebuild the identical world with <b>npm run v3:reset</b>.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

// app/admin/layout.tsx
//
// Admin chrome. Outside the (views) group so it has no period band. The page itself
// renders the MetaStrip (no period toggle) + AdminNav. Admin is fully interactive in
// M1/M2; M0 renders the structure + placeholder cards.

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</div>
    </AppShell>
  );
}

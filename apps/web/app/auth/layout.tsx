// app/auth/layout.tsx
//
// Auth pages keep the v1 AppShell chrome (it lived in the root layout before the
// /v3 preview needed a standalone shell).

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

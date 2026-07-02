// app/(views)/layout.tsx
//
// Layout for the data views (Function / Team / Team member). Each page owns its
// own `.top` header (view title + PeriodToggle) and `.main` frame. The AppShell
// (sidebar chrome) lives HERE rather than the root layout, so the /v3 preview
// can render its own standalone shell.

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function ViewsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

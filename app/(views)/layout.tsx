// app/(views)/layout.tsx
//
// Shared chrome for the four data views (Function / Team / Team member / My view).
// Each child page renders its own <MetaStrip title=… /> (which contains the
// PeriodToggle reading ?period=), because the title is view-specific. This layout
// provides the consistent scroll container + content padding around them.
//
// The PeriodToggle inside MetaStrip is wrapped in <Suspense> at the page level via the
// route's own loading.tsx; here we only own structure so the band stays sticky.

import type { ReactNode } from 'react';

export default function ViewsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</div>
  );
}

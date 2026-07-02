import type { ReactNode } from 'react';
import { activePin } from '@/lib/v3/read';
import { V3Nav } from '@/components/v3/Nav';
import './v3.css';

export const dynamic = 'force-dynamic';

export default async function V3Layout({ children }: { children: ReactNode }) {
  let versionLabel = 'v3 · not computed';
  try {
    const pin = await activePin();
    versionLabel = `config v${pin.version}${pin.date ? ` · as-of ${pin.date}` : ' · not computed'}`;
  } catch {
    versionLabel = 'v3 · database unavailable';
  }
  return (
    <div className="v3-root">
      <div className="v3-demo-banner">
        ◤ DEMO DATA — v3.0 preview on a deterministic synthetic dataset (schema `v3`, 10 archetypal
        developers). No real employee data. The v1 app and public schema are untouched.
      </div>
      <header className="v3-header">
        <div className="v3-logo">Prism <em>v3 preview</em></div>
        <V3Nav />
        <span className="v3-chip-version">{versionLabel}</span>
      </header>
      <main className="v3-main">{children}</main>
    </div>
  );
}

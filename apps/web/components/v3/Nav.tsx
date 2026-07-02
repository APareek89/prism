'use client';

// v3 section nav — the app's segmented control (.seg from globals.css), used the
// same way PeriodToggle uses it. Buttons (not links) because .seg styles buttons.

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/v3', label: 'Team' },
  { href: '/v3/me', label: 'My View' },
  { href: '/v3/configure', label: 'Configure' },
];

export function V3Nav() {
  const pathname = usePathname() ?? '/v3';
  const router = useRouter();
  const isActive = (href: string) =>
    href === '/v3' ? pathname === '/v3' || pathname.startsWith('/v3/dev') : pathname.startsWith(href);
  return (
    <nav className="seg" aria-label="v3 preview sections">
      {TABS.map((t) => (
        <button
          key={t.href}
          type="button"
          className={isActive(t.href) ? 'on' : ''}
          aria-current={isActive(t.href) ? 'page' : undefined}
          onClick={() => router.push(t.href)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

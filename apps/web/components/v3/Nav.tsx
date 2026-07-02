'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/v3', label: 'Team' },
  { href: '/v3/me', label: 'My View' },
  { href: '/v3/configure', label: 'Configure' },
];

export function V3Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/v3' ? pathname === '/v3' || pathname.startsWith('/v3/dev') : pathname.startsWith(href);
  return (
    <nav className="v3-nav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={isActive(t.href) ? 'active' : ''}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

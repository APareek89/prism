// components/layout/AdminNav.tsx
//
// Admin sub-nav (Connectors / Roster / Config / Sizing). Client component for active
// state. For M0 these are anchor tabs scrolling to sections of the single Admin page;
// full interactive wiring lands in M1/M2.

'use client';

const ADMIN_SECTIONS = [
  { id: 'connectors', label: 'Connectors' },
  { id: 'roster', label: 'Roster' },
  { id: 'config', label: 'Index config' },
  { id: 'sizing', label: 'Sizing' },
] as const;

export function AdminNav() {
  return (
    <nav
      aria-label="Admin sections"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        padding: '4px 0',
      }}
    >
      {ADMIN_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--mut)',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

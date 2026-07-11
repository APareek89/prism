// components/admin/MembersPanel.tsx
//
// Org roster: invite members by email + see who's invited/active (M8 v2 W3). Client
// island — reads/writes GET/POST /api/org/members (admin-gated). Invited members appear
// as "invited" until they self-register with that email and join this org.

'use client';

import { useCallback, useEffect, useState } from 'react';

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  status: 'invited' | 'active';
  match: string;
}

export function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/org/members', { cache: 'no-store' });
      const json = await res.json();
      setMembers(Array.isArray(json.members) ? json.members : []);
    } catch {
      /* leave list as-is */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const list = emails.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
      if (list.length === 0) {
        setMessage('Enter at least one valid email.');
        setBusy(false);
        return;
      }
      const res = await fetch('/api/org/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails: list }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? 'Could not add members.');
      } else {
        setMessage(`Invited ${json.added} member${json.added === 1 ? '' : 's'}.`);
        setEmails('');
        await load();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="cardhead">
        <h3>Members</h3>
        <span className="sub">invite by email · they self-register into this org</span>
      </div>

      <form onSubmit={invite} style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="alice@acme.com, bob@acme.com"
          aria-label="Member emails"
          style={{
            flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line2)', background: 'var(--panel2)', color: 'var(--ink)',
            fontSize: 13, fontFamily: 'var(--body)',
          }}
        />
        <button type="submit" disabled={busy} style={{
          cursor: busy ? 'wait' : 'pointer', padding: '9px 16px', borderRadius: 'var(--radius-sm)',
          border: 'none', background: '#5b8def', color: '#06122b', fontSize: 13, fontWeight: 700,
          fontFamily: 'var(--body)', opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {message ? <p style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 12 }}>{message}</p> : null}

      {members.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--mut2)', fontFamily: 'var(--mono)' }}>
          No members yet — invite teammates above.
        </p>
      ) : (
        <table>
          <thead>
            <tr><th>Member</th><th>Email</th><th>Status</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name ?? '—'}</td>
                <td className="mono">{m.email ?? '—'}</td>
                <td>
                  <span className={`stchip ${m.status === 'active' ? 'st-adopted' : 'st-ack'}`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// components/admin/RosterUpload.tsx
//
// The engineer-roster card body (Admin): the `.upload` dropzone for employees.csv plus
// the roster `table` mapping people to their data streams, with a `Match` column using
// AttributionBadge. Faithful port of the design's `.upload` + `table` markup.
//
// Client component because it owns the file input (drop / click to select). On pick/drop
// it POSTs the CSV (multipart `file`) to /api/connectors/employees/upload, which parses +
// idempotently provisions every row; on success it calls router.refresh() so the match
// table below re-renders with the freshly provisioned people.
//
// The table `rows` are real RosterMatchDTO[] fetched on the server and passed in; when
// empty the table renders just its header (no fabricated people).
//
// 'use client'

'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RosterMatchDTO } from '@/lib/ui/view-models';
import { AttributionBadge } from './AttributionBadge';

export interface RosterUploadProps {
  rows: RosterMatchDTO[];
}

export function RosterUpload({ rows }: RosterUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'busy' | 'ok' | 'err'; msg: string } | null>(null);

  function onPick() {
    inputRef.current?.click();
  }

  async function onFile(file: File | null) {
    setFileName(file?.name ?? null);
    if (!file) return;
    setStatus({ tone: 'busy', msg: `Uploading ${file.name}…` });
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/connectors/employees/upload', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        const errs = Array.isArray(data.errors) ? (data.errors as string[]).join('; ') : '';
        setStatus({ tone: 'err', msg: String(data.error ?? errs ?? `upload failed (${res.status})`) });
        return;
      }
      setStatus({
        tone: 'ok',
        msg: `provisioned ${data.provisioned ?? 0} (${data.created ?? 0} new, ${data.updated ?? 0} updated)`,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus({ tone: 'err', msg: e instanceof Error ? e.message : 'upload failed' });
    }
  }

  return (
    <>
      {/* hidden native input drives both click-to-upload and drop */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div
        className="upload"
        role="button"
        tabIndex={0}
        aria-label="Upload employees.csv"
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
        style={{ cursor: 'pointer' }}
      >
        ⭱ Drop <b>employees.csv</b> or click to upload
        <span className="mono">
          columns: name, designation, github_handle, email, claude_account_uuid
        </span>
        {status ? (
          <span
            className="mono"
            style={{
              color: status.tone === 'err' ? 'var(--warn)' : status.tone === 'ok' ? 'var(--good, #2e9e5b)' : 'var(--mut2)',
              marginTop: 8,
            }}
          >
            {fileName ? `${fileName} — ` : ''}
            {status.msg}
          </span>
        ) : null}
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Designation</th>
            <th>GitHub</th>
            <th>Email</th>
            <th>Claude account_uuid</th>
            <th>Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const initial = row.name.trim().charAt(0).toUpperCase() || '·';
            return (
              <tr key={`${row.name}-${i}`} className={row.you ? 'you' : undefined}>
                <td>
                  <div className="mem">
                    <span className={row.you ? 'av y' : 'av'}>{initial}</span>
                    <div>
                      <b>
                        {row.name}
                        {row.you ? ' (You)' : ''}
                      </b>
                    </div>
                  </div>
                </td>
                <td>{row.designation}</td>
                <td>{row.githubHandle ?? '—'}</td>
                <td>{row.email ?? '—'}</td>
                <td>
                  {row.claudeUuidMasked ?? (
                    <span style={{ color: 'var(--warn)' }}>unmatched</span>
                  )}
                </td>
                <td>
                  <AttributionBadge match={row.match} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// components/admin/RosterUpload.tsx
//
// The engineer-roster card body (Admin): the `.upload` dropzone for employees.csv plus
// the roster `table` mapping people to their data streams, with a `Match` column using
// AttributionBadge. Faithful port of the design's `.upload` + `table` markup.
//
// Client component because it owns the file input (drop / click to select). Accepting
// the CSV and POSTing it to the provisioning endpoint is deferred to M2 — for now the
// chosen file's name is shown with an explicit "parsing deferred to M2" note, so the
// affordance reads as real without fabricating a parse result.
//
// The table `rows` are real RosterMatchDTO[] fetched on the server and passed in; when
// empty the table renders just its header (no fabricated people).
//
// 'use client'

'use client';

import { useRef, useState } from 'react';
import type { RosterMatchDTO } from '@/lib/ui/view-models';
import { AttributionBadge } from './AttributionBadge';

export interface RosterUploadProps {
  rows: RosterMatchDTO[];
}

export function RosterUpload({ rows }: RosterUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onPick() {
    inputRef.current?.click();
  }

  function onFile(file: File | null) {
    // Accept the file (capture its name) but do not parse — provisioning is M2.
    setFileName(file?.name ?? null);
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
        {fileName ? (
          <span className="mono" style={{ color: 'var(--warn)', marginTop: 8 }}>
            {fileName} selected — parsing deferred to M2
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

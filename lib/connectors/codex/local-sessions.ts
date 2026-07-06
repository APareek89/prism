// lib/connectors/codex/local-sessions.ts
//
// Filesystem walk over CODEX_LOCAL_SESSIONS_DIR (default ~/.codex). Reads every
// **/*.jsonl rollout file READ-ONLY, parses each with the pure Codex parser, and
// dedupes across files by (sessionId, repo). Server-only (node:fs). Keyless-safe:
// missing/unreadable dir → empty list + a note, never a throw.
//
// Dedupe rule (differs from the Claude scan's cross-file SUM on purpose): a RESUMED
// Codex session writes a NEW rollout file that can replay the session's history, so
// summing across files would double-count tokens. When the same (sessionId, repo)
// appears in multiple files we keep the RICHEST single record (most gross tokens,
// then most turns) — an honest floor, never an inflated sum.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCodexRollout } from './parser';
import type { RawSession } from '@/lib/connectors/claude-code/parser';
import { expandHome } from '@/lib/connectors/claude-code/local-sessions';
import { makeSessionKey } from '@/lib/connectors/claude-code/byo';
import { serverEnv } from '@/lib/config/env';

/** Result of a local Codex scan (mirrors the Claude scan's shape). */
export interface CodexScanResult {
  sessions: RawSession[];
  filesScanned: number;
  dir: string;
  note: string | null;
}

/** The configured Codex dir (env or ~/.codex), home-expanded + absolute. */
export function codexSessionsDir(): string {
  const raw = serverEnv.CODEX_LOCAL_SESSIONS_DIR || '~/.codex';
  return path.resolve(expandHome(raw));
}

/** Recursively collect absolute paths of all *.jsonl files under `root`. Never throws. */
async function globJsonl(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable subtree — skip silently.
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
    }
  }
  await walk(root);
  return out;
}

/** Gross token volume of a session (for the richest-record dedupe). */
function volume(s: RawSession): number {
  return s.tokensIn + s.cacheRead + s.tokensOut;
}

/**
 * Walk the local Codex dir and return deduped RawSessions. READ-ONLY. Never throws —
 * a missing/empty dir yields an empty list and an explanatory note so the connector
 * reports a clean not-configured / empty state.
 */
export async function scanCodexSessions(): Promise<CodexScanResult> {
  const root = codexSessionsDir();
  // Rollouts live under <dir>/sessions/YYYY/MM/DD/; scan that subtree when present,
  // else the whole dir (older layouts / custom configs).
  const preferred = path.join(root, 'sessions');
  let dir = root;
  try {
    if ((await fs.stat(preferred)).isDirectory()) dir = preferred;
  } catch {
    // no sessions/ subdir — fall through to the root.
  }

  let exists = true;
  try {
    exists = (await fs.stat(dir)).isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) {
    return { sessions: [], filesScanned: 0, dir, note: `codex sessions dir not found: ${dir}` };
  }

  const files = await globJsonl(dir);
  const best = new Map<string, RawSession>();
  let scanned = 0;

  for (const file of files) {
    let text: string;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      continue; // unreadable file — skip.
    }
    scanned += 1;
    // Filename stem (rollout-<ts>-<uuid>) is only the fallback id; session_meta.id wins.
    const stem = path.basename(file, '.jsonl');
    const parsed = parseCodexRollout(text, { fallbackSessionId: stem, fallbackRepo: '' });
    for (const s of parsed) {
      if (!s.repo) continue; // a rollout with no observed cwd carries no repo evidence.
      const key = makeSessionKey(s.sessionId, s.repo);
      const prev = best.get(key);
      if (
        !prev ||
        volume(s) > volume(prev) ||
        (volume(s) === volume(prev) && s.turns > prev.turns)
      ) {
        best.set(key, s);
      }
    }
  }

  const sessions = Array.from(best.values()).sort((a, b) =>
    (b.ts ?? '').localeCompare(a.ts ?? ''),
  );

  return {
    sessions,
    filesScanned: scanned,
    dir,
    note: scanned === 0 ? `no .jsonl rollout files under ${dir}` : null,
  };
}

// lib/connectors/codex/index.ts
//
// CodexConnector — the second AI-agent source (owner decision 2026-07-06: Codex in
// Month 1; Cursor/Copilot gated on design-partner tool mix). Reads the user's LOCAL
// ~/.codex rollout .jsonl files (READ-ONLY), parses them with the pure Codex parser,
// and upserts cc_sessions with source='codex' through the SAME write layer Claude
// Code uses — one session store, per-tool provenance.
//
// CONTRACTS (identical to the Claude Code connector):
//   • Keyless-safe: CODEX_LOCAL_SESSIONS_DIR has a default (~/.codex); a missing dir
//     is a clean not-configured/empty state — nothing written, nothing thrown.
//   • No dummy data: only real parsed rollouts; an empty dir writes nothing.
//   • Single-person demo binds every session to the is_demo "self employee".
//   • HONESTY NOTE: Codex emits no first-party `pr-link` event, so its sessions link
//     to PRs only via the weaker branch/sha/coauthor methods (lower confidence —
//     surfaced as such by the link layer, never inflated).

import { isConfigured } from '@/lib/config/env';
import type { ConnectorStatus } from '@/lib/types/db';
import type { IngestResult } from '@/lib/types/connectors';
import { setStatus, touchLastSync, upsertConfig } from '@/lib/connectors/status';
import { scanCodexSessions as scanCodexSessionFiles, codexSessionsDir } from './local-sessions';
import { persistSessions } from '@/lib/connectors/claude-code/session-map';

const CONNECTOR_TYPE = 'codex' as const;

/** The connector's public API (mirrors ClaudeCodeConnectorApi). */
export interface CodexConnectorApi {
  /** Synchronous, env-only — never hits the FS or DB. */
  status(): ConnectorStatus;
  /** Walk local rollouts, parse, persist, and report a tally. Never throws. */
  scanCodexSessions(functionId: string): Promise<IngestResult>;
}

class CodexConnector implements CodexConnectorApi {
  status(): ConnectorStatus {
    // 'connected' means the local-file path is available (the dir has a default),
    // not that any rollout exists. An empty scan is a clean empty state.
    return isConfigured('codex') ? 'connected' : 'not_configured';
  }

  async scanCodexSessions(functionId: string): Promise<IngestResult> {
    const result: IngestResult = { type: CONNECTOR_TYPE, written: 0, skipped: 0, errors: [] };

    // Mark syncing (best-effort; never throws past the connector).
    await setStatus(functionId, CONNECTOR_TYPE, 'syncing');

    try {
      // 1) Walk + parse local rollout .jsonl files (READ-ONLY).
      const scan = await scanCodexSessionFiles();

      // 2) Persist with source='codex' (binds to the self employee, like Claude Code).
      const persisted = await persistSessions(functionId, scan.sessions, 'codex');
      result.written = persisted.written;
      result.skipped = persisted.skipped;
      result.errors.push(...persisted.errors);

      // 3) Surface scan metadata in the connector config.
      await upsertConfig(
        functionId,
        CONNECTOR_TYPE,
        {
          sessions_dir: scan.dir,
          files_scanned: scan.filesScanned,
          sessions_found: scan.sessions.length,
          scan_note: scan.note,
          // Standing caveat surfaced to Admin: weaker AI→PR link methods only.
          link_note: 'codex emits no pr-link event; links use branch/sha/coauthor (lower confidence)',
        },
        persisted.errors.length > 0 ? 'error' : 'connected',
      );

      // 4) Health: error if any write failed, else stamp last_sync_at.
      if (persisted.errors.length > 0) {
        await setStatus(functionId, CONNECTOR_TYPE, 'error', persisted.errors.join('; '));
      } else {
        await touchLastSync(functionId, CONNECTOR_TYPE);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(message);
      await setStatus(functionId, CONNECTOR_TYPE, 'error', message);
    }

    return result;
  }
}

/** The single shared instance. */
export const codexConnector: CodexConnectorApi = new CodexConnector();

/**
 * ENTRY POINT (pipeline). Walk the local ~/.codex rollout files, parse + persist
 * them as cc_sessions (source='codex') for `functionId`, and return an ingest tally.
 * Keyless-safe and non-throwing.
 */
export async function ingestCodex(functionId: string): Promise<IngestResult> {
  return codexConnector.scanCodexSessions(functionId);
}

/** Re-exports for the pipeline / tests. */
export { codexSessionsDir };

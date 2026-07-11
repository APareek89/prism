// lib/db/statement.ts
//
// Read module for the ROI statement v0 page (docs/prd/2026-08-roi-statement-v0.md).
// One exported getStatement(functionId, date) returns a single StatementDTO.
//
// This module ONLY fetches raw evidence rows (via the shared db() resolver:
// DEMO_MODE service-role / RLS in prod — see lib/db/_base.ts) and hands them to the
// pure lib/db/statement-derive.ts. It never computes a number itself — the
// determinism boundary lives in the derive layer. Empty DB ⇒ all-null DTO
// ("awaiting signal" everywhere), never fabricated values.

import type { StatementDTO } from '@/lib/ui/view-models';
import { resolveWindow } from '@/lib/scoring/window';
import { db, selectRows, selectOne, type DbReadFilter } from './_base';
import {
  buildStatement,
  type RawPr,
  type RawLink,
  type RawSession,
  type StatementWindow,
} from './statement-derive';

/**
 * The ROI statement for a function's trailing 28-day window ending on `date`.
 *
 * @param functionId  the function scope.
 * @param date        the as-of day (YYYY-MM-DD); the window is the trailing 28 days
 *                    ending here. Passed in — never a hidden clock — so the numbers
 *                    are deterministic (see lib/scoring/window.ts).
 * @param now         wall time, used ONLY for the cosmetic generated-at stamp.
 */
export async function getStatement(
  functionId: string,
  date: string,
  now: Date = new Date(),
): Promise<StatementDTO> {
  const compute = resolveWindow(date).compute;
  const window: StatementWindow = {
    since: compute.start,
    end: compute.end,
    days: compute.days,
  };

  const client = await db();

  const [fnRow, prs, links, sessions] = await Promise.all([
    selectOne(() =>
      client.from('functions').select('name').eq('id', functionId).maybeSingle(),
    ),
    selectRows(
      client
        .from('gh_prs')
        .select('id, repo, number, title, is_merged, merged_at, reverted_at, ai_assisted')
        .eq('function_id', functionId) as DbReadFilter,
    ),
    selectRows(
      client
        .from('pr_ai_link')
        .select('pr_id, cc_session_id, method, confidence')
        .eq('function_id', functionId) as DbReadFilter,
    ),
    selectRows(
      client
        .from('cc_sessions')
        .select('id, ts, source, tokens_in, tokens_out, linked_pr, repo')
        .eq('function_id', functionId) as DbReadFilter,
    ),
  ]);

  const functionName = (fnRow?.name as string | undefined) ?? 'Engineering';

  return buildStatement({
    functionName,
    window,
    generatedAtLabel: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    prs: prs as unknown as RawPr[],
    links: links as unknown as RawLink[],
    sessions: sessions as unknown as RawSession[],
  });
}

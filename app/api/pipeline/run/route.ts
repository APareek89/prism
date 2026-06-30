// app/api/pipeline/run/route.ts
//
// POST /api/pipeline/run — run the on-demand scoring pipeline for the bootstrap function.
//
// Thin handler over lib/pipeline/run.runPipeline: ingest every configured connector,
// link AI→PR, refresh blame, assemble scoring inputs, call the M0 engine (computeDaily),
// and persist kpi_daily / index_daily. The route supplies the run date (the orchestrator
// never reads a clock) so the result is deterministic per request.
//
// Admin-gated (run_pipeline capability). Returns the PipelineSummary the Run-pipeline
// button surfaces. Never throws — runPipeline guards each step internally.

import { withAdmin } from '@/lib/auth/guards';
import { runPipeline } from '@/lib/pipeline/run';
import {
  ok,
  badRequest,
  serverError,
  resolveBootstrapFunctionId,
  readJson,
  errMessage,
} from '../../connectors/_lib/route-helpers';

export const dynamic = 'force-dynamic';

/** Today's date as 'YYYY-MM-DD' (UTC) — the run date for the pipeline. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const POST = withAdmin(async (req: Request): Promise<Response> => {
  const functionId = await resolveBootstrapFunctionId();
  if (!functionId) return badRequest('no bootstrap function to score');

  const body = (await readJson<{ date?: string }>(req)) ?? {};
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today();

  try {
    const summary = await runPipeline({ functionId, date });
    return ok(summary, summary.ok ? 200 : 200);
  } catch (e) {
    return serverError(errMessage(e));
  }
});

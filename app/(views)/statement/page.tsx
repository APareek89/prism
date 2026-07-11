// app/(views)/statement/page.tsx  →  /statement
//
// ROI statement v0 (docs/prd/2026-08-roi-statement-v0.md): one server-rendered,
// print-friendly page a CTO forwards to a CFO. The three load-bearing numbers for the
// trailing 28-day window, each with an evidence badge and a same-page drill-down. NO
// bands, NO composite index, NO L-levels, NO narration, NO USD. Nulls render "awaiting
// signal" — never a fabricated 0.
//
// Server Component. Every number comes from lib/db getStatement (pure derive layer),
// so this renders cleanly empty on no data and traces every figure to its drill-down.

import type { Metadata } from 'next';
import { getCurrentFunctionId } from '@/lib/db/_base';
import { getStatement } from '@/lib/db/statement';
import type {
  StatementShareDTO,
  StatementReliabilityDTO,
  StatementRevertCohortDTO,
  StatementTokensDTO,
} from '@/lib/ui/view-models';
import { fmtTokens } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'ROI statement — Prism' };

/** Validate a ?asof=YYYY-MM-DD override; fall back to today (UTC). The window math in
 *  getStatement is pure over whatever date we pass — this is the only clock read. */
function resolveAsOf(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const today = new Date().toISOString().slice(0, 10);
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return today;
}

const AWAIT = <span className="stmt-await">awaiting signal</span>;

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ asof?: string | string[] }>;
}) {
  const sp = await searchParams;
  const asOf = resolveAsOf(sp.asof);
  const functionId = await getCurrentFunctionId();

  if (!functionId) {
    return (
      <div className="main stmt">
        <div className="card">
          <EmptyState
            title="Awaiting signal"
            hint="connect sources in Admin to generate the ROI statement"
          />
        </div>
      </div>
    );
  }

  const s = await getStatement(functionId, asOf);

  return (
    <div className="main stmt">
      {/* Header */}
      <header className="stmt-head">
        <div className="stmt-ttl">
          <h1>AI ROI statement</h1>
          <p>{s.header.functionName}</p>
        </div>
        <div className="stmt-metacol">
          <span className="stmt-window">{s.header.windowLabel}</span>
          <span className="stmt-gen">Generated {s.header.generatedAtLabel}</span>
        </div>
      </header>

      {/* The three load-bearing numbers */}
      <section className="stmt-nums" aria-label="The three numbers">
        <ShareCard share={s.share} />
        <ReliabilityCard reliability={s.reliability} />
        <TokensCard tokens={s.tokens} />
      </section>

      {/* Standing honesty line (footer of the print page) */}
      <footer className="stmt-foot">{s.honestyLine}</footer>

      {/* Drill-downs — same page, below the fold, excluded from print */}
      <section className="stmt-drill" aria-label="Evidence drill-downs">
        <h2 className="stmt-drill-h">Evidence</h2>

        <div className="stmt-table" id="drill-prs">
          <div className="cardhead">
            <h3>Window PRs</h3>
            <span className="sub">{s.drilldowns.windowPrs.length} merged in window</span>
          </div>
          {s.drilldowns.windowPrs.length === 0 ? (
            <p className="stmt-empty">No merged PRs in this window.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Title</th>
                  <th>Merged</th>
                  <th>AI</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {s.drilldowns.windowPrs.map((p) => (
                  <tr key={`${p.repo}#${p.number}`}>
                    <td className="mono">#{p.number}</td>
                    <td>{p.title}</td>
                    <td className="mono">{p.mergedAtLabel}</td>
                    <td className="mono">{p.aiAssisted ? 'yes' : 'no'}</td>
                    <td className="mono">
                      {p.methodLabel}
                      {p.confidence !== null ? ` (${p.confidence})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="stmt-table" id="drill-reverts">
          <div className="cardhead">
            <h3>Reverts</h3>
            <span className="sub">both cohorts · {s.reliability.ruleText}</span>
          </div>
          {s.drilldowns.reverts.length === 0 ? (
            <p className="stmt-empty">No reverts in this window.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Title</th>
                  <th>Cohort</th>
                  <th>Reverted</th>
                </tr>
              </thead>
              <tbody>
                {s.drilldowns.reverts.map((r) => (
                  <tr key={`${r.repo}#${r.number}`}>
                    <td className="mono">#{r.number}</td>
                    <td>{r.title}</td>
                    <td className="mono">{r.cohort === 'ai' ? 'AI' : 'human'}</td>
                    <td className="mono">{r.revertedAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="stmt-table" id="drill-sessions">
          <div className="cardhead">
            <h3>Linked sessions</h3>
            <span className="sub">metadata only — never prompt text</span>
          </div>
          {s.drilldowns.linkedSessions.length === 0 ? (
            <p className="stmt-empty">No sessions linked to window AI PRs.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Tool</th>
                  <th>Tokens</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {s.drilldowns.linkedSessions.map((ses, i) => (
                  <tr key={`${ses.tsLabel}-${i}`}>
                    <td className="mono">{ses.tsLabel}</td>
                    <td>{ses.sourceLabel}</td>
                    <td className="mono">{fmtTokens(ses.tokens)}</td>
                    <td className="mono">{ses.methodLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Number cards
// ─────────────────────────────────────────────────────────────────────────────

function ShareCard({ share }: { share: StatementShareDTO }) {
  const badge =
    share.linkedPrCount === 0
      ? 'No AI→PR links yet'
      : `${share.linkedPrCount} PR${share.linkedPrCount === 1 ? '' : 's'} linked: ` +
        share.methods.map((m) => `${m.prCount} ${m.label} (${m.confidence})`).join(', ');

  return (
    <article className="stmt-num">
      <a className="stmt-cap" href="#drill-prs">
        1 · AI-assisted share of shipped work
      </a>
      <div className="stmt-big">
        {share.sharePct === null ? AWAIT : <>{share.sharePct}%</>}
      </div>
      <div className="stmt-sub">
        {share.aiPrCount} of {share.totalPrCount} merged PRs were AI-assisted
      </div>
      <div className="stmt-evi">{badge}</div>
      {share.perTool.length > 0 && (
        <div className="stmt-tool">
          {share.perTool.map((t) => `${t.label} ${t.sharePct}% (${t.sessionCount})`).join('  ·  ')}
        </div>
      )}
      {share.unattributedTools.map((u) => (
        <div className="stmt-gray" key={u.source}>
          {u.sessionCount} {u.label} session{u.sessionCount === 1 ? '' : 's'} unattributed (no pr-link
          event)
        </div>
      ))}
    </article>
  );
}

function cohortFigure(c: StatementRevertCohortDTO) {
  return c.revertRatePct === null ? AWAIT : <>{c.revertRatePct}%</>;
}

function ReliabilityCard({ reliability }: { reliability: StatementReliabilityDTO }) {
  const { ai, human } = reliability;
  return (
    <article className="stmt-num">
      <a className="stmt-cap" href="#drill-reverts">
        2 · Held up after merge — AI vs human
      </a>
      <div className="stmt-pair">
        <div className="stmt-half">
          <div className="stmt-half-lab">AI-assisted</div>
          <div className="stmt-mid">{cohortFigure(ai)}</div>
          <div className="stmt-sub">
            {ai.reverted} of {ai.total} reverted
            {ai.smallSample ? <span className="stmt-warn"> · N={ai.total} — too few to conclude</span> : null}
          </div>
        </div>
        <div className="stmt-half">
          <div className="stmt-half-lab">Human baseline</div>
          <div className="stmt-mid">{cohortFigure(human)}</div>
          <div className="stmt-sub">
            {human.reverted} of {human.total} reverted
            {human.smallSample ? (
              <span className="stmt-warn"> · N={human.total} — too few to conclude</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="stmt-evi">{reliability.ruleText}</div>
    </article>
  );
}

function TokensCard({ tokens }: { tokens: StatementTokensDTO }) {
  return (
    <article className="stmt-num">
      <a className="stmt-cap" href="#drill-sessions">
        3 · Tokens per shipped AI PR
      </a>
      <div className="stmt-big">
        {tokens.tokensPerAiPr === null ? AWAIT : <>{fmtTokens(tokens.tokensPerAiPr)}</>}
      </div>
      <div className="stmt-sub">
        {fmtTokens(tokens.linkedTokens)} tokens across {tokens.aiPrCount} AI PR
        {tokens.aiPrCount === 1 ? '' : 's'}
      </div>
      <div className="stmt-evi">
        {tokens.tokensPerAiPrExact === null
          ? 'No first-party links'
          : `${fmtTokens(tokens.tokensPerAiPrExact)} / PR · first-party links only (${tokens.exactAiPrCount} PR${tokens.exactAiPrCount === 1 ? '' : 's'})`}
      </div>
      <div className="stmt-gray">
        {fmtTokens(tokens.unattributedTokens)} tokens exploration / unattributed — shown for
        completeness, excluded from the ratio
      </div>
    </article>
  );
}

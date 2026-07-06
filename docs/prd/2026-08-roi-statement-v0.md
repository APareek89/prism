# ROI statement v0 (Month-1, part 2) — build spec

> Status: Approved for build (implementation-ready; written for any model/session)
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [next-6-months.md](../strategy/next-6-months.md) Month 1, [operating-principle.md](../strategy/operating-principle.md), [M1 PRD](2026-08-core6-main-index.md) (the FULL v3.0 project — this v0 is the trimmed slice)
> HARD RULES apply: no dummy data · column truth = `supabase/migrations/*.sql`, validate live (`select <cols> from public.<t> limit 0`) · numbers computed in a pure read/derive layer, LLM never touches them · no USD anywhere.

## What this is

One server-rendered, print-friendly page a CTO forwards to a CFO: **the three load-bearing
numbers** for the trailing 28-day window, each with an evidence badge and a drill-down.
No bands, no composite index, no L-levels, no narration. This is the month-1 demand-test
artifact ("send to 20 CTOs") — its job is surviving skeptical drill-in, not completeness.

## Non-goals (deliberate trimming — do NOT add)

- No v3.0 engine changes (`lib/scoring` untouched; that's the full M1 PRD, separate work).
- No harness/linkage/coaching content. No email. No public/unauthenticated share link (v0 is authed; print/PDF is the sharing path).
- No USD (tokens only). No cadence/iterations/rework KPIs.

## The page

- Route: `app/(views)/statement/page.tsx` → `/statement`. Server Component; reads via a new `lib/db/statement.ts` module using the existing `db()` resolver (DEMO_MODE service-role / RLS in prod — see `lib/db/_base.ts`).
- Header: function name · window ("28 days ending YYYY-MM-DD", from `lib/scoring/window.ts` — never a hidden clock; date passed in) · generated-at stamp.
- Footer: the standing honesty line: "Every number is computed from ingested evidence; 'awaiting signal' means we don't know — Prism never fabricates."
- Print stylesheet: fits one A4/Letter page, no nav chrome.

## The three numbers (exact formulas, real columns)

All read window-scoped merged PRs: `gh_prs` where `function_id = $fn`, `is_merged = true`,
`merged_at >= window.since`.

**1 · AI-assisted share of shipped work**
- `share = count(ai_assisted = true) ÷ count(*)` over window merged PRs. Render as %.
- Denominator 0 → render "awaiting signal" (null), never 0%.
- **Evidence badge:** link-method mix for those PRs from `pr_ai_link` (join on `pr_id`), counted per `method` (`pr_link`/`sha`/`branch`/`coauthor`) with confidence values shown — e.g. "12 PRs linked: 9 first-party (0.99), 3 branch (0.80)".
- **Per-tool line:** session share by `cc_sessions.source` (`claude_code` vs `codex`, migration 0034) for window sessions (`ts >= window.since`); if any window PR's repo has sessions from a tool that produced zero links, show the gray-slice line: "N codex sessions unattributed (no pr-link event)".

**2 · Held up after merge — AI vs human baseline (the fairness control)**
- AI revert rate = `count(ai_assisted AND reverted_at is not null) ÷ count(ai_assisted)`.
- Human baseline = same formula over `ai_assisted = false` rows.
- Render side by side, ALWAYS both — never the AI number alone.
- Either denominator < 5 → keep the number but add the small-sample banner ("N=3 — too few to conclude"). Either denominator 0 → that side renders "awaiting signal".
- **Evidence badge:** every counted revert listed in the drill-down (PR number, `reverted_at`, ≤14d rule stated — the detector's rule text, see migration 0007 comments).

**3 · Tokens per shipped AI PR (tokens only — no dollars)**
- Numerator: sum of `tokens_in + tokens_out` over sessions linked to window AI PRs — `cc_sessions` joined via `pr_ai_link.cc_session_id` where `pr_ai_link.pr_id` ∈ window AI PRs. Denominator: count of window AI PRs.
- Secondary line (headline stays all-links): the exact-only figure using links with `method = 'pr_link'` — labeled "first-party links only".
- **Unattributed context line (never scored, always shown):** total window session tokens NOT linked to any PR, labeled "exploration / unattributed — shown for completeness, excluded from the ratio".
- Zero AI PRs → "awaiting signal".

## Drill-downs

Each number links to a plain table section (same page, below the fold, excluded from print):
1. Window PRs: number, title, merged_at, ai_assisted, link method+confidence.
2. Reverts: both cohorts' reverted PRs with `reverted_at`.
3. Linked sessions: session ts, `source`, tokens, method. Metadata only — never prompt text.

## Implementation notes (for the builder)

- New files only: `lib/db/statement.ts` (one exported `getStatement(functionId, date)` returning a single DTO) + the route + a small print CSS. Follow `lib/db/*` DTO conventions (`lib/ui/view-models.ts` if a DTO type is added there).
- VALIDATE columns live before trusting queries (the hard rule): `gh_prs(id, repo, number, title, is_merged, merged_at, reverted_at, ai_assisted)` · `pr_ai_link(pr_id, cc_session_id, method, confidence)` · `cc_sessions(id, ts, source, tokens_in, tokens_out, linked_pr)`. Migrations of record: 0007, 0008, 0010, 0033, 0034.
- Derivations are pure functions over fetched rows — colocate as `lib/db/statement-derive.ts` (or in-module pure exports) with unit tests on fixtures (fixtures live in tests only, never seeded).
- Known trap: `npm run db:migrate` calls the absent Supabase CLI — use `node --env-file=.env.local scripts/db-migrate.mjs` (no migration should be needed for this spec).
- Verify: `npm run test` (extend), `npm run typecheck`, `npm run build`, then render `/statement` on real dogfood data and confirm every number traces to its drill-down.

## Acceptance checklist (ship gate)

- [ ] Renders on real dogfood data; all three numbers correct against hand-run SQL.
- [ ] Zero USD strings; zero composite scores/bands anywhere on the page.
- [ ] Nulls render "awaiting signal"; small-N banners fire at N<5.
- [ ] AI revert rate never renders without the human baseline beside it.
- [ ] Every number shows its evidence badge; every badge count matches its drill-down rows.
- [ ] Per-tool (`source`) split renders; codex gray-slice line appears when applicable.
- [ ] Print preview = one clean page.

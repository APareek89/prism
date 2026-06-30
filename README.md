# Prism — AI-Native Engineering Index

Measures and improves the ROI of Claude Code spend in software engineering. Local-first;
deploy target is **Render**. One person is the whole function for the demo (**org = me = team**),
but the code is **multi-employee-ready** — adding people who join your GitHub org is a normal
admin action, not a refactor.

> **No dummy data.** The app starts empty. Every view renders an "awaiting signal" state until
> your real GitHub PRs + Claude Code sessions (+ optional Sentry) flow in. Nothing is fabricated.

See the design + architecture specs in [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Stack
Next.js (App Router) · Supabase (Postgres + RLS + Auth) · Inngest (durable daily pipeline) ·
LangGraph + LangChain (TypeScript, in-process — narrative agents only, never the score) ·
Resend (email digest) · connectors: GitHub App, Claude Code (local `~/.claude` sessions), Sentry.

## Prerequisites
- Node ≥ 22 (`nvm use`)
- A free [Supabase](https://supabase.com) project
- (later) the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations
- (M4) an Anthropic API key + a [Resend](https://resend.com) key

## Quick start (local, keyless boot)
```bash
nvm use
npm install
cp .env.example .env.local      # already scaffolded; fill Supabase vars first
npm run test:scoring            # the deterministic engine runs with no keys
npm run dev                     # http://localhost:3000 — empty/awaiting-signal until connected
```

### Connect your data (Admin view)
1. **Supabase** — paste the four `*_SUPABASE_*` vars into `.env.local`, then `npm run db:migrate`.
2. **Claude Code** — Admin → *Connect Claude* → *Scan local sessions* (reads `~/.claude`), then bind the stream to your roster row.
3. **GitHub** — Admin → *Connect GitHub*: install the Prism GitHub App on a repo you own. Local webhooks need a tunnel (`smee.io` / `gh webhook forward`).
4. **Sentry** (optional) — Admin → *Connect Sentry* with a free Developer-tier token.
5. Do real work in the repo with Claude Code → open & merge a PR → Admin → **Run pipeline now**.

### Pipeline + email (M4)
```bash
npm run inngest:dev             # durable pipeline dev server (separate terminal)
```

## Milestones
- **M0** scaffold + schema + RLS + deterministic scoring engine (+ tests) — keyless. ← current
- **M1** full UI (4 views + drill-in), empty states, Admin interactive — keyless. **→ pause for keys**
- **M2** connectors (GitHub / Claude local sessions / Sentry) + AI→PR link + onboarding
- **M3** scoring wired to real data → views light up
- **M4** LangGraph agents + Inngest pipeline + Resend digest + courses + adoption monitoring
- **M5** end-to-end demo + polish

## Scripts
| | |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | production build (must pass keyless) |
| `npm run test` / `test:scoring` | all tests / scoring engine only |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` / `db:reset` | Supabase migrations |
| `npm run inngest:dev` | Inngest pipeline dev server |

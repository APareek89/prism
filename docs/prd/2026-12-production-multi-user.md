# Production multi-user — real auth, RLS, Render (M5 · Dec 2026)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [handoff.md](../../handoff.md) (decisions 1, 3, 5), [roadmap](README.md), [ownership-map](../architecture/ownership-map.md)

## Context / Problem

- Prism runs single-user in DEMO_MODE on one laptop: no real Supabase session, service-role reads, RLS bypassed locally. Production paths exist by design (real RLS client when `DEMO_MODE=false`) but have never carried real users.
- The org roadmap (M7–M9) is meaningless without multiple authenticated humans in one deployment. This month turns the architecture's multi-user readiness ("org = me = team today, multi-employee-ready") into a running production system.
- Deploy target has always been **Render** (decision 1); `render.yaml` is a stub.

## Goals

- Prism runs on Render as a production deployment with real Supabase authentication and RLS enforced end-to-end.
- A second (and third) real human can sign in, be provisioned as an employee, and see role-appropriate views.
- DEMO_MODE survives untouched as the local demo/dev path.

## Non-goals

- No Claude-usage data for teammates yet — that requires telemetry (M7). Their Usage/Efficiency KPIs render honest nulls ("awaiting signal") this month; GitHub-side data (PRs) flows where handles match.
- No CSV roster wizard or eligibility flags (M8).
- No SSO/SCIM (Phase-2 v2 decision); Supabase email magic-link (+ Google OAuth if free) is enough.
- No billing, no multi-tenant (one org per deployment this year).

## Users / Personas

- **Founding team members** (first real users beyond the owner): sign in, get provisioned, see My View.
- **Owner/admin**: invites users, assigns roles, connects the org's repos.
- **Pilot-org admin (Q3)**: the eventual beneficiary — this month builds the rails they'll onboard onto.

## User stories

- As a teammate, I want to sign in with my work email and land on My View, so I can see my own index without touching anyone's laptop.
- As a teammate, I want RLS to guarantee I can only read what my role allows, so adoption doesn't depend on trusting the client code.
- As the admin, I want to invite a user by email and have an employee record provisioned on first sign-in, so onboarding is one step.
- As the admin, I want the production pipeline to run on schedule (Inngest) without my machine, so scores stay current unattended.
- As a developer of Prism, I want DEMO_MODE to keep working locally exactly as today, so demo and dev workflows don't regress.

## Scope

**In scope**
- Supabase Auth (magic link; Google OAuth optional) wired to `getAuthUser`; session→employee binding on first sign-in.
- Invite flow (admin enters email → invited user provisioned via existing `provisionEmployee` path on first login).
- RLS verification pass: every read module exercised as each role with cross-user access asserted denied.
- Render production deployment: `render.yaml` completed, env/secrets management, Supabase production config, Inngest cron live in prod, GitHub webhook URL updated.
- Roles: admin · lead · IC (the existing role model, now enforced by real sessions).
- Operational basics: DB backups enabled, error reporting for the app itself, deploy runbook in docs.

**Out of scope**
- Multi-org tenancy, billing, SCIM/SSO.
- Any scoring or UI feature work — this is a platform month by design (December, holiday-shortened).
- Teammate Claude-session ingestion (M6).

## Functional requirements

- FR-1: A user with an invited email can authenticate via Supabase magic link and reach their My View; unknown emails are rejected with a clear message.
- FR-2: First sign-in provisions (or binds to) exactly one employee record keyed on email; repeat sign-ins never duplicate.
- FR-3: With `DEMO_MODE=false`, every read flows through the RLS client under the user's session; no service-role reads on any user-facing path.
- FR-4: Role visibility holds under RLS: IC sees self + team aggregates; lead sees team + members; admin sees admin surfaces — verified by automated cross-role denial tests.
- FR-5: The production deployment serves the app on a stable URL with all connectors functional (GitHub webhooks received, pipeline runnable on-demand and on the daily cron).
- FR-6: Members whose GitHub handle matches PR authorship get GitHub-side KPIs; their AI-usage KPIs render "awaiting signal" (null), never 0, until telemetry lands.
- FR-7: DEMO_MODE continues to work locally with service-role reads and the demo employee, unchanged.
- FR-8: Secrets never ship to the client or the repo; production env is documented in the deploy runbook (values in Render, not in git).
- FR-9: An admin can deactivate a user; deactivation revokes access on next request while preserving historical scored data.
- FR-10: The daily pipeline runs unattended in production and its outcome (ok/error) is visible on the Admin surface.

## Non-functional requirements

- **Security**: RLS as the enforcement boundary (not UI checks); auth callback hardening; service-role key server-only; webhook signature verification stays mandatory.
- **Reliability**: deploy is reproducible from `render.yaml` + runbook; DB backups daily; failed cron visible, not silent.
- **Privacy**: production carries real people's data from day one — the metrics-not-content rule and role visibility are restated in the runbook.
- **Simplicity**: zero new services beyond the Render web service itself; Supabase hosted features only (Auth, Postgres, Edge Function already in use).

## Open questions

- Google OAuth alongside magic link at launch, or magic-link only? (CPO proposal: magic-link only; add OAuth when a pilot org asks.)
- Which Supabase project hosts production — promote the current one or create a clean prod project with migrations replayed? (CPO proposal: clean prod project; keeps dev/demo separate.)
- Custom domain now or Render subdomain until pilot? (owner)

## Milestones

- W1: Auth wiring (magic link, session→employee binding) + invite flow.
- W2: RLS verification pass with cross-role denial tests; deactivation.
- W3: Render production deploy + env/secrets + webhooks + Inngest cron live.
- W4 (holiday-short): burn-in with 2–3 real users, backup/restore drill, runbook, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RLS gaps discovered late (policies never carried real sessions) | med | high | W2 dedicated denial-test pass per table per role, before deploy |
| December capacity (holidays) | high | med | Platform-only scope, no model changes; W4 is burn-in, not build |
| Teammate null KPIs read as "Prism is broken" | med | low | Explicit "awaiting signal — fleet telemetry arrives in February (M7)" empty state |
| Webhook/env drift between local and prod | med | med | Single runbook as source of truth; `--check` migration inspection against prod before apply |

## Success metrics

- ≥2 real users besides the owner signed in and provisioned in production.
- 100% of cross-role denial tests pass under RLS with real sessions.
- 7 consecutive unattended daily pipeline runs with ok status.
- Zero service-role reads on user-facing paths when `DEMO_MODE=false` (code audit + runtime assertion).

## References

- Decisions: [handoff.md](../../handoff.md) — Render (1), multi-employee-ready (3), DEMO_MODE auth design (5)
- Code: `lib/auth/session.ts`, `lib/db/_base.ts`, `lib/onboarding/provision.ts`, `supabase/migrations/` (RLS policies), `render.yaml`
- [ownership-map.md](../architecture/ownership-map.md) — single-owner rules for auth/clients

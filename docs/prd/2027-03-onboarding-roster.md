# Multi-tenant onboarding — org signup, invites & roster (M8 · pulled forward)

> Status: Draft (v2 — expanded to true multi-tenant)
> Owner: Prism CPO
> Last updated: 2026-07-11
> Related: [phase-2.md](../phase-2.md) §6, [M5 PRD](2026-12-production-multi-user.md), [M7 PRD](2027-02-fleet-telemetry.md), [roadmap](README.md), [handoff.md](../../handoff.md) (Phase 1)
>
> **Pulled forward** from Mar 2027: M8's hard dependency — M5's multi-user auth + RLS core —
> is already built and verified this session (see Context). **Scope expanded** from an admin
> CSV-roster wizard for one company to **true multi-tenant** self-serve onboarding.

## Context / Problem

- Prism's auth + RLS **core is now live** (Phase 1, this session): `DEMO_MODE=false` gating in middleware, email+password login via Supabase Auth, first-login→employee binding ([lib/auth/link.ts](../../lib/auth/link.ts)), and per-user RLS isolation verified (anon 0 rows; each user sees only their own row). That was M8's blocker.
- But the app is still **single-tenant**: one hardcoded bootstrap `functions` row. `resolveBootstrapFunctionId`, `getCurrentFunctionId`, `linkOrProvisionUser`, and the roster upload all assume that single function.
- To be a product, **many orgs must self-serve onboard on one deployment, each fully isolated**: an org signs itself up, its admin invites members by email, and those members create their own logins and land in *their* org — never seeing another org's data.
- The original M8 scope (admin uploads a CSV roster + eligibility + unmatched resolution for one company) is **kept**, but wrapped in the multi-tenant model — those pieces become per-org.
- M7 (fleet telemetry) is a **soft** dependency: onboarding works without it; numbers stay "awaiting signal" until telemetry flows.

## Goals

- An org **self-serve creates an account** → a new isolated tenant (organization + its first function + an admin user), with zero manual DB work.
- An org admin **adds users by email**, and invited users **self-register and log into their own org**.
- **Tenant isolation is enforced by RLS** — a user can only ever read/write their own org's data (verified adversarially, including cross-org attempts).
- Keep M8's original safety guarantees: roster ingestion validated, dry-run previewed, idempotent on email, no guessed identity joins; role-driven eligibility.

## Non-goals

- No SCIM/SSO — email/password + CSV first (SCIM v2, Phase-2 decision table).
- **One function per org in v1** — the `organizations` table + `functions.org_id` are 1:many-ready, but a tenant starts with a single Engineering function; multi-function-per-org (full Org→Function→Team depth) lands with M9.
- No email-deliverability build (SMTP / branded invite emails) — v1 creates accounts server-side; a real verified invite-email flow is a follow-up (see Open questions).
- No non-engineering function packs; no connector admin redesign; no Manager Enablement scoring.
- No org billing / plans / seat limits.

## Users / Personas

- **Org founder / admin**: signs the org up, invites members, manages roster + eligibility, resolves unmatched identities.
- **Invited member (IC / lead)**: gets invited by email, self-registers with a password, lands in their org.
- **Function lead**: reviews their team's slice.
- **The tenant boundary itself**: no user or query may ever cross orgs.

## User stories

- As an org founder, I want to sign up and create my organization in one step, so I can start without a services engagement.
- As an org admin, I want to add teammates by email, so they can join my org.
- As an invited teammate, I want to create my own account with the email I was invited on and land directly in my org, so onboarding is self-serve.
- As any user, I want certainty that I can only see my own org's data, so tenancy is trustworthy.
- As an org admin, I want to upload/re-upload a CSV keyed on email and preview the diff before it writes, so a bad file can't corrupt my org.
- As an org admin, I want unmatched GitHub/AI accounts queued on a resolution screen, so nobody's data is attached by guesswork.
- As a manager, I want to be excluded from IC scoring by default, so I'm not graded on the wrong job.

## Scope

**In scope**
- **Tenant model**: new `organizations` table (id, name, slug, created_at) as the tenant root; `functions.org_id` FK (one function per org in v1); employees belong to an org via their function.
- **Org self-serve signup**: create org + first function + admin employee (+`admin` role) + auth user, atomically.
- **Invite-by-email**: admin adds member emails → `pending` seats (`employees` rows, `user_id=null`) scoped to *their* org. Reuses [provisionEmployee](../../lib/onboarding/provision.ts); single-add + CSV.
- **Invite → join**: an invited user self-registers with that email → bound to the pending seat in the correct org (extends `linkOrProvisionUser` to resolve the seat by email across orgs). No pending seat + no org name → rejected with guidance.
- **Tenant-scoped resolution**: `resolveBootstrapFunctionId`/`getCurrentFunctionId` and every write path resolve the *authenticated user's* org, never "the first function." Ingest endpoints attribute by the caller's org.
- Original per-org pieces: function-pack activation, roster CSV, unmatched resolution screen, eligibility flags, team/manager scoping.

**Out of scope**
- Multi-function-per-org; verified invite emails / SMTP; billing; SCIM/HRIS; connector admin redesign.

## Functional requirements

- FR-1: Function activation instantiates the pack's KPIs, anchors, and connector checklist for that org's function; nothing activates as a blank slate.
- FR-2: CSV upload parses and validates (schema, email format, duplicate emails, unknown team references) and presents a full dry-run diff (creates / updates / no-ops / errors) before any write.
- FR-3: Applying a roster is idempotent on (org, email): re-uploading the same file is a no-op; a corrected file updates in place; no path duplicates an employee.
- FR-4: Roster rows with `github_handle` / `ai_tool_account` that don't match known identities set `match_status = pending` and appear on the resolution screen; no identity is ever auto-joined.
- FR-5: The resolution screen lets the admin confirm or reject candidate matches; every resolution is recorded (who, when) for audit.
- FR-6: `role = lead` sets IC-scoring exclusion by default (overridable); excluded people render with an explicit "measured as manager — index coming" state, never as low scorers.
- FR-7: Team and manager relationships are queryable scoping facts (person → team → function → org chain) consumed by views and, next month, the org rollup.
- FR-8: The dogfood org is migrated through this flow itself — the ship gate is our own onboarding.
- FR-12: **Org signup** — a visitor creates an organization by providing org name + admin email + password; this atomically creates an `organizations` row, its first `functions` row, an admin `employees` row bound to the new auth user, and an `admin` role grant. The founder lands in their org.
- FR-13: **Invite** — an org admin adds one or more member emails; each becomes a `pending` seat in the admin's org; adding is idempotent on (org, email); no auth user is created at invite time.
- FR-14: **Member self-register** — a person signs up with an email that matches a pending seat → their new auth user is bound to that seat and lands in that org. An email with no pending seat and no org name is rejected with guidance ("ask your admin to invite you, or create an organization").
- FR-15: **Tenant isolation** — every read/write is scoped to the caller's org by RLS; a user can never read, write, or enumerate another org's data (employees, functions, PRs, sessions, index/kpi, insights, ingest). Verified with adversarial cross-org tests.
- FR-16: **No single-tenant fallbacks** — no code path resolves "the first/only function"; org/function is always derived from the authenticated user (or the invite seat at signup). `resolveBootstrapFunctionId` is replaced by an org-scoped resolver.
- FR-17: **Working signup** — account creation succeeds end-to-end without external email delivery; a created user can immediately sign in.
- FR-18: **Ingest scoping** — the pr-link / telemetry ingest endpoints attribute to the org resolved from the caller's identity/token, never a global bootstrap function.

## Non-functional requirements

- **Security / tenancy**: RLS is the isolation boundary; the service-role client is used only in server actions that must cross RLS (org creation, invite linking) and always writes org-scoped rows with `org_id` derived from the caller. **Cross-tenant leakage is a release-blocking test.**
- **Signup mechanism**: v1 creates confirmed users server-side (service-role `admin.createUser`) to avoid an email-deliverability dependency — trading email-ownership proof for self-containment; member signup is gated on a pending invite, org creation is rate-limited. Flagged to replace with verified invite emails (follow-up).
- **Safety**: dry-run is mandatory; apply is transactional — a failed apply leaves no partial roster.
- **Auditability**: every org creation, invite, roster apply, and identity resolution is logged with actor + diff.
- **Simplicity**: server-side only; no background import service; the org/function/employee tables accept a future SCIM writer without migration drama.
- **Accessibility**: signup, invite, and resolution flows are keyboard-completable; errors are per-field/per-row and screen-reader announced.

## Open questions

- **Duplicate / fake org accounts**: v1 org signup is permissive — no dedup, no domain/email verification, so duplicate or fake orgs are possible. **Owner decision (2026-07-11): accept for v1, defer to a later stronger-security pass** (verified invite emails, org verification/dedup, abuse guards). The schema is designed verification-ready (`organizations.status`, `organizations.created_by`) so hardening is additive, not a rewrite.
- Email confirmation: v1 uses server-side `admin.createUser` (confirmed) so signup works without SMTP — but that skips email-ownership proof. When do we add real verified invite emails? (CPO proposal: immediate follow-up; gate member signup on a per-invite token in the meantime.)
- Supabase rejects some email domains as "invalid" (observed with `@prism.local`) and the project's "Confirm email" toggle state is unset — confirm the real signup path against deliverable domains in W1.
- Invite token vs open email-match: should member signup require a per-invite token (link), or just match a pending seat by email? (Open-match is simpler but weaker; token is safer.)
- Team hierarchy depth: flat teams under a function this year, or nested? (CPO proposal: flat.)
- Roster removals: does CSV absence deactivate a person, or is deactivation always explicit? (CPO proposal: explicit only; absence flags for review.)

## Milestones

- W1: `organizations` table + `functions.org_id` migration (**0036**); org-scoped resolver replaces every bootstrap-function lookup; confirm the signup path against real email domains.
- W2: org self-serve signup (server action: org + function + admin + role) + working create-account UX; invited-member self-register → join.
- W3: admin invite-by-email (single + CSV, per org) reusing `provisionEmployee`; unmatched resolution + eligibility, now per org.
- W4: adversarial cross-tenant isolation tests; dogfood — create 2 orgs, invite + join in each, prove isolation; ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Cross-tenant data leak** (a missed org scope / RLS gap) | med | **high** | RLS is the boundary + release-blocking adversarial cross-org tests; service-role writes always set `org_id` from the caller's identity |
| Server-side signup (`admin.createUser`, no email proof) lets accounts be made for unowned emails | med | med | Gate member signup on a pending invite (or per-invite token); rate-limit org creation; replace with verified invite emails as the immediate follow-up |
| Removing bootstrap-function fallbacks breaks existing paths (connectors, ingest, reads) | med | med | Migrate all `resolveBootstrapFunctionId` callers in one pass; keep the dogfood org as org #1; typecheck + e2e |
| Real-world CSVs are messier than the spec | high | med | Per-row errors + downloadable report; dry-run absorbs the mess before writes |
| Eligibility defaults surprise managers ("where's my score?") | med | low | Explicit "measured as manager — index on the backlog" state; never a blank |

## Success metrics

- **Two independent orgs** created self-serve on one deployment, a user in each, with **zero cross-org visibility** (adversarial test passes).
- Invited member self-registers and lands in the correct org with zero manual DB edits.
- No code path resolves a global bootstrap function (grep-clean).
- Roster re-upload idempotency: second identical upload = zero changes (automated + live).
- 100% of unmatched identities resolved via the screen (none out-of-band).

## References

- Phase 1 (this session): [lib/auth/link.ts](../../lib/auth/link.ts), [lib/auth/session.ts](../../lib/auth/session.ts), `DEMO_MODE` gating, RLS scoping verified — the M5 core this PRD depends on.
- Reuse: [provision.ts](../../lib/onboarding/provision.ts) (`provisionEmployee`), [roster-csv.ts](../../lib/onboarding/roster-csv.ts), `POST /api/connectors/employees/upload` + `/match`, [RosterUpload.tsx](../../components/admin/RosterUpload.tsx).
- New: `organizations` table (migration 0036+), org-scoped resolver, org-signup server action.
- Spec basis: [phase-2.md](../phase-2.md) §6 (wizard steps, CSV rules, eligibility), §8 (CSV first, SCIM v2).
- Consumers: [M9 org rollup](2027-04-org-rollup-dashboard.md) (scope chain), [manager index (backlog)](backlog/manager-enablement-index.md) (lead routing).

## Changelog

- **v2 (2026-07-11)** — Expanded to **true multi-tenant** and **pulled forward** (M5's auth+RLS core met in Phase 1). Added org self-serve signup, invite-by-email, member self-registration, the `organizations` tenant model, and tenant-isolation requirements (FR-12–FR-18). Original single-company roster/eligibility/resolution scope retained, now per-org. M7 reclassified as a soft (value) dependency.
- **v1 (2026-07-06)** — Initial: admin CSV-roster wizard for a single company.

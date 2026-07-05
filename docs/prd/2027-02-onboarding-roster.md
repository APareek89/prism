# Onboarding wizard & roster (M7 · Feb 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [phase-2.md](../phase-2.md) §6, [M5 PRD](2026-12-production-multi-user.md), [M6 PRD](2027-01-fleet-telemetry.md), [roadmap](README.md)

## Context / Problem

- Prism can now host multiple authenticated users (M5) with real usage data (M6) — but getting a company from zero to configured still requires hand-holding: manual employee creation, manual identity fixes, no notion of teams or eligibility.
- Phase-2 §6 defines the answer: a three-step wizard (pick functions → CSV roster → eligibility flags) whose goal is **a company reaching first honest numbers without a services engagement**.
- Q3's pilot org is the forcing function: this month is the difference between "demo" and "product".

## Goals

- A new org completes setup end-to-end via the wizard: functions activated, roster loaded, identities resolved, eligibility set.
- Roster ingestion is safe by construction: validated, dry-run previewed, idempotent on email, and never guesses an identity join.
- Role drives eligibility from day one: leads/managers are excluded from IC scoring by default and flagged for the Manager Enablement route (index arrives M11).

## Non-goals

- No SCIM/SSO roster sync — CSV first, SCIM v2 (Phase-2 decision table); tables stay designed to accept both.
- No non-engineering function packs (M10) — the function picker ships with Engineering active and other packs visibly "coming", never a blank-slate KPI builder.
- No connector admin redesign (parked, owned separately per Phase-2 §5).
- No Manager Enablement Index scoring (M11) — this month only routes and stores the flag.

## Users / Personas

- **Pilot-org admin**: runs the wizard, uploads the roster, resolves unmatched accounts.
- **Function lead**: reviews their team's roster slice and eligibility.
- **IC / lead employees**: land in the right team with the right role without doing anything.

## User stories

- As an org admin, I want to upload a CSV of my people and preview exactly what will happen before anything writes, so a bad file can't corrupt my org.
- As an org admin, I want to re-upload a corrected CSV keyed on email and have it update in place, so fixing mistakes is safe and boring.
- As an org admin, I want unmatched GitHub/AI accounts queued on a resolution screen, so nobody's data is attached by guesswork.
- As a manager, I want to be excluded from IC scoring by default, so I'm not graded on the wrong job while my index doesn't exist yet.
- As an org admin, I want contractors' inclusion to be my org's explicit choice, so policy matches how we actually engage them.

## Scope

**In scope**
- Step 1 — Pick functions: activating a function loads its pack (KPIs, anchors, connector requirements) pre-configured; Engineering is the available pack this month.
- Step 2 — Roster CSV: columns `name, email, function, team, manager_email, role (IC/lead)`, optional `github_handle`, `ai_tool_account`; parse → validate → dry-run preview → apply; idempotent upsert keyed on email.
- Unmatched-account resolution screen (extends the existing `match_status` model): pending identities listed with suggested candidates, resolved only by explicit admin action.
- Step 3 — Eligibility flags: leads/managers excluded from IC scoring by default (routed to the manager index when it ships); contractors/interns configurable (included / excluded / tracked separately).
- Team structure: `team` and `manager_email` land as first-class scoping data (feeds M8's scope chain).

**Out of scope**
- SCIM connector, HRIS integrations.
- Bulk GitHub-org member import (org-sync stays what it is; roster is the source of people-truth).
- Any UI for packs beyond activation (pack anchors tuning lives in Configure, unchanged).

## Functional requirements

- FR-1: The wizard runs as an ordered three-step flow with progress persisted — an admin can leave and resume without losing state.
- FR-2: Function activation instantiates the pack's KPIs, anchors, and connector checklist for that function; nothing activates as a blank slate.
- FR-3: CSV upload parses and validates (schema, email format, duplicate emails, unknown function/team references, manager emails that don't resolve) and presents a full dry-run diff (creates / updates / no-ops / errors) before any write.
- FR-4: Applying a roster is idempotent on email: re-uploading the same file is a no-op; a corrected file updates in place; no path duplicates an employee.
- FR-5: Roster rows with `github_handle` or `ai_tool_account` that don't match known identities set `match_status = pending` and appear on the resolution screen; no identity is ever auto-joined.
- FR-6: The resolution screen lets the admin confirm or reject candidate matches; every resolution is recorded (who, when) for audit.
- FR-7: `role = lead` sets IC-scoring exclusion by default (overridable per person); excluded people render with an explicit "measured as manager — index coming" state, never as low scorers.
- FR-8: Contractor/intern treatment is a per-org setting honored by scoring scope (included / excluded / tracked separately) and displayed wherever coverage is stated.
- FR-9: Team and manager relationships from the roster are queryable scoping facts (person → team → function chain) consumed by views and, next month, the org rollup.
- FR-10: Wizard completion lands the admin on a "first honest numbers" checklist: connectors state, enrollment coverage (M6), and when the first scored batch will publish.
- FR-11: The dogfood org is migrated through the wizard itself (roster CSV of the founding team) — the ship gate is our own onboarding.

## Non-functional requirements

- **Safety**: dry-run is mandatory, not optional; apply is transactional — a failed apply leaves no partial roster.
- **Auditability**: every roster apply and identity resolution is logged with actor and diff summary.
- **Simplicity**: CSV parsing server-side in the app; no background import service; roster tables designed to accept a future SCIM writer without migration drama.
- **Accessibility**: the wizard is keyboard-completable; validation errors are per-row, specific, and screen-reader announced.

## Open questions

- Team hierarchy depth: flat teams under a function this year, or nested teams? (CPO proposal: flat — the scope chain in Phase-2 is Org → Function → Team → Individual; nesting only with pilot evidence.)
- Roster removals: does absence from a re-uploaded CSV deactivate a person, or is deactivation always explicit? (CPO proposal: explicit only; CSV absence flags for review — silent deactivation is too sharp.)
- Minimum viable `ai_tool_account` semantics while Claude is the only tool (likely = telemetry identity email) — confirm against M6's identity map in W1.

## Milestones

- W1: Wizard shell + function activation + roster schema/scoping migrations.
- W2: CSV parse/validate/dry-run/apply with idempotency + audit log.
- W3: Resolution screen + eligibility flags + coverage checklist.
- W4: Dogfood org re-onboarded through the wizard end-to-end; pilot-org dry run if available; ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Real-world CSVs are messier than the spec (encodings, aliases, half-filled rows) | high | med | Per-row errors with downloadable error report; dry-run absorbs the mess before writes |
| Identity resolution backlog stalls scoring for new people | med | med | Pending people score on what IS matched (e.g. GitHub-only) with coverage stated; resolution screen surfaces count loudly |
| Eligibility defaults surprise managers ("where's my score?") | med | low | Explicit "measured as manager — index ships in June" state; never a blank |
| Wizard scope creep into connector admin | med | med | Connector admin is parked by decision (Phase-2 §5); wizard links to existing Admin, doesn't rebuild it |

## Success metrics

- Dogfood org fully re-onboarded via the wizard with zero manual DB edits.
- Roster re-upload idempotency: second identical upload produces zero changes (automated test + live verification).
- 100% of unmatched identities resolved via the screen (none resolved out-of-band).
- Time-to-first-honest-numbers for a fresh org: ≤1 day after CSV apply (given connectors + enrollment done).

## References

- Spec: [phase-2.md](../phase-2.md) §6 (wizard steps, CSV rules, eligibility), §8 defaults (CSV first, SCIM v2)
- Code: `lib/onboarding/provision.ts`, `employees.match_status` model, `lib/connectors/identity.ts`
- Consumers: [M8 org rollup](2027-03-org-rollup-dashboard.md) (scope chain), [M11 manager index](2027-06-manager-enablement-index.md) (lead routing)

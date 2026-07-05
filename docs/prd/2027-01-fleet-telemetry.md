# Fleet telemetry ingestion — the org data plane (M6 · Jan 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §4 §8 §11 P4, [M5 PRD](2026-12-production-multi-user.md), [roadmap](README.md)

## Context / Problem

- Claude Code ingestion reads `~/.claude` on the owner's laptop — a one-machine data plane. Production multi-user (M5) means teammates exist but their AI usage is invisible: Usage/Efficiency KPIs are honest nulls.
- The spec's org-wide answer (scoring-model §4): **OTLP telemetry** — Claude Code's telemetry export streams session metadata to a collector endpoint with an org token, identity-mapped to the roster.
- Coverage is itself a KPI precondition: cadence H0 asks "are all machines enrolled?" before anyone scores low.

## Goals

- Teammates' Claude Code sessions stream to production Prism with **metadata only** — the privacy line (no prompt text, no code content) holds by construction.
- Telemetry-ingested sessions are first-class: same schema, same scoring, same AI→PR linking as locally-parsed sessions.
- Enrollment coverage is visible per person/machine, so "low cadence" can never be an enrollment artifact.

## Non-goals

- No coaching plugin (M9) — telemetry is passive capture; nothing runs hooks yet.
- No edit-level depth/survival capture beyond what Claude Code's telemetry exports today; those 📎 signals stay null where data doesn't exist (honest nulls).
- No MDM tooling itself — we document the managed-settings payload; fleet push is the org's MDM job.
- No non-Claude AI tools (Copilot etc.) — multi-tool stays a future decision.

## Users / Personas

- **Teammate IC**: enrolls once (settings push or one-liner), then their usage scores appear like anyone's.
- **Platform admin**: issues/rotates the org token, watches enrollment coverage, maps unmatched identities.
- **Function lead**: finally sees team-level Usage/Efficiency on real data.

## User stories

- As an IC, I want enrollment to be a one-time settings change, so being measured costs me nothing day-to-day.
- As an IC, I want a plain statement of exactly what leaves my machine (metrics and metadata, never prompt text), so I can trust the deal.
- As a platform admin, I want unmatched telemetry identities queued for resolution (never guessed), so data lands on the right person or not at all.
- As a function lead, I want the coverage line ("8 of 10 enrolled") next to team usage numbers, so gaps read as enrollment, not behavior.
- As the owner, I want my own machines migrated onto telemetry alongside the local scan, so the two paths are verified to agree before local-only is retired.

## Scope

**In scope**
- Telemetry ingest endpoint in the app (an authenticated API route accepting Claude Code's OTLP-compatible export), org-token auth, per-machine source identity.
- Identity map: telemetry account/email → employee, reusing `match_status` (matched / pending) with a resolution screen — no silent orphans, no guessed joins.
- Normalization into the existing session store (`cc_sessions`-compatible), deduped against local-scan ingestion during the overlap period.
- Enrollment coverage surface (per person: enrolled machines, last-seen) + the managed-settings payload documented for MDM push.
- Parity validation: token counts, models, session shapes from telemetry match the local parser for the same sessions.

**Out of scope**
- A standalone collector service — the app IS the collector (architecture guardrail: API route before new infra; revisit only if volume forces it).
- Prompt-quality flags computed server-side (they are computed on-machine by design; plugin arrives M9).
- Cross-person skill identity surfaces (AI Leaders UI lands with M8; the data starts accruing now).

## Functional requirements

- FR-1: A machine configured with the org token streams Claude Code telemetry to production Prism; events are accepted, validated, and stored idempotently (redelivery-safe).
- FR-2: Ingested payloads contain metrics and metadata only; any field carrying free text beyond whitelisted metadata is dropped at the boundary and the drop is logged.
- FR-3: Telemetry sessions map to employees via the identity map; unmatched identities queue as `pending` on a resolution screen and are never auto-assigned.
- FR-4: A session ingested via telemetry scores identically to the same session ingested via local scan (same KPIs, same AI→PR link eligibility); the overlap-period dedupe keeps exactly one copy.
- FR-5: Enrollment coverage renders per person (machines, last event time) and per team (coverage %); the cadence KPI drill-down references coverage so under-enrollment is visible at the point of judgment.
- FR-6: Org token can be rotated by the admin; old-token events are rejected after rotation with a clear admin-visible signal.
- FR-7: The managed-settings payload (endpoint, token reference, export settings) is documented for MDM distribution; a single developer can also enroll manually in <5 minutes.
- FR-8: Sessions from unconnected repos still count toward Usage (global sessions rule), exactly as the local path behaves today.
- FR-9: With telemetry live for the founding team, members' Usage/Efficiency KPIs move from "awaiting signal" to real numbers with no manual steps beyond enrollment + identity match.
- FR-10: The pipeline records source (local-scan vs telemetry) per session for audit; retiring the local path for enrolled machines is a config flip, not a code change.

## Non-functional requirements

- **Privacy**: the three-mechanism design is the contract — server receives outcome-side metadata only; a payload audit sample is reviewable by the admin; no prompt/code content is ever persisted (asserted by boundary tests).
- **Security**: org-token auth over TLS; tokens server-side only; per-machine source ids to contain a leaked token's blast radius until rotation.
- **Reliability**: ingest is idempotent; short outages buffer client-side (Claude Code export retry) without data loss; daily batch unaffected by ingest latency.
- **Performance / scale**: sized for ≤50 developers × daily sessions on the single app service; if sustained volume exceeds the route's comfort, the escape hatch (managed collector) is a later decision — not built speculatively.
- **Simplicity**: one API route, one identity table extension, one coverage panel. No new services.

## Open questions

- Exact Claude Code telemetry export capabilities/fields at build time (validate in W1 spike against the then-current version; the schema mapping is written against what's real, not assumed).
- Dedupe key for overlap (session id + repo expected sufficient — confirm against real telemetry ids in W1).
- Retire local scan for the owner's machines at month end, or keep both until Q1's pilot? (CPO proposal: keep both until parity holds 2 clean weeks.)

## Milestones

- W1: Spike — real telemetry export against a dev endpoint; field mapping + parity report vs local parser.
- W2: Ingest route (auth, validation, idempotency, text-drop boundary) + identity map + resolution screen.
- W3: Normalization into session store + dedupe + coverage surface + token rotation.
- W4: Founding-team enrollment, parity verification on real sessions, ship gate: members' usage KPIs live.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Telemetry export lacks a field the local parser has (e.g. pr-link marker) | med | high | W1 parity spike decides; gaps documented per-KPI as honest nulls, never approximated |
| Volume overwhelms the API-route collector | low | med | Sized target stated (≤50 devs); measured headroom in W4; escape hatch documented, not pre-built |
| Enrollment friction stalls coverage | med | med | <5-minute manual path + MDM payload; coverage panel makes gaps visible and nameable |
| Privacy trust wobbles with first teammates | med | high | What-leaves-your-machine statement in-product; payload audit sample; boundary drop-tests |

## Success metrics

- 100% of founding-team machines enrolled; coverage panel accurate against known machine count.
- Parity: telemetry vs local parser agree on tokens/model/session counts for the same sessions (≤1% drift).
- Zero free-text fields persisted (boundary audit).
- Members' Usage/Efficiency KPIs publish on real telemetry data at ship gate.

## References

- Spec: [scoring-model.md](../scoring-model.md) §4 (Claude Code row: OTLP, org token, MDM, identity map), §8 privacy mechanisms, §11 P4
- Code: `lib/connectors/claude-code/` (parser = the parity reference), `cc_sessions` schema in `supabase/migrations/`
- Consumers unblocked: cadence H0 coverage, AI Leaders data accrual (M8), coaching reach (M9)

# In-flow coaching plugin — Addendum B (M9 · Apr 2027)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §8 (Addendum B) §9 (nudge rows), [M3 PRD](2026-10-linkage-engine.md), [roadmap](README.md)

## Context / Problem

- Prism reports inefficiency after the fact; the spec's last mile is **preventing it at the moment of work**. Every diagnostic tree already names its realtime rows (C1–C6) — nothing fires them.
- The design is fully aligned (Addendum B): a Prism plugin inside Claude Code using hooks, an intervention ladder where **enrich beats nag**, need-gating on the person's own KPIs, hard anti-Clippy guardrails, and the three-mechanism privacy contract (the prompt never leaves the machine).
- Cadence rule: scoring stays daily batch; coaching triggers are realtime in-flow with a KPI profile cached at session start.

## Goals

- Rules C1–C6 run in-flow on the developer's machine, need-gated by their own KPI profile, within the ≤500ms local budget.
- The developer experience is assistance, not surveillance: enrich by default, ≤3 nudges/day, cooldowns, `/prism status` transparency, private Coaching tab.
- Managers see anonymized themes only — per-IC coaching data never leaves the individual's view (guarantee already enforced at the M8 access layer).

## Non-goals

- No Block interventions by default — Block exists only for org-agreed safety rules (C6) and ships OFF.
- No style policing; rules fire on measured need only.
- No server-side prompt analysis of any kind — evaluation is local by design, not by configuration.
- No non-Claude-Code editors this year.

## Users / Personas

- **IC developer**: receives context enrichment and occasional one-line coaching tied to their own weak KPIs; owns their private Coaching tab.
- **Function lead / manager**: sees anonymized theme aggregates ("context-gap nudges trending down") — nothing per person.
- **Platform admin**: distributes the plugin, configures C6 sensitive paths if the org opts in.

## User stories

- As an IC whose iterations KPI is weak, I want vague prompts silently enriched with repo context (C1), so the turn succeeds without me being scolded.
- As an IC, I want a nudge to reference my own measured number ("your last 3 sessions re-sent context; cache-read 8%"), so advice is personal fact, not generic tips.
- As an IC, I want `/prism status` to list exactly which rules are active for me and why, so nothing about the coaching is opaque.
- As an IC, I want dismissing a rule to keep it quiet for days, so the plugin respects my judgment.
- As a manager, I want theme-level aggregates only, so my team can trust the coaching channel enough to leave it on.

## Scope

**In scope**
- The Prism plugin for Claude Code: UserPromptSubmit / PreToolUse (+ opt-in Stop) hooks with local rule evaluation ≤500ms; Prism's backend never on the blocking path.
- KPI profile sync: per-person profile (KPI values vs targets, linkage priorities from M3) fetched and cached at session start.
- Rules C1–C6 per the spec's gate/trigger/intervention table; intervention ladder enrich → coach → flag → block(off).
- Guardrails: ≤3 nudges/day per developer, per-rule cooldowns, dismissed-rule quiet period, `/prism status`.
- Metadata-only export: `{rule_id, trigger, intervention, outcome}` events to Prism; the Coaching tab (private) renders them; anonymized themes feed the manager aggregate (M8 floor applies).
- Adoption loop: nudge outcomes re-verified from scored data (did the KPI move?), closing the loop the same way recommendations already work.

**Out of scope**
- The org `/review` skill content beyond a seeded default (teams own their checklist).
- C6 Block enablement (config exists; default OFF; enabling is an org decision with its own sign-off).
- Prompt-quality flags beyond the local flag set already specified (length, file-refs, acceptance-criteria, exploratory shape).

## Functional requirements

- FR-1: Each rule fires only when its need-gate holds (the person's own KPI below target, or linkage priority present); a developer at target sees nothing from that rule.
- FR-2: C1 (vague prompt, weak KPI 4): enrich the turn with repo context and attach the one-line front-load coach tip per spec.
- FR-3: C2 (token waste, weak KPI 6 + low cache-read): coach compact/pin-context with the context-discipline skill pointer.
- FR-4: C3 (relevant unused skill, weak harness/linkage): coach the specific skill with its measured edge phrasing.
- FR-5: C4 (diff without tests, weak KPI 7/10): coach tests/coverage reminder at diff-time.
- FR-6: C5 (edit on a never-read file — harness correctness, ungated): enrich by instructing the agent to read first; corrects the agent, not the human.
- FR-7: C6 (sensitive-path change without review/tests): flag; Block only if the org explicitly enabled it.
- FR-8: Local evaluation completes within the ≤500ms budget; on any timeout or profile-fetch failure the plugin does nothing (fail-open, never blocks work).
- FR-9: Guardrails enforced client-side: ≤3 nudges/day, per-rule cooldowns, dismissed rules quiet for N days; `/prism status` lists active rules, gates, and remaining budget.
- FR-10: Only `{rule_id, trigger, intervention, outcome}` metadata is exported; prompt text and code content never leave the machine (boundary-tested in the plugin).
- FR-11: The private Coaching tab shows the person their own coaching history and outcomes; no other role can access it (M8 denial tests extended).
- FR-12: Anonymized theme aggregates render for leads only above the minimum-N floor.
- FR-13: Nudge effectiveness is measured from scored data (KPI movement after sustained rule activity), not self-report, and feeds the rule's own tuning backlog.

## Non-functional requirements

- **Latency**: p95 local evaluation ≤500ms; zero added latency when no rule gates open.
- **Privacy**: the three-mechanism design is the product guarantee — local extraction, local evaluation, outcome-side fingerprints; audited by plugin boundary tests + payload sampling.
- **Reliability**: plugin failures are silent no-ops for the developer; the session never breaks because coaching broke.
- **Simplicity**: the plugin is a local component + one profile endpoint + one events endpoint; no new services; distribution is a settings push (same MDM rail as M6).

## Open questions

- Dismissed-rule quiet period N (proposal: 7 days) — confirm with owner.
- Nudge phrasing review: who signs off the coach-line copy deck before it ships? (CPO proposal: owner reviews the full copy set in W3 — tone decides adoption.)
- Does the C3 measured-edge phrasing require a confirmed linkage verdict, or fall back to squad-level phrasing when linkage is insufficient? (CPO proposal: confirmed-verdict phrasing only; generic phrasing otherwise.)

## Milestones

- W1: Plugin skeleton + hooks + profile sync/cache + fail-open behavior.
- W2: Rules C1–C6 + intervention ladder + guardrails + `/prism status`.
- W3: Metadata export + Coaching tab + anonymized themes + copy review.
- W4: Founding-team live trial, latency + privacy audits, act-rate baseline, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Nudge fatigue / Clippy perception kills trust | med | high | Enrich-first ladder, hard caps, cooldowns, dismissal respect, `/prism status` transparency — all launch-blocking FRs |
| Latency budget blown by profile fetch | med | med | Profile cached at session start; evaluation never awaits network; fail-open |
| Privacy skepticism among first users | med | high | Boundary tests + a published what-leaves-the-machine note; per-person data visible only to the person |
| Rules fire on stale KPI profiles | med | low | Profile timestamp shown in `/prism status`; daily refresh; need-gates use conservative thresholds |

## Success metrics

- p95 evaluation latency ≤500ms on founding-team machines.
- Zero prompt/code content in exported payloads (audit).
- Guardrail compliance: no developer exceeds 3 nudges/day (event audit).
- Act-rate baseline established (nudges followed by the nudged behavior within the session); ≥1 rule shows measured KPI movement within 60 days.

## References

- Spec: [scoring-model.md](../scoring-model.md) §8 (ladder, C1–C6, guardrails, three privacy mechanisms), §9 nudge rows, cadence rule in §1
- Inputs: KPI profiles ([M1](2026-08-core6-main-index.md)/[M2](2026-09-harness-index.md)), linkage priorities ([M3](2026-10-linkage-engine.md)), access rules ([M8](2027-03-org-rollup-dashboard.md))
- Related: adoption loop (`lib/adoption/`), recommendations (`lib/recommendations/`)

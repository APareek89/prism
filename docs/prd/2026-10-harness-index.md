# Harness Index — KPIs 12–15 (M3 · Oct 2026)

> Status: Draft
> Owner: Prism CPO
> Last updated: 2026-07-06
> Related: [scoring-model.md](../scoring-model.md) §2 §5 (Harness-4) §11 P2, [roadmap](README.md), [M1 PRD](2026-08-core6-main-index.md)

## Context / Problem

- v3.0's headline decision is the **two-index structure**: proficiency is a driver, not a sibling outcome — inside the main index it double-counts. M1 shipped the MAIN index; the HARNESS index does not exist in code yet.
- The evidence is **already on disk**: session logs contain every tool call, skill invocation, and file read. This month is parser extensions, not new integrations (build order P2).
- Without the Harness index, the linkage engine (M4) has nothing to correlate and coaching (M11) has no need-gates for practice rules.

## Goals

- A separate 0–100 HARNESS index (KPIs 12–15, equal weights, own confidence, **no bands**) publishes on real dogfood sessions.
- Every harness credit is backed by **real execution evidence** — the anti-gaming rule is enforced by construction.
- Harness renders alongside outcomes ("harness up, outcomes flat" is itself a diagnostic) but **never mixes into the MAIN number**.

## Non-goals

- No linkage engine (M4) — this month produces the practice scores, not the harness→outcome proof.
- No realtime nudges (M11); the KPIs list their future coaching hooks but nothing fires.
- No telemetry — local session logs only.
- No merge of KPIs 13+14 (open decision; revisit after first real data).

## Users / Personas

- **IC developer**: sees which practices they've installed (skills, verification, review loop, continuity) and where credit was denied for lack of evidence.
- **Function lead**: sees team-level practice adoption without any per-prompt content.
- **Product owner**: calibrates the proposed KPI 14/15 anchors against first real data.

## User stories

- As an IC, I want my verification habit measured from what actually ran (command, duration, exit code), so the score reflects practice, not box-ticking.
- As an IC, I want a repo with no test infrastructure to mark categories inapplicable rather than score me low, so I'm never penalized for a repo gap.
- As a function lead, I want to see harness scores next to outcome scores, so I can spot "practices installed but outcomes flat" and vice versa.
- As the product owner, I want detector maturity to gate publication via confidence, so immature detectors don't socialize wrong practice scores.

## Scope

**In scope**
- Parser extensions over existing session logs: tool-call → harness-category classifier (V1–V4) with execution evidence; review-pass detector (V5) with theater guard; context-file read events at session start.
- KPI 12 (distinct skills authored, invoked ≥1× with real output), KPI 13 (verification rate + breadth), KPI 14 (review-loop rate), KPI 15 (context continuity rate).
- Repo applicability map (a repo without tests never penalizes its devs — it flags the repo).
- Harness index panel in all views + drill-downs listing per-session evidence.

**Out of scope**
- CI corroboration via Checks permission (P5 enrichment).
- Org-wide skill registry / cross-person skill identity (needs telemetry, M7).
- The 70/30 rate/breadth blend for KPI 13 (post-calibration decision).

## Functional requirements

- FR-1: HARNESS index = mean of KPIs 12–15 (equal weights), published separately with its own confidence gate; no bands, never combined with MAIN.
- FR-2: Session tool calls are classified into harness categories V1 build · V2 tests · V3 lint/typecheck · V4 runtime check, each requiring captured execution evidence (matching call + duration/exit) to count.
- FR-3: KPI 13 publishes RATE (verified AI PRs ÷ AI PRs, verification timestamp before pr-link timestamp) and BREADTH (categories used ÷ categories applicable) as separate figures until the blend is calibrated.
- FR-4: A category counts as applicable only if the repo supports it; inapplicable categories are excluded from breadth and surfaced as a repo-level flag, not a person-level penalty.
- FR-5: KPI 14 counts a review pass only when followed by a diff change or an explicit recorded "no findings" (theater guard); passes without either earn no credit.
- FR-6: KPI 15 counts a session warm-started only on evidence of a context-file read (CLAUDE.md / handoff / memory) at session start — not an incidental file open mid-session.
- FR-7: KPI 12 counts a skill only when authored AND invoked ≥1× with real output; empty skill files earn nothing; "many skills, zero use" renders as a flag.
- FR-8: Every harness KPI with no denominator renders null ("awaiting signal"), never 0.
- FR-9: Per-KPI drill-down lists the underlying evidence per session (category, command class, duration/exit, timestamps) — metadata only, never prompt text or code content.
- FR-10: Detector maturity gates publication through the index's confidence, not through hidden exclusions; low-maturity detectors render the index as low-confidence with the reason stated.
- FR-11: The dogfood org's HARNESS index publishes after a full pipeline re-run over the existing session corpus (no new data required).
- FR-12: Insight agents narrate harness alongside outcomes; the "harness up, outcomes flat" pattern is a first-class narration case.

## Non-functional requirements

- **Privacy**: classification happens over metadata already local; only category/evidence flags are stored — no prompt text, no code content.
- **Determinism**: classifier rules are versioned and pure; same session file → same categories; scoring tests extended.
- **Performance**: full-corpus reparse (≈300 sessions) completes in <10 minutes; incremental parse per pipeline run <1 minute.
- **Simplicity**: parser extensions + one new panel; no new services, no new tables beyond additive migrations (0030+ range).

## Open questions

- KPI 14/15 anchors (20/70 and 30/80) are proposed defaults — calibrate in W4 with real data before socializing (scoring-model §12-2).
- KPI 13 rate/breadth blend (proposed 70/30) — decide after first month of real data (§12-7).
- Do KPIs 13 and 14 prove redundant on dogfood data? If correlation ≈1, propose the merge (§12-4) for owner decision — not this month.

## Milestones

- W1: Harness-category classifier (V1–V4) + execution-evidence capture + tests.
- W2: Review-pass detector with theater guard + context-read events + applicability map.
- W3: KPI computation + HARNESS index + confidence gate + UI panel and drill-downs.
- W4: Full-corpus re-run on dogfood data, detector precision audit, anchor calibration review, ship gate.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Classifier misses real verification (false "unverified") | med | med | Precision/recall audit on a hand-labeled sample of dogfood sessions in W4; confidence reflects maturity |
| Review-pass detector too narrow (invisible manual re-reads) | high | low | Known limitation stated in-UI; H0 row of the KPI 14 tree; extend detector patterns iteratively |
| Practice scores socialize before anchors are calibrated | med | high | Flagged-anchor chips + owner review gate (same discipline as M1) |
| Gaming via trivial runs (e.g. `true` as a "test") | low | med | Command-class allowlists + duration>0 + evidence display makes gaming visible in drill-down |

## Success metrics

- HARNESS index publishes for the dogfood employee with stated confidence.
- ≥90% of sessions in connected repos are classified (categories or explicit none) — coverage audit.
- Detector precision ≥80% on the W4 hand-labeled sample (verification + review-pass).
- Zero harness credit without stored execution evidence (audit query).

## References

- Spec: [scoring-model.md](../scoring-model.md) — Harness-4 table + backend notes, §11 P2 row, anti-gaming rule
- Code: `lib/connectors/claude-code/parser.ts` (extension point), `lib/scoring/`, session corpus at `~/.claude`
- Diagnostic trees for 12–15: scoring-model §9

# Design-partner outreach — the live action

> Status: ACTIVE. This is month 1 of [next-6-months.md](next-6-months.md).
> Kill criterion: **<4 of 20 CTOs ask to see the statement on their own data → stop and reframe the wedge.**
> Funnel target: 20 contacted → ~8 conversations → 5 installs → 3 statements delivered → payment-intent probe.

## Target profile (all five, or don't spend the slot)

1. 20–200 engineers (big enough for the number to matter, small enough to decide fast).
2. Real AI-agent usage already (Claude Code, Cursor, or Copilot in daily use — not "exploring").
3. GitHub-hosted delivery (our outcome rails).
4. A named human who owns either the AI bill or the "is this working?" question (CTO, VP Eng, platform lead).
5. Warm-reachable (intro ≤1 hop). Cold slots only after warm slots are exhausted.

**Disqualifiers:** AI usage that is one enthusiast, not a team; GitLab/self-hosted-only (year-two); anyone who wants a scoring tool for performance reviews (wrong buyer — politely decline; it poisons A3).

## The note (four sentences, send as-is)

> We built Prism because we couldn't answer a question our own board kept asking: is the AI
> spend actually making the engineering better? Prism reads exhaust you already have —
> GitHub, your AI coding tools, your AI invoices — and produces a one-page, evidence-graded
> answer: what AI touched, what it cost, and whether the work held up, with a confidence
> label on every number and "insufficient data" where that's the honest answer. We're taking
> five design partners this quarter: read-only access, your statement generated on your real
> data within two weeks, a 30-minute readout, free — we get your skepticism in return. If the
> statement isn't something you'd forward to your CFO, that's exactly the feedback we need.

## The deal (say it exactly, keep it symmetric)

- **They give:** read-only GitHub App install; AI-tool usage export (or telemetry opt-in later); provider billing read scope when the cost page lands; 30 minutes of blunt reaction; permission to count their verified deltas anonymously.
- **They get:** the monthly ROI statement on their real data; the drill-downs behind every number; first access to the cost lane; zero charge for two quarters; veto on anything shared.
- **Explicitly promised:** no per-developer scores shown to managers, no league tables, prompt/code content never leaves their machines. (Lead with the privacy line — A3 dies in the first meeting or not at all.)

## Tracking (update weekly; this table IS the status report)

| Org | Contact | Intro path | Sent | Convo | Install | Statement | Reaction | Payment-intent |
|---|---|---|---|---|---|---|---|---|
| 1–20 | … | … | ☐ | ☐ | ☐ | ☐ | … | ☐ |

## What we are actually measuring (not vanity)

- **Demand:** how many ask for it on their data (the month-1 kill criterion).
- **Friction:** the exact sentence used when access is refused (≥3 repeats of the same reason = the product problem, per month-2 kill).
- **A3 signal:** does the champion bring an engineer to the readout, or hide it from them?
- **Day-zero countdown:** which partner is closest to the first verified delta ([operating-principle.md](operating-principle.md)) — that org gets disproportionate attention, by policy.

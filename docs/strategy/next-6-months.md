# The next six months — experiments, not features

> Status: GOVERNS sequencing (adopted 2026-07-06). The [12-month roadmap](../prd/README.md)
> is the build library this plan pulls from — PRDs get executed when an experiment demands
> them, never on autopilot.
> Operating metric: verified deltas/month ([operating-principle.md](operating-principle.md)).

## The plan — each month kills an assumption

| Month | Ship | Experiment it runs | Kill / pivot criterion |
|---|---|---|---|
| 1 | Link integrity + graph ledger (edges carry method/confidence) + **ROI statement v0** on dogfood. (Pulls trimmed [M1 PRD](../prd/2026-08-core6-main-index.md): the 3 load-bearing numbers — AI-assisted share, reverts vs human baseline, tokens/PR. No bands, no composite index.) **+ Codex ingestion** (owner override 2026-07-06: local Codex session logs as a parser variant on the existing claude-code rails; sessions carry a `source` tag; links fall back to branch/sha/coauthor — lower confidence shown honestly, since Codex has no `pr-link` event) | Send the statement to 20 CTOs ([outreach doc](design-partner-outreach.md)): demand smoke test — now with two-agent coverage | <4 of 20 ask to see it on their own data → reframe the wedge before building anything else |
| 2 | Run-cost stage ① (pulls [M2 PRD](../prd/2026-09-run-cost-visibility.md)) + **5 design partners signed, concierge-onboarded** (no wizard — founder does CSV imports personally) | Will orgs grant read access to bills + GitHub? (the real friction test) | Access refused ≥3× for the same reason → that reason IS the product problem; stop and fix it |
| 3 | Partners' ROI statements on their real data + the AI-vs-human control | Attribution fidelity on messy repos (monorepos, squash merges), audited with partner engineers | Link precision <80% → stop scaling, fix the graph |
| 4 | Lossy multi-tool ingest, next tool by partner demand (**Cursor** likely — admin/usage API, weak PR linkage; or Copilot metrics import) | Does blended coverage change the buyer conversation? (neutrality test) | If two-agent coverage (Claude + Codex) doesn't block deals → defer; if it does → this becomes the top lane |
| 5 | **One verified-delta loop end-to-end** (model routing *or* dormant seats: recommend → partner acts → verify on next bill) | Does verification convert to payment intent? **This is day zero of the corpus** | Verified savings that don't move willingness-to-pay → the loop is a feature, not the wedge |
| 6 | Price it: 3 paid pilots | The only experiment that matters | Zero paid at any price → execute a pivot branch below, per what partners actually valued |

## The assumption ledger (ranked by death probability, from the IC review)

| # | Assumption | P(false & fatal) | Killed by |
|---|---|---|---|
| A1 | Someone pays for AI ROI measurement standalone (vs expecting it free from GitHub/Datadog/vendor) | ~40% | Months 1, 6 |
| A2 | Claude-Code-only data plane is an acceptable beachhead in a Copilot/Cursor-mixed world | ~35% | Partially de-risked in Month 1 (Codex, owner override); Cursor/Copilot decided by partner tool mix in Month 4 |
| A3 | Developers tolerate being measured; the champion survives the politics | ~25% | Months 2–3 (partner behavior) |
| A4 | Attribution precision survives real-world repo mess | ~20% | Month 3 |
| A5 | A solo technical founder can run a CFO-adjacent sale | ~20% | Months 2, 6 |
| A6 | Customers adopt gateway tagging | ~15% (degrades, not kills) | Month 5+ |
| A7 | Within-person linkage reaches significance at realistic N | ~5% (kills a feature) | Post-corpus |

## Pivot branches (pre-agreed, from IC Parts 10–12)

- **Nobody cares about developer measurement** → AI spend governance: the run-cost lane becomes the company; the differentiator is the verified-savings loop (nobody in FinOps closes it). Architecture transfers nearly intact.
- **They love cost, ignore coaching/workforce** → AI FinOps: pricing indexed to AI spend under management; workforce machinery survives as the sales-differentiating "training problem vs procurement problem" module.
- **They love coaching, ignore cost** → weakest branch: coaching is a feature the agent vendors will ship natively. If this is the signal, prove coached-teams-ship-better with the linkage engine and sell the company early.

## Cadence

- **Weekly:** count progress in verified-delta pipeline terms (CTOs contacted → conversations → installs → statements → actions → verifications). Nothing else is a status update.
- **Monthly:** kill-or-continue review against the criteria above; update this doc and handoff.
- **Standing rule:** anything not on this table needs the [decision rule](operating-principle.md) run against it, in writing, before it gets built.

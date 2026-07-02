# Prism scoring model — canonical reference

> The aligned source of truth for **what** Prism measures, **how** the index is computed, and
> **how each KPI is diagnosed**. Non-technical first; formulas and anchors match the engine
> (`lib/scoring`) exactly. Keep this doc current whenever the model changes — weights, anchors,
> KPI set, or diagnostic trees. Last aligned with the product owner: **2026-07-02**.

---

## 1. The model in one paragraph

Prism watches three systems a team already uses — GitHub (delivery), Claude Code (AI usage),
Sentry (reliability) — and distills a trailing **28-day** window of real activity into **one
0–100 index** (the AI-Native Index). It answers four questions: *Are we using AI? Is it making
us faster/cheaper? Is the AI-assisted work actually good? Are we compounding skill?* Every
number is deterministic, computed from real ingested data — no surveys, no estimates, no
fabricated values. An LLM writes the plain-English commentary but is **forbidden from
computing or altering any number** (the determinism boundary).

## 2. The four dimensions — and the rule that makes them MECE

| Dimension | The question | Where it's observed | Weight |
|---|---|---|---|
| **Usage** | Do you use AI? | Footprint — how often/deep AI shows up in the work | 10% |
| **Efficiency** | What did output *cost*? | **During the work, before merge** — cycles, waste, tokens | 25% |
| **Effectiveness** | Did what shipped *hold up*? | **After merge, in the real world** — reverts, survival, incidents | 40% |
| **Proficiency** | Are you *compounding*? | Reusable artifacts — skills built, reused, spread to others | 25% |

**The sorting rule (non-negotiable):** file each KPI by **where in the work's life the number
is observed — never by what skill causes it**. Prompting well improves *every* KPI (fewer
iterations, fewer tokens, fewer reverts); skill is the common cause of everything. If KPIs were
filed by cause, all 13 would collapse into one bucket and the index would lose its diagnostic
power. The merge is the dividing line: before it = Efficiency (cost of production), after it =
Effectiveness (quality of outcome).

The proof-by-symmetry: "did the AI's output hold up" measured **at commit** (AI lines kept when
committing) is pre-merge waste → Efficiency; the same question measured **at 30 days** (AI
lines still alive) is post-merge durability → Effectiveness. Same question, two checkpoints,
two dimensions.

**Proposed display renames (open decision):** both casual readers and the product owner
initially parsed "Effectiveness" as *"using AI effectively/smartly"* — evidence the label
misleads. Proposal: display **Effectiveness → "Outcomes"** and **Proficiency → "Mastery &
leverage"**. Internal ids unchanged; UI copy only.

## 3. Data sources — what we capture and how

| Source | Question it answers | Input data captured | How integrated | Powers |
|---|---|---|---|---|
| **GitHub** | What did we ship? | Repos · PRs (author, merge time, size, branch) · commits incl. `Co-authored-by: Claude` trailers · reverts · diffs (files/lines) | Prism GitHub App on selected repos → webhooks + backfill | Delivery, size, reverts, rework |
| **Claude Code** | How did we use AI? | Per-session: turns, tokens (in/out/cache), model, tools/skills used, repo + branch, prompt-length metadata, **`pr-link` marker** (which PR the session opened) | Today: local `~/.claude` session logs. Org-wide: streamed telemetry (designed, not built) | Usage, cost, skills, the AI→PR link |
| **Sentry** | Did it break? | Releases (deploys) · issues/incidents (start, resolution, severity, linked release) | API token → scheduled pull | Change-failure, MTTR |

**Privacy default:** metrics and metadata only — **never prompt text or source code content**.

## 4. The AI→PR link — the connective tissue

Matching *"the Claude session that did the work"* to *"the merged PR"* is what makes a PR count
as AI-assisted — which unlocks most of the index. Strongest match wins:

| Method | How it matches | Confidence |
|---|---|---|
| **pr_link** | Claude Code's own first-party record of which PR the session opened (exact) | 0.99 |
| **sha** | The merged commit fingerprint appears in the session | 0.95 |
| **branch** | Session branch = PR head branch | 0.80 |
| **coauthor** | PR commits carry the `Co-authored-by: Claude` trailer | 0.60 |

A wrong link corrupts Effectiveness/Efficiency, so precision beats recall: weak methods are
repo-scoped, and the open follow-up is to suppress the coauthor fallback when an exact
`pr_link` already covers a PR (see `handoff.md`).

## 5. How the index is computed (step by step)

1. **Gather** 28 days of activity per person (90 days for PR-size calibration).
2. **Compute each KPI's raw value** — e.g. "8 of 10 merged PRs AI-assisted → 0.8". No
   denominator → `null` (honest no-signal, never 0-by-default).
3. **Normalize to 0–100 against anchors**: at/below floor → 0, at/above target → 100,
   proportional between. **No bonus beyond target.** Lower-is-better KPIs flip (at/below
   target → 100, at/above ceiling → 0).
4. **Dimension scores (L2)** = weighted mean of that dimension's normalized KPIs.
5. **Index (L1)** = 0.10·Usage + 0.25·Efficiency + 0.40·Effectiveness + 0.25·Proficiency
   (re-normalized over dimensions that have signal).
6. **Gates** (sanity rules on the band):
   - **L0 gate:** AI-active share (AI-linked merged ÷ merged) **< 0.15 forces L0 Dormant**,
     whatever the L1 number.
   - **L5 gate:** the top band requires multiplier signal ≥ 1 (someone else uses your skill),
     else caps at L4.
7. **Confidence**: too little signal → the index is suppressed and shown as *Insufficient*
   (publish floor 0.40). Small cohorts (N < 8) drop one confidence band.
8. **Narration**: LangGraph agents write "what's going well / what to improve" strictly
   grounded in the computed numbers; any invented figure is stripped and the item dropped.

**Bands:** L0 Dormant → L1 Basic (1–34) → L2 Productive (35–54) → L3 Workflow (55–69) →
L4 Power (70–84) → L5 Multiplier (85–100).

**Worked examples:** AI-assisted share 10/10 = 100% → above the 1.0 target → **100 pts**.
Average 6 turns per merged PR → between target 3 and ceiling 12 → (12−6)÷(12−3) → **67 pts**.

## 6. KPI reference — the 13 measurements

Legend: **↑** higher is better · **↓** lower is better (inverted) · status = live / pending /
dormant as of 2026-07-02.

### Usage — do you use AI? (10%)

| KPI | Plain question | Formula (words) | 0 pts | 100 pts | Dir | Status |
|---|---|---|---|---|---|---|
| AI-assisted PR share | What share of shipped work did AI touch? | AI-linked merged PRs ÷ merged PRs | ≤50% | 100% | ↑ | live |
| Agentic depth share | How often is AI the *majority* author? | PRs where ≥50% of kept changes are AI ÷ merged PRs | ≤30% | ≥80% | ↑ | pending (needs line-level AI attribution) |
| Session cadence | Habit or occasional toy? | days with a Claude session ÷ working days | ≤30% | ≥80% | ↑ | live |

### Efficiency — what does output cost? (25%, observed before merge)

| KPI | Plain question | Formula (words) | 0 pts | 100 pts | Dir | Status |
|---|---|---|---|---|---|---|
| AI iterations to merge | Back-and-forths to land a PR? | mean session turns per merged PR, compared **within S/M/L size class**, then bucket means averaged | ≥12 | ≤3 | ↓ | live (needs exact links) |
| Suggestion acceptance | How much AI output is thrown away? | accepted ÷ offered — *proposed redefinition: AI lines kept at commit ÷ AI lines written* | ≤40% | ≥80% | ↑ | **dormant** (agentic tools emit no accept/reject events) |
| Tokens to shipped | AI spend per shipped PR | all session tokens ÷ merged PRs | ≥90k | ≤30k | ↓ | live (skewed by global scan — known issue) |

The size-class rule on iterations is anti-gaming: big PRs legitimately need more turns, so PRs
are compared small-with-small, large-with-large — you can't win by only shipping tiny PRs.

### Effectiveness ("Outcomes") — did it hold up? (40%, observed after merge)

| KPI | Plain question | Formula (words) | 0 pts | 100 pts | Dir | Status |
|---|---|---|---|---|---|---|
| Merged without revert | Did AI work stick? | 1 − (AI PRs reverted ≤14d ÷ AI merged PRs); self-caught reverts excluded | ≤80% | ≥98% | ↑ | live |
| AI-code retention @30d | Alive a month later? | AI lines alive at day 30 ÷ AI lines merged | ≤20% | ≥70% | ↑ | pending (needs 30d maturity; premature-0 fix queued) |
| Change-failure rate | Did AI deploys cause incidents? | failed AI deploys ÷ AI deploys | ≥30% | ≤5% | ↓ | needs Sentry |
| Defect-rework rate | Ship it, then patch it? | fix-type follow-ups on the same code ≤14d ÷ merged PRs | ≥30% | ≤5% | ↓ | live |

### Proficiency ("Mastery & leverage") — are you compounding? (25%)

| KPI | Plain question | Formula (words) | 0 pts | 100 pts | Dir | Status |
|---|---|---|---|---|---|---|
| Effective skill leverage | Do saved skills actually *help*? | mean retention of skill-built PRs − mean retention of non-skill PRs (needs both groups; else null) | 0 edge | +20-pt edge | ↑ | pending |
| Distinct skills authored | Know-how → reusable assets? | count of distinct skills authored | 0 | 3 | ↑ | live |
| Multiplier signal | Does your leverage lift others? | authored skills used by ≥1 *other* person | 0 | 1 | ↑ | live; **gates L5** |

## 7. Anchor review checklist (open decision)

5 anchors are PRD-pinned; **8 are flagged defaults** — our judgment calls, admin-editable, and
they deserve a deliberate team review before scores are socialized (a wrong target quietly
makes everyone look better or worse than reality):

| Flagged anchor | Current default |
|---|---|
| Agentic depth share | floor 30% / target 80% |
| Session cadence | floor 30% / target 80% |
| Suggestion acceptance | floor 40% / target 80% |
| Merged without revert | floor 80% / target 98% |
| Change-failure rate | target 5% / ceiling 30% |
| Defect-rework rate | target 5% / ceiling 30% |
| Distinct skills authored | 0 → 3 saturates |
| Multiplier signal | 0 → 1 saturates |

Pinned (PRD §4.4): AI-assisted share (.5→1.0) · iterations (3→12) · retention (.2→.7) ·
tokens/PR (30k→90k) · skill leverage (0→+0.2).

## 8. Known MECE caveats (kept deliberately, stated honestly)

1. **Revert vs retention double-count.** A reverted PR's lines are also dead at 30d — one
   catastrophic failure dings two Effectiveness KPIs. Kept: they measure different failure
   modes (PR-level undo vs line-level erosion) and average within one dimension, so it dampens
   rather than distorts. But one revert hits Outcomes ~2× harder than naively expected.
2. **Skill leverage borrows the Outcomes ruler.** It uses retention as its yardstick, but the
   *measured quantity* is the delta attributable to skills — a leverage number. Clean in
   principle; said out loud here.
3. **Tokens and iterations correlate** — both track "effort to done" (compute cost vs cycles).
   Two lenses on cost; both stay in Efficiency, so no cross-dimension leakage.

## 9. Diagnostic trees — KPI → hypotheses → data

This is the diagnostic layer: the difference between a scoreboard ("Efficiency is 40") and a
product ("Efficiency is 40 *because* you re-feed context every session — here's the fix").

**Design principle — every tree starts with H0: "Is the number even real?"** Three of the four
issues found in Prism's own dogfooding were measurement artifacts, not behavior (a linking bug
showed 0% AI-share while 100% of PRs were AI-built; global-scan scope skew showed 9.2M
tokens/PR; a maturity bug showed retention 0). A diagnostic that skips H0 coaches people on
problems they don't have.

Data-source tags: `[have]` already captured · `[telemetry]` needs org telemetry · `[scm+]`
deeper GitHub/CI pull (reviews, labels, checks) · `[audit]` human spot-check of a sample ·
`[ask]` qualitative/survey.

### Usage

**1 · AI-assisted PR share** — low = AI touches little of what ships

- **H0 — Link failure, not low usage** *(hit live: 0% while every PR was AI-built)*
  - Data: unlinked merged PRs vs same-repo sessions in the window; link-method coverage per PR. `[have]` + `[audit]`
- **H1 — Adoption gap: some people rarely use AI**
  - Data: per-person session count vs per-person merged PRs. `[have]`
- **H2 — Selective use: AI for greenfield, not legacy/critical code**
  - Data: AI vs non-AI PRs by module/path, size, repo age. `[have]` + `[scm+]` labels
- **H3 — Access friction: no seat, policy blocks**
  - Data: license/seat inventory vs roster; per-repo policy list. vendor admin API + `[ask]`

**2 · Agentic depth share** — low = AI drafts, humans do the heavy lifting

- **H0 — Line-level AI authorship isn't captured at all** (current state)
  - Data: per-session edit events diffed against the final commit. `[telemetry]` (prerequisite)
- **H1 — Low trust: AI writes, humans rewrite most of it**
  - Data: AI lines written vs surviving to commit, per PR. `[telemetry]`
- **H2 — Shallow delegation: AI only gets boilerplate/tests/docs**
  - Data: file-type mix of AI-majority vs human-majority changes. `[have]` once H0 lands
- **H3 — Task mix: mostly tiny fixes where deep delegation isn't sensible**
  - Data: depth by PR size bucket and type label. `[have]` + `[scm+]`

**3 · Session cadence** — low = AI isn't a habit

- **H0 — Capture gap: other machines/IDEs invisible** (single-machine scan today)
  - Data: telemetry enrollment inventory vs roster. `[telemetry]`
- **H1 — Habit not formed: bursts then long gaps**
  - Data: streak/gap pattern per person, day-of-week shape. `[have]`
- **H2 — Wrong denominator: "working days" included non-coding days**
  - Data: days with any commit/PR/review activity as the true baseline. `[have]` + `[scm+]`
- **H3 — Quota/limit hit: wanted to use it, got capped**
  - Data: usage-limit events, seat tier. vendor admin API

### Efficiency

**4 · AI iterations to merge** — high = many back-and-forths per PR

- **H0 — Over-linking inflates turns** *(hit live: unrelated sessions cartesian-linked to PRs)*
  - Data: per-PR linked sessions with method + confidence; restrict this KPI to exact links. `[have]` + `[audit]`
- **H1 — Vague first prompts: intent emerges through correction**
  - Data: first-prompt length/structure vs total turns (**metadata only, never prompt text**). `[have]`
- **H2 — Missing context: no CLAUDE.md/skills, AI guesses wrong**
  - Data: turns on repos with context files vs without; skill-using vs not. `[have]`
- **H3 — Genuinely complex work** (rule *in*, don't assume)
  - Data: residual turns after size-class normalization, by module. `[have]`
- **H4 — Model mismatch: small model on hard tasks**
  - Data: turns by model per size class. `[have]`

**5 · Suggestion acceptance / AI edit survival** — low = much AI output thrown away

- **H0 — No capture exists** (dormant; agentic tools have no accept/reject events)
  - Data: session edit events vs committed diff. `[telemetry]` (prerequisite for all below)
- **H1 — Over-generation: AI produces more than asked, humans trim**
  - Data: written-vs-kept ratio per session, by task type. `[telemetry]`
- **H2 — Style/convention mismatch, not correctness**
  - Data: classify discarded chunks — lint/style vs logic rewrites. `[telemetry]` + `[audit]`
- **H3 — Context quality: survival higher on skill-backed sessions**
  - Data: survival split by skill usage. `[telemetry]` + `[have]`

**6 · Tokens to shipped** — high = expensive per unit of delivery

- **H0 — Scope skew: usage counted from repos whose delivery isn't** *(hit live: 9.2M/PR)*
  - Data: tokens split by repo, connected vs unconnected. `[have]`
- **H1 — Exploration vs delivery: tokens on sessions that never ship** (not necessarily waste — but must be *visible*)
  - Data: tokens in sessions with no linked PR vs linked. `[have]`
- **H2 — Context waste: re-feeding instead of caching**
  - Data: cache-read share; cache-creation ÷ input per session. `[have]`
- **H3 — Model choice: premium model for routine tasks**
  - Data: token cost by model × task size. `[have]`
- **H4 — Dead-end loops: high-token sessions producing nothing**
  - Data: top-decile token sessions joined to outcomes. `[have]`

### Effectiveness (Outcomes)

**7 · Merged without revert** — low = AI work gets undone

- **H0 — Revert detection wrong** (revert-of-revert, unrelated, self-revert miscount)
  - Data: audit each detected revert — commit, author, stated reason. `[audit]`
- **H1 — Rubber-stamp reviews on AI PRs**
  - Data: review depth (approvals, comments, time-to-approve) reverted vs surviving. `[scm+]`
- **H2 — Missing tests on reverted PRs**
  - Data: test presence / coverage delta reverted vs surviving. `[scm+]` (CI)
- **H3 — Risk clustering in fragile modules**
  - Data: revert rate by module and blast-radius flag. `[have]`
- **H4 — Pressure pattern: Friday/release-week merges revert more**
  - Data: merge timestamp vs revert incidence. `[have]`

**8 · AI-code retention @30d** — low = AI code doesn't survive a month

- **H0 — "Dead" mismeasured: moved/renamed counted as deleted** *(plus the premature-0 bug)*
  - Data: classify disappeared lines — deleted vs moved vs reformatted (follow the line via blame history). `[have]` + capture upgrade
- **H1 — Intentional churn: prototypes/experiments meant to be replaced**
  - Data: retention by PR type/label. `[scm+]`
- **H2 — Quality erosion: rewritten because wrong/unidiomatic**
  - Data: who replaced the lines, how soon, commit type of replacement. `[have]` + `[scm+]`
- **H3 — Hot-path noise: that code churns for *everyone*** ← the control-group question
  - Data: retention of **human** lines in the same files as baseline. capture change needed — blame snapshots currently track AI lines only

**9 · Change-failure rate** — high = AI deploys cause incidents

- **H0 — Attribution missing: releases lack SHAs, incidents lack release links** (#1 blocker)
  - Data: % releases with commit refs; % incidents resolvable to a deploy. `[audit]` of Sentry hygiene
- **H1 — Pre-prod gap: failures tests should have caught**
  - Data: incident type vs CI status/coverage of the changed area. `[scm+]` + Sentry
- **H2 — AI blind spots: failures cluster in AI-majority changes** (control again)
  - Data: failure rate AI-majority vs human-majority deploys. cross-source join
- **H3 — Batch blur: one "failed deploy" contained many PRs, AI blamed collectively**
  - Data: PRs per release; flag multi-PR deploys as low-attribution. Sentry release contents

**10 · Defect-rework rate** — high = ship it, then patch it

- **H0 — "Fix" detection noisy** (typo commits, unrelated fixes on same lines)
  - Data: audit sample of (original → rework) pairs. `[audit]`
- **H1 — Knowingly partial ships: TODOs merged, finished later**
  - Data: TODO/FIXME density in original diff; same-author follow-up within days. `[have]`
- **H2 — Post-merge review: rework follows late review comments**
  - Data: rework preceded by PR comments / linked issues. `[scm+]`
- **H3 — AI slop specifically: rework concentrates on AI-majority PRs**
  - Data: rework rate by AI-share of PR. `[have]` once depth capture lands

### Proficiency (Mastery & leverage)

**11 · Effective skill leverage** — no edge = skills aren't paying off

- **H0 — Not computable: too few skill-PRs or non-skill-PRs** (needs both groups; null today)
  - Data: group sizes; report *insufficient* honestly until both exist. `[have]`
- **H1 — Trivial skills: exist but encode nothing**
  - Data: per-skill outcome edge — which skills help, which hurt. `[have]` + skill registry
- **H2 — Wrong skill for the task**
  - Data: skill × task-type outcome matrix. `[have]` once per-skill joins exist
- **H3 — Stale skills: written for an old codebase state**
  - Data: skill age / last-update vs recent edge. `[scm+]`

**12 · Distinct skills authored** — low = know-how never becomes an asset

- **H0 — Skills exist outside captured paths** (personal dotfiles, other repos)
  - Data: skill *invocations* referencing skills never seen authored. `[telemetry]`
- **H1 — Repeat problems solved ad-hoc: same intent prompted repeatedly**
  - Data: recurring similar sessions with no skill use (metadata clustering, not prompt text). `[have]` approx / `[telemetry]` better
- **H2 — No incentive/time to codify**
  - Data: authored-skills vs workload; team norms. `[ask]`
- **H3 — Feature unknown**
  - Data: cohort with zero skill usage AND zero authorship. `[have]` + onboarding check

**13 · Multiplier signal** — 0 = nobody benefits from your assets

- **H0 — Cross-person usage not attributable** (local capture only knows "self")
  - Data: skill-invocation events with user identity. `[telemetry]` (hard prerequisite)
- **H1 — Not discoverable: personal folders, no shared registry**
  - Data: where skill files live (personal vs shared repo). `[scm+]` repo scan
- **H2 — Too personal: hyper-specific to the author's setup**
  - Data: reuse rate vs skill generality (parameterized? documented?). `[audit]`
- **H3 — No sharing loop: never announced, adoption never happens**
  - Data: adoption before/after sharing moments. optional Slack/docs source + `[ask]`

## 10. Cross-cutting design findings

1. **The control-group gap (biggest).** Several Outcome hypotheses (8-H3, 9-H2, 10-H3) are
   unanswerable without the **human baseline** — retention of human lines, failure rate of
   human deploys, rework on human PRs. Today outcomes are captured for AI work only. Decision:
   capture the same outcome data for non-AI work — *not to score people on it, but as the
   control* that makes "AI code retains 60%" mean something.
2. **Telemetry is the unlock for depth, not just scale.** `[telemetry]` gates KPIs 2, 3, 5
   entirely and the best hypotheses of 12–13. Org telemetry isn't just "connect more
   engineers" — it makes half the diagnostic tree testable.
3. **Privacy policy line:** every prompting hypothesis is testable with *metadata* (lengths,
   counts, patterns). Prism never needs prompt *content*. Commit to this before a team sees
   the product.

These trees are the roadmap for the insight agents: walk H0 first, discriminate between
behavior hypotheses using the listed data, and only then recommend — turning "improvement
areas" from correlational into causal.

## 11. Open decisions (alignment backlog)

| # | Decision | Status |
|---|---|---|
| 1 | Display renames: Effectiveness → "Outcomes", Proficiency → "Mastery & leverage" | proposed |
| 2 | Redefine suggestion-acceptance as **AI edit survival to commit** when telemetry lands | proposed |
| 3 | Review the **8 flagged anchors** (§7) with the team before socializing scores | open |
| 4 | Capture **human-baseline outcomes** (control group) — blame/deploys/rework for non-AI work | open |
| 5 | Org **telemetry** design (collector + managed config + account→employee mapping) | open |
| 6 | Suppress coauthor fallback when `pr_link` covers a PR; de-dupe cwd-split sessions | queued (handoff) |
| 7 | Retention premature-0 → pending/null until 30d maturity | queued (handoff) |

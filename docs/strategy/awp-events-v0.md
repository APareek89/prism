# AWP events — draft v0.1 (extraction, not invention)

> Status: Draft spec extracted from what Prism already emits/parses today. No new build
> implied. This file exists so the schema is public and versioned — the difference between
> having discussed a protocol and having started one.
> Scope for v0.1: TWO events only (`awp.link`, `awp.verify`). The rest ([sketch](awp-protocol-sketch.md)) waits for a second independent emitter.

## Envelope (all events)

| Field | Type | Rules |
|---|---|---|
| `event` | string | `awp.link` \| `awp.verify` (v0.1) |
| `spec` | string | `"0.1"` |
| `time` | RFC3339 | contemporaneous — consumers MAY reject events older than 24h at receipt |
| `actor` | object | `{kind: "agent"\|"human"\|"hybrid", tool, model?, operator: "sha256:…"}` — operator is a salted hash, never an email |
| `session` | string | `awp:session:<id>` — stable per work episode |
| `subject` | object | `{artifact: <uri>, revision?: "sha256:…"}` — artifact URIs like `git+https://host/org/repo#pr/412` |
| `confidence` | object | `{value: 0..1, method}` — REQUIRED. `method: "first_party"` implies `value: 1.0`; inferred edges MUST name their method |
| `evidence` | object | machine-checkable only: hashes, exit codes, durations, timestamps. **Free text is forbidden by schema** |
| `privacy` | string | `"metadata_only"` (the only legal value in v0.1) |
| `sig` | string | optional in v0.1 (`dsse:…`); becomes REQUIRED for chain-of-custody consumers in v0.2 |

Consumers MUST render confidence wherever they render the edge ("no naked edges") and MUST
drop any event carrying non-whitelisted free-text fields, logging the drop.

## `awp.link`

First-party causal assertion: this session produced that artifact.

```json
{
  "event": "awp.link",
  "spec": "0.1",
  "time": "2026-07-06T09:14:03Z",
  "actor": { "kind": "agent", "tool": "claude-code/2.x", "model": "claude-fable-5",
             "operator": "sha256:…" },
  "session": "awp:session:9f3c…",
  "subject": { "artifact": "git+https://github.com/acme/checkout#pr/412" },
  "assertion": "produced",
  "confidence": { "value": 1.0, "method": "first_party" },
  "evidence": { "branch_hash": "sha256:…", "diff_hash": "sha256:…" },
  "privacy": "metadata_only"
}
```

`assertion`: `produced` | `contributed` | `reviewed`.

**Provenance of this event type:** it is the generalization of Claude Code's `pr-link`
session event (`{sessionId, prRepository, prNumber}`) that Prism already joins at 0.99
confidence (`pr_ai_link.method = 'pr_link'`, migration 0033). Mapping: `sessionId` →
`session`, `prRepository`+`prNumber` → `subject.artifact`, implied `first_party` confidence.

## `awp.verify`

A verification ran against work in flight.

```json
{
  "event": "awp.verify",
  "spec": "0.1",
  "time": "2026-07-06T09:11:47Z",
  "actor": { "kind": "agent", "tool": "claude-code/2.x", "operator": "sha256:…" },
  "session": "awp:session:9f3c…",
  "subject": { "artifact": "git+https://github.com/acme/checkout#branch/feature-x" },
  "verification": { "category": "V2_tests", "target": "unit",
                    "result": "pass", "exit_code": 0, "duration_ms": 41862 },
  "confidence": { "value": 1.0, "method": "first_party" },
  "evidence": { "command_class": "test_runner" },
  "privacy": "metadata_only"
}
```

`verification.category`: `V1_build` | `V2_tests` | `V3_static` | `V4_runtime` | `V5_review`
— the harness taxonomy from [scoring-model.md](../scoring-model.md) §5 (KPI 13). Running
counts even when `result: "fail"` (running is the practice; the result feeds coaching).
Credit requires execution evidence — a category claim without exit/duration is invalid.

## Non-goals of v0.1

- No `awp.session`/`awp.action`/`awp.outcome`/`awp.cost` (defined in the [sketch](awp-protocol-sketch.md); specified when a second independent emitter exists).
- No transport mandate (OTLP mapping is the intent; v0.1 events are transport-agnostic JSON).
- No governance claims. This is a schema in a startup's repo, honestly labeled.

## Changelog

- v0.1 · 2026-07-06 — extracted from the shipping `pr-link` join + the KPI-13 harness evidence model.

# Prism marketplace — `prism-pr-link` plugin

The **hook path** for AI→PR attribution. Claude Code's OTLP telemetry carries identity +
tokens but **not** the repo / PR-number association (its `pull_request.count` metric has
"all standard attributes only"). This plugin closes that gap: a `PostToolUse(Bash)` hook
notices when a Bash call created a PR and forwards a **metadata-only** event to Prism.

```
Claude Code ──PostToolUse(Bash)──▶ forward-pr-link.mjs ──POST {sessionId,repo,prNumber}──▶
                                                          /api/ingest/pr-link ─▶ pr_link_ingest
```

This is **not** an OTLP receiver — it's a custom, tiny JSON POST. OTLP goes to its own
receiver (a separate, later piece). See the app route: `app/api/ingest/pr-link/route.ts`.

## Config seam (why dev-test extends to org deployment)

Endpoint + token are **read from the environment, never hardcoded** — the one thing that
lets the same artifact serve both worlds:

| var | dev-test today | org later |
|---|---|---|
| `PRISM_INGEST_URL` | `http://localhost:3000/api/ingest/pr-link` | your org's Prism URL |
| `PRISM_INGEST_TOKEN` | a personal token (also in the app's `.env.local`) | an org token via managed settings |
| `PRISM_INGEST_DEBUG` | `1` to log to stderr | unset |

The app side reads `PRISM_INGEST_TOKEN` and rejects anything that doesn't match.

## Install (dev / self-serve — no MDM, no org laptop)

```bash
# 1. point the hook at your Prism + token (same token as the app's .env.local)
export PRISM_INGEST_URL="http://localhost:3000/api/ingest/pr-link"
export PRISM_INGEST_TOKEN="<your dev token>"

# 2. add this marketplace and install the plugin
/plugin marketplace add /path/to/prism/integrations/prism-marketplace
/plugin install prism-pr-link@prism
```

Manual fallback (no plugin): drop the same `PostToolUse` hook into `~/.claude/settings.json`
pointing at `forward-pr-link.mjs`.

## Org deployment later (same plugin, different switch)

Force-enable the plugin + pin this marketplace via **managed settings** (`managed-settings.json`,
pushed by Jamf/Intune or the admin console), with `PRISM_INGEST_URL` / `PRISM_INGEST_TOKEN`
delivered as org config. No code change — only who flips the switch.

## Privacy

Metadata only: `sessionId`, `repo`, `prNumber` (+ optional `sha`/`branch`). The forwarder
never reads prompt text or code, and the ingest route drops anything outside that whitelist.

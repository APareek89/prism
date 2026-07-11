# prism-pr-link

A Claude Code plugin that forwards **pr-link events** — the `{sessionId, repo, prNumber}`
association Claude Code emits when it opens/pushes a PR — to Prism's ingest endpoint, so an
AI-authored PR links to its Claude session at high confidence even off the machine that ran
the local scan.

**Metadata only.** It sends the session id, repo, and PR number. Never prompt text or code.

## Install

The marketplace manifest lives at the repo root (`.claude-plugin/marketplace.json`), so:

```
/plugin marketplace add APareek89/prism        # or a local path to the repo
/plugin install prism-pr-link@prism
```

## Configure

Set these where the hook runs (get the token + URL from your org's **Admin → Plugin / ingest** panel):

```
export PRISM_INGEST_URL="https://<your-prism>/api/ingest/pr-link"
export PRISM_INGEST_TOKEN="pi_…"   # your org's ingest token
# optional: PRISM_INGEST_DEBUG=1 to log to stderr while testing
```

## How it works

A `PostToolUse(Bash)` hook fires after every Bash tool call; when the call created a PR
(its output contains a GitHub PR URL), the hook POSTs the pr-link event to
`PRISM_INGEST_URL` with `Authorization: Bearer $PRISM_INGEST_TOKEN`. The endpoint resolves
your tenant from the token and stores it as raw evidence for the AI→PR linker.

Safe by construction: it always exits 0 (a hook must never break your session), never sends
prompt/code, and no-ops if the config is absent.

## Fleet rollout

For org-wide, tamper-resistant coverage, force-enable this plugin via **managed settings**
(MDM) — the same artifact, distributed as policy instead of a per-developer install.

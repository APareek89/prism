#!/usr/bin/env bash
#
# Copy the main repo's .env.local into this git worktree.
#
# .env.local holds Prism's local dev secrets (NEXT_PUBLIC_SUPABASE_*, SUPABASE_DB_URL,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GITHUB_APP_*, DEMO_MODE, …) and is
# gitignored, so a fresh `git worktree` starts without one — every new worktree
# otherwise has to recreate it by hand, and until it does neither `npm run dev` nor the
# column-truth check (`select … from public.<t> limit 0` via SUPABASE_DB_URL) will run.
# This copies the canonical .env.local from the main working copy into the current
# worktree. It is wired to run on every session start via .claude/settings.json, and is
# safe to run by hand any time.
#
# A COPY, not a symlink, on purpose: a worktree may want its own overrides (e.g. a
# different DEMO_USER_EMAIL or a throwaway key) without touching the main .env.local,
# and worktree removal can't delete the original.
#
# Idempotent and safe: no-op in the main repo itself, no-op if there is no source
# .env.local, and it never clobbers a .env.local the worktree already has.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE="$(cd "$HERE/.." && pwd)"

# The shared .git dir lives at <main-repo>/.git; its parent is the main working copy.
COMMON="$(git -C "$WORKTREE" rev-parse --git-common-dir 2>/dev/null)" || exit 0
case "$COMMON" in /*) ;; *) COMMON="$WORKTREE/$COMMON" ;; esac   # absolutise a relative ".git"
MAIN_ROOT="$(cd "$(dirname "$COMMON")" && pwd)"

SRC="$MAIN_ROOT/.env.local"
DEST="$WORKTREE/.env.local"

[ "$WORKTREE" = "$MAIN_ROOT" ] && exit 0   # we ARE the main repo — nothing to copy
[ -f "$SRC" ] || exit 0                     # no source .env.local yet — fine
[ -e "$DEST" ] && exit 0                     # worktree already has one — don't clobber

cp "$SRC" "$DEST"

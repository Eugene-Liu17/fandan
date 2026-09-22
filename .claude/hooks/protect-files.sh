#!/bin/bash
# PreToolUse hook (Edit|Write): blocks edits to secret files and to
# migrations that have already been applied (i.e. committed to git).
# Reads the tool call's JSON from stdin, exits 2 with a reason on stderr
# to block, exits 0 to allow.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize Windows-style separators so the string checks below match
# consistently regardless of host OS.
FILE_PATH="${FILE_PATH//\\//}"
BASENAME=$(basename -- "$FILE_PATH")

# --- Secret files: block anything named .env*, except .env.example ---
if [[ "$BASENAME" == .env* ]] && [[ "$BASENAME" != ".env.example" ]]; then
  echo "Blocked: '$FILE_PATH' looks like a secret file (.env*). Edit .env.example instead, or ask the user to edit it directly." >&2
  exit 2
fi

# --- Applied migrations: block editing a migration SQL file that is
# already tracked by git (i.e. already committed, so treated as applied
# — see CLAUDE.md: "Never edit an applied migration; create a new one.") ---
if [[ "$FILE_PATH" == *"src/server/db/migrations/"*.sql ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git ls-files --error-unmatch -- "$FILE_PATH" >/dev/null 2>&1; then
      echo "Blocked: '$FILE_PATH' is an already-applied migration (tracked by git). Create a new migration instead of editing this one." >&2
      exit 2
    fi
  fi
fi

exit 0

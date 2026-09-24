#!/bin/bash
# Stop hook: before ending the turn, verify that any src/ or scripts/
# changes still typecheck and pass their related tests. Must stay fast
# (target: well under 60s), so it only runs vitest --related on changed
# files, never the full suite, and skips entirely when there's nothing
# to check.

INPUT=$(cat)

# 1. Avoid looping: if a previous Stop hook already blocked this turn
# and Claude continued, don't block again.
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# 2. No git repo yet (e.g. mid-scaffold, before `git init`) — nothing to
# diff against, so there's nothing this hook can safely check yet.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

# 3. No changes under src/ or scripts/ — nothing to verify.
# --untracked-files=all is required: without it, git collapses a wholly
# untracked directory to a single "?? src/" line instead of listing the
# files inside it, which would make the file-extraction step below miss
# everything in a brand-new directory.
CHANGED=$(git status --porcelain --untracked-files=all -- src scripts 2>/dev/null)
if [ -z "$CHANGED" ]; then
  exit 0
fi

# 4. Typecheck first — cheapest signal, and the one most likely to fail.
# The script generates Next's route types first (bare tsc fails on a fresh
# clone without .next; see T0 in docs/TASKS.md).
TSC_OUTPUT=$(pnpm run typecheck 2>&1)
TSC_EXIT=$?
if [ "$TSC_EXIT" -ne 0 ]; then
  jq -n --arg reason "Typecheck failed. Fix these errors before stopping:

$TSC_OUTPUT" '{"decision": "block", "reason": $reason}'
  exit 0
fi

# 5. Related tests for the changed TS/TSX files under src/scripts.
mapfile -t CHANGED_FILES < <(
  git status --porcelain --untracked-files=all -- src scripts 2>/dev/null \
    | awk '{print $2}' \
    | grep -E '\.(ts|tsx)$'
)
EXISTING_FILES=()
for f in "${CHANGED_FILES[@]:-}"; do
  [ -f "$f" ] && EXISTING_FILES+=("$f")
done

if [ "${#EXISTING_FILES[@]}" -eq 0 ]; then
  exit 0
fi

VITEST_OUTPUT=$(pnpm exec vitest related --run "${EXISTING_FILES[@]}" 2>&1)
VITEST_EXIT=$?
if [ "$VITEST_EXIT" -ne 0 ]; then
  jq -n --arg reason "Related tests failed. Fix these before stopping:

$VITEST_OUTPUT" '{"decision": "block", "reason": $reason}'
  exit 0
fi

exit 0

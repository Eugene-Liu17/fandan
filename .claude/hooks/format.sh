#!/bin/bash
# PostToolUse hook (Edit|Write): auto-formats the just-edited file with
# Biome, but only for extensions Biome actually formats. Never blocks —
# a formatting failure is reported but doesn't fail the tool call.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts|*.json|*.jsonc|*.css)
    ;;
  *)
    exit 0
    ;;
esac

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
pnpm exec biome format --write "$FILE_PATH" >/dev/null 2>&1

exit 0

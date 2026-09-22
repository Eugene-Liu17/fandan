---
name: add-agent-tool
description: Checklist for adding a new AI tool — use whenever a chat tool is created or extended.
---

Adding a new AI tool touches several layers; work through all of them,
in order:

1. **Zod schema** for the tool's input arguments.
2. **Service function** in `src/server/services/`, plus whatever
   `src/domain` functions it needs and their unit tests. Business rules
   go in `domain`, not in the tool or the service.
3. **Tool wrapper** in `src/server/ai/tools/`: validate input with the
   Zod schema, call the service, return a structured result. No logic
   beyond that (see `.claude/rules/ai.md`).
4. If the tool needs user interaction (a multiple-choice question, a
   confirmation), implement the matching chat component under
   `src/components/chat/` and its rendering branch by tool-part type.
   Include an "other" option on every multiple-choice tool.
5. Write the tool call's `events` row.
6. Test tool routing with the AI SDK's mock model — no real API calls.
7. Register the tool in the tool list in docs/SPEC.md.

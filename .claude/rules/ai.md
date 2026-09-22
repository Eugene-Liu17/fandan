---
paths: ["src/server/ai/**", "src/components/chat/**"]
---

# AI layer rules

- Tools are thin wrappers: Zod-validate input, call a
  `src/server/services` function, return its structured result. No
  business logic in the tool handler itself — that belongs in
  `src/domain`.
- Every multiple-choice tool must include an "other (I'll type it)"
  option (see SPEC.md core principle 4). Its answer is written to the
  database directly, never re-parsed by a model.
- Every tool call writes an `events` row (see SPEC.md's `events` table).
- Tools return structured data; the chat UI renders it by tool-part
  type (`tool-<name>`), never by re-parsing prose.
- Test tool routing with the AI SDK's mock model, never a real API call.
- System prompts live in their own file under `src/server/ai/prompts/`,
  each with a version comment at the top, so a prompt regression is a
  diffable, reviewable change.

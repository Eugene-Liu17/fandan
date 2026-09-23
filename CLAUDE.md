# Fandan (饭单)

AI chat-based weekly home-cooking planner. Spec: docs/SPEC.md. Milestones: docs/ROADMAP.md. Tasks: docs/TASKS.md. Decisions: docs/DECISIONS.md.

Next.js 16 may differ from your training data — read AGENTS.md before using an App Router API you're not certain of.

## Commands
- Dev: `pnpm dev`
- Typecheck: `pnpm run typecheck`
- Lint / format: `pnpm run lint` / `pnpm run format`
- Unit tests: `pnpm test` (single file: `pnpm exec vitest run <path>`)
- E2E: `pnpm run test:e2e`
- Layer boundaries: `pnpm run check:boundaries`
- DB: `pnpm run db:generate` / `pnpm run db:migrate` / `pnpm run db:seed`
- Local DB: `docker compose up -d` (Postgres 17, see docker-compose.yml)

## Architecture
- Layers: app/components -> server/services -> domain; server/ai/tools -> server/services.
- domain is pure: no I/O, no imports from next, ai, drizzle, or src/server. Enforced by dependency-cruiser (`pnpm run check:boundaries`), not just convention.
- AI tools are thin wrappers. Business rules live in src/domain with unit tests.
- AI chat and manual UI write the same tables through the same services. Never rely on chat history for state.

## Rules
- IMPORTANT: allergy/restriction filtering is enforced in src/domain, never only in prompts.
- Never edit an applied migration; create a new one.
- Every user-data table has user_id.
- UI copy is Simplified Chinese. Code, comments, and commits are English.

## Workflow
- One task from docs/TASKS.md per session. Start in plan mode and get the plan approved before editing.
- Before calling a task done: run typecheck, lint, tests, and boundaries, and show the output.
- Branch per task: `<type>/m<N>-<slug>` (name given in TASKS.md); update the task's status in TASKS.md in the same PR. Conventional Commits. Merge to main only via PR (`gh pr create`).
- When compacting, preserve: current task and milestone, modified files, failing test names, open questions.

---
paths: ["src/server/db/**", "drizzle.config.*"]
---

# Database layer rules

- Schema change workflow: edit the schema in
  `src/server/db/schema/` → `pnpm run db:generate` → **read the
  generated SQL before applying it** → `pnpm run db:migrate` locally →
  update seed data and repository tests to match.
- Never edit a migration file that's already committed — create a new
  one instead. The `protect-files.sh` hook enforces this for
  git-tracked files.
- Every user-data table has a `user_id` column with an index on it.
- Store all timestamps in UTC. Don't rely on the host machine's local
  timezone anywhere in this layer.

---
name: db-change
description: Standard steps for a database schema change — use whenever a Drizzle schema file is added or edited.
---

Follow the same workflow as `.claude/rules/db.md`:

1. Edit the schema under `src/server/db/schema/`.
2. Run `pnpm run db:generate`.
3. **Read the generated SQL** before applying it — check it does what
   the schema change intended, especially for column drops or type
   changes that could lose data.
4. Apply it locally: `pnpm run db:migrate`.
5. Update `scripts/seed.ts` and any repository tests that reference the
   changed table.
6. Never edit a migration file that's already committed — write a new
   one instead.
7. When opening the PR, paste the generated SQL from step 2 into the
   description so the reviewer doesn't have to open the migration file
   separately.

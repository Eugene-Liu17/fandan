# Fandan (饭单)

An AI chat-based weekly home-cooking planner. You tell the assistant what
you bought this week and which meals you're eating out; it drafts a
weekly menu from your taste profile, which you adjust and confirm. See
[docs/SPEC.md](docs/SPEC.md) for the full product spec, and
[docs/ROADMAP.md](docs/ROADMAP.md) for milestones.

## Getting started

Prerequisites: Node.js 24, pnpm (via `corepack enable pnpm`), and Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY once you reach M4; the rest have working defaults

# 3. Start local Postgres
docker compose up -d

# 4. Apply migrations
pnpm run db:migrate

# 5. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm run typecheck` | TypeScript, no emit |
| `pnpm run lint` / `pnpm run format` | Biome check / write |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm run test:e2e` | End-to-end tests (Playwright) |
| `pnpm run check:boundaries` | Enforce the layer boundaries below (dependency-cruiser) |
| `pnpm run db:generate` / `db:migrate` / `db:seed` | Drizzle schema workflow |

## Architecture

```
src/
  domain/        Pure business logic: types, rules, scoring, state machines. No I/O.
  server/
    db/           Drizzle schema, migrations, repositories
    services/     Application services: orchestrate domain + repositories
    ai/           Agent definitions, tools, system prompts
  app/            Next.js routes and pages
  components/     chat/, calendar/, ui/ (shadcn primitives)
scripts/          Offline scripts: recipe import, feature labeling
docs/             SPEC.md, ROADMAP.md, DECISIONS.md
```

`app`/`components` call `server/services` only; `server/ai/tools` calls
`server/services` only; `server/services` calls `domain`; `domain` has no
outward dependencies. `pnpm run check:boundaries` enforces this in CI.

See [CLAUDE.md](CLAUDE.md) for the full set of working conventions.

# Roadmap

Each milestone is broken into tasks in [TASKS.md](TASKS.md); each task is
one session; a milestone is normally one branch and one PR. See
[.claude/skills/milestone/SKILL.md](../.claude/skills/milestone/SKILL.md)
for the standard workflow.

## M0 — Scaffold (this session)

- [x] Initialize Next.js with pnpm, TypeScript strict, Tailwind, shadcn/ui
- [x] Configure Biome, Vitest, Playwright, Drizzle; `package.json` scripts
      match the commands in `CLAUDE.md`
- [x] Local Postgres reachable; `db:migrate` runs a real migration
      (enables the `pgcrypto` extension)
- [x] Layered directory structure in place; the boundary check catches a
      deliberately introduced violation (verified, then reverted)
- [x] `src/domain` has one example pure function with unit tests,
      proving the test pipeline works
- [x] CI workflow in place; passes locally with the same commands CI runs
- [x] CLAUDE.md and `.claude/` fully configured; hooks tested

## M1 — Data layer and domain logic

- [x] Schema, migrations, and seed data (single user: the developer) for
      every table in SPEC.md's [data model](SPEC.md#data-model)
- [x] Domain functions and unit tests for:
  - meal status transitions
  - dedupe rules: same dish excluded for N days; same main-ingredient +
    flavor excluded for N days; N configurable
  - allergy/restriction hard filtering
  - ingredient shortfall (shopping list) calculation
  - candidate dish scoring
- [x] Services layer, plus repository integration tests against a real
      local database
- [x] Domain test coverage ≥ 90%

## M2 — Recipe library

- [ ] `scripts/import-howtocook`: parses HowToCook markdown into name,
      category, ingredients (main vs. supplementary tagged), and steps;
      records source and license; idempotent (safe to re-run)
- [ ] `scripts/label-features`: batch-labels recipe `features` with a
      parsing model, output constrained by a Zod schema; cached,
      rate-limited, resumable
- [ ] Spot-check report over 20 random labeled recipes, for manual review
- [ ] Imported rows are parsed with `recipeIngredientSchema` /
      `recipeFeaturesSchema` (jsonb types are compile-time only)
- [ ] Coverage report of ingredients the dictionary does not know; such
      recipes stay quarantined (ADR-008) until mapped. The model may propose
      dictionary entries (with allergen tags); they land only through a
      reviewed PR

## M3 — Weekly calendar and manual marking (no AI)

- [ ] Weekly grid view, usable on mobile
- [ ] Each cell marks "cooked" / "not cooked" / "ate out (dish name)",
      writing to `meals` through `services` and logging an event
- [ ] Playwright e2e coverage of the marking flow
- [ ] Tasks T8 (slot write safety) and T9 (services API) from
      docs/TASKS.md come first
- [ ] Server actions return expected errors as values (`toActionResult`);
      services, db and env modules import `server-only`
- [ ] Undo a mark, remove a dish, and notes — designed with the UI
- Built without AI first, specifically to prove the business logic is
  independent of it.

## M4 — Conversation and generative UI

- [ ] Chat page with persisted messages
- [ ] Tools:
  - read this week's context
  - parse free text into pantry items
  - log a meal
  - search candidate dishes
  - generate a menu draft (writes `draft` status); the composer avoids
    repeating a dish or a main ingredient + flavor already planned or
    drafted elsewhere in the dedupe window (ADR-006)
  - revise a draft
  - confirm a draft
  - multiple-choice question (client-side interactive tool, single and
    multi-select, always includes "other")
- [ ] Menu draft cards (keep / swap) and the supplementary-ingredients
      list
- [ ] Chat and calendar write the same data: an edit made on the
      calendar is correctly read by the next conversation turn, with
      test coverage
- [ ] Tool-call routing tested with a mock model; a separate manual
      acceptance script
- [ ] Draft writes re-check restrictions and recipe visibility on the
      server for every recipe id the model supplies; the week context flags
      planned dishes that violate a restriction added later
- [ ] `messages` rows are keyed so one user can never overwrite another's;
      tool writes are idempotent under retries (e.g. `logEatOut`); a
      `tool_called` event type exists

## M5 — Onboarding, review, and eating out

- [ ] First-run onboarding (multiple choice), written to `taste_facts`
- [ ] "Review last week" at the start of each weekly conversation
- [ ] Logging eating-out meals in chat (including batch backfill),
      participating in dedupe
- [ ] Requests the AI can't satisfy recorded as `unmet_request` events
- [ ] `taste_summary` regenerated after each confirmed menu
- [ ] Batch backfill is one atomic service call; the user's time zone is
      validated when written; a restriction statement with nothing
      structured recognized is confirmed with the user

## M6 — Auth and deployment

- [ ] Supabase Auth (email magic link)
- [ ] Row-level security policies keyed on `user_id`, with tests proving
      isolation between users
- [ ] ADR for the deployment target, and a live deployment (Vercel or
      Cloud Run)
- [ ] Environment variable management and baseline observability
      (Langfuse optional)
- [ ] A checklist for the developer to use the app continuously for two
      weeks
- [ ] The app's direct Drizzle connection bypasses RLS, so queries run
      through a `withUser` executor that sets the role and claims; ADR for
      the approach
- [ ] T10 (Traditional Chinese normalization) is done before phase-2 users
      are invited

# Tasks

[ROADMAP.md](ROADMAP.md) defines milestones; this file breaks each
milestone into tasks. Architecture decisions live in
[DECISIONS.md](DECISIONS.md), product requirements in [SPEC.md](SPEC.md).

## Workflow

- One task = one session. Sessions are not tied to branches.
- Branch per larger feature (usually a milestone), not per task: its
  tasks are commits on that branch, and the branch gets one PR. Small
  standalone fixes (e.g. T0) may be committed straight to `main`.
- Every `git push` needs the user's confirmation first.
- Branch name: `<type>/m<N>-<slug>` (the name is given in the Index).
- Update the task's status in this file in the commit that finishes it.
- Tick a milestone's boxes in ROADMAP.md when the milestone's PR merges.
- Start each session in plan mode; get the plan approved before editing.
- Status values: `todo` / `in progress` / `in review` / `done`.

## Index

| ID | Title | Milestone | Depends on | Branch | Status |
| --- | --- | --- | --- | --- | --- |
| T0 | Fix CI and M0 leftovers | M0 | — | `main` (direct) | in review |
| T1 | M1 data model design (docs only) | M1 | T0 | `feat/m1-data-layer` | todo |
| T2 | Domain foundations | M1 | T1 | `feat/m1-data-layer` | todo |
| T3 | Domain rules | M1 | T2 | `feat/m1-data-layer` | todo |
| T4 | Schema, migrations, seed | M1 | T2 | `feat/m1-data-layer` | todo |
| T5 | Repositories, services, integration tests | M1 | T3, T4 | `feat/m1-data-layer` | todo |

T1–T5 share one branch, so they run in order; T3 and T4 do not depend on
each other.

---

## T0 — Fix CI and M0 leftovers

**Goal**: make `main` green again and clean up small M0 leftovers.

**Why**: `src/app/layout.tsx` uses the global `LayoutProps` type, which
Next generates during `next dev` / `next build` / `next typegen`. CI runs
`tsc` before any of those, so it fails with `TS2304: Cannot find name
'LayoutProps'` (run 35911832918). It passes locally only because
`.next/types` already exists.

**Scope**
- Change the `typecheck` script to `next typegen && tsc --noEmit`.
- Remove the reference to "A6" (a SPEC section that does not exist) from
  the comment in `src/server/db/schema/index.ts`.
- Delete the merged local branch `feat/m0-scaffold`.

**Out of scope**: editing migration `0000` (already applied; see CLAUDE.md).

**Acceptance criteria**
- [ ] `rm -rf .next && pnpm run typecheck` passes locally.
- [ ] CI is green on the PR.

**Open questions**: none.

---

## T1 — M1 data model design (docs only)

**Goal**: settle the open data-model questions in writing before any
schema or domain code is written.

**Scope**
- **ADR-006 — multiple dishes per meal slot.** Revises ADR-003. Preferred
  direction: `meals` stays one table, one row per dish, `(user_id, date,
  slot)` is not unique, add a `position` column, and status is tracked
  per dish. Must define:
  - a slot with no rows is "unknown" (SPEC principle 5);
  - what happens to planned dishes when a slot is marked "ate out";
  - how the default number of dishes per meal follows household size.
- **ADR-007 — dates and time zones.** `meals.date` is a Postgres `date`
  holding the user's local date; `users` gets `timezone` (IANA) and
  `week_starts_on`; the domain works with plain `YYYY-MM-DD` dates;
  audit timestamps stay UTC `timestamptz`. Notes how `src/domain/week.ts`
  (UTC-based) changes in T2.
- **ADR-008 — ingredient normalization and restriction model.**
  - A built-in ingredient dictionary in the domain layer: canonical name,
    aliases, category, allergen tags.
  - Structured payload for restrictions in `taste_facts`.
  - Free-text ("other") restrictions map to the dictionary via aliases;
    anything that cannot be mapped is matched literally against canonical
    names and aliases and is never silently dropped.
  - A standard condiments list.
  - A fixed vocabulary for recipe `features` (cuisine, main ingredient,
    cooking method, flavor, oil level), defined as a Zod schema in the
    domain layer and reused by M2 labeling.
- Write the refined data model back into SPEC.md's "Data model" section
  (columns, types, constraints, indexes), as SPEC.md itself requires.

**Out of scope**: any code, schema file, or migration.

**Acceptance criteria**
- [ ] ADR-006, ADR-007, ADR-008 merged; ADR-003 marked as revised.
- [ ] SPEC.md "Data model" updated to the refined version.
- [ ] Every open question is either resolved or explicitly deferred to a
      named task.

**Open questions**
- Default dishes per meal as a function of household size.
- Whether `taste_facts` restrictions need an expiry (e.g. temporary diets).

---

## T2 — Domain foundations

**Goal**: the shared types and vocabulary every domain rule builds on.

**Scope** (all in `src/domain`, pure, following ADR-006/007/008)
- Enums as `as const` constants (slot, meal status, taste fact type and
  source, event type, ...). T4's `pgEnum`s import these.
- Plain-date helpers per ADR-007; adjust `week.ts` accordingly.
- Ingredient dictionary, `normalizeIngredient`, standard condiments list.
- Recipe `features` Zod schema and fixed vocabularies.
- Meal status state machine: allowed transitions; no record means
  "unknown", never "cooked".

**Acceptance criteria**
- [ ] Every exported function has a unit test.
- [ ] Edge cases from `.claude/rules/domain.md` are covered where
      relevant (empty pantry, fully eaten-out week, allergy conflict).
- [ ] `pnpm run check:boundaries` passes.

**Open questions**: none beyond T1's outcomes.

---

## T3 — Domain rules

**Goal**: the business rules from SPEC "Core principles", as tested pure
functions.

**Scope**
- **Allergy / restriction hard filter.** A dish that contains an allergen
  written under any alias must be excluded.
- **Dedupe.** Same dish excluded for N days; same main ingredient +
  flavor excluded for N days; N configurable. Both `cooked` and `ate_out`
  count. Boundary cases: N = 0 and N = 1.
- **Shopping list.** Recipe ingredients − pantry − standard condiments,
  after normalization; identical ingredients across dishes merged; empty
  pantry covered.
- **Candidate scoring.** Hard filters first, then score (pantry coverage,
  past ratings, stated cravings). Randomness is a parameter so results
  are reproducible.
- Add `coverage.thresholds` (≥ 90% for `src/domain`) to
  `vitest.config.ts`; make CI run `pnpm run test:coverage`.

**Acceptance criteria**
- [ ] Named domain tests exist for the SPEC acceptance criteria on
      allergy filtering, dedupe, and the shopping list.
- [ ] Domain coverage ≥ 90%, enforced in CI.
- [ ] `pnpm run check:boundaries` passes.

**Open questions**
- Scoring weights (start simple; tune in M4 with real drafts).

---

## T4 — Schema, migrations, seed

**Goal**: every M1 table exists in Postgres with a repeatable seed.

**Scope** (follow `.claude/skills/db-change/SKILL.md`)
- Tables: `users`, `taste_facts`, `pantry_items`, `recipes`, `meals`,
  `events`, `conversations`, `messages`.
- Every user-data table has an indexed `user_id`; primary keys are uuid
  with default `gen_random_uuid()`; timestamps are `timestamptz`.
- `users.id` is uuid so it can match Supabase `auth.users.id` in M6.
- `recipes.source` and `recipes.license` are NOT NULL; `owner_id` null
  means the shared library.
- `messages` stores `parts jsonb` in the AI SDK UIMessage shape (M4 adds
  a migration if it needs more).
- New `scripts/seed.ts` (the `db:seed` script currently points at a file
  that does not exist): the developer user, a few hand-written recipes,
  and some meal history so dedupe has data. Safe to run twice.

**Acceptance criteria**
- [ ] Generated SQL was read and is pasted into the PR description.
- [ ] `db:migrate` succeeds on an empty database.
- [ ] Running `db:seed` twice leaves the same data.

**Open questions**: none beyond T1's outcomes.

---

## T5 — Repositories, services, integration tests

**Goal**: the services layer that both the calendar UI and AI tools will
call, tested against a real Postgres.

**Scope**
- Repositories in `src/server/db/`; services in `src/server/services/`
  orchestrating domain + repositories. Initial set: `getWeekContext`,
  `markMeal`, `logEatOut`, `addPantryItems`, `computeShoppingList`,
  `getCandidates`.
- Every write that changes user state also appends an `events` row.
- Integration tests in the vitest `server` project: separate test
  database, migrated before the run, tables cleared between cases.
- CI: add a `postgres:17-alpine` service container and run migrations
  before tests; replace the placeholder `DATABASE_URL` in `ci.yml`.

**Acceptance criteria**
- [ ] After `markMeal`, `getWeekContext` returns the new state (SPEC:
      calendar edits are visible to the next chat turn).
- [ ] A two-user test proves queries are isolated by `user_id`.
- [ ] `spec-reviewer` has been run on the branch.
- [ ] M1 boxes ticked in ROADMAP.md (in the PR for `feat/m1-data-layer`).

**Open questions**: none beyond earlier tasks.

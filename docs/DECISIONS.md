# Architecture Decision Records

## ADR-001: Technology stack

**Context**

M0 needs a concrete, versioned stack rather than "whatever's current" at
implementation time, so every future session builds on the same
foundation. Versions below are what `npm view` and actual installs
resolved to on 2026-09-22, not versions recalled from training data.

**Decision**

| Concern | Choice | Version installed |
| --- | --- | --- |
| Framework | Next.js, App Router | 16.3.5 |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` | 5.9.3 |
| UI runtime | React | 19.2.8 |
| AI | Vercel AI SDK | **7** (`ai@7.0.109` at time of writing; interactive tool results use `addToolOutput`). Not installed until M4 — re-check the current version then. |
| Models | Planning: `claude-sonnet-5`; parsing/labeling: `claude-haiku-4-5-20251001` (env vars, see `.env.example`) |
| Database | Postgres, hosted on Supabase in production; Postgres 17 locally via Docker Compose (see ADR-004) |
| ORM | Drizzle ORM + drizzle-kit | 0.45.3 / 0.31.11 |
| Validation | Zod, shared across tool args, API routes, and forms | 4.6.5 |
| UI | Tailwind CSS + shadcn/ui (Nova preset, Radix base) | 4.3.3 / 4.21.0 |
| Testing | Vitest (unit/integration, mock-model AI tests) + Playwright (e2e) | 5.0.1 / 1.63.0 |
| Code quality | Biome (lint + format) | 2.4.2 |
| Boundary enforcement | dependency-cruiser (see ADR-005) | 18.4.0 |
| Package manager | pnpm via corepack | 12.5.1 |
| CI | GitHub Actions |
| Deployment | Deferred to M6 (Vercel vs. Cloud Run) |
| MCP | None configured. External services go through `gh` and `supabase` CLIs. |

**TypeScript version note**: `typescript@latest` is 7.0.2, a from-scratch
Go-native compiler released this year. M0 stays on the 5.9.x line that
`create-next-app` resolved to, because the rest of the stack (Next 16,
drizzle-kit, Vitest) isn't yet validated against the native compiler's
`tsc` compatibility surface, and a clean scaffold passing `tsc --noEmit`
wouldn't tell us much about a real project. Revisit as a dedicated,
isolated upgrade once M1+ code exists to actually stress it.

**Consequences**

Every future session can `npm view <pkg> version` to check for drift,
but should not casually bump a major version outside of a milestone
that budgets time for it. The AI SDK is the one dependency in this table
not yet installed — confirm the current major again at M4, since it
moved from 6 to 7 between this plan's first draft and M0 execution.

---

## ADR-002: Business logic is separate from the AI framework

**Context**

An AI-first app is tempted to put business rules — dedupe, allergy
filtering, meal state transitions — directly into prompts or tool
handlers, where they're invisible to tests and easy to silently break
with a prompt edit.

**Decision**

All such rules live as pure functions in `src/domain`, with unit tests.
AI tools and the UI both call them only through `src/server/services`.
`src/domain` has no I/O and cannot import `next`, `react`, `ai`,
`drizzle-orm`, or anything under `src/server` — enforced by
dependency-cruiser (ADR-005), not just documented convention.

**Consequences**

A rule change (e.g. the dedupe window) is a domain-layer code change
with a unit test, never a prompt edit. Allergy filtering in particular
cannot be bypassed by any recommendation path, including one the model
invents, because the filter runs in code the model doesn't control.

---

## ADR-003: Plan and actual share one table (`meals`)

> **Revised by [ADR-006](#adr-006-a-meal-slot-holds-multiple-dishes)** (multiple dishes per
> slot). The decision that plan and actual share the same rows still stands; the table
> shape below is superseded.

**Context**

A naive design keeps a separate "planned menu" table and a separate
"cooking log" table, then has to reconcile them — which invites the two
going out of sync, and complicates "did we already eat this recently"
queries that need to span both.

**Decision**

`meals` holds one row per date × slot with a `status` enum (`draft` /
`planned` / `cooked` / `skipped` / `ate_out` / `unknown`). Planning
writes `planned`; manual marking and chat logging both transition the
same row to `cooked` / `ate_out` / `skipped`. There is no second table
to keep in sync.

**Consequences**

Dedupe queries scan one table. The calendar and the chat draft are two
views over the same rows, which is what makes "an edit made on the
calendar is visible to the next chat turn" (SPEC.md acceptance
criteria) a query, not a sync problem. The cost is a wider status enum
that every reader has to handle, including the "no record = unknown,
never assumed cooked" rule (SPEC.md core principle 5).

---

## ADR-004: Local database — Docker Compose Postgres

**Context**

M0 needs a local Postgres reachable by `drizzle-kit migrate`. Two
realistic options: a plain `docker compose` Postgres container, or the
Supabase CLI's full local stack (Postgres + Auth + Storage + Studio).

**Decision**

M0 uses a single-service `docker-compose.yml` running `postgres:17-alpine`
(17 chosen to match Supabase's current hosted default — see below),
with a named volume and a `pg_isready` healthcheck. The Supabase CLI is
deferred to M6, when Supabase Auth is actually wired in; adding it now
would mean running Auth/Storage/Studio containers that M0–M5 have no use
for.

Supabase's hosted default Postgres major version moved from 15 to 17 on
2026-06-17 ([Supabase changelog](https://supabase.com/changelog)), so 17
is also the right target for local-vs-hosted parity.

**Consequences**

Local dev is a `docker compose up -d` plus a plain Postgres connection
string — fast to start, easy to reason about. M6 adds a second ADR when
the Supabase CLI stack replaces or supplements this, since switching to
it later is itself a decision worth recording (connection string
changes, and Auth/RLS need the fuller local stack to test against).

---

## ADR-005: Layer boundaries enforced with dependency-cruiser, not Biome

**Context**

The architecture (`domain` → nothing; `services` → `domain`;
`app`/`components`/`ai/tools` → `services` only) needs to be a build
failure, not a convention that erodes over a few milestones. Two
realistic tools: Biome's `noRestrictedImports` lint rule, or
dependency-cruiser.

**Decision**

`pnpm run check:boundaries` runs dependency-cruiser
(`.dependency-cruiser.cjs`) against the real resolved module graph,
using the project's `tsconfig.json` (including the `@/*` path alias).

Biome's restricted-imports rule only pattern-matches the literal import
specifier string. A violation written as a relative import
(`../../server/db/client` from inside `src/domain`) would still resolve
to the forbidden module but wouldn't match a specifier-string rule,
silently defeating the check. dependency-cruiser resolves the actual
module path before applying the rule, so it catches the relative-import
case too — verified during M0 by introducing exactly that violation and
confirming `check:boundaries` fails, then reverting it.

**Consequences**

One more devDependency and one more config file, but the boundary check
can't be defeated by import style. `check:boundaries` runs in CI
alongside typecheck/lint/test, so a violation fails the build the same
way a type error would.

---

## ADR-006: A meal slot holds multiple dishes

**Context**

ADR-003 modeled a meal slot as one row with a single `planned_recipe_id`. A Chinese
home-cooked dinner is usually several dishes (a meat dish, a vegetable, a soup), and
each dish can independently be cooked, skipped, or rated. A slot can also be entirely
eaten out, or not eaten at all, which are facts about the slot rather than about any
one dish.

**Decision**

Two tables:

- **`meals`** — one row per `(user_id, date, slot)`, unique. Slot status:
  `draft` / `planned` / `cooked` / `skipped` / `ate_out`. `cooked` means eaten at
  home; `skipped` means the meal was not eaten. A slot with **no row is "unknown"**
  (SPEC core principle 5), never "cooked".
- **`meal_dishes`** — the dishes in a slot: `position`, `recipe_id` (nullable),
  `dish_name` and `features` (snapshots taken when the row is created, so later
  recipe edits do not rewrite history), dish status
  `draft` / `planned` / `eaten` / `not_eaten`, `rating` (1–5), `note`.

Plan and actual still share the same rows, as in ADR-003: planning writes `planned`,
marking and the "review last week" step move rows to `eaten` / `not_eaten`.

Rules:

- Marking a slot `ate_out` sets its planned dishes to `not_eaten` (kept as history)
  and adds the dishes eaten out as `eaten` rows. A dish name is optional; a row with
  no name contributes nothing to dedupe.
- Marking a slot `cooked` without a per-dish answer leaves its dishes `planned`. Only
  the review step (or a per-dish mark) sets `eaten` / `not_eaten`. The app never
  assumes a planned dish was eaten.
- Dedupe reads `meal_dishes` with status `eaten`, joined to `meals.date`.
- The number of dishes per meal is the user preference `dishes_per_meal`. Its default
  is derived from household size (1 → 1, 2 → 2, 3–4 → 3, 5 or more → 4) by a pure
  function in `src/domain`.

**Consequences**

The unique slot row turns concurrent writes from the chat and the calendar into an
upsert instead of a race, and gives slot-level states (ate out, skipped) a natural
home. Dedupe needs one extra join. Every reader has to handle two status enums
(slot and dish), so the state machine in `src/domain` covers both.

---

## ADR-007: Dates are the user's local calendar dates

**Context**

`src/domain/week.ts` computes weeks from UTC instants. That is wrong for the target
users: someone in US Pacific time eating dinner at 8 pm is already on the next UTC
day, so a UTC-based week grid would put the meal in the wrong cell.

**Decision**

- `meals.date` is a Postgres `date`: the user's local calendar date, with no time
  component.
- `users.timezone` (IANA name, captured from the browser at onboarding) and
  `users.week_starts_on` (0 = Sunday, 1 = Monday; default 1).
- `src/domain` works with plain `YYYY-MM-DD` dates. "Today" is computed in the
  services layer from `now` and the user's timezone, then passed into domain
  functions as a parameter (domain still never reads the clock).
- Audit timestamps (`created_at`, `updated_at`, ...) stay UTC `timestamptz`, as
  `.claude/rules/db.md` requires.

**Consequences**

Week boundaries and dedupe windows are counted in the user's own days. `week.ts`
gets a plain-date variant in T2; the UTC-instant helpers are removed once nothing
uses them.

---

## ADR-008: Ingredient vocabulary, restrictions, and recipe features

**Context**

Allergy filtering, "same main ingredient + flavor" dedupe, and the shopping-list set
difference all compare ingredients. Recipe text says 五花肉, 猪五花, and 带皮五花; a
user says "pork" or "猪肉". Without one shared vocabulary each rule would compare
strings differently and silently disagree.

**Decision**

**Ingredient dictionary.** A reviewed constant in `src/domain`, not a database table:
`key` (English snake_case), Chinese canonical name, aliases, category, allergen tags.
`normalizeIngredient(raw)` returns the key, or marks the name unmapped. M2's import
reports unmapped names so the dictionary grows through PRs.

- Allergen tags: `peanut`, `tree_nut`, `milk`, `egg`, `fish`, `crustacean`, `mollusc`,
  `soy`, `wheat`, `sesame`.
- Categories (used by diet rules and coarse grouping): `pork`, `beef`, `lamb`,
  `poultry`, `seafood`, `vegetable`, `legume`, `grain`, `dairy_egg`, `fungus`, ...

**Restrictions.** Stored in `taste_facts` with `type = restriction`. `content` is what
the user said; `payload` is one of `{kind: 'allergen', tag}`,
`{kind: 'category', category}`, `{kind: 'ingredient', key}`, `{kind: 'term', text}`.

**The filter is conservative: when in doubt, exclude.** A recipe is excluded if any
ingredient matches a restriction by tag, category, or key, **or** if the raw
ingredient name contains the restriction's term or one of its aliases as a substring.
Free text that cannot be mapped to the dictionary becomes a `term` restriction and is
never dropped.

**Standard condiments.** A domain constant of durable pantry staples: cooking oil,
salt, sugar, light and dark soy sauce, vinegar, cooking wine, oyster sauce, starch,
white pepper, chicken bouillon. Scallion, ginger, and garlic are fresh, run out, and
are **not** on the list, so they appear on the shopping list unless the pantry has
them.

**Recipe features.** A Zod schema in `src/domain`, reused by M2's labeling script.
Fixed English-key vocabularies (Chinese labels live in the UI):

- `role`: `meat` / `vegetable` / `soup` / `staple` / `mixed` (used to compose a meal
  such as one meat, one vegetable, one soup)
- `cuisine`, `method`, `flavor`
- `main_ingredient`: a dictionary key, i.e. the **specific** ingredient (五花肉 and
  排骨 are different)
- `oil_level`: `low` / `medium` / `high`

Dedupe's "same main ingredient + flavor" compares the `main_ingredient` key and
`flavor`.

**Consequences**

One normalization function feeds all three rules. The dictionary is code, so every
change is diffable and covered by a test; the cost is that a growing dictionary needs
maintenance. Conservative substring matching will occasionally over-exclude a
harmless dish, which is the intended trade-off: a missed allergen is a bug, an
over-excluded dish is not.

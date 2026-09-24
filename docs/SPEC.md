# Fandan (饭单) — Product Spec

## Background

Planning what to cook each week is a small, recurring decision that's
easy to get wrong: you forget what you bought, repeat the same dish you
had for takeout three days ago, or default to the same five meals
because nothing else comes to mind. Fandan turns this into a short
weekly conversation with an AI assistant: tell it what you bought and
which meals you're eating out, and it drafts a week's menu that avoids
recent repeats and respects what you can't or won't eat. You adjust the
draft with taps or plain language, confirm it, and the app remembers a
little more about your taste each time.

The app also tracks what you actually ate — including meals eaten out —
because avoiding repetition requires knowing the full history, not just
what got cooked at home.

## Users and phases

- **Phase 1**: the developer only. Even as a single user, every table is
  designed for multiple users from day one (see [Data model](#data-model)).
- **Phase 2**: 10–30 overseas Chinese beta users, invited once phase 1 is
  stable. They shop at Asian grocery stores and cook mostly Chinese
  home-style food.
- **Primary surface**: mobile browser. The app is responsive and
  mobile-first; desktop only needs to be usable, not optimized.

## MVP scope

1. **Onboarding**: a short multiple-choice flow collects household size,
   dietary restrictions and allergies, how many meals per week are
   cooked at home, and flavor preferences.
2. **Weekly menu conversation** (the core flow, in this order):
   a. **Review last week**: multiple-choice confirmation of which
      planned dishes were actually cooked, which weren't, and how they
      were rated.
   b. **Collect this week's context**: the user describes in plain text
      what they bought (the AI parses it into pantry items), checks off
      which meals are eaten out or skipped, and mentions any specific
      cravings.
   c. **Generate a draft**: a full week's menu, one card per dish, each
      with "keep" / "swap" actions; plus a list of supplementary
      ingredients still needed.
   d. **Revise**: the user edits the draft through card actions or plain
      conversation.
   e. **Confirm**: the plan is written to the database, and the taste
      summary is regenerated.
3. **Weekly calendar and manual marking**: a 7-day × meal-slot grid.
   Every cell can be marked "cooked" / "not cooked" / "ate out (dish
   name)" at any time, independent of the conversation.
4. **Eating-out log**: recorded either in one line of conversation
   ("had suan cai yu for lunch") or filled in manually on the calendar;
   supports batch backfill.
5. **Dedupe (MVP does only the first tier)**: a dish eaten out or cooked
   recently, and a dish sharing the same main ingredient + flavor
   profile, are excluded from the home-cooked menu within a configurable
   N-day window, counted both before and after the planned date.
6. **Allergies and restrictions**: a hard filter. No recommendation path
   may bypass it.
7. **Shopping list for supplementary ingredients**: `confirmed recipe
   ingredients − pantry − standard condiments = what to buy`. This is a
   deterministic calculation, never a model guess.
8. **Behavior log**: draft edits, manual marks, multiple-choice answers,
   and requests the AI couldn't satisfy are all written to an events log.
9. **Recipe library**: seeded from
   [HowToCook](https://github.com/Anduin2017/HowToCook) (Unlicense).
   Every recipe records its source and license; a model batch-labels
   its features once at import time.

## Non-goals (explicitly out of MVP)

Receipt/photo recognition, a native app, payments, shared household
accounts, nutrition analysis, grocery-platform integration, push
notifications, an AI-inferred-then-confirmed taste flow, charts,
pantry quantity tracking with automatic deduction, dedupe tiers 2 and 3
(down-weighting similar dishes, balancing oil-heaviness), and
automatically blocking out slots for fixed eating-out habits.

## Core principles (design constraints — violating one is a bug)

1. **Business logic is separate from the AI framework.** Dedupe
   scoring, the ingredient shortfall calculation, allergy filtering, and
   meal state transitions are pure functions in `src/domain` with unit
   tests. Both the AI tools and the UI call them through the same
   services layer.
2. **Single source of truth.** The AI conversation and manual marking
   write the same data. The AI re-reads current state from the database
   on every turn; it never relies on chat history to remember state.
3. **Allergy filtering can't live only in a prompt.** Allergy and
   restriction filtering must be implemented in code, in the domain
   layer.
4. **Multiple-choice rules.** Every multiple-choice question in the
   conversation must always include an "other (I'll type it)" option.
   An answer is structured data and is written to the database directly
   — it is never re-parsed by a model.
5. **A missing record is not the same as "ate at home."** A meal slot
   with no record is "unknown," never defaulted to "cooked at home."
6. **The taste profile stores only what the user stated.** At MVP stage,
   every taste fact records its source; nothing the model merely infers
   is stored.

## Core flows

### Weekly menu conversation

See MVP item 2 above. Each step writes through `server/services`, the
same layer the calendar UI uses, so a plan confirmed through chat is
indistinguishable in the database from one entered by hand.

### Eating-out logging

A one-line message in the chat, or a manual calendar entry, both set the
slot's `meals.status` to `ate_out` and add the dish eaten as a `meal_dishes`
row (status `eaten`, with a `dish_name`). Both paths participate in dedupe
scoring identically (see [ADR-006](DECISIONS.md)).

### Manual marking

The calendar is available independent of any conversation. Marking a
cell "cooked" / "not cooked" / "ate out" writes to `meals` (and, for
per-dish marks, `meal_dishes`) and appends an event; the next conversation turn reads the same table, so a manual edit
is visible to the AI immediately (see [ADR-002](DECISIONS.md) and
[ADR-003](DECISIONS.md)).

## Data model

Every user-data table has a `user_id` column, indexed; `users` is the identity
table itself and is keyed by `id`, and `recipes` uses a nullable `owner_id`
(null = the shared library, which is not user data). Primary keys are `uuid` with default
`gen_random_uuid()` unless noted. Audit timestamps are `timestamptz` in UTC;
`meals.date` is the user's local calendar date (see
[ADR-007](DECISIONS.md)). Enum-like columns take their values from constants in
`src/domain`, so the database and the domain cannot drift apart. Design rationale:
[ADR-006](DECISIONS.md) (meals and dishes), [ADR-007](DECISIONS.md) (dates),
[ADR-008](DECISIONS.md) (ingredients, restrictions, features).

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | Matches Supabase `auth.users.id` from M6 |
| `display_name` | text | |
| `timezone` | text | IANA name, e.g. `America/Los_Angeles`; default `UTC` |
| `week_starts_on` | smallint | 0 = Sunday, 1 = Monday; default 1 |
| `household_size` | smallint null | Null until onboarding; ≥ 1 |
| `dishes_per_meal` | smallint null | Null = derive from household size; ≥ 1 |
| `dedupe_window_days` | smallint | Default 14 (N in the dedupe rules) |
| `taste_summary` | text null | Model-generated; regenerated on confirm |
| `taste_summary_updated_at` | timestamptz null | |
| `created_at`, `updated_at` | timestamptz | |

### `taste_facts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed together with `type` |
| `type` | enum | `preference` / `restriction` / `routine` |
| `content` | text | What the user said or chose |
| `payload` | jsonb null | For restrictions: `{kind, ...}` per ADR-008 |
| `source` | enum | `stated` / `choice` (nothing inferred is stored) |
| `created_at` | timestamptz | |
| `deleted_at` | timestamptz null | Soft delete; the user can retract a fact |

### `pantry_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed |
| `ingredient_key` | text null | Dictionary key; null if unmapped |
| `raw_name` | text | As the user wrote it |
| `quantity` | enum null | `plenty` / `some` / `low` |
| `added_at` | timestamptz | |
| `removed_at` | timestamptz null | Set when used up or removed |

### `recipes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `owner_id` | uuid null | null = shared library; otherwise a user id |
| `name` | text | |
| `category` | text | |
| `ingredients` | jsonb | `[{raw_name, key, amount?, role: main \| supplementary}]` |
| `steps` | jsonb | Ordered list of step text |
| `features` | jsonb null | ADR-008 schema; filled by M2 labeling |
| `source` | text not null | e.g. `howtocook` |
| `source_ref` | text not null | Path, URL, or slug within the source |
| `license` | text not null | |
| `created_at`, `updated_at` | timestamptz | |

Unique on `(source, source_ref)` so re-importing is idempotent. Indexed on
`owner_id`.

### `meals`

One row per meal slot. No row means "unknown".

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed |
| `date` | date | User-local calendar date |
| `slot` | enum | `breakfast` / `lunch` / `dinner` |
| `status` | enum | `draft` / `planned` / `cooked` / `skipped` / `ate_out` |
| `note` | text null | |
| `created_at`, `updated_at` | timestamptz | |

Unique on `(user_id, date, slot)`.

### `meal_dishes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed |
| `meal_id` | uuid fk | References `meals.id`, on delete cascade; indexed |
| `position` | smallint | Order within the slot |
| `recipe_id` | uuid null fk | Null for dishes eaten out |
| `dish_name` | text null | Snapshot; null if the user gave no name |
| `features` | jsonb null | Snapshot used by dedupe |
| `status` | enum | `draft` / `planned` / `eaten` / `not_eaten` |
| `rating` | smallint null | 1–5 |
| `note` | text null | |
| `created_at`, `updated_at` | timestamptz | |

### `events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed together with `created_at` |
| `type` | text | Validated against a domain constant (text, not an enum, because event types change often) |
| `payload` | jsonb | |
| `created_at` | timestamptz | |

Records draft edits, manual marks, multiple-choice answers, tool calls, and
`unmet_request` events.

### `conversations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid | Indexed |
| `week_start` | date null | The week this conversation plans |
| `title` | text null | |
| `created_at`, `updated_at` | timestamptz | |

### `messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | The AI SDK message id |
| `conversation_id` | uuid fk | Indexed together with `created_at` |
| `user_id` | uuid | Indexed |
| `role` | text | `user` / `assistant` / `system` |
| `parts` | jsonb | AI SDK UIMessage parts |
| `created_at` | timestamptz | |

## Acceptance criteria

The MVP is acceptable when:

- A new user can complete onboarding and reach a first confirmed weekly
  menu within one conversation session.
- A dish eaten out in the last N days (N configurable) never appears in
  a generated draft, and neither does a dish sharing its main ingredient
  and flavor profile within the same window.
- No draft ever proposes a dish containing a declared allergen or
  restricted ingredient — verified by a domain-layer test, not manual
  inspection.
- Every meal slot with no record renders as "unknown," never as
  "cooked."
- Editing a meal slot on the calendar is immediately visible in the next
  chat turn's context, and vice versa.
- A confirmed weekly menu produces a shopping list equal to the
  deterministic set difference (recipe ingredients − pantry − standard
  condiments), independent of any model call.
- Every multiple-choice question offers an "other" option, and its
  answers are written to the database as structured data without a
  second model pass.

## End-to-end verification script

Run this after each milestone that touches the conversation or calendar
to confirm the MVP still works end-to-end:

1. Sign in as the developer account created by `pnpm run db:seed` (empty,
   so onboarding runs). The seed also rebuilds a separate demo account with
   two weeks of history and a peanut allergy, for checking dedupe and
   allergy filtering without touching real data.
2. Complete onboarding: answer household size, restrictions/allergies
   (include at least one real restriction), meals-cooked-per-week, and
   flavor preference. Confirm the answers appear in `taste_facts` with
   `source = 'choice'`.
3. Start the weekly conversation. At the "review last week" step, mark
   two dishes as cooked and one as skipped with a rating.
4. At "collect this week's context," type a short grocery list in plain
   language (e.g. "bought pork belly, bok choy, tofu, eggs"), mark one
   dinner as eating out, and mention a craving.
5. Confirm pantry items were parsed correctly; correct any
   misinterpretation.
6. Review the generated draft: verify no card contains a declared
   allergen, and no card repeats the dish logged as eaten out in the
   last N days.
7. Swap one card, keep the rest, then confirm the plan.
8. Verify: the shopping list matches `ingredients − pantry − standard
   condiments` by hand-checking one dish; `taste_summary` changed; an
   `events` row exists for the draft edit.
9. Open the weekly calendar. Verify the confirmed plan appears in the
   right cells, and that marking a cell "cooked" outside the chat is
   reflected if you start a new conversation turn afterward.
10. Log an eating-out meal directly in chat ("had suan cai yu for
    lunch"). Verify it appears on the calendar and is excluded from
    future drafts for N days.

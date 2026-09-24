/**
 * Enum-like vocabularies shared by the domain and the database schema.
 *
 * Each list is the single source of truth: `src/server/db/schema` builds its
 * `pgEnum`s (or validates text columns) from these constants, so the database
 * and the domain cannot drift apart. See docs/SPEC.md "Data model".
 */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Status of a meal slot (`meals.status`). A slot with no row is "unknown". */
export const SLOT_STATUSES = [
  "draft",
  "planned",
  "cooked",
  "skipped",
  "ate_out",
] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

/** Status of one dish in a slot (`meal_dishes.status`). See ADR-006. */
export const DISH_STATUSES = [
  "draft",
  "planned",
  "eaten",
  "not_eaten",
] as const;
export type DishStatus = (typeof DISH_STATUSES)[number];

export const TASTE_FACT_TYPES = [
  "preference",
  "restriction",
  "routine",
] as const;
export type TasteFactType = (typeof TASTE_FACT_TYPES)[number];

/** Where a taste fact came from. Nothing merely inferred is ever stored. */
export const TASTE_FACT_SOURCES = ["stated", "choice"] as const;
export type TasteFactSource = (typeof TASTE_FACT_SOURCES)[number];

export const PANTRY_QUANTITIES = ["plenty", "some", "low"] as const;
export type PantryQuantity = (typeof PANTRY_QUANTITIES)[number];

/** Whether a recipe ingredient is a main or a supplementary one. */
export const INGREDIENT_ROLES = ["main", "supplementary"] as const;
export type IngredientRole = (typeof INGREDIENT_ROLES)[number];

/**
 * Event types written to `events.type`. Stored as text, not a database enum,
 * because this list grows often; writes are validated against it instead.
 */
export const EVENT_TYPES = [
  "slot_marked",
  "dish_marked",
  "dish_rated",
  "draft_generated",
  "draft_edited",
  "draft_confirmed",
  "choice_answered",
  "pantry_updated",
  "unmet_request",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

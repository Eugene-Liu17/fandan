import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { RecipeFeatures } from "@/domain/features";
import { id, timestamps } from "./columns";
import { dishStatus, mealSlot, slotStatus } from "./enums";
import { recipes } from "./recipes";
import { userIdRef } from "./users";

/**
 * One row per meal slot (ADR-006). A slot with no row is "unknown", never
 * "cooked" (SPEC core principle 5).
 */
export const meals = pgTable(
  "meals",
  {
    id: id(),
    userId: userIdRef(),
    /** The user's local calendar date (ADR-007). */
    date: date({ mode: "string" }).notNull(),
    slot: mealSlot().notNull(),
    status: slotStatus().notNull(),
    note: text(),
    ...timestamps(),
  },
  // The unique index leads with user_id, so it also serves user_id lookups.
  (t) => [
    unique("meals_user_id_date_slot_unique").on(t.userId, t.date, t.slot),
  ],
);

/** The dishes in a slot, each with its own status (ADR-006). */
export const mealDishes = pgTable(
  "meal_dishes",
  {
    id: id(),
    userId: userIdRef(),
    mealId: uuid()
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    /** Null for dishes eaten out. */
    recipeId: uuid().references(() => recipes.id, { onDelete: "set null" }),
    /** Snapshot taken when the row is created. */
    dishName: text(),
    /** Snapshot used by dedupe. */
    features: jsonb().$type<RecipeFeatures>(),
    status: dishStatus().notNull(),
    rating: smallint(),
    note: text(),
    ...timestamps(),
  },
  (t) => [
    index("meal_dishes_user_id_idx").on(t.userId),
    index("meal_dishes_meal_id_idx").on(t.mealId),
    check("meal_dishes_rating_check", sql`${t.rating} between 1 and 5`),
  ],
);

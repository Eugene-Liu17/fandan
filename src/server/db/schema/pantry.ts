import { index, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamptz } from "./columns";
import { pantryQuantity } from "./enums";
import { userIdRef } from "./users";

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: id(),
    userId: userIdRef(),
    /** Ingredient dictionary key; null when the name is not in it. */
    ingredientKey: text(),
    rawName: text().notNull(),
    quantity: pantryQuantity(),
    addedAt: timestamptz().notNull().defaultNow(),
    /** Set when used up or removed; active items have null. */
    removedAt: timestamptz(),
  },
  (t) => [index("pantry_items_user_id_idx").on(t.userId)],
);

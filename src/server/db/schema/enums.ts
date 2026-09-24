import { pgEnum } from "drizzle-orm/pg-core";
import {
  DISH_STATUSES,
  MEAL_SLOTS,
  PANTRY_QUANTITIES,
  SLOT_STATUSES,
  TASTE_FACT_SOURCES,
  TASTE_FACT_TYPES,
} from "@/domain/enums";

// Values come from src/domain/enums.ts, so the database and the domain cannot
// drift apart. Adding a value there needs a new migration here.
export const mealSlot = pgEnum("meal_slot", MEAL_SLOTS);
export const slotStatus = pgEnum("slot_status", SLOT_STATUSES);
export const dishStatus = pgEnum("dish_status", DISH_STATUSES);
export const tasteFactType = pgEnum("taste_fact_type", TASTE_FACT_TYPES);
export const tasteFactSource = pgEnum("taste_fact_source", TASTE_FACT_SOURCES);
export const pantryQuantity = pgEnum("pantry_quantity", PANTRY_QUANTITIES);

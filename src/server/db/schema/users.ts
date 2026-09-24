import { sql } from "drizzle-orm";
import { check, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, timestamptz } from "./columns";

/**
 * The identity table. `id` will match Supabase `auth.users.id` from M6.
 * Onboarding fields stay null until the user answers them.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    displayName: text().notNull(),
    /** IANA time zone; meal dates are local to it (ADR-007). */
    timezone: text().notNull().default("UTC"),
    /** 0 = Sunday, 1 = Monday. */
    weekStartsOn: smallint().notNull().default(1),
    householdSize: smallint(),
    /** Null means "derive from household size" (ADR-006). */
    dishesPerMeal: smallint(),
    dedupeWindowDays: smallint().notNull().default(14),
    tasteSummary: text(),
    tasteSummaryUpdatedAt: timestamptz(),
    ...timestamps(),
  },
  (t) => [
    check("users_week_starts_on_check", sql`${t.weekStartsOn} in (0, 1)`),
    check("users_household_size_check", sql`${t.householdSize} >= 1`),
    check("users_dishes_per_meal_check", sql`${t.dishesPerMeal} >= 1`),
    check("users_dedupe_window_days_check", sql`${t.dedupeWindowDays} >= 0`),
  ],
);

/** The `user_id` column every user-data table carries. */
export const userIdRef = () =>
  uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

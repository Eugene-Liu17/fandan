import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamptz } from "./columns";
import { userIdRef } from "./users";

/**
 * Behavior log (SPEC MVP item 8). `type` is text validated against
 * `EVENT_TYPES` in src/domain/enums.ts, not a database enum, because the list
 * grows often.
 */
export const events = pgTable(
  "events",
  {
    id: id(),
    userId: userIdRef(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index("events_user_id_created_at_idx").on(t.userId, t.createdAt)],
);

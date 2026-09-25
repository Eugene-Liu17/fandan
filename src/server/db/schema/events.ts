import { bigint, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
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
    /**
     * Insertion order. `created_at` is the transaction's start time, so
     * events written by one transaction share it; order by `seq` instead.
     */
    seq: bigint({ mode: "number" }).generatedAlwaysAsIdentity(),
  },
  (t) => [index("events_user_id_created_at_idx").on(t.userId, t.createdAt)],
);

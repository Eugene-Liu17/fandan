import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamptz } from "./columns";
import { tasteFactSource, tasteFactType } from "./enums";
import { userIdRef } from "./users";

/** What the user stated or chose about their taste. Nothing inferred. */
export const tasteFacts = pgTable(
  "taste_facts",
  {
    id: id(),
    userId: userIdRef(),
    type: tasteFactType().notNull(),
    content: text().notNull(),
    /** For restrictions: a `Restriction` (src/domain/restrictions.ts). */
    payload: jsonb().$type<unknown>(),
    source: tasteFactSource().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
    /** Soft delete: the user retracted this fact. */
    deletedAt: timestamptz(),
  },
  (t) => [
    index("taste_facts_user_id_type_idx").on(t.userId, t.type),
    // A restriction is always written with a structured payload (ADR-008);
    // services still fall back to the stated text if it fails to parse.
    check(
      "taste_facts_restriction_payload_check",
      sql`${t.type} <> 'restriction' or ${t.payload} is not null`,
    ),
  ],
);

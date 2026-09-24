import { date, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, timestamptz } from "./columns";
import { userIdRef } from "./users";

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: userIdRef(),
    /** The week this conversation plans (its first day). */
    weekStart: date({ mode: "string" }),
    title: text(),
    ...timestamps(),
  },
  (t) => [index("conversations_user_id_idx").on(t.userId)],
);

/** Persisted chat messages, shaped after the AI SDK's UIMessage. */
export const messages = pgTable(
  "messages",
  {
    /** The AI SDK message id. */
    id: text().primaryKey(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: userIdRef(),
    role: text().notNull(),
    parts: jsonb().$type<unknown[]>().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_id_created_at_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    index("messages_user_id_idx").on(t.userId),
  ],
);

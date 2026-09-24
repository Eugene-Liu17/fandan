/**
 * Helpers shared by services: loading the acting user and resolving
 * "today" in their time zone. Not part of the public service API.
 */
import { type PlainDate, toPlainDate } from "@/domain/date";
import { type Restriction, restrictionSchema } from "@/domain/restrictions";
import type { DbExecutor } from "@/server/db/repositories/executor";
import type { TasteFactRow } from "@/server/db/repositories/taste-facts";
import { findUser, type UserRow } from "@/server/db/repositories/users";
import { ServiceError } from "./errors";

export async function requireUser(
  ex: DbExecutor,
  userId: string,
): Promise<UserRow> {
  const user = await findUser(ex, userId);
  if (!user) throw new ServiceError("not_found", `No user ${userId}`);
  return user;
}

/** The user's current local date (ADR-007). */
export function todayFor(user: UserRow, now: Date): PlainDate {
  return toPlainDate(now, user.timezone);
}

/**
 * The restriction a stored fact expresses. A payload that no longer parses
 * falls back to matching the stated text, so a restriction is never dropped
 * (ADR-008).
 */
export function restrictionOf(fact: TasteFactRow): Restriction {
  const parsed = restrictionSchema.safeParse(fact.payload);
  return parsed.success ? parsed.data : { kind: "term", text: fact.content };
}

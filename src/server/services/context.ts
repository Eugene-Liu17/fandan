/**
 * Helpers shared by services: loading the acting user and resolving
 * "today" in their time zone. Not part of the public service API.
 */
import { isPlainDate, type PlainDate, toPlainDate } from "@/domain/date";
import {
  type Restriction,
  restrictionSchema,
  restrictionsFromText,
} from "@/domain/restrictions";
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
 * The restrictions a stored fact expresses. A payload that does not parse
 * falls back to reading the stated text (e.g. "花生过敏"), so a restriction
 * is never dropped (ADR-008).
 */
export function restrictionsOf(fact: TasteFactRow): Restriction[] {
  const parsed = restrictionSchema.safeParse(fact.payload);
  return parsed.success ? [parsed.data] : restrictionsFromText(fact.content);
}

/** Parses an optional YYYY-MM-DD input date. */
export function optionalDate(value: string | undefined): PlainDate | undefined {
  if (value === undefined) return undefined;
  if (!isPlainDate(value)) {
    throw new ServiceError("invalid_input", `Not a YYYY-MM-DD date: ${value}`);
  }
  return value;
}

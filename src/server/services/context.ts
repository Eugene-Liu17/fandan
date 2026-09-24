/**
 * Helpers shared by services: loading the acting user and resolving
 * "today" in their time zone. Not part of the public service API.
 */
import { isPlainDate, type PlainDate, toPlainDate } from "@/domain/date";
import {
  type Restriction,
  restrictionSchema,
  restrictionsFromText,
  uniqueRestrictions,
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

/** The user's week start as the domain type (the column is a checked smallint). */
export function weekStartsOnOf(user: UserRow): 0 | 1 {
  return user.weekStartsOn === 0 ? 0 : 1;
}

/** The user's current local date (ADR-007). */
export function todayFor(user: UserRow, now: Date): PlainDate {
  return toPlainDate(now, user.timezone);
}

/**
 * The restrictions a stored fact expresses: its payload together with what
 * its wording says (e.g. "不吃猪肉和海鲜"), so neither a narrow payload nor
 * one that no longer parses can drop part of a stated restriction (ADR-008).
 */
export function restrictionsOf(fact: TasteFactRow): Restriction[] {
  const parsed = restrictionSchema.safeParse(fact.payload);
  return uniqueRestrictions([
    ...(parsed.success ? [parsed.data] : []),
    ...restrictionsFromText(fact.content),
  ]);
}

/** Parses an optional YYYY-MM-DD input date. */
export function optionalDate(value: string | undefined): PlainDate | undefined {
  if (value === undefined) return undefined;
  if (!isPlainDate(value)) {
    throw new ServiceError("invalid_input", `Not a YYYY-MM-DD date: ${value}`);
  }
  return value;
}

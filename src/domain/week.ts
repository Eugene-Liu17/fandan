/**
 * Week ranges over plain calendar dates (ADR-007).
 *
 * The caller supplies "today" as a plain date already resolved in the user's
 * time zone (see `toPlainDate` in ./date), so nothing here depends on the host
 * clock or time zone. See .claude/rules/domain.md.
 */

import { addDays, dayOfWeek, type PlainDate } from "./date";

export type WeekStartsOn = 0 | 1; // 0 = Sunday, 1 = Monday

export interface WeekRange {
  /** First day of the week (inclusive). */
  start: PlainDate;
  /** First day of the following week (exclusive). */
  end: PlainDate;
}

/** Returns the week containing `today`, anchored to `weekStartsOn`. */
export function getWeekRange(
  today: PlainDate,
  weekStartsOn: WeekStartsOn,
): WeekRange {
  const offset = (dayOfWeek(today) - weekStartsOn + 7) % 7;
  const start = addDays(today, -offset);
  return { start, end: addDays(start, 7) };
}

/** The seven dates of `range`, in order. */
export function weekDates(range: WeekRange): PlainDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
}

/** True when `date` falls within `range` (inclusive start, exclusive end). */
export function isWithinWeek(date: PlainDate, range: WeekRange): boolean {
  // YYYY-MM-DD strings sort chronologically.
  return date >= range.start && date < range.end;
}

/**
 * Pure date-range helpers for the weekly planning domain.
 *
 * Every function here is deterministic: time is always passed in as an
 * argument, never read from `Date.now()` internally. This is what lets
 * `src/domain` stay free of hidden I/O and makes every case reproducible
 * in a unit test. See .claude/rules/domain.md.
 */

export type WeekStartsOn = 0 | 1; // 0 = Sunday, 1 = Monday

export interface WeekRange {
  /** Inclusive start of the week, at 00:00:00.000 UTC. */
  start: Date;
  /** Exclusive end of the week (start of the following week), UTC. */
  end: Date;
}

/**
 * Returns the UTC week that contains `now`, anchored to `weekStartsOn`.
 *
 * The range is [start, end): `start` is the first instant of the week's
 * first day, `end` is the first instant of the following week. Both are
 * always at UTC midnight, regardless of `now`'s time-of-day or the host
 * machine's local timezone.
 */
export function getWeekRange(now: Date, weekStartsOn: WeekStartsOn): WeekRange {
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const currentDay = dayStart.getUTCDay();
  const offset = (currentDay - weekStartsOn + 7) % 7;

  const start = new Date(dayStart);
  start.setUTCDate(start.getUTCDate() - offset);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
}

/** Returns true when `date` falls within `range` (inclusive start, exclusive end). */
export function isWithinWeek(date: Date, range: WeekRange): boolean {
  return date >= range.start && date < range.end;
}

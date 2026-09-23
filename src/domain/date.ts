/**
 * Plain calendar dates (`YYYY-MM-DD`) with no time or time zone.
 *
 * Meals are stored against the user's local calendar date (ADR-007), so the
 * domain reasons in plain dates. Converting an instant to a local date is the
 * one place a time zone is involved; the caller always passes `now` in.
 */

declare const plainDateBrand: unique symbol;

/** A validated `YYYY-MM-DD` calendar date. Build one with `parsePlainDate`. */
export type PlainDate = string & { readonly [plainDateBrand]: true };

const PLAIN_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isPlainDate(value: string): value is PlainDate {
  const match = PLAIN_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/** Validates `value` as a plain date; throws `RangeError` if it is not one. */
export function parsePlainDate(value: string): PlainDate {
  if (!isPlainDate(value)) {
    throw new RangeError(`Not a valid YYYY-MM-DD date: "${value}"`);
  }
  return value;
}

// Plain-date arithmetic runs on UTC midnight so no host time zone or DST
// transition can shift a day.
function toUtcMs(date: PlainDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): PlainDate {
  return new Date(ms).toISOString().slice(0, 10) as PlainDate;
}

/** Returns `date` moved by `days` (negative moves backwards). */
export function addDays(date: PlainDate, days: number): PlainDate {
  if (!Number.isInteger(days)) {
    throw new RangeError(`days must be an integer, got ${days}`);
  }
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`: positive when `to` is later. */
export function diffDays(from: PlainDate, to: PlainDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Day of the week: 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: PlainDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/**
 * The calendar date that `instant` falls on in `timeZone` (an IANA name such
 * as `America/Los_Angeles`). Throws `RangeError` for an unknown time zone.
 */
export function toPlainDate(instant: Date, timeZone: string): PlainDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return parsePlainDate(`${get("year")}-${get("month")}-${get("day")}`);
}

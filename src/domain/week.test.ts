import { describe, expect, it } from "vitest";
import { getWeekRange, isWithinWeek } from "./week";

describe("getWeekRange", () => {
  it("anchors to Monday when weekStartsOn is 1", () => {
    // 2026-09-22 is a Tuesday (UTC).
    const now = new Date("2026-09-22T15:30:00.000Z");
    const range = getWeekRange(now, 1);

    expect(range.start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("anchors to Sunday when weekStartsOn is 0", () => {
    const now = new Date("2026-09-22T15:30:00.000Z");
    const range = getWeekRange(now, 0);

    expect(range.start.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("returns the same day as start when now falls exactly on the anchor day", () => {
    // 2026-09-21 is a Monday.
    const now = new Date("2026-09-21T00:00:00.000Z");
    const range = getWeekRange(now, 1);

    expect(range.start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-10-01 is a Thursday.
    const now = new Date("2026-10-01T12:00:00.000Z");
    const range = getWeekRange(now, 1);

    expect(range.start.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("crosses a year boundary correctly", () => {
    // 2027-01-01 is a Friday.
    const now = new Date("2027-01-01T08:00:00.000Z");
    const range = getWeekRange(now, 1);

    expect(range.start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });

  it("ignores the host time-of-day component", () => {
    const morning = getWeekRange(new Date("2026-09-22T00:00:01.000Z"), 1);
    const night = getWeekRange(new Date("2026-09-22T23:59:59.000Z"), 1);

    expect(morning.start.toISOString()).toBe(night.start.toISOString());
    expect(morning.end.toISOString()).toBe(night.end.toISOString());
  });
});

describe("isWithinWeek", () => {
  it("includes the start instant and excludes the end instant", () => {
    const range = getWeekRange(new Date("2026-09-22T00:00:00.000Z"), 1);

    expect(isWithinWeek(range.start, range)).toBe(true);
    expect(isWithinWeek(range.end, range)).toBe(false);
  });

  it("returns false for a date entirely outside the week", () => {
    const range = getWeekRange(new Date("2026-09-22T00:00:00.000Z"), 1);
    const farAway = new Date("2020-01-01T00:00:00.000Z");

    expect(isWithinWeek(farAway, range)).toBe(false);
  });
});

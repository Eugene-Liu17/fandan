import { describe, expect, it } from "vitest";
import { parsePlainDate } from "./date";
import { getWeekRange, isWithinWeek, weekDates } from "./week";

const d = parsePlainDate;

describe("getWeekRange", () => {
  it("anchors to Monday when weekStartsOn is 1", () => {
    // 2026-09-22 is a Tuesday.
    expect(getWeekRange(d("2026-09-22"), 1)).toEqual({
      start: "2026-09-21",
      end: "2026-09-28",
    });
  });

  it("anchors to Sunday when weekStartsOn is 0", () => {
    expect(getWeekRange(d("2026-09-22"), 0)).toEqual({
      start: "2026-09-20",
      end: "2026-09-27",
    });
  });

  it("returns today as start when today is the anchor day", () => {
    // 2026-09-21 is a Monday.
    expect(getWeekRange(d("2026-09-21"), 1).start).toBe("2026-09-21");
  });

  it("treats Sunday as the last day of a Monday-start week", () => {
    expect(getWeekRange(d("2026-09-27"), 1).start).toBe("2026-09-21");
  });

  it("crosses a month boundary", () => {
    // 2026-10-01 is a Thursday.
    expect(getWeekRange(d("2026-10-01"), 1)).toEqual({
      start: "2026-09-28",
      end: "2026-10-05",
    });
  });

  it("crosses a year boundary", () => {
    // 2027-01-01 is a Friday.
    expect(getWeekRange(d("2027-01-01"), 1)).toEqual({
      start: "2026-12-28",
      end: "2027-01-04",
    });
  });
});

describe("weekDates", () => {
  it("lists the seven days in order", () => {
    const range = getWeekRange(d("2026-12-30"), 1);
    expect(weekDates(range)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("isWithinWeek", () => {
  const range = getWeekRange(d("2026-09-22"), 1);

  it("includes the start date and excludes the end date", () => {
    expect(isWithinWeek(range.start, range)).toBe(true);
    expect(isWithinWeek(d("2026-09-27"), range)).toBe(true);
    expect(isWithinWeek(range.end, range)).toBe(false);
  });

  it("returns false for a date entirely outside the week", () => {
    expect(isWithinWeek(d("2020-01-01"), range)).toBe(false);
  });
});

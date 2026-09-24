import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  diffDays,
  isPlainDate,
  parsePlainDate,
  toPlainDate,
} from "./date";

describe("isPlainDate / parsePlainDate", () => {
  it("accepts real calendar dates, including a leap day", () => {
    expect(isPlainDate("2026-09-23")).toBe(true);
    expect(isPlainDate("2028-02-29")).toBe(true);
    expect(parsePlainDate("2026-01-01")).toBe("2026-01-01");
  });

  it("rejects impossible dates and wrong formats", () => {
    for (const bad of [
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "2026-00-10",
      "2026-9-3",
      "2026/09/23",
      "2026-09-23T00:00:00Z",
      "",
    ]) {
      expect(isPlainDate(bad), bad).toBe(false);
    }
  });

  it("throws a RangeError when parsing an invalid date", () => {
    expect(() => parsePlainDate("2026-02-30")).toThrow(RangeError);
  });
});

describe("addDays", () => {
  const d = parsePlainDate("2026-09-23");

  it("moves forwards and backwards", () => {
    expect(addDays(d, 1)).toBe("2026-09-24");
    expect(addDays(d, -23)).toBe("2026-08-31");
    expect(addDays(d, 0)).toBe("2026-09-23");
  });

  it("crosses month, year, and leap-day boundaries", () => {
    expect(addDays(parsePlainDate("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(parsePlainDate("2028-02-28"), 1)).toBe("2028-02-29");
    expect(addDays(parsePlainDate("2027-02-28"), 1)).toBe("2027-03-01");
  });

  it("is not shifted by a DST transition day", () => {
    // US clocks spring forward on 2027-03-14.
    expect(addDays(parsePlainDate("2027-03-13"), 2)).toBe("2027-03-15");
  });

  it("rejects a fractional day count", () => {
    expect(() => addDays(d, 1.5)).toThrow(RangeError);
  });
});

describe("diffDays", () => {
  it("counts whole days with sign", () => {
    const a = parsePlainDate("2026-09-01");
    const b = parsePlainDate("2026-09-15");
    expect(diffDays(a, b)).toBe(14);
    expect(diffDays(b, a)).toBe(-14);
    expect(diffDays(a, a)).toBe(0);
  });

  it("counts across a year boundary", () => {
    expect(
      diffDays(parsePlainDate("2026-12-25"), parsePlainDate("2027-01-08")),
    ).toBe(14);
  });
});

describe("dayOfWeek", () => {
  it("returns 0 for Sunday through 6 for Saturday", () => {
    expect(dayOfWeek(parsePlainDate("2026-09-20"))).toBe(0);
    expect(dayOfWeek(parsePlainDate("2026-09-21"))).toBe(1);
    expect(dayOfWeek(parsePlainDate("2026-09-26"))).toBe(6);
  });
});

describe("toPlainDate", () => {
  it("keeps an 8 pm Pacific dinner on the local date, not the UTC date", () => {
    // 2026-09-23 20:00 PDT is 2026-09-24 03:00 UTC.
    const instant = new Date("2026-09-24T03:00:00.000Z");
    expect(toPlainDate(instant, "America/Los_Angeles")).toBe("2026-09-23");
    expect(toPlainDate(instant, "UTC")).toBe("2026-09-24");
  });

  it("moves ahead of UTC for Asia/Shanghai", () => {
    // 2026-09-23 18:00 UTC is 2026-09-24 02:00 in Shanghai.
    const instant = new Date("2026-09-23T18:00:00.000Z");
    expect(toPlainDate(instant, "Asia/Shanghai")).toBe("2026-09-24");
  });

  it("is correct on a DST transition day", () => {
    // 2027-03-14 23:30 PDT (after spring forward) is 2027-03-15 06:30 UTC.
    const instant = new Date("2027-03-15T06:30:00.000Z");
    expect(toPlainDate(instant, "America/Los_Angeles")).toBe("2027-03-14");
  });

  it("throws for an unknown time zone", () => {
    expect(() => toPlainDate(new Date(0), "Mars/Olympus_Mons")).toThrow(
      RangeError,
    );
  });
});

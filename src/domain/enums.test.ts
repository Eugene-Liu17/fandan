import { describe, expect, it } from "vitest";
import {
  DISH_STATUSES,
  EVENT_TYPES,
  isOneOf,
  MEAL_SLOTS,
  SLOT_STATUSES,
} from "./enums";

describe("isOneOf", () => {
  it("accepts a member of the list", () => {
    expect(isOneOf(MEAL_SLOTS, "dinner")).toBe(true);
    expect(isOneOf(EVENT_TYPES, "unmet_request")).toBe(true);
  });

  it("rejects a string that is not in the list", () => {
    expect(isOneOf(MEAL_SLOTS, "supper")).toBe(false);
    expect(isOneOf(MEAL_SLOTS, "")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isOneOf(MEAL_SLOTS, undefined)).toBe(false);
    expect(isOneOf(MEAL_SLOTS, null)).toBe(false);
    expect(isOneOf(MEAL_SLOTS, 1)).toBe(false);
  });
});

describe("status vocabularies", () => {
  it("never includes 'unknown' as a stored status (a missing row is unknown)", () => {
    expect(isOneOf(SLOT_STATUSES, "unknown")).toBe(false);
    expect(isOneOf(DISH_STATUSES, "unknown")).toBe(false);
  });
});

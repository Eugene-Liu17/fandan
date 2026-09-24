import { describe, expect, it } from "vitest";
import { DISH_STATUSES, SLOT_STATUSES } from "./enums";

describe("status vocabularies", () => {
  it("never includes 'unknown' as a stored status (a missing row is unknown)", () => {
    expect(SLOT_STATUSES).not.toContain("unknown");
    expect(DISH_STATUSES).not.toContain("unknown");
  });
});

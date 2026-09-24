import { describe, expect, it } from "vitest";
import { recipeFeaturesSchema } from "./features";

const valid = {
  role: "meat",
  cuisine: "home_style",
  method: "braise",
  flavor: "soy_braised",
  main_ingredient: "pork_belly",
  oil_level: "high",
};

describe("recipeFeaturesSchema", () => {
  it("accepts a fully labeled dish", () => {
    expect(recipeFeaturesSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a null main ingredient (e.g. a dish eaten out)", () => {
    const parsed = recipeFeaturesSchema.parse({
      ...valid,
      main_ingredient: null,
    });
    expect(parsed.main_ingredient).toBeNull();
  });

  it("rejects a main ingredient that is not a dictionary key", () => {
    const result = recipeFeaturesSchema.safeParse({
      ...valid,
      main_ingredient: "五花肉",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a value outside a fixed vocabulary", () => {
    for (const patch of [
      { role: "dessert" },
      { cuisine: "martian" },
      { method: "microwave" },
      { flavor: "umami_bomb" },
      { oil_level: "extreme" },
    ]) {
      const result = recipeFeaturesSchema.safeParse({ ...valid, ...patch });
      expect(result.success, JSON.stringify(patch)).toBe(false);
    }
  });

  it("rejects a missing field", () => {
    const { flavor: _omit, ...rest } = valid;
    expect(recipeFeaturesSchema.safeParse(rest).success).toBe(false);
  });
});

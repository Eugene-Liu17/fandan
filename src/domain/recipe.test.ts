import { describe, expect, it } from "vitest";
import { recipeIngredientSchema, resolveIngredientKey } from "./recipe";

describe("recipeIngredientSchema", () => {
  it("accepts a mapped and an unmapped ingredient", () => {
    expect(
      recipeIngredientSchema.parse({
        raw_name: "五花肉",
        key: "pork_belly",
        amount: "500g",
        role: "main",
      }).key,
    ).toBe("pork_belly");
    expect(
      recipeIngredientSchema.parse({
        raw_name: "榴莲",
        key: null,
        role: "supplementary",
      }).key,
    ).toBeNull();
  });

  it("rejects an unknown key, a blank name, and an unknown role", () => {
    const base = { raw_name: "五花肉", key: "pork_belly", role: "main" };
    for (const patch of [
      { key: "not_a_key" },
      { raw_name: "   " },
      { role: "garnish" },
    ]) {
      expect(
        recipeIngredientSchema.safeParse({ ...base, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});

describe("resolveIngredientKey", () => {
  it("prefers a valid stored key", () => {
    expect(
      resolveIngredientKey({ raw_name: "带皮肉", key: "pork_belly" }),
    ).toBe("pork_belly");
  });

  it("falls back to the raw name when the key is missing or invalid", () => {
    expect(resolveIngredientKey({ raw_name: "西红柿", key: null })).toBe(
      "tomato",
    );
    expect(resolveIngredientKey({ raw_name: "西红柿", key: "stale_key" })).toBe(
      "tomato",
    );
  });

  it("returns null for an unmapped name", () => {
    expect(resolveIngredientKey({ raw_name: "榴莲", key: null })).toBeNull();
  });
});

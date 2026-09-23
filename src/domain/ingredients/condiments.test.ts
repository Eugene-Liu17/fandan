import { describe, expect, it } from "vitest";
import { isStandardCondiment, STANDARD_CONDIMENTS } from "./condiments";
import { getIngredient, normalizeIngredient } from "./normalize";

describe("STANDARD_CONDIMENTS", () => {
  it("only lists keys that exist in the dictionary", () => {
    for (const key of STANDARD_CONDIMENTS) {
      expect(getIngredient(key), key).toBeDefined();
    }
  });

  it("does not include scallion, ginger, or garlic (ADR-008)", () => {
    for (const raw of ["葱", "姜", "蒜"]) {
      const n = normalizeIngredient(raw);
      expect(n.kind).toBe("mapped");
      if (n.kind === "mapped") expect(isStandardCondiment(n.key)).toBe(false);
    }
  });

  it("keeps allergen tags on condiments, so allergy filtering still sees them", () => {
    expect(getIngredient("light_soy_sauce")?.allergens).toContain("soy");
    expect(getIngredient("oyster_sauce")?.allergens).toContain("mollusc");
  });
});

describe("isStandardCondiment", () => {
  it("recognizes a condiment key", () => {
    expect(isStandardCondiment("salt")).toBe(true);
    expect(isStandardCondiment("light_soy_sauce")).toBe(true);
  });

  it("rejects a non-condiment and an unknown key", () => {
    expect(isStandardCondiment("pork_belly")).toBe(false);
    expect(isStandardCondiment("nope")).toBe(false);
  });
});

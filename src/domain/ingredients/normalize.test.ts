import { describe, expect, it } from "vitest";
import { INGREDIENTS, type IngredientEntry } from "./dictionary";
import {
  buildIngredientIndex,
  getIngredient,
  isIngredientKey,
  normalizeIngredient,
  normalizeName,
} from "./normalize";
import { ALLERGEN_TAGS, INGREDIENT_CATEGORIES } from "./vocab";

describe("normalizeName", () => {
  it("removes whitespace and folds full-width characters and Latin case", () => {
    expect(normalizeName("  五花 肉 ")).toBe("五花肉");
    expect(normalizeName("ＸＯ酱")).toBe("xo酱");
  });

  it("is idempotent", () => {
    for (const raw of ["  带皮 五花肉", "ＸＯ酱", "鸡蛋"]) {
      expect(normalizeName(normalizeName(raw))).toBe(normalizeName(raw));
    }
  });
});

describe("normalizeIngredient", () => {
  it("maps a canonical name", () => {
    expect(normalizeIngredient("五花肉")).toEqual({
      kind: "mapped",
      key: "pork_belly",
    });
  });

  it("maps the first and last entries of the dictionary", () => {
    expect(normalizeIngredient("猪肉")).toEqual({
      kind: "mapped",
      key: "pork",
    });
    expect(normalizeIngredient("番茄酱")).toEqual({
      kind: "mapped",
      key: "ketchup",
    });
  });

  it("maps an alias to the same key as its canonical name", () => {
    expect(normalizeIngredient("猪五花")).toEqual({
      kind: "mapped",
      key: "pork_belly",
    });
    expect(normalizeIngredient("西红柿")).toEqual(normalizeIngredient("番茄"));
  });

  it("tolerates stray whitespace", () => {
    expect(normalizeIngredient(" 西 兰花 ")).toEqual({
      kind: "mapped",
      key: "broccoli",
    });
  });

  it("does not guess by substring", () => {
    // Contains 五花肉 but is not an exact name or alias.
    expect(normalizeIngredient("五花肉片儿")).toEqual({
      kind: "unmapped",
      name: "五花肉片儿",
    });
  });

  it("returns the normalized name when unmapped", () => {
    expect(normalizeIngredient(" 榴莲 ")).toEqual({
      kind: "unmapped",
      name: "榴莲",
    });
    expect(normalizeIngredient("")).toEqual({ kind: "unmapped", name: "" });
  });
});

describe("getIngredient / isIngredientKey", () => {
  it("looks up an entry by key", () => {
    expect(getIngredient("light_soy_sauce")?.name).toBe("生抽");
    expect(isIngredientKey("light_soy_sauce")).toBe(true);
  });

  it("returns nothing for an unknown key", () => {
    expect(getIngredient("dragon_fruit_sauce")).toBeUndefined();
    expect(isIngredientKey("dragon_fruit_sauce")).toBe(false);
  });
});

describe("buildIngredientIndex", () => {
  const entry = (
    key: string,
    name: string,
    aliases: string[] = [],
  ): IngredientEntry => ({
    key,
    name,
    aliases,
    category: "vegetable",
    allergens: [],
  });

  it("rejects a duplicate key", () => {
    expect(() =>
      buildIngredientIndex([entry("a", "甲"), entry("a", "乙")]),
    ).toThrow(/Duplicate ingredient key/);
  });

  it("rejects a name shared by two entries, even after normalization", () => {
    expect(() =>
      buildIngredientIndex([
        entry("a", "甲", ["丙"]),
        entry("b", "乙", [" 丙 "]),
      ]),
    ).toThrow(/used by both a and b/);
  });
});

describe("dictionary integrity", () => {
  it("loads without duplicate keys or names", () => {
    expect(() => buildIngredientIndex(INGREDIENTS)).not.toThrow();
  });

  it("uses only known categories and allergen tags", () => {
    for (const e of INGREDIENTS) {
      expect(INGREDIENT_CATEGORIES, e.key).toContain(e.category);
      for (const tag of e.allergens) {
        expect(ALLERGEN_TAGS, e.key).toContain(tag);
      }
    }
  });

  it("uses snake_case keys", () => {
    for (const e of INGREDIENTS) {
      expect(e.key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("stores names already in normalized form", () => {
    for (const e of INGREDIENTS) {
      for (const n of [e.name, ...e.aliases]) {
        expect(normalizeName(n), `${e.key}: ${n}`).toBe(n);
      }
    }
  });

  it("tags the compound ingredients that hide allergens", () => {
    const tags = (raw: string) => {
      const n = normalizeIngredient(raw);
      return n.kind === "mapped" ? getIngredient(n.key)?.allergens : undefined;
    };
    expect(tags("生抽")).toEqual(expect.arrayContaining(["soy", "wheat"]));
    expect(tags("酱油")).toEqual(expect.arrayContaining(["soy", "wheat"]));
    expect(tags("蚝油")).toContain("mollusc");
    expect(tags("芝麻油")).toContain("sesame");
    expect(tags("豆瓣酱")).toEqual(expect.arrayContaining(["soy", "wheat"]));
    expect(tags("面条")).toContain("wheat");
    expect(tags("花生油")).toContain("peanut");
    expect(tags("虾皮")).toContain("crustacean");
    expect(tags("豆芽")).toContain("soy");
  });
});

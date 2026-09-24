import { describe, expect, it } from "vitest";
import {
  containsTerm,
  filterByRestrictions,
  findViolations,
  type Restriction,
  restrictionSchema,
  restrictionsFromText,
  uniqueRestrictions,
} from "./restrictions";
import { recipe } from "./testing/fixtures";

const soy: Restriction = { kind: "allergen", tag: "soy" };
const peanut: Restriction = { kind: "allergen", tag: "peanut" };
const fish: Restriction = { kind: "allergen", tag: "fish" };
const mollusc: Restriction = { kind: "allergen", tag: "mollusc" };
const noPork: Restriction = { kind: "category", category: "pork" };

describe("SPEC acceptance: no draft contains a declared allergen", () => {
  it("excludes an allergen written under an alias (酱油 is soy)", () => {
    const dish = recipe("r1", "青椒肉丝", ["里脊肉", "青椒", "酱油"]);
    expect(findViolations(dish, [soy])).toEqual([
      { restriction: soy, source: "ingredient", matched: "酱油" },
    ]);
  });

  it("excludes an allergen hidden in a standard condiment (蚝油 is mollusc)", () => {
    const dish = recipe("r2", "蚝油生菜", ["生菜", "蚝油", "蒜"]);
    expect(findViolations(dish, [mollusc])).toHaveLength(1);
  });

  it("excludes an unmapped ingredient whose name contains the allergen (花生酱)", () => {
    const dish = recipe("r3", "凉拌面", ["面条", "花生酱", "黄瓜"]);
    expect(findViolations(dish, [peanut])).toEqual([
      { restriction: peanut, source: "ingredient", matched: "花生酱" },
    ]);
  });

  it("uses a stored dictionary key even when the raw name hides it", () => {
    const dish = {
      ...recipe("r4", "家常菜", []),
      ingredients: [
        { raw_name: "秘制酱汁", key: "light_soy_sauce", role: "main" } as const,
      ],
    };
    expect(findViolations(dish, [soy])).toHaveLength(1);
  });

  it("scans the recipe name when the ingredient list is incomplete", () => {
    const dish = recipe("r5", "花生酱拌面", ["面条", "黄瓜"]);
    expect(findViolations(dish, [peanut])).toEqual([
      { restriction: peanut, source: "recipe_name", matched: "花生酱拌面" },
    ]);
  });

  it("does not read a single character in a recipe name as the allergen (鱼香肉丝)", () => {
    const dish = recipe("r6", "鱼香肉丝", ["里脊肉", "木耳", "胡萝卜", "糖"]);
    expect(findViolations(dish, [fish])).toEqual([]);
  });

  it("checks the labeled main ingredient", () => {
    const dish = recipe("r7", "私房菜", ["秘制配料"], {
      main_ingredient: "shrimp",
    });
    expect(
      findViolations(dish, [{ kind: "allergen", tag: "crustacean" }]),
    ).toEqual([
      {
        restriction: { kind: "allergen", tag: "crustacean" },
        source: "main_ingredient",
        matched: "虾",
      },
    ]);
  });

  it("reports every violated restriction once", () => {
    const dish = recipe("r8", "宫保鸡丁", ["鸡胸肉", "花生米", "生抽", "老抽"]);
    const violations = findViolations(dish, [peanut, soy, fish]);
    expect(violations.map((v) => v.restriction)).toEqual([peanut, soy]);
  });
});

describe("findViolations: diet restrictions", () => {
  it("excludes every product of a category, including unlisted ones (猪油)", () => {
    expect(
      findViolations(recipe("a", "猪油拌饭", ["米饭", "猪油"]), [noPork]),
    ).toHaveLength(1);
    expect(
      findViolations(recipe("b", "红烧肉", ["五花肉"]), [noPork]),
    ).toHaveLength(1);
    expect(
      findViolations(recipe("c", "清炒菠菜", ["菠菜", "蒜"]), [noPork]),
    ).toEqual([]);
  });

  it("excludes a single ingredient and its aliases", () => {
    const noCilantro: Restriction = { kind: "ingredient", key: "cilantro" };
    expect(
      findViolations(recipe("a", "凉拌黄瓜", ["黄瓜", "芫荽"]), [noCilantro]),
    ).toHaveLength(1);
    expect(
      findViolations(recipe("b", "凉拌黄瓜", ["黄瓜", "香菜末"]), [noCilantro]),
    ).toHaveLength(1);
  });

  it("matches a free-text term that is not in the dictionary", () => {
    const noDurian: Restriction = { kind: "term", text: "榴莲" };
    expect(
      findViolations(recipe("a", "甜品", ["榴莲肉", "牛奶"]), [noDurian]),
    ).toHaveLength(1);
  });

  it("expands a free-text term that maps to the dictionary to its aliases", () => {
    const noTomato: Restriction = { kind: "term", text: "番茄" };
    expect(
      findViolations(recipe("a", "炒蛋", ["鸡蛋", "西红柿"]), [noTomato]),
    ).toHaveLength(1);
  });
});

describe("filterByRestrictions", () => {
  const dishes = [
    recipe("ok", "清炒菠菜", ["菠菜", "蒜", "盐"]),
    recipe("bad", "麻婆豆腐", ["豆腐", "肉末", "豆瓣酱"]),
  ];

  it("splits recipes into allowed and excluded", () => {
    const result = filterByRestrictions(dishes, [soy]);
    expect(result.allowed.map((r) => r.id)).toEqual(["ok"]);
    expect(result.excluded.map((e) => e.recipe.id)).toEqual(["bad"]);
    expect(result.excluded[0]?.violations[0]?.matched).toBe("豆腐");
  });

  it("allows everything when there are no restrictions", () => {
    expect(filterByRestrictions(dishes, []).allowed).toHaveLength(2);
  });

  it("handles an empty recipe list", () => {
    expect(filterByRestrictions([], [soy])).toEqual({
      allowed: [],
      excluded: [],
    });
  });
});

describe("restrictionSchema", () => {
  it("accepts each kind", () => {
    for (const r of [
      soy,
      noPork,
      { kind: "ingredient", key: "cilantro" },
      { kind: "term", text: "榴莲" },
    ]) {
      expect(restrictionSchema.safeParse(r).success, JSON.stringify(r)).toBe(
        true,
      );
    }
  });

  it("rejects unknown tags, keys, blank terms, and kinds", () => {
    for (const r of [
      { kind: "allergen", tag: "gluten" },
      { kind: "category", category: "seafood" },
      { kind: "ingredient", key: "unicorn" },
      { kind: "term", text: "   " },
      { kind: "mood", text: "sad" },
    ]) {
      expect(restrictionSchema.safeParse(r).success, JSON.stringify(r)).toBe(
        false,
      );
    }
  });
});

describe("restrictionsFromText", () => {
  const excludes = (statement: string, dish: ReturnType<typeof recipe>) =>
    filterByRestrictions([dish], restrictionsFromText(statement)).excluded
      .length === 1;

  it("keeps the statement and its core as terms", () => {
    expect(restrictionsFromText("不吃榴莲").slice(0, 2)).toEqual([
      { kind: "term", text: "不吃榴莲" },
      { kind: "term", text: "榴莲" },
    ]);
    expect(excludes("不吃榴莲", recipe("a", "榴莲酥", ["榴莲", "面粉"]))).toBe(
      true,
    );
  });

  it("reads an allergy stated in plain words (花生过敏)", () => {
    expect(restrictionsFromText("花生过敏")).toContainEqual({
      kind: "allergen",
      tag: "peanut",
    });
    expect(
      excludes("花生过敏", recipe("a", "宫保鸡丁", ["鸡胸肉", "花生米"])),
    ).toBe(true);
    expect(
      excludes("花生过敏", recipe("b", "凉拌菜", ["黄瓜", "花生油"])),
    ).toBe(true);
  });

  it("reads a whole category (不吃猪肉 excludes 五花肉)", () => {
    expect(
      excludes("不吃猪肉", recipe("a", "红烧肉", ["五花肉", "冰糖"])),
    ).toBe(true);
    expect(excludes("不吃猪肉", recipe("b", "清炒菠菜", ["菠菜"]))).toBe(false);
  });

  it("reads seafood as fish and shellfish", () => {
    expect(excludes("海鲜过敏", recipe("a", "白灼虾", ["基围虾"]))).toBe(true);
    expect(excludes("海鲜过敏", recipe("b", "清蒸鲈鱼", ["鲈鱼"]))).toBe(true);
    expect(excludes("海鲜过敏", recipe("c", "蒸扇贝", ["扇贝"]))).toBe(true);
  });

  it("reads vegetarian as no meat or seafood", () => {
    expect(excludes("我吃素", recipe("a", "可乐鸡翅", ["鸡翅"]))).toBe(true);
    expect(excludes("我吃素", recipe("b", "清炒菠菜", ["菠菜", "蒜"]))).toBe(
      false,
    );
  });

  it("reads dictionary names and short aromatics", () => {
    expect(restrictionsFromText("不要香菜")).toContainEqual({
      kind: "ingredient",
      key: "cilantro",
    });
    expect(excludes("不吃葱", recipe("a", "葱油拌面", ["面条", "小葱"]))).toBe(
      true,
    );
  });

  it("returns nothing for a blank statement and never duplicates", () => {
    expect(restrictionsFromText("   ")).toEqual([]);
    const found = restrictionsFromText("海鲜海鲜过敏").map((r) =>
      JSON.stringify(r),
    );
    expect(new Set(found).size).toBe(found.length);
  });
});

describe("SPEC acceptance: real statements and spellings (post-M1 review)", () => {
  const excluded = (statement: string, ingredients: string[]) =>
    filterByRestrictions(
      [recipe("dish", "测试菜", ingredients)],
      restrictionsFromText(statement),
    ).excluded.length === 1;

  it.each([
    ["不吃牛肉", ["肥牛卷", "金针菇"]],
    ["不吃牛肉", ["牛排"]],
    ["不吃牛肉", ["牛百叶"]],
    ["不吃牛肉", ["牛骨汤底"]],
    ["不吃牛羊肉", ["牛腩", "土豆"]],
    ["不吃牛羊肉", ["羊排"]],
    ["不吃猪肉", ["肉丝", "青椒"]],
    ["不吃猪肉", ["火腿", "米饭"]],
    ["不吃猪肉", ["培根", "芦笋"]],
    ["不吃猪肉", ["叉烧"]],
    ["不吃猪肉", ["猪油"]],
    ["不吃鸡", ["翅中"]],
    ["不吃鸡", ["凤爪"]],
    ["不吃鸡", ["西兰花", "鸡精"]],
    ["奶过敏", ["鸡蛋", "黄油"]],
    ["奶过敏", ["芝士"]],
    ["乳制品过敏", ["淡奶油"]],
    ["鸡蛋过敏", ["馄饨皮"]],
    ["蛋过敏", ["鸡蛋"]],
    ["鸡蛋过敏", ["西兰花", "鸡精"]],
    ["豆类过敏", ["豆腐"]],
    ["大豆过敏", ["酱油"]],
    ["小麦过敏", ["馄饨皮"]],
    ["麸质过敏", ["面条"]],
    ["海鲜过敏", ["xo酱"]],
    ["海鲜过敏", ["基围虾"]],
    ["海鲜过敏", ["鲈鱼"]],
    ["芝麻过敏", ["鸡胸肉", "辣椒油"]],
    ["花生过敏", ["黄瓜", "红油"]],
    ["不吃红肉", ["排骨"]],
    ["不吃红肉", ["羊肉"]],
    ["不吃肉", ["排骨"]],
    ["我不吃肉", ["牛腩"]],
    ["不吃荤", ["鸡翅"]],
    ["我吃素", ["虾仁"]],
    ["蛋奶素", ["五花肉"]],
    ["纯素", ["鸡蛋"]],
    ["纯素", ["牛奶"]],
    ["不吃香菜", ["芫荽"]],
    ["不吃葱", ["小葱"]],
    ["不吃榴莲", ["榴莲肉"]],
    ["对虾过敏", ["虾仁"]],
  ])("%s excludes %j", (statement, ingredients) => {
    expect(excluded(statement, ingredients)).toBe(true);
  });

  it.each([
    ["不吃猪肉", ["鸡翅"]],
    ["不吃猪肉", ["牛腩"]],
    ["蛋奶素", ["番茄", "鸡蛋"]],
    ["蛋奶素", ["牛奶"]],
    ["鸡蛋过敏", ["鸡翅"]],
    ["牛奶过敏", ["牛腩"]],
    ["不吃牛肉", ["牛奶"]],
    ["不吃牛肉", ["牛油果"]],
    ["不吃洋葱", ["小葱"]],
    ["不吃羊肉", ["羊肚菌"]],
    ["花生过敏", ["菠菜"]],
  ])("%s still allows %j", (statement, ingredients) => {
    expect(excluded(statement, ingredients)).toBe(false);
  });
});

describe("category search terms", () => {
  it("catch unlisted products but not look-alike words", () => {
    const noBeef: Restriction = { kind: "category", category: "beef" };
    const noPoultry: Restriction = { kind: "category", category: "poultry" };
    const check = (r: Restriction, ingredient: string) =>
      findViolations(recipe("x", "测试菜", [ingredient]), [r]).length > 0;
    expect(check(noBeef, "牛骨髓")).toBe(true);
    expect(check(noBeef, "牛奶")).toBe(false);
    expect(check(noBeef, "牛蛙")).toBe(false);
    expect(check(noPoultry, "鸭血")).toBe(true);
    expect(check(noPoultry, "鸭蛋")).toBe(false);
  });
});

describe("containsTerm", () => {
  it("ignores the term inside an excluded word, but not elsewhere", () => {
    const beef = { term: "牛", unless: ["牛奶"] };
    expect(containsTerm("牛奶", beef)).toBe(false);
    expect(containsTerm("牛奶炖牛肉", beef)).toBe(true);
    expect(containsTerm("肥牛", { term: "牛" })).toBe(true);
  });

  it("does not join neighbours into a new match when masking", () => {
    // Deleting 奶 would turn 牛奶肉 into 牛肉.
    expect(containsTerm("牛奶肉", { term: "牛肉", unless: ["奶"] })).toBe(
      false,
    );
  });
});

describe("uniqueRestrictions", () => {
  it("drops duplicates and keeps first-seen order", () => {
    const peanut: Restriction = { kind: "allergen", tag: "peanut" };
    expect(uniqueRestrictions([peanut, soy, { ...peanut }])).toEqual([
      peanut,
      soy,
    ]);
  });
});

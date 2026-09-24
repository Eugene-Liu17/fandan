import { describe, expect, it } from "vitest";
import {
  computeShoppingList,
  ingredientIdentity,
  type PantryItem,
  pantryIdentities,
} from "./shopping-list";
import { recipe } from "./testing/fixtures";

const hongshaorou = recipe("hsr", "红烧肉", [
  "五花肉",
  "冰糖",
  "生抽",
  "老抽",
  "料酒",
  "葱",
  "姜",
]);
const fanqiechaodan = recipe("fqcd", "番茄炒蛋", [
  "西红柿",
  "鸡蛋",
  "葱花",
  "盐",
  "糖",
  "食用油",
]);

const pantry = (...names: string[]): PantryItem[] =>
  names.map((rawName) => ({ ingredientKey: null, rawName }));

const names = (items: { name: string }[]) => items.map((i) => i.name);

describe("SPEC acceptance: shopping list is the deterministic set difference", () => {
  it("with an empty pantry lists every non-condiment ingredient", () => {
    expect(names(computeShoppingList([hongshaorou], []))).toEqual([
      "五花肉",
      "冰糖",
      "葱",
      "姜",
    ]);
  });

  it("drops standard condiments but keeps scallion, ginger, and garlic", () => {
    const list = computeShoppingList([fanqiechaodan], []);
    expect(names(list)).toEqual(["番茄", "鸡蛋", "葱"]);
  });

  it("subtracts pantry items, matching through aliases", () => {
    const list = computeShoppingList(
      [hongshaorou, fanqiechaodan],
      pantry("猪五花", "番茄", "土鸡蛋"),
    );
    expect(names(list)).toEqual(["冰糖", "葱", "姜"]);
  });

  it("merges the same ingredient across dishes, even when spelled differently", () => {
    const list = computeShoppingList([hongshaorou, fanqiechaodan], []);
    const scallion = list.find((i) => i.key === "scallion");
    expect(scallion?.recipeIds).toEqual(["hsr", "fqcd"]);
    expect(list.filter((i) => i.key === "scallion")).toHaveLength(1);
  });

  it("returns nothing when the pantry covers everything", () => {
    expect(
      computeShoppingList([hongshaorou], pantry("五花肉", "冰糖", "葱", "姜")),
    ).toEqual([]);
  });

  it("returns nothing for no recipes", () => {
    expect(computeShoppingList([], pantry("葱"))).toEqual([]);
  });

  it("matches unmapped ingredients by normalized name", () => {
    const dish = recipe("x", "酸菜鱼", ["草鱼", "酸菜", "泡椒"]);
    const list = computeShoppingList([dish], pantry(" 酸 菜 "));
    expect(list).toEqual([
      { key: "grass_carp", name: "草鱼", category: "fish", recipeIds: ["x"] },
      { key: null, name: "泡椒", category: null, recipeIds: ["x"] },
    ]);
  });

  it("is deterministic: same input, same output", () => {
    const a = computeShoppingList([hongshaorou, fanqiechaodan], pantry("姜"));
    const b = computeShoppingList([hongshaorou, fanqiechaodan], pantry("姜"));
    expect(a).toEqual(b);
  });
});

describe("computeShoppingList: options and edge cases", () => {
  it("accepts a custom condiment rule", () => {
    const list = computeShoppingList([hongshaorou], [], {
      isCondiment: (key) => key === "rock_sugar",
    });
    expect(names(list)).toContain("生抽");
    expect(names(list)).not.toContain("冰糖");
  });

  it("lists a recipe once per item even if it repeats an ingredient", () => {
    const dish = recipe("d", "葱油拌面", ["面条", "葱", "小葱"]);
    const list = computeShoppingList([dish], []);
    expect(list.find((i) => i.key === "scallion")?.recipeIds).toEqual(["d"]);
  });
});

describe("ingredientIdentity / pantryIdentities", () => {
  it("prefers the dictionary key and ignores blank names", () => {
    expect(ingredientIdentity("tomato", "西红柿")).toBe("key:tomato");
    expect(ingredientIdentity(null, " 泡椒 ")).toBe("name:泡椒");
    expect(ingredientIdentity(null, "  ")).toBeNull();
  });

  it("uses a stored pantry key, then the raw name", () => {
    expect(
      pantryIdentities([
        { ingredientKey: "tomato", rawName: "随便写的" },
        { ingredientKey: "stale", rawName: "西红柿" },
        { ingredientKey: null, rawName: "泡椒" },
        { ingredientKey: null, rawName: "" },
      ]),
    ).toEqual(new Set(["key:tomato", "name:泡椒"]));
  });
});

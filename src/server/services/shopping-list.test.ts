import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import { createRecipe, createSlot, createUser } from "@/server/testing/db";
import { addPantryItems } from "./pantry";
import { getShoppingList } from "./shopping-list";

// Thursday 2026-09-24, noon in Toronto.
const now = new Date("2026-09-24T16:00:00.000Z");

describe("getShoppingList", () => {
  it("is the planned recipes' ingredients minus pantry minus condiments", async () => {
    const user = await createUser();
    const hongshaorou = await createRecipe("红烧肉", [
      "五花肉",
      "冰糖",
      "生抽",
      "葱",
      "姜",
    ]);
    const tomatoEgg = await createRecipe("番茄炒蛋", [
      "番茄",
      "鸡蛋",
      "葱",
      "盐",
    ]);
    await createSlot(
      user.id,
      parsePlainDate("2026-09-25"),
      "dinner",
      "planned",
      [
        { recipeId: hongshaorou.id, dishName: "红烧肉", status: "planned" },
        { recipeId: tomatoEgg.id, dishName: "番茄炒蛋", status: "planned" },
      ],
    );
    await addPantryItems(user.id, { names: ["鸡蛋", "姜"] });

    const list = await getShoppingList(user.id, { now });
    expect(list.from).toBe("2026-09-24");
    expect(list.until).toBe("2026-09-28");
    expect(list.items.map((i) => i.name).sort()).toEqual(
      ["五花肉", "冰糖", "葱", "番茄"].sort(),
    );
    const scallion = list.items.find((i) => i.key === "scallion");
    expect(scallion?.recipeIds.sort()).toEqual(
      [hongshaorou.id, tomatoEgg.id].sort(),
    );
  });

  it("covers a menu confirmed before its week starts", async () => {
    const user = await createUser();
    const r = await createRecipe("红烧肉", ["五花肉"]);
    // Sunday evening, planning the week that starts tomorrow.
    const sunday = new Date("2026-09-27T22:00:00.000Z");
    await createSlot(
      user.id,
      parsePlainDate("2026-09-29"),
      "dinner",
      "planned",
      [{ recipeId: r.id, dishName: "红烧肉", status: "planned" }],
    );
    const list = await getShoppingList(user.id, {
      now: sunday,
      weekOf: "2026-09-28",
    });
    expect(list.from).toBe("2026-09-28");
    expect(list.until).toBe("2026-10-05");
    expect(list.items.map((i) => i.name)).toEqual(["五花肉"]);
  });

  it("drops dishes in a slot already marked cooked (still `planned`, never assumed eaten)", async () => {
    const user = await createUser();
    const r = await createRecipe("红烧肉", ["五花肉"]);
    await createSlot(
      user.id,
      parsePlainDate("2026-09-24"),
      "dinner",
      "cooked",
      [{ recipeId: r.id, dishName: "红烧肉", status: "planned" }],
    );
    expect((await getShoppingList(user.id, { now })).items).toEqual([]);
  });

  it("ignores past days, other weeks, drafts, and dishes already eaten", async () => {
    const user = await createUser();
    const r = await createRecipe("红烧肉", ["五花肉"]);
    const planned = { recipeId: r.id, dishName: "红烧肉" };
    await createSlot(
      user.id,
      parsePlainDate("2026-09-23"),
      "dinner",
      "planned",
      [{ ...planned, status: "planned" }],
    );
    await createSlot(
      user.id,
      parsePlainDate("2026-09-29"),
      "dinner",
      "planned",
      [{ ...planned, status: "planned" }],
    );
    await createSlot(user.id, parsePlainDate("2026-09-25"), "dinner", "draft", [
      { ...planned, status: "draft" },
    ]);
    await createSlot(user.id, parsePlainDate("2026-09-24"), "lunch", "cooked", [
      { ...planned, status: "eaten" },
    ]);
    expect((await getShoppingList(user.id, { now })).items).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import type { RecipeFeatures } from "@/domain/features";
import { db } from "@/server/db/client";
import { tasteFacts } from "@/server/db/schema";
import { createRecipe, createSlot, createUser } from "@/server/testing/db";
import { getCandidates } from "./candidates";
import { logEatOut } from "./meals";
import { addPantryItems } from "./pantry";

const features = (patch: Partial<RecipeFeatures>): RecipeFeatures => ({
  role: "meat",
  cuisine: "home_style",
  method: "stir_fry",
  flavor: "savory",
  main_ingredient: null,
  oil_level: "medium",
  ...patch,
});

const noJitter = { random: () => 0 };
const target = "2026-09-26";

describe("getCandidates", () => {
  it("never returns a dish with a declared allergen", async () => {
    const user = await createUser();
    await createRecipe("宫保鸡丁", ["鸡胸肉", "花生米", "干辣椒"]);
    await createRecipe("清炒菠菜", ["菠菜", "蒜"]);
    await db.insert(tasteFacts).values({
      userId: user.id,
      type: "restriction",
      content: "花生过敏",
      payload: { kind: "allergen", tag: "peanut" },
      source: "choice",
    });

    const result = await getCandidates(
      user.id,
      { targetDate: target, cravings: ["宫保鸡丁"] },
      noJitter,
    );
    expect(result.ranked.map((c) => c.recipe.name)).toEqual(["清炒菠菜"]);
    expect(result.excluded).toEqual([
      expect.objectContaining({ reason: "restriction" }),
    ]);
  });

  it("reads a restriction from its wording when the stored payload is invalid", async () => {
    const user = await createUser();
    await createRecipe("宫保鸡丁", ["鸡胸肉", "花生米"]);
    await createRecipe("榴莲酥", ["榴莲", "面粉"]);
    await createRecipe("清炒菠菜", ["菠菜"]);
    await db.insert(tasteFacts).values([
      {
        userId: user.id,
        type: "restriction",
        content: "花生过敏",
        payload: {},
        source: "stated",
      },
      {
        userId: user.id,
        type: "restriction",
        content: "不吃榴莲",
        payload: { kind: "not-a-kind" },
        source: "stated",
      },
    ]);
    const result = await getCandidates(
      user.id,
      { targetDate: target },
      noJitter,
    );
    expect(result.ranked.map((c) => c.recipe.name)).toEqual(["清炒菠菜"]);
  });

  it("applies main-ingredient + flavor dedupe to a dish logged as eaten out", async () => {
    const user = await createUser({ dedupeWindowDays: 7 });
    const braised = features({
      main_ingredient: "pork_belly",
      flavor: "soy_braised",
    });
    await createRecipe("红烧肉", ["五花肉"], { features: braised });
    await createRecipe("东坡肉", ["五花肉"], { features: braised });
    await createRecipe("清炒菠菜", ["菠菜"]);
    await logEatOut(user.id, {
      date: "2026-09-24",
      slot: "lunch",
      dishes: [{ name: "红烧肉" }],
    });

    const result = await getCandidates(
      user.id,
      { targetDate: target },
      noJitter,
    );
    expect(result.ranked.map((c) => c.recipe.name)).toEqual(["清炒菠菜"]);
    expect(
      result.excluded
        .map((e) => [
          e.recipe.name,
          e.reason === "repeat" ? e.repeat.reason : e.reason,
        ])
        .sort(),
    ).toEqual([
      ["东坡肉", "same_main_and_flavor"],
      ["红烧肉", "same_dish"],
    ]);
  });

  it("excludes dishes eaten recently, at home or out, using the user's window", async () => {
    const user = await createUser({ dedupeWindowDays: 7 });
    const hongshaorou = await createRecipe("红烧肉", ["五花肉"], {
      features: features({
        main_ingredient: "pork_belly",
        flavor: "soy_braised",
      }),
    });
    await createRecipe("酸菜鱼", ["草鱼", "酸菜"]);
    await createRecipe("清炒菠菜", ["菠菜"]);
    await createSlot(
      user.id,
      parsePlainDate("2026-09-22"),
      "dinner",
      "cooked",
      [{ recipeId: hongshaorou.id, dishName: "红烧肉", status: "eaten" }],
    );
    await createSlot(
      user.id,
      parsePlainDate("2026-09-24"),
      "lunch",
      "ate_out",
      [{ dishName: "酸菜鱼", status: "eaten" }],
    );

    const result = await getCandidates(
      user.id,
      { targetDate: target },
      noJitter,
    );
    expect(result.ranked.map((c) => c.recipe.name)).toEqual(["清炒菠菜"]);
    expect(
      result.excluded.map((e) => [e.recipe.name, e.reason]).sort(),
    ).toEqual([
      ["红烧肉", "repeat"],
      ["酸菜鱼", "repeat"],
    ]);
  });

  it("uses older ratings and the pantry for ranking", async () => {
    const user = await createUser({ dedupeWindowDays: 7 });
    const liked = await createRecipe("可乐鸡翅", ["鸡翅"]);
    await createRecipe("清炒菠菜", ["菠菜"]);
    await createRecipe("酸辣土豆丝", ["土豆"]);
    await createSlot(
      user.id,
      parsePlainDate("2026-08-01"),
      "dinner",
      "cooked",
      [
        {
          recipeId: liked.id,
          dishName: "可乐鸡翅",
          status: "eaten",
          rating: 5,
        },
      ],
    );
    await addPantryItems(user.id, { names: ["土豆"] });

    const result = await getCandidates(
      user.id,
      { targetDate: target },
      noJitter,
    );
    expect(result.ranked.map((c) => c.recipe.name)).toEqual([
      "酸辣土豆丝",
      "可乐鸡翅",
      "清炒菠菜",
    ]);
  });

  it("respects the limit and rejects a bad date", async () => {
    const user = await createUser();
    for (const name of ["甲", "乙", "丙"]) await createRecipe(name, ["菠菜"]);
    const result = await getCandidates(
      user.id,
      { targetDate: target, limit: 2 },
      noJitter,
    );
    expect(result.ranked).toHaveLength(2);
    await expect(
      getCandidates(user.id, { targetDate: "2026-13-01" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

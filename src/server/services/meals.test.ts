import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import type { RecipeFeatures } from "@/domain/features";
import { db } from "@/server/db/client";
import { mealDishes, meals } from "@/server/db/schema";
import {
  createRecipe,
  createSlot,
  createUser,
  listEvents,
} from "@/server/testing/db";
import { logEatOut, markDish, markSlot } from "./meals";

const date = parsePlainDate("2026-09-23");

const braisedPork: RecipeFeatures = {
  role: "meat",
  cuisine: "home_style",
  method: "braise",
  flavor: "soy_braised",
  main_ingredient: "pork_belly",
  oil_level: "high",
};

describe("markSlot", () => {
  it("creates a row for an unknown slot and logs one event", async () => {
    const user = await createUser();
    const view = await markSlot(user.id, {
      date,
      slot: "lunch",
      action: "markSkipped",
    });
    expect(view.state).toBe("skipped");
    expect(view.dishes).toEqual([]);

    const events = await listEvents(user.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "slot_marked",
      payload: { date, slot: "lunch", from: "unknown", to: "skipped" },
    });
  });

  it("marking cooked keeps planned dishes planned (never assumed eaten)", async () => {
    const user = await createUser();
    await createSlot(user.id, date, "dinner", "planned", [
      { dishName: "红烧肉", status: "planned" },
      { dishName: "蒜蓉菠菜", status: "planned" },
    ]);
    const view = await markSlot(user.id, {
      date,
      slot: "dinner",
      action: "markCooked",
    });
    expect(view.state).toBe("cooked");
    expect(view.dishes.map((d) => d.status)).toEqual(["planned", "planned"]);
  });

  it("marking ate_out sets planned dishes not_eaten and adds the dish eaten", async () => {
    const user = await createUser();
    await createSlot(user.id, date, "dinner", "planned", [
      { dishName: "红烧肉", status: "planned" },
    ]);
    const view = await logEatOut(user.id, {
      date,
      slot: "dinner",
      dishes: [{ name: " 酸菜鱼 " }],
    });
    expect(view.state).toBe("ate_out");
    expect(view.dishes.map((d) => [d.position, d.dishName, d.status])).toEqual([
      [0, "红烧肉", "not_eaten"],
      [1, "酸菜鱼", "eaten"],
    ]);
  });

  it("adds a second dish eaten out without touching the first", async () => {
    const user = await createUser();
    await logEatOut(user.id, {
      date,
      slot: "dinner",
      dishes: [{ name: "酸菜鱼" }],
    });
    const view = await logEatOut(user.id, {
      date,
      slot: "dinner",
      dishes: [{ name: "米饭" }],
    });
    expect(view.dishes.map((d) => [d.dishName, d.status])).toEqual([
      ["酸菜鱼", "eaten"],
      ["米饭", "eaten"],
    ]);
    expect(await listEvents(user.id)).toHaveLength(2);
  });

  it("marking skipped clears eaten dishes and their ratings", async () => {
    const user = await createUser();
    await createSlot(user.id, date, "dinner", "cooked", [
      { dishName: "红烧肉", status: "eaten", rating: 5 },
    ]);
    const view = await markSlot(user.id, {
      date,
      slot: "dinner",
      action: "markSkipped",
    });
    expect(view.dishes.map((d) => [d.status, d.rating])).toEqual([
      ["not_eaten", null],
    ]);
  });

  it("takes an eaten-out dish's features from the library recipe of the same name", async () => {
    const user = await createUser();
    await createRecipe("红烧肉", ["五花肉"], { features: braisedPork });
    const view = await logEatOut(user.id, {
      date,
      slot: "dinner",
      dishes: [
        { name: "红烧肉" },
        { name: "卤肉饭", features: braisedPork },
        { name: "麻辣香锅" },
      ],
    });
    expect(
      view.dishes.map((d) => [d.dishName, d.recipeId, d.features]),
    ).toEqual([
      ["红烧肉", null, braisedPork],
      ["卤肉饭", null, braisedPork],
      ["麻辣香锅", null, null],
    ]);
  });

  it("removes unconfirmed draft dishes when a draft slot is marked", async () => {
    const user = await createUser();
    await createSlot(user.id, date, "dinner", "draft", [
      { dishName: "草稿菜", status: "draft" },
    ]);
    const view = await markSlot(user.id, {
      date,
      slot: "dinner",
      action: "markSkipped",
    });
    expect(view.dishes).toEqual([]);
    expect(await db.select().from(mealDishes)).toHaveLength(0);
  });

  it("keeps exactly one row per slot", async () => {
    const user = await createUser();
    await markSlot(user.id, { date, slot: "dinner", action: "markCooked" });
    await markSlot(user.id, { date, slot: "dinner", action: "markSkipped" });
    const rows = await db.select().from(meals).where(eq(meals.userId, user.id));
    expect(rows.map((r) => r.status)).toEqual(["skipped"]);
  });

  it("rejects invalid input without writing anything", async () => {
    const user = await createUser();
    for (const bad of [
      { date: "2026-02-30", slot: "dinner", action: "markCooked" },
      { date, slot: "supper", action: "markCooked" },
      {
        date,
        slot: "dinner",
        action: "markCooked",
        dishes: [{ name: "不该有" }],
      },
    ]) {
      await expect(
        // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input
        markSlot(user.id, bad as any),
      ).rejects.toMatchObject({ code: "invalid_input" });
    }
    expect(await db.select().from(meals)).toHaveLength(0);
    expect(await listEvents(user.id)).toHaveLength(0);
  });

  it("fails for an unknown user", async () => {
    await expect(
      markSlot("00000000-0000-4000-8000-00000000dead", {
        date,
        slot: "dinner",
        action: "markCooked",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("markDish", () => {
  async function plannedDish() {
    const user = await createUser();
    const { dishes } = await createSlot(user.id, date, "dinner", "cooked", [
      { dishName: "红烧肉", status: "planned" },
    ]);
    const dish = dishes[0];
    if (!dish) throw new Error("no dish");
    return { user, dish };
  }

  it("marks a dish eaten and rates it, with one event each", async () => {
    const { user, dish } = await plannedDish();
    expect(
      await markDish(user.id, {
        dishId: dish.id,
        action: "markEaten",
        rating: 4,
      }),
    ).toEqual({ id: dish.id, status: "eaten", rating: 4 });
    expect((await listEvents(user.id)).map((e) => e.type)).toEqual([
      "dish_marked",
      "dish_rated",
    ]);
  });

  it("refuses to rate a dish that was not eaten", async () => {
    const { user, dish } = await plannedDish();
    await expect(
      markDish(user.id, { dishId: dish.id, rating: 5 }),
    ).rejects.toMatchObject({ code: "invalid_rating" });
    await expect(
      markDish(user.id, { dishId: dish.id, action: "markEaten", rating: 9 }),
    ).rejects.toMatchObject({ code: "invalid_rating" });
    // The failed call rolled back its status change too.
    const [row] = await db
      .select()
      .from(mealDishes)
      .where(eq(mealDishes.id, dish.id));
    expect(row?.status).toBe("planned");
  });

  it("clears the rating when a dish is corrected to not eaten", async () => {
    const { user, dish } = await plannedDish();
    await markDish(user.id, {
      dishId: dish.id,
      action: "markEaten",
      rating: 5,
    });
    expect(
      await markDish(user.id, { dishId: dish.id, action: "markNotEaten" }),
    ).toEqual({ id: dish.id, status: "not_eaten", rating: null });
  });

  it("refuses to mark a dish eaten in a skipped slot", async () => {
    const user = await createUser();
    const { dishes } = await createSlot(user.id, date, "dinner", "skipped", [
      { dishName: "红烧肉", status: "not_eaten" },
    ]);
    await expect(
      markDish(user.id, { dishId: dishes[0]?.id ?? "", action: "markEaten" }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("refuses to mark an unconfirmed draft dish", async () => {
    const user = await createUser();
    const { dishes } = await createSlot(user.id, date, "dinner", "draft", [
      { dishName: "草稿", status: "draft" },
    ]);
    await expect(
      markDish(user.id, { dishId: dishes[0]?.id ?? "", action: "markEaten" }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("requires an action or a rating", async () => {
    const { user, dish } = await plannedDish();
    await expect(markDish(user.id, { dishId: dish.id })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

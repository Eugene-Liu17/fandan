import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import { db } from "@/server/db/client";
import { events, mealDishes, tasteFacts } from "@/server/db/schema";
import { createRecipe, createSlot, createUser } from "@/server/testing/db";
import { getCandidates } from "./candidates";
import { markDish, markSlot } from "./meals";
import { addPantryItems, removePantryItem } from "./pantry";
import { getShoppingList } from "./shopping-list";
import { getWeekContext } from "./week-context";

const now = new Date("2026-09-24T16:00:00.000Z");
const date = parsePlainDate("2026-09-25");

/** Two users with overlapping data; every call acts as A. */
async function twoUsers() {
  const a = await createUser({ displayName: "A" });
  const b = await createUser({ displayName: "B" });
  const shared = await createRecipe("清炒菠菜", ["菠菜"]);
  const bPrivate = await createRecipe("B的私房菜", ["五花肉"], {
    ownerId: b.id,
  });
  const bSlot = await createSlot(b.id, date, "dinner", "planned", [
    { recipeId: bPrivate.id, dishName: "B的私房菜", status: "planned" },
    { recipeId: shared.id, dishName: "清炒菠菜", status: "eaten" },
  ]);
  const { added } = await addPantryItems(b.id, { names: ["五花肉"] });
  await db.insert(tasteFacts).values({
    userId: b.id,
    type: "restriction",
    content: "菠菜",
    payload: { kind: "ingredient", key: "spinach" },
    source: "stated",
  });
  const bDish = bSlot.dishes[0];
  const bItem = added[0];
  if (!bDish || !bItem) throw new Error("fixture failed");
  return { a, b, shared, bPrivate, bDish, bItem };
}

describe("user isolation: one user's calls never see or change another's rows", () => {
  it("reads only A's week, pantry, and restrictions", async () => {
    const { a } = await twoUsers();
    const ctx = await getWeekContext(a.id, { now });
    const states = ctx.days.flatMap((d) => d.slots.map((s) => s.state));
    expect(new Set(states)).toEqual(new Set(["unknown"]));
    expect(ctx.pantry).toEqual([]);
    expect(ctx.restrictions).toEqual([]);
  });

  it("cannot mark, rate, or remove B's rows", async () => {
    const { a, bDish, bItem } = await twoUsers();
    await expect(
      markDish(a.id, { dishId: bDish.id, action: "markEaten" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(removePantryItem(a.id, bItem.id)).rejects.toMatchObject({
      code: "not_found",
    });
    const [dish] = await db
      .select()
      .from(mealDishes)
      .where(eq(mealDishes.id, bDish.id));
    expect(dish?.status).toBe("planned");
  });

  it("marking the same date and slot creates A's own row", async () => {
    const { a, b } = await twoUsers();
    await markSlot(a.id, { date, slot: "dinner", action: "markSkipped" });
    const bCtx = await getWeekContext(b.id, { now });
    const bDinner = bCtx.days
      .find((d) => d.date === date)
      ?.slots.find((s) => s.slot === "dinner");
    expect(bDinner?.state).toBe("planned");
    expect(bDinner?.dishes.map((d) => d.status)).toEqual(["planned", "eaten"]);
  });

  it("ranks candidates from A's view only", async () => {
    const { a } = await twoUsers();
    const result = await getCandidates(
      a.id,
      { targetDate: "2026-09-26" },
      { random: () => 0 },
    );
    // B's private recipe is invisible; B's spinach restriction and B's
    // eaten spinach do not affect A.
    expect(result.ranked.map((c) => c.recipe.name)).toEqual(["清炒菠菜"]);
    expect(result.excluded).toEqual([]);
  });

  it("builds A's shopping list from A's plan only", async () => {
    const { a } = await twoUsers();
    expect((await getShoppingList(a.id, { now })).items).toEqual([]);
  });

  it("logs A's events under A only", async () => {
    const { a, b } = await twoUsers();
    await markSlot(a.id, { date, slot: "lunch", action: "markCooked" });
    await addPantryItems(a.id, { names: ["鸡蛋"] });
    const aEvents = await db
      .select()
      .from(events)
      .where(eq(events.userId, a.id));
    const bEvents = await db
      .select()
      .from(events)
      .where(eq(events.userId, b.id));
    expect(aEvents.map((e) => e.type).sort()).toEqual([
      "pantry_updated",
      "slot_marked",
    ]);
    // B's only event is from its own fixture pantry add.
    expect(bEvents.map((e) => e.type)).toEqual(["pantry_updated"]);
  });
});

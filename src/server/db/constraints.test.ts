import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import { createSlot, createUser } from "@/server/testing/db";
import { db } from "./client";
import { mealDishes, meals, tasteFacts, users } from "./schema";

// The last line of defence behind the services: the database itself rejects
// rows that break the data model's invariants.
describe("database constraints", () => {
  const date = parsePlainDate("2026-09-23");

  it("requires a payload on restriction facts", async () => {
    const user = await createUser();
    await expect(
      db.insert(tasteFacts).values({
        userId: user.id,
        type: "restriction",
        content: "花生过敏",
        source: "stated",
      }),
    ).rejects.toThrow();
    await db.insert(tasteFacts).values({
      userId: user.id,
      type: "preference",
      content: "喜欢酸辣",
      source: "stated",
    });
  });

  it("keeps one row per user, date and slot", async () => {
    const user = await createUser();
    await createSlot(user.id, date, "dinner", "planned");
    await expect(
      db.insert(meals).values({
        userId: user.id,
        date,
        slot: "dinner",
        status: "cooked",
      }),
    ).rejects.toThrow();
  });

  it("limits ratings to 1–5", async () => {
    const user = await createUser();
    const { meal } = await createSlot(user.id, date, "dinner", "cooked");
    await expect(
      db.insert(mealDishes).values({
        userId: user.id,
        mealId: meal.id,
        position: 0,
        status: "eaten",
        rating: 6,
      }),
    ).rejects.toThrow();
  });

  it("rejects a week start other than Sunday or Monday", async () => {
    await expect(
      db.insert(users).values({ displayName: "x", weekStartsOn: 3 }),
    ).rejects.toThrow();
  });
});

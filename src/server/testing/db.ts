/**
 * Helpers for integration tests. They write through the real client, which
 * points at the test database (see vitest.config.ts).
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PlainDate } from "@/domain/date";
import type { DishStatus, MealSlot, SlotStatus } from "@/domain/enums";
import type { RecipeFeatures } from "@/domain/features";
import { normalizeIngredient } from "@/domain/ingredients/normalize";
import type { RecipeIngredient } from "@/domain/recipe";
import { db } from "@/server/db/client";
import { events, mealDishes, meals, recipes, users } from "@/server/db/schema";
import { testDatabaseName } from "./test-database-url";

/** Empties every table. Refuses to run against a non-test database. */
export async function resetDatabase(): Promise<void> {
  const [row] = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  const expected = testDatabaseName();
  if (row?.name !== expected) {
    throw new Error(
      `Refusing to reset "${row?.name}": tests must run against ${expected}`,
    );
  }
  await db.execute(sql`
    truncate table messages, conversations, events, meal_dishes, meals,
      pantry_items, taste_facts, recipes, users
    restart identity cascade
  `);
}

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [user] = await db
    .insert(users)
    .values({
      displayName: "测试用户",
      timezone: "America/Toronto",
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("createUser: no row returned");
  return user;
}

/** `createRecipe("红烧肉", ["五花肉", "生抽"])` — the first ingredient is main. */
export async function createRecipe(
  name: string,
  ingredientNames: string[],
  options: { features?: RecipeFeatures; ownerId?: string } = {},
) {
  const ingredients: RecipeIngredient[] = ingredientNames.map((raw, i) => {
    const n = normalizeIngredient(raw);
    return {
      raw_name: raw,
      key: n.kind === "mapped" ? n.key : null,
      role: i === 0 ? "main" : "supplementary",
    };
  });
  const [recipe] = await db
    .insert(recipes)
    .values({
      name,
      category: "荤菜",
      ingredients,
      steps: ["做好。"],
      features: options.features ?? null,
      source: "test",
      sourceRef: randomUUID(),
      license: "CC0-1.0",
      ownerId: options.ownerId ?? null,
    })
    .returning();
  if (!recipe) throw new Error("createRecipe: no row returned");
  return recipe;
}

export interface TestDish {
  recipeId?: string | null;
  dishName?: string | null;
  status: DishStatus;
  rating?: number | null;
  features?: RecipeFeatures | null;
}

/** Inserts a slot row and its dishes directly, bypassing services. */
export async function createSlot(
  userId: string,
  date: PlainDate,
  slot: MealSlot,
  status: SlotStatus,
  dishes: TestDish[] = [],
) {
  const [meal] = await db
    .insert(meals)
    .values({ userId, date, slot, status })
    .returning();
  if (!meal) throw new Error("createSlot: no row returned");
  const dishRows =
    dishes.length === 0
      ? []
      : await db
          .insert(mealDishes)
          .values(
            dishes.map((d, position) => ({
              userId,
              mealId: meal.id,
              position,
              recipeId: d.recipeId ?? null,
              dishName: d.dishName ?? null,
              features: d.features ?? null,
              status: d.status,
              rating: d.rating ?? null,
            })),
          )
          .returning();
  return { meal, dishes: dishRows };
}

export async function listEvents(userId: string) {
  return db
    .select()
    .from(events)
    .where(eq(events.userId, userId))
    .orderBy(events.seq);
}

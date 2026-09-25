import { and, asc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import type { PlainDate } from "@/domain/date";
import type { EatenDish } from "@/domain/dedupe";
import type { DishStatus, MealSlot, SlotStatus } from "@/domain/enums";
import { mealDishes, meals } from "../schema";
import type { DbExecutor } from "./executor";

export type MealRow = typeof meals.$inferSelect;
export type DishRow = typeof mealDishes.$inferSelect;
export type NewDishRow = typeof mealDishes.$inferInsert;

export interface SlotWithDishes {
  meal: MealRow;
  /** Ordered by position. */
  dishes: DishRow[];
}

async function withDishes(
  ex: DbExecutor,
  userId: string,
  mealRows: MealRow[],
): Promise<SlotWithDishes[]> {
  if (mealRows.length === 0) return [];
  const dishRows = await ex
    .select()
    .from(mealDishes)
    .where(
      and(
        eq(mealDishes.userId, userId),
        inArray(
          mealDishes.mealId,
          mealRows.map((m) => m.id),
        ),
      ),
    )
    .orderBy(asc(mealDishes.position));
  return mealRows.map((meal) => ({
    meal,
    dishes: dishRows.filter((d) => d.mealId === meal.id),
  }));
}

/** Slot rows (with dishes) whose date is in [start, endExclusive). */
export async function findSlotsInRange(
  ex: DbExecutor,
  userId: string,
  start: PlainDate,
  endExclusive: PlainDate,
): Promise<SlotWithDishes[]> {
  const mealRows = await ex
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.date, start),
        lt(meals.date, endExclusive),
      ),
    )
    .orderBy(asc(meals.date));
  return withDishes(ex, userId, mealRows);
}

/**
 * The slot row for (date, slot) with its dishes, locked `for update` until
 * the transaction ends; undefined when the slot has no row (unknown).
 */
export async function lockSlot(
  ex: DbExecutor,
  userId: string,
  date: PlainDate,
  slot: MealSlot,
): Promise<SlotWithDishes | undefined> {
  const mealRows = await ex
    .select()
    .from(meals)
    .where(
      and(eq(meals.userId, userId), eq(meals.date, date), eq(meals.slot, slot)),
    )
    .for("update");
  const [found] = await withDishes(ex, userId, mealRows);
  return found;
}

/** Creates the slot row or updates its status. */
export async function upsertSlotStatus(
  ex: DbExecutor,
  userId: string,
  date: PlainDate,
  slot: MealSlot,
  status: SlotStatus,
): Promise<MealRow> {
  const [row] = await ex
    .insert(meals)
    .values({ userId, date, slot, status })
    .onConflictDoUpdate({
      target: [meals.userId, meals.date, meals.slot],
      set: { status, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new Error("upsertSlotStatus: no row returned");
  return row;
}

/** A dish with the status of the slot it belongs to. */
export async function findDishWithSlot(
  ex: DbExecutor,
  userId: string,
  dishId: string,
): Promise<{ dish: DishRow; slotStatus: SlotStatus } | undefined> {
  const [row] = await ex
    .select({ dish: mealDishes, slotStatus: meals.status })
    .from(mealDishes)
    .innerJoin(meals, eq(meals.id, mealDishes.mealId))
    .where(and(eq(mealDishes.userId, userId), eq(mealDishes.id, dishId)))
    .limit(1);
  return row;
}

export async function updateDish(
  ex: DbExecutor,
  userId: string,
  dishId: string,
  patch: { status?: DishStatus; rating?: number | null },
): Promise<DishRow | undefined> {
  const [row] = await ex
    .update(mealDishes)
    .set(patch)
    .where(and(eq(mealDishes.userId, userId), eq(mealDishes.id, dishId)))
    .returning();
  return row;
}

export async function deleteDishes(
  ex: DbExecutor,
  userId: string,
  dishIds: string[],
): Promise<void> {
  if (dishIds.length === 0) return;
  await ex
    .delete(mealDishes)
    .where(and(eq(mealDishes.userId, userId), inArray(mealDishes.id, dishIds)));
}

export async function insertDishes(
  ex: DbExecutor,
  rows: NewDishRow[],
): Promise<DishRow[]> {
  if (rows.length === 0) return [];
  return ex.insert(mealDishes).values(rows).returning();
}

/** Eaten dishes (home-cooked or eaten out) dated in [start, endExclusive). */
export async function findEatenDishes(
  ex: DbExecutor,
  userId: string,
  start: PlainDate,
  endExclusive: PlainDate,
): Promise<EatenDish[]> {
  const rows = await ex
    .select({
      date: meals.date,
      recipeId: mealDishes.recipeId,
      dishName: mealDishes.dishName,
      features: mealDishes.features,
      rating: mealDishes.rating,
    })
    .from(mealDishes)
    .innerJoin(meals, eq(meals.id, mealDishes.mealId))
    .where(
      and(
        eq(mealDishes.userId, userId),
        eq(mealDishes.status, "eaten"),
        gte(meals.date, start),
        lt(meals.date, endExclusive),
      ),
    );
  // `date` comes back as a YYYY-MM-DD string (mode: "string").
  return rows.map((r) => ({ ...r, date: r.date as PlainDate }));
}

/**
 * Recipe ids of planned dishes in slots that are still planned, dated in
 * [start, endExclusive). A slot marked cooked keeps its dishes `planned`
 * (never assumed eaten), but its ingredients are no longer needed.
 */
export async function findPlannedRecipeIds(
  ex: DbExecutor,
  userId: string,
  start: PlainDate,
  endExclusive: PlainDate,
): Promise<string[]> {
  const rows = await ex
    .selectDistinct({ recipeId: mealDishes.recipeId })
    .from(mealDishes)
    .innerJoin(meals, eq(meals.id, mealDishes.mealId))
    .where(
      and(
        eq(mealDishes.userId, userId),
        eq(mealDishes.status, "planned"),
        eq(meals.status, "planned"),
        isNotNull(mealDishes.recipeId),
        gte(meals.date, start),
        lt(meals.date, endExclusive),
      ),
    );
  return rows.flatMap((r) => (r.recipeId === null ? [] : [r.recipeId]));
}

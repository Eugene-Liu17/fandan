import type { PlainDate } from "@/domain/date";
import { computeShoppingList, type ShoppingItem } from "@/domain/shopping-list";
import { getWeekRange } from "@/domain/week";
import { db } from "@/server/db/client";
import { findPlannedRecipeIds } from "@/server/db/repositories/meals";
import { findActivePantry } from "@/server/db/repositories/pantry";
import { findVisibleRecipesByIds } from "@/server/db/repositories/recipes";
import { requireUser, todayFor } from "./context";

export interface ShoppingList {
  /** First day covered (today). */
  from: PlainDate;
  /** First day not covered (the start of next week). */
  until: PlainDate;
  items: ShoppingItem[];
}

/**
 * What to buy for the confirmed (planned) dishes from today to the end of
 * the current week: recipe ingredients − pantry − standard condiments,
 * computed by the domain, never by a model (SPEC MVP item 7).
 */
export async function getShoppingList(
  userId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<ShoppingList> {
  const user = await requireUser(db, userId);
  const today = todayFor(user, now);
  const { end } = getWeekRange(today, user.weekStartsOn === 0 ? 0 : 1);

  const recipeIds = await findPlannedRecipeIds(db, userId, today, end);
  const [recipes, pantry] = await Promise.all([
    findVisibleRecipesByIds(db, userId, recipeIds),
    findActivePantry(db, userId),
  ]);

  return {
    from: today,
    until: end,
    items: computeShoppingList(
      recipes,
      pantry.map((p) => ({
        ingredientKey: p.ingredientKey,
        rawName: p.rawName,
      })),
    ),
  };
}

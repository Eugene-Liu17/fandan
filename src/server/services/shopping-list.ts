import type { PlainDate } from "@/domain/date";
import { computeShoppingList, type ShoppingItem } from "@/domain/shopping-list";
import { getWeekRange } from "@/domain/week";
import { db } from "@/server/db/client";
import { findPlannedRecipeIds } from "@/server/db/repositories/meals";
import { findActivePantry } from "@/server/db/repositories/pantry";
import { findVisibleRecipesByIds } from "@/server/db/repositories/recipes";
import { optionalDate, requireUser, todayFor, weekStartsOnOf } from "./context";

export interface ShoppingList {
  /** First day covered: the week's first day, or today if that is later. */
  from: PlainDate;
  /** First day not covered (the start of next week). */
  until: PlainDate;
  items: ShoppingItem[];
}

/**
 * What to buy for a week's confirmed (planned) dishes that are still ahead:
 * recipe ingredients − pantry − standard condiments, computed by the
 * domain, never by a model (SPEC MVP item 7). `weekOf` is any date in the
 * week (default: the current week), so a menu confirmed before its week
 * starts gets its list.
 */
export async function getShoppingList(
  userId: string,
  { now = new Date(), weekOf }: { now?: Date; weekOf?: string } = {},
): Promise<ShoppingList> {
  const user = await requireUser(db, userId);
  const today = todayFor(user, now);
  const { start, end } = getWeekRange(
    optionalDate(weekOf) ?? today,
    weekStartsOnOf(user),
  );
  const from = today > start ? today : start;

  const recipeIds = await findPlannedRecipeIds(db, userId, from, end);
  const [recipes, pantry] = await Promise.all([
    findVisibleRecipesByIds(db, userId, recipeIds),
    findActivePantry(db, userId),
  ]);

  return {
    from,
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

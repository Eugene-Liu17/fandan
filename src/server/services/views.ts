/**
 * Read models returned by services, shared so every service that returns a
 * slot shapes it the same way.
 */
import type { DishStatus, MealSlot, SlotStatus } from "@/domain/enums";
import type { RecipeFeatures } from "@/domain/features";
import { type SlotState, slotStateOf } from "@/domain/meal-state";
import type { DishRow } from "@/server/db/repositories/meals";

export interface DishView {
  id: string;
  position: number;
  recipeId: string | null;
  dishName: string | null;
  status: DishStatus;
  rating: number | null;
  features: RecipeFeatures | null;
}

export interface SlotView {
  slot: MealSlot;
  /** "unknown" when the slot has no row; never assumed "cooked". */
  state: SlotState;
  mealId: string | null;
  note: string | null;
  dishes: DishView[];
}

/** A slot as the calendar and chat see it; `meal` is undefined when unknown. */
export function toSlotView(
  slot: MealSlot,
  meal: { id: string; status: SlotStatus; note: string | null } | undefined,
  dishes: readonly DishRow[],
): SlotView {
  return {
    slot,
    state: slotStateOf(meal),
    mealId: meal?.id ?? null,
    note: meal?.note ?? null,
    dishes: dishes.map((d) => ({
      id: d.id,
      position: d.position,
      recipeId: d.recipeId,
      dishName: d.dishName,
      status: d.status,
      rating: d.rating,
      features: d.features,
    })),
  };
}

import { z } from "zod";
import { MEAL_SLOTS } from "@/domain/enums";
import { type RecipeFeatures, recipeFeaturesSchema } from "@/domain/features";
import {
  applyDishAction,
  applySlotAction,
  slotStateOf,
  validateRating,
} from "@/domain/meal-state";
import { db } from "@/server/db/client";
import { appendEvent } from "@/server/db/repositories/events";
import type { DbExecutor } from "@/server/db/repositories/executor";
import {
  type DishRow,
  deleteDishes,
  findDishWithSlot,
  insertDishes,
  lockSlot,
  updateDish,
  upsertSlotStatus,
} from "@/server/db/repositories/meals";
import { findVisibleRecipesByNames } from "@/server/db/repositories/recipes";
import { requireUser } from "./context";
import { parseInput, ServiceError } from "./errors";
import { plainDateSchema } from "./schemas";
import { type SlotView, toSlotView } from "./views";

export const markSlotInputSchema = z
  .object({
    date: plainDateSchema,
    slot: z.enum(MEAL_SLOTS),
    action: z.enum(["markCooked", "markSkipped", "markAteOut"]),
    /**
     * Dishes eaten out; only with `markAteOut`. `features` (e.g. labeled by
     * the parsing model) lets dedupe apply its main-ingredient + flavor rule
     * to them; when omitted, a library recipe with the same name supplies
     * them.
     */
    dishes: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          features: recipeFeaturesSchema.nullable().optional(),
        }),
      )
      .default([]),
  })
  .refine((v) => v.dishes.length === 0 || v.action === "markAteOut", {
    message: "dishes is only allowed with markAteOut",
  });

export type MarkSlotInput = z.input<typeof markSlotInputSchema>;

/**
 * Features for dishes eaten out: the given ones, else those of a visible
 * library recipe with exactly the same (trimmed) name, else null (no
 * main-ingredient dedupe).
 */
async function eatenOutFeatures(
  ex: DbExecutor,
  userId: string,
  dishes: { name: string; features?: RecipeFeatures | null }[],
): Promise<(RecipeFeatures | null)[]> {
  const unlabeled = dishes.filter((d) => d.features == null).map((d) => d.name);
  const library = await findVisibleRecipesByNames(ex, userId, unlabeled);
  return dishes.map(
    (d) =>
      d.features ?? library.find((r) => r.name === d.name)?.features ?? null,
  );
}

/**
 * Marks a meal slot cooked / skipped / eaten out, from the calendar or the
 * chat alike. Applies the ADR-006 rules through the domain state machine,
 * then records a `slot_marked` event in the same transaction.
 */
export async function markSlot(
  userId: string,
  input: MarkSlotInput,
): Promise<SlotView> {
  const {
    date,
    slot,
    action,
    dishes: eatenOut,
  } = parseInput(markSlotInputSchema, input);
  const dishNames = eatenOut.map((d) => d.name);

  return db.transaction(async (tx) => {
    await requireUser(tx, userId);
    const existing = await lockSlot(tx, userId, date, slot);
    const from = slotStateOf(existing?.meal);
    const dishes = existing?.dishes ?? [];

    const result = applySlotAction(
      from,
      dishes.map((d) => d.status),
      action,
    );
    if (!result.ok) throw new ServiceError("invalid_transition", result.reason);

    if (result.slot === "unknown") {
      // Only discarding a draft clears a slot, and that is not a mark.
      throw new Error(`markSlot: ${action} cannot clear a slot`);
    }

    const meal = await upsertSlotStatus(tx, userId, date, slot, result.slot);

    const removed: string[] = [];
    const kept: DishRow[] = [];
    for (const [i, dish] of dishes.entries()) {
      const outcome = result.dishes[i];
      if (outcome === undefined || outcome === "remove") {
        removed.push(dish.id);
      } else if (outcome !== dish.status) {
        // A rating only belongs to an eaten dish.
        const updated = await updateDish(tx, userId, dish.id, {
          status: outcome,
          ...(outcome === "eaten" ? {} : { rating: null }),
        });
        if (updated) kept.push(updated);
      } else {
        kept.push(dish);
      }
    }
    await deleteDishes(tx, userId, removed);

    const nextPosition =
      kept.reduce((max, d) => Math.max(max, d.position), -1) + 1;
    const features = await eatenOutFeatures(tx, userId, eatenOut);
    const added = await insertDishes(
      tx,
      dishNames.map((dishName, i) => ({
        userId,
        mealId: meal.id,
        position: nextPosition + i,
        recipeId: null,
        dishName,
        features: features[i] ?? null,
        status: "eaten" as const,
      })),
    );

    await appendEvent(tx, userId, "slot_marked", {
      date,
      slot,
      action,
      from,
      to: result.slot,
      ...(dishNames.length > 0 ? { dishNames } : {}),
    });

    return toSlotView(slot, meal, [...kept, ...added]);
  });
}

/** Logs a meal eaten out (SPEC core flow "Eating-out logging"). */
export function logEatOut(
  userId: string,
  input: Omit<MarkSlotInput, "action">,
): Promise<SlotView> {
  return markSlot(userId, { ...input, action: "markAteOut" });
}

export const markDishInputSchema = z
  .object({
    dishId: z.uuid(),
    action: z.enum(["markEaten", "markNotEaten"]).optional(),
    rating: z.number().optional(),
  })
  .refine((v) => v.action !== undefined || v.rating !== undefined, {
    message: "Provide an action, a rating, or both",
  });

export type MarkDishInput = z.input<typeof markDishInputSchema>;

/**
 * Marks one dish eaten / not eaten and/or rates it (the "review last week"
 * step and per-dish calendar edits). A rating only applies to an eaten dish;
 * marking a dish not eaten clears its rating.
 */
export async function markDish(userId: string, input: MarkDishInput) {
  const { dishId, action, rating } = parseInput(markDishInputSchema, input);

  return db.transaction(async (tx) => {
    const found = await findDishWithSlot(tx, userId, dishId);
    if (!found) throw new ServiceError("not_found", `No dish ${dishId}`);
    const { dish, slotStatus } = found;

    let status = dish.status;
    let currentRating = dish.rating;

    if (action !== undefined) {
      const result = applyDishAction(slotStatus, status, action);
      if (!result.ok) {
        throw new ServiceError("invalid_transition", result.reason);
      }
      const from = status;
      status = result.status;
      if (status !== "eaten") currentRating = null;
      await updateDish(tx, userId, dishId, { status, rating: currentRating });
      await appendEvent(tx, userId, "dish_marked", {
        dishId,
        from,
        to: status,
      });
    }

    if (rating !== undefined) {
      const check = validateRating(status, rating);
      if (!check.ok) throw new ServiceError("invalid_rating", check.reason);
      currentRating = check.rating;
      await updateDish(tx, userId, dishId, { rating: currentRating });
      await appendEvent(tx, userId, "dish_rated", {
        dishId,
        rating: currentRating,
      });
    }

    return { id: dishId, status, rating: currentRating };
  });
}

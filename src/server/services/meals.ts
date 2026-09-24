import { z } from "zod";
import { isPlainDate, type PlainDate } from "@/domain/date";
import { MEAL_SLOTS } from "@/domain/enums";
import {
  applyDishAction,
  applySlotAction,
  slotStateOf,
  validateRating,
} from "@/domain/meal-state";
import { db } from "@/server/db/client";
import { appendEvent } from "@/server/db/repositories/events";
import {
  type DishRow,
  deleteDishes,
  deleteSlot,
  findDish,
  insertDishes,
  lockSlot,
  updateDish,
  upsertSlotStatus,
} from "@/server/db/repositories/meals";
import { requireUser } from "./context";
import { parseInput, ServiceError } from "./errors";
import type { SlotView } from "./week-context";

const plainDate = z
  .string()
  .refine(isPlainDate, { message: "Expected a YYYY-MM-DD date" })
  .transform((s) => s as PlainDate);

export const markSlotInputSchema = z
  .object({
    date: plainDate,
    slot: z.enum(MEAL_SLOTS),
    action: z.enum(["markCooked", "markSkipped", "markAteOut"]),
    /** Dishes eaten out; only with `markAteOut`. */
    dishNames: z.array(z.string().trim().min(1)).default([]),
  })
  .refine((v) => v.dishNames.length === 0 || v.action === "markAteOut", {
    message: "dishNames is only allowed with markAteOut",
  });

export type MarkSlotInput = z.input<typeof markSlotInputSchema>;

function toSlotView(
  slot: SlotView["slot"],
  meal: { id: string; status: SlotView["state"]; note: string | null } | null,
  dishes: DishRow[],
): SlotView {
  return {
    slot,
    state: meal?.status ?? "unknown",
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

/**
 * Marks a meal slot cooked / skipped / eaten out, from the calendar or the
 * chat alike. Applies the ADR-006 rules through the domain state machine,
 * then records a `slot_marked` event in the same transaction.
 */
export async function markSlot(
  userId: string,
  input: MarkSlotInput,
): Promise<SlotView> {
  const { date, slot, action, dishNames } = parseInput(
    markSlotInputSchema,
    input,
  );

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
      // Not reachable for marks today; kept so every outcome is persisted.
      if (existing) await deleteSlot(tx, userId, existing.meal.id);
      await appendEvent(tx, userId, "slot_marked", {
        date,
        slot,
        action,
        from,
        to: result.slot,
      });
      return toSlotView(slot, null, []);
    }

    const meal = await upsertSlotStatus(tx, userId, date, slot, result.slot);

    const removed: string[] = [];
    const kept: DishRow[] = [];
    for (const [i, dish] of dishes.entries()) {
      const outcome = result.dishes[i];
      if (outcome === undefined || outcome === "remove") {
        removed.push(dish.id);
      } else if (outcome !== dish.status) {
        const updated = await updateDish(tx, userId, dish.id, {
          status: outcome,
        });
        if (updated) kept.push(updated);
      } else {
        kept.push(dish);
      }
    }
    await deleteDishes(tx, userId, removed);

    const nextPosition =
      kept.reduce((max, d) => Math.max(max, d.position), -1) + 1;
    const added = await insertDishes(
      tx,
      dishNames.map((dishName, i) => ({
        userId,
        mealId: meal.id,
        position: nextPosition + i,
        recipeId: null,
        dishName,
        features: null,
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
    const dish = await findDish(tx, userId, dishId);
    if (!dish) throw new ServiceError("not_found", `No dish ${dishId}`);

    let status = dish.status;
    let currentRating = dish.rating;

    if (action !== undefined) {
      const result = applyDishAction(status, action);
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

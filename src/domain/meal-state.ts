/**
 * State machines for meal slots and their dishes (ADR-006).
 *
 * A slot is a row in `meals`; its dishes are rows in `meal_dishes`. A slot
 * with no row is "unknown" and is never treated as cooked (SPEC core
 * principle 5). These functions only decide the next states; the services
 * layer persists them and writes the matching events.
 */

import type { DishStatus, SlotStatus } from "./enums";

/** A slot's state including the implicit "no row" state. */
export type SlotState = SlotStatus | "unknown";

/** The state of a slot given its row, or `undefined` when there is none. */
export function slotStateOf(
  row: { status: SlotStatus } | undefined,
): SlotState {
  return row?.status ?? "unknown";
}

export type SlotAction =
  | "generateDraft"
  | "confirmDraft"
  | "discardDraft"
  | "markCooked"
  | "markSkipped"
  | "markAteOut";

/** What happens to an existing dish: a new status, or removal. */
export type DishOutcome = DishStatus | "remove";

export type SlotTransition =
  | { ok: true; slot: SlotState; dishes: DishOutcome[] }
  | { ok: false; reason: SlotTransitionError };

export type SlotTransitionError =
  | "slot_already_recorded"
  | "no_draft_to_confirm"
  | "no_draft_to_discard";

const RECORDED: ReadonlySet<SlotState> = new Set([
  "cooked",
  "skipped",
  "ate_out",
]);

const MARK_TARGET = {
  markCooked: "cooked",
  markSkipped: "skipped",
  markAteOut: "ate_out",
} as const satisfies Partial<Record<SlotAction, SlotStatus>>;

/**
 * Applies `action` to a slot in `state` whose existing dishes have
 * `dishes` statuses (in order). Returns the new slot state and one outcome
 * per existing dish. Dishes the action adds (a new draft, a dish eaten out)
 * are created by the caller; this function only covers existing ones.
 */
export function applySlotAction(
  state: SlotState,
  dishes: readonly DishStatus[],
  action: SlotAction,
): SlotTransition {
  switch (action) {
    case "generateDraft":
      // Never overwrite a record of what actually happened.
      if (RECORDED.has(state)) {
        return { ok: false, reason: "slot_already_recorded" };
      }
      // The caller writes the new draft dishes; the old ones are replaced.
      return { ok: true, slot: "draft", dishes: dishes.map(() => "remove") };

    case "confirmDraft":
      if (state !== "draft")
        return { ok: false, reason: "no_draft_to_confirm" };
      return {
        ok: true,
        slot: "planned",
        dishes: dishes.map((d) => (d === "draft" ? "planned" : d)),
      };

    case "discardDraft":
      if (state !== "draft")
        return { ok: false, reason: "no_draft_to_discard" };
      return { ok: true, slot: "unknown", dishes: dishes.map(() => "remove") };

    case "markCooked":
    case "markSkipped":
    case "markAteOut": {
      const target = MARK_TARGET[action];
      // Re-marking the same state only adds or edits dishes; nothing changes.
      if (state === target)
        return { ok: true, slot: state, dishes: [...dishes] };
      return {
        ok: true,
        slot: target,
        dishes: dishes.map((d) => markedDishOutcome(d, target)),
      };
    }
  }
}

function markedDishOutcome(
  dish: DishStatus,
  target: "cooked" | "skipped" | "ate_out",
): DishOutcome {
  // An unconfirmed draft is not a plan, so it is not kept as history.
  if (dish === "draft") return "remove";
  // Eating out or skipping means the planned dishes were not eaten. Marking
  // "cooked" says nothing about which dish was eaten, so planned stays
  // planned until the review step (never assumed eaten).
  if (dish === "planned" && target !== "cooked") return "not_eaten";
  // A skipped meal was not eaten at all, so nothing in it counts as eaten.
  if (dish === "eaten" && target === "skipped") return "not_eaten";
  // Otherwise per-dish answers stand; correcting them is a dish action.
  return dish;
}

export type DishAction = "markEaten" | "markNotEaten";

export type DishTransition =
  | { ok: true; status: DishStatus }
  | { ok: false; reason: "dish_is_draft" | "slot_skipped" };

/**
 * Applies a per-dish mark (e.g. from the "review last week" step) to a dish
 * in a slot whose state is `slot`. A dish in a skipped slot cannot be eaten:
 * the slot has to be re-marked first.
 */
export function applyDishAction(
  slot: SlotState,
  status: DishStatus,
  action: DishAction,
): DishTransition {
  if (status === "draft") return { ok: false, reason: "dish_is_draft" };
  if (action === "markEaten" && slot === "skipped") {
    return { ok: false, reason: "slot_skipped" };
  }
  return { ok: true, status: action === "markEaten" ? "eaten" : "not_eaten" };
}

export type RatingCheck =
  | { ok: true; rating: number }
  | { ok: false; reason: "rating_out_of_range" | "dish_not_eaten" };

/** A rating is an integer 1–5 and only applies to a dish that was eaten. */
export function validateRating(
  status: DishStatus,
  rating: number,
): RatingCheck {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, reason: "rating_out_of_range" };
  }
  if (status !== "eaten") return { ok: false, reason: "dish_not_eaten" };
  return { ok: true, rating };
}

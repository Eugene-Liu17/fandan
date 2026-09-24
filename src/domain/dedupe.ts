/**
 * Dedupe, first tier only (SPEC MVP item 5).
 *
 * A candidate for `targetDate` is excluded when, within `windowDays` days
 * before or after that date, the user ate
 * - the same dish (same recipe, or the same dish name eaten out), or
 * - a dish with the same specific main ingredient and flavor.
 * Dishes cooked at home and eaten out count the same way.
 */

import { diffDays, type PlainDate } from "./date";
import type { RecipeFeatures } from "./features";
import { normalizeName } from "./ingredients/normalize";
import type { RecipeCandidate } from "./recipe";

/** A `meal_dishes` row with status `eaten`, joined to its slot's date. */
export interface EatenDish {
  date: PlainDate;
  recipeId: string | null;
  dishName: string | null;
  features: RecipeFeatures | null;
  rating: number | null;
}

export type RepeatReason = "same_dish" | "same_main_and_flavor";

export interface Repeat {
  reason: RepeatReason;
  dish: EatenDish;
}

function assertWindow(windowDays: number): void {
  if (!Number.isInteger(windowDays) || windowDays < 0) {
    throw new RangeError(
      `windowDays must be a non-negative integer, got ${windowDays}`,
    );
  }
}

function isSameDish(candidate: RecipeCandidate, dish: EatenDish): boolean {
  if (dish.recipeId !== null && dish.recipeId === candidate.id) return true;
  return (
    dish.dishName !== null &&
    normalizeName(dish.dishName) === normalizeName(candidate.name)
  );
}

function isSameMainAndFlavor(
  candidate: RecipeCandidate,
  dish: EatenDish,
): boolean {
  const a = candidate.features;
  const b = dish.features;
  if (a === null || b === null) return false;
  if (a.main_ingredient === null || a.main_ingredient !== b.main_ingredient) {
    return false;
  }
  // "other" means the flavor is unknown, which is not evidence of a repeat.
  return a.flavor !== "other" && a.flavor === b.flavor;
}

/**
 * The eaten dish that makes `candidate` a repeat on `targetDate`, or null.
 * A same-dish match is reported ahead of a main-and-flavor match.
 * `windowDays` = 0 disables dedupe; 1 means the same day only.
 */
export function findRepeat(
  candidate: RecipeCandidate,
  targetDate: PlainDate,
  history: readonly EatenDish[],
  windowDays: number,
): Repeat | null {
  assertWindow(windowDays);
  const inWindow = history.filter(
    (dish) => Math.abs(diffDays(dish.date, targetDate)) < windowDays,
  );
  const sameDish = inWindow.find((dish) => isSameDish(candidate, dish));
  if (sameDish) return { reason: "same_dish", dish: sameDish };
  const similar = inWindow.find((dish) => isSameMainAndFlavor(candidate, dish));
  if (similar) return { reason: "same_main_and_flavor", dish: similar };
  return null;
}

export interface DedupeResult<T extends RecipeCandidate> {
  allowed: T[];
  excluded: { recipe: T; repeat: Repeat }[];
}

/** Splits `candidates` into those that are not repeats and those that are. */
export function dedupeCandidates<T extends RecipeCandidate>(
  candidates: readonly T[],
  targetDate: PlainDate,
  history: readonly EatenDish[],
  windowDays: number,
): DedupeResult<T> {
  assertWindow(windowDays);
  const result: DedupeResult<T> = { allowed: [], excluded: [] };
  for (const recipe of candidates) {
    const repeat = findRepeat(recipe, targetDate, history, windowDays);
    if (repeat === null) result.allowed.push(recipe);
    else result.excluded.push({ recipe, repeat });
  }
  return result;
}

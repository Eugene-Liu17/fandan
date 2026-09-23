/**
 * Household-derived defaults (ADR-006).
 */

/**
 * Default number of dishes per meal for a household of `householdSize`
 * people: 1 → 1, 2 → 2, 3–4 → 3, 5 or more → 4. The user can override it
 * (`users.dishes_per_meal`).
 */
export function defaultDishesPerMeal(householdSize: number): number {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new RangeError(
      `householdSize must be a positive integer, got ${householdSize}`,
    );
  }
  if (householdSize <= 2) return householdSize;
  if (householdSize <= 4) return 3;
  return 4;
}

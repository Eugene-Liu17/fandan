/**
 * Standard condiments (ADR-008): durable pantry staples assumed to be at
 * home, so they never appear on the shopping list. Scallion, ginger, and
 * garlic are fresh and run out, so they are deliberately not on this list.
 *
 * Being a standard condiment does not exempt an ingredient from allergy
 * filtering: soy sauce still carries its soy and wheat tags.
 */

import type { IngredientKey } from "./dictionary";

export const STANDARD_CONDIMENTS = [
  "cooking_oil",
  "salt",
  "sugar",
  "light_soy_sauce",
  "dark_soy_sauce",
  "vinegar",
  "cooking_wine",
  "oyster_sauce",
  "starch",
  "white_pepper",
  "chicken_bouillon",
] as const satisfies readonly IngredientKey[];

const CONDIMENT_SET: ReadonlySet<string> = new Set(STANDARD_CONDIMENTS);

/** True when `key` is a standard condiment. */
export function isStandardCondiment(key: string): boolean {
  return CONDIMENT_SET.has(key);
}

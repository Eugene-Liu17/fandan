/**
 * Test-only builders for domain rule tests. Not imported by production code.
 */

import type { RecipeFeatures } from "../features";
import type { RecipeCandidate, RecipeIngredient } from "../recipe";

/** `recipe("id", "name", ["五花肉", "生抽"])` — first ingredient is main. */
export function recipe(
  id: string,
  name: string,
  ingredientNames: string[],
  features: Partial<RecipeFeatures> | null = null,
): RecipeCandidate {
  const ingredients: RecipeIngredient[] = ingredientNames.map((raw, i) => ({
    raw_name: raw,
    key: null,
    role: i === 0 ? "main" : "supplementary",
  }));
  return {
    id,
    name,
    ingredients,
    features: features === null ? null : { ...defaultFeatures, ...features },
  };
}

export const defaultFeatures: RecipeFeatures = {
  role: "meat",
  cuisine: "home_style",
  method: "stir_fry",
  flavor: "savory",
  main_ingredient: null,
  oil_level: "medium",
};

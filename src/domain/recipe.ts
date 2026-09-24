/**
 * Recipe shapes shared by the domain rules.
 *
 * `recipeIngredientSchema` also validates the `recipes.ingredients` jsonb
 * column, so stored recipes and domain inputs have one definition.
 */

import { z } from "zod";
import { INGREDIENT_ROLES } from "./enums";
import type { RecipeFeatures } from "./features";
import type { IngredientKey } from "./ingredients/dictionary";
import { isIngredientKey, normalizeIngredient } from "./ingredients/normalize";

export const recipeIngredientSchema = z.object({
  /** The ingredient as written in the recipe source. */
  raw_name: z.string().trim().min(1),
  /** Dictionary key when the name was mapped at import time. */
  key: z
    .string()
    .refine(isIngredientKey, { message: "Not an ingredient dictionary key" })
    .nullable(),
  amount: z.string().optional(),
  role: z.enum(INGREDIENT_ROLES),
});

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

/** The part of a recipe the rules need. */
export interface RecipeCandidate {
  id: string;
  name: string;
  ingredients: readonly RecipeIngredient[];
  features: RecipeFeatures | null;
}

/**
 * The dictionary key for an ingredient: its stored key when valid,
 * otherwise whatever its raw name normalizes to, or null when unmapped.
 */
export function resolveIngredientKey(ingredient: {
  raw_name: string;
  /** Typed loosely: rows read from the database may carry a stale key. */
  key: string | null;
}): IngredientKey | null {
  if (ingredient.key !== null && isIngredientKey(ingredient.key)) {
    return ingredient.key;
  }
  const normalized = normalizeIngredient(ingredient.raw_name);
  return normalized.kind === "mapped" ? normalized.key : null;
}

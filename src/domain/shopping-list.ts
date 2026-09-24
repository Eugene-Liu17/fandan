/**
 * Shopping list for supplementary ingredients (SPEC MVP item 7):
 * confirmed recipe ingredients − pantry − standard condiments.
 *
 * A deterministic set difference over normalized ingredient identities,
 * never a model guess.
 */

import { isStandardCondiment } from "./ingredients/condiments";
import type { IngredientKey } from "./ingredients/dictionary";
import {
  getIngredient,
  isIngredientKey,
  normalizeIngredient,
  normalizeName,
} from "./ingredients/normalize";
import type { IngredientCategory } from "./ingredients/vocab";
import { type RecipeCandidate, resolveIngredientKey } from "./recipe";

/** An active `pantry_items` row (not removed). */
export interface PantryItem {
  ingredientKey: string | null;
  rawName: string;
}

export interface ShoppingItem {
  /** Dictionary key, or null for an ingredient the dictionary does not know. */
  key: IngredientKey | null;
  /** Canonical name when mapped, otherwise the normalized raw name. */
  name: string;
  category: IngredientCategory | null;
  /** Recipes that need this ingredient, in order of first appearance. */
  recipeIds: string[];
}

/**
 * The identity two ingredient mentions share when they are the same thing:
 * `key:<dictionary key>`, else `name:<normalized name>`; null when blank.
 */
export function ingredientIdentity(
  key: IngredientKey | null,
  rawName: string,
): string | null {
  if (key !== null) return `key:${key}`;
  const name = normalizeName(rawName);
  return name.length > 0 ? `name:${name}` : null;
}

/** Identities of everything in the pantry. */
export function pantryIdentities(pantry: readonly PantryItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of pantry) {
    let key: IngredientKey | null = null;
    if (item.ingredientKey !== null && isIngredientKey(item.ingredientKey)) {
      key = item.ingredientKey;
    } else {
      const normalized = normalizeIngredient(item.rawName);
      if (normalized.kind === "mapped") key = normalized.key;
    }
    const id = ingredientIdentity(key, item.rawName);
    if (id !== null) ids.add(id);
  }
  return ids;
}

export interface ShoppingListOptions {
  /** Which dictionary keys are assumed to be at home. */
  isCondiment?: (key: string) => boolean;
}

/** What still needs buying for `recipes`, given `pantry`. */
export function computeShoppingList(
  recipes: readonly RecipeCandidate[],
  pantry: readonly PantryItem[],
  { isCondiment = isStandardCondiment }: ShoppingListOptions = {},
): ShoppingItem[] {
  const have = pantryIdentities(pantry);
  const items = new Map<string, ShoppingItem>();

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = resolveIngredientKey(ingredient);
      if (key !== null && isCondiment(key)) continue;
      const id = ingredientIdentity(key, ingredient.raw_name);
      if (id === null || have.has(id)) continue;

      const existing = items.get(id);
      if (existing) {
        if (!existing.recipeIds.includes(recipe.id)) {
          existing.recipeIds.push(recipe.id);
        }
        continue;
      }
      const entry = key === null ? undefined : getIngredient(key);
      items.set(id, {
        key,
        name: entry?.name ?? normalizeName(ingredient.raw_name),
        category: entry?.category ?? null,
        recipeIds: [recipe.id],
      });
    }
  }
  return [...items.values()];
}

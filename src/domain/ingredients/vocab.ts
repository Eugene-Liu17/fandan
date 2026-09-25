/**
 * Allergen tags and ingredient categories (ADR-008).
 *
 * Allergen tags drive the hard allergy filter; categories drive diet rules
 * such as "no pork" and coarse grouping.
 */

export const ALLERGEN_TAGS = [
  "peanut",
  "tree_nut",
  "milk",
  "egg",
  "fish",
  "crustacean",
  "mollusc",
  "soy",
  "wheat",
  "sesame",
] as const;
export type AllergenTag = (typeof ALLERGEN_TAGS)[number];

export const INGREDIENT_CATEGORIES = [
  "pork",
  "beef",
  "lamb",
  "poultry",
  "fish",
  "shellfish",
  "egg",
  "soy_product",
  "vegetable",
  "fungus",
  "legume",
  "grain",
  "nut_seed",
  "dairy",
  "aromatic",
  "condiment",
  "beverage",
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

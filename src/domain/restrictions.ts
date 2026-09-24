/**
 * Allergy and restriction hard filter (SPEC core principle 3, ADR-008).
 *
 * The filter is conservative: when in doubt, exclude. A recipe violates a
 * restriction when
 * - an ingredient resolves to a dictionary entry the restriction covers, or
 * - an ingredient's raw name contains any name or alias the restriction
 *   covers (catches unmapped names such as 花生酱), or
 * - the recipe name contains such a term of two or more characters (a safety
 *   net for incomplete ingredient lists; single characters are skipped there
 *   so 鱼香肉丝 is not read as fish).
 * No recommendation path may bypass this: callers filter before scoring.
 */

import { z } from "zod";
import { INGREDIENTS, type IngredientEntry } from "./ingredients/dictionary";
import {
  getIngredient,
  isIngredientKey,
  normalizeIngredient,
  normalizeName,
} from "./ingredients/normalize";
import {
  ALLERGEN_TAGS,
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
} from "./ingredients/vocab";
import type { RecipeCandidate } from "./recipe";
import { resolveIngredientKey } from "./recipe";

/** Stored in `taste_facts.payload` for facts of type `restriction`. */
export const restrictionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("allergen"), tag: z.enum(ALLERGEN_TAGS) }),
  z.object({
    kind: z.literal("category"),
    category: z.enum(INGREDIENT_CATEGORIES),
  }),
  z.object({
    kind: z.literal("ingredient"),
    key: z
      .string()
      .refine(isIngredientKey, { message: "Not an ingredient dictionary key" }),
  }),
  /** Free text that could not be mapped to the dictionary. Never dropped. */
  z.object({ kind: z.literal("term"), text: z.string().trim().min(1) }),
]);

export type Restriction = z.infer<typeof restrictionSchema>;

/**
 * Extra search terms for categories whose products are often written in
 * ways the dictionary does not list (猪油, 猪骨汤, 羊蝎子 ...).
 */
export const CATEGORY_EXTRA_TERMS: Partial<
  Record<IngredientCategory, readonly string[]>
> = {
  pork: ["猪"],
  beef: ["牛肉", "牛骨", "牛油"],
  lamb: ["羊"],
  shellfish: ["贝"],
};

export interface Violation {
  restriction: Restriction;
  /** Where the match was found. */
  source: "ingredient" | "main_ingredient" | "recipe_name";
  /** The ingredient name or recipe name that matched. */
  matched: string;
}

interface Matcher {
  restriction: Restriction;
  coversEntry: (entry: IngredientEntry) => boolean;
  /** Normalized, non-empty search terms. */
  terms: string[];
}

const namesOf = (entry: IngredientEntry) => [entry.name, ...entry.aliases];

function compile(restriction: Restriction): Matcher {
  let coversEntry: (entry: IngredientEntry) => boolean;
  let rawTerms: string[];

  switch (restriction.kind) {
    case "allergen":
      coversEntry = (e) =>
        (e.allergens as readonly string[]).includes(restriction.tag);
      rawTerms = INGREDIENTS.filter(coversEntry).flatMap(namesOf);
      break;
    case "category":
      coversEntry = (e) => e.category === restriction.category;
      rawTerms = [
        ...INGREDIENTS.filter(coversEntry).flatMap(namesOf),
        ...(CATEGORY_EXTRA_TERMS[restriction.category] ?? []),
      ];
      break;
    case "ingredient": {
      const entry = getIngredient(restriction.key);
      coversEntry = (e) => e.key === restriction.key;
      rawTerms = entry ? namesOf(entry) : [];
      break;
    }
    case "term": {
      const mapped = normalizeIngredient(restriction.text);
      const entry =
        mapped.kind === "mapped" ? getIngredient(mapped.key) : undefined;
      coversEntry = (e) => entry !== undefined && e.key === entry.key;
      rawTerms = [restriction.text, ...(entry ? namesOf(entry) : [])];
      break;
    }
  }

  const terms = [...new Set(rawTerms.map(normalizeName))].filter(
    (t) => t.length > 0,
  );
  return { restriction, coversEntry, terms };
}

const MIN_RECIPE_NAME_TERM_LENGTH = 2;

function firstViolation(
  recipe: RecipeCandidate,
  matcher: Matcher,
): Violation | null {
  const { restriction, coversEntry, terms } = matcher;

  for (const ingredient of recipe.ingredients) {
    const key = resolveIngredientKey(ingredient);
    const entry = key === null ? undefined : getIngredient(key);
    const name = normalizeName(ingredient.raw_name);
    if (
      (entry !== undefined && coversEntry(entry)) ||
      terms.some((t) => name.includes(t))
    ) {
      return {
        restriction,
        source: "ingredient",
        matched: ingredient.raw_name,
      };
    }
  }

  const mainKey = recipe.features?.main_ingredient;
  const mainEntry = mainKey ? getIngredient(mainKey) : undefined;
  if (mainEntry !== undefined && coversEntry(mainEntry)) {
    return { restriction, source: "main_ingredient", matched: mainEntry.name };
  }

  const recipeName = normalizeName(recipe.name);
  if (
    terms.some(
      (t) =>
        [...t].length >= MIN_RECIPE_NAME_TERM_LENGTH && recipeName.includes(t),
    )
  ) {
    return { restriction, source: "recipe_name", matched: recipe.name };
  }

  return null;
}

/** Every restriction `recipe` violates (at most one violation each). */
export function findViolations(
  recipe: RecipeCandidate,
  restrictions: readonly Restriction[],
): Violation[] {
  return restrictions
    .map(compile)
    .map((m) => firstViolation(recipe, m))
    .filter((v): v is Violation => v !== null);
}

export interface RestrictionFilterResult<T extends RecipeCandidate> {
  allowed: T[];
  excluded: { recipe: T; violations: Violation[] }[];
}

/** Splits `recipes` into those that respect every restriction and those that do not. */
export function filterByRestrictions<T extends RecipeCandidate>(
  recipes: readonly T[],
  restrictions: readonly Restriction[],
): RestrictionFilterResult<T> {
  const matchers = restrictions.map(compile);
  const result: RestrictionFilterResult<T> = { allowed: [], excluded: [] };
  for (const recipe of recipes) {
    const violations = matchers
      .map((m) => firstViolation(recipe, m))
      .filter((v): v is Violation => v !== null);
    if (violations.length === 0) result.allowed.push(recipe);
    else result.excluded.push({ recipe, violations });
  }
  return result;
}
